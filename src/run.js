/*
 * Voblox mini-game — Word Run (parkour runner).
 * You auto-run; gates approach with one answer-word per lane. A clue (definition)
 * shows — steer into the lane whose word matches. Wrong gate = stumble, lose a life.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  function start(opts) {
    var words = opts.words, store = opts.store, LANES = 3;
    var wrap = document.createElement("div"); wrap.className = "gamewrap run";
    wrap.innerHTML = '<canvas id="rcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="rclue"></div>' +
      '<div class="grow"><span id="rlives"></span><span id="rscore"></span><button class="replay" id="rspeak" type="button" title="Read again">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="rmsg"></div><div class="runhint">⬆️⬇️ or tap a lane</div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#rcv"), ctx = cv.getContext("2d");
    var W, H; function resize() { W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight; } resize();
    window.addEventListener("resize", resize);
    document.getElementById("quit").onclick = leave;

    var lives = 3, score = 0, lane = 1, playerY = 0, speed = 230, running = true, raf = 0, gate = null, cooldown = 0.8, run = 0, lastSpoken = "";
    var msgEl = document.getElementById("rmsg");
    document.getElementById("rspeak").onclick = function () { VQ.speak(lastSpoken); };
    function laneY(l) { return H * 0.30 + l * (H * 0.46 / (LANES - 1)); }
    function newGate() {
      var pool = VQ.shuffle(words), tw = pool[0];
      var sense = tw.senses[Math.floor(Math.random() * tw.senses.length)];
      var options = VQ.shuffle([tw.word, pool[1].word, pool[2].word]);
      gate = { x: W * 0.94, word: tw.word, def: sense.def, pos: sense.pos, options: options, correctLane: options.indexOf(tw.word), resolved: false };
      document.getElementById("rclue").innerHTML = '🏃 Run through: <b>“' + VQ.esc(sense.def) + '”</b> <span class="posclue">(' + sense.pos + ")</span>";
      lastSpoken = "Run through the gate that means. " + sense.def; VQ.speak(lastSpoken);
    }
    function setLane(l) { lane = Math.max(0, Math.min(LANES - 1, l)); }
    function onKey(e) { var k = (e.key || "").toLowerCase(); if (k === "arrowup" || k === "w") setLane(lane - 1); else if (k === "arrowdown" || k === "s") setLane(lane + 1); }
    document.addEventListener("keydown", onKey);
    function pickLaneByY(y) { var best = 0, bd = 1e9; for (var l = 0; l < LANES; l++) { var d = Math.abs(y - laneY(l)); if (d < bd) { bd = d; best = l; } } setLane(best); }
    cv.addEventListener("mousedown", function (e) { pickLaneByY(e.clientY); });
    cv.addEventListener("touchstart", function (e) { pickLaneByY(e.changedTouches[0].clientY); }, { passive: true });
    function flash(m, col) { msgEl.textContent = m; msgEl.style.color = col || "#fff"; msgEl.style.opacity = "1"; setTimeout(function () { msgEl.style.opacity = "0"; }, 850); }
    function updateHud() { var h = ""; for (var i = 0; i < 3; i++) h += (i < lives ? "❤️" : "🖤"); document.getElementById("rlives").textContent = h; document.getElementById("rscore").textContent = "🏁 " + score; }

    function resolveGate() {
      gate.resolved = true;
      var ok = lane === gate.correctLane;
      store.record({ word: gate.word, format: "def2word_mc", kind: "mc" }, ok);
      if (ok) { score++; speed = Math.min(430, speed + 12); flash("✅ +1", "#69f0ae"); }
      else { lives--; flash("❌ it was “" + gate.options[gate.correctLane] + "”", "#ff8a8a"); if (lives <= 0) setTimeout(end, 700); }
      updateHud();
    }

    function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function draw() {
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#8ecbff"); g.addColorStop(1, "#e3f3ff"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var top = H * 0.20, bot = H * 0.86;
      ctx.fillStyle = "#7a6a55"; ctx.fillRect(0, top, W, bot - top);
      // scrolling lane lines
      ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 4; ctx.setLineDash([26, 22]); ctx.lineDashOffset = -(run % 48);
      for (var l = 0; l < LANES - 1; l++) { var y = (laneY(l) + laneY(l + 1)) / 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.setLineDash([]);
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
      // player
      ctx.font = Math.round(Math.min(58, H * 0.09)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🏃", W * 0.22, playerY);
    }
    var lastT = performance.now();
    function frame(now) {
      if (!running) return; raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      run += speed * dt;
      playerY += (laneY(lane) - playerY) * Math.min(1, dt * 12);
      if (!gate) { cooldown -= dt; if (cooldown <= 0) newGate(); }
      else { gate.x -= speed * dt; if (!gate.resolved && gate.x <= W * 0.22) resolveGate(); if (gate.x < -120) { gate = null; cooldown = 0.7; } }
      draw();
    }

    function end() {
      running = false; cancelAnimationFrame(raf);
      store.state.gems += score * 6; store.save();
      wrap.innerHTML = '<div class="card hero" style="max-width:480px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">🏁</div><div class="hero-line">Nice run!</div><div class="hero-sub">You cleared <b>' + score + "</b> gates · +" + (score * 6) + ' 💎</div><button id="again" class="submit big-next">Run again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
    }
    function cleanup() { running = false; cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); window.removeEventListener("resize", resize); if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }

    playerY = laneY(lane); updateHud(); newGate(); lastT = performance.now(); raf = requestAnimationFrame(frame);
  }
  global.VobloxRun = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
