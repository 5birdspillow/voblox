/*
 * Voblox mini-game — 🎢 Word Park (a Roblox-style theme-park tycoon).
 * Leo builds a park: build pads around a path loop, TWELVE tiers of rides from
 * a 🎠 Carousel up to the 🌈 RAINBOW MEGAPLEX. Little emoji guests stream in the
 * gate, queue for a ride, bob along, pay a fare (+N gold floats up), then wander
 * to another ride or leave. More & better rides = higher ⭐ rating = faster guests.
 *
 * VOCAB IS THE GATE: ride tiers unlock IN ORDER, and each new tier needs a
 * 📋 BUILD PERMIT — a word (miniQuiz). Answer right → the next tier opens. Park
 * EXPANSIONS and — the big one — CASHING OUT also ask for a word. That's the
 * whole learning loop: to grow (and to bank) you keep spelling.
 *
 * The visible economy (books.js pattern): the run's Vobux payout scales with
 * gold EARNED this session (guests paying), NOT the park's stored wealth — no
 * idle money printer. AND cash-out is now WORD-GATED with DIMINISHING repeats
 * and a MINIMUM deposit, so a maxed park can't print Vobux forever (Leo's find).
 *
 * SESSION-only by design (a hard rule from Au): no idle/offline earnings, no
 * daily mechanics. But the park LAYOUT + gold + staff + decorations + expansions
 * persist via stats.parkSave (additive), so coming back resumes the same park.
 *
 * Also new: decorations (adjacent-fare boosts), staff (janitor/mascot/engineer),
 * litter + a real ⭐ rating, three guest types, a session goals board, ride jams,
 * and 🎆 fireworks. All timers dt-driven; guests cap 40, litter cap 15.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var MW = 640, MH = 520; // one logical space, letterboxed both orientations

  // the 12 ride tiers, word-gated in order. cost = park-gold to build,
  // fare = gold a guest pays per completed ride cycle, tickRate = cycle length (s).
  // Tiers 8-12 escalate steeply — the long-game gold sink.
  var RIDES = [
    { key: "carousel", name: "Carousel", emoji: "🎠", cost: 50, fare: 4, tickRate: 3.5 },
    { key: "slide", name: "Mega Slide", emoji: "🛝", cost: 120, fare: 8, tickRate: 3.2 },
    { key: "ferris", name: "Ferris Wheel", emoji: "🎡", cost: 300, fare: 16, tickRate: 3.6 },
    { key: "coaster", name: "Coaster", emoji: "🎢", cost: 700, fare: 32, tickRate: 3.0 },
    { key: "castle", name: "Haunted Castle", emoji: "🏰", cost: 1500, fare: 60, tickRate: 3.4 },
    { key: "rocket", name: "Rocket Drop", emoji: "🚀", cost: 3000, fare: 110, tickRate: 2.8 },
    { key: "rainbow", name: "RAINBOW LOOPER", emoji: "🌈", cost: 6000, fare: 210, tickRate: 2.6 },
    { key: "wheel", name: "Giant Wheel", emoji: "🎡", cost: 12000, fare: 360, tickRate: 2.6 },
    { key: "flume", name: "Log Flume", emoji: "🌊", cost: 22000, fare: 600, tickRate: 2.5 },
    { key: "manor", name: "Haunted Manor", emoji: "🏰", cost: 40000, fare: 1000, tickRate: 2.4 },
    { key: "rocket2", name: "Rocket Coaster", emoji: "🚀", cost: 75000, fare: 1700, tickRate: 2.3 },
    { key: "megaplex", name: "RAINBOW MEGAPLEX", emoji: "🌈", cost: 140000, fare: 3000, tickRate: 2.2 }
  ];
  var PRESTIGE_TIER = 7; // building a rainbow-class ride (tier ≥ 7) unlocks 🌟 rebuild

  // cheap decorations — placeable on a pad; each ADJACENT ride earns +15% fare (cap +45%)
  var DECOS = [
    { key: "tree", name: "Tree", emoji: "🌳", cost: 40 },
    { key: "balloon", name: "Balloon Stand", emoji: "🎈", cost: 60 },
    { key: "fountain", name: "Fountain", emoji: "⛲", cost: 120 }
  ];
  // hire-once staff — big gold, big quality-of-life
  var STAFF = [
    { id: "janitor", name: "Janitor", emoji: "🧹", cost: 1200, blurb: "auto-sweeps litter" },
    { id: "mascot", name: "Mascot", emoji: "🦁", cost: 2500, blurb: "more guests arrive" },
    { id: "engineer", name: "Engineer", emoji: "🔧", cost: 4000, blurb: "rides never jam" }
  ];
  var EXP_COST = [2000, 8000]; // two expansions, +3 pads each (base 9 → 12 → 15)

  var START_GOLD = 80;
  var CASH_MIN = 150;         // must EARN at least this before the bank will pay out
  var VISITOR_CAP = 40;       // perf cap on guests on screen
  var LITTER_CAP = 15;        // perf cap on litter
  var JAM_EVERY = 90;         // a ride jams roughly this often (seconds) without an Engineer

  // 9 fixed base build pads arranged around the path loop (logical coords, pad center)
  var PADS = [
    { x: 150, y: 120 }, { x: 320, y: 105 }, { x: 490, y: 120 },
    { x: 130, y: 260 }, { x: 320, y: 260 }, { x: 510, y: 260 },
    { x: 150, y: 400 }, { x: 320, y: 415 }, { x: 490, y: 400 }
  ];
  // 6 extra pads unlocked by the two expansions (indices 9-11, then 12-14)
  var EXPANSION_PADS = [
    { x: 240, y: 190 }, { x: 400, y: 190 }, { x: 320, y: 200 },
    { x: 240, y: 335 }, { x: 400, y: 335 }, { x: 320, y: 325 }
  ];
  // the walking loop guests follow (a rounded rectangle of waypoints, clockwise)
  var LOOP = [
    { x: 90, y: 175 }, { x: 90, y: 345 }, { x: 230, y: 460 }, { x: 410, y: 460 },
    { x: 550, y: 345 }, { x: 550, y: 175 }, { x: 410, y: 60 }, { x: 230, y: 60 }
  ];
  var GATE = { x: 320, y: 490 }; // guests enter (and leave) here, bottom-center

  var KID_EMOJI = ["🧒", "👧", "👦"], PARENT_EMOJI = ["🧑", "👩", "👨"];

  function rideByTier(t) { return RIDES[t - 1]; }
  function decoByKey(k) { for (var i = 0; i < DECOS.length; i++) if (DECOS[i].key === k) return DECOS[i]; return null; }
  function staffById(id) { for (var i = 0; i < STAFF.length; i++) if (STAFF[i].id === id) return STAFF[i]; return null; }
  function ordinal(n) { return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : (n + "th"); }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("park");
    // additive save fields only — never touch stats.best (the platform score)
    var save = stats.parkSave || null;

    var wrap = document.createElement("div"); wrap.className = "gamewrap park";
    wrap.innerHTML =
      '<canvas id="pkcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="pkmsg">🎢 Word Park</div>' +
      '<div class="grow"><span id="pkgold">🟡 0</span><span id="pkrate">⭐</span>' +
      '<button class="replay" id="pkpermit" type="button" style="display:none"></button>' +
      '<button class="replay" id="pkshop" type="button">🏪 Shop</button>' +
      '<button class="replay" id="pkcash" type="button">💰 Cash out</button>' +
      '<button class="replay" id="pkrebuild" type="button" style="display:none">🌟 REBUILD</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="pkgoals" id="pkgoals" style="position:absolute;left:8px;top:calc(env(safe-area-inset-top,0px) + 112px);z-index:6;background:rgba(20,30,40,.55);color:#fff;font:600 12px/1.35 Trebuchet MS,sans-serif;padding:6px 8px;border-radius:10px;pointer-events:none;max-width:190px"></div>' +
      '<div class="gmsg" id="pkbig"></div>' +
      '<div class="gover" id="pkq" style="display:none"></div>' +
      '<div class="gover" id="pkend" style="display:none"></div>' +
      '<div class="gover" id="pkcard" style="display:none"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#pkcv"), ctx = cv.getContext("2d");

    // iPhone fit: the shared .ghud .grow is a NOWRAP centered row; park's 6 pills+buttons
    // overflow a 393px screen (Cash out / Leave get clipped). Compact + wrap them inline
    // (mirrors the .gamewrap.digger compact-fit reference) so nothing clips. UI only.
    (function () {
      var grow = wrap.querySelector(".grow");
      if (!grow) return;
      grow.style.flexWrap = "wrap";
      grow.style.gap = "5px";
      grow.style.padding = "0 4px";
      Array.prototype.forEach.call(grow.children, function (el) {
        el.style.whiteSpace = "nowrap";
        if (el.tagName === "SPAN") {              // 🟡 gold + ⭐ rating pills
          el.style.fontSize = "13px";
          el.style.padding = "3px 8px";
          el.style.borderWidth = "2px";
          el.style.borderBottomWidth = "3px";
        } else {                                  // PERMIT / Shop / Cash out / REBUILD / Leave
          el.style.fontSize = "13px";
          el.style.padding = "6px 9px";
          el.style.margin = "0";                  // kill .bossquit margin-top:14px so the row aligns
        }
      });
    })();

    // ---------- responsive letterbox (one logic space, both orientations) ----------
    var W, H, S, OX, OY;
    function resize() {
      W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight;
      var reserve = 96; // room for the HUD bar up top
      S = Math.min(W / MW, (H - reserve) / MH);
      OX = (W - MW * S) / 2;
      OY = reserve + (H - reserve - MH * S) / 2;
      layoutGoals();
    }
    // Park the goals panel just BELOW the real HUD. .ghud height already bakes in
    // env(safe-area-inset-top) (its padding-top is calc(env(safe-area-inset-top)+10px))
    // AND any button-row wrapping, so measuring it clears both the Dynamic Island and
    // the HUD on any device — no hardcoded top:118px collision.
    function layoutGoals() {
      var gh = wrap.querySelector(".ghud"), gp = document.getElementById("pkgoals");
      if (gh && gp) gp.style.top = (Math.round(gh.getBoundingClientRect().height) + 6) + "px";
    }
    resize(); window.addEventListener("resize", resize);
    function X(x) { return OX + x * S; }
    function Y(y) { return OY + y * S; }
    function pz(n) { return n * S; }

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- park state ----------
    var running = true, raf = 0, lastT = performance.now();
    var gold = START_GOLD;
    var unlockedTier = 1;      // how many tiers are permitted (1..12); tier 1 is free
    var prestige = 0;          // 🌟 rebuilds done — each ×1.5 to all fares
    var earned = 0;            // gold EARNED this session (drives the Vobux payout)
    var pads = [];             // build slots: null | ride {tier,...} | deco {deco:true,key,...}
    var visitors = [];         // little guests walking / queueing / riding
    var floats = [];           // "+N" gold texts drifting up
    var litter = [];           // 🍬 dropped by guests; too much = grumpy park
    var balloons = [];         // ambient drifting 🎈 (feels alive)
    var mascot = null;         // wandering 🦁 when hired
    var arriveT = 2;           // countdown to the next guest
    var banked = false;        // this banking window already cashed?
    var permitOpen = false;    // is a permit quiz on screen?
    var cashQuizOpen = false;  // is the cash-out word quiz on screen?
    var expandOpen = false;    // is the expansion word quiz on screen?
    var built0 = 0;            // whether a rainbow-class ride has EVER been built (prestige gate)
    var expansions = 0;        // 0..2 park expansions bought
    var staff = { janitor: false, mascot: false, engineer: false };
    var cashOutCount = 0;      // SESSION-only: how many times banked this run (diminishing)
    var lastRw = null;         // the reward object of the last bank (for the card + tests)
    var jamTimer = JAM_EVERY;  // countdown to the next random ride jam
    var cleanT = 2.5;          // janitor sweep cadence
    var ambientT = 1.5;        // balloon spawn cadence
    var fw5 = false;           // rating-5 fireworks already fired?
    for (var i = 0; i < 9; i++) pads.push(null);

    // session goals board (fixed trio — deterministic & always meaningful)
    var goals = [
      { id: "earn", text: "Earn 500 🟡 gold", target: 500, reward: 200, done: false },
      { id: "build", text: "Build 8 rides", target: 8, reward: 300, done: false },
      { id: "rating", text: "Reach ⭐4 rating", target: 4, reward: 250, done: false }
    ];

    // restore a saved park (layout + gold + progress + staff + decorations + expansions)
    if (save) {
      gold = typeof save.gold === "number" ? save.gold : START_GOLD;
      unlockedTier = save.unlockedTier || 1;
      prestige = save.prestige || 0;
      expansions = save.expansions || 0;
      while (pads.length < 9 + expansions * 3) pads.push(null);
      if (save.staff) { staff.janitor = !!save.staff.janitor; staff.mascot = !!save.staff.mascot; staff.engineer = !!save.staff.engineer; }
      if (save.pads) for (var p = 0; p < pads.length && p < save.pads.length; p++) {
        var sp = save.pads[p];
        if (sp && sp.tier) buildAt(p, sp.tier, true);
        else if (sp && sp.deco) placeDecoAt(p, sp.deco);
      }
    }

    function fareMul() { return Math.pow(1.5, prestige); } // 🌟 prestige multiplies fares
    function padXY(i) { return i < 9 ? PADS[i] : EXPANSION_PADS[i - 9]; }
    function ridePads() { var out = []; pads.forEach(function (pd, i) { if (pd && pd.tier) out.push(i); }); return out; }
    function rideCount() { return ridePads().length; }
    function decoCount() { var n = 0; pads.forEach(function (pd) { if (pd && pd.deco) n++; }); return n; }
    function staffCount() { return (staff.janitor ? 1 : 0) + (staff.mascot ? 1 : 0) + (staff.engineer ? 1 : 0); }
    function adjacent(i, j) { var a = padXY(i), b = padXY(j), dx = a.x - b.x, dy = a.y - b.y; return (dx * dx + dy * dy) < 200 * 200; }
    // multiplier a ride gets from ADJACENT decorations: +15% each, cap +45%
    function decorationBoost(pad) {
      var pd = pads[pad]; if (!pd || !pd.tier) return 1;
      var n = 0;
      for (var j = 0; j < pads.length; j++) if (j !== pad && pads[j] && pads[j].deco && adjacent(pad, j)) n++;
      return 1 + 0.15 * Math.min(3, n);
    }

    // ---------- persistence (additive, never stats.best) ----------
    function persist() {
      stats.parkSave = {
        gold: gold, unlockedTier: unlockedTier, prestige: prestige, expansions: expansions,
        pads: pads.map(function (pd) { return pd ? (pd.tier ? { tier: pd.tier } : { deco: pd.key }) : null; }),
        staff: { janitor: !!staff.janitor, mascot: !!staff.mascot, engineer: !!staff.engineer }
      };
      store.save();
    }

    // ---------- HUD ----------
    var msgEl = document.getElementById("pkmsg"), bigEl = document.getElementById("pkbig");
    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1300);
    }
    // ⭐ park rating 1-5: rides + how fancy + decorations + staff − litter mess
    function rating() {
      var built = 0, tierSum = 0;
      pads.forEach(function (pd) { if (pd && pd.tier) { built++; tierSum += pd.tier; } });
      if (!built) return 1;
      var score = built * 0.35 + tierSum * 0.22 + decoCount() * 0.25 + staffCount() * 0.4;
      if (litter.length > 8) score -= (litter.length - 8) * 0.45; // dirty park drags the stars down
      return Math.max(1, Math.min(5, 1 + Math.floor(score)));
    }
    function ratingFactors() {
      return "🎢 rides " + rideCount() + " · 🌳 decor " + decoCount() +
        " · 🍬 litter " + litter.length + (litter.length > 8 ? " (messy!)" : "") +
        " · 🧑‍🔧 staff " + staffCount();
    }
    function updateGoals() {
      var g = document.getElementById("pkgoals"); if (!g) return;
      g.innerHTML = "🎯 Goals" + goals.map(function (go) {
        return "<br>" + (go.done ? "✅ " : "▫️ ") + go.text +
          (go.done ? "" : " <span style='opacity:.75'>(" + goalProgress(go) + "/" + go.target + ")</span>");
      }).join("");
    }
    function hud() {
      document.getElementById("pkgold").textContent = "🟡 " + Math.floor(gold);
      var r = rating();
      var rt = document.getElementById("pkrate");
      rt.textContent = "⭐".repeat(r) + (prestige > 0 ? "  🌟×" + prestige : "");
      rt.title = "Rating " + r + "/5 — " + ratingFactors();
      // 📋 PERMIT button: shows the next locked tier (if any)
      var pb = document.getElementById("pkpermit");
      if (unlockedTier < RIDES.length) {
        var nxt = RIDES[unlockedTier];
        pb.style.display = ""; pb.textContent = "📋 PERMIT → " + nxt.emoji;
      } else pb.style.display = "none";
      // 💰 cash-out dims until you've earned the minimum deposit
      var cb = document.getElementById("pkcash");
      cb.style.opacity = earned >= CASH_MIN ? "" : "0.45";
      cb.title = earned >= CASH_MIN ? "Cash out (answer a word!)" : "Earn " + CASH_MIN + " 🟡 first";
      // 🌟 rebuild button appears once a rainbow has ever been built
      document.getElementById("pkrebuild").style.display = built0 ? "" : "none";
      updateGoals();
      layoutGoals();
    }

    // ---------- goals ----------
    function goalProgress(g) {
      if (g.id === "earn") return Math.floor(earned);
      if (g.id === "build") return rideCount();
      if (g.id === "rating") return rating();
      return 0;
    }
    function checkGoals() {
      goals.forEach(function (g) {
        if (!g.done && goalProgress(g) >= g.target) {
          g.done = true;
          // pays a gold bonus straight into the EARNED pool (normal cash-out path — never a side bank)
          gold += g.reward; earned += g.reward;
          big("🎯 Goal done — " + g.text + "! +" + g.reward + " 🟡", "#9be15d");
          if (sfx && sfx.fanfare) sfx.fanfare();
          if (juice) juice.burst(W / 2, H * 0.3, "#69f0ae", 18);
        }
      });
    }

    // ---------- building ----------
    // buildAt is the raw placement (used by restore + the test .build force path)
    function buildAt(pad, tier, silent) {
      var def = rideByTier(tier);
      pads[pad] = { tier: tier, key: def.key, emoji: def.emoji, cycle: 0, riders: 0, spin: Math.random() * 6, jammed: false, fixTaps: 0, earned: 0 };
      if (tier >= PRESTIGE_TIER) built0 = 1; // a rainbow-class ride exists → prestige unlocked
      if (!silent) {
        if (juice) juice.burst(X(padXY(pad).x), Y(padXY(pad).y), "#ffd23f", 16);
        if (sfx && sfx.pop) sfx.pop();
        checkGoals();
      }
    }
    // the REAL build path: check unlock + affordability, spend gold, place it
    function buyBuild(pad, tier) {
      if (pad < 0 || pad >= pads.length || pads[pad]) return false;
      if (tier < 1 || tier > RIDES.length) return false;
      if (tier > unlockedTier) { big("🔒 Get a 📋 PERMIT to unlock that ride!", "#ffd740"); return false; }
      var def = rideByTier(tier);
      if (gold < def.cost) { big("Not enough 🟡 gold for a " + def.name + "!", "#ffd740"); return false; }
      gold -= def.cost;
      buildAt(pad, tier);
      big("🎉 " + def.emoji + " " + def.name + " built!", "#9be15d");
      persist(); hud(); closeCard();
      return true;
    }
    // decorations share the pad grid; cheap, boost adjacent rides
    function placeDecoAt(pad, key) {
      var def = decoByKey(key); if (!def) return;
      pads[pad] = { deco: true, key: def.key, emoji: def.emoji, spin: Math.random() * 6 };
    }
    function buyDeco(pad, key) {
      if (pad < 0 || pad >= pads.length || pads[pad]) return false;
      var def = decoByKey(key); if (!def) return false;
      if (gold < def.cost) { big("Not enough 🟡 gold for a " + def.name + "!", "#ffd740"); return false; }
      gold -= def.cost; placeDecoAt(pad, key);
      if (juice) juice.burst(X(padXY(pad).x), Y(padXY(pad).y), "#9be15d", 12);
      if (sfx && sfx.pop) sfx.pop();
      big("🌳 " + def.name + " placed — nearby rides earn +15%!", "#9be15d");
      persist(); hud(); closeCard();
      return true;
    }
    function demolish(pad) {
      var pd = pads[pad]; if (!pd) return;
      var back = pd.tier ? Math.floor(rideByTier(pd.tier).cost * 0.5) : Math.floor(decoByKey(pd.key).cost * 0.5);
      pads[pad] = null; gold += back;
      // send any guests riding this pad back to wandering
      visitors.forEach(function (v) { if (v.pad === pad) { v.pad = -1; v.mode = "walk"; } });
      if (juice) juice.burst(X(padXY(pad).x), Y(padXY(pad).y), "#cfd6dd", 14);
      if (sfx && sfx.whoosh) sfx.whoosh();
      big("🔨 Demolished — +" + back + " 🟡 back", "#8ecdf7");
      persist(); hud(); closeCard();
    }

    // ---------- build / info cards ----------
    var cardEl = document.getElementById("pkcard");
    function closeCard() { cardEl.style.display = "none"; cardEl.innerHTML = ""; }
    function openPadCard(pad) {
      if (permitOpen || cashQuizOpen || expandOpen) return;
      if (pads[pad]) return pads[pad].tier ? openRideCard(pad) : openDecoCard(pad);
      // build menu: every UNLOCKED ride tier you can afford + the cheap decorations
      var rideRows = RIDES.map(function (def, idx) {
        var tier = idx + 1;
        if (tier > unlockedTier) return "";
        var can = gold >= def.cost;
        return '<button class="embtn" style="min-width:130px' + (can ? "" : ";opacity:.5") + '" data-bt="' + tier + '">' +
          '<span class="ebl">' + def.emoji + " " + def.cost + ' 🟡</span>' +
          '<span class="ebs">' + def.name + " · +" + Math.round(def.fare * fareMul()) + "/ride</span></button>";
      }).join("");
      var decoRows = DECOS.map(function (def) {
        var can = gold >= def.cost;
        return '<button class="embtn" style="min-width:120px' + (can ? "" : ";opacity:.5") + '" data-deco="' + def.key + '">' +
          '<span class="ebl">' + def.emoji + " " + def.cost + ' 🟡</span>' +
          '<span class="ebs">' + def.name + " · +15% near</span></button>";
      }).join("");
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:440px">' +
        '<div class="wqtitle">🏗 Build here</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🟡 ' + Math.floor(gold) + ' gold · tap a ride to build it</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + rideRows + "</div>" +
        '<div style="font-size:11px;color:#8a98a8;margin:8px 0 4px">🌳 Decorations (boost nearby rides):</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + decoRows + "</div>" +
        (unlockedTier < RIDES.length ? '<div style="font-size:11px;color:#8a98a8;margin-top:8px">Next ride needs a 📋 PERMIT (answer a word!)</div>' : "") +
        '<button class="wqskip" id="pk_cardback" type="button">close</button></div>';
      cardEl.style.display = "flex";
      Array.prototype.forEach.call(cardEl.querySelectorAll("[data-bt]"), function (b) {
        b.onclick = function () { buyBuild(pad, +b.dataset.bt); };
      });
      Array.prototype.forEach.call(cardEl.querySelectorAll("[data-deco]"), function (b) {
        b.onclick = function () { buyDeco(pad, b.dataset.deco); };
      });
      document.getElementById("pk_cardback").onclick = closeCard;
    }
    function openRideCard(pad) {
      var pd = pads[pad], def = rideByTier(pd.tier);
      var back = Math.floor(def.cost * 0.5);
      var boost = decorationBoost(pad);
      var boostPct = Math.round((boost - 1) * 100);
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:380px">' +
        '<div style="font-size:48px">' + def.emoji + (pd.jammed ? " ⚠️" : "") + '</div>' +
        '<div class="wqtitle">' + def.name + '</div>' +
        '<div style="font-size:13px;color:#5a6b7a;margin:4px 0">Fare: +' + Math.round(def.fare * fareMul() * boost) + ' 🟡 each ride' +
        (boostPct > 0 ? ' <span style="color:#2f9e44">(🌳 +' + boostPct + '% from decorations!)</span>' : "") +
        '<br>earned so far: ' + Math.floor(pd.earned || 0) + ' 🟡</div>' +
        (pd.jammed ? '<div style="color:#e08a2f;font-weight:800;font-size:13px;margin:4px 0">🔧 Jammed! Tap it 3× to fix (' + (pd.fixTaps || 0) + '/3)</div>' : "") +
        '<button class="submit" id="pk_demo" style="background:#e57373">🔨 Demolish for +' + back + ' 🟡 (50%)</button>' +
        '<br><button class="wqskip" id="pk_cardback2" type="button">close</button></div>';
      cardEl.style.display = "flex";
      document.getElementById("pk_demo").onclick = function () { demolish(pad); };
      document.getElementById("pk_cardback2").onclick = closeCard;
    }
    function openDecoCard(pad) {
      var pd = pads[pad], def = decoByKey(pd.key), back = Math.floor(def.cost * 0.5);
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:340px">' +
        '<div style="font-size:48px">' + def.emoji + '</div>' +
        '<div class="wqtitle">' + def.name + '</div>' +
        '<div style="font-size:13px;color:#5a6b7a;margin:4px 0">Boosts every ride right next to it by +15% (up to +45%).</div>' +
        '<button class="submit" id="pk_demo" style="background:#e57373">🔨 Remove for +' + back + ' 🟡</button>' +
        '<br><button class="wqskip" id="pk_cardback2" type="button">close</button></div>';
      cardEl.style.display = "flex";
      document.getElementById("pk_demo").onclick = function () { demolish(pad); };
      document.getElementById("pk_cardback2").onclick = closeCard;
    }

    // ---------- 🏪 the shop: staff + park expansion ----------
    function openShop() {
      if (permitOpen || cashQuizOpen || expandOpen) return;
      var staffRows = STAFF.map(function (s) {
        var owned = staff[s.id], can = gold >= s.cost;
        return '<button class="embtn" style="min-width:150px' + (owned || !can ? ";opacity:.5" : "") + '"' + (owned ? " disabled" : "") + ' data-hire="' + s.id + '">' +
          '<span class="ebl">' + s.emoji + " " + (owned ? "hired ✓" : s.cost + " 🟡") + '</span>' +
          '<span class="ebs">' + s.name + " · " + s.blurb + "</span></button>";
      }).join("");
      var expBtn;
      if (expansions >= 2) expBtn = '<div style="font-size:12px;color:#8a98a8">🗺 Park fully expanded! (15 pads)</div>';
      else {
        var ec = EXP_COST[expansions];
        expBtn = '<button class="embtn" style="min-width:200px' + (gold >= ec ? "" : ";opacity:.5") + '" data-expand="1">' +
          '<span class="ebl">🗺 ' + ec + ' 🟡 + a word</span>' +
          '<span class="ebs">Expand the park (+3 pads)</span></button>';
      }
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:440px">' +
        '<div class="wqtitle">🏪 Park Shop</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🟡 ' + Math.floor(gold) + ' gold</div>' +
        '<div style="font-size:11px;color:#8a98a8;margin:2px 0 4px">Staff (hire once):</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + staffRows + "</div>" +
        '<div style="font-size:11px;color:#8a98a8;margin:8px 0 4px">Grow the park:</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + expBtn + "</div>" +
        '<button class="wqskip" id="pk_shopback" type="button">close</button></div>';
      cardEl.style.display = "flex";
      Array.prototype.forEach.call(cardEl.querySelectorAll("[data-hire]"), function (b) {
        b.onclick = function () { hireStaff(b.dataset.hire); };
      });
      var eb = cardEl.querySelector("[data-expand]"); if (eb) eb.onclick = function () { closeCard(); expand(); };
      document.getElementById("pk_shopback").onclick = closeCard;
    }
    function hireStaff(id) {
      var def = staffById(id); if (!def) return false;
      if (staff[id]) { big(def.emoji + " " + def.name + " is already hired!", "#ffd740"); return false; }
      if (gold < def.cost) { big("Need " + def.cost + " 🟡 to hire the " + def.name + "!", "#ffd740"); return false; }
      gold -= def.cost; staff[id] = true;
      big("🎉 Hired the " + def.emoji + " " + def.name + "!", "#69f0ae");
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) juice.burst(W / 2, H * 0.4, "#ffd23f", 16);
      persist(); hud(); closeCard();
      return true;
    }

    // ---------- 🗺 park expansion (word-gated + big gold) ----------
    function expand() {
      if (permitOpen || cashQuizOpen || expandOpen) return false;
      if (expansions >= 2) { big("🗺 The park is fully expanded!", "#ffd740"); return false; }
      var cost = EXP_COST[expansions];
      if (gold < cost) { big("Need " + cost + " 🟡 gold to expand the park!", "#ffd740"); return false; }
      expandOpen = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("pkq"), words, store, {
        title: "🗺 Answer a word to expand your park!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; expandOpen = false;
          if (ok) {
            gold -= cost; expansions++;
            for (var k = 0; k < 3; k++) pads.push(null);
            big("🎉 Park expanded! +3 build pads!", "#69f0ae");
            fireworks();
            persist();
          } else big("The mapmaker needs a word! Try again any time.", "#ff8a8a");
          hud();
        }
      });
      return true;
    }

    // ---------- 📋 the permit quiz (the learning hook) ----------
    var lastFmt = null;
    function openPermit() {
      if (permitOpen || cashQuizOpen || expandOpen || unlockedTier >= RIDES.length) return;
      permitOpen = true;
      var nxt = RIDES[unlockedTier]; // the tier we're trying to unlock
      cv._lastQ = VQ.miniQuiz(document.getElementById("pkq"), words, store, {
        title: "📋 Permit test! Answer to unlock the next ride!",
        lastFormat: lastFmt,
        // NOT skippable — you must earn the permit
        cb: function (ok, res, fmt) {
          lastFmt = fmt; permitOpen = false;
          if (ok) {
            unlockedTier = Math.min(RIDES.length, unlockedTier + 1);
            big("📋 PERMIT GRANTED! " + nxt.emoji + " " + nxt.name + " unlocked!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(W / 2, H / 2, "#ffd23f", 22);
            persist();
          } else big("📋 Permit denied — try again any time!", "#ff8a8a");
          hud();
        }
      });
    }

    // ---------- 🌟 prestige: rebuild bigger ----------
    function doPrestige() {
      if (!built0) return;
      prestige++;
      for (var k = 0; k < pads.length; k++) pads[k] = null; // clear rides + decorations, keep pad count/expansions
      visitors = []; floats = []; litter = []; balloons = []; mascot = null;
      gold = START_GOLD;
      built0 = 0; fw5 = false; // must build a new rainbow to rebuild again
      // (unlockedTier, staff, and expansions are KEPT — you keep your learning + big buys)
      big("🌟 REBUILT BIGGER! All future fares ×" + fareMul().toFixed(2) + "!", "#ffd23f");
      if (sfx && sfx.fanfare) sfx.fanfare();
      fireworks();
      persist(); hud();
    }

    // ---------- 🎆 fireworks ----------
    function fireworks() {
      if (juice) {
        for (var cf = 0; cf < 6; cf++) juice.burst(W * (0.15 + Math.random() * 0.7), H * (0.2 + Math.random() * 0.3),
          ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb", "#ffa726"][cf], 18);
        juice.shake(5);
      }
      if (sfx && sfx.fanfare) sfx.fanfare();
    }

    // ---------- the economy: bank the run, SHOW the payout ----------
    // diminishing repeats: 1st cash-out full, 2nd half, 3rd+ quarter (SESSION only)
    function cashMult() { return cashOutCount <= 0 ? 1 : (cashOutCount === 1 ? 0.5 : 0.25); }
    function runRewards(mult) {
      // Vobux scale with gold EARNED this session + a bonus per permit unlocked.
      var tierBonus = (unlockedTier - 1) * 6; // each new tier permitted = a study win
      var gems = Math.min(70, Math.round(5 + earned / 60 + tierBonus));
      var rank = Math.min(10, 2 + Math.floor(earned / 300) + prestige);
      var xp = Math.min(70, Math.round(8 + earned / 40 + (unlockedTier - 1) * 4));
      return {
        win: true,
        score: Math.round(earned) + prestige * 200,
        rankPtsDelta: Math.max(1, Math.round(rank * mult)),
        xp: Math.max(1, Math.round(xp * mult)),
        gems: Math.max(1, Math.round(gems * mult)),
        mult: mult
      };
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      var mult = cashMult();
      var rw = runRewards(mult);
      var res = store.recordGame ? store.recordGame("park", rw) : null;
      cashOutCount++;   // this bank counts toward the diminishing rate
      lastRw = rw;
      return { rw: rw, res: res, mult: mult };
    }
    // the actual payout + card (shared by the word-gated flow and cashOutForce)
    function doCashOut() {
      var bank = bankRun();
      if (!bank) return;
      var rw = bank.rw, res = bank.res, mult = bank.mult, visit = cashOutCount;
      var rateLine = mult < 1
        ? '<div style="margin:2px 0;font-size:12px;color:#c26a1f">' + ordinal(visit) + ' visit to the bank today: ' +
          (mult === 0.5 ? "half rate" : "quarter rate") + '</div>'
        : "";
      var end = document.getElementById("pkcard");
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:420px">' +
        '<div style="font-size:44px">💰🎢</div>' +
        '<div class="wqtitle" style="font-size:20px">Park payout!</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP</div>" +
        rateLine +
        '<div style="margin:2px 0;font-size:13px;color:#5a6b7a">🟡 ' + Math.round(earned) + ' gold earned this visit · ⭐ rating ' + rating() + (prestige ? " · 🌟×" + prestige : "") + (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        '<button class="submit big-next" id="pk_keep">Keep building ➜</button></div>';
      end.style.display = "flex";
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(5); for (var cf = 0; cf < 4; cf++) juice.burst(W * (0.25 + cf * 0.18), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b"][cf], 14); }
      document.getElementById("pk_keep").onclick = function () {
        end.style.display = "none"; end.innerHTML = "";
        // fresh banking window: the NEXT stretch of earnings can be banked — but the
        // diminishing RATE (cashOutCount) is NOT reset, so this can't print forever.
        banked = false; earned = 0;
        hud();
      };
    }
    // 💰 Cash out: WORD-GATED. Answer a word first; correct → payout; wrong → gold kept.
    function cashOut() {
      if (banked || permitOpen || cashQuizOpen || expandOpen) return;
      if (earned < CASH_MIN) {
        big("The bank opens at " + CASH_MIN + " 🟡 earned — keep the rides busy!", "#ffd740");
        if (sfx && sfx.toast) sfx.toast("💰 Earn " + CASH_MIN + " 🟡 before cashing out!");
        return;
      }
      cashQuizOpen = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("pkq"), words, store, {
        title: "💰 Answer for the banker to cash out!",
        lastFormat: lastFmt,
        // NOT skippable — learning is the throttle
        cb: function (ok, res, fmt) {
          lastFmt = fmt; cashQuizOpen = false;
          if (ok) doCashOut();
          else big("The banker wants a word! Your gold is safe — try again.", "#ffd740");
          hud();
        }
      });
    }

    // ---------- guests (the visible economy in motion) ----------
    function pickGuestType() {
      var r = rating();
      if (Math.random() < (r >= 3 ? 0.06 : 0.02)) return "vip";            // 🤩 rare
      if (Math.random() < 0.32 + (r >= 4 ? 0.15 : 0) + decoCount() * 0.03) return "parent"; // 🧑 love decor
      return "kid";                                                        // 🧒 default
    }
    function guestEmoji(ty) {
      if (ty === "vip") return "🤩";
      if (ty === "parent") return PARENT_EMOJI[Math.floor(Math.random() * PARENT_EMOJI.length)];
      return KID_EMOJI[Math.floor(Math.random() * KID_EMOJI.length)];
    }
    function spawnGuest(type) {
      if (visitors.length >= VISITOR_CAP) return;
      var ty = type || pickGuestType();
      visitors.push({
        type: ty, emoji: guestEmoji(ty),
        x: GATE.x, y: GATE.y, wp: 0, // walking toward loop waypoint wp
        mode: "walk", pad: -1, rideT: 0, bob: Math.random() * 6, life: 0, rode: 0, jamWait: 0
      });
    }
    function bestRidePad() {
      var bp = ridePads(), best = -1, bt = -1;
      bp.forEach(function (p) { if (pads[p].tier > bt) { bt = pads[p].tier; best = p; } });
      return best;
    }
    function guestPickRide(v) {
      var bp = ridePads();
      if (!bp.length) { v.mode = "leave"; return; }
      var pad;
      if (v.type === "vip") pad = bestRidePad();                       // 🤩 always the best ride
      else if (v.type === "parent") {                                  // 🧑 prefer decorated rides
        var bestB = -1;
        bp.forEach(function (p) { var b = decorationBoost(p); if (b > bestB) { bestB = b; pad = p; } });
        if (pad == null) pad = bp[Math.floor(Math.random() * bp.length)];
      } else {                                                          // 🧒 love the low tiers
        var lows = bp.filter(function (p) { return pads[p].tier <= 3; });
        var pool = lows.length ? lows : bp;
        pool = pool.filter(function (p) { return p !== v.lastPad; });
        if (!pool.length) pool = lows.length ? lows : bp;
        pad = pool[Math.floor(Math.random() * pool.length)];
      }
      if (pad == null) pad = bp[Math.floor(Math.random() * bp.length)];
      v.pad = pad; v.mode = "toRide";
    }
    function moveToward(v, tx, ty, sp, dt) {
      var dx = tx - v.x, dy = ty - v.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var step2 = sp * dt;
      if (step2 >= d) { v.x = tx; v.y = ty; return true; }
      v.x += dx / d * step2; v.y += dy / d * step2; return false;
    }
    function dropLitter(x, y) {
      if (litter.length >= LITTER_CAP) return;
      litter.push({ x: x + (Math.random() - 0.5) * 44, y: y + 18 + (Math.random() - 0.5) * 20 });
    }

    // ---------- the simulation step (dt-driven; NO Date.now) ----------
    function step(dt) {
      var r = rating();
      // guests arrive faster the higher your rating (🦁 mascot = +1 rate tier)
      arriveT -= dt;
      if (arriveT <= 0) {
        arriveT = Math.max(0.6, 4.5 - (r + (staff.mascot ? 1 : 0)) * 0.6);
        if (ridePads().length && visitors.length < VISITOR_CAP) spawnGuest();
      }
      var grumpy = litter.length > 8; // a messy park makes guests pay less & leave sooner
      var GW = 95; // guest walk speed (logical units/s)
      for (var vi = visitors.length - 1; vi >= 0; vi--) {
        var v = visitors[vi];
        v.life += dt; v.bob += dt;
        if (v.mode === "walk") {
          // stroll the loop a beat, then pick a ride
          if (moveToward(v, LOOP[v.wp].x, LOOP[v.wp].y, GW, dt)) {
            v.wp = (v.wp + 1) % LOOP.length;
            if (Math.random() < 0.5) guestPickRide(v);
          }
        } else if (v.mode === "toRide") {
          var pd0 = pads[v.pad];
          if (!pd0 || !pd0.tier) { v.mode = "walk"; continue; } // ride got demolished under them
          if (moveToward(v, padXY(v.pad).x, padXY(v.pad).y, GW, dt)) {
            v.mode = "riding"; v.rideT = rideByTier(pd0.tier).tickRate; v.jamWait = 0; pd0.riders = (pd0.riders || 0) + 1;
          }
        } else if (v.mode === "riding") {
          var pd = pads[v.pad];
          if (!pd || !pd.tier) { v.mode = "walk"; continue; }
          if (pd.jammed) {
            // 🔧 ride jammed → no earning until it's tapped 3× to fix; guest waits, then gives up
            v.jamWait += dt;
            if (v.jamWait > 4) { v.mode = "walk"; v.pad = -1; v.jamWait = 0; pd.riders = Math.max(0, (pd.riders || 0) - 1); }
            continue;
          }
          v.rideT -= dt;
          if (v.rideT <= 0) {
            // 💰 paid! the guest completes the cycle and hands over the fare
            var base = rideByTier(pd.tier).fare * fareMul() * decorationBoost(v.pad);
            var m = 1;
            if (v.type === "vip") m = 3;                     // 🤩 pay triple
            else if (v.type === "parent" && r >= 4) m = 1.2; // 🧑 +20% at a 4⭐ park
            if (grumpy) m *= 0.6;                            // 🍬 messy park tips less
            var fare = Math.max(1, Math.round(base * m));
            gold += fare; earned += fare;
            pd.earned = (pd.earned || 0) + fare; pd.riders = Math.max(0, (pd.riders || 0) - 1);
            floats.push({ x: padXY(v.pad).x, y: padXY(v.pad).y - 30, t: 1.1, n: fare, vip: v.type === "vip" });
            if (sfx && sfx.coin && Math.random() < 0.5) sfx.coin();
            if (Math.random() < 0.14) dropLitter(padXY(v.pad).x, padXY(v.pad).y); // guests litter
            v.lastPad = v.pad; v.rode++;
            // wander to another ride, or leave after a few rides (sooner if grumpy)
            if (v.rode >= (grumpy ? 1 : 2) + Math.floor(Math.random() * 3)) v.mode = "leave";
            else { v.mode = "walk"; v.pad = -1; }
            checkGoals(); hud();
          }
        } else if (v.mode === "leave") {
          if (moveToward(v, GATE.x, GATE.y, GW, dt)) visitors.splice(vi, 1);
        }
      }
      // 🔧 random ride jam every ~90s (unless an Engineer is on staff)
      if (!staff.engineer) {
        jamTimer -= dt;
        if (jamTimer <= 0) {
          jamTimer = JAM_EVERY + Math.random() * 30;
          var rp = ridePads().filter(function (p) { return !pads[p].jammed; });
          if (rp.length) { var jp = rp[Math.floor(Math.random() * rp.length)]; pads[jp].jammed = true; pads[jp].fixTaps = 0; big("🔧 The " + rideByTier(pads[jp].tier).name + " jammed! Tap it 3× to fix!", "#ffd740"); }
        }
      }
      // 🧹 janitor sweeps a piece of litter now and then
      if (staff.janitor && litter.length) { cleanT -= dt; if (cleanT <= 0) { cleanT = 2.5; litter.shift(); } }
      // ✨ rating-5 fireworks (once until it drops again)
      if (rating() >= 5) { if (!fw5) { fw5 = true; fireworks(); big("🎆 5⭐ PARK! Everybody loves it!", "#ffd23f"); } }
      else fw5 = false;
      // 🦁 mascot wanders the loop
      if (staff.mascot) {
        if (!mascot) mascot = { x: GATE.x, y: GATE.y, wp: 0, bob: 0 };
        mascot.bob += dt;
        if (moveToward(mascot, LOOP[mascot.wp].x, LOOP[mascot.wp].y, 60, dt)) mascot.wp = (mascot.wp + 1) % LOOP.length;
      }
      // 🎈 ambient balloons drift up from balloon stands
      ambientT -= dt;
      if (ambientT <= 0) {
        ambientT = 2.2;
        var bpads = []; pads.forEach(function (pd, i) { if (pd && pd.deco && pd.key === "balloon") bpads.push(i); });
        if (bpads.length && balloons.length < 8) { var bp = padXY(bpads[Math.floor(Math.random() * bpads.length)]); balloons.push({ x: bp.x + (Math.random() - 0.5) * 20, y: bp.y - 20, t: 3.2 }); }
      }
      for (var bi = balloons.length - 1; bi >= 0; bi--) { balloons[bi].t -= dt; balloons[bi].y -= 20 * dt; if (balloons[bi].t <= 0) balloons.splice(bi, 1); }
      // floaty "+N" gold texts drift up and fade
      for (var fi = floats.length - 1; fi >= 0; fi--) { floats[fi].t -= dt; floats[fi].y -= 22 * dt; if (floats[fi].t <= 0) floats.splice(fi, 1); }
      // gentle ride spin/animation
      pads.forEach(function (pd) { if (pd) pd.spin += dt; });
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, rr) { ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath(); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // grass gradient over the whole screen
      var g1 = ctx.createLinearGradient(0, 0, 0, H); g1.addColorStop(0, "#7ec850"); g1.addColorStop(1, "#5aa838");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      // the park panel (logical space) with a soft border
      ctx.fillStyle = "#8fd45f"; rrect(X(10), Y(10), pz(MW - 20), pz(MH - 20), pz(24)); ctx.fill();
      // path loop: a warm ring following the waypoints
      ctx.strokeStyle = "#d9c39a"; ctx.lineWidth = pz(34); ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      LOOP.forEach(function (pt, i) { var fx = X(pt.x), fy = Y(pt.y); if (i === 0) ctx.moveTo(fx, fy); else ctx.lineTo(fx, fy); });
      ctx.closePath(); ctx.stroke();
      // the gate at the bottom
      ctx.font = Math.round(pz(40)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🎪", X(GATE.x), Y(GATE.y + 6));
      // build pads: dashed rects (empty) / animated ride / decoration
      var padPx = pz(84);
      pads.forEach(function (pd, i) {
        var px = X(padXY(i).x), py = Y(padXY(i).y);
        if (!pd) {
          ctx.save();
          ctx.setLineDash([pz(9), pz(7)]); ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = pz(3);
          rrect(px - padPx / 2, py - padPx / 2, padPx, padPx, pz(12)); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.55; ctx.font = "bold " + Math.round(pz(15)) + "px Trebuchet MS"; ctx.fillStyle = "#3c6b1f";
          ctx.fillText("+ build", px, py);
          ctx.restore();
        } else if (pd.deco) {
          var db = Math.sin(pd.spin * 2 + i) * pz(3);
          ctx.font = Math.round(pz(42)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(pd.emoji, px, py + db);
        } else {
          var def = rideByTier(pd.tier);
          // little animation per ride: gentle bob + a rotating hint (jammed = a nervous wobble)
          var bob = Math.sin(pd.spin * 2.2 + i) * pz(4);
          var sc = pz(56);
          ctx.save();
          ctx.translate(px, py + bob);
          if (pd.jammed) ctx.rotate(Math.sin(pd.spin * 20) * 0.14);
          else if (def.key === "carousel" || def.key === "ferris" || def.key === "wheel" || def.key === "rainbow" || def.key === "megaplex") ctx.rotate(Math.sin(pd.spin) * 0.12);
          ctx.font = Math.round(sc) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(def.emoji, 0, 0);
          ctx.restore();
          if (decorationBoost(i) > 1) { ctx.font = Math.round(pz(16)) + "px serif"; ctx.fillText("✨", px + padPx / 2 - pz(6), py - padPx / 2 + pz(8)); }
          if (pd.jammed) {
            ctx.font = "bold " + Math.round(pz(13)) + "px Trebuchet MS"; ctx.fillStyle = "#e08a2f";
            ctx.fillText("🔧 TAP 3× (" + (pd.fixTaps || 0) + "/3)", px, py + padPx / 2 + pz(4));
          } else if (pd.riders > 0) {
            ctx.font = "bold " + Math.round(pz(13)) + "px Trebuchet MS"; ctx.fillStyle = "#fff";
            ctx.fillText("🎟 " + pd.riders, px, py + padPx / 2 + pz(4));
          }
        }
      });
      // litter
      litter.forEach(function (l) {
        ctx.font = Math.round(pz(18)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🍬", X(l.x), Y(l.y));
      });
      // guests (VIPs sparkle)
      visitors.forEach(function (v) {
        var bob = v.mode === "riding" ? Math.sin(v.bob * 8) * pz(7) : Math.sin(v.bob * 6) * pz(2);
        ctx.font = Math.round(pz(v.type === "vip" ? 28 : 26)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (v.type === "vip") { ctx.font = Math.round(pz(15)) + "px serif"; ctx.fillText("✨", X(v.x) - pz(12), Y(v.y) - bob - pz(10)); ctx.font = Math.round(pz(28)) + "px serif"; }
        ctx.fillText(v.emoji, X(v.x), Y(v.y) - bob);
      });
      // 🦁 mascot
      if (mascot) { ctx.font = Math.round(pz(28)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🦁", X(mascot.x), Y(mascot.y) - Math.sin(mascot.bob * 6) * pz(3)); }
      // 🎈 ambient balloons
      balloons.forEach(function (b) {
        ctx.globalAlpha = Math.max(0, Math.min(1, b.t / 3.2));
        ctx.font = Math.round(pz(22)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🎈", X(b.x), Y(b.y)); ctx.globalAlpha = 1;
      });
      // floaty "+N" gold texts
      floats.forEach(function (f) {
        ctx.globalAlpha = Math.max(0, Math.min(1, f.t));
        ctx.font = "bold " + Math.round(pz(f.vip ? 24 : 20)) + "px Trebuchet MS"; ctx.fillStyle = f.vip ? "#ffec80" : "#ffd23f"; ctx.textAlign = "center";
        ctx.fillText("+" + f.n + " 🟡", X(f.x), Y(f.y));
        ctx.globalAlpha = 1;
      });
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input (phantom-tap safe: discrete, single-fire) ----------
    function padAt(mx, my) {
      for (var i = 0; i < pads.length; i++) {
        var pxy = padXY(i);
        if (Math.abs(mx - pxy.x) < 52 && Math.abs(my - pxy.y) < 52) return i;
      }
      return -1;
    }
    function fixTap(pad) {
      var pd = pads[pad]; if (!pd || !pd.tier || !pd.jammed) return;
      pd.fixTaps = (pd.fixTaps || 0) + 1;
      if (juice) juice.burst(X(padXY(pad).x), Y(padXY(pad).y), "#ffd23f", 8);
      if (sfx && sfx.pop) sfx.pop();
      if (pd.fixTaps >= 3) { pd.jammed = false; pd.fixTaps = 0; big("🔧 Fixed! Silly sparks fly — the " + rideByTier(pd.tier).name + " runs again!", "#69f0ae"); }
      else big("🔧 Tap tap! (" + pd.fixTaps + "/3)", "#ffd740");
      hud();
    }
    function tapPad(pad) {
      var pd = pads[pad];
      if (pd && pd.tier && pd.jammed) { fixTap(pad); return; } // tap a jammed ride to fix it
      openPadCard(pad);
    }
    function tap(sx, sy) {
      if (permitOpen || cashQuizOpen || expandOpen) return;
      var mx = (sx - OX) / S, my = (sy - OY) / S;
      // clean litter first (tapping trash sweeps it)
      for (var li = litter.length - 1; li >= 0; li--) {
        if (Math.abs(mx - litter[li].x) < 28 && Math.abs(my - litter[li].y) < 28) {
          litter.splice(li, 1); if (juice) juice.burst(X(mx), Y(my), "#f79ad3", 8); if (sfx && sfx.pop) sfx.pop(); hud(); return;
        }
      }
      var pad = padAt(mx, my);
      if (pad >= 0) tapPad(pad);
    }
    // single-fire discrete taps: touchstart preventDefault + mousedown
    cv.addEventListener("touchstart", function (e) {
      e.preventDefault();
      var r = cv.getBoundingClientRect();
      tap(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top);
    }, { passive: false });
    cv.addEventListener("mousedown", function (e) {
      var r = cv.getBoundingClientRect();
      tap(e.clientX - r.left, e.clientY - r.top);
    });

    // ---------- HUD buttons ----------
    document.getElementById("pkpermit").onclick = openPermit;
    document.getElementById("pkshop").onclick = openShop;
    document.getElementById("pkcash").onclick = cashOut;
    document.getElementById("pkrebuild").onclick = doPrestige;

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; // clamp, no Date.now logic
      if (!permitOpen && !cashQuizOpen && !expandOpen) step(dt);
      draw();
    }

    // ---------- exit / banking on close ----------
    // leaving (or closing the app) always banks any un-cashed earnings — quitting must
    // NEVER lose progress, so it needs NO word. It DOES share the diminishing rate.
    function bankExit() {
      if (earned <= 0 && unlockedTier <= 1) return; // nothing worth banking
      var bank = bankRun();
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) {
        global.VobloxSfx.toast("🎢 Park run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
      }
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      persist(); // save the park layout one last time
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test hook ----------
    cv._park = {
      state: function () {
        return {
          gold: gold,
          pads: pads.map(function (pd) { return pd ? (pd.tier ? { tier: pd.tier } : { deco: pd.key }) : null; }),
          unlockedTier: unlockedTier,
          visitors: visitors.length,
          rating: rating(),
          earned: earned,
          prestige: prestige,
          banked: banked,
          permitOpen: permitOpen,
          cashQuizOpen: cashQuizOpen,
          expandOpen: expandOpen,
          expansions: expansions
        };
      },
      give: function (n) { gold += n; hud(); },
      earn: function (n) { earned += n; gold += n; checkGoals(); hud(); }, // deterministic earnings (tests)
      build: function (pad, tier) { buildAt(pad, tier); persist(); hud(); }, // force ride (test)
      buyBuild: function (pad, tier) { return buyBuild(pad, tier); },        // real ride path
      buyDeco: function (pad, key) { return buyDeco(pad, key); },            // real decoration path
      placeDeco: function (pad, key) { placeDecoAt(pad, key); persist(); hud(); return pads[pad]; }, // force (test)
      decorationBoost: function (pad) { return decorationBoost(pad); },
      permit: openPermit,
      expand: function () { return expand(); },
      tick: function (s) { // same code path as frames: subdivide into frame-sized steps
        var left = s;
        while (left > 0) { var d = Math.min(0.05, left); step(d); left -= d; }
      },
      demolish: function (pad) { demolish(pad); },
      cashOut: cashOut,                       // opens the word quiz (specs answer via cv._lastQ)
      cashOutForce: function () { doCashOut(); }, // skips the word (bankExit-style internal reuse)
      cashOutCount: function () { return cashOutCount; },
      lastReward: function () { return lastRw; },
      prestige: doPrestige,
      openPad: function (pad) { openPadCard(pad); }, // convenience for card specs
      openShop: openShop,
      hireStaff: function (id) { return hireStaff(id); },
      staff: function () { return { janitor: staff.janitor, mascot: staff.mascot, engineer: staff.engineer }; },
      spawnGuest: function (type) { spawnGuest(type); },
      jamRide: function (pad) { var pd = pads[pad]; if (pd && pd.tier) { pd.jammed = true; pd.fixTaps = 0; } },
      fixRide: function (pad) { fixTap(pad); return !!(pads[pad] && pads[pad].tier && pads[pad].jammed); }, // returns still-jammed?
      litter: function () { return litter.length; },
      addLitter: function (n) { for (var k = 0; k < (n || 1); k++) dropLitter(120 + Math.random() * 400, 120 + Math.random() * 280); return litter.length; },
      goals: function () { return goals.map(function (g) { return { id: g.id, text: g.text, target: g.target, reward: g.reward, progress: goalProgress(g), done: g.done }; }); },
      rides: RIDES, decos: DECOS, staffDefs: STAFF
    };

    hud();
    big("🎢 Build rides, earn 🟡 gold, spell for 📋 PERMITS!", "#ffe14d");

    // guarded demo hook: seed a lively rating-4 park so a glance shows the game alive
    if (global._parkdemo) setTimeout(function () {
      global._parkdemo = 0;
      unlockedTier = 6; gold = 4000;
      buildAt(0, 1); buildAt(2, 3); buildAt(4, 4); buildAt(6, 2); buildAt(8, 5);
      placeDecoAt(1, "tree"); placeDecoAt(3, "balloon"); placeDecoAt(5, "fountain");
      staff.janitor = true; staff.mascot = true; // lively + wandering mascot
      // a few guests mid-visit: some walking, some riding, one VIP
      spawnGuest("kid"); spawnGuest("parent"); spawnGuest("kid"); spawnGuest("vip"); spawnGuest("parent"); spawnGuest("kid");
      visitors[0].mode = "riding"; visitors[0].pad = 0; visitors[0].rideT = 2;
      visitors[1].mode = "riding"; visitors[1].pad = 4; visitors[1].rideT = 1.5;
      visitors[2].mode = "toRide"; visitors[2].pad = 2;
      hud();
    }, 700);

    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxPark = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
