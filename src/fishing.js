/*
 * Voblox arcade game — 🎣 Fishing Frenzy.
 * Cast (tap to lock the power meter), wait for the "❗", tap to hook, then HOLD
 * to keep the bobber inside the fish zone until the catch bar fills. 40 species
 * across 4 waters (higher ranks unlock wilder waters), a Fishdex collection log,
 * word questions to hook the epic/legendary ones, and 3-minute tournaments
 * against AI anglers. Fish sell for gems at the end of the session.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;

  function S(id, name, emoji, rarity, min, max) { return { id: id, name: name, emoji: emoji, rarity: rarity, min: min, max: max }; }
  var WATERS = [
    { id: "pond", name: "Sunny Pond", emoji: "🏞️", at: 0, sky: ["#9fd6ff", "#e3f3ff"], water: ["#4aa3d8", "#2f86b8"], fish: [
      S("minnow", "Minnow", "🐟", "common", 4, 9), S("bluegill", "Bluegill", "🐟", "common", 8, 18),
      S("perch", "Perch", "🐟", "common", 10, 22), S("sunny", "Sunfish", "🐠", "common", 8, 16),
      S("frog", "Bog Frog", "🐸", "common", 6, 12), S("koi", "Koi", "🐠", "rare", 20, 45),
      S("bass", "Big Bass", "🐟", "rare", 25, 55), S("snapper", "Snapping Turtle", "🐢", "rare", 20, 40),
      S("goldkoi", "Golden Koi", "🐠", "epic", 35, 70), S("kingtoad", "King Toad", "🐸", "legendary", 30, 60)] },
    { id: "river", name: "Rushing River", emoji: "🏔️", at: 20, sky: ["#a8e0d0", "#e8fff5"], water: ["#3d9bbf", "#2a7a99"], fish: [
      S("dace", "Dace", "🐟", "common", 6, 14), S("trout", "Rainbow Trout", "🐟", "common", 15, 35),
      S("crawdad", "Crawdad", "🦞", "common", 6, 14), S("smelt", "Smelt", "🐟", "common", 5, 12),
      S("eel", "River Eel", "🪱", "common", 30, 70), S("salmon", "Salmon", "🐟", "rare", 40, 90),
      S("catfish", "Catfish", "🐟", "rare", 35, 80), S("beaver", "Beaver (oops!)", "🦫", "rare", 60, 90),
      S("steel", "Steelhead", "🐟", "epic", 50, 100), S("riverking", "River King Sturgeon", "🐟", "legendary", 90, 200)] },
    { id: "ocean", name: "Big Blue Ocean", emoji: "🌊", at: 50, sky: ["#7ec8ff", "#d0ecff"], water: ["#2a6fd0", "#1a4fa0"], fish: [
      S("clown", "Clownfish", "🐠", "common", 6, 12), S("crab", "Crab", "🦀", "common", 8, 20),
      S("herring", "Herring", "🐟", "common", 12, 25), S("seahorse", "Seahorse", "🐡", "common", 5, 12),
      S("puffer", "Pufferfish", "🐡", "rare", 15, 35), S("squid", "Squid", "🦑", "rare", 25, 60),
      S("octo", "Octopus", "🐙", "rare", 40, 90), S("tuna", "Giant Tuna", "🐟", "epic", 80, 180),
      S("shark", "Reef Shark", "🦈", "epic", 120, 250), S("whale", "Baby Whale", "🐋", "legendary", 200, 400)] },
    { id: "mystic", name: "Mystic Lake", emoji: "🌌", at: 100, sky: ["#6b5aa8", "#b8a0e8"], water: ["#4a3b8b", "#2a1f5b"], fish: [
      S("glow", "Glowfish", "✨", "common", 8, 18), S("moonjelly", "Moon Jelly", "🪼", "common", 10, 25),
      S("starfish", "Wishing Star", "⭐", "common", 8, 15), S("bat", "Lake Bat (?!)", "🦇", "rare", 15, 30),
      S("ghost", "Ghost Fish", "👻", "rare", 20, 45), S("crystal", "Crystal Crab", "💠", "rare", 15, 35),
      S("rainboweel", "Rainbow Eel", "🌈", "epic", 60, 130), S("phoenix", "Phoenix Fish", "🔥", "epic", 50, 110),
      S("gemturtle", "Gem Turtle", "🐢", "epic", 40, 90), S("dragon", "Water Dragon", "🐉", "legendary", 150, 300)] }
  ];
  var RVAL = { common: 6, rare: 18, epic: 45, legendary: 120 };
  var RWEIGHT = { common: 62, rare: 26, epic: 9.5, legendary: 2.5 };
  var ZONE_H = { common: 0.30, rare: 0.24, epic: 0.19, legendary: 0.155 };
  var NEED_S = { common: 2.6, rare: 3.6, epic: 4.8, legendary: 6.2 };

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("fishing");
    if (!stats.dex) stats.dex = {};
    var wrap = document.createElement("div"); wrap.className = "gamewrap fishing";
    wrap.innerHTML =
      '<canvas id="fcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="fmsg">🎣 Fishing Frenzy</div>' +
      '<div class="grow"><span id="fgems">💰 0</span><span id="fbest" style="display:none"></span>' +
      '<button class="replay" id="fdex" type="button" title="Fishdex">📖</button>' +
      '<button class="replay" id="ftour" type="button" title="Tournament">🏆</button>' +
      '<button class="bossquit" id="quit">Done</button></div>' +
      '<div class="grow" id="fwaters"></div></div>' +
      '<div class="gmsg" id="fbig"></div>' +
      '<div class="gover" id="fq" style="display:none"></div>' +
      '<div class="gover" id="fcard" style="display:none"></div>' +
      '<div class="runhint" id="fhint">Tap to cast!</div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#fcv"), ctx = cv.getContext("2d");
    var W, H, WY, DOCKX;
    function resize() { W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight; WY = H * 0.52; DOCKX = W * 0.16; }
    resize(); window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var myCfg = AV.resolve(store.state);
    var rod = (function () { var g = store.state.equipped["gear.fishing"]; var it = g && global.VobloxItems ? global.VobloxItems.byId[g] : null; return it ? it.emoji : "🎣"; })();

    var running = true, raf = 0, lastT = performance.now(), run = 0;
    var water = WATERS[0];
    var state = "idle"; // idle -> cast -> wait -> bite -> reel (word gate for epics) -> idle
    var meter = 0, meterDir = 1, castPow = 0, bobber = null, biteAt = 0, biteWin = 0, fish = null;
    var reel = { i: 0.5, vi: 0, z: 0.5, vz: 0, prog: 0.3 };
    var held = false, sessionGems = 0, catches = 0, newSpecies = 0, bestVal = 0, lastFmt = null;
    // tournament
    var tour = null; // {t, me, bots:[{bot, score, nextAt}]}

    var msgEl = document.getElementById("fmsg"), bigEl = document.getElementById("fbig"), hintEl = document.getElementById("fhint");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 950); }
    function hud() {
      document.getElementById("fgems").textContent = "💰 " + sessionGems;
      var wEl = document.getElementById("fwaters");
      wEl.innerHTML = WATERS.map(function (w) {
        var locked = stats.rankPts < w.at;
        return '<button class="wtab' + (w === water ? " on" : "") + (locked ? " locked" : "") + '" data-w="' + w.id + '">' +
          w.emoji + " " + (locked ? "🔒 " + P.gameRank(w.at).name : w.name) + "</button>";
      }).join("");
      Array.prototype.forEach.call(wEl.querySelectorAll(".wtab"), function (b) {
        b.onclick = function () {
          var w = WATERS.filter(function (x) { return x.id === b.dataset.w; })[0];
          if (stats.rankPts < w.at) { big("🔒 Reach " + P.gameRank(w.at).name + " rank to fish here!", "#ffd740"); return; }
          water = w; state = "idle"; bobber = null; fish = null; hintEl.textContent = "Tap to cast!";
          msgEl.innerHTML = w.emoji + " <b>" + w.name + "</b>";
        };
      });
    }

    // ---- fish picking ----
    function pickFish() {
      var roll = Math.random() * 100, rarity = "common";
      if (roll < RWEIGHT.legendary + castPow * 1.5) rarity = "legendary";
      else if (roll < RWEIGHT.legendary + RWEIGHT.epic + castPow * 3) rarity = "epic";
      else if (roll < RWEIGHT.legendary + RWEIGHT.epic + RWEIGHT.rare + castPow * 5) rarity = "rare";
      var pool = water.fish.filter(function (f) { return f.rarity === rarity; });
      var sp = pool[Math.floor(Math.random() * pool.length)] || water.fish[0];
      var size = Math.round(sp.min + Math.random() * (sp.max - sp.min) * (0.6 + castPow * 0.4));
      var value = Math.round(RVAL[sp.rarity] * (0.7 + size / sp.max));
      return { sp: sp, size: size, value: value };
    }

    // ---- state transitions ----
    function cast() {
      castPow = meter;
      state = "wait";
      var bx = DOCKX + W * 0.14 + castPow * W * 0.55;
      bobber = { x: Math.min(W * 0.92, bx), y: WY + 6 };
      biteAt = run + 1.2 + Math.random() * 3.2 * (1.1 - castPow * 0.4);
      hintEl.textContent = "Wait for the ❗ …";
      if (sfx) sfx.whoosh();
      if (juice) juice.burst(bobber.x, WY, "#cfe8ff", 6);
    }
    function bite() {
      state = "bite"; biteWin = run + 0.8;
      fish = pickFish();
      hintEl.textContent = "❗ TAP NOW!";
      if (sfx) sfx.pop();
    }
    function hook() {
      if (fish.sp.rarity === "epic" || fish.sp.rarity === "legendary") {
        state = "question";
        big((fish.sp.rarity === "legendary" ? "🌟 LEGENDARY" : "💜 EPIC") + " fish — set the hook with a word!", "#ffe14d");
        VQ.miniQuiz(document.getElementById("fq"), words, store, {
          title: "🎣 It's a " + fish.sp.rarity.toUpperCase() + " one! Answer to hook it!",
          lastFormat: lastFmt,
          cb: function (ok, res, fmt) {
            lastFmt = fmt;
            if (ok) { startReel(); big("HOOKED! Hold to reel!", "#69f0ae"); }
            else { state = "idle"; bobber = null; hintEl.textContent = "It got away… tap to cast again!"; big("💨 It slipped away!", "#ff8a8a"); }
          }
        });
      } else startReel();
    }
    function startReel() {
      state = "reel";
      reel = { i: 0.5, vi: 0, z: 0.5, vz: 0, prog: 0.34 };
      hintEl.textContent = "HOLD to lift • keep the bobber on the fish!";
      if (sfx) sfx.chime();
    }
    function caught() {
      state = "idle"; bobber = null;
      catches++; sessionGems += fish.value; bestVal = Math.max(bestVal, fish.value);
      var d = stats.dex[fish.sp.id];
      var isNew = !d;
      if (!d) { stats.dex[fish.sp.id] = { n: 1, best: fish.size }; newSpecies++; }
      else { d.n++; if (fish.size > d.best) d.best = fish.size; }
      store.save();
      if (tour) tour.me += fish.value;
      hud();
      if (sfx) sfx.coin(); if (juice) { juice.burst(W / 2, H / 2, "#ffd740", 18); juice.shake(fish.sp.rarity === "legendary" ? 10 : 5); }
      var rc = global.VobloxItems ? global.VobloxItems.RARITY[fish.sp.rarity] : { color: "#fff", label: fish.sp.rarity };
      var fc = document.getElementById("fcard");
      fc.innerHTML = '<div class="wqcard" style="text-align:center"><div class="wqtitle">' + (isNew ? "🆕 NEW SPECIES!" : "Caught!") + '</div>' +
        '<div style="font-size:56px;line-height:1.1">' + fish.sp.emoji + '</div>' +
        '<div style="font-weight:900;font-size:20px;color:#20303a">' + VQ.esc(fish.sp.name) + '</div>' +
        '<div style="color:' + rc.color + ';font-weight:900">' + rc.label + " · " + fish.size + ' cm</div>' +
        '<div style="color:#2f9e44;font-weight:900;font-size:18px;margin-top:4px">+' + fish.value + " 💰</div>" +
        '<button class="wqskip" id="fok">Keep fishing 🎣</button></div>';
      fc.style.display = "flex";
      document.getElementById("fok").onclick = function () { fc.style.display = "none"; fc.innerHTML = ""; hintEl.textContent = "Tap to cast!"; };
      hintEl.textContent = "";
    }
    function escape(msg) {
      state = "idle"; bobber = null;
      big(msg || "💨 It got away!", "#ff8a8a"); if (sfx) sfx.buzz();
      hintEl.textContent = "Tap to cast again!";
    }

    // ---- Fishdex ----
    document.getElementById("fdex").onclick = function () {
      var fc = document.getElementById("fcard");
      var rows = WATERS.map(function (w) {
        var cells = w.fish.map(function (sp) {
          var d = stats.dex[sp.id];
          var rc = global.VobloxItems ? global.VobloxItems.RARITY[sp.rarity].color : "#888";
          return '<div class="dexcell" style="border-color:' + rc + '">' +
            (d ? '<div class="dexe">' + sp.emoji + '</div><div class="dexn">' + VQ.esc(sp.name) + '</div><div class="dexs">×' + d.n + " · " + d.best + "cm</div>"
               : '<div class="dexe">❓</div><div class="dexn">???</div><div class="dexs">&nbsp;</div>') + "</div>";
        }).join("");
        return '<div class="wqtitle" style="margin-top:8px">' + w.emoji + " " + w.name + '</div><div class="dexgrid">' + cells + "</div>";
      }).join("");
      var total = Object.keys(stats.dex).length;
      fc.innerHTML = '<div class="wqcard" style="max-height:78vh;overflow:auto"><div class="wqtitle">📖 Fishdex — ' + total + " / 40</div>" + rows +
        '<button class="wqskip" id="fok">Close</button></div>';
      fc.style.display = "flex";
      document.getElementById("fok").onclick = function () { fc.style.display = "none"; fc.innerHTML = ""; };
    };

    // ---- tournament ----
    document.getElementById("ftour").onclick = function () {
      if (tour) return;
      var rivals = Bots.pickOpponents(2, P.botSkillFor(stats.rankPts));
      tour = { t: 180, me: 0, bots: rivals.map(function (b) { return { bot: b, score: 0, nextAt: run + 6 + (1 - b.skill) * 10 }; }) };
      sessionGems = 0; catches = 0; bestVal = 0; hud();
      big("🏆 3-minute tournament — GO!", "#ffe14d");
      if (sfx) sfx.fanfare();
    };

    // ---- input ----
    function press() {
      if (state === "idle") { state = "cast"; meter = 0; meterDir = 1; hintEl.textContent = "Tap again to lock the power!"; }
      else if (state === "cast") cast();
      else if (state === "bite") hook();
      else if (state === "wait") { /* patience, fisher */ }
    }
    cv.addEventListener("touchstart", function () { held = true; press(); }, { passive: true });
    cv.addEventListener("touchend", function () { held = false; }, { passive: true });
    cv.addEventListener("mousedown", function () { held = true; press(); });
    window.addEventListener("mouseup", mouseUp);
    function mouseUp() { held = false; }
    function onKey(e) {
      var k = (e.key || "").toLowerCase();
      if (k === " " || k === "enter") { e.preventDefault(); if (!held) press(); held = true; }
    }
    function onKeyUp(e) { var k = (e.key || "").toLowerCase(); if (k === " " || k === "enter") held = false; }
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);

    // ---- frame ----
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      run += dt;
      if (state !== "question") {
        if (state === "cast") { meter += meterDir * dt * 1.5; if (meter > 1) { meter = 1; meterDir = -1; } if (meter < 0) { meter = 0; meterDir = 1; } }
        if (state === "wait" && run >= biteAt) bite();
        if (state === "bite" && run > biteWin) escape("Too slow — it spat the hook!");
        if (state === "reel") {
          // player bobber: hold lifts, gravity sinks
          reel.vi += (held ? -2.6 : 2.2) * dt; reel.vi *= 0.94;
          reel.i += reel.vi * dt * 2.2;
          if (reel.i < 0) { reel.i = 0; reel.vi *= -0.3; } if (reel.i > 1) { reel.i = 1; reel.vi *= -0.3; }
          // fish zone swims
          reel.vz += (Math.random() - 0.5) * dt * (2.2 + (RVAL[fish.sp.rarity] / 40));
          reel.vz = Math.max(-0.9, Math.min(0.9, reel.vz));
          reel.z += reel.vz * dt; if (reel.z < 0.08) { reel.z = 0.08; reel.vz *= -1; } if (reel.z > 0.92) { reel.z = 0.92; reel.vz *= -1; }
          var zh = ZONE_H[fish.sp.rarity];
          var inZone = Math.abs(reel.i - reel.z) < zh / 2;
          reel.prog += (inZone ? dt / NEED_S[fish.sp.rarity] : -dt * 0.28);
          if (inZone && sfx && Math.random() < dt * 2) sfx.tone(700 + reel.prog * 400, 0.03, "sine", 0.02);
          if (reel.prog >= 1) caught();
          else if (reel.prog <= 0) escape("The line snapped loose!");
        }
        if (tour) {
          tour.t -= dt;
          tour.bots.forEach(function (tb) {
            if (run >= tb.nextAt) {
              tb.score += Math.round(8 + tb.bot.skill * 30 + Math.random() * 14);
              tb.nextAt = run + 7 + (1 - tb.bot.skill) * 12 + Math.random() * 6;
            }
          });
          if (tour.t <= 0) endTournament();
        }
      }
      if (juice) juice.update(dt);
      draw();
    }

    function endTournament() {
      var standings = [{ name: store.state.profile.name, score: tour.me, me: true }]
        .concat(tour.bots.map(function (tb) { return { name: tb.bot.name, score: tb.score }; }))
        .sort(function (a, b) { return b.score - a.score; });
      var place = standings.findIndex(function (s) { return s.me; }) + 1;
      tour = null;
      var pts = place === 1 ? 18 : place === 2 ? 8 : 3;
      big(place === 1 ? "🥇 You WIN the tournament!" : place === 2 ? "🥈 2nd place!" : "🥉 3rd place!", "#ffe14d");
      if (sfx && place === 1) sfx.fanfare();
      var fc = document.getElementById("fcard");
      fc.innerHTML = '<div class="wqcard" style="text-align:center"><div class="wqtitle">🏆 Tournament results</div>' +
        standings.map(function (s, i) {
          return '<div style="font-weight:' + (s.me ? 900 : 600) + ';color:#20303a;font-size:16px;margin:3px 0">' +
            ["🥇", "🥈", "🥉"][i] + " " + VQ.esc(s.name) + " — " + s.score + " 💰" + (s.me ? " (you!)" : "") + "</div>";
        }).join("") +
        '<div style="color:#2f9e44;font-weight:900;margin-top:6px">+' + pts + " rank pts</div>" +
        '<button class="wqskip" id="fok">Nice!</button></div>';
      fc.style.display = "flex";
      stats.rankPts += pts; store.save(); hud();
      document.getElementById("fok").onclick = function () { fc.style.display = "none"; fc.innerHTML = ""; };
    }

    // ---- drawing ----
    function draw() {
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      var sky = ctx.createLinearGradient(0, 0, 0, WY); sky.addColorStop(0, water.sky[0]); sky.addColorStop(1, water.sky[1]);
      ctx.fillStyle = sky; ctx.fillRect(-10, -10, W + 20, WY + 10);
      var wat = ctx.createLinearGradient(0, WY, 0, H); wat.addColorStop(0, water.water[0]); wat.addColorStop(1, water.water[1]);
      ctx.fillStyle = wat; ctx.fillRect(-10, WY, W + 20, H - WY + 10);
      // gentle waves
      ctx.strokeStyle = "#ffffff33"; ctx.lineWidth = 2;
      for (var wv = 0; wv < 3; wv++) {
        ctx.beginPath();
        for (var x = 0; x <= W; x += 14) ctx.lineTo(x, WY + 14 + wv * 22 + Math.sin(run * 1.4 + x * 0.02 + wv) * 3);
        ctx.stroke();
      }
      // dock
      ctx.fillStyle = "#8a5a3b"; ctx.fillRect(-10, WY - 14, DOCKX + 40, 14);
      ctx.fillStyle = "#6d4429"; ctx.fillRect(DOCKX + 14, WY, 10, H * 0.2); ctx.fillRect(10, WY, 10, H * 0.2);
      // Leo sits on the dock with his rod (and pet buddy)
      AV.draw(ctx, { x: DOCKX - 14, y: WY - 12, size: H * 0.16, config: myCfg, pose: "sit", frame: run, name: store.state.profile.name, heldOverride: rod });
      if (myCfg.pet) { ctx.font = Math.round(H * 0.05) + "px serif"; ctx.textAlign = "center"; ctx.fillText(myCfg.pet, DOCKX - 14 - W * 0.055, WY - 18); }
      // line + bobber
      if (bobber) {
        ctx.strokeStyle = "#ffffffaa"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(DOCKX + 10, WY - H * 0.14); ctx.quadraticCurveTo((DOCKX + bobber.x) / 2, WY - H * 0.18, bobber.x, bobber.y); ctx.stroke();
        var bob = Math.sin(run * 3) * 2 + (state === "bite" ? Math.sin(run * 30) * 4 : 0);
        ctx.font = Math.round(H * 0.035) + "px serif"; ctx.textAlign = "center"; ctx.fillText("🔴", bobber.x, bobber.y + bob);
        if (state === "bite") { ctx.font = "bold " + Math.round(H * 0.06) + "px Trebuchet MS"; ctx.fillStyle = "#ff5252"; ctx.fillText("❗", bobber.x, bobber.y - H * 0.06); }
      }
      // cast meter
      if (state === "cast") {
        var mw = Math.min(300, W * 0.55), mx = W / 2 - mw / 2, my = H * 0.86;
        ctx.fillStyle = "#00000066"; ctx.fillRect(mx, my, mw, 18);
        ctx.fillStyle = meter > 0.75 ? "#69f0ae" : "#ffd740"; ctx.fillRect(mx, my, mw * meter, 18);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, 18);
      }
      // reel minigame bar (right side, nice and big for thumbs)
      if (state === "reel" && fish) {
        var bh = H * 0.6, bw = Math.max(46, W * 0.07), bx = W - bw - 14, by = H * 0.14;
        ctx.fillStyle = "#00000066"; ctx.fillRect(bx, by, bw, bh);
        var zh = ZONE_H[fish.sp.rarity] * bh;
        ctx.fillStyle = "#2f9e44cc"; ctx.fillRect(bx, by + reel.z * bh - zh / 2, bw, zh);
        ctx.font = Math.round(bw * 0.6) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(fish.sp.emoji, bx + bw / 2, by + reel.z * bh);
        ctx.fillText("🔴", bx + bw / 2, by + reel.i * bh);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
        // progress
        ctx.fillStyle = "#00000066"; ctx.fillRect(bx - 16, by, 10, bh);
        ctx.fillStyle = "#ffd740"; var ph = bh * reel.prog; ctx.fillRect(bx - 16, by + bh - ph, 10, ph);
      }
      // tournament board
      if (tour) {
        var rows = [{ name: store.state.profile.name, score: tour.me, me: true }]
          .concat(tour.bots.map(function (tb) { return { name: tb.bot.name, score: tb.score }; }))
          .sort(function (a, b) { return b.score - a.score; });
        ctx.font = "bold 14px Trebuchet MS, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
        var ty = H * 0.16;
        ctx.fillStyle = "#00000066"; ctx.fillRect(10, ty - 8, 190, 30 + rows.length * 20);
        ctx.fillStyle = "#fff";
        ctx.fillText("🏆 " + Math.max(0, Math.ceil(tour.t / 60)) + ":" + ("0" + Math.max(0, Math.floor(tour.t % 60))).slice(-2), 18, ty);
        rows.forEach(function (r, i) { ctx.fillStyle = r.me ? "#ffe14d" : "#fff"; ctx.fillText((i + 1) + ". " + r.name + " — " + r.score, 18, ty + 22 + i * 20); });
      }
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    // ---- end / cleanup ----
    function finishSession() {
      var xp = catches * 5 + Math.round(sessionGems / 8);
      var delta = Math.min(10, newSpecies * 2 + (catches > 0 ? 2 : 0));
      if (catches > 0 || sessionGems > 0) {
        store.recordGame("fishing", { win: catches >= 5, score: bestVal, rankPtsDelta: delta, xp: xp, gems: sessionGems });
      }
    }
    function cleanup() {
      running = false; cancelAnimationFrame(raf); VQ.shush();
      document.removeEventListener("keydown", onKey); document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize); window.removeEventListener("mouseup", mouseUp);
      if (wrap.parentNode) wrap.remove();
    }
    document.getElementById("quit").onclick = function () { finishSession(); cleanup(); if (opts.onExit) opts.onExit(); };

    hud();
    msgEl.innerHTML = water.emoji + " <b>" + water.name + "</b> — catch 'em all for the Fishdex!";
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxFishing = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
