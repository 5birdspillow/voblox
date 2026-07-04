/*
 * Voblox arcade game — 📚 Books vs Zombies (a loving PvZ-style lane defense).
 * The Brain-Rot zombies shuffle in staring at their phones; your BOOKS defend
 * the library. 5×9 grid, 📖 Ink economy, book carts as the last line per row,
 * and FIVE levels that ramp like the real thing (new books + new zombies each).
 * VOCAB IS THE POWER CURVE:
 *   - 🖋 INK RUSH: answer a word (miniQuiz) → +150 ink burst (15s cooldown).
 *     Dictionaries drip ink slowly; readers fund armies fast.
 *   - The 📜 Spell Book (top weapon) asks a word to place.
 * recordGame("books") per level; progress persists (gameStats.books.best).
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  var MW = 1000, MH = 560;
  var ROWS = 5, COLS = 9;

  var BOOKS = {
    blaster: { name: "Word Blaster", emoji: "📕", cost: 100, hp: 90, dmg: 7, cd: 1.15, lvl: 1, tip: "shoots letters" },
    dict: { name: "Dictionary", emoji: "📖", cost: 50, hp: 90, drip: 25, dripCd: 8.5, lvl: 1, tip: "makes ink" },
    wall: { name: "Book Wall", emoji: "📚", cost: 50, hp: 340, lvl: 2, tip: "very thick reading" },
    freeze: { name: "Freeze Thesaurus", emoji: "❄️", cost: 175, hp: 90, dmg: 5, cd: 1.25, slow: true, lvl: 3, tip: "chills zombies" },
    bomb: { name: "Grammar Bomb", emoji: "💥", cost: 150, hp: 60, boom: true, lvl: 4, tip: "BOOM! one use" },
    spell: { name: "Spell Book", emoji: "📜", cost: 200, hp: 90, dmg: 11, cd: 1.1, pierce: true, word: true, lvl: 5, tip: "word-powered beam" }
  };
  var ZOMBIES = {
    basic: { name: "Scroller", emoji: "🧟", hp: 60, speed: 10, dps: 13 },
    speedy: { name: "Speed-Scroller", emoji: "🧟‍♀️", hp: 42, speed: 17, dps: 12 },
    bucket: { name: "Helmet Head", emoji: "🪖", hp: 175, speed: 8.5, dps: 14 },
    shield: { name: "Tablet Shield", emoji: "🛡️", hp: 260, speed: 7.5, dps: 15 },
    boss: { name: "THE DOOMSCROLLER", emoji: "📺", hp: 950, speed: 5.5, dps: 45, big: true }
  };
  // level design: which rows are open, the spawn timeline, and what unlocks
  function levelPlan(n) {
    function wave(t, type, row) { return { t: t, type: type, row: row }; }
    var L = { rows: [1, 2, 3], spawns: [], intro: "", unlock: [] };
    var R = function (rows) { return rows[Math.floor(Math.random() * rows.length)]; };
    if (n === 1) {
      L.rows = [1, 2, 3]; L.intro = "The Brain-Rot zombies found the library… Defend it with BOOKS!";
      L.unlock = ["blaster", "dict"];
      [14, 30, 44, 58, 70, 80].forEach(function (t) { L.spawns.push(wave(t, "basic", R(L.rows))); });
    } else if (n === 2) {
      L.rows = [0, 1, 2, 3, 4]; L.intro = "All five reading rooms are open — and the zombies got FASTER.";
      L.unlock = ["wall"];
      [12, 24, 36, 46, 56, 64, 72, 82, 92, 100].forEach(function (t, i) { L.spawns.push(wave(t, i % 3 === 2 ? "speedy" : "basic", R(L.rows))); });
    } else if (n === 3) {
      L.rows = [0, 1, 2, 3, 4]; L.intro = "Helmet Heads incoming. Freeze them before they chew the shelves!";
      L.unlock = ["freeze"];
      [10, 20, 30, 40, 48, 56, 64, 72, 80, 88].forEach(function (t, i) { L.spawns.push(wave(t, i % 4 === 3 ? "bucket" : i % 3 === 2 ? "speedy" : "basic", R(L.rows))); });
      [104, 104, 106, 108].forEach(function (t) { L.spawns.push(wave(t, "basic", R(L.rows))); });
      L.huge = [102];
    } else if (n === 4) {
      L.rows = [0, 1, 2, 3, 4]; L.intro = "Tablet Shields! It takes serious firepower — or a Grammar Bomb.";
      L.unlock = ["bomb"];
      [10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98].forEach(function (t, i) { L.spawns.push(wave(t, i % 5 === 4 ? "shield" : i % 4 === 3 ? "bucket" : i % 3 === 2 ? "speedy" : "basic", R(L.rows))); });
      [112, 112, 114, 114, 116, 118].forEach(function (t, i) { L.spawns.push(wave(t, i % 2 ? "bucket" : "basic", R(L.rows))); });
      L.huge = [110];
    } else {
      L.rows = [0, 1, 2, 3, 4]; L.intro = "THE DOOMSCROLLER is here. Place the 📜 Spell Book — words beat screens!";
      L.unlock = ["spell"];
      [10, 18, 26, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 94].forEach(function (t, i) { L.spawns.push(wave(t, ["basic", "speedy", "bucket", "shield"][i % 4], R(L.rows))); });
      L.spawns.push(wave(108, "boss", 2));
      [116, 118, 120, 122].forEach(function (t, i) { L.spawns.push(wave(t, i % 2 ? "speedy" : "bucket", R(L.rows))); });
      L.huge = [106];
    }
    L.spawns.sort(function (a, b) { return a.t - b.t; });
    return L;
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("books");
    if (!stats.lvl) stats.lvl = 1; // highest unlocked level (stats.best is the platform BEST SCORE - do not collide)
    var wrap = document.createElement("div"); wrap.className = "gamewrap books";
    wrap.innerHTML =
      '<canvas id="bkcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="bkmsg">📚 Books vs Zombies</div>' +
      '<div class="grow"><span id="bkink">🖋 0</span><span id="bkwave"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="bkbig"></div>' +
      '<div class="gover" id="bkq" style="display:none"></div>' +
      '<div class="gover" id="bkend" style="display:none"></div>' +
      '<div id="bkbar"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#bkcv"), ctx = cv.getContext("2d");
    var W, H, S, OX, OY, portrait = false, compact = false;
    // responsive grid metrics: on phones the lawn goes EDGE TO EDGE with wide
    // PvZ-mobile tiles (logical width expands to fill; zombie/shot speeds rescale)
    var MWv = MW, GXv = 118, GYv = 96, CWv = 92, CHv = 88, SPD = 1;
    var rot = document.createElement("div"); rot.className = "rotgate"; rot.innerHTML = "🔄<br>Turn your phone sideways,<br>Librarian!"; wrap.appendChild(rot);
    function resize() {
      W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight;
      compact = H < 480 || W < 900;
      wrap.classList.toggle("compact", compact);
      var reserve = compact ? 86 : 132; // real HUD + build-bar heights
      S = (H - reserve) / MH;
      if (!compact) S = Math.min(S, W / MW);
      MWv = Math.max(MW, Math.floor(W / S) - 4); // fill the physical width
      GXv = compact ? 66 : 118; GYv = compact ? 10 : 96;
      CWv = (MWv - GXv - 16) / COLS;
      // on phones, ONLY the open lanes render — a 3-lane level gets huge full-height rows
      var rowsN = (compact && plan) ? Math.max(3, plan.rows.length) : ROWS;
      CHv = (MH - GYv - 8) / rowsN;
      SPD = CWv / 92; // keep crossing-time balance no matter how wide the tiles get
      OX = Math.max(0, (W - MWv * S) / 2);
      OY = compact ? 40 : Math.max(36, (H - reserve - MH * S) / 2 + 36);
      portrait = W < H && W < 700;
      rot.style.display = portrait ? "flex" : "none";
    }
    resize(); window.addEventListener("resize", resize);
    function px(x) { return OX + x * S; } function py(y) { return OY + y * S; } function pz(n) { return n * S; }
    function tileX(c) { return GXv + c * CWv + CWv / 2; }
    function tileY(r) {
      var vr = r;
      if (compact && plan) { vr = plan.rows.indexOf(r); if (vr < 0) vr = r; }
      return GYv + vr * CHv + CHv / 2;
    }

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var running = true, raf = 0, lastT = performance.now();
    var level = 0, plan = null, run = 0, ink = 0, over = false, paused = false, endShown = false;
    var plants = [], zombies = [], shots = [], carts = [], spawnIdx = 0, hugeShown = {};
    var selected = null, rushCd = 0, lastFmt = null, kills = 0, rushes = 0;

    var msgEl = document.getElementById("bkmsg"), bigEl = document.getElementById("bkbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1300); }
    function hud() {
      document.getElementById("bkink").textContent = "🖋 " + ink;
      var total = plan ? plan.spawns.length : 0;
      document.getElementById("bkwave").textContent = plan ? "🧟 " + Math.min(spawnIdx, total) + "/" + total : "";
    }

    // ---------- level select / flow ----------
    function showSelect() {
      level = 0; plan = null; paused = true;
      var end = document.getElementById("bkend");
      var rows = [1, 2, 3, 4, 5].map(function (n) {
        var open = n <= stats.lvl, done = n < stats.lvl;
        return '<button class="embtn" style="min-width:118px' + (open ? "" : ";opacity:.45") + '" data-lv="' + n + '">' +
          '<span class="ebl">' + (done ? "⭐ " : open ? "▶ " : "🔒 ") + "Level " + n + "</span>" +
          '<span class="ebs">' + ["First Shelf", "Five Rooms", "Helmet Heads", "Tablet Shields", "THE BOSS"][n - 1] + "</span></button>";
      }).join("");
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:560px"><div style="font-size:40px">📚🧟</div>' +
        '<div class="wqtitle" style="font-size:20px">Books vs Zombies</div>' +
        '<div style="margin:4px 0 10px;color:#5a6b7a;font-weight:bold">The Brain-Rot horde is at the doors. Knowledge is the only weapon.</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + rows + "</div></div>";
      end.style.display = "flex";
      Array.prototype.forEach.call(end.querySelectorAll("[data-lv]"), function (b) {
        b.onclick = function () { var n = +b.dataset.lv; if (n <= stats.lvl) beginLevel(n); else big("🔒 Beat Level " + (n - 1) + " first!", "#ffd740"); };
      });
    }
    function beginLevel(n) {
      level = n; plan = levelPlan(n);
      run = 0; ink = 75; spawnIdx = 0; hugeShown = {}; kills = 0; rushes = 0;
      plants = []; zombies = []; shots = []; selected = null; rushCd = 0; over = false; endShown = false;
      for (var r = 0; r < ROWS; r++) { plants.push([null, null, null, null, null, null, null, null, null]); }
      carts = plan.rows.map(function (r) { return { row: r, used: false, x: GXv - 52, rolling: false }; });
      resize(); // row metrics depend on how many lanes this level opens
      document.getElementById("bkend").style.display = "none";
      paused = false;
      msgEl.innerHTML = "📚 <b>Level " + n + "</b>";
      big("📖 " + plan.intro, "#ffe14d");
      renderBar(); hud();
    }
    function endLevel(won) {
      if (over) return; over = true; paused = true;
      var res = store.recordGame ? store.recordGame("books", {
        win: won,
        score: kills * 4 + rushes * 10 + level * 20,
        rankPtsDelta: won ? Math.min(12, 3 + level * 2) : 2,
        xp: Math.min(60, 8 + kills * 2 + rushes * 5 + (won ? level * 6 : 0)),
        gems: won ? 10 + level * 5 : 5
      }) : null;
      if (won && level >= stats.lvl && level < 5) { stats.lvl = level + 1; store.save(); }
      if (won && level === 5) { stats.beatBoss = true; store.save(); }
      var end = document.getElementById("bkend");
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:44px">' + (won ? "🏆" : "🧟") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (won ? (level === 5 ? "THE LIBRARY IS SAVED! You beat the Doomscroller!" : "Level " + level + " cleared!") : "The zombies reached the shelves…") + "</div>" +
        '<div style="margin:6px 0">🧟 ' + kills + " munched · 🖋 " + rushes + " ink rushes" + (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        '<button class="submit big-next" id="bknext">' + (won && level < 5 ? "Next level ➜" : "Level select") + "</button></div>";
      end.style.display = "flex";
      if (won && sfx && sfx.fanfare) sfx.fanfare();
      if (won && juice) juice.shake(6);
      document.getElementById("bknext").onclick = function () {
        if (won && level < 5) beginLevel(level + 1); else showSelect();
      };
    }

    // ---------- book bar ----------
    function renderBar() {
      var bar = document.getElementById("bkbar");
      if (!plan) { bar.innerHTML = ""; return; }
      var avail = Object.keys(BOOKS).filter(function (k) { return BOOKS[k].lvl <= level; });
      bar.innerHTML = avail.map(function (k) {
        var b = BOOKS[k];
        var can = ink >= b.cost;
        return '<button class="embtn' + (selected === k ? " mode" : "") + '" style="min-width:86px' + (can ? "" : ";opacity:.5") + '" data-bk="' + k + '">' +
          '<span class="ebl">' + b.emoji + " " + b.cost + '</span><span class="ebs">' + b.name + (b.word ? " 📖word" : "") + "</span></button>";
      }).join("") +
        '<button class="embtn study" id="bkrush"' + (rushCd > 0 ? ' style="opacity:.55"' : "") + '><span class="ebl">🖋 INK RUSH</span><span class="ebs">' + (rushCd > 0 ? Math.ceil(rushCd) + "s" : "answer = +150") + "</span></button>";
      Array.prototype.forEach.call(bar.querySelectorAll("[data-bk]"), function (b) {
        b.onclick = function () {
          var k = b.dataset.bk;
          if (ink < BOOKS[k].cost) { big("Not enough ink — 🖋 INK RUSH a word!", "#ffd740"); return; }
          selected = selected === k ? null : k;
          renderBar();
        };
      });
      var rush = document.getElementById("bkrush");
      if (rush) rush.onclick = inkRush;
    }
    function inkRush() {
      if (paused || over || rushCd > 0) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("bkq"), words, store, {
        title: "🖋 INK RUSH! Answer to refill your pen!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            ink += 150; rushes++; rushCd = 15;
            big("🖋 +150 INK!", "#69f0ae");
            if (sfx && sfx.coin) sfx.coin();
            if (juice) juice.burst(px(60), py(60), "#69f0ae", 14);
          } else big("The pen ran dry…", "#ff8a8a");
          hud(); renderBar();
        }
      });
    }

    // ---------- planting ----------
    function tileAt(x, y) {
      var c = Math.floor((x - GXv) / CWv), vr = Math.floor((y - GYv) / CHv);
      var r = (compact && plan) ? (plan.rows[vr] !== undefined ? plan.rows[vr] : -1) : vr;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
      return { r: r, c: c };
    }
    function place(k, r, c) {
      var def = BOOKS[k];
      plants[r][c] = { k: k, hp: def.hp, maxHp: def.hp, cd: 1 + Math.random(), drip: def.dripCd || 0, r: r, c: c, flash: 0 };
      ink -= def.cost; selected = null;
      if (juice) juice.burst(px(tileX(c)), py(tileY(r)), "#9be15d", 10);
      if (sfx && sfx.pop) sfx.pop();
      if (def.boom) { // Grammar Bomb: fuse then BOOM
        setTimeout(function () { explode(r, c); }, 900);
      }
      hud(); renderBar();
    }
    function tryPlace(r, c) {
      if (!selected || over || paused) return;
      if (plan.rows.indexOf(r) < 0) { big("That reading room is closed!", "#ffd740"); return; }
      if (plants[r][c]) { big("A book already lives there!", "#ffd740"); return; }
      var k = selected, def = BOOKS[k];
      if (ink < def.cost) { big("Not enough ink!", "#ffd740"); return; }
      if (def.word) { // 📜 Spell Book: speak the word of power to place it
        paused = true;
        cv._lastQ = VQ.miniQuiz(document.getElementById("bkq"), words, store, {
          title: "📜 Speak the word to awaken the Spell Book!",
          lastFormat: lastFmt,
          cb: function (ok, res, fmt) {
            lastFmt = fmt; paused = false;
            if (ok) { place(k, r, c); big("📜 The Spell Book awakens!", "#c9b6ff"); }
            else big("The Spell Book stays asleep…", "#ff8a8a");
            renderBar();
          }
        });
        return;
      }
      place(k, r, c);
    }
    function explode(r, c) {
      plants[r][c] = null;
      for (var rr = r - 1; rr <= r + 1; rr++) for (var i = zombies.length - 1; i >= 0; i--) {
        var z = zombies[i];
        if (z.row >= r - 1 && z.row <= r + 1 && Math.abs(z.x - tileX(c)) < CWv * 1.7) hurtZ(z, 95);
      }
      if (juice) { juice.shake(10); juice.burst(px(tileX(c)), py(tileY(r)), "#ff9f43", 24); }
      if (sfx) { sfx.tone && sfx.tone(80, 0.35, 0.09); }
    }

    // ---------- combat ----------
    function spawnZombie(type, row) {
      var def = ZOMBIES[type];
      zombies.push({ type: type, row: row, x: MWv + 30, hp: def.hp, maxHp: def.hp, speed: def.speed, dps: def.dps, chill: 0, groan: Math.random() * 6 });
    }
    function hurtZ(z, dmg) {
      z.hp -= dmg;
      if (juice && Math.random() < 0.4) juice.text(px(z.x), py(tileY(z.row) - 40), "-" + dmg, "#ffd740");
      if (z.hp <= 0) {
        kills++;
        var zi = zombies.indexOf(z); if (zi >= 0) zombies.splice(zi, 1);
        if (juice) juice.burst(px(z.x), py(tileY(z.row)), "#9aa86a", 12);
        if (sfx && sfx.pop && Math.random() < 0.5) sfx.pop();
        hud();
      }
    }
    function step(dt) {
      run += dt;
      rushCd = Math.max(0, rushCd - dt);
      if (Math.floor(run) !== Math.floor(run - dt) && Math.floor(run) % 3 === 0) renderBar(); // refresh cooldown/costs
      // spawns
      while (spawnIdx < plan.spawns.length && plan.spawns[spawnIdx].t <= run) {
        var s = plan.spawns[spawnIdx++]; spawnZombie(s.type, s.row); hud();
      }
      if (plan.huge) plan.huge.forEach(function (t) {
        if (!hugeShown[t] && run >= t) { hugeShown[t] = 1; big("🚨 A HUGE WAVE APPROACHES!", "#ff8a8a"); if (sfx && sfx.buzz) sfx.buzz(); }
      });
      // plants act
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var p = plants[r][c]; if (!p) continue;
        var def = BOOKS[p.k];
        p.flash = Math.max(0, p.flash - dt);
        if (def.drip) { p.drip -= dt; if (p.drip <= 0) { p.drip = def.dripCd; ink += def.drip; hud(); if (juice) juice.text(px(tileX(c)), py(tileY(r) - 30), "+" + def.drip + "🖋", "#8ecdf7"); } }
        if (def.dmg) {
          var target = null;
          for (var zi = 0; zi < zombies.length; zi++) { var z = zombies[zi]; if (z.row === r && z.x > tileX(c) - 10 && z.x < MW + 20) { if (!target || z.x < target.x) target = z; } }
          if (target) {
            p.cd -= dt;
            if (p.cd <= 0) {
              p.cd = def.cd;
              shots.push({ x: tileX(c) + 20, y: tileY(r) - 14, row: r, dmg: def.dmg, slow: !!def.slow, pierce: !!def.pierce, hit: {}, ch: String.fromCharCode(65 + Math.floor(Math.random() * 26)) });
              if (sfx && sfx.pop && Math.random() < 0.2) sfx.pop();
            }
          }
        }
      }
      // shots fly
      for (var si = shots.length - 1; si >= 0; si--) {
        var sh = shots[si];
        sh.x += 300 * SPD * dt;
        var gone = sh.x > MWv + 20;
        for (var z2i = 0; z2i < zombies.length && !gone; z2i++) {
          var z2 = zombies[z2i];
          if (z2.row === sh.row && Math.abs(z2.x - sh.x) < 22 && !sh.hit[z2i]) {
            hurtZ(z2, sh.dmg);
            if (sh.slow) z2.chill = 3;
            if (sh.pierce) { sh.hit[z2i] = 1; } else gone = true;
          }
        }
        if (gone) shots.splice(si, 1);
      }
      // zombies advance + munch
      for (var zj = zombies.length - 1; zj >= 0; zj--) {
        var zz = zombies[zj];
        zz.chill = Math.max(0, zz.chill - dt);
        var sp = zz.speed * SPD * (zz.chill > 0 ? 0.5 : 1);
        // munch the first plant in reach
        var col = Math.floor((zz.x - 24 - GXv) / CWv);
        var plant = (col >= 0 && col < COLS) ? plants[zz.row][col] : null;
        if (plant && zz.x - 24 <= tileX(col) + CWv * 0.3) {
          plant.hp -= zz.dps * dt; plant.flash = 0.15;
          if (plant.hp <= 0) { plants[zz.row][col] = null; if (sfx && sfx.buzz && Math.random() < 0.3) sfx.buzz(); }
        } else {
          zz.x -= sp * dt;
        }
        if (zz.x < GXv - 6) { // reached the carts
          var cart = carts.filter(function (ct) { return ct.row === zz.row && !ct.used && !ct.rolling; })[0];
          if (cart) { cart.rolling = true; if (sfx && sfx.whoosh) sfx.whoosh(); big("📚 BOOK CART!", "#8ecdf7"); }
          else if (zz.x < GXv - 40) { endLevel(false); return; }
        }
      }
      // carts roll
      carts.forEach(function (ct) {
        if (!ct.rolling) return;
        ct.x += 480 * SPD * dt;
        for (var ci = zombies.length - 1; ci >= 0; ci--) { if (zombies[ci].row === ct.row && zombies[ci].x < ct.x + 40) { kills++; zombies.splice(ci, 1); } }
        if (ct.x > MWv + 60) { ct.rolling = false; ct.used = true; }
      });
      // victory: everything spawned and cleared
      if (spawnIdx >= plan.spawns.length && zombies.length === 0 && !over) endLevel(true);
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // library backdrop: warm wall + bookshelf stripes
      var g1 = ctx.createLinearGradient(0, 0, 0, H); g1.addColorStop(0, "#5b4632"); g1.addColorStop(1, "#3c2e20");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      if (!compact) for (var b = 0; b < 12; b++) {
        ctx.fillStyle = ["#c65b4e", "#5b8ac6", "#c6a94e", "#6ac65b", "#9a6ac6"][b % 5];
        ctx.fillRect(px(20 + b * 82), py(18), pz(30), pz(52));
      }
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(0, py(74), W, pz(8));
      if (!plan) return;
      // floor tiles: on phones only OPEN lanes render (full height); desktop shows all
      var floorRows = compact ? plan.rows : [0, 1, 2, 3, 4];
      floorRows.forEach(function (r) {
        var open = plan.rows.indexOf(r) >= 0;
        for (var c = 0; c < COLS; c++) {
          ctx.fillStyle = !open ? "rgba(0,0,0,.35)" : ((r + c) % 2 ? "#8a6a4a" : "#967553");
          ctx.fillRect(px(GXv + c * CWv), py(tileY(r) - CHv / 2), pz(CWv - 3), pz(CHv - 3));
        }
      });
      // selected ghost
      if (selected) { ctx.fillStyle = "rgba(155,225,93,.25)"; ctx.fillRect(px(GXv), py(GYv), pz(COLS * CWv), pz(ROWS * CHv)); }
      // carts
      carts.forEach(function (ct) {
        if (ct.used && !ct.rolling) return;
        ctx.font = Math.round(pz(CHv * 0.52)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🛒", px(ct.rolling ? ct.x : GXv - 52), py(tileY(ct.row)));
      });
      // plants
      for (var pr = 0; pr < ROWS; pr++) for (var pc = 0; pc < COLS; pc++) {
        var p = plants[pr][pc]; if (!p) continue;
        var bx = tileX(pc), by = tileY(pr);
        var bob = Math.sin(run * 3 + pc + pr) * 2.5;
        ctx.font = Math.round(pz(CHv * 0.66)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (p.flash > 0) { ctx.save(); ctx.globalAlpha = 0.55; }
        ctx.fillText(BOOKS[p.k].emoji, px(bx), py(by + bob));
        if (p.flash > 0) ctx.restore();
        if (p.hp < p.maxHp) { ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(px(bx - CWv * 0.3), py(by + CHv * 0.34), pz(CWv * 0.6), pz(5)); ctx.fillStyle = "#69f0ae"; ctx.fillRect(px(bx - CWv * 0.3), py(by + CHv * 0.34), pz(CWv * 0.6 * Math.max(0, p.hp / p.maxHp)), pz(5)); }
      }
      // shots: flying letters!
      ctx.fillStyle = "#ffe14d"; ctx.font = "bold " + Math.round(pz(CHv * 0.36)) + "px Trebuchet MS";
      shots.forEach(function (sh) { ctx.fillText(sh.ch, px(sh.x), py(sh.y)); });
      // zombies
      zombies.forEach(function (z) {
        var zy = tileY(z.row), sc = CHv * (ZOMBIES[z.type].big ? 1.05 : 0.76);
        var lurch = Math.sin(run * 4 + z.groan) * 3;
        ctx.font = Math.round(pz(sc)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (z.chill > 0) { ctx.save(); ctx.filter = "hue-rotate(160deg)"; }
        ctx.fillText(ZOMBIES[z.type].emoji, px(z.x), py(zy - 8 + lurch));
        if (z.chill > 0) ctx.restore();
        ctx.font = Math.round(pz(CHv * 0.24)) + "px serif";
        ctx.fillText("📱", px(z.x + CWv * 0.18), py(zy + 8 + lurch)); // doomscrolling, always
        ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(px(z.x - CWv * 0.27), py(zy - sc * 0.72), pz(CWv * 0.55), pz(5));
        ctx.fillStyle = "#ff8a8a"; ctx.fillRect(px(z.x - CWv * 0.27), py(zy - sc * 0.72), pz(CWv * 0.55 * Math.max(0, z.hp / z.maxHp)), pz(5));
        ctx.fillStyle = "#ffe14d";
      });
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input (phantom-tap safe) ----------
    function tap(x, y) {
      var mx = (x - OX) / S, my = (y - OY) / S;
      var t = tileAt(mx, my);
      if (t) tryPlace(t.r, t.c);
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var r = cv.getBoundingClientRect(); tap(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top); }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); tap(e.clientX - r.left, e.clientY - r.top); });

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over && plan) step(dt);
      draw();
    }

    function exit() {
      if (plan && !over && (kills > 0 || rushes > 0) && store.recordGame) {
        store.recordGame("books", { win: false, score: kills * 4, rankPtsDelta: 1, xp: Math.min(25, kills * 2 + rushes * 4), gems: 3 });
      }
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // test hook
    cv._books = {
      state: function () { return { level: level, ink: ink, plants: plants, zombies: zombies, carts: carts, over: over, best: stats.lvl, spawnIdx: spawnIdx, planLen: plan ? plan.spawns.length : 0 }; },
      begin: beginLevel,
      give: function (n) { ink += n; hud(); renderBar(); },
      pick: function (k) { selected = k; },
      put: function (k, r, c) { place(k, r, c); },
      zombie: function (type, row, x) { spawnZombie(type, row); if (x !== undefined) zombies[zombies.length - 1].x = x; },
      clearSpawns: function () { spawnIdx = plan.spawns.length; }
    };

    hud();
    showSelect();
    if (global._bvzdemo) setTimeout(function () { // test hook: a lively mid-battle board
      global._bvzdemo = 0;
      beginLevel(1);
      cv._books.give(400);
      cv._books.put("dict", 1, 0); cv._books.put("dict", 2, 0);
      cv._books.put("blaster", 1, 1); cv._books.put("blaster", 2, 1); cv._books.put("blaster", 3, 1);
      cv._books.put("wall", 2, 4);
      cv._books.zombie("basic", 2, 700); cv._books.zombie("speedy", 1, 820); cv._books.zombie("bucket", 3, 880);
    }, 700);
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxBooks = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
