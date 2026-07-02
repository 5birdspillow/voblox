/*
 * Voblox arcade game — 🏓 Pickleball Blitz.
 * Side-view pickleball vs an AI ladder. Move under the ball to return it —
 * the closer you are to the sweet spot, the better the shot. Answer word
 * questions for ⚡ SMASH tokens. First to 7 wins; wins climb your rank and
 * bring tougher (and chattier) opponents.
 */
(function (global) {
  var VQ = global.VobloxQuestions, Engine = global.VobloxEngine;
  var AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;
  var MC_FORMATS = ["word2def", "cloze_mc", "def2word_mc", "synonym", "antonym"];
  var WIN_AT = 7;

  function start(opts) {
    var words = opts.words, store = opts.store;
    var wrap = document.createElement("div"); wrap.className = "gamewrap pickle";
    wrap.innerHTML =
      '<canvas id="pkcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="pkmsg">🏓 Pickleball Blitz</div>' +
      '<div class="grow"><span id="pkscore">0 : 0</span><span id="pktok">⚡ 0</span>' +
      '<button class="replay" id="pkpow" type="button" title="Answer a word for a SMASH token">⚡ Word Power</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="pkbig"></div>' +
      '<div class="gover" id="pkq" style="display:none"></div>' +
      '<div class="runhint" id="pkhint">Drag / ◀▶ to move under the ball &nbsp;•&nbsp; tap ⚡ for smash power</div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#pkcv"), ctx = cv.getContext("2d");
    var W, H, GY, NETX, NETTOP;
    function resize() {
      W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight;
      GY = H * 0.78; NETX = W / 2; NETTOP = GY - H * 0.12;
    }
    resize();
    window.addEventListener("resize", resize);

    // ---- match setup ----
    var stats = store.game("pickle");
    var bot = Bots.pickOpponents(1, P.botSkillFor(stats.rankPts))[0];
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var myCfg = AV.resolve(store.state);
    var paddle = (function () { var g = store.state.equipped["gear.pickle"]; var it = g && global.VobloxItems ? global.VobloxItems.byId[g] : null; return it ? it.emoji : "🏓"; })();

    var running = true, raf = 0, lastT = performance.now();
    var me = { x: 0, tx: 0, score: 0, swingT: 9, reach: 0 };
    var ai = { x: 0, tx: 0, score: 0, swingT: 9, reach: 0, err: (1 - bot.skill) * 90, spd: 170 + bot.skill * 230 };
    var ball = null; // {x,y,vx,vy,r}
    var g = 900;
    var state = "intro"; // intro -> serve -> rally -> point -> end (+question pause)
    var server = "me", tokens = 0, meter = 0, meterDir = 1, banner = "", bannerT = 0, bubble = null, pointT = 0, lastHit = "me", serveIdle = 0;
    var qOpen = false, run = 0;

    function layout() {
      me.x = me.tx = W * 0.22; ai.x = ai.tx = W * 0.78;
      me.reach = W * 0.075; ai.reach = W * 0.075;
    }
    layout();

    var msgEl = document.getElementById("pkmsg"), bigEl = document.getElementById("pkbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 900); }
    function hud() {
      document.getElementById("pkscore").textContent = me.score + " : " + ai.score;
      document.getElementById("pktok").textContent = "⚡ " + tokens;
    }
    function chat(kind) { bubble = { text: Bots.say(bot, kind), age: 0 }; }

    // ---- ball launching ----
    function launch(from, targetX, speed, flat) {
      var x0 = from === "me" ? me.x : ai.x, y0 = GY - H * 0.16;
      var T = Math.max(0.55, Math.abs(targetX - x0) / speed);
      if (flat) T *= 0.62; // smashes travel flatter and faster
      ball = { x: x0, y: y0, vx: (targetX - x0) / T, vy: (GY - y0 - 0.5 * g * T * T) / T, r: Math.max(7, H * 0.014), smash: !!flat };
      lastHit = from;
      if (sfx) (flat ? sfx.whoosh() : sfx.pop());
    }
    function swingQuality(p) { return Math.max(0, 1 - Math.abs(ball.x - p.x) / p.reach); }

    function serveNow(power) {
      state = "rally";
      if (server === "me") {
        var q = 0.4 + power * 0.6;
        var tx = NETX + W * (0.14 + 0.3 * q) + (Math.random() - 0.5) * W * 0.06;
        launch("me", Math.min(W * 0.94, tx), 260 + power * 240, power > 0.92);
        me.swingT = 0;
      } else {
        var qb = 0.35 + bot.skill * 0.55 + Math.random() * 0.1;
        launch("ai", NETX - W * (0.12 + 0.32 * qb) - Math.random() * W * 0.05, 250 + qb * 220, false);
        ai.swingT = 0;
      }
    }

    function pointTo(side, why) {
      state = "point"; pointT = 1.35; ball = null;
      if (side === "me") { me.score++; big("✅ " + why, "#69f0ae"); if (sfx) sfx.coin(); if (juice) juice.burst(W * 0.3, H * 0.3, "#69f0ae", 14); }
      else { ai.score++; big("❌ " + why, "#ff8a8a"); if (sfx) sfx.buzz(); if (Math.random() < 0.5) chat("win"); }
      hud();
      server = side; // rally scoring: winner serves
      if (me.score >= WIN_AT || ai.score >= WIN_AT) state = "end";
    }

    // ---- word power (the learning hook) ----
    var qEl = document.getElementById("pkq"), lastFmt = null, pendingQ = null;
    function askWord() {
      if (qOpen || state === "end") return;
      qOpen = true;
      var cards = words.map(function (w) { return store.state.cards[w.word]; }).filter(Boolean);
      var card = Engine.selectDue(cards, Date.now()) || cards[Math.floor(Math.random() * cards.length)];
      var data = words.filter(function (w) { return w.word === card.word; })[0];
      var fmt = Engine.pickFormat(card, data, lastFmt, MC_FORMATS); lastFmt = fmt;
      var q = VQ.gen(card, words, { format: fmt }); pendingQ = q;
      qEl.innerHTML = '<div class="wqcard"><div class="wqtitle">⚡ Word Power!</div><div class="wqprompt">' + q.promptHTML +
        ' <button class="replay" id="wqsay">🔊</button></div><div class="wqchoices">' +
        q.choices.map(function (ch, i) { return '<button class="wqc" data-i="' + i + '">' + VQ.esc(ch.label) + "</button>"; }).join("") +
        '</div><button class="wqskip" id="wqskip">skip</button></div>';
      qEl.style.display = "flex";
      VQ.readQ(q);
      document.getElementById("wqsay").onclick = function () { VQ.readQ(q); };
      document.getElementById("wqskip").onclick = function () { closeWord(); };
      Array.prototype.forEach.call(qEl.querySelectorAll(".wqc"), function (b) {
        b.onclick = function () {
          var ok = !!q.choices[parseInt(b.dataset.i, 10)].correct;
          Array.prototype.forEach.call(qEl.querySelectorAll(".wqc"), function (bb, idx) {
            bb.disabled = true; if (q.choices[idx].correct) bb.classList.add("right"); else if (bb === b) bb.classList.add("wrong");
          });
          var res = store.record(q, ok);
          if (ok) {
            tokens = Math.min(3, tokens + 1); hud();
            if (sfx) sfx.chime();
            setTimeout(function () { closeWord(); big("⚡ SMASH ready!" + (res.earned ? " +" + res.earned + " 💎" : ""), "#ffe14d"); }, 650);
          } else {
            qEl.querySelector(".wqcard").innerHTML += '<div class="wqteach">' + VQ.entryHTML(q.data, { mnem: true }) + "</div>";
            var btn = document.createElement("button"); btn.className = "wqskip"; btn.textContent = "Got it";
            btn.onclick = function () { closeWord(); };
            qEl.querySelector(".wqcard").appendChild(btn);
            if (sfx) sfx.buzz();
          }
        };
      });
    }
    function closeWord() { qOpen = false; qEl.style.display = "none"; qEl.innerHTML = ""; VQ.shush(); }
    document.getElementById("pkpow").onclick = askWord;

    // ---- input: drag/keys MOVE ONLY (iOS-safe); serving locks the meter ----
    function moveToX(clientX) { var r = cv.getBoundingClientRect(); me.tx = Math.max(W * 0.05, Math.min(NETX - W * 0.05, clientX - r.left)); }
    cv.addEventListener("touchstart", function (e) { if (state === "serve" && server === "me") { lockServe(); return; } moveToX(e.changedTouches[0].clientX); }, { passive: true });
    cv.addEventListener("touchmove", function (e) { moveToX(e.changedTouches[0].clientX); }, { passive: true });
    cv.addEventListener("mousedown", function (e) { if (state === "serve" && server === "me") { lockServe(); return; } moveToX(e.clientX); });
    cv.addEventListener("mousemove", function (e) { if (e.buttons) moveToX(e.clientX); });
    function onKey(e) {
      if (qOpen) return;
      var k = (e.key || "").toLowerCase();
      if (k === "arrowleft" || k === "a") me.tx -= W * 0.06;
      else if (k === "arrowright" || k === "d") me.tx += W * 0.06;
      else if (k === " " || k === "enter") { e.preventDefault(); if (state === "serve" && server === "me") lockServe(); else if (state === "end") again(); }
      else if (k === "p" || k === "w") askWord();
      me.tx = Math.max(W * 0.05, Math.min(NETX - W * 0.05, me.tx));
    }
    document.addEventListener("keydown", onKey);
    function lockServe() { serveNow(1 - Math.abs(meter - 0.5) * 2 < 0 ? 0.5 : meter); }

    // ---- frame ----
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      run += dt;

      if (qOpen) { draw(); return; } // world freezes while thinking about a word

      if (state === "intro") { state = "serve"; msgEl.innerHTML = "🏓 vs <b>" + VQ.esc(bot.name) + "</b> — first to " + WIN_AT + "!"; chat("hi"); }
      if (state === "serve") {
        meter += meterDir * dt * 1.6; if (meter > 1) { meter = 1; meterDir = -1; } if (meter < 0) { meter = 0; meterDir = 1; }
        if (server === "ai") { ai.swingT += dt; if (ai.swingT > 1.1) { serveNow(0); } }
        else { serveIdle += dt; if (serveIdle > 7) { big("Auto serve!", "#9fd6ff"); serveNow(0.55); } } // keep the game moving for daydreamers
      } else serveIdle = 0;
      if (state === "point") { pointT -= dt; if (pointT <= 0) { state = "serve"; meter = 0; meterDir = 1; ai.swingT = 0; msgEl.innerHTML = (server === "me" ? "Your serve — tap to power it!" : VQ.esc(bot.name) + " serves…"); } }

      // players slide toward their targets
      me.x += (me.tx - me.x) * Math.min(1, dt * 10);
      ai.x += (ai.tx - ai.x) * Math.min(1, dt * (5 + bot.skill * 6));
      me.swingT += dt; ai.swingT += dt;

      if (state === "rally" && ball) {
        var pxB = ball.x, pyB = ball.y;
        ball.vy += g * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        // net collision — interpolate the crossing so fast smashes can't tunnel through
        if (ball && (pxB - NETX) * (ball.x - NETX) <= 0 && pxB !== ball.x) {
          var tt = (NETX - pxB) / (ball.x - pxB);
          if (pyB + (ball.y - pyB) * tt > NETTOP) {
            pointTo(lastHit === "me" ? "ai" : "me", lastHit === "me" ? "Into the net!" : bot.name + " nets it!");
          }
        }
        // bot tracks the ball when it's coming its way
        if (ball && ball.vx > 0) {
          var T = Math.max(0.05, (GY - ball.y - 0.001) / Math.max(60, ball.vy + 200));
          ai.tx = Math.max(NETX + W * 0.05, Math.min(W * 0.95, ball.x + ball.vx * T * 0.72 + (Math.random() - 0.5) * ai.err));
        } else if (ball) { ai.tx = W * 0.76; }
        // returns
        if (ball && ball.vx > 0 && ball.x > ai.x - ai.reach && ball.y > GY - H * 0.24 && lastHit !== "ai") {
          var q2 = swingQuality(ai) * (0.5 + bot.skill * 0.5);
          if (ball.smash) q2 *= Math.max(0.15, bot.skill - 0.25); // smashes are hard to return
          if (q2 > 0.18) {
            // smarter bots aim for the OPEN court — stand still and you'll get burned
            var tx2;
            if (Math.random() < 0.3 + bot.skill * 0.5) {
              tx2 = me.x < NETX * 0.5 ? NETX - W * (0.06 + Math.random() * 0.06) : W * (0.06 + Math.random() * 0.06);
            } else {
              tx2 = NETX - W * (0.12 + q2 * 0.3) - Math.random() * W * 0.08;
            }
            launch("ai", Math.max(W * 0.06, Math.min(NETX - W * 0.05, tx2)), 240 + q2 * 240, bot.skill > 0.55 && q2 > 0.8 && Math.random() < 0.3);
            ai.swingT = 0;
            if (ball && ball.smash && sfx) sfx.pop();
          }
        }
        if (ball && ball.vx < 0 && ball.x < me.x + me.reach && ball.y > GY - H * 0.26 && lastHit !== "me") {
          var q1 = swingQuality(me);
          if (q1 > 0.12) {
            var smash = tokens > 0 && q1 > 0.45;
            if (smash) { tokens--; hud(); if (juice) { juice.shake(9); juice.burst(ball.x, ball.y, "#ffe14d", 16); } big("⚡ SMASH!", "#ffe14d"); chat("nice"); }
            var deepM = 0.12 + q1 * 0.36;
            launch("me", Math.min(W * 0.94, NETX + W * deepM + Math.random() * W * 0.06), 250 + q1 * 230, smash);
            me.swingT = 0;
            if (q1 > 0.85 && juice) juice.text(me.x, GY - H * 0.3, "PERFECT!", "#69f0ae");
          }
        }
        // ground + out
        if (ball && ball.y >= GY) {
          if (ball.x < NETX) pointTo("ai", bot.name + " scores!");
          else pointTo("me", "Point!");
        }
        if (ball && (ball.x < -30 || ball.x > W + 30)) {
          pointTo(lastHit === "me" ? "ai" : "me", lastHit === "me" ? "Out!" : bot.name + " hits it out!");
        }
      }

      if (state === "end" && running) { end(); return; }
      if (juice) juice.update(dt);
      if (bubble) { bubble.age += dt; if (bubble.age > 2.4) bubble = null; }
      draw();
    }

    // ---- drawing ----
    function draw() {
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#8ecbff"); sky.addColorStop(1, "#d7ecff");
      ctx.fillStyle = sky; ctx.fillRect(-10, -10, W + 20, H + 20);
      // court
      ctx.fillStyle = "#3d9bd1"; ctx.fillRect(-10, GY, W + 20, H - GY);
      ctx.fillStyle = "#2f86b8"; ctx.fillRect(-10, GY, W + 20, 6);
      ctx.strokeStyle = "#ffffff88"; ctx.lineWidth = 3;
      [0.08, 0.5, 0.92].forEach(function (fx) { ctx.beginPath(); ctx.moveTo(W * fx, GY); ctx.lineTo(W * fx, H); ctx.stroke(); });
      // net
      ctx.fillStyle = "#20303a"; ctx.fillRect(NETX - 3, NETTOP, 6, GY - NETTOP);
      ctx.fillStyle = "#fff"; ctx.fillRect(NETX - 3, NETTOP, 6, 5);
      // players (Leo wears his equipped skins; bot has its own look)
      var mePose = me.swingT < 0.3 ? "swing" : (Math.abs(me.tx - me.x) > 4 ? "run" : "idle");
      AV.draw(ctx, { x: me.x, y: GY, size: H * 0.17, config: myCfg, pose: mePose, frame: me.swingT < 0.3 ? me.swingT : run, name: store.state.profile.name, heldOverride: paddle });
      var aiPose = ai.swingT < 0.3 ? "swing" : (Math.abs(ai.tx - ai.x) > 4 ? "run" : "idle");
      AV.draw(ctx, { x: ai.x, y: GY, size: H * 0.17, config: bot.avatar, pose: aiPose, frame: ai.swingT < 0.3 ? ai.swingT : run + 3, name: bot.name, flip: true, heldOverride: "🏓" });
      if (myCfg.pet) { ctx.font = Math.round(H * 0.045) + "px serif"; ctx.textAlign = "center"; ctx.fillText(myCfg.pet, me.x - W * 0.06, GY - 6); }
      // ball + trail
      if (ball) {
        if (myCfg.trail && juice && lastHit === "me") juice.trail(ball.x, ball.y, myCfg.trail);
        ctx.fillStyle = ball.smash ? "#ffe14d" : "#eaff5c"; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#0003"; ctx.lineWidth = 2; ctx.stroke();
      }
      // serve meter
      if (state === "serve" && server === "me") {
        var mw = Math.min(280, W * 0.5), mx = me.x - mw / 2, my = GY - H * 0.3;
        ctx.fillStyle = "#00000055"; ctx.fillRect(mx, my, mw, 16);
        ctx.fillStyle = meter > 0.8 ? "#69f0ae" : "#ffd740"; ctx.fillRect(mx, my, mw * meter, 16);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, 16);
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px Trebuchet MS, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("TAP to serve!", me.x, my - 8);
      }
      if (bubble) Bots.bubble(ctx, { x: ai.x, y: GY - H * 0.19 - 14, text: bubble.text, age: bubble.age });
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    // ---- end / cleanup ----
    function end() {
      running = false; cancelAnimationFrame(raf);
      var win = me.score > ai.score;
      var gems = 8 + me.score * 4 + (win ? 22 : 0);
      var res = store.recordGame("pickle", { win: win, score: me.score, rankPtsDelta: win ? 12 : 2, xp: 12 + me.score * 3 + (win ? 15 : 0), gems: gems });
      var rank = P.gameRank(store.game("pickle").rankPts);
      wrap.innerHTML = '<div class="card hero" style="max-width:480px;margin:60px auto 0;text-align:center;color:#20303a">' +
        '<div class="big-emoji">' + (win ? "🏆" : "🏓") + '</div>' +
        '<div class="hero-line">' + (win ? "You beat " + VQ.esc(bot.name) + "!" : VQ.esc(bot.name) + " wins " + ai.score + "–" + me.score) + '</div>' +
        '<div class="hero-sub">' + me.score + " – " + ai.score + " · +" + gems + " 💎 · +" + (12 + me.score * 3 + (win ? 15 : 0)) + " XP" +
        (res.rankedUp ? "<br><b>" + res.newRank.icon + " Rank up: " + res.newRank.name + "!</b>" : "<br>" + rank.icon + " " + rank.name + " · " + store.game("pickle").rankPts + " pts") + "</div>" +
        '<button id="again" class="submit big-next">Rematch 🏓</button>' +
        '<button id="leave2" class="menubtn" style="margin-top:10px">Back to the Arcade</button></div>';
      document.getElementById("again").onclick = again;
      document.getElementById("leave2").onclick = leave;
      if (win && sfx) sfx.fanfare();
      chat(win ? "lose" : "win");
    }
    function cleanup() {
      running = false; cancelAnimationFrame(raf); VQ.shush();
      document.removeEventListener("keydown", onKey); window.removeEventListener("resize", resize);
      if (wrap.parentNode) wrap.remove();
    }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }
    document.getElementById("quit").onclick = leave;

    hud();
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxPickle = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
