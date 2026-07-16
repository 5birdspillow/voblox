/*
 * Voblox arcade game — 🚢 WORD FLEET (classic Battleship vs a named bot admiral).
 * Two 10×10 grids: yours (ships visible) and the enemy admiral's (hidden). SETUP:
 * place 5 ships (5/4/3/3/2) — tap-to-select + tap-to-place, 🔄 rotate, drag to
 * move, 🎲 shuffle, then LOCK IN. BATTLE: tap an enemy cell to fire — a hit 💥
 * lets you fire again (classic streak), a miss 🌊 hands the salvo to the admiral,
 * whose real hunt/target AI fires back (no cheating — it only reads its own shots).
 * First fleet sunk loses.
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 📡 SONAR PING (once/match): answer a word → a 3×3 slice of the enemy grid is
 *     revealed for 3s (ghost markers). Wrong = try again, no penalty.
 *   - 🛠 EMERGENCY REPAIR: when your LAST ship is down to 1 cell, a word restores
 *     one destroyed cell of it (once). Wrong = play on.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("fleet") per
 * match via bankRun() — banked on match end, quit, AND app-close. Stats persist
 * additively (winsF, bestAccuracy).
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  var GRID = 10, TOTAL = 17;
  var SHIP_DEFS = [
    { name: "Carrier", size: 5 }, { name: "Battleship", size: 4 },
    { name: "Cruiser", size: 3 }, { name: "Submarine", size: 3 }, { name: "Destroyer", size: 2 }
  ];
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function cellName(r, c) { return String.fromCharCode(65 + c) + (r + 1); }

  // ---------- board model (pure) ----------
  function makeBoard() {
    var b = { occ: [], shot: [], ships: [] };
    for (var i = 0; i < 100; i++) { b.occ[i] = -1; b.shot[i] = 0; } // shot: 0 none, 1 miss, 2 hit
    SHIP_DEFS.forEach(function (d) { b.ships.push({ name: d.name, size: d.size, cells: [], hits: 0, sunk: false, horiz: true, r: 0, c: 0, placed: false }); });
    return b;
  }
  function cellsFor(size, r, c, horiz) {
    var cells = [];
    for (var k = 0; k < size; k++) {
      var rr = horiz ? r : r + k, cc = horiz ? c + k : c;
      if (rr < 0 || rr > 9 || cc < 0 || cc > 9) return null;
      cells.push(rr * 10 + cc);
    }
    return cells;
  }
  function rebuildOcc(b) {
    for (var i = 0; i < 100; i++) b.occ[i] = -1;
    b.ships.forEach(function (s, i) { if (s.placed) s.cells.forEach(function (cl) { b.occ[cl] = i; }); });
  }
  function tryPlace(b, shipIdx, r, c, horiz) {
    var ship = b.ships[shipIdx];
    var cells = cellsFor(ship.size, r, c, horiz);
    if (!cells) return false;
    for (var i = 0; i < 100; i++) { // occupancy of the OTHER placed ships
      var owner = b.occ[i];
      if (owner >= 0 && owner !== shipIdx && cells.indexOf(i) >= 0) return false;
    }
    // guard against self-overlap via stale occ: recompute against other ships only
    for (var s = 0; s < b.ships.length; s++) {
      if (s === shipIdx || !b.ships[s].placed) continue;
      for (var k = 0; k < b.ships[s].cells.length; k++) if (cells.indexOf(b.ships[s].cells[k]) >= 0) return false;
    }
    ship.cells = cells; ship.r = r; ship.c = c; ship.horiz = horiz; ship.placed = true;
    rebuildOcc(b);
    return true;
  }
  function randPlace(b) {
    b.ships.forEach(function (s) { s.placed = false; s.cells = []; s.hits = 0; s.sunk = false; });
    for (var i = 0; i < 100; i++) b.occ[i] = -1;
    b.ships.forEach(function (s, idx) {
      var tries = 0;
      while (tries++ < 500) {
        var horiz = Math.random() < 0.5;
        var r = Math.floor(Math.random() * 10), c = Math.floor(Math.random() * 10);
        if (tryPlace(b, idx, r, c, horiz)) break;
      }
    });
  }
  function defaultPlace(b) { // tidy, deterministic starting layout (ships lined up to drag/rotate/shuffle)
    b.ships.forEach(function (s) { s.placed = false; s.cells = []; s.hits = 0; s.sunk = false; });
    for (var i = 0; i < 100; i++) b.occ[i] = -1;
    var rows = [0, 2, 4, 6, 8];
    b.ships.forEach(function (s, idx) { tryPlace(b, idx, rows[idx], 0, true); });
  }
  function allPlaced(b) { return b.ships.every(function (s) { return s.placed; }); }
  function remaining(b) { var n = 0; b.ships.forEach(function (s) { n += s.size - s.hits; }); return n; }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("fleet");
    stats.winsF = stats.winsF || 0;              // additive-only (recordGame owns best/wins/plays)
    stats.bestAccuracy = stats.bestAccuracy || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap fleet";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    var actBtn = "position:absolute;z-index:8;border:none;border-radius:14px;font-family:inherit;font-weight:900;color:#fff;cursor:pointer;padding:11px 16px;font-size:15px;box-shadow:0 5px 0 #0006,0 8px 20px #0006";
    wrap.innerHTML =
      '<canvas id="flcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="flmsg">🚢 Word Fleet</div>' +
      '<div class="grow"><span id="flstat"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="flbig"></div>' +
      '<div id="flsetup" style="position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 22px);transform:translateX(-50%);z-index:8;display:flex;gap:8px">' +
      '<button id="flrotate" style="' + actBtn + ';background:linear-gradient(#8ecdf7,#3f8fd8)">🔄 Rotate</button>' +
      '<button id="flshuffle" style="' + actBtn + ';background:linear-gradient(#c9b6ff,#9d8df1)">🎲 Shuffle</button>' +
      '<button id="fllock" style="' + actBtn + ';background:linear-gradient(#5be07a,#1fa34d)">✅ Lock In</button></div>' +
      '<button id="flsonar" style="' + actBtn + ';left:50%;bottom:calc(env(safe-area-inset-bottom) + 22px);transform:translateX(-50%);background:linear-gradient(#5fd7c9,#1f9e8f);display:none">📡 Sonar Ping</button>' +
      '<button id="flrepair" style="' + actBtn + ';left:50%;bottom:calc(env(safe-area-inset-bottom) + 74px);transform:translateX(-50%);background:linear-gradient(#ffb24d,#ff6b1f);display:none">🛠 Emergency Repair</button>' +
      '<div id="fllog" style="position:absolute;top:calc(env(safe-area-inset-top) + 70px);right:6px;z-index:7;width:74px;font-family:Trebuchet MS,sans-serif;font-size:11px;font-weight:bold;color:#dff;line-height:1.5;text-align:right;pointer-events:none;text-shadow:0 1px 2px #000"></div>' +
      '<div class="gover" id="flq" style="display:none"></div>' +
      '<div class="gover" id="flcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#flcv"), ctx = cv.getContext("2d");
    var qEl = document.getElementById("flq"), cardEl = document.getElementById("flcard");
    var msgEl = document.getElementById("flmsg"), bigEl = document.getElementById("flbig"), statEl = document.getElementById("flstat"), logEl = document.getElementById("fllog");
    var setupBar = document.getElementById("flsetup"), sonarBtn = document.getElementById("flsonar"), repairBtn = document.getElementById("flrepair");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- opponents (3 named admirals near Leo's rank) ----------
    var opponents = Bots.pickOpponents(3, P.botSkillFor(stats.rankPts)).slice();
    opponents.sort(function (a, b) { return a.skill - b.skill; });
    while (opponents.length < 3 && Bots.ALL.length) opponents.push(opponents[opponents.length - 1] || Bots.ALL[0]);
    var curOpp = 0, rival = opponents[0];

    // ---------- responsive letterbox (portrait = stacked, landscape = side-by-side) ----------
    var W, H, S, rects = { enemy: { ox: 0, oy: 0 }, you: { ox: 0, oy: 0 } };
    var LB = 16; // label gutter
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      var top = 84, bottom = 84, gap = 20, pad = 8;
      if (H >= W) { // portrait — grids stacked
        S = Math.min((W - 2 * pad - LB) / GRID, (H - top - bottom - gap - 2 * LB) / (2 * GRID));
        var gw = S * GRID;
        var ox = (W - (LB + gw)) / 2 + LB;
        rects.enemy = { ox: ox, oy: top + LB };
        rects.you = { ox: ox, oy: top + LB + gw + gap + LB };
      } else { // landscape — grids side by side
        S = Math.min((W - 2 * pad - 2 * LB - gap) / (2 * GRID), (H - top - bottom - LB) / GRID);
        var gw2 = S * GRID, blockW = LB + gw2;
        var startX = (W - (2 * blockW + gap)) / 2;
        rects.enemy = { ox: startX + LB, oy: top + LB };
        rects.you = { ox: startX + blockW + gap + LB, oy: top + LB };
      }
    }
    resize(); window.addEventListener("resize", resize);
    function cellX(rect, c) { return rect.ox + c * S; }
    function cellY(rect, r) { return rect.oy + r * S; }
    function pointToCell(px, py) {
      var which, rect;
      for (var w2 = 0; w2 < 2; w2++) {
        which = w2 === 0 ? "enemy" : "you"; rect = rects[which];
        var c = Math.floor((px - rect.ox) / S), r = Math.floor((py - rect.oy) / S);
        if (r >= 0 && r < GRID && c >= 0 && c < GRID) return { which: which, r: r, c: c };
      }
      return null;
    }

    // ---------- boards + match state ----------
    var you = makeBoard(), enemy = makeBoard();
    var phase = "setup", turn = "you", over = false, won = false, paused = false, banked = false, touched = false;
    var hits = 0, shots = 0, botShots = 0, quizOpen = false;
    var sonarUsed = false, repairUsed = false, repairOffered = false, lastFmt = null;
    var winStreak = 0, gt = 0, botThinkT = 0;
    var fx = [], sonarCells = [], sonarT = 0, log = [];
    // setup interaction
    var selShip = -1, dragging = false, dragOrig = null;
    // bot AI
    var botTargets = [], botHits = [], botParity = false, botPar = 0;

    // ---------- HUD / message ----------
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1200); }
    function updateHud() {
      var acc = shots > 0 ? Math.round(hits / shots * 100) : 0;
      var eShips = enemy.ships.filter(function (s) { return !s.sunk; }).length;
      statEl.textContent = phase === "setup" ? "⚓ Place your fleet vs " + rival.name
        : "🚢 " + eShips + " enemy · 🎯 " + hits + "/" + shots + " (" + acc + "%)";
      updateButtons();
    }
    function updateButtons() {
      var battle = phase === "battle" && !over && !paused && !quizOpen;
      setupBar.style.display = (phase === "setup" && !paused) ? "flex" : "none";
      sonarBtn.style.display = (battle && !sonarUsed) ? "block" : "none";
      repairBtn.style.display = (battle && canRepair()) ? "block" : "none";
    }
    function logShot(icon, r, c, hit, sunkName) {
      log.unshift(icon + " " + cellName(r, c) + (sunkName ? " ⚓" : hit ? " 💥" : " 🌊"));
      if (log.length > 12) log.pop();
      logEl.innerHTML = log.join("<br>");
    }

    // ---------- fx (cosmetic only) ----------
    function addFx(kind, rect, r, c) {
      fx.push({ kind: kind, x: cellX(rect, c) + S / 2, y: cellY(rect, r) + S / 2, t: 0, dur: kind === "shell" ? 0.4 : 0.6 });
    }
    function shell(fromRect, toRect, r, c) {
      fx.push({ kind: "shell", x0: fromRect.ox + S * 5, y0: fromRect.oy + S * 5, x: cellX(toRect, c) + S / 2, y: cellY(toRect, r) + S / 2, t: 0, dur: 0.35 });
    }

    // ---------- firing (turn-based, synchronous) ----------
    function fire(r, c) {
      if (phase !== "battle" || over || turn !== "you") return null;
      if (r < 0 || r > 9 || c < 0 || c > 9) return null;
      var cell = r * 10 + c;
      if (enemy.shot[cell] !== 0) return null;
      touched = true; shots++;
      var idx = enemy.occ[cell], result;
      shell(rects.you, rects.enemy, r, c);
      if (idx >= 0) {
        enemy.shot[cell] = 2; hits++;
        var s = enemy.ships[idx]; s.hits++;
        addFx("boom", rects.enemy, r, c);
        if (sfx && sfx.boom) sfx.boom(); else if (sfx && sfx.pop) sfx.pop();
        if (juice) juice.shake(4);
        if (s.hits >= s.size) {
          s.sunk = true; result = "sunk"; logShot("🎯", r, c, true, s.name);
          big("💥 You sank the " + s.name + "!", "#69f0ae");
          if (sfx && sfx.chime) sfx.chime();
          if (remaining(enemy) <= 0) { endMatch(true); return "sunk"; }
        } else { result = "hit"; logShot("🎯", r, c, true); big("💥 Direct hit!", "#ffd23f"); }
      } else {
        enemy.shot[cell] = 1; result = "miss"; logShot("🎯", r, c, false);
        addFx("splash", rects.enemy, r, c);
        if (sfx && sfx.plip) sfx.plip();
        turn = "bot"; botThinkT = 0.6;
      }
      updateHud();
      return result;
    }

    // ---------- bot admiral AI (hunt / target — reads ONLY its own shots) ----------
    function pushTarget(r, c) {
      if (r < 0 || r > 9 || c < 0 || c > 9) return;
      var cell = r * 10 + c;
      if (you.shot[cell] !== 0) return;
      if (botTargets.indexOf(cell) < 0) botTargets.push(cell);
    }
    function pushNeighbors(cell) { var r = Math.floor(cell / 10), c = cell % 10; pushTarget(r - 1, c); pushTarget(r + 1, c); pushTarget(r, c - 1); pushTarget(r, c + 1); }
    function rebuildTargets() { // line-aware once 2+ hits share a row/col
      botTargets = [];
      if (!botHits.length) return;
      if (botHits.length === 1) { pushNeighbors(botHits[0]); return; }
      var r0 = Math.floor(botHits[0] / 10), c0 = botHits[0] % 10, sameR = true, sameC = true;
      var rs = [], cs = [];
      botHits.forEach(function (h) { var r = Math.floor(h / 10), c = h % 10; if (r !== r0) sameR = false; if (c !== c0) sameC = false; rs.push(r); cs.push(c); });
      if (sameR) { var mn = Math.min.apply(null, cs), mx = Math.max.apply(null, cs); pushTarget(r0, mn - 1); pushTarget(r0, mx + 1); }
      else if (sameC) { var mnr = Math.min.apply(null, rs), mxr = Math.max.apply(null, rs); pushTarget(mnr - 1, c0); pushTarget(mxr + 1, c0); }
      else botHits.forEach(function (h) { pushNeighbors(h); });
    }
    function botPick() {
      while (botTargets.length) { var cand = botTargets.pop(); if (you.shot[cand] === 0) return cand; } // target mode
      var list = []; for (var i = 0; i < 100; i++) if (you.shot[i] === 0) list.push(i); // hunt mode
      if (!list.length) return -1;
      var pool = list;
      if (botParity) { var par = []; for (var k = 0; k < list.length; k++) { var cc = list[k]; if (((Math.floor(cc / 10) + (cc % 10)) & 1) === botPar) par.push(cc); } if (par.length) pool = par; }
      return pool[Math.floor(Math.random() * pool.length)];
    }
    function botShoot() { // one shot; returns { r, c, result }
      if (phase !== "battle" || over) return null;
      var cell = botPick(); if (cell < 0) return null;
      var r = Math.floor(cell / 10), c = cell % 10, idx = you.occ[cell], result;
      touched = true; botShots++;
      shell(rects.enemy, rects.you, r, c);
      if (idx >= 0) {
        you.shot[cell] = 2; var s = you.ships[idx]; s.hits++; botHits.push(cell);
        addFx("boom", rects.you, r, c);
        if (juice) juice.shake(5);
        if (s.hits >= s.size) {
          s.sunk = true; result = "sunk"; logShot("🔴", r, c, true, s.name);
          big("🚢 " + rival.name + " sank your " + s.name + "!", "#ff8a8a");
          botHits = []; botTargets = [];
          if (remaining(you) <= 0) { endMatch(false); return { r: r, c: c, result: "sunk" }; }
        } else { result = "hit"; logShot("🔴", r, c, true); rebuildTargets(); }
        botThinkT = 0.55; // a hit means the admiral fires again (stays its turn)
        checkRepairOffer();
      } else {
        you.shot[cell] = 1; result = "miss"; logShot("🔴", r, c, false);
        addFx("splash", rects.you, r, c);
        turn = "you"; // salvo returns to you
      }
      updateHud();
      return { r: r, c: c, result: result };
    }

    // ---------- word hooks ----------
    function bestSonar() { // the 3×3 slice hiding the most un-shot enemy ship cells
      var best = [0, 0], bestN = -1;
      for (var r0 = 0; r0 <= 7; r0++) for (var c0 = 0; c0 <= 7; c0++) {
        var n = 0;
        for (var dr = 0; dr < 3; dr++) for (var dc = 0; dc < 3; dc++) { var cl = (r0 + dr) * 10 + (c0 + dc); if (enemy.occ[cl] >= 0 && enemy.shot[cl] === 0) n++; }
        if (n > bestN) { bestN = n; best = [r0, c0]; }
      }
      var cells = [];
      for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) cells.push((best[0] + a) * 10 + (best[1] + b));
      return cells;
    }
    function sonarQuiz() {
      if (phase !== "battle" || over || sonarUsed || quizOpen) return;
      quizOpen = true; paused = true; updateButtons();
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "📡 SONAR PING — answer to scan the enemy waters!", lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; quizOpen = false; paused = false;
          if (ok) {
            sonarUsed = true; sonarCells = bestSonar(); sonarT = 3;
            big("📡 Ping returned! Enemy ships revealed — fire fast!", "#5fd7c9");
            if (sfx && sfx.chime) sfx.chime();
          } else big("📡 No echo… try the sonar again.", "#ffd740");
          updateHud();
        }
      });
    }
    function lastShip() { var alive = you.ships.filter(function (s) { return !s.sunk; }); return alive.length === 1 ? alive[0] : null; }
    function canRepair() { if (repairUsed) return false; var s = lastShip(); return !!(s && (s.size - s.hits) === 1 && s.hits > 0); }
    function checkRepairOffer() {
      if (canRepair() && !repairOffered) { repairOffered = true; big("🛠 LAST SHIP! Tap EMERGENCY REPAIR — answer to patch it!", "#ffb24d"); }
    }
    function repairQuiz() {
      if (phase !== "battle" || over || quizOpen || !canRepair()) return;
      quizOpen = true; paused = true; updateButtons();
      var target = lastShip();
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "🛠 EMERGENCY REPAIR — answer to weld a cell back!", lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; quizOpen = false; paused = false;
          if (ok && target) {
            for (var i = 0; i < target.cells.length; i++) { var cl = target.cells[i]; if (you.shot[cl] === 2) { you.shot[cl] = 0; target.hits--; break; } }
            repairUsed = true;
            big("🛠 Hull repaired! A cell is back — fight on!", "#69f0ae");
            if (sfx && sfx.chime) sfx.chime();
          } else big("🛠 The weld failed — hold the line!", "#ffd740");
          updateHud();
        }
      });
    }

    // ---------- economy: ONE banking path ----------
    function accuracy() { return shots > 0 ? hits / shots : 0; }
    function rewards(win) {
      var rem = remaining(you);
      return {
        win: !!win,
        score: rem * 10 + hits,
        rankPtsDelta: win ? Math.min(12, 5 + winStreak * 2) : 2,
        xp: Math.min(80, 10 + hits * 3 + (win ? 24 : 0)),
        gems: win ? 24 + rem * 2 : Math.min(14, 4 + hits)
      };
    }
    function bankRun(win) {
      if (banked) return null;
      banked = true;
      var rw = rewards(win);
      var res = store.recordGame ? store.recordGame("fleet", rw) : null;
      return { rw: rw, res: res };
    }
    function endMatch(win) {
      if (over) return;
      over = true; won = win; phase = "over"; paused = true; turn = "you";
      var acc = accuracy();
      if (win) { stats.winsF = (stats.winsF || 0) + 1; winStreak++; } else winStreak = 0;
      if (shots > 0 && acc > (stats.bestAccuracy || 0)) stats.bestAccuracy = acc;
      if (store.save) store.save();
      var bank = bankRun(win) || { rw: rewards(win), res: null };
      showEnd(win, bank.rw, bank.res);
      updateButtons();
    }
    function showEnd(win, rw, res) {
      var accPct = Math.round(accuracy() * 100), bestPct = Math.round((stats.bestAccuracy || 0) * 100);
      var payRow = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>';
      var oppBtns = opponents.map(function (o, i) {
        var face = (o.avatar && o.avatar.face && o.avatar.face.length <= 2) ? o.avatar.face : "🙂";
        return '<button class="embtn" data-opp="' + i + '" style="min-width:104px"><span class="ebl">' + face + " " + o.name + '</span><span class="ebs">rematch</span></button>';
      }).join("");
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:480px">' +
        '<div style="font-size:46px">' + (win ? "🏆" : "🌊") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (win ? "🚢 FLEET VICTORY over " + rival.name + "!" : "😤 " + rival.name + " sank your fleet…") + '</div>' +
        payRow +
        '<div style="margin:2px 0;font-size:15px">🎯 Accuracy <b>' + accPct + '%</b> (' + hits + '/' + shots + ')' + (res && res.rankedUp ? '  ·  🎖 RANK UP!' : '') + '</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:8px">🏆 ' + (stats.winsF || 0) + ' fleet wins · 🎯 best accuracy ' + bestPct + '%</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
        '<button class="submit" id="flrematch" type="button">Rematch ➜</button>' + oppBtns +
        '<button class="wqskip" id="flleave" type="button">Leave</button></div></div>';
      cardEl.style.display = "flex";
      if (win && sfx && sfx.fanfare) sfx.fanfare();
      if (win && juice) { juice.shake(6); for (var c = 0; c < 6; c++) juice.burst(W * (0.15 + c * 0.14), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb", "#5fd7c9"][c], 16); }
      document.getElementById("flrematch").onclick = function () { begin(curOpp); };
      document.getElementById("flleave").onclick = exit;
      Array.prototype.forEach.call(cardEl.querySelectorAll("[data-opp]"), function (b) { b.onclick = function () { begin(+b.dataset.opp); }; });
    }

    // ---------- match lifecycle ----------
    function begin(oppIdx) {
      if (oppIdx === undefined || oppIdx === null) oppIdx = curOpp;
      curOpp = clamp(oppIdx | 0, 0, opponents.length - 1);
      rival = opponents[curOpp];
      you = makeBoard(); enemy = makeBoard();
      randPlace(enemy); defaultPlace(you); // enemy hidden & random; your fleet starts tidy (drag / 🔄 / 🎲 to arrange)
      phase = "setup"; turn = "you"; over = false; won = false; paused = false; banked = false; touched = false;
      hits = 0; shots = 0; botShots = 0; quizOpen = false;
      sonarUsed = false; repairUsed = false; repairOffered = false;
      sonarCells = []; sonarT = 0; fx = []; log = []; logEl.innerHTML = "";
      selShip = -1; dragging = false; botTargets = []; botHits = [];
      botParity = rival.skill >= 0.5; botPar = Math.floor(Math.random() * 2); // sharper admirals hunt on parity
      cardEl.style.display = "none"; qEl.style.display = "none";
      msgEl.innerHTML = "⚓ <b>Place your fleet</b> — vs Admiral " + rival.name;
      big("⚓ Deploy your fleet, Captain!", "#ffe14d");
      updateHud();
    }
    function lockIn() {
      if (phase !== "setup") return false;
      if (!allPlaced(you)) { big("⚓ Place all 5 ships first!", "#ffd740"); return false; }
      phase = "battle"; turn = "you"; selShip = -1;
      msgEl.innerHTML = "🚢 <b>Battle stations!</b> — vs Admiral " + rival.name;
      big("🎯 FIRE! Sink " + rival.name + "'s fleet!", "#ffe14d");
      if (sfx && sfx.whoosh) sfx.whoosh();
      updateHud();
      return true;
    }
    function shuffle() { if (phase === "setup") { randPlace(you); selShip = -1; if (sfx && sfx.pop) sfx.pop(); updateHud(); } }
    function rotateSel() {
      if (phase !== "setup" || selShip < 0) { big("Tap a ship to select, then 🔄 Rotate", "#8ecdf7"); return; }
      var s = you.ships[selShip];
      s.placed = false; rebuildOcc(you);
      if (!tryPlace(you, selShip, s.r, s.c, !s.horiz)) tryPlace(you, selShip, s.r, s.c, s.horiz); // revert if it won't fit
      if (sfx && sfx.pop) sfx.pop();
      updateHud();
    }

    // ---------- setup input (tap-select + tap-place + drag) ----------
    function shipAt(cell) { var o = you.occ[cell]; return o >= 0 ? o : -1; }
    function tapCell(r, c) {
      if (phase !== "setup") return;
      var cell = r * 10 + c, owner = shipAt(cell);
      if (selShip >= 0) { // place the selected ship's anchor here
        var s = you.ships[selShip]; s.placed = false; rebuildOcc(you);
        if (tryPlace(you, selShip, r, c, s.horiz)) { selShip = -1; if (sfx && sfx.pop) sfx.pop(); }
        else { tryPlace(you, selShip, s.r, s.c, s.horiz); if (owner >= 0) selShip = owner; else big("⚓ Won't fit there!", "#ffd740"); }
      } else if (owner >= 0) selShip = owner; // select a ship
      updateHud();
    }
    var downCell = null, moved = false;
    function pt(e, touch) { var rc = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - rc.left, y: s.clientY - rc.top }; }
    function onDown(px, py) {
      if (paused || quizOpen) return;
      var hit = pointToCell(px, py);
      if (!hit) return;
      if (phase === "battle" && hit.which === "enemy" && turn === "you") { fire(hit.r, hit.c); return; }
      if (phase === "setup" && hit.which === "you") {
        downCell = hit; moved = false;
        var owner = shipAt(hit.r * 10 + hit.c);
        if (owner >= 0) { selShip = owner; dragging = true; dragOrig = { r: you.ships[owner].r, c: you.ships[owner].c, horiz: you.ships[owner].horiz }; }
        updateHud();
      }
    }
    function onMove(px, py) {
      if (!dragging || phase !== "setup" || selShip < 0) return;
      var hit = pointToCell(px, py);
      if (!hit || hit.which !== "you") return;
      moved = true;
      var s = you.ships[selShip];
      s.placed = false; rebuildOcc(you);
      if (!tryPlace(you, selShip, hit.r, hit.c, s.horiz)) tryPlace(you, selShip, dragOrig.r, dragOrig.c, dragOrig.horiz);
    }
    function onUp(px, py) {
      if (phase === "setup" && downCell && !moved) tapCell(downCell.r, downCell.c);
      else if (dragging) selShip = -1;
      dragging = false; downCell = null;
      updateHud();
    }
    cv.addEventListener("mousedown", function (e) { var p = pt(e); onDown(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { var p = pt(e); onMove(p.x, p.y); });
    cv.addEventListener("mouseup", function (e) { var p = pt(e); onUp(p.x, p.y); });
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); onDown(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); onMove(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); var t = e.changedTouches[0]; var p = pt(e, t); onUp(p.x, p.y); }, { passive: false });
    document.getElementById("flrotate").onclick = rotateSel;
    document.getElementById("flshuffle").onclick = shuffle;
    document.getElementById("fllock").onclick = lockIn;
    sonarBtn.onclick = sonarQuiz;
    repairBtn.onclick = repairQuiz;

    // ---------- simulation ----------
    function step(dt) {
      gt += dt;
      if (sonarT > 0) sonarT = Math.max(0, sonarT - dt);
      for (var i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t >= fx[i].dur) fx.splice(i, 1); }
      if (juice) juice.update(dt);
      if (phase === "battle" && !over && !paused && !quizOpen && turn === "bot") {
        botThinkT -= dt;
        if (botThinkT <= 0) botShoot();
      }
    }
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; // cosmetic dt, clamped
      if (!paused) step(dt);
      draw();
    }

    // ---------- drawing ----------
    function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function drawGrid(board, rect, isYou) {
      var gw = S * GRID;
      // labels
      ctx.fillStyle = "rgba(220,245,255,.75)"; ctx.font = "bold " + Math.max(9, Math.round(S * 0.32)) + "px Trebuchet MS, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (var c = 0; c < GRID; c++) ctx.fillText(String.fromCharCode(65 + c), cellX(rect, c) + S / 2, rect.oy - LB / 2);
      ctx.textAlign = "right";
      for (var r = 0; r < GRID; r++) ctx.fillText(String(r + 1), rect.ox - 3, cellY(rect, r) + S / 2);
      ctx.textAlign = "center";
      // water cells (shimmer)
      for (r = 0; r < GRID; r++) for (c = 0; c < GRID; c++) {
        var x = cellX(rect, c), y = cellY(rect, r);
        var sh = Math.sin(r * 0.7 + c * 1.3 + gt * 1.8) * 10;
        ctx.fillStyle = "rgb(" + (24 + sh) + "," + (70 + sh) + "," + (120 + sh) + ")";
        ctx.fillRect(x, y, S, S);
      }
      // your ships (visible bodies)
      if (isYou) board.ships.forEach(function (s) {
        if (!s.placed) return;
        var head = s.cells[0], tail = s.cells[s.cells.length - 1];
        var hx = cellX(rect, head % 10), hy = cellY(rect, Math.floor(head / 10));
        var tx = cellX(rect, tail % 10) + S, ty = cellY(rect, Math.floor(tail / 10)) + S;
        ctx.fillStyle = s.sunk ? "#5a2530" : "#556170";
        roundRect(hx + S * 0.12, hy + S * 0.12, (tx - hx) - S * 0.24, (ty - hy) - S * 0.24, S * 0.22); ctx.fill();
        if (selShip >= 0 && board.ships[selShip] === s) { ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3; ctx.stroke(); }
      });
      else board.ships.forEach(function (s) { // enemy: reveal only sunk hulls
        if (!s.sunk) return;
        var head = s.cells[0], tail = s.cells[s.cells.length - 1];
        var hx = cellX(rect, head % 10), hy = cellY(rect, Math.floor(head / 10));
        var tx = cellX(rect, tail % 10) + S, ty = cellY(rect, Math.floor(tail / 10)) + S;
        ctx.fillStyle = "#5a2530"; roundRect(hx + S * 0.12, hy + S * 0.12, (tx - hx) - S * 0.24, (ty - hy) - S * 0.24, S * 0.22); ctx.fill();
      });
      // sonar ghosts (enemy only)
      if (!isYou && sonarT > 0) {
        ctx.globalAlpha = 0.35 + Math.sin(gt * 6) * 0.12;
        sonarCells.forEach(function (cl) {
          if (board.occ[cl] >= 0 && board.shot[cl] === 0) { ctx.fillStyle = "#5fd7c9"; ctx.fillRect(cellX(rect, cl % 10) + S * 0.2, cellY(rect, Math.floor(cl / 10)) + S * 0.2, S * 0.6, S * 0.6); }
        });
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(95,215,201,.7)"; ctx.lineWidth = 2;
        if (sonarCells.length) { var c0 = sonarCells[0]; ctx.strokeRect(cellX(rect, c0 % 10), cellY(rect, Math.floor(c0 / 10)), S * 3, S * 3); }
      }
      // shot markers + smoke on burning ships
      ctx.font = Math.round(S * 0.62) + "px serif";
      for (r = 0; r < GRID; r++) for (c = 0; c < GRID; c++) {
        var cell = r * 10 + c, sx = cellX(rect, c) + S / 2, sy = cellY(rect, r) + S / 2;
        if (board.shot[cell] === 2) { ctx.fillText("💥", sx, sy); if (Math.sin((r + c) * 2 + gt * 3) > 0.3) { ctx.globalAlpha = 0.35; ctx.fillStyle = "rgba(60,60,60,1)"; ctx.beginPath(); ctx.arc(sx, sy - S * 0.4 - Math.sin(gt * 2 + cell) * 4, S * 0.18, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } }
        else if (board.shot[cell] === 1) { ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(sx, sy, S * 0.13, 0, Math.PI * 2); ctx.fill(); }
      }
      // grid lines + frame
      ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 1;
      for (var g = 0; g <= GRID; g++) { ctx.beginPath(); ctx.moveTo(rect.ox + g * S, rect.oy); ctx.lineTo(rect.ox + g * S, rect.oy + gw); ctx.stroke(); ctx.beginPath(); ctx.moveTo(rect.ox, rect.oy + g * S); ctx.lineTo(rect.ox + gw, rect.oy + g * S); ctx.stroke(); }
      ctx.strokeStyle = isYou ? "#69f0ae" : (turn === "you" && phase === "battle" ? "#ffd23f" : "#ff6b6b"); ctx.lineWidth = 3;
      ctx.strokeRect(rect.ox, rect.oy, gw, gw);
    }
    function draw() {
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0a1a2e"); g.addColorStop(1, "#04101f");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); if (juice) ctx.translate(juice.ox, juice.oy);
      drawGrid(enemy, rects.enemy, false);
      drawGrid(you, rects.you, true);
      // fx: shells arc, splashes, booms
      for (var i = 0; i < fx.length; i++) {
        var f = fx[i], p = f.t / f.dur;
        if (f.kind === "shell") {
          var x = f.x0 + (f.x - f.x0) * p, y = f.y0 + (f.y - f.y0) * p - Math.sin(p * Math.PI) * 60;
          ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        } else if (f.kind === "splash") {
          ctx.strokeStyle = "rgba(150,220,255," + (1 - p) + ")"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x, f.y, S * 0.2 + p * S * 0.4, 0, Math.PI * 2); ctx.stroke();
        } else if (f.kind === "boom") {
          ctx.fillStyle = "rgba(255," + Math.round(140 - p * 100) + ",40," + (1 - p) + ")";
          ctx.beginPath(); ctx.arc(f.x, f.y, S * 0.2 + p * S * 0.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    // ---------- exit / banking ----------
    function bankExit() {
      if (over || phase !== "battle" || !touched) return; // untouched / already-banked runs bank nothing
      var bank = bankRun(false);
      if (bank && sfx && sfx.toast) sfx.toast("🚢 Fleet run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    var running = true, raf = 0, lastT = performance.now();
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (specs are written against this exact shape) ----------
    cv._fleet = {
      state: function () {
        return {
          phase: phase, turn: turn, yourCells: remaining(you), enemyCells: remaining(enemy),
          hits: hits, shots: shots, won: won, banked: banked, sonarUsed: sonarUsed, repairUsed: repairUsed
        };
      },
      begin: begin,
      placeShip: function (i, r, c, horiz) { if (phase !== "setup" || i < 0 || i > 4) return false; var s = you.ships[i]; s.placed = false; rebuildOcc(you); var ok = tryPlace(you, i, r, c, !!horiz); if (!ok && s.cells.length) tryPlace(you, i, s.r, s.c, s.horiz); return ok; },
      shuffle: shuffle,
      lockIn: lockIn,
      fire: fire,
      enemyGrid: function () { return { occ: enemy.occ.slice(), shot: enemy.shot.slice(), ships: enemy.ships.map(function (s) { return { name: s.name, size: s.size, cells: s.cells.slice(), hits: s.hits, sunk: s.sunk }; }) }; },
      botFire: botShoot,
      sonarQuiz: sonarQuiz,
      repairQuiz: repairQuiz,
      tick: function (sec) {
        var left = sec || 0;
        while (left > 0) { var d = Math.min(0.05, left); var sp = paused; paused = false; step(d); if (sp) paused = sp; left -= d; }
        draw();
      }
    };

    // ---------- boot ----------
    begin(0);
    if (global._fleetdemo) { // screenshot seed: a lively mid-battle tableau
      global._fleetdemo = 0;
      lockIn();
      // your shots on the enemy grid: a couple of hits + misses, one enemy ship burning
      var eBurn = enemy.ships[1]; if (eBurn.placed) { enemy.shot[eBurn.cells[0]] = 2; eBurn.hits = 1; }
      enemy.shot[3] = 1; enemy.shot[27] = 1; enemy.shot[44] = 2;
      hits = 2; shots = 4; logShot("🎯", 4, 4, true); logShot("🎯", 0, 3, false);
      // enemy shots on your grid
      var yTarget = you.ships[0]; if (yTarget.placed) { you.shot[yTarget.cells[0]] = 2; yTarget.hits = 1; botShots = 3; }
      you.shot[55] = 1; you.shot[71] = 1;
      // a sonar ghost hovering over the enemy waters
      sonarUsed = true; sonarCells = bestSonar(); sonarT = 3;
      turn = "you"; paused = true; updateHud(); draw();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxFleet = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
