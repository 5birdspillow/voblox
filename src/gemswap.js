/*
 * Voblox arcade game — 💎 GEM SWAP (a juicy Bejeweled / Candy-Crush-lite).
 * An 8×8 board of 6 colorblind-friendly gem SHAPES. Swap two adjacent gems by
 * drag or tap-tap; only swaps that make a match STICK (invalid swaps wobble back).
 * Matches of 3+ pop with a cascade chain and a rising "CASCADE ×n!" multiplier.
 *
 * SPECIALS (Candy-Crush rules):
 *   match-4  → 💠 LINE gem (clears its whole row or column when matched)
 *   L / T    → 💣 BOMB gem (3×3 blast)
 *   match-5  → ⭐ PRISM (swap with any color → clears ALL of that color)
 *   specials combine when swapped together (line+line = cross, bomb+bomb = big blast,
 *   prism+special = spectacular).
 *
 * MODES from a start card:
 *   🎯 LEVELS — 20 hand-tuned goals (score / clear-N-of-a-color / drop 🍯 honey to
 *               the floor) with move limits; 1–3 stars by leftover moves; stars persist.
 *   ⏱ BLITZ  — 90 seconds, pure score.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT (all via VQ.miniQuiz → store.record):
 *   🔄 out of moves on a level → a word grants +5 moves (once per attempt; wrong = kind retry)
 *   🌈 every 3rd level completion → a word DOUBLES the star Vobux
 *   ⏱ Blitz at 30s left → a word adds +20 seconds (once)
 *
 * Economy: study pays via miniQuiz, plus ONE store.recordGame("gemswap", …) per
 * level/blitz run, banked on run-end, quit, AND app-close. Board LOGIC is fully
 * synchronous + deterministic; animations are purely cosmetic (dt-driven).
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var ROWS = 8, COLS = 8, NCOL = 6;
  var SP_NONE = 0, SP_LINE = 1, SP_BOMB = 2, SP_PRISM = 3;

  // 6 gems: distinct SHAPE + color + emoji accent (colorblind-safe by shape)
  var GEMS = [
    { c: "#ff5b6e", shape: "circle", e: "❤️" },
    { c: "#ffc23d", shape: "square", e: "⭐" },
    { c: "#3fd07a", shape: "diamond", e: "🍀" },
    { c: "#40b6ff", shape: "triangle", e: "💧" },
    { c: "#b06aff", shape: "hexagon", e: "🔮" },
    { c: "#ff9f43", shape: "pentagon", e: "🔶" }
  ];

  // 20 hand-tuned levels: goal(s) + move limit. Star tiers come from leftover moves.
  var LEVELS = [
    { name: "Warm-Up", moves: 22, goals: [{ type: "score", need: 1500 }] },
    { name: "See Red", moves: 20, goals: [{ type: "color", color: 0, need: 18 }] },
    { name: "Sweeter", moves: 20, goals: [{ type: "score", need: 3000 }] },
    { name: "Green Thumb", moves: 18, goals: [{ type: "color", color: 2, need: 22 }] },
    { name: "First Honey", moves: 24, goals: [{ type: "honey", need: 1 }] },
    { name: "Two Tasks", moves: 22, goals: [{ type: "score", need: 3500 }, { type: "color", color: 3, need: 16 }] },
    { name: "Blue Streak", moves: 18, goals: [{ type: "color", color: 3, need: 28 }] },
    { name: "Big Score", moves: 20, goals: [{ type: "score", need: 6000 }] },
    { name: "Double Honey", moves: 24, goals: [{ type: "honey", need: 2 }] },
    { name: "Purple Reign", moves: 18, goals: [{ type: "color", color: 4, need: 26 }] },
    { name: "Tight Moves", moves: 16, goals: [{ type: "score", need: 5000 }] },
    { name: "Rainbow Rush", moves: 22, goals: [{ type: "color", color: 1, need: 20 }, { type: "color", color: 5, need: 20 }] },
    { name: "Honey Hunt", moves: 22, goals: [{ type: "honey", need: 3 }] },
    { name: "Orange Crush", moves: 18, goals: [{ type: "color", color: 5, need: 30 }] },
    { name: "Score Sprint", moves: 18, goals: [{ type: "score", need: 8000 }] },
    { name: "Triple Threat", moves: 22, goals: [{ type: "score", need: 6000 }, { type: "honey", need: 2 }] },
    { name: "Red Storm", moves: 16, goals: [{ type: "color", color: 0, need: 34 }] },
    { name: "Honey Flood", moves: 24, goals: [{ type: "honey", need: 4 }] },
    { name: "Marathon", moves: 20, goals: [{ type: "score", need: 12000 }] },
    { name: "Gem Master", moves: 20, goals: [{ type: "score", need: 9000 }, { type: "color", color: 4, need: 22 }, { type: "honey", need: 2 }] }
  ];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("gemswap");
    stats.stars = stats.stars || {};       // level -> best stars (persisted additively)
    stats.bestBlitz = stats.bestBlitz || 0;
    stats.done = stats.done || 0;           // total level completions (for the 🌈 every-3rd hook)

    // ---------- DOM (fullscreen canvas, inline styles so no new CSS) ----------
    var wrap = document.createElement("div");
    wrap.className = "gamewrap gemswap";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="gscv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="gsmsg">💎 Gem Swap</div>' +
      '<div class="grow"><span id="gsscore">0</span><span id="gsgoal"></span>' +
      '<span id="gsmoves"></span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="gsbig"></div>' +
      '<div class="gover" id="gsq" style="display:none"></div>' +
      '<div class="gover" id="gscard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#gscv"), ctx = cv.getContext("2d");
    var msgEl = document.getElementById("gsmsg"), bigEl = document.getElementById("gsbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H, tile, ox, oy;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      var avail = Math.min(W - 16, H - 150);
      tile = Math.max(24, Math.floor(avail / COLS));
      var boardPx = tile * COLS;
      ox = Math.floor((W - boardPx) / 2);
      oy = Math.max(70, Math.floor((H - boardPx) / 2) + 10);
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var G = [];                              // the board: G[r][c] = gem | null
    var running = true, raf = 0, lastT = performance.now();
    var mode = null, level = 1, score = 0, moves = 0, over = false, paused = false;
    var playing = false, banked = false;
    var goals = [], colorCleared = [0, 0, 0, 0, 0, 0], honeyCount = 0;
    var blitzLeft = 0, timeOffered = false, timeGranted = false;
    var movesGranted = false, lastStars = 0, lastRewardGems = 0, doubleUsed = false;
    var reshuffleCount = 0, idle = 0, hintCell = null, lastFmt = null;
    var pops = [];                           // cosmetic pop particles

    function newGem(t) { return { t: (t === undefined ? Math.floor(Math.random() * NCOL) : t), sp: SP_NONE, dir: null, jar: false, fall: 0, pop: 0 }; }
    function colorable(cell) { return !!(cell && !cell.jar && cell.t >= 0); }
    function isSpecial(cell) { return !!(cell && cell.sp && cell.sp !== SP_NONE); }
    function isPrism(cell) { return !!(cell && cell.sp === SP_PRISM); }

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1100);
    }
    function toast(m) { big(m, "#8ec7ff"); if (sfx && sfx.toast) sfx.toast(m); }

    // ---------- board helpers ----------
    function emptyBoard() { G = []; for (var r = 0; r < ROWS; r++) { var row = []; for (var c = 0; c < COLS; c++) row.push(null); G.push(row); } }
    function fillFresh() {
      // random board with NO starting matches and at least one legal move
      var tries = 0;
      do {
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) G[r][c] = newGem();
        tries++;
      } while (tries < 60 && (computeMatches(null) || !hasMove()));
    }

    // find same-color straight runs and the specials they should spawn
    function computeMatches(swapCells) {
      var hR = [], vR = [], r, c;
      for (r = 0; r < ROWS; r++) {
        c = 0;
        while (c < COLS) {
          var cell = G[r][c];
          if (colorable(cell)) {
            var c2 = c;
            while (c2 + 1 < COLS && colorable(G[r][c2 + 1]) && G[r][c2 + 1].t === cell.t) c2++;
            if (c2 - c + 1 >= 3) { var hc = []; for (var k = c; k <= c2; k++) hc.push({ r: r, c: k }); hR.push({ cells: hc, len: c2 - c + 1, dir: "h", t: cell.t, row: r, c0: c, c1: c2 }); }
            c = c2 + 1;
          } else c++;
        }
      }
      for (c = 0; c < COLS; c++) {
        r = 0;
        while (r < ROWS) {
          var cl = G[r][c];
          if (colorable(cl)) {
            var r2 = r;
            while (r2 + 1 < ROWS && colorable(G[r2 + 1][c]) && G[r2 + 1][c].t === cl.t) r2++;
            if (r2 - r + 1 >= 3) { var vc = []; for (var k2 = r; k2 <= r2; k2++) vc.push({ r: k2, c: c }); vR.push({ cells: vc, len: r2 - r + 1, dir: "v", t: cl.t, col: c, r0: r, r1: r2 }); }
            r = r2 + 1;
          } else r++;
        }
      }
      if (!hR.length && !vR.length) return null;

      var clear = {};
      function add(rr, cc) { clear[rr + "," + cc] = 1; }
      hR.concat(vR).forEach(function (run) { run.cells.forEach(function (p) { add(p.r, p.c); }); });

      function inSwap(rr, cc) { if (!swapCells) return false; for (var i = 0; i < swapCells.length; i++) if (swapCells[i] && swapCells[i].r === rr && swapCells[i].c === cc) return true; return false; }
      function pickSpot(cells) { for (var i = 0; i < cells.length; i++) if (inSwap(cells[i].r, cells[i].c)) return cells[i]; return cells[Math.floor(cells.length / 2)]; }

      var specials = [], usedH = {}, usedV = {};
      // L / T intersections → BOMB
      hR.forEach(function (h, hi) {
        vR.forEach(function (v, vi) {
          if (h.t !== v.t) return;
          if (v.col >= h.c0 && v.col <= h.c1 && h.row >= v.r0 && h.row <= v.r1) {
            specials.push({ r: h.row, c: v.col, sp: SP_BOMB, t: h.t, dir: null });
            usedH[hi] = 1; usedV[vi] = 1;
          }
        });
      });
      // straight runs → PRISM (5+) or LINE (4)
      hR.forEach(function (h, hi) { if (usedH[hi]) return; var s = pickSpot(h.cells); if (h.len >= 5) specials.push({ r: s.r, c: s.c, sp: SP_PRISM, t: -2, dir: null }); else if (h.len === 4) specials.push({ r: s.r, c: s.c, sp: SP_LINE, t: h.t, dir: "h" }); });
      vR.forEach(function (v, vi) { if (usedV[vi]) return; var s = pickSpot(v.cells); if (v.len >= 5) specials.push({ r: s.r, c: s.c, sp: SP_PRISM, t: -2, dir: null }); else if (v.len === 4) specials.push({ r: s.r, c: s.c, sp: SP_LINE, t: v.t, dir: "v" }); });

      return { clear: clear, specials: specials };
    }

    function dominantColor() {
      var tally = [0, 0, 0, 0, 0, 0];
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var g = G[r][c]; if (colorable(g)) tally[g.t]++; }
      var best = 0; for (var i = 1; i < NCOL; i++) if (tally[i] > tally[best]) best = i;
      return best;
    }

    // detonate any EXISTING specials whose cell is in the clear set (chain), skip new-special spots
    function expandSpecials(clear, spots) {
      var stack = []; for (var k in clear) stack.push(k);
      var seen = {};
      while (stack.length) {
        var key = stack.pop();
        if (seen[key]) continue; seen[key] = 1;
        if (spots && spots[key]) continue;
        var pr = key.split(","), r = +pr[0], c = +pr[1], cell = G[r][c];
        if (!cell) continue;
        var blast = null, rr, cc;
        if (cell.sp === SP_LINE) { blast = []; if (cell.dir === "v") { for (rr = 0; rr < ROWS; rr++) blast.push(rr + "," + c); } else { for (cc = 0; cc < COLS; cc++) blast.push(r + "," + cc); } }
        else if (cell.sp === SP_BOMB) { blast = []; for (rr = Math.max(0, r - 1); rr <= Math.min(ROWS - 1, r + 1); rr++) for (cc = Math.max(0, c - 1); cc <= Math.min(COLS - 1, c + 1); cc++) blast.push(rr + "," + cc); }
        else if (cell.sp === SP_PRISM) { var col = dominantColor(); blast = []; for (rr = 0; rr < ROWS; rr++) for (cc = 0; cc < COLS; cc++) { var g = G[rr][cc]; if (colorable(g) && g.t === col) blast.push(rr + "," + cc); } }
        if (blast) blast.forEach(function (bk) { if (!clear[bk]) { clear[bk] = 1; } if (!seen[bk]) stack.push(bk); });
      }
    }

    // gravity + honey collection + refill (one column at a time)
    function applyGravity() {
      for (var c = 0; c < COLS; c++) {
        var write = ROWS - 1;
        for (var r = ROWS - 1; r >= 0; r--) {
          var cell = G[r][c]; G[r][c] = null;
          if (!cell) continue;
          if (cell.jar && write === ROWS - 1) { honeyCount++; if (juice) juice.text(ox + c * tile + tile / 2, oy + (ROWS - 1) * tile, "🍯!", "#ffcf3a"); if (sfx && sfx.coin) sfx.coin(); continue; }
          if (write !== r) cell.fall = (cell.fall || 0) + (write - r);
          G[write][c] = cell; write--;
        }
        for (var r2 = write; r2 >= 0; r2--) { var ng = newGem(); ng.fall = write + 1; G[r2][c] = ng; }
      }
    }

    // the ONE cascade engine: consumes an initial clear set + specials, then chains
    function runCascades(clear, specials) {
      var total = 0, casc = 0;
      while (clear) {
        casc++;
        var spots = {}; specials.forEach(function (s) { spots[s.r + "," + s.c] = 1; });
        expandSpecials(clear, spots);
        var gems = 0;
        for (var key in clear) {
          if (spots[key]) continue;
          var pr = key.split(","), r = +pr[0], c = +pr[1], cell = G[r][c];
          if (!cell) continue;
          if (colorable(cell)) colorCleared[cell.t]++;
          pops.push({ r: r, c: c, col: colorable(cell) ? GEMS[cell.t].c : "#ffffff", life: 0.36 });
          G[r][c] = null; gems++;
        }
        specials.forEach(function (s) { G[s.r][s.c] = { t: s.t, sp: s.sp, dir: s.dir || null, jar: false, fall: 0, pop: 0.3 }; });
        total += gems;
        score += gems * 10 * casc + specials.length * 25;
        if (casc >= 2 && gems > 0) { big("CASCADE ×" + casc + "!", "#ffd23f"); if (juice) juice.shake(3); }
        if (sfx && sfx.pop && gems > 0) sfx.pop();
        applyGravity();
        var m = computeMatches(null);
        if (!m) break;
        clear = m.clear; specials = m.specials;
      }
      hud();
      return total;
    }

    // ---------- swap ----------
    function adjacent(r1, c1, r2, c2) { return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; }

    function doSwap(r1, c1, r2, c2) {
      if (over || !playing) return 0;
      if (!adjacent(r1, c1, r2, c2)) return 0;
      var a = G[r1][c1], b = G[r2][c2];
      if (!a || !b || a.jar || b.jar) return 0;

      // physically swap
      G[r1][c1] = b; G[r2][c2] = a;
      var cleared = 0, valid = false;

      if (isPrism(a) || isPrism(b)) { cleared = activatePrism(r1, c1, r2, c2); valid = true; }
      else if (isSpecial(a) && isSpecial(b)) { cleared = activateCombo(r1, c1, r2, c2); valid = true; }
      else {
        var m = computeMatches([{ r: r1, c: c1 }, { r: r2, c: c2 }]);
        if (m) { cleared = runCascades(m.clear, m.specials); valid = true; }
      }

      if (!valid) { G[r1][c1] = a; G[r2][c2] = b; if (sfx && sfx.buzz) sfx.buzz(); return 0; }
      afterMove();
      return cleared;
    }

    // ⭐ PRISM: swap with a color clears ALL of that color; combos are spectacular
    function activatePrism(r1, c1, r2, c2) {
      // find which cell is the prism after the swap and what it met
      var pr, ot, or, oc;
      if (isPrism(G[r1][c1])) { pr = { r: r1, c: c1 }; ot = G[r2][c2]; or = r2; oc = c2; }
      else { pr = { r: r2, c: c2 }; ot = G[r1][c1]; or = r1; oc = c1; }
      var clear = {}; function add(r, c) { clear[r + "," + c] = 1; }
      if (isPrism(ot)) { // prism + prism → wipe the whole board
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (G[r][c]) add(r, c);
        big("⭐⭐ TOTAL PRISM!", "#e0aaff");
      } else if (isSpecial(ot)) { // prism + line/bomb → turn every gem of that color into that special, detonate
        var col = ot.t;
        for (var rr = 0; rr < ROWS; rr++) for (var cc = 0; cc < COLS; cc++) { var g = G[rr][cc]; if (colorable(g) && g.t === col) { g.sp = ot.sp; g.dir = ot.dir || (Math.random() < 0.5 ? "h" : "v"); add(rr, cc); } }
        add(or, oc); big("⭐💥 SPECTACULAR!", "#e0aaff");
      } else { // prism + normal color → clear ALL of that color
        var color = ot.t;
        for (var r3 = 0; r3 < ROWS; r3++) for (var c3 = 0; c3 < COLS; c3++) { var g3 = G[r3][c3]; if (colorable(g3) && g3.t === color) add(r3, c3); }
        big("⭐ PRISM — " + GEMS[color].e + " cleared!", "#e0aaff");
      }
      G[pr.r][pr.c] = null; add(pr.r, pr.c); // consume the prism itself
      if (juice) juice.shake(6);
      if (sfx && sfx.fanfare) sfx.fanfare();
      return runCascades(clear, []);
    }

    // 💠/💣 special + special (non-prism) combos
    function activateCombo(r1, c1, r2, c2) {
      var a = G[r1][c1], b = G[r2][c2];
      var clear = {}; function add(r, c) { if (r >= 0 && r < ROWS && c >= 0 && c < COLS) clear[r + "," + c] = 1; }
      var lr = r1, lc = c1; // focal point
      if (a.sp === SP_LINE && b.sp === SP_LINE) { // cross
        for (var c = 0; c < COLS; c++) add(lr, c);
        for (var r = 0; r < ROWS; r++) add(r, lc);
        big("💠 CROSS BLAST!", "#7fe0ff");
      } else if (a.sp === SP_BOMB && b.sp === SP_BOMB) { // 5×5
        for (var rr = lr - 2; rr <= lr + 2; rr++) for (var cc = lc - 2; cc <= lc + 2; cc++) add(rr, cc);
        big("💣💣 MEGA BLAST!", "#ffb347");
      } else { // line + bomb → 3 rows & 3 cols
        for (var r3 = lr - 1; r3 <= lr + 1; r3++) for (var c3 = 0; c3 < COLS; c3++) add(r3, c3);
        for (var r4 = 0; r4 < ROWS; r4++) for (var c4 = lc - 1; c4 <= lc + 1; c4++) add(r4, c4);
        big("💠💣 GIANT CROSS!", "#ffcf7a");
      }
      if (juice) juice.shake(7);
      if (sfx && sfx.fanfare) sfx.fanfare();
      return runCascades(clear, []);
    }

    // ---------- after a move: moves, goals, settle, no-move reshuffle ----------
    function afterMove() {
      idle = 0; hintCell = null;
      if (mode === "levels") moves = Math.max(0, moves - 1);
      settle();
      hud();
      if (checkWin()) { endRun(true); return; }
      if (mode === "levels" && moves <= 0) outOfMoves();
    }
    function settle() {
      var guard = 0;
      while (!hasMove() && guard < 40) { reshuffle(); guard++; }
    }
    function reshuffle() {
      reshuffleCount++;
      var gems = [], spots = [], r, c;
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) { var g = G[r][c]; if (g && !g.jar) { gems.push(g); spots.push({ r: r, c: c }); } }
      var tries = 0;
      do {
        for (var i = gems.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = gems[i]; gems[i] = gems[j]; gems[j] = tmp; }
        for (var s = 0; s < spots.length; s++) G[spots[s].r][spots[s].c] = gems[s];
        tries++;
      } while (tries < 50 && (computeMatches(null) || !hasMove()));
      toast("No moves — reshuffling!");
    }
    function hasMove() { return !!findMove(); }
    function findMove() {
      var r, c;
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) if (isPrism(G[r][c])) return { r: r, c: c, r2: r, c2: (c + 1 < COLS ? c + 1 : c - 1) };
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (tryPair(r, c, r, c + 1)) return { r: r, c: c, r2: r, c2: c + 1 };
        if (tryPair(r, c, r + 1, c)) return { r: r, c: c, r2: r + 1, c2: c };
      }
      return null;
    }
    function tryPair(r1, c1, r2, c2) {
      if (r2 >= ROWS || c2 >= COLS) return false;
      var a = G[r1][c1], b = G[r2][c2];
      if (!a || !b || a.jar || b.jar) return false;
      if (isSpecial(a) || isSpecial(b)) return true; // specials always give a move
      G[r1][c1] = b; G[r2][c2] = a;
      var m = computeMatches(null);
      G[r1][c1] = a; G[r2][c2] = b;
      return !!m;
    }

    // ---------- goals / win ----------
    function goalHave(g) { return g.type === "score" ? score : g.type === "honey" ? honeyCount : colorCleared[g.color] || 0; }
    function goalMet(g) { return goalHave(g) >= g.need; }
    function checkWin() { if (!goals.length) return false; for (var i = 0; i < goals.length; i++) if (!goalMet(goals[i])) return false; return true; }
    function computeStars() {
      var tot = LEVELS[level - 1] ? LEVELS[level - 1].moves : 20;
      var s = 1;
      if (moves >= Math.ceil(tot * 0.2)) s++;
      if (moves >= Math.ceil(tot * 0.4)) s++;
      return s;
    }

    // ---------- HUD ----------
    function hud() {
      document.getElementById("gsscore").textContent = "💎 " + score;
      var gEl = document.getElementById("gsgoal"), mEl = document.getElementById("gsmoves");
      if (mode === "blitz") {
        gEl.textContent = "🎯 10000";
        mEl.textContent = "⏱ " + Math.ceil(blitzLeft) + "s";
      } else if (mode === "levels") {
        gEl.textContent = goals.map(function (g) {
          var lbl = g.type === "score" ? "🎯" : g.type === "honey" ? "🍯" : GEMS[g.color].e;
          return lbl + " " + goalHave(g) + "/" + g.need;
        }).join("  ");
        mEl.textContent = "↔ " + moves;
      } else { gEl.textContent = ""; mEl.textContent = ""; }
    }

    // ---------- word hooks ----------
    function openQuiz(title, cb) {
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("gsq"), words, store, {
        title: title, lastFormat: lastFmt,
        cb: function (ok, res, fmt) { lastFmt = fmt; paused = false; cb(ok, res); }
      });
    }
    // 🔄 out of moves → a word buys +5 moves (once per attempt; wrong is kind)
    function outOfMoves() {
      if (over) return;
      if (movesGranted) { endRun(false); return; }
      movesQuiz();
    }
    function movesQuiz() {
      if (over) return;
      openQuiz("🔄 Out of moves! Answer for +5 moves!", function (ok) {
        if (ok && !movesGranted) { moves += 5; movesGranted = true; big("🔄 +5 moves — keep going!", "#69f0ae"); if (juice) juice.shake(3); hud(); }
        else if (ok) { big("Already boosted this level!", "#ffd23f"); hud(); }
        else { retryOffer(); }
      });
    }
    function retryOffer() { // wrong answer = kind retry card
      var card = document.getElementById("gscard");
      card.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:38px">🙂</div>' +
        '<div class="wqtitle">So close! Try another word for your +5 moves?</div>' +
        '<button class="submit" id="gs_retry" type="button">Try again</button> ' +
        '<button class="wqskip" id="gs_giveup" type="button">End level</button></div>';
      card.style.display = "flex";
      document.getElementById("gs_retry").onclick = function () { card.style.display = "none"; movesQuiz(); };
      document.getElementById("gs_giveup").onclick = function () { card.style.display = "none"; endRun(false); };
    }
    // ⏱ Blitz at 30s → +20 seconds (once)
    function timeQuiz() {
      if (mode !== "blitz" || over || timeGranted) return;
      openQuiz("⏱ Answer to add +20 seconds!", function (ok) {
        if (ok) { blitzLeft += 20; timeGranted = true; big("⏱ +20 seconds!", "#69f0ae"); hud(); }
        else big("No worries — keep swapping!", "#ffd23f");
      });
    }
    // 🌈 every 3rd completion → a word DOUBLES the star Vobux
    function doubleQuiz() {
      if (doubleUsed || over === false) { /* only meaningful post-run */ }
      if (doubleUsed) return;
      openQuiz("🌈 Answer to DOUBLE your Vobux!", function (ok) {
        doubleUsed = true;
        if (ok && lastRewardGems > 0) {
          store.state.gems = (store.state.gems || 0) + lastRewardGems;
          store.save();
          big("🌈 DOUBLE Vobux! +" + lastRewardGems + " 💎", "#ffd23f");
          if (sfx && sfx.fanfare) sfx.fanfare();
        } else big("That's ok — you still earned your Vobux!", "#8ec7ff");
        showEndCard(true);
      });
    }

    // ---------- banking (ONE path, guarded, fires everywhere) ----------
    function runRewards(won) {
      var gems = won ? (8 + level + Math.floor(score / 500)) : (2 + Math.floor(score / 700));
      return {
        win: !!won,
        score: score,
        rankPtsDelta: won ? Math.min(10, 3 + level) : Math.min(5, 1 + Math.floor(score / 2500)),
        xp: Math.min(80, 8 + Math.floor(score / 150) + (won ? 10 : 0)),
        gems: Math.min(140, gems)
      };
    }
    function bankRun(won) {
      if (banked) return null;
      banked = true;
      var rw = runRewards(won);
      var res = store.recordGame ? store.recordGame("gemswap", rw) : null;
      lastRewardGems = rw.gems;
      return { rw: rw, res: res };
    }

    // ---------- run lifecycle ----------
    function beginLevel(m, lv) {
      mode = m; level = lv || 1;
      score = 0; over = false; paused = false; playing = true; banked = false;
      colorCleared = [0, 0, 0, 0, 0, 0]; honeyCount = 0;
      movesGranted = false; doubleUsed = false; timeOffered = false; timeGranted = false;
      lastStars = 0; lastRewardGems = 0; idle = 0; hintCell = null; pops = [];
      document.getElementById("gscard").style.display = "none";
      document.getElementById("gsq").style.display = "none";
      resize();
      emptyBoard();
      if (m === "blitz") {
        blitzLeft = 90; goals = [{ type: "score", need: 10000 }];
        fillFresh();
        msgEl.textContent = "⏱ BLITZ — 90 seconds!";
        big("⏱ GO!", "#ffd23f");
      } else {
        var def = LEVELS[level - 1] || LEVELS[0];
        moves = def.moves; blitzLeft = 0;
        goals = def.goals.map(function (g) { return { type: g.type, color: g.color, need: g.need }; });
        fillFresh();
        seedHoney();
        msgEl.textContent = "🎯 Level " + level + " — " + def.name;
        big("🎯 " + def.name, "#ffd23f");
      }
      hud();
    }
    function seedHoney() { // drop a honey jar per honey-goal near the top
      var need = 0; goals.forEach(function (g) { if (g.type === "honey") need += g.need; });
      var placed = 0, guard = 0;
      while (placed < need && guard < 200) {
        guard++;
        var c = Math.floor(Math.random() * COLS), r = Math.floor(Math.random() * 2);
        if (G[r][c] && !G[r][c].jar) { G[r][c] = { t: -1, sp: SP_NONE, dir: null, jar: true, fall: 0, pop: 0 }; placed++; }
      }
    }

    function endRun(won) {
      if (over) return;
      over = true; playing = false; paused = true;
      if (mode === "levels") {
        if (won) {
          lastStars = computeStars();
          if (lastStars > (stats.stars[level] || 0)) stats.stars[level] = lastStars;
          stats.done = (stats.done || 0) + 1;
        }
      } else {
        won = score >= 10000;
        if (score > (stats.bestBlitz || 0)) stats.bestBlitz = score;
      }
      store.save();
      bankRun(won);
      if (won && sfx && sfx.fanfare) sfx.fanfare();
      if (won && juice) { juice.shake(6); for (var i = 0; i < 5; i++) juice.burst(W * (0.2 + i * 0.15), H * 0.35, GEMS[i % NCOL].c, 16); }
      showEndCard(won);
    }

    function showEndCard(won) {
      var card = document.getElementById("gscard");
      var rw = runRewards(won); // recompute for display (matches banked values pre-double)
      var eligibleDouble = mode === "levels" && won && !doubleUsed && (stats.done % 3 === 0);
      var starRow = mode === "levels" && won ? '<div style="font-size:30px">' + "⭐".repeat(lastStars) + "☆".repeat(3 - lastStars) + "</div>" : "";
      var title = mode === "blitz"
        ? (won ? "⏱ BLITZ CLEARED! " + score + " points!" : "⏱ Time! " + score + " points" + (score >= (stats.bestBlitz || 0) ? " — best yet!" : ""))
        : (won ? "🎯 Level " + level + " cleared!" : "Out of moves…");
      card.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:42px">' + (won ? "🏆" : "💎") + "</div>" +
        '<div class="wqtitle" style="font-size:20px">' + title + "</div>" + starRow +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP</div>" +
        (eligibleDouble ? '<button class="submit" id="gs_double" type="button" style="background:linear-gradient(90deg,#ff6b6b,#ffd23f,#3fd07a,#40b6ff,#b06aff)">🌈 Double Vobux — answer a word!</button><br>' : "") +
        (mode === "levels" && won && level < 20 ? '<button class="submit" id="gs_next" type="button">Next level ➜</button> ' : "") +
        '<button class="submit" id="gs_replay" type="button">Replay</button> ' +
        '<button class="wqskip" id="gs_leave" type="button">Leave</button></div>';
      card.style.display = "flex";
      var db = document.getElementById("gs_double"); if (db) db.onclick = function () { card.style.display = "none"; doubleQuiz(); };
      var nx = document.getElementById("gs_next"); if (nx) nx.onclick = function () { beginLevel("levels", level + 1); };
      var rp = document.getElementById("gs_replay"); if (rp) rp.onclick = function () { beginLevel(mode, mode === "levels" ? level : 1); };
      var lv = document.getElementById("gs_leave"); if (lv) lv.onclick = showStart;
    }

    // ---------- start / mode card + level select ----------
    function showStart() {
      mode = null; playing = false; over = false; paused = true;
      var card = document.getElementById("gscard");
      var grid = "";
      for (var n = 1; n <= 20; n++) {
        var s = stats.stars[n] || 0;
        grid += '<button class="embtn" style="min-width:70px" data-lv="' + n + '">' +
          '<span class="ebl">Lv ' + n + '</span><span class="ebs">' + (s ? "⭐".repeat(s) : "▶") + "</span></button>";
      }
      card.innerHTML = '<div class="wqcard" style="text-align:center;max-width:560px"><div style="font-size:44px">💎</div>' +
        '<div class="wqtitle" style="font-size:22px">Gem Swap</div>' +
        '<div style="margin:2px 0 8px;color:#5a6b7a;font-weight:bold">Match 3+ · make specials · chase the stars</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px">' +
        '<button class="embtn mode" style="min-width:130px" id="gs_blitz"><span class="ebl">⏱ Blitz</span><span class="ebs">90s · best ' + (stats.bestBlitz || 0) + "</span></button></div>" +
        '<div style="font-weight:900;margin:4px 0">🎯 Levels</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-height:44vh;overflow-y:auto">' + grid + "</div></div>";
      card.style.display = "flex";
      document.getElementById("gs_blitz").onclick = function () { beginLevel("blitz"); };
      Array.prototype.forEach.call(card.querySelectorAll("[data-lv]"), function (b) {
        b.onclick = function () { beginLevel("levels", +b.dataset.lv); };
      });
      hud();
    }

    // ---------- drawing (cosmetic only) ----------
    function shapePath(x, y, rad, shape) {
      ctx.beginPath();
      if (shape === "circle") { ctx.arc(x, y, rad, 0, Math.PI * 2); }
      else if (shape === "square") { ctx.rect(x - rad, y - rad, rad * 2, rad * 2); }
      else if (shape === "diamond") { ctx.moveTo(x, y - rad); ctx.lineTo(x + rad, y); ctx.lineTo(x, y + rad); ctx.lineTo(x - rad, y); ctx.closePath(); }
      else { // polygon
        var sides = shape === "triangle" ? 3 : shape === "pentagon" ? 5 : 6;
        var rot = shape === "triangle" ? -Math.PI / 2 : -Math.PI / 2;
        for (var i = 0; i < sides; i++) { var a = rot + i * Math.PI * 2 / sides; var px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
        ctx.closePath();
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g1 = ctx.createLinearGradient(0, 0, 0, H); g1.addColorStop(0, "#241b3a"); g1.addColorStop(1, "#140f22");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      if (!G.length || !mode) return;
      // board frame
      ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.fillRect(ox - 6, oy - 6, tile * COLS + 12, tile * ROWS + 12);
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.10)";
        ctx.fillRect(ox + c * tile, oy + r * tile, tile - 1, tile - 1);
        var cell = G[r][c]; if (!cell) continue;
        var fy = cell.fall ? cell.fall * tile : 0;
        var cx = ox + c * tile + tile / 2, cy = oy + r * tile + tile / 2 - fy;
        var rad = tile * 0.36 * (cell.pop ? (1 + cell.pop) : 1);
        if (cell.jar) {
          ctx.font = Math.round(tile * 0.6) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("🍯", cx, cy);
          continue;
        }
        if (cell.sp === SP_PRISM) {
          var pg = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
          pg.addColorStop(0, "#ff6b6b"); pg.addColorStop(0.5, "#ffd23f"); pg.addColorStop(1, "#40b6ff");
          ctx.fillStyle = pg; shapePath(cx, cy, rad, "hexagon"); ctx.fill();
          ctx.font = Math.round(rad) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⭐", cx, cy);
          continue;
        }
        var gm = GEMS[cell.t];
        ctx.fillStyle = gm.c; shapePath(cx, cy, rad, gm.shape); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 2; ctx.stroke();
        if (cell.sp === SP_LINE) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); if (cell.dir === "v") { ctx.moveTo(cx, cy - rad); ctx.lineTo(cx, cy + rad); } else { ctx.moveTo(cx - rad, cy); ctx.lineTo(cx + rad, cy); } ctx.stroke(); }
        else if (cell.sp === SP_BOMB) { ctx.fillStyle = "#fff"; ctx.font = "bold " + Math.round(rad) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("💣", cx, cy); }
        else { ctx.font = Math.round(rad * 0.7) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.globalAlpha = 0.85; ctx.fillText(gm.e, cx, cy); ctx.globalAlpha = 1; }
      }
      // selection highlight
      if (sel) { ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3; ctx.strokeRect(ox + sel.c * tile + 2, oy + sel.r * tile + 2, tile - 5, tile - 5); }
      // hint sparkle
      if (hintCell && idle > 6) {
        var hx = ox + hintCell.c * tile + tile / 2, hy = oy + hintCell.r * tile + tile / 2;
        ctx.fillStyle = "rgba(255,255,255," + (0.4 + Math.sin(performance.now() / 120) * 0.3) + ")";
        ctx.font = Math.round(tile * 0.5) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✨", hx, hy);
      }
      // pops
      pops.forEach(function (p) {
        var px = ox + p.c * tile + tile / 2, py = oy + p.r * tile + tile / 2;
        var f = p.life / 0.36;
        ctx.globalAlpha = f; ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(px, py, tile * 0.5 * (1.2 - f), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input (drag or tap-tap) ----------
    var sel = null;
    function cellAt(px, py) {
      var c = Math.floor((px - ox) / tile), r = Math.floor((py - oy) / tile);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
      return { r: r, c: c };
    }
    function onDown(px, py) {
      if (paused || over || !playing) return;
      var t = cellAt(px, py); if (!t) return;
      idle = 0;
      if (sel && adjacent(sel.r, sel.c, t.r, t.c)) { doSwap(sel.r, sel.c, t.r, t.c); sel = null; }
      else if (sel && sel.r === t.r && sel.c === t.c) { sel = null; }
      else sel = t;
      down = t; downPx = { x: px, y: py };
    }
    function onMove(px, py) {
      if (!down || paused || over || !playing) return;
      var dx = px - downPx.x, dy = py - downPx.y;
      if (Math.abs(dx) < tile * 0.4 && Math.abs(dy) < tile * 0.4) return;
      var nr = down.r, nc = down.c;
      if (Math.abs(dx) > Math.abs(dy)) nc += dx > 0 ? 1 : -1; else nr += dy > 0 ? 1 : -1;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) { doSwap(down.r, down.c, nr, nc); }
      sel = null; down = null;
    }
    var down = null, downPx = null;
    function rel(e) { var b = cv.getBoundingClientRect(); return { x: (e.clientX !== undefined ? e.clientX : e.changedTouches[0].clientX) - b.left, y: (e.clientY !== undefined ? e.clientY : e.changedTouches[0].clientY) - b.top }; }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = rel(e); onDown(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = rel(e); onMove(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); down = null; }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var p = rel(e); onDown(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { if (down) { var p = rel(e); onMove(p.x, p.y); } });
    cv.addEventListener("mouseup", function () { down = null; });

    // ---------- time (blitz) ----------
    function timeStep(dt) {
      if (mode !== "blitz" || over || paused) return;
      blitzLeft -= dt;
      if (blitzLeft <= 30 && !timeOffered) { timeOffered = true; timeQuiz(); }
      if (blitzLeft <= 0) { blitzLeft = 0; endRun(false); }
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over && playing) {
        timeStep(dt);
        idle += dt;
        if (idle > 6 && !hintCell && mode === "levels") hintCell = findMove();
      }
      // cosmetic animation decay
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var g = G[r] && G[r][c]; if (g) { if (g.fall) g.fall = Math.max(0, g.fall - dt * 14); if (g.pop) g.pop = Math.max(0, g.pop - dt * 3); } }
      for (var i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
      draw();
    }

    // ---------- exit + bank-on-close ----------
    function bankExit() { if (playing && !banked && !over) bankRun(false); }
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

    // ---------- test API (exactly the documented surface) ----------
    function serializeBoard() {
      var out = [];
      for (var r = 0; r < ROWS; r++) {
        var row = [];
        for (var c = 0; c < COLS; c++) {
          var cell = G[r][c];
          if (!cell) row.push(null);
          else if (cell.jar) row.push({ t: -1, jar: true });
          else if (cell.sp) row.push({ t: cell.t, sp: cell.sp, dir: cell.dir || null });
          else row.push(cell.t);
        }
        out.push(row);
      }
      return out;
    }
    function parseCell(v) {
      if (v === null || v === undefined) return null;
      if (v === "H") return { t: -1, sp: SP_NONE, dir: null, jar: true, fall: 0, pop: 0 };
      if (typeof v === "number") return { t: v, sp: SP_NONE, dir: null, jar: false, fall: 0, pop: 0 };
      return { t: (v.t === undefined ? 0 : v.t), sp: v.sp || SP_NONE, dir: v.dir || null, jar: !!v.jar, fall: 0, pop: 0 };
    }
    cv._gemswap = {
      state: function () {
        return {
          mode: mode, level: level, moves: moves, score: score,
          goals: goals.map(function (g) { return { type: g.type, need: g.need, have: goalHave(g) }; }),
          stars: stats.stars, over: over, banked: banked,
          blitzLeft: mode === "blitz" ? Math.ceil(blitzLeft) : 0,
          board: serializeBoard()
        };
      },
      begin: function (m, lv) { beginLevel(m || "levels", lv || 1); },
      swap: function (r1, c1, r2, c2) { return doSwap(r1, c1, r2, c2); },
      setBoard: function (grid) {
        if (G.length === 0) emptyBoard();
        for (var r = 0; r < ROWS && r < grid.length; r++) for (var c = 0; c < COLS && grid[r] && c < grid[r].length; c++) G[r][c] = parseCell(grid[r][c]);
      },
      movesQuiz: function () { movesQuiz(); },
      doubleQuiz: function () { doubleQuiz(); },
      timeQuiz: function () { timeQuiz(); },
      reshuffles: function () { return reshuffleCount; },
      tick: function (seconds) { var left = seconds || 0; while (left > 0 && !over) { var d = Math.min(0.05, left); timeStep(d); left -= d; } }
    };

    // ---------- boot ----------
    emptyBoard(); // ensure state().board is always an 8×8 grid, even before a run
    hud();
    showStart();

    // Demo hook: paused mid-level-7 — a colorful board with a line gem + bomb, goals partly done.
    if (global._gemswapdemo) setTimeout(function () {
      global._gemswapdemo = 0;
      beginLevel("levels", 7);
      G[3][3] = { t: 2, sp: SP_LINE, dir: "h", jar: false, fall: 0, pop: 0 };
      G[5][5] = { t: 4, sp: SP_BOMB, dir: null, jar: false, fall: 0, pop: 0 };
      colorCleared[3] = 12; score = 1800; // 2 goals partly done
      moves = 12; paused = true; hud();
    }, 700);

    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxGemSwap = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
