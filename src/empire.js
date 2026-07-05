/*
 * Voblox arcade game — 🏰 Word Empire (kid-sized Age of Empires / StarCraft).
 * Gather gold with workers, build a Barracks/Library/Towers, train knights and
 * archers, then storm the enemy castle. LEARNING IS THE POWER CURVE:
 *   - Army cap starts tiny; every correct 📖 Study answer at the Library = +2 cap.
 *   - Towers are word-gated to build; the ☄️ Meteor spell is cast by answering.
 * No unit micro (kid-friendly): your army fights as one brave blob with two
 * moods — 🛡 DEFEND the castle or ⚔️ ATTACK! Enemy AI raids in growing waves,
 * scaled by rank (botSkillFor). One match ≈ 4–8 minutes → recordGame("empire").
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;

  // map is a fixed logical space, scaled to the canvas (resize-safe, test-stable)
  var MW = 1000, MH = 560;
  var COST = { worker: 50, knight: 60, archer: 80, rax: 80, library: 100, tower: 100 };
  var UNIT = {
    worker: { hp: 30, dmg: 2, range: 16, speed: 60, cd: 1.0 },
    knight: { hp: 65, dmg: 9, range: 18, speed: 58, cd: 0.9 },
    archer: { hp: 40, dmg: 6, range: 125, speed: 52, cd: 1.1 }
  };
  var BLD = {
    hall: { hp: 320, w: 86, h: 76, emoji: "🏰" },
    rax: { hp: 160, w: 64, h: 56, emoji: "⚔️" },
    library: { hp: 140, w: 64, h: 56, emoji: "📚" },
    tower: { hp: 150, w: 40, h: 62, emoji: "🗼", range: 150, dmg: 6, cd: 0.8 }
  };
  // 📗 Normal / 📙 Hard / 📕 NIGHTMARE — Nightmare is tuned to beat GROWN-UPS
  var TIERS_E = {
    1: { name: "Normal", emoji: "📗", foeHpMul: 1, hallMul: 1, skillAdd: 0, startGold: 120, waveMul: 1, gemMul: 1 },
    2: { name: "Hard", emoji: "📙", foeHpMul: 1.2, hallMul: 1.35, skillAdd: 0.18, startGold: 100, waveMul: 1.15, gemMul: 2 },
    3: { name: "NIGHTMARE", emoji: "📕", foeHpMul: 1.45, hallMul: 1.75, skillAdd: 0.4, startGold: 80, waveMul: 1.4, gemMul: 3 }
  };

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("empire");
    var wrap = document.createElement("div"); wrap.className = "gamewrap empire";
    wrap.innerHTML =
      '<canvas id="emcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="emmsg">🏰 Word Empire</div>' +
      '<div class="grow"><span id="emgold">💰 120</span><span id="emcap">⚡ 0/3</span>' +
      '<button class="bossquit" id="quit">Done</button></div></div>' +
      '<div class="gmsg" id="embig"></div>' +
      '<div class="gover" id="emq" style="display:none"></div>' +
      '<div class="gover" id="emend" style="display:none"></div>' +
      '<div id="embar"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#emcv"), ctx = cv.getContext("2d");
    var W, H, S, OX, OY, vertical = false, compact = false;
    // TWO orientations, ONE logic space (the Books vs Zombies pattern):
    //  - landscape: your castle left, the foe right — classic RTS
    //  - portrait: the battlefield TRANSPOSES — your castle at the bottom,
    //    the enemy marches DOWN from the top. No more rotate-your-phone gate.
    function resize() {
      W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight;
      vertical = H > W;
      compact = Math.min(W, H) < 520 || Math.max(W, H) < 900;
      wrap.classList.toggle("compact", compact);
      var reserve = compact ? 76 : 66;
      if (vertical) {
        S = Math.min((W - 6) / MH, (H - reserve - 40) / MW);
        OX = (W - MH * S) / 2; OY = 40 + Math.max(0, (H - reserve - 40 - MW * S) / 2);
      } else {
        S = Math.min(W / MW, (H - reserve) / MH);
        OX = (W - MW * S) / 2; OY = Math.max(0, (H - reserve - MH * S) / 2 + (compact ? 30 : 0));
      }
    }
    resize(); window.addEventListener("resize", resize);
    // point transform: logical (x = toward the enemy, y = across the field)
    function X(x, y) { return vertical ? OX + y * S : OX + x * S; }
    function Y(x, y) { return vertical ? OY + (MW - x) * S : OY + y * S; }
    function pz(n) { return n * S; }
    // a logical rect → screen rect in either orientation
    function TR(x, y, w, h) {
      var ax = X(x, y), ay = Y(x, y), bx = X(x + w, y + h), by = Y(x + w, y + h);
      return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
    }
    function toLogical(sx, sy) {
      if (vertical) return { x: MW - (sy - OY) / S, y: (sx - OX) / S };
      return { x: (sx - OX) / S, y: (sy - OY) / S };
    }

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var myCfg = AV.resolve(store.state);
    // the FIRST battle is a training battle: gentle raids, weaker castle
    var rookie = (stats.plays || 0) === 0;
    var skill = P.botSkillFor(stats.rankPts);
    if (rookie) skill = Math.min(skill, 0.22);
    var rival = Bots.pickOpponents(1, Math.max(0.25, skill))[0];
    var rivalCfg = rival.avatar;

    var running = true, raf = 0, run = 0, lastT = performance.now(), over = false;
    var gold = 120, study = 0, cap = 3, kills = 0, losses = 0, lastFmt = null;
    var meteorCd = 0, waveNum = 0, mode = "defend", paused = false;
    var waveT = 45 + (1 - skill) * 40; // first raid: rookie ~76s to build, veterans ~48s
    var bell = false, hintT = 50;
    var tier = 1, workerLost = 0, banked = false, sellMode = false;
    function applyTierPick(tr) { // multipliers onto the already-seeded battle
      tier = tr;
      var T = TIERS_E[tr];
      gold = T.startGold;
      skill = Math.min(0.95, skill + T.skillAdd);
      foeHall.hp = foeHall.maxHp = Math.round(BLD.hall.hp * T.hallMul);
      waveT = Math.max(26, (45 + (1 - skill) * 40) / T.waveMul);
      if (tr === 3) big("📕 NIGHTMARE. " + rival.name + " shows no mercy.", "#ff8a8a");
      hud(); renderBar();
    }
    var units = [], buildings = [], effects = [];
    var mines = [{ x: 330, y: 120, left: 900 }, { x: 300, y: 460, left: 900 }, { x: 660, y: 90, left: 900 }, { x: 690, y: 480, left: 900 }];
    var trees = []; for (var ti = 0; ti < 14; ti++) trees.push({ x: 420 + (ti % 7) * 28 + (ti * 37 % 17), y: 200 + Math.floor(ti / 7) * 130 + (ti * 53 % 23) });

    function bld(team, kind, x, y) { var b = { team: team, kind: kind, x: x, y: y, hp: BLD[kind].hp, maxHp: BLD[kind].hp, cd: 0 }; buildings.push(b); return b; }
    function unit(team, kind, x, y) {
      var mul = team === 1 ? TIERS_E[tier].foeHpMul : 1;
      var u = { team: team, kind: kind, x: x, y: y, hp: Math.round(UNIT[kind].hp * mul), maxHp: Math.round(UNIT[kind].hp * mul), cd: 0, carry: 0, mineT: 0, tgt: null, face: 1 };
      units.push(u); return u;
    }
    var myHall = bld(0, "hall", 120, 280);
    var foeHall = bld(1, "hall", 880, 280);
    if (rookie) { foeHall.hp = foeHall.maxHp = 240; }
    bld(1, "rax", 800, 180);
    // building pads fill in a fixed, sensible order (no fiddly placement on a phone)
    var PADS = { rax: { x: 215, y: 175 }, library: { x: 215, y: 390 }, tower: [{ x: 330, y: 220 }, { x: 330, y: 345 }] };
    var myRax = null, myLib = null, towerCount = 0;
    unit(0, "worker", 170, 240); unit(0, "worker", 170, 320);
    unit(1, "worker", 830, 240); unit(1, "worker", 830, 330);

    var msgEl = document.getElementById("emmsg"), bigEl = document.getElementById("embig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1100); }

    // ---------- HUD / build bar ----------
    function hud() {
      document.getElementById("emgold").textContent = "💰 " + gold;
      var used = units.filter(function (u) { return u.team === 0 && u.kind !== "worker"; }).length;
      document.getElementById("emcap").textContent = "⚡ " + used + "/" + cap;
    }
    function armyUsed() { return units.filter(function (u) { return u.team === 0 && u.kind !== "worker"; }).length; }
    function workerCount() { return units.filter(function (u) { return u.team === 0 && u.kind === "worker"; }).length; }
    function barBtn(id, label, sub, cls) { return '<button class="embtn ' + (cls || "") + '" id="' + id + '"><span class="ebl">' + label + '</span><span class="ebs">' + sub + "</span></button>"; }
    function renderBar() {
      var bar = document.getElementById("embar");
      bar.innerHTML =
        barBtn("b_worker", "👷 Worker", COST.worker + "g" + (workerCount() >= 6 ? " · max" : "")) +
        (myRax ? barBtn("b_knight", "⚔️ Knight", COST.knight + "g") + barBtn("b_archer", "🏹 Archer", COST.archer + "g") : barBtn("b_rax", "🏯 Barracks", COST.rax + "g")) +
        (myLib ? barBtn("b_study", "📖 Study", "+2 army cap", "study") + barBtn("b_meteor", "☄️ Meteor", meteorCd > 0 ? Math.ceil(meteorCd) + "s" : "word spell", "study") : barBtn("b_library", "📚 Library", COST.library + "g")) +
        (towerCount < 2 ? barBtn("b_tower", "🗼 Tower", COST.tower + "g + word") : "") +
        barBtn("b_bell", bell ? "⛏️ Work!" : "🔔 Garrison", bell ? "villagers come out" : "hide + castle shoots") +
        barBtn("b_sell", sellMode ? "✋ Stop" : "🔨 Dismiss", sellMode ? "tap done" : "tap unit/tower, ½ back") +
        barBtn("b_mode", mode === "defend" ? "⚔️ ATTACK!" : "🛡 Defend", mode === "defend" ? "send the army" : "come home", "mode");
      function on(id, fn) { var b = document.getElementById(id); if (b) b.onclick = fn; }
      on("b_worker", function () { buy("worker"); });
      on("b_rax", function () { buyBld("rax"); });
      on("b_knight", function () { buy("knight"); });
      on("b_archer", function () { buy("archer"); });
      on("b_library", function () { buyBld("library"); });
      on("b_tower", function () { buyTower(); });
      on("b_study", openStudy);
      on("b_meteor", castMeteor);
      on("b_sell", function () {
        sellMode = !sellMode;
        big(sellMode ? "🔨 Tap a soldier or tower to send it home (half gold back)" : "✋ Done dismissing.", "#8ecdf7");
        renderBar();
      });
      on("b_bell", function () {
        bell = !bell;
        if (!bell) units.forEach(function (u) { if (u.team === 0) u.inside = false; });
        big(bell ? "🔔 Villagers, into the castle!" : "⛏️ Back to work!", "#8ecdf7");
        if (sfx && sfx.pop) sfx.pop();
        renderBar();
      });
      on("b_mode", function () {
        mode = mode === "defend" ? "attack" : "defend";
        big(mode === "attack" ? "⚔️ CHARGE!" : "🛡 Fall back!", mode === "attack" ? "#ff8a8a" : "#8ecdf7");
        if (sfx) (mode === "attack" ? sfx.fanfare && sfx.fanfare() : sfx.pop && sfx.pop());
        renderBar();
      });
    }
    function buy(kind) {
      if (over || paused) return;
      if (kind === "worker" && workerCount() >= 6) { big("Worker camp is full!", "#ffd740"); return; }
      if (kind !== "worker" && armyUsed() >= cap) { big("⚡ Army cap full — 📖 Study to grow it!", "#ffd740"); return; }
      if (gold < COST[kind]) { big("Need more gold!", "#ffd740"); return; }
      gold -= COST[kind];
      var u = unit(0, kind, myHall.x + 50, myHall.y + (Math.random() * 60 - 30));
      if (juice) juice.burst(X(u.x, u.y), Y(u.x, u.y), "#9be15d", 8);
      if (sfx && sfx.coin) sfx.coin();
      hud(); renderBar();
    }
    function buyBld(kind) {
      if (over || paused || gold < COST[kind]) { if (gold < COST[kind]) big("Need more gold!", "#ffd740"); return; }
      gold -= COST[kind];
      var pad = PADS[kind];
      var b = bld(0, kind, pad.x, pad.y);
      if (kind === "rax") myRax = b; else if (kind === "library") { myLib = b; big("📚 Library built — Study to grow your army!", "#9be15d"); }
      if (juice) juice.burst(X(b.x, b.y), Y(b.x, b.y), "#ffd740", 14);
      if (sfx && sfx.chime) sfx.chime();
      hud(); renderBar();
    }
    function buyTower() {
      if (over || paused || towerCount >= 2) return;
      if (gold < COST.tower) { big("Need more gold!", "#ffd740"); return; }
      paused = true;
      VQ.miniQuiz(document.getElementById("emq"), words, store, {
        title: "🗼 Answer to raise the tower!", lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            gold -= COST.tower;
            bld(0, "tower", PADS.tower[towerCount].x, PADS.tower[towerCount].y);
            towerCount++;
            big("🗼 Tower raised!", "#9be15d");
            if (sfx && sfx.chime) sfx.chime();
          } else big("The builders got confused…", "#ff8a8a");
          hud(); renderBar();
        }
      });
    }
    function openStudy() {
      if (over || paused) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("emq"), words, store, {
        title: "📖 Study at the Library — grow your army!", lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            study++; cap = Math.min(25, cap + 2); gold += 15;
            big("⚡ Army cap +2! (+15g)", "#9be15d");
            if (sfx && sfx.fanfare) sfx.fanfare();
          }
          hud(); renderBar();
        }
      });
    }
    function castMeteor() {
      if (over || paused || meteorCd > 0) return;
      paused = true;
      VQ.miniQuiz(document.getElementById("emq"), words, store, {
        title: "☄️ Speak the word of POWER!", lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (!ok) { big("The spell fizzled…", "#ff8a8a"); return; }
          meteorCd = 75;
          // strike the biggest enemy cluster (or their castle door)
          var foes = units.filter(function (u) { return u.team === 1; });
          var tx = foeHall.x - 60, ty = foeHall.y;
          if (foes.length) {
            var best = foes[0], bestN = -1;
            foes.forEach(function (f) {
              var n = foes.filter(function (g) { return Math.hypot(g.x - f.x, g.y - f.y) < 90 ; }).length;
              if (n > bestN) { bestN = n; best = f; }
            });
            tx = best.x; ty = best.y;
          }
          effects.push({ kind: "meteor", x: tx, y: ty, t: 0 });
          setTimeout(function () {
            units.forEach(function (u) { if (u.team === 1 && Math.hypot(u.x - tx, u.y - ty) < 95) hurt(u, 40); });
            buildings.forEach(function (b) { if (b.team === 1 && Math.hypot(b.x - tx, b.y - ty) < 95) hurtB(b, 30); });
            if (juice) { juice.shake(12); juice.burst(X(tx, ty), Y(tx, ty), "#ff9f43", 26); }
            if (sfx) { sfx.tone && sfx.tone(90, 0.4, 0.09); }
          }, 650);
          big("☄️ METEOR!", "#ff9f43");
          renderBar();
        }
      });
    }

    // ---------- combat helpers ----------
    function hurt(u, dmg) {
      u.hp -= dmg;
      if (juice) juice.text(X(u.x, u.y), Y(u.x, u.y) - 14, "-" + dmg, u.team === 1 ? "#ffd740" : "#ff8a8a");
      if (u.hp <= 0) {
        if (u.team === 1) { kills++; } else if (u.kind !== "worker") losses++; else workerLost++;
        units.splice(units.indexOf(u), 1);
        if (juice) juice.burst(X(u.x, u.y), Y(u.x, u.y), u.team === 1 ? "#ffd740" : "#ff8a8a", 10);
        hud();
      }
    }
    function hurtB(b, dmg) {
      b.hp -= dmg;
      if (b.hp <= 0) {
        buildings.splice(buildings.indexOf(b), 1);
        if (b.kind === "rax" && b.team === 0) myRax = null;
        if (b.kind === "library" && b.team === 0) myLib = null;
        if (juice) { juice.shake(8); juice.burst(X(b.x, b.y), Y(b.x, b.y), "#8a5a3b", 20); }
        if (b === foeHall) win(true);
        else if (b === myHall) win(false);
        renderBar();
      }
    }
    function nearestFoe(u, maxD) {
      var best = null, bd = maxD;
      units.forEach(function (v) { if (v.team !== u.team && !v.inside) { var d = Math.hypot(v.x - u.x, v.y - u.y); if (d < bd) { bd = d; best = v; } } });
      // buildings pull less: only when no soldier is close
      if (!best) buildings.forEach(function (b) { if (b.team !== u.team) { var d = Math.hypot(b.x - u.x, b.y - u.y); if (d < bd) { bd = d; best = b; } } });
      return best;
    }
    function isBld(e) { return e && e.kind && BLD[e.kind]; }

    // ---------- unit brains ----------
    function stepWorker(u, dt) {
      if (u.team === 1) { // enemy workers just look busy
        u.x += Math.sin(run * 0.7 + u.y) * 6 * dt; return;
      }
      if (bell) { // 🔔 town bell: run inside, drop off any gold, stay safe
        if (u.inside) return;
        moveToward(u, myHall.x, myHall.y, dt);
        if (Math.hypot(u.x - myHall.x, u.y - myHall.y) < 36) { u.inside = true; if (u.carry) { gold += u.carry; u.carry = 0; hud(); } }
        return;
      }
      if (u.carry) { // bring gold home
        moveToward(u, myHall.x + 40, myHall.y, dt);
        if (Math.hypot(u.x - (myHall.x + 40), u.y - myHall.y) < 24) { gold += u.carry; u.carry = 0; hud(); }
        return;
      }
      var mine = null, bd = 1e9;
      mines.forEach(function (m) { if (m.left > 0) { var d = Math.hypot(m.x - u.x, m.y - u.y); if (d < bd) { bd = d; mine = m; } } });
      if (!mine) return;
      if (bd > 26) { moveToward(u, mine.x, mine.y, dt); return; }
      u.mineT += dt;
      if (u.mineT > 1.3) { u.mineT = 0; mine.left -= 10; u.carry = 10; }
    }
    function stepSoldier(u, dt) {
      var home = u.team === 0 ? myHall : foeHall;
      var enemyHome = u.team === 0 ? foeHall : myHall;
      var uMode = u.team === 0 ? mode : "attack";
      var aggro = uMode === "attack" ? 260 : 200;
      var tgt = nearestFoe(u, aggro);
      if (!tgt && uMode === "attack") tgt = enemyHome;
      if (!tgt) { // defend: hold near home
        if (Math.hypot(u.x - home.x - 70, u.y - home.y) > 46) moveToward(u, home.x + (u.team === 0 ? 70 : -70), home.y + ((units.indexOf(u) % 5) - 2) * 26, dt);
        return;
      }
      var range = UNIT[u.kind].range + (isBld(tgt) ? 26 : 0);
      var d = Math.hypot(tgt.x - u.x, tgt.y - u.y);
      if (d > range) { moveToward(u, tgt.x, tgt.y, dt); return; }
      u.cd -= dt;
      if (u.cd <= 0) {
        u.cd = UNIT[u.kind].cd;
        if (u.kind === "archer") effects.push({ kind: "arrow", x: u.x, y: u.y - 12, tx: tgt.x, ty: tgt.y - 8, t: 0 });
        if (isBld(tgt)) hurtB(tgt, UNIT[u.kind].dmg); else hurt(tgt, UNIT[u.kind].dmg);
        if (sfx && sfx.pop && Math.random() < 0.3) sfx.pop();
      }
    }
    function moveToward(u, x, y, dt) {
      var d = Math.hypot(x - u.x, y - u.y) || 1;
      var sp = UNIT[u.kind].speed;
      u.x += ((x - u.x) / d) * sp * dt; u.y += ((y - u.y) / d) * sp * dt;
      u.face = x >= u.x ? 1 : -1;
      // gentle separation so the blob stays readable
      units.forEach(function (v) { if (v !== u && v.team === u.team) { var dd = Math.hypot(v.x - u.x, v.y - u.y); if (dd < 20 && dd > 0) { u.x += (u.x - v.x) / dd * 14 * dt; u.y += (u.y - v.y) / dd * 14 * dt; } } });
      u.x = Math.max(20, Math.min(MW - 20, u.x)); u.y = Math.max(40, Math.min(MH - 20, u.y));
    }
    function garrisonCount() { return units.filter(function (u) { return u.team === 0 && u.inside; }).length; }
    function stepTowers(dt) {
      buildings.forEach(function (b) {
        if (b.kind !== "tower") return;
        b.cd -= dt; if (b.cd > 0) return;
        var tgt = null, bd = BLD.tower.range;
        units.forEach(function (v) { if (v.team !== b.team && !v.inside) { var d = Math.hypot(v.x - b.x, v.y - b.y); if (d < bd) { bd = d; tgt = v; } } });
        if (tgt) { b.cd = BLD.tower.cd; effects.push({ kind: "arrow", x: b.x, y: b.y - 30, tx: tgt.x, ty: tgt.y, t: 0 }); hurt(tgt, BLD.tower.dmg); }
      });
      // AoE town-bell rule: a garrisoned castle SHOOTS — more villagers, more arrows
      var gc = garrisonCount();
      if (gc > 0) {
        myHall.cd = (myHall.cd || 0) - dt;
        if (myHall.cd <= 0) {
          var tgt2 = null, bd2 = 160;
          units.forEach(function (v) { if (v.team === 1) { var d = Math.hypot(v.x - myHall.x, v.y - myHall.y); if (d < bd2) { bd2 = d; tgt2 = v; } } });
          if (tgt2) {
            myHall.cd = 0.9;
            effects.push({ kind: "arrow", x: myHall.x, y: myHall.y - 40, tx: tgt2.x, ty: tgt2.y, t: 0 });
            hurt(tgt2, 2 + gc);
            if (sfx && sfx.pop && Math.random() < 0.4) sfx.pop();
          }
        }
      }
    }

    // ---------- enemy waves ----------
    function stepEnemy(dt) {
      waveT -= dt;
      if (waveT <= 0) {
        waveNum++;
        waveT = Math.max(tier === 3 ? 20 : 28, (58 - skill * 26) / TIERS_E[tier].waveMul);
        var size = Math.min(rookie ? 4 : (tier === 3 ? 12 : 8), 1 + Math.floor(waveNum * (0.35 + skill * 1.15) * TIERS_E[tier].waveMul));
        for (var i = 0; i < size; i++) unit(1, Math.random() < 0.65 ? "knight" : "archer", foeHall.x - 40, foeHall.y - 40 + i * 22);
        big("⚠️ " + rival.name + "'s raid is coming!", "#ffd740");
        if (sfx && sfx.buzz) sfx.buzz();
      }
      if (hintT > 0) { hintT -= dt; if (hintT <= 0 && !myLib) big("💡 Build a 📚 Library — studying makes your army BIGGER!", "#c9b6ff"); }
    }

    // ---------- win / lose ----------
    // one banking path for level ends, mid-run quits AND app-close (BvZ pattern:
    // rewards must be VISIBLE and never lost to a tab close)
    function runRewards(didWin) {
      var T = TIERS_E[tier];
      var studyBonus = study * 4;
      return {
        win: !!didWin,
        score: kills * 5 + study * 10 + (didWin ? tier * 40 : 0),
        rankPtsDelta: didWin ? Math.min(14, 8 + Math.min(4, study) + (tier - 1) * 2) : 2,
        xp: Math.min(80, 15 + kills * 2 + study * 6 + (didWin ? tier * 8 : 0)),
        gems: studyBonus + (didWin ? 25 * T.gemMul : 8), studyBonus: studyBonus
      };
    }
    function bankRun(didWin) {
      if (banked) return null;
      banked = true;
      var rw = runRewards(didWin);
      var res = store.recordGame ? store.recordGame("empire", rw) : null;
      return { rw: rw, res: res };
    }
    function win(didWin) {
      if (over) return; over = true;
      var bank = bankRun(didWin) || { rw: runRewards(didWin), res: null };
      var rw = bank.rw, res = bank.res;
      // ⭐ stars: win · lose no villagers · study 2+ words (per tier, 9/battle)
      var earned = 0, newMedals = 0;
      if (didWin) {
        earned = 1 + (workerLost === 0 ? 1 : 0) + (study >= 2 ? 1 : 0);
        stats.starsT = stats.starsT || {};
        var key = "q:" + tier;
        var prev = stats.starsT[key] || 0;
        if (earned > prev) { stats.starsT[key] = earned; newMedals += earned - prev; } // ⚒ 1 Medal per NEW star
        stats.tierDoneQ = stats.tierDoneQ || 0;
        if (tier > stats.tierDoneQ) { stats.tierDoneQ = tier; newMedals += 2; }
        if (newMedals > 0) stats.medals = (stats.medals || 0) + newMedals;
        store.save();
      }
      var T = TIERS_E[tier];
      var starRow = didWin ? '<div style="font-size:26px;margin:2px 0">' + "⭐".repeat(earned) + "☆".repeat(3 - earned) + '</div>' +
        '<div style="font-size:11px;color:#5a6b7a">win · keep every villager · study 2+ words</div>' : "";
      var payRow = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP" +
        (newMedals > 0 ? ' · <span style="color:#b06a00">+' + newMedals + " ⚒</span>" : "") +
        (rw.studyBonus ? ' <span style="color:#7a4fd0;font-size:12px">(incl. 📖 study bonus +' + rw.studyBonus + ")</span>" : "") + "</div>";
      var end = document.getElementById("emend");
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:44px">' + (didWin ? "🏆" : "💫") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (didWin ? (tier > 1 ? T.emoji + " " + T.name + " VICTORY! The castle is yours!" : "VICTORY! The castle is yours!") : "Your castle fell… next time!") + "</div>" +
        starRow + payRow +
        '<div style="margin:2px 0">⚔️ ' + kills + " foes defeated · 📖 " + study + " words studied" +
        (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        '<button class="submit big-next" id="emok">' + (didWin ? "Claim victory ⏎" : "Back to the island ⏎") + "</button></div>";
      end.style.display = "flex";
      if (didWin && juice) { juice.shake(6); }
      if (didWin && sfx && sfx.fanfare) sfx.fanfare();
      document.getElementById("emok").onclick = exit;
    }

    // ---------- drawing ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // field
      var g1 = ctx.createLinearGradient(0, 0, 0, H); g1.addColorStop(0, "#8fd062"); g1.addColorStop(1, "#5cab3e");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,.10)";
      for (var i = 0; i < 8; i++) { var st = TR(0, 70 * i + 20, MW, 6); ctx.fillRect(st.x, st.y, st.w, st.h); }
      // territory tints (blue = home, red = foe; transposes with the field)
      var homeT = TR(0, 0, 380, MH), foeT = TR(620, 0, 380, MH);
      ctx.fillStyle = "rgba(47,123,224,.07)"; ctx.fillRect(homeT.x, homeT.y, homeT.w, homeT.h);
      ctx.fillStyle = "rgba(224,60,60,.07)"; ctx.fillRect(foeT.x, foeT.y, foeT.w, foeT.h);
      trees.forEach(function (t) { ctx.font = Math.round(Math.max(17, pz(30))) + "px serif"; ctx.textAlign = "center"; ctx.fillText("🌳", X(t.x, t.y), Y(t.x, t.y)); });
      mines.forEach(function (m) {
        ctx.font = Math.round(Math.max(18, pz(26))) + "px serif"; ctx.textAlign = "center";
        ctx.fillText(m.left > 0 ? "⛰️" : "🕳️", X(m.x, m.y), Y(m.x, m.y));
        if (m.left > 0) { ctx.font = Math.round(Math.max(11, pz(13))) + "px Trebuchet MS"; ctx.fillStyle = "#5a4a20"; ctx.fillText("💰" + m.left, X(m.x, m.y + 18), Y(m.x, m.y + 18)); }
      });
      buildings.forEach(function (b) {
        var def = BLD[b.kind], w = pz(def.w), h = pz(def.h);
        ctx.fillStyle = b.team === 0 ? "#cfe0f4" : "#f4cfcf";
        ctx.strokeStyle = b.team === 0 ? "#2f6bb0" : "#b03a3a"; ctx.lineWidth = 3;
        rrect(X(b.x, b.y) - w / 2, Y(b.x, b.y) - h / 2, w, h, 8); ctx.fill(); ctx.stroke();
        ctx.font = Math.round(h * 0.55) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(def.emoji, X(b.x, b.y), Y(b.x, b.y));
        hpBar(X(b.x, b.y), Y(b.x, b.y) - h / 2 - 8, w, b.hp / b.maxHp, b.team);
      });
      units.forEach(function (u) {
        if (u.inside) return; // garrisoned villagers are safe inside the castle
        var s = (compact ? 8 : 0) + (u.kind === "worker" ? 30 : 36); // bigger heroes on phones
        var cfg = u.team === 0 ? myCfg : rivalCfg;
        var held = u.kind === "knight" ? "🗡️" : u.kind === "archer" ? "🏹" : (u.carry ? "💰" : "⛏️");
        AV.draw(ctx, { x: X(u.x, u.y), y: Y(u.x, u.y) + s / 2, size: s, config: cfg, pose: "run", frame: run + u.x * 0.01, flip: u.face < 0, heldOverride: held });
        hpBar(X(u.x, u.y), Y(u.x, u.y) - s * 0.75, s * 0.9, u.hp / u.maxHp, u.team);
      });
      var gc2 = garrisonCount();
      if (gc2 > 0) { ctx.font = Math.round(Math.max(13, pz(18))) + "px Trebuchet MS"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText("🔔×" + gc2, X(myHall.x, myHall.y - 58), Y(myHall.x, myHall.y - 58)); }
      // effects
      for (var e = effects.length - 1; e >= 0; e--) {
        var fx = effects[e]; fx.t += 0.05;
        if (fx.kind === "arrow") {
          var k = Math.min(1, fx.t * 2.2);
          ctx.strokeStyle = "#5a4a20"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(X(fx.x, fx.y), Y(fx.x, fx.y));
          var ax2 = fx.x + (fx.tx - fx.x) * k, ay2 = fx.y + (fx.ty - fx.y) * k;
          ctx.lineTo(X(ax2, ay2), Y(ax2, ay2) - pz(Math.sin(k * Math.PI) * 18)); ctx.stroke();
          if (k >= 1) effects.splice(e, 1);
        } else if (fx.kind === "meteor") {
          var mk = Math.min(1, fx.t * 1.4);
          ctx.font = Math.round(pz(30 + mk * 26)) + "px serif"; ctx.textAlign = "center";
          ctx.fillText("☄️", X(fx.x, fx.y) + pz((1 - mk) * 140), Y(fx.x, fx.y) - pz((1 - mk) * 260));
          if (mk >= 1) { ctx.font = Math.round(pz(60)) + "px serif"; ctx.fillText("💥", X(fx.x, fx.y), Y(fx.x, fx.y)); if (fx.t > 1) effects.splice(e, 1); }
        }
      }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function hpBar(x, y, w, f, team) {
      if (f >= 1) return;
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(x - w / 2, y, w, 5);
      ctx.fillStyle = team === 0 ? "#69f0ae" : "#ff8a8a"; ctx.fillRect(x - w / 2, y, w * Math.max(0, f), 5);
    }

    // ---------- main loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) {
        run += dt;
        meteorCd = Math.max(0, meteorCd - dt);
        units.slice().forEach(function (u) { if (u.kind === "worker") stepWorker(u, dt); else stepSoldier(u, dt); });
        stepTowers(dt); stepEnemy(dt);
        if (Math.floor(run) !== Math.floor(run - dt)) { hud(); if (Math.floor(run) % 5 === 0) renderBar(); }
      }
      draw();
    }

    // ---------- exit / cleanup ----------
    function bankExit() {
      if (over || banked || (kills === 0 && study === 0)) return;
      var bank = bankRun(false);
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🏰 Battle banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      over = true;
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // 🔨 map taps: dismiss units / demolish towers while sell mode is on
    function mapTap(mx, my) {
      if (!sellMode || over || paused) return;
      var L = toLogical(mx, my);
      // nearest own tower first (bigger refund, deliberate act)
      var bestB = null, bdB = 46;
      buildings.forEach(function (b) { if (b.team === 0 && b.kind === "tower") { var d = Math.hypot(b.x - L.x, b.y - L.y); if (d < bdB) { bdB = d; bestB = b; } } });
      if (bestB) {
        buildings.splice(buildings.indexOf(bestB), 1); towerCount--;
        gold += Math.floor(COST.tower / 2);
        big("🔨 Tower taken down: +" + Math.floor(COST.tower / 2) + "g", "#8ecdf7");
        if (juice) juice.burst(X(bestB.x, bestB.y), Y(bestB.x, bestB.y), "#cfd6dd", 12);
        if (sfx && sfx.whoosh) sfx.whoosh();
        hud(); renderBar();
        return;
      }
      var bestU = null, bdU = 34;
      units.forEach(function (u) { if (u.team === 0 && u.kind !== "worker" && !u.inside) { var d = Math.hypot(u.x - L.x, u.y - L.y); if (d < bdU) { bdU = d; bestU = u; } } });
      if (bestU) {
        units.splice(units.indexOf(bestU), 1);
        var refund = Math.floor(COST[bestU.kind] / 2);
        gold += refund;
        big("🔨 " + bestU.kind + " sent home: +" + refund + "g", "#8ecdf7");
        if (juice) juice.burst(X(bestU.x, bestU.y), Y(bestU.x, bestU.y), "#cfd6dd", 10);
        if (sfx && sfx.pop) sfx.pop();
        hud();
      }
    }
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); mapTap(e.clientX - r.left, e.clientY - r.top); });
    cv.addEventListener("touchstart", function (e) { // discrete tap: preventDefault kills the iOS phantom double-fire
      if (!sellMode) return;
      e.preventDefault();
      var r = cv.getBoundingClientRect(), t = e.changedTouches[0];
      mapTap(t.clientX - r.left, t.clientY - r.top);
    }, { passive: false });

    // ⚔️ pick your pain: after the first win, each battle opens with a tier choice
    function showTierPickE() {
      var td = stats.tierDoneQ || 0;
      var stT = stats.starsT || {};
      paused = true;
      var end = document.getElementById("emend");
      var btns = [1, 2, 3].map(function (tr) {
        var T = TIERS_E[tr];
        var open = tr === 1 || td >= tr - 1;
        var sn = stT["q:" + tr] || 0;
        return '<button class="embtn' + (tr === 3 ? " mode" : "") + '" style="min-width:128px' + (open ? "" : ";opacity:.45") + '" data-etr="' + tr + '">' +
          '<span class="ebl">' + T.emoji + " " + T.name + '</span>' +
          '<span class="ebs">' + (open ? ("⭐" + sn + "/3 · pays ×" + T.gemMul) : ("beat " + TIERS_E[tr - 1].name + " first")) + "</span></button>";
      }).join("");
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:36px">⚔️</div>' +
        '<div class="wqtitle" style="font-size:19px">Quick Battle vs ' + rival.name + " — pick your pain</div>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0">' + btns + "</div></div>";
      end.style.display = "flex";
      Array.prototype.forEach.call(end.querySelectorAll("[data-etr]"), function (b) {
        b.onclick = function () {
          var tr = +b.dataset.etr;
          if (tr > 1 && td < tr - 1) { big("🔒 Beat " + TIERS_E[tr - 1].name + " first!", "#ffd740"); return; }
          applyTierPick(tr);
          end.style.display = "none";
          paused = false;
        };
      });
    }
    // test hook: deterministic control for the harness
    cv._empire = {
      state: function () { return { gold: gold, cap: cap, study: study, units: units, buildings: buildings, myHall: myHall, foeHall: foeHall, mode: mode, over: over, tier: tier, workerLost: workerLost, banked: banked, sellMode: sellMode, vertical: vertical, medals: stats.medals || 0, starsT: stats.starsT || {}, tierDoneQ: stats.tierDoneQ || 0 }; },
      give: function (g) { gold += g; hud(); renderBar(); },
      weakenFoe: function (hp) { foeHall.hp = hp; },
      spawn: function (team, kind, x, y) { return unit(team, kind, x, y); },
      setTier: applyTierPick,
      sell: function (on) { sellMode = on !== false; },
      tapLogical: function (lx, ly) { mapTap(X(lx, ly), Y(lx, ly)); },
      winNow: function (didWin) { win(didWin); }
    };

    msgEl.innerHTML = "🏰 <b>Word Empire</b> — vs " + rival.name;
    big("⚔️ " + rival.name + ": " + (rival.chat && rival.chat.hi ? rival.chat.hi : "To battle!"), "#ffd740");
    if (!rookie && (stats.wins || 0) > 0) showTierPickE(); // veterans pick their pain
    hud(); renderBar();
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxEmpire = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
