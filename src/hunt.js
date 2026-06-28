/*
 * Voblox mini-game — Word Hunt (Oregon Trail-style hunting).
 * A clue (definition) shows; animals run across each carrying a word.
 * Aim the crosshair and shoot the animal whose word matches the clue. Limited bullets.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  var ANIMALS = ["🦌", "🐰", "🦃", "🐗", "🦬", "🦆", "🐎", "🦫"];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var wrap = document.createElement("div"); wrap.className = "gamewrap hunt";
    wrap.innerHTML = '<canvas id="gcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="clue"></div>' +
      '<div class="grow"><span id="ammo"></span><span id="score"></span><button class="replay" id="hspeak" type="button" title="Read again">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="gmsg"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#gcv"), ctx = cv.getContext("2d");
    var W, H; function resize() { W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight; } resize();
    window.addEventListener("resize", resize);
    document.getElementById("quit").onclick = leave;

    var ammo = 12, score = 0, target = null, animals = [], pointer = { x: -100, y: -100 }, running = true, raf = 0, flashT = -9999, lastSpoken = "";
    var msgEl = document.getElementById("gmsg");
    document.getElementById("hspeak").onclick = function () { VQ.speak(lastSpoken); };

    function newRound() {
      var pool = VQ.shuffle(words), tw = pool[0];
      var sense = tw.senses[Math.floor(Math.random() * tw.senses.length)];
      target = { word: tw.word, def: sense.def, pos: sense.pos };
      var labels = VQ.shuffle([tw.word].concat(pool.slice(1, 4).map(function (w) { return w.word; })));
      var n = labels.length;
      animals = labels.map(function (lab, i) {
        var dir = Math.random() < 0.5 ? 1 : -1;
        var size = Math.min(60, Math.max(40, H * 0.09));
        return { word: lab, correct: lab === tw.word, emoji: ANIMALS[(i * 2 + Math.floor(Math.random() * 3)) % ANIMALS.length],
          x: W * (0.12 + Math.random() * 0.76),
          y: H * 0.55 + i * (H * 0.30 / Math.max(1, n - 1)), vx: dir * (55 + Math.random() * 55), size: size, alive: true };
      });
      document.getElementById("clue").innerHTML = '🎯 Shoot the one that means:<br><b>“' + VQ.esc(target.def) + '”</b> <span class="posclue">(' + target.pos + ")</span>";
      lastSpoken = "Shoot the animal that means. " + target.def; VQ.speak(lastSpoken);
      updateHud();
    }
    function updateHud() { document.getElementById("ammo").textContent = "🔫 " + ammo; document.getElementById("score").textContent = "🍖 " + score; }
    function flash(m) { msgEl.textContent = m; msgEl.style.opacity = "1"; flashT = performance.now(); }

    function shoot(px, py) {
      if (!running) return;
      ammo--; updateHud();
      var hit = null;
      for (var i = animals.length - 1; i >= 0; i--) { var a = animals[i]; if (a.alive && Math.abs(px - a.x) < a.size * 0.75 && Math.abs(py - a.y) < a.size * 0.75) { hit = a; break; } }
      if (!hit) { flash("💨 Missed!"); if (ammo <= 0) setTimeout(end, 700); return; }
      hit.alive = false;
      if (hit.correct) { score++; store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, true); flash("🎯 Caught the " + target.word + "!"); }
      else { store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, false); flash('❌ That was “' + hit.word + "”. Answer: " + target.word); }
      if (ammo <= 0) setTimeout(end, 950);
      else setTimeout(function () { if (running) newRound(); }, hit.correct ? 700 : 1150);
    }
    cv.addEventListener("mousemove", function (e) { pointer.x = e.clientX; pointer.y = e.clientY; });
    cv.addEventListener("mousedown", function (e) { pointer.x = e.clientX; pointer.y = e.clientY; shoot(e.clientX, e.clientY); });
    cv.addEventListener("touchstart", function (e) { var t = e.changedTouches[0]; pointer.x = t.clientX; pointer.y = t.clientY; shoot(t.clientX, t.clientY); }, { passive: true });
    cv.addEventListener("touchmove", function (e) { var t = e.changedTouches[0]; pointer.x = t.clientX; pointer.y = t.clientY; }, { passive: true });

    function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function draw() {
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#9fd6ff"); g.addColorStop(1, "#d6efff"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#6cbf4b"; ctx.fillRect(0, H * 0.6, W, H * 0.4);
      ctx.fillStyle = "#57a83e"; for (var bx = 40; bx < W; bx += 150) { ctx.beginPath(); ctx.ellipse(bx, H * 0.6, 40, 16, 0, 0, 7); ctx.fill(); }
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      animals.forEach(function (a) {
        if (!a.alive) return;
        ctx.save(); ctx.translate(a.x, a.y); if (a.vx < 0) ctx.scale(-1, 1);
        ctx.font = Math.round(a.size) + "px serif"; ctx.fillText(a.emoji, 0, 0); ctx.restore();
        ctx.font = "bold " + Math.round(a.size * 0.34) + "px Trebuchet MS, sans-serif";
        var tw = ctx.measureText(a.word).width;
        ctx.fillStyle = "rgba(255,255,255,0.94)"; roundRect(ctx, a.x - tw / 2 - 9, a.y - a.size * 0.95 - 24, tw + 18, 27, 9); ctx.fill();
        ctx.fillStyle = "#20303a"; ctx.fillText(a.word, a.x, a.y - a.size * 0.95 - 10);
      });
      ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 16, 0, 7);
      ctx.moveTo(pointer.x - 24, pointer.y); ctx.lineTo(pointer.x - 6, pointer.y); ctx.moveTo(pointer.x + 6, pointer.y); ctx.lineTo(pointer.x + 24, pointer.y);
      ctx.moveTo(pointer.x, pointer.y - 24); ctx.lineTo(pointer.x, pointer.y - 6); ctx.moveTo(pointer.x, pointer.y + 6); ctx.lineTo(pointer.x, pointer.y + 24);
      ctx.stroke();
    }
    var lastT = performance.now();
    function frame(now) {
      if (!running) return; raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      animals.forEach(function (a) { if (!a.alive) return; a.x += a.vx * dt; if (a.vx > 0 && a.x > W + 90) a.x = -90; if (a.vx < 0 && a.x < -90) a.x = W + 90; });
      if (now - flashT > 1200) msgEl.style.opacity = "0";
      draw();
    }

    function end() {
      running = false; cancelAnimationFrame(raf);
      store.state.gems += score * 8; store.save();
      wrap.innerHTML = '<div class="card hero" style="max-width:480px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">🏕️</div><div class="hero-line">Hunt over!</div><div class="hero-sub">You caught <b>' + score + "</b> animals · +" + (score * 8) + ' 💎</div><button id="again" class="submit big-next">Hunt again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
    }
    function cleanup() { running = false; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }

    newRound(); lastT = performance.now(); raf = requestAnimationFrame(frame);
  }
  global.VobloxHunt = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
