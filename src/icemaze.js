/*
 * Voblox brain game — 🐧 ICE MAZE (a Pokémon ice-cave sliding puzzle).
 * The penguin stands on slick ice: pick a direction and it SLIDES until it
 * smacks into something — a wall, a rock, a pushed block, or the 🐟 fish that
 * clears the level. 24 hand-authored levels escalate the mechanics:
 *   1-6   plain walls & 🪨 rocks
 *   7-12  🕳 holes — fall in and you kindly slide again from the start
 *   13-18 ❄️ ice cracks that break after ONE pass (a second pass is a hole)
 *   19-24 🚪 one-way gates + 📦 a pushable ice block that slides ahead of you
 * This is a THINKING game: no timers, unlimited attempts, encouraging quips.
 *
 * VOCAB IS THE LEARNING LOOP, NEVER PUNISHMENT:
 *   - 💡 HINT: answer a word (miniQuiz) → the next best move flashes as an arrow
 *     (computed by a real BFS solver). Repeatable — every hint costs one word.
 *   - 🔑 LEVEL PACKS: levels 9-16 and 17-24 are word-gated the first time
 *     (one word each pack; the unlock persists forever).
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("icemaze")
 * per SESSION (the whole visit), banked once on Leave AND app-close. Stars persist
 * additively (stats.stars: level->best); pack unlocks persist (stats.packs).
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // 24 levels. Legend: # wall · . ice · R rock · O hole · C crack · F fish ·
  //   P penguin start · B pushable block · ^ v < > one-way gate (allowed dir).
  var LEVELS = [
    ["#####", "#P..#", "#.#.#", "#..F#", "#####"],
    ["######", "#P..R#", "#....#", "#R.F.#", "#....#", "######"],
    ["#######", "#P...R#", "#.....#", "#R..F.#", "#.....#", "#R...R#", "#######"],
    ["#######", "#P....#", "#.RRR.#", "#...R.#", "#.R..F#", "#.R.R.#", "#######"],
    ["#######", "#P..R.#", "#..R..#", "#R...R#", "#..F..#", "#.R..R#", "#######"],
    ["########", "#P....R#", "#RRRR..#", "#....R.#", "#.RR.R.#", "#.R.F..#", "#.R....#", "########"],
    ["######", "#P.O.#", "#....#", "#R..F#", "######"],
    ["#######", "#P...R#", "#.O...#", "#..O.R#", "#R..F.#", "#######"],
    ["#######", "#P..R.#", "#.O.O.#", "#....R#", "#R.F..#", "#.O.O.#", "#######"],
    ["########", "#P....R#", "#.O.O..#", "#R.O...#", "#..O.F.#", "#.O..O.#", "########"],
    ["#######", "#P...R#", "#.O.O.#", "#.....#", "#RO..F#", "#.O.O.#", "#######"],
    ["########", "#P....R#", "#.O.O..#", "#..O...#", "#R...F.#", "#.O.O..#", "########"],
    ["######", "#...F#", "#....#", "#..C.#", "#..P.#", "######"],
    ["######", "#F...#", "#....#", "#.C..#", "#.P..#", "######"],
    ["#######", "#P.C..#", "#..C..#", "#C...C#", "#..CF.#", "#######"],
    ["#######", "#PC...#", "#.C.C.#", "#...C.#", "#CC.F.#", "#######"],
    ["#######", "#P..C.#", "#.CC..#", "#..C.C#", "#C..F.#", "#######"],
    ["########", "#P..C..#", "#.CC.C.#", "#..C.C.#", "#C..CF.#", "########"],
    ["#######", "#PB..F#", "#.....#", "#....R#", "#######"],
    ["#######", "#P.B..#", "#.....#", "#..#F.#", "#....R#", "#######"],
    ["#######", "#P.>.F#", "#.....#", "#R...R#", "#######"],
    ["#######", "#P.B.F#", "#..>..#", "#R...R#", "#######"],
    ["#######", "#P.^..#", "#.>.F.#", "#..#..#", "#R...R#", "#######"],
    ["########", "#P.B.>F#", "#......#", "#R#..#R#", "#..>...#", "########"]
  ];
  var NAMES = [
    "First Slide", "Rocky Start", "Open Rink", "Rock Garden", "Slalom", "The Maze",
    "Mind the Gap", "Two Holes", "Hole Grid", "Careful Now", "Pit Stops", "Swiss Ice",
    "First Crack", "Thin Ice", "Crackle", "Crunch", "Fragile", "Shatterpath",
    "Push It", "Boxed In", "One-Way", "Block & Gate", "Turnstile", "Cold Finale"
  ];
  var QUIPS = [
    "🐧 Whoops — splash! Slide again!", "🕳 Down the hole! No worries, from the top!",
    "🐧 Brrr! Try a different path!", "❄️ That ice gave way — one more go!",
    "🐧 Almost! Reset and rethink!", "🐧 Slippery! Have another slide!"
  ];

  var DIRS = { up: { dc: 0, dr: -1 }, down: { dc: 0, dr: 1 }, left: { dc: -1, dr: 0 }, right: { dc: 1, dr: 0 } };
  function gateOf(ch) { return ch === "^" ? "up" : ch === "v" ? "down" : ch === "<" ? "left" : ch === ">" ? "right" : null; }
  function arrowFor(dir) { return dir === "up" ? "⬆️" : dir === "down" ? "⬇️" : dir === "left" ? "⬅️" : "➡️"; }
  function rep(s, n) { return n > 0 ? new Array(n + 1).join(s) : ""; }
  function cloneSet(o) { var x = {}; for (var k in o) x[k] = 1; return x; }

  // ---------- pure slide engine (shared by play + the BFS hint solver) ----------
  function baseAt(g, c, r) { if (r < 0 || r >= g.length || c < 0 || c >= g[0].length) return "#"; return g[r].charAt(c); }
  function parseLevel(rows) {
    var g = [], start = null, blocks = {};
    for (var r = 0; r < rows.length; r++) {
      var line = rows[r].split("");
      for (var c = 0; c < line.length; c++) {
        if (line[c] === "P") { start = { c: c, r: r }; line[c] = "."; }
        else if (line[c] === "B") { blocks[c + "," + r] = 1; line[c] = "."; }
      }
      g.push(line.join(""));
    }
    return { g: g, start: start, blocks: blocks };
  }
  // one full slide from st in dir; returns the resolved state + what happened.
  function simulate(g, st, dir) {
    var d = DIRS[dir], pc = st.pc, pr = st.pr;
    var blocks = cloneSet(st.blocks), broken = cloneSet(st.broken);
    var moved = false, fell = false, solved = false, pushedFrom = null, pushedTo = null, guard = 0;
    while (guard++ < 2000) {
      var nc = pc + d.dc, nr = pr + d.dr, ch = baseAt(g, nc, nr);
      if (ch === "#" || ch === "R") break;
      var gd = gateOf(ch); if (gd && gd !== dir) break;
      var bk = nc + "," + nr;
      if (blocks[bk]) {
        var bc = nc + d.dc, br = nr + d.dr, bch = baseAt(g, bc, br), bk2 = bc + "," + br;
        if (bch === "." && !blocks[bk2]) {
          delete blocks[bk]; blocks[bk2] = 1;
          if (pushedFrom === null) pushedFrom = { c: nc, r: nr };
          pushedTo = { c: bc, r: br };
          pc = nc; pr = nr; moved = true; continue;
        }
        break; // block can't move → penguin stops before it
      }
      if (ch === "C") {
        if (broken[bk]) { pc = nc; pr = nr; moved = true; fell = true; break; } // second pass = hole
        broken[bk] = 1; pc = nc; pr = nr; moved = true; continue; // first pass ok, now cracked
      }
      if (ch === "O") { pc = nc; pr = nr; moved = true; fell = true; break; }
      if (ch === "F") { pc = nc; pr = nr; moved = true; solved = true; break; }
      pc = nc; pr = nr; moved = true; // plain ice / passable gate
    }
    return { pc: pc, pr: pr, blocks: blocks, broken: broken, moved: moved, fell: fell, solved: solved, pushedFrom: pushedFrom, pushedTo: pushedTo };
  }
  function stateKey(st) {
    var bs = [], k; for (k in st.blocks) bs.push(k); bs.sort();
    var br = []; for (k in st.broken) br.push(k); br.sort();
    return st.pc + "," + st.pr + "|" + bs.join(";") + "|" + br.join(";");
  }
  // BFS over slide-states → { dir: first optimal move, par: shortest solve length }
  function solve(g, from) {
    var start = { pc: from.pc, pr: from.pr, blocks: cloneSet(from.blocks), broken: cloneSet(from.broken) };
    var q = [{ st: start, d: 0, fm: null }], seen = {}, n = 0, dirs = ["up", "down", "left", "right"];
    seen[stateKey(start)] = 1;
    while (q.length && n++ < 120000) {
      var cur = q.shift();
      for (var i = 0; i < 4; i++) {
        var r = simulate(g, cur.st, dirs[i]);
        if (!r.moved || r.fell) continue;
        var fm = cur.fm || dirs[i];
        if (r.solved) return { dir: fm, par: cur.d + 1 };
        var ns = { pc: r.pc, pr: r.pr, blocks: r.blocks, broken: r.broken }, nk = stateKey(ns);
        if (seen[nk]) continue;
        seen[nk] = 1; q.push({ st: ns, d: cur.d + 1, fm: fm });
      }
    }
    return null;
  }
  function packOf(lv) { return lv <= 8 ? 1 : lv <= 16 ? 2 : 3; }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("icemaze");
    stats.stars = stats.stars || {}; // level -> best stars (additive)
    stats.packs = stats.packs || {}; // "2"/"3" -> unlocked

    var wrap = document.createElement("div");
    wrap.className = "gamewrap icemaze";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="imcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="immsg">🐧 Ice Maze</div>' +
      '<div class="grow"><span id="imstat"></span><span id="imstars"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="imbig"></div>' +
      '<button id="imhint" type="button" style="display:none;position:absolute;left:calc(env(safe-area-inset-left, 0px) + 12px);' +
      'bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:8;background:linear-gradient(#ffe14d,#ffb01f);' +
      'color:#5a3d00;border:none;border-radius:14px;padding:11px 16px;font-family:inherit;font-weight:900;' +
      'font-size:15px;box-shadow:0 5px 0 #b9791a,0 8px 20px #0006;cursor:pointer">💡 Hint (a word)</button>' +
      '<button id="imretry" type="button" style="display:none;position:absolute;right:calc(env(safe-area-inset-right, 0px) + 12px);' +
      'bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:8;background:#eaf6ff;color:#2f5f86;' +
      'border:none;border-radius:14px;padding:11px 16px;font-family:inherit;font-weight:900;' +
      'font-size:15px;box-shadow:0 5px 0 #a9cbe4,0 8px 20px #0005;cursor:pointer">↺ Retry</button>' +
      '<div class="gover" id="imq" style="display:none"></div>' +
      '<div class="gover" id="imend" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#imcv"), ctx = cv.getContext("2d");
    var imq = document.getElementById("imq"), imend = document.getElementById("imend");
    var msgEl = document.getElementById("immsg"), bigEl = document.getElementById("imbig");
    var hintBtn = document.getElementById("imhint"), retryBtn = document.getElementById("imretry");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // Retina-sharp backing store (min(dpr,2)); all game code stays in CSS px.
    var W, H, cell, OX, OY;
    function resize() {
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      W = wrap.clientWidth || global.innerWidth || 360;
      H = wrap.clientHeight || global.innerHeight || 640;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize(); window.addEventListener("resize", resize);
    function metrics() {
      var gw = g[0].length, gh = g.length;
      var padV = 150, padH = 24;
      cell = Math.min((W - padH * 2) / gw, (H - padV) / gh, 108);
      OX = (W - cell * gw) / 2; OY = (H - cell * gh) / 2 + 8;
    }

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var g = null, start0 = null, initBlocks = {}, level = 0, par = 0;
    var pos = { c: 0, r: 0 }, blocks = {}, broken = {};
    var moves = 0, attempt = 1, solved = false, active = false, paused = false, sliding = false;
    var animP = { c: 0, r: 0 }, anim = null, animB = { c: 0, r: 0 };
    var hint = { dir: null, t: 0 }, snow = [];
    var sessionNewStars = 0, session3 = false, banked = false, lastFmt = null, demoStars = null;

    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1300); }
    function totalStars() { var s = 0; for (var k in stats.stars) s += stats.stars[k]; return s; }
    function packUnlocked(lv) { var p = packOf(lv); return p === 1 || !!stats.packs[p]; }
    function hud() {
      msgEl.innerHTML = active ? ("🐧 <b>" + level + ". " + NAMES[level - 1] + "</b>") : "🐧 Ice Maze";
      document.getElementById("imstat").textContent = active ? ("👣 " + moves + " / par " + par + (attempt > 1 ? "  ·  try " + attempt : "")) : "";
      var sv = demoStars != null ? demoStars : (stats.stars[level] || 0);
      document.getElementById("imstars").textContent = active ? (rep("⭐", sv) + rep("☆", 3 - sv)) : "";
    }

    // ---------- level flow ----------
    function beginLevel(n) {
      var parsed = parseLevel(LEVELS[n - 1]);
      level = n; g = parsed.g; start0 = parsed.start; initBlocks = cloneSet(parsed.blocks);
      pos = { c: start0.c, r: start0.r }; blocks = cloneSet(initBlocks); broken = {};
      moves = 0; attempt = 1; solved = false; active = true; paused = false; sliding = false;
      hint = { dir: null, t: 0 }; snow = []; anim = null;
      animP = { c: pos.c, r: pos.r };
      var sol = solve(g, { pc: pos.c, pr: pos.r, blocks: blocks, broken: broken });
      par = sol ? sol.par : 10;
      metrics(); // establish cell/OX/OY now so particle FX work before the first draw
      imend.style.display = "none"; imq.style.display = "none";
      hintBtn.style.display = "block"; retryBtn.style.display = "block";
      big("Slide to the 🐟 fish!", "#dff3ff");
      hud();
    }
    function restartAttempt(fromHole) {
      pos = { c: start0.c, r: start0.r }; blocks = cloneSet(initBlocks); broken = {};
      moves = 0; solved = false; sliding = false; anim = null; hint.dir = null;
      animP = { c: pos.c, r: pos.r };
      if (fromHole) { attempt++; big(QUIPS[(attempt) % QUIPS.length], "#8ecdf7"); if (sfx && sfx.buzz) sfx.buzz(); }
      imend.style.display = "none";
      hud();
    }
    function reset() { if (!active) return; restartAttempt(false); attempt = 1; hud(); }

    function onSolved() {
      solved = true; hint.dir = null;
      var earned = moves <= par ? 3 : moves <= par + 2 ? 2 : 1;
      var prev = stats.stars[level] || 0;
      if (earned > prev) {
        sessionNewStars += (earned - prev);
        if (earned === 3 && prev < 3) session3 = true;
        stats.stars[level] = earned;
        if (store.save) store.save();
      }
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(6); juice.burst(OX + (pos.c + 0.5) * cell, OY + (pos.r + 0.5) * cell, "#ffd23f", 22); }
      showStarCard(earned);
    }
    function showStarCard(earned) {
      var pool = Math.min(90, sessionNewStars * 6);
      var next = level + 1;
      var canNext = next <= 24 && packUnlocked(next);
      imend.innerHTML = '<div class="wqcard" style="text-align:center;max-width:420px">' +
        '<div style="font-size:44px">🐟</div>' +
        '<div class="wqtitle" style="font-size:20px">' + level + ". " + NAMES[level - 1] + " cleared!</div>" +
        '<div style="font-size:34px;margin:2px 0">' + rep("⭐", earned) + rep("☆", 3 - earned) + '</div>' +
        '<div style="font-size:12px;color:#5a6b7a">solved in ' + moves + " (par " + par + ") · 3⭐ at or under par</div>" +
        '<div style="margin:8px 0;font-weight:900;color:#2f9e44;font-size:16px">Session pool: +' + pool +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"></div>' +
        '<div style="font-size:11px;color:#8a98a8;margin-bottom:6px">banked when you Leave</div>' +
        '<button class="submit big-next" id="im_next" type="button">' + (canNext ? "Next level ➜" : "Level select") + "</button>" +
        '<button class="wqskip" id="im_replay" type="button">↺ replay for 3⭐</button>' +
        '<button class="wqskip" id="im_sel" type="button">level select</button></div>';
      imend.style.display = "flex";
      hintBtn.style.display = "none"; retryBtn.style.display = "none";
      document.getElementById("im_next").onclick = function () { if (canNext) beginLevel(next); else showSelect(); };
      document.getElementById("im_replay").onclick = function () { reset(); hintBtn.style.display = "block"; retryBtn.style.display = "block"; };
      document.getElementById("im_sel").onclick = showSelect;
    }

    function showSelect() {
      active = false; paused = true; solved = false; sliding = false; demoStars = null;
      hintBtn.style.display = "none"; retryBtn.style.display = "none";
      imq.style.display = "none";
      var cells = "";
      for (var n = 1; n <= 24; n++) {
        var open = packUnlocked(n), sn = stats.stars[n] || 0;
        var face = !open ? "🔒" : sn > 0 ? rep("⭐", sn) : "▶";
        cells += '<button class="embtn" style="min-width:96px' + (open ? "" : ";opacity:.5") + '" data-lv="' + n + '">' +
          '<span class="ebl">' + face + " " + n + '</span><span class="ebs">' + NAMES[n - 1] + "</span></button>";
      }
      imend.innerHTML = '<div class="wqcard" style="max-width:640px;max-height:84vh;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;text-align:center">' +
        '<div style="font-size:38px">🐧🧊🐟</div>' +
        '<div class="wqtitle" style="font-size:21px">Ice Maze</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin:2px 0 8px">Slide the penguin to the fish. It stops only when it hits something. ⭐' + totalStars() + "/72 stars</div>" +
        '<div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:center">' + cells + "</div>" +
        '<div style="font-size:11px;color:#8a98a8;margin-top:8px">🔑 Packs 9-16 &amp; 17-24 open with one word each. 💡 Hints cost a word too.</div></div>';
      imend.style.display = "flex";
      Array.prototype.forEach.call(imend.querySelectorAll("[data-lv]"), function (b) {
        b.onclick = function () {
          var n = +b.dataset.lv;
          if (packUnlocked(n)) beginLevel(n);
          else packQuiz(packOf(n));
        };
      });
      hud();
    }

    // ---------- word hooks ----------
    function hintQuiz() {
      if (!active || paused || sliding || solved) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(imq, words, store, {
        title: "💡 Answer a word to reveal the next best move!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            var sol = solve(g, { pc: pos.c, pr: pos.r, blocks: blocks, broken: broken });
            if (sol) { hint.dir = sol.dir; hint.t = 3.5; big("💡 Try " + arrowFor(sol.dir) + " !", "#ffe14d"); if (sfx && sfx.chime) sfx.chime(); }
            else big("💡 Hmm — try Retry!", "#ffd740");
          } else big("The hint melted away…", "#ff8a8a");
        }
      });
    }
    function packQuiz(pack) {
      if (pack !== 2 && pack !== 3) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(imq, words, store, {
        title: "🔑 Answer a word to unlock levels " + (pack === 2 ? "9-16" : "17-24") + "!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            stats.packs[pack] = 1; if (store.save) store.save();
            big("🔑 Unlocked levels " + (pack === 2 ? "9-16" : "17-24") + "!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            showSelect();
          } else { big("Still frozen shut — try again!", "#ff8a8a"); showSelect(); }
        }
      });
    }

    // ---------- sliding ----------
    function snowBurst() {
      var x = OX + (pos.c + 0.5) * cell, y = OY + (pos.r + 0.5) * cell;
      for (var i = 0; i < 10; i++) snow.push({ x: x, y: y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 200 - 30, t: 0.5, r: 2 + Math.random() * 3 });
      if (sfx && sfx.pop) sfx.pop();
    }
    function beginSlide(dir, instant) {
      if (!active || paused || sliding || solved) return;
      var res = simulate(g, { pc: pos.c, pr: pos.r, blocks: blocks, broken: broken }, dir);
      if (!res.moved) return;
      var fromC = pos.c, fromR = pos.r;
      pos.c = res.pc; pos.r = res.pr; blocks = res.blocks; broken = res.broken;
      moves++; hint.dir = null; hud();
      if (sfx && sfx.whoosh) sfx.whoosh();
      if (instant) { animP = { c: pos.c, r: pos.r }; snowBurst(); finishSlide(res); return; }
      var dist = Math.abs(res.pc - fromC) + Math.abs(res.pr - fromR);
      anim = { fromC: fromC, fromR: fromR, toC: res.pc, toR: res.pr, t: 0, dur: Math.max(0.09, dist * 0.05), res: res, blk: null };
      if (res.pushedFrom) { anim.blk = { fc: res.pushedFrom.c, fr: res.pushedFrom.r, tc: res.pushedTo.c, tr: res.pushedTo.r, key: res.pushedTo.c + "," + res.pushedTo.r }; animB = { c: res.pushedFrom.c, r: res.pushedFrom.r }; }
      sliding = true;
    }
    function finishSlide(res) {
      if (res.fell) { restartAttempt(true); }
      else if (res.solved) { snowBurst(); onSolved(); }
      else { snowBurst(); }
    }

    // ---------- input ----------
    var downX = 0, downY = 0, downOn = false;
    function localXY(clientX, clientY) { var rc = cv.getBoundingClientRect(); return { x: clientX - rc.left, y: clientY - rc.top }; }
    function dirFromDelta(dx, dy) { return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"); }
    function resolveGesture(x, y) {
      var dx = x - downX, dy = y - downY;
      if (Math.abs(dx) > 24 || Math.abs(dy) > 24) { beginSlide(dirFromDelta(dx, dy)); return; }
      if (!active || !g) return; // tap: direction relative to the penguin
      var px = OX + (animP.c + 0.5) * cell, py = OY + (animP.r + 0.5) * cell;
      beginSlide(dirFromDelta(x - px, y - py));
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = localXY(e.changedTouches[0].clientX, e.changedTouches[0].clientY); downX = p.x; downY = p.y; downOn = true; }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); if (!downOn) return; downOn = false; var p = localXY(e.changedTouches[0].clientX, e.changedTouches[0].clientY); resolveGesture(p.x, p.y); }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var p = localXY(e.clientX, e.clientY); downX = p.x; downY = p.y; downOn = true; });
    cv.addEventListener("mouseup", function (e) { if (!downOn) return; downOn = false; var p = localXY(e.clientX, e.clientY); resolveGesture(p.x, p.y); });
    function onKey(e) {
      var k = e.key, d = k === "ArrowUp" ? "up" : k === "ArrowDown" ? "down" : k === "ArrowLeft" ? "left" : k === "ArrowRight" ? "right" : null;
      if (d) { e.preventDefault(); beginSlide(d); }
    }
    document.addEventListener("keydown", onKey);
    hintBtn.onclick = hintQuiz; retryBtn.onclick = reset;

    // ---------- simulation ----------
    function ease(p) { return 1 - (1 - p) * (1 - p); }
    function step(dt) {
      if (sliding && anim) {
        anim.t += dt;
        var p = Math.min(1, anim.t / anim.dur), e = ease(p);
        animP.c = anim.fromC + (anim.toC - anim.fromC) * e;
        animP.r = anim.fromR + (anim.toR - anim.fromR) * e;
        if (anim.blk) { animB.c = anim.blk.fc + (anim.blk.tc - anim.blk.fc) * e; animB.r = anim.blk.fr + (anim.blk.tr - anim.blk.fr) * e; }
        if (p >= 1) { sliding = false; var res = anim.res; anim = null; finishSlide(res); }
      } else if (!sliding) { animP.c = pos.c; animP.r = pos.r; }
      for (var i = snow.length - 1; i >= 0; i--) { var s = snow[i]; s.t -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 700 * dt; if (s.t <= 0) snow.splice(i, 1); }
      if (hint.t > 0) hint.t -= dt;
      if (juice) juice.update(dt);
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function glyph(ch, cx, cy, sz) { ctx.font = Math.round(sz) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(ch, cx, cy); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#8fc3e8"); bg.addColorStop(1, "#3f6f9c");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      if (!active || !g) { if (juice) juice.draw(ctx); return; }
      metrics();
      var gw = g[0].length, gh = g.length, gs = cell * 0.66;
      for (var r = 0; r < gh; r++) for (var c = 0; c < gw; c++) {
        var ch = g[r].charAt(c), x = OX + c * cell, y = OY + r * cell, cx = x + cell / 2, cy = y + cell / 2;
        if (ch === "#") { ctx.fillStyle = "#33546e"; ctx.fillRect(x, y, cell, cell); ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.fillRect(x, y, cell, cell * 0.18); continue; }
        ctx.fillStyle = (r + c) % 2 ? "#e8f6fe" : "#d4ecf9";
        rrect(x + 1, y + 1, cell - 2, cell - 2, Math.min(9, cell * 0.14)); ctx.fill();
        ctx.strokeStyle = "rgba(120,170,205,.35)"; ctx.lineWidth = 1; ctx.stroke();
        var brk = broken[c + "," + r];
        if (ch === "R") glyph("🪨", cx, cy, gs);
        else if (ch === "O") glyph("🕳️", cx, cy, gs);
        else if (ch === "C") { if (brk) glyph("🕳️", cx, cy, gs); else { ctx.strokeStyle = "rgba(90,140,180,.85)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + cell * 0.25, cy); ctx.lineTo(x + cell * 0.5, y + cell * 0.3); ctx.lineTo(x + cell * 0.62, cy); ctx.lineTo(x + cell * 0.8, y + cell * 0.72); ctx.stroke(); glyph("❄️", cx, cy, gs * 0.7); } }
        else if (ch === "F") glyph("🐟", cx, cy, gs);
        else if (gateOf(ch)) { ctx.fillStyle = "rgba(150,110,60,.22)"; rrect(x + 3, y + 3, cell - 6, cell - 6, 6); ctx.fill(); glyph("🚪", cx, cy, gs * 0.8); glyph(arrowFor(gateOf(ch)), cx, cy + cell * 0.02, gs * 0.42); }
      }
      // pushable blocks (skip the one being animated; drawn separately)
      for (var bk in blocks) { if (sliding && anim && anim.blk && bk === anim.blk.key) continue; var pp = bk.split(","); glyph("📦", OX + (+pp[0] + 0.5) * cell, OY + (+pp[1] + 0.5) * cell, gs); }
      if (sliding && anim && anim.blk) glyph("📦", OX + (animB.c + 0.5) * cell, OY + (animB.r + 0.5) * cell, gs);
      // hint arrow flashing beside the penguin
      if (hint.dir && hint.t > 0) {
        ctx.globalAlpha = 0.5 + Math.abs(Math.sin(hint.t * 6)) * 0.5;
        var hx = OX + (animP.c + 0.5 + DIRS[hint.dir].dc * 0.5) * cell, hy = OY + (animP.r + 0.5 + DIRS[hint.dir].dr * 0.5) * cell;
        glyph(arrowFor(hint.dir), hx, hy, gs * 0.9); ctx.globalAlpha = 1;
      }
      // penguin
      var penx = OX + (animP.c + 0.5) * cell, peny = OY + (animP.r + 0.5) * cell;
      if (solved) { ctx.globalAlpha = 0.9; glyph("🎉", penx, peny - cell * 0.5, gs * 0.7); ctx.globalAlpha = 1; }
      glyph("🐧", penx, peny, gs * 1.05);
      // snow spray
      ctx.fillStyle = "#ffffff";
      for (var si = 0; si < snow.length; si++) { var s2 = snow[si]; ctx.globalAlpha = Math.max(0, s2.t * 1.8); ctx.beginPath(); ctx.arc(s2.x, s2.y, s2.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (juice) juice.draw(ctx);
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && active) step(dt);
      draw();
    }

    // ---------- economy: ONE bank per session (Leave + app-close), guarded ----------
    function rewards() {
      var ns = sessionNewStars;
      return { win: session3, score: totalStars(), rankPtsDelta: Math.min(12, ns * 2), xp: Math.min(90, 10 + ns * 8), gems: Math.min(90, ns * 6) };
    }
    function bankRun() {
      if (banked || sessionNewStars <= 0) return null;
      banked = true;
      var rw = rewards();
      var res = store.recordGame ? store.recordGame("icemaze", rw) : null;
      return { rw: rw, res: res };
    }
    function bankExit() {
      var b = bankRun();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🐧 Ice Maze banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
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

    // ---------- test API ----------
    cv._icemaze = {
      state: function () {
        return {
          level: level, moves: moves, par: par, sliding: sliding, pos: { c: pos.c, r: pos.r },
          solved: solved, stars: stats.stars[level] || 0, totalStars: totalStars(),
          banked: banked, attempt: attempt, hintDir: hint.dir, packs: { 2: !!stats.packs[2], 3: !!stats.packs[3] },
          active: active, sessionNewStars: sessionNewStars
        };
      },
      begin: beginLevel,
      slide: function (dir) { beginSlide(dir, true); },
      levelData: function () {
        var bl = [], k; for (k in blocks) { var pp = k.split(","); bl.push({ c: +pp[0], r: +pp[1] }); }
        var br = []; for (k in broken) { var qq = k.split(","); br.push({ c: +qq[0], r: +qq[1] }); }
        var fish = null; for (var r = 0; r < g.length; r++) { var fi = g[r].indexOf("F"); if (fi >= 0) fish = { c: fi, r: r }; }
        return { grid: g.slice(), blocks: bl, broken: br, start: { c: start0.c, r: start0.r }, fish: fish };
      },
      hintQuiz: hintQuiz,
      packQuiz: packQuiz,
      reset: reset,
      solveTo: function () { onSolved(); }
    };

    // ---------- boot ----------
    hud();
    showSelect();
    // demo hook: paused on level 14, mid-slide upward, a broken crack behind, 2⭐ on the HUD
    if (global._icemazedemo) {
      global._icemazedemo = 0;
      setTimeout(function () {
        beginLevel(14);
        demoStars = 2;
        // break the level's crack (behind the penguin) and freeze a slide in progress
        for (var r = 0; r < g.length; r++) for (var c = 0; c < g[0].length; c++) if (g[r].charAt(c) === "C") broken[c + "," + r] = 1;
        moves = 3;
        animP = { c: start0.c, r: start0.r - 1.4 };
        sliding = true; anim = { fromC: start0.c, fromR: start0.r, toC: start0.c, toR: start0.r - 3, t: 0.02, dur: 999, res: { moved: true }, blk: null };
        paused = true;
        hud();
      }, 200);
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxIceMaze = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
