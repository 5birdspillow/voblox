/*
 * Voblox arcade game — 🌀 WORD ROYALE (a kid-kind battle-royale-lite).
 * You drop onto a big square island with 11 named rivals (real VobloxBots).
 * WEAPONS AUTO-FIRE at the nearest rival in range — the fun is MOVEMENT and
 * positioning (like Word Survivors). Foam-dart zapping, zero gore: a zapped
 * fighter simply "teleports home". Getting zapped with no 🛡 shields = out.
 * 📦 Loot crates scatter the map: walk over one for a better blaster
 * (pea → dart → burst → mega, each faster & stronger) or a shield bubble
 * (+1 hit protection, max 3). ⭕ A shrinking STORM circle squeezes everyone
 * together over ~3.5 minutes; outside it you take tick damage and a big arrow
 * points you back to safety. Last one standing wins the 👑 VICTORY CROWN.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🌟 GOLDEN CRATES: the best 3-4 crates ask a word (miniQuiz). Correct =
 *     MEGA blaster + full shields; wrong = a friendly pea-blaster consolation.
 *   - 🪽 RESPAWN WING (once per match): eliminated before the top 3? Answer a
 *     word to glide back in. Wrong = your placement stands. No punishment.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("royale")
 * per match, banked on elimination, win, quit, AND app-close — always SHOWN.
 * bestPlace (lower=better) / crowns / elims persist additively.
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  var WORLD = 2200;                 // square island, world units
  var CX = WORLD / 2, CY = WORLD / 2; // storm safe-circle center (fixed = fair)
  var N_BOTS = 11;                  // rivals (you + 11 = 12 fighters)
  var CRATE_COUNT = 25, GOLDEN_COUNT = 4;
  var MATCH_LEN = 210;              // ~3.5 minutes (dt-accumulated)
  var BASE_MOVE = 168;              // world units / second
  var GRAB_R = 34, HIT_R = 22, DART_LIFE_PAD = 0.2;
  var STORM_TICK = 1.3;            // seconds between storm hits while outside

  // blaster tiers: each faster (lower cd) and stronger (range/dart-speed, mega dmg 2)
  var WEAPONS = [
    { name: "Pea", emoji: "🟢", range: 230, cd: 0.85, dmg: 1, ds: 430, col: "#9be15d" },
    { name: "Dart", emoji: "🎯", range: 300, cd: 0.60, dmg: 1, ds: 500, col: "#4fc3f7" },
    { name: "Burst", emoji: "💥", range: 365, cd: 0.40, dmg: 1, ds: 565, col: "#ffd23f" },
    { name: "Mega", emoji: "🔥", range: 445, cd: 0.34, dmg: 2, ds: 645, col: "#ff6b6b" }
  ];
  var PALETTE = ["#ff6b6b", "#ffd23f", "#6bd968", "#4fc3f7", "#b06aff", "#ff9f43",
                 "#f77fbe", "#5fd7c9", "#9be15d", "#ff8a5c", "#7c9cff", "#ffce54"];

  // storm keyframes: [matchT, radius]. Holds, then shrinks, in 4 phases.
  var STORM_KEYS = [[0, 1300], [40, 1300], [80, 950], [115, 950],
                    [145, 620], [175, 620], [198, 300], [210, 300]];
  function stormRadiusAt(tt) {
    var k = STORM_KEYS;
    if (tt <= k[0][0]) return k[0][1];
    for (var i = 0; i < k.length - 1; i++) {
      if (tt >= k[i][0] && tt <= k[i + 1][0]) {
        var f = (tt - k[i][0]) / (k[i + 1][0] - k[i][0] || 1);
        return k[i][1] + (k[i + 1][1] - k[i][1]) * f;
      }
    }
    return k[k.length - 1][1];
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("royale");
    // additive, never-renamed persistence
    if (stats.bestPlace == null) stats.bestPlace = 99; // lower = better
    stats.crowns = stats.crowns || 0;
    stats.elims = stats.elims || 0;

    var skill = (P && P.botSkillFor) ? P.botSkillFor(stats.rankPts || 0) : 0.4;
    var playerName = (store.state && store.state.profile && store.state.profile.name) || "You";

    var wrap = document.createElement("div");
    wrap.className = "gamewrap royale";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="rycv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="rymsg">🌀 Word Royale — grab loot, dodge the storm!</div>' +
      '<div class="grow" style="flex-wrap:wrap"><span id="ryshield">🛡 0</span><span id="ryweap">🟢 Pea</span>' +
      '<span id="ryalive">👥 12/12</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="rybig"></div>' +
      '<div class="gover" id="ryq" style="display:none"></div>' +
      '<div class="gover" id="rycard" style="display:none"></div>';
    document.body.appendChild(wrap);
    // compact, wrap-safe HUD chips so the row FITS 393px (Leave never clips) — digger pattern
    (function () {
      var gr = wrap.querySelector(".ghud .grow"); if (!gr) return;
      gr.style.flexWrap = "wrap"; gr.style.gap = "6px";
      Array.prototype.forEach.call(gr.children, function (el) {
        el.style.flexShrink = "0"; el.style.whiteSpace = "nowrap";
        if (el.tagName === "SPAN") { el.style.fontSize = "14px"; el.style.padding = "4px 8px"; }
      });
    })();

    var cv = wrap.querySelector("#rycv"), ctx = cv.getContext("2d");
    var msgEl = wrap.querySelector("#rymsg"), bigEl = wrap.querySelector("#rybig");
    var qEl = wrap.querySelector("#ryq"), cardEl = wrap.querySelector("#rycard");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H;
    function resize() { W = cv.width = wrap.clientWidth || global.innerWidth || 360; H = cv.height = wrap.clientHeight || global.innerHeight || 640; }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var me, bots = [], crates = [], darts = [], poofs = [];
    var matchT = 0, myElims = 0, stormOverride = null;
    var placement = null, over = false, won = false, paused = false, banked = false;
    var wingUsed = false, wingPending = false, lastFmt = null;
    // programmatic / stick input
    var mvx = 0, mvy = 0, keys = {}, stick = null, stickOX = 0, stickOY = 0;

    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1200); }
    function currentStormR() { return stormOverride != null ? stormOverride : stormRadiusAt(matchT); }
    function distC(f) { var dx = f.x - CX, dy = f.y - CY; return Math.sqrt(dx * dx + dy * dy); }
    function outsideSafe(f) { return distC(f) > currentStormR(); }
    function aliveBots() { var n = 0; for (var i = 0; i < bots.length; i++) if (bots[i].alive) n++; return n; }
    function aliveCount() { return (me && me.alive ? 1 : 0) + aliveBots(); }

    function hud() {
      document.getElementById("ryshield").textContent = "🛡 " + (me ? me.shields : 0);
      var w = WEAPONS[me ? me.weapon : 0];
      document.getElementById("ryweap").textContent = w.emoji + " " + w.name;
      document.getElementById("ryalive").textContent = "👥 " + aliveCount() + "/12";
    }

    // ---------- world setup ----------
    function ringPos(i, total, rad) {
      var a = (i / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
      return { x: CX + Math.cos(a) * rad, y: CY + Math.sin(a) * rad };
    }
    function makeFighter(o) {
      return { name: o.name, isBot: !!o.isBot, skill: o.skill || skill, color: o.color,
        x: o.x, y: o.y, tx: o.x, ty: o.y, alive: true, shields: 0, weapon: 0,
        fireCd: 0.3 + Math.random() * 0.4, retargetT: 0, stormT: 0, elims: 0,
        chatText: "", chatAge: 9, avatar: o.avatar, chat: o.chat };
    }
    function seedWorld() {
      // 12 fighters spread on a jittered ring — far enough apart that no one is
      // in range at the drop (fights ramp only as loot & the storm pull you in)
      var mp = ringPos(0, 12, 780);
      me = makeFighter({ name: playerName, isBot: false, color: "#4fc3f7", x: mp.x, y: mp.y, skill: 0.6 });
      bots = [];
      var defs = (Bots && Bots.pickOpponents) ? Bots.pickOpponents(N_BOTS, skill) : [];
      for (var i = 0; i < N_BOTS; i++) {
        var d = defs[i] || { id: "bot" + i, name: "Rival" + i, skill: skill, avatar: {}, chat: {} };
        var p = ringPos(i + 1, 12, 780);
        bots.push(makeFighter({ name: d.name, isBot: true, color: PALETTE[(i + 1) % PALETTE.length], x: p.x, y: p.y, skill: d.skill, avatar: d.avatar, chat: d.chat }));
      }
      // scatter crates; the last GOLDEN_COUNT are the prized golden ones
      crates = [];
      for (var c = 0; c < CRATE_COUNT; c++) {
        crates.push({ x: 90 + Math.random() * (WORLD - 180), y: 90 + Math.random() * (WORLD - 180),
          golden: c < GOLDEN_COUNT, kind: Math.random() < 0.5 ? "shield" : "weapon" });
      }
      darts = []; poofs = [];
    }

    function begin() {
      matchT = 0; myElims = 0; stormOverride = null;
      placement = null; over = false; won = false; paused = false; banked = false;
      wingUsed = false; wingPending = false;
      mvx = 0; mvy = 0; keys = {}; stick = null;
      seedWorld();
      cardEl.style.display = "none"; qEl.style.display = "none";
      hud();
      big("🌀 DROP IN! Grab loot &amp; be the last one standing!", "#9be15d");
    }

    // ---------- economy: ONE guarded bank path, always SHOWN ----------
    function rewards(w, place) {
      var pl = place || 12, e = myElims;
      return {
        win: !!w,
        score: e * 12 + (13 - pl) * 10 + (w ? 120 : 0),
        rankPtsDelta: w ? 14 : Math.min(10, 2 + Math.max(0, 12 - pl) + Math.floor(e / 2)),
        xp: Math.min(80, 8 + e * 4 + Math.max(0, 12 - pl) * 3 + (w ? 20 : 0)),
        gems: (w ? 25 : 0) + 4 + e * 3 + Math.max(0, 12 - pl) * 2
      };
    }
    function persistProgress(w, place) {
      if (place != null && place < (stats.bestPlace == null ? 99 : stats.bestPlace)) stats.bestPlace = place;
      if (w) stats.crowns = (stats.crowns || 0) + 1;
      stats.elims = (stats.elims || 0) + myElims;
      if (store.save) store.save();
    }
    function bankRun(w, place) {
      if (banked) return null;
      banked = true;
      persistProgress(w, place);
      var rw = rewards(w, place);
      var res = store.recordGame ? store.recordGame("royale", rw) : null;
      return { rw: rw, res: res };
    }

    // ---------- eliminations (kid-kind: "teleported home") ----------
    function poof(f) { poofs.push({ x: f.x, y: f.y, age: 0 }); if (juice) juice.burst(sx(f.x), sy(f.y), f.color, 14); }
    function eliminate(target, shooter) {
      if (!target.alive || over) return;
      target.alive = false;
      poof(target);
      if (sfx && sfx.pop) sfx.pop();
      if (target === me) { playerDown(shooter); return; }
      // a rival was zapped — credit the shooter (player or another bot)
      if (shooter === me) { myElims++; if (Math.random() < 0.4) big("💥 You zapped " + target.name + "!", "#ffd23f"); }
      else if (shooter && shooter.isBot) shooter.elims++;
      checkWin();
    }
    function checkWin() {
      if (!over && me && me.alive && aliveBots() === 0) finalize(1, true);
    }
    function playerDown(shooter) {
      if (over) return;
      me.alive = false; // zapped — idempotent whether via a dart or a direct call
      var place = aliveBots() + 1; // your standing at the moment you're zapped
      if (place >= 4 && !wingUsed && !wingPending) { openWing(place); return; }
      finalize(place, false);
    }
    function finalize(place, w) {
      if (over) return;
      over = true; won = w; placement = place; paused = true;
      var bank = bankRun(w, place) || { rw: rewards(w, place), res: null };
      showCard(bank.rw, bank.res);
      if (w) { if (sfx && sfx.fanfare) sfx.fanfare(); if (juice) { juice.shake(6); for (var c = 0; c < 5; c++) juice.burst(W * (0.2 + c * 0.15), H * 0.35, PALETTE[c], 16); } }
      else { if (sfx && sfx.buzz) sfx.buzz(); if (juice) juice.shake(9); }
    }

    // ---------- damage ----------
    function applyHit(target, dmg, shooter) {
      if (!target.alive || over) return;
      if (target.shields >= dmg) { target.shields -= dmg; if (target === me) { hud(); big("🛡 shield popped!", "#8ecdf7"); } }
      else eliminate(target, shooter);
    }
    function applyStormHit(f) {
      if (!f.alive) return;
      if (f.shields > 0) { f.shields--; if (f === me) { hud(); big("⭕ The storm! Get inside the circle!", "#e0a0ff"); } }
      else eliminate(f, null);
    }

    // ---------- crates ----------
    function nearestCrate(f) {
      var best = -1, bd = 1e9;
      for (var i = 0; i < crates.length; i++) { var dx = crates[i].x - f.x, dy = crates[i].y - f.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
      return best;
    }
    function applyCrate(f, cr) {
      if (cr.kind === "shield") { f.shields = Math.min(3, f.shields + 1); if (f === me) big("🛡 Shield bubble! (" + f.shields + "/3)", "#8ecdf7"); }
      else { if (f.weapon < 3) { f.weapon++; if (f === me) big("📦 " + WEAPONS[f.weapon].emoji + " " + WEAPONS[f.weapon].name + " blaster!", "#9be15d"); } else { f.shields = Math.min(3, f.shields + 1); if (f === me) big("🛡 Extra shield! (" + f.shields + "/3)", "#8ecdf7"); } }
      if (f === me) { hud(); if (sfx && sfx.coin) sfx.coin(); }
    }
    function grabCrate(idx) {
      var cr = crates[idx]; if (!cr) return;
      crates.splice(idx, 1);
      if (cr.golden && me.alive) { openGolden(); return; }
      applyCrate(me, cr);
    }
    function openGolden() {
      if (over) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "🌟 GOLDEN CRATE! Answer a word for a MEGA reward!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) { me.weapon = 3; me.shields = 3; big("🌟 MEGA BLASTER + FULL SHIELDS!", "#69f0ae"); if (sfx && sfx.fanfare) sfx.fanfare(); if (juice) juice.burst(W / 2, H / 2, "#ffd23f", 20); }
          else { if (me.weapon < 1) me.weapon = 0; big("The crate gave a friendly 🟢 pea blaster — keep hunting!", "#ffd740"); }
          hud();
        }
      });
    }

    // ---------- respawn wing ----------
    function openWing(place) {
      wingPending = true; paused = true;
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "🪽 RESPAWN WING! Answer a word to glide back in!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; wingPending = false; wingUsed = true;
          if (ok) {
            me.alive = true; paused = false;
            var a = Math.random() * Math.PI * 2, r = currentStormR() * 0.55;
            me.x = CX + Math.cos(a) * r; me.y = CY + Math.sin(a) * r;
            me.shields = Math.max(me.shields, 1); me.stormT = 0;
            big("🪽 Back in the game — go go go!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            hud();
          } else { big("Placement stands — " + place + "th of 12!", "#ffd740"); finalize(place, false); }
        }
      });
    }

    // ---------- auto-fire (all fighters) ----------
    function nearestEnemyInRange(f, range) {
      var best = null, bd = range * range;
      if (f !== me && me.alive) { var dx = me.x - f.x, dy = me.y - f.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = me; } }
      for (var i = 0; i < bots.length; i++) { var b = bots[i]; if (b === f || !b.alive) continue; var ex = b.x - f.x, ey = b.y - f.y, e = ex * ex + ey * ey; if (e < bd) { bd = e; best = b; } }
      return best;
    }
    function fireStep(f, dt) {
      if (!f.alive) return;
      f.fireCd -= dt;
      if (f.fireCd > 0) return;
      var w = WEAPONS[f.weapon];
      var tgt = nearestEnemyInRange(f, w.range);
      if (!tgt) { f.fireCd = 0.12; return; }
      f.fireCd = w.cd * (f === me ? 1 : (1.35 - f.skill * 0.45));
      var ang = Math.atan2(tgt.y - f.y, tgt.x - f.x);
      if (f !== me) ang += (Math.random() - 0.5) * (1 - f.skill) * 0.5; // aim error
      darts.push({ x: f.x, y: f.y, vx: Math.cos(ang) * w.ds, vy: Math.sin(ang) * w.ds,
        dmg: w.dmg, owner: f, col: w.col, life: w.range / w.ds + DART_LIFE_PAD });
      if (sfx && sfx.pop && f === me && Math.random() < 0.3) sfx.pop();
    }
    function stepDarts(dt) {
      for (var i = darts.length - 1; i >= 0; i--) {
        var s = darts[i];
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        var gone = s.life <= 0 || s.x < 0 || s.x > WORLD || s.y < 0 || s.y > WORLD;
        if (!gone) {
          // check every alive fighter except the owner
          if (me.alive && s.owner !== me && hitsF(s, me)) { applyHit(me, s.dmg, s.owner); gone = true; }
          if (!gone) for (var b = 0; b < bots.length; b++) { var bo = bots[b]; if (bo === s.owner || !bo.alive) continue; if (hitsF(s, bo)) { applyHit(bo, s.dmg, s.owner); gone = true; break; } }
        }
        if (gone) darts.splice(i, 1);
      }
    }
    function hitsF(s, f) { var dx = f.x - s.x, dy = f.y - s.y; return dx * dx + dy * dy < HIT_R * HIT_R; }

    // ---------- bot AI: flee storm > fight in range > seek loot > roam ----------
    function botThink(b, dt) {
      b.retargetT -= dt;
      if (b.retargetT > 0) return;
      b.retargetT = 0.5 - b.skill * 0.25;
      var r = currentStormR();
      if (distC(b) > r - 60) { b.tx = CX; b.ty = CY; return; } // run for safety
      // fight: chase the nearest visible enemy so its blaster can reach
      var awr = 340 + b.skill * 120, prey = null, pd = awr * awr;
      if (me.alive) { var mx = me.x - b.x, my = me.y - b.y, md = mx * mx + my * my; if (md < pd) { pd = md; prey = me; } }
      for (var i = 0; i < bots.length; i++) { var o = bots[i]; if (o === b || !o.alive) continue; var ox = o.x - b.x, oy = o.y - b.y, od = ox * ox + oy * oy; if (od < pd) { pd = od; prey = o; } }
      if (prey && Math.random() < 0.35 + b.skill * 0.5) { b.tx = prey.x; b.ty = prey.y; if (Math.random() < 0.015 && Bots) { b.chatText = Bots.say(b, "nice"); b.chatAge = 0; } return; }
      // seek the nearest crate that sits INSIDE the safe circle
      var best = null, bd = 1e9;
      for (var c = 0; c < crates.length; c++) { var cr = crates[c]; var cdx = cr.x - CX, cdy = cr.y - CY; if (cdx * cdx + cdy * cdy > r * r) continue; var dx = cr.x - b.x, dy = cr.y - b.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = cr; } }
      if (best) { b.tx = best.x; b.ty = best.y; }
      else { var a = Math.random() * Math.PI * 2, rr = Math.random() * r * 0.8; b.tx = CX + Math.cos(a) * rr; b.ty = CY + Math.sin(a) * rr; }
    }
    function moveToward(f, tx, ty, sp, dt) {
      var dx = tx - f.x, dy = ty - f.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) { var v = Math.min(sp * dt, d); f.x += dx / d * v; f.y += dy / d * v; }
      f.x = Math.max(40, Math.min(WORLD - 40, f.x)); f.y = Math.max(40, Math.min(WORLD - 40, f.y));
    }

    // ---------- player input ----------
    function inputVec() {
      if (stick) return stick;
      var kx = 0, ky = 0;
      if (keys.left) kx -= 1; if (keys.right) kx += 1; if (keys.up) ky -= 1; if (keys.down) ky += 1;
      if (kx || ky) return { x: kx, y: ky };
      return { x: mvx, y: mvy };
    }

    // ---------- simulation ----------
    function step(dt) {
      matchT += dt;
      // player move
      if (me.alive) {
        var iv = inputVec(), il = Math.sqrt(iv.x * iv.x + iv.y * iv.y);
        if (il > 0.01) moveToward(me, me.x + iv.x / il * 60, me.y + iv.y / il * 60, BASE_MOVE, dt);
      }
      // rivals think + move
      for (var i = 0; i < bots.length; i++) {
        var b = bots[i]; if (!b.alive) continue;
        botThink(b, dt);
        moveToward(b, b.tx, b.ty, BASE_MOVE * (0.82 + b.skill * 0.3), dt);
        b.chatAge += dt;
      }
      // auto-fire for everyone, then move darts
      fireStep(me, dt);
      for (i = 0; i < bots.length; i++) fireStep(bots[i], dt);
      stepDarts(dt);
      // crate pickups (fighters walk over loot)
      for (var c = crates.length - 1; c >= 0; c--) {
        var cr = crates[c];
        if (me.alive && !paused && !over) { var mdx = cr.x - me.x, mdy = cr.y - me.y; if (mdx * mdx + mdy * mdy < GRAB_R * GRAB_R) { grabCrate(c); continue; } }
        var got = false;
        for (i = 0; i < bots.length && !got; i++) { var bo = bots[i]; if (!bo.alive) continue; var bdx = cr.x - bo.x, bdy = cr.y - bo.y; if (bdx * bdx + bdy * bdy < GRAB_R * GRAB_R) { if (cr.golden) { bo.weapon = 3; bo.shields = 3; } else applyCrate(bo, cr); got = true; } }
        if (got) crates.splice(c, 1);
      }
      // storm tick damage (per-fighter timer so they don't all pop at once)
      var everyone = bots.concat([me]);
      for (i = 0; i < everyone.length; i++) {
        var f = everyone[i]; if (!f.alive) continue;
        if (outsideSafe(f)) { f.stormT += dt; if (f.stormT >= STORM_TICK) { f.stormT = 0; applyStormHit(f); } }
        else f.stormT = 0;
      }
      // poofs age out
      for (i = poofs.length - 1; i >= 0; i--) { poofs[i].age += dt; if (poofs[i].age > 1) poofs.splice(i, 1); }
      if (juice) juice.update(dt);
      hud();
      checkWin();
    }

    // ---------- drawing (camera follows the player, 1:1 top-down) ----------
    function camX() { return me ? me.x : CX; }
    function camY() { return me ? me.y : CY; }
    function sx(wx) { return W / 2 + (wx - camX()); }
    function sy(wy) { return H / 2 + (wy - camY()); }
    function onScreen(x, y, pad) { return x > -pad && x < W + pad && y > -pad && y < H + pad; }
    function drawFighter(f, isSelf) {
      var x = sx(f.x), y = sy(f.y);
      if (!onScreen(x, y, 60)) return;
      ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fillStyle = f.color; ctx.fill();
      ctx.lineWidth = isSelf ? 4 : 2; ctx.strokeStyle = isSelf ? "#fff" : "rgba(0,0,0,.25)"; ctx.stroke();
      // shield ring bubbles
      if (f.shields > 0) { ctx.strokeStyle = "rgba(120,205,255,.85)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 20 + f.shields, 0, Math.PI * 2); ctx.stroke(); }
      // cute eyes
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x - 5, y - 3, 3, 0, Math.PI * 2); ctx.arc(x + 5, y - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#20303a"; ctx.beginPath(); ctx.arc(x - 5, y - 3, 1.4, 0, Math.PI * 2); ctx.arc(x + 5, y - 3, 1.4, 0, Math.PI * 2); ctx.fill();
      // name tag
      ctx.font = "bold 12px Trebuchet MS, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 3; ctx.strokeText(f.name, x, y - 26);
      ctx.fillStyle = isSelf ? "#9be15d" : "#fff"; ctx.fillText(f.name, x, y - 26);
      if (f.chatAge < 2.4 && Bots && Bots.bubble) Bots.bubble(ctx, { x: x, y: y - 34, text: f.chatText, age: f.chatAge });
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // island ground
      ctx.fillStyle = "#3f7d4a"; ctx.fillRect(0, 0, W, H);
      // grassy tiles for a sense of motion
      var ts = 96, ox = ((camX() % ts) + ts) % ts, oy = ((camY() % ts) + ts) % ts;
      ctx.fillStyle = "#478a53";
      for (var gx = -ts; gx < W + ts; gx += ts) for (var gy = -ts; gy < H + ts; gy += ts) { if (((Math.round((gx + ox) / ts) + Math.round((gy + oy) / ts)) & 1) === 0) ctx.fillRect(gx - ox, gy - oy, ts, ts); }
      // island border (edge of the world)
      ctx.strokeStyle = "rgba(20,40,25,.6)"; ctx.lineWidth = 8;
      ctx.strokeRect(sx(0), sy(0), WORLD, WORLD);
      // crates
      for (var c = 0; c < crates.length; c++) {
        var cr = crates[c], cxp = sx(cr.x), cyp = sy(cr.y);
        if (!onScreen(cxp, cyp, 24)) continue;
        ctx.font = "24px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (cr.golden) { ctx.save(); ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 14; ctx.fillText("🌟", cxp, cyp); ctx.restore(); ctx.fillText("📦", cxp, cyp + 2); }
        else ctx.fillText("📦", cxp, cyp);
      }
      // fighters (rivals, then you on top)
      for (var b = 0; b < bots.length; b++) if (bots[b].alive) drawFighter(bots[b], false);
      if (me && me.alive) drawFighter(me, true);
      // darts
      for (var d = 0; d < darts.length; d++) { var s = darts[d], dxp = sx(s.x), dyp = sy(s.y); if (!onScreen(dxp, dyp, 12)) continue; ctx.beginPath(); ctx.arc(dxp, dyp, 4, 0, Math.PI * 2); ctx.fillStyle = s.col; ctx.fill(); }
      // teleport-home poofs
      for (var p = 0; p < poofs.length; p++) { var po = poofs[p]; ctx.globalAlpha = Math.max(0, 1 - po.age); ctx.font = "26px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✨", sx(po.x), sy(po.y) - po.age * 24); ctx.globalAlpha = 1; }
      // ⭕ the storm: tint everything OUTSIDE the safe circle, punch the safe hole
      var r = currentStormR(), scx = sx(CX), scy = sy(CY);
      // one path with a reverse-winding hole — destination-out ERASED the scene
      // inside the circle to transparency and the 3D world showed through
      ctx.fillStyle = "rgba(150,80,220,.34)";
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(scx, scy, r, 0, Math.PI * 2, true); ctx.fill();
      ctx.beginPath(); ctx.arc(scx, scy, r, 0, Math.PI * 2); ctx.strokeStyle = "rgba(220,170,255,.9)"; ctx.lineWidth = 4; ctx.stroke();
      // big arrow home when you're caught outside
      if (me && me.alive && outsideSafe(me)) {
        var ang = Math.atan2(CY - me.y, CX - me.x);
        ctx.save(); ctx.translate(W / 2, H / 2 - 60); ctx.rotate(ang);
        ctx.fillStyle = "rgba(255,235,80,.95)"; ctx.beginPath(); ctx.moveTo(28, 0); ctx.lineTo(-14, -16); ctx.lineTo(-14, 16); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = "#ffd23f"; ctx.font = "bold 15px Trebuchet MS, sans-serif"; ctx.textAlign = "center"; ctx.fillText("⭕ RUN TO THE CIRCLE!", W / 2, H / 2 - 92);
      }
      if (juice) juice.draw(ctx);
    }

    // ---------- end card ----------
    function showCard(rw, res) {
      var title = won ? "👑 VICTORY CROWN! You were the last one standing!" :
        "🌀 #" + placement + " of 12 — teleported home!";
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (won ? "👑" : "🌀") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + title + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🏁 Placement <b>#' + placement + '</b> · 💥 <b>' + myElims + '</b> zapped</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🏅 Best placement #' + (stats.bestPlace || placement) + ' · 👑 ' + (stats.crowns || 0) + ' crowns' + (res && res.rankedUp ? ' · 🎖 RANK UP!' : '') + '</div>' +
        '<button class="submit big-next" id="ry_again" type="button">Play Again ➜</button>' +
        '<button class="wqskip" id="ry_leave" type="button">Leave</button></div>';
      cardEl.style.display = "flex";
      document.getElementById("ry_again").onclick = function () { cardEl.style.display = "none"; begin(); };
      document.getElementById("ry_leave").onclick = exit;
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) step(dt);
      draw();
    }

    // ---------- input (phantom-tap safe: canvas is a virtual stick) ----------
    function stickFrom(x, y) {
      var dx = x - stickOX, dy = y - stickOY, len = Math.sqrt(dx * dx + dy * dy);
      if (len < 6) return { x: 0, y: 0 };
      var cap = Math.min(len, 60);
      return { x: (dx / len) * (cap / 60), y: (dy / len) * (cap / 60) };
    }
    function rel(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = rel(e, e.changedTouches[0]); stickOX = p.x; stickOY = p.y; stick = { x: 0, y: 0 }; }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = rel(e, e.changedTouches[0]); stick = stickFrom(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); stick = null; }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var p = rel(e); stickOX = p.x; stickOY = p.y; stick = { x: 0, y: 0 }; });
    cv.addEventListener("mousemove", function (e) { if (stick) { var p = rel(e); stick = stickFrom(p.x, p.y); } });
    cv.addEventListener("mouseup", function () { stick = null; });
    cv.addEventListener("mouseleave", function () { stick = null; });
    function onKey(down) {
      return function (e) {
        var k = e.key;
        if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = down;
        else if (k === "ArrowRight" || k === "d" || k === "D") keys.right = down;
        else if (k === "ArrowUp" || k === "w" || k === "W") keys.up = down;
        else if (k === "ArrowDown" || k === "s" || k === "S") keys.down = down;
        else return;
        if (down) e.preventDefault();
      };
    }
    var keyDown = onKey(true), keyUp = onKey(false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    // ---------- exit / banking (mid-match quit + app-close both bank) ----------
    function bankExit() {
      if (over || banked) return; // an ended match already banked
      var place = me && me.alive ? aliveBots() + 1 : (placement || aliveBots() + 1);
      var b = bankRun(false, place);
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🌀 Royale banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("beforeunload", onUnload);
      if (VQ && VQ.shush) VQ.shush();
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._royale = {
      state: function () {
        return {
          t: matchT, alive: aliveCount(), myShields: me ? me.shields : 0,
          weapon: me ? me.weapon : 0, placement: placement, elims: myElims,
          stormR: currentStormR(), inStorm: !!(me && me.alive && outsideSafe(me)),
          over: over, won: won, banked: banked, wingUsed: wingUsed
        };
      },
      begin: begin,
      move: function (dx, dy) { mvx = dx; mvy = dy; stick = null; },
      warp: function (x, y) { if (me) { me.x = Math.max(40, Math.min(WORLD - 40, x)); me.y = Math.max(40, Math.min(WORLD - 40, y)); } },
      spawnCrate: function (x, y, golden) { var cr = { x: x, y: y, golden: !!golden, kind: "weapon" }; crates.push(cr); return cr; },
      grab: function () { var i = nearestCrate(me); if (i >= 0) grabCrate(i); return i >= 0; },
      zapNearest: function () {
        var best = null, bd = 1e9;
        for (var i = 0; i < bots.length; i++) { var b = bots[i]; if (!b.alive) continue; var dx = b.x - me.x, dy = b.y - me.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; } }
        if (best) { eliminate(best, me); return true; }
        return false;
      },
      thin: function (n) {
        for (var i = 0; i < bots.length && aliveBots() > n; i++) { if (bots[i].alive) { bots[i].alive = false; poof(bots[i]); } }
        hud(); checkWin();
      },
      stormTo: function (r) { stormOverride = r; },
      hurtMe: function () { applyHit(me, 1, null); },
      eliminateMe: function () { if (me.alive) playerDown(null); }
    };

    // ---------- boot ----------
    begin();
    if (global._royaledemo) { // screenshot seed: a frozen late-game tableau
      global._royaledemo = 0;
      matchT = 185; stormOverride = 260; myElims = 4;
      // leave only 3 rivals alive (4 fighters incl. you), crowded near the center
      for (var s = 3; s < bots.length; s++) bots[s].alive = false;
      me.x = CX + 40; me.y = CY - 20; me.weapon = 2; me.shields = 2;
      var live = [], li = 0;
      for (var s2 = 0; s2 < bots.length; s2++) if (bots[s2].alive) live.push(bots[s2]);
      for (var L = 0; L < live.length; L++) { var a = L / live.length * Math.PI * 2; live[L].x = CX + Math.cos(a) * 150; live[L].y = CY + Math.sin(a) * 150; live[L].weapon = 1 + (L % 3); live[L].shields = L % 2; }
      // darts in flight between the survivors
      darts.push({ x: CX + 60, y: CY - 10, vx: 400, vy: 40, dmg: 1, owner: me, col: WEAPONS[2].col, life: 1 });
      darts.push({ x: CX - 120, y: CY + 90, vx: -300, vy: -120, dmg: 1, owner: live[0], col: WEAPONS[1].col, life: 1 });
      // a golden crate on screen
      crates = [{ x: CX + 120, y: CY + 60, golden: true, kind: "weapon" }];
      paused = true; hud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxRoyale = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
