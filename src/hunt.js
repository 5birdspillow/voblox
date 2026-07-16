/*
 * Voblox mini-game — 🦌 Word Hunt, waves edition.
 * A clue shows; animals run across carrying words — shoot the one that
 * matches. Waves get faster; every 3rd wave a ✨GOLDEN✨ animal streaks by
 * (always safe to shoot: +2 ammo + bonus gems). Correct hits refund a bullet
 * and build a combo multiplier. Out of ammo = camp time.
 */
(function (global) {
  var VQ = global.VobloxQuestions, P = global.VobloxProfile;
  var ANIMALS = ["🦌", "🐰", "🦃", "🐗", "🦬", "🦆", "🐎", "🦫"];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var wrap = document.createElement("div"); wrap.className = "gamewrap hunt";
    wrap.innerHTML = '<canvas id="gcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="clue"></div>' +
      '<div class="grow"><span id="ammo"></span><span id="score"></span><span id="hcombo" style="display:none"></span><button class="replay" id="hspeak" type="button" title="Read again">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="gmsg"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#gcv"), ctx = cv.getContext("2d");
    var DPR = Math.min(global.devicePixelRatio || 1, 2);
    var W, H; function resize() { W = wrap.clientWidth; H = wrap.clientHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); } resize();
    window.addEventListener("resize", resize);
    document.getElementById("quit").onclick = leave;

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var ammo = 12, score = 0, wave = 0, combo = 0, bestCombo = 0, gemsBank = 0;
    var target = null, animals = [], golden = null, pointer = { x: -100, y: -100 }, running = true, raf = 0, flashT = -9999, lastSpoken = "";
    var msgEl = document.getElementById("gmsg");
    document.getElementById("hspeak").onclick = function () { VQ.speak(lastSpoken); };

    function newRound() {
      wave++;
      var pool = VQ.shuffle(words), tw = pool[0];
      var sense = tw.senses[Math.floor(Math.random() * tw.senses.length)];
      target = { word: tw.word, def: sense.def, pos: sense.pos };
      var labels = VQ.shuffle([tw.word].concat(pool.slice(1, 4).map(function (w) { return w.word; })));
      var n = labels.length;
      var speed = 55 + Math.min(90, wave * 9);
      animals = labels.map(function (lab, i) {
        var dir = Math.random() < 0.5 ? 1 : -1;
        var size = Math.min(60, Math.max(40, H * 0.09));
        return { word: lab, correct: lab === tw.word, emoji: ANIMALS[(i * 2 + Math.floor(Math.random() * 3)) % ANIMALS.length],
          x: W * (0.12 + Math.random() * 0.76),
          y: H * 0.55 + i * (H * 0.30 / Math.max(1, n - 1)), vx: dir * (speed + Math.random() * 55), size: size, alive: true,
          zig: wave >= 4 ? 0.5 + Math.random() : 0 }; // older waves dart around
      });
      golden = null;
      if (wave % 3 === 0) {
        golden = { x: -80, y: H * (0.3 + Math.random() * 0.2), vx: 210 + wave * 8, size: Math.min(54, H * 0.08), alive: true };
      }
      document.getElementById("clue").innerHTML = '🎯 Wave ' + wave + ' — shoot the one that means:<br><b>“' + VQ.esc(target.def) + '”</b> <span class="posclue">(' + target.pos + ")</span>";
      lastSpoken = "Shoot the animal that means. " + sense.def; VQ.speak(lastSpoken);
      cv._hunt = { animals: animals, target: target }; // test hook
      updateHud();
    }
    function updateHud() {
      document.getElementById("ammo").textContent = "🔫 " + ammo;
      document.getElementById("score").textContent = "🍖 " + score;
      var hc = document.getElementById("hcombo");
      if (combo > 1) { hc.style.display = ""; hc.textContent = "🔥 x" + combo; } else hc.style.display = "none";
    }
    function flash(m) { msgEl.textContent = m; msgEl.style.opacity = "1"; flashT = performance.now(); }

    function shoot(px, py) {
      if (!running) return;
      ammo--; updateHud();
      // golden first — it's a free-for-all bonus
      if (golden && golden.alive && Math.abs(px - golden.x) < golden.size && Math.abs(py - golden.y) < golden.size) {
        golden.alive = false; ammo += 2; gemsBank += 12;
        flash("✨ GOLDEN! +2 🔫 +12 💎");
        if (sfx) sfx.fanfare(); if (juice) { juice.burst(px, py, "#ffe14d", 18); juice.text(px, py - 30, "+12 💎", "#ffe14d"); }
        updateHud();
        return;
      }
      var hit = null;
      for (var i = animals.length - 1; i >= 0; i--) { var a = animals[i]; if (a.alive && Math.abs(px - a.x) < a.size * 0.75 && Math.abs(py - a.y) < a.size * 0.75) { hit = a; break; } }
      if (!hit) { flash("💨 Missed!"); combo = 0; updateHud(); if (sfx) sfx.pop(); if (ammo <= 0) setTimeout(end, 700); return; }
      hit.alive = false;
      if (hit.correct) {
        score++; combo++; bestCombo = Math.max(bestCombo, combo); ammo++;
        var g = (4 + wave) * Math.min(3, combo);
        gemsBank += g;
        store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, true);
        flash("🎯 " + target.word + "! +" + g + " 💎" + (combo > 1 ? " (x" + combo + ")" : "") + " +1 🔫");
        if (sfx) sfx.coin(); if (juice) { juice.burst(hit.x, hit.y, "#69f0ae", 12); juice.text(hit.x, hit.y - 30, "+" + g, "#69f0ae"); }
      } else {
        combo = 0;
        store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, false);
        flash('❌ That was “' + hit.word + "”. Answer: " + target.word);
        if (sfx) sfx.buzz(); if (juice) juice.shake(6);
      }
      updateHud();
      if (ammo <= 0) setTimeout(end, 950);
      else setTimeout(function () { if (running) newRound(); }, hit.correct ? 650 : 1150);
    }
    var lastTouch = -9999;
    cv.addEventListener("mousemove", function (e) { pointer.x = e.clientX; pointer.y = e.clientY; });
    cv.addEventListener("mousedown", function (e) { if (performance.now() - lastTouch < 800) return; pointer.x = e.clientX; pointer.y = e.clientY; shoot(e.clientX, e.clientY); });
    cv.addEventListener("touchstart", function (e) { lastTouch = performance.now(); var t = e.changedTouches[0]; pointer.x = t.clientX; pointer.y = t.clientY; shoot(t.clientX, t.clientY); }, { passive: true });
    cv.addEventListener("touchmove", function (e) { var t = e.changedTouches[0]; pointer.x = t.clientX; pointer.y = t.clientY; }, { passive: true });

    function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#9fd6ff"); g.addColorStop(1, "#d6efff"); ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.fillStyle = "#6cbf4b"; ctx.fillRect(-10, H * 0.6, W + 20, H * 0.4);
      ctx.fillStyle = "#57a83e"; for (var bx = 40; bx < W; bx += 150) { ctx.beginPath(); ctx.ellipse(bx, H * 0.6, 40, 16, 0, 0, 7); ctx.fill(); }
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (golden && golden.alive) {
        ctx.save(); ctx.translate(golden.x, golden.y);
        ctx.font = Math.round(golden.size) + "px serif"; ctx.fillText("✨", -golden.size * 0.8, 0); ctx.fillText("🦌", 0, 0); ctx.fillText("✨", golden.size * 0.8, 0);
        ctx.restore();
      }
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
      if (juice) juice.draw(ctx);
      ctx.restore();
    }
    var lastT = performance.now(), zt = 0;
    function frame(now) {
      if (!running) return; raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      zt += dt;
      animals.forEach(function (a) {
        if (!a.alive) return;
        a.x += a.vx * dt;
        if (a.zig) a.y += Math.sin(zt * 3 + a.x * 0.02) * a.zig;
        if (a.vx > 0 && a.x > W + 90) a.x = -90;
        if (a.vx < 0 && a.x < -90) a.x = W + 90;
      });
      if (golden && golden.alive) { golden.x += golden.vx * dt; if (golden.x > W + 100) golden.alive = false; }
      if (now - flashT > 1200) msgEl.style.opacity = "0";
      if (juice) juice.update(dt);
      draw();
    }

    function end() {
      running = false; cancelAnimationFrame(raf);
      var res = store.recordGame("hunt", {
        win: score >= 8, score: score,
        rankPtsDelta: score >= 8 ? 10 : score >= 4 ? 5 : 2,
        xp: 6 + score * 3 + bestCombo * 2,
        gems: gemsBank
      });
      wrap.innerHTML = '<div class="card hero" style="max-width:480px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">🏕️</div><div class="hero-line">Hunt over — wave ' + wave + '!</div><div class="hero-sub">🍖 ' + score + " caught · best combo 🔥x" + bestCombo + " · +" + gemsBank + ' 💎' +
        (res.rankedUp ? " · <b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + '</div><button id="again" class="submit big-next">Hunt again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
      if (score >= 8 && sfx) sfx.fanfare();
    }
    function cleanup() { running = false; cancelAnimationFrame(raf); VQ.shush(); window.removeEventListener("resize", resize); if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }

    newRound(); lastT = performance.now(); raf = requestAnimationFrame(frame);
  }
  global.VobloxHunt = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
