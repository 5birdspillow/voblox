/*
 * Voblox arcade game — 👑 Card Clash (a kid-sized Clash-Royale lane battler).
 * ONE vertical arena: YOUR tower ❤️ at the bottom, the BOT'S tower at the top,
 * TWO lanes. Play unit cards from a hand of 4 (tap card → tap a lane half to
 * deploy). Units march their lane, fight what they meet, then batter the tower.
 * First tower down wins; a 3-minute soft cap ends it on tower HP.
 * VOCAB IS THE POWER CURVE:
 *   - ⚡ ELIXIR SURGE: answer a word (miniQuiz, NOT skippable) → +4 elixir NOW
 *     plus a one-time "next card costs 1 less" discount. Wrong still gives +1
 *     (we teach, we don't punish). The whole battle PAUSES while you think.
 * The bot plays on the same elixir rules; its brain sharpens with your rank
 * (botSkillFor). recordGame("clash") banks once per match — on win, on loss,
 * on quit, even on tab-close — and the reward is always SHOWN (Au: Leo saw no
 * Vobux when they were invisible or lost on close).
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;

  // fixed logical arena — scaled to the canvas so tests stay resolution-proof
  var AW = 420, AH = 640;
  var TOWER_HP = 100;
  var MATCH_CAP = 180; // seconds → sudden-death judging
  var ELIXIR_CAP = 10, ELIXIR_OVER = 12; // a SURGE can briefly overfill past the cap

  // ⚔️ THE COUNTER TRIANGLE — the whole strategy is which card beats which.
  // hp/dmg are chunky and readable; range<20 = melee, higher = shooter.
  // special flags: ranged, flies, blocksArrows, vsRanged, splash, ramTower, slowAura.
  var UNITS = {
    knight:    { name: "Knight",      emoji: "⚔️", cost: 3, hp: 42, dmg: 7,  speed: 46, range: 16,  cd: 0.9, tip: "tanky melee" },
    archer:    { name: "Archer",      emoji: "🏹", cost: 2, hp: 16, dmg: 5,  speed: 44, range: 120, cd: 0.9, ranged: true, tip: "fragile shooter" },
    shieldman: { name: "Shieldman",   emoji: "🛡", cost: 3, hp: 40, dmg: 4,  speed: 38, range: 16,  cd: 1.0, blocksArrows: true, tip: "blocks arrows" },
    rider:     { name: "Rider",       emoji: "🐎", cost: 4, hp: 34, dmg: 8,  speed: 84, range: 16,  cd: 0.8, vsRanged: true, tip: "fast, wrecks shooters" },
    wizard:    { name: "Wizard",      emoji: "🧙", cost: 5, hp: 20, dmg: 7,  speed: 42, range: 110, cd: 1.3, ranged: true, splash: true, tip: "splash blaster" },
    dragon:    { name: "Baby Dragon", emoji: "🐉", cost: 6, hp: 44, dmg: 8,  speed: 40, range: 90,  cd: 1.1, ranged: true, flies: true, tip: "flies — hits all, only air-hitters hit it", locked: "wins3" },
    ram:       { name: "Ram",         emoji: "⚙", cost: 4, hp: 52, dmg: 6,  speed: 40, range: 20,  cd: 1.0, ramTower: true, tip: "smashes TOWERS, ignores units", locked: "wins6" },
    freezer:   { name: "Freezer",     emoji: "🧊", cost: 3, hp: 26, dmg: 2,  speed: 40, range: 70,  cd: 1.1, ranged: true, slowAura: true, tip: "slows nearby foes" }
  };
  // the deck: 8 cards, in a fixed cycle order (played card goes to the back)
  var DECK = ["knight", "archer", "shieldman", "rider", "wizard", "freezer", "dragon", "ram"];

  // who can even be hit by whom (the 🐉 flies above swords)
  function canHit(attacker, target) {
    var ad = UNITS[attacker.kind], td = UNITS[target.kind];
    if (td.flies) return !!ad.ranged; // only shooters (and dragons — they're ranged) hit fliers
    return true;
  }
  // ⚔️ the counter multipliers (readable, chunky)
  function dmgMul(attacker, target) {
    var ad = UNITS[attacker.kind], td = UNITS[target.kind];
    if (ad.vsRanged && td.ranged) return 2;        // 🐎 Rider shreds shooters
    if (ad.ranged && !ad.splash && td.blocksArrows) return 0.4; // 🛡 blocks arrows (not splash/melee)
    return 1;
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("clash");
    // additive-only save fields (never touch stats.best — that's the platform score)
    // wins3 is OUR own additive counter (unlocks 🐉 at 3, ⚙ at 6). It is separate
    // from the platform's st.wins/st.plays/st.best, which recordGame owns — we
    // never touch those directly.
    stats.wins3 = stats.wins3 || 0;

    // 🔓 a card is playable once its unlock (if any) is met
    function unlocked(kind) {
      var need = UNITS[kind].locked;
      if (!need) return true;
      if (need === "wins3") return (stats.wins3 || 0) >= 3;
      if (need === "wins6") return (stats.wins3 || 0) >= 6;
      return true;
    }
    function lockLabel(kind) {
      var need = UNITS[kind].locked;
      if (need === "wins3") return "3 wins";
      if (need === "wins6") return "6 wins";
      return "";
    }

    var wrap = document.createElement("div"); wrap.className = "gamewrap clash";
    wrap.innerHTML =
      '<canvas id="clcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="clmsg">👑 Card Clash</div>' +
      '<div class="grow" style="flex-wrap:wrap;gap:6px"><span id="clelx" style="font-size:13px;white-space:nowrap;padding:4px 8px"></span>' +
      '<button class="embtn study" id="clsurge" style="min-width:0"><span class="ebl">⚡ SURGE</span><span class="ebs">answer a word</span></button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="clbig"></div>' +
      '<div class="gover" id="clq" style="display:none"></div>' +
      '<div class="gover" id="clend" style="display:none"></div>' +
      // the card hand reuses the existing #embar bottom-bar styling (fixed, scrolls
      // in a row) — only one game wrap ever mounts at a time, so no id collision.
      '<div id="embar"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#clcv"), ctx = cv.getContext("2d");

    // ---------- responsive letterbox (ONE logic space, both orientations) ----------
    cv.style.touchAction = "none"; // iOS: the arena is a tap surface, never a scroll/zoom target
    var W, H, S, OX, OY;
    function resize() {
      // retina: keep ALL game math in CSS px (W/H), but back the canvas with a
      // dpr-scaled buffer so emoji/text stay crisp at iPhone DPR3 (clamped to 2 for
      // memory). Same pattern as bjj/chef/fishing/karts. clash never calls
      // setTransform itself and its save/restore are balanced, so this is safe.
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      W = wrap.clientWidth; H = wrap.clientHeight;
      cv.style.width = W + "px"; cv.style.height = H + "px"; // clash has no shared canvas-size CSS rule → set it here
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS px; buffer is dpr-scaled
      var reserve = 118; // room for the HUD (top) + card hand (bottom bar)
      S = Math.min(W / AW, (H - reserve) / AH); // uniform fit, portrait or landscape
      OX = Math.max(0, (W - AW * S) / 2);
      OY = Math.max(30, (H - reserve - AH * S) / 2 + 30);
    }
    resize(); window.addEventListener("resize", resize);
    function X(x) { return OX + x * S; } // logical → screen
    function Y(y) { return OY + y * S; }
    function pz(n) { return n * S; }

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- opponent identity + brain (scaled by rank) ----------
    var skill = P.botSkillFor(stats.rankPts);
    var rival = Bots.pickOpponents(1, Math.max(0.25, skill))[0];
    var rivalCfg = rival.avatar, myCfg = AV.resolve(store.state);

    // ---------- match state ----------
    var running = true, raf = 0, lastT = performance.now();
    var over = false, won = false, paused = false, banked = false, endShown = false;
    var elixir = 0, botElixir = 0, elixTick = 0, botTick = 0;
    var myTower = TOWER_HP, foeTower = TOWER_HP, time = 0;
    var units = [], effects = [];
    var cycle = DECK.slice(), hand = [], selected = null, discount = 0; // cycle = the live 8-card queue; hand = first 4
    var surgeCd = 0, botPaused = false, unitsPlayed = 0, lastFmt = null;
    var uid = 1;

    // the two lane center-lines and the tower anchors (logical space)
    var LANE_X = [AW * 0.30, AW * 0.70];
    var MY_TOWER_Y = AH - 54, FOE_TOWER_Y = 54;
    var DEPLOY_LINE = AH * 0.5; // you may only deploy on YOUR (bottom) half

    // the HAND is always the first 4 cards of the live cycle queue
    function refillHand() { hand = cycle.slice(0, 4); }
    // played card leaves the hand and rotates to the BACK; the 5th card slides in
    function cycleCard(kind) {
      var idx = cycle.indexOf(kind);
      if (idx < 0) return;
      cycle.splice(idx, 1);   // pull it out…
      cycle.push(kind);       // …and send it to the back of the queue
      refillHand();
      selected = null;
    }

    // ---------- HUD ----------
    var msgEl = document.getElementById("clmsg"), bigEl = document.getElementById("clbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1200); }
    function hud() {
      var n = Math.floor(elixir);
      var pips = "💧".repeat(Math.min(ELIXIR_CAP, n));
      // compact chip: tiny pip icons + a big readable number (≥14px) + a short
      // discount badge — fits the 393px HUD row. <i>/<b> (not <span>) so the shared
      // ".ghud .grow span" white-pill rule can't wrap each inner piece.
      document.getElementById("clelx").innerHTML =
        '<i style="font-style:normal;font-size:11px">' + pips + '</i> ' +
        '<b style="font-size:15px">' + n + '</b>' +
        (discount > 0 ? ' <b style="color:#1e8f4e;font-size:12px">next −1</b>' : '');
      var sb = document.getElementById("clsurge");
      if (sb) { sb.style.opacity = surgeCd > 0 ? "0.55" : "1"; sb.querySelector(".ebs").textContent = surgeCd > 0 ? Math.ceil(surgeCd) + "s" : "answer a word"; }
    }

    // ---------- card hand (bottom bar of DOM buttons — onclick is phantom-safe) ----------
    function renderBar() {
      var bar = document.getElementById("embar");
      bar.innerHTML = hand.map(function (kind) {
        var u = UNITS[kind];
        var locked = !unlocked(kind);
        var cost = Math.max(1, u.cost - (discount > 0 ? 1 : 0));
        var can = !locked && elixir >= cost;
        return '<button class="embtn' + (selected === kind ? " mode" : "") + '" style="min-width:78px' + (can ? "" : ";opacity:.5") + '" data-card="' + kind + '"' + (locked ? " disabled" : "") + '>' +
          '<span class="ebl">' + (locked ? "🔒" : u.emoji) + " " + (locked ? "" : cost) + '</span>' +
          '<span class="ebs">' + (locked ? lockLabel(kind) : u.name) + "</span></button>";
      }).join("");
      Array.prototype.forEach.call(bar.querySelectorAll("[data-card]"), function (b) {
        b.onclick = function () {
          var kind = b.dataset.card;
          if (!unlocked(kind)) { big("🔒 Unlock with " + lockLabel(kind) + "!", "#ffd740"); return; }
          var cost = Math.max(1, UNITS[kind].cost - (discount > 0 ? 1 : 0));
          if (elixir < cost) { big("Not enough 💧 — hit ⚡ SURGE!", "#ffd740"); return; }
          selected = selected === kind ? null : kind;
          renderBar();
          if (selected) big("Tap YOUR half of a lane to deploy " + UNITS[kind].emoji, "#8ecdf7");
        };
      });
    }

    // ---------- deploying ----------
    function spawnUnit(side, kind, lane, y) {
      var u = UNITS[kind];
      var un = { id: uid++, side: side, kind: kind, lane: lane, x: LANE_X[lane], y: y, hp: u.hp, maxHp: u.hp, cd: Math.random() * 0.3, slow: 0, flash: 0, hitK: 0 };
      units.push(un);
      return un;
    }
    // YOU deploy: pay elixir, spend the one-time discount, cycle the hand
    function play(kind, lane) {
      if (over || paused) return false;
      if (hand.indexOf(kind) < 0 || !unlocked(kind)) return false;
      var cost = Math.max(1, UNITS[kind].cost - (discount > 0 ? 1 : 0));
      if (elixir < cost) return false;
      elixir -= cost;
      if (discount > 0) discount = 0; // one-time only
      // deploy just inside your half so units always have a march ahead of them
      var y = Math.min(AH - 96, Math.max(DEPLOY_LINE + 20, MY_TOWER_Y - 80));
      spawnUnit(0, kind, lane, y);
      unitsPlayed++;
      cycleCard(kind);
      if (juice) juice.burst(X(LANE_X[lane]), Y(y), "#69f0ae", 12);
      if (sfx && sfx.pop) sfx.pop();
      hud(); renderBar();
      return true;
    }

    // ---------- ⚡ ELIXIR SURGE (the word hook) ----------
    function openSurge(force) {
      if (over) return;
      if (!force && surgeCd > 0) { big("⚡ Surge recharging… " + Math.ceil(surgeCd) + "s", "#ffd740"); return; }
      paused = true; // BOTH sides freeze while Leo thinks
      cv._lastQ = VQ.miniQuiz(document.getElementById("clq"), words, store, {
        title: "⚡ Answer for an ELIXIR SURGE!",
        lastFormat: lastFmt, skippable: false, // the whole point is he practices
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt; paused = false;
          surgeCd = 8;
          if (ok) {
            elixir = Math.min(ELIXIR_OVER, elixir + 4); // burst can briefly overfill
            discount = 1; // next card costs 1 less
            big("⚡ SURGE! +4 💧 and your next card is CHEAPER!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) { juice.shake(5); juice.burst(60, 60, "#ffe14d", 18); }
          } else {
            elixir = Math.min(ELIXIR_OVER, elixir + 1); // still a little juice — we teach
            big("A trickle of elixir… +1 💧. Keep studying!", "#8ecdf7");
          }
          hud(); renderBar();
        }
      });
    }

    // ---------- the bot brain ----------
    // low skill: dumps random affordable cards. high skill: saves for its 5-6 cost
    // combos and answers your lane pushes by dropping units in the lane you're
    // stacking. The bot deploys on ITS (top) half and marches DOWN.
    var botCycle = DECK.slice(), botHand = [], botThink = 1.5;
    function botRefill() { botHand = botCycle.slice(0, 4); }
    botRefill();
    function botPlay(kind, lane) {
      var cost = UNITS[kind].cost;
      if (botElixir < cost) return;
      botElixir -= cost;
      var y = Math.max(96, FOE_TOWER_Y + 70);
      spawnUnit(1, kind, lane, y);
      var bi = botCycle.indexOf(kind); if (bi >= 0) { botCycle.splice(bi, 1); botCycle.push(kind); }
      botRefill();
    }
    function botTurn(dt) {
      if (botPaused) return;
      botThink -= dt;
      if (botThink > 0) return;
      botThink = Math.max(0.6, 2.4 - skill * 1.6); // sharper bots act faster
      // save-up discipline scales with skill: dumb bots spend at 3, smart bots hoard
      var floor = 2 + Math.round(skill * 4);
      if (botElixir < floor) return;
      // pick an affordable card the bot has unlocked at its own level (bot ignores locks)
      var affordable = botHand.filter(function (k) { return UNITS[k].cost <= botElixir; });
      if (!affordable.length) return;
      var kind;
      if (skill > 0.5) {
        // smart: prefer the priciest affordable card (its combo) …
        affordable.sort(function (a, b) { return UNITS[b].cost - UNITS[a].cost; });
        kind = affordable[0];
      } else {
        kind = affordable[Math.floor(Math.random() * affordable.length)];
      }
      // …and answer your push: drop into whichever lane YOU are stacking
      var lane = Math.random() < 0.5 ? 0 : 1;
      if (skill > 0.4) {
        var mine = [0, 0];
        units.forEach(function (u) { if (u.side === 0) mine[u.lane]++; });
        if (mine[0] !== mine[1]) lane = mine[0] > mine[1] ? 0 : 1;
      }
      botPlay(kind, lane);
    }

    // ---------- combat step ----------
    function nearestFoe(u) {
      var best = null, bd = 1e9;
      for (var i = 0; i < units.length; i++) {
        var o = units[i];
        if (o.side === u.side || o.lane !== u.lane) continue;
        if (!canHit(u, o)) continue; // 🐉 fliers are only hittable by ranged
        var d = Math.abs(o.y - u.y);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }
    function hurt(u, dmg) {
      u.hp -= dmg; u.flash = 0.12;
      if (juice && Math.random() < 0.4) juice.text(X(u.x), Y(u.y - 18), "-" + Math.round(dmg), "#ffd740");
      if (u.hp <= 0) {
        var i = units.indexOf(u); if (i >= 0) units.splice(i, 1);
        if (juice) juice.burst(X(u.x), Y(u.y), u.side === 0 ? "#69f0ae" : "#ff8a8a", 10);
        if (sfx && sfx.pop && Math.random() < 0.4) sfx.pop();
      }
    }
    function towerHit(side, dmg) { // side whose tower is TAKING damage
      if (side === 0) myTower = Math.max(0, myTower - dmg); else foeTower = Math.max(0, foeTower - dmg);
      if (juice) juice.shake(3);
      hud();
      if (myTower <= 0 && !over) endMatch(false);
      else if (foeTower <= 0 && !over) endMatch(true);
    }
    function step(dt) {
      time += dt;
      surgeCd = Math.max(0, surgeCd - dt);
      // 💧 elixir regen — 1 per 2s for both sides (cap 10; a SURGE can overfill YOURS)
      elixTick += dt; if (elixTick >= 2) { elixTick -= 2; if (elixir < ELIXIR_CAP) elixir = Math.min(ELIXIR_CAP, elixir + 1); hud(); renderBar(); }
      botTick += dt; if (botTick >= 2) { botTick -= 2; botElixir = Math.min(ELIXIR_CAP, botElixir + 1); }
      botTurn(dt);

      // 🧊 slow auras: freezers chill nearby enemies (reset each frame, reapply)
      units.forEach(function (u) { u.slow = Math.max(0, u.slow - dt); });
      units.forEach(function (f) {
        if (!UNITS[f.kind].slowAura) return;
        units.forEach(function (o) {
          if (o.side !== f.side && Math.abs(o.y - f.y) < 90 && o.lane === f.lane) o.slow = 0.6;
        });
      });

      // each unit: advance toward the enemy tower, fight what's in front, hit tower
      for (var i = units.length - 1; i >= 0; i--) {
        var u = units[i];
        if (units.indexOf(u) < 0) continue; // may have died this frame
        var ud = UNITS[u.kind];
        u.flash = Math.max(0, u.flash - dt);
        u.cd = Math.max(0, u.cd - dt);
        var dir = u.side === 0 ? -1 : 1; // side 0 marches up (−y), bot marches down (+y)
        var sp = ud.speed * (u.slow > 0 ? 0.5 : 1);
        var foe = ud.ramTower ? null : nearestFoe(u);
        var target = null, targetY = 0, isTower = false;
        if (foe && Math.abs(foe.y - u.y) <= ud.range + 14) { target = foe; targetY = foe.y; }
        else {
          // no unit in reach: is the enemy tower in range?
          var towerY = u.side === 0 ? FOE_TOWER_Y : MY_TOWER_Y;
          if (Math.abs(towerY - u.y) <= ud.range + 26) { isTower = true; targetY = towerY; }
        }
        if (target) {
          if (u.cd <= 0) {
            u.cd = ud.cd; u.hitK = time;
            var dmg = ud.dmg * dmgMul(u, target);
            hurt(target, dmg);
            if (ud.splash) { // 🧙 wizard splashes the whole cluster in its lane
              units.forEach(function (o) { if (o.side !== u.side && o !== target && o.lane === u.lane && Math.abs(o.y - target.y) < 40) hurt(o, dmg * 0.6); });
              if (juice) juice.burst(X(target.x), Y(target.y), "#c9b6ff", 10);
            }
          }
        } else if (isTower) {
          if (u.cd <= 0) {
            u.cd = ud.cd; u.hitK = time;
            var td = ud.ramTower ? ud.dmg * 4 : ud.dmg; // ⚙ Ram hits towers 4×
            towerHit(u.side === 0 ? 1 : 0, td);
          }
        } else {
          u.y += dir * sp * dt; // march
        }
      }

      // ⏱ soft cap → the lower-hp tower loses (tie = draw)
      if (time >= MATCH_CAP && !over) {
        if (myTower === foeTower) endMatch(null);
        else endMatch(foeTower < myTower);
      }
    }

    // ---------- economy: ONE banking path (books.js bankRun pattern) ----------
    function runRewards(win) {
      // won ? 30 flat : a small consolation that grows with effort (books.js pattern)
      var gems = win ? 30 : Math.min(12, 3 + unitsPlayed);
      return {
        win: !!win,
        score: unitsPlayed * 6 + (100 - foeTower) + (win ? 200 : 0), // tower damage dealt + a win bonus
        rankPtsDelta: win ? Math.min(12, 5 + (stats.wins3 || 0)) : 2,
        xp: Math.min(80, 10 + unitsPlayed * 3 + (win ? 30 : 0)),
        gems: gems
      };
    }
    function bankRun(win) {
      if (banked) return null;
      banked = true;
      var rw = runRewards(win);
      var res = store.recordGame ? store.recordGame("clash", rw) : null;
      return { rw: rw, res: res };
    }
    function endMatch(result) { // true win, false loss, null draw
      if (over) return; over = true; paused = true; won = result === true;
      var win = result === true, draw = result === null;
      var bank = bankRun(win) || { rw: runRewards(win), res: null };
      var rw = bank.rw, res = bank.res;
      if (win) { stats.wins3 = (stats.wins3 || 0) + 1; store.save(); } // additive win counter → unlocks
      var newUnlock = "";
      if (win && stats.wins3 === 3) newUnlock = "🐉 Baby Dragon UNLOCKED!";
      if (win && stats.wins3 === 6) newUnlock = "⚙ Ram UNLOCKED!";
      showEnd(win, draw, rw, res, newUnlock);
    }
    function showEnd(win, draw, rw, res, newUnlock) {
      endShown = true;
      var end = document.getElementById("clend");
      var title = draw ? "⏱ Time! A perfect draw." : win ? "👑 VICTORY! " + rival.name + "'s tower falls!" : "💔 " + rival.name + " took your tower…";
      var payRow = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP</div>";
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:460px"><div style="font-size:44px">' + (win ? "🏆" : draw ? "⏱" : "💔") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + title + "</div>" + payRow +
        '<div style="margin:2px 0">❤️ Your tower: ' + myTower + '  ·  🏯 ' + rival.name + ": " + foeTower + "</div>" +
        (newUnlock ? '<div style="margin:4px 0;color:#b06a00;font-weight:900">' + newUnlock + "</div>" : "") +
        '<div style="margin:2px 0;font-size:12px;color:#5a6b7a">🃏 ' + unitsPlayed + " cards played" + (res && res.rankedUp ? "  ·  🎖 RANK UP!" : "") + "</div>" +
        '<div style="display:flex;gap:8px;justify-content:center;margin-top:8px">' +
        '<button class="submit" id="clrematch">Rematch ➜</button>' +
        '<button class="embtn" id="clnew" style="min-width:130px"><span class="ebl">🔀 New rival</span><span class="ebs">fresh opponent</span></button></div></div>';
      end.style.display = "flex";
      if (win && sfx && sfx.fanfare) sfx.fanfare();
      if (win && juice) { juice.shake(6); for (var c = 0; c < 5; c++) juice.burst(W * (0.2 + c * 0.15), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][c], 16); }
      document.getElementById("clrematch").onclick = function () { begin(); };
      document.getElementById("clnew").onclick = function () { rival = Bots.pickOpponents(1, Math.max(0.25, skill), [rival.id])[0]; rivalCfg = rival.avatar; begin(); };
    }

    // ---------- start / restart a match ----------
    function begin() {
      over = false; won = false; paused = false; banked = false; endShown = false;
      elixir = 5; botElixir = 5; elixTick = 0; botTick = 0;
      myTower = TOWER_HP; foeTower = TOWER_HP; time = 0;
      units = []; effects = []; discount = 0; surgeCd = 0; unitsPlayed = 0; botPaused = false;
      cycle = DECK.slice(); botCycle = DECK.slice(); botThink = 1.5; selected = null;
      refillHand(); botRefill();
      document.getElementById("clend").style.display = "none";
      msgEl.innerHTML = "👑 <b>Card Clash</b> vs " + rival.name;
      big("👑 CLASH! Drop cards, smash the tower!", "#ffe14d");
      hud(); renderBar();
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function bar(cx, cy, wpx, f, col) {
      if (f >= 1) return;
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(cx - wpx / 2, cy, wpx, 5);
      ctx.fillStyle = col; ctx.fillRect(cx - wpx / 2, cy, wpx * Math.max(0, f), 5);
    }
    function drawTower(y, hp, mine, cfg, name) {
      var cx = X(AW / 2), cy = Y(y);
      // avatar head beside the tower (chessclub.js pattern)
      if (AV && AV.drawHead) AV.drawHead(ctx, { x: X(AW / 2) + (mine ? -AW * 0.36 * S : AW * 0.36 * S), y: cy, size: Math.max(20, pz(34)), config: cfg });
      ctx.font = "bold " + Math.round(pz(46)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(mine ? "❤️" : "🏯", cx, cy);
      // tower HP bar
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(cx - pz(60), cy + pz(30), pz(120), pz(9));
      ctx.fillStyle = mine ? "#69f0ae" : "#ff8a8a"; ctx.fillRect(cx - pz(60), cy + pz(30), pz(120) * (hp / TOWER_HP), pz(9));
      ctx.fillStyle = "#fff"; ctx.font = "bold " + Math.round(pz(13)) + "px Trebuchet MS";
      ctx.fillText((mine ? "YOU" : name) + "  " + hp, cx, cy + pz(48));
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // arena backdrop
      var g = ctx.createLinearGradient(0, OY, 0, Y(AH)); g.addColorStop(0, "#7a4d8f"); g.addColorStop(0.5, "#3f6a8f"); g.addColorStop(1, "#3f8f6a");
      ctx.fillStyle = g; ctx.fillRect(X(0), Y(0), pz(AW), pz(AH));
      // the river / midline
      ctx.fillStyle = "rgba(90,180,230,.5)"; ctx.fillRect(X(0), Y(AH / 2 - 10), pz(AW), pz(20));
      // your deploy zone glow when a card is picked
      if (selected) { ctx.fillStyle = "rgba(105,240,174,.15)"; ctx.fillRect(X(0), Y(DEPLOY_LINE), pz(AW), pz(AH - DEPLOY_LINE)); }
      // lane guides
      [0, 1].forEach(function (l) {
        ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X(LANE_X[l]), Y(90)); ctx.lineTo(X(LANE_X[l]), Y(AH - 90)); ctx.stroke();
      });
      // towers
      drawTower(FOE_TOWER_Y, foeTower, false, rivalCfg, rival.name);
      drawTower(MY_TOWER_Y, myTower, true, myCfg, "YOU");
      // units
      var uS = pz(30);
      units.forEach(function (u) {
        var ud = UNITS[u.kind];
        var bob = Math.sin(time * 6 + u.id) * pz(2) + (u.hitK && time - u.hitK < 0.2 ? -pz(4) : 0);
        var cx = X(u.x), cy = Y(u.y) + bob;
        ctx.font = Math.round(uS * (ud.flies ? 1.15 : 1)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (u.flash > 0) { ctx.save(); ctx.globalAlpha = 0.55; }
        ctx.fillText(ud.emoji, cx, cy);
        if (u.flash > 0) ctx.restore();
        if (u.slow > 0) { ctx.font = Math.round(uS * 0.5) + "px serif"; ctx.fillText("🧊", cx + uS * 0.4, cy - uS * 0.3); }
        // a tiny team dot so friend/foe reads at a glance
        ctx.fillStyle = u.side === 0 ? "#69f0ae" : "#ff6b6b";
        ctx.beginPath(); ctx.arc(cx, cy + uS * 0.5, pz(3.2), 0, Math.PI * 2); ctx.fill();
        bar(cx, cy - uS * 0.55, uS * 0.8, u.hp / u.maxHp, u.side === 0 ? "#69f0ae" : "#ff8a8a");
      });
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input (discrete, phantom-tap safe) ----------
    function tap(px, py) {
      if (over || paused || !selected) return;
      var lx = (px - OX) / S, ly = (py - OY) / S;
      if (ly < DEPLOY_LINE) { big("Deploy on YOUR half (bottom)!", "#ffd740"); return; }
      var lane = lx < AW / 2 ? 0 : 1;
      play(selected, lane);
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var r = cv.getBoundingClientRect(); tap(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top); }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); tap(e.clientX - r.left, e.clientY - r.top); });
    document.getElementById("clsurge").onclick = function () { openSurge(false); };

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; // clamp: no huge catch-up steps
      if (!paused && !over) step(dt);
      draw();
    }

    // leaving mid-match (or closing the app) always BANKS + says so
    function bankExit() {
      if (over || unitsPlayed === 0) return;
      var bank = bankRun(false);
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("👑 Clash run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (the specs are written against this exact shape) ----------
    cv._clash = {
      state: function () {
        return {
          elixir: elixir, botElixir: botElixir, myTower: myTower, foeTower: foeTower,
          over: over, won: won, banked: banked, paused: paused, time: time, discount: discount,
          surgeCd: surgeCd, unitsPlayed: unitsPlayed, wins3: stats.wins3 || 0,
          hand: hand.slice(),
          units: units.map(function (u) { return { id: u.id, side: u.side, kind: u.kind, lane: u.lane, y: u.y, hp: u.hp, slow: u.slow }; })
        };
      },
      begin: begin,
      play: play,
      give: function (n) { elixir = Math.min(ELIXIR_OVER, elixir + n); hud(); renderBar(); },
      surge: function () { openSurge(true); },
      damageTower: function (side, n) { towerHit(side, n); },
      botPause: function (on) { botPaused = !!on; },
      // extra helper (beyond the required API): drop a BOT unit for deterministic
      // counter tests — the bot never plays on demand, so specs need this.
      spawnFoe: function (kind, lane, y) { return spawnUnit(1, kind, lane, y === undefined ? FOE_TOWER_Y + 70 : y); },
      spawnMine: function (kind, lane, y) { return spawnUnit(0, kind, lane, y === undefined ? MY_TOWER_Y - 80 : y); },
      rival: function () { return { name: rival.name, id: rival.id }; }
    };

    // first paint + boot the match
    hud();
    begin();
    // guarded demo hook (books.js pattern): a lively mid-battle board for screenshots
    if (global._clashdemo) setTimeout(function () {
      global._clashdemo = 0;
      begin();
      cv._clash.give(6);
      cv._clash.play("knight", 0); cv._clash.play("archer", 1);
      cv._clash.botPause(false);
      spawnUnit(1, "knight", 1, AH * 0.4); spawnUnit(1, "archer", 0, AH * 0.42);
    }, 700);
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxClash = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
