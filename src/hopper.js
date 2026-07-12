/*
 * Voblox arcade game — 🚸 ROAD HOPPER (a kid-kind Crossy-Road-style endless hopper).
 * Your 🐔 chicken hops forward across an endless scrolling grid of 🌿 grass,
 * 🛣 roads (dodge cars), 🌊 rivers (ride drifting logs & lily pads) and 🚂 rail
 * tracks (a bell warns, then a fast train). Score = the furthest row you reach.
 *
 * KID-KIND DEATHS: the FIRST lethal hit each run just flattens you into a comic
 * 🥞 pancake for 1.5s and bumps you back a row — nobody actually gets run over.
 * An 🦅 EAGLE swoops if you idle >8s or lag the camera (no free flatten there).
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 💫 SECOND HOP: when the run would truly end, ONE word (miniQuiz) revives
 *     you on the nearest safe tile — once per run.
 *   - 🌟 GOLDEN WORD tiles every 40 rows: hop on, answer, and earn 10 rows of
 *     SUPER HOPS — double-length leaps, car-proof, and DOUBLE coins.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("hopper")
 * per run — banked on run-over, quit, AND app-close. Stats persist additively.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  var COLS = 9;
  var CARS = ["🚗", "🚙", "🚕", "🚚"];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("hopper");
    // additive, never-renamed save fields
    stats.bestRows = stats.bestRows || 0;
    stats.totalCoins = stats.totalCoins || 0;

    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    var wrap = document.createElement("div");
    wrap.className = "gamewrap hopper";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="hpcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="hpmsg">🚸 Road Hopper — tap or swipe to cross!</div>' +
      '<div class="grow"><span id="hprow">🚩 0</span><span id="hpcoin">🪙 0</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="hpbig"></div>' +
      '<div class="gover" id="hpq" style="display:none"></div>' +
      '<div class="gover" id="hpcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#hpcv"), ctx = cv.getContext("2d");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- responsive metrics ----------
    var W, H, TILE, OX, rowH, visibleAhead;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      TILE = Math.max(30, Math.min(W * 0.98 / COLS, H / 9));
      OX = (W - TILE * COLS) / 2;
      rowH = TILE * 0.9;
      visibleAhead = Math.ceil(H / rowH) + 3;
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var rowsCache = {}, chicken = { row: 0, cx: Math.floor(COLS / 2) };
    var maxRow = 0, coins = 0, camY = 0, camCreep = 0;
    var flattenUsed = false, revived = false, superRows = 0;
    var over = false, paused = false, banked = false, statsSaved = false;
    var flattening = false, flattenT = 0, idleT = 0, hopAnim = 0, lastFmt = null;

    function big(m, col) {
      var e = document.getElementById("hpbig");
      e.textContent = m; e.style.color = col || "#fff"; e.style.opacity = "1";
      setTimeout(function () { e.style.opacity = "0"; }, 1200);
    }
    function hud() {
      document.getElementById("hprow").textContent = "🚩 " + maxRow;
      document.getElementById("hpcoin").textContent = "🪙 " + coins + (superRows > 0 ? "  🌟" + superRows : "");
    }

    // ---------- endless row generation (cached & deterministic per row) ----------
    function genRow(n) {
      if (rowsCache[n]) return rowsCache[n];
      var r = { n: n, type: "grass", trees: {}, coins: {}, cars: [], logs: [], gold: -1,
                dir: 1, speed: 0, railT: 0, alarm: 0, train: null };
      if (n <= 3) {
        r.type = "grass"; // a safe starting meadow
      } else if (n % 40 === 0) {
        r.type = "grass"; r.gold = 1 + Math.floor(Math.random() * (COLS - 2)); // 🌟 golden word tile
      } else {
        var roll = Math.random();
        if (roll < 0.34) r.type = "road";
        else if (roll < 0.56) r.type = "river";
        else if (roll < 0.68) r.type = "rail";
        else r.type = "grass";
      }
      if (r.type === "grass") {
        for (var c = 0; c < COLS; c++) {
          if (n > 3 && r.gold < 0 && r.gold !== c && Math.random() < 0.14) r.trees[c] = 1;
          else if (r.gold !== c && Math.random() < 0.12) r.coins[c] = 1;
        }
        delete r.trees[Math.floor(Math.random() * COLS)]; // always leave a lane open
        if (r.gold >= 0) { delete r.trees[r.gold]; delete r.coins[r.gold]; }
      } else if (r.type === "road") {
        r.dir = Math.random() < 0.5 ? 1 : -1;
        r.speed = 1.5 + Math.random() * 1.8;
        var gap = 3 + Math.floor(Math.random() * 2), off = Math.random() * gap;
        for (var x = -1; x < COLS + 2; x += gap) r.cars.push({ x: x + off, e: CARS[Math.floor(Math.random() * CARS.length)] });
      } else if (r.type === "river") {
        r.dir = Math.random() < 0.5 ? 1 : -1;
        r.speed = 0.8 + Math.random() * 1.3;
        var lgap = 3 + Math.floor(Math.random() * 2), loff = Math.random() * lgap;
        for (var lx = -2; lx < COLS + 3; lx += lgap) {
          var pad = Math.random() < 0.3;
          r.logs.push({ x: lx + loff, w: pad ? 1 : (2 + Math.floor(Math.random() * 2)), pad: pad });
        }
      } else if (r.type === "rail") {
        r.dir = Math.random() < 0.5 ? 1 : -1;
        r.railT = 2 + Math.random() * 3;
      }
      rowsCache[n] = r;
      return r;
    }

    // ---------- placement helpers ----------
    function safeCol(r) {
      var mid = Math.round(chicken ? chicken.cx : COLS / 2), order = [mid];
      for (var d = 1; d < COLS; d++) order.push(mid - d, mid + d);
      for (var i = 0; i < order.length; i++) { var c = order[i]; if (c >= 0 && c < COLS && !r.trees[c]) return c; }
      return Math.floor(COLS / 2);
    }
    function placeSafe(r) {
      if (r.type === "grass") return safeCol(r);
      if (r.type === "road") { // the integer column farthest from every car
        var best = Math.floor(COLS / 2), bestD = -1;
        for (var c = 0; c < COLS; c++) {
          var md = 99; for (var i = 0; i < r.cars.length; i++) { var dd = Math.abs(r.cars[i].x - c); if (dd < md) md = dd; }
          if (md > bestD) { bestD = md; best = c; }
        }
        return best;
      }
      if (r.type === "river" && r.logs.length) { var lg = r.logs[0]; return Math.max(0, Math.min(COLS - 1, lg.x + lg.w / 2)); }
      return Math.floor(COLS / 2);
    }
    function logUnder(r, cx) {
      for (var i = 0; i < r.logs.length; i++) { var lg = r.logs[i]; if (cx >= lg.x - 0.15 && cx <= lg.x + lg.w + 0.15) return lg; }
      return null;
    }

    // ---------- run lifecycle ----------
    function begin() {
      rowsCache = {};
      chicken = { row: 0, cx: Math.floor(COLS / 2) };
      maxRow = 0; coins = 0; camY = 0; camCreep = 0;
      flattenUsed = false; revived = false; superRows = 0;
      over = false; paused = false; banked = false; statsSaved = false;
      flattening = false; flattenT = 0; idleT = 0; hopAnim = 0;
      document.getElementById("hpcard").style.display = "none";
      document.getElementById("hpq").style.display = "none";
      hud();
      big("🐔 HOP! Cross as far as you can!", "#8ef");
    }

    // ---------- hopping ----------
    function hop(dir) {
      if (over || paused || flattening) return;
      idleT = 0;
      var nr = chicken.row, ncx = Math.round(chicken.cx);
      var dist = (dir === "up" && superRows > 0) ? 2 : 1;
      if (dir === "up") nr = chicken.row + dist;
      else if (dir === "down") nr = Math.max(0, chicken.row - 1);
      else if (dir === "left") ncx = Math.round(chicken.cx) - 1;
      else if (dir === "right") ncx = Math.round(chicken.cx) + 1;
      else return;
      if (ncx < 0 || ncx > COLS - 1) return; // can't hop off the sides
      var dr = genRow(nr);
      if (dr.type === "grass" && dr.trees[ncx]) return; // a tree blocks the way
      chicken.row = nr; chicken.cx = ncx; hopAnim = 0.14;
      if (dir === "up" && superRows > 0) superRows = Math.max(0, superRows - dist);
      if (sfx && sfx.pop) sfx.pop();
      if (chicken.row > maxRow) { maxRow = chicken.row; hud(); milestoneCheck(); }
      var lr = genRow(chicken.row), col = Math.round(chicken.cx);
      if (lr.coins[col]) { delete lr.coins[col]; coins += superRows > 0 ? 2 : 1; if (sfx && sfx.coin) sfx.coin(); hud(); }
      if (lr.gold === col) { goldQuiz(); return; } // hopping onto gold opens the word
      hazardResolve(0); // instant squish / river fall check on the tile we landed on
    }
    function milestoneCheck() {
      if (maxRow > 0 && maxRow % 25 === 0) {
        big("🚩 " + maxRow + " ROWS! Milestone!", "#ffd23f");
        if (juice) { juice.shake(6); for (var i = 0; i < 4; i++) juice.burst(Math.random() * W, H * 0.4, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b"][i], 12); }
        if (sfx && sfx.fanfare) sfx.fanfare();
      }
    }

    // ---------- hazards & the kind death cascade ----------
    function hazardResolve(dt) {
      if (over || paused || flattening) return;
      var r = genRow(chicken.row);
      if (r.type === "road") {
        if (superRows > 0) return; // SUPER HOPS shrug off cars
        for (var i = 0; i < r.cars.length; i++) {
          if (Math.abs(r.cars[i].x - chicken.cx) < 0.62) { if (sfx && sfx.buzz) sfx.buzz(); lethal(false); return; }
        }
      } else if (r.type === "river") {
        var lg = logUnder(r, chicken.cx);
        if (lg) { chicken.cx += r.dir * r.speed * dt; if (chicken.cx < -0.35 || chicken.cx > COLS - 0.65) lethal(false); } // ride the drift
        else lethal(false); // splash!
      } else if (r.type === "rail") {
        if (r.train && Math.abs(r.train.x - chicken.cx) < 2.6) lethal(false);
      }
    }
    function lethal(byEagle) {
      if (over || flattening) return;
      if (!byEagle && !flattenUsed) { // the one free comic flatten
        flattenUsed = true; flattening = true; flattenT = 1.5;
        knockback();
        if (sfx && sfx.buzz) sfx.buzz();
        if (juice) juice.shake(10);
        big("😵 SPLAT! Shake it off — hop back on!", "#ffd23f");
        return;
      }
      if (!revived) offerSecondHop(); else runOver();
    }
    function knockback() {
      var n = Math.max(0, chicken.row - 1);
      while (n > 0 && genRow(n).type !== "grass") n--;
      chicken.row = n; chicken.cx = safeCol(genRow(n));
    }
    function reviveSafe() {
      var n = chicken.row;
      while (n > 0 && genRow(n).type !== "grass") n--;
      chicken.row = n; chicken.cx = safeCol(genRow(n));
      idleT = 0; flattening = false;
    }
    function offerSecondHop() {
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("hpq"), words, store, {
        title: "💫 SECOND HOP! Answer a word to leap back to safety!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; revived = true;
          if (ok) {
            paused = false; reviveSafe();
            big("💫 SECOND HOP! Back in the game!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(W / 2, H / 2, "#8ef", 24);
            hud();
          } else runOver();
        }
      });
    }
    function goldQuiz() {
      paused = true;
      genRow(chicken.row).gold = -1; // consume the tile so it never retriggers
      cv._lastQ = VQ.miniQuiz(document.getElementById("hpq"), words, store, {
        title: "🌟 GOLDEN WORD! Answer it for SUPER HOPS!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false; idleT = 0;
          if (ok) {
            superRows = 10;
            big("🌟 SUPER HOPS! Double leaps · car-proof · double coins!", "#ffd23f");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.shake(6);
          } else big("The golden word fades…", "#ff8a8a");
          hud();
        }
      });
    }
    function eagle() {
      if (over || flattening || paused) return;
      big("🦅 The eagle swoops! No mercy hops here…", "#ff8a8a");
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(12);
      lethal(true); // eagle skips the free flatten
    }

    // ---------- run over / rewards / banking ----------
    function rewards() {
      var rows = maxRow;
      return {
        win: rows >= 100,
        score: rows,
        rankPtsDelta: Math.min(10, 1 + Math.floor(rows / 15)),
        xp: Math.min(80, 5 + Math.floor(rows / 2) + coins),
        gems: Math.min(120, Math.floor(rows / 3) + coins)
      };
    }
    // the ONE bank path — computed once, guarded, recorded to the store engine
    function bankRun(won) {
      if (banked) return null;
      banked = true;
      var rw = rewards(); rw.win = !!won;
      var res = store.recordGame ? store.recordGame("hopper", rw) : null;
      return { rw: rw, res: res };
    }
    // additive persistence: best rows + lifetime coins (once per run)
    function saveStats() {
      if (statsSaved) return; statsSaved = true;
      if (maxRow > (stats.bestRows || 0)) stats.bestRows = maxRow;
      stats.totalCoins = (stats.totalCoins || 0) + coins;
      if (store.save) store.save();
    }
    function runOver() {
      if (over) return;
      over = true; paused = true;
      saveStats();
      var b = bankRun(maxRow >= 100);
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(12);
      showCard(b ? b.rw : rewards());
    }
    function showCard(rw) {
      var card = document.getElementById("hpcard");
      card.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">🐔</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (rw.win ? "🏆 100+ ROWS! Legendary hopper!" : "Squished!") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🚩 Rows <b>' + maxRow + '</b> · 🪙 <b>' + coins + '</b> · 🏆 Best <b>' + (stats.bestRows || 0) + '</b></div>' +
        '<button class="submit big-next" id="hpreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="hpleave" type="button">Leave</button></div>';
      card.style.display = "flex";
      if (rw && sfx && sfx.fanfare && maxRow >= (stats.bestRows || 0) && maxRow > 0) sfx.fanfare();
      document.getElementById("hpreplay").onclick = function () { card.style.display = "none"; begin(); };
      document.getElementById("hpleave").onclick = exit;
    }

    // ---------- simulation ----------
    function advanceWorld(dt) {
      var lo = Math.floor(camY) - 6, hi = Math.floor(camY) + visibleAhead + 4;
      for (var n = lo; n <= hi; n++) {
        if (n < 0) continue;
        var r = genRow(n);
        if (r.type === "road") {
          for (var i = 0; i < r.cars.length; i++) {
            var car = r.cars[i]; car.x += r.dir * r.speed * dt;
            if (car.x > COLS + 2) car.x -= COLS + 4; else if (car.x < -2) car.x += COLS + 4;
          }
        } else if (r.type === "river") {
          for (var j = 0; j < r.logs.length; j++) {
            var lg = r.logs[j]; lg.x += r.dir * r.speed * dt;
            if (lg.x > COLS + 2) lg.x -= COLS + 5; else if (lg.x < -3) lg.x += COLS + 5;
          }
        } else if (r.type === "rail") {
          if (r.train) {
            r.train.x += r.dir * 14 * dt;
            if (r.train.x > COLS + 3 || r.train.x < -3) { r.train = null; r.railT = 4 + Math.random() * 4; r.alarm = 0; }
          } else {
            r.railT -= dt;
            if (r.railT <= 1 && !r.alarm) { r.alarm = 1; if (sfx && sfx.pop) sfx.pop(); }
            if (r.railT <= 0) { r.train = { x: r.dir > 0 ? -3 : COLS + 3 }; if (sfx && sfx.buzz) sfx.buzz(); }
          }
        }
      }
    }
    function step(dt) {
      if (over) return;
      hopAnim = Math.max(0, hopAnim - dt);
      camY += (chicken.row - camY) * Math.min(1, dt * 4); // easing camera
      advanceWorld(dt); // the world keeps living even while paused/flattened
      if (paused) return;
      if (flattening) { flattenT -= dt; if (flattenT <= 0) flattening = false; return; }
      camCreep += dt * 0.3; // gentle anti-camping creep
      idleT += dt;
      if (idleT >= 8 || chicken.row < Math.floor(camCreep) - 10) { idleT = 0; eagle(); return; }
      hazardResolve(dt);
    }

    // ---------- drawing (chunky voxel tiles: a flat top + a darker side) ----------
    function colX(cx) { return OX + cx * TILE + TILE / 2; }
    function rowY(r) { return H * 0.66 - (r - camY) * rowH; }
    function emo(ch, x, y, size) { ctx.font = Math.round(size) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(ch, x, y); }
    function rrect(x, y, w, h, rad) { ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath(); }
    function topColor(r, c) {
      if (r.type === "road") return r.n % 2 ? "#585d68" : "#515663";
      if (r.type === "river") return c % 2 ? "#3fa0e6" : "#3897dd";
      if (r.type === "rail") return c % 2 ? "#a8a0b0" : "#9c94a6";
      return (r.n + c) % 2 ? "#7ec850" : "#77bd48";
    }
    function sideColor(t) { return t === "road" ? "#33373f" : t === "river" ? "#2b6fae" : t === "rail" ? "#6f6578" : "#4f9433"; }
    function draw() {
      var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#bfe8ff"); sky.addColorStop(1, "#8fd0ef");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      var lo = Math.floor(camY) + visibleAhead, hi = Math.floor(camY) - 2;
      for (var r = lo; r >= hi; r--) {
        if (r < 0) continue;
        var rr = genRow(r), y = rowY(r);
        for (var c = 0; c < COLS; c++) {
          var x = OX + c * TILE;
          ctx.fillStyle = sideColor(rr.type); ctx.fillRect(x, y + rowH - 5, TILE, 9); // voxel depth
          ctx.fillStyle = topColor(rr, c); ctx.fillRect(x, y, TILE - 1, rowH - 5);   // flat top
        }
        if (rr.type === "road") { ctx.fillStyle = "rgba(255,255,255,.55)"; for (var d = 0; d < COLS; d++) ctx.fillRect(OX + d * TILE + TILE * 0.35, y + rowH / 2 - 2, TILE * 0.3, 3); }
        if (rr.type === "rail") { ctx.strokeStyle = "#6a5a48"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(OX, y + rowH * 0.35); ctx.lineTo(OX + TILE * COLS, y + rowH * 0.35); ctx.moveTo(OX, y + rowH * 0.62); ctx.lineTo(OX + TILE * COLS, y + rowH * 0.62); ctx.stroke(); if (rr.alarm && Math.floor(camCreep * 6) % 2) { ctx.fillStyle = "rgba(255,60,60,.7)"; ctx.fillRect(OX - 2, y, 6, rowH); ctx.fillRect(OX + TILE * COLS - 4, y, 6, rowH); } }
        // logs & lily pads first so the chicken rides on top
        for (var li = 0; li < rr.logs.length; li++) {
          var lg = rr.logs[li];
          if (lg.pad) emo("🪷", colX(lg.x), y + rowH * 0.5, TILE * 0.72);
          else { ctx.fillStyle = "#8a5a2b"; rrect(OX + lg.x * TILE + 3, y + rowH * 0.24, lg.w * TILE - 6, rowH * 0.5, 7); ctx.fill(); }
        }
        for (var c2 = 0; c2 < COLS; c2++) {
          if (rr.trees[c2]) emo("🌳", colX(c2), y + rowH * 0.4, TILE * 0.9);
          else if (rr.coins[c2]) emo("🪙", colX(c2), y + rowH * 0.5, TILE * 0.5);
        }
        if (rr.gold >= 0) { ctx.fillStyle = "rgba(255,210,60,.35)"; ctx.fillRect(OX + rr.gold * TILE, y, TILE - 1, rowH - 5); emo("🌟", colX(rr.gold), y + rowH * 0.5, TILE * 0.7); }
        for (var ci = 0; ci < rr.cars.length; ci++) emo(rr.cars[ci].e, colX(rr.cars[ci].x), y + rowH * 0.5, TILE * 0.82);
        if (rr.train) emo("🚂", colX(rr.train.x), y + rowH * 0.5, TILE * 1.05);
        if (r > 0 && r % 25 === 0) emo("🚩", colX(COLS - 0.5), y + rowH * 0.3, TILE * 0.6);
      }
      // the chicken (with a little hop squash / a flat pancake when splatted)
      var chx = colX(chicken.cx), chy = rowY(chicken.row) + rowH * 0.5;
      if (superRows > 0) { ctx.strokeStyle = "rgba(255,210,60,.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(chx, chy, TILE * 0.5, 0, Math.PI * 2); ctx.stroke(); }
      emo(flattening ? "🥞" : "🐔", chx, chy - hopAnim * 40, TILE * (flattening ? 0.95 : 0.8));
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!over) step(dt);
      draw();
    }

    // ---------- input: tap = forward, swipe = that way, WASD/arrows too ----------
    var tsx = 0, tsy = 0, msx = 0, msy = 0;
    function handleSwipe(dx, dy) {
      if (paused || over) return;
      var adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx < 24 && ady < 24) { hop("up"); return; } // a tap hops forward
      if (adx > ady) hop(dx > 0 ? "right" : "left"); else hop(dy > 0 ? "down" : "up");
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var t = e.changedTouches[0]; tsx = t.clientX; tsy = t.clientY; }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); var t = e.changedTouches[0]; handleSwipe(t.clientX - tsx, t.clientY - tsy); }, { passive: false });
    cv.addEventListener("mousedown", function (e) { msx = e.clientX; msy = e.clientY; });
    cv.addEventListener("mouseup", function (e) { handleSwipe(e.clientX - msx, e.clientY - msy); });
    function onKey(e) {
      var k = e.key, d = null;
      if (k === "ArrowUp" || k === "w" || k === "W") d = "up";
      else if (k === "ArrowDown" || k === "s" || k === "S") d = "down";
      else if (k === "ArrowLeft" || k === "a" || k === "A") d = "left";
      else if (k === "ArrowRight" || k === "d" || k === "D") d = "right";
      if (d) { e.preventDefault(); hop(d); }
    }
    document.addEventListener("keydown", onKey);

    // ---------- exit / banking ----------
    function bankExit() {
      if (over) return; // run-over already banked
      if (maxRow === 0 && coins === 0) return; // an untouched run banks nothing
      saveStats();
      var b = bankRun(false);
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🚸 Hop run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
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
    cv._hopper = {
      state: function () {
        return {
          row: chicken.row, coins: coins, flattenUsed: flattenUsed, revived: revived,
          superRows: superRows, over: over, banked: banked, best: Math.max(maxRow, stats.bestRows || 0),
          maxRow: maxRow, paused: paused, flattening: flattening, tile: { type: genRow(chicken.row).type }
        };
      },
      begin: begin,
      hop: hop,
      rowAt: function (n) { var r = genRow(n); return { type: r.type, cars: r.cars, logs: r.logs, gold: r.gold }; },
      warpRow: function (n) { var r = genRow(n); chicken.row = n; chicken.cx = placeSafe(r); if (n > maxRow) maxRow = n; camY = n; idleT = 0; hud(); },
      squish: function () { lethal(false); },
      goldTile: function () { var n = chicken.row + 1; var r = genRow(n); r.type = "grass"; r.trees = {}; r.coins = {}; r.cars = []; r.logs = []; r.gold = Math.round(chicken.cx); },
      tick: function (sec) { var left = sec; while (left > 1e-6 && !over) { var h = Math.min(0.05, left); step(h); left -= h; } }
    };

    // ---------- boot ----------
    begin();
    if (global._hopperdemo) { // screenshot seed: mid-river drama with a golden tile ahead
      global._hopperdemo = 0;
      for (var pn = 28; pn <= 40; pn++) genRow(pn);
      var r32 = genRow(32); r32.type = "road"; r32.cars = [{ x: 1, e: "🚗" }, { x: 5, e: "🚚" }]; r32.dir = 1; r32.speed = 2;
      var r33 = genRow(33); r33.type = "road"; r33.cars = [{ x: 2.5, e: "🚙" }, { x: 6.5, e: "🚕" }]; r33.dir = -1; r33.speed = 2.4;
      var r34 = genRow(34); r34.type = "river"; r34.logs = [{ x: 2.5, w: 3, pad: false }, { x: 7, w: 1, pad: true }]; r34.dir = 1; r34.speed = 1;
      var r35 = genRow(35); r35.type = "grass"; r35.trees = { 1: 1, 7: 1 }; r35.coins = { 4: 1 };
      var r36 = genRow(36); r36.type = "grass"; r36.trees = {}; r36.coins = {}; r36.gold = 4;
      chicken.row = 34; chicken.cx = 4; maxRow = 34; camY = 34; paused = true;
      big("🚸 Ride the log — a 🌟 golden word waits ahead!", "#ffd23f");
      hud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxHopper = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
