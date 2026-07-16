/*
 * Voblox arcade game — ♟️ Chess Club.
 * FULL chess vs AI club members: legal move generation (castling, en passant,
 * promotion), check/checkmate/stalemate, and a negamax + alpha-beta engine
 * whose search is budgeted by NODE COUNT (never wall-clock — keeps it exact
 * under the test harness). Bots have ratings and blunder rates. Elo-lite club
 * rating, puzzle mode, and word-earned 🧠 tokens buy Hints and Takebacks.
 *
 * VobloxChess.AI is pure and DOM-free so the harness can test it deeply.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;

  // ============================== ENGINE ==============================
  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  // center-bonus piece-square (indexed by rank/file distance from center)
  function pst(piece, idx, side) {
    var f = idx % 8, r = Math.floor(idx / 8);
    var cf = Math.min(f, 7 - f), cr = Math.min(r, 7 - r);
    var center = (cf + cr) * 2; // 0..12
    var lo = piece.toLowerCase();
    if (lo === "n" || lo === "b") return center * 2;
    if (lo === "p") { var adv = side === "w" ? r : 7 - r; return adv * 4 + cf; }
    if (lo === "q") return center;
    if (lo === "k") return -center; // keep the king out of the middle
    return center;
  }
  function fileOf(i) { return i % 8; }
  function initial() {
    var sq = new Array(64).fill(null);
    var back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    for (var f = 0; f < 8; f++) {
      sq[f] = back[f].toUpperCase(); sq[8 + f] = "P";
      sq[48 + f] = "p"; sq[56 + f] = back[f];
    }
    return { sq: sq, turn: "w", castle: { K: true, Q: true, k: true, q: true }, ep: null };
  }
  function idxOf(name) { return (name.charCodeAt(0) - 97) + (parseInt(name[1], 10) - 1) * 8; }
  function nameOf(i) { return String.fromCharCode(97 + (i % 8)) + (Math.floor(i / 8) + 1); }
  function fromMap(map, turn) {
    var b = { sq: new Array(64).fill(null), turn: turn || "w", castle: { K: false, Q: false, k: false, q: false }, ep: null };
    Object.keys(map).forEach(function (k) { b.sq[idxOf(k)] = map[k]; });
    return b;
  }
  function clone(b) { return { sq: b.sq.slice(), turn: b.turn, castle: { K: b.castle.K, Q: b.castle.Q, k: b.castle.k, q: b.castle.q }, ep: b.ep }; }
  function sideOf(p) { return p === p.toUpperCase() ? "w" : "b"; }

  var KN = [17, 15, 10, 6, -17, -15, -10, -6];
  var KING = [8, -8, 1, -1, 9, 7, -9, -7];
  var ROOKD = [8, -8, 1, -1], BISHD = [9, 7, -9, -7];

  function attacked(b, idx, by) {
    var i, j, p;
    // pawns
    var pd = by === "w" ? [-7, -9] : [7, 9]; // squares FROM which an enemy pawn attacks idx
    for (i = 0; i < 2; i++) {
      j = idx + pd[i];
      if (j >= 0 && j < 64 && Math.abs(fileOf(j) - fileOf(idx)) === 1) {
        p = b.sq[j];
        if (p && sideOf(p) === by && p.toLowerCase() === "p") return true;
      }
    }
    // knights
    for (i = 0; i < 8; i++) {
      j = idx + KN[i];
      if (j >= 0 && j < 64 && Math.abs(fileOf(j) - fileOf(idx)) <= 2) {
        p = b.sq[j];
        if (p && sideOf(p) === by && p.toLowerCase() === "n") return true;
      }
    }
    // king
    for (i = 0; i < 8; i++) {
      j = idx + KING[i];
      if (j >= 0 && j < 64 && Math.abs(fileOf(j) - fileOf(idx)) <= 1) {
        p = b.sq[j];
        if (p && sideOf(p) === by && p.toLowerCase() === "k") return true;
      }
    }
    // sliders
    function ray(dirs, hits) {
      for (var d = 0; d < dirs.length; d++) {
        var cur = idx;
        while (true) {
          var nxt = cur + dirs[d];
          if (nxt < 0 || nxt > 63 || Math.abs(fileOf(nxt) - fileOf(cur)) > 1) break;
          var q = b.sq[nxt];
          if (q) { if (sideOf(q) === by && hits.indexOf(q.toLowerCase()) !== -1) return true; break; }
          cur = nxt;
        }
      }
      return false;
    }
    if (ray(ROOKD, ["r", "q"])) return true;
    if (ray(BISHD, ["b", "q"])) return true;
    return false;
  }
  function kingIdx(b, side) {
    var k = side === "w" ? "K" : "k";
    for (var i = 0; i < 64; i++) if (b.sq[i] === k) return i;
    return -1;
  }
  function inCheck(b, side) { var ki = kingIdx(b, side); return ki !== -1 && attacked(b, ki, side === "w" ? "b" : "w"); }

  function pseudo(b, side) {
    var out = [], i, p;
    for (i = 0; i < 64; i++) {
      p = b.sq[i];
      if (!p || sideOf(p) !== side) continue;
      var lo = p.toLowerCase();
      if (lo === "p") {
        var dir = side === "w" ? 8 : -8, start = side === "w" ? 1 : 6, last = side === "w" ? 7 : 0;
        var one = i + dir;
        if (one >= 0 && one < 64 && !b.sq[one]) {
          if (Math.floor(one / 8) === last) out.push({ from: i, to: one, promo: side === "w" ? "Q" : "q" });
          else out.push({ from: i, to: one });
          var two = i + dir * 2;
          if (Math.floor(i / 8) === start && !b.sq[two]) out.push({ from: i, to: two, dbl: true });
        }
        [dir - 1, dir + 1].forEach(function (cd) {
          var t = i + cd;
          if (t < 0 || t > 63 || Math.abs(fileOf(t) - fileOf(i)) !== 1) return;
          var q = b.sq[t];
          if (q && sideOf(q) !== side) {
            if (Math.floor(t / 8) === last) out.push({ from: i, to: t, promo: side === "w" ? "Q" : "q" });
            else out.push({ from: i, to: t });
          } else if (!q && t === b.ep) out.push({ from: i, to: t, ep: true });
        });
      } else if (lo === "n" || lo === "k") {
        var ds = lo === "n" ? KN : KING, lim = lo === "n" ? 2 : 1;
        for (var d = 0; d < 8; d++) {
          var t2 = i + ds[d];
          if (t2 < 0 || t2 > 63 || Math.abs(fileOf(t2) - fileOf(i)) > lim) continue;
          var q2 = b.sq[t2];
          if (!q2 || sideOf(q2) !== side) out.push({ from: i, to: t2 });
        }
        if (lo === "k") {
          // castling (rights + emptiness; through-check filtered below)
          var rank = side === "w" ? 0 : 56;
          if (i === rank + 4) {
            if ((side === "w" ? b.castle.K : b.castle.k) && !b.sq[rank + 5] && !b.sq[rank + 6] && b.sq[rank + 7] === (side === "w" ? "R" : "r"))
              out.push({ from: i, to: rank + 6, castle: "K" });
            if ((side === "w" ? b.castle.Q : b.castle.q) && !b.sq[rank + 3] && !b.sq[rank + 2] && !b.sq[rank + 1] && b.sq[rank] === (side === "w" ? "R" : "r"))
              out.push({ from: i, to: rank + 2, castle: "Q" });
          }
        }
      } else {
        var dirs = lo === "r" ? ROOKD : lo === "b" ? BISHD : ROOKD.concat(BISHD);
        for (var dd = 0; dd < dirs.length; dd++) {
          var cur = i;
          while (true) {
            var nx = cur + dirs[dd];
            if (nx < 0 || nx > 63 || Math.abs(fileOf(nx) - fileOf(cur)) > 1) break;
            var qq = b.sq[nx];
            if (!qq) out.push({ from: i, to: nx });
            else { if (sideOf(qq) !== side) out.push({ from: i, to: nx }); break; }
            cur = nx;
          }
        }
      }
    }
    return out;
  }
  function apply(b, m) {
    var nb = clone(b);
    var p = nb.sq[m.from], side = sideOf(p);
    nb.sq[m.to] = m.promo || p;
    nb.sq[m.from] = null;
    if (m.ep) nb.sq[m.to + (side === "w" ? -8 : 8)] = null;
    if (m.castle === "K") { var r1 = side === "w" ? 7 : 63; nb.sq[m.to - 1] = nb.sq[r1]; nb.sq[r1] = null; }
    if (m.castle === "Q") { var r2 = side === "w" ? 0 : 56; nb.sq[m.to + 1] = nb.sq[r2]; nb.sq[r2] = null; }
    // rights
    if (p === "K") { nb.castle.K = nb.castle.Q = false; }
    if (p === "k") { nb.castle.k = nb.castle.q = false; }
    [[0, "Q"], [7, "K"], [56, "q"], [63, "k"]].forEach(function (rc) {
      if (m.from === rc[0] || m.to === rc[0]) nb.castle[rc[1]] = false;
    });
    nb.ep = m.dbl ? (m.from + (side === "w" ? 8 : -8)) : null;
    nb.turn = side === "w" ? "b" : "w";
    return nb;
  }
  function legalMoves(b, side) {
    side = side || b.turn;
    var opp = side === "w" ? "b" : "w";
    return pseudo(b, side).filter(function (m) {
      if (m.castle) {
        // can't castle out of / through check
        var mid = m.castle === "K" ? m.from + 1 : m.from - 1;
        if (attacked(b, m.from, opp) || attacked(b, mid, opp)) return false;
      }
      return !inCheck(apply(b, m), side);
    });
  }
  function status(b, side) {
    side = side || b.turn;
    var moves = legalMoves(b, side);
    var chk = inCheck(b, side);
    if (!moves.length) return chk ? "mate" : "stale";
    return chk ? "check" : "ok";
  }
  function evalBoard(b, side) {
    var s = 0;
    for (var i = 0; i < 64; i++) {
      var p = b.sq[i];
      if (!p) continue;
      var v = VAL[p.toLowerCase()] + pst(p, i, sideOf(p));
      s += sideOf(p) === side ? v : -v;
    }
    return s;
  }
  function bestMove(b, side, o) {
    o = o || {};
    var maxNodes = o.maxNodes || 30000, maxDepth = o.depth || 3, nodes = 0;
    var ABORT = {};
    function nega(bb, depth, alpha, beta, s2) {
      if (++nodes > maxNodes) throw ABORT;
      var moves = legalMoves(bb, s2);
      if (!moves.length) return inCheck(bb, s2) ? -100000 + (maxDepth - depth) : 0;
      if (depth === 0) return evalBoard(bb, s2);
      // captures first for better pruning
      moves.sort(function (a, c) { return (bb.sq[c.to] ? 1 : 0) - (bb.sq[a.to] ? 1 : 0); });
      var best = -Infinity;
      for (var i = 0; i < moves.length; i++) {
        var v = -nega(apply(bb, moves[i]), depth - 1, -beta, -alpha, s2 === "w" ? "b" : "w");
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return best;
    }
    var rootMoves = legalMoves(b, side);
    if (!rootMoves.length) return null;
    var pick = rootMoves[0], scored = [];
    for (var d = 1; d <= maxDepth; d++) {
      try {
        var roundScores = [];
        var alpha = -Infinity;
        for (var i = 0; i < rootMoves.length; i++) {
          var v = -nega(apply(b, rootMoves[i]), d - 1, -Infinity, -alpha + 0, side === "w" ? "b" : "w");
          roundScores.push({ m: rootMoves[i], v: v });
          if (v > alpha) alpha = v;
        }
        roundScores.sort(function (a, c) { return c.v - a.v; });
        scored = roundScores;
        pick = scored[0].m;
      } catch (e) { if (e !== ABORT) throw e; break; }
    }
    // blunder model: sometimes take the 2nd/3rd best line instead
    if (o.blunder && scored.length > 1 && Math.random() < o.blunder) {
      pick = scored[Math.min(scored.length - 1, 1 + Math.floor(Math.random() * 2))].m;
    }
    return pick;
  }
  var AI = {
    initial: initial, fromMap: fromMap, clone: clone, idxOf: idxOf, nameOf: nameOf,
    legalMoves: legalMoves, apply: apply, status: status, inCheck: inCheck,
    bestMove: bestMove, evalBoard: evalBoard
  };

  // ============================== UI ==============================
  var GLYPH = { P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔", p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
  var CLUB = [
    { id: "noodle", title: "Rookie", rating: 400, depth: 1, nodes: 4000, blunder: 0.35 },
    { id: "pete", title: "Puzzler", rating: 700, depth: 2, nodes: 9000, blunder: 0.16 },
    { id: "carla", title: "Tactician", rating: 1000, depth: 2, nodes: 20000, blunder: 0.05 },
    { id: "queenq", title: "Champion", rating: 1300, depth: 3, nodes: 30000, blunder: 0.01 }
  ];
  var PUZZLES = [
    { mate: 1, note: "Checkmate on the back row.", board: { a1: "R", e1: "K", g8: "k", f7: "p", g7: "p", h7: "p" }, moves: [{ from: "a1", to: "a8" }] },
    { mate: 1, note: "Two rooks make a ladder.", board: { a1: "R", b7: "R", e1: "K", h8: "k" }, moves: [{ from: "a1", to: "a8" }] },
    { mate: 1, note: "Your king guards the escape squares.", board: { d1: "Q", g6: "K", g8: "k" }, moves: [{ from: "d1", to: "d8" }] },
    { mate: 1, note: "King and rook box the king in.", board: { a1: "R", f6: "K", f8: "k" }, moves: [{ from: "a1", to: "a8" }] },
    { mate: 1, note: "Queen to the corner — your king does the rest.", board: { a1: "Q", g6: "K", h8: "k" }, moves: [{ from: "a1", to: "a8" }] },
    { mate: 2, note: "Check, the king runs to h7, then Qg7 mate.", board: { f6: "K", b1: "Q", h8: "k" }, moves: [{ from: "b1", to: "b8" }, { from: "h8", to: "h7" }, { from: "b8", to: "g7" }] },
    { mate: 2, note: "Drive the king to a7, then Qb7 mate.", board: { c6: "K", g1: "Q", a8: "k" }, moves: [{ from: "g1", to: "g8" }, { from: "a8", to: "a7" }, { from: "g8", to: "b7" }] }
  ];

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("chess");
    if (!stats.rating) stats.rating = 500;

    var wrap = document.createElement("div"); wrap.className = "gamewrap chessclub";
    document.body.appendChild(wrap);
    // iPhone fit: the in-game HUD row (token + Word/Hint/Takeback + Leave) overflows
    // 393px, so compact + wrap it; push the board/lobby below the Dynamic Island + HUD.
    if (!document.getElementById("cc-ios-fit")) {
      var st = document.createElement("style"); st.id = "cc-ios-fit";
      st.textContent =
        ".gamewrap.chessclub .ghud .grow{flex-wrap:wrap;gap:6px;padding:0 4px}" +
        ".gamewrap.chessclub .ghud .grow span{padding:3px 8px;font-size:13px;white-space:nowrap;border-width:2px;border-bottom-width:3px}" +
        ".gamewrap.chessclub .ghud .grow .replay{font-size:12px;padding:3px 8px;white-space:nowrap}" +
        ".gamewrap.chessclub .ghud .grow .bossquit{font-size:13px;padding:4px 10px;margin-top:0;white-space:nowrap}" +
        ".gamewrap.chessclub .cc-lobby{padding-top:calc(env(safe-area-inset-top) + 104px)}" +
        ".gamewrap.chessclub .cc-boardwrap{margin-top:calc(env(safe-area-inset-top) + 104px)}";
      document.head.appendChild(st);
    }
    var sfx = global.VobloxSfx || null;
    var tokens = 0, lastFmt = null;

    function esc(s) { return VQ.esc(s); }
    function cleanup() {
      VQ.shush();
      if (wrap.parentNode) wrap.remove();
    }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }

    // ---------- lobby ----------
    function lobby() {
      var rows = CLUB.map(function (c, i) {
        var b = Bots.byId[c.id];
        return '<button class="cc-opp" data-i="' + i + '"><span class="cc-oname">' + esc(b.name) + '</span><span class="cc-otitle">' + c.title + " · " + c.rating + "</span></button>";
      }).join("");
      wrap.innerHTML =
        '<div class="ghud"><div class="clue">♟️ Chess Club — your rating: <b>' + Math.round(stats.rating) + "</b></div>" +
        '<div class="grow"><button class="bossquit" id="quit">Leave</button></div></div>' +
        '<div class="cc-lobby"><div class="card" style="max-width:460px;width:100%;color:#20303a;text-align:center">' +
        '<h2 style="margin:4px 0 10px">Pick your opponent</h2>' + rows +
        (stats.resume ? '<button class="submit big-next" id="cc-cont" style="margin-top:8px">⏩ Continue your game</button>' : "") +
        '<button class="menubtn" id="cc-puz" style="margin-top:10px">🧩 Puzzles (mate in 1–2)</button>' +
        "</div></div>";
      document.getElementById("quit").onclick = leave;
      Array.prototype.forEach.call(wrap.querySelectorAll(".cc-opp"), function (btn) {
        btn.onclick = function () { game(CLUB[parseInt(btn.dataset.i, 10)], null); };
      });
      var cont = document.getElementById("cc-cont");
      if (cont) cont.onclick = function () {
        var r = stats.resume;
        var c = CLUB.filter(function (x) { return x.id === r.oppId; })[0] || CLUB[0];
        game(c, r);
      };
      document.getElementById("cc-puz").onclick = function () { puzzle(0); };
    }

    // ---------- serialize ----------
    function ser(b) { return { s: b.sq.map(function (p) { return p || "."; }).join(""), t: b.turn, c: b.castle, e: b.ep }; }
    function deser(o) { return { sq: o.s.split("").map(function (ch) { return ch === "." ? null : ch; }), turn: o.t, castle: o.c, ep: o.e }; }

    // ---------- game vs bot ----------
    function game(club, resume) {
      var bot = Bots.byId[club.id];
      var board = resume ? deser(resume.board) : initial();
      var hist = [], sel = null, targets = [], thinking = false, over = false, hintSq = null;
      var myMoves = 0, awaitingWord = false, lastQ = null; // vocab is REQUIRED: a word gates play every few of your moves
      var QUESTION_EVERY = 6; // Leo found every-3 too naggy — a word every 6th of his moves

      function save() { stats.resume = { oppId: club.id, board: ser(board) }; store.save(); }
      function clearSave() { stats.resume = null; store.save(); }

      function render(msg) {
        var st = status(board);
        var cells = "";
        for (var r = 7; r >= 0; r--) for (var f = 0; f < 8; f++) {
          var i = r * 8 + f, p = board.sq[i];
          var cls = "csq " + ((r + f) % 2 ? "l" : "d") +
            (sel === i ? " sel" : "") +
            (targets.indexOf(i) !== -1 ? (p ? " cap" : " tgt") : "") +
            (hintSq === i ? " hint" : "");
          cells += '<div class="' + cls + '" data-i="' + i + '">' + (p ? GLYPH[p] : "") + "</div>";
        }
        wrap.innerHTML =
          '<div class="ghud"><div class="clue" id="ccmsg">' + (msg || ("♟️ vs <b>" + esc(bot.name) + "</b> (" + club.rating + ") — you're White! 🧠 word breaks keep you sharp")) + "</div>" +
          '<div class="grow"><span id="cctok">🧠 ' + tokens + "</span>" +
          '<button class="replay" id="ccword" type="button" title="Answer a word for a token">🧠 Word</button>' +
          '<button class="replay" id="cchint" type="button" title="1 token">💡 Hint</button>' +
          '<button class="replay" id="ccundo" type="button" title="1 token">↩️ Takeback</button>' +
          '<button class="bossquit" id="quit">Leave</button></div></div>' +
          '<div class="cc-boardwrap"><canvas id="ccfaces" width="340" height="54"></canvas><div class="cboard" id="cboard">' + cells + "</div></div>" +
          '<div class="gover" id="ccq" style="display:none"></div>';
        document.getElementById("quit").onclick = function () { if (!over) save(); leave(); };
        var fc = document.getElementById("ccfaces").getContext("2d");
        AV.drawHead(fc, { x: 30, y: 30, size: 34, config: AV.resolve(store.state) });
        fc.font = "bold 13px Trebuchet MS"; fc.fillStyle = "#fff"; fc.textAlign = "left";
        fc.fillText(store.state.profile.name + " (" + Math.round(stats.rating) + ")", 56, 34);
        AV.drawHead(fc, { x: 310, y: 30, size: 34, config: bot.avatar });
        fc.textAlign = "right"; fc.fillText(bot.name + " (" + club.rating + ")", 288, 34);
        document.getElementById("ccword").onclick = askWord;
        document.getElementById("cchint").onclick = hint;
        document.getElementById("ccundo").onclick = takeback;
        Array.prototype.forEach.call(wrap.querySelectorAll(".csq"), function (cell) {
          cell.onclick = function () { tap(parseInt(cell.dataset.i, 10)); };
        });
        if (over) {
          var box = document.createElement("div");
          box.className = "cc-end card";
          box.innerHTML = '<div style="font-size:34px">' + over.emoji + '</div><b>' + over.text + "</b><br>" +
            '<span class="muted2">Rating: ' + Math.round(over.oldR) + " → <b>" + Math.round(stats.rating) + "</b></span><br>" +
            '<button class="submit" id="ccagain" style="margin-top:8px">Play again</button> ' +
            '<button class="menubtn" id="cclobby" style="margin-top:8px">Club lobby</button>';
          wrap.appendChild(box);
          document.getElementById("ccagain").onclick = function () { game(club, null); };
          document.getElementById("cclobby").onclick = lobby;
        }
      }

      function tap(i) {
        if (over || thinking || awaitingWord || board.turn !== "w") return;
        hintSq = null;
        var p = board.sq[i];
        if (sel === null) {
          if (p && sideOf(p) === "w") { sel = i; targets = legalMoves(board, "w").filter(function (m) { return m.from === i; }).map(function (m) { return m.to; }); render(); }
          return;
        }
        if (i === sel) { sel = null; targets = []; render(); return; }
        var mv = legalMoves(board, "w").filter(function (m) { return m.from === sel && m.to === i; })[0];
        if (!mv) {
          if (p && sideOf(p) === "w") { sel = i; targets = legalMoves(board, "w").filter(function (m) { return m.from === i; }).map(function (m) { return m.to; }); render(); }
          return;
        }
        hist.push(ser(board));
        board = apply(board, mv);
        sel = null; targets = [];
        myMoves++;
        if (sfx) sfx.pop();
        afterMove("w");
      }

      function afterMove(mover) {
        var st = status(board);
        if (st === "mate") return finish(mover === "w");
        if (st === "stale") return finish(null);
        save();
        if (board.turn === "b") {
          thinking = true;
          render("🤔 " + esc(bot.name) + " is thinking…");
          setTimeout(function () {
            var mv = bestMove(board, "b", { depth: club.depth, maxNodes: club.nodes, blunder: club.blunder });
            if (mv) { board = apply(board, mv); if (sfx) sfx.tone(300, 0.05, "sine", 0.04); }
            thinking = false;
            var st2 = status(board);
            if (st2 === "mate") return finish(false); // white to move with no moves = I'm mated
            if (st2 === "stale") return finish(null);
            render(st2 === "check" ? "⚠️ Check! Protect your king!" : undefined);
            maybeAskRequired(); // every few of your moves, you must answer a word to keep playing
          }, 420);
        } else render(st === "check" ? "⚠️ Check!" : undefined);
      }

      function finish(iWon) { // true = I mated them; false = they mated me; null = draw
        var score = iWon === null ? 0.5 : iWon ? 1 : 0;
        var exp = 1 / (1 + Math.pow(10, (club.rating - stats.rating) / 400));
        var oldR = stats.rating;
        stats.rating = Math.max(100, stats.rating + 32 * (score - exp));
        clearSave();
        var res = store.recordGame("chess", {
          win: iWon === true, score: Math.round(stats.rating),
          rankPtsDelta: iWon === true ? 12 : iWon === null ? 5 : 2,
          xp: iWon === true ? 30 : iWon === null ? 15 : 8,
          gems: iWon === true ? 40 : iWon === null ? 15 : 5
        });
        over = { emoji: iWon === true ? "🏆" : iWon === null ? "🤝" : "♚", oldR: oldR,
                 text: iWon === true ? "CHECKMATE — you beat " + bot.name + "!" : iWon === null ? "Stalemate — a draw!" : bot.name + " got you — rematch?" };
        if (iWon === true && sfx) sfx.fanfare();
        render(over.text);
      }

      // ---- REQUIRED words: you must answer to keep playing (gates every few moves) ----
      function maybeAskRequired() {
        if (over || awaitingWord) return;
        if (myMoves > 0 && myMoves % QUESTION_EVERY === 0) requiredWord();
      }
      function requiredWord() {
        awaitingWord = true;
        lastQ = VQ.miniQuiz(document.getElementById("ccq"), words, store, {
          title: "🧠 Brain break! Answer a word to keep playing ♟️",
          lastFormat: lastFmt, skippable: false, // no skip — the whole point is he practices
          cb: function (ok, res, fmt) {
            lastFmt = fmt || lastFmt;
            awaitingWord = false;
            if (ok) { tokens = Math.min(3, tokens + 1); if (sfx) sfx.chime(); render("✅ Nice thinking! +🧠 token — your move!"); }
            else render("📚 Good try — remember that one. Your move!");
          }
        });
      }

      // ---- word tokens (BONUS): answer any time for a hint/takeback token ----
      function askWord() {
        if (awaitingWord) return;
        VQ.miniQuiz(document.getElementById("ccq"), words, store, {
          title: "🧠 Chess brain! Answer for a bonus token!",
          lastFormat: lastFmt, skippable: true,
          cb: function (ok, res, fmt) {
            lastFmt = fmt || lastFmt;
            if (ok) { tokens = Math.min(3, tokens + 1); if (sfx) sfx.chime(); }
            render();
          }
        });
      }
      function hint() {
        if (over || thinking) return;
        if (tokens < 1) { askWord(); return; }
        tokens--;
        var mv = bestMove(board, "w", { depth: 2, maxNodes: 15000 });
        if (mv) { sel = mv.from; targets = [mv.to]; hintSq = mv.to; }
        render("💡 Try this move!");
      }
      function takeback() {
        if (over || thinking || hist.length === 0) return;
        if (tokens < 1) { askWord(); return; }
        tokens--;
        board = deser(hist.pop());
        sel = null; targets = []; save();
        render("↩️ Take-back — try a different plan!");
      }

      // test hook: drive the required-word gating deterministically in the harness
      wrap._chess = {
        state: function () { return { myMoves: myMoves, awaitingWord: awaitingWord, turn: board.turn, over: !!over, tokens: tokens }; },
        play: function () {
          if (board.turn !== "w" || over || awaitingWord) return false;
          var mvs = legalMoves(board, "w"); if (!mvs.length) return false;
          tap(mvs[0].from); tap(mvs[0].to); return true;
        },
        quizUp: function () { var q = document.getElementById("ccq"); return !!(q && q.style.display !== "none" && q.querySelector(".wqc")); },
        answer: function (correct) {
          var wq = document.querySelectorAll("#ccq .wqc"); if (!wq.length || !lastQ) return false;
          var idx = 0; lastQ.choices.forEach(function (c, i) { if (correct ? c.correct : !c.correct) idx = i; });
          wq[idx].click(); return true;
        }
      };

      render();
    }

    // ---------- puzzles ----------
    function puzzle(pi) {
      var Pz = PUZZLES[pi % PUZZLES.length];
      var board = fromMap(Pz.board, "w"), moveIdx = 0, sel = null, solved = false;
      function render(msg, good) {
        var cells = "";
        for (var r = 7; r >= 0; r--) for (var f = 0; f < 8; f++) {
          var i = r * 8 + f, p = board.sq[i];
          cells += '<div class="csq ' + ((r + f) % 2 ? "l" : "d") + (sel === i ? " sel" : "") + '" data-i="' + i + '">' + (p ? GLYPH[p] : "") + "</div>";
        }
        wrap.innerHTML =
          '<div class="ghud"><div class="clue">🧩 Puzzle ' + (pi % PUZZLES.length + 1) + "/" + PUZZLES.length + " — <b>mate in " + Pz.mate + "</b></div>" +
          '<div class="grow"><button class="replay" id="cchintp">💡 Hint</button><button class="bossquit" id="quit">Leave</button></div></div>' +
          '<div class="cc-boardwrap"><div class="cboard">' + cells + "</div>" +
          '<div class="cc-pmsg" style="color:' + (good ? "#69f0ae" : "#ffd1a8") + '">' + (msg || "White to move — find the mate!") + "</div>" +
          (solved ? '<div style="text-align:center"><button class="submit" id="ccnext">Next puzzle ➡</button> <button class="menubtn" id="cclobby">Club lobby</button></div>' : "") +
          "</div>";
        document.getElementById("quit").onclick = leave;
        document.getElementById("cchintp").onclick = function () { render("💡 " + Pz.note, false); };
        if (solved) {
          document.getElementById("ccnext").onclick = function () { puzzle(pi + 1); };
          document.getElementById("cclobby").onclick = lobby;
          return;
        }
        Array.prototype.forEach.call(wrap.querySelectorAll(".csq"), function (cell) {
          cell.onclick = function () {
            var i = parseInt(cell.dataset.i, 10);
            if (sel === null) { if (board.sq[i] && sideOf(board.sq[i]) === "w") { sel = i; render(); } return; }
            var exp = Pz.moves[moveIdx];
            if (sel === idxOf(exp.from) && i === idxOf(exp.to)) {
              board.sq[idxOf(exp.to)] = board.sq[idxOf(exp.from)]; board.sq[idxOf(exp.from)] = null;
              sel = null; moveIdx++;
              if (moveIdx >= Pz.moves.length) {
                solved = true;
                store.recordGame("chess", { win: true, rankPtsDelta: 4, xp: 12, gems: 15 });
                if (sfx) sfx.fanfare();
                render("Checkmate! 🏆 Brilliant!", true);
              } else {
                var bm = Pz.moves[moveIdx];
                board.sq[idxOf(bm.to)] = board.sq[idxOf(bm.from)]; board.sq[idxOf(bm.from)] = null;
                moveIdx++;
                render("Black runs — now finish it!", true);
              }
            } else { sel = null; board = fromMap(Pz.board, "w"); moveIdx = 0; render("Not the mate — reset, try again!", false); }
          };
        });
      }
      render();
    }

    lobby();
  }

  global.VobloxChess = { start: start, AI: AI };
})(typeof window !== "undefined" ? window : globalThis);
