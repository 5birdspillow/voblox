/*
 * Voblox arcade game — 🏐 SPIKE BALL (1v1 cartoon beach volleyball, Pikachu-Volleyball style).
 * Side-view sand court split by a net: YOU on the left, a named bot on the right. Hold
 * left/right (or drag) to run, tap / up-swipe to JUMP. The ball is a big forgiving beach
 * ball — touching it bumps it up-and-over; jumping into it at the net = a SPIKE (fast
 * downward smash with speed lines). Ball on the ground = point for the other side; first
 * to 11 (win by 2) takes the SET; best-of-3 sets wins the MATCH. Serve alternates.
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🔥 POWER SPIKE: touches fill a meter; full → a WORD arms a flaming rocket next spike.
 *   - 🛡 SAVE: at set point AGAINST you, a WORD grants a one-time skip of the next ground point.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("spike") per match
 * via bankRun(), banked on match end, quit, AND app-close (matchWinsV, longestRally persist).
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  // fixed logical court — scaled to the canvas so specs stay resolution-proof
  var CW = 600, CH = 320;
  var GROUND = 300;            // y of the sand line (down is +y)
  var NET_X = CW / 2, NET_W = 8, NET_TOP = 200;   // net bar spans y∈[200,300] at mid-court
  var BALL_R = 22, PL_R = 26, REST_Y = GROUND - PL_R;
  var G = 1300;               // gravity (px/s^2)
  var WALL = 0.86;            // wall/net restitution
  var JUMP_V = -620;          // jump impulse (up)
  var YOU_CAP = 360;          // your run speed
  var WIN_AT = 11, SETS_TO_WIN = 2;
  var MAXV = 2400;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function hyp(x, y) { return Math.sqrt(x * x + y * y); }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("spike");
    // additive-only save fields (recordGame owns best/wins/plays/rankPts)
    stats.matchWinsV = stats.matchWinsV || 0;
    stats.longestRally = stats.longestRally || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap spike";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="spcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="spmsg">🏐 Spike Ball</div>' +
      '<div class="grow"><span id="spscore">0 : 0</span><span id="spmeter">🔥 0%</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="spbig"></div>' +
      '<button id="sppow" type="button" style="display:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 40px);' +
      'transform:translateX(-50%);z-index:8;background:linear-gradient(#ffb24d,#ff6b1f);color:#fff;border:none;border-radius:16px;' +
      'padding:14px 22px;font-family:inherit;font-weight:900;font-size:18px;box-shadow:0 6px 0 #b9491a,0 10px 24px #0006;cursor:pointer">' +
      '🔥 POWER SPIKE — answer a word!</button>' +
      '<button id="spsave" type="button" style="display:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 96px);' +
      'transform:translateX(-50%);z-index:8;background:linear-gradient(#5be0e0,#1f8aa3);color:#fff;border:none;border-radius:16px;' +
      'padding:12px 20px;font-family:inherit;font-weight:900;font-size:16px;box-shadow:0 6px 0 #176677,0 10px 24px #0006;cursor:pointer">' +
      '🛡 SAVE — answer a word!</button>' +
      '<div class="gover" id="spq" style="display:none"></div>' +
      '<div class="gover" id="spcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#spcv"), ctx = cv.getContext("2d");
    var qEl = document.getElementById("spq"), cardEl = document.getElementById("spcard");
    var msgEl = document.getElementById("spmsg"), bigEl = document.getElementById("spbig");
    var powBtn = document.getElementById("sppow"), saveBtn = document.getElementById("spsave");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- responsive letterbox (ONE logic space) ----------
    var W, H, S, OX, OY;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      var reserve = 92; // room for the HUD strip
      S = Math.min(W / CW, (H - reserve) / CH);
      OX = Math.max(0, (W - CW * S) / 2);
      OY = Math.max(30, (H - reserve - CH * S) / 2 + 40);
    }
    resize(); window.addEventListener("resize", resize);
    function X(x) { return OX + x * S; }
    function Y(y) { return OY + y * S; }
    function pz(n) { return n * S; }

    // ---------- opponent picker (3 named rivals near Leo's rank) ----------
    var baseSkill = P.botSkillFor(stats.rankPts);
    var opponents = Bots.pickOpponents(3, baseSkill).slice();
    opponents.sort(function (a, b) { return a.skill - b.skill; }); // easiest → hardest
    while (opponents.length < 3 && Bots.ALL.length) opponents.push(opponents[opponents.length - 1] || Bots.ALL[0]);
    var TIERS = ["🐣 Rookie", "😎 Pro", "🔥 Champ"];
    var curOpp = 0, rival = opponents[0], skill = rival.skill;

    // ---------- match state ----------
    var running = true, raf = 0, lastT = performance.now(), runT = 0;
    var started = false, over = false, won = false, paused = false, banked = false;
    var youPts = 0, botPts = 0, sets = [0, 0], totalYou = 0;
    var serving = "you", serveDelay = 0;
    var meter = 0, powered = false;
    var saveArmed = false, saveUsed = false;
    var rally = 0, matchLongest = 0, rallyAnnounced = false;
    var interacted = false, lastFmt = null;
    var heldDir = 0; // keyboard hold (-1 left, +1 right)

    var ball = { x: CW * 0.25, y: 120, vx: 0, vy: 0, flame: 0, spike: 0, squash: 0 };
    var you = { x: CW * 0.25, tx: CW * 0.25, y: REST_Y, vy: 0, onGround: true, mine: true, mood: 0 };
    var botP = { x: CW * 0.75, tx: CW * 0.75, y: REST_Y, vy: 0, onGround: true, mine: false, mood: 0 };
    var puffs = [], lines = []; // sand puffs + spike speed lines

    var youMinX = PL_R, youMaxX = NET_X - NET_W / 2 - PL_R;
    var botMinX = NET_X + NET_W / 2 + PL_R, botMaxX = CW - PL_R;

    function setPointAgainst() { return !over && botPts >= WIN_AT - 1 && botPts - youPts >= 1; }
    function matchPoint() { return setPointAgainst(); }

    // ---------- HUD ----------
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1200); }
    function hud() {
      document.getElementById("spscore").textContent = youPts + " : " + botPts;
      document.getElementById("spmeter").textContent = powered ? "🔥 ARMED" : "🔥 " + Math.round(meter * 100) + "%";
      updateButtons();
    }
    function updateButtons() {
      var live = started && !over && !paused;
      powBtn.style.display = (live && meter >= 1 && !powered) ? "block" : "none";
      saveBtn.style.display = (live && setPointAgainst() && !saveUsed) ? "block" : "none";
    }

    // ---------- word hooks ----------
    function addMeter(a) {
      if (powered) return;
      meter = Math.min(1, meter + a);
      if (meter >= 1 && sfx && sfx.chime) sfx.chime();
      updateButtons();
    }
    function powerQuiz() {
      if (over || !started) return;
      paused = true; updateButtons();
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "🔥 POWER SPIKE! Answer to arm a flaming smash!",
        lastFormat: lastFmt, skippable: false,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt; paused = false;
          if (ok) {
            powered = true; meter = 0;
            big("🔥 POWER SPIKE ARMED — your next smash ROCKETS!", "#ff9f43");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) { juice.shake(5); juice.burst(W * 0.3, H * 0.6, "#ff9f43", 20); }
          } else {
            meter = Math.max(0, meter - 0.3);
            big("Fizzled — keep studying and try again!", "#8ecdf7");
          }
          hud();
        }
      });
    }
    function saveQuiz() {
      if (over || !started || saveUsed) return;
      paused = true; updateButtons();
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "🛡 SAVE! Answer a word to guard the next point!",
        lastFormat: lastFmt, skippable: false,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt; paused = false;
          if (ok) {
            saveArmed = true; saveUsed = true;
            big("🛡 SAVE ARMED — the next ground touch won't count!", "#5be0e0");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(W * 0.3, H * 0.85, "#5be0e0", 18);
          } else {
            big("No worries — play on!", "#8ecdf7"); // never punished
          }
          hud();
        }
      });
    }

    // ---------- ball / player contact ----------
    function contactBall(p, forced) {
      var dx = ball.x - p.x, dy = ball.y - p.y, d = hyp(dx, dy);
      var min = BALL_R + PL_R;
      if (!forced && (d >= min || d <= 0)) return false;
      if (d <= 0) { d = 0.001; dx = 0; dy = -1; }
      var nx = dx / d, ny = dy / d;
      if (!forced) { ball.x = p.x + nx * min; ball.y = p.y + ny * min; } // separate
      var toOpp = p.mine ? 1 : -1;                 // you send right, the bot sends left
      var speed = hyp(p.vy, 0) + Math.abs(p.tx - p.x) * 0.4;
      var airborne = p.y < REST_Y - 22;
      var nearNet = Math.abs(p.x - NET_X) < 110;
      var high = ball.y < NET_TOP + 40;
      var spiking = airborne && nearNet && high;
      if (spiking) {
        var mul = (powered && p.mine) ? 2.0 : 1.0;
        ball.vx = toOpp * (330 + speed * 0.7) * mul;
        ball.vy = (300 + Math.abs(p.vy) * 0.4) * mul;   // downward SMASH
        ball.spike = 0.5; ball.squash = 1;
        spawnLines();
        if (powered && p.mine) { ball.flame = 1.4; powered = false; big("🔥 FLAMING ROCKET!", "#ff6b1f"); }
        else big("💥 SPIKE!", p.mine ? "#69f0ae" : "#ff8a8a");
        if (sfx && sfx.whoosh) sfx.whoosh();
        if (juice) juice.shake(6);
      } else {
        // forgiving bump: up and over, plus the runner's momentum
        ball.vx = toOpp * (150 + speed * 0.5) + (p.tx - p.x) * 0.35;
        ball.vy = -(300 + Math.abs(p.vy) * 0.3);
        ball.squash = 0.6;
        if (sfx && sfx.pop) sfx.pop();
      }
      clampBall();
      if (p.mine) addMeter(0.22);
      rally++; if (rally > matchLongest) matchLongest = rally;
      if (rally === 5 && !rallyAnnounced) { rallyAnnounced = true; big("🔊 RALLY!", "#ffd23f"); if (sfx && sfx.chime) sfx.chime(); }
      if (juice) juice.burst(X(ball.x), Y(ball.y), ball.flame > 0 ? "#ff6b1f" : (p.mine ? "#69f0ae" : "#ff8a8a"), 8);
      interacted = true;
      return true;
    }
    function clampBall() {
      var sp = hyp(ball.vx, ball.vy);
      if (sp > MAXV) { ball.vx *= MAXV / sp; ball.vy *= MAXV / sp; }
    }
    function spawnLines() { for (var i = 0; i < 6; i++) lines.push({ x: ball.x, y: ball.y, life: 0.4 }); }
    function sandPuff(x) { for (var i = 0; i < 8; i++) puffs.push({ x: x + (Math.random() - 0.5) * 30, y: GROUND, vx: (Math.random() - 0.5) * 90, vy: -40 - Math.random() * 90, life: 0.5 }); }

    // ---------- physics ----------
    function stepPlayer(p, dt) {
      p.vy += G * dt; p.y += p.vy * dt;
      if (p.y >= REST_Y) { p.y = REST_Y; p.vy = 0; p.onGround = true; } else p.onGround = false;
      var lo = p.mine ? youMinX : botMinX, hi = p.mine ? youMaxX : botMaxX;
      var cap = p.mine ? YOU_CAP : (160 + skill * 220);
      var dx = clamp(p.tx, lo, hi) - p.x, stp = cap * dt;
      if (Math.abs(dx) > stp) p.x += (dx > 0 ? 1 : -1) * stp; else p.x = clamp(p.tx, lo, hi);
      p.x = clamp(p.x, lo, hi);
    }
    function jumpP(p) { if (p.onGround) { p.vy = JUMP_V; p.onGround = false; if (p.mine && sfx && sfx.pop) sfx.pop(); } }

    // the bot: tracks the ball on its side, leaps to spike near the net, else guards home
    function botAI(dt) {
      var b = botP, homeX = NET_X + 130;
      var onSide = ball.x > NET_X;
      if (onSide) {
        b.tx = clamp(ball.x + ball.vx * (0.06 + skill * 0.10), botMinX, botMaxX);
        var canSpike = b.onGround && ball.y < NET_TOP + 50 && Math.abs(b.x - ball.x) < 70 && ball.vy > -40;
        var fumble = ball.flame > 0 && Math.random() > skill; // the rocket rattles weaker bots
        if (canSpike && !fumble && Math.random() < 0.04 + skill * 0.20) jumpP(b);
      } else {
        b.tx = homeX + (ball.x - homeX) * (0.15 + skill * 0.15);
      }
    }

    function handleNet() {
      var reach = NET_W / 2 + BALL_R;
      if (ball.y + BALL_R <= NET_TOP) return;             // sailing over the net
      if (ball.x >= NET_X - reach && ball.x <= NET_X && ball.vx > 0) { ball.x = NET_X - reach; ball.vx = -Math.abs(ball.vx) * WALL; netFx(); }
      else if (ball.x <= NET_X + reach && ball.x >= NET_X && ball.vx < 0) { ball.x = NET_X + reach; ball.vx = Math.abs(ball.vx) * WALL; netFx(); }
      else if (Math.abs(ball.x - NET_X) < reach && ball.y < NET_TOP && ball.vy > 0) { ball.y = NET_TOP - BALL_R; ball.vy = -Math.abs(ball.vy) * WALL; } // tape bounce
    }
    function netFx() { if (sfx && sfx.pop && Math.random() < 0.4) sfx.pop(); if (juice && Math.random() < 0.3) juice.shake(2); }

    function ballStep(dt) {
      if (serveDelay > 0) { serveDelay = Math.max(0, serveDelay - dt); ball.spike = Math.max(0, ball.spike - dt); return; }
      ball.vy += G * dt;
      if (ball.flame > 0) ball.flame = Math.max(0, ball.flame - dt);
      if (ball.spike > 0) ball.spike = Math.max(0, ball.spike - dt);
      if (ball.squash > 0) ball.squash = Math.max(0, ball.squash - dt * 3);
      clampBall();
      var sp = hyp(ball.vx, ball.vy);
      var n = Math.max(1, Math.ceil(sp * dt / (BALL_R * 0.5))); // substep so the net/ground is never tunneled
      var sdt = dt / n;
      for (var i = 0; i < n; i++) {
        ball.x += ball.vx * sdt; ball.y += ball.vy * sdt;
        if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx) * WALL; }
        else if (ball.x + BALL_R > CW) { ball.x = CW - BALL_R; ball.vx = -Math.abs(ball.vx) * WALL; }
        if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy) * WALL; }
        handleNet();
        contactBall(you, false); contactBall(botP, false);
        if (ball.y + BALL_R >= GROUND) { landOnGround(); return; }
      }
    }
    function landOnGround() {
      ball.y = GROUND - BALL_R; ball.vy = 0; ball.vx = 0;
      sandPuff(ball.x);
      if (juice) juice.shake(4);
      var loserSide = ball.x < NET_X ? "you" : "bot"; // the side it dropped on failed to return
      if (loserSide === "you" && saveArmed) {
        saveArmed = false;
        big("🛡 SAVED! That one didn't count!", "#5be0e0");
        if (sfx && sfx.fanfare) sfx.fanfare();
        startServe("you");
        hud();
        return;
      }
      awardPoint(loserSide === "you" ? "bot" : "you");
    }

    // ---------- scoring / sets / match ----------
    function awardPoint(who) {
      if (over) return;
      interacted = true;
      if (who === "you") { youPts++; totalYou++; } else botPts++;
      rally = 0; rallyAnnounced = false;
      meter = Math.min(1, meter); // (touches already banked it)
      if (who === "you") { if (juice) juice.burst(W * 0.3, H * 0.4, "#69f0ae", 12); if (sfx && sfx.coin) sfx.coin(); }
      else { botP.mood = 1; if (sfx && sfx.buzz) sfx.buzz(); }
      big(who === "you" ? "🏐 POINT!" : "😤 " + rival.name + " scores!", who === "you" ? "#69f0ae" : "#ff8a8a");
      hud();
      if (youPts >= WIN_AT && youPts - botPts >= 2) return winSet("you");
      if (botPts >= WIN_AT && botPts - youPts >= 2) return winSet("bot");
      if (setPointAgainst()) big("🛡 SET POINT against you — tap SAVE!", "#ffd740");
      startServe(who === "you" ? "bot" : "you"); // serve alternates
    }
    function winSet(who) {
      sets[who === "you" ? 0 : 1]++;
      you.mood = who === "you" ? 1 : 0; botP.mood = who === "bot" ? 1 : 0;
      big(who === "you" ? "🎉 SET " + sets[0] + " — you take it!" : "😖 " + rival.name + " takes the set", who === "you" ? "#ffd23f" : "#ff8a8a");
      if (sfx && sfx.fanfare && who === "you") sfx.fanfare();
      youPts = 0; botPts = 0; saveArmed = false; saveUsed = false; // save resets each set
      hud();
      if (sets[0] >= SETS_TO_WIN || sets[1] >= SETS_TO_WIN) { endMatch(sets[0] >= SETS_TO_WIN); return; }
      startServe(who === "you" ? "bot" : "you");
    }
    function startServe(who) {
      serving = who; serveDelay = 1.0; ball.flame = 0; ball.spike = 0;
      var left = who === "you";
      ball.x = left ? CW * 0.25 : CW * 0.75; ball.y = 150;
      ball.vx = (left ? 1 : -1) * 150; ball.vy = -240; // gentle toss-in that arcs toward the net
    }

    // ---------- economy: ONE banking path (airhockey/slice pattern) ----------
    function rewards(win) {
      return {
        win: !!win,
        score: sets[0] * 100 + totalYou,                       // sets won ×100 + points scored
        rankPtsDelta: win ? Math.min(12, 6 + sets[0] * 2) : 2,
        xp: Math.min(80, 12 + totalYou * 2 + (win ? 24 : 0)),
        gems: win ? 24 + totalYou : Math.min(14, 4 + totalYou * 2)
      };
    }
    function bankRun(win) {
      if (banked) return null;
      banked = true;
      var rw = rewards(win);
      var res = store.recordGame ? store.recordGame("spike", rw) : null;
      return { rw: rw, res: res };
    }
    function persistStats(win) {
      if (win) stats.matchWinsV = (stats.matchWinsV || 0) + 1;
      if (matchLongest > (stats.longestRally || 0)) stats.longestRally = matchLongest;
      if (store.save) store.save();
    }
    function endMatch(win) {
      if (over) return;
      over = true; paused = true; won = win;
      persistStats(win);
      var bank = bankRun(win) || { rw: rewards(win), res: null };
      showEnd(win, bank.rw, bank.res);
    }
    function showEnd(win, rw, res) {
      updateButtons();
      var payRow = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>';
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:460px">' +
        '<div style="font-size:46px">' + (win ? "🏆" : "🏐") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (win ? "🏐 MATCH WON over " + rival.name + "!" : "😤 " + rival.name + " takes the match…") + '</div>' +
        payRow +
        '<div style="margin:2px 0;font-size:16px">Sets <b>' + sets[0] + ' : ' + sets[1] + '</b> · ' + totalYou + ' points won' + (res && res.rankedUp ? '  ·  🎖 RANK UP!' : '') + '</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:8px">🏆 ' + (stats.matchWinsV || 0) + ' match wins · 🔊 longest rally ' + (stats.longestRally || 0) + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
        '<button class="submit" id="sprematch" type="button">Rematch ➜</button>' +
        '<button class="embtn" id="spnext" style="min-width:130px"><span class="ebl">🔀 Next rival</span><span class="ebs">pick again</span></button>' +
        '<button class="wqskip" id="spleave" type="button">Leave</button></div></div>';
      cardEl.style.display = "flex";
      if (win && sfx && sfx.fanfare) sfx.fanfare();
      if (win && juice) { juice.shake(6); for (var c = 0; c < 6; c++) juice.burst(W * (0.15 + c * 0.14), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb", "#ffb01f"][c], 16); }
      document.getElementById("sprematch").onclick = function () { begin(curOpp); };
      document.getElementById("spnext").onclick = showPicker;
      document.getElementById("spleave").onclick = exit;
    }

    // ---------- picker / begin ----------
    function showPicker() {
      started = false; over = false; paused = true; updateButtons();
      var btns = opponents.map(function (o, i) {
        var face = (o.avatar && o.avatar.face && o.avatar.face.length <= 2) ? o.avatar.face : "🙂";
        return '<button class="embtn" data-opp="' + i + '" style="min-width:120px">' +
          '<span class="ebl">' + face + " " + o.name + '</span><span class="ebs">' + TIERS[i] + '</span></button>';
      }).join("");
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:520px">' +
        '<div style="font-size:46px">🏐</div><div class="wqtitle" style="font-size:22px">Spike Ball</div>' +
        '<div style="margin:4px 0 10px;color:#5a6b7a;font-weight:bold">Beach volleyball — first to win 2 sets (to 11) takes the match!</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + btns + '</div>' +
        '<div style="font-size:12px;color:#8a98a8;margin-top:8px">🏆 Match wins: ' + (stats.matchWinsV || 0) + ' · 🔊 Longest rally: ' + (stats.longestRally || 0) + '</div></div>';
      cardEl.style.display = "flex";
      Array.prototype.forEach.call(cardEl.querySelectorAll("[data-opp]"), function (b) {
        b.onclick = function () { begin(+b.dataset.opp); };
      });
    }
    function begin(oppIdx) {
      if (oppIdx === undefined || oppIdx === null) oppIdx = curOpp;
      curOpp = clamp(oppIdx | 0, 0, opponents.length - 1);
      rival = opponents[curOpp]; skill = rival.skill;
      started = true; over = false; won = false; paused = false; banked = false; interacted = false;
      youPts = 0; botPts = 0; sets = [0, 0]; totalYou = 0;
      meter = 0; powered = false; saveArmed = false; saveUsed = false;
      rally = 0; matchLongest = 0; rallyAnnounced = false;
      you.x = you.tx = CW * 0.25; you.y = REST_Y; you.vy = 0; you.onGround = true; you.mood = 0;
      botP.x = botP.tx = CW * 0.75; botP.y = REST_Y; botP.vy = 0; botP.onGround = true; botP.mood = 0;
      puffs = []; lines = []; heldDir = 0;
      cardEl.style.display = "none";
      msgEl.innerHTML = "🏐 <b>Spike Ball</b> vs " + rival.name;
      big("🏐 SERVE UP! First to 2 sets!", "#ffe14d");
      startServe(Math.random() < 0.5 ? "you" : "bot");
      hud();
    }

    // ---------- drawing ----------
    function drawPlayer(p, col, dark, face) {
      var cx = X(p.x), cy = Y(p.y), r = pz(PL_R);
      ctx.save(); ctx.translate(cx, cy);
      // shadow on the sand
      ctx.globalAlpha = 0.2; ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.ellipse(0, Y(GROUND) - cy, r * 1.1, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = dark; ctx.stroke();
      ctx.font = Math.round(r * 1.1) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(p.mood > 0.5 ? "🤩" : (p.onGround ? face : "😮"), 0, -r * 0.08);
      ctx.restore();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, Y(0), 0, Y(GROUND)); // sky
      g.addColorStop(0, "#8fd3ff"); g.addColorStop(1, "#d9f0ff");
      ctx.fillStyle = "#0a1622"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = g; ctx.fillRect(X(0), Y(0), pz(CW), pz(GROUND));
      ctx.fillStyle = "rgba(255,240,170,.8)"; ctx.beginPath(); ctx.arc(X(CW * 0.82), Y(60), pz(30), 0, Math.PI * 2); ctx.fill(); // sun
      var sg = ctx.createLinearGradient(0, Y(GROUND), 0, Y(CH)); // sand
      sg.addColorStop(0, "#f4d9a0"); sg.addColorStop(1, "#e6c07a");
      ctx.fillStyle = sg; ctx.fillRect(X(0), Y(GROUND), pz(CW), pz(CH - GROUND) + 40);
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = pz(3); ctx.strokeRect(X(0), Y(0), pz(CW), pz(GROUND));
      ctx.fillStyle = "#eee"; ctx.fillRect(X(NET_X - NET_W / 2), Y(NET_TOP), pz(NET_W), pz(GROUND - NET_TOP)); // net
      ctx.fillStyle = "#fff"; ctx.fillRect(X(NET_X - NET_W / 2 - 1), Y(NET_TOP), pz(NET_W + 2), pz(6));
      for (var li = 0; li < lines.length; li++) { // speed lines behind a spiked ball
        var L = lines[li]; ctx.globalAlpha = Math.max(0, L.life * 2);
        ctx.strokeStyle = ball.flame > 0 ? "#ff6b1f" : "#fff"; ctx.lineWidth = pz(3);
        ctx.beginPath(); ctx.moveTo(X(L.x - ball.vx * 0.03), Y(L.y - ball.vy * 0.03)); ctx.lineTo(X(L.x), Y(L.y)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      drawPlayer(botP, "#ff9a9a", "#a11f2f", botP.mood > 0.5 ? "🤩" : "😠");
      drawPlayer(you, "#8fd0ff", "#1f6ea1", "😀");
      var bx = X(ball.x), by = Y(ball.y), br = pz(BALL_R), sq = 1 - ball.squash * 0.3; // beach ball (squash/stretch)
      if (ball.flame > 0) { ctx.globalAlpha = 0.4; ctx.fillStyle = "#ff8a3d"; ctx.beginPath(); ctx.arc(bx, by, br * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.save(); ctx.translate(bx, by); ctx.scale(1 / sq, sq);
      var bg = ctx.createRadialGradient(-br * 0.3, -br * 0.3, br * 0.2, 0, 0, br);
      bg.addColorStop(0, "#fff"); bg.addColorStop(1, ball.flame > 0 ? "#ff6b1f" : "#ffd23f");
      ctx.beginPath(); ctx.arc(0, 0, br, 0, Math.PI * 2); ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = "#e05b6e"; ctx.lineWidth = pz(2.5);
      ctx.beginPath(); ctx.moveTo(0, -br); ctx.quadraticCurveTo(br * 0.6, 0, 0, br); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -br); ctx.quadraticCurveTo(-br * 0.6, 0, 0, br); ctx.stroke();
      ctx.restore();
      for (var pi = 0; pi < puffs.length; pi++) { // sand puffs
        var pf = puffs[pi]; ctx.globalAlpha = Math.max(0, pf.life * 1.6);
        ctx.fillStyle = "#f4e2bf"; ctx.beginPath(); ctx.arc(X(pf.x), Y(pf.y), pz(5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawPips();
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }
    function drawPips() {
      for (var s = 0; s < SETS_TO_WIN; s++) {
        ctx.fillStyle = s < sets[0] ? "#69f0ae" : "rgba(105,240,174,.25)";
        ctx.beginPath(); ctx.arc(X(30 + s * 22), Y(24), pz(7), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s < sets[1] ? "#ff6b6b" : "rgba(255,107,107,.25)";
        ctx.beginPath(); ctx.arc(X(CW - 30 - s * 22), Y(24), pz(7), 0, Math.PI * 2); ctx.fill();
      }
    }

    // ---------- input (canvas-only listeners die with the node) ----------
    function toLogical(px, py) { return { x: (px - OX) / S, y: (py - OY) / S }; }
    function pt(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    var down = false, dnX = 0, dnY = 0, dnT = 0, moved = 0;
    function press(px, py) {
      if (over || paused || !started) return;
      down = true; dnX = px; dnY = py; dnT = runT; moved = 0;
      you.tx = clamp(toLogical(px, py).x, youMinX, youMaxX);
    }
    function drag(px, py) {
      if (!down || over || paused || !started) return;
      moved += Math.abs(px - dnX);
      you.tx = clamp(toLogical(px, py).x, youMinX, youMaxX);
    }
    function release(px, py) {
      if (!down) return; down = false;
      var quick = (runT - dnT) < 0.22, still = Math.abs(px - dnX) < 24;
      var swipeUp = (dnY - py) > 40;
      if ((quick && still) || swipeUp) jumpP(you);
    }
    cv.addEventListener("mousedown", function (e) { var p = pt(e); press(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { if (down) { var p = pt(e); drag(p.x, p.y); } });
    cv.addEventListener("mouseup", function (e) { var p = pt(e); release(p.x, p.y); });
    cv.addEventListener("mouseleave", function () { down = false; });
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); press(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); drag(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); release(p.x, p.y); }, { passive: false });
    function onKeyDown(e) {
      if (e.key === "ArrowLeft") heldDir = -1;
      else if (e.key === "ArrowRight") heldDir = 1;
      else if (e.key === " " || e.key === "ArrowUp" || e.key === "Spacebar") { jumpP(you); e.preventDefault(); }
    }
    function onKeyUp(e) {
      if (e.key === "ArrowLeft" && heldDir === -1) heldDir = 0;
      else if (e.key === "ArrowRight" && heldDir === 1) heldDir = 0;
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    powBtn.onclick = powerQuiz;
    saveBtn.onclick = saveQuiz;

    // ---------- simulation ----------
    function stepSim(dt) {
      if (!started || over) return;
      runT += dt;
      if (heldDir !== 0) you.tx = clamp(you.x + heldDir * 40, youMinX, youMaxX);
      botAI(dt);
      stepPlayer(you, dt); stepPlayer(botP, dt);
      ballStep(dt);
      you.mood = Math.max(0, you.mood - dt * 0.5); botP.mood = Math.max(0, botP.mood - dt * 0.5);
      for (var i = puffs.length - 1; i >= 0; i--) { var p = puffs[i]; p.vy += G * 0.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) puffs.splice(i, 1); }
      for (var k = lines.length - 1; k >= 0; k--) { lines[k].life -= dt * 2; if (lines[k].life <= 0) lines.splice(k, 1); }
      updateButtons();
    }
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; // clamp — no huge catch-up steps
      if (!paused) stepSim(dt);
      draw();
    }

    // ---------- exit / banking ----------
    function bankExit() {
      if (over || !started) return;
      if (!interacted) return; // an untouched match banks nothing
      persistStats(false);
      var bank = bankRun(false);
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🏐 Spike Ball banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
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

    // ---------- test API (specs are written against this exact shape) ----------
    cv._spike = {
      state: function () {
        return {
          you: youPts, bot: botPts, sets: [sets[0], sets[1]],
          serving: serving, rally: rally, meter: meter, powered: powered,
          saveUsed: saveUsed, over: over, won: won, banked: banked,
          ball: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy }
        };
      },
      begin: begin,
      moveTo: function (x) { you.tx = clamp(x, youMinX, youMaxX); you.x = you.tx; },
      jump: function () { jumpP(you); },
      placeBall: function (x, y, vx, vy) {
        ball.x = clamp(x, BALL_R, CW - BALL_R); ball.y = clamp(y, BALL_R, GROUND - BALL_R);
        ball.vx = vx || 0; ball.vy = vy || 0; ball.flame = 0; ball.spike = 0; ball.squash = 0;
        serveDelay = 0; // ball is live immediately
      },
      touch: function () { contactBall(you, true); hud(); },
      scorePoint: function (who) { awardPoint(who === "bot" ? "bot" : "you"); },
      fillMeter: function () { meter = 1; updateButtons(); if (sfx && sfx.chime) sfx.chime(); },
      powerQuiz: powerQuiz,
      saveQuiz: saveQuiz,
      tick: function (sec) {
        var left = sec || 0;
        while (left > 0) { var d = Math.min(0.05, left); stepSim(d); left -= d; }
        draw();
      },
      rival: function () { return { name: rival.name, id: rival.id, skill: skill, idx: curOpp }; }
    };

    // ---------- boot ----------
    hud();
    showPicker();
    if (global._spikedemo) { // screenshot seed: a lively mid-rally tableau (9-8, set 2)
      global._spikedemo = 0;
      begin(1);
      sets = [1, 1]; youPts = 9; botPts = 8;
      serveDelay = 0;
      ball.x = NET_X + 30; ball.y = 150; ball.vx = 260; ball.vy = 360; ball.spike = 0.5; ball.squash = 0.5;
      spawnLines();
      you.x = you.tx = NET_X - 70; you.y = REST_Y - 90; you.vy = -120; you.onGround = false;
      botP.x = botP.tx = NET_X + 70; botP.y = REST_Y - 80; botP.vy = 100; botP.onGround = false;
      paused = true; hud(); draw();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxSpike = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
