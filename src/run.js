/*
 * Voblox mini-game — 🏃 Word Run, ghost-race edition.
 * You auto-run; gates approach with one answer-word per lane — steer into the
 * lane whose word matches the clue. NOW you race a rival: their avatar runs
 * beside you and answers gates too (by skill). Coins spawn between gates —
 * swerve to grab them. Every 5 gates = LEVEL UP (faster + bonus). First to 12
 * gates or last one standing wins.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;
  var GOAL = 12;

  function start(opts) {
    var words = opts.words, store = opts.store, LANES = 3;
    var stats = store.game("run");
    var rival = Bots.pickOpponents(1, P.botSkillFor(stats.rankPts))[0];
    var wrap = document.createElement("div"); wrap.className = "gamewrap run";
    wrap.innerHTML = '<canvas id="rcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="rclue"></div>' +
      '<div class="grow"><span id="rlives"></span><span id="rscore"></span><span id="rrival"></span><button class="replay" id="rspeak" type="button" title="Read again">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<button class="rgo" id="rgo" type="button">GO ▶</button>' +
      '<div class="gmsg" id="rmsg"></div><div class="runhint">Tap the matching lane &nbsp;•&nbsp; GO ▶ (or ➡️)</div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#rcv"), ctx = cv.getContext("2d");
    var W, H; function resize() { W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight; } resize();
    window.addEventListener("resize", resize);
    document.getElementById("quit").onclick = leave;

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var myCfg = AV.resolve(store.state);
    var lives = 3, score = 0, lane = 1, playerY = 0, speed = 78, running = true, raf = 0, gate = null, cooldown = 0.8, run = 0, lastSpoken = "", coinsGot = 0;
    var ghost = { score: 0, lane: 0, y: 0 };
    var coins = [];
    var msgEl = document.getElementById("rmsg");
    document.getElementById("rspeak").onclick = function () { VQ.speak(lastSpoken); };
    function laneY(l) { return H * 0.30 + l * (H * 0.46 / (LANES - 1)); }
    function newGate() {
      var pool = VQ.shuffle(words), tw = pool[0];
      var sense = tw.senses[Math.floor(Math.random() * tw.senses.length)];
      var options = VQ.shuffle([tw.word, pool[1].word, pool[2].word]);
      gate = { x: W * 0.94, word: tw.word, def: sense.def, pos: sense.pos, options: options, correctLane: options.indexOf(tw.word), resolved: false };
      // ghost picks its lane: right answer with skill-based probability
      ghost.lane = Math.random() < 0.3 + rival.skill * 0.5 ? gate.correctLane : Math.floor(Math.random() * LANES);
      // sprinkle coins on the way in
      coins = [];
      for (var c = 0; c < 3; c++) coins.push({ x: W * (0.4 + c * 0.16), lane: Math.floor(Math.random() * LANES), got: false });
      document.getElementById("rclue").innerHTML = '🏃 Run through: <b>“' + VQ.esc(sense.def) + '”</b> <span class="posclue">(' + sense.pos + ")</span>";
      lastSpoken = "Run through the gate that means. " + sense.def; VQ.speak(lastSpoken);
    }
    function setLane(l) { lane = Math.max(0, Math.min(LANES - 1, l)); }
    function onKey(e) { var k = (e.key || "").toLowerCase(); if (k === "arrowup" || k === "w") setLane(lane - 1); else if (k === "arrowdown" || k === "s") setLane(lane + 1); else if (k === "arrowright" || k === "d" || k === "enter" || k === " ") { e.preventDefault(); commit(); } }
    document.addEventListener("keydown", onKey);
    function pickLaneByY(y) { var best = 0, bd = 1e9; for (var l = 0; l < LANES; l++) { var d = Math.abs(y - laneY(l)); if (d < bd) { bd = d; best = l; } } setLane(best); }
    var lastTap = -9999;
    // Touch/click MOVES you into a lane; the gate auto-checks when it reaches you.
    function moveToY(clientY) { var r = cv.getBoundingClientRect(); pickLaneByY(clientY - r.top); }
    cv.addEventListener("mousedown", function (e) { if (performance.now() - lastTap < 800) return; moveToY(e.clientY); });
    cv.addEventListener("touchstart", function (e) { lastTap = performance.now(); moveToY(e.changedTouches[0].clientY); }, { passive: true });
    cv.addEventListener("touchmove", function (e) { lastTap = performance.now(); moveToY(e.changedTouches[0].clientY); }, { passive: true });
    document.getElementById("rgo").onclick = commit;
    function flash(m, col) { msgEl.textContent = m; msgEl.style.color = col || "#fff"; msgEl.style.opacity = "1"; setTimeout(function () { msgEl.style.opacity = "0"; }, 850); }
    function updateHud() {
      var h = ""; for (var i = 0; i < 3; i++) h += (i < lives ? "❤️" : "🖤");
      document.getElementById("rlives").textContent = h;
      document.getElementById("rscore").textContent = "🏁 " + score + "/" + GOAL;
      document.getElementById("rrival").textContent = "👻 " + rival.name.split(/[_ ]/)[0] + " " + ghost.score;
    }

    function resolveGate() {
      if (!gate || gate.resolved) return;
      gate.resolved = true;
      var ok = lane === gate.correctLane;
      var ghostOk = ghost.lane === gate.correctLane;
      store.record({ word: gate.word, format: "def2word_mc", kind: "mc" }, ok);
      if (ok) {
        score++; speed = Math.min(170, speed + 4);
        flash("✅ +1", "#69f0ae");
        if (sfx) sfx.coin(); if (juice) juice.burst(W * 0.22, laneY(lane), "#69f0ae", 10);
        if (score % 5 === 0) { flash("⚡ LEVEL UP! Faster!", "#ffe14d"); speed = Math.min(190, speed + 14); if (score === 10) { lives = Math.min(3, lives + 1); updateHud(); } if (sfx) sfx.chime(); }
      } else {
        lives--; flash("❌ it was “" + gate.options[gate.correctLane] + "”", "#ff8a8a");
        if (sfx) sfx.buzz(); if (juice) juice.shake(7);
      }
      if (ghostOk) ghost.score++;
      updateHud();
      gate = null;
      if (lives <= 0 || score >= GOAL || ghost.score >= GOAL) setTimeout(end, 800);
      else cooldown = 0.4;
    }
    function commit() { if (gate && !gate.resolved) resolveGate(); }

    function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function draw() {
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#8ecbff"); g.addColorStop(1, "#e3f3ff"); ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
      var top = H * 0.20, bot = H * 0.86;
      ctx.fillStyle = "#7a6a55"; ctx.fillRect(-10, top, W + 20, bot - top);
      ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 4; ctx.setLineDash([26, 22]); ctx.lineDashOffset = -(run % 48);
      for (var l = 0; l < LANES - 1; l++) { var y = (laneY(l) + laneY(l + 1)) / 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.setLineDash([]);
      // coins
      ctx.font = Math.round(Math.min(30, H * 0.05)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      coins.forEach(function (c) { if (!c.got) ctx.fillText("🪙", c.x, laneY(c.lane) + Math.sin(run * 0.15 + c.x) * 3); });
      // gate
      if (gate) {
        var dw = Math.min(120, W * 0.16), dh = H * 0.14;
        for (var gl = 0; gl < LANES; gl++) {
          var gy = laneY(gl);
          ctx.fillStyle = gate.resolved ? (gl === gate.correctLane ? "#2f9e44" : "#7a3a3a") : "#9b6dff";
          roundRect(ctx, gate.x - dw / 2, gy - dh / 2, dw, dh, 12); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold " + Math.round(Math.min(22, dw * 0.2)) + "px Trebuchet MS, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(gate.options[gl], gate.x, gy);
        }
      }
      // ghost rival (slightly behind, translucent)
      ghost.y += (laneY(ghost.lane) - ghost.y) * 0.12;
      ctx.globalAlpha = 0.55;
      AV.draw(ctx, { x: W * 0.13, y: ghost.y + H * 0.045, size: H * 0.085, config: rival.avatar, pose: "run", frame: run * 0.02 + 2, name: rival.name });
      ctx.globalAlpha = 1;
      // me (real avatar with equipped skins + trail)
      AV.draw(ctx, { x: W * 0.22, y: playerY + H * 0.05, size: H * 0.095, config: myCfg, pose: "run", frame: run * 0.02, name: store.state.profile.name });
      if (myCfg.trail && juice) juice.trail(W * 0.2, playerY + H * 0.03, myCfg.trail);
      if (myCfg.pet) { ctx.font = Math.round(H * 0.035) + "px serif"; ctx.fillText(myCfg.pet, W * 0.17, playerY - H * 0.02); }
      if (juice) juice.draw(ctx);
      ctx.restore();
    }
    var lastT = performance.now();
    function frame(now) {
      if (!running) return; raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      run += speed * dt;
      playerY += (laneY(lane) - playerY) * Math.min(1, dt * 12);
      if (!gate) { cooldown -= dt; if (cooldown <= 0) newGate(); }
      else {
        gate.x -= speed * dt;
        coins.forEach(function (c) {
          if (c.got) return;
          c.x -= speed * dt;
          if (Math.abs(c.x - W * 0.22) < 24 && c.lane === lane) {
            c.got = true; coinsGot++;
            if (juice) juice.text(c.x, laneY(c.lane) - 20, "+2", "#ffe14d");
            if (sfx) sfx.pop();
          } else if (c.x < -30) c.got = true;
        });
        if (!gate.resolved && gate.x <= W * 0.22) resolveGate();
        if (gate && gate.x < -120) { gate = null; cooldown = 0.7; }
      }
      if (juice) juice.update(dt);
      draw();
    }

    function end() {
      running = false; cancelAnimationFrame(raf);
      var win = score > ghost.score || (score >= GOAL && score >= ghost.score);
      var gems = score * 6 + coinsGot * 2 + (win ? 20 : 0);
      var res = store.recordGame("run", {
        win: win, score: score,
        rankPtsDelta: win ? 10 : score >= 6 ? 5 : 2,
        xp: 6 + score * 3 + (win ? 10 : 0),
        gems: gems
      });
      wrap.innerHTML = '<div class="card hero" style="max-width:480px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">' + (win ? "🏆" : "🏁") + '</div><div class="hero-line">' + (win ? "You beat " + VQ.esc(rival.name) + "!" : VQ.esc(rival.name) + " wins " + ghost.score + "–" + score) + '</div><div class="hero-sub">You cleared <b>' + score + "</b> gates · 🪙 " + coinsGot + " · +" + gems + ' 💎' +
        (res.rankedUp ? " · <b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + '</div><button id="again" class="submit big-next">Run again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
      if (win && sfx) sfx.fanfare();
    }
    function cleanup() { running = false; cancelAnimationFrame(raf); VQ.shush(); document.removeEventListener("keydown", onKey); window.removeEventListener("resize", resize); if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }

    playerY = laneY(lane); ghost.y = laneY(0); updateHud(); newGate(); lastT = performance.now(); raf = requestAnimationFrame(frame);
  }
  global.VobloxRun = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
