/*
 * Voblox arcade game — 🧱 BRICK BLITZ (a juicy Breakout/Arkanoid-lite).
 * Drag the paddle at the bottom; the ball bounces and shatters bricks. The
 * angle off the paddle depends on WHERE the ball lands, so aiming is a skill.
 * 12 hand-authored levels (walls, heart, smiley, invader, castle, diamond,
 * checker, pyramid, fortress, waves, skull, boss) escalate with 2-3 hit strong
 * bricks, unbreakable STEEL, and moving brick rows in the later levels.
 * Bricks drop catchable power-ups: 🔱 multi-ball, 📏 wide paddle, 🧲 magnet,
 * 🔥 fireball, 🐢 slow-mo — plus one clearly-marked 💀 shrink to dodge.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 💥 BLASTER: breaking bricks charges a meter; full = answer a WORD, and a
 *     correct answer fires a laser volley that clears a whole column.
 *   - 🔑 LEVEL KEYS: levels 5+ start locked — answer a word at the door to enter
 *     (persisted once each, so Leo never re-earns a door he already opened).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("brick")
 * per run, banked on game-over, all-12-clear, quit AND app-close. Stats persist
 * additively: bestLevel (highest unlocked), bestScore, keys (unlocked doors).
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // catchable power-ups. good ones help; 💀 is the only one that hurts.
  var POWERS = {
    multi:  { e: "🔱", good: true },
    wide:   { e: "📏", good: true },
    magnet: { e: "🧲", good: true },
    fire:   { e: "🔥", good: true },
    slow:   { e: "🐢", good: true },
    anti:   { e: "💀", good: false }
  };
  var GOOD = ["multi", "wide", "magnet", "fire", "slow"];

  // 12 hand-authored levels. legend: x=1hit  o=2hit  O=3hit  S=steel(unbreakable)
  //   P=guaranteed power-up brick  .=empty. Rows are padded to the widest line.
  var LEVELS = [
    { name: "First Wall", rows: ["xxxxxxxxxxxxx", "xxxxxxxxxxxxx", "xxxxxxxxxxxxx"] },
    { name: "Sweetheart", rows: [
      ".xxx...xxx...", "xxxxx.xxxxx..", "xxxxxxxxxxxxx", "xxxxxxxxxxxxx",
      ".xxxxxxxxxxx.", "..xxxxxxxxx..", "...xxxxxxx...", "....xxxxx....", ".....xxx....."] },
    { name: "Smiley", rows: [
      "...xxxxxxx...", ".xxxxxxxxxxx.", "xxxxxxxxxxxxx", "xx.xxxxx.xxxx",
      "xxxxxxxxxxxxx", "x.xxxxxxxxx.x", "xx.xxxxxxx.xx", ".xxx.....xxx.", "...xxxxxxx..."] },
    { name: "Invader", rows: [
      "..x.......x..", "...x.....x...", "..xxxxxxxxx..", ".xx.xxxxx.xx.",
      "xxxxxxxxxxxxx", "x.xxxxxxxxx.x", "x.x.......x.x", "...xx...xx..."] },
    { name: "Castle", rows: [
      "x.x.x.x.x.x.x", "xxxxxxxxxxxxx", "xoooooooooooo", "xoSSSSSSSSSox",
      "xoS.......Sox", "xoSSSSSSSSSox"] },
    { name: "Diamond", rows: [
      "......O......", ".....OoO.....", "....OoxoO....", "...OoxxxoO...",
      "..OoxxxxxoO..", "...OoxxxoO...", "....OoxoO....", ".....OoO.....", "......O......"] },
    { name: "Checkerboard", rows: [
      "SxSxSxSxSxSxS", "xoxoxoxoxoxox", "SxSxSxSxSxSxS", "xoxoxoxoxoxox", "SxSxSxSxSxSxS"] },
    { name: "Pyramid", rows: [
      "......O......", ".....OOO.....", "....OoooO....", "...OooxooO...",
      "..OooxxxooO..", ".OooxxxxxooO.", "OooxxxxxxxooO"] },
    { name: "Fortress", move: true, rows: [
      "SxxxxxxxxxxS", "SooooooooooS", "Sx.x.x.x.x.S", "SooooooooooS", "SxxxxxxxxxxS"] },
    { name: "Waves", move: true, rows: [
      "x.x.x.x.x.x.x", ".o.o.o.o.o.o.", "x.x.x.x.x.x.x", ".o.o.o.o.o.o.",
      "x.x.x.x.x.x.x", ".o.o.o.o.o.o."] },
    { name: "Skull", move: true, rows: [
      ".SSSSSSSSS.", "SoooooooooS", "So.ooooo.oS", "SoooooooooS",
      "Soo.ooo.ooS", "SoooooooooS", ".Soo.o.ooS.", ".S.o.o.o.S."] },
    { name: "Boss Wall", move: true, rows: [
      "OOOOOOOOOOOOO", "OoooooooooooO", "OoSSSSSSSSSoO", "OoooooooooooO",
      "OoSSSSSSSSSoO", "OOOOOOOOOOOOO"] }
  ];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("brick");
    // additive, never-renamed save fields
    stats.bestLevel = stats.bestLevel || 1;   // highest level ever unlocked/reached
    stats.bestScore = stats.bestScore || 0;
    stats.keys = stats.keys || {};            // { level: 1 } once a word-door is opened

    var wrap = document.createElement("div");
    wrap.className = "gamewrap brick";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="bbcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="bbmsg">🧱 Brick Blitz</div>' +
      '<div class="grow"><span id="bbscore">🎯 0</span><span id="bblives">❤️❤️❤️</span>' +
      '<span id="bblevel">Lv 1</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="bbbig"></div>' +
      '<button id="bbfire" type="button" style="display:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 92px);' +
      'transform:translateX(-50%);z-index:8;background:linear-gradient(#ff8a5b,#ff5b6e);color:#fff;' +
      'border:none;border-radius:16px;padding:12px 20px;font-family:inherit;font-weight:900;font-size:17px;' +
      'box-shadow:0 6px 0 #b93a49,0 10px 24px #0006;cursor:pointer">💥 BLASTER — answer a word!</button>' +
      '<div id="bbsafe" style="position:absolute;left:0;bottom:calc(env(safe-area-inset-bottom, 0px) + 20px);width:0;height:0;pointer-events:none"></div>' +
      '<div class="gover" id="bbq" style="display:none"></div>' +
      '<div class="gover" id="bbcard" style="display:none"></div>';
    document.body.appendChild(wrap);
    // compact HUD row so a long level name (e.g. "Lv 7 · Checkerboard") wraps
    // instead of shoving the Leave button off the right edge of a phone screen
    (function () {
      var st = document.createElement("style");
      st.textContent =
        ".gamewrap.brick .ghud .grow{flex-wrap:wrap;gap:6px;padding:0 4px}" +
        ".gamewrap.brick .ghud .grow span{font-size:14px;padding:3px 8px;white-space:nowrap;border-width:2px;border-bottom-width:3px}" +
        ".gamewrap.brick .ghud .grow .bossquit{white-space:nowrap}";
      wrap.appendChild(st);
    })();

    var cv = wrap.querySelector("#bbcv"), ctx = cv.getContext("2d");
    var bbq = document.getElementById("bbq"), bbcard = document.getElementById("bbcard");
    var bbmsg = document.getElementById("bbmsg"), bbbig = document.getElementById("bbbig");
    var bbfire = document.getElementById("bbfire");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- responsive metrics ----------
    var W, H, gridX0, gridY0, brickW, brickH, radius, paddleY, paddleBaseW, paddleH, safeB = 0;
    var bbsafe = document.getElementById("bbsafe");
    var maxShift, fieldSpeed, speedBase;
    var curDef = null, curCols = 0, curRows = 0, curMove = false;
    function computeMetrics() {
      var side = W * 0.05;
      brickW = (W - 2 * side) / (curCols || 13);
      brickH = Math.max(9, Math.min(H * 0.03, brickW * 0.55));
      gridX0 = side; gridY0 = H * 0.10;
      radius = Math.max(4, Math.min(W, H) * 0.013);
      paddleY = H - safeB - Math.max(26, H * 0.06);
      paddleBaseW = Math.max(60, W * 0.16);
      paddleH = Math.max(9, H * 0.016);
      maxShift = brickW * 0.9; fieldSpeed = brickW * 0.6;
      speedBase = Math.max(280, H * 0.62);
    }
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      // home-indicator inset, probed off an env()-based element (20px base)
      try { safeB = Math.max(0, (parseFloat(getComputedStyle(bbsafe).bottom) || 20) - 20); } catch (_) { safeB = 0; }
      computeMetrics();
      if (paddleX !== undefined) paddleX = clampPaddle(paddleX);
    }

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var level = 1, lives = 3, score = 0, charge = 0, run = 0, bricksBroken = 0;
    var over = false, paused = false, banked = false, needClear = false;
    var bricks = [], balls = [], powerups = [], fieldShift = 0, fieldDir = 1;
    var active = { wide: 0, magnet: 0, slow: 0, anti: 0 };
    var paddleX, pointerDown = false, leftDown = false, rightDown = false, lastFmt = null;

    resize();

    function clampPaddle(x) { var hw = paddleW() / 2; return Math.max(hw, Math.min(W - hw, x)); }
    function paddleW() { var w = paddleBaseW; if (active.wide > 0) w *= 1.7; if (active.anti > 0) w *= 0.6; return Math.max(40, w); }
    function brickX(br) { return gridX0 + br.c * brickW + (curMove ? fieldShift : 0); }
    function countBreakable() { var n = 0; for (var i = 0; i < bricks.length; i++) if (bricks[i].alive && !bricks[i].steel) n++; return n; }

    function big(m, col) { bbbig.textContent = m; bbbig.style.color = col || "#fff"; bbbig.style.opacity = "1"; setTimeout(function () { bbbig.style.opacity = "0"; }, 1100); }
    function updateHud() {
      document.getElementById("bbscore").textContent = "🎯 " + score;
      var hs = ""; for (var i = 0; i < 3; i++) hs += i < lives ? "❤️" : "🖤";
      document.getElementById("bblives").textContent = hs;
      document.getElementById("bblevel").textContent = "Lv " + level + (curDef ? " · " + curDef.name : "");
      if (charge >= 1 && !over) bbfire.style.display = "block"; else if (charge < 1) bbfire.style.display = "none";
    }

    // ---------- level build / flow ----------
    function buildLevel(n) {
      var def = LEVELS[n - 1]; curDef = def; curMove = !!def.move;
      var rows = def.rows, w = 0, i;
      for (i = 0; i < rows.length; i++) if (rows[i].length > w) w = rows[i].length;
      curCols = w; curRows = rows.length;
      computeMetrics();
      bricks = [];
      for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < w; c++) {
          var ch = rows[r].charAt(c) || ".";
          if (ch === "." || ch === " ") continue;
          var b = { r: r, c: c, steel: false, hp: 1, max: 1, pu: null, alive: true };
          if (ch === "S") { b.steel = true; b.hp = Infinity; b.max = Infinity; }
          else if (ch === "o") { b.hp = 2; b.max = 2; }
          else if (ch === "O") { b.hp = 3; b.max = 3; }
          else if (ch === "P") { b.pu = GOOD[Math.floor(Math.random() * GOOD.length)]; }
          if (!b.steel && !b.pu) {
            var rr = Math.random();
            if (rr < 0.02) b.pu = "anti"; else if (rr < 0.14) b.pu = GOOD[Math.floor(Math.random() * GOOD.length)];
          }
          bricks.push(b);
        }
      }
    }
    function enterLevel(n) {
      level = n;
      if (n > (stats.bestLevel || 1)) { stats.bestLevel = n; store.save(); }
      buildLevel(n);
      active = { wide: 0, magnet: 0, slow: 0, anti: 0 };
      powerups = []; balls = []; fieldShift = 0; fieldDir = 1;
      paddleX = W / 2; spawnBall();
      paused = false; needClear = false;
      bbmsg.textContent = "🧱 Level " + n + " — " + LEVELS[n - 1].name;
      updateHud();
    }
    function openLevel(n) { if (n >= 5 && !stats.keys[n]) doorQuiz(n); else enterLevel(n); }
    function startRun(n) {
      n = n || 1; lives = 3; score = 0; charge = 0; bricksBroken = 0;
      over = false; banked = false; run = 0;
      bbcard.style.display = "none"; bbq.style.display = "none";
      enterLevel(n);
      big("🧱 BRICK BLITZ!", "#8ecdf7");
    }
    function levelCleared() {
      if (level >= LEVELS.length) { winRun(); return; }
      big("🧱 Level " + level + " cleared!", "#69f0ae");
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) juice.shake(6);
      openLevel(level + 1);
    }
    function checkClear() { needClear = false; if (countBreakable() === 0) levelCleared(); }

    // ---------- balls & bricks ----------
    function spawnBall() {
      var a = (Math.random() - 0.5) * 0.6;
      balls.push({ x: paddleX, y: paddleY - radius - 2, vx: speedBase * Math.sin(a), vy: -speedBase * Math.cos(a), stuck: active.magnet > 0, fire: 0 });
    }
    function addClone(b) {
      if (balls.length >= 6) return;
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || speedBase, a = (Math.random() - 0.5) * 1.2;
      balls.push({ x: b.x, y: b.y, vx: sp * Math.sin(a), vy: -Math.abs(sp * Math.cos(a)), stuck: false, fire: b.fire });
    }
    function launchStuck() {
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        if (b.stuck) { b.stuck = false; var a = (Math.random() - 0.5) * 0.5; b.vx = speedBase * Math.sin(a); b.vy = -speedBase * Math.cos(a); }
      }
    }
    function destroyBrick(br) {
      br.alive = false; bricksBroken++; score += 10;
      charge = Math.min(1, charge + 0.07);
      var cx = brickX(br) + brickW / 2, cy = gridY0 + br.r * brickH + brickH / 2;
      if (br.pu) spawnPowerup(br.pu, cx, cy);
      if (juice) juice.burst(cx, cy, "#ffd23f", 8);
      if (sfx && sfx.pop && Math.random() < 0.5) sfx.pop();
      needClear = true;
    }
    function hitBricks(b) {
      for (var i = 0; i < bricks.length; i++) {
        var br = bricks[i]; if (!br.alive) continue;
        var rx = brickX(br), ry = gridY0 + br.r * brickH, rw = brickW - 2, rh = brickH - 2;
        var cx = b.x < rx ? rx : (b.x > rx + rw ? rx + rw : b.x);
        var cy = b.y < ry ? ry : (b.y > ry + rh ? ry + rh : b.y);
        var dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy > radius * radius) continue;
        if (b.fire > 0 && !br.steel) { destroyBrick(br); b.fire--; return; } // fireball pierces
        var ox = b.x - (rx + rw / 2), oy = b.y - (ry + rh / 2);
        if (Math.abs(ox) / rw > Math.abs(oy) / rh) b.vx = ox > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
        else b.vy = oy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
        if (!br.steel) { if (br.hp > 1) { br.hp--; if (juice) juice.shake(2); } else destroyBrick(br); }
        return; // one brick per substep — substepping keeps it tunnel-free
      }
    }
    function advanceBalls(h) {
      for (var i = balls.length - 1; i >= 0; i--) {
        var b = balls[i];
        if (b.stuck) { b.x = paddleX; b.y = paddleY - radius - 2; continue; }
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < radius) { b.x = radius; b.vx = Math.abs(b.vx); }
        else if (b.x > W - radius) { b.x = W - radius; b.vx = -Math.abs(b.vx); }
        if (b.y < radius) { b.y = radius; b.vy = Math.abs(b.vy); }
        hitBricks(b);
        if (b.vy > 0 && b.y + radius >= paddleY && b.y - radius <= paddleY + paddleH && Math.abs(b.x - paddleX) <= paddleW() / 2 + radius) {
          b.y = paddleY - radius;
          var hit = (b.x - paddleX) / (paddleW() / 2); if (hit > 1) hit = 1; if (hit < -1) hit = -1;
          var sp = Math.max(speedBase * 0.85, Math.sqrt(b.vx * b.vx + b.vy * b.vy));
          var ang = hit * 1.05; b.vx = sp * Math.sin(ang); b.vy = -Math.abs(sp * Math.cos(ang));
          if (active.magnet > 0) b.stuck = true;
          if (sfx && sfx.pop) sfx.pop();
        }
        if (b.y - radius > H) balls.splice(i, 1);
      }
      if (balls.length === 0 && !over) loseBall();
    }
    function loseBall() {
      lives--; updateHud();
      if (lives <= 0) { gameOver(); return; }
      big("💔 Ball lost — " + lives + " left", "#ff8a8a");
      if (sfx && sfx.buzz) sfx.buzz();
      balls = []; spawnBall();
    }

    // ---------- power-ups ----------
    function spawnPowerup(id, x, y) { powerups.push({ id: id, x: x, y: y, vy: Math.max(120, H * 0.3) }); }
    function updatePowerups(dt) {
      for (var i = powerups.length - 1; i >= 0; i--) {
        var p = powerups[i]; p.y += p.vy * dt;
        if (p.y >= paddleY - radius && p.y <= paddleY + paddleH + 18 && Math.abs(p.x - paddleX) <= paddleW() / 2 + 10) { applyPower(p.id); powerups.splice(i, 1); }
        else if (p.y > H + 30) powerups.splice(i, 1);
      }
    }
    function applyPower(id) {
      if (id === "multi") { var cur = balls.slice(); for (var i = 0; i < cur.length && balls.length < 6; i++) { addClone(cur[i]); addClone(cur[i]); } big("🔱 MULTIBALL!", "#40c4ff"); }
      else if (id === "wide") { active.wide = 12; big("📏 WIDE PADDLE!", "#69f0ae"); }
      else if (id === "magnet") { active.magnet = 12; big("🧲 MAGNET — tap to re-aim!", "#c9b6ff"); }
      else if (id === "fire") { for (var f = 0; f < balls.length; f++) balls[f].fire = 6; big("🔥 FIREBALL — pierces 6!", "#ff9f43"); }
      else if (id === "slow") { active.slow = 8; big("🐢 SLOW-MO!", "#8ecdf7"); }
      else if (id === "anti") { active.anti = 8; big("💀 SHRINK! (dodge these)", "#ff6b6b"); }
      if (sfx) { if (id === "anti" && sfx.buzz) sfx.buzz(); else if (sfx.coin) sfx.coin(); }
      if (juice) juice.burst(paddleX, paddleY, id === "anti" ? "#ff6b6b" : "#ffd23f", 14);
      updateHud();
    }
    function decayPowers(dt) {
      var wasMag = active.magnet > 0;
      if (active.wide > 0) active.wide = Math.max(0, active.wide - dt);
      if (active.magnet > 0) active.magnet = Math.max(0, active.magnet - dt);
      if (active.slow > 0) active.slow = Math.max(0, active.slow - dt);
      if (active.anti > 0) active.anti = Math.max(0, active.anti - dt);
      if (wasMag && active.magnet <= 0) launchStuck();
    }
    function activePowers() {
      var p = [];
      if (active.wide > 0) p.push("wide");
      if (active.magnet > 0) p.push("magnet");
      if (active.slow > 0) p.push("slow");
      if (active.anti > 0) p.push("anti");
      for (var i = 0; i < balls.length; i++) if (balls[i].fire > 0) { p.push("fire"); break; }
      return p;
    }

    // ---------- word hooks ----------
    function showBlasterBtn() { if (charge >= 1 && !over && !paused) bbfire.style.display = "block"; }
    function blasterQuiz() {
      if (over) return;
      paused = true; bbfire.style.display = "none";
      cv._lastQ = VQ.miniQuiz(bbq, words, store, {
        title: "💥 BLASTER CHARGED! Answer to fire the laser!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) { fireLaser(); big("💥 LASER VOLLEY!", "#ffd23f"); }
          else big("The blaster fizzled…", "#ff8a8a");
          charge = 0; // spend the meter AFTER the laser (its own hits would refill it)
          updateHud();
        }
      });
    }
    function fireLaser() {
      function colCount(cc) { var n = 0; for (var i = 0; i < bricks.length; i++) { var br = bricks[i]; if (br.alive && !br.steel && br.c === cc) n++; } return n; }
      var col = Math.round((paddleX - gridX0 - (curMove ? fieldShift : 0)) / brickW);
      if (col < 0 || col >= curCols || colCount(col) === 0) { var best = 0, bn = -1; for (var cc = 0; cc < curCols; cc++) { var n = colCount(cc); if (n > bn) { bn = n; best = cc; } } col = best; }
      var hit = 0;
      for (var i = 0; i < bricks.length; i++) { var br = bricks[i]; if (br.alive && !br.steel && br.c === col) { destroyBrick(br); hit++; } }
      score += hit * 5;
      if (juice) { juice.shake(7); juice.burst(paddleX, paddleY, "#ffd23f", 20); }
      if (sfx && sfx.fanfare) sfx.fanfare();
      checkClear();
    }
    function doorQuiz(n) {
      paused = true;
      cv._lastQ = VQ.miniQuiz(bbq, words, store, {
        title: "🔑 Level " + n + " is locked — answer to open the door!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) { stats.keys[n] = 1; store.save(); big("🔑 DOOR UNLOCKED!", "#69f0ae"); if (sfx && sfx.fanfare) sfx.fanfare(); enterLevel(n); }
          else { big("The door stays locked — try again!", "#ff8a8a"); doorQuiz(n); }
        }
      });
    }

    // ---------- banking / end ----------
    function rewards(won) {
      return {
        win: !!won, score: score,
        rankPtsDelta: won ? Math.min(12, 3 + level * 2) : Math.min(6, 1 + Math.floor(score / 120)),
        xp: Math.min(90, 8 + Math.floor(score / 10) + (won ? level * 4 : 0)),
        gems: 3 + Math.floor(score / 25) + (won ? level * 3 : 0)
      };
    }
    // the ONE bank path — computed once, guarded, recorded to the store engine
    function bank(won) {
      if (banked) return null;
      banked = true;
      var rw = rewards(won);
      var res = store.recordGame ? store.recordGame("brick", rw) : null;
      return { rw: rw, res: res };
    }
    function persistBest() { if (score > (stats.bestScore || 0)) { stats.bestScore = score; store.save(); } }
    function gameOver() {
      if (over) return; over = true; paused = true;
      persistBest();
      var b = bank(false);
      if (juice) juice.shake(10);
      if (sfx && sfx.buzz) sfx.buzz();
      showCard(false, b ? b.rw : rewards(false));
    }
    function winRun() {
      if (over) return; over = true; paused = true;
      persistBest();
      var b = bank(true);
      showCard(true, b ? b.rw : rewards(true));
    }
    function showCard(won, rw) {
      bbcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (won ? "🏆" : "🧱") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (won ? "YOU CLEARED ALL 12 LEVELS!" : "Game over!") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🧱 Level <b>' + level + '</b> · 🎯 Score <b>' + score + '</b> · 🏆 Best <b>' + (stats.bestScore || 0) + '</b></div>' +
        '<button class="submit big-next" id="bbreplay" type="button">Play again ➜</button>' +
        '<button class="wqskip" id="bbleave" type="button">Leave</button></div>';
      bbcard.style.display = "flex";
      if (won && sfx && sfx.fanfare) sfx.fanfare();
      document.getElementById("bbreplay").onclick = function () { bbcard.style.display = "none"; startRun(1); };
      document.getElementById("bbleave").onclick = exit;
    }

    // ---------- input ----------
    function pointerX(clientX) { var r = cv.getBoundingClientRect(); return clientX - r.left; }
    function onDown(x) { if (over || paused) return; paddleX = clampPaddle(x); launchStuck(); }
    function onMove(x) { if (over || paused) return; paddleX = clampPaddle(x); }
    cv.addEventListener("mousedown", function (e) { pointerDown = true; onDown(pointerX(e.clientX)); });
    cv.addEventListener("mousemove", function (e) { if (pointerDown) onMove(pointerX(e.clientX)); });
    cv.addEventListener("mouseup", function () { pointerDown = false; });
    cv.addEventListener("mouseleave", function () { pointerDown = false; });
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); onDown(pointerX(e.changedTouches[0].clientX)); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); onMove(pointerX(e.changedTouches[0].clientX)); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); }, { passive: false });
    function onKey(e) { if (e.key === "ArrowLeft") leftDown = true; else if (e.key === "ArrowRight") rightDown = true; else if (e.key === " " || e.key === "ArrowUp") launchStuck(); }
    function onKeyUp(e) { if (e.key === "ArrowLeft") leftDown = false; else if (e.key === "ArrowRight") rightDown = false; }
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    function movePaddleKeys(dt) { var v = W * 0.9; if (leftDown) paddleX = clampPaddle(paddleX - v * dt); if (rightDown) paddleX = clampPaddle(paddleX + v * dt); }
    bbfire.onclick = blasterQuiz;

    // ---------- simulation ----------
    function step(dt) {
      run += dt;
      decayPowers(dt);
      if (curMove) { fieldShift += fieldDir * fieldSpeed * dt; if (fieldShift > maxShift) { fieldShift = maxShift; fieldDir = -1; } else if (fieldShift < -maxShift) { fieldShift = -maxShift; fieldDir = 1; } }
      movePaddleKeys(dt);
      updatePowerups(dt);
      // ball physics substepped so it never tunnels a brick at high speed
      var ts = active.slow > 0 ? 0.55 : 1, bdt = dt * ts;
      var sp = speedBase; for (var i = 0; i < balls.length; i++) { var m = Math.sqrt(balls[i].vx * balls[i].vx + balls[i].vy * balls[i].vy); if (m > sp) sp = m; }
      var steps = Math.ceil(sp * bdt / (radius * 0.8)); if (steps < 1) steps = 1; if (steps > 80) steps = 80;
      var h = bdt / steps;
      for (var s = 0; s < steps && !over; s++) advanceBalls(h);
      if (needClear) checkClear();
      showBlasterBtn();
      updateHud();
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function brickColor(br) {
      if (br.steel) return "#90a4ae";
      if (br.max >= 3) return br.hp >= 3 ? "#ef5350" : br.hp === 2 ? "#ff8a65" : "#ffab91";
      if (br.max === 2) return br.hp >= 2 ? "#ffca28" : "#ffe082";
      return "#4fc3f7";
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1b2740"); g.addColorStop(1, "#0a0f1c");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // bricks
      for (var i = 0; i < bricks.length; i++) {
        var br = bricks[i]; if (!br.alive) continue;
        var x = brickX(br), y = gridY0 + br.r * brickH;
        ctx.fillStyle = brickColor(br);
        rrect(x + 1, y + 1, brickW - 3, brickH - 3, 3); ctx.fill();
        if (br.steel) { ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 1; ctx.stroke(); }
        else if (br.pu) { ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(x + brickW / 2, y + brickH / 2, Math.max(2, brickH * 0.16), 0, Math.PI * 2); ctx.fill(); }
      }
      // paddle
      var pw = paddleW();
      ctx.fillStyle = active.anti > 0 ? "#ff6b6b" : (active.wide > 0 ? "#69f0ae" : "#e0e6ef");
      rrect(paddleX - pw / 2, paddleY, pw, paddleH, paddleH / 2); ctx.fill();
      // power-ups (emoji, skull clearly marked)
      for (i = 0; i < powerups.length; i++) {
        var p = powerups[i], sz = Math.max(16, radius * 2.4);
        ctx.font = Math.round(sz) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(POWERS[p.id].e, p.x, p.y);
      }
      // balls
      for (i = 0; i < balls.length; i++) {
        var b = balls[i];
        ctx.fillStyle = b.fire > 0 ? "#ff9f43" : "#ffffff";
        ctx.beginPath(); ctx.arc(b.x, b.y, radius, 0, Math.PI * 2); ctx.fill();
        if (b.fire > 0) { ctx.strokeStyle = "rgba(255,120,40,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, radius * 1.5, 0, Math.PI * 2); ctx.stroke(); }
      }
      // charge meter — a fat gold bar hugging the bottom (above the home indicator)
      var bw = Math.min(320, W * 0.6), bx = (W - bw) / 2, by = H - safeB - 14;
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(bx, by, bw, 8);
      ctx.fillStyle = charge >= 1 ? "#ff5b6e" : "#ffd23f"; ctx.fillRect(bx, by, bw * charge, 8);
      ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = "bold 10px Trebuchet MS"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("💥 BLASTER", W / 2, by - 3);
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

    // ---------- exit / banking (mid-run quits AND app-close both bank) ----------
    function bankExit() {
      if (over) return; // game-over / win already banked
      if (score <= 0 && bricksBroken === 0) return; // an untouched run banks nothing
      persistBest();
      var b = bank(false);
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🧱 Brick run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("resize", resize);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKeyUp);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._brick = {
      state: function () {
        return {
          level: level, lives: lives, score: score, bricks: countBreakable(),
          balls: balls.length, charge: charge, powers: activePowers(),
          over: over, banked: banked, best: stats.bestScore || 0,
          bestLevel: stats.bestLevel || 1, keys: stats.keys
        };
      },
      begin: function (n) { startRun(n || 1); },
      paddleTo: function (x) { paddleX = clampPaddle(x); },
      ballAt: function (x, y, vx, vy) { if (!balls.length) spawnBall(); var b = balls[0]; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.stuck = false; return b; },
      breakAll: function (leave) {
        leave = leave || 0; var live = [], i;
        for (i = 0; i < bricks.length; i++) if (bricks[i].alive && !bricks[i].steel) live.push(bricks[i]);
        for (i = leave; i < live.length; i++) { live[i].alive = false; bricksBroken++; score += 5; }
        checkClear();
      },
      drop: function (id) { spawnPowerup(POWERS[id] ? id : "wide", paddleX, paddleY - Math.max(50, H * 0.18)); },
      blasterQuiz: blasterQuiz,
      keyQuiz: function (n) { doorQuiz(n); },
      lose: function () { balls = []; if (!over) loseBall(); },
      tick: function (seconds) { var left = seconds; while (left > 0) { var d = Math.min(0.05, left); if (!paused && !over) step(d); left -= d; } }
    };

    // ---------- boot ----------
    startRun(1);
    if (global._brickdemo) setTimeout(function () { // screenshot seed: a lively mid-level-3 board
      global._brickdemo = 0;
      startRun(3);
      var live = [], i; for (i = 0; i < bricks.length; i++) if (bricks[i].alive && !bricks[i].steel) live.push(bricks[i]);
      for (i = Math.floor(live.length / 2); i < live.length; i++) live[i].alive = false; // half-broken smiley
      spawnBall(); // a second ball
      spawnPowerup("wide", paddleX + 30, paddleY - H * 0.3); // a power-up falling
      charge = 0.7; paused = true; updateHud();
    }, 700);
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxBrick = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
