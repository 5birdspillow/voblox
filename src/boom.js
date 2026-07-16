/*
 * Voblox arcade game — 💣 BOOM BLOCKS (a kid-kind Bomberman-lite arena brawl).
 * A 13×11 tile arena: indestructible pillars in the classic grid, soft 📦 crates
 * filling the rest, and FOUR fighters in the corners — you 🧢 plus three named
 * bots from the roster. Drop 💣 bombs, blow crates, and POP opponents into
 * floaty bubbles 🫧 (never gore — they just POOF away). Last one standing wins
 * the round; best-of-3 takes the match.
 * VOCAB IS THE MERCY + THE EDGE, never a wall:
 *   - 💥 REVIVE: the FIRST time each match you get popped, a WORD (miniQuiz)
 *     poofs you back to your corner with a 2s shield. Once only — then you're out.
 *   - 🎁 STARTING BOOST: between rounds, answer a word to begin the next round
 *     already holding a power-up (correct only; a miss is a kind "fight on").
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("boom")
 * per match, banked on match-end, quit, AND app-close. Stats persist additively
 * (stats.matchWins, stats.crates). Rewards are always SHOWN.
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  // ---------- arena constants ----------
  var COLS = 13, ROWS = 11;
  var EMPTY = 0, WALL = 1, CRATE = 2, HAZARD = 3;
  var FUSE = 2.0, FLAME_LIFE = 0.45, BASE_SPEED = 3.4, START_RANGE = 2;
  var KICK_SPEED = 6.0, SD_TIME = 120, CRATE_CHANCE = 0.82, DROP_CHANCE = 0.4;

  var DIRV = { N: { dx: 0, dy: -1 }, S: { dx: 0, dy: 1 }, E: { dx: 1, dy: 0 }, W: { dx: -1, dy: 0 } };
  var DIRS = [DIRV.N, DIRV.E, DIRV.S, DIRV.W];
  var DIRNAMES = ["N", "E", "S", "W"];

  // 📦 crates drop these (40%); each also the between-round STARTING BOOST menu
  var POWERS = {
    range: { e: "🔥", name: "+Blast" },
    bomb: { e: "💣", name: "+Bomb" },
    speed: { e: "👟", name: "+Speed" },
    kick: { e: "🧤", name: "Kick" },
    shield: { e: "🛡", name: "Shield" }
  };
  var POWER_KEYS = ["range", "bomb", "speed", "kick", "shield"];
  var COLORS = ["#40c4ff", "#ff6b6b", "#ffd23f", "#69f0ae"];

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("boom");
    stats.matchWins = stats.matchWins || 0;   // additive save fields (never renamed)
    stats.crates = stats.crates || 0;

    // ---------- DOM: fullscreen canvas + HUD, inline styles so no new CSS ----------
    var wrap = document.createElement("div");
    wrap.className = "gamewrap boom";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="bmcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="bmmsg">💣 Boom Blocks</div>' +
      '<div class="grow"><span id="bmround">Round 1</span><span id="bmwl">🏆 0–0</span>' +
      '<span id="bmpw">💣1 🔥2</span><span id="bmalive">👥 4</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="bmbig"></div>' +
      // 💣 drop button (bottom-right): a discrete DOM tap, phantom-safe
      '<button id="bmdrop" type="button" style="position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);' +
      'bottom:calc(env(safe-area-inset-bottom,0px) + 18px);z-index:8;width:78px;height:78px;border-radius:50%;' +
      'background:radial-gradient(circle at 35% 30%,#ff8a5b,#d63a2f);border:3px solid #fff6;color:#fff;' +
      'font-size:34px;font-family:inherit;padding:0;line-height:1;box-shadow:0 6px 0 #8a2018,0 10px 22px #0007;cursor:pointer">💣</button>' +
      '<div class="gover" id="bmq" style="display:none"></div>' +
      '<div class="gover" id="bmround-card" style="display:none"></div>' +
      '<div class="gover" id="bmcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#bmcv"), ctx = cv.getContext("2d");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- responsive letterbox (both orientations fit the SAME grid) ----------
    // Retina-sharp backing store (min(dpr,2)); all game code stays in CSS px.
    var W, H, TS, OX, OY;
    function resize() {
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      W = wrap.clientWidth || global.innerWidth || 360;
      H = wrap.clientHeight || global.innerHeight || 640;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var top = Math.min(W, H) < 520 ? 84 : 110, bot = 96; // room for HUD + drop button
      TS = Math.min((W - 12) / COLS, (H - top - bot) / ROWS);
      if (TS <= 0) TS = 1;
      OX = Math.max(0, (W - COLS * TS) / 2);
      OY = top + Math.max(0, (H - top - bot - ROWS * TS) / 2);
    }
    resize(); window.addEventListener("resize", resize);
    function PX(col) { return OX + (col + 0.5) * TS; }
    function PY(row) { return OY + (row + 0.5) * TS; }

    // ---------- match / round state ----------
    var running = true, raf = 0, lastT = performance.now();
    var grid = [], safe = {};
    var players = [], you = null, bots = [];
    var bombs = [], flames = [], items = [], pops = [];
    var round = 0, roundsWon = 0, roundsLost = 0, crates = 0;
    var over = false, won = false, banked = false, paused = false, roundOver = false;
    var revived = false, reviveOpen = false, matchT = 0, sdNext = 0, lastFmt = null;
    var spiral = [];

    // corners: you bottom-left; three bots the other corners
    var CORNERS = [
      { c: 1, r: ROWS - 2 }, { c: 1, r: 1 }, { c: COLS - 2, r: 1 }, { c: COLS - 2, r: ROWS - 2 }
    ];

    // ---------- roster: you + three named bots (skill from rank) ----------
    function buildRoster() {
      var rankPts = stats.rankPts || 0;
      var skill = P && P.botSkillFor ? P.botSkillFor(rankPts) : 0.4;
      var opp = Bots && Bots.pickOpponents ? Bots.pickOpponents(3, skill) :
        [{ name: "Bomber A", skill: 0.4 }, { name: "Bomber B", skill: 0.4 }, { name: "Bomber C", skill: 0.4 }];
      players = [];
      players.push(mkPlayer(true, "You", "🧢", COLORS[0], CORNERS[0], skill));
      for (var i = 0; i < 3; i++) {
        var b = opp[i] || { name: "Bot", skill: skill };
        players.push(mkPlayer(false, b.name, null, COLORS[i + 1], CORNERS[i + 1], b.skill || skill));
      }
      you = players[0];
      bots = players.slice(1);
    }
    function mkPlayer(isYou, name, emoji, color, corner, skill) {
      return {
        you: isYou, name: name, emoji: emoji, color: color, corner: corner, skill: skill,
        col: corner.c, row: corner.r, dir: "S", alive: true, out: false,
        range: START_RANGE, capacity: 1, speed: BASE_SPEED, kick: false, shield: 0,
        bombsOut: 0, input: { x: 0, y: 0 }, think: 0.4 + Math.random() * 0.4, bombCd: 0
      };
    }

    // ---------- arena build ----------
    function buildArena() {
      grid = []; safe = {};
      CORNERS.forEach(function (cn) { // keep an L of clear tiles at each spawn
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
          safe[(cn.c + o[0]) + "," + (cn.r + o[1])] = 1;
        });
      });
      for (var r = 0; r < ROWS; r++) {
        grid.push([]);
        for (var c = 0; c < COLS; c++) {
          var t;
          if (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1) t = WALL; // outer ring
          else if (r % 2 === 0 && c % 2 === 0) t = WALL;                        // classic pillars
          else if (safe[c + "," + r]) t = EMPTY;                                // spawn safe-zone
          else t = Math.random() < CRATE_CHANCE ? CRATE : EMPTY;                // soft crates
          grid[r].push(t);
        }
      }
      // precompute the sudden-death shrink spiral (outer ring → inward, clockwise)
      spiral = [];
      var lo = 0, hiC = COLS - 1, hiR = ROWS - 1, loR = 0;
      while (lo <= hiC && loR <= hiR) {
        for (var c2 = lo; c2 <= hiC; c2++) spiral.push({ c: c2, r: loR });
        for (var r2 = loR + 1; r2 <= hiR; r2++) spiral.push({ c: hiC, r: r2 });
        for (var c3 = hiC - 1; c3 >= lo; c3--) spiral.push({ c: c3, r: hiR });
        for (var r3 = hiR - 1; r3 > loR; r3--) spiral.push({ c: lo, r: r3 });
        lo++; hiC--; loR++; hiR--;
      }
    }

    // ---------- HUD ----------
    var msgEl = document.getElementById("bmmsg"), bigEl = document.getElementById("bmbig");
    function bigFlash(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1200);
    }
    function botsAlive() { var n = 0; bots.forEach(function (b) { if (b.alive) n++; }); return n; }
    function hud() {
      document.getElementById("bmround").textContent = "Round " + Math.max(1, round);
      document.getElementById("bmwl").textContent = "🏆 " + roundsWon + "–" + roundsLost;
      document.getElementById("bmpw").textContent = "💣" + (you ? you.capacity : 1) + " 🔥" + (you ? you.range : 2) +
        (you && you.speed > BASE_SPEED ? " 👟" : "") + (you && you.kick ? " 🧤" : "") + (you && you.shield > 0 ? " 🛡" : "");
      document.getElementById("bmalive").textContent = "👥 " + ((you && you.alive ? 1 : 0) + botsAlive());
    }

    // ---------- lobby ----------
    function showLobby() {
      paused = true;
      var el = document.getElementById("bmround-card");
      var names = bots.map(function (b) { return b.name; }).join(", ");
      el.innerHTML = '<div class="wqcard" style="text-align:center;max-width:520px">' +
        '<div style="font-size:44px">💣📦</div>' +
        '<div class="wqtitle" style="font-size:20px">Boom Blocks</div>' +
        '<div style="margin:4px 0 8px;color:#5a6b7a;font-weight:bold">Blast crates, pop rivals into bubbles, be the last one standing! Best of 3 vs ' + names + '.</div>' +
        '<div style="font-size:11px;color:#8a98a8;margin-bottom:8px">Move: drag / WASD · Bomb: tap, Space, or the 💣 button · Get popped once? A WORD revives you!</div>' +
        '<button class="submit big-next" id="bmplay" type="button">FIGHT! ➜</button></div>';
      el.style.display = "flex";
      document.getElementById("bmplay").onclick = function () { startMatch(); };
    }

    // ---------- match / round flow ----------
    function startMatch() {
      roundsWon = 0; roundsLost = 0; crates = 0; round = 1;
      over = false; won = false; banked = false; revived = false;
      you.startBoost = null;
      document.getElementById("bmcard").style.display = "none";
      document.getElementById("bmround-card").style.display = "none";
      buildRound();
      paused = false;
      msgEl.innerHTML = "💣 <b>Boom Blocks</b> — last one standing!";
      bigFlash("Round 1 — FIGHT!", "#ffe14d");
      hud();
    }
    function buildRound() {
      roundOver = false; matchT = 0; sdNext = SD_TIME;
      bombs = []; flames = []; items = []; pops = [];
      buildArena();
      players.forEach(function (p) {
        p.col = p.corner.c; p.row = p.corner.r; p.dir = "S";
        p.alive = true; p.out = false; p.bombsOut = 0; p.input = { x: 0, y: 0 };
        p.range = START_RANGE; p.capacity = 1; p.speed = BASE_SPEED; p.kick = false; p.shield = 0;
        p.think = 0.5 + Math.random() * 0.5; p.bombCd = 0;
      });
      if (you.startBoost) { grant(you, you.startBoost); you.startBoost = null; }
      hud();
    }
    function nextRound() {
      round++;
      buildRound();
      showRoundCard();
    }
    function showRoundCard() {
      paused = true;
      var el = document.getElementById("bmround-card");
      el.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:40px">💣</div>' +
        '<div class="wqtitle" style="font-size:20px">Round ' + round + ' — FIGHT!</div>' +
        '<div style="font-size:13px;color:#5a6b7a;margin:4px 0 8px">Score: 🏆 ' + roundsWon + '–' + roundsLost +
        '<br>🎁 Answer a word to START with a power-up:</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">' +
        POWER_KEYS.map(function (k) {
          return '<button class="embtn" style="min-width:76px" data-pw="' + k + '"><span class="ebl">' + POWERS[k].e +
            '</span><span class="ebs">' + POWERS[k].name + '</span></button>';
        }).join("") + '</div>' +
        '<button class="submit big-next" id="bmfight" type="button">Fight! ➜</button></div>';
      el.style.display = "flex";
      Array.prototype.forEach.call(el.querySelectorAll("[data-pw]"), function (b) {
        b.onclick = function () { pickBoostWord(b.dataset.pw); };
      });
      document.getElementById("bmfight").onclick = function () {
        el.style.display = "none"; paused = false; bigFlash("Round " + round + " — FIGHT!", "#ffe14d");
      };
    }
    function pickBoostWord(k) {
      cv._lastQ = VQ.miniQuiz(document.getElementById("bmq"), words, store, {
        title: "🎁 Answer to start with " + POWERS[k].e + " " + POWERS[k].name + "!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (ok) { grant(you, k); bigFlash(POWERS[k].e + " Power-up ready!", "#69f0ae"); }
          else bigFlash("Almost — fight on! ➜", "#ffd740");
          document.getElementById("bmround-card").style.display = "none"; paused = false; hud();
        }
      });
    }
    function checkRoundEnd() {
      if (roundOver || over) return;
      var alive = players.filter(function (p) { return p.alive; });
      if (alive.length <= 1) { roundOver = true; endRound(alive[0] || null); }
    }
    function endRound(winner) {
      paused = true;
      if (winner && winner.you) { roundsWon++; bigFlash("🏆 You win the round!", "#69f0ae"); }
      else if (winner) { roundsLost++; bigFlash("💥 " + winner.name + " takes the round…", "#ff8a8a"); }
      hud();
      if (roundsWon >= 2 || roundsLost >= 2) { endMatch(roundsWon >= 2); return; }
      nextRound();
    }

    // ---------- reward economy (books/dungeon bankRun pattern) ----------
    function runRewards(w) {
      var gems = w ? 20 + roundsWon * 10 + crates : 5 + roundsWon * 8 + Math.floor(crates / 2);
      var xp = Math.min(80, 10 + roundsWon * 8 + crates * 2 + (w ? 20 : 0));
      return {
        win: !!w, score: roundsWon * 100 + crates,
        rankPtsDelta: w ? Math.min(12, 8 + roundsWon) : Math.min(6, 2 + roundsWon),
        xp: xp, gems: gems
      };
    }
    function bankRun(w) {
      if (banked) return null;
      banked = true;
      var rw = runRewards(w);
      var res = store.recordGame ? store.recordGame("boom", rw) : null;
      return { rw: rw, res: res };
    }
    function endMatch(w) {
      if (over) return;
      over = true; won = w; paused = true; roundOver = true;
      if (w) stats.matchWins = (stats.matchWins || 0) + 1;
      stats.crates = (stats.crates || 0) + crates;
      store.save();
      var bank = bankRun(w) || { rw: runRewards(w), res: null };
      var rw = bank.rw, res = bank.res;
      var card = document.getElementById("bmcard");
      var title = w ? "🏆 MATCH WON! You out-boomed them all!" : "💥 Match over — the crown slips away…";
      card.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:44px">' + (w ? "🏆" : "💣") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + title + '</div>' +
        '<div style="margin:4px 0">🏆 Rounds ' + roundsWon + '–' + roundsLost + ' · 📦 ' + crates + ' crates busted</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP' + (res && res.rankedUp ? '<br>🎖 RANK UP!' : '') + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;margin-top:6px">' +
        '<button class="submit big-next" id="bmrematch" type="button">Rematch</button>' +
        '<button class="wqskip" id="bmleave" type="button">Leave</button></div></div>';
      card.style.display = "flex";
      if (w && sfx && sfx.fanfare) sfx.fanfare();
      if (w && juice) { juice.shake(6); for (var i = 0; i < 5; i++) juice.burst(W * (0.2 + i * 0.15), H * 0.35, COLORS[i % 4], 16); }
      document.getElementById("bmrematch").onclick = function () { startMatch(); };
      document.getElementById("bmleave").onclick = exit;
    }

    // ---------- power-ups ----------
    function grant(pl, k) {
      if (k === "range") pl.range++;
      else if (k === "bomb") pl.capacity++;
      else if (k === "speed") pl.speed += 0.7;
      else if (k === "kick") pl.kick = true;
      else if (k === "shield") pl.shield = Math.max(pl.shield, 6);
      if (pl === you) hud();
    }
    function collectItems(pl) {
      var c = Math.round(pl.col), r = Math.round(pl.row);
      for (var i = items.length - 1; i >= 0; i--) {
        if (items[i].c === c && items[i].r === r) {
          grant(pl, items[i].type);
          if (pl.you) { bigFlash(POWERS[items[i].type].e + " " + POWERS[items[i].type].name + "!", "#69f0ae"); if (sfx && sfx.coin) sfx.coin(); }
          items.splice(i, 1);
        }
      }
    }

    // ---------- bombs & blasts ----------
    function bombAt(c, r) { for (var i = 0; i < bombs.length; i++) if (bombs[i].col === c && bombs[i].row === r) return bombs[i]; return null; }
    function bombBlocks(pl, c, r) {
      var b = bombAt(c, r); if (!b) return false;
      // a fighter may step OFF the bomb they're currently standing on, not back on
      if (Math.round(pl.col) === c && Math.round(pl.row) === r) return false;
      return true;
    }
    function dropBombFor(pl) {
      if (!pl.alive || over || paused) return false;
      if (pl.bombsOut >= pl.capacity) return false;
      var c = Math.round(pl.col), r = Math.round(pl.row);
      if (grid[r][c] !== EMPTY || bombAt(c, r)) return false;
      bombs.push({ col: c, row: r, fuse: FUSE, owner: pl, range: pl.range, kickV: null });
      pl.bombsOut++;
      if (sfx && sfx.pop) sfx.pop();
      return true;
    }
    function kickBomb(b, dir) { var d = DIRV[dir]; b.kickV = { dx: d.dx, dy: d.dy }; }
    // the cross of tiles a bomb reaches: center + each arm, stopping at wall / after a crate
    function blastPath(b) {
      var cells = [{ c: b.col, r: b.row, crate: false }];
      DIRS.forEach(function (d) {
        for (var k = 1; k <= b.range; k++) {
          var c = b.col + d.dx * k, r = b.row + d.dy * k;
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
          var t = grid[r][c];
          if (t === WALL) break;
          cells.push({ c: c, r: r, crate: t === CRATE });
          if (t === CRATE) break;
        }
      });
      return cells;
    }
    function dangerAt(c, r) {
      for (var i = 0; i < bombs.length; i++) {
        var path = blastPath(bombs[i]);
        for (var j = 0; j < path.length; j++) if (path[j].c === c && path[j].r === r) return true;
      }
      return false;
    }
    function destroyCrate(c, r) {
      grid[r][c] = EMPTY; crates++;
      if (Math.random() < DROP_CHANCE) items.push({ c: c, r: r, type: POWER_KEYS[Math.floor(Math.random() * POWER_KEYS.length)] });
      if (juice) juice.burst(PX(c), PY(r), "#c98a4a", 8);
    }
    function detonate(first) {
      var queue = [first], hit = {};
      while (queue.length) {
        var b = queue.shift();
        var idx = bombs.indexOf(b); if (idx < 0) continue;
        bombs.splice(idx, 1);
        if (b.owner) b.owner.bombsOut = Math.max(0, b.owner.bombsOut - 1);
        var path = blastPath(b);
        for (var i = 0; i < path.length; i++) {
          var cell = path[i];
          flames.push({ c: cell.c, r: cell.r, life: FLAME_LIFE });
          hit[cell.c + "," + cell.r] = 1;
          if (cell.crate) destroyCrate(cell.c, cell.r);
          else {
            var chain = bombAt(cell.c, cell.r);
            if (chain && queue.indexOf(chain) < 0) queue.push(chain);
          }
        }
      }
      if (juice) juice.shake(5);
      if (sfx && sfx.tone) sfx.tone(80, 0.3, 0.09);
      // pop anyone caught in the freshly-lit cross
      players.forEach(function (p) { if (p.alive && hit[Math.round(p.col) + "," + Math.round(p.row)]) popPlayer(p, false); });
    }
    function explodeAll() { bombs.slice().forEach(function (b) { if (bombs.indexOf(b) >= 0) detonate(b); }); }

    // ---------- popping & revive ----------
    function addPop(pl) { pops.push({ col: pl.col, row: pl.row, life: 1.2, color: pl.color }); }
    function popPlayer(pl, force) {
      if (reviveOpen || over) return;
      if (!pl.alive || pl.out) return;
      if (!force && pl.shield > 0) { pl.shield = 0; if (juice) juice.burst(PX(pl.col), PY(pl.row), "#69f0ae", 10); hud(); return; }
      if (pl.you && !revived) { openRevive(pl); return; }  // the once-per-match mercy
      pl.alive = false; pl.out = true; pl.input = { x: 0, y: 0 };
      addPop(pl);
      if (sfx && sfx.pop) sfx.pop();
      if (juice) juice.burst(PX(pl.col), PY(pl.row), pl.color, 16);
      hud();
      checkRoundEnd();
    }
    function openRevive(pl) {
      reviveOpen = true; paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("bmq"), words, store, {
        title: "💥 POPPED! Answer to POOF back with a 🛡 shield!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; reviveOpen = false; paused = false;
          if (ok) {
            revived = true; pl.revived = true; pl.alive = true; pl.out = false; pl.shield = 2.0;
            pl.col = pl.corner.c; pl.row = pl.corner.r; pl.input = { x: 0, y: 0 };
            bigFlash("✨ Revived! 2s shield — GO!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else {
            revived = true; pl.alive = false; pl.out = true; addPop(pl);
            bigFlash("💫 Out! GG — nice try!", "#8ecdf7");
            checkRoundEnd();
          }
          hud();
        }
      });
    }

    // ---------- movement (grid-snapped, dungeon.js drag-stick style) ----------
    function canEnter(pl, c, r) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
      if (grid[r][c] !== EMPTY) return false;
      if (bombBlocks(pl, c, r)) return false;
      return true;
    }
    function movePlayer(pl, dt) {
      var inx = pl.input.x, iny = pl.input.y;
      if (Math.abs(inx) < 0.1 && Math.abs(iny) < 0.1) return;
      var dir = Math.abs(inx) >= Math.abs(iny) ? (inx < 0 ? "W" : "E") : (iny < 0 ? "N" : "S");
      var d = DIRV[dir], sp = pl.speed * dt;
      var cc = Math.round(pl.col), cr = Math.round(pl.row);
      pl.dir = dir;
      if (d.dx !== 0) {
        var dy = cr - pl.row; if (Math.abs(dy) > 1e-4) pl.row += clamp(dy, -sp, sp);
        if (Math.abs(cr - pl.row) > 0.12) return;              // align to lane before advancing
        var nc = cc + d.dx;
        if (canEnter(pl, nc, cr)) pl.col += d.dx * sp;
        else {
          pl.col += clamp(cc - pl.col, -sp, sp);
          var b = bombAt(nc, cr); if (b && pl.kick && Math.abs(pl.col - cc) < 0.12) kickBomb(b, dir);
        }
      } else {
        var dx = cc - pl.col; if (Math.abs(dx) > 1e-4) pl.col += clamp(dx, -sp, sp);
        if (Math.abs(cc - pl.col) > 0.12) return;
        var nr = cr + d.dy;
        if (canEnter(pl, cc, nr)) pl.row += d.dy * sp;
        else {
          pl.row += clamp(cr - pl.row, -sp, sp);
          var b2 = bombAt(cc, nr); if (b2 && pl.kick && Math.abs(pl.row - cr) < 0.12) kickBomb(b2, dir);
        }
      }
    }

    // ---------- bot AI: dodge blasts, hunt crates, chase when powered ----------
    function safeNeighbor(b) {
      var cc = Math.round(b.col), cr = Math.round(b.row), best = null;
      DIRNAMES.forEach(function (dir) {
        var d = DIRV[dir], c = cc + d.dx, r = cr + d.dy;
        if (canEnter(b, c, r) && !dangerAt(c, r)) best = best || dir;
      });
      return best;
    }
    function nearestOf(b, pred) {
      var best = null, bd = 1e9, cc = Math.round(b.col), cr = Math.round(b.row);
      for (var r = 1; r < ROWS - 1; r++) for (var c = 1; c < COLS - 1; c++) {
        if (!pred(c, r)) continue;
        var dd = Math.abs(c - cc) + Math.abs(r - cr);
        if (dd < bd) { bd = dd; best = { c: c, r: r, d: dd }; }
      }
      return best;
    }
    function stepToward(b, tgt) {
      if (!tgt) return { x: 0, y: 0 };
      var cc = Math.round(b.col), cr = Math.round(b.row);
      var opts = [];
      DIRNAMES.forEach(function (dir) {
        var d = DIRV[dir], c = cc + d.dx, r = cr + d.dy;
        if (canEnter(b, c, r) && !dangerAt(c, r)) opts.push({ dir: dir, d: d, dist: Math.abs(c - tgt.c) + Math.abs(r - tgt.r) });
      });
      if (!opts.length) return { x: 0, y: 0 };
      opts.sort(function (a, z) { return a.dist - z.dist; });
      var pick = Math.random() < b.skill ? opts[0] : opts[Math.floor(Math.random() * opts.length)];
      return { x: pick.d.dx, y: pick.d.dy };
    }
    function adjacentCrate(b) {
      var cc = Math.round(b.col), cr = Math.round(b.row);
      for (var i = 0; i < DIRS.length; i++) {
        var r = cr + DIRS[i].dy, c = cc + DIRS[i].dx;
        if (grid[r] && grid[r][c] === CRATE) return true;
      }
      return false;
    }
    function botThink(b, dt) {
      b.bombCd = Math.max(0, b.bombCd - dt);
      var cc = Math.round(b.col), cr = Math.round(b.row);
      if (dangerAt(cc, cr)) {                                  // flee the danger map
        var fd = safeNeighbor(b);
        b.input = fd ? { x: DIRV[fd].dx, y: DIRV[fd].dy } : { x: 0, y: 0 };
        b.think = 0.08; return;
      }
      b.think -= dt; if (b.think > 0) return;
      b.think = 0.25 + (1 - b.skill) * 0.45;
      // adjacent to a crate (or a rival, if powered) and can retreat? bomb it
      var powered = b.range > START_RANGE || b.capacity > 1;
      if (b.bombCd <= 0 && (adjacentCrate(b) || (powered && Math.random() < b.skill)) && safeNeighbor(b)) {
        if (dropBombFor(b)) { b.bombCd = 1.6; var fd2 = safeNeighbor(b); b.input = fd2 ? { x: DIRV[fd2].dx, y: DIRV[fd2].dy } : b.input; return; }
      }
      var tgt = powered && Math.random() < b.skill
        ? nearestOf(b, function (c, r) { return players.some(function (p) { return p.alive && !p.you === !b.you ? false : (p !== b && p.alive && Math.round(p.col) === c && Math.round(p.row) === r); }); })
        : nearestOf(b, function (c, r) { return grid[r][c] === CRATE; }) ||
          nearestOf(b, function (c, r) { return items.some(function (it) { return it.c === c && it.r === r; }); });
      b.input = stepToward(b, tgt);
    }

    // ---------- sudden death: the arena shrinks to a hazard ring ----------
    function shrinkStep() {
      // find the next non-hazard spiral tile and turn it to lava
      for (var i = 0; i < spiral.length; i++) {
        var s = spiral[i];
        if (grid[s.r][s.c] !== HAZARD) {
          grid[s.r][s.c] = HAZARD;
          bombs = bombs.filter(function (b) { return !(b.col === s.c && b.row === s.r); });
          players.forEach(function (p) { if (p.alive && Math.round(p.col) === s.c && Math.round(p.row) === s.r) popPlayer(p, true); });
          return;
        }
      }
    }

    // ---------- per-frame simulation ----------
    function readYourInput() {
      if (!you.alive) return;
      if (touchActive) you.input = { x: moveVec.x, y: moveVec.y };
      else if (keyHeld.W || keyHeld.A || keyHeld.S || keyHeld.D)
        you.input = { x: (keyHeld.D ? 1 : 0) - (keyHeld.A ? 1 : 0), y: (keyHeld.S ? 1 : 0) - (keyHeld.W ? 1 : 0) };
      // else: keep whatever move()/AI set (lets test move() persist)
    }
    function moveBomb(b, dt) {
      if (!b.kickV) return;
      var sp = KICK_SPEED * dt, cc = Math.round(b.col), cr = Math.round(b.row);
      if (b.kickV.dx !== 0) {
        var nc = cc + b.kickV.dx;
        if (nc < 0 || nc >= COLS || grid[cr][nc] !== EMPTY || bombAt(nc, cr) || onTile(nc, cr)) { b.col = cc; b.kickV = null; }
        else b.col += b.kickV.dx * sp;
      } else {
        var nr = cr + b.kickV.dy;
        if (nr < 0 || nr >= ROWS || grid[nr][cc] !== EMPTY || bombAt(cc, nr) || onTile(cc, nr)) { b.row = cr; b.kickV = null; }
        else b.row += b.kickV.dy * sp;
      }
    }
    function onTile(c, r) { return players.some(function (p) { return p.alive && Math.round(p.col) === c && Math.round(p.row) === r; }); }
    function step(dt) {
      if (over || paused) return;
      matchT += dt;
      readYourInput();
      players.forEach(function (p) {
        if (!p.alive) return;
        if (!p.you) botThink(p, dt);
        movePlayer(p, dt);
        collectItems(p);
        if (p.shield > 0) p.shield = Math.max(0, p.shield - dt);
      });
      // bombs: slide (kicked) + fuse down; detonate the due ones
      var due = [];
      for (var i = 0; i < bombs.length; i++) { moveBomb(bombs[i], dt); bombs[i].fuse -= dt; if (bombs[i].fuse <= 0) due.push(bombs[i]); }
      due.forEach(function (b) { if (bombs.indexOf(b) >= 0) detonate(b); });
      // flames fade; anyone standing in fire gets popped
      for (var f = flames.length - 1; f >= 0; f--) { flames[f].life -= dt; if (flames[f].life <= 0) flames.splice(f, 1); }
      players.forEach(function (p) {
        if (!p.alive) return;
        var c = Math.round(p.col), r = Math.round(p.row);
        if (grid[r][c] === HAZARD) { popPlayer(p, true); return; }
        for (var k = 0; k < flames.length; k++) if (flames[k].c === c && flames[k].r === r) { popPlayer(p, false); break; }
      });
      for (var pp = pops.length - 1; pp >= 0; pp--) { pops[pp].life -= dt; pops[pp].row -= dt * 0.8; if (pops[pp].life <= 0) pops.splice(pp, 1); }
      // ⏱ sudden death: start shrinking the ring
      if (matchT >= sdNext) { sdNext += 0.55; shrinkStep(); if (matchT < SD_TIME + 0.6) bigFlash("⏱ SUDDEN DEATH — the walls close in!", "#ff8a8a"); }
    }

    // ---------- draw ----------
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#2b3550"); bg.addColorStop(1, "#171c2b");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      if (!grid.length) return;
      var fs = Math.round(TS * 0.72);
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var x = OX + c * TS, y = OY + r * TS, t = grid[r][c];
        ctx.fillStyle = (r + c) % 2 ? "#3a4463" : "#333c58";
        ctx.fillRect(x, y, TS - 1, TS - 1);
        if (t === WALL) {
          ctx.fillStyle = (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1) ? "#5a6488" : "#7b6a9a";
          ctx.fillRect(x + 1, y + 1, TS - 3, TS - 3);
          ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(x + 2, y + 2, TS - 5, (TS - 5) * 0.4);
        } else if (t === CRATE) {
          ctx.font = fs + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("📦", x + TS / 2, y + TS / 2);
        } else if (t === HAZARD) {
          ctx.fillStyle = "rgba(255,90,50,.7)"; ctx.fillRect(x + 1, y + 1, TS - 3, TS - 3);
          ctx.font = fs + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🔥", x + TS / 2, y + TS / 2);
        }
      }
      // items
      ctx.font = Math.round(TS * 0.6) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      items.forEach(function (it) {
        var pulse = 1 + Math.sin(matchT * 6 + it.c) * 0.12;
        ctx.font = Math.round(TS * 0.6 * pulse) + "px serif"; ctx.fillText(POWERS[it.type].e, PX(it.c), PY(it.r));
      });
      // bombs (pulse faster as the fuse burns)
      bombs.forEach(function (b) {
        var pl = 1 + Math.sin((FUSE - b.fuse) * 12) * 0.14 * (1 - b.fuse / FUSE + 0.3);
        ctx.font = Math.round(TS * 0.66 * pl) + "px serif"; ctx.fillText("💣", PX(b.col), PY(b.row));
      });
      // flames
      flames.forEach(function (f) {
        ctx.globalAlpha = Math.max(0, f.life / FLAME_LIFE);
        ctx.font = Math.round(TS * 0.8) + "px serif"; ctx.fillText("💥", PX(f.c), PY(f.r));
        ctx.globalAlpha = 1;
      });
      // players
      players.forEach(function (p) {
        if (!p.alive) return;
        var px = PX(p.col), py = PY(p.row), rad = TS * 0.36;
        ctx.beginPath(); ctx.arc(px, py + TS * 0.04, rad, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 2; ctx.stroke();
        if (p.shield > 0) {
          ctx.strokeStyle = "rgba(105,240,174," + (0.5 + Math.sin(matchT * 8) * 0.3) + ")"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(px, py + TS * 0.04, rad + 4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.font = Math.round(TS * 0.5) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(p.emoji || "🙂", px, py + TS * 0.02);
        ctx.font = "bold " + Math.round(TS * 0.26) + "px Trebuchet MS"; ctx.fillStyle = "#fff";
        ctx.fillText(p.you ? "You" : p.name, px, py - TS * 0.5);
      });
      // 🫧 pops floating away
      pops.forEach(function (o) {
        ctx.globalAlpha = Math.max(0, o.life / 1.2);
        ctx.font = Math.round(TS * 0.7) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🫧", PX(o.col), PY(o.row)); ctx.globalAlpha = 1;
      });
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input ----------
    var moveVec = { x: 0, y: 0 }, touchActive = false, touchStart = null, touchTime = 0, dragging = false;
    var keyHeld = {};
    cv.addEventListener("touchstart", function (e) {
      e.preventDefault();
      var rc = cv.getBoundingClientRect(), tc = e.changedTouches[0];
      touchStart = { x: tc.clientX - rc.left, y: tc.clientY - rc.top };
      touchTime = performance.now(); dragging = false; touchActive = true;
    }, { passive: false });
    cv.addEventListener("touchmove", function (e) {
      if (!touchStart) return; e.preventDefault();
      var rc = cv.getBoundingClientRect(), tc = e.changedTouches[0];
      var dx = (tc.clientX - rc.left) - touchStart.x, dy = (tc.clientY - rc.top) - touchStart.y;
      if (Math.hypot(dx, dy) > 8) dragging = true;
      if (dragging) { var m = Math.hypot(dx, dy) || 1, cl = Math.min(1, m / 46); moveVec.x = dx / m * cl; moveVec.y = dy / m * cl; }
    }, { passive: false });
    function endTouch(e) {
      if (!touchStart) return; e.preventDefault();
      if (!dragging && performance.now() - touchTime < 160) dropBombFor(you); // a quick tap = drop
      touchStart = null; dragging = false; touchActive = false; moveVec.x = 0; moveVec.y = 0;
      if (you.alive) you.input = { x: 0, y: 0 };
    }
    cv.addEventListener("touchend", endTouch, { passive: false });
    cv.addEventListener("touchcancel", endTouch, { passive: false });
    cv.addEventListener("mousedown", function () { dropBombFor(you); }); // desktop: click = bomb

    // 💣 drop button: discrete tap (touchstart preventDefault kills the phantom mouse)
    var dropBtn = document.getElementById("bmdrop");
    function dropTap(e) { e.preventDefault(); dropBombFor(you); }
    dropBtn.addEventListener("touchstart", dropTap, { passive: false });
    dropBtn.addEventListener("mousedown", dropTap);

    function onKeyDown(e) {
      var k = e.key;
      if (k === " " || k === "Spacebar") { e.preventDefault(); dropBombFor(you); return; }
      if (k === "w" || k === "W" || k === "ArrowUp") keyHeld.W = true;
      else if (k === "s" || k === "S" || k === "ArrowDown") keyHeld.S = true;
      else if (k === "a" || k === "A" || k === "ArrowLeft") keyHeld.A = true;
      else if (k === "d" || k === "D" || k === "ArrowRight") keyHeld.D = true;
      else return;
      e.preventDefault();
    }
    function onKeyUp(e) {
      var k = e.key;
      if (k === "w" || k === "W" || k === "ArrowUp") keyHeld.W = false;
      else if (k === "s" || k === "S" || k === "ArrowDown") keyHeld.S = false;
      else if (k === "a" || k === "A" || k === "ArrowLeft") keyHeld.A = false;
      else if (k === "d" || k === "D" || k === "ArrowRight") keyHeld.D = false;
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      step(dt);
      draw();
    }

    // ---------- exit / banking ----------
    function bankExit() {
      if (over || round < 1 || banked) return;
      stats.crates = (stats.crates || 0) + crates; store.save();
      var b = bankRun(false);
      if (b && sfx && sfx.toast) sfx.toast("💣 Boom run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
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
    cv._boom = {
      state: function () {
        return {
          round: round, roundsWon: roundsWon, roundsLost: roundsLost,
          alive: !!(you && you.alive), botsAlive: botsAlive(),
          bombs: you ? you.capacity : 1, range: you ? you.range : START_RANGE,
          speed: you ? you.speed : BASE_SPEED, shield: !!(you && you.shield > 0),
          revived: revived, over: over, won: won, banked: banked, crates: crates,
          matchWins: stats.matchWins || 0
        };
      },
      begin: startMatch,
      move: function (dx, dy) { if (you) you.input = { x: dx, y: dy }; },
      warpTo: function (col, row) { if (you) { you.col = col; you.row = row; you.input = { x: 0, y: 0 }; } },
      dropBomb: function () { return dropBombFor(you); },
      explodeAll: explodeAll,
      grid: function () { return grid; },
      give: function (power) { grant(you, power); },
      popMe: function () { popPlayer(you, true); },
      popBots: function (n) {
        var cnt = 0;
        for (var i = 0; i < bots.length && cnt < n; i++) { if (bots[i].alive) { popPlayer(bots[i], true); cnt++; } }
      },
      tick: function (seconds) {
        var rem = seconds;
        while (rem > 0.0001) { var dt = Math.min(0.05, rem); rem -= dt; if (!over && !paused) step(dt); }
      }
    };

    // ---------- boot ----------
    buildRoster();
    hud();
    showLobby();
    if (global._boomdemo) setTimeout(function () { // demo hook: a lively mid-round board
      global._boomdemo = 0;
      startMatch();
      grant(bots[0], "range"); grant(bots[0], "bomb"); grant(bots[0], "speed"); // a powered-up bot on show
      cv._boom.warpTo(5, ROWS - 4);
      dropBombFor(you);
      bots[0].col = 7; bots[0].row = 5; dropBombFor(bots[0]);
      cv._boom.tick(1.9); // fuses nearly out — blasts about to pop and crates breaking
      paused = true;
    }, 700);
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxBoom = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
