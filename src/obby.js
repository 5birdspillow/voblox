/*
 * Voblox arcade game — 🧗 Sky Obby.
 * Roblox-style sky obstacle course: run and double-jump across floating
 * platforms (some move, some vanish, spinners knock you back), racing two AI
 * ghosts to the finish flag. Word checkpoints save your respawn point.
 * 20 stages across 4 sky worlds; falling just sends you back to a checkpoint.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;
  var WORLDS = [
    { name: "Sunny Skies", top: "#8ecbff", bot: "#e3f3ff", plat: "#5cab3e", edge: "#3f7e2a" },
    { name: "Sunset Sky", top: "#ff9a6a", bot: "#ffd1a8", plat: "#b06dff", edge: "#7a4fd0" },
    { name: "Frost Heights", top: "#a8c8e8", bot: "#e8f4ff", plat: "#7ec8ff", edge: "#4a8ac0" },
    { name: "Star Space", top: "#1a1a3e", bot: "#3a3a6e", plat: "#ffd76a", edge: "#c09020" }
  ];
  var STAGES_PER = 5, GRAV = 1500, JUMP = 560, SPEED = 240;

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("obby");
    if (!stats.resume) stats.resume = { stage: 0, stars: [] };
    var prog = stats.resume;
    var stageIdx = Math.min(prog.stage, STAGES_PER * WORLDS.length - 1);
    var world = WORLDS[Math.floor(stageIdx / STAGES_PER)];

    var wrap = document.createElement("div"); wrap.className = "gamewrap obby";
    wrap.innerHTML =
      '<canvas id="obcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="obmsg">🧗 Sky Obby</div>' +
      '<div class="grow"><span id="obstage">Stage ' + (stageIdx + 1) + '</span><span id="obtime">0.0s</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="obbig"></div>' +
      '<div class="gover" id="obq" style="display:none"></div>' +
      '<button class="kbtn left" id="obL" type="button">◀</button>' +
      '<button class="kbtn right" id="obR" type="button">▶</button>' +
      '<button class="sbtn shoot" id="obJ" type="button" style="border-radius:50%;padding:20px 24px">⤒</button>' +
      '<div class="runhint">Hold ◀ ▶ to run • ⤒ to jump (twice = double-jump!)</div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#obcv"), ctx = cv.getContext("2d");
    var W, H;
    function resize() { W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight; }
    resize(); window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var myCfg = AV.resolve(store.state);

    // ---- stage generation (seeded, so stage N is always the same course) ----
    var rng = P.rng(1000 + stageIdx * 17);
    var plats = [], checkpoints = [], spinners = [], finishX = 0;
    (function gen() {
      var x = 0, y = 0.62, n = 14 + Math.floor(stageIdx / 2);
      plats.push({ x: -60, y: y, w: 220, type: "s" });
      for (var i = 0; i < n; i++) {
        var gap = 90 + rng() * (70 + Math.min(60, stageIdx * 6));
        var w = Math.max(70, 150 - stageIdx * 3 - rng() * 40);
        x += gap + w;
        y = Math.max(0.25, Math.min(0.8, y + (rng() - 0.5) * 0.3));
        var r = rng(), type = "s";
        if (stageIdx > 1 && r < 0.18) type = "m";      // moving
        else if (stageIdx > 3 && r < 0.32) type = "v"; // vanishing
        plats.push({ x: x, y: y, w: w, type: type, ph: rng() * 6 });
        if (stageIdx > 5 && rng() < 0.22) spinners.push({ x: x + w / 2, y: y - 0.13, ph: rng() * 6 });
        if (i === Math.floor(n / 3) || i === Math.floor((2 * n) / 3)) checkpoints.push({ x: x + w / 2, y: y, on: false });
      }
      finishX = x + 160;
      plats.push({ x: finishX - 80, y: 0.6, w: 220, type: "s" });
    })();

    function platY(p) { return p.y * H + (p.type === "m" ? Math.sin(run * 1.4 + p.ph) * H * 0.09 : 0); }
    function platGone(p) { return p.type === "v" && Math.sin(run * 1.8 + p.ph) < -0.25; }

    // ---- entities ----
    var me = { x: 40, y: 0, vx: 0, vy: 0, ground: false, jumps: 0, coyote: 0, respawn: { x: 40 } };
    me.y = platY(plats[0]) - 1;
    var rivals = Bots.pickOpponents(2, P.botSkillFor(stats.rankPts));
    var ghosts = rivals.map(function (b, i) {
      return { bot: b, wp: 0, x: 20 - i * 18, y: me.y, t: 0, speed: (0.75 + b.skill * 0.45), done: 0, jumpT: 9 };
    });
    var running = true, raf = 0, lastT = performance.now(), run = 0, camX = 0, time = 0, state = "play", qOpen = false, lastFmt = null, doneRank = 0, bubble = null;
    var kL = false, kR = false;

    var msgEl = document.getElementById("obmsg"), bigEl = document.getElementById("obbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 950); }

    // ---- input ----
    function hold(el, set) {
      el.addEventListener("touchstart", function () { set(true); }, { passive: true });
      el.addEventListener("touchend", function () { set(false); }, { passive: true });
      el.addEventListener("mousedown", function () { set(true); });
      window.addEventListener("mouseup", function () { set(false); });
    }
    hold(document.getElementById("obL"), function (v) { kL = v; });
    hold(document.getElementById("obR"), function (v) { kR = v; });
    function jump() {
      if (qOpen || state !== "play") return;
      if (me.ground || me.coyote > 0) { me.vy = -JUMP; me.ground = false; me.coyote = 0; me.jumps = 1; if (sfx) sfx.pop(); }
      else if (me.jumps === 1) { me.vy = -JUMP * 0.92; me.jumps = 2; if (sfx) sfx.whoosh(); if (juice) juice.burst(me.x - camX, me.y, "#ffffff", 5); }
    }
    document.getElementById("obJ").addEventListener("touchstart", function () { jump(); }, { passive: true });
    document.getElementById("obJ").addEventListener("mousedown", jump);
    function onKey(e) {
      var k = (e.key || "").toLowerCase();
      if (k === "arrowleft" || k === "a") kL = true;
      if (k === "arrowright" || k === "d") kR = true;
      if (k === " " || k === "arrowup" || k === "w") { e.preventDefault(); jump(); }
    }
    function onKeyUp(e) { var k = (e.key || "").toLowerCase(); if (k === "arrowleft" || k === "a") kL = false; if (k === "arrowright" || k === "d") kR = false; }
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);

    // ---- checkpoints (the word hook) ----
    function tryCheckpoint(c) {
      if (c.on || qOpen) return;
      qOpen = true;
      VQ.miniQuiz(document.getElementById("obq"), words, store, {
        title: "🚩 Word Checkpoint — answer to save your spot!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt; qOpen = false;
          if (ok) {
            c.on = true; me.respawn = { x: c.x };
            big("🚩 Checkpoint saved!" + (res && res.earned ? " +" + res.earned + " 💎" : ""), "#69f0ae");
            if (sfx) sfx.chime(); if (juice) juice.burst(c.x - camX, c.y * H - 30, "#69f0ae", 12);
          } else big("Almost! Touch the flag to try again.", "#ff8a8a");
        }
      });
    }
    function respawn() {
      me.x = me.respawn.x; me.vx = 0; me.vy = 0; me.jumps = 0;
      var best = plats[0];
      plats.forEach(function (p) { if (Math.abs(p.x + p.w / 2 - me.x) < Math.abs(best.x + best.w / 2 - me.x)) best = p; });
      me.y = platY(best) - 1;
      big("☁️ Bounced back!", "#9fd6ff"); if (sfx) sfx.buzz();
    }

    // ---- frame ----
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (qOpen) { draw(); return; }
      run += dt;
      if (state === "play") {
        time += dt;
        // me physics
        var ax = (kL ? -1 : 0) + (kR ? 1 : 0);
        me.vx += (ax * SPEED - me.vx) * Math.min(1, dt * 10);
        me.vy += GRAV * dt;
        me.x += me.vx * dt;
        var prevY = me.y;
        me.y += me.vy * dt;
        me.ground = false;
        me.coyote -= dt;
        plats.forEach(function (p) {
          if (platGone(p)) return;
          var py = platY(p);
          if (me.x > p.x - 8 && me.x < p.x + p.w + 8 && prevY <= py + 2 && me.y >= py - 2 && me.vy >= 0) {
            me.y = py; me.vy = 0; me.ground = true; me.coyote = 0.12; me.jumps = 0;
          }
        });
        // spinners knock you back
        spinners.forEach(function (s) {
          var sy = s.y * H, ang = run * 2.4 + s.ph;
          var tipX = s.x + Math.cos(ang) * 46, tipY = sy + Math.sin(ang) * 46;
          [[tipX, tipY], [s.x - Math.cos(ang) * 46, sy - Math.sin(ang) * 46]].forEach(function (t2) {
            if (Math.hypot(t2[0] - me.x, t2[1] - me.y + 20) < 24) { me.vx = -260; me.vy = -260; if (juice) juice.shake(6); if (sfx) sfx.thud(); }
          });
        });
        // checkpoints + finish + fall
        checkpoints.forEach(function (c) { if (!c.on && Math.abs(c.x - me.x) < 26 && Math.abs(c.y * H - me.y) < 60) tryCheckpoint(c); });
        if (me.x >= finishX) return finish();
        if (me.y > H + 60) respawn();
        // ghosts follow the platform rail
        ghosts.forEach(function (g) {
          if (g.done) return;
          g.t += dt;
          var target = plats[Math.min(g.wp + 1, plats.length - 1)];
          var tx = target.x + target.w / 2, ty = platY(target);
          var d = Math.hypot(tx - g.x, ty - g.y);
          var sp = 170 * g.speed;
          if (d < 20) { g.wp++; g.jumpT = 0; if (g.wp >= plats.length - 1) { g.done = ++doneRank; if (!me.done) bubble = { who: g, text: Bots.say(g.bot, "win"), age: 0 }; } }
          else { g.x += ((tx - g.x) / d) * sp * dt; g.y += ((ty - g.y) / d) * sp * dt * 1.4; }
          g.jumpT += dt;
          if (g.bot.skill < 0.6 && Math.random() < dt * 0.06) g.t -= 0.6; // wobbles
        });
        camX += (Math.max(0, me.x - W * 0.35) - camX) * Math.min(1, dt * 6);
        document.getElementById("obtime").textContent = time.toFixed(1) + "s";
      }
      if (bubble) { bubble.age += dt; if (bubble.age > 2.2) bubble = null; }
      if (juice) juice.update(dt);
      draw();
    }

    function finish() {
      if (state !== "play") return;
      state = "end"; running = false; cancelAnimationFrame(raf);
      var place = 1 + ghosts.filter(function (g) { return g.done; }).length;
      var stars = place === 1 ? 3 : place === 2 ? 2 : 1;
      prog.stars[stageIdx] = Math.max(prog.stars[stageIdx] || 0, stars);
      prog.stage = Math.min(stageIdx + 1, STAGES_PER * WORLDS.length - 1);
      store.save();
      var res = store.recordGame("obby", {
        win: place === 1, score: stageIdx + 1,
        rankPtsDelta: place === 1 ? 8 : place === 2 ? 5 : 3,
        xp: 10 + stars * 5, gems: 8 + stars * 8
      });
      wrap.innerHTML = '<div class="card hero" style="max-width:480px;margin:60px auto 0;text-align:center;color:#20303a">' +
        '<div class="big-emoji">' + (place === 1 ? "🏁" : "⭐") + '</div>' +
        '<div class="hero-line">Stage ' + (stageIdx + 1) + " done — " + (place === 1 ? "1st place!" : place === 2 ? "2nd place!" : "made it!") + "</div>" +
        '<div class="hero-sub">' + "⭐".repeat(stars) + " · " + time.toFixed(1) + "s" +
        (res.rankedUp ? " · <b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + "</div>" +
        '<button id="again" class="submit big-next">Next stage ▶</button>' +
        '<button id="leave2" class="menubtn" style="margin-top:10px">Back to the Arcade</button></div>';
      document.getElementById("again").onclick = again;
      document.getElementById("leave2").onclick = leave;
      if (sfx) sfx.fanfare();
    }

    // ---- drawing ----
    function draw() {
      var ox = (juice ? juice.ox : 0) - camX, oy = juice ? juice.oy : 0;
      ctx.save();
      var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, world.top); sky.addColorStop(1, world.bot);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // parallax clouds
      ctx.globalAlpha = 0.5; ctx.font = "28px serif"; ctx.textAlign = "center";
      for (var c2 = 0; c2 < 8; c2++) { var cx = ((c2 * 340 - camX * 0.4) % (W + 300)) - 150; ctx.fillText(world.name === "Star Space" ? "⭐" : "☁️", cx + (cx < -140 ? W + 300 : 0), 60 + (c2 % 4) * 70); }
      ctx.globalAlpha = 1;
      ctx.translate(ox, oy);
      // platforms
      plats.forEach(function (p) {
        if (p.x + p.w < camX - 40 || p.x > camX + W + 40) return;
        var py = platY(p), gone = platGone(p);
        ctx.globalAlpha = gone ? 0.18 : 1;
        ctx.fillStyle = world.plat; ctx.fillRect(p.x, py, p.w, 16);
        ctx.fillStyle = world.edge; ctx.fillRect(p.x, py + 12, p.w, 6);
        if (p.type === "v" && !gone) { ctx.fillStyle = "#ffffff66"; ctx.font = "11px serif"; ctx.fillText("✦", p.x + p.w / 2, py + 11); }
        ctx.globalAlpha = 1;
      });
      // spinners
      spinners.forEach(function (s) {
        var sy = s.y * H, ang = run * 2.4 + s.ph;
        ctx.strokeStyle = "#e05252"; ctx.lineWidth = 7; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(s.x - Math.cos(ang) * 46, sy - Math.sin(ang) * 46); ctx.lineTo(s.x + Math.cos(ang) * 46, sy + Math.sin(ang) * 46); ctx.stroke();
        ctx.fillStyle = "#20303a"; ctx.beginPath(); ctx.arc(s.x, sy, 6, 0, Math.PI * 2); ctx.fill();
      });
      // checkpoints + finish
      ctx.font = "26px serif";
      checkpoints.forEach(function (c) { ctx.fillText(c.on ? "✅" : "🚩", c.x, c.y * H - 22); });
      ctx.fillText("🏁", finishX, plats[plats.length - 1].y * H - 22);
      // ghosts + me
      ghosts.forEach(function (g) {
        AV.draw(ctx, { x: g.x, y: g.y, size: H * 0.11, config: g.bot.avatar, pose: g.jumpT < 0.3 ? "jump" : "run", frame: run + g.x * 0.01, name: g.bot.name });
      });
      var pose = !me.ground ? "jump" : (Math.abs(me.vx) > 20 ? "run" : "idle");
      AV.draw(ctx, { x: me.x, y: me.y, size: H * 0.115, config: myCfg, pose: pose, frame: run, name: store.state.profile.name, flip: me.vx < -10 });
      if (myCfg.trail && juice && Math.abs(me.vx) > 40) juice.trail(me.x, me.y - 6, myCfg.trail);
      if (myCfg.pet) { ctx.font = Math.round(H * 0.04) + "px serif"; ctx.fillText(myCfg.pet, me.x - 34, me.y - 8); }
      if (bubble && bubble.who) Bots.bubble(ctx, { x: bubble.who.x, y: bubble.who.y - H * 0.13, text: bubble.text, age: bubble.age });
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    function cleanup() {
      running = false; cancelAnimationFrame(raf); VQ.shush();
      document.removeEventListener("keydown", onKey); document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      if (wrap.parentNode) wrap.remove();
    }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(Object.assign({}, opts, { resume: true })); }
    document.getElementById("quit").onclick = leave;

    msgEl.innerHTML = "🧗 <b>" + world.name + "</b> — Stage " + (stageIdx + 1) + "/20 · race " + VQ.esc(rivals[0].name) + " & " + VQ.esc(rivals[1].name) + "!";
    bubble = { who: ghosts[0], text: Bots.say(rivals[0], "hi"), age: 0 };
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxObby = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
