/*
 * Voblox arcade game — ⛷️ SKI RUSH (an endless downhill slalom with a YETI on your tail).
 * You carve left/right down an ever-steepening mountain: weave through 🚩 slalom
 * GATES (each pass = points + a speed pip), dodge 🌲 trees, 🪨 rocks and stray
 * skiers, and grab 🪙 coins + ❄️ crystals. Hit something = a 1.5s tumble that
 * bleeds speed. Three tumbles and THE YETI 🦣 wakes and gives chase; one more
 * tumble and it catches you (snowball roll, played for laughs). Distance is score.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 📜 WORD SCROLLS (every ~30 gates): grab one, answer a word (miniQuiz) and
 *     ignite 🚀 ROCKET SKIS — 5s invincible speed burst with DOUBLE coins.
 *   - 💖 ONE-TIME REVIVE: when the yeti catches you, a word puts you back ahead
 *     of it — once per run.
 *   - ❄️ five crystals forgive one tumble.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("ski") per
 * run — banked on run-over, quit, AND app-close. stats.bestM / stats.gates persist.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var MW = 1000, HW = 468;          // logical course width; skier x clamped to +/-HW
  var LOOK = 150;                   // meters of course visible ahead
  var START_SPD = 26, MAX_SPD = 62, MIN_SPD = 8;
  var ACCEL = 0.55, GATE_PIP = 2.4; // steady speed-up + a pip per gate
  var CARVE = 560;                  // logical carve speed (units/s)
  var GATE_GAPW = 132, SKIER_HALF = 34;
  var OBST = { tree: 42, rock: 34, skier: 32 };

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("ski");
    // additive, never-renamed save fields (stats.best is the PLATFORM best — untouched)
    stats.bestM = stats.bestM || 0;
    stats.gates = stats.gates || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap ski";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="skicv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="skmsg">⛷️ Ski Rush — carve down the mountain!</div>' +
      '<div class="grow"><span id="skm">🏁 0m</span><span id="skcoins">🪙 0</span>' +
      '<span id="skcry">❄️ 0</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="skbig"></div>' +
      '<div class="gover" id="skq2" style="display:none"></div>' +
      '<div class="gover" id="skicard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#skicv"), ctx = cv.getContext("2d");
    var skq2 = document.getElementById("skq2"), skicard = document.getElementById("skicard");
    var msgEl = document.getElementById("skmsg"), bigEl = document.getElementById("skbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // Retina-sharp backing store (min(dpr,2)); all game code stays in CSS px.
    var W, H, S;
    function resize() {
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      W = wrap.clientWidth || global.innerWidth || 360;
      H = wrap.clientHeight || global.innerHeight || 640;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = W / MW;
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var entities = [];
    var m, speed, px, carveDir, gates, coins, crystals, tumbles, style;
    var yetiAwake, yetiDist, airborne, airSpin, rocket, tumbling;
    var revived, over, paused, banked, statsSaved;
    var gateMark, spawnMark, gatesSinceScroll, lastFmt;

    function big(msg, col) {
      bigEl.textContent = msg; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1150);
    }
    function hud() {
      document.getElementById("skm").textContent = "🏁 " + Math.round(m) + "m" + (rocket > 0 ? " 🚀" : "");
      document.getElementById("skcoins").textContent = "🪙 " + coins;
      document.getElementById("skcry").textContent = "❄️ " + crystals + (yetiAwake ? "  🦣" : "");
    }

    // ---------- run lifecycle ----------
    function begin() {
      entities = [];
      m = 0; speed = START_SPD; px = 0; carveDir = 0;
      gates = 0; coins = 0; crystals = 0; tumbles = 0; style = 0;
      yetiAwake = false; yetiDist = 240; airborne = 0; airSpin = 0; rocket = 0; tumbling = 0;
      revived = false; over = false; paused = false; banked = false; statsSaved = false;
      // a short, clean intro runway so the first seconds ease you in (also gives
      // specs a deterministic window to place their own gates/obstacles)
      gateMark = 70; spawnMark = 90; gatesSinceScroll = 0;
      skicard.style.display = "none"; skq2.style.display = "none";
      hud();
      big("⛷️ GO! Carve left & right!", "#8ecdf7");
    }

    function rewards() {
      var won = m >= 2000;
      return {
        win: won, score: Math.round(m),
        rankPtsDelta: won ? Math.min(12, 4 + Math.floor(m / 1000)) : Math.min(6, 1 + Math.floor(m / 700)),
        xp: Math.min(80, 6 + Math.floor(m / 40) + coins + style),
        gems: Math.min(120, Math.round(m / 40) + coins)
      };
    }
    // the ONE bank path — computed once, guarded, recorded to the store engine
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = rewards();
      var res = store.recordGame ? store.recordGame("ski", rw) : null;
      return { rw: rw, res: res };
    }
    // additive persistence: best distance + lifetime gates (once per run)
    function endRunStats() {
      if (statsSaved) return; statsSaved = true;
      if (Math.round(m) > (stats.bestM || 0)) stats.bestM = Math.round(m);
      stats.gates = (stats.gates || 0) + gates;
      if (store.save) store.save();
    }

    function endRun() {
      if (over) return;
      over = true; paused = true;
      endRunStats();
      var b = bankRun();
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(10);
      showEnd(b ? b.rw : rewards());
    }
    function showEnd(rw) {
      var meters = Math.round(m);
      skicard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (rw.win ? "🏔️🏆" : "🦣") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (rw.win ? "MOUNTAIN CONQUERED!" : "The yeti got you!") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🏁 <b>' + meters + 'm</b> · 🚩 ' + gates + ' gates · 🪙 ' + coins + '</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🏔️ Best <b>' + (stats.bestM || 0) + 'm</b> · ' + (stats.gates || 0) + ' gates all-time</div>' +
        '<button class="submit big-next" id="skreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="skleave" type="button">Leave</button></div>';
      skicard.style.display = "flex";
      if (rw.win && sfx && sfx.fanfare) sfx.fanfare();
      document.getElementById("skreplay").onclick = function () { skicard.style.display = "none"; begin(); };
      document.getElementById("skleave").onclick = exit;
    }

    // ---------- tumbles / yeti ----------
    function doTumble() {
      if (over) return;
      if (yetiAwake) { yetiDist = 0; caught(); return; } // one more tumble = caught
      tumbles++;
      tumbling = 1.5;
      speed = Math.max(MIN_SPD, speed * 0.5); // lose speed in the wipeout
      carveDir = 0; airborne = 0;
      if (juice) { juice.shake(7); juice.burst(W / 2 + px * S, H * 0.7, "#ffffff", 16); }
      if (sfx && sfx.buzz && Math.random() < 0.4) sfx.buzz();
      if (tumbles >= 3) {
        yetiAwake = true; yetiDist = 62;
        big("🦣 THREE TUMBLES — THE YETI AWAKES!", "#ff8a8a");
        if (sfx && sfx.buzz) sfx.buzz(); // the roar
      } else {
        big("💥 Tumble! Watch out!", "#ffd23f");
      }
      hud();
    }
    // the yeti runs you down — a word can save you, ONCE
    function caught() {
      if (over) return;
      if (revived) { big("🦣 CAUGHT! Rolled up like a giant snowball!", "#ff8a8a"); endRun(); return; }
      paused = true;
      if (sfx && sfx.buzz) sfx.buzz();
      cv._lastQ = VQ.miniQuiz(skq2, words, store, {
        title: "🦣 CAUGHT! Spell a word to wriggle FREE and dash ahead!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) {
            revived = true; yetiDist = 150; tumbling = 0; paused = false;
            big("🚀 FREE! You dash ahead of the yeti!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(W / 2, H / 2, "#8ecdf7", 22);
          } else {
            endRun();
          }
        }
      });
    }

    // ---------- jumps / rocket / scrolls ----------
    function launch() {
      if (over || airborne > 0) return;
      airborne = 1.1; airSpin = 0;
      if (sfx && sfx.whoosh) sfx.whoosh();
      big("🛷 AIRBORNE! Tap to spin!", "#8ecdf7");
    }
    function land() {
      if (airSpin > 0) {
        var pts = airSpin * 3; style += pts; coins += airSpin; // trick coins
        big("🌀 " + airSpin + "-SPIN! +" + airSpin + " 🪙 style!", "#ffd23f");
        if (sfx && sfx.fanfare) sfx.fanfare();
        if (juice) juice.burst(W / 2 + px * S, H * 0.7, "#ffe14d", 18);
      }
      airSpin = 0; hud();
    }
    function spin() {
      if (over) return;
      if (airborne > 0) { airSpin++; if (sfx && sfx.pop) sfx.pop(); }
    }
    function grabScroll() {
      if (over) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(skq2, words, store, {
        title: "📜 Word Scroll! Answer to ignite 🚀 ROCKET SKIS!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            rocket = 5; speed = Math.min(MAX_SPD, speed + 8);
            big("🚀 ROCKET SKIS! Invincible + DOUBLE coins!", "#ffd23f");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.shake(6);
          } else big("The scroll fizzles… keep carving!", "#8ecdf7");
        }
      });
    }

    // ---------- course spawning ----------
    function gateSpacing() { return Math.max(40, 62 - speed * 0.32); }
    function scheduleSpawns() {
      var horizon = m + LOOK;
      while (gateMark < horizon) {
        entities.push({ kind: "gate", at: gateMark, x: (Math.random() * 2 - 1) * 300, gapW: GATE_GAPW, resolved: false });
        gatesSinceScroll++;
        if (gatesSinceScroll >= 30) {
          gatesSinceScroll = 0;
          entities.push({ kind: "scroll", at: gateMark + 20, x: (Math.random() * 2 - 1) * 260, half: 40, resolved: false });
        }
        gateMark += gateSpacing();
      }
      while (spawnMark < horizon) {
        var r = Math.random(), sx = (Math.random() * 2 - 1) * 400;
        if (r < 0.15) entities.push({ kind: "tree", at: spawnMark, x: sx, half: OBST.tree, resolved: false });
        else if (r < 0.25) entities.push({ kind: "rock", at: spawnMark, x: sx, half: OBST.rock, resolved: false });
        else if (r < 0.31) entities.push({ kind: "skier", at: spawnMark, x: sx, half: OBST.skier, resolved: false });
        else if (r < 0.39) entities.push({ kind: "ramp", at: spawnMark, x: sx, half: 54, resolved: false });
        else if (r < 0.60) { for (var ci = 0; ci < 4; ci++) entities.push({ kind: "coin", at: spawnMark + ci * 4, x: sx + (ci - 1.5) * 30, half: 26, resolved: false }); }
        else if (r < 0.68) entities.push({ kind: "crystal", at: spawnMark, x: sx, half: 26, resolved: false });
        spawnMark += 12 + Math.random() * 10;
      }
    }
    function onGatePass() {
      speed = Math.min(MAX_SPD, speed + GATE_PIP); style += 1;
      if (sfx && sfx.pop && Math.random() < 0.4) sfx.pop();
      if (juice) juice.text(W / 2 + px * S, H * 0.66, "🚩", "#69f0ae");
    }
    function resolveEntity(e) {
      e.resolved = true;
      var dx = Math.abs(px - e.x);
      if (e.kind === "gate") { if (dx < e.gapW) { gates++; onGatePass(); } return; }
      if (dx >= (e.half + SKIER_HALF)) return; // missed it entirely
      if (e.kind === "coin") {
        coins += (rocket > 0 ? 2 : 1);
        if (sfx && sfx.coin) sfx.coin();
        if (juice) juice.text(W / 2 + e.x * S, H * 0.6, "+" + (rocket > 0 ? 2 : 1), "#ffd23f");
      } else if (e.kind === "crystal") {
        crystals++;
        if (crystals >= 5) { crystals -= 5; if (tumbles > 0) tumbles--; big("❄️ Crystal charge — a tumble forgiven!", "#8ecdf7"); }
        if (sfx && sfx.coin) sfx.coin();
      } else if (e.kind === "ramp") {
        if (airborne <= 0) launch();
      } else if (e.kind === "scroll") {
        grabScroll();
      } else { // tree / rock / skier
        if (airborne > 0 || rocket > 0 || tumbling > 0) return; // sailed over / invincible / already down
        doTumble();
      }
    }

    // ---------- simulation ----------
    function step(dt) {
      if (over) return;
      speed = Math.min(MAX_SPD, speed + ACCEL * dt);
      var eff = speed + (rocket > 0 ? 18 : 0);
      m += eff * dt;
      // carve (frozen during a tumble)
      if (tumbling > 0) { tumbling = Math.max(0, tumbling - dt); carveDir = 0; }
      else {
        px += carveDir * CARVE * dt;
        if (px < -HW) px = -HW; else if (px > HW) px = HW;
        if (carveDir !== 0 && juice && Math.random() < 0.4) juice.burst(W / 2 + px * S, H * 0.72, "#eaf4ff", 4);
      }
      if (rocket > 0) rocket = Math.max(0, rocket - dt);
      if (airborne > 0) { airborne = Math.max(0, airborne - dt); if (airborne === 0) land(); }
      // yeti creeps or drifts back — never auto-catches; only a tumble does that
      if (yetiAwake) { yetiDist += (eff * 0.02 - 0.15) * dt; if (yetiDist > 240) yetiDist = 240; if (yetiDist < 0) yetiDist = 0; }
      scheduleSpawns();
      var keep = [];
      for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        if (!e.resolved && m >= e.at) resolveEntity(e);
        if (!e.resolved) keep.push(e);
      }
      entities = keep;
      hud();
    }

    // ---------- drawing ----------
    function draw() {
      var horizonY = H * 0.16, skierY = H * 0.7;
      // day → night gradient shift as you descend
      var phase = (Math.sin(m / 1600) + 1) / 2; // 0..1
      function lerp(a, b) { return Math.round(a + (b - a) * phase); }
      var top = "rgb(" + lerp(150, 30) + "," + lerp(200, 40) + "," + lerp(240, 90) + ")";
      var bot = "rgb(" + lerp(230, 20) + "," + lerp(240, 24) + "," + lerp(250, 54) + ")";
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, top); g.addColorStop(0.42, bot); g.addColorStop(0.42, "#f4fbff"); g.addColorStop(1, "#dbeaf6");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // slope side-shading rushing up past you
      ctx.fillStyle = "rgba(180,205,230,.25)";
      var stripe = (m * 4) % 90;
      for (var sy = horizonY - stripe; sy < H; sy += 90) ctx.fillRect(0, sy, W, 3);

      function scr(e) { var frac = Math.max(0, Math.min(1, (e.at - m) / LOOK)); return { x: W / 2 + e.x * S, y: skierY - frac * (skierY - horizonY), s: 0.4 + (1 - frac) * 0.9 }; }
      // entities from far to near
      var sorted = entities.slice().sort(function (a, b) { return b.at - a.at; });
      for (var i = 0; i < sorted.length; i++) {
        var e = sorted[i], p = scr(e), sz = Math.round(30 * p.s);
        ctx.font = sz + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (e.kind === "gate") {
          ctx.font = Math.round(28 * p.s) + "px serif";
          ctx.fillText("🚩", p.x - e.gapW * S, p.y); ctx.fillText("🚩", p.x + e.gapW * S, p.y);
        } else {
          ctx.fillText({ tree: "🌲", rock: "🪨", skier: "🎿", coin: "🪙", crystal: "❄️", ramp: "🛷", scroll: "📜" }[e.kind] || "❓", p.x, p.y);
        }
      }
      // the yeti, chasing from up-slope
      if (yetiAwake) {
        var yf = Math.max(0, Math.min(1, yetiDist / 160));
        var yy = skierY - (0.4 + yf * 0.5) * (skierY - horizonY);
        ctx.font = Math.round(46 - yf * 16) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🦣", W / 2 + px * S * 0.6, yy);
      }
      // the skier (you)
      ctx.save();
      ctx.translate(W / 2 + px * S, skierY - (airborne > 0 ? 22 : 0));
      if (airborne > 0) ctx.rotate((airSpin + (1.1 - airborne) * 2) * 1.6);
      else ctx.rotate(carveDir * 0.3);
      ctx.font = "40px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(rocket > 0 ? "🚀" : "⛷️", 0, 0);
      ctx.restore();
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) step(dt);
      draw();
    }

    // ---------- input: hold a screen half / drag to carve, arrows on desktop ----------
    function pointCarve(clientX) {
      var r = cv.getBoundingClientRect();
      var lx = clientX - r.left;
      carveDir = lx < r.width / 2 ? -1 : 1;
    }
    function onDown(clientX) {
      if (paused || over) return;
      if (airborne > 0) spin(); // a tap while airborne = trick spin
      pointCarve(clientX);
    }
    function onTouchStart(e) { e.preventDefault(); onDown(e.changedTouches[0].clientX); }
    function onTouchMove(e) { e.preventDefault(); if (!paused && !over) pointCarve(e.changedTouches[0].clientX); }
    function onTouchEnd(e) { e.preventDefault(); carveDir = 0; }
    function onMouseDown(e) { onDown(e.clientX); }
    function onMouseMove(e) { if ((e.buttons & 1) && !paused && !over) pointCarve(e.clientX); }
    function onMouseUp() { carveDir = 0; }
    cv.addEventListener("touchstart", onTouchStart, { passive: false });
    cv.addEventListener("touchmove", onTouchMove, { passive: false });
    cv.addEventListener("touchend", onTouchEnd, { passive: false });
    cv.addEventListener("mousedown", onMouseDown);
    cv.addEventListener("mousemove", onMouseMove);
    cv.addEventListener("mouseup", onMouseUp);
    function onKeyDown(e) {
      if (paused || over) return;
      if (e.key === "ArrowLeft") { carveDir = -1; e.preventDefault(); }
      else if (e.key === "ArrowRight") { carveDir = 1; e.preventDefault(); }
      else if (e.key === "ArrowUp" || e.key === " ") { if (airborne > 0) spin(); e.preventDefault(); }
    }
    function onKeyUp(e) { if (e.key === "ArrowLeft" || e.key === "ArrowRight") carveDir = 0; }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    // ---------- exit / banking ----------
    function bankExit() {
      if (over) return; // run-over already banked
      if (m <= 0 && coins === 0 && gates === 0) return; // an untouched run banks nothing
      endRunStats();
      var b = bankRun();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("⛷️ Ski run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
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
    cv._ski = {
      state: function () {
        return {
          m: Math.round(m), speed: speed, gates: gates, coins: coins, crystals: crystals,
          tumbles: tumbles, yetiAwake: yetiAwake, yetiDist: yetiDist, airborne: airborne > 0,
          rocket: rocket, revived: revived, over: over, banked: banked, best: stats.bestM || 0, x: px
        };
      },
      begin: begin,
      carve: function (dir) { carveDir = dir < 0 ? -1 : dir > 0 ? 1 : 0; },
      placeGate: function (offsetX) { entities.push({ kind: "gate", at: m + 26, x: px + (offsetX || 0), gapW: GATE_GAPW, resolved: false }); },
      placeObstacle: function (offsetX, kind) {
        kind = OBST[kind] ? kind : "tree";
        entities.push({ kind: kind, at: m + 22, x: px + (offsetX || 0), half: OBST[kind], resolved: false });
      },
      placeScroll: function () { entities.push({ kind: "scroll", at: m + 24, x: px, half: 40, resolved: false }); },
      jump: function () { launch(); },
      spin: function () { if (airborne <= 0) airborne = 1.0; spin(); },
      tumble: function () { doTumble(); },
      catchMe: function () { if (over) return; yetiAwake = true; yetiDist = 0; caught(); },
      tick: function (sec) {
        var left = sec;
        while (left > 1e-6) { if (over || paused) break; var h = Math.min(0.05, left); step(h); left -= h; }
      }
    };

    // ---------- boot ----------
    begin();
    if (global._skidemo) { // screenshot seed: 800m, mid-jump with a spin, yeti on the tail
      global._skidemo = 0;
      m = 800; speed = 44; px = -40;
      airborne = 0.6; airSpin = 2;
      yetiAwake = true; yetiDist = 46; coins = 27; gates = 14;
      entities = [
        { kind: "gate", at: 838, x: 60, gapW: GATE_GAPW, resolved: false },
        { kind: "gate", at: 890, x: -120, gapW: GATE_GAPW, resolved: false },
        { kind: "tree", at: 862, x: 260, half: OBST.tree, resolved: false },
        { kind: "coin", at: 850, x: -30, half: 26, resolved: false },
        { kind: "coin", at: 858, x: 0, half: 26, resolved: false },
        { kind: "coin", at: 866, x: 30, half: 26, resolved: false },
        { kind: "crystal", at: 878, x: 150, half: 26, resolved: false },
        { kind: "scroll", at: 910, x: 40, half: 40, resolved: false }
      ];
      paused = true; // freeze the tableau — the demo exists for screenshots
      hud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxSki = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
