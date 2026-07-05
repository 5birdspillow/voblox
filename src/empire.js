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
  var COST = { worker: 50, knight: 60, archer: 80, shield: 70, cavalry: 90, wizard: 120, catapult: 140, rax: 80, library: 100, tower: 100 };
  var UNIT = {
    worker: { hp: 30, dmg: 2, range: 16, speed: 60, cd: 1.0, emoji: "⛏️" },
    knight: { hp: 65, dmg: 9, range: 18, speed: 58, cd: 0.9, emoji: "🗡️" },
    archer: { hp: 40, dmg: 6, range: 125, speed: 52, cd: 1.1, emoji: "🏹" },
    shield: { hp: 130, dmg: 4, range: 16, speed: 44, cd: 1.1, emoji: "🛡️" },
    cavalry: { hp: 55, dmg: 8, range: 16, speed: 92, cd: 0.8, emoji: "🐎" },
    wizard: { hp: 35, dmg: 10, range: 110, speed: 48, cd: 1.6, splash: true, emoji: "🪄" },
    catapult: { hp: 70, dmg: 5, range: 140, speed: 30, cd: 2.2, siege: true, emoji: "🪨" },
    frostbite: { hp: 380, dmg: 14, range: 95, speed: 40, cd: 1.4, emoji: "❄️", hero: 1, name: "LADY FROSTBITE" },
    ignis: { hp: 540, dmg: 18, range: 26, speed: 44, cd: 1.0, emoji: "🔥", hero: 1, wordShield: true, name: "WARLORD IGNIS" }
  };
  // 🗺 THE CONQUEST MAP — 12 territories, 3 regions, 2 generals
  var TERR = [
    { id: "t1", name: "Sunny Fields", region: "🌾", twist: null, hallMul: 0.8, sub: "a gentle start" },
    { id: "t2", name: "Golden Hills", region: "🌾", twist: "goldrich", hallMul: 1, sub: "RICH mines!" },
    { id: "t3", name: "Windmill Flats", region: "🌾", twist: "notowers", hallMul: 1, sub: "NO towers allowed" },
    { id: "t4", name: "Meadow Keep", region: "🌾", twist: null, hallMul: 1.25, sub: "a fortified keep" },
    { id: "t5", name: "Frost Gate", region: "🏔", twist: "frozen", hallMul: 1.1, sub: "frozen mines mine SLOW" },
    { id: "t6", name: "Icicle Pass", region: "🏔", twist: "frozen", hallMul: 1.25, sub: "cold and colder" },
    { id: "t7", name: "Glacier Yard", region: "🏔", twist: "notowers", hallMul: 1.3, sub: "no towers, all ice" },
    { id: "t8", name: "FROSTBITE'S THRONE", region: "🏔", twist: "frozen", hallMul: 1.4, boss: "frostbite", sub: "❄️ she FREEZES your army" },
    { id: "t9", name: "Ash Road", region: "🌋", twist: "lavavents", hallMul: 1.3, sub: "the ground ERUPTS" },
    { id: "t10", name: "Cinder Mines", region: "🌋", twist: "goldrich", hallMul: 1.45, sub: "rich but burning" },
    { id: "t11", name: "Obsidian Wall", region: "🌋", twist: "lavavents", hallMul: 1.6, sub: "vents + a mighty wall" },
    { id: "t12", name: "IGNIS'S FORTRESS", region: "🌋", twist: "lavavents", hallMul: 1.8, boss: "ignis", sub: "🌋 word-shielded WARLORD" }
  ];
  // ⚔️ THE COUNTER TRIANGLE — composition IS the strategy
  function dmgMul(attKind, def) {
    var d = def && def.kind;
    var isB = def && BLD[d];
    if (attKind === "catapult") return isB ? 4 : 0.6;      // ⚙ demolishes buildings, tickles men
    if (isB) return 1;
    if (attKind === "cavalry" && d === "archer") return 2;  // 🐎 shreds archers
    if (attKind === "cavalry" && d === "shield") return 0.5; // …bounces off shields
    if (attKind === "archer" && d === "shield") return 0.4;  // 🛡 blocks arrows
    if (attKind === "knight" && d === "shield") return 1.3;  // swords crack shields
    if (attKind === "wizard" && d === "shield") return 1.6;  // magic ignores shields
    return 1;
  }
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
    var baseSkill = skill;
    var rival = Bots.pickOpponents(1, Math.max(0.25, skill))[0];
    var rivalCfg = rival.avatar;

    var running = true, raf = 0, run = 0, lastT = performance.now(), over = false;
    var gold = 120, study = 0, cap = 3, kills = 0, losses = 0, lastFmt = null;
    var meteorCd = 0, waveNum = 0, mode = "defend", paused = false;
    var waveT = 45 + (1 - skill) * 40; // first raid: rookie ~76s to build, veterans ~48s
    var bell = false, hintT = 50;
    var tier = 1, workerLost = 0, banked = false, sellMode = false;
    var rallyPoint = null, rallyArm = false;
    var terr = null, ventT = 10, frostT = 25, frozenArmy = 0, hero = null;
    function applyTierPick(tr) { // multipliers onto the already-seeded battle
      tier = tr;
      var T = TIERS_E[tr];
      gold = T.startGold;
      skill = Math.min(0.95, baseSkill + T.skillAdd + (terr ? TERR.indexOf(terr) * 0.03 : 0));
      foeHall.hp = foeHall.maxHp = Math.round(BLD.hall.hp * T.hallMul * (terr ? terr.hallMul : 1));
      waveT = Math.max(26, (45 + (1 - skill) * 40) / T.waveMul);
      if (tr === 3) big("📕 NIGHTMARE. " + rival.name + " shows no mercy.", "#ff8a8a");
      hud(); renderBar();
    }
    var units = [], buildings = [], effects = [];
    var mines = [];
    var trees = []; for (var ti = 0; ti < 14; ti++) trees.push({ x: 420 + (ti % 7) * 28 + (ti * 37 % 17), y: 200 + Math.floor(ti / 7) * 130 + (ti * 53 % 23) });

    function bld(team, kind, x, y) { var b = { team: team, kind: kind, x: x, y: y, hp: BLD[kind].hp, maxHp: BLD[kind].hp, cd: 0 }; buildings.push(b); return b; }
    function unit(team, kind, x, y) {
      var mul = team === 1 ? TIERS_E[tier].foeHpMul : 1;
      var u = { team: team, kind: kind, x: x, y: y, hp: Math.round(UNIT[kind].hp * mul), maxHp: Math.round(UNIT[kind].hp * mul), cd: 0, carry: 0, mineT: 0, tgt: null, face: 1 };
      units.push(u); return u;
    }
    // building pads fill in a fixed, sensible order (no fiddly placement on a phone)
    var PADS = { rax: { x: 215, y: 175 }, library: { x: 215, y: 390 }, tower: [{ x: 330, y: 220 }, { x: 330, y: 345 }] };
    var myHall = null, foeHall = null, myRax = null, myLib = null, towerCount = 0;
    // every battle (quick or territory) seeds through here — re-enterable for the map
    function resetBattle(cfg) {
      terr = cfg.terr || null;
      units = []; buildings = []; effects = [];
      gold = 120; study = 0; cap = 3; kills = 0; losses = 0; workerLost = 0;
      meteorCd = 0; waveNum = 0; mode = "defend"; bell = false; hintT = 50; run = 0;
      over = false; banked = false; sellMode = false; rallyPoint = null; rallyArm = false;
      ventT = 10; frostT = 25; frozenArmy = 0; hero = null; tier = 1;
      var mineGold = terr && terr.twist === "goldrich" ? 1400 : 900;
      mines = [{ x: 330, y: 120, left: mineGold }, { x: 300, y: 460, left: mineGold }, { x: 660, y: 90, left: mineGold }, { x: 690, y: 480, left: mineGold }];
      myHall = bld(0, "hall", 120, 280);
      foeHall = bld(1, "hall", 880, 280);
      if (rookie && !terr) { foeHall.hp = foeHall.maxHp = 240; }
      bld(1, "rax", 800, 180);
      myRax = null; myLib = null; towerCount = 0;
      unit(0, "worker", 170, 240); unit(0, "worker", 170, 320);
      unit(1, "worker", 830, 240); unit(1, "worker", 830, 330);
      if (terr && terr.boss) { // the general guards the fortress until the raids begin
        hero = unit(1, terr.boss, foeHall.x - 70, foeHall.y + 60);
        hero.guard = true;
        if (UNIT[terr.boss].wordShield) hero.shield = true;
        big(UNIT[terr.boss].emoji + " " + UNIT[terr.boss].name + " awaits…", "#c9b6ff");
      }
      applyTierPick(cfg.tier || 1);
      if (rookie && !terr) { foeHall.hp = foeHall.maxHp = 240; } // training castle stays gentle (after tier math)
      document.getElementById("emend").style.display = "none";
      msgEl.innerHTML = terr ? terr.region + " <b>" + terr.name + "</b>" : "🏰 <b>Word Empire</b> — vs " + rival.name;
      if (terr && terr.twist === "notowers") big("🚫 No towers here — the army IS the wall!", "#ffd740");
      if (terr && terr.twist === "frozen") big("🥶 Frozen mines — gold comes slow. Study hard!", "#8ecdf7");
      if (terr && terr.twist === "lavavents") big("🌋 Watch the ground — it ERUPTS!", "#ff9f43");
      paused = false;
      hud(); renderBar();
    }

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
        (myRax ? barBtn("b_knight", "⚔️ Knight", COST.knight + "g") + barBtn("b_archer", "🏹 Archer", COST.archer + "g") +
          barBtn("b_shield", "🛡 Shield", COST.shield + "g") + barBtn("b_cavalry", "🐎 Cavalry", COST.cavalry + "g") +
          (myLib ? barBtn("b_wizard", "🧙 Wizard", COST.wizard + "g + word", "study") + barBtn("b_catapult", "⚙ Catapult", COST.catapult + "g") : "")
          : barBtn("b_rax", "🏯 Barracks", COST.rax + "g")) +
        (myLib ? barBtn("b_study", "📖 Study", "+2 army cap", "study") + barBtn("b_meteor", "☄️ Meteor", meteorCd > 0 ? Math.ceil(meteorCd) + "s" : "word spell", "study") : barBtn("b_library", "📚 Library", COST.library + "g")) +
        (frozenArmy ? barBtn("b_thaw", "🔥 THAW!", "answer = un-freeze", "mode") : "") +
        (towerCount < 2 && !(terr && terr.twist === "notowers") ? barBtn("b_tower", "🗼 Tower", COST.tower + "g + word") : "") +
        barBtn("b_bell", bell ? "⛏️ Work!" : "🔔 Garrison", bell ? "villagers come out" : "hide + castle shoots") +
        barBtn("b_sell", sellMode ? "✋ Stop" : "🔨 Dismiss", sellMode ? "tap done" : "tap unit/tower, ½ back") +
        barBtn("b_rally", rallyArm ? "📍 Tap map…" : "📍 Rally", mode === "rally" ? "holding the flag" : "tap map to hold there") +
        barBtn("b_mode", mode === "defend" ? "⚔️ ATTACK!" : "🛡 Defend", mode === "defend" ? "send the army" : "come home", "mode");
      function on(id, fn) { var b = document.getElementById(id); if (b) b.onclick = fn; }
      on("b_worker", function () { buy("worker"); });
      on("b_rax", function () { buyBld("rax"); });
      on("b_knight", function () { buy("knight"); });
      on("b_archer", function () { buy("archer"); });
      on("b_shield", function () { buy("shield"); });
      on("b_cavalry", function () { buy("cavalry"); });
      on("b_wizard", function () { buyWizard(); });
      on("b_catapult", function () { buy("catapult"); });
      on("b_thaw", thaw);
      on("b_rally", function () {
        rallyArm = !rallyArm;
        if (rallyArm) big("📍 Tap anywhere on the field — the army will HOLD there.", "#8ecdf7");
        renderBar();
      });
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
    // 🧙 wizards study before they serve: answering a word IS the hiring exam
    function buyWizard() {
      if (over || paused) return;
      if (armyUsed() >= cap) { big("⚡ Army cap full — 📖 Study to grow it!", "#ffd740"); return; }
      if (gold < COST.wizard) { big("Need more gold!", "#ffd740"); return; }
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("emq"), words, store, {
        title: "🧙 A wizard joins only the learned — answer!", lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            gold -= COST.wizard;
            var u = unit(0, "wizard", myHall.x + 50, myHall.y + (Math.random() * 60 - 30));
            if (juice) juice.burst(X(u.x, u.y), Y(u.x, u.y), "#c9b6ff", 14);
            if (sfx && sfx.fanfare) sfx.fanfare();
            big("🧙 The wizard bows to a fellow scholar!", "#c9b6ff");
          } else big("The wizard is unimpressed…", "#ff8a8a");
          hud(); renderBar();
        }
      });
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
    function hurt(u, dmg, by) {
      if (UNIT[u.kind] && UNIT[u.kind].wordShield && u.shield) { // 🌋 Ignis laughs behind his flame shield
        if (juice && Math.random() < 0.3) juice.text(X(u.x, u.y), Y(u.x, u.y) - 20, "🔥 WORD-LOCKED", "#ff9f43");
        return;
      }
      u.hp -= dmg;
      if (juice) juice.text(X(u.x, u.y), Y(u.x, u.y) - 14, "-" + dmg, u.team === 1 ? "#ffd740" : "#ff8a8a");
      if (u.hp <= 0) {
        if (u.team === 1) { kills++; } else if (u.kind !== "worker") losses++; else workerLost++;
        units.splice(units.indexOf(u), 1);
        // ⭐ veterancy: survivors who rack up kills get stripes, health and bite
        if (u === hero) { hero = null; gold += 50; big("👑 THE GENERAL FALLS! +50g", "#ffd740"); if (juice) juice.shake(10); if (sfx && sfx.fanfare) sfx.fanfare(); }
        if (by && by.team === 0 && by.kind !== "worker" && units.indexOf(by) >= 0) {
          by.vk = (by.vk || 0) + 1;
          if (by.vk === 2) { by.vet = 1; by.vetDmg = 2; by.maxHp += 15; by.hp += 15; big("⭐ " + by.kind + " earned a stripe!", "#ffd740"); if (sfx && sfx.chime) sfx.chime(); }
          if (by.vk === 5) { by.vet = 2; by.vetDmg = 5; by.maxHp += 20; by.hp += 20; big("⭐⭐ VETERAN " + by.kind + "!", "#ffd740"); if (sfx && sfx.fanfare) sfx.fanfare(); }
        }
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
      var cycle = terr && terr.twist === "frozen" ? 2.6 : 1.3; // 🥶 frozen mines are stubborn
      if (u.mineT > cycle) { u.mineT = 0; mine.left -= 10; u.carry = 10; }
    }
    function stepSoldier(u, dt) {
      if (u.frozen > 0) { u.frozen -= dt; return; } // ❄️ statues don't march
      var home = u.team === 0 ? myHall : foeHall;
      var enemyHome = u.team === 0 ? foeHall : myHall;
      var uMode = u.team === 0 ? mode : (u.guard && waveNum < 2 ? "defend" : "attack");
      var aggro = uMode === "attack" ? 260 : 200;
      var tgt = nearestFoe(u, aggro);
      if (!tgt && uMode === "attack") tgt = enemyHome;
      if (!tgt) {
        if (uMode === "rally" && rallyPoint) { // 📍 hold the flag
          if (Math.hypot(u.x - rallyPoint.x, u.y - rallyPoint.y) > 42) moveToward(u, rallyPoint.x + ((units.indexOf(u) % 5) - 2) * 22, rallyPoint.y + ((units.indexOf(u) % 3) - 1) * 26, dt);
          return;
        }
        // defend: hold near home
        if (Math.hypot(u.x - home.x - 70, u.y - home.y) > 46) moveToward(u, home.x + (u.team === 0 ? 70 : -70), home.y + ((units.indexOf(u) % 5) - 2) * 26, dt);
        return;
      }
      // catapults prefer BUILDINGS when one is in reach
      if (UNIT[u.kind].siege) {
        var bTgt = null, bbd = 300;
        buildings.forEach(function (b) { if (b.team !== u.team) { var dd = Math.hypot(b.x - u.x, b.y - u.y); if (dd < bbd) { bbd = dd; bTgt = b; } } });
        if (bTgt) tgt = bTgt;
      }
      var range = UNIT[u.kind].range + (isBld(tgt) ? 26 : 0);
      var d = Math.hypot(tgt.x - u.x, tgt.y - u.y);
      if (d > range) { moveToward(u, tgt.x, tgt.y, dt); return; }
      u.cd -= dt;
      if (u.cd <= 0) {
        u.cd = UNIT[u.kind].cd;
        var base = UNIT[u.kind].dmg + (u.vetDmg || 0);
        var dmg = Math.max(1, Math.round(base * dmgMul(u.kind, tgt)));
        if (u.kind === "archer" || u.kind === "catapult") effects.push({ kind: "arrow", x: u.x, y: u.y - 12, tx: tgt.x, ty: tgt.y - 8, t: 0 });
        if (u.kind === "wizard") effects.push({ kind: "zap", x: tgt.x, y: tgt.y, t: 0 });
        if (isBld(tgt)) hurtB(tgt, dmg); else hurt(tgt, dmg, u);
        if (UNIT[u.kind].splash && !isBld(tgt)) { // 🪄 splash: singe everyone near the target
          units.slice().forEach(function (v) { if (v.team !== u.team && v !== tgt && !v.inside && Math.hypot(v.x - tgt.x, v.y - tgt.y) < 48) hurt(v, Math.max(1, Math.round(dmg * 0.6)), u); });
        }
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
    // the rival fields the SAME roster you do — scout the wave, counter the comp
    function spawnWave() {
      var pool = ["knight", "knight", "archer"];
      if (tier >= 2 || waveNum >= 3) pool.push("shield", "cavalry");
      if (tier === 3 && waveNum >= 3) pool.push("wizard");
      if (tier === 3 && waveNum >= 5) pool.push("catapult");
      var size = Math.min(rookie ? 4 : (tier === 3 ? 12 : 8), 1 + Math.floor(waveNum * (0.35 + skill * 1.15) * TIERS_E[tier].waveMul));
      for (var i = 0; i < size; i++) unit(1, pool[Math.floor(Math.random() * pool.length)], foeHall.x - 40, foeHall.y - 40 + i * 22);
      return size;
    }
    // territory hazards + general powers tick here
    function terrStep(dt) {
      if (!terr) return;
      if (terr.twist === "lavavents") { // 🌋 the ground erupts under EVERYONE
        ventT -= dt;
        if (ventT <= 0) {
          ventT = 12;
          for (var v = 0; v < 2; v++) {
            var vx = 250 + Math.random() * 500, vy = 100 + Math.random() * 380;
            effects.push({ kind: "vent", x: vx, y: vy, t: 0 });
            (function (vx2, vy2) {
              setTimeout(function () {
                if (over) return;
                units.slice().forEach(function (u2) { if (!u2.inside && Math.hypot(u2.x - vx2, u2.y - vy2) < 72) hurt(u2, 15); });
                if (juice) { juice.shake(6); juice.burst(X(vx2, vy2), Y(vx2, vy2), "#ff9f43", 18); }
              }, 1500);
            })(vx, vy);
          }
          if (sfx && sfx.buzz) sfx.buzz();
        }
      }
      if (hero && UNIT[hero.kind] && hero.kind === "frostbite") { // ❄️ she freezes your whole army
        frostT -= dt;
        if (frostT <= 0) {
          frostT = 25;
          var n = 0;
          units.forEach(function (u3) { if (u3.team === 0 && u3.kind !== "worker") { u3.frozen = 6; n++; } });
          if (n > 0) {
            frozenArmy = 1;
            big("❄️ LADY FROSTBITE FREEZES YOUR ARMY — 🔥 THAW with a word!", "#8ecdf7");
            if (sfx && sfx.buzz) sfx.buzz();
            renderBar();
          }
        }
      }
      if (frozenArmy && !units.some(function (u4) { return u4.team === 0 && u4.frozen > 0; })) { frozenArmy = 0; renderBar(); }
    }
    // 🔥 THAW: answer a word, the ice shatters instantly
    function thaw() {
      if (over || paused) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("emq"), words, store, {
        title: "🔥 THAW THE ARMY — answer to shatter the ice!", lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            units.forEach(function (u5) { u5.frozen = 0; });
            frozenArmy = 0;
            big("🔥 THE ICE SHATTERS! CHARGE!", "#ff9f43");
            if (juice) juice.shake(6);
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("Still frozen… brrr.", "#8ecdf7");
          renderBar();
        }
      });
    }
    // 🌋 tap Ignis and answer to melt his word-shield for 12s
    function heroDuel() {
      if (!hero || !hero.shield || over || paused) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("emq"), words, store, {
        title: "🌋 WARLORD IGNIS DEMANDS A WORD — break his shield!", lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok && hero) {
            hero.shield = false; hero.shieldOffT = 12;
            big("💥 HIS SHIELD MELTS — 12 seconds, STRIKE!", "#69f0ae");
            if (juice) { juice.shake(8); juice.burst(X(hero.x, hero.y), Y(hero.x, hero.y), "#ff9f43", 24); }
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("The Warlord laughs in flames…", "#ff8a8a");
        }
      });
    }
    function stepEnemy(dt) {
      waveT -= dt;
      if (hero && hero.shieldOffT !== undefined && !hero.shield) {
        hero.shieldOffT -= dt;
        if (hero.shieldOffT <= 0 && units.indexOf(hero) >= 0) { hero.shield = true; big("🔥 HIS SHIELD REIGNITES!", "#ff8a8a"); }
      }
      if (waveT <= 0) {
        waveNum++;
        waveT = Math.max(tier === 3 ? 20 : 28, (58 - skill * 26) / TIERS_E[tier].waveMul);
        spawnWave();
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
    function tdB(bid) { // highest tier beaten for a battle (legacy tierDoneQ folds in)
      stats.tierDoneB = stats.tierDoneB || {};
      var v = stats.tierDoneB[bid] || 0;
      if (bid === "q") v = Math.max(v, stats.tierDoneQ || 0);
      return v;
    }
    function terrDone(id) { var st = stats.starsT || {}; return (st[id + ":1"] || 0) + (st[id + ":2"] || 0) + (st[id + ":3"] || 0) > 0; }
    function win(didWin) {
      if (over) return; over = true;
      var bank = bankRun(didWin) || { rw: runRewards(didWin), res: null };
      var rw = bank.rw, res = bank.res;
      var bid = terr ? terr.id : "q";
      // ⭐ stars: win · lose no villagers · study 2+ words (per tier, 9/battle)
      var earned = 0, newMedals = 0;
      if (didWin) {
        earned = 1 + (workerLost === 0 ? 1 : 0) + (study >= 2 ? 1 : 0);
        stats.starsT = stats.starsT || {};
        var key = bid + ":" + tier;
        var prev = stats.starsT[key] || 0;
        if (earned > prev) { stats.starsT[key] = earned; newMedals += earned - prev; } // ⚒ 1 Medal per NEW star
        stats.tierDoneB = stats.tierDoneB || {};
        if (tier > (stats.tierDoneB[bid] || 0)) { stats.tierDoneB[bid] = tier; newMedals += 2; }
        if (bid === "q") stats.tierDoneQ = Math.max(stats.tierDoneQ || 0, tier);
        if (terr) {
          stats.territories = stats.territories || {};
          stats.territories[terr.id] = 1;
          if (terr.id === "t12") stats.mapDone = true;
        }
        if (newMedals > 0) stats.medals = (stats.medals || 0) + newMedals;
        store.save();
      }
      var T = TIERS_E[tier];
      var terrIdx = terr ? TERR.indexOf(terr) : -1;
      var nextTerr = didWin && terr && terrIdx < TERR.length - 1 ? TERR[terrIdx + 1] : null;
      var title = didWin
        ? (terr && terr.id === "t12" ? "🎉 THE MAP IS YOURS! Warlord Ignis kneels!"
          : terr && terr.boss ? UNIT[terr.boss].emoji + " THE GENERAL FALLS! " + terr.name + " is conquered!"
            : terr ? terr.region + " " + terr.name + " CONQUERED!" + (tier > 1 ? " (" + T.name + ")" : "")
              : (tier > 1 ? T.emoji + " " + T.name + " VICTORY!" : "VICTORY! The castle is yours!"))
        : "Your castle fell… next time!";
      var starRow = didWin ? '<div style="font-size:26px;margin:2px 0">' + "⭐".repeat(earned) + "☆".repeat(3 - earned) + '</div>' +
        '<div style="font-size:11px;color:#5a6b7a">win · keep every villager · study 2+ words</div>' : "";
      var payRow = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP" +
        (newMedals > 0 ? ' · <span style="color:#b06a00">+' + newMedals + " ⚒</span>" : "") +
        (rw.studyBonus ? ' <span style="color:#7a4fd0;font-size:12px">(incl. 📖 study bonus +' + rw.studyBonus + ")</span>" : "") + "</div>";
      var end = document.getElementById("emend");
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:44px">' + (didWin ? "🏆" : "💫") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + title + "</div>" +
        starRow + payRow +
        '<div style="margin:2px 0">⚔️ ' + kills + " foes defeated · 📖 " + study + " words studied" +
        (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        (nextTerr ? '<button class="submit big-next" id="emnext">Next: ' + nextTerr.region + " " + nextTerr.name + " ➜</button> " : "") +
        '<button class="submit' + (nextTerr ? '" style="background:#8a98a8' : ' big-next') + '" id="emok">🗺 War map</button></div>';
      end.style.display = "flex";
      if (didWin && juice) { juice.shake(6); }
      if (didWin && sfx && sfx.fanfare) sfx.fanfare();
      var nb = document.getElementById("emnext");
      if (nb) nb.onclick = function () { resetBattle({ terr: nextTerr, tier: 1 }); };
      document.getElementById("emok").onclick = showMap;
    }
    // 🗺 THE WAR MAP — pick your battle
    function showMap() {
      paused = true; over = true;
      var end = document.getElementById("emend");
      var stT = stats.starsT || {};
      function starSum(id) { return (stT[id + ":1"] || 0) + (stT[id + ":2"] || 0) + (stT[id + ":3"] || 0); }
      function tIcons(bid) { var td = tdB(bid); return td >= 3 ? "📗📙📕" : td === 2 ? "📗📙" : td === 1 ? "📗" : ""; }
      var regions = [{ key: "🌾", name: "Green Meadows" }, { key: "🏔", name: "Frostpeaks" }, { key: "🌋", name: "Obsidian Wastes" }];
      var html = regions.map(function (rg) {
        var terrs = TERR.filter(function (tt) { return tt.region === rg.key; });
        var btns = terrs.map(function (tt) {
          var idx = TERR.indexOf(tt);
          var open = idx === 0 || terrDone(TERR[idx - 1].id);
          var sn = starSum(tt.id);
          return '<button class="embtn" style="min-width:124px' + (open ? "" : ";opacity:.45") + (tt.boss ? ";border:2px solid #b03a3a" : "") + '" data-terr="' + idx + '">' +
            '<span class="ebl">' + (sn > 0 ? "⭐" + sn + "/9 " : open ? "▶ " : "🔒 ") + tt.name + " " + tIcons(tt.id) + "</span>" +
            '<span class="ebs">' + tt.sub + "</span></button>";
        }).join("");
        return '<div style="margin:6px 0 2px;font-weight:900">' + rg.key + " " + rg.name + '</div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + btns + "</div>";
      }).join("");
      var quickBtn = '<button class="embtn mode" style="min-width:140px" id="em_quick"><span class="ebl">⚔️ Quick Battle</span><span class="ebs">vs ' + rival.name + " · " + tIcons("q") + "</span></button>";
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-height:84vh;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y">' +
        '<div style="font-size:36px">🗺</div><div class="wqtitle" style="font-size:20px">The Conquest Map</div>' +
        (stats.mapDone ? '<div style="color:#b06a00;font-weight:900">👑 MAP CONQUERED</div>' : "") +
        html + '<div style="margin-top:8px">' + quickBtn + "</div>" +
        '<div style="font-size:11px;color:#8a98a8;margin-top:6px">⭐ per battle: win · keep every villager · study 2+ words</div></div>';
      end.style.display = "flex";
      Array.prototype.forEach.call(end.querySelectorAll("[data-terr]"), function (b) {
        b.onclick = function () {
          var idx = +b.dataset.terr;
          var tt = TERR[idx];
          var open = idx === 0 || terrDone(TERR[idx - 1].id);
          if (!open) { big("🔒 Conquer " + TERR[idx - 1].name + " first!", "#ffd740"); return; }
          if (tdB(tt.id) >= 1) showTierPickE(tt.id, tt.name, function (tr) { resetBattle({ terr: tt, tier: tr }); });
          else resetBattle({ terr: tt, tier: 1 });
        };
      });
      document.getElementById("em_quick").onclick = function () {
        if (tdB("q") >= 1) showTierPickE("q", "Quick Battle", function (tr) { resetBattle({ terr: null, tier: tr }); });
        else resetBattle({ terr: null, tier: 1 });
      };
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
        var isHero = UNIT[u.kind] && UNIT[u.kind].hero;
        var s = ((compact ? 8 : 0) + (u.kind === "worker" ? 30 : 36)) * (isHero ? 1.5 : 1);
        var cfg = u.team === 0 ? myCfg : rivalCfg;
        var held = u.kind === "worker" ? (u.carry ? "💰" : "⛏️") : UNIT[u.kind].emoji;
        if (u.frozen > 0) { ctx.save(); ctx.filter = "hue-rotate(160deg) saturate(2)"; }
        AV.draw(ctx, { x: X(u.x, u.y), y: Y(u.x, u.y) + s / 2, size: s, config: cfg, pose: u.frozen > 0 ? "idle" : "run", frame: run + u.x * 0.01, flip: u.face < 0, heldOverride: held });
        if (u.frozen > 0) { ctx.restore(); ctx.font = Math.round(s * 0.5) + "px serif"; ctx.textAlign = "center"; ctx.fillText("🧊", X(u.x, u.y), Y(u.x, u.y)); }
        hpBar(X(u.x, u.y), Y(u.x, u.y) - s * 0.75, s * 0.9, u.hp / u.maxHp, u.team);
        if (u.vet) { ctx.font = Math.round(Math.max(10, pz(12))) + "px serif"; ctx.textAlign = "center"; ctx.fillText("⭐".repeat(u.vet), X(u.x, u.y), Y(u.x, u.y) - s * 1.05); }
        if (isHero) {
          ctx.font = "bold " + Math.round(Math.max(10, pz(13))) + "px Trebuchet MS"; ctx.textAlign = "center"; ctx.fillStyle = "#fff";
          ctx.fillText(UNIT[u.kind].emoji + " " + UNIT[u.kind].name, X(u.x, u.y), Y(u.x, u.y) - s * 1.25);
          if (u.shield) {
            ctx.strokeStyle = "rgba(255,159,67," + (0.55 + Math.sin(run * 6) * 0.25) + ")"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(X(u.x, u.y), Y(u.x, u.y), s * 0.85, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "#ff9f43"; ctx.font = "bold " + Math.round(Math.max(9, pz(11))) + "px Trebuchet MS";
            ctx.fillText("TAP + WORD!", X(u.x, u.y), Y(u.x, u.y) + s * 1.15);
          }
        }
      });
      if (rallyPoint && mode === "rally") { // 📍 the flag the army holds
        ctx.font = Math.round(Math.max(20, pz(28))) + "px serif"; ctx.textAlign = "center";
        ctx.fillText("🚩", X(rallyPoint.x, rallyPoint.y), Y(rallyPoint.x, rallyPoint.y) - pz(8) + Math.sin(run * 3) * 2);
      }
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
        } else if (fx.kind === "vent") {
          var vk2 = Math.min(1, fx.t / 1.5 * 0.05 * 30);
          ctx.strokeStyle = "rgba(255,90,30," + (0.7 - vk2 * 0.4) + ")"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(X(fx.x, fx.y), Y(fx.x, fx.y), pz(72), 0, Math.PI * 2); ctx.stroke();
          ctx.font = Math.round(pz(26 + vk2 * 14)) + "px serif"; ctx.textAlign = "center";
          ctx.fillText(vk2 < 0.95 ? "⚠️" : "🌋", X(fx.x, fx.y), Y(fx.x, fx.y));
          if (fx.t > 1.1) effects.splice(e, 1);
        } else if (fx.kind === "zap") {
          var zk = Math.min(1, fx.t * 3);
          ctx.strokeStyle = "rgba(201,182,255," + (1 - zk) + ")"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(X(fx.x, fx.y), Y(fx.x, fx.y), pz(12 + zk * 40), 0, Math.PI * 2); ctx.stroke();
          if (zk >= 1) effects.splice(e, 1);
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
        stepTowers(dt); stepEnemy(dt); terrStep(dt);
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
      if (over || paused) return;
      var L = toLogical(mx, my);
      if (rallyArm) { // 📍 plant the flag
        rallyArm = false;
        rallyPoint = { x: Math.max(40, Math.min(MW - 40, L.x)), y: Math.max(50, Math.min(MH - 30, L.y)) };
        mode = "rally";
        big("📍 Army, HOLD THE FLAG!", "#8ecdf7");
        if (sfx && sfx.pop) sfx.pop();
        renderBar();
        return;
      }
      // 🌋 tap the shielded Warlord to challenge him
      if (hero && hero.shield && Math.hypot(hero.x - L.x, hero.y - L.y) < 60) { heroDuel(); return; }
      if (!sellMode) return;
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
      if (!sellMode && !rallyArm && !(hero && hero.shield)) return;
      e.preventDefault();
      var r = cv.getBoundingClientRect(), t = e.changedTouches[0];
      mapTap(t.clientX - r.left, t.clientY - r.top);
    }, { passive: false });

    // ⚔️ pick your pain: any beaten battle can be replayed HARDER
    function showTierPickE(bid, label, beginFn) {
      var td = tdB(bid);
      var stT = stats.starsT || {};
      paused = true;
      var end = document.getElementById("emend");
      var btns = [1, 2, 3].map(function (tr) {
        var T = TIERS_E[tr];
        var open = tr === 1 || td >= tr - 1;
        var sn = stT[bid + ":" + tr] || 0;
        return '<button class="embtn' + (tr === 3 ? " mode" : "") + '" style="min-width:128px' + (open ? "" : ";opacity:.45") + '" data-etr="' + tr + '">' +
          '<span class="ebl">' + T.emoji + " " + T.name + '</span>' +
          '<span class="ebs">' + (open ? ("⭐" + sn + "/3 · pays ×" + T.gemMul) : ("beat " + TIERS_E[tr - 1].name + " first")) + "</span></button>";
      }).join("");
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:36px">⚔️</div>' +
        '<div class="wqtitle" style="font-size:19px">' + label + " — pick your pain</div>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0">' + btns + "</div>" +
        '<button class="wqskip" id="etp_back" type="button">back</button></div>';
      end.style.display = "flex";
      Array.prototype.forEach.call(end.querySelectorAll("[data-etr]"), function (b) {
        b.onclick = function () {
          var tr = +b.dataset.etr;
          if (tr > 1 && td < tr - 1) { big("🔒 Beat " + TIERS_E[tr - 1].name + " first!", "#ffd740"); return; }
          beginFn(tr);
        };
      });
      document.getElementById("etp_back").onclick = showMap;
    }
    // test hook: deterministic control for the harness
    cv._empire = {
      state: function () { return { gold: gold, cap: cap, study: study, units: units, buildings: buildings, myHall: myHall, foeHall: foeHall, mode: mode, over: over, tier: tier, workerLost: workerLost, banked: banked, sellMode: sellMode, vertical: vertical, medals: stats.medals || 0, starsT: stats.starsT || {}, tierDoneQ: stats.tierDoneQ || 0, effects: effects, territories: stats.territories || {}, mapDone: !!stats.mapDone }; },
      give: function (g) { gold += g; hud(); renderBar(); },
      weakenFoe: function (hp) { foeHall.hp = hp; },
      spawn: function (team, kind, x, y) { return unit(team, kind, x, y); },
      setTier: applyTierPick,
      sell: function (on) { sellMode = on !== false; },
      tapLogical: function (lx, ly) { mapTap(X(lx, ly), Y(lx, ly)); },
      winNow: function (didWin) { win(didWin); },
      rally: function (x, y) { rallyArm = true; mapTap(X(x, y), Y(x, y)); },
      rallyPoint: function () { return rallyPoint; },
      wave: function (n) { waveNum = n !== undefined ? n : waveNum + 1; return spawnWave(); },
      dmgMul: dmgMul,
      beginT: function (idx, tr) { resetBattle({ terr: idx > 0 ? TERR[idx - 1] : null, tier: tr || 1 }); },
      terr: function () { return terr; },
      hero: function () { return hero; },
      duelHero: heroDuel,
      thawNow: thaw,
      map: showMap,
      TERR: TERR
    };

    // rookies charge straight into their training battle; veterans get the war map
    if (rookie) {
      resetBattle({ terr: null, tier: 1 });
      big("⚔️ " + rival.name + ": " + (rival.chat && rival.chat.hi ? rival.chat.hi : "To battle!"), "#ffd740");
    } else {
      resetBattle({ terr: null, tier: 1 }); // seed a field behind the map
      showMap();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxEmpire = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
