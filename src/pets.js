/*
 * Voblox arcade game — 🐾 Pet Paradise.
 * Hatch eggs into 32 pets (with rare ✨SHINY✨ variants), train them by
 * answering words ("your pet studies with you!"), evolve them, and battle
 * 3v3 against AI trainers with a fire/water/leaf type triangle + a tap-timing
 * crit bar. Equip a pet as your buddy and it follows you into other games.
 * The Mythic egg unlocks by MASTERING the active lesson (90%+ predicted).
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;
  function S(id, emoji, name, type) { return { id: id, emoji: emoji, name: name, type: type }; }
  var EGGS = [
    { id: "basic", name: "Basic Egg", emoji: "🥚", price: 150, rarity: "common", pets: [
      S("dog", "🐶", "Pup", "leaf"), S("cat", "🐱", "Kitty", "fire"), S("bunny", "🐰", "Hopper", "leaf"),
      S("hamster", "🐹", "Nibbles", "leaf"), S("duck", "🦆", "Quackers", "water"), S("pig", "🐷", "Truffle", "leaf"),
      S("mouse", "🐭", "Peanut", "fire"), S("chick", "🐤", "Pip", "fire")] },
    { id: "spark", name: "Spark Egg", emoji: "🐣", price: 400, rarity: "rare", pets: [
      S("fox", "🦊", "Blaze-tail", "fire"), S("owl", "🦉", "Professor Hoot", "leaf"), S("penguin", "🐧", "Waddles", "water"),
      S("koala", "🐨", "Snoozy", "leaf"), S("raccoon", "🦝", "Bandit", "fire"), S("wolf", "🐺", "Luna-howl", "water"),
      S("frog", "🐸", "Ribbles", "water"), S("bee", "🐝", "Buzz", "leaf")] },
    { id: "royal", name: "Royal Egg", emoji: "🪺", price: 900, rarity: "epic", unlockLevel: 5, pets: [
      S("panda", "🐼", "Bamboo-boss", "leaf"), S("tiger", "🐯", "Stripes", "fire"), S("lion", "🦁", "King Fluff", "fire"),
      S("eagle", "🦅", "Skyclaw", "water"), S("octopus", "🐙", "Inky", "water"), S("polar", "🐻‍❄️", "Frostpaw", "water"),
      S("gorilla", "🦍", "Bigsy", "leaf"), S("shark", "🦈", "Chompers", "water")] },
    { id: "mythic", name: "Mythic Egg", emoji: "🌈", price: 1800, rarity: "legendary", needMastery: true, pets: [
      S("dragon", "🐉", "Ember-wing", "star"), S("unicorn", "🦄", "Stardust", "star"),
      S("phoenix", "🐦‍🔥", "Flare", "star"), S("trex", "🦖", "Rexy Prime", "star"),
      S("whale", "🐋", "Moonsong", "star"), S("alien", "👾", "Zorp", "star"),
      S("robot", "🤖", "Bolt-buddy", "star"), S("ghostcat", "🐈‍⬛", "Shadow", "star")] }
  ];
  var TYPE = { fire: { emoji: "🔥", beats: "leaf" }, water: { emoji: "💧", beats: "fire" }, leaf: { emoji: "🌿", beats: "water" }, star: { emoji: "⭐", beats: null } };
  function xpNeed(l) { return 20 + l * 15; }
  function power(p) { return (5 + p.level * 3) * (p.shiny ? 1.5 : 1) * (p.type === "star" ? 1.25 : 1); }
  function evoStage(p) { return p.level >= 10 ? 2 : p.level >= 5 ? 1 : 0; }

  function findSpec(species) {
    for (var e = 0; e < EGGS.length; e++) for (var i = 0; i < EGGS[e].pets.length; i++) if (EGGS[e].pets[i].id === species) return EGGS[e].pets[i];
    return EGGS[0].pets[0];
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("pets");
    var state = store.state;
    state.pets = state.pets || [];
    // migrate any old-shape pets defensively
    state.pets.forEach(function (p) { if (!p.emoji) { var sp = findSpec(p.species || p.id); p.emoji = sp.emoji; p.type = sp.type; } });

    var wrap = document.createElement("div"); wrap.className = "gamewrap pets";
    wrap.innerHTML =
      '<canvas id="ptcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="ptmsg">🐾 Pet Paradise</div>' +
      '<div class="grow"><span id="ptgems">💎 0</span>' +
      '<button class="replay" id="pteggs" type="button">🥚 Eggs</button>' +
      '<button class="replay" id="ptbattle" type="button">⚔️ Battle</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="ptbig"></div>' +
      '<div class="gover" id="ptq" style="display:none"></div>' +
      '<div class="gover" id="ptcard" style="display:none"></div>' +
      '<div class="runhint">Tap a pet to train, rename, or bring along!</div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#ptcv"), ctx = cv.getContext("2d");
    var W, H;
    function resize() { W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight; }
    resize(); window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var running = true, raf = 0, lastT = performance.now(), run = 0, lastFmt = null;
    var wander = []; // meadow positions
    function seedWander() {
      wander = state.pets.map(function (p, i) {
        var r = P.rng(100 + i);
        return { x: W * (0.12 + r() * 0.76), y: H * (0.45 + r() * 0.4), vx: 0, t: r() * 5 };
      });
    }
    seedWander();

    var msgEl = document.getElementById("ptmsg"), bigEl = document.getElementById("ptbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1000); }
    function hud() { document.getElementById("ptgems").innerHTML = '<img class="vbx" src="icons/vobux.png" alt="V"> ' + state.gems; }
    function card() { return document.getElementById("ptcard"); }
    function closeCard() { card().style.display = "none"; card().innerHTML = ""; }

    // ---------- eggs ----------
    document.getElementById("pteggs").onclick = function () {
      var mastery = store.predicted(words);
      var rows = EGGS.map(function (e, i) {
        var locked = (e.unlockLevel && state.level < e.unlockLevel) || (e.needMastery && mastery < 90);
        var why = e.unlockLevel && state.level < e.unlockLevel ? "Reach level " + e.unlockLevel :
          e.needMastery && mastery < 90 ? "Master the lesson (90%+) — now " + mastery + "%" : "";
        var rc = global.VobloxItems.RARITY[e.rarity];
        return '<button class="cc-opp" data-e="' + i + '" ' + (locked ? "disabled style='opacity:.55'" : "") + '>' +
          '<span class="cc-oname">' + e.emoji + " " + e.name + ' <span style="color:' + rc.color + ';font-size:12px">' + rc.label + "</span></span>" +
          '<span class="cc-otitle">' + (locked ? "🔒 " + why : e.price + ' <img class="vbx" src="icons/vobux.png" alt="Vobux">') + "</span></button>";
      }).join("");
      card().innerHTML = '<div class="wqcard"><div class="wqtitle">🥚 Hatch an egg! (you have ' + state.gems + ' <img class="vbx" src="icons/vobux.png" alt=""> Vobux)</div>' + rows +
        '<div class="muted2" style="margin-top:6px">✨ Every egg has a 1-in-20 SHINY chance!</div>' +
        '<button class="wqskip" id="ptx">close</button></div>';
      card().style.display = "flex";
      document.getElementById("ptx").onclick = closeCard;
      Array.prototype.forEach.call(card().querySelectorAll("[data-e]"), function (b) {
        b.onclick = function () { hatch(EGGS[parseInt(b.dataset.e, 10)]); };
      });
    };
    function hatch(egg) {
      if (state.gems < egg.price) { big("Not enough Vobux — answer words to earn more!", "#ff8a8a"); return; }
      state.gems -= egg.price;
      var sp = egg.pets[Math.floor(Math.random() * egg.pets.length)];
      var shiny = Math.random() < 0.05;
      var pet = { species: sp.id, emoji: sp.emoji, type: sp.type, name: sp.name, shiny: shiny, level: 1, xp: 0 };
      state.pets.push(pet);
      store.save(); seedWander(); hud();
      if (sfx) sfx.fanfare();
      var rc = global.VobloxItems.RARITY[egg.rarity];
      card().innerHTML = '<div class="wqcard" style="text-align:center"><div class="wqtitle">' + (shiny ? "✨ SHINY!! ✨" : "It hatched!") + '</div>' +
        '<div style="font-size:64px">' + (shiny ? "✨" : "") + sp.emoji + (shiny ? "✨" : "") + '</div>' +
        '<div style="font-weight:900;font-size:20px;color:#20303a">' + VQ.esc(sp.name) + "</div>" +
        '<div style="color:' + rc.color + ';font-weight:900">' + rc.label + " · " + TYPE[sp.type].emoji + " " + sp.type + "</div>" +
        '<button class="wqskip" id="ptx">Welcome home! 🎉</button></div>';
      card().style.display = "flex";
      document.getElementById("ptx").onclick = closeCard;
      if (juice) juice.burst(W / 2, H / 2, shiny ? "#ffe14d" : "#9be870", 20);
    }

    // ---------- pet panel (train / buddy / rename) ----------
    function petPanel(idx) {
      var p = state.pets[idx];
      var isBuddy = state.equipped.pet === "hatch:" + idx;
      var stage = evoStage(p);
      card().innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:' + (44 + stage * 12) + 'px">' + (p.shiny ? "✨" : "") + p.emoji + (stage >= 2 ? "👑" : stage >= 1 ? "⭐" : "") + '</div>' +
        '<div style="font-weight:900;font-size:19px;color:#20303a">' + VQ.esc(p.name) + (p.shiny ? " ✨" : "") + '</div>' +
        '<div class="muted2">' + TYPE[p.type].emoji + " " + p.type + " · Level " + p.level + " · power " + Math.round(power(p)) + "</div>" +
        '<div class="xpbar" style="max-width:220px;margin:6px auto"><div class="xpfill" style="width:' + Math.round(100 * p.xp / xpNeed(p.level)) + '%"></div><span>' + p.xp + "/" + xpNeed(p.level) + " XP</span></div>" +
        '<button class="ibtn" id="pttrain" style="font-size:14px;padding:8px 14px">📚 Study together (word!)</button> ' +
        '<button class="ibtn' + (isBuddy ? " on" : "") + '" id="ptbuddy" style="font-size:14px;padding:8px 14px">' + (isBuddy ? "✓ Your buddy" : "🎒 Bring along") + "</button>" +
        '<button class="wqskip" id="ptx">close</button></div>';
      card().style.display = "flex";
      document.getElementById("ptx").onclick = closeCard;
      document.getElementById("ptbuddy").onclick = function () {
        if (isBuddy) delete state.equipped.pet; else state.equipped.pet = "hatch:" + idx;
        store.save(); if (sfx) sfx.pop(); closeCard();
        big(isBuddy ? p.name + " stays home." : "🎒 " + p.name + " will follow you into games!", "#9fd6ff");
      };
      document.getElementById("pttrain").onclick = function () {
        closeCard();
        VQ.miniQuiz(document.getElementById("ptq"), words, store, {
          title: "📚 " + p.name + " is studying with you!",
          lastFormat: lastFmt,
          cb: function (ok, res, fmt) {
            lastFmt = fmt || lastFmt;
            if (ok) {
              p.xp += 12;
              var evoBefore = evoStage(p);
              while (p.xp >= xpNeed(p.level)) { p.xp -= xpNeed(p.level); p.level++; }
              store.save();
              var evoAfter = evoStage(p);
              if (evoAfter > evoBefore) { big("🌟 " + p.name + " EVOLVED!", "#ffe14d"); if (sfx) sfx.fanfare(); if (juice) juice.burst(W / 2, H / 2, "#ffe14d", 22); }
              else { big("📚 " + p.name + " +12 XP!" + (res && res.earned ? " (+" + res.earned + " 💎)" : ""), "#69f0ae"); if (sfx) sfx.chime(); }
            } else big(p.name + " tilts its head… try again!", "#ff8a8a");
            hud();
          }
        });
      };
    }

    // ---------- battles ----------
    var battle = null;
    document.getElementById("ptbattle").onclick = function () {
      if (state.pets.length < 1) { big("Hatch a pet first! 🥚", "#ffd740"); return; }
      var team = state.pets.slice().sort(function (a, b) { return power(b) - power(a); }).slice(0, 3);
      var trainer = Bots.pickOpponents(1, P.botSkillFor(stats.rankPts))[0];
      var avgLvl = Math.max(1, Math.round(team.reduce(function (a, p) { return a + p.level; }, 0) / team.length));
      var pool = EGGS[0].pets.concat(EGGS[1].pets);
      var foes = [0, 1, 2].map(function (i) {
        var sp = pool[Math.floor(Math.random() * pool.length)];
        return { species: sp.id, emoji: sp.emoji, type: sp.type, name: sp.name, shiny: false, level: Math.max(1, avgLvl + Math.round((trainer.skill - 0.4) * 4)), xp: 0 };
      });
      battle = { team: team.map(function (p) { return { p: p, hp: 30 + p.level * 6, max: 30 + p.level * 6 }; }),
                 foes: foes.map(function (p) { return { p: p, hp: 30 + p.level * 6, max: 30 + p.level * 6 }; }),
                 trainer: trainer, mi: 0, fi: 0, turn: "me", meterT: 0, waiting: false };
      renderBattle("⚔️ " + trainer.name + " challenges you! Tap a move — hit SPACE/tap when the bar is green for a CRIT!");
    };
    function alive(list) { return list.filter(function (u) { return u.hp > 0; }); }
    function typeMult(a, d) { return TYPE[a].beats === d ? 1.5 : TYPE[d].beats === a ? 0.7 : 1; }
    function renderBattle(msg) {
      if (!battle) return;
      var b = battle;
      var mine = b.team[b.mi], foe = b.foes[b.fi];
      function row(u, right) {
        return '<div style="display:flex;align-items:center;gap:8px;justify-content:' + (right ? "flex-end" : "flex-start") + ';margin:3px 0">' +
          '<span style="font-size:30px">' + (u.p.shiny ? "✨" : "") + u.p.emoji + '</span><div>' +
          '<div style="font-weight:900;font-size:13px;color:#20303a">' + VQ.esc(u.p.name) + " L" + u.p.level + " " + TYPE[u.p.type].emoji + "</div>" +
          '<div style="width:120px;height:8px;background:#0002;border-radius:5px"><div style="width:' + Math.round(100 * Math.max(0, u.hp) / u.max) + '%;height:100%;border-radius:5px;background:' + (u.hp / u.max > 0.4 ? "#2f9e44" : "#e05252") + '"></div></div>' +
          "</div></div>";
      }
      card().innerHTML = '<div class="wqcard"><div class="wqtitle">⚔️ vs ' + VQ.esc(b.trainer.name) + "</div>" +
        '<div style="display:flex;justify-content:space-between"><div>' + b.team.map(function (u, i) { return i === b.mi ? "<b>" + row(u) + "</b>" : row(u); }).join("") + "</div>" +
        "<div>" + b.foes.map(function (u, i) { return i === b.fi ? "<b>" + row(u, true) + "</b>" : row(u, true); }).join("") + "</div></div>" +
        '<div class="cc-pmsg" style="color:#20303a;font-weight:bold">' + msg + "</div>" +
        (b.turn === "me" && !b.waiting ?
          '<div class="bjrow"><button class="bjcard" data-mv="0"><span class="bjemoji">💥</span><span class="bjname">Big Attack</span><span class="bjodds">timing!</span></button>' +
          '<button class="bjcard" data-mv="1"><span class="bjemoji">🎯</span><span class="bjname">Quick Hit</span><span class="bjodds">safe</span></button>' +
          '<button class="bjcard" data-mv="2"><span class="bjemoji">💚</span><span class="bjname">Rest</span><span class="bjodds">+heal</span></button></div>' : "") +
        '<button class="wqskip" id="ptrun">🏃 Run away</button></div>';
      card().style.display = "flex";
      document.getElementById("ptrun").onclick = function () { battle = null; closeCard(); };
      Array.prototype.forEach.call(card().querySelectorAll("[data-mv]"), function (btn) {
        btn.onclick = function () { myMove(parseInt(btn.dataset.mv, 10)); };
      });
    }
    function myMove(mv) {
      var b = battle; if (!b || b.turn !== "me") return;
      var mine = b.team[b.mi], foe = b.foes[b.fi];
      if (mv === 2) {
        mine.hp = Math.min(mine.max, mine.hp + 12);
        endMyTurn("💚 " + mine.p.name + " rests (+12)!");
        return;
      }
      if (mv === 0) {
        // timing bar: tap again inside the green zone
        b.waiting = true; b.meterT = 0;
        renderBattle("⏳ Tap NOW when the bar is in the GREEN!");
        var bar = document.createElement("div");
        bar.className = "xpbar"; bar.style.cssText = "max-width:260px;margin:8px auto";
        bar.innerHTML = '<div class="xpfill" id="ptmeter" style="width:0%;background:linear-gradient(90deg,#e05252,#ffd740,#2f9e44,#ffd740,#e05252)"></div><span>TAP!</span>';
        card().querySelector(".wqcard").insertBefore(bar, card().querySelector("#ptrun"));
        var t0 = performance.now();
        function tick() {
          if (!battle || !b.waiting) return;
          var el = document.getElementById("ptmeter");
          if (!el) return;
          var f = ((performance.now() - t0) / 1400) % 1;
          el.style.width = Math.round(f * 100) + "%";
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        function commit() {
          if (!battle || !b.waiting) return;
          b.waiting = false;
          var f = ((performance.now() - t0) / 1400) % 1;
          var crit = f > 0.38 && f < 0.62;
          var dmg = Math.round(power(mine.p) * 1.3 * typeMult(mine.p.type, foe.p.type) * (crit ? 1.6 : 0.9));
          foe.hp -= dmg;
          card().removeEventListener("mousedown", commit); document.removeEventListener("keydown", keyCommit);
          endMyTurn((crit ? "💥 CRIT! " : "💥 ") + mine.p.name + " hits for " + dmg + "!");
        }
        function keyCommit(e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); commit(); } }
        card().addEventListener("mousedown", commit);
        card().addEventListener("touchstart", commit, { passive: true });
        document.addEventListener("keydown", keyCommit);
        return;
      }
      var dmg2 = Math.round(power(mine.p) * typeMult(mine.p.type, foe.p.type));
      foe.hp -= dmg2;
      endMyTurn("🎯 " + mine.p.name + " hits for " + dmg2 + "!");
    }
    function endMyTurn(msg) {
      var b = battle;
      if (alive(b.foes).length === 0) return winBattle();
      if (b.foes[b.fi].hp <= 0) b.fi = b.foes.findIndex(function (u) { return u.hp > 0; });
      b.turn = "foe";
      renderBattle(msg);
      setTimeout(function () {
        if (!battle) return;
        var foe = b.foes[b.fi], mine = b.team[b.mi];
        var dmg = Math.round(power(foe.p) * typeMult(foe.p.type, mine.p.type) * (0.75 + b.trainer.skill * 0.5));
        mine.hp -= dmg;
        var m2 = "🤖 " + foe.p.name + " hits " + mine.p.name + " for " + dmg + "!";
        if (mine.hp <= 0) {
          var next = b.team.findIndex(function (u) { return u.hp > 0; });
          if (next === -1) return loseBattle();
          b.mi = next; m2 += " 😵 Go, " + b.team[next].p.name + "!";
        }
        b.turn = "me";
        renderBattle(m2 + " Your move!");
      }, 900);
    }
    function winBattle() {
      var b = battle; battle = null;
      b.team.forEach(function (u) { u.p.xp += 10; while (u.p.xp >= xpNeed(u.p.level)) { u.p.xp -= xpNeed(u.p.level); u.p.level++; } });
      var res = store.recordGame("pets", { win: true, score: b.team.length, rankPtsDelta: 10, xp: 22, gems: 25 });
      store.save(); hud();
      card().innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:44px">🏆</div>' +
        '<div class="wqtitle">You beat ' + VQ.esc(b.trainer.name) + "!</div>" +
        '<div class="muted2">+25 💎 · every pet +10 XP' + (res.rankedUp ? " · " + res.newRank.icon + " " + res.newRank.name + "!" : "") + "</div>" +
        '<button class="wqskip" id="ptx">🎉</button></div>';
      card().style.display = "flex";
      document.getElementById("ptx").onclick = closeCard;
      if (sfx) sfx.fanfare();
    }
    function loseBattle() {
      var b = battle; battle = null;
      store.recordGame("pets", { win: false, score: 0, rankPtsDelta: 2, xp: 8, gems: 5 });
      hud();
      card().innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:44px">💫</div>' +
        '<div class="wqtitle">' + VQ.esc(b.trainer.name) + " wins this one!</div>" +
        '<div class="muted2">Train your pets with words and try again!</div>' +
        '<button class="wqskip" id="ptx">Okay!</button></div>';
      card().style.display = "flex";
      document.getElementById("ptx").onclick = closeCard;
      if (sfx) sfx.buzz();
    }

    // ---------- meadow ----------
    cv.addEventListener("touchstart", function (e) { var r = cv.getBoundingClientRect(); tapMeadow(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top); }, { passive: true });
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); tapMeadow(e.clientX - r.left, e.clientY - r.top); });
    function tapMeadow(x, y) {
      if (card().style.display === "flex") return;
      for (var i = 0; i < state.pets.length; i++) {
        var w2 = wander[i]; if (!w2) continue;
        if (Math.hypot(w2.x - x, w2.y - y) < 40) { petPanel(i); return; }
      }
    }
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      run += dt;
      wander.forEach(function (w2, i) {
        w2.t -= dt;
        if (w2.t <= 0) { w2.t = 2 + Math.random() * 4; w2.vx = (Math.random() - 0.5) * 50; }
        w2.x = Math.max(30, Math.min(W - 30, w2.x + w2.vx * dt));
      });
      if (juice) juice.update(dt);
      draw();
    }
    function draw() {
      ctx.save();
      var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#8ecbff"); sky.addColorStop(1, "#c8f0d8");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.4);
      ctx.fillStyle = "#6cc24a"; ctx.fillRect(0, H * 0.38, W, H);
      ctx.font = "22px serif"; ctx.textAlign = "center";
      for (var d = 0; d < 8; d++) { var r = P.rng(50 + d); ctx.fillText(["🌼", "🌷", "🌳", "🍄"][d % 4], r() * W, H * (0.42 + r() * 0.5)); }
      ctx.font = "26px serif"; ctx.fillText("🏠", W * 0.9, H * 0.34);
      if (!state.pets.length) {
        ctx.font = "bold " + Math.round(H * 0.035) + "px Trebuchet MS, sans-serif"; ctx.fillStyle = "#20303a";
        ctx.fillText("Your meadow is empty — tap 🥚 Eggs to hatch your first pet!", W / 2, H * 0.5);
      }
      state.pets.forEach(function (p, i) {
        var w2 = wander[i]; if (!w2) return;
        var stage = evoStage(p);
        var sz = Math.round(H * (0.055 + stage * 0.012) * (p.shiny ? 1.15 : 1));
        ctx.font = sz + "px serif";
        var bob = Math.sin(run * 3 + i) * 3;
        if (p.shiny) ctx.fillText("✨", w2.x - sz * 0.7, w2.y - sz * 0.5 + bob);
        ctx.fillText(p.emoji, w2.x, w2.y + bob);
        if (stage >= 1) ctx.fillText(stage >= 2 ? "👑" : "⭐", w2.x + sz * 0.6, w2.y - sz * 0.6 + bob);
        ctx.font = "bold 12px Trebuchet MS, sans-serif";
        ctx.fillStyle = "#00000066"; ctx.fillText(p.name + " L" + p.level, w2.x + 1, w2.y + sz * 0.62 + 1);
        ctx.fillStyle = state.equipped.pet === "hatch:" + i ? "#ffe14d" : "#fff";
        ctx.fillText(p.name + " L" + p.level, w2.x, w2.y + sz * 0.62);
      });
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    function cleanup() {
      running = false; cancelAnimationFrame(raf); VQ.shush();
      window.removeEventListener("resize", resize);
      if (wrap.parentNode) wrap.remove();
    }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    document.getElementById("quit").onclick = leave;

    msgEl.innerHTML = "🐾 <b>Pet Paradise</b> — " + (state.pets.length ? state.pets.length + " pets live here!" : "hatch your first egg!");
    hud();
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxPets = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
