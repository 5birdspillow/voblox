/*
 * Voblox arcade game — 🥷 NINJA SLICE (a juicy Fruit-Ninja-style slicer).
 * Fruits arc up from the bottom; drag a blade to slice them for points and
 * splashy particles. Slice two-plus in one stroke for a COMBO bonus. 💣 Bombs
 * arc up too — slicing one costs a heart. Three hearts, endless waves, best
 * score kept forever.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - ⭐ FRENZY: slicing fills a meter; full meter offers a WORD. Answer it and
 *     the sky rains fruit for 10s — NO bombs, DOUBLE points.
 *   - 💖 SECOND CHANCE: lose your last heart and a WORD can revive you (once).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("slice")
 * per run, banked on run-over, quit, AND app-close. Stats persist additively.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // juicy fruit table (emoji + splash color); 💣 is the only thing that bites
  var FRUITS = [
    { e: "🍉", c: "#ff5b6e" }, { e: "🍎", c: "#ff5b5b" }, { e: "🍌", c: "#ffe14d" },
    { e: "🍊", c: "#ff9f43" }, { e: "🍇", c: "#b06aff" }, { e: "🍍", c: "#ffd23f" },
    { e: "🥝", c: "#8ed44f" }, { e: "🍓", c: "#ff4d6d" }, { e: "🍑", c: "#ff8f6b" }
  ];
  var G = 1500; // gravity (px/s^2) — tuned so a full arc lasts a satisfying beat

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("slice");
    // additive, never-renamed save fields
    stats.bestScore = stats.bestScore || 0;
    stats.totalSliced = stats.totalSliced || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap slice";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="slcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="slmsg">🥷 Ninja Slice — drag to slice!</div>' +
      '<div class="grow"><span id="slscore">🍉 0</span><span id="slhearts">❤️❤️❤️</span>' +
      '<span id="slwave">Wave 1</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="slbig"></div>' +
      '<button id="slfrz" type="button" style="display:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 40px);' +
      'transform:translateX(-50%);z-index:8;background:linear-gradient(#ffe14d,#ffb01f);color:#5a3d00;' +
      'border:none;border-radius:16px;padding:14px 22px;font-family:inherit;font-weight:900;font-size:18px;' +
      'box-shadow:0 6px 0 #b9791a,0 10px 24px #0006;cursor:pointer">⭐ FRENZY — answer a word!</button>' +
      '<div class="gover" id="slq" style="display:none"></div>' +
      '<div class="gover" id="slcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#slcv"), ctx = cv.getContext("2d");
    var slq = document.getElementById("slq"), slcard = document.getElementById("slcard");
    var msgEl = document.getElementById("slmsg"), bigEl = document.getElementById("slbig");
    var frzBtn = document.getElementById("slfrz");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H, objR2;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      objR2 = Math.max(24, Math.min(W, H) * 0.062); // fruit radius
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var objects = [], trail = [];
    var score = 0, hearts = 3, wave = 1, runT = 0, spawnT = 0.4;
    var frenzy = 0, frenzyOn = false, frenzyT = 0;
    var over = false, paused = false, banked = false, statsSaved = false;
    var secondChanceUsed = false, slicedTotal = 0;
    var dragging = false, lastX = 0, lastY = 0, strokeCount = 0, frzShown = false;
    var lastFmt = null;

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1100);
    }
    function updateHud() {
      document.getElementById("slscore").textContent = "🍉 " + score;
      var hs = ""; for (var i = 0; i < 3; i++) hs += i < hearts ? "❤️" : "🖤";
      document.getElementById("slhearts").textContent = hs;
      document.getElementById("slwave").textContent = (frenzyOn ? "⭐ FRENZY " : "Wave ") + (frenzyOn ? Math.ceil(frenzyT) + "s" : wave);
    }

    // ---------- run lifecycle ----------
    function begin() {
      objects = []; trail = [];
      score = 0; hearts = 3; wave = 1; runT = 0; spawnT = 0.4;
      frenzy = 0; frenzyOn = false; frenzyT = 0;
      over = false; paused = false; banked = false; statsSaved = false;
      secondChanceUsed = false; slicedTotal = 0;
      dragging = false; strokeCount = 0; frzShown = false;
      hideFrenzyBtn();
      slcard.style.display = "none"; slq.style.display = "none";
      updateHud();
      big("🥷 SLICE!", "#8ef");
    }

    function rewards() {
      return {
        win: false, score: score,
        rankPtsDelta: Math.min(8, 1 + Math.floor(score / 70)),
        xp: Math.min(80, 5 + Math.floor(score / 12)),
        gems: 3 + Math.floor(score / 25)
      };
    }
    // the ONE bank path — computed once, guarded, recorded to the store engine
    function bankRun(won) {
      if (banked) return null;
      banked = true;
      var rw = rewards(); rw.win = !!won;
      var res = store.recordGame ? store.recordGame("slice", rw) : null;
      return { rw: rw, res: res };
    }
    // additive persistence: best score + lifetime fruit count (once per run)
    function endRunStats() {
      if (statsSaved) return; statsSaved = true;
      if (score > (stats.bestScore || 0)) stats.bestScore = score;
      stats.totalSliced = (stats.totalSliced || 0) + slicedTotal;
      if (store.save) store.save();
    }

    function runOver() {
      if (over) return;
      over = true; paused = true;
      hideFrenzyBtn();
      endRunStats();
      var b = bankRun(false);
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(10);
      showEnd(b ? b.rw : rewards());
    }
    function showEnd(rw) {
      slcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">🥷</div>' +
        '<div class="wqtitle" style="font-size:20px">Run over!</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🍉 Score <b>' + score + '</b> · 🏆 Best <b>' + (stats.bestScore || 0) + '</b></div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">' + slicedTotal + ' sliced this run · ' + (stats.totalSliced || 0) + ' all-time</div>' +
        '<button class="submit big-next" id="slreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="slleave" type="button">Leave</button></div>';
      slcard.style.display = "flex";
      if (rw && sfx && sfx.fanfare && score >= (stats.bestScore || 0) && score > 0) sfx.fanfare();
      document.getElementById("slreplay").onclick = function () { slcard.style.display = "none"; begin(); };
      document.getElementById("slleave").onclick = exit;
    }

    // ---------- hearts / second chance ----------
    function hurt() {
      if (over || paused) return;
      hearts = Math.max(0, hearts - 1);
      updateHud();
      if (juice) juice.shake(11);
      if (sfx && sfx.buzz) sfx.buzz();
      if (hearts <= 0) {
        if (!secondChanceUsed) offerSecondChance();
        else runOver();
      }
    }
    function offerSecondChance() {
      paused = true; hideFrenzyBtn();
      cv._lastQ = VQ.miniQuiz(slq, words, store, {
        title: "💖 SECOND CHANCE! Answer a word to leap back in!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; secondChanceUsed = true;
          if (ok) {
            hearts = 1; paused = false; updateHud();
            big("💖 REVIVED! One heart back!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(W / 2, H / 2, "#ff6b9d", 24);
          } else {
            runOver();
          }
        }
      });
    }

    // ---------- frenzy (the word power) ----------
    function checkFrenzyReady() {
      if (frenzy >= 1 && !frenzyOn && !frzShown && !paused && !over) showFrenzyBtn();
    }
    function showFrenzyBtn() { frzShown = true; frzBtn.style.display = "block"; if (sfx && sfx.chime) sfx.chime(); }
    function hideFrenzyBtn() { frzShown = false; frzBtn.style.display = "none"; }
    function frenzyQuiz() {
      if (over || paused) return;
      paused = true; hideFrenzyBtn();
      cv._lastQ = VQ.miniQuiz(slq, words, store, {
        title: "⭐ FRENZY WORD! Answer to unleash the fruit shower!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) startFrenzy();
          else { frenzy = 0; big("The frenzy fizzled…", "#ff8a8a"); }
          updateHud();
        }
      });
    }
    function startFrenzy() {
      frenzyOn = true; frenzyT = 10; frenzy = 0;
      // the shower is a SAFE zone — sweep any live bombs off the board
      for (var i = objects.length - 1; i >= 0; i--) if (objects[i].kind === "bomb") objects.splice(i, 1);
      big("⭐ FRENZY! Double points — NO bombs!", "#ffd23f");
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) juice.shake(6);
    }

    // ---------- spawning ----------
    function speedMul() { return Math.min(1.65, 1 + (wave - 1) * 0.05); }
    function bombChance() { return Math.min(0.3, 0.05 + (wave - 1) * 0.022); }
    function spawnObj(kind, easy) {
      var r = objR2;
      var o = { kind: kind, r: r, sliced: false, life: 0.3, rot: (Math.random() - 0.5) * 0.6, spin: (Math.random() - 0.5) * 5 };
      if (kind === "bomb") { o.e = "💣"; o.c = "#5a5a5a"; }
      else { var f = FRUITS[Math.floor(Math.random() * FRUITS.length)]; o.e = f.e; o.c = f.c; }
      if (easy) {
        // test/demo arc: parked near mid-screen, drifting slowly so it's sliceable
        o.x = W / 2; o.y = H * 0.5; o.vx = 0; o.vy = -120;
      } else {
        o.x = W * (0.12 + Math.random() * 0.76);
        o.y = H + r;
        var peak = H * (0.44 + Math.random() * 0.26);
        o.vy = -Math.sqrt(2 * G * peak) * speedMul();
        o.vx = ((W / 2 - o.x) / W) * 300 + (Math.random() - 0.5) * 220;
      }
      objects.push(o);
      return o;
    }
    function doSpawnWave(dt) {
      spawnT -= dt;
      if (spawnT > 0) return;
      if (frenzyOn) {
        spawnT = 0.32;
        for (var f = 0; f < 2; f++) spawnObj("fruit", false);
        return;
      }
      spawnT = Math.max(0.5, 1.15 - wave * 0.09); // lively from wave 1
      var batch = 1;
      if (Math.random() < 0.25 + (wave - 1) * 0.13) batch++;
      if (wave >= 4 && Math.random() < 0.3) batch++;
      for (var i = 0; i < batch; i++) {
        var bomb = Math.random() < bombChance();
        spawnObj(bomb ? "bomb" : "fruit", false);
      }
    }

    // ---------- slicing ----------
    function distToSeg(px, py, ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      var t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var cx = ax + t * dx, cy = ay + t * dy;
      return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
    }
    function cut(o) {
      if (o.sliced) return;
      o.sliced = true; o.life = 0.28;
      if (o.kind === "bomb") {
        if (juice) { juice.burst(o.x, o.y, "#ff5b5b", 28); juice.text(o.x, o.y - 12, "💥", "#ff5b5b"); juice.shake(16); }
        if (sfx && sfx.buzz) sfx.buzz();
        big("💥 BOMB!", "#ff5b5b");
        hurt();
        return;
      }
      strokeCount++; slicedTotal++;
      var pts = frenzyOn ? 20 : 10;
      score += pts;
      frenzy = Math.min(1, frenzy + 0.09);
      if (juice) { juice.burst(o.x, o.y, o.c, 16); juice.text(o.x, o.y - 8, "+" + pts, o.c); }
      if (sfx && sfx.pop) sfx.pop();
      checkFrenzyReady();
      updateHud();
    }
    function resolveCombo() {
      if (strokeCount >= 2) {
        var bonus = strokeCount * 5;
        score += bonus;
        big("🔥 COMBO x" + strokeCount + "!  +" + bonus, "#ffd23f");
        if (juice) juice.shake(6);
        if (sfx && sfx.coin) sfx.coin();
        updateHud();
      }
      strokeCount = 0;
    }
    // the public test/blade entry: cut everything under a point, then settle combo
    function sliceAt(x, y) {
      if (over) return;
      strokeCount = 0;
      var pad = objR2 * 0.6 + 10;
      for (var i = objects.length - 1; i >= 0; i--) {
        var o = objects[i];
        if (o.sliced) continue;
        var d = Math.sqrt((o.x - x) * (o.x - x) + (o.y - y) * (o.y - y));
        if (d < o.r + pad) cut(o);
      }
      resolveCombo();
    }

    // ---------- pointer (blade) — canvas-only listeners die with the node ----------
    function pt(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    function down(x, y) {
      if (paused || over) return;
      dragging = true; strokeCount = 0; lastX = x; lastY = y;
      trail = [{ x: x, y: y, life: 0.3 }];
    }
    function move(x, y) {
      if (!dragging || paused || over) return;
      trail.push({ x: x, y: y, life: 0.3 }); if (trail.length > 18) trail.shift();
      for (var i = objects.length - 1; i >= 0; i--) {
        var o = objects[i];
        if (!o.sliced && distToSeg(o.x, o.y, lastX, lastY, x, y) < o.r + 6) cut(o);
      }
      lastX = x; lastY = y;
    }
    function up() { if (!dragging) return; dragging = false; resolveCombo(); }
    cv.addEventListener("mousedown", function (e) { var p = pt(e); down(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { var p = pt(e); move(p.x, p.y); });
    cv.addEventListener("mouseup", up);
    cv.addEventListener("mouseleave", up);
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); down(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); move(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); up(); }, { passive: false });
    frzBtn.onclick = frenzyQuiz;

    // ---------- simulation ----------
    function step(dt) {
      runT += dt;
      var nw = 1 + Math.floor(runT / 16);
      if (nw !== wave && !frenzyOn) { wave = nw; big("🌊 Wave " + wave + "!", "#8ecdf7"); updateHud(); }
      if (frenzyOn) {
        frenzyT -= dt;
        updateHud();
        if (frenzyT <= 0) { frenzyOn = false; big("Frenzy over — bombs are back!", "#ffd23f"); updateHud(); }
      }
      doSpawnWave(dt);
      for (var i = objects.length - 1; i >= 0; i--) {
        var o = objects[i];
        o.vy += G * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.spin * dt;
        if (o.sliced) { o.life -= dt; if (o.life <= 0) objects.splice(i, 1); continue; }
        if (o.y > H + o.r * 2.6 && o.vy > 0) objects.splice(i, 1); // missed — no penalty, kids play free
      }
      for (var k = trail.length - 1; k >= 0; k--) { trail[k].life -= dt * 3.5; if (trail[k].life <= 0) trail.splice(k, 1); }
      if (juice) juice.update(dt);
      checkFrenzyReady();
    }

    // ---------- drawing ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H);
      if (frenzyOn) { g.addColorStop(0, "#3a2f10"); g.addColorStop(1, "#120d02"); }
      else { g.addColorStop(0, "#20304a"); g.addColorStop(1, "#0b1020"); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // faint dojo moon
      ctx.fillStyle = frenzyOn ? "rgba(255,220,120,.12)" : "rgba(255,255,255,.06)";
      ctx.beginPath(); ctx.arc(W * 0.8, H * 0.22, Math.min(W, H) * 0.16, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      if (juice) ctx.translate(juice.ox, juice.oy);
      // objects
      for (var i = 0; i < objects.length; i++) {
        var o = objects[i];
        ctx.save();
        ctx.translate(o.x, o.y); ctx.rotate(o.rot);
        if (o.sliced) ctx.globalAlpha = Math.max(0, o.life / 0.28);
        ctx.font = Math.round(o.r * 2) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(o.e, 0, 0);
        if (o.kind === "bomb" && !o.sliced) { // red danger glow — a dark bomb must READ on the dark dojo
          ctx.globalAlpha = 0.35 + Math.sin(runT * 10) * 0.15;
          ctx.strokeStyle = "#ff5b5b"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, o.r * 1.15, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(255,120,60," + (0.5 + Math.sin(runT * 20) * 0.4) + ")";
          ctx.beginPath(); ctx.arc(0, -o.r * 0.7, o.r * 0.14, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      // blade trail
      if (trail.length > 1) {
        for (var s = 1; s < trail.length; s++) {
          var a = trail[s - 1], b = trail[s];
          ctx.strokeStyle = "rgba(255,255,255," + Math.max(0, b.life * 2.2) + ")";
          ctx.lineWidth = Math.max(1, b.life * 22); ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (juice) juice.draw(ctx);
      ctx.restore();

      // frenzy meter — a fat gold bar hugging the bottom
      var bw = Math.min(320, W * 0.6), bx = (W - bw) / 2, by = H - 16;
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(bx, by, bw, 8);
      ctx.fillStyle = frenzyOn ? "#ff6b6b" : "#ffd23f";
      ctx.fillRect(bx, by, bw * (frenzyOn ? Math.max(0, frenzyT / 10) : frenzy), 8);
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) step(dt);
      draw();
    }

    // ---------- exit / banking ----------
    function bankExit() {
      if (over) return; // run-over already banked
      if (score <= 0 && slicedTotal === 0) return; // an untouched run banks nothing
      endRunStats();
      var b = bankRun(false);
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🥷 Slice run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._slice = {
      state: function () {
        var live = 0; for (var i = 0; i < objects.length; i++) if (!objects[i].sliced) live++;
        return {
          score: score, hearts: hearts, best: stats.bestScore || 0,
          frenzy: frenzy, frenzyOn: frenzyOn, wave: wave, banked: banked,
          over: over, fruits: live, secondChanceUsed: secondChanceUsed
        };
      },
      begin: begin,
      spawn: function (kind) { return spawnObj(kind === "bomb" ? "bomb" : "fruit", true); },
      sliceAt: sliceAt,
      fillFrenzy: function () { frenzy = 1; checkFrenzyReady(); },
      frenzyQuiz: frenzyQuiz,
      hurt: hurt,
      runner: null
    };

    // ---------- boot ----------
    begin();
    if (global._slicedemo) { // screenshot seed: a lively mid-run board
      global._slicedemo = 0;
      score = 140; wave = 3; frenzy = 0.5; slicedTotal = 14;
      // park a busy board (easy arcs hover near mid-screen so shots show it)
      for (var ds = 0; ds < 6; ds++) spawnObj(ds === 3 ? "bomb" : "fruit", true);
      objects.forEach(function (o, i) { o.x = W * (0.14 + i * 0.14); o.y = H * (0.3 + (i % 3) * 0.14); o.vy = -40 - i * 12; o.vx = 0; });
      paused = true; // freeze the tableau — the demo exists for screenshots
      updateHud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxSlice = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
