/*
 * Voblox arcade game — 🪩 PINBALL PANIC (a full, juicy pinball table).
 * A portrait table (logical 480×800, letterboxed): two flippers, a spring
 * plunger, 3 pop bumpers, 2 slingshots, a spinner lane, 3 drop-target banks,
 * a ramp loop, a side lane back to the plunger, and a center saucer. Real
 * circle-vs-segment physics, substepped so the ball NEVER tunnels (≤3 logical
 * units per substep). 3 balls per game, a one-time ball-saver each ball.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - ⚡ WORD MODE: light all 4 W-O-R-D letters (drop-target banks + the saucer)
 *     and a word (miniQuiz) appears. Correct = MULTIBALL (2 extra balls, DOUBLE
 *     points). Wrong = the letters reset, kindly.
 *   - 💖 LAST-BALL REVIVE: when your final ball drains, one word can put it back
 *     in the plunger (once per game).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("pinball")
 * per game, banked on game-over, quit, AND app-close. Stats persist additively.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // ---------- table geometry (logical units, y points DOWN) ----------
  var TW = 480, TH = 800;
  var R = 11;            // ball radius
  var GRAV = 1300;       // gravity (units/s^2)
  var MAXSTEP = 3;       // ball never advances more than this per substep
  var MAXV = 1550;       // speed cap (keeps the sim stable)
  var FLIPSPEED = 17;    // flipper angular speed (rad/s)
  var BUMPKICK = 300;    // extra pop off a bumper

  // outer walls + top dome + plunger channel (restitution e)
  var STATICS = [
    { ax: 12, ay: 40, bx: 12, by: 792, e: 0.42 },      // left wall
    { ax: 12, ay: 40, bx: 92, by: 18, e: 0.42 },       // top-left slope
    { ax: 92, ay: 18, bx: 392, by: 18, e: 0.42 },      // top
    { ax: 392, ay: 18, bx: 468, by: 112, e: 0.5 },     // top-right slope (feeds plunger drop-in)
    { ax: 468, ay: 112, bx: 468, by: 792, e: 0.42 },   // right outer wall
    { ax: 436, ay: 152, bx: 436, by: 792, e: 0.42 },   // plunger divider (open above y152)
    { ax: 12, ay: 632, bx: 96, by: 712, e: 0.4 },      // left lower funnel
    { ax: 436, ay: 632, bx: 352, by: 712, e: 0.4 }     // right lower funnel
  ];
  // slingshots (bounce hard, score 25)
  var SLINGS = [
    { ax: 104, ay: 706, bx: 152, by: 668, e: 1, kick: 260, cool: 0 },
    { ax: 344, ay: 706, bx: 296, by: 668, e: 1, kick: 260, cool: 0 }
  ];
  // pop bumpers (score 50)
  var BUMPERS = [
    { x: 150, y: 236, r: 23, cool: 0 },
    { x: 330, y: 236, r: 23, cool: 0 },
    { x: 240, y: 330, r: 23, cool: 0 }
  ];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("pinball");
    stats.bestScore = stats.bestScore || 0;   // additive, never-renamed
    stats.multiballs = stats.multiballs || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap pinball";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="pbcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="pbmsg">🪩 PINBALL PANIC — flip &amp; light W-O-R-D!</div>' +
      '<div class="grow"><span id="pbscore">0</span><span id="pbword">W·O·R·D</span>' +
      '<span id="pbballs">🪀 1/3</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="pbbig"></div>' +
      '<div class="gover" id="pbq" style="display:none"></div>' +
      '<div class="gover" id="pbcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#pbcv"), ctx = cv.getContext("2d");
    var pbq = document.getElementById("pbq"), pbcard = document.getElementById("pbcard");
    var msgEl = document.getElementById("pbmsg"), bigEl = document.getElementById("pbbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- letterbox (logical 480×800 -> centered on the canvas) ----------
    var W, H, S, OX, OY;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      S = Math.min(W / TW, H / TH);
      OX = (W - TW * S) / 2; OY = (H - TH * S) / 2;
    }
    resize();
    window.addEventListener("resize", resize);
    function sx(x) { return OX + x * S; }
    function sy(y) { return OY + y * S; }
    function lx(px) { return (px - OX) / S; }
    function ly(py) { return (py - OY) / S; }

    // ---------- flippers (rotating segments pivoted near the bottom) ----------
    function mkFlipper(px, py, len, restAng, upAng) {
      var f = { px: px, py: py, len: len, restAng: restAng, upAng: upAng, ang: restAng, angVel: 0, up: false, tx: 0, ty: 0 };
      f.tx = px + len * Math.cos(restAng); f.ty = py + len * Math.sin(restAng);
      return f;
    }
    var flL = mkFlipper(140, 720, 92, 0.44, -0.36);   // left: rest down-right, raises up
    var flR = mkFlipper(340, 720, 92, Math.PI - 0.44, Math.PI + 0.36); // right: mirrored

    // ---------- drop-target banks + saucer + spinner ----------
    function bankSeg(cx, cy) { return { ax: cx - 16, ay: cy, bx: cx + 16, by: cy, e: 0.55 }; }
    var banks = [
      { letter: "W", x: 330, y: 300, cleared: false, seg: bankSeg(330, 300) },
      { letter: "O", x: 150, y: 384, cleared: false, seg: bankSeg(150, 384) },
      { letter: "R", x: 330, y: 470, cleared: false, seg: bankSeg(330, 470) }
    ];
    var saucer = { x: 108, y: 176, r: 16 };
    var spinZone = { x0: 44, x1: 88, y0: 452, y1: 540 };
    var ramp = { x0: 150, x1: 300, y: 74 }; // top ramp trigger line
    var ORDER = ["W", "O", "R", "D"];

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var balls = [], ball = 1, over = false, paused = false, banked = false, statsSaved = false;
    var score = 0, scoreMul = 1, multiball = false, wordActive = false;
    var lit = { W: false, O: false, R: false, D: false };
    var saverT = 0, saverUsed = false, reviveUsed = false, revived = false;
    var combo = 0, comboT = 0, lastMilestone = 0, mbCount = 0;
    var plungerPower = 0, plungerCharging = false, popT = [];
    var lastFmt = null;

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1100);
    }
    function litLetters() { var o = []; for (var i = 0; i < ORDER.length; i++) if (lit[ORDER[i]]) o.push(ORDER[i]); return o; }
    function updateHud() {
      document.getElementById("pbscore").textContent = score.toLocaleString ? score.toLocaleString() : "" + score;
      document.getElementById("pbword").textContent = ORDER.map(function (c) { return lit[c] ? c : "·"; }).join("");
      document.getElementById("pbballs").textContent = (multiball ? "⚡×" + balls.length : "🪀 " + ball + "/3");
    }

    // ---------- scoring ----------
    function checkMilestone() {
      var m = Math.floor(score / 25000);
      if (m > lastMilestone) {
        lastMilestone = m;
        big("🎇 " + (m * 25) + "K!", "#ffd23f");
        if (juice) { juice.shake(7); juice.burst(W / 2, H * 0.35, "#ffd23f", 20); }
        if (sfx && sfx.fanfare) sfx.fanfare();
      }
    }
    function addScore(base, x, y, col) {
      var pts = Math.round(base * scoreMul);
      score += pts;
      if (juice && x !== undefined) juice.text(sx(x), sy(y), "+" + pts, col || "#ffe14d");
      checkMilestone();
      updateHud();
    }

    // ---------- ball helpers ----------
    function spawnPlungerBall() {
      balls.push({ x: 452, y: 772, vx: 0, vy: 0, parked: true, age: 0, captured: false, capT: 0 });
    }
    function ballSaverStart() { saverT = 5; saverUsed = false; }
    function ballSaverOn() { return saverT > 0 && !saverUsed; }

    function launch(power) {
      power = Math.max(0.05, Math.min(1, power || 1));
      var b = balls[0]; if (!b) { spawnPlungerBall(); b = balls[0]; }
      b.parked = false; b.age = 0;
      b.vy = -(430 + 980 * power);
      b.vx = -20 * power;
      plungerPower = 0; plungerCharging = false;
      if (sfx && sfx.whoosh) sfx.whoosh();
      if (juice) juice.burst(sx(452), sy(770), "#8ecdf7", 10);
    }
    function placeBall(x, y, vx, vy) {
      if (!balls.length) spawnPlungerBall();
      var b = balls[0];
      b.x = x; b.y = y; b.vx = vx || 0; b.vy = vy || 0; b.parked = false; b.captured = false;
    }

    // ---------- W-O-R-D letters ----------
    function lightLetter(ch) {
      if (lit[ch]) return;
      lit[ch] = true;
      if (juice) juice.burst(W / 2, 60, "#40c4ff", 12);
      updateHud();
      if (lit.W && lit.O && lit.R && lit.D) startWord();
    }
    function clearBank(bk) {
      if (bk.cleared) return;
      bk.cleared = true;
      addScore(200, bk.x, bk.y, "#9be15d");
      big("🎯 " + bk.letter + " target!", "#9be15d");
      if (sfx && sfx.pop) sfx.pop();
      lightLetter(bk.letter);
    }
    function hitTargets(bank) {
      var bk = banks[bank]; if (bk) clearBank(bk);
    }
    function resetLetters(relight) {
      lit = { W: false, O: false, R: false, D: false };
      for (var i = 0; i < banks.length; i++) banks[i].cleared = false;
      updateHud();
    }

    // ---------- WORD mode (the vocab hook) ----------
    function startWord() {
      if (wordActive || over) return;
      wordActive = true; paused = true;
      cv._lastQ = VQ.miniQuiz(pbq, words, store, {
        title: "⚡ WORD MODE! Spell it right for ⚡ MULTIBALL!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; wordActive = false; paused = false;
          if (ok) { startMultiball(); }
          else { resetLetters(); big("Letters reset — try again!", "#ffd23f"); }
          updateHud();
        }
      });
    }
    function lightWord() { // test/entry shortcut: light all 4 and open the quiz
      lit = { W: true, O: true, R: true, D: true };
      for (var i = 0; i < banks.length; i++) banks[i].cleared = true;
      updateHud();
      startWord();
    }
    function startMultiball() {
      multiball = true; scoreMul = 2; mbCount++;
      stats.multiballs = (stats.multiballs || 0) + 1;
      // 2 EXTRA balls — top up to at least 3 in play
      while (balls.length < 3) {
        balls.push({ x: 220 + balls.length * 30, y: 200, vx: (Math.random() - 0.5) * 260, vy: -180, parked: false, age: 0, captured: false, capT: 0 });
      }
      resetLetters();
      big("⚡⚡ MULTIBALL! DOUBLE POINTS! ⚡⚡", "#ffd23f");
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(9); juice.burst(W / 2, H / 2, "#ffd23f", 26); }
      updateHud();
    }

    // ---------- ball loss / saver / revive / game over ----------
    function drainBall(i, force) {
      balls.splice(i, 1);
      if (balls.length >= 1) { // multiball still running
        if (multiball && balls.length < 2) { multiball = false; scoreMul = 1; big("Multiball over!", "#8ecdf7"); }
        updateHud();
        return;
      }
      loseBallGroup(force);
    }
    function loseBallGroup(force) {
      if (multiball) { multiball = false; scoreMul = 1; }
      if (!force && ballSaverOn()) { // 💫 one-time ball-saver
        saverUsed = true; resetLetters(); spawnPlungerBall(); ballSaverStart(); saverUsed = true;
        big("💫 BALL SAVED!", "#69f0ae");
        if (sfx && sfx.chime) sfx.chime();
        updateHud();
        return;
      }
      if (ball < 3) { ball++; resetLetters(); spawnPlungerBall(); ballSaverStart();
        big("🪀 Ball " + ball + " of 3", "#8ecdf7");
        if (sfx && sfx.pop) sfx.pop(); updateHud(); return;
      }
      // last ball
      if (!reviveUsed) { reviveUsed = true; openRevive(); return; }
      gameOver();
    }
    function openRevive() {
      paused = true;
      cv._lastQ = VQ.miniQuiz(pbq, words, store, {
        title: "💖 LAST BALL! Answer a word to save your game!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) {
            revived = true; paused = false; resetLetters(); spawnPlungerBall(); ballSaverStart();
            big("💖 REVIVED! One more ball!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else { gameOver(); }
        }
      });
    }

    // ---------- banking (one guarded path for over / quit / app-close) ----------
    function rewards(won) {
      return {
        win: !!won, score: score,
        rankPtsDelta: Math.min(12, 2 + Math.floor(score / 8000)) + (won ? 5 : 0),
        xp: Math.min(80, 8 + Math.floor(score / 300)),
        gems: Math.min(100, 5 + Math.floor(score / 500))
      };
    }
    function bankRun(won) {
      if (banked) return null;
      banked = true;
      var rw = rewards(won);
      var res = store.recordGame ? store.recordGame("pinball", rw) : null;
      return { rw: rw, res: res };
    }
    function endRunStats() {
      if (statsSaved) return; statsSaved = true;
      if (score > (stats.bestScore || 0)) stats.bestScore = score;
      if (store.save) store.save();
    }
    function gameOver() {
      if (over) return;
      over = true; paused = true;
      endRunStats();
      var b = bankRun(score >= 50000);
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(10);
      showEnd(b ? b.rw : rewards(score >= 50000));
    }
    function showEnd(rw) {
      pbcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">🪩</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (rw.win ? "🏆 HUGE GAME!" : "Game over!") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🪩 Score <b>' + score.toLocaleString() + '</b> · 🏆 Best <b>' + (stats.bestScore || 0).toLocaleString() + '</b></div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">' + mbCount + ' multiball' + (mbCount === 1 ? "" : "s") + ' this game · ' + (stats.multiballs || 0) + ' all-time</div>' +
        '<button class="submit big-next" id="pbreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="pbleave" type="button">Leave</button></div>';
      pbcard.style.display = "flex";
      if (rw && sfx && sfx.fanfare && score >= (stats.bestScore || 0) && score > 0) sfx.fanfare();
      document.getElementById("pbreplay").onclick = function () { pbcard.style.display = "none"; begin(); };
      document.getElementById("pbleave").onclick = exit;
    }

    // ---------- lifecycle ----------
    function begin() {
      balls = []; ball = 1; over = false; paused = false; banked = false; statsSaved = false;
      score = 0; scoreMul = 1; multiball = false; wordActive = false;
      combo = 0; comboT = 0; lastMilestone = 0; mbCount = 0;
      saverUsed = false; reviveUsed = false; revived = false;
      plungerPower = 0; plungerCharging = false; popT = [];
      resetLetters();
      flL.up = false; flR.up = false; flL.ang = flL.restAng; flR.ang = flR.restAng;
      spawnPlungerBall(); ballSaverStart();
      pbcard.style.display = "none"; pbq.style.display = "none";
      updateHud();
      big("🪩 PULL &amp; LAUNCH!", "#8ef");
    }

    // ---------- physics ----------
    function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
    function closestOnSeg(px, py, ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      var t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = clamp01(t);
      return { x: ax + t * dx, y: ay + t * dy };
    }
    function hitSeg(b, s) {
      var c = closestOnSeg(b.x, b.y, s.ax, s.ay, s.bx, s.by);
      var nx = b.x - c.x, ny = b.y - c.y, d2 = nx * nx + ny * ny;
      if (d2 > R * R) return false;
      var d = Math.sqrt(d2) || 0.0001; nx /= d; ny /= d;
      b.x = c.x + nx * R; b.y = c.y + ny * R;
      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { var e = s.e || 0.42; b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
      if (s.kick) { b.vx += nx * s.kick; b.vy += ny * s.kick; }
      return true;
    }
    function hitBumper(b, bm) {
      var nx = b.x - bm.x, ny = b.y - bm.y, d2 = nx * nx + ny * ny, rr = R + bm.r;
      if (d2 > rr * rr) return false;
      var d = Math.sqrt(d2) || 0.0001; nx /= d; ny /= d;
      b.x = bm.x + nx * rr; b.y = bm.y + ny * rr;
      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 1.85 * vn * nx; b.vy -= 1.85 * vn * ny; }
      b.vx += nx * BUMPKICK; b.vy += ny * BUMPKICK;
      return true;
    }
    function hitFlipper(b, f) {
      var c = closestOnSeg(b.x, b.y, f.px, f.py, f.tx, f.ty);
      var nx = b.x - c.x, ny = b.y - c.y, d2 = nx * nx + ny * ny;
      if (d2 > R * R) return;
      var d = Math.sqrt(d2) || 0.0001; nx /= d; ny /= d;
      b.x = c.x + nx * R; b.y = c.y + ny * R;
      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 1.4 * vn * nx; b.vy -= 1.4 * vn * ny; }
      if (Math.abs(f.angVel) > 2) { // a moving flipper imparts velocity — the flip!
        var rr = Math.sqrt((c.x - f.px) * (c.x - f.px) + (c.y - f.py) * (c.y - f.py));
        var kick = Math.min(920, Math.abs(f.angVel) * rr * 0.55);
        b.vx += nx * kick; b.vy += ny * kick;
      }
    }
    function advFlipper(f, h) {
      var target = f.up ? f.upAng : f.restAng;
      var diff = target - f.ang, mx = FLIPSPEED * h;
      var mv = diff > mx ? mx : diff < -mx ? -mx : diff;
      f.ang += mv; f.angVel = mv / h;
      f.tx = f.px + f.len * Math.cos(f.ang); f.ty = f.py + f.len * Math.sin(f.ang);
    }
    function saucerCheck(b) {
      if (b.captured) return;
      var dx = b.x - saucer.x, dy = b.y - saucer.y;
      if (dx * dx + dy * dy < (saucer.r + R) * (saucer.r + R)) {
        b.captured = true; b.capT = 1.2; b.x = saucer.x; b.y = saucer.y; b.vx = 0; b.vy = 0;
        addScore(1000, saucer.x, saucer.y, "#e040fb");
        big("🛸 SAUCER! +" + Math.round(1000 * scoreMul), "#e040fb");
        if (sfx && sfx.coin) sfx.coin();
        lightLetter("D");
      }
    }
    function spinnerCheck(b) {
      var inz = b.x > spinZone.x0 && b.x < spinZone.x1 && b.y > spinZone.y0 && b.y < spinZone.y1;
      if (inz && !b.inSpin) { b.inSpin = true; addScore(10, b.x, b.y - 20, "#40c4ff"); }
      else if (!inz) b.inSpin = false;
    }
    function rampCheck(b) {
      if (b.vy < -60 && b.y < ramp.y && !b.onRamp && b.x > ramp.x0 && b.x < ramp.x1) {
        b.onRamp = true;
        combo++; comboT = 3;
        var bonus = 500 + (combo - 1) * 250;
        addScore(bonus, b.x, b.y, "#ffd23f");
        big("🌀 RAMP! " + (combo > 1 ? "COMBO ×" + combo + "  " : "") + "+" + Math.round(bonus * scoreMul), "#ffd23f");
        if (sfx && sfx.chime) sfx.chime();
        // shoot it around to the side lane feeding the plunger
        b.vx = 260; b.vy = 40;
      } else if (b.y > ramp.y + 40) b.onRamp = false;
    }
    function resolveBall(b) {
      if (b.captured) return;
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > MAXV) { b.vx *= MAXV / sp; b.vy *= MAXV / sp; }
      var i;
      for (i = 0; i < STATICS.length; i++) hitSeg(b, STATICS[i]);
      for (i = 0; i < SLINGS.length; i++) {
        if (hitSeg(b, SLINGS[i]) && SLINGS[i].cool <= 0) { SLINGS[i].cool = 0.12; addScore(25, (SLINGS[i].ax + SLINGS[i].bx) / 2, (SLINGS[i].ay + SLINGS[i].by) / 2, "#ff8a8a"); if (sfx && sfx.pop) sfx.pop(); }
      }
      hitFlipper(b, flL); hitFlipper(b, flR);
      for (i = 0; i < BUMPERS.length; i++) {
        if (hitBumper(b, BUMPERS[i]) && BUMPERS[i].cool <= 0) { BUMPERS[i].cool = 0.12; addScore(50, BUMPERS[i].x, BUMPERS[i].y - BUMPERS[i].r, "#ff6b6b"); popT.push({ x: BUMPERS[i].x, y: BUMPERS[i].y, t: 0.16 }); if (sfx && sfx.pop) sfx.pop(); }
      }
      for (i = 0; i < banks.length; i++) { if (!banks[i].cleared && hitSeg(b, banks[i].seg)) clearBank(banks[i]); }
      saucerCheck(b); spinnerCheck(b); rampCheck(b);
    }

    function step(dt) {
      // cooldowns / timers
      var i;
      for (i = 0; i < SLINGS.length; i++) SLINGS[i].cool = Math.max(0, SLINGS[i].cool - dt);
      for (i = 0; i < BUMPERS.length; i++) BUMPERS[i].cool = Math.max(0, BUMPERS[i].cool - dt);
      for (i = popT.length - 1; i >= 0; i--) { popT[i].t -= dt; if (popT[i].t <= 0) popT.splice(i, 1); }
      if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
      if (saverT > 0) saverT = Math.max(0, saverT - dt);
      // released captured balls (saucer eject)
      for (i = 0; i < balls.length; i++) {
        var b = balls[i];
        b.age += dt;
        if (b.captured) { b.capT -= dt; if (b.capT <= 0) { b.captured = false; b.vy = -520; b.vx = 40; if (sfx && sfx.whoosh) sfx.whoosh(); } }
      }
      // determine a uniform substep small enough that NOTHING moves > MAXSTEP:
      // the fastest ball AND a sweeping flipper's tip both count, so a raising
      // flipper can never teleport past a resting ball.
      var maxv = 0;
      for (i = 0; i < balls.length; i++) { if (balls[i].parked || balls[i].captured) continue; var s2 = Math.sqrt(balls[i].vx * balls[i].vx + balls[i].vy * balls[i].vy) + GRAV * dt; if (s2 > maxv) maxv = s2; }
      if ((flL.up ? flL.ang > flL.upAng : flL.ang < flL.restAng) || (flR.up ? flR.ang < flR.upAng : flR.ang > flR.restAng)) {
        var tipV = FLIPSPEED * Math.max(flL.len, flR.len);
        if (tipV > maxv) maxv = tipV;
      }
      var steps = Math.max(1, Math.min(64, Math.ceil(maxv * dt / MAXSTEP)));
      var h = dt / steps;
      for (var s = 0; s < steps; s++) {
        advFlipper(flL, h); advFlipper(flR, h);
        for (i = 0; i < balls.length; i++) {
          var bl = balls[i];
          if (bl.parked || bl.captured) continue;
          bl.vy += GRAV * h;
          bl.x += bl.vx * h; bl.y += bl.vy * h;
          resolveBall(bl);
        }
        // drains (natural — the ball-saver may catch these)
        for (i = balls.length - 1; i >= 0; i--) {
          if (!balls[i].parked && balls[i].y > TH + 16) { drainBall(i, false); }
        }
        if (over || paused) break;
      }
    }

    // ---------- drawing ----------
    function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath(); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // table felt
      var g = ctx.createLinearGradient(0, OY, 0, OY + TH * S);
      g.addColorStop(0, "#241a3a"); g.addColorStop(1, "#0e0a1c");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#181030"; ctx.fillRect(sx(12), sy(18), (TW - 24) * S, (TH - 30) * S);
      // walls
      ctx.strokeStyle = "#6a5aa8"; ctx.lineWidth = Math.max(2, 4 * S); ctx.lineCap = "round";
      var i;
      for (i = 0; i < STATICS.length; i++) { var w2 = STATICS[i]; ctx.beginPath(); ctx.moveTo(sx(w2.ax), sy(w2.ay)); ctx.lineTo(sx(w2.bx), sy(w2.by)); ctx.stroke(); }
      // slings
      ctx.strokeStyle = "#ff6b6b"; ctx.lineWidth = Math.max(3, 6 * S);
      for (i = 0; i < SLINGS.length; i++) { var sl = SLINGS[i]; ctx.beginPath(); ctx.moveTo(sx(sl.ax), sy(sl.ay)); ctx.lineTo(sx(sl.bx), sy(sl.by)); ctx.stroke(); }
      // spinner lane hint
      ctx.fillStyle = "rgba(64,196,255,.12)"; ctx.fillRect(sx(spinZone.x0), sy(spinZone.y0), (spinZone.x1 - spinZone.x0) * S, (spinZone.y1 - spinZone.y0) * S);
      // banks
      for (i = 0; i < banks.length; i++) {
        var bk = banks[i];
        ctx.font = Math.round(20 * S) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (!bk.cleared) {
          ctx.fillStyle = "#ffd23f"; ctx.fillRect(sx(bk.x - 16), sy(bk.y - 7), 32 * S, 14 * S);
          ctx.fillStyle = "#5a3d00"; ctx.font = "bold " + Math.round(13 * S) + "px Trebuchet MS"; ctx.fillText(bk.letter, sx(bk.x), sy(bk.y));
        } else { ctx.fillStyle = "rgba(155,225,93,.35)"; ctx.fillRect(sx(bk.x - 16), sy(bk.y - 4), 32 * S, 8 * S); }
      }
      // bumpers
      for (i = 0; i < BUMPERS.length; i++) {
        var bm = BUMPERS[i], pop = 0;
        for (var p = 0; p < popT.length; p++) if (popT[p].x === bm.x && popT[p].y === bm.y) pop = popT[p].t / 0.16;
        ctx.fillStyle = pop > 0 ? "#fff59d" : "#a05ad8";
        circle(sx(bm.x), sy(bm.y), (bm.r + pop * 4) * S); ctx.fill();
        ctx.fillStyle = "#e6d5ff"; ctx.font = Math.round(bm.r * 1.1 * S) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🍄", sx(bm.x), sy(bm.y));
      }
      // saucer
      ctx.fillStyle = "#3a2a5a"; circle(sx(saucer.x), sy(saucer.y), saucer.r * S); ctx.fill();
      ctx.strokeStyle = "#e040fb"; ctx.lineWidth = Math.max(1, 2 * S); ctx.stroke();
      // flippers
      ctx.strokeStyle = "#40c4ff"; ctx.lineWidth = Math.max(5, 9 * S); ctx.lineCap = "round";
      [flL, flR].forEach(function (f) { ctx.beginPath(); ctx.moveTo(sx(f.px), sy(f.py)); ctx.lineTo(sx(f.tx), sy(f.ty)); ctx.stroke(); });
      // plunger (only when a ball waits)
      if (balls[0] && balls[0].parked) {
        var pc = plungerPower;
        ctx.fillStyle = "#ffd23f"; ctx.fillRect(sx(444), sy(778 + pc * 14), 16 * S, (10 + pc * 20) * S);
      }
      // balls
      for (i = 0; i < balls.length; i++) {
        var b = balls[i];
        var rg = ctx.createRadialGradient(sx(b.x) - 3, sy(b.y) - 3, 1, sx(b.x), sy(b.y), R * S);
        rg.addColorStop(0, "#ffffff"); rg.addColorStop(1, "#9aa8c8");
        ctx.fillStyle = rg; circle(sx(b.x), sy(b.y), R * S); ctx.fill();
      }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) {
        if (plungerCharging && balls[0] && balls[0].parked) plungerPower = Math.min(1, plungerPower + dt * 0.9);
        step(dt);
      }
      draw();
    }

    // ---------- input (arrow keys + screen halves + mouse; multi-touch aware) ----------
    function inPlungerZone(px) { return lx(px) > 400; }
    function flip(side, up) { (side === "L" ? flL : flR).up = up; if (up && sfx && sfx.tick) sfx.tick(); }
    function onKey(e, down) {
      if (e.key === "ArrowLeft") { flip("L", down); e.preventDefault(); }
      else if (e.key === "ArrowRight") { flip("R", down); e.preventDefault(); }
      else if (e.key === " " || e.key === "ArrowDown") {
        if (down) plungerCharging = true;
        else if (plungerCharging) { plungerCharging = false; if (balls[0] && balls[0].parked) launch(plungerPower || 0.6); }
        e.preventDefault();
      }
    }
    var kd = function (e) { if (!over && !paused) onKey(e, true); };
    var ku = function (e) { onKey(e, false); };
    document.addEventListener("keydown", kd);
    document.addEventListener("keyup", ku);

    var touchMap = {}; // identifier -> 'L' | 'R' | 'P'
    function touchStart(px, id) {
      if (inPlungerZone(px) && balls[0] && balls[0].parked) { touchMap[id] = "P"; plungerCharging = true; }
      else if (lx(px) < TW / 2) { touchMap[id] = "L"; flip("L", true); }
      else { touchMap[id] = "R"; flip("R", true); }
    }
    function touchEnd(id) {
      var role = touchMap[id]; delete touchMap[id];
      if (role === "L") flip("L", false);
      else if (role === "R") flip("R", false);
      else if (role === "P") { plungerCharging = false; if (balls[0] && balls[0].parked) launch(plungerPower || 0.6); }
    }
    cv.addEventListener("touchstart", function (e) {
      e.preventDefault();
      var r = cv.getBoundingClientRect();
      for (var i = 0; i < e.changedTouches.length; i++) { var tc = e.changedTouches[i]; if (!paused && !over) touchStart(tc.clientX - r.left, tc.identifier); }
    }, { passive: false });
    function touchLift(e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) touchEnd(e.changedTouches[i].identifier); }
    cv.addEventListener("touchend", touchLift, { passive: false });
    cv.addEventListener("touchcancel", touchLift, { passive: false });
    cv.addEventListener("mousedown", function (e) { if (paused || over) return; var r = cv.getBoundingClientRect(); touchStart(e.clientX - r.left, "mouse"); });
    cv.addEventListener("mouseup", function () { touchEnd("mouse"); });
    cv.addEventListener("mouseleave", function () { if (touchMap.mouse) touchEnd("mouse"); });

    // ---------- exit / banking on close ----------
    function bankExit() {
      if (over) return;                 // game-over already banked
      if (score <= 0) return;           // an untouched game banks nothing
      endRunStats();
      var b = bankRun(false);
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🪩 Pinball banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("keydown", kd);
      document.removeEventListener("keyup", ku);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._pinball = {
      state: function () {
        return {
          score: score, ball: ball, ballsLeft: Math.max(0, 3 - ball),
          letters: litLetters(), multiball: multiball, ballSaver: ballSaverOn(),
          revived: revived, over: over, banked: banked, best: stats.bestScore || 0,
          balls: balls.map(function (b) { return { x: b.x, y: b.y, vx: b.vx, vy: b.vy }; })
        };
      },
      begin: begin,
      flip: flip,
      launch: launch,
      placeBall: placeBall,
      hitTargets: hitTargets,
      lightWord: lightWord,
      drain: function () { if (balls.length) drainBall(0, true); else loseBallGroup(true); },
      tick: function (seconds) {
        var left = seconds, dtc = 0.05;
        while (left > 0.0001 && !over) { var d = Math.min(dtc, left); if (!paused) step(d); left -= d; }
      }
    };

    // ---------- boot ----------
    begin();
    if (global._pinballdemo) { // screenshot seed: mid-play, two letters lit, big score
      global._pinballdemo = 0;
      score = 18450; lastMilestone = 0; lit.W = true; lit.O = true;
      banks[0].cleared = true; banks[1].cleared = true;
      balls = [{ x: 240, y: 360, vx: 120, vy: -60, parked: false, age: 3, captured: false, capT: 0 }];
      paused = true; updateHud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxPinball = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
