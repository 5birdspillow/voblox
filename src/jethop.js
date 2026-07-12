/*
 * Voblox arcade game — 🐤 JET HOP (a kid-kind flappy flier with a jetpack twist).
 * Your chick straps on a tiny jetpack; TAP = a puff of thrust. Gravity pulls you
 * down; fly through blocky GATE towers that scroll left. Each gate cleared = +1.
 * Speed and gap tightness ramp SLOWLY, and it never feels mean:
 *   - brushing a tower knocks you into a 1s TUMBLE (you lose your coin streak) —
 *     only a full floor crash or a SECOND brush mid-tumble ends the run.
 * COLLECT between gates: 🪙 coins (5-in-a-row = bonus), 🎈 balloons (+3),
 * and a rare ⭐ star that starts STARBURST (3s invincible zoom, auto-collect).
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🚀 BOOSTER: once per run, crashing opens a WORD that revives you at the
 *     crash point with 2s of invincibility.
 *   - 📜 SCROLL: every 15 gates a scroll floats in a gap — fly through, answer,
 *     and correct grants STARBURST + doubles every coin for the rest of the run.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("jethop")
 * per run, banked on run-over, quit, AND app-close. Stats persist additively.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("jethop");
    // additive, never-renamed save fields
    stats.bestGates = stats.bestGates || 0;
    stats.totalCoins = stats.totalCoins || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap jethop";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="jhcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="jhmsg">🐤 Jet Hop — tap to puff!</div>' +
      '<div class="grow"><span id="jhscore">🚀 0</span><span id="jhcoins">🪙 0</span>' +
      '<span id="jhtag"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="jhbig"></div>' +
      '<div class="gover" id="jhq" style="display:none"></div>' +
      '<div class="gover" id="jhcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#jhcv"), ctx = cv.getContext("2d");
    var jhq = document.getElementById("jhq"), jhcard = document.getElementById("jhcard");
    var msgEl = document.getElementById("jhmsg"), bigEl = document.getElementById("jhbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- responsive metrics ----------
    var W, H, chickX, chickR, floorY, topMargin, towerW, GAP_DX, itemR;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      chickX = W * 0.30;
      chickR = Math.max(14, Math.min(W, H) * 0.038);
      floorY = H * 0.86;
      topMargin = H * 0.10;
      towerW = W * 0.15;
      GAP_DX = W * 0.62;
      itemR = chickR * 0.72;
    }
    resize();
    window.addEventListener("resize", resize);

    // physics tuned as fractions of H so the FEEL is identical on any screen
    function GR() { return H * 1.5; }             // gravity px/s^2
    function FLAP() { return -H * 0.52; }          // one-puff impulse (upward)
    function MAXFALL() { return H * 0.72; }        // terminal dive speed
    function baseSpeed() { return W * 0.30; }       // world scroll px/s
    function speedNow() { return baseSpeed() * (1 + Math.min(0.6, gates * 0.02)) * (starburst > 0 ? 1.35 : 1); }
    function gapHalf() { return H * (0.20 - 0.07 * Math.min(1, gates / 40)); }

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var y = 0, vy = 0, flapAnim = 0;
    var gatesArr = [], items = [], puffs = [], clouds = [], hills = [];
    var gates = 0, gateSeq = 0, coins = 0, streak = 0;
    var tumbling = false, tumbleT = 0, starburst = 0, invincT = 0, doubled = false;
    var over = false, paused = false, banked = false, statsSaved = false;
    var boosterUsed = false, boosterOpen = false, crashY = 0, runT = 0;
    var lastFmt = null;

    function inv() { return starburst > 0 || invincT > 0; }

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1100);
    }
    function updateHud() {
      document.getElementById("jhscore").textContent = "🚀 " + gates;
      document.getElementById("jhcoins").textContent = "🪙 " + coins;
      document.getElementById("jhtag").textContent =
        starburst > 0 ? "⭐ " + Math.ceil(starburst) + "s" : doubled ? "✨×2" : "";
    }

    // ---------- world building ----------
    function makeClouds() {
      clouds = []; hills = [];
      for (var i = 0; i < 5; i++) clouds.push({ x: Math.random() * W, y: topMargin + Math.random() * H * 0.35, s: 0.6 + Math.random() * 0.8 });
      for (var h = 0; h < 4; h++) hills.push({ x: h * W * 0.4, r: W * (0.3 + Math.random() * 0.2) });
    }
    function spawnItemsBefore(g, prevX) {
      // a gentle coin trail leading into this gap
      var n = 3 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i++) {
        var fx = (i + 1) / (n + 1);
        items.push({ type: "coin", x: prevX + (g.x - prevX) * fx, y: g.cy + Math.sin(fx * Math.PI) * gapHalf() * 0.4, taken: false });
      }
      var midX = prevX + (g.x - prevX) * 0.5;
      var roll = Math.random();
      if (roll < 0.06) items.push({ type: "star", x: midX, y: topMargin + Math.random() * (floorY - topMargin), taken: false });
      else if (roll < 0.30) items.push({ type: "balloon", x: midX, y: topMargin + Math.random() * (floorY - topMargin - H * 0.1), taken: false });
    }
    function spawnGate(x) {
      gateSeq++;
      var half = gapHalf();
      var minY = topMargin + half, maxY = floorY - half;
      var cy = minY + Math.random() * Math.max(1, maxY - minY);
      var prevX = gatesArr.length ? gatesArr[gatesArr.length - 1].x : x - GAP_DX;
      var g = { x: x, cy: cy, half: half, passed: false, hit: false, scroll: (gateSeq % 15 === 0) };
      gatesArr.push(g);
      spawnItemsBefore(g, prevX);
      if (g.scroll) items.push({ type: "scroll", x: g.x, y: g.cy, taken: false });
    }
    function ensureGates() {
      while (gatesArr.length === 0 || gatesArr[gatesArr.length - 1].x < W + GAP_DX) {
        var nx = gatesArr.length ? gatesArr[gatesArr.length - 1].x + GAP_DX : W * 1.05;
        spawnGate(nx);
      }
    }

    // ---------- run lifecycle ----------
    function begin() {
      y = H * 0.42; vy = 0; flapAnim = 0;
      gatesArr = []; items = []; puffs = [];
      gates = 0; gateSeq = 0; coins = 0; streak = 0;
      tumbling = false; tumbleT = 0; starburst = 0; invincT = 0; doubled = false;
      over = false; paused = false; banked = false; statsSaved = false;
      boosterUsed = false; boosterOpen = false; runT = 0;
      makeClouds(); ensureGates();
      jhcard.style.display = "none"; jhq.style.display = "none";
      updateHud();
      big("🐤 GO!", "#8ef");
    }

    function rewards() {
      return {
        win: gates >= 30,
        score: gates,
        rankPtsDelta: Math.min(10, 1 + Math.floor(gates / 4)),
        xp: Math.min(80, 6 + gates * 2 + Math.floor(coins / 2)),
        gems: Math.min(120, 3 + Math.round(coins * 2)) // coins-based, capped
      };
    }
    // the ONE bank path — computed once, guarded, recorded to the store engine
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = rewards();
      var res = store.recordGame ? store.recordGame("jethop", rw) : null;
      return { rw: rw, res: res };
    }
    // additive persistence: best gate count + lifetime coins (once per run)
    function endRunStats() {
      if (statsSaved) return; statsSaved = true;
      if (gates > (stats.bestGates || 0)) stats.bestGates = gates;
      stats.totalCoins = (stats.totalCoins || 0) + coins;
      if (store.save) store.save();
    }

    function runOver() {
      if (over) return;
      over = true; paused = true;
      endRunStats();
      var b = bankRun();
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(12);
      showEnd(b ? b.rw : rewards());
    }
    function showEnd(rw) {
      jhcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">🐤💨</div>' +
        '<div class="wqtitle" style="font-size:20px">Run over!</div>' +
        '<div style="margin:4px 0;font-size:15px">🚀 Gates <b>' + gates + '</b> · 🪙 Coins <b>' + coins + '</b> · 🏆 Best <b>' + (stats.bestGates || 0) + '</b></div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        (rw.win ? '<div style="color:#2f9e44;font-weight:900">🏅 30+ gates — high flier!</div>' : '') +
        '<button class="submit big-next" id="jhreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="jhleave" type="button">Leave</button></div>';
      jhcard.style.display = "flex";
      if (rw && sfx && sfx.fanfare && gates >= (stats.bestGates || 0) && gates > 0) sfx.fanfare();
      document.getElementById("jhreplay").onclick = function () { jhcard.style.display = "none"; begin(); };
      document.getElementById("jhleave").onclick = exit;
    }

    // ---------- crashes & the booster word ----------
    function fatalCrash() {
      if (over || boosterOpen || paused) return;
      crashY = y;
      if (!boosterUsed) openBooster(); else runOver();
    }
    function openBooster() {
      paused = true; boosterOpen = true;
      cv._lastQ = VQ.miniQuiz(jhq, words, store, {
        title: "🚀 BOOSTER! Answer a word to blast back in!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; boosterUsed = true; boosterOpen = false;
          if (ok) {
            paused = false; tumbling = false; tumbleT = 0;
            y = Math.max(topMargin + chickR, Math.min(floorY - chickR, crashY));
            vy = FLAP() * 0.4; invincT = 2; // revive at the crash point, 2s invincible
            big("🚀 BOOST! 2s of invincible flight!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(chickX, y, "#ffd23f", 22);
          } else {
            runOver();
          }
        }
      });
    }
    function beginTumble() {
      tumbling = true; tumbleT = 1; streak = 0;
      vy = FLAP() * 0.35;
      big("😵 Tumble! Coin streak lost — steady now!", "#ffd23f");
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(8);
    }

    // ---------- the scroll word (STARBURST + double coins) ----------
    function openScroll() {
      paused = true;
      cv._lastQ = VQ.miniQuiz(jhq, words, store, {
        title: "📜 SCROLL WORD! Answer to unleash a STARBURST!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            startStarburst(3); doubled = true;
            big("📜⭐ STARBURST! Coins DOUBLED for the rest of the run!", "#ffd23f");
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("The scroll crumbled…", "#ff8a8a");
          updateHud();
        }
      });
    }
    function startStarburst(sec) {
      starburst = sec;
      if (juice) juice.shake(6);
      if (sfx && sfx.chime) sfx.chime();
    }

    // ---------- collectibles ----------
    function collect(it) {
      if (it.taken) return; it.taken = true;
      if (it.type === "coin") {
        var g = doubled ? 2 : 1; coins += g; streak++;
        if (streak % 5 === 0) { coins += doubled ? 10 : 5; big("🪙 STREAK ×5! Bonus coins!", "#ffd23f"); if (juice) juice.burst(chickX, y, "#ffd23f", 18); }
        if (juice) juice.text(chickX, y - 12, "+" + g, "#ffd23f");
        if (sfx && sfx.coin) sfx.coin();
      } else if (it.type === "balloon") {
        coins += doubled ? 6 : 3;
        big("🎈 POP! +" + (doubled ? 6 : 3) + " coins", "#8ecdf7");
        if (juice) juice.burst(it.x, it.y, "#ff8a8a", 16);
        if (sfx && sfx.pop) sfx.pop();
      } else if (it.type === "star") {
        startStarburst(3);
        big("⭐ STARBURST! Invincible zoom!", "#ffd23f");
        if (juice) juice.burst(it.x, it.y, "#ffe14d", 22);
      } else if (it.type === "scroll") {
        openScroll();
      }
      updateHud();
    }

    // ---------- flap ----------
    function flap() {
      if (over || paused) return;
      vy = FLAP();
      flapAnim = 0.18;
      for (var i = 0; i < 4; i++) puffs.push({ x: chickX - chickR * 0.6, y: y + chickR * 0.5, vx: -60 - Math.random() * 60, vy: 60 + Math.random() * 80, life: 0.4 });
      if (sfx && sfx.pop) sfx.pop();
    }

    // ---------- simulation ----------
    function step(dt) {
      runT += dt;
      // timers
      if (starburst > 0) { starburst = Math.max(0, starburst - dt); if (starburst === 0) big("⭐ Zoom over!", "#ffd23f"); }
      if (invincT > 0) invincT = Math.max(0, invincT - dt);
      if (tumbling) { tumbleT -= dt; if (tumbleT <= 0) tumbling = false; }
      if (flapAnim > 0) flapAnim = Math.max(0, flapAnim - dt);

      // chick physics
      vy = Math.min(MAXFALL(), vy + GR() * dt);
      y += vy * dt;
      if (y - chickR < 0) { y = chickR; if (vy < 0) vy = 0; }        // soft ceiling
      if (y + chickR >= floorY) {                                     // the ground
        if (inv()) { y = floorY - chickR; vy = FLAP() * 0.6; }        // bounce while invincible
        else { y = floorY - chickR; fatalCrash(); return; }
      }

      // scroll the world
      var spd = speedNow();
      var dx = spd * dt;
      var i;
      for (i = 0; i < gatesArr.length; i++) gatesArr[i].x -= dx;
      for (i = 0; i < items.length; i++) items[i].x -= dx;
      for (i = 0; i < clouds.length; i++) { clouds[i].x -= dx * 0.25 * clouds[i].s; if (clouds[i].x < -W * 0.2) { clouds[i].x = W + W * 0.1; clouds[i].y = topMargin + Math.random() * H * 0.35; } }
      for (i = 0; i < hills.length; i++) { hills[i].x -= dx * 0.5; if (hills[i].x < -hills[i].r) hills[i].x += hills.length * W * 0.4 + W * 0.4; }

      // gates: pass scoring + kid-kind collision
      for (i = 0; i < gatesArr.length; i++) {
        var g = gatesArr[i];
        if (!g.passed && g.x < chickX) { g.passed = true; gates++; if (gates % 25 === 0) big("🌅 The sky shifts…", "#c9b6ff"); updateHud(); }
        var overlapX = Math.abs(chickX - g.x) < towerW / 2 + chickR;
        if (overlapX && !g.hit && !inv()) {
          var insideGap = (y - chickR > g.cy - g.half) && (y + chickR < g.cy + g.half);
          if (!insideGap) {
            g.hit = true;
            if (tumbling) { fatalCrash(); return; }
            beginTumble();
          }
        }
      }
      // drop offscreen gates
      while (gatesArr.length && gatesArr[0].x < -towerW) gatesArr.shift();
      ensureGates();

      // collectibles
      for (i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        if (it.taken) { items.splice(i, 1); continue; }
        if (it.x < -itemR * 2) { items.splice(i, 1); continue; }
        var near = Math.abs(chickX - it.x) < chickR + itemR;
        if (starburst > 0 && Math.abs(chickX - it.x) < chickR * 4) { collect(it); continue; } // vacuum
        if (near && Math.abs(y - it.y) < chickR + itemR) collect(it);
      }
      // puffs
      for (i = puffs.length - 1; i >= 0; i--) { var p = puffs[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) puffs.splice(i, 1); }
      if (juice) juice.update(dt);
    }

    // ---------- drawing ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // day-night gradient shifts smoothly every 25 gates
      var nt = 0.5 - 0.5 * Math.cos(Math.PI * (gates % 50) / 25);
      function mix(a, b, t) { return Math.round(a + (b - a) * t); }
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgb(" + mix(120, 20, nt) + "," + mix(196, 26, nt) + "," + mix(255, 64, nt) + ")");
      g.addColorStop(1, "rgb(" + mix(196, 12, nt) + "," + mix(232, 16, nt) + "," + mix(255, 40, nt) + ")");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // moon/sun
      ctx.fillStyle = nt > 0.5 ? "rgba(255,255,220,.85)" : "rgba(255,240,180,.9)";
      ctx.beginPath(); ctx.arc(W * 0.78, H * 0.2, Math.min(W, H) * 0.07, 0, Math.PI * 2); ctx.fill();
      // parallax clouds
      ctx.fillStyle = "rgba(255,255,255," + (0.7 - nt * 0.4) + ")";
      for (var c = 0; c < clouds.length; c++) {
        var cl = clouds[c], cr = W * 0.05 * cl.s;
        ctx.beginPath();
        ctx.arc(cl.x, cl.y, cr, 0, Math.PI * 2);
        ctx.arc(cl.x + cr, cl.y + cr * 0.3, cr * 0.8, 0, Math.PI * 2);
        ctx.arc(cl.x - cr, cl.y + cr * 0.3, cr * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // parallax hills
      ctx.fillStyle = nt > 0.5 ? "#123018" : "#3f8a4a";
      for (var h = 0; h < hills.length; h++) { ctx.beginPath(); ctx.arc(hills[h].x, floorY, hills[h].r, Math.PI, 0); ctx.fill(); }
      // gate towers (blocky)
      for (var i = 0; i < gatesArr.length; i++) {
        var ga = gatesArr[i], gx = ga.x - towerW / 2;
        ctx.fillStyle = nt > 0.5 ? "#2b6cb0" : "#37b24d";
        ctx.fillRect(gx, 0, towerW, ga.cy - ga.half);
        ctx.fillRect(gx, ga.cy + ga.half, towerW, floorY - (ga.cy + ga.half));
        ctx.fillStyle = "rgba(0,0,0,.18)";
        ctx.fillRect(gx, ga.cy - ga.half - 14, towerW, 14);
        ctx.fillRect(gx, ga.cy + ga.half, towerW, 14);
      }
      // ground
      ctx.fillStyle = nt > 0.5 ? "#1b1006" : "#8a5a2b"; ctx.fillRect(0, floorY, W, H - floorY);
      // items
      for (i = 0; i < items.length; i++) {
        var it = items[i]; if (it.taken) continue;
        var e = it.type === "coin" ? "🪙" : it.type === "balloon" ? "🎈" : it.type === "star" ? "⭐" : "📜";
        var sc = it.type === "scroll" ? itemR * 2.6 : itemR * 2.1;
        ctx.font = Math.round(sc) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(e, it.x, it.y + Math.sin(runT * 5 + it.x) * 3);
      }
      // puffs (jet thrust)
      for (i = 0; i < puffs.length; i++) { ctx.globalAlpha = Math.max(0, puffs[i].life * 2); ctx.fillStyle = "#ffd27f"; ctx.beginPath(); ctx.arc(puffs[i].x, puffs[i].y, chickR * 0.35, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      // the chick + jetpack (rotate: nose up on flap, dive when falling; squash/stretch)
      ctx.save();
      ctx.translate(chickX, y);
      var rot = Math.max(-0.5, Math.min(1.0, vy / (H * 0.9)));
      if (tumbling) rot = Math.sin(runT * 22) * 0.9;
      ctx.rotate(rot);
      if (inv()) { ctx.shadowColor = "#ffe14d"; ctx.shadowBlur = 22; }
      // jetpack behind
      ctx.fillStyle = "#8a94a6"; ctx.fillRect(-chickR * 0.95, -chickR * 0.5, chickR * 0.5, chickR);
      var sx = 1 + flapAnim * 1.2, sy = 1 - flapAnim * 0.8; // squash on flap
      ctx.font = Math.round(chickR * 2 * Math.max(0.7, sy)) + "px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.scale(sx, sy); ctx.fillText("🐤", 0, 0); ctx.restore();
      ctx.restore();
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

    // ---------- input (canvas + Space; all listeners die on exit) ----------
    function onTouch(e) { e.preventDefault(); flap(); }
    function onMouse() { flap(); }
    function onKey(e) { if (e.code === "Space" || e.key === " " || e.keyCode === 32) { e.preventDefault(); flap(); } }
    cv.addEventListener("touchstart", onTouch, { passive: false });
    cv.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);

    // ---------- exit / banking ----------
    function bankExit() {
      if (over) return; // run-over already banked
      if (gates === 0 && coins === 0) return; // an untouched run banks nothing
      endRunStats();
      var b = bankRun();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🐤 Jet Hop banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
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

    // ---------- test API (on the canvas) ----------
    cv._jethop = {
      state: function () {
        return {
          gates: gates, coins: coins, streak: streak, tumbling: tumbling,
          starburst: starburst, doubled: doubled, over: over, banked: banked,
          best: stats.bestGates || 0, y: y, vy: vy
        };
      },
      begin: begin,
      flap: flap,
      warpGate: function (n) { gates = n; updateHud(); },
      nextGap: function () {
        ensureGates();
        for (var i = 0; i < gatesArr.length; i++) {
          var g = gatesArr[i];
          if (g.x + towerW / 2 > chickX && !g.passed) return { x: g.x, yTop: g.cy - g.half, yBot: g.cy + g.half };
        }
        var f = gatesArr[0];
        return { x: f.x, yTop: f.cy - f.half, yBot: f.cy + f.half };
      },
      placeCoin: function (x, y2) { items.push({ type: "coin", x: x, y: y2, taken: false }); },
      placeScroll: function () { items.push({ type: "scroll", x: chickX, y: y, taken: false }); },
      crash: function () { fatalCrash(); },
      tick: function (sec) {
        var left = sec;
        while (left > 0.0001) { var d = Math.min(0.05, left); left -= d; if (!paused && !over) step(d); }
      }
    };

    // ---------- boot ----------
    begin();
    if (global._jethopdemo) { // screenshot seed: a lively mid-flight tableau
      global._jethopdemo = 0;
      gates = 18; gateSeq = 18; coins = 27;
      // a coin trail streaming behind, and a scroll waiting in the next gap
      ensureGates();
      for (var d = 0; d < 6; d++) items.push({ type: "coin", x: chickX - d * chickR * 2.2, y: y + Math.sin(d) * chickR, taken: false });
      var ng = gatesArr[0]; if (ng) items.push({ type: "scroll", x: ng.x, y: ng.cy, taken: false });
      updateHud();
      paused = true; // freeze the tableau — the demo exists for screenshots
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxJetHop = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
