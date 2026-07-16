/*
 * Voblox arcade game — 🚀 STAR BLASTER (a friendly Galaga-style shooter).
 * Your ship guards the bottom of the screen and auto-fires upward. Alien
 * formations (👾🛸) fly in, sit in formation, and DIVE at you. Survive SECTORS
 * 1-5 (3 waves + a BOSS SAUCER each), then endless mode scales forever.
 * VOCAB IS THE POWER CURVE:
 *   - 💥 MEGA LASER: kills fill a charge meter; when full, answer a word
 *     (miniQuiz) to fire a screen-clearing beam. Bosses take BIG damage but
 *     never die outright to it.
 *   - Between sectors: answer a word to pick 1 of 3 run upgrades.
 * Kid-kind: a hit costs one 💙 shield and respawns you in place with a brief
 * invulnerability blink — never a full restart mid-sector.
 * recordGame("blaster") banks ONCE per run (over / quit / beforeunload);
 * bestScore + bestSector persist on store.game("blaster").
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var VW = 1000, VH = 640;            // logical playfield (scaled to the canvas)
  var ALIEN_EMOJI = ["👾", "🛸", "👽", "🦑", "🤖"];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("blaster");
    // additive persistence — never rename/remove existing fields
    stats.bestScore = stats.bestScore || 0;
    stats.bestSector = stats.bestSector || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap blaster";
    wrap.innerHTML =
      '<canvas id="bscv"></canvas>' +
      '<div class="ghud"><div class="clue" id="bsmsg">🚀 Star Blaster</div>' +
      '<div class="grow" style="flex-wrap:wrap"><span id="bsstat"></span>' +
      '<button class="bossquit" id="bwarp" title="Time Warp: slow the invaders">🕒</button>' +
      '<button class="bossquit" id="bbarr" title="Star Barrage: homing strikes">☄️</button>' +
      '<button class="bossquit" id="bmega" style="display:none">💥 MEGA</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="bsbig"></div>' +
      '<div class="gover" id="bsq" style="display:none"></div>' +
      '<div class="gover" id="bscard" style="display:none"></div>';
    document.body.appendChild(wrap);
    // compact, wrap-safe HUD chips so the row FITS 393px (Leave never clips) — digger pattern
    (function () {
      var gr = wrap.querySelector(".ghud .grow"); if (!gr) return;
      gr.style.flexWrap = "wrap"; gr.style.gap = "6px";
      Array.prototype.forEach.call(gr.children, function (el) {
        el.style.flexShrink = "0"; el.style.whiteSpace = "nowrap";
        if (el.tagName === "SPAN") { el.style.fontSize = "14px"; el.style.padding = "4px 8px"; }
      });
    })();

    var cv = wrap.querySelector("#bscv"), ctx = cv.getContext("2d");
    var ghudEl = wrap.querySelector(".ghud");
    var W = 800, H = 600, SX = 1, SY = 1, hudH = 60;
    function measureHud() { hudH = ghudEl ? Math.round(ghudEl.getBoundingClientRect().height) : 60; }
    function resize() {
      W = cv.width = wrap.clientWidth || 800;
      H = cv.height = wrap.clientHeight || 600;
      SX = W / VW; SY = H / VH;
      measureHud();
    }
    resize();
    window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var started = false, over = false, paused = false, banked = false, won = false;
    var sector = 1, wave = 0, score = 0, kills = 0, megaUses = 0, charge = 0;
    var shields = 3, maxShields = 3, invuln = 0;
    var ship = { x: VW / 2, y: VH - 56, w: 34 };
    var bullets = [], ebullets = [], aliens = [], boss = null, powerups = [], stars = [];
    var upgrades = [];
    var fireT = 0, fireBase = 0.34, fireMul = 1;
    var spreadT = 0, rapidT = 0;
    var formT = 0, formDir = 1, awaiting = false, waveTimer = 0, diveT = 2.2;
    var warpT = 0, warpCd = 0, barrCd = 0;  // special abilities: 🕒 time warp + ☄️ barrage
    var lastFmt = null;

    for (var si = 0; si < 60; si++) stars.push({ x: Math.random() * VW, y: Math.random() * VH, z: 0.3 + Math.random() * 1.2 });

    var msgEl = wrap.querySelector("#bsmsg"), bigEl = wrap.querySelector("#bsbig");
    var statEl = wrap.querySelector("#bsstat"), megaBtn = wrap.querySelector("#bmega");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1200); }
    var warpBtn = wrap.querySelector("#bwarp"), barrBtn = wrap.querySelector("#bbarr");
    function hud() {
      statEl.textContent = "💙" + Math.max(0, shields) + "  ·  🚀 S" + sector + (boss ? " BOSS" : "-" + wave) +
        "  ·  ⭐" + score + "  ·  ⚡" + Math.round(charge * 100) + "%";
      megaBtn.style.display = (charge >= 1 && !over && !paused) ? "" : "none";
      warpBtn.textContent = warpCd > 0 ? "🕒 " + Math.ceil(warpCd) : "🕒";
      warpBtn.style.opacity = warpCd > 0 ? ".45" : "1";
      barrBtn.textContent = barrCd > 0 ? "☄️ " + Math.ceil(barrCd) : "☄️";
      barrBtn.style.opacity = barrCd > 0 ? ".45" : "1";
      measureHud(); // HUD row may wrap taller as the stat text changes
    }
    // ---------- special abilities ----------
    function timeWarp() {
      if (warpCd > 0 || over || paused) return;
      warpT = 5; warpCd = 25;
      big("🕒 TIME WARP — the invaders crawl!", "#8be9fd");
      if (sfx && sfx.chime) sfx.chime();
      if (juice) juice.shake(4);
      hud();
    }
    function barrage() {
      if (barrCd > 0 || over || paused) return;
      barrCd = 20;
      var hits = 0;
      for (var i = aliens.length - 1; i >= 0 && hits < 6; i--) {
        var a = aliens[i];
        a.hp -= 2; hits++;
        if (juice) { juice.burst(a.x * SX, a.y * SY, "#ffd23f", 10); juice.text(a.x * SX, a.y * SY - 14, "☄️", "#ffd23f"); }
        if (a.hp <= 0) killAlienAt(i);
      }
      if (boss) {
        boss.hp -= 8; hits++;
        if (juice) juice.burst(boss.x * SX, boss.y * SY, "#ffd23f", 16);
        if (boss.hp <= 0) { score += 120 + sector * 10; if (sfx && sfx.fanfare) sfx.fanfare(); sectorClear(); }
      }
      big(hits ? "☄️ STAR BARRAGE!" : "☄️ …nothing up there!", "#ffd23f");
      if (sfx && sfx.pop) sfx.pop();
      hud();
    }

    // ---------- flow ----------
    function begin() {
      started = true; over = false; paused = false; banked = false; won = false;
      sector = 1; wave = 0; score = 0; kills = 0; megaUses = 0; charge = 0;
      shields = 3; maxShields = 3; invuln = 0;
      ship.x = VW / 2; ship.w = 34; fireMul = 1; fireT = 0; spreadT = 0; rapidT = 0;
      bullets = []; ebullets = []; aliens = []; boss = null; powerups = []; upgrades = [];
      awaiting = false; waveTimer = 0; diveT = 2.2; formDir = 1;
      wrap.querySelector("#bscard").style.display = "none";
      wrap.querySelector("#bsq").style.display = "none";
      msgEl.textContent = "🚀 SECTOR " + sector;
      big("🚀 SECTOR " + sector + " — defend the galaxy!", "#8be9fd");
      advanceWave();
      hud();
    }

    function spawnFormation(n) {
      var cols = Math.min(8, Math.max(2, n));
      var rows = Math.max(1, Math.ceil(n / cols));
      var hp = 1 + Math.floor(sector / 2);
      var gapX = 92, gapY = 74, startX = VW / 2 - (cols - 1) * gapX / 2, startY = 96;
      var made = 0;
      for (var r = 0; r < rows && made < n; r++) {
        for (var c = 0; c < cols && made < n; c++) {
          aliens.push({
            homeX: startX + c * gapX, homeY: startY + r * gapY,
            x: startX + c * gapX, y: -30 - r * 40,
            hp: hp, kind: (r + c) % ALIEN_EMOJI.length, state: "enter",
            wig: Math.random() * 6, drop: 0
          });
          made++;
        }
      }
      awaiting = false;
    }

    function advanceWave() {
      wave++;
      if (wave > 3) { startBoss(); return; }
      msgEl.textContent = "🚀 SECTOR " + sector + " — Wave " + wave + "/3";
      spawnFormation(3 + sector + wave);
    }

    function startBoss() {
      boss = { x: VW / 2, y: 120, w: 90, hp: 60 + sector * 22, dir: 1, shootT: 1.1 };
      boss.maxHp = boss.hp;
      msgEl.textContent = "🛸 SECTOR " + sector + " BOSS!";
      big("🛸 BOSS SAUCER INCOMING!", "#ff6b6b");
      if (sfx && sfx.buzz) sfx.buzz();
    }

    function sectorClear() {
      boss = null;
      if (sector >= 5) won = true;
      if (sector > (stats.bestSector || 0)) { stats.bestSector = sector; store.save(); }
      big("✨ SECTOR " + sector + " CLEARED!", "#69f0ae");
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(6); juice.burst(W / 2, H / 2, "#ffd23f", 20); }
      betweenQuiz();
    }

    function betweenQuiz() {
      paused = true;
      cv._lastQ = VQ.miniQuiz(wrap.querySelector("#bsq"), words, store, {
        title: "🛠 UPGRADE! Answer to choose a boost for your ship!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) showUpgradePick();
          else { big("No boost this time — press on!", "#ffd740"); paused = false; nextSector(); }
        }
      });
    }
    function showUpgradePick() {
      var picks = [
        { id: "fire", t: "⚡ Faster Fire", d: "shoot 20% quicker" },
        { id: "ship", t: "🛡 Slimmer Ship", d: "smaller hitbox" },
        { id: "shield", t: "💙 +1 Shield", d: "one more heart" }
      ];
      var card = wrap.querySelector("#bscard");
      card.innerHTML = '<div class="wqcard" style="text-align:center;max-height:80vh;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y">' +
        '<div class="wqtitle">🛠 Choose your upgrade</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0">' +
        picks.map(function (p) {
          return '<button class="embtn" style="min-width:130px" data-up="' + p.id + '"><span class="ebl">' + p.t + '</span><span class="ebs">' + p.d + '</span></button>';
        }).join("") + "</div></div>";
      card.style.display = "flex";
      Array.prototype.forEach.call(card.querySelectorAll("[data-up]"), function (b) {
        b.onclick = function () { applyUpgrade(b.dataset.up); card.style.display = "none"; paused = false; nextSector(); };
      });
    }
    function applyUpgrade(id) {
      upgrades.push(id);
      if (id === "fire") fireMul *= 0.8;
      else if (id === "ship") ship.w = Math.max(16, ship.w * 0.8);
      else if (id === "shield") { maxShields++; shields++; }
      big("🛠 " + id.toUpperCase() + " installed!", "#c9b6ff");
      if (sfx && sfx.coin) sfx.coin();
      hud();
    }
    function nextSector() {
      sector++; wave = 0; awaiting = false;
      msgEl.textContent = "🚀 SECTOR " + sector;
      big((sector > 5 ? "🌌 DEEP SPACE — Sector " : "🚀 SECTOR ") + sector + "!", "#8be9fd");
      advanceWave();
      hud();
    }

    // ---------- combat ----------
    function awardKill(x, y, kind) {
      kills++;
      score += 10 + sector * 2;
      charge = Math.min(1, charge + 0.05);
      if (juice) juice.burst(x * SX, y * SY, "#9be15d", 8);
      if (sfx && sfx.pop && Math.random() < 0.4) sfx.pop();
      // some kills drop a power-up
      if (Math.random() < 0.12) {
        var roll = Math.random();
        powerups.push({ x: x, y: y, kind: roll < 0.4 ? "spread" : roll < 0.8 ? "rapid" : "shield", vy: 130 });
      }
      hud();
    }
    function killAlienAt(i) {
      var a = aliens[i]; aliens.splice(i, 1); awardKill(a.x, a.y, a.kind);
    }

    function loseShield() {
      if (over) return;
      shields--;
      if (juice) juice.shake(8);
      if (sfx && sfx.buzz) sfx.buzz();
      if (shields <= 0) { gameOver(); return; }
      invuln = 1.6; // brief blink, respawn in place
      big("💥 Shield down! " + shields + " left", "#ff8a8a");
      hud();
    }

    function fireBeam() {
      megaUses++;
      var n = aliens.length, i;
      for (i = n - 1; i >= 0; i--) { var a = aliens[i]; aliens.splice(i, 1); awardKill(a.x, a.y, a.kind); }
      if (boss) { // big damage — never an instant kill
        var dmg = Math.max(1, Math.round(boss.maxHp * 0.34));
        boss.hp = Math.max(1, boss.hp - dmg);
        big("💥 MEGA LASER! Boss −" + dmg, "#ffd23f");
      } else big("💥 MEGA LASER — sector swept!", "#ffd23f");
      ebullets = [];
      charge = 0;
      if (juice) { juice.shake(12); for (var k = 0; k < 5; k++) juice.burst(W * (0.15 + k * 0.17), H * 0.4, "#40c4ff", 14); }
      if (sfx && sfx.fanfare) sfx.fanfare();
      hud();
    }
    function openMega() {
      if (paused || over || charge < 1) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(wrap.querySelector("#bsq"), words, store, {
        title: "💥 MEGA LASER! Answer to unleash the beam!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) fireBeam();
          else big("The laser fizzled…", "#ff8a8a");
          hud();
        }
      });
    }

    // ---------- simulation ----------
    function fireShip(dt) {
      fireT -= dt;
      if (fireT > 0) return;
      var rate = fireBase * fireMul * (rapidT > 0 ? 0.5 : 1);
      fireT = rate;
      if (spreadT > 0) {
        bullets.push({ x: ship.x, y: ship.y - 20, vy: -620, vx: 0 });
        bullets.push({ x: ship.x, y: ship.y - 20, vy: -600, vx: -220 });
        bullets.push({ x: ship.x, y: ship.y - 20, vy: -600, vx: 220 });
      } else bullets.push({ x: ship.x, y: ship.y - 20, vy: -640, vx: 0 });
      if (sfx && sfx.pop && Math.random() < 0.15) sfx.pop();
    }

    function step(dt) {
      formT += dt;
      if (invuln > 0) invuln = Math.max(0, invuln - dt);
      if (spreadT > 0) spreadT = Math.max(0, spreadT - dt);
      if (rapidT > 0) rapidT = Math.max(0, rapidT - dt);
      if (warpT > 0) { warpT = Math.max(0, warpT - dt); if (warpT === 0) big("Time snaps back!", "#8be9fd"); }
      if (warpCd > 0) { warpCd = Math.max(0, warpCd - dt); if (warpCd === 0) hud(); }
      if (barrCd > 0) { barrCd = Math.max(0, barrCd - dt); if (barrCd === 0) hud(); }
      var edt = warpT > 0 ? dt * 0.4 : dt; // 🕒 enemies experience slowed time

      // arrow-key drift
      if (keys.left) ship.x -= 520 * dt;
      if (keys.right) ship.x += 520 * dt;
      ship.x = Math.max(ship.w, Math.min(VW - ship.w, ship.x));

      fireShip(dt);

      // stars
      for (var s = 0; s < stars.length; s++) { stars[s].y += stars[s].z * 60 * dt; if (stars[s].y > VH) { stars[s].y = 0; stars[s].x = Math.random() * VW; } }

      // player bullets
      for (var bi = bullets.length - 1; bi >= 0; bi--) {
        var b = bullets[bi]; b.y += b.vy * dt; b.x += (b.vx || 0) * dt;
        if (b.y < -20 || b.x < -20 || b.x > VW + 20) { bullets.splice(bi, 1); continue; }
        var hitSomething = false;
        for (var ai = aliens.length - 1; ai >= 0; ai--) {
          var al = aliens[ai];
          if (Math.abs(al.x - b.x) < 30 && Math.abs(al.y - b.y) < 28) {
            al.hp -= 1; hitSomething = true;
            if (al.hp <= 0) killAlienAt(ai);
            break;
          }
        }
        if (!hitSomething && boss && Math.abs(boss.x - b.x) < boss.w && Math.abs(boss.y - b.y) < 46) {
          boss.hp -= 1; hitSomething = true;
          if (juice && Math.random() < 0.3) juice.text(boss.x * SX, boss.y * SY, "-1", "#ffd740");
          if (boss.hp <= 0) { score += 120 + sector * 10; if (sfx && sfx.fanfare) sfx.fanfare(); sectorClear(); }
        }
        if (hitSomething) bullets.splice(bi, 1);
      }

      // alien formation + dives
      formDir += 0; // (formation sway uses formT)
      var sway = Math.sin(formT * 0.8) * 70;
      var descend = boss ? 0 : 4 * edt * (1 + sector * 0.15); // creep toward the player
      for (var fi = aliens.length - 1; fi >= 0; fi--) {
        var a2 = aliens[fi];
        if (a2.state === "enter") {
          a2.y += 260 * edt;
          if (a2.y >= a2.homeY) { a2.y = a2.homeY; a2.state = "form"; }
          a2.x = a2.homeX + sway;
        } else if (a2.state === "form") {
          a2.homeY += descend;
          a2.x = a2.homeX + sway + Math.sin(formT * 3 + a2.wig) * 6;
          a2.y = a2.homeY;
          // old-school Galaga: an alien that slips past just LOOPS back to the top
          // — escapes never cost a shield, only touches and shots do
          if (a2.y > VH - 90) { a2.homeY = 96 + Math.random() * 70; a2.y = -30; a2.state = "enter"; continue; }
        } else if (a2.state === "dive") {
          a2.y += 280 * edt;
          a2.x += a2.vx * edt;
          if (a2.y > VH + 20) { a2.homeY = 96 + Math.random() * 70; a2.y = -40; a2.state = "enter"; continue; }
          if (invuln <= 0 && Math.abs(a2.x - ship.x) < ship.w + 20 && Math.abs(a2.y - ship.y) < 34) {
            aliens.splice(fi, 1); loseShield(); continue;
          }
        }
      }
      // pick a diver now and then
      if (!boss) {
        diveT -= edt;
        if (diveT <= 0) {
          diveT = Math.max(0.7, 2.4 - sector * 0.2);
          var formers = [];
          for (var di = 0; di < aliens.length; di++) if (aliens[di].state === "form") formers.push(aliens[di]);
          if (formers.length) {
            var dv = formers[Math.floor(Math.random() * formers.length)];
            dv.state = "dive"; dv.vx = (ship.x - dv.x) * 0.5;
          }
        }
      }

      // boss motion + shots
      if (boss) {
        boss.x += boss.dir * (90 + sector * 10) * edt;
        if (boss.x < boss.w + 20) { boss.x = boss.w + 20; boss.dir = 1; }
        if (boss.x > VW - boss.w - 20) { boss.x = VW - boss.w - 20; boss.dir = -1; }
        boss.shootT -= edt;
        if (boss.shootT <= 0) {
          boss.shootT = Math.max(0.5, 1.4 - sector * 0.08);
          ebullets.push({ x: boss.x, y: boss.y + 30, vy: 240 + sector * 12, vx: (ship.x - boss.x) * 0.35 });
        }
      }

      // enemy bullets
      for (var ei = ebullets.length - 1; ei >= 0; ei--) {
        var eb = ebullets[ei]; eb.y += eb.vy * edt; eb.x += (eb.vx || 0) * edt;
        if (eb.y > VH + 20 || eb.x < -20 || eb.x > VW + 20) { ebullets.splice(ei, 1); continue; }
        if (invuln <= 0 && Math.abs(eb.x - ship.x) < ship.w + 8 && Math.abs(eb.y - ship.y) < 26) {
          ebullets.splice(ei, 1); loseShield(); if (over) return;
        }
      }

      // power-ups fall; catch them
      for (var pi = powerups.length - 1; pi >= 0; pi--) {
        var pu = powerups[pi]; pu.y += pu.vy * dt;
        if (pu.y > VH + 20) { powerups.splice(pi, 1); continue; }
        if (Math.abs(pu.x - ship.x) < ship.w + 26 && Math.abs(pu.y - ship.y) < 34) {
          if (pu.kind === "spread") { spreadT = 15; big("🔱 SPREAD SHOT! 15s", "#69f0ae"); }
          else if (pu.kind === "rapid") { rapidT = 15; big("⚡ RAPID FIRE! 15s", "#ffd740"); }
          else { shields = Math.min(maxShields + 1, shields + 1); maxShields = Math.max(maxShields, shields); big("💙 +1 SHIELD!", "#8be9fd"); }
          if (sfx && sfx.coin) sfx.coin();
          powerups.splice(pi, 1); hud();
        }
      }

      // wave / sector progression (only when idle & clear)
      if (started && !boss && !paused && !over && aliens.length === 0) {
        if (!awaiting) { awaiting = true; waveTimer = 0.9; }
        else { waveTimer -= dt; if (waveTimer <= 0) advanceWave(); }
      }
    }

    // ---------- drawing ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0a0a24"); g.addColorStop(1, "#1a0a2e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // parallax stars
      for (var s = 0; s < stars.length; s++) {
        ctx.globalAlpha = 0.3 + stars[s].z * 0.4;
        ctx.fillStyle = "#cfe4ff";
        ctx.fillRect(stars[s].x * SX, stars[s].y * SY, 2 * stars[s].z, 2 * stars[s].z);
      }
      ctx.globalAlpha = 1;
      // aliens
      for (var i = 0; i < aliens.length; i++) {
        var a = aliens[i];
        ctx.font = Math.round(38 * Math.min(SX, SY)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(ALIEN_EMOJI[a.kind], a.x * SX, a.y * SY);
      }
      // boss (chunky health bar BELOW the HUD — the old one hid under it)
      if (boss) {
        ctx.font = Math.round(96 * Math.min(SX, SY)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🛸", boss.x * SX, boss.y * SY);
        var by = Math.max(96, hudH + 6); // sit BELOW the HUD (which clears the Dynamic Island via env safe-top)
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(W * 0.12, by, W * 0.76, 22);
        ctx.fillStyle = "#ff6b6b"; ctx.fillRect(W * 0.12 + 3, by + 3, (W * 0.76 - 6) * Math.max(0, boss.hp / boss.maxHp), 16);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px Trebuchet MS, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("🛸 BOSS SAUCER  " + Math.max(0, Math.ceil(boss.hp)) + " / " + boss.maxHp, W / 2, by + 11);
      }
      // 🕒 warp tint while time is slowed
      if (warpT > 0) { ctx.fillStyle = "rgba(80,180,255,.08)"; ctx.fillRect(0, 0, W, H); }
      // player bullets
      ctx.fillStyle = "#ffe14d";
      for (var b = 0; b < bullets.length; b++) ctx.fillRect(bullets[b].x * SX - 2, bullets[b].y * SY - 8, 4, 12);
      // enemy bullets
      ctx.fillStyle = "#ff6b6b";
      for (var e = 0; e < ebullets.length; e++) ctx.fillRect(ebullets[e].x * SX - 3, ebullets[e].y * SY - 4, 6, 10);
      // power-ups
      for (var p = 0; p < powerups.length; p++) {
        ctx.font = Math.round(26 * Math.min(SX, SY)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(powerups[p].kind === "spread" ? "🔱" : powerups[p].kind === "rapid" ? "⚡" : "💙", powerups[p].x * SX, powerups[p].y * SY);
      }
      // ship (blink while invulnerable)
      if (invuln <= 0 || Math.floor(formT * 12) % 2 === 0) {
        ctx.font = Math.round(40 * Math.min(SX, SY)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🚀", ship.x * SX, ship.y * SY);
      }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input ----------
    var keys = { left: false, right: false };
    function mapX(clientX) {
      var r = cv.getBoundingClientRect();
      var denom = r.width || W || VW;
      return Math.max(ship.w, Math.min(VW - ship.w, (clientX - r.left) / denom * VW));
    }
    var dragging = false;
    cv.addEventListener("touchstart", function (ev) { ev.preventDefault(); ship.x = mapX(ev.changedTouches[0].clientX); }, { passive: false });
    cv.addEventListener("touchmove", function (ev) { ev.preventDefault(); ship.x = mapX(ev.changedTouches[0].clientX); }, { passive: false });
    cv.addEventListener("mousedown", function (ev) { dragging = true; ship.x = mapX(ev.clientX); });
    function onMove(ev) { if (dragging) ship.x = mapX(ev.clientX); }
    function onUp() { dragging = false; }
    function onKeyDown(ev) {
      if (ev.key === "ArrowLeft") keys.left = true;
      else if (ev.key === "ArrowRight") keys.right = true;
      else if ((ev.key === " " || ev.key === "Enter") && charge >= 1 && !paused && !over) openMega();
    }
    function onKeyUp(ev) { if (ev.key === "ArrowLeft") keys.left = false; else if (ev.key === "ArrowRight") keys.right = false; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    megaBtn.onclick = openMega;
    warpBtn.onclick = timeWarp;
    barrBtn.onclick = barrage;

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over && started) step(dt);
      draw();
    }

    // ---------- banking / end ----------
    function runRewards() {
      return {
        win: !!won,
        score: score,
        rankPtsDelta: Math.min(14, 2 + sector * 2 + megaUses),
        xp: Math.min(90, 8 + kills * 2 + (sector - 1) * 5 + megaUses * 4),
        gems: Math.min(140, 5 + kills + (sector - 1) * 6 + megaUses * 5 + (won ? 25 : 0))
      };
    }
    function saveBest() {
      if (score > (stats.bestScore || 0)) stats.bestScore = score;
      if (sector > (stats.bestSector || 0)) stats.bestSector = sector;
      store.save();
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = runRewards();
      var res = store.recordGame ? store.recordGame("blaster", rw) : null;
      return { rw: rw, res: res };
    }
    function showEndCard(bank) {
      var rw = bank ? bank.rw : runRewards();
      var card = wrap.querySelector("#bscard");
      card.innerHTML = '<div class="wqcard" style="text-align:center;max-height:80vh;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y">' +
        '<div style="font-size:44px">' + (won ? "🏆" : "💥") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (won ? "GALAXY DEFENDED!" : "Ship down!") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:2px 0">🚀 Reached Sector ' + sector + ' · ⭐ ' + score + ' this run</div>' +
        '<div style="margin:2px 0;color:#5a6b7a">Best score ' + (stats.bestScore || 0) + ' · Best sector ' + (stats.bestSector || 0) + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;margin-top:8px">' +
        '<button class="submit" id="bsreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="bsleave" type="button">Leave</button></div></div>';
      card.style.display = "flex";
      wrap.querySelector("#bsreplay").onclick = function () { card.style.display = "none"; begin(); };
      wrap.querySelector("#bsleave").onclick = exit;
    }
    function gameOver() {
      if (over) return; over = true; paused = true;
      saveBest();
      var bank = bankRun();
      if (juice) juice.shake(10);
      if (sfx && sfx.buzz) sfx.buzz();
      showEndCard(bank);
      hud();
    }
    function bankExit() {
      if (over || banked || !started) return;
      saveBest();
      var bank = bankRun();
      if (bank && sfx && sfx.toast) sfx.toast("🚀 Run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);

    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    wrap.querySelector("#quit").onclick = exit;

    // ---------- test API ----------
    cv._blaster = {
      state: function () {
        return {
          score: score, shields: shields, sector: sector, wave: wave,
          best: stats.bestScore || 0, charge: charge, banked: banked, over: over,
          aliens: aliens.length, boss: boss ? { hp: boss.hp } : null, upgrades: upgrades.slice(),
          warpT: warpT, warpCd: warpCd, barrCd: barrCd
        };
      },
      warp: timeWarp,
      barrage: barrage,
      alienList: function () { return aliens; },
      cool: function () { warpCd = 0; barrCd = 0; warpT = 0; hud(); },
      begin: begin,
      moveTo: function (x) { ship.x = Math.max(ship.w, Math.min(VW - ship.w, x)); },
      spawnWave: function (n) { aliens = []; boss = null; awaiting = false; spawnFormation(n || 4); hud(); },
      killAll: function () { for (var i = aliens.length - 1; i >= 0; i--) killAlienAt(i); hud(); },
      fillCharge: function () { charge = 1; hud(); },
      megaQuiz: openMega,
      spawnBoss: function () { aliens = []; boss = null; startBoss(); hud(); },
      hurt: loseShield
    };

    // ---------- boot ----------
    hud();
    begin();
    if (global._blasterdemo) setTimeout(function () { // screenshot scene: a busy mid-boss fight
      global._blasterdemo = 0;
      sector = 3; wave = 3; won = false;
      cv._blaster.spawnWave(8);
      startBoss(); // after the wave — spawnWave/spawnBoss each clear the other
      charge = 0.7;
      for (var d = 0; d < 5; d++) ebullets.push({ x: 200 + d * 140, y: 200 + d * 30, vy: 200, vx: 0 });
      powerups.push({ x: 500, y: 300, kind: "spread", vy: 120 });
      hud();
    }, 60);
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }

  global.VobloxBlaster = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
