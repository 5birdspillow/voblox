/*
 * Voblox arcade game — 🏒 AIR HOCKEY (the classic table, vs a bot ladder).
 * Portrait table (letterboxed): YOUR mallet on the bottom half (drag anywhere in
 * your half — it follows your finger with a speed cap so it feels physical), the
 * BOT'S mallet up top. A puck with friction + wall bounces; goals top & bottom
 * center. First to 7 wins. After each goal the puck resets to the scored-on side's
 * half with a 1s countdown.
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🔥 POWER PUCK: hitting the puck fills a charge meter; full → a button offers
 *     a WORD. Correct = your NEXT strike is a flaming triple-speed rocket the bot
 *     fumbles. Wrong = play on, meter dips a little.
 *   - 🧤 CLUTCH SAVE: when the BOT reaches match point (6), a WORD can shrink your
 *     goal 25% for the rest of the match. Wrong = play on, no punishment.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("airhockey")
 * per match via bankRun(), banked on match end, quit, AND app-close. Stats persist
 * additively (wins7, bestStreak).
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  // fixed logical table — scaled to the canvas so specs stay resolution-proof
  var AW = 400, AH = 660;
  var PUCK_R = 15, MALLET_R = 28;
  var GOAL_W = 150;           // goal-mouth width (centered on AW/2)
  var WIN_AT = 7;
  var FRICTION = 0.62;        // per-second velocity decay (air-table glide)
  var REST = 0.92;           // wall/goal-post restitution
  var BASE_HIT = 320;        // base impulse a mallet imparts on contact
  var MAXV = 2200;           // hard speed cap (flame rockets ride near the top)

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("airhockey");
    // additive-only save fields (never touch stats.best/wins/plays — recordGame owns those)
    stats.wins7 = stats.wins7 || 0;
    stats.bestStreak = stats.bestStreak || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap airhockey";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="ahcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="ahmsg">🏒 Air Hockey</div>' +
      '<div class="grow"><span id="ahscore">0 : 0</span><span id="ahchg">⚡ 0%</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="ahbig"></div>' +
      '<button id="ahpow" type="button" style="display:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 40px);' +
      'transform:translateX(-50%);z-index:8;background:linear-gradient(#ffb24d,#ff6b1f);color:#fff;border:none;border-radius:16px;' +
      'padding:14px 22px;font-family:inherit;font-weight:900;font-size:18px;box-shadow:0 6px 0 #b9491a,0 10px 24px #0006;cursor:pointer">' +
      '🔥 POWER PUCK — answer a word!</button>' +
      '<button id="ahclutch" type="button" style="display:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 96px);' +
      'transform:translateX(-50%);z-index:8;background:linear-gradient(#5be07a,#1fa34d);color:#fff;border:none;border-radius:16px;' +
      'padding:12px 20px;font-family:inherit;font-weight:900;font-size:16px;box-shadow:0 6px 0 #17773a,0 10px 24px #0006;cursor:pointer">' +
      '🧤 CLUTCH SAVE — answer a word!</button>' +
      '<div class="gover" id="ahq" style="display:none"></div>' +
      '<div class="gover" id="ahcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#ahcv"), ctx = cv.getContext("2d");
    var qEl = document.getElementById("ahq"), cardEl = document.getElementById("ahcard");
    var msgEl = document.getElementById("ahmsg"), bigEl = document.getElementById("ahbig");
    var powBtn = document.getElementById("ahpow"), clutchBtn = document.getElementById("ahclutch");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- responsive letterbox (ONE logic space) ----------
    var W, H, S, OX, OY;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      var reserve = 96; // room for the HUD strip
      S = Math.min(W / AW, (H - reserve) / AH);
      OX = Math.max(0, (W - AW * S) / 2);
      OY = Math.max(30, (H - reserve - AH * S) / 2 + 30);
    }
    resize(); window.addEventListener("resize", resize);
    function X(x) { return OX + x * S; }
    function Y(y) { return OY + y * S; }
    function pz(n) { return n * S; }

    // ---------- opponent ladder (3 named rivals near Leo's rank) ----------
    var baseSkill = P.botSkillFor(stats.rankPts);
    var opponents = Bots.pickOpponents(3, baseSkill).slice();
    opponents.sort(function (a, b) { return a.skill - b.skill; }); // easiest → hardest
    while (opponents.length < 3 && Bots.ALL.length) opponents.push(opponents[opponents.length - 1] || Bots.ALL[0]);
    var TIERS = ["🐣 Rookie", "😎 Pro", "🔥 Champ"];
    var curOpp = 0, rival = opponents[0], skill = rival.skill;

    // ---------- match state ----------
    var running = true, raf = 0, lastT = performance.now(), runT = 0;
    var started = false, over = false, won = false, paused = false, banked = false;
    var you = 0, bot = 0, charge = 0, powered = false, clutch = false, clutchOffered = false;
    var winStreak = 0, interacted = false, lastFmt = null, resetT = 0, countTxt = "";
    var puck = { x: AW / 2, y: AH / 2, vx: 0, vy: 0, flame: 0 };
    var myMallet = { x: AW / 2, y: AH - 70, tx: AW / 2, ty: AH - 70, vx: 0, vy: 0, squash: 0, mine: true };
    var botMallet = { x: AW / 2, y: 70, tx: AW / 2, ty: 70, vx: 0, vy: 0, squash: 0, mine: false };
    var trail = [];

    function bottomGoalW() { return clutch ? GOAL_W * 0.75 : GOAL_W; }
    function inGoalX(x, w) { return Math.abs(x - AW / 2) < w / 2; }
    function matchPoint() { return bot >= WIN_AT - 1 && !over; }

    // ---------- HUD ----------
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1100); }
    function hud() {
      document.getElementById("ahscore").textContent = you + " : " + bot;
      document.getElementById("ahchg").textContent = powered ? "🔥 ARMED" : "⚡ " + Math.round(charge * 100) + "%";
      updateButtons();
    }
    function updateButtons() {
      var live = started && !over && !paused;
      powBtn.style.display = (live && charge >= 1 && !powered) ? "block" : "none";
      clutchBtn.style.display = (live && matchPoint() && !clutch) ? "block" : "none";
    }

    // ---------- charge / word hooks ----------
    function addCharge(a) {
      if (powered) return;
      charge = Math.min(1, charge + a);
      if (charge >= 1 && sfx && sfx.chime) sfx.chime();
      updateButtons();
    }
    function powerQuiz() {
      if (over || !started) return;
      paused = true; updateButtons();
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "🔥 POWER PUCK! Answer to arm a flaming strike!",
        lastFormat: lastFmt, skippable: false,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt; paused = false;
          if (ok) {
            powered = true; charge = 0;
            big("🔥 POWER PUCK ARMED — your next strike ROCKETS!", "#ff9f43");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) { juice.shake(5); juice.burst(W / 2, H * 0.7, "#ff9f43", 20); }
          } else {
            charge = Math.max(0, charge - 0.3);
            big("Fizzled — keep studying and try again!", "#8ecdf7");
          }
          hud();
        }
      });
    }
    function clutchQuiz() {
      if (over || !started) return;
      clutchOffered = true;
      paused = true; updateButtons();
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "🧤 CLUTCH SAVE! Answer to shrink your goal!",
        lastFormat: lastFmt, skippable: false,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt; paused = false;
          if (ok) {
            clutch = true;
            big("🧤 CLUTCH! Your goal shrinks — hold the line!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(W / 2, H * 0.9, "#69f0ae", 18);
          } else {
            big("No worries — play on!", "#8ecdf7"); // never punished
          }
          hud();
        }
      });
    }

    // ---------- physics ----------
    function clampPuckSpeed() {
      var sp = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
      if (sp > MAXV) { puck.vx *= MAXV / sp; puck.vy *= MAXV / sp; }
    }
    function wallFx() { if (sfx && sfx.pop && Math.random() < 0.35) sfx.pop(); if (juice && Math.random() < 0.3) juice.shake(2); }
    function hitMallet(m) {
      var dx = puck.x - m.x, dy = puck.y - m.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var min = PUCK_R + MALLET_R;
      if (d >= min || d === 0) return;
      var nx = dx / d, ny = dy / d;
      puck.x = m.x + nx * min; puck.y = m.y + ny * min; // separate
      var vn = puck.vx * nx + puck.vy * ny;
      if (vn < 0) { puck.vx -= 2 * vn * nx; puck.vy -= 2 * vn * ny; } // reflect
      var mspeed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      var hit = BASE_HIT + mspeed * 0.55;
      puck.vx = puck.vx * 0.4 + nx * hit + m.vx * 0.5;
      puck.vy = puck.vy * 0.4 + ny * hit + m.vy * 0.5;
      m.squash = 1;
      if (m.mine) {
        if (powered) { puck.vx *= 3; puck.vy *= 3; puck.flame = 1.5; powered = false; big("🔥 FLAMING ROCKET!", "#ff6b1f"); }
        addCharge(0.34);
        if (juice) juice.burst(X(puck.x), Y(puck.y), puck.flame > 0 ? "#ff6b1f" : "#69f0ae", 10);
      } else {
        // bot strikes toward one of YOUR corners; sharper bots aim harder
        var corner = (Math.random() < 0.5) ? AW * 0.16 : AW * 0.84;
        puck.vx += (corner - puck.x) * (0.5 + skill * 0.8);
        if (juice) juice.burst(X(puck.x), Y(puck.y), "#ff8a8a", 8);
      }
      clampPuckSpeed();
      if (sfx && sfx.pop) sfx.pop();
      interacted = true;
    }
    function physics(dt) {
      if (resetT > 0) { // held during the post-goal countdown
        resetT = Math.max(0, resetT - dt);
        countTxt = resetT > 0 ? String(Math.ceil(resetT)) : "";
        return;
      }
      var f = Math.pow(FRICTION, dt);
      puck.vx *= f; puck.vy *= f;
      if (puck.flame > 0) puck.flame = Math.max(0, puck.flame - dt);
      clampPuckSpeed();
      var sp = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
      var n = Math.max(1, Math.ceil(sp * dt / (PUCK_R * 0.6))); // substep so a wall/mallet is never tunneled
      var sdt = dt / n;
      for (var i = 0; i < n; i++) {
        puck.x += puck.vx * sdt; puck.y += puck.vy * sdt;
        if (puck.x - PUCK_R < 0) { puck.x = PUCK_R; puck.vx = Math.abs(puck.vx) * REST; wallFx(); }
        else if (puck.x + PUCK_R > AW) { puck.x = AW - PUCK_R; puck.vx = -Math.abs(puck.vx) * REST; wallFx(); }
        if (puck.y - PUCK_R < 0) {
          if (inGoalX(puck.x, GOAL_W)) { scoreGoal("you"); return; }   // into the TOP goal = YOU score
          puck.y = PUCK_R; puck.vy = Math.abs(puck.vy) * REST; wallFx();
        } else if (puck.y + PUCK_R > AH) {
          if (inGoalX(puck.x, bottomGoalW())) { scoreGoal("bot"); return; } // into YOUR (bottom) goal = BOT scores
          puck.y = AH - PUCK_R; puck.vy = -Math.abs(puck.vy) * REST; wallFx();
        }
        hitMallet(myMallet);
        hitMallet(botMallet);
      }
      trail.push({ x: puck.x, y: puck.y, life: 1 });
      if (trail.length > 14) trail.shift();
    }

    // ---------- mallets ----------
    function clampMallet(m) {
      m.x = clamp(m.x, MALLET_R, AW - MALLET_R);
      if (m.mine) m.y = clamp(m.y, AH / 2 + 4, AH - 4);
      else m.y = clamp(m.y, 4, AH / 2 - 4);
    }
    function moveMallet(m, dt, cap) {
      var px = m.x, py = m.y;
      var dx = m.tx - m.x, dy = m.ty - m.y, d = Math.sqrt(dx * dx + dy * dy);
      var step = cap * dt;
      if (d > step && d > 0) { m.x += dx / d * step; m.y += dy / d * step; }
      else { m.x = m.tx; m.y = m.ty; }
      clampMallet(m);
      m.vx = (m.x - px) / dt; m.vy = (m.y - py) / dt;
      m.squash = Math.max(0, m.squash - dt * 4);
    }
    // the bot: guards its goal, chases loose pucks in its half, strikes for your corners
    function botAI() {
      var m = botMallet, homeX = AW / 2, homeY = 66;
      var tx = homeX, ty = homeY;
      var puckInReach = puck.y < AH * 0.52;
      var fumble = puck.flame > 0; // the flaming rocket rattles even good goalies
      if (puckInReach && !fumble) {
        var lead = 0.10 * skill; // higher skill predicts the puck's path
        tx = puck.x + puck.vx * lead;
        var aggro = 0.30 + skill * 0.45; // how far it ventures out to attack
        ty = clamp(puck.y - PUCK_R - MALLET_R * 0.2, homeY * 0.5, AH * aggro);
      } else {
        tx = homeX + (puck.x - homeX) * (0.35 + skill * 0.25); // shade toward the puck to guard
        ty = homeY;
        if (fumble && Math.random() < 0.5) { tx = m.x; ty = m.y; } // hesitate on the rocket
      }
      m.tx = clamp(tx, MALLET_R, AW - MALLET_R);
      m.ty = clamp(ty, 4, AH / 2 - 4);
    }

    // ---------- scoring / flow ----------
    function goalFx(who) {
      if (sfx) { if (sfx.buzz) sfx.buzz(); if (sfx.fanfare && who === "you") sfx.fanfare(); }
      if (juice) {
        juice.shake(8);
        var col = who === "you" ? ["#ffd23f", "#69f0ae", "#40c4ff"] : ["#ff6b6b", "#ff9f43"];
        for (var i = 0; i < 4; i++) juice.burst(W * (0.2 + i * 0.2), H * 0.4, col[i % col.length], 14);
      }
      big(who === "you" ? "🚨 GOAL! Crowd goes wild!" : "😤 " + rival.name + " scores!", who === "you" ? "#69f0ae" : "#ff8a8a");
    }
    function resetAfterGoal(who) {
      // puck returns to the SCORED-ON side's half (you scored → reset up top; bot scored → reset near you)
      var topHalf = (who === "you");
      puck.x = AW / 2; puck.y = topHalf ? AH * 0.28 : AH * 0.72;
      puck.vx = 0; puck.vy = (topHalf ? 1 : -1) * 110; puck.flame = 0;
      trail = []; resetT = 1; countTxt = "1";
    }
    function scoreGoal(who) {
      if (over || !started) return;
      interacted = true;
      if (who === "you") you++; else bot++;
      goalFx(who); hud();
      if (you >= WIN_AT) { endMatch(true); return; }
      if (bot >= WIN_AT) { endMatch(false); return; }
      if (bot === WIN_AT - 1 && !clutch && !clutchOffered) { // bot at match point → offer the clutch save
        big("🧤 MATCH POINT against you — tap CLUTCH SAVE!", "#ffd740");
      }
      resetAfterGoal(who);
    }

    // ---------- economy: ONE banking path (slice.js/clash.js pattern) ----------
    function rewards(win) {
      var margin = you - bot;
      return {
        win: !!win,
        score: you + Math.max(0, margin),                                   // your goals + margin
        rankPtsDelta: win ? Math.min(12, 6 + winStreak * 2) : 2,
        xp: Math.min(80, 12 + you * 6 + (win ? 24 : 0)),
        gems: win ? 24 + you * 2 : Math.min(14, 4 + you * 3)
      };
    }
    function bankRun(win) {
      if (banked) return null;
      banked = true;
      var rw = rewards(win);
      var res = store.recordGame ? store.recordGame("airhockey", rw) : null;
      return { rw: rw, res: res };
    }
    function endMatch(win) {
      if (over) return;
      over = true; paused = true; won = win;
      if (win) {
        stats.wins7 = (stats.wins7 || 0) + 1;
        winStreak++;
        if (winStreak > (stats.bestStreak || 0)) stats.bestStreak = winStreak;
        if (store.save) store.save();
      } else winStreak = 0;
      var bank = bankRun(win) || { rw: rewards(win), res: null };
      showEnd(win, bank.rw, bank.res);
    }
    function showEnd(win, rw, res) {
      updateButtons();
      var payRow = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>';
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:460px">' +
        '<div style="font-size:46px">' + (win ? "🏆" : "🥅") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (win ? "🏒 VICTORY over " + rival.name + "!" : "😤 " + rival.name + " takes it…") + '</div>' +
        payRow +
        '<div style="margin:2px 0;font-size:16px">Final <b>' + you + ' : ' + bot + '</b>' + (res && res.rankedUp ? '  ·  🎖 RANK UP!' : '') + '</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:8px">🏆 ' + (stats.wins7 || 0) + ' wins · 🔥 best streak ' + (stats.bestStreak || 0) + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
        '<button class="submit" id="ahrematch" type="button">Rematch ➜</button>' +
        '<button class="embtn" id="ahnext" style="min-width:130px"><span class="ebl">🔀 Next opponent</span><span class="ebs">pick again</span></button>' +
        '<button class="wqskip" id="ahleave" type="button">Leave</button></div></div>';
      cardEl.style.display = "flex";
      if (win && sfx && sfx.fanfare) sfx.fanfare();
      if (win && juice) { juice.shake(6); for (var c = 0; c < 6; c++) juice.burst(W * (0.15 + c * 0.14), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb", "#ffb01f"][c], 16); }
      document.getElementById("ahrematch").onclick = function () { begin(curOpp); };
      document.getElementById("ahnext").onclick = showLadder;
      document.getElementById("ahleave").onclick = exit;
    }

    // ---------- ladder / begin ----------
    function showLadder() {
      started = false; over = false; paused = true;
      updateButtons();
      var btns = opponents.map(function (o, i) {
        var face = (o.avatar && o.avatar.face && o.avatar.face.length <= 2) ? o.avatar.face : "🙂";
        return '<button class="embtn" data-opp="' + i + '" style="min-width:120px">' +
          '<span class="ebl">' + face + " " + o.name + '</span><span class="ebs">' + TIERS[i] + '</span></button>';
      }).join("");
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center;max-width:520px">' +
        '<div style="font-size:46px">🏒</div><div class="wqtitle" style="font-size:22px">Air Hockey</div>' +
        '<div style="margin:4px 0 10px;color:#5a6b7a;font-weight:bold">Pick your opponent — first to ' + WIN_AT + ' wins the table!</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + btns + '</div>' +
        '<div style="font-size:12px;color:#8a98a8;margin-top:8px">🏆 Wins: ' + (stats.wins7 || 0) + ' · 🔥 Best streak: ' + (stats.bestStreak || 0) + '</div></div>';
      cardEl.style.display = "flex";
      Array.prototype.forEach.call(cardEl.querySelectorAll("[data-opp]"), function (b) {
        b.onclick = function () { begin(+b.dataset.opp); };
      });
    }
    function begin(oppIdx) {
      if (oppIdx === undefined || oppIdx === null) oppIdx = curOpp;
      curOpp = clamp(oppIdx | 0, 0, opponents.length - 1);
      rival = opponents[curOpp]; skill = rival.skill;
      started = true; over = false; won = false; paused = false; banked = false;
      you = 0; bot = 0; charge = 0; powered = false; clutch = false; clutchOffered = false;
      interacted = false; resetT = 0.8; countTxt = "";
      puck.x = AW / 2; puck.y = AH / 2; puck.vx = 0; puck.vy = (Math.random() < 0.5 ? -1 : 1) * 120; puck.flame = 0;
      myMallet.x = myMallet.tx = AW / 2; myMallet.y = myMallet.ty = AH - 70; myMallet.vx = myMallet.vy = 0;
      botMallet.x = botMallet.tx = AW / 2; botMallet.y = botMallet.ty = 66; botMallet.vx = botMallet.vy = 0;
      trail = [];
      cardEl.style.display = "none";
      msgEl.innerHTML = "🏒 <b>Air Hockey</b> vs " + rival.name;
      big("🏒 FACE OFF! First to " + WIN_AT + "!", "#ffe14d");
      hud();
    }

    // ---------- drawing ----------
    function disc(cx, cy, r, fill, ring) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      if (ring) { ctx.lineWidth = Math.max(2, r * 0.18); ctx.strokeStyle = ring; ctx.stroke(); }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // rink surface
      var g = ctx.createLinearGradient(0, Y(0), 0, Y(AH));
      g.addColorStop(0, "#dfefff"); g.addColorStop(0.5, "#c7e3ff"); g.addColorStop(1, "#dfefff");
      ctx.fillStyle = "#0a1622"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = g; ctx.fillRect(X(0), Y(0), pz(AW), pz(AH));
      // border
      ctx.strokeStyle = "#1f3550"; ctx.lineWidth = pz(6);
      ctx.strokeRect(X(0), Y(0), pz(AW), pz(AH));
      // center line + circle
      ctx.strokeStyle = "rgba(40,90,150,.55)"; ctx.lineWidth = pz(3);
      ctx.beginPath(); ctx.moveTo(X(0), Y(AH / 2)); ctx.lineTo(X(AW), Y(AH / 2)); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(AW / 2), Y(AH / 2), pz(58), 0, Math.PI * 2); ctx.stroke();
      // goals (top = bot's, bottom = yours; yours may be shrunk by CLUTCH)
      ctx.fillStyle = "#ff6b6b";
      ctx.fillRect(X(AW / 2 - GOAL_W / 2), Y(0) - pz(2), pz(GOAL_W), pz(8));
      ctx.fillStyle = "#69f0ae";
      var bw = bottomGoalW();
      ctx.fillRect(X(AW / 2 - bw / 2), Y(AH) - pz(6), pz(bw), pz(8));
      // puck trail
      for (var i = 0; i < trail.length; i++) {
        var tp = trail[i], a = i / trail.length;
        ctx.globalAlpha = a * 0.5;
        disc(X(tp.x), Y(tp.y), pz(PUCK_R) * (0.5 + a * 0.5), puck.flame > 0 ? "#ff9f43" : "#3a5f8a", null);
      }
      ctx.globalAlpha = 1;
      // mallets (squash = brief flatten on a strike)
      drawMallet(botMallet, "#ff6b6b", "#a11f2f");
      drawMallet(myMallet, "#40c4ff", "#1f6ea1");
      // puck
      if (puck.flame > 0) { disc(X(puck.x), Y(puck.y), pz(PUCK_R) * 1.5, "rgba(255,140,40,.35)", null); }
      disc(X(puck.x), Y(puck.y), pz(PUCK_R), puck.flame > 0 ? "#ff6b1f" : "#12233a", puck.flame > 0 ? "#ffd23f" : "#3a5f8a");
      // score pips along the sides
      drawPips();
      // post-goal countdown
      if (resetT > 0 && countTxt) {
        ctx.fillStyle = "rgba(20,35,58,.85)"; ctx.font = "bold " + Math.round(pz(70)) + "px Trebuchet MS, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(countTxt, X(AW / 2), Y(AH / 2));
      }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }
    function drawMallet(m, fill, ring) {
      var r = pz(MALLET_R), sq = 1 - m.squash * 0.25;
      ctx.save(); ctx.translate(X(m.x), Y(m.y)); ctx.scale(1 / sq, sq);
      disc(0, 0, r, fill, ring); disc(0, 0, r * 0.42, ring, null);
      ctx.restore();
    }
    function drawPips() {
      for (var i = 0; i < WIN_AT; i++) {
        ctx.fillStyle = i < bot ? "#ff6b6b" : "rgba(255,107,107,.22)";
        ctx.beginPath(); ctx.arc(X(6), Y(40 + i * 26), pz(6), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = i < you ? "#69f0ae" : "rgba(105,240,174,.22)";
        ctx.beginPath(); ctx.arc(X(AW - 6), Y(AH - 40 - i * 26), pz(6), 0, Math.PI * 2); ctx.fill();
      }
    }

    // ---------- input (drag the mallet; canvas-only listeners die with the node) ----------
    function toLogical(px, py) { return { x: (px - OX) / S, y: (py - OY) / S }; }
    function setTargetFrom(px, py) {
      if (over || paused || !started) return;
      var p = toLogical(px, py);
      if (p.y < AH / 2) p.y = AH / 2 + 4; // clamp into your half
      myMallet.tx = clamp(p.x, MALLET_R, AW - MALLET_R);
      myMallet.ty = clamp(p.y, AH / 2 + 4, AH - 4);
    }
    var dragging = false;
    function pt(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    cv.addEventListener("mousedown", function (e) { var p = pt(e); dragging = true; setTargetFrom(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { if (!dragging) return; var p = pt(e); setTargetFrom(p.x, p.y); });
    cv.addEventListener("mouseup", function () { dragging = false; });
    cv.addEventListener("mouseleave", function () { dragging = false; });
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); dragging = true; setTargetFrom(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); setTargetFrom(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); dragging = false; }, { passive: false });
    powBtn.onclick = powerQuiz;
    clutchBtn.onclick = clutchQuiz;

    // ---------- simulation step + loop ----------
    function step(dt) {
      if (!started || over || paused) return;
      runT += dt;
      botAI();
      moveMallet(myMallet, dt, 1500); // your mallet is snappy (follows the finger)
      moveMallet(botMallet, dt, 240 + skill * 380); // sharper bots move faster
      physics(dt);
      updateButtons();
    }
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; // clamp — no huge catch-up steps
      step(dt);
      draw();
    }

    // ---------- exit / banking ----------
    function bankExit() {
      if (over || !started) return;
      if (you === 0 && bot === 0 && !interacted) return; // an untouched match banks nothing
      var bank = bankRun(false);
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🏒 Air Hockey banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
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

    // ---------- test API (specs are written against this exact shape) ----------
    cv._airhockey = {
      state: function () {
        return {
          you: you, bot: bot, charge: charge, powered: powered, clutch: clutch,
          over: over, won: won, banked: banked, matchPoint: matchPoint(),
          puck: { x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy }
        };
      },
      begin: begin,
      malletTo: function (x, y) {
        myMallet.tx = clamp(x, MALLET_R, AW - MALLET_R);
        myMallet.ty = clamp(y, AH / 2 + 4, AH - 4);
        myMallet.x = myMallet.tx; myMallet.y = myMallet.ty; myMallet.vx = 0; myMallet.vy = 0;
      },
      placePuck: function (x, y, vx, vy) {
        puck.x = clamp(x, PUCK_R, AW - PUCK_R); puck.y = clamp(y, PUCK_R, AH - PUCK_R);
        puck.vx = vx || 0; puck.vy = vy || 0; puck.flame = 0; resetT = 0; trail = [];
      },
      strike: function (dx, dy) {
        var boost = powered ? 3 : 1;
        puck.vx = (dx || 0) * boost; puck.vy = (dy || 0) * boost;
        if (powered) { puck.flame = 1.5; powered = false; }
        clampPuckSpeed();
        addCharge(0.34); myMallet.squash = 1; interacted = true;
        if (sfx && sfx.whoosh) sfx.whoosh();
        hud();
      },
      fillCharge: function () { charge = 1; updateButtons(); if (sfx && sfx.chime) sfx.chime(); },
      powerQuiz: powerQuiz,
      clutchQuiz: clutchQuiz,
      scoreGoal: scoreGoal,
      tick: function (sec) {
        var left = sec || 0;
        while (left > 0) { var d = Math.min(0.05, left); var sp = paused; paused = false; step(d); if (sp) paused = sp; left -= d; }
        draw();
      },
      rival: function () { return { name: rival.name, id: rival.id, skill: skill, idx: curOpp }; }
    };

    // ---------- boot ----------
    hud();
    showLadder();
    if (global._airhockeydemo) { // screenshot seed: a lively mid-match tableau
      global._airhockeydemo = 0;
      begin(1);
      you = 4; bot = 3; charge = 0.8;
      puck.x = AW * 0.5; puck.y = AH * 0.45; puck.vx = 190; puck.vy = -330;
      for (var ti = 0; ti < 8; ti++) trail.push({ x: puck.x - puck.vx * ti * 0.02, y: puck.y - puck.vy * ti * 0.02, life: 1 });
      myMallet.x = myMallet.tx = AW * 0.42; myMallet.y = myMallet.ty = AH - 90;
      botMallet.x = botMallet.tx = AW * 0.6; botMallet.y = botMallet.ty = 120;
      paused = true; hud(); draw();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxAirHockey = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
