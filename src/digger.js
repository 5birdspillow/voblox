/*
 * Voblox arcade game — ⛏️ GOLD DIGGER (a Motherlode-style dig-deep miner).
 * A little mining pod drills into an endless, deterministic tile world: dirt is
 * fast, rock is slow, hard rock needs a better drill. Deeper = richer ores AND
 * meaner rock. FUEL is the run timer — empty fuel never kills, it just teleports
 * you topside ("Out of fuel! Back topside."). At the surface you SELL ore for
 * run-gold and spend it on drill / tank / cargo upgrades.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - ⛽ WORD FUEL: answer a word (miniQuiz) → +40% fuel. Big button at the
 *     surface, plus one emergency use per dive when the tank runs low.
 *   - 🔧 Drill / Tank / Cargo tier 3 & 4 are WORD-GATED: buying asks a word
 *     first (right = buy proceeds; wrong = gold kept, try again after a dive).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("digger")
 * per run, banked once (guarded) on End Shift, quit, AND app-close. Deepest depth
 * and lifetime gold persist additively — existing save fields are never renamed.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var COLS = 12, METERS = 10; // grid width; each row of depth = 10 meters
  // ore table (rarest first): emoji, min depth (m), per-tile chance, sell value
  var ORES = [
    { k: "rainbow", e: "🌈", min: 800, chance: 0.06, val: 400, c2: "#c96bff" },
    { k: "diamond", e: "💠", min: 500, chance: 0.07, val: 120, c2: "#4dd8e6" },
    { k: "gold", e: "🟡", min: 250, chance: 0.10, val: 40, c2: "#ffcf3f" },
    { k: "silver", e: "⚪", min: 120, chance: 0.12, val: 15, c2: "#d7e0e8" },
    { k: "coal", e: "🪨", min: 30, chance: 0.14, val: 5, c2: "#5a5a5a" }
  ];
  var ORVAL = {}; var ORBYK = {};
  for (var oi = 0; oi < ORES.length; oi++) { ORVAL[ORES[oi].k] = ORES[oi].val; ORBYK[ORES[oi].k] = ORES[oi]; }

  var TANK_MAX = [0, 120, 180, 260, 380];   // fuel capacity by tank tier
  var CARGO_MAX = [0, 6, 12, 20, 32];        // ore capacity by cargo tier
  var DRILL_COST = [0, 0, 60, 180, 420];     // cost to reach tier n
  var TANK_COST = [0, 0, 50, 140, 320];
  var CARGO_COST = [0, 0, 50, 140, 320];
  var MILES = [{ m: 100, s: "🥉 100m!" }, { m: 250, s: "🥈 250m!" }, { m: 500, s: "🥇 500m!" }, { m: 750, s: "💠 750m!" }, { m: 1000, s: "🌈 1000m!!" }];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("digger");
    // additive, NEVER-renamed persistence
    stats.bestDepth = stats.bestDepth || 0;
    stats.totalGold = stats.totalGold || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap digger";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="ddcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="ddmsg">⛏️ Gold Digger — dig deep!</div>' +
      '<div class="grow"><span id="dgfuel">⛽ 100%</span><span id="dgdepth">0m</span>' +
      '<span id="dggold">🪙 0</span><span id="dgcargo">📦 0/6</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<button id="dgfuelbtn" type="button" style="display:none;position:absolute;left:50%;' +
      'bottom:calc(env(safe-area-inset-bottom) + 40px);transform:translateX(-50%);z-index:8;' +
      'background:linear-gradient(#ffe14d,#ffb01f);color:#5a3d00;border:none;border-radius:16px;' +
      'padding:12px 20px;font-family:inherit;font-weight:900;font-size:17px;' +
      'box-shadow:0 6px 0 #b9791a,0 10px 24px #0006;cursor:pointer">⛽ LOW FUEL — answer a word!</button>' +
      '<div class="gmsg" id="ddbig"></div>' +
      '<div class="gover" id="dgshop" style="display:none"></div>' +
      '<div class="gover" id="ddq" style="display:none"></div>' +
      '<div class="gover" id="ddcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#ddcv"), ctx = cv.getContext("2d");
    var ddq = document.getElementById("ddq"), ddcard = document.getElementById("ddcard");
    var dgshop = document.getElementById("dgshop"), fuelBtn = document.getElementById("dgfuelbtn");
    var msgEl = document.getElementById("ddmsg"), bigEl = document.getElementById("ddbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H, cellPx, offX;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      cellPx = Math.max(26, Math.min(Math.floor(W / COLS), Math.floor(H / 12), 52));
      offX = Math.floor((W - cellPx * COLS) / 2);
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var seed = (Date.now() >>> 0) ^ 0x9e3779b9;
    var dug = {}, tileCache = {};
    var podCol, podRow, atSurface, over, paused, banked;
    var fuelUnits, gold, cargo, tiers, maxDepthRun, goldEarnedRun, shownMile, emergencyUsed;
    var heldDir = null, drillTarget = null, lastFmt = null, camY = 0, t0 = 0;

    function key(c, r) { return c + "," + r; }
    function tankMax() { return TANK_MAX[tiers.tank]; }
    function cargoMax() { return CARGO_MAX[tiers.cargo]; }
    function drillPower() { return tiers.drill + 1; }
    function drillSpeed() { return 1.4 + tiers.drill * 0.75; }
    function fuelFrac() { return Math.max(0, Math.min(1, fuelUnits / tankMax())); }
    function depthM() { return atSurface ? 0 : (podRow + 1) * METERS; }

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
    function genTile(c, r) {
      var kk = key(c, r), cached = tileCache[kk];
      if (cached) return cached;
      var m = (r + 1) * METERS, tile;
      // matrix hardness by depth (1 dirt · 2 rock · 3 hard · 4 super)
      var hr = cr(c, r, 5);
      var superC = Math.min(0.25, Math.max(0, (m - 600) / 3000));
      var hardC = Math.min(0.34, Math.max(0, (m - 200) / 2500));
      var rockC = Math.min(0.6, 0.1 + m / 1500);
      var hard = hr < superC ? 4 : hr < superC + hardC ? 3 : hr < superC + hardC + rockC ? 2 : 1;
      // special pockets
      if (m > 25 && cr(c, r, 3) < 0.02) tile = { type: "fuel", hard: 1, e: "⛽" };
      else if (m > 55 && cr(c, r, 4) < 0.012) tile = { type: "chest", hard: 1, e: "💎" };
      else {
        var ore = null;
        for (var i = 0; i < ORES.length; i++) {
          var o = ORES[i];
          if (m >= o.min && cr(c, r, 10 + i) < o.chance) { ore = o; break; }
        }
        if (ore) tile = { type: "ore", ore: ore.k, hard: hard, e: ore.e, col: ore.c2 };
        else tile = { type: hard === 4 ? "super" : hard === 3 ? "hard" : hard === 2 ? "rock" : "dirt", hard: hard, e: "" };
      }
      tileCache[kk] = tile;
      return tile;
    }
    function isPassable(c, r) { return r < 0 || !!dug[key(c, r)]; }

    // ---------- HUD ----------
    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1200);
    }
    function hud() {
      document.getElementById("dgfuel").textContent = "⛽ " + Math.round(fuelFrac() * 100) + "%";
      document.getElementById("dgdepth").textContent = Math.round(depthM()) + "m";
      document.getElementById("dggold").textContent = "🪙 " + gold;
      document.getElementById("dgcargo").textContent = "📦 " + cargo.length + "/" + cargoMax();
    }

    // ---------- run lifecycle ----------
    function begin() {
      seed = (seed * 1103515245 + 12345) >>> 0; // fresh world each session
      dug = {}; tileCache = {};
      podCol = Math.floor(COLS / 2); podRow = -1;
      atSurface = true; over = false; paused = false; banked = false;
      fuelUnits = tankMax(); gold = 0; cargo = [];
      maxDepthRun = 0; goldEarnedRun = 0; shownMile = {}; emergencyUsed = false;
      heldDir = null; drillTarget = null;
      ddcard.style.display = "none"; ddq.style.display = "none";
      arriveSurface();
      hud();
    }
    function resetTiers() { tiers = { drill: 1, tank: 1, cargo: 1 }; }

    // ---------- movement + digging ----------
    function updateDepth() {
      var d = depthM();
      if (d > maxDepthRun) {
        maxDepthRun = d;
        for (var i = 0; i < MILES.length; i++) {
          if (d >= MILES[i].m && !shownMile[MILES[i].m]) {
            shownMile[MILES[i].m] = 1; big(MILES[i].s, "#ffd23f");
            if (sfx && sfx.chime) sfx.chime(); if (juice) juice.shake(4);
          }
        }
        if (d > (stats.bestDepth || 0)) { stats.bestDepth = d; if (store.save) store.save(); } // deepest persists forever
      }
    }
    function arriveSurface() { atSurface = true; podRow = -1; drillTarget = null; hideFuelBtn(); renderSurface(); dgshop.style.display = "flex"; }
    function leaveSurface() { atSurface = false; emergencyUsed = false; dgshop.style.display = "none"; }
    function moveTo(c, r) {
      podCol = c;
      if (r < 0) { if (!atSurface) { podRow = -1; arriveSurface(); } atSurface = true; podRow = -1; }
      else { if (atSurface) leaveSurface(); podRow = r; gravity(); }
      updateDepth(); hud();
    }
    function gravity() { while (podRow >= 0 && isPassable(podCol, podRow + 1)) { podRow++; updateDepth(); } }
    function burnFuel(u) {
      fuelUnits -= u;
      if (fuelUnits <= 0) { forceSurface(); return true; }
      return false;
    }
    function forceSurface() {
      fuelUnits = Math.max(fuelUnits, tankMax() * 0.2); // courtesy top-up — never stuck
      drillTarget = null; heldDir = null;
      big("⛽ Out of fuel! Back topside.", "#ffb01f");
      if (sfx && sfx.buzz) sfx.buzz();
      moveTo(podCol, -1);
    }
    function neighbor(dir) {
      if (dir === "down") return [podCol, podRow + 1];
      if (dir === "up") return [podCol, podRow - 1];
      if (dir === "left") return [podCol - 1, podRow];
      if (dir === "right") return [podCol + 1, podRow];
      return null;
    }
    function digTile(c, r) {
      var kk = key(c, r);
      if (dug[kk]) return;
      var tile = genTile(c, r);
      dug[kk] = 1;
      if (tile.type === "fuel") { fuelUnits = Math.min(tankMax(), fuelUnits + tankMax() * 0.35); big("⛽ Fuel pocket! +35%", "#ffd23f"); if (sfx && sfx.coin) sfx.coin(); }
      else if (tile.type === "chest") { addOre("gold"); addOre("gold"); addOre("silver"); big("💎 Treasure chest!", "#ffd23f"); if (sfx && sfx.coin) sfx.coin(); }
      else if (tile.type === "ore") { if (addOre(tile.ore)) { if (juice) juice.text(tileScreenX(c), tileScreenY(r), tile.e, tile.col || "#fff"); if (sfx && sfx.pop) sfx.pop(); } }
    }
    function addOre(k) {
      if (cargo.length >= cargoMax()) { big("📦 Cargo full — sell topside!", "#ffd740"); return false; }
      cargo.push(k); hud(); return true;
    }
    // one code path for a step: move into air, or drill a solid tile
    function tryStep(dir, instant) {
      if (over || paused || atSurface && dir === "up") return false;
      var n = neighbor(dir); if (!n) return false;
      var c = n[0], r = n[1];
      if (c < 0 || c >= COLS) return false;
      if (isPassable(c, r)) { // walk / fall through open space
        if (burnFuel(3)) return false;
        moveTo(c, r); return true;
      }
      var tile = genTile(c, r);
      if (tile.hard > drillPower()) { big("🪨 Too hard — upgrade your drill!", "#ffd740"); return false; }
      if (instant) return completeDrillNow(c, r, tile);
      if (!drillTarget || drillTarget.c !== c || drillTarget.r !== r) drillTarget = { c: c, r: r, hard: tile.hard, prog: 0 };
      return true;
    }
    function completeDrillNow(c, r, tile) {
      if (burnFuel(4 + tile.hard * 4)) return false; // empty → already surfaced
      digTile(c, r); drillTarget = null; moveTo(c, r);
      if (juice) juice.burst(tileScreenX(c), tileScreenY(r), "#8a6a4a", 8);
      return true;
    }

    // ---------- surface economy ----------
    function sell() {
      if (!atSurface || cargo.length === 0) { if (cargo.length === 0) big("Dig up some ore first!", "#ffd740"); return 0; }
      var sum = 0; for (var i = 0; i < cargo.length; i++) sum += ORVAL[cargo[i]] || 0;
      gold += sum; goldEarnedRun += sum; cargo = [];
      big("💰 Sold ore for " + sum + " gold!", "#69f0ae");
      if (sfx && sfx.coin) sfx.coin(); if (juice) juice.burst(W / 2, H * 0.4, "#ffd23f", 16);
      hud(); renderSurface();
      return sum;
    }
    function costOf(which, next) { return which === "drill" ? DRILL_COST[next] : which === "tank" ? TANK_COST[next] : CARGO_COST[next]; }
    function buy(which) {
      if (!atSurface) { big("Surface to upgrade!", "#ffd740"); return false; }
      var tier = tiers[which], next = tier + 1;
      if (next > 4) { big("🔧 Already maxed!", "#ffd740"); return false; }
      var cost = costOf(which, next);
      if (gold < cost) { big("Not enough gold (" + cost + ")!", "#ffd740"); return false; }
      if (next >= 3) { openBuyQuiz(which, next, cost); return true; } // word-gated
      applyBuy(which, cost); return true;
    }
    function applyBuy(which, cost) {
      gold -= cost; tiers[which] += 1;
      if (which === "tank") fuelUnits = Math.min(tankMax(), fuelUnits + tankMax() * 0.25);
      big("🔧 " + which.toUpperCase() + " upgraded to tier " + tiers[which] + "!", "#69f0ae");
      if (sfx && sfx.fanfare) sfx.fanfare(); if (juice) juice.shake(4);
      hud(); renderSurface();
    }
    function openBuyQuiz(which, next, cost) {
      paused = true;
      cv._lastQ = VQ.miniQuiz(ddq, words, store, {
        title: "🔧 Tier " + next + " " + which + " — answer to unlock the upgrade!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) applyBuy(which, cost);
          else big("Keep your gold — try again after a dive.", "#ff8a8a");
          renderSurface();
        }
      });
    }

    // ---------- word fuel ----------
    function fuelQuiz() {
      if (over) return;
      paused = true; hideFuelBtn();
      cv._lastQ = VQ.miniQuiz(ddq, words, store, {
        title: "⛽ WORD FUEL! Answer a word to refill the tank!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            fuelUnits = Math.min(tankMax(), fuelUnits + tankMax() * 0.4);
            big("⛽ +40% fuel! Dig on!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("The pump sputtered…", "#ff8a8a");
          hud();
        }
      });
    }
    function showFuelBtn() { fuelBtn.style.display = "block"; }
    function hideFuelBtn() { fuelBtn.style.display = "none"; }
    fuelBtn.onclick = function () { emergencyUsed = true; fuelQuiz(); };

    // ---------- surface shop UI ----------
    function upBtn(which, label, emoji) {
      var tier = tiers[which], next = tier + 1;
      var maxed = next > 4;
      var cost = maxed ? 0 : costOf(which, next);
      var gate = !maxed && next >= 3 ? " 📖" : "";
      return '<button class="embtn" style="min-width:120px' + (maxed || gold < cost ? ";opacity:.6" : "") + '" data-buy="' + which + '">' +
        '<span class="ebl">' + emoji + " " + label + " " + "●".repeat(tier) + "○".repeat(4 - tier) + '</span>' +
        '<span class="ebs">' + (maxed ? "MAX" : "🪙 " + cost + gate) + "</span></button>";
    }
    function renderSurface() {
      if (over) return;
      dgshop.innerHTML = '<div class="wqcard" style="text-align:center;max-width:560px">' +
        '<div style="font-size:40px">🏕️⛏️</div>' +
        '<div class="wqtitle" style="font-size:20px">Surface Camp</div>' +
        '<div style="margin:4px 0 8px;color:#5a6b7a;font-weight:bold">🪙 ' + gold + ' gold · 📦 ' + cargo.length + '/' + cargoMax() + ' ore · deepest ' + Math.round(stats.bestDepth) + 'm</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:8px">' +
        '<button class="embtn study" style="min-width:130px" id="dg_sell"><span class="ebl">💰 Sell ore</span><span class="ebs">' + cargo.length + ' chunks</span></button>' +
        '<button class="embtn study" style="min-width:130px" id="dg_fuel"><span class="ebl">⛽ Word Fuel</span><span class="ebs">answer = +40%</span></button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
        upBtn("drill", "Drill", "🔩") + upBtn("tank", "Tank", "🛢️") + upBtn("cargo", "Cargo", "📦") + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px">' +
        '<button class="embtn mode" style="min-width:130px" id="dg_dive"><span class="ebl">⛏️ DIVE!</span><span class="ebs">drill down</span></button>' +
        '<button class="embtn" style="min-width:130px" id="dg_end"><span class="ebl">🏕 End shift</span><span class="ebs">bank &amp; finish</span></button>' +
        '</div>' +
        '<div style="font-size:11px;color:#8a98a8;margin-top:8px">Tier 3 &amp; 4 upgrades ask a word 📖 — study powers the dig!</div></div>';
      dgshop.style.display = "flex";
      document.getElementById("dg_sell").onclick = sell;
      document.getElementById("dg_fuel").onclick = fuelQuiz;
      document.getElementById("dg_dive").onclick = function () { tryStep("down", false); };
      document.getElementById("dg_end").onclick = endShift;
      Array.prototype.forEach.call(dgshop.querySelectorAll("[data-buy]"), function (b) {
        b.onclick = function () { buy(b.dataset.buy); };
      });
    }

    // ---------- banking / end of run ----------
    function rewards() {
      var d = maxDepthRun;
      return {
        win: d >= 500,
        score: goldEarnedRun + Math.round(d),
        rankPtsDelta: Math.min(12, 1 + Math.floor(d / 120)),
        xp: Math.min(80, 6 + Math.floor(goldEarnedRun / 20) + Math.floor(d / 40)),
        gems: 3 + Math.floor(goldEarnedRun / 40) + Math.floor(d / 120)
      };
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = rewards();
      stats.totalGold = (stats.totalGold || 0) + goldEarnedRun;
      if (maxDepthRun > (stats.bestDepth || 0)) stats.bestDepth = maxDepthRun;
      var res = store.recordGame ? store.recordGame("digger", rw) : null;
      if (store.save) store.save();
      return { rw: rw, res: res };
    }
    function endShift() {
      if (over) return;
      over = true; paused = true; hideFuelBtn(); dgshop.style.display = "none";
      var b = bankRun() || { rw: rewards(), res: null };
      var rw = b.rw;
      ddcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (rw.win ? "🏆" : "⛏️") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">Shift complete!</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">⬇️ Deepest <b>' + Math.round(maxDepthRun) + 'm</b> · 🪙 <b>' + goldEarnedRun + '</b> gold earned</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">All-time deepest ' + Math.round(stats.bestDepth) + 'm · ' + (stats.totalGold || 0) + ' gold mined</div>' +
        '<button class="submit big-next" id="dg_again" type="button">⛏️ Dig again ➜</button>' +
        '<button class="wqskip" id="dg_leave" type="button">Leave</button></div>';
      ddcard.style.display = "flex";
      if (rw.win && sfx && sfx.fanfare) sfx.fanfare();
      if (juice) juice.shake(6);
      document.getElementById("dg_again").onclick = function () { ddcard.style.display = "none"; resetTiers(); begin(); };
      document.getElementById("dg_leave").onclick = exit;
    }

    // ---------- input (phantom-tap safe) ----------
    function tileScreenX(c) { return offX + c * cellPx + cellPx / 2; }
    function tileScreenY(r) { return (r - camY) * cellPx + cellPx / 2; }
    function tap(x, y) {
      if (over || paused || atSurface) return;
      // which neighbor did the tap land on, relative to the pod?
      var px = tileScreenX(podCol), py = tileScreenY(podRow);
      var dx = x - px, dy = y - py;
      var dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
      heldDir = dir; tryStep(dir, false);
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var r = cv.getBoundingClientRect(); tap(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top); }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); tap(e.clientX - r.left, e.clientY - r.top); });
    function clearHeld() { heldDir = null; drillTarget = null; }
    cv.addEventListener("mouseup", clearHeld);
    cv.addEventListener("mouseleave", clearHeld);
    cv.addEventListener("touchend", function (e) { e.preventDefault(); clearHeld(); }, { passive: false });
    var KEYS = { ArrowDown: "down", ArrowUp: "up", ArrowLeft: "left", ArrowRight: "right" };
    function onKeyDown(e) {
      var d = KEYS[e.key]; if (!d || over || paused || atSurface) return;
      e.preventDefault(); heldDir = d; tryStep(d, false);
    }
    function onKeyUp(e) { if (KEYS[e.key] === heldDir) clearHeld(); }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    // ---------- simulation ----------
    function step(dt) {
      t0 += dt;
      if (!atSurface) {
        if (drillTarget) {
          drillTarget.prog += dt * drillSpeed();
          if (drillTarget.prog >= drillTarget.hard) {
            var c = drillTarget.c, r = drillTarget.r, tile = genTile(c, r);
            completeDrillNow(c, r, tile);
          }
        } else if (heldDir) {
          tryStep(heldDir, false);
        }
        // emergency word fuel offer (once per dive)
        if (!emergencyUsed && fuelFrac() < 0.15 && !paused) showFuelBtn(); else if (fuelFrac() >= 0.15) hideFuelBtn();
      }
      // camera eases toward the pod
      var targetCam = (atSurface ? 0 : podRow) - (H / cellPx) * 0.42;
      camY += (targetCam - camY) * Math.min(1, dt * 6);
      if (juice) juice.update(dt);
    }

    // ---------- drawing ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H);
      if (atSurface) { g.addColorStop(0, "#7ec8ff"); g.addColorStop(1, "#cfe9c0"); }
      else { g.addColorStop(0, "#5b4632"); g.addColorStop(1, "#241a10"); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var r0 = Math.floor(camY) - 1, r1 = r0 + Math.ceil(H / cellPx) + 2;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (var r = r0; r <= r1; r++) {
        for (var c = 0; c < COLS; c++) {
          var sx = offX + c * cellPx, sy = (r - camY) * cellPx;
          if (r < 0) continue; // sky
          if (dug[key(c, r)]) { ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(sx, sy, cellPx - 1, cellPx - 1); continue; }
          var tile = genTile(c, r);
          var base = tile.hard === 4 ? "#2e2a33" : tile.hard === 3 ? "#4a4038" : tile.hard === 2 ? "#6e5844" : "#8a6a4a";
          ctx.fillStyle = base; ctx.fillRect(sx, sy, cellPx - 1, cellPx - 1);
          if (tile.e) { ctx.font = Math.round(cellPx * 0.6) + "px serif"; ctx.fillText(tile.e, sx + cellPx / 2, sy + cellPx / 2); }
        }
      }
      // surface rig line
      var rigY = (0 - camY) * cellPx;
      if (rigY > -20 && rigY < H + 20) { ctx.fillStyle = "rgba(120,90,50,.6)"; ctx.fillRect(0, rigY - 4, W, 4); }
      // the pod
      var px = tileScreenX(podCol), py = tileScreenY(podRow < 0 ? -0.2 : podRow);
      ctx.font = Math.round(cellPx * 0.78) + "px serif";
      var bob = atSurface ? Math.sin(t0 * 3) * 2 : 0;
      ctx.fillText("⛏️", px - cellPx * 0.16, py + bob);
      ctx.fillText("🤖", px + cellPx * 0.16, py + bob);
      if (drillTarget) { // drilling spark
        ctx.fillStyle = "rgba(255,210,60," + (0.4 + Math.sin(t0 * 30) * 0.3) + ")";
        ctx.fillRect(offX + drillTarget.c * cellPx, (drillTarget.r - camY) * cellPx, cellPx - 1, cellPx - 1);
      }
      // fuel gauge along the bottom
      var bw = Math.min(320, W * 0.6), bx = (W - bw) / 2, by = H - 14;
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(bx, by, bw, 8);
      var ff = fuelFrac();
      ctx.fillStyle = ff < 0.2 ? "#ff5b5b" : ff < 0.4 ? "#ffb01f" : "#69f0ae";
      ctx.fillRect(bx, by, bw * ff, 8);
      if (juice) juice.draw(ctx);
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) step(dt);
      draw();
    }

    // ---------- exit / banking ----------
    function progressed() { return maxDepthRun > 0 || goldEarnedRun > 0 || cargo.length > 0; }
    function bankExit() {
      if (over) return; // End Shift already banked
      if (!progressed()) return; // an untouched run banks nothing
      var b = bankRun();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("⛏️ Dig banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
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
          depth: depthM(), fuel: fuelFrac(), gold: gold, cargo: cargo.length, cargoMax: cargoMax(),
          drillTier: tiers.drill, tankTier: tiers.tank, cargoTier: tiers.cargo,
          atSurface: atSurface, over: over, banked: banked, bestDepth: stats.bestDepth || 0
        };
      },
      begin: function () { resetTiers(); begin(); },
      drill: function (dir) { return tryStep(dir || "down", true); },
      warpDepth: function (m) {
        var tr = Math.max(0, Math.round(m / METERS) - 1);
        leaveSurface(); atSurface = false; emergencyUsed = false;
        for (var rr = 0; rr <= tr; rr++) dug[key(podCol, rr)] = 1;
        podRow = tr; updateDepth(); hud();
      },
      give: function (n) { gold += n; goldEarnedRun += n; hud(); renderSurface(); },
      fill: function (n) { for (var i = 0; i < (n || 0) && cargo.length < cargoMax(); i++) cargo.push("silver"); hud(); },
      surface: function () { moveTo(podCol, -1); },
      sell: sell,
      buy: buy,
      fuelQuiz: fuelQuiz,
      setFuel: function (frac) { fuelUnits = Math.max(0, frac) * tankMax(); hud(); },
      endShift: endShift
    };

    // ---------- boot ----------
    resetTiers();
    begin();
    if (global._diggerdemo) { // screenshot seed: a mid-dive scene, frozen
      global._diggerdemo = 0;
      seed = 12345;
      cv._digger.warpDepth(180);
      tiers.cargo = 2; for (var dq = 0; dq < 6; dq++) cargo.push(dq % 3 === 0 ? "gold" : "silver");
      fuelUnits = tankMax() * 0.4;
      // carve a little dug shaft + expose some ore veins beside it
      for (var dr = 12; dr <= 17; dr++) { dug[key(podCol, dr)] = 1; }
      tileCache[key(podCol - 1, 16)] = { type: "ore", ore: "gold", hard: 2, e: "🟡", col: "#ffcf3f" };
      tileCache[key(podCol + 1, 15)] = { type: "ore", ore: "diamond", hard: 3, e: "💠", col: "#4dd8e6" };
      tileCache[key(podCol - 1, 14)] = { type: "ore", ore: "silver", hard: 2, e: "⚪", col: "#d7e0e8" };
      camY = podRow - (H / cellPx) * 0.42;
      hud(); paused = true; // freeze the tableau for screenshots
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxDigger = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
