/*
 * Voblox arcade game — 👨‍🍳 Chef Rush.
 * Overcooked-lite: customers queue up with recipes; tap the RIGHT stations in
 * order (pantry → chop → stove → serve) before their patience runs out. Tips
 * grow your restaurant stars: new menus unlock, and at ★3 an AI sous-chef bot
 * joins your kitchen and works a station for real. VIP customers ask a word
 * question — answer for a triple tip! 2-minute shifts.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;
  var STATIONS = [
    { id: "pantry", emoji: "🧺", name: "Pantry" },
    { id: "chop", emoji: "🔪", name: "Chop" },
    { id: "stove", emoji: "🍳", name: "Stove" },
    { id: "serve", emoji: "🛎️", name: "Serve" }
  ];
  // dish: steps are station ids; star = menu tier required
  var DISHES = [
    { name: "Burger", emoji: "🍔", star: 1, steps: ["pantry", "stove", "serve"] },
    { name: "Fries", emoji: "🍟", star: 1, steps: ["pantry", "chop", "stove", "serve"] },
    { name: "Salad", emoji: "🥗", star: 1, steps: ["pantry", "chop", "serve"] },
    { name: "Pizza", emoji: "🍕", star: 2, steps: ["pantry", "chop", "stove", "stove", "serve"] },
    { name: "Hot Dog", emoji: "🌭", star: 2, steps: ["pantry", "stove", "serve"] },
    { name: "Sushi", emoji: "🍣", star: 3, steps: ["pantry", "chop", "chop", "serve"] },
    { name: "Ramen", emoji: "🍜", star: 3, steps: ["pantry", "chop", "stove", "serve"] },
    { name: "Cake", emoji: "🍰", star: 4, steps: ["pantry", "chop", "stove", "stove", "serve"] },
    { name: "Sundae", emoji: "🍨", star: 4, steps: ["pantry", "chop", "serve"] },
    { name: "Golden Feast", emoji: "🍱", star: 5, steps: ["pantry", "chop", "stove", "chop", "stove", "serve"] }
  ];
  var STAR_AT = [0, 120, 320, 620, 1000]; // lifetime coins -> stars 1..5
  var SHIFT_S = 120;

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("chef");
    if (!stats.coinsTotal) stats.coinsTotal = 0;
    function starsNow() { var s = 1; STAR_AT.forEach(function (a, i) { if (stats.coinsTotal >= a) s = i + 1; }); return s; }

    var wrap = document.createElement("div"); wrap.className = "gamewrap chef";
    wrap.innerHTML =
      '<canvas id="chcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="chmsg">👨‍🍳 Chef Rush</div>' +
      '<div class="grow"><span id="chcoins">🪙 0</span><span id="chclock">2:00</span><span id="chstars"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="chbig"></div>' +
      '<div class="gover" id="chq" style="display:none"></div>' +
      '<div class="runhint">Tap the glowing station to cook the order!</div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#chcv"), ctx = cv.getContext("2d");
    var W, H, KY;
    function resize() { W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight; KY = H * 0.72; }
    resize(); window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var myCfg = AV.resolve(store.state);
    var stars = starsNow();
    var sous = stars >= 3 ? Bots.pickOpponents(1, 0.6)[0] : null;

    var running = true, raf = 0, lastT = performance.now(), run = 0;
    var clock = SHIFT_S, coins = 0, served = 0, grumpy = 0, orders = [], nextOrderT = 0.5, state = "play", qOpen = false, lastFmt = null;
    var chefAt = 3, chefBusy = 0, sousAt = 0, sousT = 4, bubble = null, combo = 0;

    var msgEl = document.getElementById("chmsg"), bigEl = document.getElementById("chbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 900); }
    function hud() {
      document.getElementById("chcoins").textContent = "🪙 " + coins;
      var t = Math.max(0, Math.ceil(clock));
      document.getElementById("chclock").textContent = Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2);
      document.getElementById("chstars").textContent = "⭐".repeat(stars);
    }

    function menu() { return DISHES.filter(function (d) { return d.star <= stars; }); }
    function newOrder() {
      if (orders.length >= 3) return;
      var pool = menu();
      var d = pool[Math.floor(Math.random() * pool.length)];
      var vip = served > 0 && (served + orders.length) % 4 === 3;
      orders.push({ dish: d, step: 0, patience: 1, rate: 1 / (16 + d.steps.length * 4), vip: vip, asked: false });
    }

    function stationX(i) { return W * (0.14 + i * 0.24); }
    function activeOrder() { return orders[0] || null; }

    function tapStation(i) {
      if (qOpen || state !== "play") return;
      var o = activeOrder();
      if (!o) return;
      if (o.vip && !o.asked) { askVIP(o); return; }
      var want = o.dish.steps[o.step];
      if (STATIONS[i].id === want) {
        chefAt = i; chefBusy = 0.35;
        o.step++;
        combo++;
        if (sfx) sfx.pop();
        if (juice) juice.burst(stationX(i), KY - 30, "#ffd76a", 6);
        if (o.step >= o.dish.steps.length) serveOrder(o);
      } else {
        combo = 0;
        o.patience = Math.max(0.06, o.patience - 0.07);
        if (sfx) sfx.buzz(); if (juice) juice.shake(4);
        big("Wrong station! Look for the glow ✨", "#ff8a8a");
      }
    }
    function serveOrder(o) {
      orders.shift();
      var tip = Math.round((5 + o.dish.steps.length * 3) * (0.5 + o.patience) * (o.vipBonus ? 3 : 1) * (1 + Math.min(0.5, combo * 0.05)));
      coins += tip; served++;
      if (juice) { juice.text(W / 2, H * 0.4, "+" + tip + " 🪙" + (o.vipBonus ? " VIP!" : ""), "#ffe14d"); juice.burst(W / 2, H * 0.42, "#69f0ae", 12); }
      if (sfx) sfx.coin();
      hud();
    }
    function askVIP(o) {
      qOpen = true;
      VQ.miniQuiz(document.getElementById("chq"), words, store, {
        title: "🤩 VIP order! Answer for a TRIPLE tip!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt; qOpen = false;
          o.asked = true; o.vipBonus = !!ok;
          big(ok ? "🤩 VIP is thrilled — triple tip incoming!" : "VIP shrugs — regular tip.", ok ? "#ffe14d" : "#ff8a8a");
          if (ok && sfx) sfx.chime();
        }
      });
    }
    cv.addEventListener("touchstart", function (e) { var r = cv.getBoundingClientRect(); hitTest(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top); }, { passive: true });
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); hitTest(e.clientX - r.left, e.clientY - r.top); });
    function hitTest(x, y) {
      if (y > KY - 70) for (var i = 0; i < 4; i++) if (Math.abs(x - stationX(i)) < W * 0.11) return tapStation(i);
      // tapping a VIP order card also opens its question
      var o = activeOrder();
      if (o && o.vip && !o.asked && y < H * 0.3) askVIP(o);
    }
    function onKey(e) { var n = parseInt(e.key, 10); if (n >= 1 && n <= 4) tapStation(n - 1); }
    document.addEventListener("keydown", onKey);

    // ---- frame ----
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (qOpen) { draw(); return; }
      run += dt;
      if (state === "play") {
        clock -= dt;
        if (clock <= 0) return endShift();
        nextOrderT -= dt;
        if (nextOrderT <= 0) { newOrder(); nextOrderT = 6 + Math.random() * 5 - Math.min(3, served * 0.2); }
        orders.forEach(function (o) { o.patience -= o.rate * dt; });
        for (var i = orders.length - 1; i >= 0; i--) {
          if (orders[i].patience <= 0) {
            orders.splice(i, 1); grumpy++;
            big("😤 A customer stormed off!", "#ff8a8a");
            if (sfx) sfx.thud(); combo = 0;
          }
        }
        chefBusy -= dt;
        // sous-chef bot works the active order every few seconds
        if (sous) {
          sousT -= dt;
          if (sousT <= 0) {
            sousT = 5.5 - Math.min(2, stars * 0.3);
            var o = activeOrder();
            if (o && (!o.vip || o.asked)) {
              var want = o.dish.steps[o.step];
              sousAt = STATIONS.findIndex(function (s) { return s.id === want; });
              o.step++;
              bubble = { text: Bots.say(sous, "nice"), age: 0 };
              if (juice) juice.burst(stationX(sousAt), KY - 30, "#9fd6ff", 5);
              if (o.step >= o.dish.steps.length) serveOrder(o);
            }
          }
        }
        hud();
      }
      if (bubble) { bubble.age += dt; if (bubble.age > 2.2) bubble = null; }
      if (juice) juice.update(dt);
      draw();
    }

    function endShift() {
      running = false; cancelAnimationFrame(raf);
      stats.coinsTotal += coins;
      var oldStars = stars, newStars = starsNow();
      var goal = 40 + stars * 20;
      var res = store.recordGame("chef", {
        win: coins >= goal, score: coins,
        rankPtsDelta: (coins >= goal ? 10 : 3) + (newStars > oldStars ? 10 : 0),
        xp: 10 + Math.round(coins / 6) + (newStars > oldStars ? 25 : 0),
        gems: Math.round(coins * 0.8)
      });
      store.save();
      wrap.innerHTML = '<div class="card hero" style="max-width:500px;margin:50px auto 0;text-align:center;color:#20303a">' +
        '<div class="big-emoji">' + (newStars > oldStars ? "🌟" : coins >= goal ? "👨‍🍳" : "🍳") + '</div>' +
        '<div class="hero-line">' + (newStars > oldStars ? "NEW STAR! Your restaurant is ⭐" + newStars + "!" : coins >= goal ? "Great shift!" : "Shift over!") + "</div>" +
        '<div class="hero-sub">' + served + " dishes · " + coins + " 🪙 (goal " + goal + ")" +
        (newStars > oldStars && newStars === 3 ? "<br><b>👨‍🍳 A sous-chef joins your kitchen!</b>" : "") +
        (newStars > oldStars ? "<br>New menu items unlocked!" : "") +
        (res.rankedUp ? "<br><b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + "</div>" +
        '<button id="again" class="submit big-next">Next shift 🍳</button>' +
        '<button id="leave2" class="menubtn" style="margin-top:10px">Back to the Arcade</button></div>';
      document.getElementById("again").onclick = again;
      document.getElementById("leave2").onclick = leave;
      if (newStars > oldStars && sfx) sfx.fanfare();
    }

    // ---- drawing ----
    function draw() {
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#f7e8d0"); bg.addColorStop(1, "#e8cfa8");
      ctx.fillStyle = bg; ctx.fillRect(-10, -10, W + 20, H + 20);
      // kitchen floor + counter
      ctx.fillStyle = "#c8a06a"; ctx.fillRect(-10, KY, W + 20, H - KY);
      for (var fx = 0; fx < W; fx += 46) { ctx.fillStyle = (fx / 46) % 2 ? "#c09a64" : "#c8a06a"; ctx.fillRect(fx, KY, 46, H - KY); }
      ctx.fillStyle = "#8a5a3b"; ctx.fillRect(-10, KY - 58, W + 20, 58);
      ctx.fillStyle = "#7a4a2e"; ctx.fillRect(-10, KY - 6, W + 20, 6);
      // orders row
      var o0 = activeOrder();
      orders.forEach(function (o, i) {
        var oxx = W * 0.14 + i * Math.min(180, W * 0.28), oyy = H * 0.14;
        ctx.fillStyle = i === 0 ? "#fff" : "#ffffffbb";
        ctx.strokeStyle = o.vip ? "#ffb020" : "#0002"; ctx.lineWidth = i === 0 ? 4 : 2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(oxx - 62, oyy - 34, 124, 92, 12) : ctx.rect(oxx - 62, oyy - 34, 124, 92); ctx.fill(); ctx.stroke();
        ctx.font = "26px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText((o.vip ? "🤩" : "🙂") + " " + o.dish.emoji, oxx, oyy - 10);
        // steps with progress
        ctx.font = "13px serif";
        var stepsTxt = o.dish.steps.map(function (s, si) {
          var st = STATIONS.filter(function (x) { return x.id === s; })[0];
          return si < o.step ? "✅" : st.emoji;
        }).join(" ");
        ctx.fillStyle = "#20303a"; ctx.fillText(stepsTxt, oxx, oyy + 18);
        // patience bar
        ctx.fillStyle = "#00000022"; ctx.fillRect(oxx - 52, oyy + 38, 104, 8);
        ctx.fillStyle = o.patience > 0.4 ? "#2f9e44" : "#e05252"; ctx.fillRect(oxx - 52, oyy + 38, 104 * Math.max(0, o.patience), 8);
        if (o.vip && !o.asked && i === 0) { ctx.font = "bold 12px Trebuchet MS"; ctx.fillStyle = "#b06a00"; ctx.fillText("TAP for word bonus!", oxx, oyy + 56); }
      });
      // stations
      for (var i = 0; i < 4; i++) {
        var sx = stationX(i);
        var glow = o0 && (!o0.vip || o0.asked) && STATIONS[i].id === o0.dish.steps[o0.step];
        if (glow) { ctx.fillStyle = "#ffe14d55"; ctx.beginPath(); ctx.arc(sx, KY - 44, 52 + Math.sin(run * 6) * 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#f4e8d8"; ctx.strokeStyle = glow ? "#f0a92e" : "#0003"; ctx.lineWidth = glow ? 5 : 3;
        ctx.fillRect(sx - 44, KY - 78, 88, 68); ctx.strokeRect(sx - 44, KY - 78, 88, 68);
        ctx.font = "34px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(STATIONS[i].emoji, sx, KY - 50);
        ctx.font = "bold 12px Trebuchet MS, sans-serif"; ctx.fillStyle = "#5a4a3a";
        ctx.fillText((i + 1) + ". " + STATIONS[i].name, sx, KY - 14);
      }
      // chef (me) at my station + sous-chef
      var size = H * 0.15;
      AV.draw(ctx, { x: stationX(chefAt), y: KY + size * 0.62, size: size, config: myCfg, pose: chefBusy > 0 ? "swing" : "idle", frame: chefBusy > 0 ? 0.12 : run, name: store.state.profile.name, heldOverride: "🍳" });
      if (sous) {
        AV.draw(ctx, { x: stationX(sousAt), y: KY + size * 0.62, size: size * 0.92, config: sous.avatar, pose: "idle", frame: run + 2, name: sous.name + " (sous)", flip: true, heldOverride: "🥄" });
        if (bubble) Bots.bubble(ctx, { x: stationX(sousAt), y: KY - size * 0.5, text: bubble.text, age: bubble.age });
      }
      if (myCfg.pet) { ctx.font = Math.round(H * 0.045) + "px serif"; ctx.fillText(myCfg.pet, stationX(chefAt) - W * 0.07, KY + size * 0.55); }
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    function cleanup() {
      running = false; cancelAnimationFrame(raf); VQ.shush();
      document.removeEventListener("keydown", onKey); window.removeEventListener("resize", resize);
      if (wrap.parentNode) wrap.remove();
    }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }
    document.getElementById("quit").onclick = leave;

    msgEl.innerHTML = "👨‍🍳 <b>⭐" + stars + " restaurant</b>" + (sous ? " — " + VQ.esc(sous.name) + " is your sous-chef!" : " — reach ⭐3 to hire a sous-chef!");
    hud(); newOrder();
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxChef = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
