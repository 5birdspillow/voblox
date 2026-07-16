/*
 * Voblox arcade game — 🌊 FISHING FRENZY 2: THE ABYSS.
 * A deep-sea SEQUEL with real DEPTH. Your boat 🚤 rides the surface; beneath it a
 * CONTINUOUS water column drops through four zones — ☀️ Sunlit Shallows, 🌅 Twilight,
 * 🌑 Midnight, ⭐ THE ABYSS — each darker than the last. Tap to CAST, then your lure
 * SINKS and you steer it (drag left/right, tap-and-hold to jig). A camera follows the
 * lure down. Buy a real TACKLE BOX of lures with run-coins; each fish only likes some
 * of them (wrong lure = it ignores you). When a fish strikes, a HOOK FIGHT begins:
 * a tension bar (hold to reel in, release and it takes line) PLUS telegraphed LUNGES
 * you counter by pressing the opposite way. Peg the tension a full second and the line
 * SNAPS (kindly — the lure survives). 29 species across the four zones, one ⭐ LEGENDARY
 * per zone and ONE 🐋 mythic ABYSS LEVIATHAN. A Depth-Dex logs every catch.
 * VOCAB IS THE HOOK:
 *   - 🪝 PERFECT CAST: answer a word → the next bite is instant-hooked at HALF stamina.
 *   - 💡 Glow Jig & 🐟 Live Minnow are WORD-GATED buys (right word = the purchase lands).
 *   - LEGENDARY / MYTHIC fish demand a 📜 SPEAK-THE-WORD mid-fight — miss it and it
 *     spooks off (no loss, no scold).
 * Coins + lures + upgrades PERSIST additively in stats; ONE recordGame("fishing2") per
 * session banks the catch value as gems (cap 250) — shown on the Leave card.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // ---- species catalog: id, name, emoji, zone(0-3), rarity, size range, liked lures ----
  function F(id, name, emoji, zone, rarity, min, max, lures) {
    return { id: id, name: name, emoji: emoji, zone: zone, rarity: rarity, min: min, max: max, lures: lures };
  }
  var SPECIES = [
    // ☀️ Zone 0 — Sunlit Shallows (0-30m): worm & spinner country
    F("guppy", "Guppy", "🐟", 0, "common", 4, 10, ["worm"]),
    F("sardine", "Silver Sardine", "🐟", 0, "common", 6, 14, ["worm", "spinner"]),
    F("crab", "Rock Crab", "🦀", 0, "common", 8, 20, ["worm", "shrimp"]),
    F("sunfish", "Sunfish", "🐠", 0, "common", 8, 18, ["worm"]),
    F("bass", "Bold Bass", "🐟", 0, "rare", 20, 45, ["spinner", "minnow"]),
    F("pike", "Pike", "🐡", 0, "rare", 25, 55, ["minnow", "spinner"]),
    F("sunking", "SUNKING", "🦈", 0, "legendary", 60, 130, ["minnow"]),
    // 🌅 Zone 1 — Twilight (30-70m): spinner & shrimp
    F("lantern", "Lanternfish", "🐟", 1, "common", 6, 14, ["spinner"]),
    F("silverside", "Silverside", "🐟", 1, "common", 8, 16, ["spinner"]),
    F("prawn", "Twilight Prawn", "🦐", 1, "common", 5, 12, ["shrimp"]),
    F("jelly", "Drifting Jelly", "🪼", 1, "common", 10, 24, ["shrimp"]),
    F("mackerel", "Mackerel", "🐟", 1, "rare", 20, 45, ["spinner", "minnow"]),
    F("cuttle", "Cuttlefish", "🐙", 1, "rare", 25, 55, ["shrimp", "minnow"]),
    F("sword", "Swordfish", "🗡️", 1, "epic", 60, 130, ["minnow"]),
    F("inkmaw", "INKMAW", "🦑", 1, "legendary", 90, 190, ["glow", "minnow"]),
    // 🌑 Zone 2 — Midnight (70-120m): only Glow Jig (or Minnow) is visible down here
    F("hatchet", "Hatchetfish", "🐟", 2, "common", 5, 12, ["glow"]),
    F("glowjelly", "Glow Jelly", "🪼", 2, "common", 8, 20, ["glow"]),
    F("lantshark", "Lantern Shark", "🦈", 2, "common", 15, 35, ["glow", "minnow"]),
    F("gulper", "Gulper Eel", "🪱", 2, "rare", 30, 70, ["glow", "minnow"]),
    F("angler", "Anglerfish", "🎣", 2, "rare", 25, 55, ["glow"]),
    F("vampsquid", "Vampire Squid", "🦑", 2, "epic", 40, 90, ["glow", "minnow"]),
    F("trenchwyrm", "TRENCHWYRM", "🐉", 2, "legendary", 100, 210, ["minnow"]),
    // ⭐ Zone 3 — THE ABYSS (120-200m): line tier 3 only
    F("dumbo", "Dumbo Octopus", "🐙", 3, "common", 10, 25, ["glow"]),
    F("abyssjelly", "Abyss Jelly", "🪼", 3, "common", 12, 28, ["glow"]),
    F("fangtooth", "Fangtooth", "🐟", 3, "common", 8, 18, ["glow", "minnow"]),
    F("isopod", "Giant Isopod", "🦐", 3, "rare", 20, 45, ["glow"]),
    F("frilled", "Frilled Shark", "🦈", 3, "rare", 40, 90, ["minnow"]),
    F("colossus", "COLOSSUS SQUID", "🦑", 3, "legendary", 120, 260, ["minnow", "glow"]),
    F("leviathan", "THE ABYSS LEVIATHAN", "🐋", 3, "mythic", 300, 600, ["minnow"])
  ];
  var BY_ID = {}; SPECIES.forEach(function (s) { BY_ID[s.id] = s; });

  // ---- the tackle box: two of them are WORD-GATED purchases ----
  var LURES = {
    worm: { id: "worm", name: "Worm", emoji: "🪱", cost: 0, gated: false, tip: "shallow common fish" },
    spinner: { id: "spinner", name: "Spinner", emoji: "✨", cost: 45, gated: false, tip: "fast mid-water fish" },
    shrimp: { id: "shrimp", name: "Shrimp", emoji: "🦐", cost: 95, gated: false, tip: "twilight bottom-feeders" },
    glow: { id: "glow", name: "Glow Jig", emoji: "💡", cost: 150, gated: true, tip: "seen in the dark deep" },
    minnow: { id: "minnow", name: "Live Minnow", emoji: "🐟", cost: 220, gated: true, tip: "predators strike it" }
  };
  var LURE_ORDER = ["worm", "spinner", "shrimp", "glow", "minnow"];

  var ZONES = [
    { name: "Sunlit Shallows", emoji: "☀️", top: 0, bot: 30 },
    { name: "Twilight", emoji: "🌅", top: 30, bot: 70 },
    { name: "Midnight", emoji: "🌑", top: 70, bot: 120 },
    { name: "The Abyss", emoji: "⭐", top: 120, bot: 200 }
  ];
  var RVAL = { common: 8, rare: 20, epic: 45, legendary: 110, mythic: 260 };
  var STAM = { common: 2, rare: 3.2, epic: 4.5, legendary: 6, mythic: 9 };
  var TEL = { common: 1.4, rare: 1.1, epic: 0.9, legendary: 0.7, mythic: 0.55 };
  var RARCOL = { common: "#9fb4c4", rare: "#40c4ff", epic: "#c07bff", legendary: "#ffd23f", mythic: "#ff6bd6" };
  var LINE_MAX = [70, 120, 200]; // deepest reachable by line tier 1/2/3

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("fishing2");

    // ---- persistent, additive fields (never touch stats.best) ----
    var coins = stats.coins2 || 0;
    var lures = stats.lures || { worm: 1 }; if (!lures.worm) lures.worm = 1;
    var lineTier = stats.lineTier || 1;
    var reelTier = stats.reelTier || 1;
    var dex = stats.dex2 || {};
    var bestDepth = stats.bestDepth2 || 0;
    stats.coins2 = coins; stats.lures = lures; stats.lineTier = lineTier;
    stats.reelTier = reelTier; stats.dex2 = dex; if (stats.bestDepth2 == null) stats.bestDepth2 = bestDepth;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap fishing2";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="f2cv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="f2msg">🌊 Fishing Frenzy 2: The Abyss</div>' +
      '<div class="grow"><span id="f2depth">0m</span><span id="f2zone">☀️ Shallows</span>' +
      '<span id="f2coins">🪙 0</span><span id="f2buff" style="display:none">🪝</span>' +
      '<button class="replay" id="f2dex" type="button" title="Depth-Dex">📖</button>' +
      '<button class="replay" id="f2shop" type="button" title="Boat & Tackle">🛒</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="f2big"></div>' +
      '<div class="gover" id="f2q" style="display:none"></div>' +
      '<div class="gover" id="f2card" style="display:none"></div>' +
      '<div id="f2bar" style="position:absolute;left:0;right:96px;bottom:0;padding:6px 8px calc(env(safe-area-inset-bottom) + 6px);display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end;z-index:8;background:linear-gradient(transparent,rgba(0,0,0,.28))"></div>' +
      // the REEL is the most important control in the game — a big fixed thumb
      // button that can never be pushed off-screen by the lure chips
      '<button id="f2reel" type="button" style="position:absolute;right:10px;bottom:calc(env(safe-area-inset-bottom) + 10px);width:80px;height:80px;z-index:9;' +
      'border-radius:50%;border:3px solid #ffffff55;background:linear-gradient(#4fc3f7,#1a6ab0);color:#fff;font-family:inherit;font-weight:900;font-size:15px;' +
      'box-shadow:0 5px 0 #0d3a66,0 8px 20px #0007;cursor:pointer;padding:0;line-height:1.15">🎣<br>REEL</button>' +
      '<div class="runhint" id="f2hint" style="bottom:calc(env(safe-area-inset-bottom) + 104px)">Tap the water to cast!</div>';
    document.body.appendChild(wrap);
    // compact the crowded HUD row so the Leave button never clips on a phone
    // (a long zone name like "Sunlit Shallows" used to shove it off), and give
    // the little 📖/🛒 buttons a real 44px thumb target
    (function () {
      var st = document.createElement("style");
      st.textContent =
        ".gamewrap.fishing2 .ghud .grow{flex-wrap:wrap;gap:6px;padding:0 4px}" +
        ".gamewrap.fishing2 .ghud .grow span{font-size:14px;padding:3px 8px;white-space:nowrap;border-width:2px;border-bottom-width:3px}" +
        ".gamewrap.fishing2 .ghud .grow .replay{min-width:44px;min-height:44px;font-size:20px;padding:0;display:inline-flex;align-items:center;justify-content:center}" +
        ".gamewrap.fishing2 .ghud .grow .bossquit{white-space:nowrap}";
      wrap.appendChild(st);
    })();
    var cv = wrap.querySelector("#f2cv"), ctx = cv.getContext("2d");

    var W, H;
    function resize() { W = cv.width = wrap.clientWidth || 800; H = cv.height = wrap.clientHeight || 560; }
    resize(); window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---- live state ----
    var running = true, raf = 0, lastT = performance.now(), run = 0;
    var cast = false;            // lure deployed in the water column?
    var depth = 0;               // lure depth in metres
    var lureX = 0.5;             // lure horizontal position (fraction of width)
    var camDepth = 0;            // eased camera depth
    var reelHeld = false;        // reel button / hook-fight hold
    var jigT = 0;                // little upward hop timer
    var lure = "worm";           // selected lure id
    var buffed = false;          // 🪝 perfect-cast charged (one at a time)
    var fight = null;            // null | { sp, staminaMax, stamina, tension, line, lunge, tel, lungeCd, pegT, phase, wordPending }
    var fishList = [];           // live fish swimming the column
    var bubbles = [];            // rising particle bubbles
    var spawnT = 1.2;            // ambient fish spawn countdown
    var banked = false;          // this session already recorded?
    var sessionValue = 0, sessionCatches = 0, bestVal = 0, gotBig = false, lastFmt = null;

    for (var b = 0; b < 26; b++) bubbles.push({ x: Math.random(), d: Math.random() * 200, r: 1 + Math.random() * 3, sp: 6 + Math.random() * 10 });

    // ---------- helpers ----------
    function maxDepth() { return LINE_MAX[lineTier - 1] || 70; }
    function reelSpeed() { return 22 + reelTier * 10; }
    // strict thresholds: a line that reaches EXACTLY 70/120m still reads as the
    // shallower zone, so tier-1 (70m) can't fish Midnight and tier-2 (120m) can't fish the Abyss
    function zoneOf(m) { return m > 120 ? 3 : m > 70 ? 2 : m > 30 ? 1 : 0; }
    function likes(sp, id) { return sp.lures.indexOf(id) >= 0; }
    function sightR(sp) {
      // in the dark (zone 2+), fish only notice the glow jig or a minnow — tiny sight otherwise
      if (sp.zone >= 2 && lure !== "glow" && lure !== "minnow") return 4;
      return 14;
    }

    var msgEl = document.getElementById("f2msg"), bigEl = document.getElementById("f2big"), hintEl = document.getElementById("f2hint");
    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1100);
    }
    function hud() {
      var z = zoneOf(cast || fight ? depth : 0);
      document.getElementById("f2depth").textContent = Math.round(cast || fight ? depth : 0) + "m";
      document.getElementById("f2zone").textContent = ZONES[z].emoji + " " + ZONES[z].name;
      document.getElementById("f2coins").textContent = "🪙 " + coins;
      document.getElementById("f2buff").style.display = buffed ? "" : "none";
    }
    function persist() {
      stats.coins2 = coins; stats.lures = lures; stats.lineTier = lineTier;
      stats.reelTier = reelTier; stats.dex2 = dex;
      stats.bestDepth2 = Math.max(stats.bestDepth2 || 0, bestDepth);
      store.save();
    }

    // ---------- the tackle bar (compact chips — the old wide buttons shoved
    // the REEL clean off a phone screen, which made the game feel broken) ----------
    function renderBar() {
      var bar = document.getElementById("f2bar");
      var lb = LURE_ORDER.map(function (id) {
        var L = LURES[id], owned = !!lures[id];
        var sel = lure === id && owned;
        var badge = owned ? "" :
          '<span style="position:absolute;right:-4px;top:-6px;background:#ffd23f;color:#3a2a00;border-radius:9px;font-size:10px;font-weight:900;padding:1px 4px">🔒' + L.cost + '</span>';
        return '<button data-lure="' + id + '" title="' + L.name + " — " + L.tip + '" style="position:relative;width:52px;height:52px;' +
          'background:rgba(10,24,40,.66);border:2px solid ' + (sel ? "#ffe14d" : owned ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.14)") + ';border-radius:14px;' +
          'font-size:22px;padding:0;line-height:1;font-family:inherit;cursor:pointer;' + (owned ? "" : "opacity:.55;") + '">' + L.emoji + badge + '</button>';
      }).join("");
      bar.innerHTML = lb +
        '<button id="f2perf" title="Perfect Cast — answer a word, next bite is instant-hooked" style="position:relative;width:52px;height:52px;' +
        'background:rgba(60,20,80,.7);border:2px solid ' + (buffed ? "#9be15d" : "rgba(255,255,255,.3)") + ';border-radius:14px;font-size:22px;padding:0;line-height:1;font-family:inherit;cursor:pointer">🪝' +
        (buffed ? '<span style="position:absolute;right:-4px;top:-6px;background:#9be15d;color:#0a3014;border-radius:9px;font-size:10px;font-weight:900;padding:1px 4px">✓</span>' : "") + '</button>';
      Array.prototype.forEach.call(bar.querySelectorAll("[data-lure]"), function (btn) {
        btn.onclick = function () {
          var id = btn.dataset.lure;
          if (lures[id]) { lure = id; big(LURES[id].emoji + " " + LURES[id].name + " tied on!", "#8ecdf7"); renderBar(); }
          else buyLure(id);
        };
      });
      document.getElementById("f2perf").onclick = perfectCastQuiz;
    }

    // ---------- buying lures (word-gated for glow + minnow) ----------
    function buyLure(id) {
      var L = LURES[id];
      if (!L || lures[id]) { if (lures[id]) { lure = id; renderBar(); } return; }
      if (!L.gated) {
        if (coins < L.cost) { big("Not enough 🪙 coins for the " + L.name + "!", "#ffd740"); return; }
        coins -= L.cost; lures[id] = 1; lure = id; persist(); hud(); renderBar();
        big("🛒 " + L.emoji + " " + L.name + " bought!", "#9be15d");
        if (sfx && sfx.coin) sfx.coin();
        return;
      }
      // word gate: correct answer lands the purchase; wrong keeps your coins
      cv._lastQ = VQ.miniQuiz(document.getElementById("f2q"), words, store, {
        title: "🛒 Buy the " + L.emoji + " " + L.name + " — spell to seal the deal!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) {
            if (coins < L.cost) { big("Right word! …but you need " + L.cost + " 🪙 first.", "#ffd740"); return; }
            coins -= L.cost; lures[id] = 1; lure = id; persist(); hud(); renderBar();
            big("🔓 " + L.emoji + " " + L.name + " UNLOCKED!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else { big("The tackle shop keeps its " + L.name + " for now — coins kept.", "#ff8a8a"); }
        }
      });
    }

    // ---------- 🪝 perfect cast buff ----------
    function perfectCastQuiz() {
      if (buffed) { big("🪝 Already charged — cast and hook!", "#ffe14d"); return; }
      cv._lastQ = VQ.miniQuiz(document.getElementById("f2q"), words, store, {
        title: "🪝 PERFECT CAST — answer to charge an instant hook!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) { buffed = true; hud(); renderBar(); big("🪝 Charged! Next bite hooks INSTANTLY at half stamina.", "#69f0ae"); if (sfx && sfx.chime) sfx.chime(); }
          else big("The cast wobbled — try again!", "#ff8a8a");
        }
      });
    }

    // ---------- boat & tackle shop (upgrades) ----------
    var LINE_COST = [0, 120, 300];  // cost to reach tier 2 / 3
    var REEL_COST = [0, 90, 160, 240];
    function upgrade(which) {
      if (which === "line") {
        if (lineTier >= 3) { big("Line already maxed — the ABYSS is yours!", "#ffd740"); return false; }
        var lc = LINE_COST[lineTier];
        if (coins < lc) { big("Need " + lc + " 🪙 for a longer line!", "#ffd740"); return false; }
        coins -= lc; lineTier++; persist(); hud(); renderShop();
        big("🪢 Line tier " + lineTier + "! Now reaches " + maxDepth() + "m.", "#9be15d");
        if (sfx && sfx.fanfare) sfx.fanfare();
        return true;
      }
      if (which === "reel") {
        if (reelTier >= 3) { big("Reel already maxed!", "#ffd740"); return false; }
        var rc = REEL_COST[reelTier];
        if (coins < rc) { big("Need " + rc + " 🪙 for a faster reel!", "#ffd740"); return false; }
        coins -= rc; reelTier++; persist(); hud(); renderShop();
        big("⚙️ Reel tier " + reelTier + " — reels in faster!", "#9be15d");
        if (sfx && sfx.pop) sfx.pop();
        return true;
      }
      return false;
    }
    function renderShop() {
      var end = document.getElementById("f2card");
      var lineRow = lineTier >= 3 ? '<span style="color:#2f9e44;font-weight:900">MAXED</span>' :
        '<button class="submit" style="padding:5px 10px" id="f2upline">' + LINE_COST[lineTier] + ' 🪙 → ' + LINE_MAX[lineTier] + 'm</button>';
      var reelRow = reelTier >= 3 ? '<span style="color:#2f9e44;font-weight:900">MAXED</span>' :
        '<button class="submit" style="padding:5px 10px" id="f2upreel">' + REEL_COST[reelTier] + ' 🪙 faster</button>';
      end.innerHTML = '<div class="wqcard" style="max-width:460px"><div class="wqtitle">🛒 Boat & Tackle — 🪙 ' + coins + '</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">Longer line reaches deeper zones. Deeper water = rarer fish.</div>' +
        '<div style="display:flex;align-items:center;gap:8px;background:#f4f8fc;border-radius:10px;padding:6px 10px;margin:4px 0"><span style="font-size:22px">🪢</span><div style="flex:1;text-align:left"><b>Line — tier ' + lineTier + '/3</b><div style="font-size:11px;color:#5a6b7a">t1 70m · t2 120m · t3 200m ABYSS</div></div>' + lineRow + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;background:#f4f8fc;border-radius:10px;padding:6px 10px;margin:4px 0"><span style="font-size:22px">⚙️</span><div style="flex:1;text-align:left"><b>Reel — tier ' + reelTier + '/3</b><div style="font-size:11px;color:#5a6b7a">reel line in faster</div></div>' + reelRow + '</div>' +
        '<button class="wqskip" id="f2shopback" type="button">back to fishing</button></div>';
      end.style.display = "flex";
      var ul = document.getElementById("f2upline"); if (ul) ul.onclick = function () { upgrade("line"); };
      var ur = document.getElementById("f2upreel"); if (ur) ur.onclick = function () { upgrade("reel"); };
      document.getElementById("f2shopback").onclick = function () { end.style.display = "none"; end.innerHTML = ""; };
    }
    document.getElementById("f2shop").onclick = renderShop;

    // ---------- Depth-Dex ----------
    function showDex() {
      var end = document.getElementById("f2card");
      var rows = ZONES.map(function (z, zi) {
        var cells = SPECIES.filter(function (s) { return s.zone === zi; }).map(function (sp) {
          var d = dex[sp.id];
          var col = RARCOL[sp.rarity] || "#888";
          return '<div class="dexcell" style="border-color:' + col + '">' +
            (d ? '<div class="dexe">' + sp.emoji + '</div><div class="dexn">' + VQ.esc(sp.name) + '</div><div class="dexs">×' + d.n + " · " + d.best + "cm</div>"
               : '<div class="dexe">' + (sp.rarity === "mythic" ? "🌑" : "❓") + '</div><div class="dexn">???</div><div class="dexs">&nbsp;</div>') + "</div>";
        }).join("");
        return '<div class="wqtitle" style="margin-top:8px">' + z.emoji + " " + z.name + '</div><div class="dexgrid">' + cells + "</div>";
      }).join("");
      var found = Object.keys(dex).length;
      end.innerHTML = '<div class="wqcard" style="max-height:80vh;overflow:auto"><div class="wqtitle">📖 Depth-Dex — ' + found + " / " + SPECIES.length + "</div>" + rows +
        '<button class="wqskip" id="f2dexclose" type="button">Close</button></div>';
      end.style.display = "flex";
      document.getElementById("f2dexclose").onclick = function () { end.style.display = "none"; end.innerHTML = ""; };
    }
    document.getElementById("f2dex").onclick = showDex;

    // ---------- casting / steering the lure ----------
    function doCast() {
      if (cast || fight) return;
      cast = true; depth = 0; lureX = 0.5; reelHeld = false; jigT = 0;
      hintEl.textContent = "It sinks… drag to steer, hold-tap to jig, REEL to bring it up.";
      if (sfx && sfx.whoosh) sfx.whoosh();
    }
    function steer(dx) { if (!cast || fight) return; lureX += dx * 1.4; if (lureX < 0.05) lureX = 0.05; if (lureX > 0.95) lureX = 0.95; }
    function jig() { if (!cast || fight) return; jigT = 0.9; if (sfx && sfx.tone) sfx.tone(520, 0.05, "sine", 0.03); }
    function sinkTo(m) {
      if (fight) return;
      cast = true;
      var md = maxDepth();
      depth = Math.max(0, Math.min(md, m));
      camDepth = depth;
      if (depth > bestDepth) bestDepth = Math.round(depth);
      hud();
    }

    // ---------- spawning fish ----------
    function makeFish(sp, atDepth, atX) {
      var band = ZONES[sp.zone];
      var d = atDepth == null ? band.top + 4 + Math.random() * (band.bot - band.top - 8) : atDepth;
      return { sp: sp, x: atX == null ? Math.random() * 0.9 + 0.05 : atX, depth: d, dir: Math.random() < 0.5 ? -1 : 1, wig: Math.random() * 6, home: d };
    }
    function spawnFish(id, dist) {
      var sp = BY_ID[id]; if (!sp) return null;
      var f = makeFish(sp, depth + (dist || 0), lureX);
      fishList.push(f); return f;
    }
    function ambientSpawn() {
      if (fishList.length >= 9) return;
      var z = zoneOf(cast || fight ? depth : 12);
      var pool = SPECIES.filter(function (s) { return s.zone === z && s.rarity !== "mythic"; });
      // rarity weighting so the good ones stay special
      var roll = Math.random() * 100;
      var want = roll < 4 ? "legendary" : roll < 18 ? "epic" : roll < 45 ? "rare" : "common";
      var cand = pool.filter(function (s) { return s.rarity === want; });
      if (!cand.length) cand = pool;
      if (!cand.length) return;
      fishList.push(makeFish(cand[Math.floor(Math.random() * cand.length)]));
    }

    // ---------- the strike ----------
    function nearestFish() {
      var best = null, bd = 1e9;
      for (var i = 0; i < fishList.length; i++) {
        var f = fishList[i];
        var d = Math.abs(f.depth - depth) + Math.abs(f.x - lureX) * 40;
        if (d < bd) { bd = d; best = f; }
      }
      return best;
    }
    function bite() {
      if (fight || !cast) return false;
      var f = nearestFish();
      if (!f) return false;
      if (!likes(f.sp, lure)) { big(f.sp.emoji + " sniffs the " + LURES[lure].name + "… and swims off. (wrong lure)", "#ffd740"); return false; }
      strike(f);
      return true;
    }
    function strike(f) {
      // remove the fish from the water and open a hook fight
      var idx = fishList.indexOf(f); if (idx >= 0) fishList.splice(idx, 1);
      startFight(f.sp);
    }

    // ---------- HOOK FIGHT v2 ----------
    function setLunge() {
      fight.lunge = Math.random() < 0.5 ? "L" : "R";
      fight.tel = TEL[fight.sp.rarity] || 1.1;
    }
    function startFight(sp) {
      var smax = STAM[sp.rarity] || 3;
      fight = {
        sp: sp, staminaMax: smax, stamina: buffed ? smax * 0.5 : smax,
        tension: 0, line: 0, lunge: null, tel: 0, lungeCd: 0, pegT: 0,
        phase: sp.rarity === "mythic" ? 3 : 1, wordPending: false
      };
      if (buffed) { buffed = false; hud(); renderBar(); }
      setLunge();
      hintEl.textContent = "HOLD 🎣 REEL to fight it in — counter the ⬅➡ lunges!";
      var big2 = sp.rarity === "legendary" || sp.rarity === "mythic";
      if (big2) {
        big((sp.rarity === "mythic" ? "🐋 THE ABYSS LEVIATHAN!" : "⭐ " + sp.name + "!"), RARCOL[sp.rarity]);
        if (juice) juice.shake(sp.rarity === "mythic" ? 12 : 8);
        if (sfx && sfx.fanfare) sfx.fanfare();
        speakWord(); // 📜 it demands a word before the fight can be won
      } else {
        if (sfx && sfx.chime) sfx.chime();
      }
    }
    function speakWord() {
      fight.wordPending = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("f2q"), words, store, {
        title: "📜 SPEAK THE WORD to hold the " + fight.sp.name + "!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (!fight) return;
          if (ok) { fight.wordPending = false; big("📜 The word holds it! Keep fighting!", "#69f0ae"); if (juice) juice.shake(5); }
          else spookOff();
        }
      });
    }
    function spookOff() {
      big("💨 It spooked off into the dark — no worries, no loss!", "#8ecdf7");
      fight = null; reelHeld = false; cast = false; depth = 0;
      hintEl.textContent = "Tap the water to cast again!";
      if (sfx && sfx.whoosh) sfx.whoosh();
    }
    function snap() {
      big("〰️ SNAP! The line pegged out — ease off next time. (lure survived)", "#ffd740");
      fight = null; reelHeld = false;
      hintEl.textContent = "Phew — your lure's fine. REEL up or keep fishing.";
      if (sfx && sfx.buzz) sfx.buzz();
    }
    function counter(dir) {
      if (!fight || fight.wordPending) return;
      if (fight.lunge && fight.lunge === dir) {
        fight.stamina = Math.max(0, fight.stamina - 1.15);
        fight.lunge = null; fight.lungeCd = 0.55 + Math.random() * 0.5;
        if (juice) juice.burst(W / 2, H / 2, "#69f0ae", 8);
        if (sfx && sfx.pop) sfx.pop();
      } else {
        // wrong way / no lunge — a little tension penalty
        fight.tension = Math.min(1, fight.tension + 0.12);
        if (sfx && sfx.tone) sfx.tone(220, 0.05, "square", 0.02);
      }
    }
    function updateFight(dt) {
      if (fight.wordPending) return; // paused for the 📜 word prompt
      fight.tension += (reelHeld ? 0.9 : -0.75) * dt;
      if (fight.tension < 0) fight.tension = 0;
      if (fight.tension > 1) fight.tension = 1;
      if (fight.tension >= 0.999) { fight.pegT += dt; if (fight.pegT > 1) { snap(); return; } }
      else fight.pegT = 0;
      // line comes in while reeling (faster once the fish tires), slips out when you let go
      var pull = reelHeld ? (0.14 + 0.13 * (1 - fight.stamina / fight.staminaMax)) : -0.10;
      fight.line += pull * dt;
      if (fight.line < 0) fight.line = 0;
      if (fight.line >= 1) { landFight(); return; }
      // telegraphed lunges
      if (fight.lunge) {
        fight.tel -= dt;
        if (fight.tel <= 0) { fight.tension = Math.min(1, fight.tension + 0.3); fight.lunge = null; fight.lungeCd = 0.6 + Math.random() * 0.5; }
      } else {
        fight.lungeCd -= dt;
        if (fight.lungeCd <= 0 && fight.stamina > 0) setLunge();
      }
    }
    function landFight() {
      var sp = fight.sp;
      var size = Math.round(sp.min + Math.random() * (sp.max - sp.min));
      var frac = (size - sp.min) / Math.max(1, (sp.max - sp.min));
      var val = Math.round((RVAL[sp.rarity] || 8) * (0.7 + frac * 0.6));
      coins += val; sessionValue += val; sessionCatches++; bestVal = Math.max(bestVal, val);
      if (sp.rarity === "legendary" || sp.rarity === "mythic") gotBig = true;
      var d = dex[sp.id], isNew = !d;
      if (!d) dex[sp.id] = { n: 1, best: size };
      else { d.n++; if (size > d.best) d.best = size; }
      if (depth > bestDepth) bestDepth = Math.round(depth);
      persist(); hud();
      var caughtDepth = Math.round(depth);
      fight = null; reelHeld = false; cast = false; depth = 0;
      if (sfx && sfx.coin) sfx.coin();
      if (juice) { juice.burst(W / 2, H * 0.45, RARCOL[sp.rarity] || "#ffd740", 20); juice.shake(sp.rarity === "mythic" ? 12 : sp.rarity === "legendary" ? 9 : 5); }
      var end = document.getElementById("f2card");
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div class="wqtitle">' + (isNew ? "🆕 NEW SPECIES!" : "Landed!") + '</div>' +
        '<div style="font-size:56px;line-height:1.1">' + sp.emoji + '</div>' +
        '<div style="font-weight:900;font-size:20px;color:#20303a">' + size + 'cm ' + VQ.esc(sp.name) + (isNew ? " — NEW!" : "") + '</div>' +
        '<div style="color:' + (RARCOL[sp.rarity] || "#888") + ';font-weight:900">' + sp.rarity.toUpperCase() + ' · from ' + caughtDepth + 'm</div>' +
        '<div style="color:#2f9e44;font-weight:900;font-size:18px;margin-top:4px">+' + val + ' 🪙</div>' +
        '<button class="wqskip" id="f2keep">Keep fishing 🎣</button></div>';
      end.style.display = "flex";
      document.getElementById("f2keep").onclick = function () { end.style.display = "none"; end.innerHTML = ""; hintEl.textContent = "Tap the water to cast!"; };
    }
    function winFight() { if (fight) { if (fight.wordPending) fight.wordPending = false; landFight(); } }

    // ---------- fish AI ----------
    var homingN = 0; // fish currently charging the lure (slows the sink — bite anticipation!)
    function updateFish(dt) {
      var nowHoming = 0;
      for (var i = 0; i < fishList.length; i++) {
        var f = fishList[i];
        f.wig += dt * 6;
        var band = ZONES[f.sp.zone];
        // jigging flashes the lure — fish notice from twice as far
        var seeR = sightR(f.sp) * (jigT > 0 ? 2 : 1);
        if (cast && !fight && likes(f.sp, lure) && Math.abs(f.depth - depth) < seeR && Math.abs(f.x - lureX) < 0.42) {
          // noticed the lure — CHARGE it (much faster than the lure sinks, so
          // strikes actually happen in real play, not just in forced tests)
          nowHoming++;
          f.depth += (depth - f.depth > 0 ? 1 : -1) * 26 * dt;
          f.x += (lureX - f.x > 0 ? 1 : -1) * 0.28 * dt;
          if (Math.abs(f.depth - depth) < 4 && Math.abs(f.x - lureX) < 0.09) { strike(f); i--; continue; }
        } else {
          // idle patrol within the band
          f.x += f.dir * 0.05 * dt;
          if (f.x < 0.04) { f.x = 0.04; f.dir = 1; } if (f.x > 0.96) { f.x = 0.96; f.dir = -1; }
          f.depth = f.home + Math.sin(f.wig) * 2.5;
          if (f.depth < band.top + 2) f.depth = band.top + 2;
          if (f.depth > band.bot - 2) f.depth = band.bot - 2;
        }
      }
      // cull fish that wandered far from the current view
      if (!fight) {
        var view = cast ? depth : 12;
        fishList = fishList.filter(function (f) { return Math.abs(f.depth - view) < 90; });
      }
      if (nowHoming > 0 && homingN === 0 && cast && !fight) hintEl.textContent = "❗ Something's coming — get ready!";
      homingN = nowHoming;
    }

    // ---------- input ----------
    var dnX = 0, dnY = 0, dnT = 0, lstX = 0, dragging = false, moved = false, pendCast = false;
    function pt(e) { var r = cv.getBoundingClientRect(); var t = e.changedTouches ? e.changedTouches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; }
    function onDown(x, y) {
      dragging = true; moved = false; dnX = lstX = x; dnY = y; dnT = run;
      if (!cast && !fight) pendCast = true; else pendCast = false;
    }
    function onMove(x, y) {
      if (!dragging) return;
      var dxp = (x - lstX) / (W || 1);
      if (Math.abs(x - dnX) > 8) moved = true;
      if (cast && !fight) steer(dxp);
      lstX = x;
    }
    function onUp(x, y) {
      if (!dragging) return;
      dragging = false;
      if (fight && !fight.wordPending) { counter(x < W / 2 ? "L" : "R"); return; }
      if (pendCast && !moved) { doCast(); pendCast = false; return; }
      if (cast && !fight && !moved) jig();
    }
    function tStart(e) { e.preventDefault(); var p = pt(e); onDown(p.x, p.y); }
    function tMove(e) { e.preventDefault(); var p = pt(e); onMove(p.x, p.y); }
    function tEnd(e) { e.preventDefault(); var p = pt(e); onUp(p.x, p.y); }
    function mDown(e) { var p = pt(e); onDown(p.x, p.y); }
    function mMove(e) { var p = pt(e); onMove(p.x, p.y); }
    function mUp(e) { var p = pt(e); onUp(p.x, p.y); }
    cv.addEventListener("touchstart", tStart, { passive: false });
    cv.addEventListener("touchmove", tMove, { passive: false });
    cv.addEventListener("touchend", tEnd, { passive: false });
    cv.addEventListener("mousedown", mDown);
    window.addEventListener("mousemove", mMove);
    window.addEventListener("mouseup", mUp);
    // the big fixed REEL button (in-wrap, so its listeners die with the game)
    (function () {
      var rb = document.getElementById("f2reel");
      function reelOn(e) { e.preventDefault(); reelHeld = true; }
      function reelOff() { reelHeld = false; }
      rb.addEventListener("touchstart", reelOn, { passive: false });
      rb.addEventListener("touchend", reelOff);
      rb.addEventListener("touchcancel", reelOff);
      rb.addEventListener("mousedown", reelOn);
      rb.addEventListener("mouseup", reelOff);
      rb.addEventListener("mouseleave", reelOff);
    })();

    // ---------- simulation ----------
    function step(dt) {
      run += dt;
      spawnT -= dt;
      if (spawnT <= 0) { ambientSpawn(); spawnT = 1.6 + Math.random() * 1.8; }
      for (var i = 0; i < bubbles.length; i++) { var bu = bubbles[i]; bu.d -= bu.sp * dt; if (bu.d < 0) { bu.d = 200; bu.x = Math.random(); } }
      updateFish(dt);
      if (fight) updateFight(dt);
      else if (cast) {
        if (jigT > 0) jigT -= dt;
        if (reelHeld) depth -= reelSpeed() * dt;
        // gentle sink (was a 16 m/s plummet no fish could catch); a charging
        // fish slows it to a crawl so the strike lands — the anticipation IS the fun
        else depth += (homingN > 0 ? 1.5 : 6.5) * dt * (jigT > 0 ? 0.25 : 1);
        if (jigT > 0) depth -= 4 * dt;
        var md = maxDepth();
        if (depth < 0) depth = 0;
        if (depth > md) depth = md;
        if (depth <= 0 && reelHeld) { cast = false; reelHeld = false; hintEl.textContent = "Tap the water to cast!"; }
        if (depth > bestDepth) bestDepth = Math.round(depth);
      }
      var target = (cast || fight) ? depth : 0;
      camDepth += (target - camDepth) * Math.min(1, dt * 4);
      hud();
    }

    // ---------- drawing ----------
    function depthColor(m) {
      // shallows bright blue → abyss near-black
      var t = Math.min(1, m / 200);
      var r = Math.round(42 * (1 - t) + 4 * t);
      var g = Math.round(120 * (1 - t) + 8 * t);
      var bl = Math.round(190 * (1 - t) + 26 * t);
      return "rgb(" + r + "," + g + "," + bl + ")";
    }
    function draw() {
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      var topH = 96;                                   // HUD reserve
      var viewM = 62;                                  // metres visible in the column
      var pxPerM = (H - topH) / viewM;
      var camTop = Math.max(0, camDepth - viewM * 0.42);
      function yOf(m) { return topH + (m - camTop) * pxPerM; }
      // water column gradient
      var g = ctx.createLinearGradient(0, topH, 0, H);
      g.addColorStop(0, depthColor(camTop)); g.addColorStop(1, depthColor(camTop + viewM));
      ctx.fillStyle = g; ctx.fillRect(-10, topH, W + 20, H - topH + 10);
      // sky + boat when near the surface
      if (camTop < 8) {
        var sy = ctx.createLinearGradient(0, 0, 0, topH); sy.addColorStop(0, "#8fd0ff"); sy.addColorStop(1, "#dff2ff");
        ctx.fillStyle = sy; ctx.fillRect(-10, -10, W + 20, topH + 10);
        var surfY = yOf(0);
        ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 2;
        ctx.beginPath(); for (var xx = 0; xx <= W; xx += 14) ctx.lineTo(xx, surfY + Math.sin(run * 1.6 + xx * 0.03) * 3); ctx.stroke();
        ctx.font = Math.round(H * 0.06) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🚤", W * lureX, surfY - 14);
      }
      // fading light shafts (dim with depth)
      var shaftA = Math.max(0, 0.16 * (1 - camTop / 90));
      if (shaftA > 0.01) {
        ctx.fillStyle = "rgba(255,255,220," + shaftA + ")";
        for (var s = 0; s < 4; s++) { var lx = ((s + 1) / 5 + Math.sin(run * 0.3 + s) * 0.02) * W; ctx.save(); ctx.translate(lx, topH); ctx.transform(1, 0, -0.25, 1, 0, 0); ctx.fillRect(-16, 0, 32, H); ctx.restore(); }
      }
      // zone floor seaweed/rocks parallax
      ZONES.forEach(function (z) {
        var fy = yOf(z.bot);
        if (fy > topH - 20 && fy < H + 20) {
          ctx.font = "18px serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          for (var k = 0; k < 7; k++) { var gx = (k / 6) * W + Math.sin(k * 2 + z.top) * 10; ctx.fillText(k % 2 ? "🪨" : "🌿", gx, fy); }
        }
      });
      // rising bubbles
      ctx.fillStyle = "#ffffff44";
      for (var bi = 0; bi < bubbles.length; bi++) { var bb = bubbles[bi]; var by = yOf(camTop + bb.d * 0.31); if (by > topH && by < H) { ctx.beginPath(); ctx.arc(bb.x * W, by, bb.r, 0, 6.28); ctx.fill(); } }
      // fish (silhouettes in the dark unless glowing)
      var darkView = camTop >= 70;
      for (var fi = 0; fi < fishList.length; fi++) {
        var f = fishList[fi]; var fy = yOf(f.depth);
        if (fy < topH - 20 || fy > H + 20) continue;
        var lit = !darkView || lure === "glow";
        ctx.font = Math.round(20 + (f.sp.max > 100 ? 14 : 0)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.save(); ctx.translate(f.x * W + Math.sin(f.wig) * 3, fy);
        if (!lit) { ctx.globalAlpha = 0.28; }
        ctx.fillText(f.sp.emoji, 0, 0);
        ctx.restore(); ctx.globalAlpha = 1;
      }
      // the lure + line + glow ring
      if (cast || fight) {
        var ly = fight ? yOf(depth) : yOf(depth);
        var lx2 = W * lureX;
        ctx.strokeStyle = "#ffffffaa"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(lx2, yOf(0)); ctx.lineTo(lx2, ly); ctx.stroke();
        if (lure === "glow" && camTop >= 40) {
          var rg = ctx.createRadialGradient(lx2, ly, 2, lx2, ly, 48);
          rg.addColorStop(0, "#fff6b0cc"); rg.addColorStop(1, "#fff6b000");
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(lx2, ly, 48, 0, 6.28); ctx.fill();
        }
        ctx.font = "20px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(LURES[lure].emoji, lx2, ly + (jigT > 0 ? -4 : 0));
        // live depth readout by the lure
        ctx.font = "bold 13px Trebuchet MS, sans-serif"; ctx.fillStyle = "#fff";
        ctx.fillText(Math.round(depth) + "m", lx2, ly + 22);
      }
      // hook-fight UI
      if (fight && !fight.wordPending) {
        var bw = Math.max(46, W * 0.07), bx = W - bw - 14, by = H * 0.16, bh = H * 0.56;
        // tension bar
        ctx.fillStyle = "#00000066"; ctx.fillRect(bx, by, bw, bh);
        var th = bh * fight.tension;
        ctx.fillStyle = fight.tension > 0.85 ? "#ff5252" : fight.tension > 0.6 ? "#ffd23f" : "#69f0ae";
        ctx.fillRect(bx, by + bh - th, bw, th);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
        ctx.font = "bold 12px Trebuchet MS"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText("TENSION", bx + bw / 2, by - 4);
        // line-in progress
        ctx.fillStyle = "#00000066"; ctx.fillRect(bx - 16, by, 10, bh);
        ctx.fillStyle = "#40c4ff"; var ph = bh * fight.line; ctx.fillRect(bx - 16, by + bh - ph, 10, ph);
        // lunge arrow
        if (fight.lunge) {
          ctx.font = "bold " + Math.round(H * 0.09) + "px Trebuchet MS"; ctx.fillStyle = "#ffe14d"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(fight.lunge === "L" ? "⬅" : "➡", W / 2, H * 0.4);
          ctx.font = "bold 14px Trebuchet MS"; ctx.fillStyle = "#fff";
          ctx.fillText("press " + (fight.lunge === "L" ? "LEFT" : "RIGHT") + "!", W / 2, H * 0.4 + 34);
        }
        // the fish, front and center
        ctx.font = Math.round(H * 0.08) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(fight.sp.emoji, W / 2, H * 0.62);
      }
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      step(dt);
      if (juice) juice.update(dt);
      draw();
    }

    // ---------- banking / exit ----------
    function runRewards() {
      var gems = Math.min(250, Math.round(sessionValue));
      var xp = Math.min(80, sessionCatches * 4 + Math.round(sessionValue / 10) + (gotBig ? 10 : 0));
      var delta = Math.min(12, sessionCatches + (gotBig ? 5 : 0));
      return { win: gotBig, score: bestVal, rankPtsDelta: delta, xp: xp, gems: gems };
    }
    function bankRun() {
      if (banked) return null;
      if (sessionCatches === 0 && sessionValue === 0) return null;
      banked = true;
      var rw = runRewards();
      var res = store.recordGame ? store.recordGame("fishing2", rw) : null;
      return { rw: rw, res: res };
    }
    function doExit() {
      running = false; cancelAnimationFrame(raf); VQ.shush();
      cv.removeEventListener("touchstart", tStart); cv.removeEventListener("touchmove", tMove); cv.removeEventListener("touchend", tEnd);
      cv.removeEventListener("mousedown", mDown);
      window.removeEventListener("mousemove", mMove); window.removeEventListener("mouseup", mUp);
      window.removeEventListener("resize", resize); window.removeEventListener("beforeunload", onUnload);
      persist();
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    function showEndCard(bank) {
      var rw = bank.rw, res = bank.res;
      var end = document.getElementById("f2card");
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:440px"><div style="font-size:44px">🌊🎣</div>' +
        '<div class="wqtitle" style="font-size:20px">Back to the docks!</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:2px 0;font-size:13px;color:#5a6b7a">🎣 ' + sessionCatches + ' caught this trip · deepest ' + bestDepth + 'm' + (gotBig ? ' · ⭐ trophy!' : '') + (res && res.rankedUp ? '<br>🎖 RANK UP!' : '') + '</div>' +
        '<button class="submit big-next" id="f2done">Leave the boat ➜</button></div>';
      end.style.display = "flex";
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(5); for (var c = 0; c < 4; c++) juice.burst(W * (0.25 + c * 0.18), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6bd6"][c], 14); }
      document.getElementById("f2done").onclick = doExit;
    }
    function quit() {
      var bank = bankRun();
      if (bank) showEndCard(bank); else doExit();
    }
    function bankExit() {
      var bank = bankRun();
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🌊 Fishing trip banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    document.getElementById("quit").onclick = quit;

    // ---------- test hook ----------
    cv._fishing2 = {
      state: function () {
        return {
          depth: Math.round((cast || fight ? depth : 0) * 10) / 10,
          zone: zoneOf(cast || fight ? depth : 0),
          lure: lure,
          coins: coins,
          casting: cast,
          fighting: fight ? { species: fight.sp.id, stamina: fight.stamina, tension: fight.tension, lunge: fight.lunge, wordPending: fight.wordPending } : null,
          buffed: buffed,
          banked: banked,
          session: { catches: sessionCatches, value: sessionValue },
          lineTier: lineTier,
          reelTier: reelTier,
          maxDepth: maxDepth()
        };
      },
      cast: doCast,
      steer: function (dx) { steer(dx); },
      jig: jig,
      sinkTo: function (m) { sinkTo(m); },
      spawnFish: function (id, dist) { return spawnFish(id, dist); },
      bite: bite,
      reelHold: function (on) { reelHeld = !!on; },
      counter: function (dir) { counter(dir); },
      winFight: winFight,
      buyLure: function (id) { buyLure(id); },
      give: function (n) { coins += n; persist(); hud(); renderBar(); },
      perfectCastQuiz: perfectCastQuiz,
      upgrade: function (which) { return upgrade(which); },
      dex: function () { return dex; },
      fish: function () { return fishList; },
      SPECIES: SPECIES, LURES: LURES
    };

    // ---------- boot ----------
    renderBar(); hud();
    big("🌊 Cast down through four zones — the ABYSS awaits!", "#ffe14d");

    // guarded demo hook: a paused mid-fight tableau in the Twilight zone
    if (global._fishing2demo) setTimeout(function () {
      global._fishing2demo = 0;
      coins = 340; lineTier = 3; reelTier = 2;
      lures.spinner = 1; lures.shrimp = 1; lures.glow = 1; lures.minnow = 1;
      lure = "minnow";
      dex["guppy"] = { n: 2, best: 9 }; dex["lantern"] = { n: 1, best: 12 };
      dex["prawn"] = { n: 1, best: 10 }; dex["mackerel"] = { n: 1, best: 33 };
      cast = true; depth = 55; camDepth = 55; lureX = 0.5;
      var sp = BY_ID["mackerel"];
      fight = { sp: sp, staminaMax: STAM.rare, stamina: STAM.rare * 0.7, tension: 0.6, line: 0.3, lunge: "L", tel: 1.0, lungeCd: 0, pegT: 0, phase: 1, wordPending: false };
      fishList = [makeFish(BY_ID["silverside"], 48, 0.25), makeFish(BY_ID["jelly"], 62, 0.78)];
      hud(); renderBar();
    }, 300);

    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxFishing2 = { start: start, SPECIES: SPECIES, LURES: LURES, ZONES: ZONES };
})(typeof window !== "undefined" ? window : globalThis);
