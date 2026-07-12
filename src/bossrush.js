/*
 * Voblox arcade game — 🏰 BOSS RUSH (a pure boss-gauntlet arena fighter).
 * SIX bosses back-to-back, each with a name, a personality, and ONE distinct,
 * always-dodgeable, always-telegraphed attack pattern. Leo LOVES bosses, so
 * this game is nothing BUT bosses. Descended from the dungeon.js arena-combat +
 * boss-word-duel pattern (its proven ancestor).
 * VOCAB IS THE POWER CURVE:
 *   - Every boss wears a re-arming WORD SHIELD. Tap him (or press E) to open a
 *     word-duel (miniQuiz); a correct word drops the shield for 10s and ONLY
 *     then does your sword bite. It re-arms ~10-12s later — study to keep hitting.
 *   - Between bosses: a 5s breather + FULL heal + a word for a BUFF (sword /
 *     speed / +1 heart). Wrong is never punished — you just continue as-is.
 * KIND, not punishing: 0 hearts ends the gauntlet at THAT boss with a warm
 * "you reached Boss N" — never a scolding. recordGame("bossrush") banks ONCE
 * per run (defeat, clear, quit, or tab-close), rewards always SHOWN.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar;

  // ONE square logical arena, letterboxed to fit any screen (dungeon.js style).
  var MW = 520, MH = 520;
  var PR = 20;                       // player radius (logical)

  // ---------- the six bosses: name · personality · distinct attack ----------
  var BOSSES = {
    1: { emoji: "🐗", name: "TUSK", hp: 6, r: 40, color: "#c9884a", tag: "charges in a straight line — just step aside!" },
    2: { emoji: "🐙", name: "INKLING", hp: 7, r: 40, color: "#7b5cd6", tag: "lobs ink that leaves slippery slow-puddles" },
    3: { emoji: "🌪", name: "GUSTO", hp: 8, r: 40, color: "#63c7d6", tag: "sweeps wind walls — slip through the gaps!" },
    4: { emoji: "🧊", name: "FREEZO", hp: 9, r: 42, color: "#7fd0ff", tag: "blasts expanding frost rings — mind the gap" },
    5: { emoji: "⚡", name: "VOLTA", hp: 10, r: 42, color: "#ffd23f", tag: "zaps lightning columns — dodge the glow" },
    6: { emoji: "👑", name: "KING KABOOM", hp: 16, r: 48, color: "#ff6b6b", tag: "EVERY trick at once — and TWO phases!" }
  };

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("bossrush");
    stats.bestBoss = stats.bestBoss || 1;   // furthest boss REACHED (1-6). NOT stats.best.
    stats.clears = stats.clears || 0;        // full six-boss gauntlet wins

    var cfg = AV && AV.resolve ? AV.resolve(store.state) : { skin: "#ffcc88", shirt: "#2f7be0", pants: "#394063", face: "smile" };

    var wrap = document.createElement("div"); wrap.className = "gamewrap bossrush";
    wrap.innerHTML =
      '<canvas id="brcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="brmsg">🏰 Boss Rush</div>' +
      '<div class="grow"><span id="brhearts">❤️❤️❤️</span><span id="brboss"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="brbig"></div>' +
      // ⚔ sword button (bottom-right): a discrete tap swings the sword
      '<button type="button" id="brswing" style="position:absolute;right:14px;bottom:calc(env(safe-area-inset-bottom, 0px) + 16px);' +
      'width:76px;height:76px;background:rgba(20,16,30,.72);border:2px solid rgba(255,225,77,.55);border-radius:20px;' +
      'color:#ffd23f;font-size:34px;font-weight:900;font-family:inherit;padding:0;line-height:1;cursor:pointer;z-index:8">⚔</button>' +
      '<div class="gover" id="brq" style="display:none"></div>' +
      '<div class="gover" id="brbuff" style="display:none"></div>' +
      '<div class="gover" id="brcard" style="display:none"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#brcv"), ctx = cv.getContext("2d");

    // ---------- responsive letterbox (one square fits both orientations) ----------
    var W, H, S, OX, OY, compact = false;
    function resize() {
      W = cv.width = wrap.clientWidth || 520;
      H = cv.height = wrap.clientHeight || 640;
      compact = Math.min(W, H) < 520;
      var top = compact ? 88 : 118, bot = 96; // bottom breathing room for the ⚔ button
      var availW = W - 12, availH = H - top - bot;
      S = Math.min(availW / MW, availH / MH);
      if (S <= 0) S = 1;
      OX = Math.max(0, (W - MW * S) / 2);
      OY = top + Math.max(0, (availH - MH * S) / 2);
    }
    resize(); window.addEventListener("resize", resize);
    function X(x) { return OX + x * S; }
    function Y(y) { return OY + y * S; }
    function pz(n) { return n * S; }

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var started = false, over = false, won = false, banked = false, paused = false;
    var bossNum = 1, boss = null, hazards = [];
    var breather = false, breatherT = 0, nextBossNum = 1;
    var hearts = 3, maxHearts = 3, swordDmg = 1, speedMul = 1, buffs = [];
    var beaten = 0;                          // bosses fully defeated THIS run
    var player = { x: MW / 2, y: MH * 0.72, dir: "N", inv: 0, phase: 0 };
    var moveVec = { x: 0, y: 0 }, keyHeld = {};
    var swingT = 0, swingCd = 0, lastFmt = null;

    function big(m, col) { var e = document.getElementById("brbig"); e.textContent = m; e.style.color = col || "#fff"; e.style.opacity = "1"; setTimeout(function () { e.style.opacity = "0"; }, 1250); }
    function hud() {
      document.getElementById("brhearts").textContent = "❤️".repeat(Math.max(0, hearts)) + "🖤".repeat(Math.max(0, maxHearts - hearts));
      document.getElementById("brboss").textContent = (started && !over) ? (BOSSES[bossNum].emoji + " " + BOSSES[bossNum].name + (bossNum === 6 && boss && boss.phase === 2 ? " ②" : "")) : "";
    }
    function clampBoss(b) { b.x = Math.max(b.r, Math.min(MW - b.r, b.x)); b.y = Math.max(b.r, Math.min(MH - b.r, b.y)); }

    // ---------- boss-select / continue ----------
    function showSelect() {
      started = false; boss = null; paused = true; over = false; won = false; breather = false;
      document.getElementById("brboss").textContent = "";
      var card = document.getElementById("brcard");
      var best = stats.bestBoss || 1;
      var chips = [1, 2, 3, 4, 5, 6].map(function (n) {
        var open = n <= best, d = BOSSES[n];
        return '<button class="embtn" style="min-width:120px' + (open ? "" : ";opacity:.4") + '" data-boss="' + n + '">' +
          '<span class="ebl">' + (open ? d.emoji + " " : "🔒 ") + "Boss " + n + '</span>' +
          '<span class="ebs">' + (open ? d.name : "locked") + "</span></button>";
      }).join("");
      var cont = best > 1 ? '<button class="embtn mode" style="min-width:150px" id="br_cont">' +
        '<span class="ebl">➜ Continue</span><span class="ebs">from ' + BOSSES[best].emoji + " " + BOSSES[best].name + "</span></button>" : "";
      card.innerHTML = '<div class="wqcard" style="text-align:center;max-width:560px"><div style="font-size:40px">🏰⚔️</div>' +
        '<div class="wqtitle" style="font-size:20px">Boss Rush</div>' +
        '<div style="margin:4px 0 10px;color:#5a6b7a;font-weight:bold">Six bosses, back to back. Every shield opens for a WORD — tap the boss & answer, then strike! ' +
        (stats.clears ? "🏆 Gauntlet cleared " + stats.clears + "×." : "Can you clear them all?") + "</div>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
        '<button class="embtn study" style="min-width:150px" id="br_start"><span class="ebl">▶ Start</span><span class="ebs">from Boss 1 ' + BOSSES[1].emoji + "</span></button>" + cont + "</div>" +
        '<div style="margin-top:10px;font-size:12px;color:#8a98a8">Or jump to any boss you have reached:</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:4px">' + chips + "</div>" +
        '<div style="font-size:11px;color:#8a98a8;margin-top:8px">Move: drag / WASD · Sword: tap, Space, or ⚔ · Tap the boss (or E) to duel his shield</div></div>';
      card.style.display = "flex";
      var sb = document.getElementById("br_start"); if (sb) sb.onclick = function () { begin(1); };
      var cb = document.getElementById("br_cont"); if (cb) cb.onclick = function () { begin(best); };
      Array.prototype.forEach.call(card.querySelectorAll("[data-boss]"), function (b) {
        b.onclick = function () { var n = +b.dataset.boss; if (n > best) { big("🔒 Reach Boss " + n + " in the gauntlet first!", "#ffd740"); return; } begin(n); };
      });
    }

    // ---------- start / spawn ----------
    function begin(fromBoss) {
      fromBoss = Math.max(1, Math.min(6, fromBoss || 1));
      started = true; over = false; won = false; banked = false; paused = false; breather = false;
      hearts = 3; maxHearts = 3; swordDmg = 1; speedMul = 1; buffs = []; beaten = 0;
      moveVec.x = 0; moveVec.y = 0; keyHeld = {}; swingT = 0; swingCd = 0;
      player.x = MW / 2; player.y = MH * 0.72; player.dir = "N"; player.inv = 0;
      document.getElementById("brcard").style.display = "none";
      hideBuff();
      spawnBoss(fromBoss);
      document.getElementById("brmsg").innerHTML = "🏰 <b>Boss Rush</b> — beat all six!";
      hud();
    }
    function spawnBoss(n) {
      bossNum = n; var d = BOSSES[n];
      boss = { hp: d.hp, maxHp: d.hp, x: MW / 2, y: MH * 0.30, r: d.r, hit: 0,
        shield: true, shieldT: 0, mode: "idle", modeT: 0, atkCd: 1.7,
        tx: MW / 2, ty: MH / 2, wt: 0, cvx: 0, cvy: 0, phase: 1, tick: 0 };
      hazards = [];
      if (n > (stats.bestBoss || 1)) { stats.bestBoss = n; store.save(); } // furthest reached
      big(d.emoji + " " + d.name + " — " + d.tag, "#ffd23f");
      if (sfx && sfx.buzz) sfx.buzz();
      hud();
    }

    // ---------- word-duel: drop the shield for 10s ----------
    function duel() {
      if (!boss || !boss.shield || paused || over || breather) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("brq"), words, store, {
        title: "⚔️ " + BOSSES[bossNum].name + "'s WORD SHIELD — answer to drop it!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (!boss) return;
          if (ok) {
            boss.shield = false; boss.shieldT = 10; // down 10s, then re-arms
            big("💥 SHIELD DOWN — 10 seconds, SWING!", "#69f0ae");
            if (juice) { juice.shake(8); juice.burst(X(boss.x), Y(boss.y), "#c9b6ff", 22); }
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("The shield holds — read the word and try again!", "#ff8a8a");
        }
      });
    }

    // ---------- damaging the boss ----------
    function hitBoss(n) {
      if (!boss || boss.shield) { if (boss && juice && Math.random() < 0.4) juice.text(X(boss.x), Y(boss.y - 46), "🛡 WORD-LOCKED", "#c9b6ff"); return; }
      boss.hp -= n; boss.hit = 0.15;
      if (juice) juice.text(X(boss.x), Y(boss.y - 30), "-" + n, "#ffd740");
      if (boss.hp <= 0) killBoss();
    }
    function damageBoss(n) { if (!boss || over || breather) return; if (boss.shield) return; hitBoss(n); }

    function killBoss() {
      if (!boss) return;
      beaten++;
      var was = bossNum; boss = null; hazards = [];
      if (juice) { juice.shake(7); for (var i = 0; i < 5; i++) juice.burst(W * (0.25 + i * 0.14), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][i], 14); }
      if (sfx && sfx.pop) sfx.pop();
      if (was >= 6) { winRun(); } else { startBreather(was + 1); }
      hud();
    }

    // ---------- breather: full heal + a word for a buff ----------
    function startBreather(next) {
      breather = true; breatherT = 5; nextBossNum = next;
      hearts = maxHearts;
      big("💚 Fully healed! Answer a word for a BUFF — or skip, no worries.", "#69f0ae");
      showBuffOffer();
      hud();
    }
    function showBuffOffer() {
      var el = document.getElementById("brbuff");
      el.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:36px">💚</div>' +
        '<div class="wqtitle">Breather!</div>' +
        '<div style="margin:6px 0;color:#5a6b7a">Fully healed. Answer a word to earn a BUFF — wrong never hurts you.</div>' +
        '<button class="submit" id="br_buffq" type="button">📖 Answer for a BUFF</button><br>' +
        '<button class="wqskip" id="br_skip" type="button">skip to next boss →</button></div>';
      el.style.display = "flex";
      document.getElementById("br_buffq").onclick = breatherQuiz;
      document.getElementById("br_skip").onclick = skipBreather;
    }
    function breatherQuiz() {
      if (!breather || over) return;
      paused = true; document.getElementById("brbuff").style.display = "none";
      cv._lastQ = VQ.miniQuiz(document.getElementById("brq"), words, store, {
        title: "📖 Answer for a BUFF!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (!breather) return;
          if (ok) { big("✨ Nice! Pick your BUFF!", "#ffe14d"); showBuffChoices(); }
          else { big("No worries — onward, hero!", "#8ecdf7"); showBuffOffer(); }
        }
      });
    }
    function showBuffChoices() {
      paused = true;
      var el = document.getElementById("brbuff");
      var opts2 = [
        { id: "sword", emoji: "🗡️", t: "Sharper Sword", s: "+1 sword power" },
        { id: "speed", emoji: "💨", t: "Swift Boots", s: "move faster" },
        { id: "heart", emoji: "❤️", t: "Big Heart", s: "+1 max heart" }
      ];
      el.innerHTML = '<div class="wqcard" style="text-align:center"><div class="wqtitle">✨ Pick a BUFF</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px">' +
        opts2.map(function (o) {
          return '<button class="embtn" style="min-width:120px" data-buff="' + o.id + '"><span class="ebl">' + o.emoji + " " + o.t + '</span><span class="ebs">' + o.s + "</span></button>";
        }).join("") + "</div></div>";
      el.style.display = "flex";
      Array.prototype.forEach.call(el.querySelectorAll("[data-buff]"), function (b) { b.onclick = function () { pickBuff(b.dataset.buff); }; });
    }
    function pickBuff(id) {
      if (!breather) return;
      buffs.push(id);
      if (id === "sword") { swordDmg += 1; big("🗡️ Sharper Sword! +1 power", "#ffd23f"); }
      else if (id === "speed") { speedMul += 0.25; big("💨 Swift Boots! Zoom zoom", "#8ecdf7"); }
      else if (id === "heart") { maxHearts += 1; hearts = maxHearts; big("❤️ Bigger heart! Max +1", "#ff6b6b"); }
      if (sfx && sfx.chime) sfx.chime();
      hideBuff(); paused = false; hud();
    }
    function hideBuff() { var el = document.getElementById("brbuff"); if (el) el.style.display = "none"; }
    function skipBreather() { if (!breather) return; advanceBoss(); }
    function advanceBoss() { breather = false; hideBuff(); spawnBoss(nextBossNum); }

    // ---------- sword swing ----------
    function swing() {
      if (over || paused || breather || swingCd > 0) return;
      swingT = 0.28; swingCd = 0.32;
      if (sfx && sfx.whoosh) sfx.whoosh();
      if (boss && !boss.shield) {
        var ax = { N: 0, S: 0, E: 1, W: -1 }[player.dir], ay = { N: -1, S: 1, E: 0, W: 0 }[player.dir];
        var dx = boss.x - player.x, dy = boss.y - player.y, dist = Math.hypot(dx, dy);
        var reach = PR + boss.r + 30;
        var dot = dist > 0 ? (dx * ax + dy * ay) / dist : 1;
        if (dist <= reach && dot > 0.2) hitBoss(swordDmg);
      }
      if (juice) { var fx = { N: 0, S: 0, E: 1, W: -1 }[player.dir], fy = { N: -1, S: 1, E: 0, W: 0 }[player.dir]; juice.burst(X(player.x + fx * 30), Y(player.y + fy * 30), "#e8f0ff", 6); }
    }

    // ---------- taking damage ----------
    function hurt() {
      if (over || breather || player.inv > 0) return;
      hearts -= 1; player.inv = 1.0;
      if (juice) juice.shake(6);
      if (sfx && sfx.buzz) sfx.buzz();
      hud();
      if (hearts <= 0) endRun(false);
    }

    // ---------- boss AI: each schedules its ONE signature attack ----------
    function nextCd() {
      if (bossNum === 6) return boss && boss.phase === 2 ? 1.2 : 1.7;
      return [0, 2.3, 2.0, 2.1, 2.0, 1.9][bossNum];
    }
    function bossAI(dt) {
      var b = boss; if (!b) return;
      b.hit = Math.max(0, b.hit - dt);
      if (!b.shield) { b.shieldT -= dt; if (b.shieldT <= 0) { b.shield = true; big("🛡 THE WORD SHIELD RE-ARMS — tap & answer!", "#ffb3b3"); if (sfx && sfx.buzz) sfx.buzz(); } }
      // KING KABOOM phase change at half health
      if (bossNum === 6 && b.phase < 2 && b.hp <= b.maxHp / 2) { b.phase = 2; b.atkCd = 0.6; big("👑 KING KABOOM POWERS UP — PHASE 2!", "#ffd23f"); if (sfx && sfx.buzz) sfx.buzz(); hud(); }
      // charge (windup → dash) locks movement while it plays
      if (b.mode === "windup") { b.modeT -= dt; if (b.modeT <= 0) { b.mode = "dash"; b.modeT = 0.7; } return; }
      if (b.mode === "dash") { b.modeT -= dt; b.x += b.cvx * dt; b.y += b.cvy * dt; clampBoss(b); if (b.modeT <= 0) { b.mode = "idle"; b.atkCd = nextCd(); } return; }
      // otherwise drift toward a wander point
      b.wt -= dt; if (b.wt <= 0) { b.tx = 90 + Math.random() * (MW - 180); b.ty = 70 + Math.random() * (MH * 0.5); b.wt = 1.3 + Math.random() * 1.1; }
      var dx = b.tx - b.x, dy = b.ty - b.y, dl = Math.hypot(dx, dy) || 1, sp = 44;
      b.x += dx / dl * sp * dt; b.y += dy / dl * sp * dt; clampBoss(b);
      b.atkCd -= dt; if (b.atkCd <= 0) { doAttack(b); b.atkCd = nextCd(); }
    }
    function doAttack(b) {
      b.tick++;
      if (bossNum === 1) startCharge(b);
      else if (bossNum === 2) lobBlob(b);
      else if (bossNum === 3) windWall(b);
      else if (bossNum === 4) frostRing(b);
      else if (bossNum === 5) boltColumn(b);
      else { // KABOOM mixes everything
        if (b.phase === 1) { (b.tick % 2 === 0) ? startCharge(b) : lobBlob(b); }
        else { var pick = b.tick % 3; if (pick === 0) startCharge(b); else if (pick === 1) frostRing(b); else boltColumn(b); }
      }
    }
    function startCharge(b) {
      var dx = player.x - b.x, dy = player.y - b.y, dl = Math.hypot(dx, dy) || 1;
      b.cvx = dx / dl * 360; b.cvy = dy / dl * 360; b.mode = "windup"; b.modeT = 0.65;
      if (sfx && sfx.buzz) sfx.buzz();
    }
    function lobBlob(b) { hazards.push({ type: "blob", x: b.x, y: b.y, sx: b.x, sy: b.y, tx: player.x, ty: player.y, t: 0, dur: 0.9 }); }
    function windWall(b) {
      var horiz = b.tick % 2 === 0, gs = 60 + Math.random() * (MW - 260);
      hazards.push({ type: "wall", horiz: horiz, pos: -20, spd: 250, gs: gs, gw: 150, t: 0, phase: "form" });
      if (sfx && sfx.whoosh) sfx.whoosh();
    }
    function frostRing(b) { hazards.push({ type: "ring", x: b.x, y: b.y, rad: 18, spd: 155, phase: "form", t: 0 }); }
    function boltColumn(b) { hazards.push({ type: "bolt", cx: Math.max(60, Math.min(MW - 60, player.x)), w: 82, phase: "warn", t: 0 }); }

    // ---------- hazard update + contact (all dt-driven, all telegraphed) ----------
    function heroInPuddle() {
      for (var i = 0; i < hazards.length; i++) { var h = hazards[i]; if (h.type === "puddle" && Math.hypot(player.x - h.x, player.y - h.y) < h.r) return true; }
      return false;
    }
    function updateHazards(dt) {
      for (var i = hazards.length - 1; i >= 0; i--) {
        var h = hazards[i];
        if (h.type === "blob") {
          h.t += dt; var f = Math.min(1, h.t / h.dur);
          h.x = h.sx + (h.tx - h.sx) * f; h.y = h.sy + (h.ty - h.sy) * f;
          if (h.t >= h.dur) { hazards[i] = { type: "puddle", x: h.tx, y: h.ty, r: 58, life: 5 }; if (juice) juice.burst(X(h.tx), Y(h.ty), "#7b5cd6", 12); }
        } else if (h.type === "puddle") {
          h.life -= dt; if (h.life <= 0) hazards.splice(i, 1);
        } else if (h.type === "wall") {
          if (h.phase === "form") { h.t += dt; if (h.t >= 0.5) { h.phase = "sweep"; h.pos = 0; } }
          else {
            h.pos += h.spd * dt;
            var pp = h.horiz ? player.y : player.x, gapPos = h.horiz ? player.x : player.y;
            if (Math.abs(pp - h.pos) < 26 && (gapPos < h.gs || gapPos > h.gs + h.gw)) hurt();
            if (h.pos > MW + 30) hazards.splice(i, 1);
          }
        } else if (h.type === "ring") {
          if (h.phase === "form") { h.t += dt; if (h.t >= 0.5) h.phase = "grow"; }
          else {
            h.rad += h.spd * dt;
            if (Math.abs(Math.hypot(player.x - h.x, player.y - h.y) - h.rad) < 24) hurt();
            if (h.rad > 360) hazards.splice(i, 1);
          }
        } else if (h.type === "bolt") {
          h.t += dt;
          if (h.phase === "warn") { if (h.t >= 0.9) { h.phase = "strike"; h.t = 0; if (sfx && sfx.buzz) sfx.buzz(); } }
          else { if (Math.abs(player.x - h.cx) < h.w / 2) hurt(); if (h.t >= 0.35) hazards.splice(i, 1); }
        }
      }
      // charging boss body hurts on contact
      if (boss && boss.mode === "dash" && player.inv <= 0 && Math.hypot(player.x - boss.x, player.y - boss.y) < PR + boss.r) hurt();
    }

    // ---------- hero movement ----------
    function setDir(dx, dy) { if (Math.abs(dx) > Math.abs(dy)) player.dir = dx < 0 ? "W" : "E"; else if (Math.abs(dy) > 0.001) player.dir = dy < 0 ? "N" : "S"; }
    function moveHero(dt) {
      var mvx = moveVec.x, mvy = moveVec.y;
      if (keyHeld.W || keyHeld.ArrowUp) mvy -= 1;
      if (keyHeld.S || keyHeld.ArrowDown) mvy += 1;
      if (keyHeld.A || keyHeld.ArrowLeft) mvx -= 1;
      if (keyHeld.D || keyHeld.ArrowRight) mvx += 1;
      var mag = Math.hypot(mvx, mvy);
      if (mag > 1) { mvx /= mag; mvy /= mag; mag = 1; }
      if (mag > 0.05) {
        setDir(mvx, mvy);
        var slow = heroInPuddle() ? 0.5 : 1;
        var sp = 185 * speedMul * slow;
        player.x = Math.max(PR, Math.min(MW - PR, player.x + mvx * sp * dt));
        player.y = Math.max(PR, Math.min(MH - PR, player.y + mvy * sp * dt));
      }
    }

    // ---------- simulation step ----------
    function step(dt) {
      player.inv = Math.max(0, player.inv - dt);
      swingT = Math.max(0, swingT - dt);
      swingCd = Math.max(0, swingCd - dt);
      if (breather) { breatherT -= dt; moveHero(dt); if (breatherT <= 0) advanceBoss(); return; }
      bossAI(dt);
      updateHazards(dt);
      moveHero(dt);
    }

    // ---------- reward economy (dungeon.js bankRun pattern) ----------
    function runRewards(w) {
      var gems = w ? (40 + beaten * 6) : Math.min(70, 4 + beaten * 9);
      var xp = Math.min(90, (w ? 30 : 6) + beaten * 8);
      var rank = w ? Math.min(12, 5 + beaten) : Math.min(7, 1 + beaten);
      return { win: !!w, score: beaten * 100 + (w ? 200 : 0), rankPtsDelta: rank, xp: xp, gems: gems };
    }
    function bankRun(w) {
      if (banked) return null;
      banked = true;
      var rw = runRewards(w);
      var res = store.recordGame ? store.recordGame("bossrush", rw) : null;
      return { rw: rw, res: res };
    }
    function bankExit() {
      if (!started || over) return;
      var b = bankRun(false);
      if (b && sfx && sfx.toast) sfx.toast("🏰 Boss Rush banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }

    function beatenIcons() { var s = ""; for (var i = 1; i <= beaten && i <= 6; i++) s += BOSSES[i].emoji; return s || "🥇"; }
    function winRun() { won = true; stats.clears = (stats.clears || 0) + 1; store.save(); endRun(true); }
    function endRun(w) {
      if (over) return; over = true; paused = true; won = w; breather = false; hideBuff();
      var bank = bankRun(w) || { rw: runRewards(w), res: null };
      var rw = bank.rw, res = bank.res;
      var card = document.getElementById("brcard");
      var title = w ? "🏆 GAUNTLET CLEARED! You beat all six bosses!" :
        "💫 You reached " + BOSSES[bossNum].emoji + " " + BOSSES[bossNum].name + " — so brave!";
      var payRow = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP</div>";
      card.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:44px">' + (w ? "🏆" : "💫") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + title + "</div>" + payRow +
        '<div style="margin:2px 0">' + beatenIcons() + ' — ' + beaten + " / 6 bosses beaten" + (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        '<div style="display:flex;gap:8px;justify-content:center;margin-top:8px">' +
        '<button class="submit" id="br_replay" type="button">Replay ↻</button>' +
        '<button class="wqskip" id="br_leave" type="button">Leave</button></div></div>';
      card.style.display = "flex";
      if (w && sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(6); for (var i = 0; i < 5; i++) juice.burst(W * (0.2 + i * 0.15), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][i], 16); }
      document.getElementById("br_replay").onclick = showSelect;
      document.getElementById("br_leave").onclick = exit;
      hud();
    }

    // ---------- drawing ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#241d2e"); g.addColorStop(1, "#15101c");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // arena floor
      ctx.fillStyle = "#2c2438"; ctx.fillRect(X(0), Y(0), MW * S, MH * S);
      ctx.strokeStyle = "rgba(255,225,77,.16)"; ctx.lineWidth = 3; ctx.strokeRect(X(0), Y(0), MW * S, MH * S);
      ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 1;
      for (var gi = 1; gi < 8; gi++) { ctx.beginPath(); ctx.moveTo(X(gi * MW / 8), Y(0)); ctx.lineTo(X(gi * MW / 8), Y(MH)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(0), Y(gi * MH / 8)); ctx.lineTo(X(MW), Y(gi * MH / 8)); ctx.stroke(); }
      drawHazards();
      drawBoss();
      drawHero();
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }
    function drawHazards() {
      hazards.forEach(function (h) {
        if (h.type === "blob") {
          ctx.globalAlpha = 0.5; ctx.fillStyle = "#3a2f5c"; ctx.beginPath(); ctx.arc(X(h.tx), Y(h.ty), pz(30), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = "#7b5cd6"; ctx.beginPath(); ctx.arc(X(h.x), Y(h.y) - pz(24), pz(15), 0, Math.PI * 2); ctx.fill();
        } else if (h.type === "puddle") {
          ctx.globalAlpha = Math.min(0.55, h.life / 5 + 0.15); ctx.fillStyle = "#6a4fc0"; ctx.beginPath(); ctx.arc(X(h.x), Y(h.y), pz(h.r), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        } else if (h.type === "wall") {
          var forming = h.phase === "form";
          ctx.fillStyle = forming ? "rgba(99,199,214," + (0.3 + Math.sin(h.t * 20) * 0.25) + ")" : "rgba(99,199,214,.72)";
          var pos = forming ? 4 : h.pos;
          if (h.horiz) { ctx.fillRect(X(0), Y(pos) - pz(24), pz(h.gs), pz(48)); ctx.fillRect(X(h.gs + h.gw), Y(pos) - pz(24), MW * S - pz(h.gs + h.gw), pz(48)); }
          else { ctx.fillRect(X(pos) - pz(24), Y(0), pz(48), pz(h.gs)); ctx.fillRect(X(pos) - pz(24), Y(h.gs + h.gw), pz(48), MW * S - pz(h.gs + h.gw)); }
        } else if (h.type === "ring") {
          var forming2 = h.phase === "form";
          ctx.strokeStyle = forming2 ? "rgba(127,208,255," + (0.3 + Math.sin(h.t * 20) * 0.25) + ")" : "rgba(127,208,255,.8)";
          ctx.lineWidth = pz(forming2 ? 6 : 20); ctx.beginPath(); ctx.arc(X(h.x), Y(h.y), pz(h.rad), 0, Math.PI * 2); ctx.stroke();
        } else if (h.type === "bolt") {
          if (h.phase === "warn") { ctx.fillStyle = "rgba(255,210,63," + (0.14 + Math.sin(h.t * 18) * 0.1) + ")"; ctx.fillRect(X(h.cx - h.w / 2), Y(0), pz(h.w), MH * S); }
          else { ctx.fillStyle = "rgba(255,244,150,.85)"; ctx.fillRect(X(h.cx - h.w / 2), Y(0), pz(h.w), MH * S); }
        }
      });
    }
    function drawBoss() {
      var b = boss; if (!b) return;
      var d = BOSSES[bossNum], sc = pz(b.r * 2.1);
      var wind = b.mode === "windup";
      if (b.hit > 0 || (wind && Math.floor(lastT / 80) % 2 === 0)) { ctx.save(); ctx.globalAlpha = 0.5; }
      ctx.font = Math.round(sc) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(d.emoji, X(b.x), Y(b.y));
      if (b.hit > 0 || wind) ctx.restore();
      // hp bar
      var f = Math.max(0, b.hp / b.maxHp), bw = sc * 0.95;
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(X(b.x) - bw / 2, Y(b.y) - sc * 0.62, bw, 6);
      ctx.fillStyle = "#ff8a8a"; ctx.fillRect(X(b.x) - bw / 2, Y(b.y) - sc * 0.62, bw * f, 6);
      // shield ring + prompt
      if (b.shield) {
        ctx.strokeStyle = "rgba(201,182,255," + (0.5 + Math.sin(lastT / 120) * 0.25) + ")"; ctx.lineWidth = pz(4);
        ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), sc * 0.62, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#c9b6ff"; ctx.font = "bold " + Math.round(pz(15)) + "px Trebuchet MS";
        ctx.fillText("TAP + WORD!", X(b.x), Y(b.y) - sc * 0.78);
      }
    }
    function drawHero() {
      if (swingT > 0) {
        var ax = { N: 0, S: 0, E: 1, W: -1 }[player.dir], ay = { N: -1, S: 1, E: 0, W: 0 }[player.dir];
        var base = Math.atan2(ay, ax), sweep = (1 - swingT / 0.28) * 1.4 - 0.7;
        ctx.strokeStyle = "rgba(230,240,255,.85)"; ctx.lineWidth = pz(6); ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(X(player.x), Y(player.y), pz(PR + 28), base + sweep - 0.5, base + sweep + 0.5); ctx.stroke();
      }
      var blink = player.inv > 0 && Math.floor(player.inv * 12) % 2 === 0;
      if (blink) ctx.globalAlpha = 0.4;
      if (AV && AV.draw) {
        var moving = Math.hypot(moveVec.x + (keyHeld.A ? -1 : 0) + (keyHeld.D ? 1 : 0), moveVec.y + (keyHeld.W ? -1 : 0) + (keyHeld.S ? 1 : 0)) > 0.1;
        AV.draw(ctx, { x: X(player.x), y: Y(player.y) + pz(PR), size: pz(PR * 3), config: cfg, pose: swingT > 0 ? "swing" : (moving ? "run" : "idle"), frame: player.phase, flip: player.dir === "W", name: "" });
      } else { ctx.fillStyle = "#40c4ff"; ctx.beginPath(); ctx.arc(X(player.x), Y(player.y), pz(PR), 0, Math.PI * 2); ctx.fill(); }
      if (blink) ctx.globalAlpha = 1;
    }

    // ---------- input (phantom-tap safe) ----------
    var touchStart = null, touchTime = 0, dragging = false;
    function screenToLogical(sx, sy) { return { x: (sx - OX) / S, y: (sy - OY) / S }; }
    function tapAt(sx, sy) {
      if (boss && boss.shield) { var lg = screenToLogical(sx, sy); if (Math.hypot(lg.x - boss.x, lg.y - boss.y) < boss.r + 26) { duel(); return; } }
      swing();
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var r = cv.getBoundingClientRect(), tch = e.changedTouches[0]; touchStart = { x: tch.clientX - r.left, y: tch.clientY - r.top }; touchTime = performance.now(); dragging = false; }, { passive: false });
    cv.addEventListener("touchmove", function (e) {
      if (!touchStart) return; e.preventDefault();
      var r = cv.getBoundingClientRect(), tch = e.changedTouches[0];
      var dx = (tch.clientX - r.left) - touchStart.x, dy = (tch.clientY - r.top) - touchStart.y;
      if (Math.hypot(dx, dy) > 10) dragging = true;
      if (dragging) { var mag = Math.hypot(dx, dy) || 1, cl = Math.min(1, mag / 60); moveVec.x = dx / mag * cl; moveVec.y = dy / mag * cl; }
    }, { passive: false });
    function endTouch(e) {
      if (!touchStart) return; e.preventDefault();
      var quick = performance.now() - touchTime < 150;
      if (!dragging && quick) tapAt(touchStart.x, touchStart.y);
      touchStart = null; dragging = false; moveVec.x = 0; moveVec.y = 0;
    }
    cv.addEventListener("touchend", endTouch, { passive: false });
    cv.addEventListener("touchcancel", endTouch, { passive: false });
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); tapAt(e.clientX - r.left, e.clientY - r.top); });
    // ⚔ sword button — a discrete tap (touchstart preventDefault suppresses the iOS phantom mouse tap)
    (function () {
      var sb = document.getElementById("brswing");
      function sw(e) { e.preventDefault(); swing(); }
      sb.addEventListener("touchstart", sw, { passive: false });
      sb.addEventListener("mousedown", sw);
    })();
    function onKeyDown(e) {
      var k = e.key;
      if (k === " " || k === "Spacebar") { e.preventDefault(); swing(); return; }
      if (k === "e" || k === "E") { duel(); return; }
      if (k === "w" || k === "W" || k === "ArrowUp") keyHeld.W = keyHeld.ArrowUp = true;
      else if (k === "s" || k === "S" || k === "ArrowDown") keyHeld.S = keyHeld.ArrowDown = true;
      else if (k === "a" || k === "A" || k === "ArrowLeft") keyHeld.A = keyHeld.ArrowLeft = true;
      else if (k === "d" || k === "D" || k === "ArrowRight") keyHeld.D = keyHeld.ArrowRight = true;
      else return;
      e.preventDefault();
    }
    function onKeyUp(e) {
      var k = e.key;
      if (k === "w" || k === "W" || k === "ArrowUp") keyHeld.W = keyHeld.ArrowUp = false;
      else if (k === "s" || k === "S" || k === "ArrowDown") keyHeld.S = keyHeld.ArrowDown = false;
      else if (k === "a" || k === "A" || k === "ArrowLeft") keyHeld.A = keyHeld.ArrowLeft = false;
      else if (k === "d" || k === "D" || k === "ArrowRight") keyHeld.D = keyHeld.ArrowRight = false;
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      player.phase = (player.phase || 0) + dt;
      if (!paused && !over && started) step(dt);
      draw();
    }

    // ---------- exit / cleanup ----------
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API ----------
    cv._bossrush = {
      state: function () {
        return {
          bossNum: bossNum, bossHp: boss ? boss.hp : 0, bossMaxHp: boss ? boss.maxHp : 0,
          shield: boss ? !!boss.shield : false, hearts: hearts, maxHearts: maxHearts,
          over: over, won: won, banked: banked, buffs: buffs.slice(), breather: breather
        };
      },
      begin: begin,
      move: function (dx, dy) { moveVec.x = dx; moveVec.y = dy; },
      swing: function () { swingCd = 0; swing(); },
      duel: duel,
      breatherQuiz: breatherQuiz,
      pickBuff: pickBuff,
      damageBoss: damageBoss,
      hurt: function () { player.inv = 0; hurt(); },
      skipBreather: skipBreather,
      boss: function () { return boss; },
      player: function () { return { x: player.x, y: player.y, dir: player.dir }; }
    };

    hud();
    showSelect();
    if (global._bossrushdemo) setTimeout(function () { // test hook: GUSTO mid-fight, walls up, shield down
      global._bossrushdemo = 0;
      begin(3);
      player.x = MW / 2; player.y = MH / 2;
      if (boss) { boss.shield = false; boss.shieldT = 10; }
      hazards.push({ type: "wall", horiz: true, pos: 180, spd: 0, gs: 200, gw: 150, t: 1, phase: "sweep" });
      hazards.push({ type: "wall", horiz: true, pos: 360, spd: 0, gs: 110, gw: 150, t: 1, phase: "sweep" });
      paused = true;
    }, 700);
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxBossRush = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
