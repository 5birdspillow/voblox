/*
 * Voblox arcade game — 🎳 STRIKE ZONE (real ten-pin bowling).
 * A perspective lane with 10 pins in formation. DRAG BACK from the ball and
 * release to throw (direction + power, aim arrow while dragging); SWIPE left/
 * right DURING the roll to add curve/spin for juicy hook shots. Ball-pin and
 * pin-pin knockdowns are simulated as circles with momentum transfer, substepped
 * so a fast ball never tunnels the rack.
 *
 * REAL SCORING: 10 frames, strikes/spares/open frames with proper bonus math and
 * the 10th-frame extra balls, shown on a kid-readable score sheet up top.
 *
 * MODES: solo 10-frame game vs your best, or VS BOT — a named rival (Bots) that
 * alternates frames with fast-forwarded rolls.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🎳 POWER BALL: once per game, answer a word (miniQuiz) to load a heavy ball
 *     (stronger scatter + mild aim assist) for your next throw.
 *   - 🔁 RE-RACK: when a SPLIT is left standing, a word can re-rack it once (kind).
 * Economy: gems/XP only via store.record (miniQuiz) + ONE recordGame("bowling")
 * per game, banked on game-end, quit, AND app-close. Stats persist additively.
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  // ---------- logical lane space (bowler at y=0, pins at the far end) ----------
  var LW = 100, LL = 300;            // lane width / length (logical units)
  var BALLR = 4.6, PINR = 2.7;       // circle radii
  var MAXV = 250;                    // top ball speed down the lane
  var CURVEACC = 90, SWIPE = 0.5;    // hook accel per spin unit / swipe→spin gain

  function pinHome() {
    var s = 11, rg = 11, cx = LW / 2, y0 = 250;
    return [
      { id: 1, x: cx, y: y0 },
      { id: 2, x: cx - s / 2, y: y0 + rg }, { id: 3, x: cx + s / 2, y: y0 + rg },
      { id: 4, x: cx - s, y: y0 + 2 * rg }, { id: 5, x: cx, y: y0 + 2 * rg }, { id: 6, x: cx + s, y: y0 + 2 * rg },
      { id: 7, x: cx - 1.5 * s, y: y0 + 3 * rg }, { id: 8, x: cx - 0.5 * s, y: y0 + 3 * rg },
      { id: 9, x: cx + 0.5 * s, y: y0 + 3 * rg }, { id: 10, x: cx + 1.5 * s, y: y0 + 3 * rg }
    ];
  }
  // known splits get a special callout
  function splitName(ids) {
    var key = ids.slice().sort(function (a, b) { return a - b; }).join(",");
    var named = { "7,10": "7-10", "4,6": "4-6", "4,7,10": "4-7-10", "6,7,10": "6-7-10", "4,6,7,10": "big four", "5,7": "5-7", "5,10": "5-10", "8,10": "8-10", "4,9": "4-9" };
    return named[key] || null;
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("bowling");
    stats.bestGame = stats.bestGame || 0;   // additive, never-renamed
    stats.strikes = stats.strikes || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap bowling";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="bwcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="bwmsg">🎳 Strike Zone — drag back to throw!</div>' +
      '<div class="grow"><span id="bwframe">Frame 1</span><span id="bwscore">Score 0</span>' +
      '<button class="embtn" id="bwvs" style="min-width:70px;padding:8px 10px"><span class="ebl">🤖 VS</span></button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="bwsheet" id="bwsheet" style="position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 112px);' +
      'z-index:6;display:flex;gap:2px;justify-content:center;padding:2px 4px;pointer-events:none;font-family:Trebuchet MS,sans-serif"></div>' +
      '<div class="gmsg" id="bwbig"></div>' +
      '<button id="bwpow" type="button" style="display:none;position:absolute;left:calc(env(safe-area-inset-left, 0px) + 12px);bottom:calc(env(safe-area-inset-bottom) + 16px);' +
      'z-index:8;background:linear-gradient(#ffd23f,#ff9f1f);color:#5a3d00;border:none;border-radius:14px;padding:10px 14px;' +
      'font-family:inherit;font-weight:900;font-size:14px;box-shadow:0 5px 0 #b9791a,0 8px 18px #0006;cursor:pointer">🎳 POWER BALL</button>' +
      '<button id="bwrr" type="button" style="display:none;position:absolute;right:calc(env(safe-area-inset-right, 0px) + 12px);bottom:calc(env(safe-area-inset-bottom) + 16px);' +
      'z-index:8;background:linear-gradient(#8ecdf7,#3f8fd8);color:#06263f;border:none;border-radius:14px;padding:10px 14px;' +
      'font-family:inherit;font-weight:900;font-size:14px;box-shadow:0 5px 0 #2c6aa0,0 8px 18px #0006;cursor:pointer">🔁 RE-RACK</button>' +
      '<div class="gover" id="bwq" style="display:none"></div>' +
      '<div class="gover" id="bwcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#bwcv"), ctx = cv.getContext("2d");
    var bwq = document.getElementById("bwq"), bwcard = document.getElementById("bwcard");
    var msgEl = document.getElementById("bwmsg"), bigEl = document.getElementById("bwbig");
    var powBtn = document.getElementById("bwpow"), rrBtn = document.getElementById("bwrr");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- responsive perspective lane ----------
    // Retina-sharp backing store (min(dpr,2)); all game code stays in CSS px.
    // The lane's far end starts below the score sheet (whose env() top already
    // clears the Dynamic Island), so pins are never hidden under the HUD.
    var W, H, laneBot, laneTop, nearHalf, farHalf, laneCx;
    var sheetEl = document.getElementById("bwsheet");
    function resize() {
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      W = wrap.clientWidth || global.innerWidth || 360;
      H = wrap.clientHeight || global.innerHeight || 640;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      laneCx = W / 2;
      var sheetBot = 0;
      try { sheetBot = (parseFloat(getComputedStyle(sheetEl).top) || 0) + 56; } catch (_) {}
      laneTop = Math.max(96, H * 0.16, sheetBot);
      laneBot = H - Math.max(70, H * 0.14);
      nearHalf = Math.min(W * 0.42, 240);
      farHalf = nearHalf * 0.34;
    }
    resize(); window.addEventListener("resize", resize);
    // logical (lx across 0..LW, ly down 0..LL) → screen, with converging perspective
    function project(lx, ly) {
      var t = ly / LL;                          // 0 near .. 1 far
      var half = nearHalf + (farHalf - nearHalf) * t;
      var sy = laneBot + (laneTop - laneBot) * t;
      var sx = laneCx + ((lx - LW / 2) / (LW / 2)) * half;
      return { x: sx, y: sy, s: half / nearHalf };
    }
    function toLogical(sx, sy) {
      var t = (sy - laneBot) / (laneTop - laneBot); t = t < 0 ? 0 : t > 1 ? 1 : t;
      var half = nearHalf + (farHalf - nearHalf) * t;
      return { x: LW / 2 + ((sx - laneCx) / half) * (LW / 2), y: t * LL };
    }

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now(), animT = 0;
    var pins = [], ball = null, phase = "aim";   // aim | roll | quiz
    var fi = 0, rollNo = 1, pinsStanding = 10;   // frame index 0..9
    var sheet = [], frameScores = [], scoreTotal = 0, strikesThisGame = 0;
    var over = false, paused = false, banked = false, ended = false;
    var vsBot = false, bot = null, botSheet = [], botScores = [], botTotal = 0, botPlayed = 0;
    var powerUsed = false, powerArmed = false, rerackUsed = false, splitStanding = false;
    var rackStart = 10, lastFmt = null, aim = { active: false, x0: 0, y0: 0, x: 0, y: 0 }, swipeX = null;

    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1200); }

    // ---------- rack ----------
    function resetRack() {
      pins = pinHome().map(function (p) { return { id: p.id, x: p.x, y: p.y, hx: p.x, hy: p.y, vx: 0, vy: 0, down: false, ang: 0, spin: 0 }; });
      pinsStanding = 10;
    }
    function standingCount() { var n = 0; for (var i = 0; i < pins.length; i++) if (!pins[i].down) n++; return n; }
    function standingIds() { var a = []; for (var i = 0; i < pins.length; i++) if (!pins[i].down) a.push(pins[i].id); return a; }
    function markDown(n) { // test/shortcut topple of n standing pins (natural order)
      var c = 0;
      for (var i = 0; i < pins.length && c < n; i++) {
        if (!pins[i].down) { pins[i].down = true; pins[i].vx = (Math.random() - 0.5) * 40; pins[i].vy = 30 + Math.random() * 40; pins[i].spin = (Math.random() - 0.5) * 12; c++; }
      }
    }

    // ---------- lifecycle ----------
    function begin(bots) {
      vsBot = !!bots;
      bot = vsBot ? (Bots ? Bots.pickOpponents(1, P ? P.botSkillFor(stats.rankPts) : 0.5, [])[0] : null) : null;
      if (vsBot && !bot) bot = { name: "Rival", skill: 0.5 };
      fi = 0; rollNo = 1; sheet = []; frameScores = []; scoreTotal = 0; strikesThisGame = 0;
      botSheet = []; botScores = []; botTotal = 0; botPlayed = 0;
      for (var i = 0; i < 10; i++) { sheet.push([]); botSheet.push([]); }
      over = false; paused = false; banked = false; ended = false;
      powerUsed = false; powerArmed = false; rerackUsed = false; splitStanding = false;
      phase = "aim"; ball = null; aim.active = false; swipeX = null;
      resetRack();
      bwcard.style.display = "none"; bwq.style.display = "none";
      hidePow(); hideRR();
      updateSheet(); hud();
      big(vsBot ? "🎳 VS " + bot.name + "!" : "🎳 STRIKE ZONE!", "#ffd23f");
      if (vsBot && Bots && sfx && sfx.chime) sfx.chime();
    }
    function hud() {
      document.getElementById("bwframe").textContent = (fi >= 9 ? "Frame 10" : "Frame " + (fi + 1)) + (vsBot ? "  🤖" : "");
      document.getElementById("bwscore").textContent = "Score " + scoreTotal + (vsBot ? " · " + bot.name + " " + botTotal : "");
    }
    function showPow() { if (!powerUsed && !over) powBtn.style.display = "block"; }
    function hidePow() { powBtn.style.display = "none"; }
    function showRR() { rrBtn.style.display = "block"; }
    function hideRR() { rrBtn.style.display = "none"; }

    // ---------- SCORING ENGINE ----------
    function tenthComplete(a) {
      if (a.length < 2) return false;
      if (a[0] === 10 || a[0] + a[1] === 10) return a.length === 3;
      return a.length === 2;
    }
    function computeScores(sh) {
      var balls = [];
      for (var f = 0; f < 10; f++) for (var r = 0; r < sh[f].length; r++) balls.push(sh[f][r]);
      var scores = [], total = 0, i = 0, last = 0;
      for (var fr = 0; fr < 10; fr++) {
        if (fr < 9) {
          if (i >= balls.length) { scores[fr] = null; break; }
          if (balls[i] === 10) { // strike
            if (i + 2 < balls.length) { total += 10 + balls[i + 1] + balls[i + 2]; scores[fr] = total; last = total; }
            else { scores[fr] = null; i += 1; break; }
            i += 1;
          } else if (i + 1 < balls.length) {
            if (balls[i] + balls[i + 1] === 10) { // spare
              if (i + 2 < balls.length) { total += 10 + balls[i + 2]; scores[fr] = total; last = total; }
              else { scores[fr] = null; i += 2; break; }
            } else { total += balls[i] + balls[i + 1]; scores[fr] = total; last = total; }
            i += 2;
          } else { scores[fr] = null; break; }
        } else {
          var rem = sh[9], s = 0; for (var k = 0; k < rem.length; k++) s += rem[k];
          if (tenthComplete(rem)) { total += s; scores[fr] = total; last = total; }
          else scores[fr] = null;
        }
      }
      return { scores: scores, total: last };
    }
    function recompute() {
      var r = computeScores(sheet); frameScores = r.scores; scoreTotal = r.total;
      if (vsBot) { var b = computeScores(botSheet); botScores = b.scores; botTotal = b.total; }
    }

    // ---------- roll resolution ----------
    function endFrame() { fi += 1; rollNo = 1; resetRack(); splitStanding = false; }
    function finishGame() {
      over = true;
      recompute();
      if (vsBot) { while (botPlayed < 10) { botPlayFrame(botPlayed); botPlayed++; } recompute(); } // rival finishes so the win is real
      endGame();
    }
    function handleTenth(knocked) {
      var a = sheet[9];
      if (a.length === 1) { if (knocked === 10) resetRack(); rollNo = 2; }
      else if (a.length === 2) {
        var strike1 = a[0] === 10, spare = !strike1 && a[0] + a[1] === 10;
        if (strike1) { if (a[1] === 10) resetRack(); rollNo = 3; }
        else if (spare) { resetRack(); rollNo = 3; }
        else finishGame();
      } else finishGame();
    }
    function checkSplit() {
      var ids = standingIds();
      var headDown = ids.indexOf(1) < 0;
      if (!headDown || ids.length < 2) { splitStanding = false; hideRR(); return; }
      // a real split: a downed pin sits between standing pins (horizontal gap)
      var xs = ids.map(function (id) { return pins.filter(function (p) { return p.id === id; })[0].hx; });
      var gap = Math.max.apply(null, xs) - Math.min.apply(null, xs);
      if (gap > 14) {
        splitStanding = true;
        var nm = splitName(ids);
        big(nm ? nm + " split... yikes! 😬" : "SPLIT! tricky one 😬", "#ff9f43");
        if (sfx && sfx.buzz) sfx.buzz();
        if (!rerackUsed) showRR();
      }
    }
    function resolveRoll(knocked) {
      if (over || ended) return;
      knocked = Math.max(0, Math.min(knocked, pinsStanding));
      var firstBall = (rollNo === 1);
      sheet[fi].push(knocked);
      pinsStanding -= knocked;
      var tenth = (fi === 9);
      if (!tenth) {
        if (firstBall && knocked === 10) { strikeFx(); strikesThisGame++; endFrame(); }
        else if (firstBall) {
          if (knocked === 0) big("GUTTER... shake it off! 🎳", "#8ecdf7");
          rollNo = 2; checkSplit();
        } else {
          if (pinsStanding === 0) spareFx(); else openFx(knocked);
          endFrame();
        }
      } else {
        if (firstBall && knocked === 10) { strikeFx(); strikesThisGame++; }
        else if (!firstBall && knocked > 0 && pinsStanding === 0 && sheet[9].length === 2 && sheet[9][0] !== 10) spareFx();
        else if (knocked === 10) { strikeFx(); strikesThisGame++; }
        handleTenth(knocked);
      }
      recompute(); updateSheet(); hud();
      phase = "aim"; powerArmed = false;
      if (!over) { showPow(); botCatchUp(); }
    }
    function strikeFx() {
      big("STRIKE!! 💥", "#ffd23f");
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(7); juice.burst(laneCx, laneTop + 20, "#ffd23f", 22); }
    }
    function spareFx() {
      big("SPARE! ✨", "#69f0ae");
      if (sfx && sfx.coin) sfx.coin();
      if (juice) { juice.shake(4); juice.burst(laneCx, laneTop + 20, "#69f0ae", 16); }
    }
    function openFx(knocked) {
      if (pinsStanding <= 2 && pinsStanding > 0) { big("so close! " + pinsStanding + " left 😮", "#8ecdf7"); if (sfx && sfx.tone) sfx.tone(320, 0.18, 0.05); } // crowd oooh
      else if (knocked >= 8) big("nice — " + knocked + " down!", "#8ecdf7");
    }

    // ---------- VS BOT ----------
    function botRoll(max) {
      if (!bot) return 0;
      var sk = bot.skill || 0.5;
      if (Math.random() < 0.15 + sk * 0.6) return max;              // clean sheet the rack
      var got = Math.round(max * (0.35 + Math.random() * sk));
      return Math.max(0, Math.min(max, got));
    }
    function botPlayFrame(f) {
      var a = [];
      if (f < 9) {
        var r1 = botRoll(10); a.push(r1);
        if (r1 < 10) a.push(botRoll(10 - r1));
      } else {
        var b1 = botRoll(10); a.push(b1);
        var stand = b1 === 10 ? 10 : 10 - b1;
        var b2 = botRoll(stand); a.push(b2);
        if (b1 === 10 || b1 + b2 === 10) { var s3 = (b2 === 10 || b1 + b2 === 10) ? 10 : stand - b2; a.push(botRoll(s3)); }
      }
      botSheet[f] = a;
    }
    function botCatchUp() {
      if (!vsBot) return;
      var playerDone = over ? 10 : fi;         // completed player frames
      while (botPlayed < playerDone) { botPlayFrame(botPlayed); botPlayed++; }
      recompute();
      if (botPlayed > 0 && !over) big("🤖 " + bot.name + ": frame " + botPlayed + " (" + botTotal + ")", "#c9b6ff");
      hud();
    }

    // ---------- physics throw ----------
    function launch(offset, power, curve) {
      if (over || phase === "roll") return;
      var x0 = LW / 2 + Math.max(-40, Math.min(40, offset));
      power = Math.max(0.12, Math.min(1, power));
      ball = { x: x0, y: 3, vx: 0, vy: power * MAXV, spin: Math.max(-1, Math.min(1, curve)) * 1.4, active: true, gutter: false, power: !!powerArmed, trail: [] };
      if (powerArmed) { ball.vy *= 1.15; ball.heavy = 3.2; if (offset) ball.x = LW / 2 + offset * 0.6; } // mild aim assist
      rackStart = standingCount();
      phase = "roll"; splitStanding = false; hidePow(); hideRR();
      if (sfx && sfx.whoosh) sfx.whoosh();
    }
    function circHit(ax, ay, bx, by, rr) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy < rr * rr; }
    function physMicro(h) {
      if (ball && ball.active) {
        // oil sheen: little curve on the slick front half, big hook in the dry back
        var oil = ball.y < LL * 0.62 ? 0.35 : 1.15;
        ball.vx += ball.spin * (ball.heavy ? 0.6 : 1) * CURVEACC * oil * h;
        ball.x += ball.vx * h; ball.y += ball.vy * h;
        if (ball.x < BALLR || ball.x > LW - BALLR) { ball.x = Math.max(BALLR, Math.min(LW - BALLR, ball.x)); ball.vx = 0; ball.spin = 0; ball.gutter = true; }
        for (var i = 0; i < pins.length; i++) {
          var p = pins[i]; if (p.down) continue;
          if (circHit(ball.x, ball.y, p.x, p.y, BALLR + PINR)) {
            var dx = p.x - ball.x, dy = p.y - ball.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
            var force = (ball.heavy || 1.4) * (0.5 + ball.vy / MAXV);
            p.vx += (dx / d) * 70 * force + ball.vx * 0.4; p.vy += (dy / d) * 80 * force + ball.vy * 0.25;
            p.spin += (Math.random() - 0.5) * 18; p.down = true;
            ball.vx += (dx / d) * -6; ball.vy *= 0.94;
            if (sfx && sfx.pop) sfx.pop();
            if (juice) juice.burst(project(p.x, p.y).x, project(p.x, p.y).y, "#fff", 5);
          }
        }
        if (ball.y > LL + 12) ball.active = false;
      }
      // pins scatter + knock each other
      for (var a = 0; a < pins.length; a++) {
        var pa = pins[a]; if (Math.abs(pa.vx) < 0.3 && Math.abs(pa.vy) < 0.3) { pa.vx *= 0.6; pa.vy *= 0.6; continue; }
        pa.x += pa.vx * h; pa.y += pa.vy * h; pa.ang += pa.spin * h;
        pa.vx *= 0.90; pa.vy *= 0.90; pa.spin *= 0.9;
        for (var b = 0; b < pins.length; b++) {
          if (a === b) continue; var pb = pins[b];
          if (circHit(pa.x, pa.y, pb.x, pb.y, PINR * 2)) {
            var ex = pb.x - pa.x, ey = pb.y - pa.y, ed = Math.sqrt(ex * ex + ey * ey) || 1;
            pb.vx += (ex / ed) * Math.abs(pa.vx + pa.vy) * 0.5 + pa.vx * 0.3;
            pb.vy += (ey / ed) * Math.abs(pa.vx + pa.vy) * 0.5 + pa.vy * 0.3;
            pb.spin += (Math.random() - 0.5) * 10;
            if (!pb.down && (Math.abs(pb.vx) + Math.abs(pb.vy)) > 12) { pb.down = true; if (sfx && sfx.pop && Math.random() < 0.4) sfx.pop(); }
            pa.vx *= 0.7; pa.vy *= 0.7;
          }
        }
      }
    }
    function physStep(dt) {
      var sp = ball && ball.active ? Math.abs(ball.vy) + Math.abs(ball.vx) : 40;
      var steps = Math.max(1, Math.ceil(sp * dt / PINR));   // substep: never tunnel the rack
      var h = dt / steps;
      for (var i = 0; i < steps; i++) physMicro(h);
    }
    function pinsMoving() {
      for (var i = 0; i < pins.length; i++) if (Math.abs(pins[i].vx) > 0.8 || Math.abs(pins[i].vy) > 0.8) return true;
      return false;
    }
    function settlePhys() {
      var knocked = rackStart - standingCount();
      var wasPower = ball && ball.power;
      ball = null;
      resolveRoll(knocked);
      if (wasPower && juice) juice.shake(6);
    }
    // deterministic throw for tests: launch + simulate to rest, synchronously
    function throwAt(offset, power, curve) {
      launch(offset, power, curve);
      var g = 0;
      while (ball && ball.active && g < 800) { physStep(0.03); g++; }
      g = 0;
      while (pinsMoving() && g < 400) { physStep(0.03); g++; }
      settlePhys();
    }

    // ---------- word powers ----------
    function powerQuiz() {
      if (powerUsed || over || paused || phase === "roll") return;
      paused = true; hidePow();
      cv._lastQ = VQ.miniQuiz(bwq, words, store, {
        title: "🎳 POWER BALL! Answer to load a heavy ball!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            powerUsed = true; powerArmed = true;
            big("🎳 POWER BALL LOADED — throw now!", "#ffd23f");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(laneCx, laneBot - 30, "#ffd23f", 18);
          } else { showPow(); big("no power this time…", "#ff8a8a"); }
        }
      });
    }
    function rerackQuiz() {
      if (rerackUsed || !splitStanding || over || paused || phase === "roll") return;
      paused = true; hideRR();
      cv._lastQ = VQ.miniQuiz(bwq, words, store, {
        title: "🔁 RE-RACK the split? Answer a word!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false; rerackUsed = true;
          if (ok) {
            // kind re-rack: respot the standing pins clustered near the head spot
            var st = pins.filter(function (p) { return !p.down; }), bx = LW / 2 - (st.length - 1) * 4;
            st.forEach(function (p, i) { p.x = p.hx = bx + i * 8; p.y = p.hy = 250; p.vx = p.vy = p.ang = 0; });
            splitStanding = false;
            big("🔁 RE-RACKED! easy pickings now ✨", "#8ecdf7");
            if (sfx && sfx.chime) sfx.chime();
            if (juice) juice.burst(laneCx, laneTop + 30, "#8ecdf7", 16);
          } else { if (!rerackUsed) showRR(); big("split stays… good luck!", "#ff8a8a"); }
        }
      });
    }

    // ---------- score sheet UI ----------
    function frameMarks(a, tenth) {
      function m(v, prev) { return v === 10 ? "X" : v === 0 ? "-" : (prev !== undefined && v + prev === 10) ? "/" : String(v); }
      var o = ["", "", ""];
      if (!tenth) {
        if (a.length >= 1) o[0] = a[0] === 10 ? "" : m(a[0]);
        if (a.length >= 1 && a[0] === 10) o[1] = "X";
        else if (a.length >= 2) o[1] = m(a[1], a[0]);
      } else {
        for (var i = 0; i < a.length; i++) {
          if (a[i] === 10) o[i] = "X";
          else if (i > 0 && a[i - 1] !== 10 && a[i] + a[i - 1] === 10) o[i] = "/";
          else o[i] = a[i] === 0 ? "-" : String(a[i]);
        }
      }
      return o;
    }
    function updateSheet() {
      var el = document.getElementById("bwsheet"); if (!el) return;
      var html = "", cur = over ? 9 : fi;
      for (var f = 0; f < 10; f++) {
        var tenth = f === 9, mk = frameMarks(sheet[f], tenth);
        var cum = frameScores[f]; var flash = "";
        if (sheet[f].length && (sheet[f][0] === 10 || (sheet[f].length >= 2 && sheet[f][0] + sheet[f][1] === 10))) flash = ";box-shadow:0 0 0 2px #ffd23f inset";
        var here = f === cur ? ";border-color:#ffd23f;border-width:2px" : "";
        var cells = tenth ? 3 : 2, cw = tenth ? 48 : 34; // 9×34 + 48 + gaps = 372px — fits a 393px screen
        var top = "";
        for (var c = 0; c < cells; c++) top += '<span style="display:inline-block;width:' + (cw / cells) + 'px;border-left:1px solid #0003;font-size:12px;font-weight:900;color:#20303a">' + (mk[c] || "&nbsp;") + "</span>";
        html += '<div style="width:' + cw + 'px;background:rgba(255,255,255,.92);border:1px solid #0004;border-radius:3px;overflow:hidden' + here + flash + '">' +
          '<div style="font-size:10px;color:#5a6b7a;line-height:11px">' + (f + 1) + '</div>' +
          '<div style="height:15px;line-height:15px">' + top + '</div>' +
          '<div style="font-size:14px;font-weight:900;height:17px;line-height:17px;color:#0b1730;border-top:1px solid #0003">' + (cum != null ? cum : "&nbsp;") + '</div></div>';
      }
      el.innerHTML = html;
    }

    // ---------- drawing ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#141b2e"); g.addColorStop(1, "#242c1a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // lane trapezoid with oil sheen
      var nl = project(0, 0), nr = project(LW, 0), fl = project(0, LL), fr = project(LW, LL);
      ctx.beginPath(); ctx.moveTo(nl.x, nl.y); ctx.lineTo(nr.x, nr.y); ctx.lineTo(fr.x, fr.y); ctx.lineTo(fl.x, fl.y); ctx.closePath();
      var lg = ctx.createLinearGradient(0, laneBot, 0, laneTop); lg.addColorStop(0, "#d9a05b"); lg.addColorStop(0.62, "#e8c489"); lg.addColorStop(1, "#c98a45");
      ctx.fillStyle = lg; ctx.fill();
      // oil sheen (front half glossy)
      ctx.save(); ctx.clip(); ctx.fillStyle = "rgba(180,220,255,.10)";
      ctx.fillRect(0, laneBot - (laneBot - laneTop) * 0.62, W, (laneBot - laneTop) * 0.62); ctx.restore();
      // gutters
      ctx.strokeStyle = "#20242e"; ctx.lineWidth = Math.max(6, nearHalf * 0.06);
      ctx.beginPath(); ctx.moveTo(nl.x - 4, nl.y); ctx.lineTo(fl.x - 2, fl.y); ctx.moveTo(nr.x + 4, nr.y); ctx.lineTo(fr.x + 2, fr.y); ctx.stroke();
      // converging aim guides (arrows on the lane)
      ctx.strokeStyle = "rgba(90,60,30,.5)"; ctx.lineWidth = 1;
      for (var gx = 25; gx <= 75; gx += 25) { var a0 = project(gx, 6), a1 = project(gx, LL * 0.8); ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke(); }
      for (var d = 20; d <= 40; d += 20) { var dot = project(LW / 2, d); ctx.fillStyle = "#7a4a1e"; ctx.beginPath(); ctx.arc(dot.x, dot.y, 2 * dot.s, 0, 7); ctx.fill(); }
      // pins
      for (var i = 0; i < pins.length; i++) {
        var p = pins[i], pr = project(p.x, p.y), rad = PINR * pr.s * 3.1;
        ctx.save(); ctx.translate(pr.x, pr.y);
        if (p.down) {
          ctx.rotate(p.ang || 1.2); ctx.globalAlpha = 0.6; ctx.fillStyle = "#e8e8ee";
          ctx.beginPath(); ctx.ellipse(0, 0, rad * 0.9, rad * 0.45, 0, 0, 7); ctx.fill();
        } else {
          ctx.fillStyle = "#fbfbff";
          ctx.beginPath(); ctx.ellipse(0, -rad * 0.2, rad * 0.55, rad, 0, 0, 7); ctx.fill();
          ctx.fillStyle = "#d33"; ctx.fillRect(-rad * 0.5, -rad * 0.5, rad, rad * 0.22);
        }
        ctx.restore();
      }
      // ball + curve trail
      if (ball) {
        ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 16) ball.trail.shift();
        for (var t = 0; t < ball.trail.length; t++) {
          var tp = project(ball.trail[t].x, ball.trail[t].y);
          ctx.globalAlpha = (t / ball.trail.length) * 0.4; ctx.fillStyle = ball.power ? "#ff5b5b" : "#40c4ff";
          ctx.beginPath(); ctx.arc(tp.x, tp.y, BALLR * tp.s * 1.6, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        var bp = project(ball.x, ball.y), br = BALLR * bp.s * 2.4;
        var bg = ctx.createRadialGradient(bp.x - br * 0.3, bp.y - br * 0.3, 1, bp.x, bp.y, br);
        bg.addColorStop(0, ball.power ? "#ff9a9a" : "#8fd4ff"); bg.addColorStop(1, ball.power ? "#8b0000" : "#12324f");
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bp.x, bp.y, br, 0, 7); ctx.fill();
      }
      // aim arrow while dragging back
      if (aim.active && phase === "aim") {
        var dx = aim.x0 - aim.x, dy = aim.y0 - aim.y, len = Math.min(Math.sqrt(dx * dx + dy * dy), 0.4 * Math.min(W, H));
        var ang = Math.atan2(dy, dx), sx = laneCx, sy = laneBot - 24;
        ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx, sy);
        var ex = sx + Math.cos(ang) * len, ey = sy - Math.abs(Math.sin(ang) * 0) - len; // pull forward preview up-lane
        ex = sx - dx * 0.6; ey = sy - len;
        ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, 7); ctx.fill();
      }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- loop ----------
    function step(dt) {
      animT += dt;
      if (phase === "roll" && ball) {
        physStep(dt);
        if (!ball.active && !pinsMoving()) settlePhys();
      } else if (phase === "roll" && !ball) { if (!pinsMoving()) settlePhys(); }
    }
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) step(dt);
      draw();
    }
    // deterministic stepping for tests/demo (<=0.05s substeps)
    function tick(seconds) {
      var left = seconds;
      while (left > 0) { var d = Math.min(0.05, left); if (!paused && !over) step(d); animT += d; left -= d; }
    }

    // ---------- input: drag back to throw, swipe during roll to curve ----------
    function pt(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    function down(x, y) {
      if (over || paused) return;
      if (phase === "roll") { swipeX = x; return; }        // grab to steer the roll
      if (phase !== "aim") return;
      aim.active = true; aim.x0 = x; aim.y0 = y; aim.x = x; aim.y = y;
    }
    function move(x, y) {
      if (phase === "roll" && swipeX != null && ball && ball.active) { ball.spin += (x - swipeX) * SWIPE * 0.03; swipeX = x; return; }
      if (!aim.active) return; aim.x = x; aim.y = y;
    }
    function up() {
      if (phase === "roll") { swipeX = null; return; }
      if (!aim.active) return; aim.active = false;
      var dx = aim.x0 - aim.x, dy = aim.y0 - aim.y, len = Math.sqrt(dx * dx + dy * dy);
      if (len < 10) return;                                 // tiny tap = no throw
      var power = Math.min(1, len / (0.4 * Math.min(W, H)));
      var offset = Math.max(-30, Math.min(30, -(dx) / (0.5 * W) * 30));
      var curve = Math.max(-1, Math.min(1, -(dx) / (0.5 * W)));
      launch(offset, power, curve);
    }
    cv.addEventListener("mousedown", function (e) { var p = pt(e); down(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { var p = pt(e); move(p.x, p.y); });
    cv.addEventListener("mouseup", up);
    cv.addEventListener("mouseleave", up);
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); down(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); move(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); up(); }, { passive: false });
    powBtn.onclick = powerQuiz; rrBtn.onclick = rerackQuiz;
    document.getElementById("bwvs").onclick = function () { begin(!vsBot); };

    // ---------- banking (ONE path: game-end, quit, app-close) ----------
    function rewards(won) {
      return {
        win: !!won, score: scoreTotal,
        rankPtsDelta: won ? Math.min(14, 4 + Math.floor(scoreTotal / 40)) : 2,
        xp: Math.min(80, 10 + Math.floor(scoreTotal / 6) + strikesThisGame * 2),
        gems: Math.max(3, Math.round(scoreTotal / 10) + strikesThisGame * 2 + (won ? 12 : 0))
      };
    }
    function bankRun(won) {
      if (banked) return null; banked = true;
      var rw = rewards(won);
      var res = store.recordGame ? store.recordGame("bowling", rw) : null;
      return { rw: rw, res: res };
    }
    function endGame() {
      if (ended) return; ended = true; over = true; paused = true;
      hidePow(); hideRR();
      var won = scoreTotal >= 120 || (vsBot && scoreTotal > botTotal);
      if (scoreTotal > (stats.bestGame || 0)) stats.bestGame = scoreTotal;
      stats.strikes = (stats.strikes || 0) + strikesThisGame;
      if (store.save) store.save();
      var bank = bankRun(won) || { rw: rewards(won) };
      updateSheet();
      showEndCard(bank.rw, won);
    }
    function showEndCard(rw, won) {
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(8); for (var cf = 0; cf < 5; cf++) juice.burst(W * (0.2 + cf * 0.15), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][cf], 16); }
      var vsLine = vsBot ? '<div style="margin:2px 0;font-size:14px">You <b>' + scoreTotal + "</b> vs " + bot.name + " <b>" + botTotal + "</b> — " + (scoreTotal > botTotal ? "🏆 you win!" : scoreTotal === botTotal ? "🤝 tie!" : "next time!") + "</div>" : "";
      bwcard.innerHTML = '<div class="wqcard" style="text-align:center;max-width:560px">' +
        '<div style="font-size:44px">🎳</div>' +
        '<div class="wqtitle" style="font-size:22px">' + (won ? "GREAT GAME!" : "Game over!") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:16px">🎳 Final <b>' + scoreTotal + '</b> · 💥 ' + strikesThisGame + ' strikes · 🏆 Best <b>' + (stats.bestGame || 0) + '</b></div>' +
        vsLine + sheetCardHTML() +
        '<button class="submit big-next" id="bwreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="bwleave" type="button">Leave</button></div>';
      bwcard.style.display = "flex";
      document.getElementById("bwreplay").onclick = function () { bwcard.style.display = "none"; begin(vsBot); };
      document.getElementById("bwleave").onclick = exit;
    }
    function sheetCardHTML() {
      var row = "";
      for (var f = 0; f < 10; f++) {
        var mk = frameMarks(sheet[f], f === 9).filter(function (x) { return x; }).join(" ");
        row += '<div style="min-width:30px;border:1px solid #0003;border-radius:4px;padding:2px"><div style="font-size:9px;color:#5a6b7a">' + (f + 1) + '</div><div style="font-size:11px;font-weight:900">' + (mk || "-") + '</div><div style="font-size:11px;color:#0b1730">' + (frameScores[f] != null ? frameScores[f] : "") + '</div></div>';
      }
      return '<div style="display:flex;gap:2px;justify-content:center;flex-wrap:wrap;margin:8px 0">' + row + "</div>";
    }

    // ---------- exit ----------
    function hasProgress() { return fi > 0 || (sheet[0] && sheet[0].length > 0); }
    function bankExit() {
      if (over || ended) return;
      if (!hasProgress()) return;
      var b = bankRun(false);
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🎳 Bowling game banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
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
    cv._bowling = {
      state: function () {
        return {
          frame: Math.min(10, fi + 1), roll: rollNo, pins: pinsStanding, score: scoreTotal,
          scores: frameScores.slice(), sheet: sheet.map(function (a) { return a.slice(); }),
          over: over, banked: banked, best: stats.bestGame || 0, powerUsed: powerUsed,
          vsBot: vsBot, botScore: botTotal, splitStanding: splitStanding, phase: phase
        };
      },
      begin: begin,
      throwAt: throwAt,
      strike: function () { markDown(pinsStanding); resolveRoll(pinsStanding); },
      knock: function (n) { n = Math.max(0, Math.min(n, pinsStanding)); markDown(n); resolveRoll(n); },
      powerQuiz: powerQuiz,
      rerackQuiz: rerackQuiz,
      tick: tick
    };

    // ---------- boot ----------
    begin(false);
    if (global._bowlingdemo) { // screenshot seed: paused mid-roll of frame 6, sheet half full (a strike + a spare)
      global._bowlingdemo = 0;
      sheet[0] = [10]; sheet[1] = [7, 3]; sheet[2] = [9, 0]; sheet[3] = [8, 1]; sheet[4] = [6, 2];
      fi = 5; rollNo = 1; resetRack();
      recompute(); updateSheet(); hud();
      ball = { x: 44, y: 150, vx: -12, vy: 200, spin: 0.9, active: true, gutter: false, power: false, trail: [] };
      for (var q = 0; q < 10; q++) ball.trail.push({ x: 50 - q * 0.7, y: 150 - q * 12 });
      phase = "roll"; paused = true;
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxBowling = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
