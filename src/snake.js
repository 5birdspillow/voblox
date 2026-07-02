/*
 * Voblox mini-game — Word Snake.
 * A definition clue shows; word-berries sit on the board. Steer the snake to eat the
 * berry whose word matches. Wrong berry or biting yourself costs a life. Walls wrap.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  function start(opts) {
    var words = opts.words, store = opts.store, GRID = 13;
    var wrap = document.createElement("div"); wrap.className = "gamewrap snake";
    wrap.innerHTML = '<canvas id="scv"></canvas>' +
      '<div class="ghud"><div class="clue" id="sclue"></div><div class="grow"><span id="slives"></span><span id="sscore">🍎 0</span><button class="replay" id="sspeak" type="button" title="Read again">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="dpad"><button data-d="u">▲</button><div class="dmid"><button data-d="l">◀</button><button data-d="r">▶</button></div><button data-d="d">▼</button></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#scv"), ctx = cv.getContext("2d");
    var W, H, board, cell, ox, oy;
    function resize() {
      W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight;
      board = Math.min(W, H * 0.78) * 0.96; cell = board / GRID; ox = (W - board) / 2; oy = (H - board) / 2 + H * 0.05;
    }
    resize(); window.addEventListener("resize", resize);
    document.getElementById("quit").onclick = leave;
    document.getElementById("sspeak").onclick = function () { VQ.speak(lastSpoken); };

    var snake, dir, nextDir, foods, target, lives = 3, score = 0, lastSpoken = "", running = true, raf = 0, growBy = 0;
    var sfx = global.VobloxSfx || null, walls = [], gemsBank = 0;
    function level() { return 1 + Math.floor(score / 4); }
    function stepMs() { return Math.max(105, 180 - (level() - 1) * 18); }
    function buildWalls() {
      // level 2+: little wall crosses appear (never on the snake's home row)
      walls = [];
      var lv = level();
      if (lv >= 2) [[3, 3], [9, 9]].forEach(function (p) { walls.push({ x: p[0], y: p[1] }, { x: p[0] + 1, y: p[1] }, { x: p[0], y: p[1] + 1 }); });
      if (lv >= 3) [[9, 3], [3, 9]].forEach(function (p) { walls.push({ x: p[0], y: p[1] }, { x: p[0] - 1, y: p[1] }, { x: p[0], y: p[1] - 1 }); });
    }
    function isWall(x, y) { return walls.some(function (w) { return w.x === x && w.y === y; }); }
    function cellFree(x, y) { return !isWall(x, y) && !snake.some(function (s) { return s.x === x && s.y === y; }) && !foods.some(function (f) { return f.x === x && f.y === y; }); }
    function placeFoods() {
      var pool = VQ.shuffle(words); target = pool[0];
      var s = target.senses[Math.floor(Math.random() * target.senses.length)];
      document.getElementById("sclue").innerHTML = '🐍 Eat the word that means:<br><b>“' + VQ.esc(s.def) + '”</b> <span class="posclue">(' + s.pos + ")</span>";
      lastSpoken = "Eat the word that means. " + s.def; VQ.speak(lastSpoken);
      var labels = VQ.shuffle([pool[0].word, pool[1].word, pool[2].word, pool[3] ? pool[3].word : pool[1].word]);
      var uniq = [], seen = {}; labels.forEach(function (w) { if (!seen[w]) { seen[w] = 1; uniq.push(w); } });
      foods = [];
      uniq.forEach(function (w) {
        for (var tries = 0; tries < 80; tries++) {
          var x = 1 + Math.floor(Math.random() * (GRID - 2)), y = 1 + Math.floor(Math.random() * (GRID - 2));
          if (cellFree(x, y)) { foods.push({ x: x, y: y, word: w, correct: w === target.word }); break; }
        }
      });
      // rare ⭐ golden berry: +6 gems and trims your tail (safe to eat any time)
      if (Math.random() < 0.35) {
        for (var gt = 0; gt < 80; gt++) {
          var gx2 = 1 + Math.floor(Math.random() * (GRID - 2)), gy2 = 1 + Math.floor(Math.random() * (GRID - 2));
          if (cellFree(gx2, gy2)) { foods.push({ x: gx2, y: gy2, golden: true }); break; }
        }
      }
    }
    function reset(full) {
      snake = [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }]; dir = { x: 1, y: 0 }; nextDir = dir; growBy = 0;
      if (full) { score = 0; lives = 3; }
      if (full || !foods) placeFoods();
    }
    function setDir(dx, dy) { if (dx === -dir.x && dy === -dir.y) return; nextDir = { x: dx, y: dy }; }
    function onKey(e) { var k = (e.key || "").toLowerCase(); if (k === "arrowup" || k === "w") setDir(0, -1); else if (k === "arrowdown" || k === "s") setDir(0, 1); else if (k === "arrowleft" || k === "a") setDir(-1, 0); else if (k === "arrowright" || k === "d") setDir(1, 0); }
    document.addEventListener("keydown", onKey);
    Array.prototype.forEach.call(wrap.querySelectorAll(".dpad button"), function (b) { b.onclick = function () { var d = b.dataset.d; setDir(d === "l" ? -1 : d === "r" ? 1 : 0, d === "u" ? -1 : d === "d" ? 1 : 0); }; });
    var sw0 = null;
    cv.addEventListener("touchstart", function (e) { sw0 = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }; }, { passive: true });
    cv.addEventListener("touchend", function (e) { if (!sw0) return; var dx = e.changedTouches[0].clientX - sw0.x, dy = e.changedTouches[0].clientY - sw0.y; if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(dx) > 18) setDir(dx > 0 ? 1 : -1, 0); } else if (Math.abs(dy) > 18) setDir(0, dy > 0 ? 1 : -1); sw0 = null; }, { passive: true });

    function updateHud() { var h = ""; for (var i = 0; i < 3; i++) h += (i < lives ? "❤️" : "🖤"); document.getElementById("slives").textContent = h; document.getElementById("sscore").textContent = "🍎 " + score + " · Lv" + level(); }
    function loseLife(reason) { lives--; updateHud(); flash(reason, "#ff8a8a"); if (lives <= 0) { end(); return; } reset(false); }
    var flashMsg = "", flashUntil = 0;
    function flash(m, c) { flashMsg = m; flashCol = c || "#fff"; flashUntil = performance.now() + 1000; }
    var flashCol = "#fff";

    function step() {
      if (!running) return;
      dir = nextDir;
      var head = { x: (snake[0].x + dir.x + GRID) % GRID, y: (snake[0].y + dir.y + GRID) % GRID };
      if (isWall(head.x, head.y)) { if (sfx) sfx.thud(); loseLife("Bonk! Hit a wall"); return; }
      if (snake.some(function (s) { return s.x === head.x && s.y === head.y; })) { loseLife("Ouch! You bit yourself"); return; }
      snake.unshift(head);
      var ate = null;
      for (var i = 0; i < foods.length; i++) if (foods[i].x === head.x && foods[i].y === head.y) { ate = foods[i]; break; }
      if (ate) {
        if (ate.golden) {
          foods.splice(foods.indexOf(ate), 1);
          gemsBank += 6;
          while (snake.length > 3) snake.pop(); // a trim! much easier to steer
          flash("⭐ +6 💎 and a trim!", "#ffe14d");
          if (sfx) sfx.coin();
        } else if (ate.correct) {
          score++; gemsBank += 5 + level();
          store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, true);
          updateHud(); growBy += 2;
          var lvBefore = 1 + Math.floor((score - 1) / 4);
          if (level() > lvBefore) { buildWalls(); flash("⚡ LEVEL " + level() + " — faster + walls!", "#ffe14d"); if (sfx) sfx.chime(); }
          else { flash("🍎 +1", "#69f0ae"); if (sfx) sfx.coin(); }
          placeFoods();
        } else {
          store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, false);
          foods.splice(foods.indexOf(ate), 1);
          if (growBy > 0) growBy--; else snake.pop();
          if (sfx) sfx.buzz();
          loseLife("That word didn't fit!"); return;
        }
      }
      if (growBy > 0) growBy--; else snake.pop();
    }
    function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function gx(x) { return ox + x * cell; } function gy(y) { return oy + y * cell; }
    function draw() {
      cv._snake = { foods: foods, head: snake[0], walls: walls }; // test hook
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#163b1f"; ctx.fillRect(0, 0, W, H);
      // board
      for (var x = 0; x < GRID; x++) for (var y = 0; y < GRID; y++) { ctx.fillStyle = (x + y) % 2 ? "#2f6b3a" : "#357a42"; ctx.fillRect(gx(x), gy(y), cell + 1, cell + 1); }
      // walls
      walls.forEach(function (w2) { ctx.fillStyle = "#5a4632"; rr(ctx, gx(w2.x) + 1, gy(w2.y) + 1, cell - 2, cell - 2, 4); ctx.fill(); ctx.fillStyle = "#6d5540"; ctx.fillRect(gx(w2.x) + 3, gy(w2.y) + 3, cell - 6, 4); });
      // foods + labels
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      foods.forEach(function (f) {
        ctx.font = Math.round(cell * 0.8) + "px serif";
        ctx.fillText(f.golden ? "⭐" : "🍎", gx(f.x) + cell / 2, gy(f.y) + cell / 2);
        if (f.golden) return;
        ctx.font = "bold " + Math.max(11, Math.round(cell * 0.42)) + "px Trebuchet MS, sans-serif";
        var tw = ctx.measureText(f.word).width;
        ctx.fillStyle = "rgba(255,255,255,0.95)"; rr(ctx, gx(f.x) + cell / 2 - tw / 2 - 7, gy(f.y) - cell * 0.72, tw + 14, cell * 0.6, 7); ctx.fill();
        ctx.fillStyle = "#20303a"; ctx.fillText(f.word, gx(f.x) + cell / 2, gy(f.y) - cell * 0.42);
      });
      // snake
      snake.forEach(function (s, i) { ctx.fillStyle = i === 0 ? "#ffd23f" : "#5fd35f"; rr(ctx, gx(s.x) + 1, gy(s.y) + 1, cell - 2, cell - 2, 5); ctx.fill(); });
      // flash
      if (performance.now() < flashUntil) { ctx.fillStyle = flashCol; ctx.font = "900 " + Math.round(H * 0.05) + "px Trebuchet MS, sans-serif"; ctx.fillText(flashMsg, W / 2, H * 0.12); }
    }
    function end() {
      running = false; cancelAnimationFrame(raf);
      var res = store.recordGame("snake", {
        win: score >= 8, score: score,
        rankPtsDelta: score >= 8 ? 10 : score >= 4 ? 5 : 2,
        xp: 5 + score * 3,
        gems: gemsBank + score * 5
      });
      wrap.innerHTML = '<div class="card hero" style="max-width:460px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">🐍</div><div class="hero-line">Game over — level ' + level() + '!</div><div class="hero-sub">You ate <b>' + score + "</b> right words · +" + (gemsBank + score * 5) + ' 💎' + ((res && res.rankedUp) ? " · <b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + '</div><button id="again" class="submit big-next">Play again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
    }
    function cleanup() { running = false; cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); window.removeEventListener("resize", resize); if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }

    buildWalls(); reset(true); updateHud();
    var acc = 0, lastT = performance.now();
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      acc += (now - lastT); lastT = now;
      var guard = 0;
      while (acc >= stepMs() && guard++ < 4) { acc -= stepMs(); step(); }
      draw();
    }
    raf = requestAnimationFrame(frame);
  }
  global.VobloxSnake = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
