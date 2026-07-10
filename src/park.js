/*
 * Voblox mini-game — 🎢 Word Park (a Roblox-style theme-park tycoon).
 * Leo builds a park: 9 fixed pads around a path loop, seven tiers of rides from
 * a 🎠 Carousel up to the 🌈 RAINBOW LOOPER. Little emoji guests stream in the
 * gate, queue for a ride, bob along, pay a fare (+N gold floats up), then wander
 * to another ride or leave. More & better rides = higher ⭐ rating = faster guests.
 *
 * VOCAB IS THE GATE: ride tiers unlock IN ORDER, and each new tier needs a
 * 📋 BUILD PERMIT — a word (miniQuiz). Answer right → the next tier opens. That's
 * the whole learning loop: to build fancier rides you keep spelling.
 *
 * The visible economy (books.js pattern): the run's Vobux payout scales with
 * gold EARNED this session (guests paying), NOT the park's stored wealth — no
 * idle money printer. bankRun() fires on 💰 Cash out, on quit, and on tab-close,
 * and always SHOWS the payout card so Leo can SEE his Vobux.
 *
 * SESSION-only by design (a hard rule from Au): no idle/offline earnings, no
 * daily mechanics. But the park LAYOUT + gold persist via stats.parkSave, so
 * coming back resumes the same park you left.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var MW = 640, MH = 520; // one logical space, letterboxed both orientations

  // the 7 ride tiers, word-gated in order. cost = park-gold to build,
  // fare = gold a guest pays per completed ride cycle, tickRate = cycle length (s).
  var RIDES = [
    { key: "carousel", name: "Carousel", emoji: "🎠", cost: 50, fare: 4, tickRate: 3.5 },
    { key: "slide", name: "Mega Slide", emoji: "🛝", cost: 120, fare: 8, tickRate: 3.2 },
    { key: "ferris", name: "Ferris Wheel", emoji: "🎡", cost: 300, fare: 16, tickRate: 3.6 },
    { key: "coaster", name: "Coaster", emoji: "🎢", cost: 700, fare: 32, tickRate: 3.0 },
    { key: "castle", name: "Haunted Castle", emoji: "🏰", cost: 1500, fare: 60, tickRate: 3.4 },
    { key: "rocket", name: "Rocket Drop", emoji: "🚀", cost: 3000, fare: 110, tickRate: 2.8 },
    { key: "rainbow", name: "RAINBOW LOOPER", emoji: "🌈", cost: 6000, fare: 210, tickRate: 2.6 }
  ];
  var START_GOLD = 80;
  var VISITOR_CAP = 14; // perf + readability: never more guests than this on screen
  var GUEST_EMOJI = ["🧒", "👧", "👦", "👩", "👨"];

  // 9 fixed build pads arranged around the path loop (logical coords, pad center)
  var PADS = [
    { x: 150, y: 120 }, { x: 320, y: 105 }, { x: 490, y: 120 },
    { x: 130, y: 260 }, { x: 320, y: 260 }, { x: 510, y: 260 },
    { x: 150, y: 400 }, { x: 320, y: 415 }, { x: 490, y: 400 }
  ];
  // the walking loop guests follow (a rounded rectangle of waypoints, clockwise)
  var LOOP = [
    { x: 90, y: 175 }, { x: 90, y: 345 }, { x: 230, y: 460 }, { x: 410, y: 460 },
    { x: 550, y: 345 }, { x: 550, y: 175 }, { x: 410, y: 60 }, { x: 230, y: 60 }
  ];
  var GATE = { x: 320, y: 490 }; // guests enter (and leave) here, bottom-center

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
      '<button class="replay" id="pkcash" type="button">💰 Cash out</button>' +
      '<button class="replay" id="pkrebuild" type="button" style="display:none">🌟 REBUILD</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="pkbig"></div>' +
      '<div class="gover" id="pkq" style="display:none"></div>' +
      '<div class="gover" id="pkend" style="display:none"></div>' +
      '<div class="gover" id="pkcard" style="display:none"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#pkcv"), ctx = cv.getContext("2d");

    // ---------- responsive letterbox (one logic space, both orientations) ----------
    var W, H, S, OX, OY;
    function resize() {
      W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight;
      var reserve = 96; // room for the HUD bar up top
      S = Math.min(W / MW, (H - reserve) / MH);
      OX = (W - MW * S) / 2;
      OY = reserve + (H - reserve - MH * S) / 2;
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
    var unlockedTier = 1;      // how many tiers are permitted (1..7); tier 1 is free
    var prestige = 0;          // 🌟 rebuilds done — each ×1.5 to all fares
    var earned = 0;            // gold EARNED this session (drives the Vobux payout)
    var pads = [];             // 9 slots: null | { tier, emoji, key, ride runtime... }
    var visitors = [];         // little guests walking / queueing / riding
    var floats = [];           // "+N" gold texts drifting up
    var arriveT = 2;           // countdown to the next guest
    var banked = false;        // this banking window already cashed?
    var permitOpen = false;    // is a permit quiz on screen?
    var built0 = 0;            // whether a rainbow has EVER been built (prestige gate)
    for (var i = 0; i < 9; i++) pads.push(null);

    // restore a saved park (layout + gold + progress) so returning resumes it
    if (save) {
      gold = typeof save.gold === "number" ? save.gold : START_GOLD;
      unlockedTier = save.unlockedTier || 1;
      prestige = save.prestige || 0;
      if (save.pads) for (var p = 0; p < 9 && p < save.pads.length; p++) {
        if (save.pads[p] && save.pads[p].tier) buildAt(p, save.pads[p].tier, true);
      }
    }

    function fareMul() { return Math.pow(1.5, prestige); } // 🌟 prestige multiplies fares

    // ---------- persistence (additive, never stats.best) ----------
    function persist() {
      stats.parkSave = {
        gold: gold, unlockedTier: unlockedTier, prestige: prestige,
        pads: pads.map(function (pd) { return pd ? { tier: pd.tier } : null; })
      };
      store.save();
    }

    // ---------- HUD ----------
    var msgEl = document.getElementById("pkmsg"), bigEl = document.getElementById("pkbig");
    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1300);
    }
    // ⭐ park rating 1-5: grows with how many rides you've built and how fancy
    function rating() {
      var built = 0, tierSum = 0;
      pads.forEach(function (pd) { if (pd) { built++; tierSum += pd.tier; } });
      if (!built) return 1;
      var score = built * 0.35 + tierSum * 0.28;
      return Math.max(1, Math.min(5, 1 + Math.floor(score)));
    }
    function hud() {
      document.getElementById("pkgold").textContent = "🟡 " + Math.floor(gold);
      var r = rating();
      document.getElementById("pkrate").textContent = "⭐".repeat(r) + (prestige > 0 ? "  🌟×" + prestige : "");
      // 📋 PERMIT button: shows the next locked tier (if any)
      var pb = document.getElementById("pkpermit");
      if (unlockedTier < RIDES.length) {
        var nxt = RIDES[unlockedTier];
        pb.style.display = ""; pb.textContent = "📋 PERMIT → " + nxt.emoji;
      } else pb.style.display = "none";
      // 🌟 rebuild button appears once a rainbow has ever been built
      document.getElementById("pkrebuild").style.display = built0 ? "" : "none";
    }

    // ---------- building ----------
    // buildAt is the raw placement (used by restore + the test .build force path)
    function buildAt(pad, tier, silent) {
      var def = RIDES[tier - 1];
      pads[pad] = { tier: tier, key: def.key, emoji: def.emoji, cycle: 0, riders: 0, spin: Math.random() * 6 };
      if (tier === RIDES.length) built0 = 1; // a rainbow exists → prestige unlocked
      if (!silent) {
        if (juice) juice.burst(X(PADS[pad].x), Y(PADS[pad].y), "#ffd23f", 16);
        if (sfx && sfx.pop) sfx.pop();
      }
    }
    // the REAL build path: check unlock + affordability, spend gold, place it
    function buyBuild(pad, tier) {
      if (pad < 0 || pad > 8 || pads[pad]) return false;
      if (tier < 1 || tier > RIDES.length) return false;
      if (tier > unlockedTier) { big("🔒 Get a 📋 PERMIT to unlock that ride!", "#ffd740"); return false; }
      var def = RIDES[tier - 1];
      if (gold < def.cost) { big("Not enough 🟡 gold for a " + def.name + "!", "#ffd740"); return false; }
      gold -= def.cost;
      buildAt(pad, tier);
      big("🎉 " + def.emoji + " " + def.name + " built!", "#9be15d");
      persist(); hud(); closeCard();
      return true;
    }
    function demolish(pad) {
      var pd = pads[pad]; if (!pd) return;
      var back = Math.floor(RIDES[pd.tier - 1].cost * 0.5); // 50% refund
      pads[pad] = null; gold += back;
      // send any guests riding this pad back to wandering
      visitors.forEach(function (v) { if (v.pad === pad) { v.pad = -1; v.mode = "walk"; } });
      if (juice) juice.burst(X(PADS[pad].x), Y(PADS[pad].y), "#cfd6dd", 14);
      if (sfx && sfx.whoosh) sfx.whoosh();
      big("🔨 Demolished — +" + back + " 🟡 back", "#8ecdf7");
      persist(); hud(); closeCard();
    }

    // ---------- build / info cards ----------
    var cardEl = document.getElementById("pkcard");
    function closeCard() { cardEl.style.display = "none"; cardEl.innerHTML = ""; }
    function openPadCard(pad) {
      if (permitOpen) return;
      if (pads[pad]) return openRideCard(pad);
      // build menu: every UNLOCKED tier you can afford (cheapest first)
      var rows = RIDES.map(function (def, idx) {
        var tier = idx + 1;
        if (tier > unlockedTier) return "";
        var can = gold >= def.cost;
        return '<button class="embtn" style="min-width:130px' + (can ? "" : ";opacity:.5") + '" data-bt="' + tier + '">' +
          '<span class="ebl">' + def.emoji + " " + def.cost + ' 🟡</span>' +
          '<span class="ebs">' + def.name + " · +" + Math.round(def.fare * fareMul()) + "/ride</span></button>";
      }).join("");
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:420px">' +
        '<div class="wqtitle">🏗 Build a ride here</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🟡 ' + Math.floor(gold) + ' gold · tap a ride to build it</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + rows + "</div>" +
        (unlockedTier < RIDES.length ? '<div style="font-size:11px;color:#8a98a8;margin-top:8px">Next ride needs a 📋 PERMIT (answer a word!)</div>' : "") +
        '<button class="wqskip" id="pk_cardback" type="button">close</button></div>';
      cardEl.style.display = "flex";
      Array.prototype.forEach.call(cardEl.querySelectorAll("[data-bt]"), function (b) {
        b.onclick = function () { buyBuild(pad, +b.dataset.bt); };
      });
      document.getElementById("pk_cardback").onclick = closeCard;
    }
    function openRideCard(pad) {
      var pd = pads[pad], def = RIDES[pd.tier - 1];
      var back = Math.floor(def.cost * 0.5);
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:380px">' +
        '<div style="font-size:48px">' + def.emoji + '</div>' +
        '<div class="wqtitle">' + def.name + '</div>' +
        '<div style="font-size:13px;color:#5a6b7a;margin:4px 0">Fare: +' + Math.round(def.fare * fareMul()) + ' 🟡 each ride · earned so far: ' + Math.floor(pd.earned || 0) + ' 🟡</div>' +
        '<button class="submit" id="pk_demo" style="background:#e57373">🔨 Demolish for +' + back + ' 🟡 (50%)</button>' +
        '<br><button class="wqskip" id="pk_cardback2" type="button">close</button></div>';
      cardEl.style.display = "flex";
      document.getElementById("pk_demo").onclick = function () { demolish(pad); };
      document.getElementById("pk_cardback2").onclick = closeCard;
    }

    // ---------- 📋 the permit quiz (the learning hook) ----------
    var lastFmt = null;
    function openPermit() {
      if (permitOpen || unlockedTier >= RIDES.length) return;
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
      pads = []; for (var k = 0; k < 9; k++) pads.push(null);
      visitors = []; floats = [];
      gold = START_GOLD;
      built0 = 0; // must build a new rainbow to rebuild again
      // (unlockedTier is kept — you keep your learned permits; fares are now ×1.5 more)
      big("🌟 REBUILT BIGGER! All future fares ×" + fareMul().toFixed(2) + "!", "#ffd23f");
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(8); for (var cf = 0; cf < 6; cf++) juice.burst(W * (0.2 + cf * 0.12), H * 0.4, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb", "#ffa726"][cf], 18); }
      persist(); hud();
    }

    // ---------- the economy: bank the run, SHOW the payout ----------
    function runRewards() {
      // Vobux scale with gold EARNED this session + a bonus per permit unlocked.
      var tierBonus = (unlockedTier - 1) * 6; // each new tier permitted = a study win
      var gems = Math.min(70, Math.round(5 + earned / 60 + tierBonus));
      return {
        win: true,
        score: Math.round(earned) + prestige * 200,
        rankPtsDelta: Math.min(10, 2 + Math.floor(earned / 300) + prestige),
        xp: Math.min(70, Math.round(8 + earned / 40 + (unlockedTier - 1) * 4)),
        gems: gems
      };
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = runRewards();
      var res = store.recordGame ? store.recordGame("park", rw) : null;
      return { rw: rw, res: res };
    }
    // 💰 Cash out: bank + SHOW the card so Leo SEES his Vobux, then a fresh window
    function cashOut() {
      var bank = bankRun();
      if (!bank) return;
      var rw = bank.rw, res = bank.res;
      var end = document.getElementById("pkcard");
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:420px">' +
        '<div style="font-size:44px">💰🎢</div>' +
        '<div class="wqtitle" style="font-size:20px">Park payout!</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP</div>" +
        '<div style="margin:2px 0;font-size:13px;color:#5a6b7a">🟡 ' + Math.round(earned) + ' gold earned this visit · ⭐ rating ' + rating() + (prestige ? " · 🌟×" + prestige : "") + (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        '<button class="submit big-next" id="pk_keep">Keep building ➜</button></div>';
      end.style.display = "flex";
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(5); for (var cf = 0; cf < 4; cf++) juice.burst(W * (0.25 + cf * 0.18), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b"][cf], 14); }
      document.getElementById("pk_keep").onclick = function () {
        end.style.display = "none"; end.innerHTML = "";
        // fresh banking window: a new cash-out can bank the NEXT stretch of earnings
        banked = false; earned = 0;
        hud();
      };
    }

    // ---------- guests (the visible economy in motion) ----------
    function builtPads() { var out = []; pads.forEach(function (pd, i) { if (pd) out.push(i); }); return out; }
    function spawnGuest() {
      if (visitors.length >= VISITOR_CAP) return;
      visitors.push({
        emoji: GUEST_EMOJI[Math.floor(Math.random() * GUEST_EMOJI.length)],
        x: GATE.x, y: GATE.y, wp: 0, // walking toward loop waypoint wp
        mode: "walk", pad: -1, rideT: 0, bob: Math.random() * 6, life: 0, rode: 0
      });
    }
    function guestPickRide(v) {
      var bp = builtPads();
      if (!bp.length) { v.mode = "leave"; return; }
      // wander to a random built ride (skip the one just ridden if possible)
      var choices = bp.filter(function (p) { return p !== v.lastPad; });
      if (!choices.length) choices = bp;
      v.pad = choices[Math.floor(Math.random() * choices.length)];
      v.mode = "toRide";
    }
    function moveToward(v, tx, ty, sp, dt) {
      var dx = tx - v.x, dy = ty - v.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var step2 = sp * dt;
      if (step2 >= d) { v.x = tx; v.y = ty; return true; }
      v.x += dx / d * step2; v.y += dy / d * step2; return false;
    }

    // ---------- the simulation step (dt-driven; NO Date.now) ----------
    function step(dt) {
      var r = rating();
      // guests arrive faster the higher your rating (and if you have any ride)
      arriveT -= dt;
      if (arriveT <= 0) {
        arriveT = Math.max(0.8, 4.5 - r * 0.6);
        if (builtPads().length && visitors.length < VISITOR_CAP) spawnGuest();
      }
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
          if (!pd0) { v.mode = "walk"; continue; } // ride got demolished under them
          if (moveToward(v, PADS[v.pad].x, PADS[v.pad].y, GW, dt)) {
            v.mode = "riding"; v.rideT = RIDES[pd0.tier - 1].tickRate; pd0.riders = (pd0.riders || 0) + 1;
          }
        } else if (v.mode === "riding") {
          var pd = pads[v.pad];
          if (!pd) { v.mode = "walk"; continue; }
          v.rideT -= dt;
          if (v.rideT <= 0) {
            // 💰 paid! the guest completes the cycle and hands over the fare
            var fare = Math.round(RIDES[pd.tier - 1].fare * fareMul());
            gold += fare; earned += fare;
            pd.earned = (pd.earned || 0) + fare; pd.riders = Math.max(0, (pd.riders || 0) - 1);
            floats.push({ x: PADS[v.pad].x, y: PADS[v.pad].y - 30, t: 1.1, n: fare });
            if (sfx && sfx.coin && Math.random() < 0.5) sfx.coin();
            v.lastPad = v.pad; v.rode++;
            // wander to another ride, or leave after a few rides
            if (v.rode >= 2 + Math.floor(Math.random() * 3)) v.mode = "leave";
            else { v.mode = "walk"; v.pad = -1; }
            hud();
          }
        } else if (v.mode === "leave") {
          if (moveToward(v, GATE.x, GATE.y, GW, dt)) visitors.splice(vi, 1);
        }
      }
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
      // build pads: dashed rounded rects (empty) or a big animated ride emoji (built)
      var padPx = pz(84);
      pads.forEach(function (pd, i) {
        var px = X(PADS[i].x), py = Y(PADS[i].y);
        if (!pd) {
          ctx.save();
          ctx.setLineDash([pz(9), pz(7)]); ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = pz(3);
          rrect(px - padPx / 2, py - padPx / 2, padPx, padPx, pz(12)); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.55; ctx.font = "bold " + Math.round(pz(15)) + "px Trebuchet MS"; ctx.fillStyle = "#3c6b1f";
          ctx.fillText("+ build", px, py);
          ctx.restore();
        } else {
          var def = RIDES[pd.tier - 1];
          // little animation per ride: gentle bob + a rotating hint
          var bob = Math.sin(pd.spin * 2.2 + i) * pz(4);
          var sc = pz(56);
          ctx.save();
          ctx.translate(px, py + bob);
          // rides that "turn" get a slow rotation for life
          if (def.key === "carousel" || def.key === "ferris" || def.key === "rainbow") ctx.rotate(Math.sin(pd.spin) * 0.12);
          ctx.font = Math.round(sc) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(def.emoji, 0, 0);
          ctx.restore();
          // a riders badge
          if (pd.riders > 0) {
            ctx.font = "bold " + Math.round(pz(13)) + "px Trebuchet MS"; ctx.fillStyle = "#fff";
            ctx.fillText("🎟 " + pd.riders, px, py + padPx / 2 + pz(4));
          }
        }
      });
      // guests
      visitors.forEach(function (v) {
        var bob = v.mode === "riding" ? Math.sin(v.bob * 8) * pz(7) : Math.sin(v.bob * 6) * pz(2);
        ctx.font = Math.round(pz(26)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(v.emoji, X(v.x), Y(v.y) - bob);
      });
      // floaty "+N" gold texts
      floats.forEach(function (f) {
        ctx.globalAlpha = Math.max(0, Math.min(1, f.t));
        ctx.font = "bold " + Math.round(pz(20)) + "px Trebuchet MS"; ctx.fillStyle = "#ffd23f"; ctx.textAlign = "center";
        ctx.fillText("+" + f.n + " 🟡", X(f.x), Y(f.y));
        ctx.globalAlpha = 1;
      });
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input (phantom-tap safe: discrete, single-fire) ----------
    function padAt(mx, my) {
      for (var i = 0; i < 9; i++) {
        if (Math.abs(mx - PADS[i].x) < 52 && Math.abs(my - PADS[i].y) < 52) return i;
      }
      return -1;
    }
    function tap(sx, sy) {
      if (permitOpen) return;
      var mx = (sx - OX) / S, my = (sy - OY) / S;
      var pad = padAt(mx, my);
      if (pad >= 0) openPadCard(pad);
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
    document.getElementById("pkcash").onclick = cashOut;
    document.getElementById("pkrebuild").onclick = doPrestige;

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; // clamp, no Date.now logic
      if (!permitOpen) step(dt);
      draw();
    }

    // ---------- exit / banking on close ----------
    // leaving (or closing the app) always banks any un-cashed earnings, with a toast.
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
          pads: pads.map(function (pd) { return pd ? { tier: pd.tier } : null; }),
          unlockedTier: unlockedTier,
          visitors: visitors.length,
          rating: rating(),
          earned: earned,
          prestige: prestige,
          banked: banked,
          permitOpen: permitOpen
        };
      },
      give: function (n) { gold += n; hud(); },
      build: function (pad, tier) { buildAt(pad, tier); persist(); hud(); }, // force (test)
      buyBuild: function (pad, tier) { return buyBuild(pad, tier); },        // real path
      permit: openPermit,
      tick: function (s) { // same code path as frames: subdivide into frame-sized steps
        var left = s;
        while (left > 0) { var d = Math.min(0.05, left); step(d); left -= d; }
      },
      demolish: function (pad) { demolish(pad); },
      cashOut: cashOut,
      prestige: doPrestige,
      openPad: function (pad) { openPadCard(pad); }, // convenience for card specs
      rides: RIDES
    };

    hud();
    big("🎢 Build rides, earn 🟡 gold, spell for 📋 PERMITS!", "#ffe14d");

    // guarded demo hook: seed a lively park so a glance shows the game alive
    if (global._parkdemo) setTimeout(function () {
      global._parkdemo = 0;
      unlockedTier = 5; gold = 900;
      buildAt(0, 1); buildAt(2, 2); buildAt(4, 3); buildAt(6, 4); buildAt(8, 2);
      // a few guests mid-visit: some walking, some riding
      for (var d = 0; d < 6; d++) spawnGuest();
      visitors[0].mode = "riding"; visitors[0].pad = 0; visitors[0].rideT = 2;
      visitors[1].mode = "riding"; visitors[1].pad = 4; visitors[1].rideT = 1.5;
      visitors[2].mode = "toRide"; visitors[2].pad = 2;
      hud();
    }, 700);

    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxPark = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
