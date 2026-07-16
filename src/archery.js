/*
 * Voblox arcade game — 🎯 BULLSEYE (a drag-to-aim archery range).
 * Side view: your archer on the left, targets downrange. DRAG BACK from the bow
 * to draw — an aim arrow + power indicator appear (NO trajectory preview; kids
 * learn the arc by feel) — release to loose. Arrows fly a gravity arc bent by
 * WIND (a wind sock shows it, and it changes every round) and stick where they
 * land with a thunk. Rings score 10/8/6/4/2 and a dead-center BULLSEYE pays 25.
 *
 * COURSE: 12 rounds of 3 arrows, escalating — static targets at growing range →
 * wind picks up → moving targets → 🎈 balloon (+5) & 🍎 apple-on-a-post (+15)
 * bonuses → a far tiny GOLD target in heavy wind for the finale.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🧘 STEADY AIM: answer a word (miniQuiz) to BANK a steady shot (max 2).
 *     Spending one reveals the FULL trajectory preview for that single arrow.
 *   - Rounds 7-12 are word-gated the first time only (one word, then persists).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("archery")
 * per course run, banked on course-end, quit, AND app-close. Stats persist
 * additively (bestCourse, bullseyes). Flight is deterministic given angle/power/
 * wind, so specs can verify the physics is honest.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // logical world (downrange x →, height y ↑, ground at y=0). Screen-independent.
  var WW = 1040, WH = 460, BX = 92, BY = 132, G = 900;
  var GOLD_THRESHOLD = 150; // course total that earns the 🥇 (a "win")

  // ring scoring off the radial miss distance at the target's face
  function ringScore(d, R) {
    if (d <= R * 0.10) return { pts: 25, bull: true };
    if (d <= R * 0.25) return { pts: 10 };
    if (d <= R * 0.45) return { pts: 8 };
    if (d <= R * 0.68) return { pts: 6 };
    if (d <= R * 0.86) return { pts: 4 };
    if (d <= R) return { pts: 2 };
    return { pts: 0 };
  }

  // per-round design: range grows, then wind, then movement, then bonuses, then gold
  function roundConfig(n) {
    var c = { n: n, tx: 0, ty: 200, r: 60, moving: false, drift: 0, windMag: 0, bonus: [], gold: false };
    c.tx = Math.min(958, 452 + n * 40);            // targets march downrange
    c.r = Math.max(24, 62 - n * 2.4);              // …and shrink as they go
    c.ty = 190 + ((n % 3) - 1) * 22;
    if (n >= 4 && n <= 6) c.windMag = (n - 3) * 66;                 // wind picks up
    if (n >= 7 && n <= 9) { c.moving = true; c.drift = 44 + (n - 7) * 12; c.windMag = (n - 6) * 58; }
    if (n === 10) { c.windMag = 70; c.ty = 210; c.r = 40; c.bonus = [{ kind: "balloon", x: 620, y: 320, r: 30, pts: 5 }, { kind: "balloon", x: 780, y: 360, r: 30, pts: 5 }]; }
    if (n === 11) { c.windMag = 96; c.ty = 200; c.r = 42; c.bonus = [{ kind: "apple", x: 720, y: 300, r: 22, pts: 15 }]; }
    if (n === 12) { c.gold = true; c.tx = 964; c.ty = 210; c.r = 20; c.windMag = 220; }
    return c;
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("archery");
    stats.bestCourse = stats.bestCourse || 0;   // additive, never-renamed save fields
    stats.bullseyes = stats.bullseyes || 0;
    stats.packLate = stats.packLate || false;   // rounds 7-12 unlocked once, forever

    var wrap = document.createElement("div");
    wrap.className = "gamewrap archery";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="arcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="armsg">🎯 Bullseye — drag back from the bow to aim!</div>' +
      '<div class="grow"><span id="arscore">🎯 0</span><span id="arround">Round 1</span>' +
      '<span id="arwind">🚩 —</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="arbig"></div>' +
      '<button id="arsteady" type="button" style="display:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 34px);' +
      'transform:translateX(-50%);z-index:8;background:linear-gradient(#b9f6ca,#69f0ae);color:#134a2b;' +
      'border:none;border-radius:16px;padding:13px 20px;min-height:48px;box-sizing:border-box;font-family:inherit;font-weight:900;font-size:16px;' +
      'box-shadow:0 6px 0 #2e9e63,0 10px 24px #0006;cursor:pointer">🧘 STEADY AIM — bank a word</button>' +
      '<div class="gover" id="arq" style="display:none"></div>' +
      '<div class="gover" id="arcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#arcv"), ctx = cv.getContext("2d");
    var arq = document.getElementById("arq"), arcard = document.getElementById("arcard");
    var msgEl = document.getElementById("armsg"), bigEl = document.getElementById("arbig");
    var steadyBtn = document.getElementById("arsteady");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H, S, OX, OY, camDX = 0, DPR = 1;
    function resize() {
      W = wrap.clientWidth || global.innerWidth || 360;
      H = wrap.clientHeight || global.innerHeight || 640;
      DPR = Math.min(global.devicePixelRatio || 1, 2); // retina-crisp buffer; game stays in CSS px
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      S = Math.min(W / WW, H / WH);
      OX = (W - WW * S) / 2;
      OY = (H - WH * S) / 2;
    }
    resize();
    window.addEventListener("resize", resize);
    // world → screen (y flips: world up is screen up); camDX is the micro-follow
    function sx(wx) { return OX + camDX + wx * S; }
    function sy(wy) { return OY + (WH - wy) * S; }

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var round = 1, cfg = roundConfig(1), arrowNo = 1;
    var courseTotal = 0, roundScore = 0;
    var wind = 0, windParts = [];
    var target = { x: 0, y: 0, r: 0, moving: false, phase: 0 };
    var bonus = [];               // live bonus targets this round
    var stuck = [];               // arrows that have landed (x,y in world, inTarget)
    var flying = null;            // the one in-flight animated arrow (human play)
    var steady = 0, previewNext = false, previewShot = null;
    var aiming = null;            // active drag: {angle, power} (the draw() fn renders it)
    var over = false, paused = false, banked = false, steadyShown = false;
    var packGate = false, lastFmt = null, simClock = 0;

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1150);
    }
    function windTxt() {
      var a = Math.abs(Math.round(wind));
      if (a < 6) return "🚩 calm";
      var arrows = a < 90 ? "›" : a < 170 ? "››" : "›››";
      return wind > 0 ? "🚩 " + arrows : "🚩 " + arrows.split("›").join("‹");
    }
    function updateHud() {
      document.getElementById("arscore").textContent = "🎯 " + (courseTotal + roundScore);
      document.getElementById("arround").textContent = (cfg.gold ? "🥇 Round " : "Round ") + round + "/12";
      document.getElementById("arwind").textContent = windTxt();
    }

    // ---------- course / round flow ----------
    function newWindParts() {
      windParts = [];
      for (var i = 0; i < 26; i++) windParts.push({ x: Math.random() * WW, y: 40 + Math.random() * (WH - 80) });
    }
    function setWind(w) { wind = w; document.getElementById("arwind").textContent = windTxt(); }
    function rollWind() {
      var mag = cfg.windMag;
      setWind(mag ? (Math.random() < 0.5 ? -mag : mag) * (0.75 + Math.random() * 0.5) : 0);
    }
    function layoutRound() {
      cfg = roundConfig(round);
      target = { x: cfg.tx, y: cfg.ty, baseY: cfg.ty, r: cfg.r, moving: cfg.moving, drift: cfg.drift, phase: 0, gold: cfg.gold };
      bonus = cfg.bonus.map(function (b) { return { kind: b.kind, x: b.x, y: b.y, baseY: b.y, r: b.r, pts: b.pts, phase: Math.random() * 6, alive: true }; });
      stuck = []; flying = null; roundScore = 0; arrowNo = 1;
      previewNext = false; previewShot = null;
      rollWind(); newWindParts();
      updateHud();
    }
    function startCourse() {
      round = 1; courseTotal = 0; over = false; paused = false; banked = false;
      steady = 0; steadyShown = false; hideSteady();
      arcard.style.display = "none"; arq.style.display = "none";
      layoutRound();
      big("🎯 BULLSEYE — 12 rounds, 3 arrows each. Loose!", "#ffe14d");
    }
    // enter a round; rounds 7-12 word-gate the FIRST time only (then it persists)
    function begin(n) {
      round = Math.max(1, Math.min(12, n | 0));
      over = false; paused = false;
      arcard.style.display = "none";
      layoutRound();
      if (round >= 7 && !stats.packLate) { packQuiz(); }
      return true;
    }
    function nextArrow() {
      if (arrowNo >= 3) { finishRound(); return; }
      arrowNo++; previewShot = null;
      updateHud();
    }
    function finishRound() {
      courseTotal += roundScore;
      if (round >= 12) { endCourse(); return; }
      big("Round " + round + ": " + roundScore + " pts", "#8ecdf7");
      round++; layoutRound();
      if (round >= 7 && !stats.packLate) packQuiz();
    }

    // ---------- physics (deterministic given angle, power, wind) ----------
    function xAt(a, t) { return a.bx + a.vx * t + 0.5 * a.w * t * t; }
    function yAt(a, t) { return a.by + a.vy * t - 0.5 * G * t * t; }
    // first positive time the arrow's x reaches px (accounts for wind curvature)
    function solveXt(a, px) {
      if (Math.abs(a.w) < 1e-6) { var t = (px - a.bx) / a.vx; return t > 0 ? t : Infinity; }
      var A = 0.5 * a.w, B = a.vx, C = a.bx - px, disc = B * B - 4 * A * C;
      if (disc < 0) return Infinity;
      var sq = Math.sqrt(disc), t1 = (-B + sq) / (2 * A), t2 = (-B - sq) / (2 * A);
      var lo = Math.min(t1, t2), hi = Math.max(t1, t2);
      return lo > 1e-4 ? lo : (hi > 1e-4 ? hi : Infinity);
    }
    // time the falling arrow returns to the ground (y=0)
    function groundT(a) {
      var disc = a.vy * a.vy + 2 * G * a.by;
      return (a.vy + Math.sqrt(disc)) / G;
    }
    function makeArrow(angle, power) {
      return { bx: BX, by: BY, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power, w: wind, angle: angle, power: power, t: 0 };
    }
    // resolve WHERE this shot lands and score it (used by both loose() and flight-end)
    function resolveArrow(a) {
      var gT = groundT(a);
      // candidate faces to cross, nearest downrange first
      var faces = [];
      for (var i = 0; i < bonus.length; i++) if (bonus[i].alive) faces.push(bonus[i]);
      faces.push({ kind: "main", x: target.x, y: target.y, r: target.r });
      faces.sort(function (p, q) { return p.x - q.x; });
      for (var f = 0; f < faces.length; f++) {
        var face = faces[f];
        if (face.x < a.bx) continue;
        var tc = solveXt(a, face.x);
        if (tc === Infinity || tc > gT + 1e-3) continue; // fell short of this face
        var py = yAt(a, tc);
        if (py <= 0) continue;                            // grounded before this face
        var d = Math.abs(py - face.y);
        if (d <= face.r) return { hit: face, t: tc, x: face.x, y: py, d: d };
      }
      // nothing struck — the arrow buries in the ground where it fell
      var gx = xAt(a, gT);
      return { hit: null, t: gT, x: gx, y: 0, d: Infinity };
    }
    function applyLanding(a, res) {
      var pts = 0, bull = false, label = "";
      if (res.hit && res.hit.kind === "main") {
        var rs = ringScore(res.d, res.hit.r);
        pts = rs.pts; bull = !!rs.bull;
        if (bull) { stats.bullseyes = (stats.bullseyes || 0) + 1; if (store.save) store.save(); }
        label = bull ? "🎯 BULLSEYE! +25" : pts > 0 ? "+" + pts : "miss";
      } else if (res.hit) {
        pts = res.hit.pts; res.hit.alive = false;
        label = (res.hit.kind === "apple" ? "🍎 APPLE! +" : "🎈 POP! +") + pts;
      } else {
        label = "thunk — miss";
      }
      roundScore += pts;
      stuck.push({ x: res.x, y: res.y, angle: a.angle, wobble: Math.random() * 0.3, inTarget: !!res.hit });
      if (pts > 0) {
        if (juice) { juice.burst(sx(res.x), sy(res.y), bull ? "#ffd23f" : "#69f0ae", bull ? 22 : 12); if (bull) juice.text(sx(res.x), sy(res.y) - 26, "BULLSEYE", "#ffd23f"); }
        if (sfx) { if (bull && sfx.fanfare) sfx.fanfare(); else if (sfx.pop) sfx.pop(); }
      } else if (sfx && sfx.thock) sfx.thock();
      big(label, bull ? "#ffd23f" : pts > 0 ? "#69f0ae" : "#ff8a8a");
      updateHud();
      return { pts: pts, bull: bull };
    }
    // the deterministic test/entry shot — launches AND settles synchronously
    function loose(angle, power) {
      if (over || paused) return 0;
      var a = makeArrow(angle, power);
      var res = resolveArrow(a);
      var out = applyLanding(a, res);
      nextArrow();
      return out.pts;
    }
    // the same shot, but ANIMATED for human play (flies over frames, then settles)
    function launchAnimated(angle, power) {
      if (over || paused || flying) return;
      flying = makeArrow(angle, power);
      flying.res = resolveArrow(flying);      // precomputed landing (same physics)
      flying.preview = previewShot;
      previewShot = null;
      if (sfx && sfx.whoosh) sfx.whoosh();
    }
    function stepFlight(dt) {
      if (!flying) return;
      flying.t += dt;
      var end = flying.res.t;
      camDX = Math.max(-70, Math.min(0, -(xAt(flying, flying.t) - BX) * 0.05 * S)); // micro-follow
      if (flying.t >= end) {
        applyLanding(flying, flying.res);
        flying = null; camDX = 0;
        nextArrow();
      }
    }

    // ---------- aim solver (the physics honesty oracle) ----------
    // returns {angle,power} that lands dead-center of the current main target
    // under the CURRENT wind — the same closed form loose() integrates.
    function aimFor() {
      var tx = target.x, ty = target.y, dx = tx - BX;
      var T = Math.max(0.6, Math.min(1.9, dx / 560));
      var vx = (tx - BX - 0.5 * wind * T * T) / T;
      var vy = (ty - BY + 0.5 * G * T * T) / T;
      return { angle: Math.atan2(vy, vx), power: Math.sqrt(vx * vx + vy * vy) };
    }

    // ---------- STEADY AIM word power ----------
    function showSteady() { if (steadyShown || paused || over) return; steadyShown = true; steadyBtn.style.display = "block"; }
    function hideSteady() { steadyShown = false; steadyBtn.style.display = "none"; }
    function steadyQuiz() {
      if (over || paused || steady >= 2) return;
      paused = true; hideSteady();
      cv._lastQ = VQ.miniQuiz(arq, words, store, {
        title: "🧘 STEADY AIM — answer to bank a steadied shot!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            steady = Math.min(2, steady + 1);
            big("🧘 Steady shot banked! (" + steady + "/2) — tap it to see the arc", "#69f0ae");
            if (sfx && sfx.chime) sfx.chime();
          } else big("The breath wavered…", "#ff8a8a");
          updateHud();
        }
      });
    }
    // spend a banked steady shot: reveal the FULL trajectory for the next arrow
    function useSteady() {
      if (steady <= 0) { big("No steady shots — 🧘 answer a word first!", "#ffd740"); return false; }
      steady--;
      previewShot = aimFor(); // shown as a dotted arc the player can match
      previewNext = true;
      big("🧘 Steady! The arc is revealed for this arrow.", "#c9f7d8");
      updateHud();
      return true;
    }

    // ---------- ROUND word gate (rounds 7-12, first time only) ----------
    function packQuiz() {
      packGate = true; paused = true; hideSteady();
      cv._lastQ = VQ.miniQuiz(arq, words, store, {
        title: "📜 FIELD PASS — answer a word to open the far range!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; packGate = false; paused = false;
          if (ok) {
            stats.packLate = true; if (store.save) store.save();
            big("📜 Far range unlocked — for good!", "#ffe14d");
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("The pass was denied — try a word again.", "#ff8a8a");
        }
      });
    }

    // ---------- course end + banking ----------
    function rewards(total) {
      var win = total >= GOLD_THRESHOLD;
      return {
        win: win, score: total,
        rankPtsDelta: win ? 9 : Math.min(6, 1 + Math.floor(total / 40)),
        xp: Math.min(80, 10 + Math.floor(total / 6)),
        gems: 5 + Math.floor(total / 10)
      };
    }
    // the ONE bank path — computed once, guarded, recorded to the store engine
    function bankRun(total) {
      if (banked) return null;
      banked = true;
      var rw = rewards(total);
      var res = store.recordGame ? store.recordGame("archery", rw) : null;
      return { rw: rw, res: res };
    }
    function medalFor(total) { return total >= GOLD_THRESHOLD ? "🥇" : total >= 100 ? "🥈" : "🥉"; }
    function endCourse() {
      if (over) return;
      over = true; paused = true; hideSteady();
      var total = courseTotal;
      if (total > (stats.bestCourse || 0)) { stats.bestCourse = total; if (store.save) store.save(); }
      var bank = bankRun(total) || { rw: rewards(total) };
      var rw = bank.rw, medal = medalFor(total);
      arcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:48px">' + medal + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (rw.win ? "GOLD! The range is yours!" : "Course complete!") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🎯 Total <b>' + total + '</b> · 🏆 Best <b>' + (stats.bestCourse || 0) + '</b></div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🎯 ' + (stats.bullseyes || 0) + ' bullseyes all-time · gold needs ' + GOLD_THRESHOLD + '</div>' +
        '<button class="submit big-next" id="arreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="arleave" type="button">Leave</button></div>';
      arcard.style.display = "flex";
      if (rw.win && sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(7); for (var cf = 0; cf < 5; cf++) juice.burst(W * (0.2 + cf * 0.15), H * 0.34, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][cf], 16); }
      document.getElementById("arreplay").onclick = function () { arcard.style.display = "none"; startCourse(); };
      document.getElementById("arleave").onclick = exit;
    }

    // ---------- drag-to-aim (draw the bow) ----------
    function pt(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    // convert a screen point to a launch (angle,power) by pulling BACK from the bow
    function aimFromPointer(px, py) {
      var bowSX = sx(BX), bowSY = sy(BY);
      var dx = bowSX - px, dy = py - bowSY;         // pull-back vector (screen y down → world y up)
      var dist = Math.sqrt(dx * dx + dy * dy);
      var maxDraw = Math.min(W, H) * 0.42;
      var power = 320 + Math.min(1, dist / maxDraw) * 620;
      return { angle: Math.atan2(dy, dx), power: power, dist: dist };
    }
    function down(px, py) {
      if (paused || over || flying) return;
      aiming = aimFromPointer(px, py);
    }
    function move(px, py) { if (aiming && !paused && !over) aiming = aimFromPointer(px, py); }
    function up() {
      if (!aiming) return;
      var d = aiming; aiming = null;
      if (d.dist < 14) return; // a tap, not a draw
      launchAnimated(d.angle, d.power);
      previewNext = false;
    }
    cv.addEventListener("mousedown", function (e) { var p = pt(e); down(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { var p = pt(e); move(p.x, p.y); });
    cv.addEventListener("mouseup", up);
    cv.addEventListener("mouseleave", up);
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); down(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); move(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); up(); }, { passive: false });
    steadyBtn.onclick = function () { if (steady > 0) useSteady(); else steadyQuiz(); };

    // ---------- simulation ----------
    function step(dt) {
      simClock += dt;
      if (target.moving) { target.phase += dt; target.y = target.baseY + Math.sin(target.phase * 1.4) * target.drift; }
      for (var b = 0; b < bonus.length; b++) { var bo = bonus[b]; bo.phase += dt; bo.y = bo.baseY + Math.sin(bo.phase * 0.9) * 22; }
      // wind particles stream across the field in the wind's direction
      var wd = wind === 0 ? 0 : (wind > 0 ? 1 : -1);
      for (var i = 0; i < windParts.length; i++) {
        var p = windParts[i];
        p.x += (60 + Math.abs(wind) * 0.4) * wd * dt;
        if (wd > 0 && p.x > WW) p.x = 0; else if (wd < 0 && p.x < 0) p.x = WW;
      }
      stepFlight(dt);
      // offer STEADY AIM once per round when the player still has arrows to steady
      if (!steadyShown && steady < 2 && !over && !paused && arrowNo <= 3 && !flying) showSteady();
      if (juice) juice.update(dt);
    }
    // advance the sim by `seconds` in fixed <=50ms sub-steps (deterministic)
    function tick(seconds) {
      var left = seconds;
      while (left > 1e-4) { var d = Math.min(0.05, left); step(d); left -= d; }
    }

    // ---------- drawing ----------
    function drawArrow(px, py, angle, alpha) {
      ctx.save(); ctx.translate(px, py); ctx.rotate(-angle);
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      ctx.strokeStyle = "#6b4a2b"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-26 * S, 0); ctx.lineTo(18 * S, 0); ctx.stroke();
      ctx.fillStyle = "#cfd6dd"; ctx.beginPath();
      ctx.moveTo(18 * S, 0); ctx.lineTo(10 * S, -4 * S); ctx.lineTo(10 * S, 4 * S); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#ff6b6b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-26 * S, 0); ctx.lineTo(-20 * S, -5 * S); ctx.moveTo(-26 * S, 0); ctx.lineTo(-20 * S, 5 * S); ctx.stroke();
      ctx.restore();
    }
    function drawTargetFace(tobj) {
      var cx = sx(tobj.x), cy = sy(tobj.y), R = tobj.r * S;
      var cols = tobj.gold ? ["#ffd23f", "#ffe98a", "#ffd23f", "#fff3bf", "#ffd23f"] : ["#e05252", "#ffffff", "#40a4ff", "#111111", "#ffd23f"];
      for (var k = 0; k < 5; k++) { ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.arc(cx, cy, R * (1 - k * 0.19), 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = "#0006"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      // post the target stands on
      ctx.strokeStyle = "#7a5a34"; ctx.lineWidth = 5 * S; ctx.beginPath(); ctx.moveTo(cx, cy + R); ctx.lineTo(cx, sy(0)); ctx.stroke();
    }
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#8fd3ff"); g.addColorStop(0.7, "#cdeeff"); g.addColorStop(1, "#dff3e0");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // ground
      ctx.fillStyle = "#8bc772"; ctx.fillRect(0, sy(0), W, H - sy(0));
      ctx.fillStyle = "#79b562"; ctx.fillRect(0, sy(0), W, 4);
      // wind particles (little streaks)
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 2;
      if (Math.abs(wind) > 6) for (var i = 0; i < windParts.length; i++) {
        var p = windParts[i], len = 6 + Math.abs(wind) * 0.05, wd = wind > 0 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(sx(p.x), sy(p.y)); ctx.lineTo(sx(p.x) - wd * len, sy(p.y)); ctx.stroke();
      }
      // wind sock, up high near the target
      var sockX = sx(target.x), sockY = sy(WH - 40), fl = Math.max(8, Math.abs(wind) * 0.12) * (wind >= 0 ? 1 : -1) * S;
      ctx.strokeStyle = "#5a6b7a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sockX, sockY); ctx.lineTo(sockX, sockY - 34 * S); ctx.stroke();
      ctx.fillStyle = Math.abs(wind) > 120 ? "#ff6b6b" : "#ffb01f";
      ctx.beginPath(); ctx.moveTo(sockX, sockY - 30 * S); ctx.lineTo(sockX + fl, sockY - 24 * S); ctx.lineTo(sockX, sockY - 18 * S); ctx.closePath(); ctx.fill();
      // bonus targets
      for (var bi = 0; bi < bonus.length; bi++) {
        var bo = bonus[bi]; if (!bo.alive) continue;
        ctx.font = Math.round(bo.r * 2.2 * S) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (bo.kind === "apple") { ctx.strokeStyle = "#7a5a34"; ctx.lineWidth = 4 * S; ctx.beginPath(); ctx.moveTo(sx(bo.x), sy(bo.y)); ctx.lineTo(sx(bo.x), sy(0)); ctx.stroke(); }
        ctx.fillText(bo.kind === "apple" ? "🍎" : "🎈", sx(bo.x), sy(bo.y));
      }
      // main target
      drawTargetFace(target);
      // stuck arrows
      for (var si = 0; si < stuck.length; si++) { var a = stuck[si]; drawArrow(sx(a.x), sy(a.y), a.angle, 1); }
      // steady preview arc (dotted) for the readied arrow
      if (previewShot) {
        ctx.strokeStyle = "rgba(38,166,91,.7)"; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath();
        var pa = makeArrow(previewShot.angle, previewShot.power);
        for (var tt = 0; tt <= 2.0; tt += 0.05) { var wx = xAt(pa, tt), wy = yAt(pa, tt); if (wy < 0) break; if (tt === 0) ctx.moveTo(sx(wx), sy(wy)); else ctx.lineTo(sx(wx), sy(wy)); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      // the archer + bow
      var bx = sx(BX), by = sy(BY), bend = aiming ? Math.min(1, (aiming.power - 320) / 620) : 0;
      ctx.strokeStyle = "#2e6b3a"; ctx.lineWidth = 6 * S; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 6 * S, sy(0)); ctx.stroke();            // body
      ctx.fillStyle = "#f2c9a0"; ctx.beginPath(); ctx.arc(bx - 4 * S, by - 24 * S, 9 * S, 0, Math.PI * 2); ctx.fill(); // head
      ctx.strokeStyle = "#6b4a2b"; ctx.lineWidth = 4 * S;                                            // bow
      ctx.beginPath(); ctx.arc(bx + 8 * S, by, 26 * S, -Math.PI * 0.6, Math.PI * 0.6); ctx.stroke();
      ctx.strokeStyle = "#eee"; ctx.lineWidth = 1.5;                                                 // string, drawn back when aiming
      var pull = bend * 24 * S;
      ctx.beginPath(); ctx.moveTo(bx + 8 * S, by - 22 * S); ctx.lineTo(bx + 8 * S - pull, by); ctx.lineTo(bx + 8 * S, by + 22 * S); ctx.stroke();
      // aim arrow + power indicator while drawing (NO trajectory — kids learn the arc)
      if (aiming) {
        drawArrow(bx + 8 * S - pull, by, aiming.angle, 0.9);
        var pw = Math.min(1, (aiming.power - 320) / 620);
        ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(bx - 30 * S, by + 40 * S, 60 * S, 8);
        ctx.fillStyle = pw > 0.8 ? "#ff6b6b" : "#ffd23f"; ctx.fillRect(bx - 30 * S, by + 40 * S, 60 * S * pw, 8);
      }
      // the arrow in flight (with a little wobble)
      if (flying) {
        var fx = xAt(flying, flying.t), fy = yAt(flying, flying.t);
        var vx = flying.vx + flying.w * flying.t, vy = flying.vy - G * flying.t;
        var ang = Math.atan2(vy, vx) + Math.sin(flying.t * 30) * 0.05;
        drawArrow(sx(fx), sy(fy), ang, 1);
      }
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

    // ---------- exit / banking ----------
    function bankExit() {
      if (over) return;                          // course-end already banked
      if (courseTotal + roundScore <= 0 && stuck.length === 0) return; // untouched run banks nothing
      var total = courseTotal + roundScore;
      var b = bankRun(total);
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🎯 Bullseye run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
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
    cv._archery = {
      state: function () {
        var arr = [];
        for (var i = 0; i < stuck.length; i++) arr.push({ x: stuck[i].x, y: stuck[i].y, flying: false });
        if (flying) arr.push({ x: xAt(flying, flying.t), y: yAt(flying, flying.t), flying: true });
        return {
          round: round, arrow: arrowNo, score: courseTotal + roundScore, roundScore: roundScore,
          wind: wind, arrows: arr, steady: steady, over: over, banked: banked,
          best: stats.bestCourse || 0, packs: { late: !!stats.packLate }
        };
      },
      begin: begin,
      loose: loose,
      windSet: function (w) { setWind(w); },
      targetAt: function () { return { x: target.x, y: target.y, r: target.r, moving: !!target.moving }; },
      aimFor: aimFor,
      steadyQuiz: steadyQuiz,
      useSteady: useSteady,
      packQuiz: packQuiz,
      tick: tick
    };

    // ---------- boot ----------
    startCourse();
    if (global._archerydemo) { // screenshot seed: paused mid-round-9 with an arrow mid-flight
      global._archerydemo = 0;
      round = 9; courseTotal = 92; layoutRound(); setWind(120);
      // two arrows already buried in the target face
      stuck.push({ x: target.x, y: target.y + 12, angle: 0.6, inTarget: true });
      stuck.push({ x: target.x, y: target.y - 8, angle: 0.5, inTarget: true });
      // one arrow frozen mid-flight in the wind
      flying = makeArrow(0.72, 720); flying.res = resolveArrow(flying); flying.t = flying.res.t * 0.55;
      // a balloon drifting across
      bonus = [{ kind: "balloon", x: 640, y: 330, baseY: 330, r: 30, pts: 5, phase: 1, alive: true }];
      roundScore = 18; paused = true; updateHud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxArchery = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
