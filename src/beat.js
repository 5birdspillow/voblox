/*
 * Voblox arcade game — 🎵 BEAT BOUNCE (a kid-friendly rhythm note-tapper).
 * THREE lanes; colored gem-notes fall to a glowing hit-line. Tap the lane as a
 * note crosses (A/S/D or ←/↓/→, or big canvas tap-zones). Judgment by TIMING:
 *   PERFECT (big score + combo) · GOOD (score) · MISS (combo breaks, lose health).
 * TIMING MODEL: the song is a DETERMINISTIC seeded beatmap. Song position advances
 * ONLY by accumulating rAF dt (clamped ≤ 0.05) — never the audio/wall clock. Audio
 * is decorative (VobloxSfx tick/chime, null-safe); the game feels right fully muted.
 * VOCAB IS THE POWER CURVE:
 *   ⭐ STAR notes → miniQuiz. Correct = ENCORE (2× score rest of song + health).
 *   Retrying a failed song asks one word first — correct starts you with a SHIELD.
 * 5 songs unlock by C+ grade + ⭐ Endless Jam. recordGame("beat") banks every run.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var LANES = 3;
  var PERFECT = 0.055, GOOD = 0.13, MISS_LATE = 0.17, APPROACH = 1.5;
  var MAXHP = 100, MISS_HP = 7, WRONG_HP = 6;
  var LANE_COLS = ["#ff5d6c", "#3ec6ff", "#ffd23f"];

  // rising BPM + density; songs 2-5 unlock by finishing the previous with a C+ grade
  var SONGS = [
    { name: "Sunny Steps",   emoji: "☀️", bpm: 92,  dens: 0.52, seed: 101, bars: 22 },
    { name: "Robot Groove",  emoji: "🤖", bpm: 108, dens: 0.62, seed: 211, bars: 24 },
    { name: "Dragon Drums",  emoji: "🐲", bpm: 124, dens: 0.72, seed: 331, bars: 26 },
    { name: "Comet Rush",    emoji: "☄️", bpm: 140, dens: 0.82, seed: 457, bars: 28 },
    { name: "Galaxy Finale", emoji: "🌌", bpm: 156, dens: 0.92, seed: 613, bars: 30 }
  ];
  var ENDLESS = SONGS.length; // songIdx sentinel for ⭐ Endless Jam

  // deterministic per-song PRNG (independent of Math.random, which the harness seeds)
  function mkRng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function buildMap(song) {
    var rng = mkRng(song.seed), beat = 60 / song.bpm, notes = [], t = 2.2;
    var beats = song.bars * 4;
    for (var b = 0; b < beats; b++) {
      var roll = rng();
      if (b > 6 && roll < song.dens * 0.16) { // a RUN of four eighth-notes climbing lanes
        var l0 = Math.floor(rng() * LANES);
        for (var k = 0; k < 4; k++) notes.push({ t: t + k * (beat / 2), lane: (l0 + k) % LANES, star: false, judged: false });
      } else if (roll < song.dens * 0.34) { // a DOUBLE (two lanes at once)
        var l1 = Math.floor(rng() * LANES), l2 = (l1 + 1 + Math.floor(rng() * 2)) % LANES;
        notes.push({ t: t, lane: l1, star: false, judged: false });
        notes.push({ t: t, lane: l2, star: false, judged: false });
      } else if (roll < song.dens) { // a SINGLE
        notes.push({ t: t, lane: Math.floor(rng() * LANES), star: false, judged: false });
      } // else a rest
      t += beat;
    }
    notes.sort(function (a, b2) { return a.t - b2.t; });
    if (notes.length > 8) { notes[Math.floor(notes.length * 0.35)].star = true; notes[Math.floor(notes.length * 0.72)].star = true; }
    return { notes: notes, duration: (notes.length ? notes[notes.length - 1].t : t) + 2.5 };
  }
  // ⭐ Endless Jam — accelerating; never ends by winning, only by failing
  function buildEndless() {
    var rng = mkRng(9091), notes = [], t = 2.2, iv = 0.5;
    for (var b = 0; b < 500; b++) {
      if (rng() < 0.9) {
        notes.push({ t: t, lane: Math.floor(rng() * LANES), star: false, judged: false });
        if (rng() < 0.28) notes.push({ t: t, lane: Math.floor(rng() * LANES), star: false, judged: false });
      }
      t += iv; iv = Math.max(0.2, iv * 0.997);
    }
    return { notes: notes, duration: 1e9 };
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("beat");
    // additive save fields — NEVER rename/remove existing ones (plays/wins/best/rankPts…)
    if (stats.bestScore == null) stats.bestScore = 0;
    if (stats.bestCombo == null) stats.bestCombo = 0;
    if (stats.songsCleared == null) stats.songsCleared = 0; // highest unlocked song index
    if (!stats.grades) stats.grades = {};

    var wrap = document.createElement("div"); wrap.className = "gamewrap beat";
    wrap.innerHTML =
      '<canvas id="btcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="btmsg">🎵 Beat Bounce</div>' +
      '<div class="grow"><span id="btscore">0</span><span id="btcombo">×0</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="btbig"></div>' +
      '<div class="gover" id="btq" style="display:none"></div>' +
      '<div class="gover" id="btcard" style="display:none"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#btcv"), ctx = cv.getContext("2d");
    var W = 0, H = 0;
    function resize() { W = cv.width = wrap.clientWidth || 360; H = cv.height = wrap.clientHeight || 640; }
    resize(); window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var selecting = true, song = null, songIdx = 0, notes = [], duration = 0;
    var songT = 0, score = 0, combo = 0, bestComboRun = 0, health = MAXHP;
    var encore = false, shieldMisses = 0, starsOpened = 0, lastMilestone = 0;
    var perfectCount = 0, goodCount = 0, missCount = 0;
    var over = false, won = false, banked = false, paused = true, gradeStr = "";
    var lastFmt = null;

    function laneW() { return W / LANES; }
    function laneX(l) { return l * laneW() + laneW() / 2; }
    function hitY() { return H * 0.8; }
    function topY() { return H * 0.08; }
    function noteY(n) { return hitY() - ((n.t - songT) / APPROACH) * (hitY() - topY()); }

    var msgEl = wrap.querySelector("#btmsg"), bigEl = wrap.querySelector("#btbig");
    function msg(m) { if (msgEl) msgEl.innerHTML = m; }
    function big(m, col) {
      if (!bigEl) return;
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { if (bigEl) bigEl.style.opacity = "0"; }, 900);
    }
    function hud() {
      var s = wrap.querySelector("#btscore"), c = wrap.querySelector("#btcombo");
      if (s) s.textContent = score + (encore ? " ⭐2×" : "");
      if (c) c.textContent = "×" + combo;
    }

    // ---------- grading ----------
    function accuracy() {
      var tot = perfectCount + goodCount + missCount;
      if (tot === 0) return 0;
      return (perfectCount + goodCount * 0.6) / tot;
    }
    function computeGrade() {
      var a = accuracy();
      return a >= 0.95 ? "S" : a >= 0.85 ? "A" : a >= 0.7 ? "B" : a >= 0.5 ? "C" : "D";
    }
    function gradeRank(g) { return { S: 5, A: 4, B: 3, C: 2, D: 1, F: 0 }[g] || 0; }

    // ---------- flow ----------
    function showSelect() {
      selecting = true; song = null; paused = true; over = false;
      var card = document.getElementById("btcard");
      var btns = SONGS.map(function (s, i) {
        var open = i <= stats.songsCleared, gr = stats.grades[i];
        return '<button class="embtn" style="min-width:150px' + (open ? "" : ";opacity:.45") + '" data-song="' + i + '">' +
          '<span class="ebl">' + s.emoji + " " + s.name + '</span>' +
          '<span class="ebs">' + (open ? (s.bpm + " BPM" + (gr ? " · " + gr : "")) : "🔒 clear " + SONGS[i - 1].name) + "</span></button>";
      }).join("");
      var eOpen = stats.songsCleared >= SONGS.length;
      var eBtn = '<button class="embtn" style="min-width:150px' + (eOpen ? "" : ";opacity:.45") + '" data-song="' + ENDLESS + '">' +
        '<span class="ebl">⭐ Endless Jam</span><span class="ebs">' + (eOpen ? "accelerating!" : "🔒 clear all 5 songs") + "</span></button>";
      card.innerHTML = '<div class="wqcard" style="text-align:center;max-width:560px">' +
        '<div style="font-size:40px">🎵</div><div class="wqtitle" style="font-size:22px">Beat Bounce</div>' +
        '<div style="margin:2px 0 10px;color:#5a6b7a;font-weight:bold">Tap on the beat! Best score: ' + stats.bestScore + ' · best combo: ' + stats.bestCombo + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + btns + eBtn + "</div>" +
        '<div style="font-size:11px;color:#8a98a8;margin-top:8px">A/S/D or ←/↓/→ · or tap the lanes</div></div>';
      card.style.display = "flex";
      Array.prototype.forEach.call(card.querySelectorAll("[data-song]"), function (b) {
        b.onclick = function () {
          var i = +b.dataset.song;
          var open = i < SONGS.length ? i <= stats.songsCleared : stats.songsCleared >= SONGS.length;
          if (!open) { big("🔒 Locked — clear the earlier songs!", "#ffd740"); return; }
          beginSong(i, false);
        };
      });
    }

    function beginSong(i, warmShield) {
      selecting = false; songIdx = i;
      var map = i >= SONGS.length ? buildEndless() : buildMap(SONGS[i]);
      notes = map.notes; duration = map.duration;
      song = i >= SONGS.length ? { name: "Endless Jam", emoji: "⭐", endless: true } : SONGS[i];
      songT = 0; score = 0; combo = 0; bestComboRun = 0; health = MAXHP;
      encore = false; starsOpened = 0; lastMilestone = 0; gradeStr = "";
      perfectCount = 0; goodCount = 0; missCount = 0;
      shieldMisses = warmShield ? 3 : 0;
      over = false; won = false; banked = false; paused = false;
      document.getElementById("btcard").style.display = "none";
      msg(song.emoji + " <b>" + song.name + "</b>");
      big("🎵 " + song.name + (warmShield ? " — 🛡 shield up!" : " — tap on the beat!"), "#ffe14d");
      hud(); lastT = performance.now();
    }

    // ---------- judging ----------
    function firstUnjudged() {
      var best = null;
      for (var i = 0; i < notes.length; i++) { var n = notes[i]; if (n.judged) continue; if (!best || n.t < best.t) best = n; }
      return best;
    }
    function countUpcoming() { var c = 0; for (var i = 0; i < notes.length; i++) if (!notes[i].judged) c++; return c; }

    function judgeTap(lane) {
      if (selecting || paused || over || !song) return;
      var best = null, bestAbs = 1e9, near = null, nearAbs = 1e9;
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i]; if (n.judged) continue;
        var d = Math.abs(n.t - songT);
        if (d > GOOD) continue;
        if (n.lane === lane && d < bestAbs) { best = n; bestAbs = d; }
        if (d < nearAbs) { near = n; nearAbs = d; }
      }
      if (best) resolveHit(best, bestAbs);
      else if (near) registerMiss(WRONG_HP, null); // right time, WRONG lane → combo breaks
      // else: a harmless ghost tap (no note near in time) — kind to mashers
    }
    function resolveHit(n, absd) {
      n.judged = true;
      var perfect = absd <= PERFECT;
      combo++; if (combo > bestComboRun) bestComboRun = combo;
      if (perfect) perfectCount++; else goodCount++;
      var base = perfect ? 100 : 40;
      score += Math.round(base * (encore ? 2 : 1) * (1 + Math.min(combo, 100) * 0.01));
      if (combo >= 10 && combo % 10 === 0 && combo !== lastMilestone) {
        lastMilestone = combo; big("COMBO " + combo + "!", "#69f0ae");
        if (juice) juice.shake(4); if (sfx && sfx.chime) sfx.chime();
      }
      if (juice) juice.text(laneX(n.lane), hitY() - 34, perfect ? "PERFECT" : "GOOD", perfect ? "#ffe14d" : "#8ecdf7");
      if (sfx && sfx.pop) sfx.pop(); // decorative tick — timing does NOT depend on it
      hud();
      if (n.star) openStar(n);
    }
    function registerMiss(dmg, n) {
      if (n) n.judged = true;
      if (shieldMisses > 0) { shieldMisses--; combo = 0; big("🛡 shielded!", "#c9b6ff"); hud(); return; }
      combo = 0; missCount++;
      health -= dmg;
      if (juice) juice.text(W / 2, hitY() - 60, "MISS", "#ff8a8a");
      if (sfx && sfx.buzz) sfx.buzz();
      hud();
      if (health <= 0) { health = 0; endSong(false); }
    }

    // ---------- word hooks ----------
    function openStar(n) {
      if (starsOpened >= 2 && !n.forced) return; // cap 2 star quizzes per song
      starsOpened++; paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("btq"), words, store, {
        title: "⭐ STAR NOTE! Answer for ENCORE POWER (2× score)!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            encore = true; health = Math.min(MAXHP, health + 30);
            big("⭐ ENCORE! 2× score + health!", "#ffe14d");
            if (juice) juice.shake(6); if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("⭐ No encore — keep the beat!", "#8ecdf7");
          hud(); lastT = performance.now();
        }
      });
    }
    // retrying a failed song: one word first — correct starts with a 3-miss shield
    function retry() {
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("btq"), words, store, {
        title: "🔥 Warm up! Answer to start with a SHIELD.",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) { lastFmt = fmt; beginSong(songIdx, ok); }
      });
    }

    // ---------- economy: ONE bank per run, guarded ----------
    function reward(w) {
      var g = w ? gradeStr : "F";
      var base = w ? 10 + songIdx * 4 : 3;
      var gems = base + Math.floor(score / 500) + (w && g === "S" ? 8 : 0);
      return {
        win: !!w, score: score,
        rankPtsDelta: w ? Math.min(12, 3 + songIdx * 2) : 1,
        xp: Math.min(80, 8 + Math.floor(score / 300) + (w ? songIdx * 5 : 0)),
        gems: Math.max(2, gems)
      };
    }
    function bankRun(w) {
      if (banked) return null;
      banked = true;
      var rw = reward(w);
      var res = store.recordGame ? store.recordGame("beat", rw) : null;
      return { rw: rw, res: res };
    }

    function endSong(w) {
      if (over) return;
      over = true; won = w; paused = true;
      gradeStr = w ? computeGrade() : "F";
      if (song && !song.endless) {
        if (w) {
          var prev = stats.grades[songIdx];
          if (!prev || gradeRank(gradeStr) > gradeRank(prev)) stats.grades[songIdx] = gradeStr;
          if (gradeRank(gradeStr) >= gradeRank("C") && songIdx + 1 > stats.songsCleared) stats.songsCleared = songIdx + 1;
        }
      }
      if (score > stats.bestScore) stats.bestScore = score;
      if (bestComboRun > stats.bestCombo) stats.bestCombo = bestComboRun;
      store.save();
      var bank = bankRun(w) || { rw: reward(w) };
      showCard(w, bank.rw);
      if (w && sfx && sfx.fanfare) sfx.fanfare();
      if (w && juice) { juice.shake(6); for (var i = 0; i < 5; i++) juice.burst(W * (0.2 + i * 0.15), H * 0.35, LANE_COLS[i % 3], 16); }
    }

    function showCard(w, rw) {
      var endless = song && song.endless;
      var card = document.getElementById("btcard");
      var title = endless ? "⭐ Endless Jam — score " + score + "!" :
        w ? (song.emoji + " " + song.name + " — Grade " + gradeStr + "!") : "The beat got away…";
      var gradeBig = (w && !endless) ? '<div style="font-size:52px;font-weight:900;color:#ffd23f">' + gradeStr + "</div>" : "";
      var pay = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP</div>";
      var hasNext = w && !endless && songIdx < SONGS.length - 1 && songIdx + 1 <= stats.songsCleared;
      var buttons = "";
      if (w) {
        buttons += hasNext ? '<button class="submit big-next" id="bt_next">Next Song ➜</button>' : "";
        buttons += '<button class="embtn" style="min-width:110px" id="bt_replay"><span class="ebl">🔁 Replay</span></button>';
      } else {
        buttons += '<button class="submit big-next" id="bt_retry">🔥 Try again (warm up!)</button>';
      }
      buttons += '<button class="embtn" style="min-width:110px" id="bt_songs"><span class="ebl">🎵 Songs</span></button>' +
        '<button class="embtn" style="min-width:90px" id="bt_leave"><span class="ebl">🚪 Leave</span></button>';
      card.innerHTML = '<div class="wqcard" style="text-align:center;max-width:520px">' +
        '<div style="font-size:40px">' + (w ? "🏆" : "🎧") + "</div>" +
        '<div class="wqtitle" style="font-size:20px">' + title + "</div>" + gradeBig + pay +
        '<div style="margin:2px 0;color:#5a6b7a">🔥 combo ' + bestComboRun + " · 🎯 " + perfectCount + " perfect · best score " + stats.bestScore + "</div>" +
        (w ? "" : '<div style="margin:4px 0;color:#7a4fd0">Nice try! Warm up with a word and get a shield.</div>') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px">' + buttons + "</div></div>";
      card.style.display = "flex";
      var bn = document.getElementById("bt_next"); if (bn) bn.onclick = function () { beginSong(songIdx + 1, false); };
      var br = document.getElementById("bt_replay"); if (br) br.onclick = function () { beginSong(songIdx, false); };
      var bt = document.getElementById("bt_retry"); if (bt) bt.onclick = retry;
      var bs = document.getElementById("bt_songs"); if (bs) bs.onclick = showSelect;
      var bl = document.getElementById("bt_leave"); if (bl) bl.onclick = exit;
    }

    // ---------- simulation ----------
    function step(dt) {
      songT += dt; // ← song position advances ONLY by accumulated rAF dt
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        if (!n.judged && songT > n.t + MISS_LATE) { registerMiss(MISS_HP, n); if (over) return; }
      }
      if (song && !song.endless && songT >= duration && !over) endSong(health > 0);
    }

    // ---------- drawing ----------
    function drawGem(x, y, r, col) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = col; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
      ctx.fillRect(-r, -r, r * 2, r * 2); ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#241a3a"); g.addColorStop(1, "#0e0a1c");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // lanes + hit-line glow
      for (var l = 0; l < LANES; l++) {
        ctx.fillStyle = l % 2 ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)";
        ctx.fillRect(l * laneW(), 0, laneW() - 1, H);
      }
      if (!selecting && song) {
        var hy = hitY();
        ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.fillRect(0, hy - 4, W, 8);
        for (var l2 = 0; l2 < LANES; l2++) {
          ctx.save(); ctx.globalAlpha = 0.85; ctx.strokeStyle = LANE_COLS[l2]; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(laneX(l2), hy, laneW() * 0.28, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        // notes
        for (var i = 0; i < notes.length; i++) {
          var n = notes[i]; if (n.judged) continue;
          var ny = noteY(n);
          if (ny < -40 || ny > H + 20) continue;
          var nx = laneX(n.lane), r = Math.max(14, laneW() * 0.16);
          if (n.star) { ctx.font = Math.round(r * 2.4) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⭐", nx, ny); }
          else drawGem(nx, ny, r, LANE_COLS[n.lane]);
        }
        // health bar
        ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(W * 0.12, H * 0.02 + 42, W * 0.76, 12);
        ctx.fillStyle = health > 35 ? "#69f0ae" : "#ff6b6b";
        ctx.fillRect(W * 0.12 + 2, H * 0.02 + 44, (W * 0.76 - 4) * Math.max(0, health / MAXHP), 8);
      }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input (iOS phantom-tap safe) ----------
    function laneFromX(x) { return Math.max(0, Math.min(LANES - 1, Math.floor(x / laneW()))); }
    cv.addEventListener("touchstart", function (e) {
      e.preventDefault();
      var r = cv.getBoundingClientRect();
      judgeTap(laneFromX(e.changedTouches[0].clientX - r.left));
    }, { passive: false });
    cv.addEventListener("mousedown", function (e) {
      var r = cv.getBoundingClientRect();
      judgeTap(laneFromX(e.clientX - r.left));
    });
    function onKey(e) {
      if (selecting || paused || over || !song) return;
      var k = e.key, lane = -1;
      if (k === "a" || k === "A" || k === "ArrowLeft") lane = 0;
      else if (k === "s" || k === "S" || k === "ArrowDown") lane = 1;
      else if (k === "d" || k === "D" || k === "ArrowRight") lane = 2;
      if (lane >= 0) { e.preventDefault(); judgeTap(lane); }
    }
    document.addEventListener("keydown", onKey);

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over && song) step(dt);
      draw();
    }

    // leaving mid-song (or closing the app) always BANKS the run
    function bankExit() {
      if (!song || over || banked) return;
      var bank = bankRun(false);
      if (bank && sfx && sfx.toast) sfx.toast("🎵 Beat run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
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

    // ---------- test hook (on the canvas) ----------
    cv._beat = {
      state: function () {
        return {
          songIdx: songIdx, t: songT, score: score, combo: combo, health: health,
          encore: encore, banked: banked, over: over, grade: over ? gradeStr : computeGrade(),
          notes: countUpcoming(), unlocked: stats.songsCleared
        };
      },
      begin: function (i) { beginSong(i, false); },
      tap: function (lane) { judgeTap(lane); },
      nextNote: function () { var n = firstUnjudged(); return n ? { lane: n.lane, t: n.t } : null; },
      seek: function (v) {
        songT = v;
        for (var i = 0; i < notes.length; i++) { var n = notes[i]; if (!n.judged && n.t <= songT - MISS_LATE) n.judged = true; }
      },
      star: function () { var n = firstUnjudged(); if (n) { n.star = true; n.forced = true; } return n ? { lane: n.lane, t: n.t } : null; },
      drain: function () { health = 5; }
    };

    hud();
    if (global._beatdemo) { // screenshot demo: song 2, notes on screen, 23-combo + score
      global._beatdemo = 0;
      beginSong(1, false);
      songT = 6.0; combo = 23; bestComboRun = 23; score = 4200; encore = true;
      // judge everything already past OR inside the miss window, so the demo
      // doesn't open on a wall of spurious MISSes
      for (var di = 0; di < notes.length; di++) if (notes[di].t < songT + MISS_LATE) notes[di].judged = true;
      paused = true; // freeze the tableau — the demo exists for screenshots
      hud();
    } else {
      showSelect();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxBeat = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
