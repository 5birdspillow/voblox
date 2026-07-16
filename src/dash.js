/*
 * Voblox arcade game — ⚡ Word Dash (a Geometry-Dash-style one-tap auto-runner).
 * Your blocky avatar sprints right forever; you TAP to jump (tap again = double
 * jump). Spikes, gaps, saw blocks and block-steps stand in the way. Death is
 * instant and respawn is FAST — the "one more try" loop is the whole point.
 * VOCAB IS THE CHECKPOINT:
 *   - Each level has WORD GATES. Reach one → the run pauses and a miniQuiz opens.
 *   - Right answer: the gate becomes your CHECKPOINT (respawn here) + a 🛡 shield
 *     that eats one death. Wrong: gate stays cold, respawn stays further back.
 * 5 handcrafted levels ramp up; level 6 is ENDLESS (procedural, tracks bestDist).
 * recordGame("dash") once per run; rewards are SHOWN and banked even on quit.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar;

  // ONE logical world height; everything scales uniformly (letterbox) to fit.
  var WORLD_H = 320, FLOOR_Y = 250, TILE = 46;          // floor line + tile unit
  var RUN_SPEED = 190;                                   // logical px/s to the right
  var GRAV = 1750, JUMP_V = -640;                        // tuned: a jump clears ~2 tiles
  var RUNNER_W = 30, RUNNER_H = 40;

  // ---------- level design ----------
  // A level is a list of obstacle segments laid out along X (logical world px).
  // Types: spike (die on touch), gap (fall = die), block (land on top OK, side = die),
  //        saw (slow-bobbing blade, die on touch). Two gates sit at fixed X.
  // Every level ends with a finish line; length ~ 60-90s at RUN_SPEED.
  function levelData(n) {
    var obs = [], gates = [], x = 700; // a calm runway before the first hazard
    function spike(px, count) { for (var i = 0; i < (count || 1); i++) obs.push({ t: "spike", x: px + i * TILE }); }
    function gap(px, w) { obs.push({ t: "gap", x: px, w: w }); }
    function block(px, h, w) { obs.push({ t: "block", x: px, h: h, w: w || TILE }); }
    function saw(px) { obs.push({ t: "saw", x: px, phase: Math.random() * 6 }); }
    // difficulty knobs per level
    var cfg = [
      { spikes: 5, gaps: 3, blocks: 3, saws: 0, len: 6500 },   // 1: gentle intro
      { spikes: 8, gaps: 4, blocks: 5, saws: 1, len: 8000 },   // 2: doubles + first saw
      { spikes: 10, gaps: 5, blocks: 7, saws: 3, len: 10000 }, // 3
      { spikes: 13, gaps: 6, blocks: 9, saws: 5, len: 12000 }, // 4
      { spikes: 16, gaps: 8, blocks: 12, saws: 7, len: 14500 } // 5: the gauntlet
    ][n - 1];
    // scatter hazards across the level with breathing room between them
    var span = cfg.len, cursor = x, R = Math.random;
    var events = [];
    for (var s = 0; s < cfg.spikes; s++) events.push({ k: "spike", n: 1 + Math.floor(R() * Math.min(3, 1 + n)) });
    for (var g = 0; g < cfg.gaps; g++) events.push({ k: "gap" });
    for (var b = 0; b < cfg.blocks; b++) events.push({ k: "block" });
    for (var sw = 0; sw < cfg.saws; sw++) events.push({ k: "saw" });
    events = VQ ? VQ.shuffle(events) : events.sort(function () { return R() - 0.5; });
    var step = (span - 400) / (events.length + 1);
    events.forEach(function (e, i) {
      var px = x + Math.round((i + 1) * step + (R() - 0.5) * step * 0.4);
      if (e.k === "spike") spike(px, e.n);
      else if (e.k === "gap") gap(px, TILE * (1 + Math.floor(R() * 2)));
      else if (e.k === "block") block(px, TILE * (1 + Math.floor(R() * 2)));
      else saw(px);
    });
    // two word gates, roughly a third and two-thirds through
    gates.push({ x: x + Math.round(span * 0.34), active: false });
    gates.push({ x: x + Math.round(span * 0.68), active: false });
    var finish = x + span;
    return { obs: obs, gates: gates, finish: finish, start: 120 };
  }

  // Endless: a bag of pre-baked "chunks" remixed forever; gates every ~1200.
  var CHUNKS = [
    function (px) { return [{ t: "spike", x: px }, { t: "spike", x: px + TILE }]; },
    function (px) { return [{ t: "gap", x: px, w: TILE * 2 }]; },
    function (px) { return [{ t: "block", x: px, h: TILE, w: TILE }, { t: "spike", x: px + TILE * 2 }]; },
    function (px) { return [{ t: "saw", x: px, phase: Math.random() * 6 }]; },
    function (px) { return [{ t: "block", x: px, h: TILE * 2, w: TILE }]; },
    function (px) { return [{ t: "spike", x: px }, { t: "gap", x: px + TILE * 2, w: TILE }]; }
  ];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("dash");
    if (!stats.lvl) stats.lvl = 1;                 // highest unlocked level (do NOT touch stats.best — that's the platform best score)
    stats.bestDist = stats.bestDist || 0;
    stats.beatAll = stats.beatAll || false;

    var wrap = document.createElement("div"); wrap.className = "gamewrap dash";
    wrap.innerHTML =
      '<canvas id="dhcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="dhmsg">⚡ Word Dash</div>' +
      '<div class="grow"><span id="dhstat"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="dhbig"></div>' +
      '<div class="gover" id="dhq" style="display:none"></div>' +
      '<div class="gover" id="dhend" style="display:none"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#dhcv"), ctx = cv.getContext("2d");
    // No `.gamewrap.dash` rule exists in games.css, so this fullscreen canvas game
    // never inherited the layout the shared sheet gives .run/.blaster/.digger. Claim
    // it inline: kill the base .gamewrap padding/scroll and pin the canvas to the
    // viewport (env safe-areas on the .ghud HUD are handled by the shared sheet).
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    cv.style.position = "absolute"; cv.style.left = "0"; cv.style.top = "0";
    cv.style.width = "100%"; cv.style.height = "100%"; cv.style.display = "block";

    // ---------- responsive letterbox: WORLD_H is fixed, scale to fit ----------
    var W, H, S, OY, dpr = 1; // scale, vertical offset (portrait centers the track), retina factor
    function resize() {
      W = wrap.clientWidth; H = wrap.clientHeight;      // game logic stays in CSS px
      dpr = Math.min(global.devicePixelRatio || 1, 2);  // retina buffer: DPR3 iPhone → crisp, capped at 2
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      S = H / WORLD_H;
      // in portrait the runner is still horizontal; just cap the scale so the
      // whole track fits the width too, then center it vertically under the HUD.
      var maxByW = W / 640; // keep a sane visible-world width on tall/narrow screens
      if (S > maxByW && maxByW > 0) S = maxByW;
      OY = Math.max(0, (H - WORLD_H * S) / 2);
    }
    resize(); window.addEventListener("resize", resize);
    function sx(x) { return (x - camX) * S; }         // world→screen X (camera follows runner)
    function sy(y) { return OY + y * S; }             // world→screen Y

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var myCfg = AV ? AV.resolve(store.state) : null;
    // equipped trail color (contract: equipped.trail → VobloxItems.byId[id].color)
    var trailColor = null;
    (function () {
      var IT = global.VobloxItems, id = store.state && store.state.equipped && store.state.equipped.trail;
      if (IT && id && IT.byId[id]) trailColor = IT.byId[id].color;
    })();

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var level = 0, data = null, over = false, paused = false, alive = false, endShown = false;
    var camX = 0, dist = 0, deaths = 0, gatesHit = 0, banked = false, gateAnswered = 0;
    var runner = { x: 0, y: FLOOR_Y - RUNNER_H, vy: 0, onGround: true, jumps: 0 };
    var checkpointX = 0, shield = false, shieldRing = 0, shakeT = 0, endlessCursor = 0, nextEndlessGateX = 1200;
    var gateOpen = false, nextGateIdx = 0, lastFmt = null, frameC = 0, trailPuffs = [];

    var msgEl = document.getElementById("dhmsg"), bigEl = document.getElementById("dhbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1200); }
    function hud() {
      var s = document.getElementById("dhstat");
      if (!data) { s.textContent = ""; return; }
      var isEndless = level === 6;
      s.textContent = (isEndless ? "🏃 " + Math.round(dist) : "🏁 " + Math.round(dist) + "/" + Math.round(data.finish)) +
        "  💀 " + deaths + (shield ? "  🛡" : "");
    }

    // ---------- level select (mirrors books.js showSelect) ----------
    function showSelect() {
      level = 0; data = null; paused = true; alive = false;
      var end = document.getElementById("dhend");
      var cards = [1, 2, 3, 4, 5].map(function (n) {
        var open = n <= stats.lvl;
        var names = ["First Sprint", "Saw Hello", "Spike City", "Gap Runner", "THE GAUNTLET"];
        return '<button class="embtn" style="min-width:118px' + (open ? "" : ";opacity:.45") + '" data-lv="' + n + '">' +
          '<span class="ebl">' + (open ? "▶ " : "🔒 ") + "Lv " + n + '</span>' +
          '<span class="ebs">' + names[n - 1] + "</span></button>";
      }).join("");
      var endlessBtn = '<button class="embtn study" style="min-width:150px' + (stats.beatAll ? "" : ";opacity:.45") + '" id="dh_endless">' +
        '<span class="ebl">♾ Endless Dash</span><span class="ebs">' + (stats.beatAll ? ("best: " + Math.round(stats.bestDist || 0)) : "beat Level 5 to unlock") + "</span></button>";
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:560px;max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch">' +
        '<div style="font-size:40px">⚡🏃</div>' +
        '<div class="wqtitle" style="font-size:20px">Word Dash</div>' +
        '<div style="margin:4px 0 10px;color:#5a6b7a;font-weight:bold">Tap to jump. Answer WORD GATES to charge checkpoints & shields!</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + cards + endlessBtn + "</div>" +
        '<div style="font-size:12px;color:#8a98a8;margin-top:8px">Tap anywhere (or Space / ↑) to jump — tap again mid-air to double-jump.</div></div>';
      end.style.display = "flex";
      Array.prototype.forEach.call(end.querySelectorAll("[data-lv]"), function (b) {
        b.onclick = function () {
          var n = +b.dataset.lv;
          if (n > stats.lvl) { big("🔒 Beat Level " + (n - 1) + " first!", "#ffd740"); return; }
          begin(n);
        };
      });
      var eb = document.getElementById("dh_endless");
      if (eb) eb.onclick = function () { if (stats.beatAll) begin(6); else big("🔒 Beat Level 5 first!", "#ffd740"); };
    }

    // ---------- begin / respawn / flow ----------
    function begin(n) {
      level = n;
      data = n === 6 ? { obs: [], gates: [], finish: Infinity, start: 120, endless: true } : levelData(n);
      dist = 0; deaths = 0; gatesHit = 0; gateAnswered = 0; banked = false; over = false; endShown = false;
      shield = false; shieldRing = 0; shakeT = 0; nextGateIdx = 0; gateOpen = false; endlessCursor = 700; nextEndlessGateX = 1200; trailPuffs = [];
      checkpointX = data.start;
      spawnRunner(checkpointX);
      camX = runner.x - 160;
      document.getElementById("dhend").style.display = "none";
      paused = false; alive = true;
      msgEl.innerHTML = n === 6 ? "♾ <b>Endless Dash</b>" : "⚡ <b>Level " + n + "</b>";
      big(n === 6 ? "♾ Run forever — how far can you go?" : "⚡ Level " + n + " — TAP to jump!", "#ffe14d");
      hud();
    }
    function spawnRunner(x) {
      runner.x = x; runner.y = FLOOR_Y - RUNNER_H; runner.vy = 0; runner.onGround = true; runner.jumps = 0;
    }
    function respawn() {
      // FAST respawn at the last checkpoint (or level start). Shield survives death
      // only if it ABSORBED the hit (handled in kill()); a fresh respawn is bare.
      spawnRunner(checkpointX);
      camX = runner.x - 160;
      alive = true; shakeT = 0;
      if (level === 6) endlessCursor = Math.max(endlessCursor, runner.x + 900);
      hud();
    }

    function runRewards(won) {
      var isEndless = level === 6;
      var distPay = isEndless ? Math.min(60, Math.floor(dist / 220)) : 0;
      var gems = (won ? 20 + level * 4 : Math.min(15, 3 + gateAnswered * 4)) + distPay;
      return {
        win: !!won,
        score: Math.round(dist) + level * 50,
        rankPtsDelta: won ? Math.min(12, 3 + level * 2) : (isEndless ? Math.min(8, 1 + Math.floor(dist / 900)) : 2),
        xp: Math.min(80, 8 + gatesHit * 6 + deaths + (won ? level * 5 : 0)),
        gems: gems
      };
    }
    function bankRun(won) {
      if (banked) return null;
      banked = true;
      var rw = runRewards(won);
      var res = store.recordGame ? store.recordGame("dash", rw) : null;
      return { rw: rw, res: res };
    }
    function endLevel(won) {
      if (over) return; over = true; paused = true; alive = false;
      var isEndless = level === 6;
      var bank = bankRun(won) || { rw: runRewards(won), res: null };
      var rw = bank.rw, res = bank.res;
      if (won && !isEndless && level >= stats.lvl && level < 5) { stats.lvl = level + 1; store.save(); }
      if (won && level === 5) { stats.beatAll = true; store.save(); }
      if (isEndless && dist > (stats.bestDist || 0)) { stats.bestDist = Math.round(dist); store.save(); }
      var end = document.getElementById("dhend");
      var title = isEndless ? "♾ You dashed " + Math.round(dist) + (Math.round(dist) >= (stats.bestDist || 0) ? " — NEW BEST!" : "!") :
        won ? (level === 5 ? "🏆 THE GAUNTLET IS BEATEN! Endless unlocked!" : "🏁 Level " + level + " cleared!") :
          "💀 You fell on Level " + level + "…"; // (this branch only if a level force-ends unwon)
      var payRow = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP</div>";
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch">' +
        '<div style="font-size:44px">' + (won ? "🏆" : "♾") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + title + "</div>" + payRow +
        '<div style="margin:2px 0">🏁 ' + Math.round(dist) + " dashed · 💀 " + deaths + " deaths · ⚡ " + gatesHit + " gates charged" +
        (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        '<button class="submit big-next" id="dhnext">' + (won && !isEndless && level < 5 ? "Next level ➜" : "Dash again") + "</button></div>";
      end.style.display = "flex";
      if (won && sfx && sfx.fanfare) sfx.fanfare();
      if (won && juice) { juice.shake(6); for (var cf = 0; cf < 5; cf++) juice.burst(W * (0.2 + cf * 0.15), H * 0.3, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][cf], 16); }
      document.getElementById("dhnext").onclick = function () {
        if (won && !isEndless && level < 5) begin(level + 1); else showSelect();
      };
    }

    // ---------- word gate ----------
    function openGate(gate) {
      if (paused || over) return;
      paused = true; gateOpen = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("dhq"), words, store, {
        title: "⚡ Word gate! Answer to charge the checkpoint!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false; gateOpen = false; gateAnswered++;
          if (gate) {
            gate.answered = true;
            if (ok) {
              gate.active = true; gatesHit++;
              checkpointX = gate.x;                 // future respawns start HERE
              shield = true; shieldRing = 1;         // 🛡 absorbs the next death
              big("⚡ CHECKPOINT CHARGED! 🛡 Shield up!", "#69f0ae");
              if (sfx && sfx.fanfare) sfx.fanfare();
              if (juice) juice.burst(sx(gate.x), sy(FLOOR_Y - 60), "#69f0ae", 18);
            } else {
              big("The gate stayed cold — keep running!", "#ff8a8a");
              if (sfx && sfx.buzz) sfx.buzz();
            }
          }
          hud();
        }
      });
    }

    // ---------- death ----------
    function kill() {
      if (!alive || over || paused) return;
      if (shield) {                       // 🛡 eats this death; run continues, no respawn
        shield = false; shieldRing = 0;
        big("🛡 Shield saved you!", "#c9b6ff");
        if (juice) { juice.shake(5); juice.burst(sx(runner.x), sy(runner.y), "#c9b6ff", 16); }
        if (sfx && sfx.pop) sfx.pop();
        // nudge the runner back onto safe ground so it doesn't die on the same frame
        runner.y = FLOOR_Y - RUNNER_H; runner.vy = 0; runner.onGround = true; runner.jumps = 0;
        runner.x = Math.max(runner.x - 30, checkpointX);
        return;
      }
      deaths++; alive = false; shakeT = 0.4;    // 400ms shake+burst, then respawn
      if (juice) { juice.shake(9); juice.burst(sx(runner.x), sy(runner.y), "#ff6b6b", 22); }
      if (sfx && sfx.buzz) sfx.buzz();
      hud();
    }

    // ---------- physics + collision ----------
    function jump() {
      if (over || paused || !alive) return;
      if (runner.onGround) { runner.vy = JUMP_V; runner.onGround = false; runner.jumps = 1; if (sfx && sfx.pop) sfx.pop(); }
      else if (runner.jumps < 2) { runner.vy = JUMP_V * 0.9; runner.jumps = 2; if (sfx && sfx.pop) sfx.pop(); }
    }
    function runnerBox() { return { x: runner.x - RUNNER_W / 2, y: runner.y, w: RUNNER_W, h: RUNNER_H }; }
    function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

    // endless: keep laying chunks ahead of the camera + a gate every ~1200 px
    function feedEndless() {
      while (endlessCursor < runner.x + 1400) {
        var mk = CHUNKS[Math.floor(Math.random() * CHUNKS.length)];
        mk(endlessCursor).forEach(function (o) { data.obs.push(o); });
        endlessCursor += TILE * (4 + Math.floor(Math.random() * 3));
      }
      while (nextEndlessGateX < runner.x + 1400) {
        data.gates.push({ x: nextEndlessGateX, active: false });
        nextEndlessGateX += 1200;
      }
      // prune obstacles/answered gates well behind the camera (bounded memory)
      if (data.obs.length > 200) data.obs = data.obs.filter(function (o) { return o.x + (o.w || TILE) > camX - 400; });
      if (data.gates.length > 30) data.gates = data.gates.filter(function (gt) { return !gt.answered || gt.x > camX - 400; });
    }

    function step(dt) {
      if (!alive) {                      // dead: run out the shake, then respawn
        shakeT -= dt;
        if (shakeT <= 0) respawn();
        return;
      }
      // advance
      runner.x += RUN_SPEED * dt;
      dist = Math.max(dist, runner.x - data.start);
      camX = runner.x - 160;
      // gravity
      runner.vy += GRAV * dt;
      runner.y += runner.vy * dt;

      // floor & block-top landing. Default floor unless we're over a gap.
      var box = runnerBox();
      var overGap = false, gapEdgeDie = false;
      // ground level under the runner: floor, unless a gap opens beneath the feet
      var groundY = FLOOR_Y;
      for (var i = 0; i < data.obs.length; i++) {
        var o = data.obs[i];
        if (o.t === "gap") {
          if (runner.x > o.x && runner.x < o.x + o.w) overGap = true;
        }
      }
      // blocks: land on top, but a side hit is death
      var landY = null;
      for (var b2 = 0; b2 < data.obs.length; b2++) {
        var ob = data.obs[b2];
        if (ob.t !== "block") continue;
        var top = FLOOR_Y - ob.h, br = { x: ob.x, y: top, w: ob.w, h: ob.h + 40 };
        if (aabb(box, br)) {
          // coming down onto the top → land; otherwise a wall hit → die
          if (runner.vy >= 0 && (runner.y + RUNNER_H) - (runner.vy * dt) <= top + 6) {
            landY = Math.min(landY == null ? 1e9 : landY, top);
          } else if (runner.y + RUNNER_H > top + 8) {
            kill(); return;
          }
        }
      }
      if (landY != null) groundY = landY;
      // settle on ground / block-top (unless a gap is under us and we've fallen in)
      if (runner.y + RUNNER_H >= groundY && !(overGap && landY == null)) {
        runner.y = groundY - RUNNER_H; runner.vy = 0; runner.onGround = true; runner.jumps = 0;
      } else {
        runner.onGround = false;
      }
      // fell into a gap / off the world
      if (runner.y > WORLD_H + 40 || (overGap && runner.y + RUNNER_H > FLOOR_Y + 6 && landY == null)) { kill(); return; }

      // spikes & saws: touch = death
      box = runnerBox();
      for (var s2 = 0; s2 < data.obs.length; s2++) {
        var h = data.obs[s2];
        if (h.t === "spike") {
          var sb = { x: h.x + 6, y: FLOOR_Y - TILE * 0.7, w: TILE - 12, h: TILE * 0.7 };
          if (aabb(box, sb)) { kill(); return; }
        } else if (h.t === "saw") {
          var sawY = FLOOR_Y - TILE * 0.5 + Math.sin(frameC * 0.03 + h.phase) * TILE * 1.4;
          var sw2 = { x: h.x + 4, y: sawY - TILE * 0.45, w: TILE - 8, h: TILE * 0.9 };
          if (aabb(box, sw2)) { kill(); return; }
        }
      }

      // trail puffs behind the runner while moving
      if (frameC % 3 === 0) {
        trailPuffs.push({ x: runner.x - RUNNER_W / 2, y: runner.y + RUNNER_H * 0.7, t: 1 });
        if (trailPuffs.length > 24) trailPuffs.shift();
      }
      for (var tp = trailPuffs.length - 1; tp >= 0; tp--) { trailPuffs[tp].t -= dt * 2; if (trailPuffs[tp].t <= 0) trailPuffs.splice(tp, 1); }
      if (shieldRing > 0) shieldRing = Math.max(0, shieldRing - dt * 0.6);

      // endless world generation
      if (data.endless) feedEndless();

      // WORD GATES: pause & quiz when reached (only once each)
      for (var gi = 0; gi < data.gates.length; gi++) {
        var g = data.gates[gi];
        if (!g.answered && runner.x >= g.x) { openGate(g); break; }
      }

      // finish line (handcrafted levels only)
      if (!data.endless && runner.x >= data.finish) { endLevel(true); return; }
      hud();
    }

    // ---------- drawing ----------
    var SKY = [
      ["#8ec5ff", "#e3f3ff"], ["#ffd39a", "#fff0dd"], ["#b7a6ff", "#efe9ff"],
      ["#9ce6c0", "#e6fff2"], ["#ff9aa8", "#ffe6ea"], ["#2b2450", "#4a3f70"]
    ];
    function rrect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function draw() {
      var ox = 0, oy = 0;
      if (juice) { ox = juice.ox || 0; oy = juice.oy || 0; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);  // draw in CSS px onto the retina buffer (game never sets its own transform)
      ctx.clearRect(0, 0, W, H);
      // gradient sky per level
      var pal = SKY[(level || 1) - 1] || SKY[0];
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (!data) return;
      ctx.save(); ctx.translate(ox, oy);
      // floor slab
      var floorScreen = sy(FLOOR_Y);
      ctx.fillStyle = level === 6 ? "#3a3358" : "#6a5540";
      ctx.fillRect(0, floorScreen, W, H - floorScreen + 40);
      ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 3;
      ctx.setLineDash([24, 20]); ctx.lineDashOffset = -(camX * S % 44);
      ctx.beginPath(); ctx.moveTo(0, floorScreen + 3); ctx.lineTo(W, floorScreen + 3); ctx.stroke();
      ctx.setLineDash([]);

      // obstacles (only what's on-screen)
      data.obs.forEach(function (o) {
        var sxx = sx(o.x);
        if (sxx < -120 || sxx > W + 120) return;
        if (o.t === "gap") {
          ctx.fillStyle = pal[1]; // cut the floor open (sky shows through)
          ctx.fillRect(sxx, floorScreen, o.w * S, H - floorScreen + 40);
        } else if (o.t === "spike") {
          ctx.fillStyle = "#d64545";
          ctx.beginPath();
          ctx.moveTo(sxx + 4 * S, floorScreen);
          ctx.lineTo(sxx + TILE / 2 * S, floorScreen - TILE * 0.7 * S);
          ctx.lineTo(sxx + (TILE - 4) * S, floorScreen);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#7a2020"; ctx.font = Math.round(16 * S) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.fillText("▲", sxx + TILE / 2 * S, floorScreen);
        } else if (o.t === "block") {
          var top = sy(FLOOR_Y - o.h);
          ctx.fillStyle = "#5b8ac6";
          rrect(sxx, top, o.w * S, (o.h + 30) * S, 6 * S); ctx.fill();
          ctx.fillStyle = "#3f6aa0"; ctx.fillRect(sxx, top, o.w * S, 5 * S);
        } else if (o.t === "saw") {
          var sawY = sy(FLOOR_Y - TILE * 0.5 + Math.sin(frameC * 0.03 + o.phase) * TILE * 1.4);
          ctx.font = Math.round(TILE * 1.0 * S) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.save(); ctx.translate(sxx + TILE / 2 * S, sawY); ctx.rotate(frameC * 0.12); ctx.fillText("⚙", 0, 0); ctx.restore();
        }
      });

      // word gates: glowing pillars + checkpoint flag when active
      data.gates.forEach(function (gt) {
        var gxx = sx(gt.x);
        if (gxx < -80 || gxx > W + 80) return;
        var pulse = 0.5 + Math.sin(frameC * 0.06) * 0.3;
        ctx.fillStyle = gt.active ? "rgba(105,240,174," + pulse + ")" : "rgba(157,109,255," + pulse + ")";
        ctx.fillRect(gxx - 5 * S, sy(FLOOR_Y - 120), 10 * S, 120 * S);
        ctx.font = Math.round(30 * S) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(gt.active ? "🚩" : "⚡", gxx, sy(FLOOR_Y - 132));
      });

      // trail puffs (equipped-trail color, else a soft default)
      trailPuffs.forEach(function (p) {
        ctx.globalAlpha = Math.max(0, p.t) * 0.6;
        ctx.fillStyle = trailColor || "#ffffff";
        ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), (3 + (1 - p.t) * 6) * S, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // the runner (blocky avatar) — hide the frame while dead-shaking
      if (alive || shakeT > 0) {
        var pose = runner.onGround ? "run" : "jump";
        if (AV) AV.draw(ctx, { x: sx(runner.x), y: sy(runner.y + RUNNER_H), size: RUNNER_H * 1.5 * S, config: myCfg, pose: pose, frame: frameC * 0.02, name: "" });
        else { ctx.fillStyle = "#2f7be0"; ctx.fillRect(sx(runner.x) - RUNNER_W / 2 * S, sy(runner.y), RUNNER_W * S, RUNNER_H * S); }
        if (shield) { // 🛡 shield ring
          ctx.strokeStyle = "rgba(201,182,255," + (0.55 + Math.sin(frameC * 0.1) * 0.25) + ")"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(sx(runner.x), sy(runner.y + RUNNER_H / 2), RUNNER_H * 0.9 * S, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // finish line
      if (!data.endless && data.finish < Infinity) {
        var fxx = sx(data.finish);
        if (fxx > -40 && fxx < W + 40) {
          for (var r = 0; r < 8; r++) for (var c = 0; c < 2; c++) {
            ctx.fillStyle = (r + c) % 2 ? "#fff" : "#222";
            ctx.fillRect(fxx + c * 10 * S, sy(FLOOR_Y - 160) + r * 20 * S, 10 * S, 20 * S);
          }
        }
      }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
      ctx.restore();
    }

    // ---------- input (phantom-tap safe) ----------
    // touchstart preventDefault suppresses the synthetic mouse event, so the two
    // listeners never double-fire. mousedown covers desktop/mouse only.
    function onTouch(e) { e.preventDefault(); jump(); }
    function onMouse() { jump(); }
    cv.addEventListener("touchstart", onTouch, { passive: false });
    cv.addEventListener("mousedown", onMouse);
    function onKey(e) {
      var k = (e.key || "").toLowerCase();
      if (k === " " || k === "arrowup" || k === "spacebar" || k === "w") { e.preventDefault(); jump(); }
    }
    document.addEventListener("keydown", onKey);

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; // rAF timestamps ONLY
      frameC++;
      if (!paused && !over && data) step(dt);
      draw();
    }

    // ---------- banking + cleanup ----------
    function bankExit() {
      if (!data || over || (deaths === 0 && gatesHit === 0 && gateAnswered === 0 && dist < 200)) return;
      // endless: a quit is still a "run" — persist how far you got
      if (level === 6 && dist > (stats.bestDist || 0)) { stats.bestDist = Math.round(dist); store.save(); }
      var bank = bankRun(false);
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("⚡ Dash banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
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
      cv.removeEventListener("touchstart", onTouch);
      cv.removeEventListener("mousedown", onMouse);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API ----------
    cv._dash = {
      state: function () {
        return { level: level, dist: Math.round(dist), deaths: deaths, alive: alive, shield: shield,
          over: over, best: stats.lvl, bestDist: stats.bestDist || 0, gatesHit: gatesHit, banked: banked, paused: paused };
      },
      begin: begin,
      jump: jump,
      kill: function () { kill(); },
      gate: function () { // force-open the next unanswered gate NOW (or a synthetic one)
        var g = null;
        for (var i = 0; i < data.gates.length; i++) if (!data.gates[i].answered) { g = data.gates[i]; break; }
        if (!g) { g = { x: runner.x + 40, active: false }; data.gates.push(g); }
        openGate(g);
      },
      runner: function () { return { x: runner.x, y: runner.y, vy: runner.vy }; },
      warp: function (x) { runner.x = x; camX = runner.x - 160; if (data && data.endless) feedEndless(); }
    };

    hud();
    showSelect();
    // guarded demo hook (exactly like books.js): drop into a lively level 2 board
    if (global._dashdemo) setTimeout(function () {
      global._dashdemo = 0;
      begin(2);
      cv._dash.warp(1200); // skip ahead near the first hazards
    }, 700);
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxDash = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
