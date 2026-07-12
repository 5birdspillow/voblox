/*
 * Voblox arcade game — 🏗️ SKY STACKER (the classic block-stacking timing game).
 * A block slides side-to-side above your tower; TAP to drop it. Overhang past the
 * block below is SLICED off and tumbles away — the tower shrinks to the overlap.
 * PERFECT drops (inside a tiny snap window) keep full width and flash "PERFECT!";
 * three perfects in a row REGROW the block a little. The camera pans down as you
 * climb — sky → sunset → space — and the crane slides faster the higher you get.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🧱 STEADY HANDS: answer a word to slow the crane 30% for the next 5 blocks.
 *   - 🪂 SECOND CHANCE: the first tumble that would end the run, a word revives it
 *     with the block reset to 60% of the base width (once per run).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("stack") per
 * run, banked on run-over, quit, AND app-close. Stats persist additively.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("stack");
    // additive, never-renamed save fields
    stats.bestFloors = stats.bestFloors || 0;
    stats.perfects = stats.perfects || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap stack";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="skcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="skmsg">🏗️ Sky Stacker — TAP to drop!</div>' +
      '<div class="grow"><span id="skfloors">🏢 1</span><span id="skbest"></span><span id="sksteadyi"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="skbig"></div>' +
      '<button id="skhands" type="button" style="display:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 40px);' +
      'transform:translateX(-50%);z-index:8;background:linear-gradient(#b7f0ff,#5ec8ff);color:#083247;' +
      'border:none;border-radius:16px;padding:14px 22px;font-family:inherit;font-weight:900;font-size:18px;' +
      'box-shadow:0 6px 0 #2e86b5,0 10px 24px #0006;cursor:pointer">🧱 STEADY HANDS — answer a word!</button>' +
      '<div class="gover" id="skq" style="display:none"></div>' +
      '<div class="gover" id="skcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#skcv"), ctx = cv.getContext("2d");
    var skq = document.getElementById("skq"), skcard = document.getElementById("skcard");
    var msgEl = document.getElementById("skmsg"), bigEl = document.getElementById("skbig");
    var handsBtn = document.getElementById("skhands");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H, blockH, anchorY;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      blockH = Math.max(18, Math.min(34, H * 0.046)); // block pixel height
      anchorY = H * 0.46; // the top of the tower always rests here (camera follows)
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var blocks = [], debris = [], slider = null, sliding = false;
    var baseW = 0, blockW = 0, floors = 1;
    var perfectStreak = 0, perfectsThisRun = 0, steady = 0, revived = false;
    var over = false, paused = false, banked = false, statsSaved = false;
    var lastFmt = null;
    var SNAP = 12, MINW = 10, REGROW = 24;

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1000);
    }
    function updateHud() {
      document.getElementById("skfloors").textContent = "🏢 " + floors;
      document.getElementById("skbest").textContent = "🏆 " + (stats.bestFloors || 0);
      document.getElementById("sksteadyi").textContent = steady > 0 ? "🧱×" + steady : "";
    }
    function showHands() { if (!paused && !over) handsBtn.style.display = "block"; }
    function hideHands() { handsBtn.style.display = "none"; }

    // ---------- metrics + slider ----------
    // crane speed ramps with height; STEADY HANDS shaves 30% off for a few blocks
    function slideSpeed() {
      var s = Math.min(W * 1.6, W * 0.5 * (1 + (floors - 1) * 0.05));
      return s * (steady > 0 ? 0.7 : 1);
    }
    function nextColor() { return "hsl(" + (((floors + 1) * 26) % 360) + ",72%,56%)"; }
    function travelMin() { return blockW / 2; }
    function travelMax() { return W - blockW / 2; }
    function spawnSlider() {
      var dir = Math.random() < 0.5 ? 1 : -1;
      slider = { x: dir > 0 ? travelMin() : travelMax(), w: blockW, dir: dir, color: nextColor() };
      sliding = true;
    }

    function begin() {
      resize();
      baseW = Math.max(90, Math.min(240, W * 0.4));
      blockW = baseW;
      SNAP = Math.min(14, Math.max(6, baseW * 0.06)); // perfect window (< 20 always)
      MINW = Math.max(8, baseW * 0.05);
      REGROW = baseW * 0.14;
      blocks = [{ x: W / 2, w: baseW, color: "hsl(200,72%,56%)", floor: 1 }];
      debris = [];
      floors = 1; perfectStreak = 0; perfectsThisRun = 0; steady = 0; revived = false;
      over = false; paused = false; banked = false; statsSaved = false;
      skcard.style.display = "none"; skq.style.display = "none";
      spawnSlider();
      showHands();
      updateHud();
      big("🏗️ STACK!", "#8ef");
    }

    // ---------- the drop ----------
    function afterPlace() {
      if (steady > 0) { steady--; if (steady === 0) big("🧱 steady hands spent", "#8ecdf7"); }
      floors++;
      updateHud();
      if (!over) spawnSlider();
    }
    function place() {
      if (!sliding || over || paused) return;
      var top = blocks[blocks.length - 1];
      var offset = slider.x - top.x;
      var ao = Math.abs(offset);
      sliding = false;
      if (ao <= SNAP) {
        // PERFECT — snap to alignment, keep full width, count the streak
        slider.x = top.x;
        blocks.push({ x: top.x, w: slider.w, color: slider.color, floor: floors + 1 });
        perfectStreak++; perfectsThisRun++;
        if (perfectStreak % 3 === 0) { // 3-in-a-row REGROWS a little (never past base)
          blockW = Math.min(baseW, blockW + REGROW);
          big("✨ PERFECT ×3 — REGROW!", "#ffd23f");
          if (juice) juice.burst(top.x, anchorY, "#ffd23f", 18);
        } else {
          big("PERFECT!", "#69f0ae");
        }
        if (sfx && sfx.coin) sfx.coin();
        if (juice) juice.text(top.x, anchorY - blockH, "PERFECT", "#69f0ae");
        afterPlace();
        return;
      }
      // SLICE — keep only the overlap, tumble the overhang away
      var oL = Math.max(slider.x - slider.w / 2, top.x - top.w / 2);
      var oR = Math.min(slider.x + slider.w / 2, top.x + top.w / 2);
      var newW = oR - oL;
      if (newW < MINW) { towerFail(); return; } // too small to survive — the tower falls
      perfectStreak = 0;
      // tumbling sliced piece (pure juice — physics tumble, no camera coupling)
      if (offset >= 0) { var rx = slider.x + slider.w / 2; spawnDebris(oR + (rx - oR) / 2, rx - oR, slider.color, 150); }
      else { var lx = slider.x - slider.w / 2; spawnDebris(oL - (oL - lx) / 2, oL - lx, slider.color, -150); }
      blocks.push({ x: (oL + oR) / 2, w: newW, color: slider.color, floor: floors + 1 });
      blockW = newW;
      if (sfx && sfx.pop) sfx.pop();
      if (juice) juice.shake(3);
      afterPlace();
    }
    function spawnDebris(cx, w, color, vx) {
      if (w <= 0) return;
      debris.push({ x: cx, y: anchorY, w: w, h: blockH, vx: vx, vy: -40, vr: vx > 0 ? 5 : -5, rot: 0, color: color });
    }

    // ---------- the tower falls (second chance lives here) ----------
    function towerFail() {
      if (over) return;
      sliding = false;
      if (!revived) offerRevive();
      else finalize();
    }
    function offerRevive() {
      paused = true; hideHands();
      cv._lastQ = VQ.miniQuiz(skq, words, store, {
        title: "🪂 SECOND CHANCE! Answer a word to save your tower!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; revived = true;
          if (ok) {
            blockW = Math.max(MINW, baseW * 0.6); // revive at 60% of the base width
            paused = false; spawnSlider(); showHands(); updateHud();
            big("🪂 SAVED! Steadier block back!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(W / 2, anchorY, "#69f0ae", 22);
          } else {
            finalize();
          }
        }
      });
    }

    // ---------- rewards / banking (the ONE path) ----------
    function rewards() {
      return {
        win: floors >= 25,
        score: floors,
        rankPtsDelta: Math.min(12, 2 + Math.floor(floors / 4) + (floors >= 25 ? 3 : 0)),
        xp: Math.min(80, 5 + floors * 2 + perfectsThisRun * 2),
        gems: 3 + Math.floor(floors * 1.5) + perfectsThisRun
      };
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = rewards();
      var res = store.recordGame ? store.recordGame("stack", rw) : null;
      return { rw: rw, res: res };
    }
    // additive persistence: best height + lifetime perfects (once per run)
    function endRunStats() {
      if (statsSaved) return; statsSaved = true;
      if (floors > (stats.bestFloors || 0)) stats.bestFloors = floors;
      stats.perfects = (stats.perfects || 0) + perfectsThisRun;
      if (store.save) store.save();
    }
    function finalize() {
      if (over) return;
      over = true; paused = true; sliding = false;
      hideHands();
      endRunStats();
      var b = bankRun();
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(10);
      showEnd(b ? b.rw : rewards());
    }
    function showEnd(rw) {
      skcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">🏗️</div>' +
        '<div class="wqtitle" style="font-size:20px">Timber! The tower fell.</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🏢 <b>' + floors + '</b> floors · 🏆 Best <b>' + (stats.bestFloors || 0) + '</b></div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">' + perfectsThisRun + ' perfects this run · ' + (stats.perfects || 0) + ' all-time' +
        (rw.win ? ' · 🌟 25+ FLOORS!' : '') + '</div>' +
        '<button class="submit big-next" id="skreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="skleave" type="button">Leave</button></div>';
      skcard.style.display = "flex";
      if (rw.win && sfx && sfx.fanfare) sfx.fanfare();
      document.getElementById("skreplay").onclick = function () { skcard.style.display = "none"; begin(); };
      document.getElementById("skleave").onclick = exit;
    }

    // ---------- STEADY HANDS (the word power) ----------
    function steadyQuiz() {
      if (over || paused) return;
      paused = true; hideHands();
      cv._lastQ = VQ.miniQuiz(skq, words, store, {
        title: "🧱 STEADY HANDS! Answer to steady the crane for 5 blocks!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false; showHands();
          if (ok) {
            steady = 5;
            big("🧱 STEADY HANDS! Crane slowed for 5 blocks!", "#8ecdf7");
            if (sfx && sfx.chime) sfx.chime();
          } else {
            big("Shaky start — try again!", "#ff8a8a");
          }
          updateHud();
        }
      });
    }
    handsBtn.onclick = steadyQuiz;

    // ---------- simulation ----------
    function step(dt) {
      if (sliding && slider) {
        slider.x += slider.dir * slideSpeed() * dt;
        var lo = travelMin(), hi = travelMax();
        if (slider.x <= lo) { slider.x = lo; slider.dir = 1; }
        else if (slider.x >= hi) { slider.x = hi; slider.dir = -1; }
      }
      for (var i = debris.length - 1; i >= 0; i--) {
        var d = debris[i];
        d.vy += 1600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
        if (d.y > H + 80) debris.splice(i, 1);
      }
      if (juice) juice.update(dt);
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function skyStops(f) {
      if (f < 15) return ["#8ed6ff", "#e6f6ff"];   // sky
      if (f < 30) return ["#ff9a6b", "#ffe0a3"];    // sunset
      return ["#0b1030", "#2a1e55"];                // space
    }
    function drawBlock(x, y, w, color, top) {
      rrect(x - w / 2, y, w, blockH, 4);
      ctx.fillStyle = color; ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(x - w / 2 + 2, y + 2, w - 4, Math.max(2, blockH * 0.22));
      ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(x - w / 2 + 2, y + blockH - Math.max(2, blockH * 0.22) - 2, w - 4, Math.max(2, blockH * 0.22));
      if (top) { ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; rrect(x - w / 2, y, w, blockH, 4); ctx.stroke(); }
    }
    function draw() {
      var stps = skyStops(floors);
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, stps[0]); g.addColorStop(1, stps[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (floors >= 30) { // stars in space
        ctx.fillStyle = "rgba(255,255,255,.8)";
        for (var s = 0; s < 40; s++) { var sx = (s * 97 % W), sy = (s * 53 % (H * 0.7)); ctx.fillRect(sx, sy, 2, 2); }
      }
      ctx.save();
      if (juice) ctx.translate(juice.ox, juice.oy);
      // the tower — newest block anchored, older ones scrolling down and away
      var topIdx = blocks.length - 1;
      for (var i = topIdx; i >= 0; i--) {
        var b = blocks[i];
        var y = anchorY + (topIdx - i) * blockH;
        if (y > H + blockH) break;
        drawBlock(b.x, y, b.w, b.color, i === topIdx);
      }
      // the sliding crane block, one floor up
      if (sliding && slider) {
        drawBlock(slider.x, anchorY - blockH, slider.w, slider.color, false);
        ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(slider.x, 0); ctx.lineTo(slider.x, anchorY - blockH); ctx.stroke();
      }
      // tumbling debris
      for (var d = 0; d < debris.length; d++) {
        var p = debris[d];
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; rrect(-p.w / 2, -p.h / 2, p.w, p.h, 4); ctx.fill();
        ctx.restore();
      }
      if (juice) juice.draw(ctx);
      ctx.restore();
      // big floor readout
      ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.font = "900 " + Math.round(Math.min(W, H) * 0.14) + "px Trebuchet MS";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(floors + "", W / 2, H * 0.2);
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) step(dt);
      draw();
    }

    // ---------- input: a canvas TAP drops the block ----------
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); place(); }, { passive: false });
    cv.addEventListener("mousedown", function () { place(); });

    // ---------- exit / banking ----------
    function bankExit() {
      if (over) return;          // finalize already banked
      if (floors <= 1) return;   // an untouched tower banks nothing
      endRunStats();
      var b = bankRun();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🏗️ Stack run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
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
    cv._stack = {
      state: function () {
        return {
          floors: floors, blockW: blockW, baseW: baseW, sliding: sliding,
          speed: slideSpeed(), perfectStreak: perfectStreak, steady: steady,
          revived: revived, over: over, banked: banked, best: stats.bestFloors || 0
        };
      },
      begin: begin,
      blockX: function () { return slider ? slider.x : W / 2; },
      towerX: function () { return blocks.length ? blocks[blocks.length - 1].x : W / 2; },
      drop: function () { place(); },
      dropAt: function (offset) {
        if (!sliding || over || paused) return;
        var top = blocks[blocks.length - 1];
        slider.x = top.x + offset;
        place();
      },
      steadyQuiz: steadyQuiz,
      kill: function () { towerFail(); }
    };

    // ---------- boot ----------
    begin();
    if (global._stackdemo) { // screenshot seed: a 12-floor tower mid-slide, a piece tumbling
      global._stackdemo = 0;
      for (var q = 0; q < 11; q++) {
        var t = blocks[blocks.length - 1];
        slider.x = t.x + ((q % 2 ? 1 : -1) * 3); // inside the snap window -> clean 12-floor tower
        place();
      }
      slider.x = blocks[blocks.length - 1].x + baseW * 0.3; // freeze the crane mid-overhang
      debris.push({ x: W * 0.72, y: anchorY - 6, w: baseW * 0.4, h: blockH, vx: 160, vy: -40, vr: 5, rot: 0.2, color: "hsl(40,80%,55%)" });
      paused = true;
      updateHud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxStack = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
