/*
 * Voblox arcade game — 📚 Books vs Zombies (a loving PvZ-style lane defense).
 * The Brain-Rot zombies shuffle in staring at their phones; your BOOKS defend
 * the library. 5×9 grid, 📖 Ink economy, book carts as the last line per row,
 * and FIVE levels that ramp like the real thing (new books + new zombies each).
 * VOCAB IS THE POWER CURVE:
 *   - 🖋 INK RUSH: answer a word (miniQuiz) → +150 ink burst (15s cooldown).
 *     Dictionaries drip ink slowly; readers fund armies fast.
 *   - The 📜 Spell Book (top weapon) asks a word to place.
 * recordGame("books") per level; progress persists (gameStats.books.best).
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  var MW = 1000, MH = 560;
  var ROWS = 5, COLS = 9;

  var BOOKS = {
    blaster: { name: "Word Blaster", emoji: "📕", cost: 100, hp: 90, dmg: 7, cd: 1.15, lvl: 1, tip: "shoots letters" },
    dict: { name: "Dictionary", emoji: "📖", cost: 50, hp: 90, drip: 25, dripCd: 8.5, lvl: 1, tip: "makes ink" },
    wall: { name: "Book Wall", emoji: "📚", cost: 50, hp: 340, lvl: 2, tip: "very thick reading" },
    freeze: { name: "Freeze Thesaurus", emoji: "❄️", cost: 175, hp: 90, dmg: 5, cd: 1.25, slow: true, lvl: 3, tip: "chills zombies" },
    catapult: { name: "Crayon Catapult", emoji: "🖍️", cost: 150, hp: 90, dmg: 15, cd: 2.6, lob: true, lvl: 3, tip: "splash lobs" },
    bomb: { name: "Grammar Bomb", emoji: "💥", cost: 150, hp: 60, boom: true, lvl: 4, tip: "BOOM! one use" },
    magnet: { name: "Magnet Bookmark", emoji: "🧲", cost: 125, hp: 80, strip: true, stripCd: 7, lvl: 4, tip: "steals helmets" },
    spell: { name: "Spell Book", emoji: "📜", cost: 200, hp: 90, dmg: 11, cd: 1.1, pierce: true, word: true, lvl: 5, tip: "word-powered beam" },
    lamp: { name: "Lamp Novel", emoji: "💡", cost: 75, hp: 80, light: true, lvl: 11, tip: "lights the dark" }
  };
  var ZOMBIES = {
    basic: { name: "Scroller", emoji: "🧟", hp: 60, speed: 10, dps: 13 },
    speedy: { name: "Speed-Scroller", emoji: "🧟‍♀️", hp: 42, speed: 17, dps: 12 },
    bucket: { name: "Helmet Head", emoji: "🪖", hp: 175, speed: 8.5, dps: 14, armored: true },
    shield: { name: "Tablet Shield", emoji: "🛡️", hp: 260, speed: 7.5, dps: 15, armored: true },
    scooter: { name: "Scooter Scroller", emoji: "🛴", hp: 35, speed: 26, dps: 0, crash: 60 },
    balloon: { name: "Balloon Scroller", emoji: "🎈", hp: 50, speed: 12, dps: 12, fly: true },
    couch: { name: "Couch Potato", emoji: "🛋️", hp: 140, speed: 6, dps: 10, ranged: true },
    splitter: { name: "Bot Splitter", emoji: "🤖", hp: 90, speed: 11, dps: 12, split: true },
    mini: { name: "Mini Bot", emoji: "🤖", hp: 25, speed: 15, dps: 8, small: true },
    miniboss: { name: "SIR HELMET", emoji: "🪖", hp: 420, speed: 6.5, dps: 22, big: true, armored: true },
    boss: { name: "THE DOOMSCROLLER", emoji: "📺", hp: 1100, speed: 5.5, dps: 45, big: true },
    gloweyes: { name: "Glow-Eyes", emoji: "👀", hp: 70, speed: 12, dps: 14, darkling: true },
    pajama: { name: "Pajama Sprinter", emoji: "🥱", hp: 45, speed: 22, dps: 10 },
    sleepgiant: { name: "Sleepwalker Giant", emoji: "😴", hp: 520, speed: 4.5, dps: 30, big: true, naps: true },
    king: { name: "THE NOTIFICATION KING", emoji: "📵", hp: 1400, speed: 5, dps: 50, big: true, wordShield: true }
  };
  // level design: which rows are open, the spawn timeline, and what unlocks
  function levelPlan(n) {
    function wave(t, type, row) { return { t: t, type: type, row: row }; }
    var L = { rows: [1, 2, 3], spawns: [], intro: "", unlock: [] };
    var R = function (rows) { return rows[Math.floor(Math.random() * rows.length)]; };
    if (n === 1) {
      L.rows = [1, 2, 3]; L.intro = "The Brain-Rot zombies found the library… Defend it with BOOKS!";
      L.unlock = ["blaster", "dict"];
      [14, 28, 40, 50, 60, 68, 76, 84].forEach(function (t) { L.spawns.push(wave(t, "basic", R(L.rows))); });
    } else if (n === 2) {
      L.rows = [0, 1, 2, 3, 4]; L.intro = "All five reading rooms are open — and the zombies got FASTER.";
      L.unlock = ["wall"];
      [12, 22, 32, 42, 50, 58, 66, 74, 82, 90, 98, 104].forEach(function (t, i) { L.spawns.push(wave(t, i % 3 === 2 ? "speedy" : "basic", R(L.rows))); });
    } else if (n === 3) {
      L.rows = [0, 1, 2, 3, 4]; L.intro = "Helmet Heads and Scooters! Freeze them — and meet the 🖍️ Catapult.";
      L.unlock = ["freeze", "catapult"];
      [10, 20, 30, 40, 48, 56, 64, 72, 80, 88].forEach(function (t, i) { L.spawns.push(wave(t, i % 4 === 3 ? "bucket" : i % 3 === 2 ? "speedy" : "basic", R(L.rows))); });
      [58, 84].forEach(function (t) { L.spawns.push(wave(t, "scooter", R(L.rows))); });
      [104, 104, 106, 108].forEach(function (t) { L.spawns.push(wave(t, "basic", R(L.rows))); });
      L.spawns.push(wave(112, "miniboss", 2));
      L.huge = [102];
    } else if (n === 4) {
      L.rows = [0, 1, 2, 3, 4]; L.intro = "Tablet Shields and Balloons! The 🧲 Magnet steals their armor…";
      L.unlock = ["bomb", "magnet"];
      [10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98].forEach(function (t, i) { L.spawns.push(wave(t, i % 5 === 4 ? "shield" : i % 4 === 3 ? "bucket" : i % 3 === 2 ? "speedy" : "basic", R(L.rows))); });
      [45, 70].forEach(function (t) { L.spawns.push(wave(t, "balloon", R(L.rows))); });
      L.spawns.push(wave(88, "couch", R(L.rows)));
      [112, 112, 114, 114, 116, 118].forEach(function (t, i) { L.spawns.push(wave(t, i % 2 ? "bucket" : "basic", R(L.rows))); });
      L.spawns.push(wave(122, "miniboss", 1));
      L.huge = [110];
    } else {
      L.rows = [0, 1, 2, 3, 4]; L.intro = "THE DOOMSCROLLER is here. Place the 📜 Spell Book — words beat screens!";
      L.unlock = ["spell"];
      [10, 18, 26, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 94].forEach(function (t, i) { L.spawns.push(wave(t, ["basic", "speedy", "bucket", "shield"][i % 4], R(L.rows))); });
      [50, 72].forEach(function (t) { L.spawns.push(wave(t, "splitter", R(L.rows))); });
      L.spawns.push(wave(85, "balloon", R(L.rows)));
      L.spawns.push(wave(98, "couch", R(L.rows)));
      L.spawns.push(wave(108, "boss", 2));
      [116, 118, 120, 122].forEach(function (t, i) { L.spawns.push(wave(t, i % 2 ? "speedy" : "bucket", R(L.rows))); });
      L.huge = [106];
    }
    L.spawns.sort(function (a, b) { return a.t - b.t; });
    return L;
  }
  // 🌃 CHAPTER 2 — NIGHT SHIFT (levels 11-15): the library after dark.
  // Zombies move FASTER in darkness; 💡 Lamp Novels carve pools of light.
  function nightPlan(n) {
    function wave(t, type, row) { return { t: t, type: type, row: row }; }
    var L = { rows: [0, 1, 2, 3, 4], spawns: [], intro: "", unlock: [], dark: true };
    var R = function (rows) { return rows[Math.floor(Math.random() * rows.length)]; };
    if (n === 11) {
      L.rows = [1, 2, 3]; L.intro = "🌃 NIGHT SHIFT. The lights are out — zombies are FASTER in the dark. Plant 💡 Lamp Novels!";
      L.unlock = ["lamp"];
      [16, 30, 42, 54, 64, 74, 84, 92].forEach(function (t, i) { L.spawns.push(wave(t, i % 3 === 2 ? "gloweyes" : "basic", R(L.rows))); });
    } else if (n === 12) {
      L.intro = "Pajama Sprinters! They sleep-run straight at your shelves.";
      [12, 24, 34, 44, 52, 60, 68, 76, 84, 92, 100].forEach(function (t, i) { L.spawns.push(wave(t, i % 4 === 3 ? "pajama" : i % 3 === 2 ? "gloweyes" : "basic", R(L.rows))); });
    } else if (n === 13) {
      L.intro = "Keep the lights ON — Glow-Eyes shrug off hits in darkness.";
      [10, 20, 30, 40, 48, 56, 64, 72, 80, 88, 96].forEach(function (t, i) { L.spawns.push(wave(t, i % 4 === 3 ? "bucket" : i % 3 === 2 ? "gloweyes" : i % 2 ? "pajama" : "basic", R(L.rows))); });
      L.spawns.push(wave(108, "sleepgiant", 2));
      L.huge = [104];
    } else if (n === 14) {
      L.intro = "Two Sleepwalker Giants tonight. Try not to wake them. (You will.)";
      [10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98].forEach(function (t, i) { L.spawns.push(wave(t, ["basic", "pajama", "gloweyes", "shield"][i % 4], R(L.rows))); });
      L.spawns.push(wave(106, "sleepgiant", 1));
      L.spawns.push(wave(112, "sleepgiant", 3));
      L.huge = [102];
    } else {
      L.intro = "📵 THE NOTIFICATION KING. His shield breaks ONLY for a word — TAP HIM and answer!";
      [10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98].forEach(function (t, i) { L.spawns.push(wave(t, ["gloweyes", "pajama", "bucket", "splitter"][i % 4], R(L.rows))); });
      L.spawns.push(wave(110, "king", 2));
      [118, 120, 122].forEach(function (t, i) { L.spawns.push(wave(t, i % 2 ? "pajama" : "gloweyes", R(L.rows))); });
      L.huge = [107];
    }
    L.spawns.sort(function (a, b) { return a.t - b.t; });
    return L;
  }
  // 🌙 Midnight Library: endless survival — waves forever, faster and meaner
  function endlessPlan() {
    return { rows: [0, 1, 2, 3, 4], spawns: [], endless: true, unlock: [], intro: "Survive as long as you can. The horde never ends…" };
  }
  // 📖 Almanac bios — silly, collectible, and each hides a Secret Word quiz
  var BIOS = {
    "b:blaster": "Fires the alphabet at 300 letters per minute. Hates the letter Q (too fancy).",
    "b:dict": "Knows every word ever. Drips ink when it feels appreciated.",
    "b:wall": "A 4,000-page encyclopedia set. Zombies chip a tooth on volume K.",
    "b:freeze": "Lists 41 words for cold. Reading it gives zombies brain-freeze.",
    "b:catapult": "Launches jumbo crayons. The red ones somehow hurt the most.",
    "b:bomb": "One typo and BOOM. Grammar is serious business.",
    "b:magnet": "Collects helmets, tablets, and loose change. Mostly helmets.",
    "b:spell": "Speaks words so powerful the lane lights up. Handle with care.",
    "z:basic": "Walked into the library by accident. Still scrolling.",
    "z:speedy": "Late for nothing, hurrying anyway. Battery at 3 percent.",
    "z:bucket": "Wears a helmet because books keep hitting him. Smart, honestly.",
    "z:shield": "Uses a tablet as a shield. The screen is cracked. He does not care.",
    "z:scooter": "Doom-scrolls WHILE scooting. A menace to shelves everywhere.",
    "z:balloon": "Floats over walls, holding a balloon and 19 unread group chats.",
    "z:couch": "Brought his own couch. Throws pillows. Zero steps today.",
    "z:splitter": "A robot that multitasks so hard it becomes two robots.",
    "z:mini": "Half a robot. Twice the attitude.",
    "z:miniboss": "SIR HELMET took knighthood classes online. Certificate pending.",
    "z:boss": "THE DOOMSCROLLER. He IS the algorithm. Beat him with words.",
    "b:lamp": "A cozy novel so warm it literally glows. Zombies hate a good reading lamp.",
    "z:gloweyes": "Sees perfectly in the dark. Books hit him softer in shadow — keep him lit!",
    "z:pajama": "Sleep-runs at full speed. Do not ask about the bunny slippers.",
    "z:sleepgiant": "Naps mid-invasion. The snoring knocks books off shelves.",
    "z:king": "📵 THE NOTIFICATION KING. His shield of unread alerts breaks only for a WORD."
  };
  // 🏭 Bindery upgrades — bought with 📜 Pages (earned from stars & the Almanac)
  var UPG = {
    blaster: [{ t: "+2 letter dmg", d: { dmg: 2 } }, { t: "+2 more", d: { dmg: 2 } }],
    dict: [{ t: "+8 ink per drip", d: { drip: 8 } }, { t: "drips faster", d: { dripCd: -1.7 } }],
    wall: [{ t: "+120 hp", d: { hp: 120 } }, { t: "+140 hp", d: { hp: 140 } }],
    freeze: [{ t: "+2 dmg", d: { dmg: 2 } }, { t: "+2 more", d: { dmg: 2 } }],
    catapult: [{ t: "+5 splash dmg", d: { dmg: 5 } }, { t: "+4 more", d: { dmg: 4 } }],
    bomb: [{ t: "bigger boom", d: { boomR: 0.5 } }, { t: "HUGE boom", d: { boomR: 0.6 } }],
    magnet: [{ t: "steals 2s faster", d: { stripCd: -2 } }, { t: "2s faster still", d: { stripCd: -2 } }],
    spell: [{ t: "+3 beam dmg", d: { dmg: 3 } }, { t: "+3 more", d: { dmg: 3 } }]
  };
  var UPG_COST = [3, 6];

  // 🌙 LIBRARIAN BLESSINGS — roguelite perks offered every 10 endless waves
  var BLESS = [
    { id: "sharp", name: "Sharpened Letters", emoji: "📕", t: "all book damage +25%" },
    { id: "golden", name: "Golden Ink", emoji: "💧", t: "ink drops worth 30 (double)" },
    { id: "bargain", name: "Bargain Bindery", emoji: "🏷", t: "books cost 20% less" },
    { id: "storm", name: "Ink Storm", emoji: "🖋", t: "dictionaries drip 50% faster" },
    { id: "frost", name: "Night Frost", emoji: "❄️", t: "new zombies arrive chilled" },
    { id: "restock", name: "Cart Restock", emoji: "🛒", t: "all used book carts RETURN" },
    { id: "surge", name: "Word Surge", emoji: "⚡", t: "+2 Power Words right now" },
    { id: "wide", name: "Wide Crayons", emoji: "🖍", t: "splash area +50%" }
  ];

  // 📗 Normal / 📙 Hard / 📕 NIGHTMARE — Nightmare is tuned to beat GROWN-UPS
  var TIERS = {
    1: { name: "Normal", emoji: "📗", hpMul: 1, spdMul: 1, dropEvery: 9, extra: 0, inkStart: 75, gemMul: 1 },
    2: { name: "Hard", emoji: "📙", hpMul: 1.25, spdMul: 1.12, dropEvery: 12, extra: 0.35, inkStart: 65, gemMul: 2 },
    3: { name: "NIGHTMARE", emoji: "📕", hpMul: 1.5, spdMul: 1.28, dropEvery: 16, extra: 0.85, inkStart: 50, gemMul: 3 }
  };
  function applyTier(L, tier, n) {
    var T = TIERS[tier];
    if (T.extra > 0) { // extra spawns woven between the originals, armored bias
      var extras = [];
      L.spawns.forEach(function (s, i) {
        if ((i % Math.max(1, Math.round(1 / T.extra))) === 0) {
          var kind = tier === 3 && i % 3 === 0 ? (n >= 3 ? "bucket" : "speedy") : s.type;
          extras.push({ t: s.t + 1.5, type: kind, row: s.row });
        }
      });
      L.spawns = L.spawns.concat(extras);
      L.spawns.sort(function (a, b) { return a.t - b.t; });
    }
    if (tier === 3) { // nightmare: a miniboss crashes EVERY level's finale
      var lastT = L.spawns.length ? L.spawns[L.spawns.length - 1].t : 60;
      L.spawns.push({ t: lastT + 6, type: "miniboss", row: 2 });
    }
    return L;
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("books");
    if (!stats.lvl) stats.lvl = 1; // highest unlocked level (stats.best is the platform BEST SCORE - do not collide)
    stats.pages = stats.pages || 0; stats.seen = stats.seen || {}; stats.up = stats.up || {}; stats.quizDone = stats.quizDone || {};
    // a book's REAL stats = base + Bindery upgrades
    function bdef(k) {
      var base = BOOKS[k], lv = stats.up[k] || 0, out = {};
      for (var f in base) out[f] = base[f];
      for (var i = 0; i < lv && UPG[k]; i++) { var dd2 = (UPG[k][i] || {}).d || {}; for (var f2 in dd2) out[f2] = (out[f2] || 0) + dd2[f2]; }
      return out;
    }
    var wrap = document.createElement("div"); wrap.className = "gamewrap books";
    wrap.innerHTML =
      '<canvas id="bkcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="bkmsg">📚 Books vs Zombies</div>' +
      '<div class="grow"><span id="bkink">🖋 0</span><span id="bkwave"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="bkbig"></div>' +
      '<div class="gover" id="bkq" style="display:none"></div>' +
      '<div class="gover" id="bkend" style="display:none"></div>' +
      '<div id="bkbar"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#bkcv"), ctx = cv.getContext("2d");
    var W, H, S, OX, OY, compact = false, vertical = false;
    // responsive grid metrics. TWO orientations, ONE logic space:
    //  - landscape: lanes run left→right (zombies walk left), classic PvZ
    //  - portrait ("vertical"): the battlefield TRANSPOSES — lanes are columns,
    //    zombies descend from the top, carts guard the bottom. Same logic,
    //    different screen mapping (X/Y below). No more rotate-your-phone gate.
    var MWv = MW, GXv = 118, GYv = 96, CWv = 92, CHv = 88, SPD = 1;
    function resize() {
      W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight;
      vertical = H > W;
      compact = Math.min(W, H) < 520 || Math.max(W, H) < 900;
      wrap.classList.toggle("compact", compact);
      var rowsN = (compact && plan) ? Math.max(3, plan.rows.length) : ROWS;
      GYv = compact ? 10 : (vertical ? 14 : 96);
      CHv = (MH - GYv - 8) / rowsN;
      if (vertical) {
        // lanes across the WIDTH, depth down the HEIGHT
        var reserveV = compact ? 96 : 140;
        S = (W - 8) / MH;
        MWv = Math.max(760, Math.floor((H - reserveV) / S) - 4);
        GXv = 54;
        OX = Math.max(0, (W - MH * S) / 2);
        OY = 44;
      } else {
        var reserve = compact ? 86 : 132;
        S = (H - reserve) / MH;
        if (!compact) S = Math.min(S, W / MW);
        MWv = Math.max(MW, Math.floor(W / S) - 4);
        GXv = compact ? 66 : 118;
        OX = Math.max(0, (W - MWv * S) / 2);
        OY = compact ? 40 : Math.max(36, (H - reserve - MH * S) / 2 + 36);
      }
      CWv = (MWv - GXv - 16) / COLS;
      SPD = CWv / 92; // crossing-time balance no matter the tile size
    }
    resize(); window.addEventListener("resize", resize);
    // point transform: logical (x = depth toward the books, y = lane position)
    function X(x, y) { return vertical ? OX + y * S : OX + x * S; }
    function Y(x, y) { return vertical ? OY + (MWv - x) * S : OY + y * S; }
    function pz(n) { return n * S; }
    function tileX(c) { return GXv + c * CWv + CWv / 2; }
    function tileY(r) {
      var vr = r;
      if (compact && plan) { vr = plan.rows.indexOf(r); if (vr < 0) vr = r; }
      return GYv + vr * CHv + CHv / 2;
    }

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var running = true, raf = 0, lastT = performance.now();
    var level = 0, plan = null, run = 0, ink = 0, over = false, paused = false, endShown = false;
    var plants = [], zombies = [], shots = [], carts = [], spawnIdx = 0, hugeShown = {};
    var selected = null, rushCd = 0, lastFmt = null, kills = 0, rushes = 0;
    var drops = [], dropT = 9, pw = 0, pwUsed = 0, zshots = [], endT = 6, endWave = 0;
    var tier = 1, adaptT = 20, banked = false, adaptWarned = false;
    var mods = null, milestones = 0;
    function freshMods() { return { dmgMul: 1, dropVal: 15, costMul: 1, dripMul: 1, spawnChill: 0, splashMul: 1, blessed: [] }; }

    var msgEl = document.getElementById("bkmsg"), bigEl = document.getElementById("bkbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1300); }
    function hud() {
      document.getElementById("bkink").textContent = "🖋 " + ink + (pw > 0 ? "  ⚡" + pw : "");
      var total = plan ? plan.spawns.length : 0;
      document.getElementById("bkwave").textContent = plan ? "🧟 " + Math.min(spawnIdx, total) + "/" + total : "";
    }

    // ---------- level select / flow ----------
    function showSelect() {
      level = 0; plan = null; paused = true;
      var end = document.getElementById("bkend");
      var stT = stats.starsT || {};
      function starTotal(n) { return (stT[n + ":1"] || stats.stars && stats.stars[n] || 0) + (stT[n + ":2"] || 0) + (stT[n + ":3"] || 0); }
      var rows = [1, 2, 3, 4, 5].map(function (n) {
        var open = n <= stats.lvl;
        var sn = starTotal(n);
        var td = (stats.tierDone || {})[n] || 0;
        var tierIcons = td >= 3 ? "📗📙📕" : td === 2 ? "📗📙" : td === 1 ? "📗" : "";
        var starTxt = sn > 0 ? "⭐" + sn + "/9 " : (open ? "▶ " : "🔒 ");
        return '<button class="embtn" style="min-width:118px' + (open ? "" : ";opacity:.45") + '" data-lv="' + n + '">' +
          '<span class="ebl">' + starTxt + "Lv " + n + " " + tierIcons + "</span>" +
          '<span class="ebs">' + ["First Shelf", "Five Rooms", "Helmet Heads", "Tablet Shields", "THE BOSS"][n - 1] + "</span></button>";
      }).join("");
      var lvl2 = stats.lvl2 || 11;
      var nightRows = !stats.beatBoss ? '<div style="font-size:12px;color:#8a98a8;margin:6px 0">🌃 Chapter 2: Night Shift — beat THE BOSS to enter the dark…</div>' :
        '<div style="margin:6px 0 2px;font-weight:900;color:#6a5ac0">🌃 Chapter 2: NIGHT SHIFT</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
        [11, 12, 13, 14, 15].map(function (n) {
          var open = n <= lvl2;
          var sn = starTotal(n);
          var td = (stats.tierDone || {})[n] || 0;
          var tierIcons = td >= 3 ? "📗📙📕" : td === 2 ? "📗📙" : td === 1 ? "📗" : "";
          var starTxt = sn > 0 ? "⭐" + sn + "/9 " : (open ? "▶ " : "🔒 ");
          return '<button class="embtn" style="min-width:118px;background:#2b2440;color:#e8e2ff' + (open ? "" : ";opacity:.45") + '" data-nlv="' + n + '">' +
            '<span class="ebl">' + starTxt + "Night " + (n - 10) + " " + tierIcons + "</span>" +
            '<span class="ebs" style="color:#b0a8d8">' + ["Lights Out", "Pajama Party", "Glow-Eyes", "Sleepwalkers", "THE KING"][n - 11] + "</span></button>";
        }).join("") + "</div>";
      var endlessBtn = nightRows + '<button class="embtn study" style="min-width:150px' + (stats.beatBoss ? "" : ";opacity:.45") + '" id="bk_endless">' +
        '<span class="ebl">🌙 Midnight Library</span><span class="ebs">' + (stats.beatBoss ? ("endless! best: wave " + (stats.endlessBest || 0)) : "beat THE BOSS to unlock") + "</span></button>" +
        '<button class="embtn" style="min-width:110px" id="bk_almanac"><span class="ebl">📖 Almanac</span><span class="ebs">' + Object.keys(stats.seen).length + "/" + (Object.keys(BOOKS).length + Object.keys(ZOMBIES).length) + ' found</span></button>' +
        '<button class="embtn" style="min-width:110px" id="bk_bindery"><span class="ebl">🏭 Bindery</span><span class="ebs">📜 ' + (stats.pages || 0) + " Pages</span></button>";
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:580px"><div style="font-size:40px">📚🧟</div>' +
        '<div class="wqtitle" style="font-size:20px">Books vs Zombies</div>' +
        '<div style="margin:4px 0 10px;color:#5a6b7a;font-weight:bold">The Brain-Rot horde is at the doors. Knowledge is the only weapon.</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + rows + endlessBtn + "</div>" +
        '<div style="font-size:11px;color:#8a98a8;margin-top:8px">⭐ per level: win · keep all carts · use 2+ ⚡ Power Words</div></div>';
      end.style.display = "flex";
      Array.prototype.forEach.call(end.querySelectorAll("[data-lv]"), function (b) {
        b.onclick = function () {
          var n = +b.dataset.lv;
          if (n > stats.lvl) { big("🔒 Beat Level " + (n - 1) + " first!", "#ffd740"); return; }
          if (((stats.tierDone || {})[n] || 0) >= 1) showTierPick(n); else beginLevel(n, 1);
        };
      });
      var eb = document.getElementById("bk_endless");
      if (eb) eb.onclick = function () { if (stats.beatBoss) beginLevel(6); else big("🔒 Beat THE BOSS first!", "#ffd740"); };
      var ab = document.getElementById("bk_almanac"); if (ab) ab.onclick = showAlmanac;
      var bb = document.getElementById("bk_bindery"); if (bb) bb.onclick = showBindery;
      Array.prototype.forEach.call(end.querySelectorAll("[data-nlv]"), function (b) {
        b.onclick = function () {
          var n = +b.dataset.nlv;
          if (n > (stats.lvl2 || 11)) { big("🔒 Beat Night " + (n - 11) + " first!", "#ffd740"); return; }
          if (((stats.tierDone || {})[n] || 0) >= 1) showTierPick(n); else beginLevel(n, 1);
        };
      });
    }
    // 📖 THE ALMANAC — every book & zombie, silly bios, and a Secret Word quiz each
    function showAlmanac() {
      var end = document.getElementById("bkend");
      function entryChip(key, emoji, name) {
        var seen = !!stats.seen[key];
        return '<button class="lchip" style="font-size:13px' + (seen ? "" : ";opacity:.5") + '" data-alm="' + key + '">' +
          (seen ? emoji + " " + name + (stats.quizDone[key] ? " ✓" : " 📖") : "❓ ???") + "</button>";
      }
      var bookChips = Object.keys(BOOKS).map(function (k) { return entryChip("b:" + k, BOOKS[k].emoji, BOOKS[k].name); }).join("");
      var zChips = Object.keys(ZOMBIES).map(function (k) { return entryChip("z:" + k, ZOMBIES[k].emoji, ZOMBIES[k].name); }).join("");
      var total = Object.keys(BOOKS).length + Object.keys(ZOMBIES).length;
      var found = Object.keys(stats.seen).length;
      end.innerHTML = '<div class="wqcard" style="max-height:82vh;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y">' +
        '<div class="wqtitle">📖 The Almanac — ' + found + "/" + total + ' discovered</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:4px">Tap an entry · 📖 = its Secret Word quiz still pays +5 Vobux & +1 📜</div>' +
        '<h4 style="margin:6px 0 2px">Your Books</h4><div class="lchips">' + bookChips + "</div>" +
        '<h4 style="margin:8px 0 2px">The Brain-Rot Horde</h4><div class="lchips">' + zChips + "</div>" +
        '<button class="wqskip" id="alm_back" type="button">back</button></div>';
      end.style.display = "flex";
      document.getElementById("alm_back").onclick = showSelect;
      Array.prototype.forEach.call(end.querySelectorAll("[data-alm]"), function (b) {
        b.onclick = function () { if (stats.seen[b.dataset.alm]) showAlmEntry(b.dataset.alm); else big("Find it in battle first!", "#ffd740"); };
      });
    }
    function showAlmEntry(key) {
      var isBook = key.indexOf("b:") === 0, id = key.slice(2);
      var d = isBook ? BOOKS[id] : ZOMBIES[id];
      var statLine = isBook
        ? (d.dmg ? "dmg " + bdef(id).dmg : d.drip ? "+" + bdef(id).drip + " ink/" + bdef(id).dripCd + "s" : d.hp >= 300 ? "hp " + bdef(id).hp : "special") + " · cost " + d.cost
        : "hp " + d.hp + " · speed " + d.speed + (d.dps ? " · bite " + d.dps : "");
      var end = document.getElementById("bkend");
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:52px">' + d.emoji + '</div>' +
        '<div class="wqtitle">' + d.name + '</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin:2px 0">' + statLine + '</div>' +
        '<div style="margin:8px 0;font-style:italic">“' + (BIOS[key] || "A mysterious figure of the library.") + '”</div>' +
        (stats.quizDone[key] ? '<div style="color:#2f9e44;font-weight:900">✓ Secret Word solved</div>'
          : '<button class="submit" id="alm_quiz" type="button">🔎 Secret Word quiz (+5 Vobux, +1 📜)</button>') +
        '<br><button class="wqskip" id="alm_back2" type="button">back</button></div>';
      end.style.display = "flex";
      document.getElementById("alm_back2").onclick = showAlmanac;
      var qb = document.getElementById("alm_quiz");
      if (qb) qb.onclick = function () { almanacQuiz(key); };
    }
    function almanacQuiz(key) {
      cv._lastQ = VQ.miniQuiz(document.getElementById("bkq"), words, store, {
        title: "🔎 Secret Word of " + (key.indexOf("b:") === 0 ? BOOKS[key.slice(2)].name : ZOMBIES[key.slice(2)].name) + "!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) {
            stats.quizDone[key] = 1;
            stats.pages = (stats.pages || 0) + 1;
            store.state.gems += 5;
            store.save();
            big("🔎 Secret solved! +5 Vobux, +1 📜", "#69f0ae");
          }
          showAlmEntry(key);
        }
      });
    }
    // 🏭 THE BINDERY — permanent book upgrades, paid in 📜 Pages
    function showBindery() {
      var end = document.getElementById("bkend");
      var rows = Object.keys(BOOKS).map(function (k) {
        var lv = stats.up[k] || 0;
        var next = UPG[k] && UPG[k][lv];
        var pips = "●".repeat(lv) + "○".repeat(2 - lv);
        return '<div style="display:flex;align-items:center;gap:8px;background:#f4f8fc;border-radius:10px;padding:6px 10px;margin:4px 0">' +
          '<span style="font-size:22px">' + BOOKS[k].emoji + '</span>' +
          '<div style="flex:1;text-align:left"><b style="font-size:13px">' + BOOKS[k].name + " " + pips + "</b>" +
          '<div style="font-size:11px;color:#5a6b7a">' + (next ? "next: " + next.t : "fully bound!") + "</div></div>" +
          (next ? '<button class="submit" style="padding:5px 10px;font-size:13px" data-up="' + k + '">' + UPG_COST[lv] + " 📜</button>" : '<span style="color:#2f9e44;font-weight:900">MAX</span>') + "</div>";
      }).join("");
      end.innerHTML = '<div class="wqcard" style="max-height:82vh;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y">' +
        '<div class="wqtitle">🏭 The Bindery — 📜 ' + (stats.pages || 0) + ' Pages</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:4px">Earn Pages from NEW stars, tier clears, and Almanac secrets. Upgrades are forever.</div>' +
        rows + '<button class="wqskip" id="bind_back" type="button">back</button></div>';
      end.style.display = "flex";
      document.getElementById("bind_back").onclick = showSelect;
      Array.prototype.forEach.call(end.querySelectorAll("[data-up]"), function (b) {
        b.onclick = function () {
          var k = b.dataset.up, lv = stats.up[k] || 0, cost = UPG_COST[lv];
          if ((stats.pages || 0) < cost) { big("Not enough 📜 Pages — earn stars & Almanac secrets!", "#ffd740"); return; }
          stats.pages -= cost;
          stats.up[k] = lv + 1;
          store.save();
          big("🏭 " + BOOKS[k].name + " upgraded: " + UPG[k][lv].t + "!", "#9be15d");
          if (sfx && sfx.fanfare) sfx.fanfare();
          showBindery();
        };
      });
    }
    // once a level is beaten, replay it HARDER — Nightmare is tuned to beat grown-ups
    function showTierPick(n) {
      var end = document.getElementById("bkend");
      var td = (stats.tierDone || {})[n] || 0;
      var stT2 = stats.starsT || {};
      var btns = [1, 2, 3].map(function (tr) {
        var T = TIERS[tr];
        var open = tr === 1 || td >= tr - 1;
        var sn = stT2[n + ":" + tr] || (tr === 1 ? (stats.stars && stats.stars[n]) || 0 : 0);
        return '<button class="embtn' + (tr === 3 ? " mode" : "") + '" style="min-width:128px' + (open ? "" : ";opacity:.45") + '" data-tr="' + tr + '">' +
          '<span class="ebl">' + T.emoji + " " + T.name + '</span>' +
          '<span class="ebs">' + (open ? ("⭐" + sn + "/3 · pays ×" + T.gemMul) : ("beat " + TIERS[tr - 1].name + " first")) + "</span></button>";
      }).join("");
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div class="wqtitle" style="font-size:19px">' + (n >= 11 ? "Night " + (n - 10) : "Level " + n) + " — pick your pain</div>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0">' + btns + "</div>" +
        '<button class="wqskip" id="tp_back" type="button">back</button></div>';
      end.style.display = "flex";
      Array.prototype.forEach.call(end.querySelectorAll("[data-tr]"), function (b) {
        b.onclick = function () {
          var tr = +b.dataset.tr;
          if (tr > 1 && td < tr - 1) { big("🔒 Beat " + TIERS[tr - 1].name + " first!", "#ffd740"); return; }
          beginLevel(n, tr);
        };
      });
      document.getElementById("tp_back").onclick = showSelect;
    }
    function beginLevel(n, tierN) {
      level = n; tier = tierN || 1;
      var T = TIERS[tier];
      plan = n === 6 ? endlessPlan() : applyTier(n >= 11 ? nightPlan(n) : levelPlan(n), tier, n);
      run = 0; ink = n === 6 ? 150 : (n >= 11 ? T.inkStart + 25 : T.inkStart); spawnIdx = 0; hugeShown = {}; kills = 0; rushes = 0;
      plants = []; zombies = []; shots = []; zshots = []; drops = []; selected = null; rushCd = 0; over = false; endShown = false;
      pw = 0; pwUsed = 0; dropT = T.dropEvery; endT = 8; endWave = 0; adaptT = 20; banked = false;
      mods = freshMods(); milestones = 0;
      for (var r = 0; r < ROWS; r++) { plants.push([null, null, null, null, null, null, null, null, null]); }
      carts = plan.rows.map(function (r) { return { row: r, used: false, x: GXv - 52, rolling: false }; });
      resize(); // row metrics depend on how many lanes this level opens
      document.getElementById("bkend").style.display = "none";
      paused = false;
      msgEl.innerHTML = plan.dark ? "🌃 <b>Night " + (n - 10) + "</b>" : "📚 <b>" + (n === 6 ? "Midnight Library" : "Level " + n) + "</b>";
      big("📖 " + plan.intro, "#ffe14d");
      renderBar(); hud();
    }
    // one banking path for EVERYTHING: level ends, endless falls, mid-run exits,
    // even closing the app. Rewards are computed once and SHOWN (Au: Leo saw no
    // Vobux — they were partly invisible, partly lost on tab-close).
    function runRewards(won) {
      var endless = plan && plan.endless;
      var T = TIERS[tier] || TIERS[1];
      var studyBonus = rushes * 3; // studying always pays extra at the end
      var gems = studyBonus + (won ? (10 + level * 5) * T.gemMul : (endless ? Math.min(90, 3 + endWave + milestones * 5) : 5));
      return {
        win: !!won,
        score: kills * 4 + rushes * 10 + (endless ? endWave * 8 : level * 20 * tier),
        rankPtsDelta: won ? Math.min(12, 3 + level * 2 + (tier - 1) * 2) : (endless ? Math.min(8, 1 + Math.floor(endWave / 4)) : 2),
        xp: Math.min(80, 8 + kills * 2 + rushes * 5 + (won ? level * 6 * tier : 0)),
        gems: gems, studyBonus: studyBonus
      };
    }
    function bankRun(won) {
      if (banked) return null;
      banked = true;
      var rw = runRewards(won);
      var res = store.recordGame ? store.recordGame("books", rw) : null;
      return { rw: rw, res: res };
    }
    function endLevel(won) {
      if (over) return; over = true; paused = true;
      var endless = plan && plan.endless;
      var bank = bankRun(won) || { rw: runRewards(won), res: null };
      var rw = bank.rw, res = bank.res;
      if (won && level >= stats.lvl && level < 5) { stats.lvl = level + 1; store.save(); }
      if (won && level === 5) { stats.beatBoss = true; store.save(); }
      // 🌃 Chapter 2 chain
      if (won && level >= 11 && level <= 14 && level + 1 > (stats.lvl2 || 11)) { stats.lvl2 = level + 1; store.save(); }
      if (won && level === 15) { stats.beatBoss2 = true; store.save(); }
      // ⭐ per-tier star challenges: win / keep every book cart / unleash 2+ Power Words
      var earned = 0, newPages = 0;
      if (won && !endless) {
        earned = 1 + (carts.every(function (ct) { return !ct.used && !ct.rolling; }) ? 1 : 0) + (pwUsed >= 2 ? 1 : 0);
        stats.starsT = stats.starsT || {};
        var key = level + ":" + tier;
        var prevStars = stats.starsT[key] || 0;
        if (earned > prevStars) { stats.starsT[key] = earned; newPages += earned - prevStars; } // 📜 1 Page per NEW star
        stats.tierDone = stats.tierDone || {};
        if (tier > (stats.tierDone[level] || 0)) { stats.tierDone[level] = tier; newPages += 2; } // first tier clear
        // legacy field keeps old saves meaningful
        stats.stars = stats.stars || {};
        if (tier === 1 && earned > (stats.stars[level] || 0)) stats.stars[level] = earned;
        if (newPages > 0) stats.pages = (stats.pages || 0) + newPages;
        store.save();
      }
      if (endless && endWave > (stats.endlessBest || 0)) { stats.endlessBest = endWave; store.save(); }
      var T = TIERS[tier] || TIERS[1];
      var end = document.getElementById("bkend");
      var lvName = level >= 11 ? "Night " + (level - 10) : "Level " + level;
      var title = endless ? "🌙 The library fell on wave " + endWave + (endWave >= (stats.endlessBest || 0) ? " — NEW RECORD!" : "!") :
        won ? (level === 5 ? "THE LIBRARY IS SAVED! You beat the Doomscroller!" :
          level === 15 ? "🌅 DAWN BREAKS! The Notification King is silenced!" :
            T.emoji + " " + lvName + (tier > 1 ? " (" + T.name + ")" : "") + " cleared!") : "The zombies reached the shelves…";
      var starRow = (won && !endless) ? '<div style="font-size:26px;margin:2px 0">' + "⭐".repeat(earned) + "☆".repeat(3 - earned) + '</div>' +
        '<div style="font-size:11px;color:#5a6b7a">win · keep all carts · use 2+ ⚡ Power Words</div>' : "";
      var payRow = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP" +
        (newPages > 0 ? ' · <span style="color:#b06a00">+' + newPages + " 📜</span>" : "") +
        (rw.studyBonus ? ' <span style="color:#7a4fd0;font-size:12px">(incl. 📖 study bonus +' + rw.studyBonus + ")</span>" : "") + "</div>";
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:44px">' + (won ? "🏆" : endless ? "🌙" : "🧟") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + title + "</div>" + starRow + payRow +
        '<div style="margin:2px 0">🧟 ' + kills + " munched · 🖋 " + rushes + " ink rushes · ⚡ " + pwUsed + " power words" + (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        '<button class="submit big-next" id="bknext">' + (won && (level < 5 || (level >= 11 && level < 15)) ? "Next level ➜" : "Level select") + "</button></div>";
      end.style.display = "flex";
      if (won && sfx && sfx.fanfare) sfx.fanfare();
      if (won && juice) { juice.shake(6); for (var cf = 0; cf < 5; cf++) juice.burst(W * (0.2 + cf * 0.15), H * 0.3, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][cf], 16); }
      document.getElementById("bknext").onclick = function () {
        if (won && (level < 5 || (level >= 11 && level < 15))) beginLevel(level + 1, tier); else showSelect();
      };
    }

    // ---------- book bar ----------
    function renderBar() {
      var bar = document.getElementById("bkbar");
      if (!plan) { bar.innerHTML = ""; return; }
      var avail = Object.keys(BOOKS).filter(function (k) { return BOOKS[k].lvl <= level; });
      bar.innerHTML = avail.map(function (k) {
        var b = BOOKS[k];
        var can = ink >= b.cost;
        return '<button class="embtn' + (selected === k ? " mode" : "") + '" style="min-width:86px' + (can ? "" : ";opacity:.5") + '" data-bk="' + k + '">' +
          '<span class="ebl">' + b.emoji + " " + b.cost + '</span><span class="ebs">' + b.name + (b.word ? " 📖word" : "") + "</span></button>";
      }).join("") +
        '<button class="embtn' + (selected === "broom" ? " mode" : "") + '" id="bkbroom"><span class="ebl">🧹 Broom</span><span class="ebs">sweep a book, ½ back</span></button>' +
        '<button class="embtn study" id="bkrush"' + (rushCd > 0 ? ' style="opacity:.55"' : "") + '><span class="ebl">🖋 INK RUSH</span><span class="ebs">' + (rushCd > 0 ? Math.ceil(rushCd) + "s" : "answer = +150") + "</span></button>";
      Array.prototype.forEach.call(bar.querySelectorAll("[data-bk]"), function (b) {
        b.onclick = function () {
          var k = b.dataset.bk;
          if (ink < BOOKS[k].cost) { big("Not enough ink — 🖋 INK RUSH a word!", "#ffd740"); return; }
          selected = selected === k ? null : k;
          renderBar();
        };
      });
      var brm = document.getElementById("bkbroom");
      if (brm) brm.onclick = function () { selected = selected === "broom" ? null : "broom"; big(selected === "broom" ? "🧹 Tap a book to sweep it away (half ink back)" : "Broom away!", "#8ecdf7"); renderBar(); };
      var rush = document.getElementById("bkrush");
      if (rush) rush.onclick = inkRush;
    }
    function inkRush() {
      if (paused || over || rushCd > 0) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("bkq"), words, store, {
        title: "🖋 INK RUSH! Answer to refill your pen!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            ink += 150; rushes++;
            rushCd = Math.min(40, 10 + rushes * 5); // each rush recharges slower — no infinite faucet
            pw = Math.min(2, pw + 1); // every studied word also charges a ⚡ POWER WORD
            big("🖋 +150 INK & ⚡ POWER WORD! Tap a book to unleash it!", "#69f0ae");
            if (sfx && sfx.coin) sfx.coin();
            if (juice) juice.burst(60, 60, "#69f0ae", 14);
          } else big("The pen ran dry…", "#ff8a8a");
          hud(); renderBar();
        }
      });
    }

    // ---------- planting ----------
    function tileAt(x, y) {
      var c = Math.floor((x - GXv) / CWv), vr = Math.floor((y - GYv) / CHv);
      var r = (compact && plan) ? (plan.rows[vr] !== undefined ? plan.rows[vr] : -1) : vr;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
      return { r: r, c: c };
    }
    function place(k, r, c) {
      var def = bdef(k);
      var mcost = Math.ceil(def.cost * ((mods || {}).costMul || 1));
      stats.seen["b:" + k] = 1;
      plants[r][c] = { k: k, hp: def.hp, maxHp: def.hp, cd: 1 + Math.random(), drip: def.dripCd || 0, r: r, c: c, flash: 0 };
      ink -= mcost; selected = null;
      if (juice) juice.burst(X(tileX(c), tileY(r)), Y(tileX(c), tileY(r)), "#9be15d", 10);
      if (sfx && sfx.pop) sfx.pop();
      if (def.boom) { // Grammar Bomb: fuse then BOOM
        setTimeout(function () { explode(r, c); }, 900);
      }
      hud(); renderBar();
    }
    function tryPlace(r, c) {
      if (!selected || over || paused) return;
      if (plan.rows.indexOf(r) < 0) { big("That reading room is closed!", "#ffd740"); return; }
      if (plants[r][c]) { big("A book already lives there!", "#ffd740"); return; }
      var k = selected, def = bdef(k);
      var cost = Math.ceil(def.cost * ((mods || {}).costMul || 1));
      if (ink < cost) { big("Not enough ink!", "#ffd740"); return; }
      if (def.word) { // 📜 Spell Book: speak the word of power to place it
        paused = true;
        cv._lastQ = VQ.miniQuiz(document.getElementById("bkq"), words, store, {
          title: "📜 Speak the word to awaken the Spell Book!",
          lastFormat: lastFmt,
          cb: function (ok, res, fmt) {
            lastFmt = fmt; paused = false;
            if (ok) { place(k, r, c); big("📜 The Spell Book awakens!", "#c9b6ff"); }
            else big("The Spell Book stays asleep…", "#ff8a8a");
            renderBar();
          }
        });
        return;
      }
      place(k, r, c);
    }
    function explode(r, c) {
      plants[r][c] = null;
      for (var rr = r - 1; rr <= r + 1; rr++) for (var i = zombies.length - 1; i >= 0; i--) {
        var z = zombies[i];
        if (z.row >= r - 1 && z.row <= r + 1 && Math.abs(z.x - tileX(c)) < CWv * 1.7) hurtZ(z, 95);
      }
      if (juice) { juice.shake(10); juice.burst(X(tileX(c), tileY(r)), Y(tileX(c), tileY(r)), "#ff9f43", 24); }
      if (sfx) { sfx.tone && sfx.tone(80, 0.35, 0.09); }
    }

    // ---------- combat ----------
    function spawnZombie(type, row) {
      var def = ZOMBIES[type];
      stats.seen["z:" + type] = 1;
      var T = TIERS[tier] || TIERS[1];
      zombies.push({ type: type, row: row, x: MWv + 30, hp: Math.round(def.hp * T.hpMul), maxHp: Math.round(def.hp * T.hpMul), speed: def.speed * T.spdMul, dps: def.dps, chill: (mods || {}).spawnChill || 0, groan: Math.random() * 6 });
      if (def.big) { big("📺 " + def.name + " HAS ENTERED THE LIBRARY!", "#c9b6ff"); if (sfx && sfx.buzz) sfx.buzz(); }
      else if (sfx && sfx.buzz && Math.random() < 0.25) sfx.buzz();
    }
    // 🌃 is this spot lit? (home glow near the shelves, or a Lamp Novel's pool)
    function litAt(x, row) {
      if (!plan || !plan.dark) return true;
      if (x < GXv + CWv * 2.1) return true; // the reading nook stays cozy
      for (var c = 0; c < COLS; c++) {
        for (var r2 = Math.max(0, row - 1); r2 <= Math.min(ROWS - 1, row + 1); r2++) {
          var p = plants[r2] && plants[r2][c];
          if (p && bdef(p.k).light && Math.abs(x - tileX(c)) < CWv * 2.4) return true;
        }
      }
      return false;
    }
    function hurtZ(z, dmg) {
      var zd = ZOMBIES[z.type];
      if (zd.wordShield && z.shield) { // 📵 the King ignores damage behind his shield
        if (juice && Math.random() < 0.3) juice.text(X(z.x, tileY(z.row) - 46), Y(z.x, tileY(z.row) - 46), "🛡 WORD-LOCKED", "#c9b6ff");
        return;
      }
      if (zd.darkling && plan && plan.dark && !litAt(z.x, z.row)) dmg = Math.ceil(dmg * 0.5); // Glow-Eyes shrugs in shadow
      dmg = Math.round(dmg * ((mods || {}).dmgMul || 1)); // 🌙 Sharpened Letters
      z.hp -= dmg;
      if (juice && Math.random() < 0.4) juice.text(X(z.x, tileY(z.row) - 40), Y(z.x, tileY(z.row) - 40), "-" + dmg, "#ffd740");
      if (z.hp <= 0) {
        kills++;
        var zi = zombies.indexOf(z); if (zi >= 0) zombies.splice(zi, 1);
        if (ZOMBIES[z.type].split) { // 🤖 breaks into two angry minis
          spawnZombie("mini", z.row); zombies[zombies.length - 1].x = z.x - 14;
          spawnZombie("mini", z.row); zombies[zombies.length - 1].x = z.x + 14;
          big("🤖 IT SPLIT!", "#ffd740");
        }
        if (juice) juice.burst(X(z.x, tileY(z.row)), Y(z.x, tileY(z.row)), "#9aa86a", 12);
        if (sfx && sfx.pop && Math.random() < 0.5) sfx.pop();
        hud();
      }
    }
    function step(dt) {
      run += dt;
      rushCd = Math.max(0, rushCd - dt);
      if (Math.floor(run) !== Math.floor(run - dt) && Math.floor(run) % 3 === 0) renderBar(); // refresh cooldown/costs
      // 🌙 endless: generated waves, faster and meaner the longer you survive
      if (plan.endless) {
        endT -= dt;
        if (endT <= 0) {
          endWave++;
          endT = Math.max(3.5, 15 - run / 25);
          var pool = ["basic", "basic", "speedy"];
          if (run > 45) pool.push("bucket", "scooter");
          if (run > 90) pool.push("shield", "balloon", "splitter", "pajama");
          if (run > 150) pool.push("couch", "miniboss", "gloweyes");
          var n2 = 1 + Math.floor(run / 60);
          for (var ei = 0; ei < Math.min(4, n2); ei++) spawnZombie(pool[Math.floor(Math.random() * pool.length)], plan.rows[Math.floor(Math.random() * plan.rows.length)]);
          if (endWave % 10 === 0) offerBlessing(); // 🌙 milestone: pick a perk + bank Vobux
          else if (endWave % 5 === 0) big("🌙 Wave " + endWave + " — still standing!", "#c9b6ff");
        }
      }
      // adaptive director: cruise with a fat ink bank and the horde smells it
      if (!plan.endless) {
        adaptT -= dt;
        if (adaptT <= 0) {
          adaptT = 20;
          var cartsSafe = carts.every(function (ct) { return !ct.used && !ct.rolling; });
          if (cartsSafe && ink > 350) {
            spawnZombie(tier === 3 ? "bucket" : "basic", plan.rows[Math.floor(Math.random() * plan.rows.length)]);
            if (!adaptWarned) { adaptWarned = true; big("👃 The horde smells your ink hoard…", "#ffd740"); }
          }
        }
      }
      // 💧 ink drips from the library ceiling — tap it before it dries!
      dropT -= dt;
      if (dropT <= 0) {
        dropT = (TIERS[tier] || TIERS[1]).dropEvery + Math.random() * 5;
        var dr = plan.rows[Math.floor(Math.random() * plan.rows.length)];
        var dc = 1 + Math.floor(Math.random() * (COLS - 2));
        drops.push({ x: tileX(dc), y: tileY(dr), t: 7 });
        if (sfx && sfx.pop) sfx.pop();
      }
      for (var dd = drops.length - 1; dd >= 0; dd--) { drops[dd].t -= dt; if (drops[dd].t <= 0) drops.splice(dd, 1); }
      // spawns
      while (spawnIdx < plan.spawns.length && plan.spawns[spawnIdx].t <= run) {
        var s = plan.spawns[spawnIdx++]; spawnZombie(s.type, s.row); hud();
      }
      if (plan.huge) plan.huge.forEach(function (t) {
        if (!hugeShown[t] && run >= t) { hugeShown[t] = 1; big("🚨 A HUGE WAVE APPROACHES!", "#ff8a8a"); if (sfx && sfx.buzz) sfx.buzz(); }
      });
      // plants act
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var p = plants[r][c]; if (!p) continue;
        var def = bdef(p.k);
        p.flash = Math.max(0, p.flash - dt);
        if (def.drip) { p.drip -= dt * ((mods || {}).dripMul || 1); if (p.drip <= 0) { p.drip = def.dripCd; ink += def.drip; hud(); if (juice) juice.text(X(tileX(c), tileY(r) - 30), Y(tileX(c), tileY(r) - 30), "+" + def.drip + "🖋", "#8ecdf7"); } }
        if (def.dmg) {
          var target = null;
          // MWv, not MW: on wide phones zombies on the right third were invisible to
          // targeting (looked like walls blocked shots). Shots always pass over walls.
          for (var zi = 0; zi < zombies.length; zi++) { var z = zombies[zi]; if (z.row === r && z.x > tileX(c) - 10 && z.x < MWv + 40) { if (!target || z.x < target.x) target = z; } }
          if (target) {
            p.cd -= dt;
            if (p.cd <= 0) {
              p.cd = def.cd; p.fireK = run;
              shots.push({ x: tileX(c) + 20, y: tileY(r) - 14, row: r, dmg: def.dmg, slow: !!def.slow, pierce: !!def.pierce, lob: !!def.lob, born: run, hit: {}, ch: def.lob ? "🖍️" : String.fromCharCode(65 + Math.floor(Math.random() * 26)) });
              if (sfx && sfx.pop && Math.random() < 0.2) sfx.pop();
            }
          }
        }
        if (def.strip) { // 🧲 magnet: yanks the armor off Helmet Heads and Tablet Shields
          p.stripT = (p.stripT === undefined ? 2 : p.stripT) - dt;
          if (p.stripT <= 0) {
            var vic = null;
            for (var az = 0; az < zombies.length; az++) { var zv = zombies[az]; if (zv.row === r && ZOMBIES[zv.type].armored && !ZOMBIES[zv.type].big && zv.x > tileX(c) - 10 && zv.x < tileX(c) + CWv * 5.5) { vic = zv; break; } }
            if (vic) {
              p.stripT = def.stripCd;
              vic.type = "basic"; vic.hp = Math.min(vic.hp, 60); vic.maxHp = 60;
              vic.speed = ZOMBIES.basic.speed; vic.dps = ZOMBIES.basic.dps;
              if (juice) { juice.text(X(vic.x, tileY(r) - 30), Y(vic.x, tileY(r) - 30), "🧲 CLANK!", "#8ecdf7"); juice.burst(X(vic.x, tileY(r)), Y(vic.x, tileY(r)), "#cfd6dd", 10); }
              if (sfx && sfx.pop) sfx.pop();
            } else p.stripT = 0.5;
          }
        }
      }
      // 🛋 couch potatoes throw pillows at your front line
      for (var qs = zshots.length - 1; qs >= 0; qs--) {
        var q2 = zshots[qs];
        q2.x -= 240 * SPD * dt;
        var qcol = Math.floor((q2.x - GXv) / CWv);
        var qp = (qcol >= 0 && qcol < COLS) ? plants[q2.row][qcol] : null;
        if (qp) {
          qp.hp -= q2.dmg; qp.flash = 0.15;
          if (qp.hp <= 0) plants[q2.row][qcol] = null;
          zshots.splice(qs, 1);
        } else if (q2.x < GXv - 30) zshots.splice(qs, 1);
      }
      // shots fly (crayon lobs are slower and SPLASH on impact)
      for (var si = shots.length - 1; si >= 0; si--) {
        var sh = shots[si];
        sh.x += (sh.lob ? 185 : 300) * SPD * dt;
        var gone = sh.x > MWv + 20;
        for (var z2i = 0; z2i < zombies.length && !gone; z2i++) {
          var z2 = zombies[z2i];
          if (z2.row === sh.row && Math.abs(z2.x - sh.x) < 22 && !sh.hit[z2i]) {
            hurtZ(z2, sh.dmg);
            if (sh.slow) z2.chill = 3;
            if (sh.lob) { // splash!
              for (var sp2 = zombies.length - 1; sp2 >= 0; sp2--) { var zn = zombies[sp2]; if (zn !== z2 && Math.abs(zn.row - sh.row) <= 1 && Math.abs(zn.x - sh.x) < CWv * 0.9 * ((mods || {}).splashMul || 1)) hurtZ(zn, Math.round(sh.dmg * 0.6)); }
              if (juice) juice.burst(X(sh.x, tileY(sh.row)), Y(sh.x, tileY(sh.row)), "#ff9f43", 12);
              gone = true;
            }
            else if (sh.pierce) { sh.hit[z2i] = 1; } else gone = true;
          }
        }
        if (gone) shots.splice(si, 1);
      }
      // zombies advance + munch (each type with its own tricks)
      for (var zj = zombies.length - 1; zj >= 0; zj--) {
        var zz = zombies[zj];
        var zdef = ZOMBIES[zz.type];
        zz.chill = Math.max(0, zz.chill - dt);
        var sp = zz.speed * SPD * (zz.chill > 0 ? 0.5 : 1);
        if (plan.dark && !litAt(zz.x, zz.row)) sp *= 1.35; // darkness emboldens them
        if (zdef.naps) { // 😴 sleepwalkers stop-and-go
          zz.napT = (zz.napT || 0) + dt;
          if ((zz.napT % 4.5) > 3) sp = 0;
        }
        if (zdef.wordShield) { // 📵 the King re-arms his shield unless kept broken
          if (zz.shield === undefined) { zz.shield = true; big("📵 TAP THE KING and answer his word to break the shield!", "#c9b6ff"); }
          if (!zz.shield) { zz.shieldOffT = (zz.shieldOffT || 0) - dt; if (zz.shieldOffT <= 0) { zz.shield = true; big("📵 HIS SHIELD RE-ARMS!", "#ff8a8a"); if (sfx && sfx.buzz) sfx.buzz(); } }
        }
        var col = Math.floor((zz.x - 24 - GXv) / CWv);
        var plant = (col >= 0 && col < COLS) ? plants[zz.row][col] : null;
        var atPlant = plant && zz.x - 24 <= tileX(col) + CWv * 0.3;
        if (zdef.fly) { // 🎈 floats right over your books
          zz.x -= sp * dt;
        } else if (zdef.ranged) { // 🛋 stops and throws pillows from range
          var frontPlant = null;
          for (var fc = COLS - 1; fc >= 0; fc--) { if (plants[zz.row][fc] && tileX(fc) < zz.x && zz.x - tileX(fc) < CWv * 4.5) { frontPlant = fc; break; } }
          if (frontPlant !== null) {
            zz.throwT = (zz.throwT === undefined ? 1.2 : zz.throwT) - dt;
            if (zz.throwT <= 0) { zz.throwT = 3; zshots.push({ x: zz.x - 26, row: zz.row, dmg: 6 }); if (sfx && sfx.whoosh) sfx.whoosh(); }
          } else zz.x -= sp * dt;
        } else if (atPlant) {
          if (zdef.crash) { // 🛴 kamikaze into the first thing it touches
            plant.hp -= zdef.crash; plant.flash = 0.2;
            if (plant.hp <= 0) plants[zz.row][col] = null;
            if (juice) { juice.burst(X(zz.x, tileY(zz.row)), Y(zz.x, tileY(zz.row)), "#ffd740", 14); juice.shake(4); }
            zombies.splice(zj, 1); kills++;
            continue;
          }
          plant.hp -= zz.dps * dt; plant.flash = 0.15;
          if (plant.hp <= 0) { plants[zz.row][col] = null; if (sfx && sfx.buzz && Math.random() < 0.3) sfx.buzz(); }
        } else {
          zz.x -= sp * dt;
        }
        if (zz.x < GXv - 6) { // reached the carts
          var cart = carts.filter(function (ct) { return ct.row === zz.row && !ct.used && !ct.rolling; })[0];
          if (cart) { cart.rolling = true; if (sfx && sfx.whoosh) sfx.whoosh(); big("📚 BOOK CART!", "#8ecdf7"); }
          else if (zz.x < GXv - 40) { endLevel(false); return; }
        }
      }
      // carts roll
      carts.forEach(function (ct) {
        if (!ct.rolling) return;
        ct.x += 480 * SPD * dt;
        for (var ci = zombies.length - 1; ci >= 0; ci--) { if (zombies[ci].row === ct.row && zombies[ci].x < ct.x + 40) { kills++; zombies.splice(ci, 1); } }
        if (ct.x > MWv + 60) { ct.rolling = false; ct.used = true; }
      });
      // victory: everything spawned and cleared (endless never ends by winning)
      if (!plan.endless && spawnIdx >= plan.spawns.length && zombies.length === 0 && !over) endLevel(true);
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    // a logical rect (x,y,w,h) → screen rect in either orientation
    function TR(x, y, w, h) {
      var ax = X(x, y), ay = Y(x, y), bx2 = X(x + w, y + h), by2 = Y(x + w, y + h);
      return { x: Math.min(ax, bx2), y: Math.min(ay, by2), w: Math.abs(bx2 - ax), h: Math.abs(by2 - ay) };
    }
    // small screen-space health bar under a sprite (always horizontal, readable)
    function bar(cx, cy, wpx, f, col) {
      if (f >= 1) return;
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(cx - wpx / 2, cy, wpx, 5);
      ctx.fillStyle = col; ctx.fillRect(cx - wpx / 2, cy, wpx * Math.max(0, f), 5);
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // library backdrop: warm wall + bookshelf stripes (roomy screens only)
      var g1 = ctx.createLinearGradient(0, 0, 0, H); g1.addColorStop(0, "#5b4632"); g1.addColorStop(1, "#3c2e20");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      if (!compact && !vertical) {
        for (var b = 0; b < 12; b++) {
          ctx.fillStyle = ["#c65b4e", "#5b8ac6", "#c6a94e", "#6ac65b", "#9a6ac6"][b % 5];
          ctx.fillRect(OX + pz(20 + b * 82), OY - pz(80), pz(30), pz(52));
        }
        ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(0, OY - pz(24), W, pz(8));
      }
      if (!plan) return;
      var spriteS = pz(Math.min(CHv, CWv * 1.15) * 0.66);
      // floor tiles: on phones only OPEN lanes render (full size)
      var floorRows = compact ? plan.rows : [0, 1, 2, 3, 4];
      floorRows.forEach(function (r) {
        var open = plan.rows.indexOf(r) >= 0;
        for (var c = 0; c < COLS; c++) {
          ctx.fillStyle = !open ? "rgba(0,0,0,.35)" : ((r + c) % 2 ? "#8a6a4a" : "#967553");
          var t = TR(GXv + c * CWv, tileY(r) - CHv / 2, CWv - 3, CHv - 3);
          ctx.fillRect(t.x, t.y, t.w, t.h);
        }
      });
      if (selected) {
        ctx.fillStyle = "rgba(155,225,93,.25)";
        var g = TR(GXv, GYv, COLS * CWv, ROWS * CHv);
        ctx.fillRect(g.x, g.y, g.w, g.h);
      }
      // 💧 ink drops (tap to collect!)
      drops.forEach(function (d) {
        var pulse = 1 + Math.sin(run * 6 + d.x) * 0.12;
        ctx.font = Math.round(spriteS * 0.8 * pulse) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🖋", X(d.x, d.y), Y(d.x, d.y));
        ctx.font = "bold " + Math.round(spriteS * 0.3) + "px Trebuchet MS"; ctx.fillStyle = "#8ecdf7";
        ctx.fillText("+" + ((mods || {}).dropVal || 15), X(d.x, d.y), Y(d.x, d.y) + spriteS * 0.62);
      });
      // carts
      carts.forEach(function (ct) {
        if (ct.used && !ct.rolling) return;
        ctx.font = Math.round(spriteS * 0.8) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        var cxx = ct.rolling ? ct.x : GXv - 52;
        ctx.fillText("🛒", X(cxx, tileY(ct.row)), Y(cxx, tileY(ct.row)));
      });
      // plants
      for (var pr = 0; pr < ROWS; pr++) for (var pc = 0; pc < COLS; pc++) {
        var p = plants[pr][pc]; if (!p) continue;
        var bx = tileX(pc), by = tileY(pr);
        var bob = Math.sin(run * 3 + pc + pr) * 2.5 + (p.fireK ? -Math.sin(Math.min(1, (run - p.fireK) * 6) * Math.PI) * 4 : 0);
        var cxs = X(bx, by), cys = Y(bx, by) + pz(bob);
        ctx.font = Math.round(spriteS) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (p.flash > 0) { ctx.save(); ctx.globalAlpha = 0.55; }
        ctx.fillText(BOOKS[p.k].emoji, cxs, cys);
        if (p.flash > 0) ctx.restore();
        if (pw > 0) { // a charged Power Word makes your books shimmer, ready to tap
          ctx.strokeStyle = "rgba(255,225,77," + (0.5 + Math.sin(run * 5) * 0.3) + ")"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(cxs, cys, spriteS * 0.62, 0, Math.PI * 2); ctx.stroke();
        }
        bar(cxs, cys + spriteS * 0.55, spriteS * 0.9, p.hp / p.maxHp, "#69f0ae");
      }
      // shots: flying letters (and lobbed crayons with a little arc)
      ctx.fillStyle = "#ffe14d"; ctx.font = "bold " + Math.round(spriteS * 0.52) + "px Trebuchet MS"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      shots.forEach(function (sh) {
        var arc = sh.lob ? -Math.abs(Math.sin((run - sh.born) * 2.4)) * spriteS * 0.5 : 0;
        ctx.fillText(sh.ch, X(sh.x, sh.y), Y(sh.x, sh.y) + arc);
      });
      // pillows incoming!
      ctx.font = Math.round(spriteS * 0.4) + "px serif";
      zshots.forEach(function (q3) { ctx.fillText("☁️", X(q3.x, tileY(q3.row)), Y(q3.x, tileY(q3.row))); });
      // zombies
      zombies.forEach(function (z) {
        var zy = tileY(z.row), zsc = spriteS * (ZOMBIES[z.type].big ? 1.5 : 1.05);
        var lurch = Math.sin(run * 4 + z.groan) * 3;
        var zxs = X(z.x, zy), zys = Y(z.x, zy) + pz(lurch) - zsc * 0.12;
        ctx.font = Math.round(zsc) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (z.chill > 0) { ctx.save(); ctx.filter = "hue-rotate(160deg)"; }
        ctx.fillText(ZOMBIES[z.type].emoji, zxs, zys);
        if (z.chill > 0) ctx.restore();
        ctx.font = Math.round(zsc * 0.36) + "px serif";
        ctx.fillText("📱", zxs + zsc * 0.34, zys + zsc * 0.28); // doomscrolling, always
        bar(zxs, zys - zsc * 0.66, zsc * 0.8, z.hp / z.maxHp, "#ff8a8a");
      });
      // 🌃 NIGHT SHIFT: darkness veils unlit tiles; lamps carve warm pools
      if (plan.dark) {
        var dRows = compact ? plan.rows : [0, 1, 2, 3, 4];
        dRows.forEach(function (r) {
          if (plan.rows.indexOf(r) < 0) return;
          for (var c = 0; c < COLS; c++) {
            if (litAt(tileX(c), r)) continue;
            var dk = TR(GXv + c * CWv, tileY(r) - CHv / 2, CWv - 3, CHv - 3);
            ctx.fillStyle = "rgba(8,10,30,.52)";
            ctx.fillRect(dk.x, dk.y, dk.w, dk.h);
          }
        });
        // lamp glows
        for (var lr = 0; lr < ROWS; lr++) for (var lc = 0; lc < COLS; lc++) {
          var lp = plants[lr][lc];
          if (lp && bdef(lp.k).light) {
            ctx.fillStyle = "rgba(255,214,110," + (0.13 + Math.sin(run * 2.2 + lc) * 0.03) + ")";
            ctx.beginPath(); ctx.arc(X(tileX(lc), tileY(lr)), Y(tileX(lc), tileY(lr)), pz(CWv * 2.4), 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      // 📵 the King's word-shield ring
      zombies.forEach(function (z) {
        if (ZOMBIES[z.type].wordShield && z.shield) {
          var kx = X(z.x, tileY(z.row)), ky = Y(z.x, tileY(z.row));
          ctx.strokeStyle = "rgba(201,182,255," + (0.55 + Math.sin(run * 6) * 0.25) + ")"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(kx, ky, spriteS * 1.05, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "#c9b6ff"; ctx.font = "bold " + Math.round(spriteS * 0.26) + "px Trebuchet MS"; ctx.textAlign = "center";
          ctx.fillText("TAP + WORD!", kx, ky - spriteS * 1.2);
        }
      });
      // boss health bar across the top
      var boss = null; zombies.forEach(function (z) { if (ZOMBIES[z.type].big) boss = z; });
      if (boss) {
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(W * 0.14, 8, W * 0.72, 16);
        ctx.fillStyle = "#c9b6ff"; ctx.fillRect(W * 0.14 + 2, 10, (W * 0.72 - 4) * Math.max(0, boss.hp / boss.maxHp), 12);
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px Trebuchet MS"; ctx.textAlign = "center";
        ctx.fillText(ZOMBIES[boss.type].emoji + " " + ZOMBIES[boss.type].name, W / 2, 17);
      }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input (phantom-tap safe) ----------
    function tap(x, y) {
      var mx, my;
      if (vertical) { my = (x - OX) / S; mx = MWv - (y - OY) / S; }
      else { mx = (x - OX) / S; my = (y - OY) / S; }
      tapLogical(mx, my);
    }
    function tapLogical(mx, my) {
      // ink drops first (they're the tastiest tap)
      for (var di = drops.length - 1; di >= 0; di--) {
        var d = drops[di];
        if (Math.abs(mx - d.x) < CWv * 0.55 && Math.abs(my - d.y) < CHv * 0.55) {
          drops.splice(di, 1);
          var dv = (mods || {}).dropVal || 15;
          ink += dv; hud();
          if (juice) { juice.burst(X(d.x, d.y), Y(d.x, d.y), "#8ecdf7", 10); juice.text(X(d.x, d.y), Y(d.x, d.y) - 16, "+" + dv + "🖋", "#8ecdf7"); }
          if (sfx && sfx.coin) sfx.coin();
          return;
        }
      }
      // 📵 tap the King to challenge his word-shield
      for (var ki = 0; ki < zombies.length; ki++) {
        var kz = zombies[ki];
        if (ZOMBIES[kz.type].wordShield && kz.shield && Math.abs(mx - kz.x) < CWv * 0.9 && Math.abs(my - tileY(kz.row)) < CHv * 0.9) {
          kingDuel(kz);
          return;
        }
      }
      var t = tileAt(mx, my);
      if (!t) return;
      // 🧹 broom: sweep a book for half its ink back
      if (selected === "broom") {
        var bp = plants[t.r] && plants[t.r][t.c];
        if (bp) {
          var refund = Math.floor(BOOKS[bp.k].cost / 2);
          plants[t.r][t.c] = null; ink += refund; selected = null;
          if (juice) juice.burst(X(tileX(t.c), tileY(t.r)), Y(tileX(t.c), tileY(t.r)), "#cfd6dd", 12);
          if (sfx && sfx.whoosh) sfx.whoosh();
          big("🧹 Swept! +" + refund + " ink back", "#8ecdf7");
          hud(); renderBar();
        }
        return;
      }
      // a charged ⚡ Power Word supercharges one of YOUR books
      if (plants[t.r] && plants[t.r][t.c] && pw > 0 && !selected) { superCharge(t.r, t.c); return; }
      tryPlace(t.r, t.c);
    }
    // 🌙 milestone: choose 1 of 3 Librarian Blessings; Vobux bank grows each time
    function offerBlessing(forceIds) {
      paused = true; milestones++;
      var pool = BLESS.filter(function (b) { return mods.blessed.indexOf(b.id) < 0 || b.id === "restock" || b.id === "surge"; });
      var picks = [];
      if (forceIds) picks = BLESS.filter(function (b) { return forceIds.indexOf(b.id) >= 0; });
      while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      picks = picks.slice(0, 3);
      var end = document.getElementById("bkend");
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:36px">🌙</div>' +
        '<div class="wqtitle" style="font-size:19px">Wave ' + endWave + " survived! +" + (milestones * 5) + " Vobux banked</div>" +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">Choose a Librarian Blessing:</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
        picks.map(function (b) {
          return '<button class="embtn" style="min-width:130px" data-bl="' + b.id + '"><span class="ebl">' + b.emoji + " " + b.name + '</span><span class="ebs">' + b.t + "</span></button>";
        }).join("") + "</div></div>";
      end.style.display = "flex";
      Array.prototype.forEach.call(end.querySelectorAll("[data-bl]"), function (btn) {
        btn.onclick = function () { applyBlessing(btn.dataset.bl); end.style.display = "none"; paused = false; };
      });
      if (sfx && sfx.chime) sfx.chime();
    }
    function applyBlessing(id) {
      mods.blessed.push(id);
      if (id === "sharp") mods.dmgMul += 0.25;
      else if (id === "golden") mods.dropVal = 30;
      else if (id === "bargain") mods.costMul = 0.8;
      else if (id === "storm") mods.dripMul = 1.5;
      else if (id === "frost") mods.spawnChill = 2.5;
      else if (id === "restock") carts.forEach(function (ct) { ct.used = false; ct.rolling = false; ct.x = GXv - 52; });
      else if (id === "surge") pw = 2;
      else if (id === "wide") mods.splashMul += 0.5;
      var b = BLESS.filter(function (x) { return x.id === id; })[0];
      big("🌙 " + b.emoji + " " + b.name + "!", "#c9b6ff");
      if (juice) juice.shake(4);
      hud(); renderBar();
    }
    // 📵 the King's word-duel: answer to shatter his shield for 12s
    function kingDuel(kz) {
      if (paused || over) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("bkq"), words, store, {
        title: "📵 THE KING DEMANDS A WORD! Answer to break his shield!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            kz.shield = false; kz.shieldOffT = 12; kz.chill = Math.max(kz.chill, 2);
            big("💥 SHIELD SHATTERED — 12 seconds, GO GO GO!", "#69f0ae");
            if (juice) { juice.shake(8); juice.burst(X(kz.x, tileY(kz.row)), Y(kz.x, tileY(kz.row)), "#c9b6ff", 24); }
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("The King laughs at your spelling…", "#ff8a8a");
        }
      });
    }
    // ⚡ POWER WORDS: earned by answering (ink rush), spent by tapping a book
    function superCharge(r, c) {
      var p = plants[r][c], def = bdef(p.k);
      if (def.boom) { big("💥 The bomb IS the power — just place it!", "#ffd740"); return; }
      pw--; pwUsed++;
      var bx = tileX(c), by = tileY(r);
      if (juice) { juice.burst(X(bx, by), Y(bx, by), "#ffe14d", 22); juice.shake(5); }
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (def.drip) { ink += 100; big("📖⚡ INK FOUNTAIN! +100", "#8ecdf7"); }
      else if (p.k === "wall") {
        p.hp = p.maxHp;
        zombies.forEach(function (z) { if (z.row === r && Math.abs(z.x - bx) < CWv * 2.6) z.x = Math.min(MWv - 10, z.x + CWv * 1.3); });
        big("📚⚡ SHELF SLAM! Healed + knockback!", "#9be15d");
      }
      else if (p.k === "freeze") { zombies.forEach(function (z) { z.chill = 4; }); big("❄️⚡ EVERYONE FREEZES!", "#8ecdf7"); }
      else if (p.k === "spell") {
        zombies.forEach(function (z) { if (z.row === r) hurtZ(z, 60); });
        for (var li = 0; li < COLS; li++) if (juice) juice.burst(X(tileX(li), by), Y(tileX(li), by), "#c9b6ff", 6);
        big("📜⚡ LIGHTNING SENTENCE!", "#c9b6ff");
      }
      else { // blaster (and future shooters): an alphabet VOLLEY
        for (var vi = 0; vi < 12; vi++) shots.push({ x: bx + 20 + vi * 16, y: by - 14, row: r, dmg: def.dmg || 7, slow: !!def.slow, pierce: true, hit: {}, ch: String.fromCharCode(65 + Math.floor(Math.random() * 26)) });
        big("📕⚡ ALPHABET STORM!", "#ffe14d");
      }
      hud();
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var r = cv.getBoundingClientRect(); tap(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top); }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); tap(e.clientX - r.left, e.clientY - r.top); });

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over && plan) step(dt);
      draw();
    }

    // leaving mid-run (or even closing the app) always BANKS the run and says so
    function bankExit() {
      if (!plan || over || (kills === 0 && rushes === 0)) return;
      var bank = bankRun(false);
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("📚 Library run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
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

    // test hook
    cv._books = {
      state: function () { return { level: level, ink: ink, plants: plants, zombies: zombies, carts: carts, over: over, best: stats.lvl, spawnIdx: spawnIdx, planLen: plan ? plan.spawns.length : 0, pw: pw, pwUsed: pwUsed, drops: drops, stars: stats.stars || {}, starsT: stats.starsT || {}, tierDone: stats.tierDone || {}, tier: tier, banked: banked, rushCd: rushCd, paused: paused, endlessBest: stats.endlessBest || 0, endWave: endWave, vertical: vertical }; },
      begin: beginLevel,
      give: function (n) { ink += n; hud(); renderBar(); },
      pick: function (k) { selected = k; },
      put: function (k, r, c) { place(k, r, c); },
      zombie: function (type, row, x) { spawnZombie(type, row); var z = zombies[zombies.length - 1]; if (x !== undefined) z.x = x; return z; },
      clearSpawns: function () { spawnIdx = plan.spawns.length; },
      charge: function (n) { pw = Math.min(2, pw + n); hud(); },
      power: function (r, c) { superCharge(r, c); },
      tapLogical: tapLogical,
      bdef: bdef,
      litAt: litAt,
      duel: function (z) { kingDuel(z); },
      bless: function (ids) { offerBlessing(ids); },
      mods: function () { return mods; },
      pages: function (n) { stats.pages = (stats.pages || 0) + n; },
      upgrade: function (k) { var lv = stats.up[k] || 0; if (stats.pages >= UPG_COST[lv]) { stats.pages -= UPG_COST[lv]; stats.up[k] = lv + 1; return true; } return false; },
      almanac: function () { return { seen: stats.seen, quizDone: stats.quizDone, pages: stats.pages }; },
      almanacQuiz: almanacQuiz
    };

    hud();
    showSelect();
    if (global._bvzdemo) setTimeout(function () { // test hook: a lively mid-battle board
      global._bvzdemo = 0;
      beginLevel(1);
      cv._books.give(400);
      cv._books.put("dict", 1, 0); cv._books.put("dict", 2, 0);
      cv._books.put("blaster", 1, 1); cv._books.put("blaster", 2, 1); cv._books.put("blaster", 3, 1);
      cv._books.put("wall", 2, 4);
      cv._books.zombie("basic", 2, 700); cv._books.zombie("speedy", 1, 820); cv._books.zombie("bucket", 3, 880);
    }, 700);
    if (global._bvznight) setTimeout(function () { // test hook: NIGHT SHIFT with the King mid-duel
      global._bvznight = 0;
      beginLevel(15);
      cv._books.give(500);
      cv._books.put("dict", 1, 0); cv._books.put("lamp", 2, 2); cv._books.put("lamp", 1, 5);
      cv._books.put("blaster", 1, 1); cv._books.put("blaster", 2, 1); cv._books.put("blaster", 3, 1);
      cv._books.zombie("gloweyes", 3, 700); cv._books.zombie("pajama", 1, 840); cv._books.zombie("king", 2, 760);
    }, 700);
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxBooks = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
