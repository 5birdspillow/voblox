/*
 * Voblox arcade game — ⚾ HOME RUN DERBY (a timing-batting slugfest).
 * Behind-the-batter view: a named bot pitcher winds up and throws — fastballs
 * (straight), curves (they bend), changeups (look fast, float in slow), and the
 * occasional WILD ball you must LAY OFF. TAP to swing; your timing vs the ball
 * crossing the plate is everything: PERFECT = crushed, good = caught at the
 * track, early/late = foul or weak grounder, chase a ball = strike.
 *
 * DERBY: 10 outs per round (any non-homer contact OR strike is an out). Homers
 * splash into the stands with a distance callout; 450+ sets off fireworks. Three
 * homers in a row lights 🔥 FIRE BALL (double distance) until you miss.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🏟 RALLY CAP: once per round at 8 outs, a word (miniQuiz) erases 3 outs.
 *   - 📜 WORD PITCH: every 5 homers one floats in — crush it AND answer right to
 *     arm a 3-pitch auto-PERFECT timing assist.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("homerun")
 * per round, banked on round-over, quit, AND app-close. Stats persist additively.
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots;

  // swing-timing windows (seconds off the perfect crossing time)
  var PERFECT = 0.05, GOOD = 0.11, CONTACT = 0.20, LATE_MISS = 0.28;

  // pitch DNA — crossT is the flight time to the plate (swingAt(crossT) = perfect)
  var PITCH = {
    fastball: { crossT: 0.40, speed: 95, emoji: "🔴", bend: 0 },
    curve:    { crossT: 0.52, speed: 83, emoji: "🟢", bend: 70 },
    changeup: { crossT: 0.62, speed: 74, emoji: "🟡", bend: 18 },
    wild:     { crossT: 0.48, speed: 80, emoji: "⚪", bend: 90 },
    word:     { crossT: 0.55, speed: 78, emoji: "📜", bend: 30 }
  };
  // the 3-rung ladder: gentle → tricky → nasty
  var ROLES = [
    { tag: "🥎 Rookie Lobber", pool: ["fastball", "fastball", "changeup"], wildRate: 0 },
    { tag: "⚾ Pro Mixer", pool: ["fastball", "curve", "changeup"], wildRate: 0.12 },
    { tag: "🔥 The Ace", pool: ["curve", "changeup", "fastball", "curve"], wildRate: 0.26 }
  ];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("homerun");
    stats.bestHomers = stats.bestHomers || 0; // additive, never-renamed save fields
    stats.longestFt = stats.longestFt || 0;

    // pick the pitcher ladder (sorted gentle→nasty so index maps to the role)
    var skill = (global.VobloxProfile && global.VobloxProfile.botSkillFor)
      ? global.VobloxProfile.botSkillFor(stats.rankPts) : 0.5;
    var roster = (Bots && Bots.pickOpponents) ? Bots.pickOpponents(3, skill) : [];
    while (roster.length < 3) roster.push({ name: "Pitchbot " + (roster.length + 1), skill: 0.4 });
    roster.sort(function (a, b) { return a.skill - b.skill; });
    var pitchers = roster.slice(0, 3).map(function (b, i) { return { bot: b, role: ROLES[i] }; });

    var wrap = document.createElement("div");
    wrap.className = "gamewrap homerun";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="hrcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="hrmsg">⚾ Home Run Derby</div>' +
      '<div class="grow"><span id="hrhomers">💥 0</span><span id="hrouts">❌ 0/10</span>' +
      '<span id="hrlong"></span><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="hrbig"></div>' +
      '<div class="gover" id="hrq" style="display:none"></div>' +
      '<div class="gover" id="hrcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#hrcv"), ctx = cv.getContext("2d");
    var hrq = document.getElementById("hrq"), hrcard = document.getElementById("hrcard");
    var msgEl = document.getElementById("hrmsg"), bigEl = document.getElementById("hrbig");
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
    var outs = 0, homers = 0, longest = 0, streak = 0, fire = false, assist = 0;
    var over = false, paused = false, banked = false, statsSaved = false;
    var rallyUsed = false, rallyOpen = false, pendingWord = false;
    var pitcherIdx = 0, nextT = 1.4, lastFmt = null;
    var pitch = null, fly = null, fwParts = [], bombs = [], camY = 0, windup = 0;

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1150);
    }
    function activePitcher() {
      var i = Math.max(pitcherIdx, Math.min(2, Math.floor(homers / 4)));
      return pitchers[i] || pitchers[0];
    }
    function updateHud() {
      document.getElementById("hrhomers").textContent = "💥 " + homers + (fire ? " 🔥" : "");
      document.getElementById("hrouts").textContent = "❌ " + outs + "/10";
      document.getElementById("hrlong").textContent =
        (longest ? "📏 " + longest + "ft" : "") + (assist ? " 🎯" + assist : "");
      var p = activePitcher();
      msgEl.innerHTML = "⚾ vs <b>" + (p.bot.name) + "</b> · " + p.role.tag;
    }

    // ---------- round lifecycle ----------
    function begin(idx) {
      pitcherIdx = Math.max(0, Math.min(2, idx || 0));
      outs = 0; homers = 0; longest = 0; streak = 0; fire = false; assist = 0;
      over = false; paused = false; banked = false; statsSaved = false;
      rallyUsed = false; rallyOpen = false; pendingWord = false;
      pitch = null; fly = null; fwParts = []; bombs = []; camY = 0; nextT = 1.4; windup = 0;
      hrcard.style.display = "none"; hrq.style.display = "none";
      updateHud();
      big("⚾ SWING FOR THE FENCES!", "#ffd23f");
    }

    function rewards(won) {
      return {
        win: !!won,
        score: homers * 100 + longest,
        rankPtsDelta: Math.min(12, 2 + homers),
        xp: Math.min(80, 6 + homers * 4),
        gems: 3 + homers * 2 + (longest >= 450 ? 5 : 0)
      };
    }
    // the ONE bank path — computed once, guarded, recorded to the store engine
    function bankRun(won) {
      if (banked) return null;
      banked = true;
      var rw = rewards(won);
      var res = store.recordGame ? store.recordGame("homerun", rw) : null;
      return { rw: rw, res: res };
    }
    // additive persistence — biggest round & longest bomb ever (once per round)
    function persistStats() {
      if (statsSaved) return; statsSaved = true;
      if (homers > (stats.bestHomers || 0)) stats.bestHomers = homers;
      if (longest > (stats.longestFt || 0)) stats.longestFt = longest;
      if (store.save) store.save();
    }
    function endRound() {
      if (over) return;
      over = true; paused = true;
      persistStats();
      var b = bankRun(homers >= 10);
      showCard(b ? b.rw : rewards(homers >= 10));
      if (sfx && sfx.fanfare && homers > 0) sfx.fanfare();
      if (juice) { juice.shake(8); for (var i = 0; i < 5; i++) juice.burst(W * (0.2 + i * 0.15), H * 0.35, "#ffd23f", 14); }
    }
    function showCard(rw) {
      hrcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (homers >= 10 ? "🏆" : "⚾") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (homers >= 10 ? "DERBY CHAMP!" : "Round over!") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">💥 <b>' + homers + '</b> homers · 📏 longest <b>' + longest + ' ft</b></div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🏅 Best round <b>' + (stats.bestHomers || 0) +
        '</b> · farthest ever <b>' + (stats.longestFt || 0) + ' ft</b></div>' +
        '<button class="submit big-next" id="hrreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="hrleave" type="button">Leave</button></div>';
      hrcard.style.display = "flex";
      document.getElementById("hrreplay").onclick = function () { hrcard.style.display = "none"; begin(pitcherIdx); };
      document.getElementById("hrleave").onclick = exit;
    }

    // ---------- distance & bombs leaderboard ----------
    function homerDistance(e) {
      var timingQ = Math.max(0, Math.min(1, 1 - e / PERFECT)); // 1 dead-center, 0 at the edge
      var base = 300 + Math.round((pitch.speed - 74) * 2);     // faster pitch = it flies farther
      var d = base + Math.round(timingQ * 110);
      if (fire) d *= 2; // 🔥 FIRE BALL
      return d;
    }
    function addBomb(d) {
      bombs.push(d);
      bombs.sort(function (a, b) { return b - a; });
      if (bombs.length > 5) bombs.length = 5;
    }

    // ---------- outcomes ----------
    function addOut(msg, col) {
      outs++; streak = 0; fire = false;
      big(msg, col || "#ff8a8a");
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(4);
      updateHud();
      if (outs >= 10) { endRound(); return; }
      // 🏟 RALLY CAP auto-offers in real play; specs drive rallyQuiz() themselves
      if (outs >= 8 && !rallyUsed && !rallyOpen && !global.__VOBLOX_TEST__) rallyQuiz();
    }
    function onHomer(d) {
      homers++; streak++;
      if (d > longest) longest = d;
      addBomb(d);
      launchFly(d);
      big("💥 " + d + " ft!!" + (fire ? " 🔥" : ""), d >= 450 ? "#ffd23f" : "#69f0ae");
      if (sfx && sfx.pop) sfx.pop();
      if (sfx && sfx.tone) sfx.tone(180 + Math.min(300, d / 2), 0.3, Math.min(0.13, d / 4000)); // crowd roar scales
      if (juice) { juice.shake(Math.min(12, 4 + d / 60)); juice.burst(W / 2, H * 0.78, "#fff", 16); }
      if (!fire && streak >= 3) { fire = true; big("🔥 FIRE BALL! Bombs count DOUBLE!", "#ff6b6b"); if (sfx && sfx.chime) sfx.chime(); }
      if (homers % 5 === 0) pendingWord = true; // 📜 a word pitch is queued up
      updateHud();
    }

    // ---------- the swing (the whole game lives here) ----------
    function resolveSwing(t) {
      if (over || paused) return;
      if (!pitch || pitch.phase !== "flight" || pitch.swung) return;
      pitch.swung = true;
      var e = Math.abs(t - pitch.crossT);
      if (pitch.word) { // 📜 WORD PITCH — contact opens the quiz, no out either way
        pitch.phase = "done";
        if (e <= CONTACT) { openWordQuiz(); }
        else { big("📜 Missed the word pitch!", "#ffd740"); scheduleNext(); }
        return;
      }
      if (assist > 0) e = 0; // 🎯 timing assist forces a perfect read
      if (pitch.wild) { addOut("😖 Chased ball four — STRIKE!"); finishPitch(); return; }
      if (e <= PERFECT) { onHomer(homerDistance(e)); finishPitch(true); return; }
      if (e <= CONTACT) {
        var lbl = e <= GOOD ? "🟠 Solid — caught at the track!"
          : (t < pitch.crossT ? "⏪ Early — foul ball!" : "⏩ Late — weak grounder!");
        addOut(lbl, "#ffd740"); finishPitch(); return;
      }
      addOut("💨 Swing & a miss — STRIKE!"); finishPitch();
    }
    function tookPitch() { // ball crossed with no swing
      pitch.phase = "done";
      if (pitch.word) { big("📜 Let the word pitch go by…", "#ffd740"); scheduleNext(); return; }
      if (pitch.wild) { big("⚾ Ball! Good eye — laid off it.", "#8ecdf7"); scheduleNext(); return; }
      addOut("👀 Took a called STRIKE!");
      finishTake();
    }
    function finishPitch(wasHomer) {
      if (pitch && !pitch.word && assist > 0) assist--; // consume one assist pitch
      if (pitch) pitch.phase = "done";
      scheduleNext();
    }
    function finishTake() { scheduleNext(); }
    function scheduleNext() { nextT = 1.4; }

    // 📜 crush-it-and-answer to arm the auto-perfect assist
    function openWordQuiz() {
      paused = true;
      cv._lastQ = VQ.miniQuiz(hrq, words, store, {
        title: "📜 WORD PITCH! You crushed it — now answer to ARM the assist!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) { assist = 3; big("🎯 ASSIST ARMED! Next 3 pitches auto-PERFECT!", "#69f0ae"); if (sfx && sfx.fanfare) sfx.fanfare(); }
          else big("📜 The word got away — no assist.", "#ff8a8a");
          updateHud(); scheduleNext();
        }
      });
    }
    // 🏟 once-per-round rally: a word erases 3 outs
    function rallyQuiz() {
      if (over || rallyUsed || rallyOpen || outs < 8) return;
      rallyOpen = true; paused = true;
      cv._lastQ = VQ.miniQuiz(hrq, words, store, {
        title: "🏟 RALLY CAP! Answer a word to ERASE 3 outs!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; rallyOpen = false; rallyUsed = true; paused = false;
          if (ok) { outs = Math.max(0, outs - 3); big("🏟 RALLY! −3 outs — you're back in it!", "#69f0ae"); if (sfx && sfx.fanfare) sfx.fanfare(); }
          else big("No rally this time — play on!", "#ffd740");
          updateHud();
          if (outs >= 10) endRound();
        }
      });
    }

    // ---------- pitching ----------
    function startPitch(type) {
      if (over) return null;
      var meta = PITCH[type] || PITCH.fastball;
      pitch = {
        type: type, phase: "flight", t: 0, crossT: meta.crossT, speed: meta.speed,
        bend: meta.bend, wild: type === "wild", word: type === "word", swung: false
      };
      windup = 0;
      return pitch;
    }
    function autoThrow() {
      if (over || paused) return;
      if (pendingWord) { pendingWord = false; startPitch("word"); big("📜 Here comes a WORD PITCH!", "#c9b6ff"); return; }
      var role = activePitcher().role;
      var type = (role.wildRate && Math.random() < role.wildRate) ? "wild"
        : role.pool[Math.floor(Math.random() * role.pool.length)];
      startPitch(type);
    }

    // ---------- homer flight + fireworks ----------
    function launchFly(d) {
      var reach = 0.55 + Math.min(0.55, d / 900); // farther bombs launch harder
      fly = {
        x: W / 2, y: H * 0.78, vx: (Math.random() * 2 - 1) * 130,
        vy: -Math.sqrt(2 * 1400 * (H * 0.9)) * reach, t: 0, dist: d, trail: [], big: d >= 450
      };
    }
    function spawnFirework(x, y, col) {
      for (var i = 0; i < 22; i++) {
        var a = (i / 22) * Math.PI * 2, sp = 90 + Math.random() * 120;
        fwParts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, col: col });
      }
    }
    function updateFly(dt) {
      if (fly) {
        fly.t += dt;
        fly.vy += 1400 * dt; fly.x += fly.vx * dt; fly.y += fly.vy * dt;
        fly.trail.push({ x: fly.x, y: fly.y }); if (fly.trail.length > 16) fly.trail.shift();
        if (fly.big && !fly.popped && fly.vy > -30) { fly.popped = true; spawnFirework(fly.x, fly.y, "#ffd23f"); spawnFirework(fly.x + 40, fly.y - 30, "#69f0ae"); }
        camY = Math.max(0, (H * 0.42 - fly.y) * 0.35); // camera follows the ball up
        if (fly.y > H + 60 || fly.t > 3.2) fly = null;
      } else camY += (0 - camY) * Math.min(1, dt * 4);
      for (var i = fwParts.length - 1; i >= 0; i--) {
        var p = fwParts[i]; p.life -= dt * 0.9; p.vy += 240 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.life <= 0) fwParts.splice(i, 1);
      }
    }

    // ---------- input: TAP / click / Space all swing ----------
    function doSwing() { if (!over && !paused && pitch && pitch.phase === "flight") resolveSwing(pitch.t); }
    cv.addEventListener("mousedown", doSwing);
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); doSwing(); }, { passive: false });
    function onKey(e) { if (e.code === "Space" || e.key === " " || e.keyCode === 32) { e.preventDefault(); doSwing(); } }
    document.addEventListener("keydown", onKey);

    // ---------- simulation ----------
    function step(dt) {
      if (pitch && pitch.phase === "flight") {
        pitch.t += dt;
        if (!pitch.swung && pitch.t > pitch.crossT + LATE_MISS) tookPitch();
      } else {
        nextT -= dt; windup = Math.max(0, nextT);
        if (nextT <= 0) autoThrow();
      }
      updateFly(dt);
      if (juice) juice.update(dt);
    }
    function tick(sec) {
      var left = sec;
      while (left > 1e-9) { var dt = Math.min(0.05, left); if (!paused && !over) step(dt); left -= dt; }
    }

    // ---------- drawing ----------
    function drawStadium() {
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#1b3a6b"); sky.addColorStop(0.55, "#2f6fb0"); sky.addColorStop(1, "#3a2f14");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // crowd tiers
      ctx.fillStyle = "#20304a"; ctx.fillRect(0, H * 0.16, W, H * 0.14);
      for (var i = 0; i < W; i += 8) {
        ctx.fillStyle = ["#d94", "#4a8", "#48d", "#e6c", "#ec5"][(i / 8) % 5 | 0];
        ctx.globalAlpha = 0.5; ctx.fillRect(i, H * 0.16 + ((i * 7) % 20), 5, 5); ctx.globalAlpha = 1;
      }
      // outfield wall + grass
      ctx.fillStyle = "#0f5a2a"; ctx.fillRect(0, H * 0.3, W, H * 0.7);
      ctx.fillStyle = "#1e7a3c"; ctx.fillRect(0, H * 0.3, W, H * 0.04);
      ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 2;
      for (var g = 0; g < 6; g++) { ctx.beginPath(); ctx.moveTo(W / 2, H * 0.82); ctx.lineTo(W * (g / 5), H * 0.34); ctx.stroke(); }
      // infield dirt + plate
      ctx.fillStyle = "#b5793f"; ctx.beginPath();
      ctx.moveTo(W / 2, H * 0.62); ctx.lineTo(W * 0.86, H); ctx.lineTo(W * 0.14, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath();
      ctx.moveTo(W / 2, H * 0.9); ctx.lineTo(W / 2 + 14, H * 0.905); ctx.lineTo(W / 2 + 10, H * 0.925);
      ctx.lineTo(W / 2 - 10, H * 0.925); ctx.lineTo(W / 2 - 14, H * 0.905); ctx.closePath(); ctx.fill();
    }
    function drawPitcher() {
      var p = activePitcher();
      var mx = W / 2, my = H * 0.5;
      // mound
      ctx.fillStyle = "#c98a4a"; ctx.beginPath(); ctx.ellipse(mx, my + 26, 46, 16, 0, 0, Math.PI * 2); ctx.fill();
      var wind = (!pitch || pitch.phase !== "flight") && windup > 0.2;
      ctx.font = "38px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.translate(mx, my); if (wind) ctx.rotate(Math.sin(performance.now() / 90) * 0.18);
      ctx.fillText("🧍", 0, 0); ctx.restore();
      ctx.font = "bold 12px Trebuchet MS, sans-serif"; ctx.fillStyle = "#fff";
      ctx.fillText(p.bot.name, mx, my - 34);
      if (wind) { ctx.fillStyle = "#ffd23f"; ctx.font = "bold 13px Trebuchet MS, sans-serif"; ctx.fillText("…winding up…", mx, my + 48); }
    }
    function drawBall() {
      if (!pitch || pitch.phase !== "flight") return;
      var prog = Math.min(1.2, pitch.t / pitch.crossT);
      var sx = W / 2 + Math.sin(prog * Math.PI) * pitch.bend * (pitch.type === "curve" ? 1 : 0.4);
      var floatY = pitch.type === "changeup" ? -Math.sin(prog * Math.PI) * H * 0.03 : 0;
      var y = H * 0.5 + (H * 0.34) * prog + floatY;
      var r = 5 + prog * prog * 20;
      ctx.beginPath(); ctx.arc(sx, y, r, 0, Math.PI * 2);
      ctx.fillStyle = pitch.wild ? "#7fd6ff" : "#fff"; ctx.fill();
      ctx.strokeStyle = "#d33"; ctx.lineWidth = 1.5; ctx.stroke();
      if (pitch.wild) { ctx.fillStyle = "#ffd23f"; ctx.font = "bold 16px Trebuchet MS, sans-serif"; ctx.fillText("LAY OFF!", sx, y - r - 12); }
      // the swing-timing ring tightening as the ball nears the plate
      if (prog > 0.4 && !pitch.swung) {
        ctx.strokeStyle = "rgba(255,255,255," + (0.2 + prog * 0.5) + ")"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(W / 2, H * 0.86, 34 * (1.4 - Math.min(1, prog)), 0, Math.PI * 2); ctx.stroke();
      }
    }
    function drawFly() {
      if (fly) {
        for (var i = 1; i < fly.trail.length; i++) { // comet trail
          var a = fly.trail[i - 1], b = fly.trail[i];
          ctx.strokeStyle = "rgba(255,255,255," + (i / fly.trail.length) * 0.8 + ")";
          ctx.lineWidth = (i / fly.trail.length) * 8 + 1; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(fly.x, fly.y, 7, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
        ctx.fillStyle = fly.big ? "#ffd23f" : "#eafff0"; ctx.font = "bold 18px Trebuchet MS, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(fly.dist + " ft", fly.x, fly.y - 16);
      }
      for (var f = 0; f < fwParts.length; f++) {
        var p = fwParts[f]; ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function drawBatter() {
      ctx.font = "56px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.translate(W / 2 - 6, H * 0.86);
      if (pitch && pitch.swung && pitch.phase !== "flight") ctx.rotate(-0.5);
      ctx.fillText("🏏", 0, 0); ctx.restore();
    }
    function drawLeaderboard() {
      if (!bombs.length) return;
      ctx.textAlign = "left"; ctx.font = "bold 12px Trebuchet MS, sans-serif";
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(W - 108, H * 0.32, 100, 18 + bombs.length * 15);
      ctx.fillStyle = "#ffd23f"; ctx.fillText("🏅 Top Bombs", W - 102, H * 0.32 + 12);
      for (var i = 0; i < bombs.length; i++) {
        ctx.fillStyle = "#fff"; ctx.fillText((i + 1) + ". " + bombs[i] + " ft", W - 102, H * 0.32 + 27 + i * 15);
      }
    }
    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (juice) ctx.translate(juice.ox || 0, juice.oy || 0);
      ctx.translate(0, camY); // camera follow
      drawStadium(); drawPitcher(); drawBall(); drawFly();
      ctx.translate(0, -camY);
      drawBatter(); drawLeaderboard();
      if (juice) juice.draw(ctx);
      ctx.restore();
      // fire banner
      if (fire) { ctx.fillStyle = "rgba(255,107,107,.9)"; ctx.font = "bold 15px Trebuchet MS, sans-serif"; ctx.textAlign = "center"; ctx.fillText("🔥 FIRE BALL — DOUBLE DISTANCE 🔥", W / 2, H * 0.14); }
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
      if (over) return; // round-over already banked
      if (homers === 0 && outs === 0) return; // an untouched round banks nothing
      persistStats();
      var b = bankRun(homers >= 10);
      if (b && sfx && sfx.toast) sfx.toast("⚾ Derby banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("keydown", onKey);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._homerun = {
      state: function () {
        return {
          outs: outs, homers: homers, longest: longest, streak: streak,
          fire: fire, assist: assist, over: over, banked: banked,
          best: stats.bestHomers || 0,
          pitch: (pitch && pitch.phase === "flight")
            ? { type: pitch.type, t: pitch.t, crossT: pitch.crossT } : null
        };
      },
      begin: begin,
      throwPitch: function (type) { return startPitch(type); },
      swingAt: function (t) { resolveSwing(t); },
      rallyQuiz: rallyQuiz,
      wordPitch: function () { return startPitch("word"); },
      tick: tick
    };

    // ---------- boot ----------
    begin(0);
    if (global._homerundemo) { // screenshot seed: the crack of a 440-ft bomb
      global._homerundemo = 0;
      homers = 6; longest = 440; bombs = [440, 421, 398, 372, 355];
      launchFly(440); fly.t = 0.5; fly.y = H * 0.5; fly.x = W / 2 + 40; fly.vy = -160;
      for (var d = 0; d < 8; d++) fly.trail.push({ x: W / 2 + 40 - d * 10, y: H * 0.5 + d * 14 });
      spawnFirework(W * 0.62, H * 0.34, "#ffd23f"); spawnFirework(W * 0.44, H * 0.28, "#69f0ae");
      pitch = null; paused = true; updateHud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxHomeRun = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
