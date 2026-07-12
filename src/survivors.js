/*
 * Voblox arcade game — 🧟 WORD SURVIVORS (a kid-friendly Vampire-Survivors-lite).
 * A 🧙 wizard kid walks an endless meadow while cute monsters swarm in. Your
 * WEAPONS AUTO-FIRE — the game is DODGING and positioning. Killed monsters drop
 * 💎 XP gems that vacuum to you; the bar fills → LEVEL UP.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - Every LEVEL UP asks a word (miniQuiz). CORRECT → pick 1 of 3 upgrades (a new
 *     weapon or a boost). WRONG → you STILL level and get a random small boost —
 *     never nothing, always kind.
 * Survive the 10-minute run to WIN. Death ends the run (time survived shown).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("survivors")
 * per run, banked on death, win, quit, AND app-close. Best time/kills persist.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // cute monster roster (emoji + splash color + base stats). 👹 is the boss.
  var MOBS = {
    slime: { e: "🟢", c: "#6ad46a", hp: 10, speed: 42, dmg: 1, r: 16 },
    bat: { e: "🦇", c: "#9a7ad4", hp: 7, speed: 74, dmg: 1, r: 14 },
    ghost: { e: "👻", c: "#cfd6ff", hp: 14, speed: 54, dmg: 1, r: 17 },
    mushroom: { e: "🍄", c: "#ff7a7a", hp: 22, speed: 34, dmg: 1, r: 18 },
    boss: { e: "👹", c: "#ff5b5b", hp: 900, speed: 40, dmg: 2, r: 40, big: true }
  };
  var MOB_KINDS = ["slime", "bat", "ghost", "mushroom"];

  // upgrades offered on level-up: 4 auto weapons + 4 boosts (plus wand level-ups)
  var UPGRADES = {
    wand: { name: "Magic Wand", emoji: "🪄", weapon: true, tip: "+bolt power" },
    firering: { name: "Fire Ring", emoji: "🔥", weapon: true, tip: "orbiting flames" },
    starrain: { name: "Star Rain", emoji: "⭐", weapon: true, tip: "falling stars" },
    boomerang: { name: "Boomerang", emoji: "🌀", weapon: true, tip: "sweeps out & back" },
    aura: { name: "Garlic Aura", emoji: "🧄", weapon: true, tip: "damage circle" },
    speed: { name: "Swift Boots", emoji: "👟", tip: "+move speed" },
    magnet: { name: "Gem Magnet", emoji: "🧲", tip: "+pickup range" },
    maxheart: { name: "Extra Heart", emoji: "❤️", tip: "+1 max heart" },
    fasterfire: { name: "Quick Cast", emoji: "⚡", tip: "weapons fire faster" }
  };

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("survivors");
    // additive, never-renamed save fields
    stats.bestTimeS = stats.bestTimeS || 0;
    stats.bestKills = stats.bestKills || 0;
    stats.wins = stats.wins || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap survivors";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="svcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="svmsg">🧟 Word Survivors — dodge the swarm!</div>' +
      '<div class="grow"><span id="svhearts">❤️❤️❤️❤️❤️</span><span id="svtime">10:00</span>' +
      '<span id="svlvl">Lv 1</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="svbig"></div>' +
      '<div class="gover" id="svq" style="display:none"></div>' +
      '<div class="gover" id="svpick" style="display:none"></div>' +
      '<div class="gover" id="svcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#svcv"), ctx = cv.getContext("2d");
    var svq = document.getElementById("svq"), svpick = document.getElementById("svpick"), svcard = document.getElementById("svcard");
    var msgEl = document.getElementById("svmsg"), bigEl = document.getElementById("svbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
    }
    resize();
    window.addEventListener("resize", resize);

    var RUN_LEN = 600; // 10-minute survival
    var HERO_R = 18, INVULN = 1.2, MAGNET0 = 46;

    // ---------- run state (reused arrays, no per-frame allocation churn) ----------
    var running = true, raf = 0, lastT = performance.now();
    var mobs = [], shots = [], drops = [], flames = []; // flames reused for the fire ring draw/hit
    var hero = { x: 0, y: 0, fx: 1, fy: 0 };
    var mvx = 0, mvy = 0; // resolved input this frame (programmatic/test)
    var keys = {}, stick = null;
    var hearts, maxHearts, invuln, runT, kills, level, xp, xpNeed, pendingLevels;
    var weapons, speedMul, magnetR, fireRateMul, boss;
    var over, won, paused, banked, spawnT, bossFlags, lastFmt;
    var fireT, starT, boomT, ringAng;

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1200);
    }
    function fmtTime(s) {
      var left = Math.max(0, Math.ceil(RUN_LEN - s));
      var m = Math.floor(left / 60), ss = left % 60;
      return m + ":" + (ss < 10 ? "0" : "") + ss;
    }
    function updateHud() {
      var hs = "", i;
      for (i = 0; i < maxHearts; i++) hs += i < hearts ? "❤️" : "🖤";
      document.getElementById("svhearts").textContent = hs;
      document.getElementById("svtime").textContent = fmtTime(runT);
      document.getElementById("svlvl").textContent = "Lv " + level;
    }

    function begin() {
      mobs.length = 0; shots.length = 0; drops.length = 0; flames.length = 0;
      hero.x = 0; hero.y = 0; hero.fx = 1; hero.fy = 0;
      mvx = 0; mvy = 0; keys = {}; stick = null;
      maxHearts = 5; hearts = 5; invuln = 0;
      runT = 0; kills = 0; level = 1; xp = 0; xpNeed = 5; pendingLevels = 0;
      weapons = { wand: 1 }; speedMul = 1; magnetR = MAGNET0; fireRateMul = 1; boss = null;
      over = false; won = false; paused = false; banked = false;
      spawnT = 0.6; bossFlags = {}; fireT = 0; starT = 1.4; boomT = 1; ringAng = 0;
      svcard.style.display = "none"; svq.style.display = "none"; svpick.style.display = "none";
      updateHud();
      big("🧙 SURVIVE!", "#8ef");
    }

    // ---------- economy: ONE guarded bank path ----------
    function rewards(w) {
      var mins = Math.floor(runT / 60);
      return {
        win: !!w, score: kills + mins,
        rankPtsDelta: w ? 12 : Math.min(8, 1 + mins),
        xp: Math.min(80, 6 + kills + mins * 4 + (w ? 20 : 0)),
        gems: 3 + Math.floor(kills / 3) + mins * 2 + (w ? 20 : 0)
      };
    }
    function persistBests() {
      var ts = Math.floor(runT);
      if (ts > (stats.bestTimeS || 0)) stats.bestTimeS = ts;
      if (kills > (stats.bestKills || 0)) stats.bestKills = kills;
      if (won) stats.wins = (stats.wins || 0) + 1;
      if (store.save) store.save();
    }
    function bankRun(w) {
      if (banked) return null;
      banked = true;
      var rw = rewards(w);
      var res = store.recordGame ? store.recordGame("survivors", rw) : null;
      return { rw: rw, res: res };
    }

    function endRun(w) {
      if (over) return;
      over = true; won = !!w; paused = true;
      var bank = bankRun(w) || { rw: rewards(w) };
      persistBests();
      showCard(bank.rw);
      if (w) { if (sfx && sfx.fanfare) sfx.fanfare(); if (juice) juice.shake(6); }
      else { if (sfx && sfx.buzz) sfx.buzz(); if (juice) juice.shake(10); }
    }
    function showCard(rw) {
      var survived = Math.floor(runT), sm = Math.floor(survived / 60), ss = survived % 60;
      svcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (won ? "🏆" : "🧟") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (won ? "YOU SURVIVED THE 10 MINUTES!" : "The swarm got you…") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">⏱ Survived <b>' + sm + ":" + (ss < 10 ? "0" : "") + ss +
        '</b> · 🧟 <b>' + kills + '</b> munched</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🏅 Best time <b>' +
        Math.floor((stats.bestTimeS || 0) / 60) + ":" + (((stats.bestTimeS || 0) % 60) < 10 ? "0" : "") + ((stats.bestTimeS || 0) % 60) +
        '</b> · best kills ' + (stats.bestKills || 0) + '</div>' +
        '<button class="submit big-next" id="svreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="svleave" type="button">Leave</button></div>';
      svcard.style.display = "flex";
      document.getElementById("svreplay").onclick = function () { svcard.style.display = "none"; begin(); };
      document.getElementById("svleave").onclick = exit;
    }

    // ---------- level up: word gate → upgrade picker (or kind boost) ----------
    function addXp(amount) {
      xp += amount;
      while (xp >= xpNeed) { xp -= xpNeed; pendingLevels++; xpNeed = 5 + level * 3 + pendingLevels * 2; }
      if (pendingLevels > 0 && !paused && !over) openLevelQuiz();
    }
    function openLevelQuiz() {
      if (over) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(svq, words, store, {
        title: "⭐ LEVEL UP! Answer a word to power up!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          level++; updateHud();
          if (ok) { showPicker(); }
          else { applyRandomBoost(); afterLevel(); }
        }
      });
    }
    function boostIds() { return ["speed", "magnet", "maxheart", "fasterfire"]; }
    function applyRandomBoost() {
      var b = boostIds();
      var id = b[Math.floor(Math.random() * b.length)];
      applyUpgrade(id);
      big("✨ " + UPGRADES[id].emoji + " " + UPGRADES[id].name + " (bonus)!", "#8ecdf7");
    }
    function afterLevel() {
      pendingLevels--;
      if (pendingLevels > 0 && !over) openLevelQuiz();
      else { paused = false; svq.style.display = "none"; svpick.style.display = "none"; }
    }
    // 3 offers: prefer new weapons, then owned-weapon level-ups + boosts
    function offerOptions() {
      var pool = [], w;
      ["firering", "starrain", "boomerang", "aura"].forEach(function (id) { if (!weapons[id]) pool.push(id); });
      for (w in weapons) if (weapons.hasOwnProperty(w)) pool.push(w);
      boostIds().forEach(function (id) { pool.push(id); });
      // shuffle, then de-dup keeping variety, take 3
      for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
      var out = [];
      for (var k = 0; k < pool.length && out.length < 3; k++) if (out.indexOf(pool[k]) < 0) out.push(pool[k]);
      while (out.length < 3) out.push(boostIds()[out.length % 4]);
      return out;
    }
    function showPicker() {
      var picks = offerOptions();
      svpick.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:34px">⭐</div>' +
        '<div class="wqtitle" style="font-size:19px">Correct! Choose your power-up:</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px">' +
        picks.map(function (id) {
          var u = UPGRADES[id], lv = weapons[id] || 0;
          var sub = u.weapon ? (lv > 0 ? "Lv " + (lv + 1) + " · " + u.tip : "NEW! " + u.tip) : u.tip;
          return '<button class="embtn" style="min-width:132px" data-up="' + id + '"><span class="ebl">' + u.emoji + " " + u.name + '</span><span class="ebs">' + sub + "</span></button>";
        }).join("") + "</div></div>";
      svpick.style.display = "flex";
      if (sfx && sfx.chime) sfx.chime();
      Array.prototype.forEach.call(svpick.querySelectorAll("[data-up]"), function (b) {
        b.onclick = function () { pick(b.dataset.up); };
      });
    }
    function pick(id) {
      if (svpick.style.display === "none" && !pendingLevels) return;
      applyUpgrade(id);
      var u = UPGRADES[id] || { emoji: "✨", name: id };
      big(u.emoji + " " + u.name + "!", "#69f0ae");
      if (juice) juice.burst(W / 2, H / 2, "#ffd23f", 18);
      if (sfx && sfx.fanfare) sfx.fanfare();
      svpick.style.display = "none";
      afterLevel();
    }
    function applyUpgrade(id) {
      var u = UPGRADES[id];
      if (u && u.weapon) { weapons[id] = (weapons[id] || 0) + 1; }
      else if (id === "speed") { speedMul += 0.12; }
      else if (id === "magnet") { magnetR += 34; }
      else if (id === "maxheart") { maxHearts++; hearts = Math.min(maxHearts, hearts + 1); }
      else if (id === "fasterfire") { fireRateMul = Math.max(0.35, fireRateMul * 0.85); }
      updateHud();
    }

    // ---------- combat helpers ----------
    function spawnMob(kind, ox, oy) {
      if (mobs.length >= 120) return null;
      var def = MOBS[kind] || MOBS.slime;
      var mins = Math.floor(runT / 60);
      var m = {
        kind: kind, e: def.e, c: def.c, r: def.r, big: !!def.big,
        x: hero.x + ox, y: hero.y + oy,
        hp: Math.round(def.hp * (1 + mins * 0.18) * (def.big ? 1 : 1)),
        maxHp: 1, speed: def.speed * (1 + mins * 0.05), dmg: def.dmg, hitCd: 0, bob: Math.random() * 6
      };
      m.maxHp = m.hp;
      mobs.push(m);
      return m;
    }
    function ringSpawn(kind) {
      var rad = Math.max(W, H) / 2 + 70;
      var a = Math.random() * Math.PI * 2;
      return spawnMob(kind || MOB_KINDS[Math.floor(Math.random() * MOB_KINDS.length)], Math.cos(a) * rad, Math.sin(a) * rad);
    }
    function dropGem(x, y, val, heart) {
      drops.push({ x: x, y: y, val: val || 1, heart: !!heart });
    }
    function killMob(idx) {
      var m = mobs[idx];
      kills++;
      if (m.big) { dropGem(m.x, m.y, 8, false); if (boss === m) boss = null; }
      else { dropGem(m.x, m.y, 1, Math.random() < 0.06); }
      if (juice) juice.burst(sx(m.x), sy(m.y), m.c, m.big ? 24 : 8);
      if (sfx && sfx.pop && Math.random() < 0.4) sfx.pop();
      mobs.splice(idx, 1);
    }
    function damageMob(m, dmg) {
      m.hp -= dmg;
      if (m.hp <= 0) { var i = mobs.indexOf(m); if (i >= 0) killMob(i); return true; }
      return false;
    }
    function takeHit(dmg) {
      if (invuln > 0 || over) return;
      hearts = Math.max(0, hearts - (dmg || 1));
      invuln = INVULN;
      updateHud();
      if (juice) juice.shake(9);
      if (sfx && sfx.buzz) sfx.buzz();
      if (hearts <= 0) endRun(false);
    }

    // screen transforms (camera centered on hero)
    function sx(wx) { return W / 2 + (wx - hero.x); }
    function sy(wy) { return H / 2 + (wy - hero.y); }
    function nearest() {
      var best = null, bd = 1e9;
      for (var i = 0; i < mobs.length; i++) {
        var m = mobs[i], dx = m.x - hero.x, dy = m.y - hero.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = m; }
      }
      return best;
    }

    // ---------- weapons (auto-fire) ----------
    function fireWeapons(dt) {
      // 🪄 WAND — bolt(s) at the nearest monster
      fireT -= dt;
      if (fireT <= 0) {
        var wl = weapons.wand || 1;
        var tgt = nearest();
        if (tgt) {
          fireT = 0.6 * fireRateMul;
          var count = 1 + Math.floor(wl / 3);
          for (var b = 0; b < count; b++) {
            var ang = Math.atan2(tgt.y - hero.y, tgt.x - hero.x) + (b - (count - 1) / 2) * 0.18;
            shots.push({ type: "bolt", x: hero.x, y: hero.y, vx: Math.cos(ang) * 360, vy: Math.sin(ang) * 360, dmg: 5 + wl * 2, r: 8, life: 1.4, hit: null });
          }
          if (sfx && sfx.pop && Math.random() < 0.2) sfx.pop();
        } else { fireT = 0.2; }
      }
      // ⭐ STAR RAIN — stars fall onto random spots near the swarm
      if (weapons.starrain) {
        starT -= dt;
        if (starT <= 0) {
          starT = 1.4 * fireRateMul;
          var sl = weapons.starrain;
          for (var s = 0; s < sl; s++) {
            var tx = hero.x + (Math.random() - 0.5) * 260, ty = hero.y + (Math.random() - 0.5) * 200;
            shots.push({ type: "star", x: tx, y: ty - 220, tx: tx, ty: ty, dmg: 16 + sl * 4, r: 46, life: 2 });
          }
        }
      }
      // 🌀 BOOMERANG — sweeps out in the facing direction and comes back
      if (weapons.boomerang) {
        boomT -= dt;
        if (boomT <= 0) {
          boomT = 2.2 * fireRateMul;
          var bl = weapons.boomerang;
          shots.push({ type: "boom", x: hero.x, y: hero.y, fx: hero.fx, fy: hero.fy, dmg: 12 + bl * 3, r: 18, t: 0, out: 1, dist: 0, hit: {} });
        }
      }
    }
    function stepShots(dt) {
      for (var i = shots.length - 1; i >= 0; i--) {
        var s = shots[i];
        if (s.type === "bolt") {
          s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
          var gone = s.life <= 0;
          for (var m = 0; m < mobs.length && !gone; m++) {
            var mo = mobs[m];
            if ((mo.x - s.x) * (mo.x - s.x) + (mo.y - s.y) * (mo.y - s.y) < (mo.r + s.r) * (mo.r + s.r)) {
              damageMob(mo, s.dmg); gone = true;
            }
          }
          if (gone) shots.splice(i, 1);
        } else if (s.type === "star") {
          s.life -= dt;
          var fall = Math.min(1, (2 - s.life) / 0.5);
          s.y = (s.ty - 220) + (s.ty - (s.ty - 220)) * fall;
          if (!s.boomed && fall >= 1) { // land: AoE splash
            s.boomed = true;
            for (var k = mobs.length - 1; k >= 0; k--) {
              var mk = mobs[k];
              if ((mk.x - s.tx) * (mk.x - s.tx) + (mk.y - s.ty) * (mk.y - s.ty) < s.r * s.r) damageMob(mk, s.dmg);
            }
            if (juice) juice.burst(sx(s.tx), sy(s.ty), "#ffd23f", 14);
          }
          if (s.life <= 0) shots.splice(i, 1);
        } else if (s.type === "boom") {
          s.t += dt;
          var reach = 190;
          if (s.out) { s.dist += 260 * dt; if (s.dist >= reach) s.out = 0; }
          else { s.dist -= 300 * dt; if (s.dist <= 0) { shots.splice(i, 1); continue; } }
          s.x = hero.x + s.fx * s.dist; s.y = hero.y + s.fy * s.dist;
          for (var bmi = mobs.length - 1; bmi >= 0; bmi--) {
            var bm = mobs[bmi];
            var key = bm.bob; // cheap per-mob throttle so a single pass hits once per ~0.25s
            if ((bm.x - s.x) * (bm.x - s.x) + (bm.y - s.y) * (bm.y - s.y) < (bm.r + s.r) * (bm.r + s.r)) {
              if ((bm.boomCd || 0) <= 0) { damageMob(bm, s.dmg); bm.boomCd = 0.25; }
            }
          }
        }
      }
    }
    // continuous-damage weapons (fire ring, garlic aura) — cheap dt*dps
    function stepAuras(dt) {
      ringAng += dt * 2.4;
      if (weapons.firering) {
        var n = weapons.firering + 1, ringR = 74, dps = 16 + weapons.firering * 6;
        flames.length = 0;
        for (var f = 0; f < n; f++) {
          var a = ringAng + (f / n) * Math.PI * 2;
          var fx = hero.x + Math.cos(a) * ringR, fy = hero.y + Math.sin(a) * ringR;
          flames.push({ x: fx, y: fy });
          for (var m = mobs.length - 1; m >= 0; m--) {
            var mo = mobs[m];
            if ((mo.x - fx) * (mo.x - fx) + (mo.y - fy) * (mo.y - fy) < (mo.r + 20) * (mo.r + 20)) damageMob(mo, dps * dt);
          }
        }
      } else flames.length = 0;
      if (weapons.aura) {
        var ar = 62 + weapons.aura * 12, adps = 9 + weapons.aura * 5;
        for (var k = mobs.length - 1; k >= 0; k--) {
          var mk = mobs[k];
          if ((mk.x - hero.x) * (mk.x - hero.x) + (mk.y - hero.y) * (mk.y - hero.y) < ar * ar) damageMob(mk, adps * dt);
        }
      }
    }

    function inputVec() {
      if (stick) return stick;
      var kx = 0, ky = 0;
      if (keys.left) kx -= 1; if (keys.right) kx += 1; if (keys.up) ky -= 1; if (keys.down) ky += 1;
      if (kx || ky) return { x: kx, y: ky };
      return { x: mvx, y: mvy };
    }

    // ---------- simulation ----------
    function step(dt) {
      runT += dt;
      if (invuln > 0) invuln = Math.max(0, invuln - dt);
      updateHud();
      // move hero
      var iv = inputVec(), il = Math.sqrt(iv.x * iv.x + iv.y * iv.y);
      if (il > 0.01) {
        var nx = iv.x / il, ny = iv.y / il;
        hero.fx = nx; hero.fy = ny;
        var hspeed = 150 * speedMul;
        hero.x += nx * hspeed * dt; hero.y += ny * hspeed * dt;
      }
      // spawns: stream in, ramping every 60s
      var mins = Math.floor(runT / 60);
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = Math.max(0.32, 1.15 - mins * 0.09);
        var batch = 1 + Math.floor(mins / 2);
        for (var s = 0; s < batch; s++) ringSpawn();
      }
      // 👹 BIG BOSS at minute 5 and minute 9
      if (runT >= 300 && !bossFlags.b5) { bossFlags.b5 = 1; boss = ringSpawn("boss"); big("👹 A BIG BOSS APPEARS!", "#ff8a8a"); if (sfx && sfx.buzz) sfx.buzz(); }
      if (runT >= 540 && !bossFlags.b9) { bossFlags.b9 = 1; boss = ringSpawn("boss"); big("👹 ANOTHER BIG BOSS!", "#ff8a8a"); if (sfx && sfx.buzz) sfx.buzz(); }
      // weapons
      fireWeapons(dt);
      stepShots(dt);
      stepAuras(dt);
      // monsters chase + touch-damage
      for (var i = mobs.length - 1; i >= 0; i--) {
        var mob = mobs[i];
        if (mob.boomCd) mob.boomCd = Math.max(0, mob.boomCd - dt);
        var dx = hero.x - mob.x, dy = hero.y - mob.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        mob.x += (dx / d) * mob.speed * dt; mob.y += (dy / d) * mob.speed * dt;
        if (d < mob.r + HERO_R) takeHit(mob.dmg);
      }
      // gems/hearts vacuum + collect
      for (var g = drops.length - 1; g >= 0; g--) {
        var gm = drops[g];
        var gdx = hero.x - gm.x, gdy = hero.y - gm.y, gd = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
        if (gd < magnetR) { gm.x += (gdx / gd) * 260 * dt; gm.y += (gdy / gd) * 260 * dt; }
        if (gd < HERO_R + 6) {
          drops.splice(g, 1);
          if (gm.heart) { hearts = Math.min(maxHearts, hearts + 1); big("❤️ +1 heart!", "#ff8a8a"); if (sfx && sfx.coin) sfx.coin(); }
          else { addXp(gm.val); if (sfx && sfx.coin && Math.random() < 0.3) sfx.coin(); }
          updateHud();
        }
      }
      if (juice) juice.update(dt);
      // WIN: survive the full 10 minutes
      if (runT >= RUN_LEN && !over) endRun(true);
    }

    // ---------- drawing ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // tiled grass meadow (checker pattern, scrolls with the camera)
      var ts = 64;
      var ox = ((hero.x % ts) + ts) % ts, oy = ((hero.y % ts) + ts) % ts;
      var cols = Math.ceil(W / ts) + 2, rows = Math.ceil(H / ts) + 2;
      var baseC = Math.floor(hero.x / ts), baseR = Math.floor(hero.y / ts);
      for (var r = -1; r < rows; r++) for (var c = -1; c < cols; c++) {
        var gx = c * ts - ox, gy = r * ts - oy;
        var cell = (baseC + c + baseR + r) & 1;
        ctx.fillStyle = cell ? "#7bbf5a" : "#71b552";
        ctx.fillRect(gx, gy, ts, ts);
      }
      // drops (gems + hearts)
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (var g = 0; g < drops.length; g++) {
        var gm = drops[g];
        ctx.font = "18px serif";
        ctx.fillText(gm.heart ? "❤️" : "💎", sx(gm.x), sy(gm.y));
      }
      // fire ring flames
      for (var f = 0; f < flames.length; f++) { ctx.font = "26px serif"; ctx.fillText("🔥", sx(flames[f].x), sy(flames[f].y)); }
      // garlic aura circle
      if (weapons && weapons.aura) {
        var ar = 62 + weapons.aura * 12;
        ctx.fillStyle = "rgba(200,255,180,.14)";
        ctx.beginPath(); ctx.arc(W / 2, H / 2, ar, 0, Math.PI * 2); ctx.fill();
      }
      // shots
      for (var i = 0; i < shots.length; i++) {
        var s = shots[i];
        if (s.type === "bolt") { ctx.font = "18px serif"; ctx.fillText("✨", sx(s.x), sy(s.y)); }
        else if (s.type === "star") { ctx.font = "26px serif"; ctx.fillText("⭐", sx(s.x), sy(s.y)); }
        else if (s.type === "boom") { ctx.font = "24px serif"; ctx.fillText("🌀", sx(s.x), sy(s.y)); }
      }
      // monsters (cull off-screen)
      for (var m = 0; m < mobs.length; m++) {
        var mo = mobs[m], msx = sx(mo.x), msy = sy(mo.y);
        if (msx < -40 || msx > W + 40 || msy < -40 || msy > H + 40) continue;
        var wob = Math.sin(runT * 6 + mo.bob) * 2;
        ctx.font = Math.round((mo.big ? 56 : 30)) + "px serif";
        ctx.fillText(mo.e, msx, msy + wob);
        if (mo.hp < mo.maxHp) {
          var bw = mo.big ? 60 : 26;
          ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(msx - bw / 2, msy - (mo.big ? 40 : 22), bw, 4);
          ctx.fillStyle = "#ff8a8a"; ctx.fillRect(msx - bw / 2, msy - (mo.big ? 40 : 22), bw * Math.max(0, mo.hp / mo.maxHp), 4);
        }
      }
      // hero (blinks while invulnerable)
      if (!(invuln > 0 && Math.floor(runT * 12) % 2)) {
        ctx.font = "34px serif"; ctx.fillText("🧙", W / 2, H / 2 + Math.sin(runT * 5) * 2);
      }
      // boss health bar across the top
      if (boss && mobs.indexOf(boss) >= 0) {
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(W * 0.14, 8, W * 0.72, 16);
        ctx.fillStyle = "#ff6b6b"; ctx.fillRect(W * 0.14 + 2, 10, (W * 0.72 - 4) * Math.max(0, boss.hp / boss.maxHp), 12);
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px Trebuchet MS"; ctx.textAlign = "center";
        ctx.fillText("👹 BIG BOSS", W / 2, 17);
      }
      // xp bar hugging the bottom
      var bw2 = Math.min(360, W * 0.7), bx2 = (W - bw2) / 2, by2 = H - 14;
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(bx2, by2, bw2, 8);
      ctx.fillStyle = "#5bd0ff"; ctx.fillRect(bx2, by2, bw2 * Math.max(0, Math.min(1, xp / xpNeed)), 8);
      if (juice) juice.draw(ctx);
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) step(dt);
      draw();
    }

    // ---------- input (phantom-tap safe: canvas is a hold/mover) ----------
    function stickFrom(x, y) {
      // vector from the touch's start point; capped to a unit stick
      var dx = x - stickOX, dy = y - stickOY, len = Math.sqrt(dx * dx + dy * dy);
      if (len < 6) return { x: 0, y: 0 };
      var cap = Math.min(len, 60);
      return { x: (dx / len) * (cap / 60), y: (dy / len) * (cap / 60) };
    }
    var stickOX = 0, stickOY = 0;
    function rel(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    cv.addEventListener("touchstart", function (e) {
      e.preventDefault(); var p = rel(e, e.changedTouches[0]);
      stickOX = p.x; stickOY = p.y; stick = { x: 0, y: 0 };
    }, { passive: false });
    cv.addEventListener("touchmove", function (e) {
      e.preventDefault(); var p = rel(e, e.changedTouches[0]); stick = stickFrom(p.x, p.y);
    }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); stick = null; }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var p = rel(e); stickOX = p.x; stickOY = p.y; stick = { x: 0, y: 0 }; });
    cv.addEventListener("mousemove", function (e) { if (stick) { var p = rel(e); stick = stickFrom(p.x, p.y); } });
    cv.addEventListener("mouseup", function () { stick = null; });
    cv.addEventListener("mouseleave", function () { stick = null; });

    function onKey(down) {
      return function (e) {
        var k = e.key;
        if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = down;
        else if (k === "ArrowRight" || k === "d" || k === "D") keys.right = down;
        else if (k === "ArrowUp" || k === "w" || k === "W") keys.up = down;
        else if (k === "ArrowDown" || k === "s" || k === "S") keys.down = down;
        else return;
        if (down) e.preventDefault();
      };
    }
    var keyDown = onKey(true), keyUp = onKey(false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    // ---------- exit / banking (mid-run quit + app-close both bank) ----------
    function bankExit() {
      if (over) return; // an ended run already banked
      if (kills === 0 && runT < 1) return; // an untouched run banks nothing
      var b = bankRun(false);
      persistBests();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🧟 Survivors run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("beforeunload", onUnload);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._survivors = {
      state: function () {
        var ws = []; for (var k in weapons) if (weapons.hasOwnProperty(k)) ws.push(k);
        return {
          t: runT, hearts: hearts, level: level, xpFrac: Math.max(0, Math.min(1, xp / xpNeed)),
          kills: kills, weapons: ws, over: over, won: won, banked: banked,
          monsters: mobs.length, boss: (boss && mobs.indexOf(boss) >= 0) ? { hp: boss.hp } : null
        };
      },
      begin: begin,
      move: function (dx, dy) { mvx = dx; mvy = dy; stick = null; },
      spawn: function (n, kind) { for (var i = 0; i < (n || 1); i++) ringSpawn(kind); },
      killAll: function () { for (var i = mobs.length - 1; i >= 0; i--) killMob(i); },
      gainXp: function (frac) { addXp((frac || 0) * xpNeed); },
      levelUpQuiz: function () { if (pendingLevels < 1) pendingLevels = 1; openLevelQuiz(); },
      pick: pick,
      hurt: function () { invuln = 0; takeHit(1); },
      warp: function (t) { runT = t; updateHud(); }
    };

    // ---------- boot ----------
    begin();
    if (global._survivorsdemo) { // screenshot seed: a busy minute-4 tableau, frozen
      global._survivorsdemo = 0;
      runT = 240; level = 6; xp = 3.5; xpNeed = 5; kills = 90;
      weapons = { wand: 3, firering: 2, starrain: 1 }; magnetR = 90;
      for (var d = 0; d < 34; d++) {
        var a = Math.random() * Math.PI * 2, rad = 90 + Math.random() * 300;
        spawnMob(MOB_KINDS[d % 4], Math.cos(a) * rad, Math.sin(a) * rad);
      }
      for (var g2 = 0; g2 < 10; g2++) dropGem(hero.x + (Math.random() - 0.5) * 200, hero.y + (Math.random() - 0.5) * 160, 1, false);
      stepAuras(0.016); // seed the flame positions so the ring shows
      paused = true; // freeze the tableau — the demo exists for screenshots
      updateHud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxSurvivors = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
