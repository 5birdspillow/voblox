/*
 * Voblox arcade game — 🎹 PIANO PANIC (a Piano-Tiles-style SPEED tapper).
 * FOUR columns; a lane of tiles scrolls DOWN forever. Every ROW has exactly one
 * BLACK key (the rest white). SMASH the black key while it sits in the bottom
 * ACTIVE ZONE — the lane instantly jumps a row and speeds up a hair. This is a
 * RACE, not a timing judge (unlike Beat Bounce): go as FAST as your fingers move.
 *   ⏱ 60-SECOND RUSH — clear as many keys as you can before the clock hits 0.
 *   🔥 MARATHON — no clock, speed ramps forever, run ends on the 3rd missed black.
 * KID-KIND: in Rush a wrong tap / missed black costs 2 SECONDS, never the run.
 * MUSIC: every cleared key plays the next note of a 16-note pentatonic loop (with
 * a bass thump every 8th), so fast play literally performs a tune — muted-safe.
 * VOCAB IS PURE UPSIDE (wrong answers NEVER punish):
 *   📜 ENCORE — once per rush, at ≤15s a word buys +15 SECONDS.
 *   🔥 FEVER  — every 40-clear streak offers a word; correct = 6s of DOUBLE keys.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("piano") per
 * run, banked on run-end, quit, AND app-close. bestRush/bestMarathon persist.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var COLS = 4;                 // D F J K
  var RUSHTIME = 60;            // headline clock (seconds)
  var SPEED0 = 1.0, RAMP = 0.03, RUSHCAP = 2.6; // marathon is UNcapped
  var BASE = 0.85;             // rows-per-second the lane falls at speed 1
  var QUEUE = 8;               // rows kept in the lane (bottom-first)
  var VISROWS = 6;             // rows drawn on screen
  var STRIKE_S = 2;            // a strike costs THIS many rush seconds (kid-kind)
  var FEVER_S = 6, FEVER_STREAK = 40, ENCORE_AT = 15;
  var KEYCH = ["D", "F", "J", "K"];
  // a cheerful C-major pentatonic loop — the chart IS the tune
  var MELODY = [523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33,
                523.25, 659.25, 783.99, 1046.50, 880.00, 783.99, 659.25, 523.25];
  var BASS = [130.81, 196.00]; // C3 / G3 alternating thump

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("piano");
    // additive save fields — NEVER rename/remove
    stats.bestRush = stats.bestRush || 0;
    stats.bestMarathon = stats.bestMarathon || 0;
    stats.totalKeys = stats.totalKeys || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap piano";
    // full-screen canvas + touch lockdown, inline so this game ships no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="pncv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="pnmsg">🎹 Piano Panic</div>' +
      '<div class="grow"><span id="pnkeys">🎹 0</span><span id="pntime"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="pnbig"></div>' +
      '<button id="pnenc" type="button" style="display:none;position:absolute;left:50%;' +
      'bottom:calc(env(safe-area-inset-bottom) + 40px);transform:translateX(-50%);z-index:8;' +
      'background:linear-gradient(#ffe14d,#ffb01f);color:#5a3d00;border:none;border-radius:16px;' +
      'padding:14px 22px;font-family:inherit;font-weight:900;font-size:18px;' +
      'box-shadow:0 6px 0 #b9791a,0 10px 24px #0006;cursor:pointer">📜 +15 seconds — answer a word!</button>' +
      '<div class="gover" id="pnq" style="display:none"></div>' +
      '<div class="gover" id="pncard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#pncv"), ctx = cv.getContext("2d");
    var msgEl = wrap.querySelector("#pnmsg"), bigEl = wrap.querySelector("#pnbig");
    var encBtn = wrap.querySelector("#pnenc");
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
    var mode = null;                       // "rush" | "marathon" | null (picker)
    var keys = 0, combo = 0, strikes = 0;  // combo == clean-streak (drives FEVER)
    var t = 0, left = RUSHTIME, speed = SPEED0, noteIdx = 0;
    var rows = [], scroll = 0;             // scroll 0..1 = how far the active row has fallen
    var feverT = 0, hitPause = 0, strikeFlashT = 0;
    var encoreUsed = false, lastFeverOffer = 0, lastMilestone = 0;
    var over = false, paused = true, banked = false, statsSaved = false;
    var lastFmt = null, touchedAt = -1e9;

    function genRow() { return { black: Math.floor(Math.random() * COLS) }; }

    function big(m, col) {
      if (!bigEl) return;
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { if (bigEl) bigEl.style.opacity = "0"; }, 900);
    }
    function msg(m) { if (msgEl) msgEl.innerHTML = m; }
    function updateHud() {
      var k = wrap.querySelector("#pnkeys"), tm = wrap.querySelector("#pntime");
      if (k) k.textContent = "🎹 " + keys + (feverT > 0 ? " 🔥2×" : "") + (combo > 1 ? "  ×" + combo : "");
      if (tm) tm.textContent = mode === "rush" ? "⏱ " + Math.ceil(Math.max(0, left)) + "s"
        : mode === "marathon" ? "❌ " + strikes + "/3" : "";
    }
    function updateEncoreBtn() {
      if (!encBtn) return;
      var show = mode === "rush" && !over && !paused && !encoreUsed && left <= ENCORE_AT && left > 0;
      encBtn.style.display = show ? "block" : "none";
    }
    function hideEncBtn() { if (encBtn) encBtn.style.display = "none"; }

    // ---------- mode picker ----------
    function showPicker() {
      mode = null; paused = true; over = false;
      var card = document.getElementById("pncard");
      card.innerHTML = '<div class="wqcard" style="text-align:center;max-width:520px">' +
        '<div style="font-size:44px">🎹</div><div class="wqtitle" style="font-size:22px">Piano Panic</div>' +
        '<div style="margin:2px 0 12px;color:#5a6b7a;font-weight:bold">Smash the BLACK keys as fast as you can!</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' +
        '<button class="embtn mode" style="min-width:160px" data-mode="rush">' +
        '<span class="ebl">⏱ 60-Second Rush</span><span class="ebs">best: ' + stats.bestRush + ' keys</span></button>' +
        '<button class="embtn" style="min-width:160px" data-mode="marathon">' +
        '<span class="ebl">🔥 Marathon</span><span class="ebs">best: ' + stats.bestMarathon + ' keys · 3 misses</span></button>' +
        '</div>' +
        '<div style="font-size:11px;color:#8a98a8;margin-top:10px">D F J K keys · or tap the columns</div></div>';
      card.style.display = "flex";
      Array.prototype.forEach.call(card.querySelectorAll("[data-mode]"), function (b) {
        b.onclick = function () { startRun(b.dataset.mode); };
      });
      updateHud();
    }

    // ---------- run lifecycle ----------
    function startRun(m) {
      mode = m;
      keys = 0; combo = 0; strikes = 0;
      t = 0; left = RUSHTIME; speed = SPEED0; noteIdx = 0;
      feverT = 0; hitPause = 0; strikeFlashT = 0; scroll = 0;
      encoreUsed = false; lastFeverOffer = 0; lastMilestone = 0;
      over = false; paused = false; banked = false; statsSaved = false;
      rows = []; for (var i = 0; i < QUEUE; i++) rows.push(genRow());
      hideEncBtn();
      document.getElementById("pncard").style.display = "none";
      document.getElementById("pnq").style.display = "none";
      msg(m === "rush" ? "⏱ <b>60-Second Rush</b>" : "🔥 <b>Marathon</b>");
      big(m === "rush" ? "⏱ GO — smash the black keys!" : "🔥 MARATHON — how far can you go?", "#ffe14d");
      updateHud(); lastT = performance.now();
    }

    // ---------- music: the chart IS the tune ----------
    function playNote() {
      if (!sfx || !sfx.tone) return;
      sfx.tone(MELODY[noteIdx % MELODY.length], 0.18, "triangle", 0.06);
      if (noteIdx % 8 === 0) sfx.tone(BASS[Math.floor(noteIdx / 8) % BASS.length], 0.3, "sine", 0.07);
    }

    // ---------- core actions ----------
    function clearRow() {
      var hitCol = rows[0].black;
      keys += feverT > 0 ? 2 : 1;
      combo++;
      playNote(); noteIdx++;
      rows.shift(); rows.push(genRow());
      scroll = 0; // the fresh active row starts at the top of the zone
      speed += RAMP; if (mode === "rush" && speed > RUSHCAP) speed = RUSHCAP;
      if (combo >= 10 && combo % 25 === 0 && combo !== lastMilestone) {
        lastMilestone = combo; big(combo + "!!", "#69f0ae");
        if (juice) juice.shake(3); if (sfx && sfx.chime) sfx.chime();
      }
      if (sfx && sfx.pop) sfx.pop();
      if (juice) juice.burst(colCenter(hitCol), H * 0.86, feverT > 0 ? "#ffd23f" : "#40c4ff", 6);
      // 🔥 FEVER offer on every clean 40-streak (once per threshold)
      if (combo > 0 && combo % FEVER_STREAK === 0 && combo !== lastFeverOffer && feverT <= 0) {
        lastFeverOffer = combo; feverQuiz();
      }
      updateHud();
    }
    function registerStrike(rewind) {
      combo = 0; strikes++;
      strikeFlashT = 0.32; hitPause = 0.2;
      if (rewind) scroll = Math.max(0, scroll - 0.25); // white tap: lane rewinds a touch
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) { juice.shake(5); juice.text(W / 2, H * 0.5, "❌", "#ff6b6b"); }
      if (mode === "rush") { left -= STRIKE_S; if (left <= 0) { left = 0; endRun(); } }
      else if (mode === "marathon" && strikes >= 3) { endRun(); }
      updateHud();
    }
    function tap(col) {
      if (over || paused || !mode || !rows.length) return;
      if (col === rows[0].black) clearRow();
      else registerStrike(true);
    }

    // ---------- simulation ----------
    function step(dt) {
      t += dt;
      if (feverT > 0) { feverT -= dt; if (feverT <= 0) { feverT = 0; big("fever over!", "#8ecdf7"); updateHud(); } }
      if (strikeFlashT > 0) strikeFlashT -= dt;
      if (mode === "rush") {
        left -= dt;
        if (left <= 0) { left = 0; endRun(); return; }
        updateEncoreBtn();
      }
      // the lane falls; hitPause briefly freezes it after a strike
      if (hitPause > 0) { hitPause -= dt; }
      else {
        scroll += dt * speed * BASE;
        var guardN = 0;
        while (scroll >= 1 && !over && guardN < COLS) { // black scrolled past the zone = missed black
          guardN++;
          rows.shift(); rows.push(genRow()); scroll -= 1;
          registerStrike(false);
        }
      }
      updateHud();
    }

    // ---------- word hooks (pure upside) ----------
    function encoreQuiz() {
      if (over || !mode) return;
      paused = true; encoreUsed = true; hideEncBtn();
      cv._lastQ = VQ.miniQuiz(document.getElementById("pnq"), words, store, {
        title: "📜 +15 SECONDS — answer a word!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false; lastT = performance.now();
          if (ok) { left += 15; big("📜 +15 SECONDS!", "#69f0ae"); if (sfx && sfx.coin) sfx.coin(); if (juice) juice.shake(4); }
          else big("No worries — keep smashing!", "#8ecdf7");
          updateHud();
        }
      });
    }
    function feverQuiz() {
      if (over || !mode) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("pnq"), words, store, {
        title: "🔥 FEVER! Answer for 6 seconds of DOUBLE keys!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false; lastT = performance.now();
          if (ok) { feverT = FEVER_S; big("🔥 FEVER — keys count DOUBLE!", "#ffd23f"); if (sfx && sfx.fanfare) sfx.fanfare(); if (juice) juice.shake(6); }
          else big("No fever — keep the streak going!", "#8ecdf7");
          updateHud();
        }
      });
    }

    // ---------- economy: ONE bank per run, guarded ----------
    function rewards(won) {
      return {
        win: !!won, score: keys,
        rankPtsDelta: Math.min(12, 2 + Math.floor(keys / 10) + (won ? 3 : 0)),
        xp: Math.min(80, 6 + keys * 2),
        gems: 3 + Math.floor(keys / 4) + (won ? 5 : 0)
      };
    }
    function bankRun(won) {
      if (banked) return null;
      banked = true;
      var rw = rewards(won);
      var res = store.recordGame ? store.recordGame("piano", rw) : null;
      return { rw: rw, res: res };
    }
    // additive persistence — best per mode + lifetime keys, exactly once per run
    function persistStats() {
      if (statsSaved) return; statsSaved = true;
      if (mode === "rush" && keys > (stats.bestRush || 0)) stats.bestRush = keys;
      if (mode === "marathon" && keys > (stats.bestMarathon || 0)) stats.bestMarathon = keys;
      stats.totalKeys = (stats.totalKeys || 0) + keys;
      store.save();
    }
    function didWin() {
      return keys > (mode === "rush" ? (stats.bestRush || 0) : (stats.bestMarathon || 0));
    }

    function endRun() {
      if (over) return;
      over = true; paused = true; hideEncBtn();
      var won = didWin();
      persistStats();
      var bank = bankRun(won) || { rw: rewards(won), res: null };
      showCard(won, bank.rw, bank.res);
      if (won && sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(6); for (var i = 0; i < 5; i++) juice.burst(W * (0.2 + i * 0.15), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][i], 16); }
    }

    function showCard(won, rw, res) {
      var card = document.getElementById("pncard");
      var kps = (keys / Math.max(1, t)).toFixed(1);
      var best = mode === "rush" ? stats.bestRush : stats.bestMarathon;
      var title = mode === "rush" ? (won ? "⏱ NEW BEST — " + keys + " keys!" : "⏱ Time! " + keys + " keys")
        : (won ? "🔥 NEW BEST — " + keys + " keys!" : "🔥 Marathon over — " + keys + " keys");
      var pay = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP</div>";
      card.innerHTML = '<div class="wqcard" style="text-align:center;max-width:520px">' +
        '<div style="font-size:44px">' + (won ? "🏆" : "🎹") + "</div>" +
        '<div class="wqtitle" style="font-size:20px">' + title + "</div>" + pay +
        '<div style="margin:2px 0;color:#5a6b7a">🎹 ' + keys + " keys · ⚡ " + kps + "/s · best " + best +
        (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px">' +
        '<button class="submit big-next" id="pn_again">▶ PLAY AGAIN</button>' +
        '<button class="embtn" style="min-width:100px" id="pn_modes"><span class="ebl">🎛 Modes</span></button>' +
        '<button class="embtn" style="min-width:90px" id="pn_leave"><span class="ebl">🚪 Leave</span></button>' +
        "</div></div>";
      card.style.display = "flex";
      var a = document.getElementById("pn_again"); if (a) a.onclick = function () { startRun(mode); };
      var m = document.getElementById("pn_modes"); if (m) m.onclick = showPicker;
      var l = document.getElementById("pn_leave"); if (l) l.onclick = exit;
    }

    // ---------- drawing ----------
    function colW() { return W / COLS; }
    function colCenter(c) { return c * colW() + colW() / 2; }
    function rowH() { return H / VISROWS; }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1a1030"); g.addColorStop(1, "#0b0716");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var cw = colW(), rh = rowH();
      // column separators
      ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 1;
      for (var c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, H); ctx.stroke(); }
      // ACTIVE ZONE band at the bottom — glow hue shifts up with speed, gold in FEVER
      var hue = Math.max(0, Math.min(300, (speed - 1) * 120));
      var zoneCol = feverT > 0 ? "rgba(255,210,63,.28)" : "hsla(" + Math.round(200 - hue) + ",90%,60%,.18)";
      ctx.fillStyle = zoneCol; ctx.fillRect(0, H - rh, W, rh);
      ctx.strokeStyle = feverT > 0 ? "#ffd23f" : "hsl(" + Math.round(200 - hue) + ",90%,65%)";
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, H - rh); ctx.lineTo(W, H - rh); ctx.stroke();
      // tiles: rows[0] is the bottom active row; higher indices climb the screen
      for (var i = 0; i < rows.length && i < VISROWS + 1; i++) {
        var y = H - rh * (i + 1) + scroll * rh;
        for (var col = 0; col < COLS; col++) {
          var black = rows[i].black === col;
          var x = col * cw;
          if (black) {
            ctx.fillStyle = i === 0 ? (feverT > 0 ? "#3a2f10" : "#141024") : "#141024";
            ctx.fillRect(x + 3, y + 3, cw - 6, rh - 6);
            ctx.fillStyle = feverT > 0 ? "#ffd23f" : "#5c9bff";
            ctx.fillRect(x + 3, y + 3, cw - 6, 5);
          } else {
            ctx.fillStyle = "rgba(255,255,255,.05)";
            ctx.fillRect(x + 3, y + 3, cw - 6, rh - 6);
          }
        }
      }
      // desktop key hints along the bottom
      ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
      for (var kc = 0; kc < COLS; kc++) ctx.fillText(KEYCH[kc], colCenter(kc), H - 12);
      // strike flash overlay
      if (strikeFlashT > 0) { ctx.fillStyle = "rgba(255,60,60," + (strikeFlashT * 0.6) + ")"; ctx.fillRect(0, 0, W, H); }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input (iOS phantom-tap safe) ----------
    function colFromX(px) {
      var r = cv.getBoundingClientRect();
      return Math.max(0, Math.min(COLS - 1, Math.floor((px - r.left) / (colW() || 1))));
    }
    cv.addEventListener("touchstart", function (e) {
      e.preventDefault();
      touchedAt = performance.now();
      tap(colFromX(e.changedTouches[0].clientX));
    }, { passive: false });
    cv.addEventListener("mousedown", function (e) {
      if (performance.now() - touchedAt < 500) return; // swallow the phantom click after a touch
      tap(colFromX(e.clientX));
    });
    function onKey(e) {
      if (over || paused || !mode) return;
      var k = (e.key || "").toLowerCase(), col = -1;
      if (k === "d") col = 0; else if (k === "f") col = 1; else if (k === "j") col = 2; else if (k === "k") col = 3;
      if (col >= 0) { e.preventDefault(); tap(col); }
    }
    document.addEventListener("keydown", onKey);
    if (encBtn) encBtn.onclick = encoreQuiz;

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over && mode) step(dt);
      draw();
    }

    // leaving mid-run (or closing the app) always BANKS the run
    function bankExit() {
      if (!mode || over || banked) return;
      persistStats();
      var bank = bankRun(didWin());
      if (bank && sfx && sfx.toast) sfx.toast("🎹 Piano run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
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
    cv._piano = {
      state: function () {
        return {
          mode: mode, t: t, left: mode === "rush" ? left : 0,
          keys: keys, combo: combo, strikes: strikes, speed: speed,
          fever: feverT > 0, banked: banked, over: over
        };
      },
      begin: function (m) { startRun(m); },
      rows: function () { return rows.map(function (r) { return { black: r.black }; }); },
      tap: function (col) { tap(col); },
      tapBlack: function () { if (rows.length) tap(rows[0].black); },
      miss: function () { registerStrike(false); },
      warp: function (v) { t = v; left = Math.max(0, RUSHTIME - v); updateEncoreBtn(); updateHud(); },
      encoreQuiz: function () { encoreQuiz(); },
      feverQuiz: function () { feverQuiz(); }
    };

    updateHud();
    if (global._pianodemo) { // screenshot demo: a rush mid-run, mid-scroll, FEVER lit
      global._pianodemo = 0;
      startRun("rush");
      keys = 28; combo = 22; t = 26; left = 34; speed = 1.6; feverT = 3; scroll = 0.4; noteIdx = 28;
      paused = true; // freeze the tableau for the screenshot
      updateHud();
    } else {
      showPicker();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxPiano = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
