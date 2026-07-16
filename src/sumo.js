/*
 * Voblox arcade game — 🥋 SUMO SMASH (a kid-kind king-of-the-hill bumper battle).
 * You + 5 named rivals are round bumper-blobs on a floating circular dohyo over a
 * long drop. HOLD/DRAG to steer; everyone constantly builds momentum. BUMP physics:
 * momentum = mass × velocity — square someone up and they FLY; get caught and YOU
 * fly. Off the edge = SPLASH! 🌊 (never game over — you spectate or second-wind back).
 * TAP (quick release) = a CHARGE DASH with a 2s cooldown — dash into a rival mid-dash
 * and you win the trade. Last blob standing wins the round; best-of-5, and the ring
 * SHRINKS 20% each round. Pickups drift in: 🐘 Heavy · 🌀 Turbo · 🛡 Anchor.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 💫 SECOND WIND: the first time YOU are knocked out in a match, a WORD drops you
 *     back in (once per match). Wrong = spectate the round, kindly.
 *   - Between rounds, a WORD lets you choose your starting pickup for the next round.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("sumo") per
 * match, banked on match-end, quit, AND app-close. matchWinsS / knockouts persist.
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  var BASE_R = 430;        // dohyo world radius, round 1 (shrinks 20% each round)
  var BLOB_R = 27;         // reference blob radius (scales with mass)
  var BOT_COUNT = 5;       // 5 rivals + you = 6 blobs
  var WIN_TARGET = 3;      // best-of-5 → first to 3 rounds
  var STEER_ACC = 1500;    // steering acceleration (world/s²)
  var MAX_SPEED = 940;     // speed cap (world/s)
  var FRICTION_K = 1.15;   // velocity decays v*=e^(-k·dt) — momentum lingers, never runaway
  var DASH_IMPULSE = 820;  // dash velocity burst
  var DASH_TIME = 0.34;    // seconds of "mid-dash" (heavier in trades)
  var DASH_CD = 2.0;       // dash cooldown seconds
  var DASH_MASS = 2.6;     // effective-mass multiplier while dashing
  var REST = 1.12;         // restitution — bouncy bumpers
  var HEAVY_MASS = 2.3, TURBO_MULT = 1.75, ANCHOR_MASS = 1e6;
  var PICKUPS = {
    heavy:  { emoji: "🐘", name: "Heavy",  dur: 8, tip: "mass UP — shove everyone!" },
    turbo:  { emoji: "🌀", name: "Turbo",  dur: 8, tip: "speed UP — zoom around!" },
    anchor: { emoji: "🛡", name: "Anchor", dur: 4, tip: "immovable — brace!" }
  };
  var PAL = ["#ff6b6b", "#ffd23f", "#6bd968", "#4fc3f7", "#b06aff", "#ff9f43", "#f77fbe", "#5fd7c9"];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("sumo");
    stats.matchWinsS = stats.matchWinsS || 0;    // additive, never-renamed persistence
    stats.knockouts = stats.knockouts || 0;

    var skill = P.botSkillFor(stats.rankPts || 0);
    var playerName = (store.state && store.state.profile && store.state.profile.name) || "You";

    var wrap = document.createElement("div");
    wrap.className = "gamewrap sumo";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="smcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="smmsg">🥋 Sumo Smash — hold to steer, TAP to DASH!</div>' +
      '<div class="grow"><span id="smround">Round 1</span><span id="smscore">🏆 0 – 0</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="smbig"></div>' +
      '<div class="gover" id="smq" style="display:none"></div>' +
      '<div class="gover" id="smpick" style="display:none"></div>' +
      '<div class="gover" id="smcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#smcv"), ctx = cv.getContext("2d");
    var msgEl = wrap.querySelector("#smmsg"), bigEl = wrap.querySelector("#smbig");
    var smq = wrap.querySelector("#smq"), smpick = wrap.querySelector("#smpick"), smcard = wrap.querySelector("#smcard");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H, scale;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      scale = Math.min(W, H) * 0.46 / BASE_R; // constant scale → shrinking ring reads clearly
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var blobs = [], shocks = [], pickups = [], pickupT = 6;
    var self = null;
    var round = 1, arenaR = BASE_R, roundsWon = 0, roundsLost = 0, knockouts = 0;
    var over = false, won = false, paused = false, banked = false;
    var secondWindUsed = false, roundResolved = false, lastFmt = null;
    var lastGaspBlob = null;

    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1150); }
    function aliveBots() { var n = 0; for (var i = 0; i < blobs.length; i++) if (!blobs[i].isPlayer && blobs[i].alive) n++; return n; }
    function hud() {
      wrap.querySelector("#smround").textContent = "Round " + round;
      wrap.querySelector("#smscore").textContent = "🏆 " + roundsWon + " – " + roundsLost;
    }
    function rOf(b) { return BLOB_R * Math.pow(b.mass, 0.38); }
    function effMass(b) {
      var m = b.mass;
      if (b.anchorT > 0) return ANCHOR_MASS;
      if (b.dashT > 0) m *= DASH_MASS;
      return m;
    }

    // ---------- blob factory ----------
    function makeBlob(def, idx, isPlayer) {
      return {
        id: def.id, name: def.name, skill: def.skill, chat: def.chat,
        color: isPlayer ? "#4fc3f7" : PAL[(idx + 1) % PAL.length],
        isPlayer: !!isPlayer, x: 0, y: 0, vx: 0, vy: 0, mass: 1,
        alive: true, aimx: 0, aimy: 0, hold: isPlayer ? false : true,
        dashT: 0, dashCd: 0, heavyT: 0, turboT: 0, anchorT: 0,
        squash: 0, squashDir: 0, teeter: 0, fallT: -1, retargetT: 0,
        chatText: "", chatAge: 9
      };
    }
    function spawnRing() {
      // spread all blobs evenly on a ring inside the current dohyo
      var n = blobs.length;
      for (var i = 0; i < n; i++) {
        var b = blobs[i], a = (i / n) * Math.PI * 2 + 0.3;
        var r = arenaR * 0.55;
        b.x = Math.cos(a) * r; b.y = Math.sin(a) * r;
        b.vx = 0; b.vy = 0; b.alive = true; b.dashT = 0; b.heavyT = 0; b.turboT = 0; b.anchorT = 0;
        b.mass = 1; b.fallT = -1; b.squash = 0; b.teeter = 0; b.hold = b.isPlayer ? false : true;
      }
    }

    // ---------- lifecycle ----------
    function begin() {
      round = 1; arenaR = BASE_R; roundsWon = 0; roundsLost = 0; knockouts = 0;
      over = false; won = false; paused = false; banked = false; secondWindUsed = false; roundResolved = false;
      shocks = []; pickups = []; pickupT = 6;
      blobs = [];
      var defs = (Bots && Bots.pickOpponents) ? Bots.pickOpponents(BOT_COUNT, skill) : [];
      blobs.push(self = makeBlob({ id: "you", name: playerName, skill: 1, chat: {} }, -1, true));
      for (var k = 0; k < BOT_COUNT; k++) {
        var def = defs[k] || { id: "bot" + k, name: "Rival" + k, skill: skill, chat: {} };
        blobs.push(makeBlob(def, k, false));
      }
      spawnRing();
      smcard.style.display = "none"; smq.style.display = "none"; smpick.style.display = "none";
      hud();
      big("🥋 Round 1 — last blob standing wins!", "#ffe14d");
    }

    // ---------- economy: ONE bank path, guarded, always SHOWN ----------
    function rewards(w) {
      var s = roundsWon * 100 + knockouts * 20;
      return {
        win: !!w, score: s,
        rankPtsDelta: w ? Math.min(14, 6 + roundsWon * 2) : Math.min(6, 1 + roundsWon),
        xp: Math.min(80, 10 + roundsWon * 8 + knockouts * 2),
        gems: (w ? 15 : 0) + 4 + roundsWon * 3 + knockouts
      };
    }
    function bankRun(w) {
      if (banked) return null;
      banked = true;
      stats.knockouts = (stats.knockouts || 0) + knockouts;    // lifetime knockouts
      if (w) stats.matchWinsS = (stats.matchWinsS || 0) + 1;   // match wins
      if (store.save) store.save();
      var rw = rewards(w);
      var res = store.recordGame ? store.recordGame("sumo", rw) : null;
      return { rw: rw, res: res };
    }

    // ---------- round / match flow ----------
    function checkRound() {
      if (roundResolved || over || paused) return;
      if (self.alive && aliveBots() === 0) winRound();
    }
    function winRound() {
      if (roundResolved || over) return;
      roundResolved = true;
      if (juice) { juice.shake(6); juice.burst(W / 2, H / 2, "#ffd23f", 18); }
      if (sfx && sfx.fanfare) sfx.fanfare();
      roundsWon++; hud();
      if (roundsWon >= WIN_TARGET) { endMatch(true); return; }
      big("🏆 Round won! The ring shrinks…", "#9be15d");
      nextRound();
    }
    function loseRound() {
      if (roundResolved || over) return;
      roundResolved = true;
      roundsLost++; hud();
      if (roundsLost >= WIN_TARGET) { endMatch(false); return; }
      big("🌊 SPLASH! Round lost — shake it off!", "#ff8a8a");
      nextRound();
    }
    function nextRound() {
      round++;
      arenaR = BASE_R * Math.pow(0.8, round - 1); // 20% smaller each round
      roundResolved = false;
      spawnRing();
      shocks = []; pickups = []; pickupT = 5;
      hud();
      offerRoundPickup();
    }
    // between rounds: a WORD lets you pick a starting pickup (optional, non-blocking to advance)
    function offerRoundPickup() {
      paused = true;
      smpick.innerHTML = '<div class="wqcard" style="text-align:center;max-width:420px">' +
        '<div style="font-size:40px">🥋</div>' +
        '<div class="wqtitle" style="font-size:20px">Round ' + round + ' — the ring is smaller!</div>' +
        '<div style="margin:4px 0 8px;color:#5a6b7a;font-weight:bold">Answer a word to walk in with a POWER — or just fight!</div>' +
        '<button class="submit" id="sm_boost" type="button">🥋 Word → starting boost</button>' +
        '<br><button class="wqskip" id="sm_fight" type="button">Fight! ▶</button></div>';
      smpick.style.display = "flex";
      wrap.querySelector("#sm_fight").onclick = startRound;
      wrap.querySelector("#sm_boost").onclick = function () {
        cv._lastQ = VQ.miniQuiz(smq, words, store, {
          title: "🥋 Answer for a starting POWER!",
          lastFormat: lastFmt,
          cb: function (ok, res, fmt) {
            lastFmt = fmt;
            if (ok) showPickupChoice(); else { big("No boost — go get 'em anyway!", "#ffd740"); startRound(); }
          }
        });
      };
    }
    function showPickupChoice() {
      smpick.innerHTML = '<div class="wqcard" style="text-align:center;max-width:440px">' +
        '<div class="wqtitle" style="font-size:19px">Correct! Choose your starting power:</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px">' +
        Object.keys(PICKUPS).map(function (k) {
          return '<button class="embtn" style="min-width:120px" data-pk="' + k + '"><span class="ebl">' +
            PICKUPS[k].emoji + " " + PICKUPS[k].name + '</span><span class="ebs">' + PICKUPS[k].tip + "</span></button>";
        }).join("") + "</div></div>";
      smpick.style.display = "flex";
      Array.prototype.forEach.call(smpick.querySelectorAll("[data-pk]"), function (b) {
        b.onclick = function () { give(b.dataset.pk); startRound(); };
      });
    }
    function startRound() {
      smpick.style.display = "none"; smpick.innerHTML = "";
      paused = false;
      big("🥋 FIGHT!", "#ffe14d");
    }

    function endMatch(w) {
      if (over) return;
      over = true; won = w; paused = true;
      var bank = bankRun(w) || { rw: rewards(w), res: null };
      smpick.style.display = "none";
      showCard(bank.rw, bank.res);
      if (w && sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(7); for (var c = 0; c < 5; c++) juice.burst(W * (0.2 + c * 0.15), H * 0.35, PAL[c], 16); }
    }
    function showCard(rw, res) {
      var title = won ? "🏆 SUMO CHAMPION! You cleared the dohyo!" :
        "Match over — you took " + roundsWon + " round" + (roundsWon === 1 ? "" : "s") + ".";
      smcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (won ? "🏆" : "🥋") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + title + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🏅 Rounds won <b>' + roundsWon + '</b> · 💥 Knockouts <b>' + knockouts + '</b></div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🏆 ' + (stats.matchWinsS || 0) + ' match wins · 💥 ' + (stats.knockouts || 0) + ' lifetime KOs' + (res && res.rankedUp ? ' · 🎖 RANK UP!' : '') + '</div>' +
        '<button class="submit big-next" id="sm_again" type="button">Rematch ➜</button>' +
        '<button class="wqskip" id="sm_leave" type="button">Leave</button></div>';
      smcard.style.display = "flex";
      wrap.querySelector("#sm_again").onclick = function () { smcard.style.display = "none"; begin(); };
      wrap.querySelector("#sm_leave").onclick = exit;
    }

    // ---------- knockouts + 💫 second wind ----------
    function knockOut(b) {
      if (!b.alive) return;
      b.alive = false; b.fallT = 0; b.vx *= 0.4; b.vy *= 0.4;
      if (juice) juice.burst(w2sx(b.x), w2sy(b.y), "#7fd3ff", 16);
      if (b.isPlayer) playerKO();
      else { knockouts++; if (sfx && sfx.pop) sfx.pop(); checkRound(); }
    }
    function playerKO() {
      if (over) return;
      big("SPLASH! 🌊", "#7fd3ff");
      if (sfx && sfx.buzz) sfx.buzz();
      if (!secondWindUsed) openSecondWind();
      else loseRound();
    }
    function openSecondWind() {
      secondWindUsed = true; // once per match, whatever the answer
      paused = true;
      cv._lastQ = VQ.miniQuiz(smq, words, store, {
        title: "💫 SECOND WIND! Answer a word to splash back in!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) {
            self.alive = true; self.fallT = -1; self.x = 0; self.y = 0; self.vx = 0; self.vy = 0; self.mass = 1;
            paused = false;
            big("💫 SECOND WIND! Back in the ring!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else {
            paused = false;
            big("Aw — spectate this round, kindly. Next one's yours!", "#ffd740");
            loseRound();
          }
        }
      });
    }

    // ---------- pickups ----------
    function give(kind) {
      if (kind === "heavy") { self.mass = HEAVY_MASS; self.heavyT = PICKUPS.heavy.dur; }
      else if (kind === "turbo") { self.turboT = PICKUPS.turbo.dur; }
      else if (kind === "anchor") { self.anchorT = PICKUPS.anchor.dur; }
      if (PICKUPS[kind]) big(PICKUPS[kind].emoji + " " + PICKUPS[kind].name + "!", "#ffd23f");
      if (juice) juice.burst(w2sx(self.x), w2sy(self.y), "#ffd23f", 14);
      hud();
    }
    function spawnPickup() {
      var keys = Object.keys(PICKUPS), kind = keys[Math.floor(Math.random() * keys.length)];
      var edge = arenaR * 1.15, a = Math.random() * Math.PI * 2;
      var x = Math.cos(a) * edge, y = Math.sin(a) * edge;
      pickups.push({ kind: kind, x: x, y: y, vx: -x / edge * 60, vy: -y / edge * 60, ph: 0, life: 14 });
    }
    function grantPickup(b, pk) {
      if (b.isPlayer) give(pk.kind);
      else { // rivals get a quick buff too, so the arena stays lively
        if (pk.kind === "heavy") { b.mass = HEAVY_MASS; b.heavyT = PICKUPS.heavy.dur; }
        else if (pk.kind === "turbo") b.turboT = PICKUPS.turbo.dur;
        else b.anchorT = PICKUPS.anchor.dur;
      }
    }

    // ---------- dash ----------
    function dash(dx, dy) {
      if (over || paused || !self.alive || self.dashCd > 0) return;
      var d;
      if (dx || dy) { d = Math.sqrt(dx * dx + dy * dy) || 1; d = { x: dx / d, y: dy / d }; }
      else if (self.hold) { var ax = self.aimx - self.x, ay = self.aimy - self.y, al = Math.sqrt(ax * ax + ay * ay) || 1; d = { x: ax / al, y: ay / al }; }
      else { var sp = Math.sqrt(self.vx * self.vx + self.vy * self.vy); d = sp > 5 ? { x: self.vx / sp, y: self.vy / sp } : { x: 1, y: 0 }; }
      self.vx += d.x * DASH_IMPULSE; self.vy += d.y * DASH_IMPULSE;
      self.dashT = DASH_TIME; self.dashCd = DASH_CD;
      self.squash = 0.5; self.squashDir = Math.atan2(d.y, d.x);
      if (sfx && sfx.whoosh) sfx.whoosh(); else if (sfx && sfx.pop) sfx.pop();
      if (juice) juice.burst(w2sx(self.x), w2sy(self.y), "#4fc3f7", 10);
    }
    function botMaybeDash(b, target, d) {
      if (b.dashCd > 0 || d > rOf(b) * 5) return;
      if (Math.random() < 0.02 + b.skill * 0.05) {
        var ax = target.x - b.x, ay = target.y - b.y, al = Math.sqrt(ax * ax + ay * ay) || 1;
        b.vx += ax / al * DASH_IMPULSE; b.vy += ay / al * DASH_IMPULSE;
        b.dashT = DASH_TIME; b.dashCd = DASH_CD; b.squash = 0.5;
      }
    }

    // ---------- AI ----------
    function botThink(b, dt) {
      b.retargetT -= dt;
      var d0 = Math.sqrt(b.x * b.x + b.y * b.y);
      if (d0 > arenaR * 0.72) { // self-preservation: steer back to center hard
        b.aimx = 0; b.aimy = 0; b.hold = true; return;
      }
      if (b.retargetT > 0) return;
      b.retargetT = 0.5 - b.skill * 0.3;
      // hunt the nearest alive opponent, aiming to shove them toward the rim
      var best = null, bd = 1e9;
      for (var i = 0; i < blobs.length; i++) {
        var o = blobs[i]; if (o === b || !o.alive) continue;
        var dx = o.x - b.x, dy = o.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        // aim slightly PAST the target, away from center → push them off
        var tx = best.x, ty = best.y, tl = Math.sqrt(tx * tx + ty * ty) || 1;
        b.aimx = best.x + tx / tl * 90; b.aimy = best.y + ty / tl * 90; b.hold = true;
        botMaybeDash(b, best, bd);
      } else { b.aimx = 0; b.aimy = 0; b.hold = true; }
      if (Math.random() < 0.015 && Bots) { b.chatText = Bots.say(b, Math.random() < 0.5 ? "nice" : "hi"); b.chatAge = 0; }
    }

    // ---------- physics ----------
    function integrate(b, dt) {
      if (!b.alive) { if (b.fallT >= 0) b.fallT += dt; return; }
      if (b.dashT > 0) b.dashT = Math.max(0, b.dashT - dt);
      if (b.dashCd > 0) b.dashCd = Math.max(0, b.dashCd - dt);
      if (b.heavyT > 0) { b.heavyT = Math.max(0, b.heavyT - dt); if (b.heavyT === 0) b.mass = 1; }
      if (b.turboT > 0) b.turboT = Math.max(0, b.turboT - dt);
      if (b.anchorT > 0) b.anchorT = Math.max(0, b.anchorT - dt);
      if (b.squash > 0) b.squash = Math.max(0, b.squash - dt * 3);
      // steering builds momentum toward the held aim
      if (b.hold && b.anchorT <= 0) {
        var dx = b.aimx - b.x, dy = b.aimy - b.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) { var acc = STEER_ACC * (b.turboT > 0 ? TURBO_MULT : 1); b.vx += dx / d * acc * dt; b.vy += dy / d * acc * dt; }
      }
      // anchored = braced & immovable
      if (b.anchorT > 0) { b.vx *= 0.55; b.vy *= 0.55; }
      // friction / cap (momentum lingers)
      var fr = Math.exp(-FRICTION_K * dt); b.vx *= fr; b.vy *= fr;
      var cap = MAX_SPEED * (b.turboT > 0 ? TURBO_MULT : 1) * (b.dashT > 0 ? 1.4 : 1);
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > cap) { b.vx = b.vx / sp * cap; b.vy = b.vy / sp * cap; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      // edge teeter (dramatic wobble near the rim)
      var dc = Math.sqrt(b.x * b.x + b.y * b.y);
      b.teeter = dc > arenaR * 0.8 ? Math.min(1, (dc - arenaR * 0.8) / (arenaR * 0.2)) : 0;
    }
    function collide(a, b) {
      if (!a.alive || !b.alive) return;
      var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
      var ra = rOf(a), rb = rOf(b), min = ra + rb;
      if (d >= min || d === 0) return;
      var nx = dx / d, ny = dy / d;
      var ma = effMass(a), mb = effMass(b);
      // positional de-overlap (anchored ones hold their ground)
      var push = min - d, aFix = a.anchorT > 0 ? 0 : (b.anchorT > 0 ? 1 : mb / (ma + mb));
      var bFix = b.anchorT > 0 ? 0 : (a.anchorT > 0 ? 1 : ma / (ma + mb));
      a.x -= nx * push * aFix; a.y -= ny * push * aFix;
      b.x += nx * push * bFix; b.y += ny * push * bFix;
      // 1D elastic exchange along the normal (momentum = mass × velocity)
      var van = a.vx * nx + a.vy * ny, vbn = b.vx * nx + b.vy * ny;
      if (van - vbn <= 0) return; // separating already
      var na = ((ma - mb) * van + 2 * mb * vbn) / (ma + mb);
      var nb = ((mb - ma) * vbn + 2 * ma * van) / (ma + mb);
      a.vx += (na - van) * nx * REST; a.vy += (na - van) * ny * REST;
      b.vx += (nb - vbn) * nx * REST; b.vy += (nb - vbn) * ny * REST;
      // juice: squash + shockwave scaled by impact
      var impact = Math.abs(van - vbn);
      a.squash = Math.min(0.7, impact / 700); b.squash = Math.min(0.7, impact / 700);
      if (impact > 260) {
        shocks.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: 0, life: 0.5 });
        if (sfx && sfx.pop) sfx.pop();
        if (juice) juice.shake(Math.min(6, impact / 160));
      }
    }
    function edgeAndEnd() {
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i]; if (!b.alive) continue;
        var dc = Math.sqrt(b.x * b.x + b.y * b.y);
        // crowd gasp on a close save (teetering, but pulling back in)
        if (dc > arenaR * 0.92 && dc <= arenaR && b !== lastGaspBlob) {
          lastGaspBlob = b; if (sfx && sfx.gasp) sfx.gasp();
          setTimeout(function () { lastGaspBlob = null; }, 600);
        }
        if (dc > arenaR) knockOut(b);
      }
    }
    function stepPickups(dt) {
      if (over) return;
      pickupT -= dt;
      if (pickupT <= 0 && pickups.length < 2) { spawnPickup(); pickupT = 8 + Math.random() * 6; }
      for (var i = pickups.length - 1; i >= 0; i--) {
        var pk = pickups[i]; pk.x += pk.vx * dt; pk.y += pk.vy * dt; pk.ph += dt; pk.life -= dt;
        var got = false;
        for (var j = 0; j < blobs.length; j++) {
          var b = blobs[j]; if (!b.alive) continue;
          var dd = Math.hypot(b.x - pk.x, b.y - pk.y);
          if (dd < rOf(b) + 20) { grantPickup(b, pk); got = true; break; }
        }
        if (got || pk.life <= 0) pickups.splice(i, 1);
      }
    }
    function step(dt) {
      var i, j;
      for (i = 0; i < blobs.length; i++) if (!blobs[i].isPlayer && blobs[i].alive) botThink(blobs[i], dt);
      for (i = 0; i < blobs.length; i++) integrate(blobs[i], dt);
      for (i = 0; i < blobs.length; i++) for (j = i + 1; j < blobs.length; j++) collide(blobs[i], blobs[j]);
      edgeAndEnd();
      stepPickups(dt);
      for (i = shocks.length - 1; i >= 0; i--) { shocks[i].r += 900 * dt; shocks[i].life -= dt; if (shocks[i].life <= 0) shocks.splice(i, 1); }
      for (i = 0; i < blobs.length; i++) blobs[i].chatAge += dt;
      if (juice) juice.update(dt);
      checkRound();
    }
    // substepped advance shared by the rAF loop AND the test tick()
    function advance(seconds) {
      var remain = seconds;
      while (remain > 1e-4 && !over && !paused) {
        var h = Math.min(0.012, remain);
        step(h); remain -= h;
      }
      hud();
    }

    // ---------- drawing ----------
    function w2sx(x) { return W / 2 + x * scale; }
    function w2sy(y) { return H / 2 + y * scale; }
    function drawBlob(b) {
      var r = rOf(b) * scale;
      var sx = w2sx(b.x), sy = w2sy(b.y);
      if (b.fallT >= 0) { sy += b.fallT * b.fallT * 900 * scale * 0.02; r *= Math.max(0.1, 1 - b.fallT * 1.1); if (r < 1) return; }
      var wob = b.teeter > 0 ? Math.sin(performance.now() / 60) * b.teeter * 0.28 : 0;
      var sq = 1 + b.squash * 0.5, iq = 1 - b.squash * 0.4;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(wob);
      ctx.beginPath(); ctx.ellipse ? ctx.ellipse(0, 0, r * sq, r * iq, 0, 0, Math.PI * 2) : ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = b.color; ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.14); ctx.strokeStyle = b.isPlayer ? "#fff" : "rgba(0,0,0,.2)"; ctx.stroke();
      if (b.anchorT > 0) { ctx.strokeStyle = "rgba(120,200,255,.9)"; ctx.lineWidth = Math.max(2, r * 0.2); ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke(); }
      if (b.dashT > 0) { ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI * 2); ctx.stroke(); }
      // cute face
      var er = Math.max(1.5, r * 0.17), eo = r * 0.34;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-eo, -r * 0.1, er, 0, Math.PI * 2); ctx.arc(eo, -r * 0.1, er, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#20303a"; ctx.beginPath(); ctx.arc(-eo, -r * 0.1, er * 0.5, 0, Math.PI * 2); ctx.arc(eo, -r * 0.1, er * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#20303a"; ctx.lineWidth = Math.max(1.2, r * 0.06); ctx.beginPath();
      var mouth = b.teeter > 0.5 ? -0.2 : 0.15;
      ctx.arc(0, r * mouth, r * 0.32, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      if (b.heavyT > 0) { ctx.font = Math.max(10, r * 0.7) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🐘", 0, -r - 8); }
      else if (b.turboT > 0) { ctx.font = Math.max(10, r * 0.7) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🌀", 0, -r - 8); }
      ctx.restore();
      if (r > 8 && b.fallT < 0) {
        ctx.fillStyle = b.isPlayer ? "#9be15d" : "rgba(255,255,255,.92)"; ctx.font = "bold " + Math.max(10, Math.min(18, r * 0.5)) + "px Trebuchet MS, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 3;
        ctx.strokeText(b.name, sx, sy - r - 12); ctx.fillText(b.name, sx, sy - r - 12);
      }
      if (b.chatAge < 2.4 && Bots && Bots.bubble) Bots.bubble(ctx, { x: sx, y: sy - r - 26, text: b.chatText, age: b.chatAge });
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#10233a"); g.addColorStop(1, "#050b16");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var cx = w2sx(0), cy = w2sy(0), R = arenaR * scale;
      // the drop shadow beneath the floating dohyo
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse ? ctx.ellipse(cx, cy + R * 0.18, R * 1.02, R * 0.5, 0, 0, Math.PI * 2) : ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      // dohyo platform
      var pg = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.2, cx, cy, R);
      pg.addColorStop(0, "#e7c98f"); pg.addColorStop(1, "#c99a54");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = pg; ctx.fill();
      ctx.lineWidth = Math.max(4, R * 0.04); ctx.strokeStyle = "#fff"; ctx.stroke();
      // inner danger ring
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(200,60,60,.4)"; ctx.stroke();
      // shockwave rings
      for (var s = 0; s < shocks.length; s++) {
        var sk = shocks[s]; ctx.beginPath(); ctx.arc(w2sx(sk.x), w2sy(sk.y), sk.r * scale, 0, Math.PI * 2);
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255," + Math.max(0, sk.life * 1.6) + ")"; ctx.stroke();
      }
      // pickups drifting in
      for (var p = 0; p < pickups.length; p++) {
        var pk = pickups[p], px = w2sx(pk.x), py = w2sy(pk.y) + Math.sin(pk.ph * 3) * 4;
        ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fill();
        ctx.strokeStyle = "#ffb01f"; ctx.lineWidth = 3; ctx.stroke();
        ctx.font = "20px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(PICKUPS[pk.kind].emoji, px, py);
      }
      // KO'd (falling) first, then the living on top
      for (var i = 0; i < blobs.length; i++) if (!blobs[i].alive) drawBlob(blobs[i]);
      for (var k = 0; k < blobs.length; k++) if (blobs[k].alive) drawBlob(blobs[k]);
      if (juice) juice.draw(ctx);
    }

    // ---------- main loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) advance(dt);
      draw();
    }

    // ---------- input (phantom-tap safe: hold=steer, quick-release=DASH) ----------
    function pt(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    function pointWorld(px, py) { return { x: (px - W / 2) / scale, y: (py - H / 2) / scale }; }
    function setAim(px, py) { var wp = pointWorld(px, py); self.aimx = wp.x; self.aimy = wp.y; self.hold = true; }
    var pressStart = null, pressT = 0, moved = false;
    function onDown(px, py) { if (paused || over || !self.alive) return; pressStart = { x: px, y: py }; pressT = performance.now(); moved = false; setAim(px, py); }
    function onMove(px, py) {
      if (!pressStart || paused || over) return;
      if (Math.hypot(px - pressStart.x, py - pressStart.y) > 10) moved = true;
      setAim(px, py);
    }
    function onUp(px, py) {
      if (!pressStart) return;
      var quick = performance.now() - pressT < 150;
      if (!moved && quick) { // a quick tap → CHARGE DASH toward the tap point
        var wp = pointWorld(px, py); dash(wp.x - self.x, wp.y - self.y);
      }
      self.hold = false; pressStart = null; moved = false;
    }
    cv.addEventListener("mousedown", function (e) { var p = pt(e); onDown(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { if (!pressStart) return; var p = pt(e); onMove(p.x, p.y); });
    cv.addEventListener("mouseup", function (e) { var p = pt(e); onUp(p.x, p.y); });
    cv.addEventListener("mouseleave", function () { self.hold = false; pressStart = null; });
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); onDown(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); onMove(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); onUp(p.x, p.y); }, { passive: false });
    // desktop keyboard: arrows/WASD steer, space dashes
    var keys = {};
    function applyKeys() {
      var dx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
      var dy = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
      if (dx || dy) { self.aimx = self.x + dx * 600; self.aimy = self.y + dy * 600; self.hold = true; } else self.hold = false;
    }
    function onKeyDown(e) { if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); dash(); return; } keys[e.key] = 1; applyKeys(); }
    function onKeyUp(e) { keys[e.key] = 0; applyKeys(); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ---------- exit / banking ----------
    function bankExit() {
      if (over || banked) return;
      var bank = bankRun(false);
      if (bank && sfx && sfx.toast) sfx.toast("🥋 Sumo run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
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
    wrap.querySelector("#quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._sumo = {
      state: function () {
        return {
          round: round, roundsWon: roundsWon, roundsLost: roundsLost,
          alive: !!self.alive, botsAlive: aliveBots(), arenaR: arenaR,
          dashCd: self.dashCd, secondWindUsed: secondWindUsed,
          over: over, won: won, banked: banked, knockouts: knockouts,
          pos: { x: self.x, y: self.y }
        };
      },
      begin: begin,
      steer: function (dx, dy) {
        if (!dx && !dy) { self.hold = false; return; }
        self.aimx = self.x + dx * 1000; self.aimy = self.y + dy * 1000; self.hold = true;
      },
      dash: function () { dash(); },
      place: function (x, y) { self.x = x; self.y = y; self.vx = 0; self.vy = 0; },
      placeBot: function (i, x, y, vx, vy) {
        var bots = []; for (var k = 0; k < blobs.length; k++) if (!blobs[k].isPlayer) bots.push(blobs[k]);
        var b = bots[i]; if (!b) return;
        b.x = x; b.y = y; b.vx = vx || 0; b.vy = vy || 0; b.alive = true; b.fallT = -1; b.hold = false;
      },
      shove: function (dx, dy) { self.vx += dx || 0; self.vy += dy || 0; },
      koBots: function (n) {
        var c = 0;
        for (var k = 0; k < blobs.length && c < n; k++) { if (!blobs[k].isPlayer && blobs[k].alive) { knockOut(blobs[k]); c++; } }
        checkRound();
      },
      koMe: function () { knockOut(self); },
      give: function (kind) { give(kind); },
      tick: function (seconds) { advance(seconds || 0); }
    };

    // ---------- boot ----------
    begin();
    if (global._sumodemo) { // screenshot seed: mid round-3, shrunken ring, one blob flying off
      global._sumodemo = 0;
      round = 3; arenaR = BASE_R * Math.pow(0.8, 2); roundsWon = 1; roundsLost = 1;
      spawnRing();
      // knock most rivals out; leave 3 blobs (you + 2), one sailing off the edge
      var live = 0;
      for (var s = 0; s < blobs.length; s++) {
        var b = blobs[s];
        if (b.isPlayer) { b.x = -arenaR * 0.2; b.y = arenaR * 0.1; b.alive = true; }
        else if (live < 2) {
          live++;
          if (live === 2) { b.x = arenaR * 1.06; b.y = -arenaR * 0.15; b.vx = 520; b.vy = -120; b.fallT = 0.18; b.alive = false; }
          else { b.x = arenaR * 0.35; b.y = arenaR * 0.3; b.alive = true; b.teeter = 0.8; }
        } else { b.alive = false; b.fallT = 1.4; }
      }
      pickups = [{ kind: "heavy", x: arenaR * 0.7, y: -arenaR * 0.7, vx: -40, vy: 40, ph: 0, life: 12 }];
      shocks = [{ x: arenaR * 0.6, y: -arenaR * 0.2, r: 90, life: 0.4 }];
      knockouts = 4; hud();
      paused = true; // freeze for the screenshot
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxSumo = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
