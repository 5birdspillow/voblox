/*
 * Voblox arcade game — ⛏️ GOLD DIGGER: DEEP CORE (a full dig-deep mining sim).
 * A little mining POD FLIES: hold/drag toward your finger to thrust (up/left/right),
 * gravity always pulls down, release and you fall. Push DOWN/LEFT/RIGHT into soil to
 * DRILL through it (drill speed vs tile hardness) — but you can NEVER drill up, so
 * think before you dig! Long falls dent the HULL; fuel powers thrust + drilling.
 *
 * Deeper = richer minerals AND meaner rock: 🟤 Copperite → 🌈 Rainbow Core, plus
 * buried 🦴�👑☄️ treasures, 🔥 magma & 💨 gas pockets, ⛰ earthquakes, and DARKNESS
 * below 800m. Surface into a little base — ⛽ Fuel Depot, 🏭 Ore Processor, 🔧 Upgrade
 * Garage (six upgrade tracks), 🛒 Supply Shack (consumables). At 2000m: 👑🌋 THE MAGMA
 * KING, a kid-safe word-shield boss. Beat him → CORE CHAMPION + New Game+.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - ⛽ WORD FUEL: one free word-refill per Fuel Depot visit (+40% fuel).
 *   - 🔧 Upgrade tiers 4 & 5 are WORD-GATED — study powers the deep dig.
 *   - 👑 The Magma King's shield drops only for a WORD (the proven duel pattern).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("digger") per
 * session, banked once (guarded) on Leave AND app-close. Deepest depth, lifetime gold,
 * upgrades, gold wallet and specials PERSIST additively — old saves load cleanly.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var COLS = 14, METERS = 10;   // grid width; each row of depth = 10 meters

  // ---------- minerals: emoji, value, weight, depth band (rarest last) ----------
  var MINERALS = {
    copper:  { e: "🟤", v: 8,    w: 1, min: 0,    max: 150,  col: "#b87333" },
    silver:  { e: "⚪", v: 25,   w: 2, min: 100,  max: 400,  col: "#d7e0e8" },
    gold:    { e: "🟡", v: 90,   w: 3, min: 250,  max: 800,  col: "#ffcf3f" },
    dusk:    { e: "💠", v: 300,  w: 4, min: 600,  max: 1200, col: "#7ad0e0" },
    void:    { e: "🔮", v: 800,  w: 5, min: 1000, max: 1700, col: "#c96bff" },
    rainbow: { e: "🌈", v: 2000, w: 6, min: 1500, max: 9999, col: "#ff77dd" }
  };
  // rarest-first scan order + per-tile spawn chance
  var MIN_ORDER = ["rainbow", "void", "dusk", "gold", "silver", "copper"];
  var MIN_CHANCE = { copper: 0.16, silver: 0.13, gold: 0.10, dusk: 0.07, void: 0.05, rainbow: 0.022 };
  // buried treasures below 400m — rare, they sparkle through the dirt
  var TREASURES = {
    dino:  { e: "🦴", v: 500,  min: 400 },
    crown: { e: "👑", v: 900,  min: 700 },
    star:  { e: "☄️", v: 1500, min: 1100 }
  };
  var TREASURE_ORDER = ["star", "crown", "dino"];

  // ---------- six upgrade tracks (tiers 1..5; 4 & 5 are word-gated) ----------
  var TANK_MAX   = [0, 100, 160, 240, 340, 460];   // fuel capacity
  var CARGO_MAX  = [0, 10, 18, 30, 46, 66];         // cargo WEIGHT capacity
  var HULL_MAX   = [0, 100, 140, 190, 250, 320];    // hull points
  var ENGINE_MUL = [0, 1, 1.2, 1.45, 1.75, 2.1];    // thrust power (offsets cargo weight)
  var DRILL_PWR  = [0, 2, 3, 4, 5, 6];              // max tile hardness the drill bites
  var DRILL_SPD  = [0, 1.0, 1.5, 2.1, 2.9, 3.8];    // drill grind speed
  var RAD_MUL    = [0, 1, 0.8, 0.62, 0.46, 0.3];    // magma/gas damage multiplier
  var COST = {
    drill:    [0, 0, 130, 340, 720, 1500],
    hull:     [0, 0, 110, 300, 640, 1350],
    engine:   [0, 0, 150, 370, 800, 1650],
    tank:     [0, 0, 100, 270, 580, 1250],
    cargo:    [0, 0, 120, 320, 680, 1450],
    radiator: [0, 0, 160, 400, 850, 1750]
  };
  var TRACK_META = {
    drill:    { e: "🔩", name: "Drill" },
    hull:     { e: "🛡", name: "Hull" },
    engine:   { e: "🚀", name: "Engine" },
    tank:     { e: "🛢️", name: "Fuel Tank" },
    cargo:    { e: "📦", name: "Cargo Bay" },
    radiator: { e: "♨️", name: "Radiator" }
  };
  var TRACK_KEYS = ["drill", "hull", "engine", "tank", "cargo", "radiator"];
  // one-time specials
  var SPECIALS = {
    headlamp1: { e: "🔦", name: "Headlamp I",  cost: 200, tip: "wider light in the dark" },
    headlamp2: { e: "🔦", name: "Headlamp II", cost: 500, tip: "widest light", needs: "headlamp1" },
    gasSiphon: { e: "🌬", name: "Gas Siphon",  cost: 420, tip: "gas pockets become +20% fuel" },
    magmaTap:  { e: "🔥", name: "Magma Tap",   cost: 650, tip: "top Radiator + this = magma PAYS 60 gold" }
  };
  // consumables (max 3 each)
  var ITEMS = {
    repair:   { e: "🧯", name: "Repair Kit",   cost: 60,  tip: "+40 hull anywhere" },
    reserve:  { e: "⛽", name: "Reserve Fuel",  cost: 55,  tip: "+50% tank anywhere" },
    dynamite: { e: "🧨", name: "Dynamite",     cost: 120, tip: "clears a 3×3 (ore drops)" },
    mega:     { e: "💥", name: "Mega Blast",    cost: 260, tip: "clears a 5×5 (ore drops)" },
    teleport: { e: "🌀", name: "Teleporter",   cost: 150, tip: "instant safe return home" },
    beam:     { e: "📡", name: "Cargo Beam",    cost: 210, tip: "sell all cargo from any depth (80%)" }
  };
  var ITEM_KEYS = ["repair", "reserve", "dynamite", "mega", "teleport", "beam"];

  // silly transmissions from DIG-BOT HQ, keyed by depth (m)
  var TRANSMISSIONS = [
    { m: 250,  s: "📡 DIG-BOT HQ: Sensors detect a warm glow far below. Keep digging!" },
    { m: 500,  s: "📡 DIG-BOT HQ: The glow is… toasty? Definitely toasty." },
    { m: 750,  s: "📡 DIG-BOT HQ: We're reading marshmallow signatures. This is not a drill. (It is a drill.)" },
    { m: 1000, s: "📡 DIG-BOT HQ: Halfway there! The core smells like a campfire." },
    { m: 1250, s: "📡 DIG-BOT HQ: Something down there is HUMMING a little tune…" },
    { m: 1500, s: "📡 DIG-BOT HQ: Rainbow rocks?! You're rich AND close!" },
    { m: 1750, s: "📡 DIG-BOT HQ: Almost to the core. Bring marshmallows. Trust us." }
  ];
  var MILES = [{ m: 100, s: "🥉 100m!" }, { m: 500, s: "🥈 500m!" }, { m: 1000, s: "🥇 1000m!!" }, { m: 1500, s: "💠 1500m!!" }];

  // physics constants (tile / second units)
  var GRAVITY = 16, THRUST_UP = 34, THRUST_H = 26, DRAG = 1.3, MAXV = 18;
  var WEIGHT_DRAG = 0.7, PR = 0.38;               // pod radius
  var FALL_FREE_V = 8, FALL_DMG = 5.5;            // soft thuds under ~4 tiles are free
  var FUEL_THRUST = 7, MAGMA_DMG = 34, GAS_DMG = 16, BOULDER_DMG = 20;
  var REPAIR_PER = 3;                              // gold per hull point at the surface

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("digger");
    // ---- additive, NEVER-renamed persistence ----
    stats.bestDepth = stats.bestDepth || 0;
    stats.totalGold = stats.totalGold || 0;
    if (!stats.dcore) stats.dcore = {};
    var dc = stats.dcore;
    dc.gold = dc.gold || 0;
    dc.upgrades = dc.upgrades || {};
    TRACK_KEYS.forEach(function (k) { if (!dc.upgrades[k]) dc.upgrades[k] = 1; });
    dc.specials = dc.specials || {};
    dc.items = dc.items || {};
    ITEM_KEYS.forEach(function (k) { if (typeof dc.items[k] !== "number") dc.items[k] = 0; });
    dc.ngPlus = dc.ngPlus || 0;
    dc.bossBeaten = !!dc.bossBeaten;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap digger";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="ddcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="ddmsg">⛏️ Gold Digger: Deep Core</div>' +
      '<div class="grow"><span id="ddfuel">⛽ 100%</span><span id="ddhull">🛡 100%</span>' +
      '<span id="dddepth">0m</span><span id="ddgold">🪙 0</span><span id="ddcargo">📦 0/10</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div id="dditems" style="position:absolute;left:calc(env(safe-area-inset-left, 0px) + 8px);bottom:calc(env(safe-area-inset-bottom, 0px) + 10px);display:flex;gap:5px;flex-wrap:wrap;max-width:60%;z-index:8"></div>' +
      '<div class="gmsg" id="ddbig"></div>' +
      '<div class="gover" id="ddshop" style="display:none"></div>' +
      '<div class="gover" id="ddq" style="display:none"></div>' +
      '<div class="gover" id="ddcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#ddcv"), ctx = cv.getContext("2d");
    var ddq = document.getElementById("ddq"), ddcard = document.getElementById("ddcard");
    var ddshop = document.getElementById("ddshop"), itemBar = document.getElementById("dditems");
    var msgEl = document.getElementById("ddmsg"), bigEl = document.getElementById("ddbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H, cellPx, offX, safeB = 0;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      cellPx = Math.max(24, Math.min(Math.floor(W / COLS), Math.floor(H / 13), 54));
      offX = Math.floor((W - cellPx * COLS) / 2);
      // home-indicator inset, probed off the item bar's env()-based bottom (10px base)
      try { safeB = Math.max(0, (parseFloat(getComputedStyle(itemBar).bottom) || 10) - 10); } catch (_) { safeB = 0; }
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run + session state ----------
    var running = true, raf = 0, lastT = performance.now();
    var seed = 0, dug = {}, tileCache = {};
    var px, py, vx, vy;                 // pod position/velocity in tile space
    var inX = 0, inY = 0;               // input thrust vector (-1..1)
    var atSurface, inBoss, over, paused, banked;
    var drillTarget = null, grounded = false, t0 = 0, camY = 0, lastFmt = null;
    var freeRefillUsed = false, shopPanel = "base";
    var sessionMaxDepth, sessionGold, bossBeatenSession;
    var quakeT = 0, quakeWarn = 0, boulders = [];
    var boss = null, blobs = [];
    var lastTransmit = 0, shownMile = {}, hullFlashLbl = 0;
    var wallet, hull;

    function key(c, r) { return c + "," + r; }
    function clampCol(c) { return c < 0 ? 0 : c >= COLS ? COLS - 1 : c; }
    function up() { return dc.upgrades; }
    function tankMax() { return TANK_MAX[up().tank]; }
    function cargoCap() { return CARGO_MAX[up().cargo]; }
    function hullMax() { return HULL_MAX[up().hull]; }
    function engineMul() { return ENGINE_MUL[up().engine]; }
    function drillPower() { return DRILL_PWR[up().drill]; }
    function drillSpeed() { return DRILL_SPD[up().drill]; }
    function radMul() { return RAD_MUL[up().radiator]; }
    function fuelFrac() { return tankMax() > 0 ? Math.max(0, Math.min(1, fuel / tankMax())) : 0; }
    function hullFrac() { return hullMax() > 0 ? Math.max(0, Math.min(1, hull / hullMax())) : 0; }
    function depthM() { return inBoss ? 2000 : Math.max(0, py * METERS); }
    var fuel; // fuel units (var hoists; used by helpers above)

    // cargo: array of mineral/treasure keys stored as {k, v, w, e, col}
    var cargo = [];
    function cargoWeight() { var s = 0; for (var i = 0; i < cargo.length; i++) s += cargo[i].w; return s; }
    function cargoValue() { var s = 0; for (var i = 0; i < cargo.length; i++) s += cargo[i].v; return s; }
    function dark() { return depthM() > 800 && !atSurface && !inBoss; }

    // ---------- deterministic world gen (own hash, never Math.random) ----------
    function h32(x) {
      x = x >>> 0;
      x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
      x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
      return (x ^ (x >>> 16)) >>> 0;
    }
    function cr(c, r, salt) {
      var v = h32(seed ^ Math.imul(salt + 1, 0x9e3779b1) ^ Math.imul(c + 7, 374761393) ^ Math.imul(r + 13, 668265263));
      return (v % 100000) / 100000;
    }
    function richMul() { return 1 + Math.min(1.2, dc.ngPlus * 0.25); } // New Game+ world is richer
    function genTile(c, r) {
      var kk = key(c, r), cached = tileCache[kk];
      if (cached) return cached;
      var m = (r + 1) * METERS, tile;
      // hardness by depth: 1 dirt · 2 rock · 3 hard rock · 4 super
      var hr = cr(c, r, 5);
      var superC = Math.min(0.22, Math.max(0, (m - 800) / 3500));
      var hardC = Math.min(0.34, Math.max(0, (m - 250) / 2600));
      var rockC = Math.min(0.6, 0.08 + m / 1600);
      var hard = hr < superC ? 4 : hr < superC + hardC ? 3 : hr < superC + hardC + rockC ? 2 : 1;
      var rm = richMul();
      if (m >= 250 && cr(c, r, 3) < Math.min(0.03, 0.008 + m / 90000)) tile = { type: "magma", hard: hard, e: "🔥" };
      else if (m >= 150 && cr(c, r, 4) < Math.min(0.028, 0.008 + m / 100000)) tile = { type: "gas", hard: hard, e: "💨" };
      else {
        tile = null;
        // buried treasures (rare, sparkle)
        for (var ti = 0; ti < TREASURE_ORDER.length; ti++) {
          var tk = TREASURE_ORDER[ti], td = TREASURES[tk];
          if (m >= td.min && cr(c, r, 20 + ti) < 0.0016 * rm) { tile = { type: "treasure", tk: tk, hard: hard, e: td.e, col: "#ffd23f" }; break; }
        }
        if (!tile) for (var mi = 0; mi < MIN_ORDER.length; mi++) {
          var k = MIN_ORDER[mi], md = MINERALS[k];
          if (m >= md.min && m <= md.max && cr(c, r, 30 + mi) < MIN_CHANCE[k] * rm) { tile = { type: "ore", ore: k, hard: hard, e: md.e, col: md.col }; break; }
        }
        if (!tile) tile = { type: hard === 4 ? "super" : hard === 3 ? "hard" : hard === 2 ? "rock" : "dirt", hard: hard, e: "" };
      }
      tileCache[kk] = tile;
      return tile;
    }
    function tileSolid(t) { return t.type !== "empty"; }
    function solidCell(c, r) {
      if (c < 0 || c >= COLS) return true;   // side walls
      if (r < 0) return false;               // sky above the base
      if (dug[key(c, r)]) return false;      // already carved
      return tileSolid(genTile(c, r));
    }

    // ---------- HUD ----------
    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1400);
    }
    function hud() {
      document.getElementById("ddfuel").textContent = "⛽ " + Math.round(fuelFrac() * 100) + "%";
      document.getElementById("ddhull").textContent = "🛡 " + Math.round(hullFrac() * 100) + "%";
      document.getElementById("dddepth").textContent = Math.round(depthM()) + "m";
      document.getElementById("ddgold").textContent = "🪙 " + wallet;
      document.getElementById("ddcargo").textContent = "📦 " + Math.round(cargoWeight()) + "/" + cargoCap();
    }

    // ---------- money ----------
    function addGold(n) { wallet += n; dc.gold = wallet; if (n > 0) sessionGold += n; hud(); }
    function spend(n) { wallet -= n; dc.gold = wallet; hud(); }

    // ---------- run lifecycle ----------
    function newSession() {
      seed = (h32((Date.now() >>> 0) ^ 0x9e3779b9 ^ (dc.ngPlus * 2654435761)) >>> 0);
      dug = {}; tileCache = {};
      wallet = dc.gold; hull = hullMax(); fuel = tankMax(); cargo = [];
      sessionMaxDepth = 0; sessionGold = 0; bossBeatenSession = false;
      lastTransmit = 0; shownMile = {};
      over = false; banked = false; boss = null; blobs = []; boulders = [];
      quakeT = 0; quakeWarn = 0;
      arriveSurface();
      hud(); renderItems();
    }
    function begin() { newSession(); }

    function arriveSurface() {
      atSurface = true; inBoss = false; paused = false;
      px = COLS / 2 + 0.5; py = -0.42; vx = 0; vy = 0; inX = inY = 0;
      drillTarget = null; freeRefillUsed = false; shopPanel = "base";
      ddcard.style.display = "none"; ddq.style.display = "none";
      renderShop();
    }
    function leaveSurface() {
      if (!atSurface) return;
      atSurface = false; ddshop.style.display = "none";
    }

    // ---------- depth events / transmissions ----------
    function updateDepthEvents() {
      var d = depthM();
      if (d > sessionMaxDepth) {
        sessionMaxDepth = d;
        for (var i = 0; i < MILES.length; i++) if (d >= MILES[i].m && !shownMile["m" + MILES[i].m]) {
          shownMile["m" + MILES[i].m] = 1; big(MILES[i].s, "#ffd23f"); if (sfx && sfx.chime) sfx.chime(); if (juice) juice.shake(4);
        }
        for (var j = 0; j < TRANSMISSIONS.length; j++) if (d >= TRANSMISSIONS[j].m && TRANSMISSIONS[j].m > lastTransmit) {
          lastTransmit = TRANSMISSIONS[j].m; big(TRANSMISSIONS[j].s, "#8ecdf7"); if (sfx && sfx.chime) sfx.chime();
        }
        if (d > (stats.bestDepth || 0)) { stats.bestDepth = d; if (store.save) store.save(); }
      }
      if (!inBoss && !atSurface && d >= 2000 && !bossBeatenSession) enterBoss();
    }

    // ---------- collecting / hazards ----------
    function collectMineral(k, c, r) {
      var md = MINERALS[k];
      if (cargoWeight() + md.w > cargoCap()) { big("📦 Cargo full — sell topside!", "#ffd740"); return; }
      cargo.push({ k: k, v: md.v, w: md.w, e: md.e, col: md.col });
      if (juice) juice.text(tileSX(c), tileSY(r), md.e, md.col); if (sfx && sfx.pop) sfx.pop();
      hud();
    }
    function collectTreasure(tile, c, r) {
      var td = TREASURES[tile.tk];
      if (cargoWeight() + 2 > cargoCap()) { big("📦 Cargo full — a treasure slipped away!", "#ffd740"); return; }
      cargo.push({ k: tile.tk, v: td.v, w: 2, e: td.e, col: "#ffd23f", treasure: true });
      big(td.e + " Buried treasure! Worth " + td.v + " topside!", "#ffd23f");
      if (juice) juice.burst(tileSX(c), tileSY(r), "#ffd23f", 16); if (sfx && sfx.coin) sfx.coin();
      hud();
    }
    function magmaHit(c, r) {
      if (up().radiator >= 5 && dc.specials.magmaTap) {
        addGold(60); big("🔥 Magma Tap! Tapped the magma for +60 gold!", "#ffb01f");
        if (juice) juice.burst(tileSX(c), tileSY(r), "#ff7a1f", 18); if (sfx && sfx.coin) sfx.coin(); return;
      }
      var dmg = Math.round(MAGMA_DMG * radMul());
      big("🔥 Magma pocket! −" + dmg + " hull", "#ff6b3d"); if (juice) { juice.shake(7); juice.burst(tileSX(c), tileSY(r), "#ff7a1f", 16); }
      if (sfx && sfx.buzz) sfx.buzz(); damage(dmg);
    }
    function gasHit(c, r) {
      if (dc.specials.gasSiphon) {
        fuel = Math.min(tankMax(), fuel + tankMax() * 0.2); big("🌬 Gas Siphon! +20% fuel", "#69f0ae");
        if (juice) juice.burst(tileSX(c), tileSY(r), "#9be15d", 14); if (sfx && sfx.coin) sfx.coin(); hud(); return;
      }
      var dmg = Math.round(GAS_DMG * radMul());
      big("💨 Gas pocket! −" + dmg + " hull", "#b6f"); if (juice) juice.shake(9);
      if (sfx && sfx.buzz) sfx.buzz(); damage(dmg);
    }
    function digTile(c, r, safe) {
      var kk = key(c, r);
      if (dug[kk]) return;
      var tile = genTile(c, r); dug[kk] = 1;
      if (tile.type === "magma") { if (!safe) magmaHit(c, r); }
      else if (tile.type === "gas") { if (!safe) gasHit(c, r); }
      else if (tile.type === "treasure") collectTreasure(tile, c, r);
      else if (tile.type === "ore") collectMineral(tile.ore, c, r);
    }

    // ---------- hull damage + kind airlifts ----------
    function damage(n) {
      if (over) return;
      hull -= n; hud();
      if (hull <= 0) airliftHull();
    }
    function airliftFuel() {
      var fee = Math.round(wallet * 0.15);
      spend(fee); fuel = tankMax() * 0.25;
      big("⛽ Out of fuel! Emergency airlift home (−" + fee + " gold fee). Cargo kept!", "#ffb01f");
      if (sfx && sfx.buzz) sfx.buzz();
      arriveSurface(); hud();
    }
    function airliftHull() {
      // drop half the CARGO where we were, then a kind airlift home
      var dropN = Math.floor(cargo.length / 2);
      if (dropN > 0) cargo.splice(0, dropN);
      hull = hullMax() * 0.35;
      big("🛡 Hull breached! Airlift home — you dropped " + dropN + " cargo. Repair up!", "#ff8a8a");
      if (juice) juice.shake(10); if (sfx && sfx.buzz) sfx.buzz();
      arriveSurface(); hud();
    }
    function burnThrust(dt, frac) {
      fuel -= FUEL_THRUST * dt * frac;
      if (fuel <= 0 && !atSurface && !over) { fuel = 0; airliftFuel(); }
    }
    function burnDrill(hard) {
      fuel -= 3 + hard * 2;
      if (fuel <= 0 && !atSurface && !over) { fuel = 0; airliftFuel(); }
    }

    // ---------- physics: fly + drill ----------
    function podCell() { return { c: clampCol(Math.floor(px)), r: Math.floor(py) }; }
    function drillDirFrom(idx, idy) {
      if (idy > 0.35 && Math.abs(idy) >= Math.abs(idx)) return "down";
      if (idx < -0.35 && Math.abs(idx) > Math.abs(idy)) return "left";
      if (idx > 0.35 && Math.abs(idx) > Math.abs(idy)) return "right";
      return null; // never up
    }
    function drillCell(dir) {
      var pc = podCell();
      if (dir === "down") return { c: pc.c, r: pc.r + 1 };
      if (dir === "left") return { c: pc.c - 1, r: pc.r };
      if (dir === "right") return { c: pc.c + 1, r: pc.r };
      return null;
    }
    // continuous drilling used in real play + tick()
    function tryDrill(idx, idy, dt) {
      var dir = drillDirFrom(idx, idy);
      if (!dir) { drillTarget = null; return false; }
      var t = drillCell(dir); if (!t || t.c < 0 || t.c >= COLS) { drillTarget = null; return false; }
      if (!solidCell(t.c, t.r)) { drillTarget = null; return false; } // open — fall/fly instead
      var tile = genTile(t.c, t.r);
      if (tile.hard > drillPower()) { drillTarget = null; if (hullFlashLbl <= 0) { big("🪨 Too hard here — upgrade your drill!", "#ffd740"); hullFlashLbl = 1.4; } return false; }
      // align to the drill lane, pin velocity
      if (dir === "down") { px += ((t.c + 0.5) - px) * Math.min(1, dt * 14); vx = 0; }
      else { py += ((t.r + 0.5) - py) * Math.min(1, dt * 14); vy = 0; }
      if (!drillTarget || drillTarget.c !== t.c || drillTarget.r !== t.r) drillTarget = { c: t.c, r: t.r, prog: 0, hard: tile.hard, dir: dir };
      drillTarget.prog += dt * drillSpeed();
      if (juice && Math.random() < 0.4) juice.burst(tileSX(t.c), tileSY(t.r), "#8a6a4a", 3);
      if (drillTarget.prog >= drillTarget.hard) completeDrill(t.c, t.r, dir);
      return true;
    }
    function completeDrill(c, r, dir) {
      burnDrill(genTile(c, r).hard);
      if (over || atSurface) { drillTarget = null; return; } // an airlift may have whisked us home
      digTile(c, r, false);
      drillTarget = null;
      if (over || atSurface) return;
      if (dir === "down") { py = r + 0.5; vy = 2; }
      else if (dir === "left") { px = c + 0.5; vx = -1; }
      else { px = c + 0.5; vx = 1; }
      updateDepthEvents(); hud();
    }
    function flyStep(idx, idy, dt) {
      vy += GRAVITY * dt;
      if (idy < -0.2) { var upAcc = Math.max(4, THRUST_UP * engineMul() - cargoWeight() * WEIGHT_DRAG / engineMul()); vy -= upAcc * dt; burnThrust(dt, -idy); }
      if (idx < -0.2) { vx -= THRUST_H * engineMul() * dt; burnThrust(dt, Math.abs(idx) * 0.6); }
      else if (idx > 0.2) { vx += THRUST_H * engineMul() * dt; burnThrust(dt, Math.abs(idx) * 0.6); }
      else { vx -= vx * Math.min(1, dt * 5); }
      // air drag + clamp
      vx -= vx * DRAG * dt; vy -= vy * DRAG * dt;
      if (vx > MAXV) vx = MAXV; else if (vx < -MAXV) vx = -MAXV;
      if (vy > MAXV) vy = MAXV; else if (vy < -MAXV) vy = -MAXV;
      // integrate + collide, axis separated
      px += vx * dt; collideX();
      py += vy * dt; collideY();
    }
    function collideX() {
      var r0 = Math.floor(py - PR), r1 = Math.floor(py + PR), r;
      if (vx > 0) { var c = Math.floor(px + PR); for (r = r0; r <= r1; r++) if (solidCell(c, r)) { px = c - PR - 0.001; vx = 0; break; } }
      else if (vx < 0) { var c2 = Math.floor(px - PR); for (r = r0; r <= r1; r++) if (solidCell(c2, r)) { px = c2 + 1 + PR + 0.001; vx = 0; break; } }
    }
    function collideY() {
      var c0 = Math.floor(px - PR), c1 = Math.floor(px + PR), c;
      if (vy > 0) {
        var r = Math.floor(py + PR);
        for (c = c0; c <= c1; c++) if (solidCell(c, r)) {
          if (vy > FALL_FREE_V) { var dmg = Math.round((vy - FALL_FREE_V) * FALL_DMG / (0.6 + up().hull * 0.14)); if (dmg > 0) { big("💥 Hard landing! −" + dmg + " hull", "#ff8a8a"); if (juice) juice.shake(6); damage(dmg); } }
          py = r - PR - 0.001; vy = 0; grounded = true; break;
        }
      } else if (vy < 0) {
        var r2 = Math.floor(py - PR);
        for (c = c0; c <= c1; c++) if (solidCell(c, r2)) { py = r2 + 1 + PR + 0.001; vy = 0; break; }
      }
    }

    // ---------- earthquakes ----------
    function forceQuake() {
      if (over || atSurface || inBoss) return;
      quakeWarn = 1.2; quakeT = 3;
      big("⛰ EARTHQUAKE! Boulders down the shafts — dodge sideways!", "#ffd23f");
      if (sfx && sfx.buzz) sfx.buzz(); if (juice) juice.shake(9);
      spawnBoulders();
    }
    function spawnBoulders() {
      var pc = podCell();
      // guaranteed one right above the pod in its (open) shaft, plus a few nearby
      boulders.push({ c: pc.c, py: py - 3, vy: 0 });
      for (var i = 0; i < 3; i++) {
        var c = clampCol(pc.c + (i - 1) * 2);
        if (dug[key(c, pc.r - 4)] || c === pc.c) boulders.push({ c: c, py: py - 4 - i, vy: 0 });
      }
    }
    function quakeStep(dt) {
      if (quakeWarn > 0) quakeWarn -= dt;
      if (quakeT > 0) { quakeT -= dt; if (Math.random() < 0.5 && juice) juice.shake(3); }
      for (var i = boulders.length - 1; i >= 0; i--) {
        var b = boulders[i];
        b.vy += GRAVITY * 1.2 * dt; b.py += b.vy * dt;
        // hit the pod?
        if (Math.abs(b.c + 0.5 - px) < 0.7 && Math.abs(b.py - py) < 0.7) {
          boulders.splice(i, 1); big("🪨 A boulder clonked the pod! −" + BOULDER_DMG + " hull", "#ff8a8a");
          if (juice) juice.shake(8); if (sfx && sfx.buzz) sfx.buzz(); damage(BOULDER_DMG); continue;
        }
        // land on solid floor
        if (solidCell(b.c, Math.floor(b.py + 0.5))) { boulders.splice(i, 1); continue; }
        if (b.py > py + 30) boulders.splice(i, 1);
      }
    }

    // ---------- the MAGMA KING boss ----------
    function enterBoss() {
      leaveSurface(); inBoss = true; paused = false;
      // carve a small open arena and drop the pod in
      var cc = Math.floor(COLS / 2), rr = 200;
      for (var r = rr - 6; r <= rr + 2; r++) for (var c = 1; c < COLS - 1; c++) dug[key(c, r)] = 1;
      px = cc + 0.5; py = rr + 1.5; vx = vy = 0;
      boss = { vents: 3, shield: true, shieldT: 0, blobCd: 2.2, x: cc + 0.5, y: rr - 4 };
      blobs = [];
      big("👑🌋 THE MAGMA KING! Tap him & answer a WORD to melt his shield, then drill his 3 vents!", "#ff7a3d");
      if (sfx && sfx.buzz) sfx.buzz();
      msgEl.innerHTML = "👑🌋 <b>THE CORE CHAMBER</b> — melt the shield, drill 3 vents!";
    }
    function bossStep(dt) {
      if (!boss) return;
      if (boss.shieldT > 0) { boss.shieldT -= dt; if (boss.shieldT <= 0) { boss.shield = true; big("🛡 The Magma King re-armed his shield — answer again!", "#ffd740"); } }
      // fly the pod (no drilling in the arena)
      flyStep(inX, inY, dt);
      // lob telegraphed magma blobs
      boss.blobCd -= dt;
      if (boss.blobCd <= 0) {
        boss.blobCd = 2.2;
        blobs.push({ x: boss.x, y: boss.y, tx: px, warn: 0.9, vx: 0, vy: 0, live: 3 });
      }
      for (var i = blobs.length - 1; i >= 0; i--) {
        var b = blobs[i];
        if (b.warn > 0) { b.warn -= dt; if (b.warn <= 0) { var dx = b.tx - b.x, dy = (py) - b.y, dd = Math.hypot(dx, dy) || 1; b.vx = dx / dd * 9; b.vy = dy / dd * 9; } continue; }
        b.x += b.vx * dt; b.y += b.vy * dt; b.live -= dt;
        if (Math.abs(b.x - px) < 0.6 && Math.abs(b.y - py) < 0.6) { blobs.splice(i, 1); big("🔥 Blob hit! −12 hull", "#ff6b3d"); if (juice) juice.shake(6); damage(12); continue; }
        if (b.live <= 0) blobs.splice(i, 1);
      }
      hud();
    }
    function duel() {
      if (!inBoss || !boss || !boss.shield || paused || over) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(ddq, words, store, {
        title: "👑 The Magma King demands a WORD! Answer to melt his shield!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            boss.shield = false; boss.shieldT = 10;
            big("💥 SHIELD MELTED — drill his 3 vents, GO!", "#69f0ae");
            if (juice) { juice.shake(8); juice.burst(W / 2, H / 2, "#ff9f43", 22); } if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("The Magma King just chuckles… try another word.", "#ff8a8a");
        }
      });
    }
    function hitVent() {
      if (!inBoss || !boss || over) return false;
      if (boss.shield) { big("🛡 His shield's up — melt it with a word first!", "#ffd740"); return false; }
      boss.vents -= 1;
      big("💥 Vent cooled! " + boss.vents + " to go!", "#69f0ae");
      if (juice) juice.burst(W / 2, H / 2, "#8ecdf7", 16); if (sfx && sfx.pop) sfx.pop();
      if (boss.vents <= 0) bossWin();
      return true;
    }
    function bossWin() {
      bossBeatenSession = true; dc.bossBeaten = true; dc.ngPlus = (dc.ngPlus || 0) + 1;
      addGold(5000);
      big("🏆 CORE CHAMPION! You cracked the core for a 5000-gold hoard!", "#ffd23f");
      if (juice) { juice.shake(12); for (var i = 0; i < 6; i++) juice.burst(W * (0.15 + i * 0.14), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb", "#ff9f43"][i], 20); }
      if (sfx && sfx.fanfare) sfx.fanfare();
      boss = null; blobs = []; inBoss = false;
      if (store.save) store.save();
      msgEl.innerHTML = "⛏️ <b>Gold Digger: Deep Core</b> — New Game+ " + dc.ngPlus + " unlocked!";
      arriveSurface(); hud();
    }

    // ---------- surface economy ----------
    function sell() {
      if (cargo.length === 0) { big("Dig up some minerals first!", "#ffd740"); return 0; }
      var counts = {}, sum = 0, i;
      for (i = 0; i < cargo.length; i++) { sum += cargo[i].v; counts[cargo[i].k] = (counts[cargo[i].k] || 0) + 1; }
      addGold(sum); cargo = [];
      big("💰 Sold the haul for " + sum + " gold!", "#69f0ae");
      if (sfx && sfx.coin) sfx.coin(); if (juice) juice.burst(W / 2, H * 0.4, "#ffd23f", 16);
      hud(); if (atSurface) renderShop();
      return sum;
    }
    function repairHull() {
      if (!atSurface) return false;
      var need = Math.ceil(hullMax() - hull);
      if (need <= 0) { big("🛡 Hull already full!", "#ffd740"); return false; }
      var cost = need * REPAIR_PER;
      if (wallet < cost) { need = Math.floor(wallet / REPAIR_PER); cost = need * REPAIR_PER; if (need <= 0) { big("Not enough gold to repair!", "#ffd740"); return false; } }
      spend(cost); hull = Math.min(hullMax(), hull + need);
      big("🛡 Patched " + need + " hull for " + cost + " gold.", "#69f0ae");
      if (sfx && sfx.fanfare) sfx.fanfare(); hud(); renderShop(); return true;
    }
    function buyFuel(units) {
      if (!atSurface) return false;
      var space = tankMax() - fuel; if (space <= 0) { big("⛽ Tank already full!", "#ffd740"); return false; }
      units = Math.min(units, space); var cost = Math.ceil(units);
      if (wallet < cost) { units = wallet; cost = wallet; if (units <= 0) { big("Not enough gold for fuel!", "#ffd740"); return false; } }
      spend(cost); fuel = Math.min(tankMax(), fuel + units);
      big("⛽ Bought " + Math.round(units) + " fuel for " + cost + " gold.", "#69f0ae");
      if (sfx && sfx.coin) sfx.coin(); hud(); renderShop(); return true;
    }
    function fuelQuiz() {
      if (over || paused) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(ddq, words, store, {
        title: "⛽ WORD FUEL! Answer a word for a free +40% refill!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) { fuel = Math.min(tankMax(), fuel + tankMax() * 0.4); freeRefillUsed = true; big("⛽ +40% fuel! Dig on!", "#69f0ae"); if (sfx && sfx.fanfare) sfx.fanfare(); }
          else big("The pump sputtered… try again.", "#ff8a8a");
          hud(); if (atSurface) renderShop();
        }
      });
    }

    // ---------- upgrades / specials / items ----------
    function buy(track) {
      if (!atSurface) { big("Surface to upgrade!", "#ffd740"); return false; }
      var cur = up()[track], next = cur + 1;
      if (next > 5) { big("🔧 " + TRACK_META[track].name + " already maxed!", "#ffd740"); return false; }
      var cost = COST[track][next];
      if (wallet < cost) { big("Not enough gold (" + cost + ")!", "#ffd740"); return false; }
      if (next >= 4) { openBuyQuiz(track, next, cost); return true; } // tiers 4 & 5 word-gated
      applyBuy(track, cost); return true;
    }
    function applyBuy(track, cost) {
      spend(cost); up()[track] += 1;
      if (track === "tank") fuel = Math.min(tankMax(), fuel + tankMax() * 0.25);
      if (track === "hull") hull = Math.min(hullMax(), hull + 40);
      big("🔧 " + TRACK_META[track].name + " → tier " + up()[track] + "!", "#69f0ae");
      if (sfx && sfx.fanfare) sfx.fanfare(); if (juice) juice.shake(4);
      if (store.save) store.save(); hud(); renderShop();
    }
    function openBuyQuiz(track, next, cost) {
      paused = true;
      cv._lastQ = VQ.miniQuiz(ddq, words, store, {
        title: "🔧 Tier " + next + " " + TRACK_META[track].name + " — answer a word to unlock it!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) applyBuy(track, cost);
          else big("Keep your gold — try again after a dive.", "#ff8a8a");
          if (atSurface) renderShop();
        }
      });
    }
    function buySpecial(id) {
      if (!atSurface) { big("Surface to buy specials!", "#ffd740"); return false; }
      var s = SPECIALS[id]; if (!s) return false;
      if (dc.specials[id]) { big("Already owned!", "#ffd740"); return false; }
      if (s.needs && !dc.specials[s.needs]) { big("Buy " + SPECIALS[s.needs].name + " first!", "#ffd740"); return false; }
      if (wallet < s.cost) { big("Not enough gold (" + s.cost + ")!", "#ffd740"); return false; }
      spend(s.cost); dc.specials[id] = 1;
      big("✨ " + s.e + " " + s.name + " installed!", "#69f0ae");
      if (sfx && sfx.fanfare) sfx.fanfare(); if (store.save) store.save(); hud(); renderShop(); return true;
    }
    function buyItem(id) {
      if (!atSurface) { big("Surface to restock!", "#ffd740"); return false; }
      var it = ITEMS[id]; if (!it) return false;
      if ((dc.items[id] || 0) >= 3) { big("Max 3 of each!", "#ffd740"); return false; }
      if (wallet < it.cost) { big("Not enough gold (" + it.cost + ")!", "#ffd740"); return false; }
      spend(it.cost); dc.items[id] = (dc.items[id] || 0) + 1;
      big("🛒 Bought " + it.e + " " + it.name + "!", "#69f0ae");
      if (sfx && sfx.coin) sfx.coin(); if (store.save) store.save(); renderItems(); renderShop(); return true;
    }
    function useItem(id) {
      if (over) return false;
      if ((dc.items[id] || 0) <= 0) { big("No " + (ITEMS[id] ? ITEMS[id].name : id) + " left!", "#ffd740"); return false; }
      if (id === "repair") { if (hull >= hullMax()) { big("Hull already full!", "#ffd740"); return false; } hull = Math.min(hullMax(), hull + 40); big("🧯 +40 hull!", "#69f0ae"); }
      else if (id === "reserve") { fuel = Math.min(tankMax(), fuel + tankMax() * 0.5); big("⛽ +50% fuel!", "#69f0ae"); }
      else if (id === "dynamite") { blast(1); big("🧨 BOOM! 3×3 cleared!", "#ffd23f"); }
      else if (id === "mega") { blast(2); big("💥 KABOOM! 5×5 cleared!", "#ffd23f"); }
      else if (id === "teleport") { big("🌀 Teleporting home — cargo safe!", "#8ecdf7"); arriveSurface(); }
      else if (id === "beam") {
        if (cargo.length === 0) { big("Nothing to beam up!", "#ffd740"); return false; }
        var pay = Math.round(cargoValue() * 0.8); addGold(pay); cargo = [];
        big("📡 Cargo Beam! Sold from here for " + pay + " gold (80%).", "#69f0ae");
      }
      dc.items[id] -= 1;
      if (sfx && sfx.chime) sfx.chime(); if (store.save) store.save();
      hud(); renderItems(); if (atSurface) renderShop();
      return true;
    }
    function blast(rad) {
      var pc = podCell();
      for (var dr = -rad; dr <= rad; dr++) for (var dc2 = -rad; dc2 <= rad; dc2++) {
        var c = pc.c + dc2, r = pc.r + dr;
        if (c < 0 || c >= COLS || r < 0) continue;
        digTile(c, r, true); // safe: hazards neutralized, ore still drops
      }
      if (juice) { juice.shake(8); juice.burst(px * cellPx + offX, tileSY(pc.r), "#ffb01f", 24); }
      if (sfx && sfx.buzz) sfx.buzz(); hud();
    }

    // ---------- consumable bar (in-wrap DOM, phantom-tap safe) ----------
    function renderItems() {
      itemBar.innerHTML = ITEM_KEYS.map(function (k) {
        var n = dc.items[k] || 0;
        return '<button type="button" class=" dditem" data-use="' + k + '" title="' + ITEMS[k].name + ' — ' + ITEMS[k].tip + '" style="position:relative;width:44px;height:44px;background:rgba(20,16,10,.72);border:2px solid ' + (n ? "rgba(255,210,60,.6)" : "rgba(255,255,255,.14)") + ';border-radius:12px;font-size:20px;padding:0;line-height:1;font-family:inherit;cursor:pointer;' + (n ? "" : "opacity:.4;") + '">' + ITEMS[k].e +
          (n ? '<span style="position:absolute;right:-4px;top:-6px;background:#ffd23f;color:#3a2a00;border-radius:9px;font-size:11px;font-weight:900;padding:1px 5px">' + n + "</span>" : "") + "</button>";
      }).join("");
      Array.prototype.forEach.call(itemBar.querySelectorAll("[data-use]"), function (b) {
        function useIt(e) { e.preventDefault(); useItem(b.dataset.use); }
        b.addEventListener("touchstart", useIt, { passive: false });
        b.addEventListener("mousedown", useIt);
      });
    }

    // ---------- surface base UI ----------
    function pips(n, max) { return "●".repeat(n) + "○".repeat(max - n); }
    function upBtn(track) {
      var cur = up()[track], next = cur + 1, maxed = next > 5, cost = maxed ? 0 : COST[track][next];
      var gate = !maxed && next >= 4 ? " 📖" : "";
      return '<button class="embtn" style="min-width:132px' + (maxed || wallet < cost ? ";opacity:.6" : "") + '" data-buy="' + track + '">' +
        '<span class="ebl">' + TRACK_META[track].e + " " + TRACK_META[track].name + " " + pips(cur, 5) + '</span>' +
        '<span class="ebs">' + (maxed ? "MAX" : "🪙 " + cost + gate) + "</span></button>";
    }
    function spBtn(id) {
      var s = SPECIALS[id], have = !!dc.specials[id];
      return '<button class="embtn" style="min-width:132px' + (have || wallet < s.cost ? ";opacity:.6" : "") + '" data-sp="' + id + '">' +
        '<span class="ebl">' + s.e + " " + s.name + '</span><span class="ebs">' + (have ? "OWNED" : "🪙 " + s.cost) + "</span></button>";
    }
    function itBtn(id) {
      var it = ITEMS[id], n = dc.items[id] || 0;
      return '<button class="embtn" style="min-width:132px' + (n >= 3 || wallet < it.cost ? ";opacity:.6" : "") + '" data-item="' + id + '">' +
        '<span class="ebl">' + it.e + " " + it.name + " " + n + "/3</span><span class=\"ebs\">" + (n >= 3 ? "MAX" : "🪙 " + it.cost) + "</span></button>";
    }
    function shopHead() {
      return '<div style="margin:4px 0 8px;color:#5a6b7a;font-weight:bold">🪙 ' + wallet + ' gold · 📦 ' + Math.round(cargoWeight()) + '/' + cargoCap() + ' · 🛡 ' + Math.round(hull) + '/' + hullMax() + ' · ⛽ ' + Math.round(fuelFrac() * 100) + '% · deepest ' + Math.round(stats.bestDepth) + 'm' + (dc.ngPlus ? ' · ⭐×' + dc.ngPlus : '') + '</div>';
    }
    function renderShop() {
      if (!atSurface || over) { ddshop.style.display = "none"; return; }
      var body;
      if (shopPanel === "fuel") {
        body = '<div class="wqtitle" style="font-size:19px">⛽ Fuel Depot</div>' + shopHead() +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
          '<button class="embtn study" style="min-width:150px" id="dd_wordfuel"><span class="ebl">📖 Free Word Fuel</span><span class="ebs">' + (freeRefillUsed ? "used this visit" : "answer = +40%") + "</span></button>" +
          '<button class="embtn" style="min-width:132px" id="dd_fill25"><span class="ebl">⛽ Buy 25 fuel</span><span class="ebs">🪙 25</span></button>' +
          '<button class="embtn mode" style="min-width:132px" id="dd_fillmax"><span class="ebl">⛽ Fill tank</span><span class="ebs">🪙 1/unit</span></button></div>';
      } else if (shopPanel === "process") {
        var counts = {}, i; for (i = 0; i < cargo.length; i++) counts[cargo[i].k] = (counts[cargo[i].k] || 0) + 1;
        var recEmoji = function (k) { return (MINERALS[k] && MINERALS[k].e) || (TREASURES[k] && TREASURES[k].e) || "◆"; };
        var rec = Object.keys(counts).map(function (k) { return '<div style="font-size:13px">' + recEmoji(k) + " ×" + counts[k] + "</div>"; }).join("") || '<div style="font-size:13px;color:#8a98a8">empty — go dig!</div>';
        body = '<div class="wqtitle" style="font-size:19px">🏭 Ore Processor</div>' + shopHead() +
          '<div style="margin:4px 0">' + rec + '</div><div style="font-weight:900;color:#2f9e44">Value: ' + cargoValue() + ' gold</div>' +
          '<button class="embtn mode" style="min-width:150px;margin-top:8px" id="dd_sell"><span class="ebl">💰 Sell all cargo</span><span class="ebs">' + cargo.length + ' chunks</span></button>';
      } else if (shopPanel === "garage") {
        body = '<div class="wqtitle" style="font-size:19px">🔧 Upgrade Garage</div>' + shopHead() +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + TRACK_KEYS.map(upBtn).join("") + '</div>' +
          '<div style="margin:8px 0 2px;font-weight:900;color:#6a5ac0">✨ One-time specials</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + Object.keys(SPECIALS).map(spBtn).join("") + '</div>' +
          '<button class="embtn" style="min-width:150px;margin-top:8px" id="dd_repair"><span class="ebl">🛠 Repair hull</span><span class="ebs">🪙 ' + REPAIR_PER + '/point</span></button>' +
          '<div style="font-size:11px;color:#8a98a8;margin-top:6px">Tiers 4 &amp; 5 ask a word 📖 — study powers the deep dig!</div>';
      } else if (shopPanel === "shack") {
        body = '<div class="wqtitle" style="font-size:19px">🛒 Supply Shack</div>' + shopHead() +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + ITEM_KEYS.map(itBtn).join("") + '</div>' +
          '<div style="font-size:11px;color:#8a98a8;margin-top:6px">Tap an item in your belt (bottom-left) to use it anywhere.</div>';
      } else {
        body = '<div style="font-size:38px">🏕️⛏️</div><div class="wqtitle" style="font-size:20px">Surface Base</div>' + shopHead() +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
          '<button class="embtn" style="min-width:130px" data-go="fuel"><span class="ebl">⛽ Fuel Depot</span><span class="ebs">refuel</span></button>' +
          '<button class="embtn" style="min-width:130px" data-go="process"><span class="ebl">🏭 Ore Processor</span><span class="ebs">sell cargo</span></button>' +
          '<button class="embtn" style="min-width:130px" data-go="garage"><span class="ebl">🔧 Upgrade Garage</span><span class="ebs">6 tracks</span></button>' +
          '<button class="embtn" style="min-width:130px" data-go="shack"><span class="ebl">🛒 Supply Shack</span><span class="ebs">consumables</span></button></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px">' +
          '<button class="embtn mode" style="min-width:150px" id="dd_dive"><span class="ebl">⛏️ DIVE!</span><span class="ebs">drill down</span></button>' +
          '<button class="embtn" style="min-width:130px" id="dd_bank"><span class="ebl">🏁 End Shift</span><span class="ebs">bank &amp; finish</span></button></div>';
      }
      var back = shopPanel !== "base" ? '<button class="wqskip" id="dd_back" type="button">← base</button>' : "";
      ddshop.innerHTML = '<div class="wqcard" style="text-align:center;max-width:600px">' + body + back + "</div>";
      ddshop.style.display = "flex";
      Array.prototype.forEach.call(ddshop.querySelectorAll("[data-go]"), function (b) { b.onclick = function () { shopPanel = b.dataset.go; renderShop(); }; });
      Array.prototype.forEach.call(ddshop.querySelectorAll("[data-buy]"), function (b) { b.onclick = function () { buy(b.dataset.buy); }; });
      Array.prototype.forEach.call(ddshop.querySelectorAll("[data-sp]"), function (b) { b.onclick = function () { buySpecial(b.dataset.sp); }; });
      Array.prototype.forEach.call(ddshop.querySelectorAll("[data-item]"), function (b) { b.onclick = function () { buyItem(b.dataset.item); }; });
      var bk = document.getElementById("dd_back"); if (bk) bk.onclick = function () { shopPanel = "base"; renderShop(); };
      var el;
      if ((el = document.getElementById("dd_wordfuel"))) el.onclick = fuelQuiz;
      if ((el = document.getElementById("dd_fill25"))) el.onclick = function () { buyFuel(25); };
      if ((el = document.getElementById("dd_fillmax"))) el.onclick = function () { buyFuel(tankMax()); };
      if ((el = document.getElementById("dd_sell"))) el.onclick = sell;
      if ((el = document.getElementById("dd_repair"))) el.onclick = repairHull;
      if ((el = document.getElementById("dd_dive"))) el.onclick = startDive;
      if ((el = document.getElementById("dd_bank"))) el.onclick = endShift;
    }
    var flyHintShown = false;
    function startDive() {
      leaveSurface();
      if (!flyHintShown) { flyHintShown = true; big("⬆️ Hold ABOVE the pod to fly — fly up out of the hole to come home!", "#8ecdf7"); }
      // begin the shaft by drilling straight down through the first tile
      inY = 1; apiDrill("down"); inY = 0;
    }

    // ---------- banking / end card ----------
    function rewards() {
      var d = sessionMaxDepth, win = d >= 1000 || bossBeatenSession;
      var gems = Math.min(250, 5 + Math.floor(sessionGold / 50) + Math.floor(d / 60) + (bossBeatenSession ? 60 : 0));
      return {
        win: win,
        score: Math.round(sessionGold + d + (bossBeatenSession ? 3000 : 0)),
        rankPtsDelta: Math.min(12, 1 + Math.floor(d / 150) + (bossBeatenSession ? 4 : 0)),
        xp: Math.min(90, 6 + Math.floor(sessionGold / 40) + Math.floor(d / 50)),
        gems: gems
      };
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = rewards();
      stats.totalGold = (stats.totalGold || 0) + sessionGold;
      if (sessionMaxDepth > (stats.bestDepth || 0)) stats.bestDepth = sessionMaxDepth;
      dc.gold = wallet;
      var res = store.recordGame ? store.recordGame("digger", rw) : null;
      if (store.save) store.save();
      return { rw: rw, res: res };
    }
    function endShift() {
      if (over) return;
      over = true; paused = true; ddshop.style.display = "none";
      var b = bankRun() || { rw: rewards(), res: null };
      var rw = b.rw;
      ddcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (rw.win ? "🏆" : "⛏️") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">Shift complete!</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">⬇️ Deepest <b>' + Math.round(sessionMaxDepth) + 'm</b> · 🪙 <b>' + sessionGold + '</b> gold earned</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">All-time deepest ' + Math.round(stats.bestDepth) + 'm · ' + (stats.totalGold || 0) + ' gold mined · 🪙 ' + wallet + ' in the wallet' + (dc.bossBeaten ? " · 👑 CORE CHAMPION" : "") + '</div>' +
        '<button class="submit big-next" id="dd_again" type="button">⛏️ New shift ➜</button>' +
        '<button class="wqskip" id="dd_leave" type="button">Leave</button></div>';
      ddcard.style.display = "flex";
      if (rw.win && sfx && sfx.fanfare) sfx.fanfare(); if (juice) juice.shake(6);
      document.getElementById("dd_again").onclick = function () { ddcard.style.display = "none"; over = false; newSession(); };
      document.getElementById("dd_leave").onclick = exit;
    }

    // ---------- input ----------
    function tileSX(c) { return offX + c * cellPx + cellPx / 2; }
    function tileSY(r) { return (r - camY) * cellPx + cellPx / 2; }
    function pointerVec(x, y) {
      // thrust toward the finger, relative to the pod on screen
      var pxs = tileSX(px - 0.5), pys = tileSY(py);
      var dx = x - pxs, dy = y - pys, d = Math.hypot(dx, dy);
      if (d < 6) { inX = inY = 0; return; }
      inX = Math.max(-1, Math.min(1, dx / (cellPx * 2)));
      inY = Math.max(-1, Math.min(1, dy / (cellPx * 2)));
    }
    function onDown(x, y) {
      if (over || paused) return;
      if (inBoss) { if (boss && boss.shield) duel(); else hitVent(); return; }
      if (atSurface) return; // buildings are DOM buttons
      pointerVec(x, y);
    }
    function onMove(x, y) { if (over || paused || atSurface || inBoss) return; pointerVec(x, y); }
    function clearInput() { inX = inY = 0; drillTarget = null; }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var r = cv.getBoundingClientRect(); onDown(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var r = cv.getBoundingClientRect(); onMove(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); clearInput(); }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); cv._md = true; onDown(e.clientX - r.left, e.clientY - r.top); });
    cv.addEventListener("mousemove", function (e) { if (!cv._md) return; var r = cv.getBoundingClientRect(); onMove(e.clientX - r.left, e.clientY - r.top); });
    cv.addEventListener("mouseup", function () { cv._md = false; clearInput(); });
    cv.addEventListener("mouseleave", function () { cv._md = false; clearInput(); });
    var keyState = {};
    var KEYS = { ArrowDown: "d", ArrowUp: "u", ArrowLeft: "l", ArrowRight: "r", s: "d", w: "u", a: "l", d: "r" };
    function applyKeys() {
      inX = (keyState.l ? -1 : 0) + (keyState.r ? 1 : 0);
      inY = (keyState.u ? -1 : 0) + (keyState.d ? 1 : 0);
    }
    function onKeyDown(e) {
      var k = KEYS[e.key]; if (!k || over || paused || atSurface || inBoss) return;
      e.preventDefault(); keyState[k] = 1; applyKeys();
    }
    function onKeyUp(e) { var k = KEYS[e.key]; if (!k) return; keyState[k] = 0; applyKeys(); }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    // ---------- test-facing single drill ----------
    function apiDrill(dir) {
      dir = dir || "down";
      if (over || dir === "up") return false;
      if (atSurface) { if (dir !== "down") return false; leaveSurface(); }
      var t = drillCell(dir); if (!t || t.c < 0 || t.c >= COLS) return false;
      if (!solidCell(t.c, t.r)) { // open space — just move a step that way
        if (dir === "down") { py = t.r + 0.5; } else { px = t.c + 0.5; }
        updateDepthEvents(); hud(); return true;
      }
      var tile = genTile(t.c, t.r);
      if (tile.hard > drillPower()) { big("🪨 Too hard — upgrade your drill!", "#ffd740"); return false; }
      // align the pod to the lane, then grind it out in one go
      if (dir === "down") px = t.c + 0.5; else py = t.r + 0.5;
      completeDrill(t.c, t.r, dir);
      return true;
    }

    // ---------- simulation ----------
    function coreStep(dt) {
      if (over) return;
      t0 += dt;
      if (hullFlashLbl > 0) hullFlashLbl -= dt;
      if (inBoss) { bossStep(dt); cameraStep(dt); if (juice) juice.update(dt); return; }
      if (atSurface && inY > 0.35) leaveSurface();
      var drilling = false;
      if (!atSurface) drilling = tryDrill(inX, inY, dt);
      if (!drilling && !atSurface) flyStep(inX, inY, dt); // docked pod is parked on the pad
      // flying up out of the hole docks the pod back at the Base (menu reopens)
      if (!atSurface && !inBoss && !over && !drillTarget && vy < 0 && py < -0.6) { arriveSurface(); hud(); return; }
      if (!atSurface) { quakeStep(dt); if (!over && depthM() > 500 && Math.random() < 0.0009) forceQuake(); }
      updateDepthEvents();
      cameraStep(dt);
      if (juice) juice.update(dt);
    }
    function cameraStep(dt) {
      var target = (atSurface ? 0 : py) - (H / cellPx) * 0.42;
      camY += (target - camY) * Math.min(1, dt * 6);
    }
    function tick(seconds) {
      var left = seconds, sub;
      while (left > 0.0001) { sub = left > 0.05 ? 0.05 : left; coreStep(sub); left -= sub; }
    }

    // ---------- drawing ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H);
      if (inBoss) { g.addColorStop(0, "#5a1a12"); g.addColorStop(1, "#1a0805"); }
      else if (atSurface) { g.addColorStop(0, "#7ec8ff"); g.addColorStop(1, "#cfe9c0"); }
      else { g.addColorStop(0, "#5b4632"); g.addColorStop(1, "#1c130a"); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      var r0 = Math.floor(camY) - 1, r1 = r0 + Math.ceil(H / cellPx) + 2, r, c;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (r = r0; r <= r1; r++) {
        if (r < 0) continue;
        for (c = 0; c < COLS; c++) {
          var sx = offX + c * cellPx, sy = (r - camY) * cellPx;
          if (dug[key(c, r)]) { ctx.fillStyle = "rgba(0,0,0,.30)"; ctx.fillRect(sx, sy, cellPx - 1, cellPx - 1); continue; }
          var tile = genTile(c, r);
          var base = tile.hard === 4 ? "#2e2a33" : tile.hard === 3 ? "#4a4038" : tile.hard === 2 ? "#6e5844" : "#8a6a4a";
          if (tile.type === "magma") base = "#7a2a12"; else if (tile.type === "gas") base = "#3a4a3a";
          ctx.fillStyle = base; ctx.fillRect(sx, sy, cellPx - 1, cellPx - 1);
          if (tile.e) { ctx.font = Math.round(cellPx * 0.58) + "px serif"; ctx.fillText(tile.e, sx + cellPx / 2, sy + cellPx / 2); }
        }
      }
      // surface rig line
      var rigY = (0 - camY) * cellPx;
      if (rigY > -20 && rigY < H + 20) { ctx.fillStyle = "rgba(120,90,50,.6)"; ctx.fillRect(0, rigY - 4, W, 4); }
      // boulders
      ctx.font = Math.round(cellPx * 0.7) + "px serif";
      for (var bi = 0; bi < boulders.length; bi++) ctx.fillText("🪨", tileSX(boulders[bi].c), tileSY(boulders[bi].py));
      // boss + blobs
      if (inBoss && boss) {
        ctx.font = Math.round(cellPx * 1.5) + "px serif"; ctx.fillText("👑🌋", tileSX(boss.x - 0.5), tileSY(boss.y));
        if (boss.shield) { ctx.strokeStyle = "rgba(140,180,255," + (0.5 + Math.sin(t0 * 5) * 0.2) + ")"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tileSX(boss.x - 0.5), tileSY(boss.y), cellPx * 1.4, 0, 7); ctx.stroke(); }
        ctx.font = Math.round(cellPx * 0.7) + "px serif";
        for (var vi = 0; vi < boss.vents; vi++) ctx.fillText("♨️", tileSX(boss.x - 1.5 + vi), tileSY(boss.y + 1.4));
        for (var mi = 0; mi < blobs.length; mi++) { var bb = blobs[mi]; ctx.globalAlpha = bb.warn > 0 ? 0.5 : 1; ctx.fillText(bb.warn > 0 ? "🎯" : "🔥", tileSX(bb.x - 0.5), tileSY(bb.y)); ctx.globalAlpha = 1; }
      }
      // the pod
      var podYs = atSurface ? (py + Math.sin(t0 * 3) * 0.03) : py;
      var px2 = tileSX(px - 0.5), py2 = tileSY(podYs);
      ctx.font = Math.round(cellPx * 0.8) + "px serif";
      ctx.fillText("⛏️", px2 - cellPx * 0.14, py2); ctx.fillText("🤖", px2 + cellPx * 0.14, py2);
      if (drillTarget) { ctx.fillStyle = "rgba(255,210,60," + (0.4 + Math.sin(t0 * 30) * 0.3) + ")"; ctx.fillRect(offX + drillTarget.c * cellPx, (drillTarget.r - camY) * cellPx, cellPx - 1, cellPx - 1); }
      if (juice) juice.draw(ctx);
      ctx.restore();
      // darkness overlay (visibility circle; Headlamp widens it)
      if (dark()) {
        var lamp = 1 + (dc.specials.headlamp2 ? 1.4 : dc.specials.headlamp1 ? 0.7 : 0);
        var rad = cellPx * (2.4 * lamp);
        var rg = ctx.createRadialGradient(px2, py2, rad * 0.4, px2, py2, rad);
        rg.addColorStop(0, "rgba(0,0,0,0)"); rg.addColorStop(1, "rgba(0,0,0,0.92)");
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      }
      // near the top? show the way home
      if (!atSurface && !inBoss && !over && py < 2.5) {
        ctx.save();
        ctx.textAlign = "center"; ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
        ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 4;
        ctx.fillText("⬆️ Fly up to dock at 🏠 Base", W / 2, 128 + Math.sin(t0 * 4) * 3);
        ctx.restore();
      }
      // quake warning banner
      if (quakeWarn > 0) { ctx.fillStyle = "rgba(200,40,20,.5)"; ctx.fillRect(0, 0, W, 6); ctx.fillRect(0, H - safeB - 6, W, 6); }
      // fuel + hull gauges (above the iPhone home indicator)
      var bw = Math.min(320, W * 0.55), bx = (W - bw) / 2;
      gauge(bx, H - safeB - 16, bw, fuelFrac(), "#69f0ae", "#ffb01f", "#ff5b5b");
      gauge(bx, H - safeB - 8, bw, hullFrac(), "#8ecdf7", "#c9b6ff", "#ff5b5b");
    }
    function gauge(x, y, w, f, hi, mid, lo) {
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(x, y, w, 6);
      ctx.fillStyle = f < 0.25 ? lo : f < 0.5 ? mid : hi; ctx.fillRect(x, y, w * f, 6);
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) coreStep(dt);
      draw();
    }

    // ---------- exit / banking ----------
    function progressed() { return sessionMaxDepth > 0 || sessionGold > 0 || cargo.length > 0 || bossBeatenSession; }
    function bankExit() {
      if (over) return;             // End Shift already banked
      if (!progressed()) return;    // an untouched run banks nothing
      var b = bankRun();
      if (b && sfx && sfx.toast) sfx.toast("⛏️ Dig banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._digger = {
      state: function () {
        return {
          depth: depthM(), fuel: fuelFrac(), hull: hullFrac(),
          gold: wallet, wallet: wallet,
          cargoW: cargoWeight(), cargoMax: cargoCap(), cargoValue: cargoValue(),
          upgrades: { drill: up().drill, hull: up().hull, engine: up().engine, tank: up().tank, cargo: up().cargo, radiator: up().radiator },
          specials: { headlamp1: !!dc.specials.headlamp1, headlamp2: !!dc.specials.headlamp2, gasSiphon: !!dc.specials.gasSiphon, magmaTap: !!dc.specials.magmaTap },
          items: { repair: dc.items.repair, reserve: dc.items.reserve, dynamite: dc.items.dynamite, mega: dc.items.mega, teleport: dc.items.teleport, beam: dc.items.beam },
          dark: dark(), atSurface: atSurface, inBoss: inBoss, over: over, banked: banked,
          bestDepth: stats.bestDepth || 0, ngPlus: dc.ngPlus, bossBeaten: dc.bossBeaten,
          climb: -vy, vx: vx
        };
      },
      begin: function () { begin(); },
      thrust: function (dx, dy) { inX = Math.max(-1, Math.min(1, dx || 0)); inY = Math.max(-1, Math.min(1, dy || 0)); if (atSurface && inY <= 0.35) { /* fly at surface */ } },
      drill: function (dir) { return apiDrill(dir); },
      warpDepth: function (m) {
        leaveSurface(); inBoss = false;
        var tr = Math.max(0, Math.round(m / METERS));
        var pc = Math.floor(COLS / 2);
        px = pc + 0.5;
        for (var rr = -1; rr <= tr; rr++) dug[key(pc, rr)] = 1;
        py = tr + 0.5; vx = 0; vy = 0;
        updateDepthEvents(); hud();
      },
      give: function (n) { addGold(n); if (atSurface) renderShop(); },
      fillCargo: function (value, weight) {
        weight = weight || 1; value = value || 0;
        cargo.push({ k: "silver", v: value, w: weight, e: "⚪", col: "#d7e0e8" });
        hud(); return true;
      },
      damage: function (n) { damage(n || 0); },
      setFuel: function (f) { fuel = Math.max(0, Math.min(1, f)) * tankMax(); hud(); },
      surface: function () { arriveSurface(); hud(); },
      sell: sell,
      buy: buy,
      buySpecial: buySpecial,
      buyItem: buyItem,
      useItem: useItem,
      quake: forceQuake,
      spawnBoss: function () { enterBoss(); hud(); },
      duel: duel,
      hitVent: hitVent,
      tick: tick,
      endShift: endShift,
      fuelQuiz: fuelQuiz,
      // deterministic test hooks (place a known tile, count nearby solids)
      putTile: function (dir, type) {
        var pc = podCell();
        var t = dir === "left" ? { c: pc.c - 1, r: pc.r } : dir === "right" ? { c: pc.c + 1, r: pc.r } : { c: pc.c, r: pc.r + 1 };
        delete dug[key(t.c, t.r)];
        tileCache[key(t.c, t.r)] = { type: type, hard: 1, e: type === "magma" ? "🔥" : type === "gas" ? "💨" : "", ore: type };
        return t;
      },
      solidCount: function (rad) {
        rad = rad || 1; var pc = podCell(), n = 0, dr, dc2;
        for (dr = -rad; dr <= rad; dr++) for (dc2 = -rad; dc2 <= rad; dc2++) if (solidCell(pc.c + dc2, pc.r + dr)) n++;
        return n;
      }
    };

    // ---------- boot ----------
    begin();
    if (global._diggerdemo) { // frozen mid-dive tableau for screenshots
      global._diggerdemo = 0;
      seed = 12345; dug = {}; tileCache = {};
      var pc = Math.floor(COLS / 2);
      leaveSurface();
      for (var rr = -1; rr <= 62; rr++) dug[key(pc, rr)] = 1;   // a dug shaft to ~600m
      px = pc + 0.5; py = 60.5; vx = 0; vy = 0;
      up().cargo = 2; up().headlamp1 = 1; dc.specials.headlamp1 = 1;
      cargo = [];
      var demoCap = CARGO_MAX[2] * 0.6, q = 0;
      while (cargoWeight() + 3 <= demoCap) { cargo.push(q % 2 ? { k: "gold", v: 90, w: 3, e: "🟡", col: "#ffcf3f" } : { k: "silver", v: 25, w: 2, e: "⚪", col: "#d7e0e8" }); q++; }
      fuel = tankMax() * 0.6; hull = hullMax() * 0.7;
      tileCache[key(pc - 1, 59)] = { type: "ore", ore: "gold", hard: 2, e: "🟡", col: "#ffcf3f" };
      tileCache[key(pc + 1, 60)] = { type: "ore", ore: "gold", hard: 2, e: "🟡", col: "#ffcf3f" };
      tileCache[key(pc + 1, 58)] = { type: "ore", ore: "silver", hard: 2, e: "⚪", col: "#d7e0e8" };
      tileCache[key(pc - 1, 61)] = { type: "magma", hard: 2, e: "🔥" };
      sessionMaxDepth = depthM();
      camY = py - (H / cellPx) * 0.42;
      hud(); renderItems(); paused = true;
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxDigger = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
