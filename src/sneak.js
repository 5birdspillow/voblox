/*
 * Voblox stealth game — 🥷 SHADOW SNEAK (a Metal-Gear-lite, fully kid-friendly).
 * 16 hand-authored single-screen levels on a letterboxed ~13×9 grid. Sneak your
 * ninja from the 🚪 door to the 💎 treasure and back out to the exit while GUARDS
 * patrol fixed routes sweeping soft yellow VISION CONES — the one readable
 * mechanic the whole game hangs on. Step into a cone and you're spotted: a kind
 * "❗", a whistle, and the room simply RESTARTS (nobody is ever hurt; an attempt
 * counter ticks). Later levels layer on 📷 blinking wall cameras, 🔦 sweeping
 * searchlights, 🌳 bushes you hide inside (cones can't see you), pressure plates
 * that squeak and make nearby guards LOOK your way, and 🪙 lure coins you toss to
 * pull a guard off route.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🕶 SMOKE BOMB: answer a word (miniQuiz) to bank a smoke bomb (max 2);
 *     using one FREEZES every cone for 4s (risk/reward escape valve).
 *   - 🔑 LEVEL PACKS: levels 6-10 and 11-16 are word-gated the first time
 *     (one word each pack; the unlock persists forever).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("sneak")
 * per SESSION, banked once on Leave AND app-close. Stars persist additively
 * (stats.starsSn: level->best); smoke uses count (stats.smokes); packs persist.
 *
 * 3 stars: ⭐ finish · ⭐ never spotted · ⭐ under par time.
 * Determinism: patrols/cones are dt-driven off FIXED routes with NO randomness,
 * so specs can assert positions and detection precisely.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var COLS = 13, ROWS = 9;
  var HP = Math.PI / 2, E = 0, Sd = HP, Wd = Math.PI, Nd = -HP;
  var CONE_RANGE = 4.3, CONE_HALF = 0.46; // ~26° half-angle
  var WALK = 3.4, DASH = 6.6;             // tiles / second
  var LURE_TIME = 4, ALERT_TIME = 2, SMOKE_TIME = 4, ALERT_R = 5;

  // ---------- 16 hand-authored levels ----------
  // grid legend: # wall · . floor · D door(start) · X exit · T 💎 treasure ·
  //   B 🌳 bush(hide) · P pressure plate(squeaks).
  // guards: {k:"g",route:[[c,r]...],spd}  camera:{k:"c",at:[c,r],dir,per,on}
  //   searchlight:{k:"l",at:[c,r],dir,arc,spd}. dir is an angle (E/Sd/Wd/Nd).
  var LEVELS = [
    { name: "First Shadow", par: 26,
      g: ["#############", "#D.........X#", "#...........#", "#...........#", "#.....T.....#", "#...........#", "#...........#", "#.B.......B.#", "#############"],
      guards: [{ k: "g", route: [[3, 7], [9, 7]], spd: 1.3 }] },
    { name: "Two Watchers", par: 30,
      g: ["#############", "#D.........X#", "#...........#", "#...#####...#", "#...........#", "#.....T.....#", "#...........#", "#...........#", "#############"],
      guards: [{ k: "g", route: [[2, 2], [10, 2]], spd: 1.3 }, { k: "g", route: [[10, 7], [2, 7]], spd: 1.3 }] },
    { name: "Squeaky Floor", par: 32,
      g: ["#############", "#D....P....X#", "#...........#", "#..#.....#..#", "#....T......#", "#..#.....#..#", "#....P......#", "#...........#", "#############"],
      guards: [{ k: "g", route: [[2, 4], [10, 4]], spd: 1.4 }] },
    { name: "Hedge Rows", par: 34,
      g: ["#############", "#D.........X#", "#.B.......B.#", "#...........#", "#....T......#", "#...........#", "#.B.......B.#", "#...........#", "#############"],
      guards: [{ k: "g", route: [[2, 4], [10, 4]], spd: 1.5 }, { k: "g", route: [[6, 2], [6, 7]], spd: 1.2 }] },
    { name: "Crossfire", par: 36,
      g: ["#############", "#D...B.....X#", "#...........#", "#..#.P.#....#", "#....T......#", "#..#...#....#", "#.....B....#", "#...........#", "#############"],
      guards: [{ k: "g", route: [[2, 2], [10, 2]], spd: 1.4 }, { k: "g", route: [[10, 7], [2, 7]], spd: 1.4 }, { k: "g", route: [[6, 1], [6, 6]], spd: 1.2 }] },
    { name: "Eye on the Wall", par: 30,
      g: ["#############", "#D.........X#", "#...........#", "#....T......#", "#...........#", "#...........#", "#...........#", "#...........#", "#############"],
      guards: [{ k: "g", route: [[2, 2], [10, 2]], spd: 1.4 }, { k: "c", at: [6, 6], dir: Nd, per: 3, on: 1.8 }] },
    { name: "Blinkers", par: 34,
      g: ["#############", "#D.........X#", "#.B.......B.#", "#...........#", "#.....T.....#", "#...........#", "#.B.......B.#", "#...........#", "#############"],
      guards: [{ k: "g", route: [[2, 4], [10, 4]], spd: 1.5 }, { k: "c", at: [3, 2], dir: Sd, per: 2.6, on: 1.5 }, { k: "c", at: [9, 6], dir: Nd, per: 2.6, on: 1.5 }] },
    { name: "Spotlight", par: 40,
      g: ["#############", "#D.........X#", "#..B.....B..#", "#...........#", "#....T......#", "#...........#", "#..B.....B..#", "#...........#", "#############"],
      guards: [{ k: "g", route: [[2, 3], [10, 3]], spd: 1.4 }, { k: "g", route: [[10, 7], [2, 7]], spd: 1.4 }, { k: "l", at: [6, 5], dir: Nd, arc: 1.0, spd: 1.1 }] },
    { name: "Camera Maze", par: 42,
      g: ["#############", "#D...#.....X#", "#....#.B....#", "#....#.....#", "#..T.#.....#", "#....#.....#", "#..B.#.....#", "#........P.#", "#############"].map(function (s) { return s.length === 13 ? s : (s + "############").slice(0, 13); }),
      guards: [{ k: "g", route: [[8, 7], [2, 7]], spd: 1.4 }, { k: "c", at: [10, 2], dir: Wd, per: 3, on: 2 }, { k: "l", at: [3, 4], dir: E, arc: 0.7, spd: 1.2 }] },
    { name: "Lockdown", par: 44,
      g: ["#############", "#D.........X#", "#.B.......B.#", "#....P......#", "#.....T.....#", "#....P......#", "#.B.......B.#", "#...........#", "#############"],
      guards: [{ k: "g", route: [[2, 2], [10, 2]], spd: 1.5 }, { k: "g", route: [[10, 6], [2, 6]], spd: 1.5 }, { k: "l", at: [6, 4], dir: Sd, arc: 1.2, spd: 1.0 }] },
    { name: "Night Patrol", par: 40,
      g: ["#############", "#D.........X#", "#...........#", "#....T......#", "#...........#", "#...........#", "#......B....#", "#...........#", "#############"],
      guards: [{ k: "g", route: [[2, 2], [10, 2]], spd: 1.5 }, { k: "l", at: [6, 6], dir: Nd, arc: 1.1, spd: 1.3 }] },
    { name: "Sweep", par: 44,
      g: ["#############", "#D.........X#", "#.B.......B.#", "#...........#", "#.....T.....#", "#...........#", "#.B.......B.#", "#...........#", "#############"],
      guards: [{ k: "l", at: [3, 4], dir: E, arc: 1.2, spd: 1.1 }, { k: "l", at: [9, 4], dir: Wd, arc: 1.2, spd: 1.1 }, { k: "g", route: [[2, 7], [10, 7]], spd: 1.5 }] },
    { name: "Watchtowers", par: 46,
      g: ["#############", "#D...#####.X#", "#....#...#.#", "#..T.#.P.#.#", "#....#...#.#", "#....#...#.#", "#.........B#", "#B........P#", "#############"],
      guards: [{ k: "g", route: [[1, 6], [1, 2]], spd: 1.4 }, { k: "c", at: [6, 3], dir: Sd, per: 2.4, on: 1.6 }, { k: "l", at: [10, 5], dir: Nd, arc: 0.8, spd: 1.2 }] },
    { name: "Gauntlet", par: 50,
      g: ["#############", "#D.........X#", "#.B..P..B..#", "#...........#", "#....T......#", "#...........#", "#.B..P..B..#", "#...........#", "#############"],
      guards: [{ k: "g", route: [[2, 3], [10, 3]], spd: 1.6 }, { k: "g", route: [[10, 5], [2, 5]], spd: 1.6 }, { k: "l", at: [6, 4], dir: E, arc: 1.4, spd: 1.3 }, { k: "c", at: [1, 7], dir: E, per: 2.2, on: 1.4 }] },
    { name: "The Vault", par: 52,
      g: ["#############", "#D...#.#...X#", "#....#.#...#", "#.B..#T#..B#", "#....#.#...#", "#....#.#...#", "#..P.....P.#", "#B.......B.#", "#############"].map(function (s) { return (s + "############").slice(0, 13); }),
      guards: [{ k: "g", route: [[2, 7], [10, 7]], spd: 1.6 }, { k: "l", at: [1, 4], dir: E, arc: 0.9, spd: 1.2 }, { k: "l", at: [11, 4], dir: Wd, arc: 0.9, spd: 1.2 }, { k: "c", at: [6, 1], dir: Sd, per: 2, on: 1.4 }] },
    { name: "Grandmaster", par: 58,
      g: ["#############", "#D.B.....B.X#", "#....P.P....#", "#...........#", "#.B..#T#..B.#", "#...........#", "#....P.P....#", "#.B.......B.#", "#############"],
      guards: [{ k: "g", route: [[2, 3], [10, 3]], spd: 1.7 }, { k: "g", route: [[10, 6], [2, 6]], spd: 1.7 }, { k: "l", at: [6, 5], dir: Nd, arc: 1.4, spd: 1.4 }, { k: "c", at: [1, 1], dir: Sd, per: 2, on: 1.5 }, { k: "c", at: [11, 7], dir: Nd, per: 2, on: 1.5 }] }
  ];

  function packOf(lv) { return lv <= 5 ? 1 : lv <= 10 ? 2 : 3; }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("sneak");
    stats.starsSn = stats.starsSn || {};   // level -> best stars (additive)
    stats.packs = stats.packs || {};       // "2"/"3" -> unlocked
    if (!stats.smokes) stats.smokes = 0;    // lifetime smoke bombs used

    var wrap = document.createElement("div");
    wrap.className = "gamewrap sneak";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="snkcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="snkmsg">🥷 Shadow Sneak</div>' +
      '<div class="grow"><span id="snkstat"></span><span id="snkstars"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="snkbig"></div>' +
      '<button id="snkearn" type="button" style="display:none;position:absolute;left:12px;' +
      'bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:8;background:linear-gradient(#c9d6ff,#8a9bd8);' +
      'color:#1c2340;border:none;border-radius:14px;padding:11px 15px;font-family:inherit;font-weight:900;' +
      'font-size:14px;box-shadow:0 5px 0 #5a6aa8,0 8px 20px #0006;cursor:pointer">🕶 Smoke (a word)</button>' +
      '<button id="snkuse" type="button" style="display:none;position:absolute;right:12px;' +
      'bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:8;background:#eef2ff;color:#2a3566;' +
      'border:none;border-radius:14px;padding:11px 15px;font-family:inherit;font-weight:900;' +
      'font-size:14px;box-shadow:0 5px 0 #aab3d8,0 8px 20px #0005;cursor:pointer">💨 Use Smoke</button>' +
      '<div class="gover" id="snkq" style="display:none"></div>' +
      '<div class="gover" id="snkend" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#snkcv"), ctx = cv.getContext("2d");
    var snkq = document.getElementById("snkq"), snkend = document.getElementById("snkend");
    var msgEl = document.getElementById("snkmsg"), bigEl = document.getElementById("snkbig");
    var earnBtn = document.getElementById("snkearn"), useBtn = document.getElementById("snkuse");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H, tile, OX, OY;
    function resize() { W = cv.width = wrap.clientWidth || global.innerWidth || 360; H = cv.height = wrap.clientHeight || global.innerHeight || 640; metrics(); }
    function metrics() {
      var top = Math.min(W, H) < 520 ? 108 : 128, padH = 14, padB = 78;
      tile = Math.min((W - padH * 2) / COLS, (H - top - padB) / ROWS, 74);
      if (!(tile > 0)) tile = 1;
      OX = (W - tile * COLS) / 2; OY = top + Math.max(0, (H - top - padB - tile * ROWS) / 2);
    }

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var LV = null, grid = null, level = 0, par = 0, active = false, paused = false, over = false;
    var ninja = { c: 1, r: 1 }, door = { c: 1, r: 1 }, treasure = { c: 6, r: 4 }, exitT = { c: 11, r: 1 };
    var hasTreasure = false, spottedThis = 0, attempt = 1, elapsed = 0;
    var guards = [], path = [], dashing = false, coin = null, stick = null;
    var smokes = 0, smokeT = 0;
    var sessionNewStars = 0, session3 = false, banked = false, lastFmt = null, demoStars = null;
    var tickCd = 0;

    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1200); }
    function totalStars() { var s = 0; for (var k in stats.starsSn) s += stats.starsSn[k]; return s; }
    function packUnlocked(lv) { var p = packOf(lv); return p === 1 || !!stats.packs[p]; }
    function hud() {
      msgEl.innerHTML = active ? ("🥷 <b>" + level + ". " + LV.name + "</b>") : "🥷 Shadow Sneak";
      document.getElementById("snkstat").textContent = active
        ? ((hasTreasure ? "💎 got it! → exit" : "→ 💎") + "  ·  🕶" + smokes + (attempt > 1 ? "  ·  try " + attempt : "")) : "";
      var sv = demoStars != null ? demoStars : (stats.starsSn[level] || 0);
      document.getElementById("snkstars").textContent = active ? (rep("⭐", sv) + rep("☆", 3 - sv)) : "";
    }
    function rep(s, n) { return n > 0 ? new Array(n + 1).join(s) : ""; }

    // ---------- grid helpers ----------
    function chAt(c, r) { if (!grid || !grid[r] || r < 0 || r >= ROWS || c < 0 || c >= COLS) return "#"; return grid[r].charAt(c); }
    function walkable(c, r) { return chAt(c, r) !== "#"; }
    function isBush(c, r) { return chAt(c, r) === "B"; }
    function parseGrid(rows) {
      grid = []; // normalize every row to exactly COLS wide (pad/clip with wall)
      for (var i = 0; i < ROWS; i++) grid.push(((rows[i] || "") + "#############").slice(0, COLS));
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var ch = grid[r].charAt(c);
        if (ch === "D") door = { c: c, r: r };
        else if (ch === "X") exitT = { c: c, r: r };
        else if (ch === "T") treasure = { c: c, r: r };
      }
    }

    // ---------- guards / cones (deterministic) ----------
    function faceTo(p, tg) { var dx = tg.c - p.c, dy = tg.r - p.r; if (Math.abs(dx) + Math.abs(dy) < 1e-4) return null; return Math.atan2(dy, dx); }
    function moveToward(p, tg, step) { var dx = tg.c - p.c, dy = tg.r - p.r, d = Math.hypot(dx, dy); if (d <= step || d < 1e-6) { p.c = tg.c; p.r = tg.r; return true; } p.c += dx / d * step; p.r += dy / d * step; return false; }
    function initGuards(data) {
      return data.guards.map(function (gd) {
        if (gd.k === "g") {
          var rt = gd.route.map(function (p) { return { c: p[0], r: p[1] }; });
          return { k: "g", pos: { c: rt[0].c, r: rt[0].r }, route: rt, ti: 1, tdir: 1, spd: gd.spd || 1.3,
            face: Math.atan2(rt[1].r - rt[0].r, rt[1].c - rt[0].c), coneOn: true, range: CONE_RANGE, half: CONE_HALF,
            alertT: 0, lureT: 0, alertTarget: null, lureTarget: null };
        }
        if (gd.k === "c") return { k: "c", pos: { c: gd.at[0], r: gd.at[1] }, face: gd.dir, per: gd.per || 3, on: gd.on || 1.8, ph: 0, coneOn: true, range: gd.range || CONE_RANGE, half: CONE_HALF };
        return { k: "l", pos: { c: gd.at[0], r: gd.at[1] }, dir0: gd.dir, arc: gd.arc || 0.9, sw: gd.spd || 1.1, ph: 0, face: gd.dir, coneOn: true, range: gd.range || CONE_RANGE, half: CONE_HALF };
      });
    }
    function stepPatrols(dt) {
      if (smokeT > 0) return; // 🕶 all cones frozen
      for (var i = 0; i < guards.length; i++) {
        var g = guards[i];
        if (g.k === "c") { g.ph += dt; g.coneOn = (g.ph % g.per) < g.on; continue; }
        if (g.k === "l") { g.ph += dt; g.face = g.dir0 + g.arc * Math.sin(g.ph * g.sw); continue; }
        // patrol guard
        if (g.lureT > 0) { g.lureT -= dt; var fl = faceTo(g.pos, g.lureTarget); if (fl != null) g.face = fl; moveToward(g.pos, g.lureTarget, g.spd * dt); continue; }
        if (g.alertT > 0) { g.alertT -= dt; var fa = faceTo(g.pos, g.alertTarget); if (fa != null) g.face = fa; continue; }
        var tg = g.route[g.ti], fc = faceTo(g.pos, tg); if (fc != null) g.face = fc;
        if (moveToward(g.pos, tg, g.spd * dt)) {
          g.ti += g.tdir;
          if (g.ti >= g.route.length) { g.ti = g.route.length - 2; g.tdir = -1; }
          else if (g.ti < 0) { g.ti = 1; g.tdir = 1; }
        }
      }
    }
    function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
    function los(gc, gr, nc, nr) {
      var dx = nc - gc, dy = nr - gr, steps = Math.ceil(Math.hypot(dx, dy) * 4);
      for (var i = 1; i < steps; i++) { var t = i / steps; if (chAt(Math.round(gc + dx * t), Math.round(gr + dy * t)) === "#") return false; }
      return true;
    }
    function coneOnOf(g) { return smokeT > 0 ? false : (g.k === "c" ? g.coneOn : true); }
    function coneSees(g, nc, nr) {
      if (!coneOnOf(g)) return false;
      var dx = nc - g.pos.c, dy = nr - g.pos.r, dist = Math.hypot(dx, dy);
      if (dist > g.range) return false;
      if (dist < 0.35) return true;
      if (Math.abs(angDiff(Math.atan2(dy, dx), g.face)) > g.half) return false;
      return los(g.pos.c, g.pos.r, nc, nr);
    }
    // is the ninja seen RIGHT NOW? (bush + active smoke both hide you)
    function seen() {
      if (smokeT > 0) return false;
      if (isBush(Math.round(ninja.c), Math.round(ninja.r))) return false;
      for (var i = 0; i < guards.length; i++) if (coneSees(guards[i], ninja.c, ninja.r)) return true;
      return false;
    }
    function nearestConeGap() { // smallest "how close to being seen" for the tension tick
      var best = 99;
      for (var i = 0; i < guards.length; i++) {
        var g = guards[i]; if (!coneOnOf(g)) continue;
        var dx = ninja.c - g.pos.c, dy = ninja.r - g.pos.r, dist = Math.hypot(dx, dy);
        if (dist > g.range + 1) continue;
        var ad = Math.abs(angDiff(Math.atan2(dy, dx), g.face));
        best = Math.min(best, ad + dist * 0.15);
      }
      return best;
    }

    // ---------- level flow ----------
    function beginLevel(n) {
      if (n < 1 || n > LEVELS.length) return;
      level = n; LV = LEVELS[n - 1]; parseGrid(LV.g); par = LV.par;
      ninja = { c: door.c, r: door.r }; hasTreasure = false;
      spottedThis = 0; attempt = 1; elapsed = 0; over = false; active = true; paused = false;
      path = []; dashing = false; coin = null; stick = null; smokeT = 0; demoStars = null;
      guards = initGuards(LV);
      metrics();
      snkend.style.display = "none"; snkq.style.display = "none";
      earnBtn.style.display = "block"; useBtn.style.display = "block";
      big("Sneak to the 💎 — mind the cones!", "#dfe6ff");
      hud();
    }
    // KIND reset: spotted just restarts the room (attempt++, nobody hurt)
    function spot() {
      if (over) return;
      spottedThis++; attempt++;
      ninja = { c: door.c, r: door.r }; hasTreasure = false;
      path = []; dashing = false; coin = null; stick = null;
      guards = initGuards(LV); // patrols snap back to their start (stays deterministic)
      big("❗ Spotted! Sneak again — try " + attempt, "#ffd23f");
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(6);
      hud();
    }
    function completeLevel(win) {
      if (over) return; over = true;
      var earned = 1 + (spottedThis === 0 ? 1 : 0) + (elapsed <= par ? 1 : 0);
      var prev = stats.starsSn[level] || 0;
      if (earned > prev) {
        sessionNewStars += (earned - prev);
        if (earned === 3 && prev < 3) session3 = true;
        stats.starsSn[level] = earned;
        if (store.save) store.save();
      }
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(6); if (earned === 3) for (var k = 0; k < 5; k++) juice.burst(W * (0.2 + k * 0.15), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][k], 16); }
      showCard(earned);
    }
    function showCard(earned) {
      var pool = Math.min(80, sessionNewStars * 5);
      var next = level + 1, canNext = next <= LEVELS.length && packUnlocked(next);
      snkend.innerHTML = '<div class="wqcard" style="text-align:center;max-width:420px">' +
        '<div style="font-size:44px">🥷💎</div>' +
        '<div class="wqtitle" style="font-size:20px">' + level + ". " + LV.name + " — escaped!</div>" +
        '<div style="font-size:34px;margin:2px 0">' + rep("⭐", earned) + rep("☆", 3 - earned) + '</div>' +
        '<div style="font-size:12px;color:#5a6b7a">finish · never spotted · under par ' + par + "s (you: " + Math.round(elapsed) + "s, ❗" + spottedThis + ")</div>" +
        '<div style="margin:8px 0;font-weight:900;color:#2f9e44;font-size:16px">Session pool: +' + pool +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"></div>' +
        '<div style="font-size:11px;color:#8a98a8;margin-bottom:6px">banked when you Leave</div>' +
        '<button class="submit big-next" id="snk_next" type="button">' + (canNext ? "Next level ➜" : "Level select") + "</button>" +
        '<button class="wqskip" id="snk_replay" type="button">↺ replay for 3⭐</button>' +
        '<button class="wqskip" id="snk_sel" type="button">level select</button></div>';
      snkend.style.display = "flex";
      earnBtn.style.display = "none"; useBtn.style.display = "none";
      document.getElementById("snk_next").onclick = function () { if (canNext) beginLevel(next); else showSelect(); };
      document.getElementById("snk_replay").onclick = function () { beginLevel(level); };
      document.getElementById("snk_sel").onclick = showSelect;
    }

    function showSelect() {
      active = false; paused = true; over = false; demoStars = null;
      earnBtn.style.display = "none"; useBtn.style.display = "none"; snkq.style.display = "none";
      var cells = "";
      for (var n = 1; n <= LEVELS.length; n++) {
        var open = packUnlocked(n), sn = stats.starsSn[n] || 0;
        var face = !open ? "🔒" : sn > 0 ? rep("⭐", sn) : "▶";
        cells += '<button class="embtn" style="min-width:96px' + (open ? "" : ";opacity:.5") + '" data-lv="' + n + '">' +
          '<span class="ebl">' + face + " " + n + '</span><span class="ebs">' + LEVELS[n - 1].name + "</span></button>";
      }
      snkend.innerHTML = '<div class="wqcard" style="max-width:640px;max-height:84vh;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;text-align:center">' +
        '<div style="font-size:38px">🥷🔦💎</div>' +
        '<div class="wqtitle" style="font-size:21px">Shadow Sneak</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin:2px 0 8px">Slip past the 🟡 vision cones to the 💎 and out the 🚪. Hide in 🌳, freeze cones with a 🕶 smoke bomb. ⭐' + totalStars() + "/" + (LEVELS.length * 3) + " stars</div>" +
        '<div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:center">' + cells + "</div>" +
        '<div style="font-size:11px;color:#8a98a8;margin-top:8px">🔑 Packs 6-10 &amp; 11-16 open with one word each. 🕶 Smoke bombs are earned with words too.</div></div>';
      snkend.style.display = "flex";
      Array.prototype.forEach.call(snkend.querySelectorAll("[data-lv]"), function (b) {
        b.onclick = function () { var n = +b.dataset.lv; if (packUnlocked(n)) beginLevel(n); else packQuiz(packOf(n)); };
      });
      hud();
    }

    // ---------- word hooks ----------
    function smokeQuiz() {
      if (paused || over || !active) return;
      if (smokes >= 2) { big("🕶 Smoke pouch is full (2)!", "#ffd740"); return; }
      paused = true;
      cv._lastQ = VQ.miniQuiz(snkq, words, store, {
        title: "🕶 Answer a word to pack a SMOKE BOMB!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) { smokes = Math.min(2, smokes + 1); big("🕶 Smoke bomb ready! (" + smokes + "/2)", "#c9d6ff"); if (sfx && sfx.chime) sfx.chime(); }
          else big("The smoke fizzled…", "#ff8a8a");
          hud();
        }
      });
    }
    function useSmoke() {
      if (!active || over) return false;
      if (smokes <= 0) { big("No smoke bombs — earn one with a word!", "#ffd740"); return false; }
      smokes--; smokeT = SMOKE_TIME;
      stats.smokes = (stats.smokes || 0) + 1; if (store.save) store.save();
      big("💨 SMOKE! Cones frozen " + SMOKE_TIME + "s — GO!", "#69f0ae");
      if (sfx && sfx.whoosh) sfx.whoosh();
      if (juice) juice.burst(OX + (ninja.c + 0.5) * tile, OY + (ninja.r + 0.5) * tile, "#dfe6ff", 18);
      hud();
      return true;
    }
    function packQuiz(pack) {
      if (pack !== 2 && pack !== 3) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(snkq, words, store, {
        title: "🔑 Answer a word to unlock levels " + (pack === 2 ? "6-10" : "11-16") + "!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            stats.packs[pack] = 1; if (store.save) store.save();
            big("🔑 Unlocked levels " + (pack === 2 ? "6-10" : "11-16") + "!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("Still locked — try again!", "#ff8a8a");
          showSelect();
        }
      });
    }

    // ---------- pathing + movement ----------
    function findPath(sc, sr, tc, tr) {
      if (!walkable(tc, tr)) return null;
      if (sc === tc && sr === tr) return [];
      var key = function (c, r) { return c + "," + r; }, q = [{ c: sc, r: sr }], prev = {}, vis = {};
      vis[key(sc, sr)] = 1;
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      while (q.length) {
        var cur = q.shift();
        if (cur.c === tc && cur.r === tr) {
          var pathOut = [], node = { c: tc, r: tr };
          while (!(node.c === sc && node.r === sr)) { pathOut.unshift(node); node = prev[key(node.c, node.r)]; if (!node) break; }
          return pathOut;
        }
        for (var i = 0; i < 4; i++) {
          var nc = cur.c + dirs[i][0], nr = cur.r + dirs[i][1];
          if (walkable(nc, nr) && !vis[key(nc, nr)]) { vis[key(nc, nr)] = 1; prev[key(nc, nr)] = { c: cur.c, r: cur.r }; q.push({ c: nc, r: nr }); }
        }
      }
      return null;
    }
    // entering a tile: plate squeak, treasure pickup, exit completion, dash noise
    function onEnterTile(c, r) {
      var ch = chAt(c, r);
      if (ch === "P" || dashing) alertGuards(c, r, ch === "P");
      if (c === treasure.c && r === treasure.r && !hasTreasure) {
        hasTreasure = true; big("💎 Got the treasure! Now escape!", "#ffd23f");
        if (sfx && sfx.coin) sfx.coin(); hud();
      }
      if (c === exitT.c && r === exitT.r && hasTreasure) completeLevel(true);
    }
    function alertGuards(c, r, squeak) {
      for (var i = 0; i < guards.length; i++) {
        var g = guards[i]; if (g.k !== "g" || g.lureT > 0) continue;
        if (Math.hypot(g.pos.c - c, g.pos.r - r) <= ALERT_R) { g.alertT = ALERT_TIME; g.alertTarget = { c: c, r: r }; }
      }
      if (squeak && sfx && sfx.blip) sfx.blip();
      else if (squeak && sfx && sfx.pop) sfx.pop();
    }

    // synchronous test-friendly pathwalk (patrols are NOT advanced here — that's
    // what wait() is for — so a walk is checked against the CURRENT cone state)
    function walkTo(tc, tr) {
      if (!active || over || paused) return false;
      var p = findPath(Math.round(ninja.c), Math.round(ninja.r), tc, tr);
      if (!p) return false; // blocked
      for (var i = 0; i < p.length; i++) {
        ninja.c = p[i].c; ninja.r = p[i].r;
        onEnterTile(p[i].c, p[i].r);
        if (over) return true;             // reached the exit → level done
        if (seen()) { spot(); return false; }
      }
      hud();
      return true;
    }
    function toss(tc, tr) {
      if (!active || over) return;
      if (!walkable(tc, tr)) return;
      var best = null, bd = 1e9;
      for (var i = 0; i < guards.length; i++) { var g = guards[i]; if (g.k !== "g") continue; var d = Math.hypot(g.pos.c - tc, g.pos.r - tr); if (d < bd) { bd = d; best = g; } }
      if (best) { best.lureT = LURE_TIME; best.lureTarget = { c: tc, r: tr }; best.alertT = 0; }
      coin = { c: tc, r: tr, t: LURE_TIME };
      big("🪙 *clink* — a guard turns to look…", "#ffe14d");
      if (sfx && sfx.coin) sfx.coin();
    }
    // deterministically advance patrols (and level time) — <=0.05s substeps
    function wait(sec) {
      var left = sec;
      while (left > 0 && !over) {
        var d = Math.min(0.05, left);
        stepPatrols(d); if (smokeT > 0) smokeT = Math.max(0, smokeT - d);
        elapsed += d;
        if (seen()) { spot(); return; }
        left -= d;
      }
      hud();
    }

    // ---------- real-time frame follow (drag / tap-to-walk) ----------
    function stepNinja(dt) {
      var spd = (dashing ? DASH : WALK) * dt;
      if (stick) {
        var mag = Math.hypot(stick.x, stick.y);
        if (mag > 0.1) {
          var mx = stick.x / mag, my = stick.y / mag;
          var nx = ninja.c + mx * spd, ny = ninja.r + my * spd;
          if (walkable(Math.round(nx), Math.round(ninja.r))) ninja.c = nx;
          if (walkable(Math.round(ninja.c), Math.round(ny))) ninja.r = ny;
          onEnterTile(Math.round(ninja.c), Math.round(ninja.r));
        }
        return;
      }
      if (!path.length) { dashing = false; return; }
      var tg = path[0], dx = tg.c - ninja.c, dy = tg.r - ninja.r, d = Math.hypot(dx, dy);
      if (d <= spd || d < 1e-6) { ninja.c = tg.c; ninja.r = tg.r; path.shift(); onEnterTile(tg.c, tg.r); }
      else { ninja.c += dx / d * spd; ninja.r += dy / d * spd; }
    }
    function stepPlay(dt) {
      stepPatrols(dt);
      if (smokeT > 0) smokeT = Math.max(0, smokeT - dt);
      stepNinja(dt);
      elapsed += dt;
      if (seen()) { spot(); return; }
      // tension music tick as a cone edge closes in (null-safe)
      tickCd -= dt;
      if (tickCd <= 0 && nearestConeGap() < 0.55) { tickCd = 0.4; if (sfx && sfx.tick) sfx.tick(); else if (sfx && sfx.blip) sfx.blip(); }
      if (coin) { coin.t -= dt; if (coin.t <= 0) coin = null; }
    }

    // ---------- input ----------
    var downX = 0, downY = 0, downOn = false, lastTap = 0;
    function localXY(x, y) { var rc = cv.getBoundingClientRect(); return { x: x - rc.left, y: y - rc.top }; }
    function tileAt(x, y) { return { c: Math.floor((x - OX) / tile), r: Math.floor((y - OY) / tile) }; }
    function goTile(c, r) {
      if (!active || over || paused) return;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS || !walkable(c, r)) return;
      var now = performance.now(); dashing = (now - lastTap) < 320; lastTap = now;
      var p = findPath(Math.round(ninja.c), Math.round(ninja.r), c, r);
      if (p) { path = p; stick = null; if (dashing) big("💨 dash! (noisy)", "#ffb3b3"); }
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = localXY(e.changedTouches[0].clientX, e.changedTouches[0].clientY); downX = p.x; downY = p.y; downOn = true; }, { passive: false });
    cv.addEventListener("touchmove", function (e) {
      if (!downOn) return; e.preventDefault();
      var p = localXY(e.changedTouches[0].clientX, e.changedTouches[0].clientY), dx = p.x - downX, dy = p.y - downY;
      if (Math.hypot(dx, dy) > tile * 0.5) { path = []; stick = { x: dx, y: dy }; }
    }, { passive: false });
    function endTouch(e) {
      if (!downOn) return; e.preventDefault(); downOn = false;
      var p = localXY(e.changedTouches[0].clientX, e.changedTouches[0].clientY), dx = p.x - downX, dy = p.y - downY;
      if (stick) { stick = null; return; }
      if (Math.hypot(dx, dy) < tile * 0.5) { var tp = tileAt(p.x, p.y); goTile(tp.c, tp.r); }
    }
    cv.addEventListener("touchend", endTouch, { passive: false });
    cv.addEventListener("touchcancel", function () { downOn = false; stick = null; });
    cv.addEventListener("mousedown", function (e) { var p = localXY(e.clientX, e.clientY); downX = p.x; downY = p.y; downOn = true; });
    cv.addEventListener("mouseup", function (e) { if (!downOn) return; downOn = false; if (stick) { stick = null; return; } var p = localXY(e.clientX, e.clientY); var tp = tileAt(p.x, p.y); goTile(tp.c, tp.r); });
    function onKey(e) {
      var k = e.key, d = k === "ArrowUp" ? { x: 0, y: -1 } : k === "ArrowDown" ? { x: 0, y: 1 } : k === "ArrowLeft" ? { x: -1, y: 0 } : k === "ArrowRight" ? { x: 1, y: 0 } : null;
      if (d && active && !over) { e.preventDefault(); path = []; stick = d; setTimeout(function () { if (stick === d) stick = null; }, 140); }
    }
    document.addEventListener("keydown", onKey);
    earnBtn.onclick = smokeQuiz; useBtn.onclick = useSmoke;

    // ---------- drawing ----------
    function glyph(ch, cx, cy, sz) { ctx.font = Math.round(sz) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(ch, cx, cy); }
    function cx(c) { return OX + (c + 0.5) * tile; }
    function cy(r) { return OY + (r + 0.5) * tile; }
    function drawCone(g) {
      if (!coneOnOf(g)) return;
      var x = cx(g.pos.c), y = cy(g.pos.r), R = g.range * tile;
      var grad = ctx.createRadialGradient(x, y, tile * 0.3, x, y, R);
      var caught = coneSees(g, ninja.c, ninja.r);
      grad.addColorStop(0, caught ? "rgba(255,120,90,.40)" : "rgba(255,231,110,.30)");
      grad.addColorStop(1, "rgba(255,231,110,0)");
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.arc(x, y, R, g.face - g.half, g.face + g.half); ctx.closePath(); ctx.fill();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#20263a"); bg.addColorStop(1, "#12151f");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      if (!active || !grid) { if (juice) juice.draw(ctx); return; }
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var ch = grid[r].charAt(c), x = OX + c * tile, y = OY + r * tile;
        if (ch === "#") { ctx.fillStyle = "#39405c"; ctx.fillRect(x, y, tile, tile); ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.fillRect(x, y, tile, tile * 0.16); continue; }
        ctx.fillStyle = (r + c) % 2 ? "#2b3350" : "#262d47"; ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        var gs = tile * 0.66;
        if (ch === "T") { if (!hasTreasure) glyph("💎", cx(c), cy(r), gs); }
        else if (ch === "X") glyph("🚪", cx(c), cy(r), gs);
        else if (ch === "B") glyph("🌳", cx(c), cy(r), gs);
        else if (ch === "P") { ctx.strokeStyle = "rgba(255,180,90,.5)"; ctx.lineWidth = 2; ctx.strokeRect(x + tile * 0.2, y + tile * 0.2, tile * 0.6, tile * 0.6); glyph("▫", cx(c), cy(r), gs * 0.6); }
      }
      // cones UNDER the guards
      for (var gi = 0; gi < guards.length; gi++) drawCone(guards[gi]);
      // lure coin
      if (coin) glyph("🪙", cx(coin.c), cy(coin.r), tile * 0.5);
      // guards + moods
      for (var g2 = 0; g2 < guards.length; g2++) {
        var g = guards[g2];
        var em = g.k === "c" ? "📷" : g.k === "l" ? "🔦" : "👮";
        glyph(em, cx(g.pos.c), cy(g.pos.r), tile * 0.7);
        if (g.k === "g") { var mood = g.lureT > 0 || g.alertT > 0 ? "❗" : "💤"; glyph(mood, cx(g.pos.c) + tile * 0.35, cy(g.pos.r) - tile * 0.42, tile * 0.34); }
      }
      // the ninja (dims + 🌳 tint while hidden; ❗ if seen)
      var nx = cx(ninja.c), ny = cy(ninja.r), hidden = isBush(Math.round(ninja.c), Math.round(ninja.r));
      if (smokeT > 0) { ctx.globalAlpha = 0.5; glyph("☁️", nx, ny, tile * 0.9); ctx.globalAlpha = 1; }
      if (hidden) ctx.globalAlpha = 0.55;
      glyph(hasTreasure ? "🥷" : "🥷", nx, ny, tile * 0.72); ctx.globalAlpha = 1;
      if (seen()) glyph("❗", nx, ny - tile * 0.55, tile * 0.5);
      if (juice) juice.draw(ctx);
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && active && !over) stepPlay(dt);
      if (juice) juice.update(dt);
      draw();
    }

    // ---------- economy: ONE bank per session (Leave + app-close), guarded ----------
    function rewards() {
      var ns = sessionNewStars;
      return { win: session3, score: totalStars(), rankPtsDelta: Math.min(12, ns * 2), xp: Math.min(80, 10 + ns * 8), gems: Math.min(80, ns * 5) };
    }
    function bankRun() {
      if (banked || sessionNewStars <= 0) return null;
      banked = true;
      var rw = rewards();
      var res = store.recordGame ? store.recordGame("sneak", rw) : null;
      return { rw: rw, res: res };
    }
    function bankExit() {
      var b = bankRun();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🥷 Shadow Sneak banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("keydown", onKey);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API ----------
    cv._sneak = {
      state: function () {
        return {
          level: level, attempt: attempt, spotted: spottedThis,
          stars: stats.starsSn[level] || 0, totalStars: totalStars(),
          smokes: smokes, inBush: isBush(Math.round(ninja.c), Math.round(ninja.r)),
          over: over, banked: banked, active: active, hasTreasure: hasTreasure,
          pos: { c: Math.round(ninja.c), r: Math.round(ninja.r) },
          packs: { 2: !!stats.packs[2], 3: !!stats.packs[3] }
        };
      },
      begin: beginLevel,
      walkTo: walkTo,
      guards: function () { return guards.map(function (g) { return { c: g.pos.c, r: g.pos.r, dir: g.face, coneOn: coneOnOf(g) }; }); },
      inCone: seen,
      wait: wait,
      toss: toss,
      smokeQuiz: smokeQuiz,
      useSmoke: useSmoke,
      packQuiz: packQuiz,
      finish: function () { completeLevel(true); }
    };

    // ---------- boot ----------
    resize(); window.addEventListener("resize", resize);
    hud();
    showSelect();
    // demo hook: paused on level 8 — two cones sweeping, ninja hiding in a bush,
    // a searchlight visible, 1 smoke already banked
    if (global._sneakdemo) {
      global._sneakdemo = 0;
      setTimeout(function () {
        beginLevel(8);
        ninja = { c: 3, r: 2 };   // sitting inside a 🌳 bush
        smokes = 1; demoStars = 1;
        wait(1.2);                 // sweep the cones into a lively pose
        paused = true; hud();
      }, 200);
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxSneak = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
