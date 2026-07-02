/*
 * Voblox arcade game — 🏎️ Turbo Karts.
 * Top-down kart racing vs 5 AI racers with gentle rubber-banding. Hold a side
 * (or ◀▶) to steer — you always accelerate. Sharp turns charge a drift boost.
 * ❓ boxes ask a word question: answer for an item (🚀 boost, 🛡️ bubble,
 * 🍌 banana, ⚡ zap). 8 tracks in 2 cups; podium finishes climb your rank.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;
  var LAPS = 3, N_WAY = 16;
  var TRACKS = [
    { name: "Meadow Loop", seed: 11, road: "#8a7a66", grass: "#5cab3e", deco: "🌼" },
    { name: "Desert Dash", seed: 23, road: "#a8845c", grass: "#e0c07a", deco: "🌵" },
    { name: "Snowy Slide", seed: 37, road: "#9aa8b8", grass: "#e8f0f8", deco: "⛄" },
    { name: "Lava Lane", seed: 41, road: "#5a4a4a", grass: "#c0392b", deco: "🌋" },
    { name: "Beach Blast", seed: 53, road: "#b89a6a", grass: "#7ec8ff", deco: "🐚" },
    { name: "Forest Flyby", seed: 67, road: "#7a6a55", grass: "#2f7d3e", deco: "🌲" },
    { name: "Candy Curves", seed: 79, road: "#d8a0c8", grass: "#ffd1dc", deco: "🍭" },
    { name: "Space Speedway", seed: 97, road: "#4a4a6a", grass: "#1a1a2e", deco: "⭐" }
  ];
  var CUPS = [{ name: "Word Cup", tracks: [0, 1, 2, 3] }, { name: "Turbo Cup", tracks: [4, 5, 6, 7] }];
  var PTS = [10, 8, 6, 5, 4, 3];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("karts");
    // cup resume: { cup: 0|1, race: 0..3, pts: [me,b1..b5], botIds: [] } — a cup in
    // progress always continues (finishing one clears it)
    var cup = stats.resume || null;
    if (!cup) {
      var rivals = Bots.pickOpponents(5, P.botSkillFor(stats.rankPts));
      cup = stats.resume = { cup: (stats.plays % 2), race: 0, pts: [0, 0, 0, 0, 0, 0], botIds: rivals.map(function (b) { return b.id; }) };
      store.save();
    }
    var bots = cup.botIds.map(function (id) { return Bots.byId[id]; });
    var TR = TRACKS[CUPS[cup.cup].tracks[cup.race]];

    var wrap = document.createElement("div"); wrap.className = "gamewrap karts";
    wrap.innerHTML =
      '<canvas id="kcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="kmsg">🏎️ ' + TR.name + "</div>" +
      '<div class="grow"><span id="kpos">6th</span><span id="klap">Lap 1/' + LAPS + '</span><span id="kitem">—</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="kbig"></div>' +
      '<div class="gover" id="kq" style="display:none"></div>' +
      '<button class="kbtn left" id="kleft" type="button">◀</button>' +
      '<button class="kbtn right" id="kright" type="button">▶</button>' +
      '<button class="kbtn use" id="kuse" type="button">USE 🎁</button>' +
      '<div class="runhint">Hold ◀ ▶ to steer • drive into ❓ boxes for items!</div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#kcv"), ctx = cv.getContext("2d");
    var W, H, CXp, CYp, ROADW, way = [];
    var rng = P.rng(TR.seed);
    function buildTrack() {
      way = [];
      var rx = W * 0.38, ry = (H - 140) * 0.36;
      CXp = W / 2; CYp = H / 2 + 30;
      for (var i = 0; i < N_WAY; i++) {
        var a = (i / N_WAY) * Math.PI * 2;
        var f = 0.78 + 0.3 * Math.abs(Math.sin(a * 2 + TR.seed)) + rng() * 0.1;
        way.push({ x: CXp + Math.cos(a) * rx * f, y: CYp + Math.sin(a) * ry * f });
      }
      ROADW = Math.max(58, Math.min(W, H) * 0.12);
    }
    function resize() { W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight; rng = P.rng(TR.seed); buildTrack(); }
    resize(); window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var myCfg = AV.resolve(store.state);

    function wayAt(i) { return way[((i % N_WAY) + N_WAY) % N_WAY]; }
    function kart(cfg, name, bot, lane) {
      var p0 = wayAt(0), p1 = wayAt(1);
      var ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      return { cfg: cfg, name: name, bot: bot, x: p0.x - Math.cos(ang) * lane * 26, y: p0.y - Math.sin(ang) * lane * 26 + (lane % 2 ? 18 : -18),
               a: ang, v: 0, wi: 1, lap: 1, prog: 0, spin: 0, boost: 0, bubble: 0, done: 0, item: null, driftT: 0 };
    }
    var me = kart(myCfg, store.state.profile.name, null, 0);
    var karts = [me].concat(bots.map(function (b, i) { return kart(b.avatar, b.name, b, i + 1); }));
    var bananas = [], boxes = [];
    function seedBoxes() {
      boxes = [];
      [3, 7, 11, 14].forEach(function (wi) { var p = wayAt(wi); boxes.push({ x: p.x, y: p.y, t: 0 }); });
    }
    seedBoxes();

    var running = true, raf = 0, lastT = performance.now(), run = 0, state = "count", countT = 3, qOpen = false, lastFmt = null, finished = [];
    var steer = 0, kL = false, kR = false;

    var msgEl = document.getElementById("kmsg"), bigEl = document.getElementById("kbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 900); }
    function hud() {
      var order = karts.slice().sort(function (a, b) { return (b.done ? 1e9 - b.done : b.lap * 100 + b.prog / 100) - (a.done ? 1e9 - a.done : a.lap * 100 + a.prog / 100); });
      var pos = order.indexOf(me) + 1;
      document.getElementById("kpos").textContent = ["1st 🥇", "2nd 🥈", "3rd 🥉", "4th", "5th", "6th"][pos - 1];
      document.getElementById("klap").textContent = me.done ? "FINISH!" : "Lap " + Math.min(me.lap, LAPS) + "/" + LAPS;
      document.getElementById("kitem").textContent = me.item || "—";
      return pos;
    }

    // ---- input: hold-to-steer (iOS-safe) ----
    var lb = document.getElementById("kleft"), rb = document.getElementById("kright");
    function hold(el, set) {
      el.addEventListener("touchstart", function (e) { set(true); }, { passive: true });
      el.addEventListener("touchend", function (e) { set(false); }, { passive: true });
      el.addEventListener("mousedown", function () { set(true); });
      window.addEventListener("mouseup", function () { set(false); });
    }
    hold(lb, function (v) { kL = v; }); hold(rb, function (v) { kR = v; });
    cv.addEventListener("touchstart", function (e) { var x = e.changedTouches[0].clientX; if (x < W / 2) kL = true; else kR = true; }, { passive: true });
    cv.addEventListener("touchend", function () { kL = kR = false; }, { passive: true });
    function onKey(e) { var k = (e.key || "").toLowerCase(); if (k === "arrowleft" || k === "a") kL = true; if (k === "arrowright" || k === "d") kR = true; if (k === "enter" || k === " ") { e.preventDefault(); useItem(); } }
    function onKeyUp(e) { var k = (e.key || "").toLowerCase(); if (k === "arrowleft" || k === "a") kL = false; if (k === "arrowright" || k === "d") kR = false; }
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    document.getElementById("kuse").onclick = useItem;

    function giveItem() {
      var roll = Math.random();
      me.item = roll < 0.4 ? "🚀" : roll < 0.65 ? "🛡️" : roll < 0.85 ? "🍌" : "⚡";
      hud(); big("Got " + me.item + "!", "#ffe14d");
    }
    function useItem() {
      if (!me.item || me.done) return;
      var it = me.item; me.item = null; hud();
      if (it === "🚀") { me.boost = 1.6; if (sfx) sfx.whoosh(); }
      else if (it === "🛡️") { me.bubble = 8; if (sfx) sfx.chime(); }
      else if (it === "🍌") { bananas.push({ x: me.x - Math.cos(me.a) * 40, y: me.y - Math.sin(me.a) * 40 }); if (sfx) sfx.pop(); }
      else if (it === "⚡") { karts.forEach(function (k2) { if (k2 !== me) k2.spin = Math.max(k2.spin, 0.9); }); big("⚡ ZAP!", "#ffe14d"); if (sfx) sfx.buzz(); }
    }

    function distToRoad(k2) {
      // distance to the polyline near the kart's waypoint index
      var best = 1e9;
      for (var d = -1; d <= 1; d++) {
        var a = wayAt(k2.wi + d), b = wayAt(k2.wi + d + 1);
        var vx = b.x - a.x, vy = b.y - a.y, wx = k2.x - a.x, wy = k2.y - a.y;
        var t = Math.max(0, Math.min(1, (vx * wx + vy * wy) / (vx * vx + vy * vy || 1)));
        var dx = a.x + vx * t - k2.x, dy = a.y + vy * t - k2.y;
        best = Math.min(best, Math.hypot(dx, dy));
      }
      return best;
    }

    function stepKart(k2, dt) {
      if (k2.done) { k2.v *= (1 - dt * 2); k2.x += Math.cos(k2.a) * k2.v * dt; k2.y += Math.sin(k2.a) * k2.v * dt; return; }
      var target = wayAt(k2.wi + 1);
      if (Math.hypot(target.x - k2.x, target.y - k2.y) < ROADW * 0.9) {
        k2.wi++; k2.prog++;
        if (k2.wi % N_WAY === 0) {
          k2.lap++;
          if (k2 === me) { if (sfx) sfx.coin(); if (me.lap <= LAPS) big("Lap " + Math.min(me.lap, LAPS) + "!", "#9fd6ff"); }
          if (k2.lap > LAPS) { k2.done = ++doneCount; if (k2 === me) return; }
        }
      }
      var offRoad = distToRoad(k2) > ROADW * 0.62;
      var maxV = (k2 === me ? 300 : 245 + k2.bot.skill * 68) * (offRoad ? 0.5 : 1);
      if (k2.spin > 0) { k2.spin -= dt; k2.a += dt * 10; k2.v *= (1 - dt * 3); }
      else {
        if (k2.boost > 0) { k2.boost -= dt; maxV *= 1.45; }
        // rubber-band the AI to keep races close but winnable
        if (k2 !== me) {
          var gap = (me.lap * N_WAY + (me.prog % N_WAY)) - (k2.lap * N_WAY + (k2.prog % N_WAY));
          maxV *= gap > 3 ? 1.14 : gap < -3 ? 0.88 : 1;
        }
        k2.v += (maxV - k2.v) * Math.min(1, dt * 1.6);
        var want;
        if (k2 === me) {
          var st = (kL ? -1 : 0) + (kR ? 1 : 0);
          k2.a += st * dt * 2.6 * (0.7 + Math.min(1, k2.v / 300) * 0.5);
          if (st !== 0 && k2.v > 180) { k2.driftT += dt; if (juice && k2.driftT > 0.5) juice.trail(k2.x, k2.y, { emoji: "✨", color: "#ffe14d" }); }
          else if (k2.driftT > 0.9) { k2.boost = Math.max(k2.boost, 0.7); big("Drift boost!", "#ffe14d"); k2.driftT = 0; if (sfx) sfx.whoosh(); }
          else k2.driftT = 0;
        } else {
          want = Math.atan2(target.y - k2.y, target.x - k2.x);
          var diff = ((want - k2.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          k2.a += Math.max(-dt * 2.6, Math.min(dt * 2.6, diff * (1.4 + k2.bot.skill)));
        }
      }
      k2.x += Math.cos(k2.a) * k2.v * dt; k2.y += Math.sin(k2.a) * k2.v * dt;
      // bananas + boxes
      for (var bi = bananas.length - 1; bi >= 0; bi--) {
        if (Math.hypot(bananas[bi].x - k2.x, bananas[bi].y - k2.y) < 22) {
          bananas.splice(bi, 1);
          if (k2.bubble > 0) { k2.bubble = 0; if (k2 === me) big("🛡️ blocked!", "#9fd6ff"); }
          else { k2.spin = Math.max(k2.spin, 0.9); if (k2 === me) { big("🍌 Whoa!", "#ff8a8a"); if (juice) juice.shake(7); } }
        }
      }
      if (k2 === me) {
        boxes.forEach(function (bx) {
          if (bx.t <= 0 && Math.hypot(bx.x - k2.x, bx.y - k2.y) < 26 && !me.item && !qOpen) {
            bx.t = 7; askWord();
          }
        });
      }
      if (k2.bubble > 0) k2.bubble -= dt;
    }
    var doneCount = 0;

    function askWord() {
      qOpen = true;
      VQ.miniQuiz(document.getElementById("kq"), words, store, {
        title: "🎁 Item Box! Answer to grab an item!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt;
          qOpen = false;
          if (ok) giveItem(); else big("No item this time — keep racing!", "#ff8a8a");
        }
      });
    }

    // ---- frame ----
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      run += dt;
      if (qOpen) { draw(); return; }
      if (state === "count") {
        countT -= dt;
        if (countT <= 0) { state = "race"; big("GO!!", "#69f0ae"); if (sfx) sfx.chime(); }
      } else if (state === "race") {
        karts.forEach(function (k2) { stepKart(k2, dt); });
        boxes.forEach(function (bx) { if (bx.t > 0) bx.t -= dt; });
        if (me.done && !me._ended) { me._ended = true; setTimeout(end, 900); }
        // if everyone else finished way ahead, wrap it up kindly
        if (!me.done && doneCount >= 5) { me.done = ++doneCount; me._ended = true; setTimeout(end, 600); }
        hud();
      }
      if (juice) juice.update(dt);
      draw();
    }

    // ---- drawing ----
    function draw() {
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      ctx.fillStyle = TR.grass; ctx.fillRect(-10, -10, W + 20, H + 20);
      // decorations
      ctx.font = "20px serif"; ctx.textAlign = "center";
      for (var d = 0; d < 10; d++) { var pr = P.rng(TR.seed * 7 + d); ctx.fillText(TR.deco, pr() * W, 90 + pr() * (H - 120)); }
      // road
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      function path() { ctx.beginPath(); ctx.moveTo(way[0].x, way[0].y); for (var i = 1; i <= N_WAY; i++) { var p = wayAt(i); ctx.lineTo(p.x, p.y); } }
      path(); ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = ROADW + 10; ctx.stroke();
      path(); ctx.strokeStyle = TR.road; ctx.lineWidth = ROADW; ctx.stroke();
      path(); ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 2; ctx.setLineDash([14, 16]); ctx.stroke(); ctx.setLineDash([]);
      // start line
      var s0 = wayAt(0);
      ctx.save(); ctx.translate(s0.x, s0.y); ctx.rotate(Math.atan2(wayAt(1).y - s0.y, wayAt(1).x - s0.x) + Math.PI / 2);
      for (var c = 0; c < 6; c++) { ctx.fillStyle = c % 2 ? "#fff" : "#222"; ctx.fillRect(-ROADW / 2 + (c * ROADW / 6), -4, ROADW / 6, 8); }
      ctx.restore();
      // boxes + bananas
      boxes.forEach(function (bx) { if (bx.t <= 0) { ctx.font = "24px serif"; ctx.fillText("❓", bx.x, bx.y + Math.sin(run * 4) * 3); } });
      ctx.font = "20px serif";
      bananas.forEach(function (b) { ctx.fillText("🍌", b.x, b.y); });
      // karts (draw as compact avatar + kart body)
      karts.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (k2) {
        ctx.save(); ctx.translate(k2.x, k2.y); ctx.rotate(k2.a + Math.PI / 2);
        ctx.fillStyle = k2 === me ? "#e74c3c" : (k2.cfg.shirt || "#3a7bc8");
        ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(12, 12); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#222"; ctx.fillRect(-14, -8, 5, 10); ctx.fillRect(9, -8, 5, 10); ctx.fillRect(-14, 6, 5, 10); ctx.fillRect(9, 6, 5, 10);
        ctx.restore();
        AV.drawHead(ctx, { x: k2.x, y: k2.y - 16, size: 17, config: k2.cfg });
        if (k2.bubble > 0) { ctx.strokeStyle = "#9fd6ff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(k2.x, k2.y, 24, 0, Math.PI * 2); ctx.stroke(); }
        if (k2.boost > 0 && juice) juice.trail(k2.x - Math.cos(k2.a) * 20, k2.y - Math.sin(k2.a) * 20, { emoji: "🔥", color: "#ff7a3d" });
        ctx.font = "bold 11px Trebuchet MS, sans-serif"; ctx.textAlign = "center";
        ctx.fillStyle = "#00000088"; ctx.fillText(k2.name, k2.x + 1, k2.y - 31);
        ctx.fillStyle = k2 === me ? "#ffe14d" : "#fff"; ctx.fillText(k2.name, k2.x, k2.y - 32);
      });
      if (myCfg.trail && juice && me.v > 60 && !me.done) juice.trail(me.x - Math.cos(me.a) * 18, me.y - Math.sin(me.a) * 18, myCfg.trail);
      if (state === "count") {
        ctx.font = "bold " + Math.round(H * 0.14) + "px Trebuchet MS, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff"; ctx.strokeStyle = "#0008"; ctx.lineWidth = 6;
        var n = Math.ceil(countT); ctx.strokeText(String(n), W / 2, H / 2); ctx.fillText(String(n), W / 2, H / 2);
      }
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    // ---- end / cup standings ----
    function end() {
      if (!running) return;
      running = false; cancelAnimationFrame(raf);
      var order = karts.slice().sort(function (a, b) { return (a.done || 99) - (b.done || 99); });
      var place = order.indexOf(me) + 1;
      // cup points
      karts.forEach(function (k2, i) {
        var p = order.indexOf(k2);
        cup.pts[i] += PTS[p] || 2;
      });
      cup.race++;
      var cupDone = cup.race >= 4;
      var standings = karts.map(function (k2, i) { return { name: k2.name, pts: cup.pts[i], me: k2 === me }; })
        .sort(function (a, b) { return b.pts - a.pts; });
      var cupPlace = standings.findIndex(function (s) { return s.me; }) + 1;
      var champion = cupDone && cupPlace === 1;
      var res = store.recordGame("karts", {
        win: place === 1, score: PTS[place - 1] || 2,
        rankPtsDelta: (place === 1 ? 10 : place === 2 ? 6 : place === 3 ? 4 : 1) + (champion ? 25 : 0),
        xp: 10 + (7 - place) * 3 + (champion ? 35 : 0),
        gems: 8 + (7 - place) * 4 + (champion ? 120 : 0)
      });
      if (cupDone) stats.resume = null;
      store.save();
      var rows = standings.map(function (s, i) {
        return '<div style="display:flex;justify-content:space-between;font-size:14px;padding:2px 0' + (s.me ? ";font-weight:900" : "") + '"><span>' + (i + 1) + ". " + VQ.esc(s.name) + (s.me ? " (you)" : "") + "</span><span>" + s.pts + " pts</span></div>";
      }).join("");
      wrap.innerHTML = '<div class="card hero" style="max-width:500px;margin:40px auto 0;text-align:center;color:#20303a">' +
        '<div class="big-emoji">' + (champion ? "🏆" : ["🥇", "🥈", "🥉"][place - 1] || "🏎️") + "</div>" +
        '<div class="hero-line">' + (champion ? CUPS[cup.cup].name + " CHAMPION!" : ["You WIN the race!", "2nd place!", "3rd place!"][place - 1] || place + "th place") + "</div>" +
        '<div class="hero-sub">' + VQ.esc(TR.name) + (res.rankedUp ? " · <b>" + res.newRank.icon + " " + res.newRank.name + " rank!</b>" : "") + "</div>" +
        '<div style="text-align:left;background:#f4f8fc;border-radius:12px;padding:8px 12px;margin:10px 0"><b>' + CUPS[cup.cup].name + "</b> — race " + Math.min(cup.race, 4) + "/4" + rows + "</div>" +
        '<button id="again" class="submit big-next">' + (cupDone ? "New cup 🏁" : "Next race ▶") + "</button>" +
        '<button id="leave2" class="menubtn" style="margin-top:10px">Back to the Arcade</button></div>';
      document.getElementById("again").onclick = again;
      document.getElementById("leave2").onclick = leave;
      if ((place === 1 || champion) && sfx) sfx.fanfare();
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

    msgEl.innerHTML = "🏎️ <b>" + TR.name + "</b> — " + CUPS[cup.cup].name + " race " + (cup.race + 1) + "/4";
    hud();
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxKarts = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
