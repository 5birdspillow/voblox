/*
 * Voblox arcade game — 🗼 Word Tower Defense.
 * Slimes march the path toward your gate. Tap a build pad and ANSWER A WORD
 * to raise a turret there (the tower wears its word!). Tap a tower + answer
 * to upgrade it. Cannon/frost/zap/gold types unlock as waves go on. 20 waves
 * + bosses; 5 maps unlock with rank. Quit between waves and Continue later.
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;
  var TYPES = {
    cannon: { emoji: "💥", name: "Cannon", dmg: 3, rate: 0.9, range: 105, at: 1 },
    frost: { emoji: "❄️", name: "Frost", dmg: 1, rate: 0.8, range: 95, slow: 0.45, at: 3 },
    zap: { emoji: "⚡", name: "Zap", dmg: 1.4, rate: 0.32, range: 90, at: 6 },
    gold: { emoji: "💰", name: "Gold", dmg: 2, rate: 1.0, range: 100, bounty: 2, at: 9 }
  };
  var MAPS = [
    { name: "Green Valley", seed: 5, at: 0, grass: "#5cab3e", path: "#c8a870" },
    { name: "Dusty Canyon", seed: 13, at: 15, grass: "#d8b87a", path: "#a8845c" },
    { name: "Frozen Field", seed: 29, at: 35, grass: "#dceefc", path: "#9ab8d0" },
    { name: "Gloomy Grove", seed: 43, at: 60, grass: "#3a5a3e", path: "#6a5a4a" },
    { name: "Lava Land", seed: 61, at: 90, grass: "#8a4a3a", path: "#4a3a3a" }
  ];
  var MAX_WAVE = 20;

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("towerd");
    var save = (opts.resume && stats.resume) ? stats.resume : null;
    var mapIdx = save ? save.map : 0;
    // pick the highest unlocked map when starting fresh
    if (!save) { MAPS.forEach(function (m, i) { if (stats.rankPts >= m.at) mapIdx = i; }); }
    var MAP = MAPS[mapIdx];

    var wrap = document.createElement("div"); wrap.className = "gamewrap towerd";
    wrap.innerHTML =
      '<canvas id="tdcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="tdmsg">🗼 ' + MAP.name + "</div>" +
      '<div class="grow"><span id="tdwave">Wave 0/' + MAX_WAVE + '</span><span id="tdlives">❤️ 10</span>' +
      '<button class="replay" id="tdgo" type="button" title="Start wave">▶ START</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="tdbig"></div>' +
      '<div class="gover" id="tdq" style="display:none"></div>' +
      '<div class="runhint" id="tdhint">Tap a ⬜ pad + answer a word to build a tower!</div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#tdcv"), ctx = cv.getContext("2d");
    var W, H, path = [], pads = [];
    var rng = P.rng(MAP.seed);
    function buildMap() {
      path = []; var n = 9;
      for (var i = 0; i <= n; i++) {
        var t = i / n;
        path.push({ x: W * (0.06 + t * 0.88), y: H * (0.5 + Math.sin(t * Math.PI * 2.2 + MAP.seed) * 0.22) });
      }
      pads = [];
      for (var j = 0; j < n; j += 1) {
        var a = path[j], b = path[j + 1] || a;
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var dx = b.y - a.y, dy = -(b.x - a.x), d = Math.hypot(dx, dy) || 1;
        [-1, 1].forEach(function (s2, idx) {
          if ((j + idx) % 2 === 0) pads.push({ x: mx + (dx / d) * 62 * s2, y: my + (dy / d) * 62 * s2, tower: null });
        });
      }
    }
    function resize() { W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight; rng = P.rng(MAP.seed); buildMap(); relinkTowers(); }
    var towers = [];
    function relinkTowers() { towers.forEach(function (t, i) { if (pads[t.padIdx]) { pads[t.padIdx].tower = t; t.x = pads[t.padIdx].x; t.y = pads[t.padIdx].y; } }); }
    resize(); window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var running = true, raf = 0, lastT = performance.now(), run = 0;
    var wave = save ? save.wave : 0, lives = save ? save.lives : 10, unlockedNote = "";
    var slimes = [], spawnQ = [], state = "build", qOpen = false, lastFmt = null, kills = 0, gemsEarned = 0;
    if (save && save.towers) {
      save.towers.forEach(function (t2) {
        var t3 = { padIdx: t2.padIdx, type: t2.type, lvl: t2.lvl, word: t2.word, cd: 0, x: 0, y: 0 };
        towers.push(t3);
      });
      relinkTowers();
    }

    var msgEl = document.getElementById("tdmsg"), bigEl = document.getElementById("tdbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 950); }
    function hud() {
      document.getElementById("tdwave").textContent = "Wave " + wave + "/" + MAX_WAVE;
      document.getElementById("tdlives").textContent = "❤️ " + lives;
      document.getElementById("tdgo").style.display = state === "build" ? "" : "none";
    }
    function persist() {
      stats.resume = { map: mapIdx, wave: wave, lives: lives, towers: towers.map(function (t) { return { padIdx: t.padIdx, type: t.type, lvl: t.lvl, word: t.word }; }) };
      store.save();
    }

    // ---- waves ----
    function startWave() {
      if (state !== "build") return;
      wave++;
      var boss = wave % 5 === 0;
      var n = 5 + wave * 2;
      spawnQ = [];
      for (var i = 0; i < n; i++) spawnQ.push({ at: i * (0.85 - Math.min(0.4, wave * 0.02)), hp: 3 + wave * 1.3, boss: false });
      if (boss) spawnQ.push({ at: n * 0.6 + 1.5, hp: (3 + wave * 1.3) * 8, boss: true });
      state = "wave"; waveT = 0;
      big("Wave " + wave + (boss ? " — BOSS! 👾" : "!"), boss ? "#ffe14d" : "#9fd6ff");
      var unlocked = Object.keys(TYPES).filter(function (k) { return TYPES[k].at === wave; })[0];
      if (unlocked) { big("🔓 " + TYPES[unlocked].emoji + " " + TYPES[unlocked].name + " towers unlocked!", "#ffe14d"); }
      hud();
    }
    var waveT = 0;
    document.getElementById("tdgo").onclick = startWave;

    function unlockedTypes() { return Object.keys(TYPES).filter(function (k) { return wave + 1 >= TYPES[k].at; }); }

    // ---- build/upgrade via word questions ----
    var pendingPad = null, pendingTower = null, buildType = null;
    function tapAt(x, y) {
      if (qOpen || state === "end") return;
      // tower tap = upgrade
      for (var i = 0; i < towers.length; i++) {
        var t = towers[i];
        if (Math.hypot(t.x - x, t.y - y) < 30) { askUpgrade(t); return; }
      }
      for (var j = 0; j < pads.length; j++) {
        var p = pads[j];
        if (!p.tower && Math.hypot(p.x - x, p.y - y) < 32) { pickType(p, j); return; }
      }
    }
    function pickType(pad, padIdx) {
      var types = unlockedTypes();
      if (types.length === 1) { askBuild(pad, padIdx, types[0]); return; }
      var qEl = document.getElementById("tdq");
      qEl.innerHTML = '<div class="wqcard"><div class="wqtitle">🏗️ Pick a tower</div><div class="wqchoices">' +
        types.map(function (k) { return '<button class="wqc" data-t="' + k + '">' + TYPES[k].emoji + " " + TYPES[k].name + (TYPES[k].slow ? " (slows!)" : TYPES[k].bounty ? " (bonus 💎)" : TYPES[k].rate < 0.5 ? " (fast!)" : "") + "</button>"; }).join("") +
        '</div><button class="wqskip" id="tdqx">cancel</button></div>';
      qEl.style.display = "flex"; qOpen = true;
      document.getElementById("tdqx").onclick = function () { qEl.style.display = "none"; qEl.innerHTML = ""; qOpen = false; };
      Array.prototype.forEach.call(qEl.querySelectorAll(".wqc"), function (b) {
        b.onclick = function () { qEl.style.display = "none"; qEl.innerHTML = ""; qOpen = false; askBuild(pad, padIdx, b.dataset.t); };
      });
    }
    function askBuild(pad, padIdx, type) {
      qOpen = true;
      var q = VQ.miniQuiz(document.getElementById("tdq"), words, store, {
        title: "🏗️ Answer to build a " + TYPES[type].emoji + " " + TYPES[type].name + " tower!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt; qOpen = false;
          if (ok) {
            var t = { padIdx: padIdx, type: type, lvl: 1, word: q.word, cd: 0, x: pad.x, y: pad.y };
            pad.tower = t; towers.push(t); persist();
            big(TYPES[type].emoji + " Tower built — it knows '" + q.word + "'!", "#69f0ae");
            if (sfx) sfx.chime(); if (juice) juice.burst(pad.x, pad.y, "#69f0ae", 10);
          } else big("The tower crumbles… try another pad!", "#ff8a8a");
        }
      });
    }
    function askUpgrade(t) {
      if (t.lvl >= 3) { big("⭐ Max level!", "#ffe14d"); return; }
      qOpen = true;
      VQ.miniQuiz(document.getElementById("tdq"), words, store, {
        title: "⬆️ Answer to upgrade to level " + (t.lvl + 1) + "!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt; qOpen = false;
          if (ok) { t.lvl++; persist(); big("⬆️ Level " + t.lvl + "!", "#69f0ae"); if (sfx) sfx.coin(); }
          else big("Not this time — the tower stays level " + t.lvl + ".", "#ff8a8a");
        }
      });
    }
    cv.addEventListener("touchstart", function (e) { var r = cv.getBoundingClientRect(); tapAt(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top); }, { passive: true });
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); tapAt(e.clientX - r.left, e.clientY - r.top); });
    function onKey(e) { if ((e.key || "") === "Enter" && state === "build") startWave(); }
    document.addEventListener("keydown", onKey);

    // ---- slimes ----
    function pathPos(t) {
      var seg = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
      var f = t * (path.length - 1) - seg;
      var a = path[seg], b = path[seg + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    function stepWave(dt) {
      waveT += dt;
      for (var i = spawnQ.length - 1; i >= 0; i--) {
        if (spawnQ[i].at <= waveT) {
          var s = spawnQ.splice(i, 1)[0];
          slimes.push({ t: 0, hp: s.hp, max: s.hp, boss: s.boss, slow: 0, speed: 0.052 - Math.min(0.02, wave * 0.001) });
        }
      }
      for (var k2 = slimes.length - 1; k2 >= 0; k2--) {
        var sl = slimes[k2];
        sl.slow = Math.max(0, sl.slow - dt);
        sl.t += sl.speed * (sl.boss ? 0.55 : 1) * (sl.slow > 0 ? 0.5 : 1) * dt * 1.6;
        if (sl.t >= 1) {
          slimes.splice(k2, 1);
          lives -= sl.boss ? 3 : 1;
          if (juice) juice.shake(7); if (sfx) sfx.thud();
          hud();
          if (lives <= 0) return lose();
        }
      }
      // towers fire
      towers.forEach(function (t) {
        t.cd -= dt;
        if (t.cd > 0) return;
        var spec = TYPES[t.type], range = spec.range + t.lvl * 14;
        var best = null, bt = -1;
        slimes.forEach(function (sl2) {
          var p = pathPos(sl2.t);
          if (Math.hypot(p.x - t.x, p.y - t.y) <= range && sl2.t > bt) { bt = sl2.t; best = sl2; }
        });
        if (best) {
          t.cd = spec.rate;
          t.fx = pathPos(best.t); t.fxT = 0.12;
          hit(best, spec.dmg * (1 + (t.lvl - 1) * 0.7), spec, t);
          if (spec.emoji === "⚡") { // zap chains to one more
            var second = null, bt2 = -1;
            slimes.forEach(function (sl3) { var p3 = pathPos(sl3.t); if (sl3 !== best && Math.hypot(p3.x - t.x, p3.y - t.y) <= range && sl3.t > bt2) { bt2 = sl3.t; second = sl3; } });
            if (second) hit(second, spec.dmg * 0.7, spec, t);
          }
        }
      });
      if (!spawnQ.length && !slimes.length && state === "wave") {
        state = "build";
        if (wave >= MAX_WAVE) return winMap();
        big("✅ Wave " + wave + " cleared!", "#69f0ae"); if (sfx) sfx.coin();
        persist(); hud();
      }
    }
    function hit(sl, dmg, spec, t) {
      sl.hp -= dmg;
      if (spec.slow) sl.slow = 1.2;
      if (sl.hp <= 0) {
        var idx = slimes.indexOf(sl); if (idx !== -1) slimes.splice(idx, 1);
        kills++;
        var g = (sl.boss ? 6 : 1) + (spec.bounty || 0);
        gemsEarned += g;
        var p = pathPos(sl.t);
        if (juice) { juice.burst(p.x, p.y, sl.boss ? "#ffe14d" : "#9be870", sl.boss ? 18 : 7); juice.text(p.x, p.y - 12, "+" + g + "💎", "#ffe14d"); }
        if (sfx) sfx.pop();
      }
    }

    function lose() {
      state = "end"; endScreen(false);
    }
    function winMap() {
      state = "end"; endScreen(true);
    }
    function endScreen(winner) {
      running = false; cancelAnimationFrame(raf);
      stats.resume = null; store.save();
      var res = store.recordGame("towerd", {
        win: winner, score: wave,
        rankPtsDelta: winner ? 14 : wave >= 10 ? 6 : 2,
        xp: 8 + wave * 2 + (winner ? 30 : 0),
        gems: gemsEarned + (winner ? 80 : 0)
      });
      wrap.innerHTML = '<div class="card hero" style="max-width:480px;margin:60px auto 0;text-align:center;color:#20303a">' +
        '<div class="big-emoji">' + (winner ? "🏆" : "💔") + '</div>' +
        '<div class="hero-line">' + (winner ? "You defended " + MAP.name + "!" : "The slimes got through…") + "</div>" +
        '<div class="hero-sub">Wave ' + wave + " · " + kills + " splats · +" + (gemsEarned + (winner ? 80 : 0)) + " 💎" +
        (res.rankedUp ? " · <b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + "</div>" +
        '<button id="again" class="submit big-next">' + (winner ? "Play again 🗼" : "Try again 💪") + "</button>" +
        '<button id="leave2" class="menubtn" style="margin-top:10px">Back to the Arcade</button></div>';
      document.getElementById("again").onclick = again;
      document.getElementById("leave2").onclick = leave;
      if (winner && sfx) sfx.fanfare();
    }

    // ---- frame ----
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (qOpen) { draw(); return; }
      run += dt;
      if (state === "wave") stepWave(dt);
      if (juice) juice.update(dt);
      draw();
    }

    // ---- drawing ----
    function draw() {
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      ctx.fillStyle = MAP.grass; ctx.fillRect(-10, -10, W + 20, H + 20);
      // path
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
      for (var i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.strokeStyle = "rgba(0,0,0,.15)"; ctx.lineWidth = 46; ctx.stroke();
      ctx.strokeStyle = MAP.path; ctx.lineWidth = 38; ctx.stroke();
      // gate
      ctx.font = "34px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🏰", path[path.length - 1].x + 22, path[path.length - 1].y);
      // pads
      pads.forEach(function (p) {
        if (p.tower) return;
        ctx.fillStyle = "#ffffff44"; ctx.strokeStyle = "#ffffff88"; ctx.lineWidth = 2;
        ctx.fillRect(p.x - 20, p.y - 20, 40, 40); ctx.strokeRect(p.x - 20, p.y - 20, 40, 40);
        ctx.fillStyle = "#ffffffaa"; ctx.font = "18px serif"; ctx.fillText("＋", p.x, p.y);
      });
      // towers (each shows its word)
      towers.forEach(function (t) {
        var spec = TYPES[t.type];
        ctx.fillStyle = "#4a5568"; ctx.fillRect(t.x - 16, t.y - 12, 32, 26);
        ctx.fillStyle = "#2d3748"; ctx.fillRect(t.x - 20, t.y - 20, 40, 12);
        ctx.font = "20px serif"; ctx.fillText(spec.emoji, t.x, t.y - 22);
        for (var l = 0; l < t.lvl; l++) { ctx.font = "9px serif"; ctx.fillText("⭐", t.x - 10 + l * 10, t.y + 8); }
        ctx.font = "bold 11px Trebuchet MS, sans-serif";
        ctx.fillStyle = "#00000066"; ctx.fillText(t.word, t.x + 1, t.y + 24);
        ctx.fillStyle = "#ffe14d"; ctx.fillText(t.word, t.x, t.y + 23);
        if (t.fxT > 0) { t.fxT -= 0.016; ctx.strokeStyle = spec.slow ? "#9fd6ff" : "#ffe14d"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(t.x, t.y - 18); ctx.lineTo(t.fx.x, t.fx.y); ctx.stroke(); }
      });
      // slimes
      slimes.forEach(function (sl) {
        var p = pathPos(sl.t);
        var sz = sl.boss ? 34 : 20;
        ctx.font = sz + "px serif";
        ctx.fillText(sl.boss ? "👾" : "🟢", p.x, p.y + Math.sin(run * 8 + sl.t * 40) * 2);
        var w2 = sl.boss ? 40 : 24;
        ctx.fillStyle = "#00000055"; ctx.fillRect(p.x - w2 / 2, p.y - sz * 0.8, w2, 4);
        ctx.fillStyle = "#9be870"; ctx.fillRect(p.x - w2 / 2, p.y - sz * 0.8, w2 * Math.max(0, sl.hp / sl.max), 4);
      });
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    function cleanup() {
      running = false; cancelAnimationFrame(raf); VQ.shush();
      document.removeEventListener("keydown", onKey); window.removeEventListener("resize", resize);
      if (wrap.parentNode) wrap.remove();
    }
    function leave() { if (state !== "end" && wave > 0 && lives > 0) persist(); cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { stats.resume = null; store.save(); cleanup(); start(opts); }
    document.getElementById("quit").onclick = leave;

    msgEl.innerHTML = "🗼 <b>" + MAP.name + "</b>" + (save ? " — welcome back! Wave " + (wave + 1) + " awaits" : " — build towers, stop the slimes!");
    hud();
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxTowerD = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
