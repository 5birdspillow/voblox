/*
 * Voblox arcade game — 💥 WALLY CRASH (a carnival stunt-launch prize game).
 * Fire Wally the crash-test daredevil 🤸 out of a cannon, watch him arc,
 * BOUNCE twice with a squashy "BOING!", and flop 💫 onto a prize board of
 * Vobux pads (5 · 10 · 15 · 25 · 50 … and one tiny golden ⭐ JACKPOT 100 far out).
 *
 * VOCAB IS THE CREDIT ENGINE, NEVER PUNISHMENT:
 *   - 🎟 CREDITS: every launch costs one credit. You earn a credit by answering
 *     a word (miniQuiz) — the "🎟 Get a credit" button is the heart of the loop.
 *     Correct = +1 credit (bank up to 5). Wrong = a kind nudge, try again free.
 *   - The physics are wind-LESS and consistent, so kids learn the power↔distance
 *     map by feel. The jackpot pad is small and far — a near-perfect ~90 power.
 * Economy: the session total is REAL Vobux, banked ONCE per session via bankRun()
 * (guarded by `banked`) on Leave AND on app-close. miniQuiz answers pay normally
 * through store.record. Persists additively: bestPad, jackpots, totalWon.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var MW = 1000, MH = 560;
  var CANNON_X = 92, GROUND_Y = 452;
  // power (0..1) maps LINEARLY to a resting x: restX = REACH_MIN + power*REACH_SPAN.
  // Tuned so the jackpot's dead-center (x 948) is hit at power 0.90 — adult-hard.
  var REACH_MIN = 210, REACH_SPAN = 820;
  var METER_PERIOD = 1.2;  // seconds for one full 0→1→0 power sweep
  var ANGLE_MIN = 0.3, ANGLE_MAX = 1.2, ANGLE_PERIOD = 1.0; // radians; sweep after the power tap
  var FLIGHT_TIME = 1.55;  // seconds from cannon to final flop
  var MAX_CREDITS = 5;

  // the prize board: pads SHRINK as the value climbs; the jackpot is tiny & far.
  var PADS = [
    { value: 5,   x: 300, w: 150, col: "#7ed957" },
    { value: 10,  x: 450, w: 120, col: "#4fc3f7" },
    { value: 15,  x: 590, w: 100, col: "#ffd23f" },
    { value: 25,  x: 710, w: 84,  col: "#ff9f43" },
    { value: 50,  x: 815, w: 66,  col: "#ff6b9d" },
    { value: 100, x: 948, w: 44,  col: "#ffe14d", jackpot: true }
  ];
  var CROWD = ["🧒", "👧", "🧑", "👴", "🧓", "👦", "🤠", "🧑‍🎤"];

  function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

  // where Wally comes to rest for a given power + angle (the ONLY payout inputs).
  // Real ballistics: range peaks at 45° (sin 2θ = 1) — so the old power-only
  // mapping is exactly the θ=45° slice, and steep or shallow shots fall short.
  function powerToRestX(power, ang) {
    if (ang == null) ang = Math.PI / 4;
    return REACH_MIN + clamp(power, 0, 1) * Math.max(0.1, Math.sin(2 * ang)) * REACH_SPAN;
  }
  // the pad Wally STOPS on: jackpot only if he lands inside its narrow slot,
  // otherwise the NEAREST regular pad by center (so a gap always pays — never 0,
  // and the smallest consolation is the 5 pad).
  function resolvePad(restX) {
    var jp = PADS[PADS.length - 1];
    if (restX >= jp.x - jp.w / 2 && restX <= jp.x + jp.w / 2) return jp;
    var best = PADS[0], bd = 1e9;
    for (var i = 0; i < PADS.length; i++) {
      if (PADS[i].jackpot) continue;
      var d = Math.abs(restX - PADS[i].x);
      if (d < bd) { bd = d; best = PADS[i]; }
    }
    return best;
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("wally");
    // additive, never-renamed save fields (NOT stats.best — that's the platform's)
    stats.bestPad = stats.bestPad || 0;
    stats.jackpots = stats.jackpots || 0;
    stats.totalWon = stats.totalWon || 0;
    // credits PERSIST (additive save field) — the welcome credit is one-time EVER,
    // so quitting and re-entering never mints a fresh one
    if (stats.credits == null) stats.credits = 1;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap wally";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="wlcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="wlmsg">💥 Wally Crash — tap to aim, tap to FIRE!</div>' +
      '<div class="grow"><span id="wlcred">🎟 1</span><span id="wlsess">💰 session: 0</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="wlbig"></div>' +
      '<button id="wlget" type="button" style="position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 26px);' +
      'transform:translateX(-50%);z-index:8;background:linear-gradient(#8ef0a0,#31c463);color:#053014;' +
      'border:none;border-radius:16px;padding:13px 20px;font-family:inherit;font-weight:900;font-size:17px;' +
      'box-shadow:0 6px 0 #1c8a3f,0 10px 24px #0006;cursor:pointer">🎟 Get a credit — answer a word!</button>' +
      '<div class="gover" id="wlq" style="display:none"></div>' +
      '<div class="gover" id="wlcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#wlcv"), ctx = cv.getContext("2d");
    var wlq = document.getElementById("wlq"), wlcard = document.getElementById("wlcard");
    var msgEl = document.getElementById("wlmsg"), bigEl = document.getElementById("wlbig");
    var getBtn = document.getElementById("wlget");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H, S, OX, OY;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      S = Math.min(W / MW, H / MH);
      OX = (W - MW * S) / 2; OY = (H - MH * S) / 2;
    }
    resize();
    window.addEventListener("resize", resize);
    function PX(x) { return OX + x * S; }
    function PY(y) { return OY + y * S; }

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var credits = stats.credits;     // persisted satchel (see above)
    var session = 0;                 // REAL Vobux earned this session (banked once)
    var phase = "idle";              // idle | aiming | angling | flying | landed
    var meter = 0, meterPhase = 0;   // power sweep 0..1
    var angle = Math.PI / 4, anglePhase = 0; // angle sweep (locked after the power tap)
    var lastPad = null;              // value of the pad last landed on
    var banked = false, sessionJackpots = 0, sessionWonJackpot = false;
    var paused = false, lastFmt = null;
    // flight
    var launchPower = 0, launchAngle = Math.PI / 4, restX = REACH_MIN, flightP = 0, lastHop = 0;
    var wallyX = CANNON_X, wallyY = GROUND_Y - 40, lit = {};
    function syncCredits() { stats.credits = credits; if (store.save) store.save(); }

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1100);
    }
    function hud() {
      document.getElementById("wlcred").textContent = "🎟 " + credits;
      document.getElementById("wlsess").textContent = "💰 session: " + session;
      // mid-aim the button would sit right on the meters — get it out of the way
      getBtn.style.display = (phase === "aiming" || phase === "angling" || phase === "flying") ? "none" : "block";
    }

    // ---------- the credit loop (vocab) ----------
    function creditQuiz() {
      if (phase === "flying") return;
      hideCard();
      cv._lastQ = VQ.miniQuiz(wlq, words, store, {
        title: "🎟 Answer a word to earn a launch credit!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) {
            if (credits >= MAX_CREDITS) big("🎟 Credits full at 5 — nice word though!", "#69f0ae");
            else { credits = Math.min(MAX_CREDITS, credits + 1); syncCredits(); big("🎟 +1 credit! Tap the cannon to launch!", "#69f0ae"); }
            if (sfx && sfx.coin) sfx.coin();
            if (juice) juice.burst(W / 2, H * 0.4, "#69f0ae", 16);
          } else {
            big("So close — try another word for your credit!", "#ffd23f");
          }
          hud();
        }
      });
    }

    // ---------- launch flow ----------
    // committing to a launch spends a credit; with none, the word quiz opens instead
    function startLaunch() {
      if (phase === "flying") return;
      hideCard();
      if (credits <= 0) { creditQuiz(); return; }
      credits--; syncCredits();
      phase = "aiming"; meterPhase = 0; meter = 0;
      big("🎯 Tap to LOCK the power!", "#ffe14d");
      hud();
    }
    // power tapped: lock it, start the ANGLE sweep (the second aiming stage)
    function lockPower() {
      launchPower = meter;
      phase = "angling"; anglePhase = 0; angle = ANGLE_MIN;
      big("📐 Now tap to LOCK the angle!", "#8be9fd");
      hud();
    }
    // fire with an exact power + angle (tap-lock and the deterministic test entry share this)
    function fire(power, ang) {
      if (phase === "flying") return;
      if (phase !== "aiming" && phase !== "angling") { // straight from idle/landed — commit a credit now
        if (credits <= 0) { creditQuiz(); return; }
        credits--; syncCredits();
      }
      hideCard();
      launchPower = clamp(power, 0, 1);
      launchAngle = ang == null ? Math.PI / 4 : clamp(ang, ANGLE_MIN, ANGLE_MAX);
      restX = powerToRestX(launchPower, launchAngle);
      phase = "flying"; flightP = 0; lastHop = 0; lit = {};
      meter = launchPower;
      wallyX = CANNON_X; wallyY = GROUND_Y - 40;
      big("💥 KA-BOOM!", "#ff9f43");
      if (sfx && sfx.whoosh) sfx.whoosh();
      if (juice) juice.burst(PX(CANNON_X), PY(GROUND_Y - 40), "#ff9f43", 18);
      hud();
    }
    // the arc: horizontal is LINEAR (so restX is exact), vertical is 3 humps
    // (launch + 2 bounces) decaying to the floor at p=1. Steeper angle = HIGHER arc.
    function flightYLogical(p) {
      var amp = 90 + 190 * (launchAngle / ANGLE_MAX);
      var hop = Math.abs(Math.sin(p * Math.PI * 3));
      return GROUND_Y - 40 - amp * hop * (1 - p * 0.82);
    }
    function land() {
      phase = "landed";
      wallyY = GROUND_Y; wallyX = restX;
      var pad = resolvePad(restX);
      lastPad = pad.value;
      session += pad.value;
      stats.totalWon += pad.value;
      if (pad.value > (stats.bestPad || 0)) stats.bestPad = pad.value;
      if (pad.jackpot) {
        sessionJackpots++; sessionWonJackpot = true; stats.jackpots++;
        if (sfx && sfx.fanfare) sfx.fanfare();
        if (juice) { juice.shake(9); for (var c = 0; c < 6; c++) juice.burst(W * (0.12 + c * 0.15), H * 0.28, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb", "#ffe14d"][c], 20); }
      } else {
        if (sfx && sfx.pop) sfx.pop();
        if (juice) juice.burst(PX(restX), PY(GROUND_Y), pad.col, 14);
      }
      if (store.save) store.save();
      showCard(pad);
      hud();
    }

    // ---------- result card ----------
    function hideCard() { wlcard.style.display = "none"; }
    function showCard(pad) {
      var jp = !!pad.jackpot;
      wlcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (jp ? "⭐🤸⭐" : "🤸💫") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (jp ? "⭐ JACKPOT!!" : "Wally flops onto the " + pad.value + " pad!") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:20px">+' + pad.value +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"></div>' +
        '<div style="margin:4px 0;font-size:14px">💰 session <b>' + session + '</b> · 🏆 best pad <b>' + (stats.bestPad || 0) + '</b>' +
        (stats.jackpots ? ' · ⭐ ' + stats.jackpots : '') + '</div>' +
        '<button class="submit big-next" id="wl_again" type="button">🎟 Launch again</button>' +
        '<button class="wqskip" id="wl_leave" type="button">Leave</button></div>';
      wlcard.style.display = "flex";
      document.getElementById("wl_again").onclick = function () { startLaunch(); };
      document.getElementById("wl_leave").onclick = exit;
    }

    // ---------- input (phantom-tap safe) ----------
    function onTap() {
      if (phase === "idle") startLaunch();
      else if (phase === "aiming") lockPower();
      else if (phase === "angling") fire(launchPower, angle);
      // flying / landed: ignore the canvas — the result card's buttons drive next
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); onTap(); }, { passive: false });
    cv.addEventListener("mousedown", function () { onTap(); });
    getBtn.onclick = creditQuiz;

    // ---------- simulation ----------
    function step(dt) {
      if (phase === "aiming") {
        meterPhase += dt;
        meter = 0.5 - 0.5 * Math.cos(2 * Math.PI * meterPhase / METER_PERIOD);
      } else if (phase === "angling") {
        anglePhase += dt;
        var af = 0.5 - 0.5 * Math.cos(2 * Math.PI * anglePhase / ANGLE_PERIOD);
        angle = ANGLE_MIN + (ANGLE_MAX - ANGLE_MIN) * af;
      } else if (phase === "flying") {
        flightP = Math.min(1, flightP + dt / FLIGHT_TIME);
        wallyX = CANNON_X + (restX - CANNON_X) * flightP;
        wallyY = flightYLogical(flightP);
        // light every pad Wally soars over
        for (var i = 0; i < PADS.length; i++) if (wallyX >= PADS[i].x) lit[i] = 1;
        // a squashy BOING on each bounce (the hump boundaries at p=1/3, 2/3)
        var hop = Math.floor(flightP * 3);
        if (hop !== lastHop && hop >= 1 && hop <= 2) {
          big("BOING!", "#ffd23f");
          if (sfx && sfx.pop) sfx.pop();
          if (juice) juice.burst(PX(wallyX), PY(GROUND_Y - 40), "#ffe14d", 10);
        }
        lastHop = hop;
        if (flightP >= 1) land();
      }
      if (juice) juice.update(dt);
    }
    // advance the sim deterministically in <=0.05s substeps (test flight resolution)
    function tick(seconds) {
      var left = seconds;
      while (left > 0) { var d = Math.min(0.05, left); step(d); left -= d; }
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // carnival sky + ground
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#2a6cc4"); g.addColorStop(1, "#7fc2ff");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#6b4a2c"; ctx.fillRect(0, PY(GROUND_Y + 22), W, H - PY(GROUND_Y + 22));
      ctx.fillStyle = "#8ecf5a"; ctx.fillRect(0, PY(GROUND_Y + 14), W, Math.max(2, 10 * S));

      // cheering crowd behind the cannon
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = Math.round(26 * S) + "px serif";
      for (var ci = 0; ci < CROWD.length; ci++) {
        var cbob = phase === "landed" ? Math.sin(performance.now() / 120 + ci) * 4 : Math.sin(ci) * 1.5;
        ctx.fillText(CROWD[ci], PX(24 + ci * 15), PY(GROUND_Y - 4) + cbob);
      }

      // the prize board pads
      ctx.font = "bold " + Math.round(19 * S) + "px Trebuchet MS";
      for (var p = 0; p < PADS.length; p++) {
        var pad = PADS[p], on = !!lit[p];
        var px = PX(pad.x - pad.w / 2), pw = pad.w * S, py = PY(GROUND_Y + 2), ph = 22 * S;
        ctx.fillStyle = pad.jackpot ? "#c99a00" : "#000"; ctx.globalAlpha = 0.22; rrect(px, py + 3 * S, pw, ph, 6 * S); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = on ? "#fff" : pad.col; rrect(px, py, pw, ph, 6 * S); ctx.fill();
        if (pad.jackpot) { ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 2 * S; ctx.stroke(); }
        ctx.fillStyle = pad.jackpot ? "#7a5200" : "#0a2a12";
        ctx.fillText((pad.jackpot ? "⭐" : "") + pad.value, PX(pad.x), py + ph / 2 + 1);
      }

      // the cannon / ramp on the left (barrel follows the aim)
      var barrelAng = phase === "flying" ? -launchAngle : phase === "angling" ? -angle : -0.72;
      ctx.save();
      ctx.translate(PX(CANNON_X), PY(GROUND_Y - 6));
      ctx.rotate(barrelAng);
      ctx.fillStyle = "#37424f"; rrect(-14 * S, -20 * S, 72 * S, 40 * S, 10 * S); ctx.fill();
      ctx.fillStyle = "#20272e"; rrect(52 * S, -18 * S, 12 * S, 36 * S, 4 * S); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#5a6570"; ctx.beginPath(); ctx.arc(PX(CANNON_X), PY(GROUND_Y - 2), 18 * S, 0, Math.PI * 2); ctx.fill();

      // dotted trail of the arc travelled so far (surprise ending stays unspoiled)
      if (phase === "flying") {
        ctx.fillStyle = "rgba(255,255,255,.55)";
        var n = Math.floor(flightP * 26);
        for (var s = 0; s <= n; s++) {
          var tp = flightP * (s / Math.max(1, n));
          var tx = CANNON_X + (restX - CANNON_X) * tp, ty = flightYLogical(tp);
          ctx.beginPath(); ctx.arc(PX(tx), PY(ty), 2.4 * S, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Wally himself (squashes at the bounce lows)
      var sq = 1;
      if (phase === "flying") { var hh = Math.abs(Math.sin(flightP * Math.PI * 3)); sq = 0.7 + hh * 0.3; }
      else if (phase === "landed") sq = 0.62;
      ctx.font = Math.round(40 * S * (2 - sq)) + "px serif";
      ctx.fillText(phase === "landed" ? "💫" : "🤸", PX(wallyX), PY(wallyY));

      // the aiming meters — raised well clear of the bottom edge (and the credit
      // button hides during aiming, so nothing ever blocks them)
      if (phase === "aiming" || phase === "angling") {
        var bw = Math.min(360, W * 0.6), bx = (W - bw) / 2, by = H - 150;
        ctx.fillStyle = "rgba(0,0,0,.45)"; rrect(bx - 4, by - 4, bw + 8, 26, 8); ctx.fill();
        // sweet-spot band (power range that lands in the jackpot slot AT 45°)
        var jp = PADS[PADS.length - 1];
        var lo = (jp.x - jp.w / 2 - REACH_MIN) / REACH_SPAN, hi = (jp.x + jp.w / 2 - REACH_MIN) / REACH_SPAN;
        ctx.fillStyle = "#c99a00"; ctx.fillRect(bx + bw * lo, by, bw * (hi - lo), 18);
        ctx.fillStyle = phase === "aiming" ? "#ffe14d" : "#b8a14d"; ctx.fillRect(bx, by, bw * meter, 18);
        ctx.fillStyle = "#fff"; ctx.fillRect(bx + bw * meter - 2, by - 3, 4, 24);
        ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = "bold " + Math.round(13 * S) + "px Trebuchet MS";
        ctx.fillText((phase === "aiming" ? "POWER " : "POWER locked: ") + Math.round(meter * 100), W / 2, by - 12);
      }
      // the ANGLE stage: a sweeping aim line from the cannon + a readout
      if (phase === "angling") {
        var aLen = 150 * S;
        ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 3 * S; ctx.setLineDash([8 * S, 7 * S]);
        ctx.beginPath(); ctx.moveTo(PX(CANNON_X), PY(GROUND_Y - 20));
        ctx.lineTo(PX(CANNON_X) + Math.cos(angle) * aLen, PY(GROUND_Y - 20) - Math.sin(angle) * aLen); ctx.stroke();
        ctx.setLineDash([]);
        var abw = Math.min(360, W * 0.6), abx = (W - abw) / 2, aby = H - 108;
        var af2 = (angle - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
        ctx.fillStyle = "rgba(0,0,0,.45)"; rrect(abx - 4, aby - 4, abw + 8, 26, 8); ctx.fill();
        // best-range marker: 45° flies farthest
        var mid = (Math.PI / 4 - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
        ctx.fillStyle = "#2f9e44"; ctx.fillRect(abx + abw * mid - 3, aby, 6, 18);
        ctx.fillStyle = "#8be9fd"; ctx.fillRect(abx, aby, abw * af2, 18);
        ctx.fillStyle = "#fff"; ctx.fillRect(abx + abw * af2 - 2, aby - 3, 4, 24);
        ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = "bold " + Math.round(13 * S) + "px Trebuchet MS";
        ctx.fillText("ANGLE " + Math.round(angle * 180 / Math.PI) + "°", W / 2, aby - 12);
      }

      if (juice) juice.draw(ctx);
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused) step(dt);
      draw();
    }

    // ---------- banking (ONE guarded path: Leave AND app-close) ----------
    function rewards() {
      return {
        win: sessionWonJackpot,
        score: session,
        rankPtsDelta: Math.min(6, 1 + Math.floor(session / 40)),
        xp: Math.min(80, 6 + Math.floor(session / 6)),
        gems: Math.min(300, session)
      };
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = rewards();
      var res = store.recordGame ? store.recordGame("wally", rw) : null;
      return { rw: rw, res: res };
    }
    function bankExit() {
      if (session <= 0) return; // an untouched session banks nothing
      var b = bankRun();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("💥 Wally banked: +" + b.rw.gems + " Vobux");
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
    cv._wally = {
      state: function () {
        return {
          credits: credits, session: session, phase: phase, meter: meter,
          angle: angle, lastPad: lastPad, banked: banked, jackpots: sessionJackpots
        };
      },
      creditQuiz: creditQuiz,
      give: function (n) { credits = Math.min(MAX_CREDITS, credits + (n || 0)); syncCredits(); hud(); },
      lockPower: lockPower,
      aim: startLaunch,
      launchAt: fire,
      tick: tick,
      collect: function () { startLaunch(); },
      pads: function () { return PADS.map(function (p) { return { x: p.x, w: p.w, value: p.value }; }); }
    };

    // ---------- boot ----------
    hud();
    if (global._wallydemo) { // screenshot seed: Wally mid-flight over a lit board
      global._wallydemo = 0;
      credits = 2; session = 45; lastPad = 25;
      launchPower = 0.72; launchAngle = Math.PI / 4; restX = powerToRestX(launchPower, launchAngle);
      phase = "flying"; flightP = 0.55; lastHop = 1;
      wallyX = CANNON_X + (restX - CANNON_X) * flightP; wallyY = flightYLogical(flightP);
      for (var d = 0; d < PADS.length; d++) if (wallyX >= PADS[d].x) lit[d] = 1;
      paused = true;
      hud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxWally = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
