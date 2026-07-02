/*
 * Voblox arcade game — ⚽ Soccer Strikers.
 * Top-down 3v3 with AI teammates who call for passes and AI defenders who
 * chase you down. Two 75-second halves. A 6-match league season vs bot teams
 * (progress saved — quit any time and Continue later). Coach's Challenge word
 * questions at kickoffs grant a speed/power boost. Goals = confetti + gems.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;
  var HALF_S = 75, GRAB = 26, TEAMS = [
    { name: "Thunder Sharks", color: "#3a7bc8", bots: ["blaze", "tom", "sam"] },
    { name: "Pixel Pandas", color: "#2c3e50", bots: ["pete", "hana", "waffle"] },
    { name: "Turbo Turtles", color: "#2f9e44", bots: ["zippy", "ben", "emma"] },
    { name: "Golden Geckos", color: "#e8a33d", bots: ["carla", "jax", "finn"] },
    { name: "Ninja Narwhals", color: "#6b4fa8", bots: ["mia", "ria", "bricks"] },
    { name: "Royal Rockets", color: "#b3392f", bots: ["gg", "dara", "gus"] }
  ];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("soccer");
    // season resume: { results: [ {gf,ga} | null x6 ], pts }
    if (!stats.resume || !stats.resume.results || stats.resume.results.length !== 6 || stats.resume.results.every(function (r) { return r; })) {
      if (!opts.resume || !stats.resume) stats.resume = { results: [null, null, null, null, null, null], pts: 0 };
    }
    var season = stats.resume;
    var teamIdx = season.results.findIndex(function (r) { return !r; });
    if (teamIdx === -1) { season = stats.resume = { results: [null, null, null, null, null, null], pts: 0 }; teamIdx = 0; }
    var TEAM = TEAMS[teamIdx];

    var wrap = document.createElement("div"); wrap.className = "gamewrap soccer";
    wrap.innerHTML =
      '<canvas id="socv"></canvas>' +
      '<div class="ghud"><div class="clue" id="somsg">⚽ Soccer Strikers</div>' +
      '<div class="grow"><span id="soscore">0 - 0</span><span id="soclock">1st · 1:15</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="sobig"></div>' +
      '<div class="gover" id="soq" style="display:none"></div>' +
      '<button class="sbtn pass" id="sopass" type="button">PASS</button>' +
      '<button class="sbtn shoot" id="soshoot" type="button">SHOOT</button>' +
      '<div class="runhint">Drag to run • PASS / SHOOT (or X / Space)</div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#socv"), ctx = cv.getContext("2d");
    var W, H, FX0, FX1, FY0, FY1, GW;
    function resize() {
      W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight;
      FX0 = W * 0.05; FX1 = W * 0.95; FY0 = H * 0.2; FY1 = H * 0.9; GW = (FY1 - FY0) * 0.3;
    }
    resize(); window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var myCfg = AV.resolve(store.state);
    var mates = Bots.pickOpponents(2, 0.55, TEAM.bots);
    var foes = TEAM.bots.map(function (id) { return Bots.byId[id]; });
    var teamSkill = foes.reduce(function (a, b) { return a + b.skill; }, 0) / 3;

    var running = true, raf = 0, lastT = performance.now(), run = 0, aiT = 0;
    var half = 1, clock = HALF_S, myGoals = 0, theirGoals = 0, state = "question"; // question -> play -> goal/half -> end
    var stateT = 0, boost = 0, bubble = null, lastFmt = null, target = null;

    function ent(x, y, side, bot) { return { x: x, y: y, side: side, bot: bot, spd: 0, face: 1, kick: 9 }; }
    var me = ent(0, 0, "me", null);
    var t1 = ent(0, 0, "me", mates[0]), t2 = ent(0, 0, "me", mates[1]);
    var f1 = ent(0, 0, "foe", foes[0]), f2 = ent(0, 0, "foe", foes[1]), f3 = ent(0, 0, "foe", foes[2]);
    var all = [me, t1, t2, f1, f2, f3];
    var ball = { x: 0, y: 0, vx: 0, vy: 0, holder: null, cool: 0 };

    function formation() {
      var cy = (FY0 + FY1) / 2;
      me.x = W * 0.38; me.y = cy;
      t1.x = W * 0.3; t1.y = cy - GW; t2.x = W * 0.3; t2.y = cy + GW;
      f1.x = W * 0.62; f1.y = cy; f2.x = W * 0.72; f2.y = cy - GW * 0.8; f3.x = W * 0.72; f3.y = cy + GW * 0.8;
      ball.x = W / 2; ball.y = cy; ball.vx = ball.vy = 0; ball.holder = null; ball.cool = 0;
      target = null;
    }
    formation();

    var msgEl = document.getElementById("somsg"), bigEl = document.getElementById("sobig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1000); }
    function hud() {
      document.getElementById("soscore").textContent = myGoals + " - " + theirGoals;
      var t = Math.max(0, Math.ceil(clock));
      document.getElementById("soclock").textContent = (half === 1 ? "1st" : "2nd") + " · " + Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2);
    }
    function chat(who, text) { bubble = { who: who, text: text, age: 0 }; }

    // ---- Coach's Challenge (kickoffs): correct = 12s of speed + shot power ----
    function coach() {
      state = "question";
      VQ.miniQuiz(document.getElementById("soq"), words, store, {
        title: "🧠 Coach's Challenge — answer for a BOOST!",
        skippable: true, lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt;
          if (ok) { boost = 12; big("⚡ BOOSTED!" + (res && res.earned ? " +" + res.earned + " 💎" : ""), "#ffe14d"); if (sfx) sfx.chime(); }
          state = "play";
        }
      });
    }

    // ---- input ----
    function moveTo(cx, cy) { var r = cv.getBoundingClientRect(); target = { x: cx - r.left, y: cy - r.top }; }
    cv.addEventListener("touchstart", function (e) { moveTo(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }, { passive: true });
    cv.addEventListener("touchmove", function (e) { moveTo(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }, { passive: true });
    cv.addEventListener("mousedown", function (e) { moveTo(e.clientX, e.clientY); });
    cv.addEventListener("mousemove", function (e) { if (e.buttons) moveTo(e.clientX, e.clientY); });
    var keys = {};
    function onKey(e) {
      var k = (e.key || "").toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].indexOf(k) !== -1) { keys[k] = true; target = null; }
      else if (k === "x") doPass();
      else if (k === " " || k === "z") { e.preventDefault(); doShoot(); }
    }
    function onKeyUp(e) { keys[(e.key || "").toLowerCase()] = false; }
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    document.getElementById("sopass").onclick = doPass;
    document.getElementById("soshoot").onclick = doShoot;

    function kickBall(from, tx, ty, power) {
      var d = Math.hypot(tx - from.x, ty - from.y) || 1;
      ball.vx = ((tx - from.x) / d) * power; ball.vy = ((ty - from.y) / d) * power;
      ball.holder = null; ball.cool = 0.25; from.kick = 0;
      if (sfx) sfx.pop();
    }
    function doPass() {
      if (ball.holder !== me || state !== "play") return;
      var best = null, bd = 1e9;
      [t1, t2].forEach(function (t) { var d = Math.hypot(t.x - me.x, t.y - me.y); if (d < bd) { bd = d; best = t; } });
      if (best) kickBall(me, best.x + 24, best.y, 430);
    }
    function doShoot() {
      if (state !== "play") return;
      if (ball.holder !== me) return;
      var gy = (FY0 + FY1) / 2 + (Math.random() - 0.5) * GW * 0.7;
      kickBall(me, FX1 + 30, gy, (520 + Math.random() * 60) * (boost > 0 ? 1.25 : 1));
      chat(t1, Bots.say(t1.bot, "nice"));
    }

    // ---- AI ----
    function chase(e2, tx, ty, spd, dt) {
      var d = Math.hypot(tx - e2.x, ty - e2.y);
      if (d > 3) { e2.x += ((tx - e2.x) / d) * spd * dt; e2.y += ((ty - e2.y) / d) * spd * dt; e2.face = tx >= e2.x ? 1 : -1; e2.spd = spd; } else e2.spd = 0;
    }
    function aiTick() {
      var cy = (FY0 + FY1) / 2;
      // teammates: t1 runs ahead high, t2 low support
      t1.goal = { x: Math.min(FX1 - 60, ball.x + W * 0.18), y: cy - GW * 0.8 };
      t2.goal = { x: Math.max(FX0 + 80, ball.x - W * 0.06), y: cy + GW * 0.8 };
      if (ball.holder === t1 || ball.holder === t2) {
        var h = ball.holder;
        if (h.x > W * 0.68 && Math.random() < 0.5) { kickBall(h, FX1 + 30, cy + (Math.random() - 0.5) * GW * 0.6, 500); chat(h, "shooting!"); }
        else if (Math.random() < 0.55) { kickBall(h, me.x, me.y, 420); chat(h, "to you, " + store.state.profile.name + "!"); }
        else h.goal = { x: h.x + 60, y: h.y };
      } else if (ball.holder === me && Math.random() < 0.25) {
        var open = (Math.abs(t1.y - f2.y) > 50) ? t1 : t2;
        chat(open, Bots.say(open.bot, "hi").indexOf("!") !== -1 ? "I'm open!" : "pass!");
      }
      // foes: nearest chases ball; one guards goal side; one marks a teammate
      var order = [f1, f2, f3].sort(function (a, b) {
        return Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y);
      });
      order[0].goal = { x: ball.x, y: ball.y };
      order[1].goal = { x: Math.min(FX1 - 40, ball.x + W * 0.2), y: cy };
      order[2].goal = { x: t1.x + 30, y: t1.y };
      if (ball.holder && ball.holder.side === "foe") {
        var fh = ball.holder;
        if (fh.x < W * 0.3 && Math.random() < 0.35 + teamSkill * 0.3) kickBall(fh, FX0 - 30, cy + (Math.random() - 0.5) * GW * 0.6, 470 + teamSkill * 80);
        else fh.goal = { x: FX0 + 50, y: cy + (Math.random() - 0.5) * 60 };
      }
    }

    // ---- frame ----
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      run += dt;
      if (state === "play") {
        clock -= dt; if (boost > 0) boost -= dt;
        if (clock <= 0) {
          if (half === 1) { half = 2; clock = HALF_S; big("⏱ Half-time!", "#9fd6ff"); formation(); state = "half"; stateT = 1.6; }
          else { state = "end"; }
        }
        aiT += dt; if (aiT > 0.33) { aiT = 0; aiTick(); }

        // my movement
        var spd = (215 + (boost > 0 ? 60 : 0)) * dt;
        var ix = 0, iy = 0;
        if (keys["arrowleft"] || keys["a"]) ix -= 1; if (keys["arrowright"] || keys["d"]) ix += 1;
        if (keys["arrowup"] || keys["w"]) iy -= 1; if (keys["arrowdown"] || keys["s"]) iy += 1;
        if (ix || iy) { var m = Math.hypot(ix, iy); me.x += (ix / m) * spd; me.y += (iy / m) * spd; me.face = ix >= 0 ? 1 : -1; me.spd = 200; }
        else if (target) { var d = Math.hypot(target.x - me.x, target.y - me.y); if (d > 6) { me.x += ((target.x - me.x) / d) * spd; me.y += ((target.y - me.y) / d) * spd; me.face = target.x >= me.x ? 1 : -1; me.spd = 200; } else me.spd = 0; }
        else me.spd = 0;

        // AI movement toward goals
        [t1, t2].forEach(function (t) { if (t.goal && ball.holder !== t) chase(t, t.goal.x, t.goal.y, 150 + t.bot.skill * 90, dt); });
        [f1, f2, f3].forEach(function (f) { if (f.goal) chase(f, f.goal.x, f.goal.y, (135 + f.bot.skill * 110) * (ball.holder === f ? 0.85 : 1), dt); });

        // clamp to field
        all.forEach(function (e2) { e2.x = Math.max(FX0 + 8, Math.min(FX1 - 8, e2.x)); e2.y = Math.max(FY0 + 8, Math.min(FY1 - 8, e2.y)); e2.kick += dt; });

        // ball
        if (ball.holder) { ball.x = ball.holder.x + ball.holder.face * 16; ball.y = ball.holder.y + 6; }
        else {
          ball.cool -= dt;
          ball.x += ball.vx * dt; ball.y += ball.vy * dt;
          ball.vx *= (1 - dt * 1.4); ball.vy *= (1 - dt * 1.4);
          if (ball.y < FY0 + 5 || ball.y > FY1 - 5) ball.vy *= -0.8;
          var gTop = (FY0 + FY1) / 2 - GW / 2, gBot = (FY0 + FY1) / 2 + GW / 2;
          // GOAL right (mine) / left (theirs)
          if (ball.x > FX1 - 4 && ball.y > gTop && ball.y < gBot) return goal("me");
          if (ball.x < FX0 + 4 && ball.y > gTop && ball.y < gBot) return goal("foe");
          if (ball.x < FX0 + 5 || ball.x > FX1 - 5) ball.vx *= -0.8;
          ball.x = Math.max(FX0 + 4, Math.min(FX1 - 4, ball.x));
          // pickup
          if (ball.cool <= 0) {
            for (var i = 0; i < all.length; i++) {
              var e3 = all[i];
              if (Math.hypot(e3.x - ball.x, e3.y - ball.y) < GRAB) { ball.holder = e3; if (e3 === me && sfx) sfx.tone(500, 0.04, "sine", 0.03); break; }
            }
          }
        }
        // steals: defenders near the carrier can poke it loose
        if (ball.holder) {
          var h2 = ball.holder;
          all.forEach(function (e4) {
            if (e4.side !== h2.side && Math.hypot(e4.x - h2.x, e4.y - h2.y) < 26 && e4.kick > 0.6) {
              var sk = e4 === me ? 0.75 : 0.3 + (e4.bot ? e4.bot.skill * 0.5 : 0);
              if (Math.random() < sk * dt * 3.2) {
                ball.holder = null; ball.cool = 0.12; e4.kick = 0;
                ball.vx = (Math.random() - 0.5) * 260; ball.vy = (Math.random() - 0.5) * 260;
                if (e4 === me) big("Stolen it!", "#69f0ae");
              }
            }
          });
        }
        hud();
      } else if (state === "half" || state === "goal") {
        stateT -= dt; if (stateT <= 0) coach();
      } else if (state === "end" && running) { return end(); }

      if (bubble) { bubble.age += dt; if (bubble.age > 2.2) bubble = null; }
      if (juice) juice.update(dt);
      draw();
    }

    function goal(side) {
      if (side === "me") { myGoals++; big("⚽ GOOOAL!", "#69f0ae"); if (sfx) sfx.fanfare(); if (juice) { juice.burst(FX1 - 20, (FY0 + FY1) / 2, "#69f0ae", 22); juice.shake(8); } }
      else { theirGoals++; big("❌ " + TEAM.name + " scores", "#ff8a8a"); if (sfx) sfx.buzz(); }
      hud(); formation();
      state = "goal"; stateT = 1.4;
      // (the frame loop is already queued — no extra rAF here)
    }

    // ---- drawing ----
    function draw() {
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      ctx.fillStyle = "#2f8f3e"; ctx.fillRect(-10, -10, W + 20, H + 20);
      // mowing stripes + lines
      for (var s = 0; s < 8; s++) { if (s % 2) { ctx.fillStyle = "#2a8438"; ctx.fillRect(FX0 + (FX1 - FX0) * s / 8, FY0, (FX1 - FX0) / 8, FY1 - FY0); } }
      ctx.strokeStyle = "#ffffffcc"; ctx.lineWidth = 3;
      ctx.strokeRect(FX0, FY0, FX1 - FX0, FY1 - FY0);
      ctx.beginPath(); ctx.moveTo(W / 2, FY0); ctx.lineTo(W / 2, FY1); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, (FY0 + FY1) / 2, 46, 0, Math.PI * 2); ctx.stroke();
      var gTop = (FY0 + FY1) / 2 - GW / 2;
      ctx.fillStyle = "#ffffff33"; ctx.fillRect(FX0 - 8, gTop, 8, GW); ctx.fillRect(FX1, gTop, 8, GW);
      ctx.strokeRect(FX0 - 8, gTop, 8, GW); ctx.strokeRect(FX1, gTop, 8, GW);
      // entities (sorted by y for overlap)
      var sorted = all.slice().sort(function (a, b) { return a.y - b.y; });
      var size = Math.max(44, H * 0.085);
      sorted.forEach(function (e5) {
        var cfg = e5 === me ? myCfg : (e5.side === "me" ? e5.bot.avatar : Object.assign({}, e5.bot.avatar, { shirt: TEAM.color }));
        var pose = ball.holder === e5 ? (e5.kick < 0.25 ? "kick" : "run") : (e5.spd > 10 ? "run" : "idle");
        AV.draw(ctx, { x: e5.x, y: e5.y + size * 0.5, size: size, config: cfg, pose: pose, frame: run + e5.x * 0.01, name: e5 === me ? store.state.profile.name : e5.bot.name, flip: e5.face < 0 });
        if (e5 === me && boost > 0) { ctx.strokeStyle = "#ffe14d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e5.x, e5.y + 4, size * 0.42, 0, Math.PI * 2); ctx.stroke(); }
      });
      if (myCfg.trail && juice && me.spd > 10) juice.trail(me.x, me.y + 14, myCfg.trail);
      // ball
      ctx.font = Math.round(size * 0.34) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("⚽", ball.x, ball.y);
      if (bubble && bubble.who) Bots.bubble(ctx, { x: bubble.who.x, y: bubble.who.y - size * 0.62, text: bubble.text, age: bubble.age });
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    // ---- season + end ----
    function end() {
      running = false; cancelAnimationFrame(raf);
      var win = myGoals > theirGoals, draw2 = myGoals === theirGoals;
      season.results[teamIdx] = { gf: myGoals, ga: theirGoals };
      season.pts += win ? 3 : draw2 ? 1 : 0;
      var seasonDone = season.results.every(function (r) { return r; });
      var champion = seasonDone && season.pts >= 11;
      store.save();
      var res = store.recordGame("soccer", {
        win: win, score: myGoals,
        rankPtsDelta: (win ? 10 : draw2 ? 4 : 1) + (champion ? 30 : 0),
        xp: 14 + myGoals * 4 + (win ? 12 : 0) + (champion ? 40 : 0),
        gems: 10 + myGoals * 5 + (win ? 18 : 0) + (champion ? 150 : 0)
      });
      if (champion) stats.resume = null; // fresh season next time
      store.save();
      var tableRows = TEAMS.map(function (t, i) {
        var r = season.results[i];
        return '<div style="display:flex;justify-content:space-between;font-size:14px;padding:2px 0' + (i === teamIdx ? ";font-weight:900" : "") + '"><span>' + VQ.esc(t.name) + "</span><span>" + (r ? r.gf + "-" + r.ga + (r.gf > r.ga ? " ✅" : r.gf === r.ga ? " ➖" : " ❌") : "· · ·") + "</span></div>";
      }).join("");
      wrap.innerHTML = '<div class="card hero" style="max-width:500px;margin:40px auto 0;text-align:center;color:#20303a">' +
        '<div class="big-emoji">' + (champion ? "🏆" : win ? "🎉" : draw2 ? "🤝" : "⚽") + "</div>" +
        '<div class="hero-line">' + (champion ? "LEAGUE CHAMPION!!" : win ? "You win " + myGoals + "–" + theirGoals + "!" : draw2 ? "Draw " + myGoals + "–" + theirGoals : TEAM.name + " wins " + theirGoals + "–" + myGoals) + "</div>" +
        '<div class="hero-sub">Season: <b>' + season.pts + ' pts</b>' + (res.rankedUp ? " · <b>" + res.newRank.icon + " " + res.newRank.name + " rank!</b>" : "") + "</div>" +
        '<div style="text-align:left;background:#f4f8fc;border-radius:12px;padding:8px 12px;margin:10px 0">' + tableRows + "</div>" +
        '<button id="again" class="submit big-next">' + (seasonDone ? "New season ⚽" : "Next match ▶") + "</button>" +
        '<button id="leave2" class="menubtn" style="margin-top:10px">Back to the Arcade</button></div>';
      document.getElementById("again").onclick = again;
      document.getElementById("leave2").onclick = leave;
      if (champion && sfx) sfx.fanfare();
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

    msgEl.innerHTML = "⚽ Match " + (teamIdx + 1) + "/6 vs <b>" + VQ.esc(TEAM.name) + "</b>";
    hud();
    chat(t1, Bots.say(t1.bot, "hi"));
    coach();
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxSoccer = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
