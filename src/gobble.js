/*
 * Voblox arcade game — 🟢 GOBBLE BLOB (a kid-kind agar.io-style eat-and-grow arena).
 * You are a cute colored blob in a round arena. Steer by holding/dragging on the
 * canvas; drift toward the touch point. Eat food pellets to grow slowly, and
 * gobble RIVAL blobs (real names from VobloxBots) that are at least 25% smaller —
 * but rivals 25%+ bigger gobble YOU. Getting gobbled is never game over: you pop
 * back small and only lose 30% of your run score. Speed scales down as you grow;
 * the camera zooms OUT so bigger = more map. 3-minute round (dt-accumulated), and
 * the biggest blob at the buzzer wins the 👑 crown.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🫧 POWER PELLETS: a rainbow pellet opens a word (miniQuiz). Correct = pick
 *     ⚡ SURGE (speed burst that ignores the size penalty) or 💪 BULK (+15% mass).
 *     Wrong loses nothing — the bubble just pops.
 *   - 💖 REVIVE: after being gobbled, a word bounces you back at 60% of your lost
 *     mass instead of pellet size (once per round).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("gobble")
 * per round, banked on round-end, quit, AND app-close. bestMass/crowns persist.
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  var ARENA_R = 1400;        // world radius
  var START_MASS = 22;       // your starting mass
  var RESPAWN_MASS = 16;     // pellet-ish respawn after a gobble
  var PELLET_MASS = 1.1;     // one food pellet
  var PELLET_COUNT = 250;    // max food on the field (respawns as eaten)
  var POWER_COUNT = 4;       // 🫧 rainbow power pellets floating around
  var ROUND_LEN = 180;       // 3 minutes, accumulated from dt
  var BOT_COUNT = 9;         // AI rivals (8-10)
  var BASE_SPEED = 300;      // world units / second at reference size
  var SURGE_TIME = 4;        // seconds of surge burst
  var SURGE_FACTOR = 1.55;   // speed factor while surging (ignores size)
  var BOT_PALETTE = ["#ff6b6b", "#ffd23f", "#6bd968", "#4fc3f7", "#b06aff",
                     "#ff9f43", "#f77fbe", "#5fd7c9", "#9be15d", "#ff8a5c"];
  var FOOD_COLORS = ["#ff6b6b", "#ffd23f", "#6bd968", "#4fc3f7", "#b06aff", "#ff9f43", "#5fd7c9"];

  function rOf(m) { return 6 + Math.sqrt(m) * 3.2; }
  var REF_R = rOf(START_MASS);

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("gobble");
    // additive, never-renamed persistence
    stats.bestMass = stats.bestMass || 0;
    stats.crowns = stats.crowns || 0;

    var skill = P.botSkillFor(stats.rankPts || 0);
    var playerName = (store.state && store.state.profile && store.state.profile.name) || "You";

    var wrap = document.createElement("div");
    wrap.className = "gamewrap gobble";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="gbcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="gbmsg">🟢 Gobble Blob — hold to steer, eat &amp; grow!</div>' +
      '<div class="grow"><span id="gbmass">🟢 0</span><span id="gbtime">3:00</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="gbbig"></div>' +
      '<div class="gover" id="gbq" style="display:none"></div>' +
      '<div class="gover" id="gbpick" style="display:none"></div>' +
      '<div class="gover" id="gbcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#gbcv"), ctx = cv.getContext("2d");
    var msgEl = wrap.querySelector("#gbmsg"), bigEl = wrap.querySelector("#gbbig");
    var qEl = wrap.querySelector("#gbq"), pickEl = wrap.querySelector("#gbpick"), cardEl = wrap.querySelector("#gbcard");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H;
    function resize() { W = cv.width = wrap.clientWidth || global.innerWidth || 360; H = cv.height = wrap.clientHeight || global.innerHeight || 640; }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var pellets = [], powers = [], bots = [];
    var self = { x: 0, y: 0, mass: START_MASS, color: "#4fc3f7", name: playerName, isPlayer: true, chatText: "", chatAge: 9 };
    var aimX = 0, aimY = 0, hold = false;
    var roundT = 0, peakScore = START_MASS, surgeT = 0;
    var over = false, won = false, paused = false, banked = false, revived = false;
    var pickOpen = false, lastFmt = null;
    var zoom = 0.3, camX = 0, camY = 0; // updated every draw; pointer maps through them

    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1200); }
    function fmtTime(s) { s = Math.max(0, Math.ceil(s)); var m = Math.floor(s / 60), ss = s % 60; return m + ":" + (ss < 10 ? "0" : "") + ss; }
    function hud() {
      document.getElementById("gbmass").textContent = "🟢 " + Math.round(self.mass) + (surgeT > 0 ? " ⚡" : "");
      document.getElementById("gbtime").textContent = fmtTime(ROUND_LEN - roundT);
    }
    function updatePeak() { if (self.mass > peakScore) peakScore = self.mass; }

    // ---------- world helpers ----------
    function randInArena(pad) {
      var a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (ARENA_R - (pad || 20));
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }
    function clampArena(b) {
      var d = Math.sqrt(b.x * b.x + b.y * b.y), lim = ARENA_R - rOf(b.mass) * 0.5;
      if (d > lim && d > 0) { b.x = b.x / d * lim; b.y = b.y / d * lim; }
    }
    function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
    function speedFactor() {
      if (surgeT > 0) return SURGE_FACTOR;
      return Math.max(0.32, Math.min(1.5, REF_R / rOf(self.mass)));
    }

    function makeBot(def, x, y, mass, idx) {
      return {
        id: def.id, name: def.name, skill: def.skill, avatar: def.avatar, chat: def.chat,
        color: BOT_PALETTE[idx % BOT_PALETTE.length], x: x, y: y, mass: mass,
        tx: x, ty: y, retargetT: 0, chatText: "", chatAge: 9, isPlayer: false
      };
    }
    function respawnBot(b) { var p = randInArena(30); b.x = p.x; b.y = p.y; b.mass = 14 + Math.random() * 12; b.tx = b.x; b.ty = b.y; b.retargetT = 0; }
    function respawnPlayer(m) { var p = randInArena(30); self.x = p.x; self.y = p.y; self.mass = m; hold = false; }
    function newPellet() { var p = randInArena(10); return { x: p.x, y: p.y, m: PELLET_MASS, color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)] }; }
    function newPower() { var p = randInArena(60); return { x: p.x, y: p.y, m: 4, ph: Math.random() * 6 }; }

    // ---------- lifecycle ----------
    function begin() {
      roundT = 0; surgeT = 0; peakScore = START_MASS;
      over = false; won = false; paused = false; banked = false; revived = false; pickOpen = false;
      self.mass = START_MASS; self.x = 0; self.y = 0; hold = false; aimX = 0; aimY = 0;
      pellets = []; for (var i = 0; i < PELLET_COUNT; i++) pellets.push(newPellet());
      powers = []; for (var j = 0; j < POWER_COUNT; j++) powers.push(newPower());
      // real rivals with names Leo recognizes, skill scaled to his rank
      bots = [];
      var defs = (Bots && Bots.pickOpponents) ? Bots.pickOpponents(BOT_COUNT, skill) : [];
      for (var k = 0; k < BOT_COUNT; k++) {
        var def = defs[k] || { id: "bot" + k, name: "Rival" + k, skill: skill, avatar: {}, chat: {} };
        var pos = randInArena(40);
        bots.push(makeBot(def, pos.x, pos.y, START_MASS * (0.6 + Math.random() * 1.4), k));
      }
      cardEl.style.display = "none"; qEl.style.display = "none"; pickEl.style.display = "none";
      hud();
      big("🟢 GO! Eat &amp; grow!", "#9be15d");
    }

    // ---------- economy: ONE bank path, guarded, always SHOWN ----------
    function rewards(w) {
      var s = Math.round(peakScore);
      return {
        win: !!w, score: s,
        rankPtsDelta: w ? Math.min(14, 6 + Math.floor(s / 60)) : Math.min(6, 1 + Math.floor(s / 70)),
        xp: Math.min(80, 8 + Math.floor(s / 8)),
        gems: (w ? 15 : 0) + 3 + Math.floor(s / 20)
      };
    }
    function persistBest() {
      if (peakScore > (stats.bestMass || 0)) stats.bestMass = Math.round(peakScore);
      if (store.save) store.save();
    }
    function bankRun(w) {
      if (banked) return null;
      banked = true;
      persistBest();
      var rw = rewards(w);
      var res = store.recordGame ? store.recordGame("gobble", rw) : null;
      return { rw: rw, res: res };
    }

    function playerRank() { var r = 1; for (var i = 0; i < bots.length; i++) if (bots[i].mass > self.mass) r++; return r; }

    function endRound(w) {
      if (over) return;
      over = true; paused = true; won = w;
      var bank = bankRun(w) || { rw: rewards(w), res: null };
      if (w) { stats.crowns = (stats.crowns || 0) + 1; if (store.save) store.save(); }
      showCard(bank.rw, bank.res, playerRank());
      if (w && sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(6); for (var c = 0; c < 5; c++) juice.burst(W * (0.2 + c * 0.15), H * 0.35, BOT_PALETTE[c], 16); }
    }
    function showCard(rw, res, rank) {
      var title = won ? "👑 CROWNED! You were the biggest blob!" :
        rank <= 3 ? "🥈 So close! You finished #" + rank : "Round over — you finished #" + rank;
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (won ? "👑" : "🟢") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + title + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🏁 Final rank <b>#' + rank + '</b> · 📈 Peak mass <b>' + Math.round(peakScore) + '</b></div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🏆 Best mass ' + (stats.bestMass || 0) + ' · 👑 ' + (stats.crowns || 0) + ' crowns' + (res && res.rankedUp ? ' · 🎖 RANK UP!' : '') + '</div>' +
        '<button class="submit big-next" id="gb_again" type="button">Play Again ➜</button>' +
        '<button class="wqskip" id="gb_leave" type="button">Leave</button></div>';
      cardEl.style.display = "flex";
      document.getElementById("gb_again").onclick = function () { cardEl.style.display = "none"; begin(); };
      document.getElementById("gb_leave").onclick = exit;
    }

    // ---------- the gobble (kid-kind) ----------
    function playerGobbled(byMass) {
      if (over) return;
      var lost = self.mass;
      peakScore = peakScore * 0.7; // lose 30% of the run score
      if (juice) { juice.shake(11); juice.burst(W / 2, H / 2, "#ff8a8a", 22); }
      if (sfx && sfx.buzz) sfx.buzz();
      if (!revived) {
        revived = true; // the revive WORD is a once-per-round chance
        paused = true;
        cv._lastQ = VQ.miniQuiz(qEl, words, store, {
          title: "💖 GOBBLED! Answer a word to bounce back BIGGER!",
          lastFormat: lastFmt,
          cb: function (ok, res, fmt) {
            lastFmt = fmt; paused = false;
            if (ok) { respawnPlayer(lost * 0.6); big("💖 REVIVED at 60% mass!", "#69f0ae"); if (sfx && sfx.fanfare) sfx.fanfare(); }
            else { respawnPlayer(RESPAWN_MASS); big("Popped back small — grow again!", "#ffd740"); }
            hud();
          }
        });
      } else {
        respawnPlayer(RESPAWN_MASS);
        big("😵 Gobbled! Respawned small — keep going!", "#ff8a8a");
        hud();
      }
    }

    // ---------- power pellets → word → SURGE / BULK ----------
    function powerQuiz() {
      if (over || paused) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "🫧 POWER PELLET! Answer to charge up!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) { openPicker(); } // stays paused until a choice is made
          else { paused = false; big("The bubble popped — no charge.", "#ffd740"); }
        }
      });
    }
    function openPicker() {
      pickOpen = true;
      pickEl.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:40px">🫧</div><div class="wqtitle" style="font-size:19px">Correct! Choose your power:</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px">' +
        '<button class="embtn mode" id="gb_surge" style="min-width:130px"><span class="ebl">⚡ SURGE</span><span class="ebs">speed burst, ignores size</span></button>' +
        '<button class="embtn study" id="gb_bulk" style="min-width:130px"><span class="ebl">💪 BULK</span><span class="ebs">+15% mass right now</span></button>' +
        '</div></div>';
      pickEl.style.display = "flex";
      document.getElementById("gb_surge").onclick = function () { choose("surge"); };
      document.getElementById("gb_bulk").onclick = function () { choose("bulk"); };
    }
    function choose(which) {
      if (!pickOpen) return;
      pickOpen = false;
      pickEl.style.display = "none"; pickEl.innerHTML = "";
      paused = false;
      if (which === "bulk") { self.mass *= 1.15; updatePeak(); big("💪 BULK! +15% mass!", "#69f0ae"); }
      else { surgeT = SURGE_TIME; big("⚡ SURGE! Speed burst!", "#ffd23f"); }
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) juice.burst(W / 2, H / 2, which === "bulk" ? "#69f0ae" : "#ffd23f", 20);
      hud();
    }

    // ---------- eating ----------
    function eatBot(bigb, smallb) {
      bigb.mass += smallb.mass * 0.8;
      if (juice) juice.burst(W / 2 + (smallb.x - self.x) * zoom, H / 2 + (smallb.y - self.y) * zoom, smallb.color || "#fff", 12);
      respawnBot(smallb);
      if (bigb === self) { updatePeak(); if (sfx && sfx.pop) sfx.pop(); }
    }
    function resolveEats() {
      var rS = rOf(self.mass), i, j;
      // player <-> bots
      for (i = 0; i < bots.length; i++) {
        var b = bots[i], rB = rOf(b.mass), d = dist(self, b);
        if (self.mass >= b.mass * 1.25 && d < rS - rB * 0.4) { eatBot(self, b); rS = rOf(self.mass); }
        else if (b.mass >= self.mass * 1.25 && d < rB - rS * 0.4 && !over) { playerGobbled(b.mass); return; }
      }
      // bot <-> bot
      for (i = 0; i < bots.length; i++) for (j = i + 1; j < bots.length; j++) {
        var a = bots[i], c = bots[j];
        if (!a || !c) continue;
        var rA = rOf(a.mass), rC = rOf(c.mass), dd = dist(a, c);
        if (a.mass >= c.mass * 1.25 && dd < rA - rC * 0.4) eatBot(a, c);
        else if (c.mass >= a.mass * 1.25 && dd < rC - rA * 0.4) eatBot(c, a);
      }
      // food pellets
      for (i = 0; i < pellets.length; i++) {
        var pl = pellets[i], eaten = false;
        if (!over && dist(self, pl) < rS) { self.mass += pl.m; updatePeak(); eaten = true; }
        else for (j = 0; j < bots.length && !eaten; j++) { if (dist(bots[j], pl) < rOf(bots[j].mass)) { bots[j].mass += pl.m; eaten = true; } }
        if (eaten) pellets[i] = newPellet();
      }
      // power pellets (player only — bots just covet them)
      for (i = 0; i < powers.length; i++) {
        if (!over && !paused && dist(self, powers[i]) < rS) {
          powers[i] = newPower();
          powerQuiz();
          break;
        }
      }
    }

    // ---------- AI ----------
    function nearestPellet(b) {
      var best = null, bd = 1e9;
      for (var i = 0; i < pellets.length; i++) { var d = dist(b, pellets[i]); if (d < bd) { bd = d; best = pellets[i]; } }
      return best;
    }
    function botThink(b, dt) {
      b.retargetT -= dt;
      if (b.retargetT > 0) return;
      b.retargetT = 0.6 - b.skill * 0.35; // sharper bots react faster
      var rB = rOf(b.mass), i;
      var blobs = bots; // consider rivals + player
      var threat = null, td = 1e9, prey = null, pd = 1e9;
      var others = [self];
      for (i = 0; i < blobs.length; i++) if (blobs[i] !== b) others.push(blobs[i]);
      for (i = 0; i < others.length; i++) {
        var o = others[i], d = dist(b, o);
        if (o.mass >= b.mass * 1.2 && d < 300 + rB * 4 && d < td) { td = d; threat = o; }
        else if (b.mass >= o.mass * 1.25 && d < 260 + rB * 6 && d < pd) { pd = d; prey = o; }
      }
      if (threat) { // flee (away from the danger)
        var ax = b.x - threat.x, ay = b.y - threat.y, al = Math.sqrt(ax * ax + ay * ay) || 1;
        b.tx = b.x + ax / al * 400; b.ty = b.y + ay / al * 400;
      } else if (prey && Math.random() < 0.4 + b.skill * 0.6) { // chase
        b.tx = prey.x; b.ty = prey.y;
      } else if (Math.random() < 0.25 && powers.length) { // hover near a power pellet
        var pw = powers[Math.floor(Math.random() * powers.length)];
        b.tx = pw.x + (Math.random() - 0.5) * 120; b.ty = pw.y + (Math.random() - 0.5) * 120;
      } else { // graze
        var np = nearestPellet(b);
        if (np) { b.tx = np.x; b.ty = np.y; } else { var rp = randInArena(30); b.tx = rp.x; b.ty = rp.y; }
      }
      if (Math.random() < 0.02 && Bots) { b.chatText = Bots.say(b, Math.random() < 0.5 ? "nice" : "hi"); b.chatAge = 0; }
    }
    function moveToward(b, factor, dt) {
      var sp = BASE_SPEED * factor;
      var dx = b.tx - b.x, dy = b.ty - b.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) { var v = Math.min(sp * dt, d); b.x += dx / d * v; b.y += dy / d * v; }
      clampArena(b);
    }

    // ---------- simulation ----------
    function step(dt) {
      roundT += dt;
      if (surgeT > 0) surgeT = Math.max(0, surgeT - dt);
      // steer the player toward the held aim point
      if (hold) { var dx = aimX - self.x, dy = aimY - self.y, d = Math.sqrt(dx * dx + dy * dy); if (d > 1) { var v = Math.min(BASE_SPEED * speedFactor() * dt, d); self.x += dx / d * v; self.y += dy / d * v; } }
      clampArena(self);
      // rivals think + move (their speed also scales inversely with size)
      for (var i = 0; i < bots.length; i++) {
        var b = bots[i];
        botThink(b, dt);
        var bf = Math.max(0.32, Math.min(1.4, REF_R / rOf(b.mass)));
        moveToward(b, bf, dt);
        b.chatAge += dt;
      }
      // power pellets bob a little
      for (var pw = 0; pw < powers.length; pw++) powers[pw].ph += dt;
      resolveEats();
      updatePeak();
      if (juice) juice.update(dt);
      hud();
      if (roundT >= ROUND_LEN && !over) endRound(playerRank() === 1);
    }

    // ---------- drawing ----------
    function w2sx(x) { return W / 2 + (x - camX) * zoom; }
    function w2sy(y) { return H / 2 + (y - camY) * zoom; }
    function drawBlob(b, isSelf) {
      var sx = w2sx(b.x), sy = w2sy(b.y), r = rOf(b.mass) * zoom;
      if (sx < -r - 40 || sx > W + r + 40 || sy < -r - 40 || sy > H + r + 40) return;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = b.color; ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.stroke();
      if (isSelf && surgeT > 0) { ctx.strokeStyle = "rgba(255,210,63," + (0.5 + Math.sin(roundT * 14) * 0.4) + ")"; ctx.lineWidth = Math.max(2, r * 0.16); ctx.beginPath(); ctx.arc(sx, sy, r + 4, 0, Math.PI * 2); ctx.stroke(); }
      // cute face
      var er = Math.max(1.5, r * 0.16), eo = r * 0.34;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx - eo, sy - r * 0.12, er, 0, Math.PI * 2); ctx.arc(sx + eo, sy - r * 0.12, er, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#20303a"; ctx.beginPath(); ctx.arc(sx - eo, sy - r * 0.12, er * 0.5, 0, Math.PI * 2); ctx.arc(sx + eo, sy - r * 0.12, er * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#20303a"; ctx.lineWidth = Math.max(1.2, r * 0.06); ctx.beginPath(); ctx.arc(sx, sy + r * 0.12, r * 0.34, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      // name tag
      if (r > 8) { ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.font = "bold " + Math.max(10, Math.min(20, r * 0.4)) + "px Trebuchet MS, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 3; ctx.strokeText(b.name, sx, sy - r - 8); ctx.fillText(b.name, sx, sy - r - 8); }
      if (b.chatAge < 2.4 && Bots && Bots.bubble) Bots.bubble(ctx, { x: sx, y: sy - r - 22, text: b.chatText, age: b.chatAge });
    }
    function draw() {
      // camera: follow the player; zoom OUT as you grow (bigger = more map)
      camX = self.x; camY = self.y;
      var view = 340 + rOf(self.mass) * 4;
      zoom = (Math.min(W, H) * 0.5) / view;
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0f2233"); g.addColorStop(1, "#08131f");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // arena disc
      ctx.beginPath(); ctx.arc(w2sx(0), w2sy(0), ARENA_R * zoom, 0, Math.PI * 2);
      ctx.fillStyle = "#12324a"; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(120,200,255,.35)"; ctx.stroke();
      // food pellets (culled to the viewport)
      for (var i = 0; i < pellets.length; i++) {
        var pl = pellets[i], px = w2sx(pl.x), py = w2sy(pl.y);
        if (px < -6 || px > W + 6 || py < -6 || py > H + 6) continue;
        ctx.beginPath(); ctx.arc(px, py, Math.max(2, rOf(pl.m) * zoom), 0, Math.PI * 2); ctx.fillStyle = pl.color; ctx.fill();
      }
      // 🫧 power pellets (rainbow, pulsing)
      for (var q = 0; q < powers.length; q++) {
        var pw = powers[q], wx = w2sx(pw.x), wy = w2sy(pw.y), pr = (rOf(pw.m) + 4) * zoom * (1 + Math.sin(pw.ph * 3) * 0.12);
        if (wx < -20 || wx > W + 20 || wy < -20 || wy > H + 20) continue;
        var rg = ctx.createLinearGradient(wx - pr, wy - pr, wx + pr, wy + pr);
        rg.addColorStop(0, "#ff6b6b"); rg.addColorStop(0.5, "#ffd23f"); rg.addColorStop(1, "#4fc3f7");
        ctx.beginPath(); ctx.arc(wx, wy, Math.max(5, pr), 0, Math.PI * 2); ctx.fillStyle = rg; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = Math.max(9, pr) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🫧", wx, wy);
      }
      // rivals, then you on top
      for (var b2 = 0; b2 < bots.length; b2++) drawBlob(bots[b2], false);
      drawBlob(self, true);
      if (juice) juice.draw(ctx);
      drawLeaderboard();
    }
    function drawLeaderboard() {
      var all = bots.slice(); all.push(self);
      all.sort(function (a, b) { return b.mass - a.mass; });
      var top = all.slice(0, 5);
      // sit BELOW the HUD row (which wraps taller on narrow screens) so the Leave button is never covered
      var lx = W - 168, ly = Math.min(W, H) < 520 ? 124 : 96, lw = 156, lh = 20 + top.length * 20;
      ctx.fillStyle = "rgba(8,18,28,.62)"; ctx.fillRect(lx, ly, lw, lh);
      ctx.fillStyle = "#ffd23f"; ctx.font = "bold 13px Trebuchet MS, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("🏆 Leaderboard", lx + 8, ly + 12);
      for (var i = 0; i < top.length; i++) {
        var b = top[i], me = b.isPlayer;
        ctx.fillStyle = me ? "#9be15d" : "#dfeaf2"; ctx.font = (me ? "bold " : "") + "12px Trebuchet MS, sans-serif";
        ctx.fillText((i + 1) + ". " + b.name, lx + 8, ly + 30 + i * 20);
        ctx.textAlign = "right"; ctx.fillText(String(Math.round(b.mass)), lx + lw - 8, ly + 30 + i * 20); ctx.textAlign = "left";
      }
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) step(dt);
      draw();
    }

    // ---------- input (phantom-tap safe: hold/move steering) ----------
    function pointWorld(px, py) { return { x: camX + (px - W / 2) / zoom, y: camY + (py - H / 2) / zoom }; }
    function setAim(px, py) { var w = pointWorld(px, py); aimX = w.x; aimY = w.y; hold = true; }
    function pt(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    cv.addEventListener("mousedown", function (e) { if (paused || over) return; var p = pt(e); setAim(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { if (!hold || paused || over) return; var p = pt(e); setAim(p.x, p.y); });
    cv.addEventListener("mouseup", function () { hold = false; });
    cv.addEventListener("mouseleave", function () { hold = false; });
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); if (paused || over) return; var p = pt(e, e.changedTouches[0]); setAim(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); if (paused || over) return; var p = pt(e, e.changedTouches[0]); setAim(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); hold = false; }, { passive: false });
    // optional keyboard steering
    var keys = {};
    function onKeyDown(e) { keys[e.key] = 1; applyKeys(); }
    function onKeyUp(e) { keys[e.key] = 0; applyKeys(); }
    function applyKeys() {
      var dx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
      var dy = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
      if (dx || dy) { aimX = self.x + dx * 600; aimY = self.y + dy * 600; hold = true; } else if (!keys._mouse) hold = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ---------- exit / banking ----------
    function bankExit() {
      if (over || banked) return; // round-over already banked
      var bank = bankRun(false);
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🟢 Gobble run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (VQ && VQ.shush) VQ.shush();
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._gobble = {
      state: function () {
        return {
          t: roundT, mass: self.mass, peak: peakScore, rank: playerRank(),
          alivebots: bots.length, over: over, won: won, banked: banked,
          revived: revived, roundLen: ROUND_LEN, speed: speedFactor()
        };
      },
      begin: begin,
      steer: function (dx, dy) {
        if (!dx && !dy) { hold = false; return; }
        aimX = self.x + dx * 1000; aimY = self.y + dy * 1000; hold = true;
      },
      feed: function (m) { self.mass += m; updatePeak(); hud(); },
      spawnRival: function (mass, dist) {
        var a = Math.random() * Math.PI * 2, d = dist || 200;
        var def = (Bots && Bots.pickOpponents) ? Bots.pickOpponents(1, skill)[0] : { id: "r", name: "Rival", skill: skill, avatar: {}, chat: {} };
        var b = makeBot(def, self.x + Math.cos(a) * d, self.y + Math.sin(a) * d, mass, bots.length);
        bots.push(b); return b;
      },
      eatNearest: function () {
        var best = null, bd = 1e9;
        for (var i = 0; i < bots.length; i++) { if (self.mass >= bots[i].mass * 1.25) { var d = dist(self, bots[i]); if (d < bd) { bd = d; best = bots[i]; } } }
        if (best) { eatBot(self, best); return true; }
        return false;
      },
      powerQuiz: powerQuiz,
      choose: choose,
      gobbleMe: function () { playerGobbled(self.mass * 2); },
      warp: function (t) { roundT = t; hud(); }
    };

    // ---------- boot ----------
    begin();
    if (global._gobbledemo) { // screenshot seed: a lively mid-round tableau, frozen
      global._gobbledemo = 0;
      self.mass = 120; peakScore = 160;
      // rivals of mixed sizes crowding the player
      var seedM = [60, 210, 95, 320, 40, 150, 75, 260, 30];
      for (var s = 0; s < bots.length; s++) {
        var ang = (s / bots.length) * Math.PI * 2, rad = 150 + (s % 3) * 90;
        bots[s].x = self.x + Math.cos(ang) * rad; bots[s].y = self.y + Math.sin(ang) * rad;
        bots[s].mass = seedM[s % seedM.length];
        if (s % 4 === 0 && Bots) { bots[s].chatText = Bots.say(bots[s], "nice"); bots[s].chatAge = 0.3; }
      }
      powers[0].x = self.x + 120; powers[0].y = self.y - 90; // a rainbow pellet on screen
      paused = true; // freeze for the screenshot
      hud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxGobble = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
