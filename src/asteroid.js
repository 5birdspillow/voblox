/*
 * Voblox arcade game — 🛸 ASTEROID ACE (a modernized Asteroids).
 * You DRIFT through inertial space: rotate, thrust, and coast — the ship keeps
 * its momentum and WRAPS around every edge. It AUTO-FIRES forward so kids never
 * fight a fire button; steering is the whole game.
 *   TOUCH: hold ANYWHERE — the ship swings its nose toward your finger and
 *          thrusts; release to drift. Double-tap = 🌀 hyperspace jump (if banked).
 *   DESKTOP: ◀ ▶ rotate, ▲ thrust, SPACE fires an extra bolt.
 * Big rocks split into 2 mediums, mediums into 2 smalls, smalls vaporize. Clear
 * the field to advance the wave (more rocks, more speed). 3 lives; a kind respawn
 * drops you into the SAFEST open spot with a 2s shield — never on top of a rock.
 * 👾 UFOs cross and take dodgeable potshots. Rocks drop 💎 crystals (the score
 * juice) and sometimes a pickup: 🔱 triple-shot, 🛡 shield, 🧲 crystal magnet.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🌀 HYPERSPACE: answer a word (miniQuiz) to BANK a jump (max 2). Spend one
 *     to teleport out of danger in a flash of warp light.
 *   - 💫 LAST STAND: lose your final life and a word can revive you — once.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("asteroid")
 * per run, banked on run-over, quit, AND app-close. Stats persist additively.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var SHIP_R = 15, ROT = 3.7;           // ship radius, turn rate (rad/s)
  var THRUST = 340, DRAG = 0.34, MAXV = 360;
  var BULLET_SPD = 560, BULLET_LIFE = 1.05, FIRE_CD = 0.3;
  var HFIX = 1 / 120;                    // fixed physics step — small enough a bolt never skips a small rock
  // rock table: radius, what it splits into, and its base score
  var ROCK = {
    big: { r: 42, split: "med", score: 20, drops: 2 },
    med: { r: 26, split: "small", score: 30, drops: 2 },
    small: { r: 15, split: null, score: 50, drops: 3 }
  };
  var PICKS = ["triple", "shield", "magnet"];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("asteroid");
    // additive, never-renamed save fields
    stats.bestWaveA = stats.bestWaveA || 0;
    stats.bestScoreA = stats.bestScoreA || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap asteroid";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="ascv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="asmsg">🛸 Asteroid Ace — hold to steer!</div>' +
      '<div class="grow"><span id="asscore">💎 0</span><span id="aslives">🚀🚀🚀</span>' +
      '<span id="aswave">Wave 1</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="asbig"></div>' +
      '<button id="ashyp" type="button" style="position:absolute;right:14px;bottom:calc(env(safe-area-inset-bottom) + 24px);' +
      'z-index:8;background:linear-gradient(#b06aff,#7a3fd0);color:#fff;border:none;border-radius:16px;padding:12px 18px;' +
      'font-family:inherit;font-weight:900;font-size:16px;box-shadow:0 5px 0 #4f2a8a,0 10px 22px #0007;cursor:pointer">🌀 Jump</button>' +
      '<div class="gover" id="asq" style="display:none"></div>' +
      '<div class="gover" id="ascard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#ascv"), ctx = cv.getContext("2d");
    var asq = document.getElementById("asq"), ascard = document.getElementById("ascard");
    var msgEl = document.getElementById("asmsg"), bigEl = document.getElementById("asbig");
    var hypBtn = document.getElementById("ashyp");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var rocks = [], bullets = [], crystals = [], pickups = [], ufos = [], ufoShots = [];
    var ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, ang: -Math.PI / 2 };
    var score = 0, lives = 3, wave = 1, runT = 0;
    var shieldT = 0, guard = false, triple = 0, magnetT = 0, hyper = 0;
    var fireCd = 0, combo = 0, comboT = 0;
    var over = false, paused = false, banked = false, statsSaved = false, reviveUsed = false;
    var started = false, clearing = false, clearT = 0, ufoT = 9, starT = 0;
    var thrusting = false, lastTap = 0, lastFmt = null;
    var keys = { left: false, right: false, up: false };
    var touchActive = false, touchX = 0, touchY = 0;
    var stars = [];
    for (var si = 0; si < 60; si++) stars.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() });

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1100);
    }
    function updateHud() {
      document.getElementById("asscore").textContent = "💎 " + score;
      var ls = ""; for (var i = 0; i < 3; i++) ls += i < lives ? "🚀" : "▪️";
      document.getElementById("aslives").textContent = ls;
      document.getElementById("aswave").textContent = "Wave " + wave;
      hypBtn.textContent = hyper > 0 ? "🌀 Jump ×" + hyper : "🌀 Learn Jump";
      hypBtn.style.opacity = (over || paused) ? "0.5" : "1";
    }

    // ---------- run lifecycle ----------
    function begin() {
      rocks = []; bullets = []; crystals = []; pickups = []; ufos = []; ufoShots = [];
      ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, ang: -Math.PI / 2 };
      score = 0; lives = 3; wave = 1; runT = 0;
      shieldT = 2; guard = false; triple = 0; magnetT = 0; hyper = 0;
      fireCd = 0; combo = 0; comboT = 0;
      over = false; paused = false; banked = false; statsSaved = false; reviveUsed = false;
      started = true; clearing = false; clearT = 0; ufoT = 9;
      ascard.style.display = "none"; asq.style.display = "none";
      spawnWave(1);
      updateHud();
      big("🛸 WAVE 1 — blast the rocks!", "#8ecdf7");
    }

    function rewards() {
      return {
        win: wave >= 6, score: score,
        rankPtsDelta: Math.min(12, 2 + wave * 2),
        xp: Math.min(80, 6 + wave * 3 + Math.floor(score / 14)),
        gems: Math.min(100, 5 + Math.floor(score / 40)) // score-based, capped at 100
      };
    }
    // the ONE bank path — computed once, guarded, recorded to the store engine
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = rewards();
      var res = store.recordGame ? store.recordGame("asteroid", rw) : null;
      return { rw: rw, res: res };
    }
    // additive persistence — best wave + best score, once per run
    function endRunStats() {
      if (statsSaved) return; statsSaved = true;
      if (wave > (stats.bestWaveA || 0)) stats.bestWaveA = wave;
      if (score > (stats.bestScoreA || 0)) stats.bestScoreA = score;
      if (store.save) store.save();
    }

    function runOver() {
      if (over) return;
      over = true; paused = true;
      endRunStats();
      var b = bankRun();
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(12);
      showEnd(b ? b.rw : rewards());
    }
    function showEnd(rw) {
      ascard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (rw.win ? "🏆" : "🛸") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (rw.win ? "Deep-space ACE!" : "Run over!") + '</div>' +
        '<div style="margin:4px 0;font-size:15px">🌊 Wave <b>' + wave + '</b> · 💎 Score <b>' + score + '</b></div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:4px">🏆 Best: wave ' + (stats.bestWaveA || 0) + ' · ' + (stats.bestScoreA || 0) + ' score</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<button class="submit big-next" id="asreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="asleave" type="button">Leave</button></div>';
      ascard.style.display = "flex";
      if (rw && sfx && sfx.fanfare && (rw.win || score >= (stats.bestScoreA || 0))) sfx.fanfare();
      updateHud();
      document.getElementById("asreplay").onclick = function () { ascard.style.display = "none"; begin(); };
      document.getElementById("asleave").onclick = exit;
    }

    // ---------- waves ----------
    function spawnWave(n) {
      var count = 3 + n; // more rocks each wave
      for (var i = 0; i < count; i++) {
        // spawn on an edge, away from the ship, drifting inward
        var edge = Math.floor(Math.random() * 4), x, y;
        if (edge === 0) { x = Math.random() * W; y = -30; }
        else if (edge === 1) { x = W + 30; y = Math.random() * H; }
        else if (edge === 2) { x = Math.random() * W; y = H + 30; }
        else { x = -30; y = Math.random() * H; }
        makeRock(x, y, "big", n);
      }
      clearing = false;
    }
    function makeRock(x, y, size, waveN) {
      var def = ROCK[size];
      var base = (size === "big" ? 26 : size === "med" ? 46 : 74) + (waveN || wave) * 5;
      var a = Math.random() * Math.PI * 2;
      var shape = [];
      for (var v = 0; v < 10; v++) shape.push(0.78 + Math.random() * 0.34); // jagged silhouette
      var rk = {
        x: x, y: y, r: def.r, size: size,
        vx: Math.cos(a) * base * 0.5, vy: Math.sin(a) * base * 0.5,
        ang: Math.random() * 6.28, spin: (Math.random() - 0.5) * 2.4, shape: shape
      };
      rocks.push(rk);
      return rk;
    }
    function comboMult() { return 1 + Math.min(4, Math.floor(combo / 3)); }
    function bumpCombo() {
      combo += 1; comboT = 1.4;
      if (combo >= 3 && combo % 3 === 0) { big("🔥 COMBO ×" + comboMult() + "!", "#ffd23f"); if (juice) juice.shake(4); }
    }
    function dropCrystal(x, y) {
      var a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 60;
      crystals.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 9, val: 5 });
    }
    function breakRock(rk) {
      var idx = rocks.indexOf(rk); if (idx < 0) return;
      rocks.splice(idx, 1);
      var def = ROCK[rk.size];
      score += def.score * comboMult();
      bumpCombo();
      for (var d = 0; d < def.drops; d++) dropCrystal(rk.x, rk.y);
      if (Math.random() < 0.22) spawnPickup(rk.x, rk.y);
      if (def.split) {
        for (var k = 0; k < 2; k++) {
          var c = makeRock(rk.x, rk.y, def.split, wave);
          var a2 = Math.random() * Math.PI * 2, sp = (rk.size === "big" ? 45 : 70) + wave * 4;
          c.vx = Math.cos(a2) * sp; c.vy = Math.sin(a2) * sp;
        }
        if (rk.size === "big" && juice) juice.shake(8); // screen-shake on big splits
      } else {
        for (var e = 0; e < 2; e++) dropCrystal(rk.x, rk.y); // smalls vaporize into extra crystals
      }
      if (juice) juice.burst(rk.x, rk.y, "#b9c6d6", rk.size === "big" ? 20 : 12);
      if (sfx && sfx.thud && rk.size === "big") sfx.thud();
      else if (sfx && sfx.pop) sfx.pop();
      updateHud();
    }
    function spawnPickup(x, y) {
      var kind = PICKS[Math.floor(Math.random() * PICKS.length)];
      pickups.push({ x: x, y: y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 11, kind: kind });
    }
    function grabPickup(p) {
      if (p.kind === "triple") { triple = 12; big("🔱 TRIPLE SHOT! 12s", "#ffd23f"); }
      else if (p.kind === "shield") { guard = true; shieldT = Math.max(shieldT, 1.2); big("🛡 SHIELD UP! (+1 hit)", "#69f0ae"); }
      else { magnetT = 8; big("🧲 CRYSTAL MAGNET! 8s", "#8ecdf7"); }
      if (sfx && sfx.coin) sfx.coin();
      if (juice) juice.burst(p.x, p.y, "#ffd740", 12);
    }

    // ---------- shooting ----------
    function mkBullet(ang, inherit) {
      var cx = Math.cos(ang), cy = Math.sin(ang);
      bullets.push({
        x: ship.x + cx * SHIP_R, y: ship.y + cy * SHIP_R,
        vx: cx * BULLET_SPD + (inherit ? ship.vx : 0), vy: cy * BULLET_SPD + (inherit ? ship.vy : 0),
        life: BULLET_LIFE
      });
    }
    function fire() {
      if (over || paused) return;
      if (triple > 0) { mkBullet(ship.ang - 0.22, true); mkBullet(ship.ang, true); mkBullet(ship.ang + 0.22, true); }
      else mkBullet(ship.ang, true);
      fireCd = FIRE_CD;
      if (sfx && sfx.pop && Math.random() < 0.4) sfx.pop();
    }
    // deterministic single bolt aimed exactly at a point (test/aim helper) — no inherited drift
    function shootAt(x, y) {
      var a = Math.atan2(y - ship.y, x - ship.x);
      bullets.push({ x: ship.x + Math.cos(a) * SHIP_R, y: ship.y + Math.sin(a) * SHIP_R, vx: Math.cos(a) * BULLET_SPD, vy: Math.sin(a) * BULLET_SPD, life: 2.2 });
    }

    // ---------- UFO ----------
    function spawnUfo() {
      var fromLeft = Math.random() < 0.5;
      ufos.push({ x: fromLeft ? -30 : W + 30, y: H * (0.2 + Math.random() * 0.6), vx: (fromLeft ? 1 : -1) * (70 + wave * 6), r: 20, shootT: 1.4, hp: 2 });
    }
    function ufoFire(u) {
      var a = Math.atan2(ship.y - u.y, ship.x - u.x) + (Math.random() - 0.5) * 0.4; // slightly off — dodgeable
      ufoShots.push({ x: u.x, y: u.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, life: 3 });
      if (sfx && sfx.whoosh) sfx.whoosh();
    }

    // ---------- lives: crash / respawn / revive ----------
    // scan a grid, land in the spot FARTHEST from every rock — never on top of one
    function safeSpot() {
      var best = { x: W / 2, y: H / 2 }, bestD = -1;
      for (var gx = 1; gx <= 5; gx++) for (var gy = 1; gy <= 5; gy++) {
        var px = W * gx / 6, py = H * gy / 6, d = 1e9;
        for (var i = 0; i < rocks.length; i++) {
          var dx = rocks[i].x - px, dy = rocks[i].y - py, dd = Math.sqrt(dx * dx + dy * dy) - rocks[i].r;
          if (dd < d) d = dd;
        }
        if (d > bestD) { bestD = d; best = { x: px, y: py }; }
      }
      return best;
    }
    function respawn() {
      var s = safeSpot();
      ship.x = s.x; ship.y = s.y; ship.vx = 0; ship.vy = 0; ship.ang = -Math.PI / 2;
      shieldT = 2; // kind: 2s of invulnerability so you never insta-die on arrival
    }
    // public: always costs a life (shield only stops COLLISION crashes, not this)
    function crash() {
      if (over || paused) return;
      lives = Math.max(0, lives - 1);
      combo = 0;
      if (juice) juice.shake(11);
      if (sfx && sfx.buzz) sfx.buzz();
      updateHud();
      if (lives <= 0) reviveOrOver();
      else { respawn(); big("💥 Ship down! " + lives + " left", "#ff8a8a"); }
    }
    function reviveOrOver() {
      if (reviveUsed) { runOver(); return; }
      paused = true;
      cv._lastQ = VQ.miniQuiz(asq, words, store, {
        title: "💫 LAST STAND! Answer a word to fly again!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; reviveUsed = true;
          if (ok) {
            lives = 1; paused = false; respawn();
            big("💫 REVIVED! One more ship!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(ship.x, ship.y, "#69f0ae", 22);
            updateHud();
          } else runOver();
        }
      });
    }

    // ---------- hyperspace (the word power) ----------
    function hyperQuiz() {
      if (over || paused) return;
      if (hyper >= 2) { big("🌀 Jumps already full!", "#ffd740"); return; }
      paused = true;
      cv._lastQ = VQ.miniQuiz(asq, words, store, {
        title: "🌀 HYPERSPACE! Answer a word to charge a jump!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) { hyper = Math.min(2, hyper + 1); big("🌀 Jump charged! (" + hyper + "/2)", "#c9b6ff"); if (sfx && sfx.chime) sfx.chime(); }
          else big("The warp core sputtered…", "#ff8a8a");
          updateHud();
        }
      });
    }
    function useHyper() {
      if (over || paused || hyper <= 0) return false;
      hyper -= 1;
      var ox = ship.x, oy = ship.y;
      var s = safeSpot();
      if (Math.abs(s.x - ox) < 1 && Math.abs(s.y - oy) < 1) { s = { x: (ox + W * 0.5 + 90) % W, y: (oy + H * 0.5 + 90) % H }; } // guarantee a move
      ship.x = s.x; ship.y = s.y; ship.vx = 0; ship.vy = 0;
      shieldT = Math.max(shieldT, 1.5);
      big("🌀 HYPERSPACE JUMP!", "#c9b6ff");
      if (sfx && sfx.whoosh) sfx.whoosh();
      if (juice) { juice.shake(6); juice.burst(ox, oy, "#c9b6ff", 18); juice.burst(ship.x, ship.y, "#c9b6ff", 18); }
      updateHud();
      return true;
    }

    // ---------- physics (fixed substeps so bolts never skip a small rock) ----------
    function wrapObj(o) { if (o.x < 0) o.x += W; else if (o.x > W) o.x -= W; if (o.y < 0) o.y += H; else if (o.y > H) o.y -= H; }
    function turnToward(target, h) {
      var d = target - ship.ang;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      var mx = ROT * h;
      ship.ang += d > mx ? mx : d < -mx ? -mx : d;
    }
    function stepFixed(h) {
      runT += h;
      // timers
      shieldT = Math.max(0, shieldT - h);
      triple = Math.max(0, triple - h);
      magnetT = Math.max(0, magnetT - h);
      comboT -= h; if (comboT <= 0) combo = 0;
      fireCd -= h;

      // steering
      thrusting = false;
      if (keys.left) ship.ang -= ROT * h;
      if (keys.right) ship.ang += ROT * h;
      if (keys.up) thrusting = true;
      if (touchActive) { turnToward(Math.atan2(touchY - ship.y, touchX - ship.x), h); thrusting = true; }
      if (thrusting) {
        ship.vx += Math.cos(ship.ang) * THRUST * h; ship.vy += Math.sin(ship.ang) * THRUST * h;
        if (juice && Math.random() < 0.5) juice.burst(ship.x - Math.cos(ship.ang) * SHIP_R, ship.y - Math.sin(ship.ang) * SHIP_R, "#ff9f43", 1);
      }
      ship.vx -= ship.vx * DRAG * h; ship.vy -= ship.vy * DRAG * h;
      var sp = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      if (sp > MAXV) { ship.vx = ship.vx / sp * MAXV; ship.vy = ship.vy / sp * MAXV; }
      ship.x += ship.vx * h; ship.y += ship.vy * h; wrapObj(ship);

      // auto-fire forward
      if (fireCd <= 0) fire();

      // rocks drift + tumble
      for (var i = 0; i < rocks.length; i++) { var rk = rocks[i]; rk.x += rk.vx * h; rk.y += rk.vy * h; rk.ang += rk.spin * h; wrapObj(rk); }

      // bullets
      for (var b = bullets.length - 1; b >= 0; b--) {
        var bl = bullets[b]; bl.x += bl.vx * h; bl.y += bl.vy * h; bl.life -= h;
        var hitRock = false;
        for (var r = 0; r < rocks.length; r++) {
          var rr = rocks[r], dx = rr.x - bl.x, dy = rr.y - bl.y;
          if (dx * dx + dy * dy < rr.r * rr.r) { breakRock(rr); hitRock = true; break; }
        }
        if (hitRock) { bullets.splice(b, 1); continue; }
        for (var uu = ufos.length - 1; uu >= 0; uu--) {
          var uf = ufos[uu], ux = uf.x - bl.x, uy = uf.y - bl.y;
          if (ux * ux + uy * uy < uf.r * uf.r) {
            uf.hp -= 1; bullets.splice(b, 1); hitRock = true;
            if (uf.hp <= 0) { score += 100 * comboMult(); bumpCombo(); dropCrystal(uf.x, uf.y); dropCrystal(uf.x, uf.y); ufos.splice(uu, 1); if (juice) juice.burst(uf.x, uf.y, "#e040fb", 20); big("👾 UFO down! +100", "#e040fb"); updateHud(); }
            break;
          }
        }
        if (hitRock) continue;
        if (bl.life <= 0 || bl.x < -20 || bl.x > W + 20 || bl.y < -20 || bl.y > H + 20) bullets.splice(b, 1);
      }

      // ufos cross + shoot
      for (var u = ufos.length - 1; u >= 0; u--) {
        var uo = ufos[u]; uo.x += uo.vx * h; uo.y += Math.sin(runT * 2 + uo.y) * 8 * h; uo.shootT -= h;
        if (uo.shootT <= 0 && !over) { uo.shootT = 1.4; ufoFire(uo); }
        if (uo.x < -60 || uo.x > W + 60) ufos.splice(u, 1);
      }
      for (var us = ufoShots.length - 1; us >= 0; us--) {
        var uz = ufoShots[us]; uz.x += uz.vx * h; uz.y += uz.vy * h; uz.life -= h;
        var hitShip = false;
        if (shieldT <= 0) { var sdx = ship.x - uz.x, sdy = ship.y - uz.y; if (sdx * sdx + sdy * sdy < (SHIP_R + 5) * (SHIP_R + 5)) { hitShip = true; } }
        if (hitShip) { ufoShots.splice(us, 1); onShipHit(); continue; }
        if (uz.life <= 0) ufoShots.splice(us, 1);
      }

      // crystals drift (magnet pulls them home) + collect
      for (var c = crystals.length - 1; c >= 0; c--) {
        var cr = crystals[c]; cr.life -= h;
        if (magnetT > 0) { var mdx = ship.x - cr.x, mdy = ship.y - cr.y, md = Math.sqrt(mdx * mdx + mdy * mdy) || 1; cr.vx += mdx / md * 900 * h; cr.vy += mdy / md * 900 * h; cr.vx *= (1 - 2 * h); cr.vy *= (1 - 2 * h); }
        cr.x += cr.vx * h; cr.y += cr.vy * h; wrapObj(cr);
        var cdx = ship.x - cr.x, cdy = ship.y - cr.y;
        if (cdx * cdx + cdy * cdy < (SHIP_R + 20) * (SHIP_R + 20)) {
          score += cr.val; crystals.splice(c, 1);
          if (juice) juice.burst(ship.x, ship.y, "#40c4ff", 5);
          if (sfx && sfx.coin && Math.random() < 0.5) sfx.coin();
          updateHud(); continue;
        }
        if (cr.life <= 0) crystals.splice(c, 1);
      }

      // pickups drift + grab
      for (var p = pickups.length - 1; p >= 0; p--) {
        var pk = pickups[p]; pk.x += pk.vx * h; pk.y += pk.vy * h; pk.life -= h; wrapObj(pk);
        var pdx = ship.x - pk.x, pdy = ship.y - pk.y;
        if (pdx * pdx + pdy * pdy < (SHIP_R + 22) * (SHIP_R + 22)) { grabPickup(pk); pickups.splice(p, 1); continue; }
        if (pk.life <= 0) pickups.splice(p, 1);
      }

      // ship vs rocks (shield = pass; guard = one free pop; else crash)
      if (!over && !paused && shieldT <= 0) {
        for (var sr = 0; sr < rocks.length; sr++) {
          var srk = rocks[sr], ddx = srk.x - ship.x, ddy = srk.y - ship.y, rad = srk.r + SHIP_R;
          if (ddx * ddx + ddy * ddy < rad * rad) { onShipHit(srk); break; }
        }
      }

      // director: an occasional UFO crossing
      ufoT -= h;
      if (ufoT <= 0 && ufos.length === 0 && !over) { ufoT = 16 + Math.random() * 10; if (wave >= 2) spawnUfo(); }

      // wave clear → advance (wave bumps immediately; new rocks arrive after a beat)
      if (started && !over && !paused && !clearing && rocks.length === 0) {
        wave += 1; clearing = true; clearT = 1.2;
        if (wave > (stats.bestWaveA || 0)) { stats.bestWaveA = wave; if (store.save) store.save(); }
        big("🌊 WAVE " + wave + "!", "#8ecdf7");
        if (sfx && sfx.chime) sfx.chime();
        updateHud();
      }
      if (clearing) { clearT -= h; if (clearT <= 0) spawnWave(wave); }

      if (juice) juice.update(h);
    }
    // a collision hit: guard pops one rock free, otherwise you crash
    function onShipHit(rk) {
      if (guard) { guard = false; shieldT = Math.max(shieldT, 0.6); if (rk) breakRock(rk); big("🛡 Shield absorbed it!", "#69f0ae"); if (juice) juice.shake(6); return; }
      crash();
    }
    function simulate(dt) {
      if (over) return;
      var steps = Math.min(600, Math.ceil(dt / HFIX));
      var h = dt / steps;
      for (var i = 0; i < steps && !over; i++) stepFixed(h);
    }

    // ---------- drawing ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0b1226"); g.addColorStop(1, "#05070f");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // starfield
      starT += 0.016;
      ctx.fillStyle = "rgba(255,255,255,.55)";
      for (var s = 0; s < stars.length; s++) { var st = stars[s]; ctx.globalAlpha = 0.3 + 0.5 * st.z * (0.6 + 0.4 * Math.sin(starT + s)); ctx.fillRect(st.x * W, st.y * H, st.z * 2, st.z * 2); }
      ctx.globalAlpha = 1;

      ctx.save();
      if (juice) ctx.translate(juice.ox, juice.oy);

      // rocks
      for (var i = 0; i < rocks.length; i++) {
        var rk = rocks[i];
        ctx.save(); ctx.translate(rk.x, rk.y); ctx.rotate(rk.ang);
        ctx.beginPath();
        for (var v = 0; v < rk.shape.length; v++) {
          var a = v / rk.shape.length * Math.PI * 2, rr = rk.r * rk.shape[v];
          var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = "#5a6478"; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "#8b98ad"; ctx.stroke();
        ctx.restore();
      }

      // crystals
      for (var c = 0; c < crystals.length; c++) { ctx.font = "18px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("💎", crystals[c].x, crystals[c].y); }
      // pickups
      for (var p = 0; p < pickups.length; p++) { ctx.font = "24px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(pickups[p].kind === "triple" ? "🔱" : pickups[p].kind === "shield" ? "🛡" : "🧲", pickups[p].x, pickups[p].y); }
      // ufos
      for (var u = 0; u < ufos.length; u++) { ctx.font = "34px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("👾", ufos[u].x, ufos[u].y); }
      // bullets
      ctx.fillStyle = "#ffe14d";
      for (var b = 0; b < bullets.length; b++) { ctx.beginPath(); ctx.arc(bullets[b].x, bullets[b].y, 3, 0, Math.PI * 2); ctx.fill(); }
      // ufo shots
      ctx.fillStyle = "#ff6b6b";
      for (var z = 0; z < ufoShots.length; z++) { ctx.beginPath(); ctx.arc(ufoShots[z].x, ufoShots[z].y, 4, 0, Math.PI * 2); ctx.fill(); }

      // ship
      ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.ang);
      if (thrusting) { // thruster flame
        ctx.fillStyle = Math.random() < 0.5 ? "#ff9f43" : "#ffd23f";
        ctx.beginPath(); ctx.moveTo(-SHIP_R + 2, -5); ctx.lineTo(-SHIP_R - 8 - Math.random() * 8, 0); ctx.lineTo(-SHIP_R + 2, 5); ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(SHIP_R + 4, 0); ctx.lineTo(-SHIP_R + 2, -SHIP_R + 3); ctx.lineTo(-SHIP_R + 7, 0); ctx.lineTo(-SHIP_R + 2, SHIP_R - 3); ctx.closePath();
      ctx.fillStyle = "#e8f0ff"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#8ecdf7"; ctx.stroke();
      ctx.restore();
      if (shieldT > 0) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(runT * 12); ctx.strokeStyle = "#69f0ae"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ship.x, ship.y, SHIP_R + 8, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }

      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; // clamp — a long stall never teleports physics
      if (!paused && !over) simulate(dt);
      draw();
    }

    // ---------- input ----------
    function pt(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    function beginSteer(x, y) {
      if (paused || over) return;
      var nowMs = performance.now();
      if (nowMs - lastTap < 300 && hyper > 0) { useHyper(); lastTap = 0; return; } // double-tap = jump
      lastTap = nowMs;
      touchActive = true; touchX = x; touchY = y;
    }
    function moveSteer(x, y) { if (touchActive) { touchX = x; touchY = y; } }
    function endSteer() { touchActive = false; }
    cv.addEventListener("mousedown", function (e) { var p = pt(e); beginSteer(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { var p = pt(e); moveSteer(p.x, p.y); });
    cv.addEventListener("mouseup", endSteer);
    cv.addEventListener("mouseleave", endSteer);
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); beginSteer(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); moveSteer(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); endSteer(); }, { passive: false });
    function onKeyDown(e) {
      var k = e.key;
      if (k === "ArrowLeft") { keys.left = true; e.preventDefault(); }
      else if (k === "ArrowRight") { keys.right = true; e.preventDefault(); }
      else if (k === "ArrowUp") { keys.up = true; e.preventDefault(); }
      else if (k === " " || k === "Spacebar") { fire(); e.preventDefault(); }
      else if (k === "Shift") { useHyper(); }
    }
    function onKeyUp(e) {
      var k = e.key;
      if (k === "ArrowLeft") keys.left = false;
      else if (k === "ArrowRight") keys.right = false;
      else if (k === "ArrowUp") keys.up = false;
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    hypBtn.onclick = function () { if (hyper > 0) useHyper(); else hyperQuiz(); };

    // ---------- exit / banking ----------
    function bankExit() {
      if (over) return; // run-over already banked
      if (score <= 0 && wave <= 1 && !started) return;
      endRunStats();
      var b = bankRun();
      if (b && sfx && sfx.toast) sfx.toast("🛸 Asteroid run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._asteroid = {
      state: function () {
        return {
          wave: wave, lives: lives, score: score,
          rocks: rocks.length, crystals: crystals.length,
          shieldT: shieldT, triple: triple, hyper: hyper,
          revived: reviveUsed, over: over, banked: banked, best: stats.bestScoreA || 0,
          ship: { x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy, ang: ship.ang }
        };
      },
      begin: begin,
      aim: function (ang) { ship.ang = ang; },
      thrust: function (on) { keys.up = !!on; },
      spawnRock: function (x, y, size) { return makeRock(x, y, size === "big" || size === "med" || size === "small" ? size : "big", wave); },
      shootAt: shootAt,
      clearRocks: function () { rocks = []; },
      hyperQuiz: hyperQuiz,
      useHyper: useHyper,
      crash: crash,
      tick: function (seconds) { simulate(seconds); }
    };

    // ---------- boot ----------
    begin();
    if (global._asteroiddemo) { // screenshot seed: a lively mid-wave-4 board, frozen
      global._asteroiddemo = 0;
      rocks = []; bullets = []; crystals = []; pickups = []; ufos = []; ufoShots = [];
      wave = 4; score = 260; lives = 2; started = true; shieldT = 0;
      makeRock(W * 0.24, H * 0.30, "big", 4);
      makeRock(W * 0.70, H * 0.28, "med", 4);
      makeRock(W * 0.58, H * 0.66, "small", 4);
      makeRock(W * 0.32, H * 0.70, "med", 4);
      makeRock(W * 0.80, H * 0.58, "small", 4);
      for (var dc = 0; dc < 7; dc++) crystals.push({ x: W * (0.2 + dc * 0.09), y: H * (0.45 + (dc % 3) * 0.1), vx: (Math.random() - 0.5) * 30, vy: 20, life: 8, val: 5 });
      pickups.push({ x: W * 0.5, y: H * 0.4, vx: 0, vy: 0, life: 9, kind: "triple" });
      ufos.push({ x: W * 0.15, y: H * 0.2, vx: 80, vy: 0, r: 20, shootT: 1, hp: 2 });
      ship.x = W * 0.45; ship.y = H * 0.52; ship.ang = -0.9; ship.vx = 40; ship.vy = -30; thrusting = true;
      updateHud();
      paused = true; // freeze the tableau — the demo exists for screenshots
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxAsteroid = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
