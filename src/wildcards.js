/*
 * Voblox arcade game — 🃏 WILD CARDS (a friendly UNO-style shedding game).
 * You + 3 named bots sit around a center discard pile. Match the top card by
 * COLOR or SYMBOL, play action cards (⏭ Skip · 🔄 Reverse · +2 · 🌈 Wild · 🌈+4),
 * and race to empty your hand. First to empty wins the ROUND and scores the
 * points left in everyone else's hands; first to 300 wins the MATCH.
 *
 * "ONE!" — drop to a single card and a big ONE! button flashes for 2s: tap it or
 * draw a 2-card penalty. Bots sometimes FORGET theirs — tap their badge to catch
 * them for a 2-card penalty (pure kid-delight).
 *
 * VOCAB IS POWER, NEVER PUNISHMENT:
 *   - 🎴 WORD WILD: answer a word (miniQuiz) to turn any card in your hand into a
 *     Wild — once per round.
 *   - 🛡 DEFLECT: when a bot hits you with a +4, a word bounces it back — once per
 *     match; a wrong answer just draws you the cards, no shame.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("wildcards")
 * per match, banked on match-end, quit, AND app-close. Stats persist additively.
 *
 * Determinism: the shuffle uses Math.random, but set window._wcseed (a number)
 * before start() and the deal becomes reproducible (mulberry32 via VobloxProfile).
 */
(function (global) {
  var VQ = global.VobloxQuestions, Bots = global.VobloxBots, P = global.VobloxProfile;

  var COLORS = { red: "#e94b4b", yellow: "#f2b825", green: "#43b64d", blue: "#3d8bff" };
  var CORDER = ["red", "yellow", "green", "blue"];
  var TARGET = 300; // points to win the match
  var HAND0 = 7;    // opening hand size

  // A card is { color, sym }. color ∈ CORDER or "wild"; sym ∈ "0".."9" | "skip" |
  // "rev" | "+2" | "wild" | "+4". Wilds carry color "wild" until played.
  function buildDeck() {
    var deck = [];
    CORDER.forEach(function (col) {
      for (var n = 0; n <= 9; n++) { deck.push({ color: col, sym: "" + n }); deck.push({ color: col, sym: "" + n }); }
      ["skip", "rev", "+2"].forEach(function (s) { deck.push({ color: col, sym: s }); deck.push({ color: col, sym: s }); });
    });
    for (var w = 0; w < 4; w++) { deck.push({ color: "wild", sym: "wild" }); deck.push({ color: "wild", sym: "+4" }); }
    return deck;
  }
  function cardValue(c) {
    if (/^[0-9]$/.test(c.sym)) return parseInt(c.sym, 10);
    if (c.sym === "wild" || c.sym === "+4") return 50;
    return 20; // skip / rev / +2
  }
  function isAction(c) { return c.sym === "skip" || c.sym === "rev" || c.sym === "+2" || c.sym === "+4"; }
  function symGlyph(c) {
    if (c.sym === "skip") return "⏭"; if (c.sym === "rev") return "🔄";
    if (c.sym === "+2") return "+2"; if (c.sym === "wild") return "🌈"; if (c.sym === "+4") return "+4";
    return c.sym;
  }
  function testMode() { return !!global.__VOBLOX_TEST__; }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("wildcards");
    stats.matchWinsW = stats.matchWinsW || 0; // additive: matches you've won
    stats.roundsWon = stats.roundsWon || 0;   // additive: rounds you've won ever

    // seeded shuffle (opt-in via window._wcseed) so specs/demos are reproducible
    var rand = Math.random;
    if (typeof global._wcseed === "number" && P && P.rng) rand = P.rng(global._wcseed >>> 0);
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

    var wrap = document.createElement("div");
    wrap.className = "gamewrap wildcards";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="wccv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="wcmsg">🃏 Wild Cards</div>' +
      '<div class="grow"><span id="wcpts">🏁 0</span><span id="wcround">Round 1</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="wcbig"></div>' +
      '<button id="wcone" type="button" style="display:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 150px);' +
      'transform:translateX(-50%);z-index:9;background:linear-gradient(#ffe14d,#ff9f1f);color:#5a3d00;border:none;border-radius:20px;' +
      'padding:14px 30px;font-family:inherit;font-weight:900;font-size:22px;box-shadow:0 6px 0 #b9791a,0 10px 24px #0007;cursor:pointer">ONE! 🃏</button>' +
      '<button id="wcww" type="button" style="position:absolute;right:12px;bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:8;' +
      'background:linear-gradient(#b06dff,#7a3fd0);color:#fff;border:none;border-radius:14px;padding:10px 14px;font-family:inherit;font-weight:900;' +
      'font-size:14px;box-shadow:0 4px 0 #5a2ea0;cursor:pointer">🎴 Word Wild</button>' +
      '<div class="wccolors" id="wcpick" style="display:none;position:absolute;inset:0;z-index:10;background:rgba(10,16,28,.6);' +
      'flex-direction:column;align-items:center;justify-content:center"></div>' +
      '<div class="gover" id="wcq" style="display:none"></div>' +
      '<div class="gover" id="wccard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#wccv"), ctx = cv.getContext("2d");
    var msgEl = document.getElementById("wcmsg"), bigEl = document.getElementById("wcbig");
    var oneBtn = document.getElementById("wcone"), wwBtn = document.getElementById("wcww");
    var pickEl = document.getElementById("wcpick"), qEl = document.getElementById("wcq"), cardEl = document.getElementById("wccard");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var W, H;
    function resize() { W = cv.width = wrap.clientWidth || global.innerWidth || 360; H = cv.height = wrap.clientHeight || global.innerHeight || 640; }
    resize(); window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var bots = (Bots ? Bots.pickOpponents(3, P ? P.botSkillFor(stats.rankPts) : 0.5) : [{ name: "Bot A", skill: 0.4 }, { name: "Bot B", skill: 0.5 }, { name: "Bot C", skill: 0.6 }]);
    var hands, drawPile, discard, top, topColor, turn, dir, round, points;
    var over, paused, banked, matchWinner;
    var oneWindow, oneTimer, wordWildUsed, deflectUsed;
    var botOne = [null, null, null, null]; // catch windows, indexed by seat (1..3)
    var botDelay = 0, flash = 0, pendingWild = -1, pendingPlus4 = null;
    var lastFmt = null;

    function botAt(seat) { return bots[seat - 1]; }
    function nextSeat(s) { return (s + dir + 4) % 4; }
    function matches(c) { return c.color === "wild" || c.color === topColor || c.sym === top.sym; }
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1100); }
    function hud() {
      document.getElementById("wcpts").textContent = "🏁 " + points[0];
      document.getElementById("wcround").textContent = "Round " + round;
    }

    // ---------- dealing ----------
    function dealRound() {
      var deck = shuffle(buildDeck());
      hands = [[], [], [], []];
      for (var s = 0; s < 4; s++) for (var k = 0; k < HAND0; k++) hands[s].push(deck.pop());
      var first = deck.pop();
      while (first && first.color === "wild") { deck.unshift(first); first = deck.pop(); } // never open on a wild
      discard = [first]; top = { color: first.color, sym: first.sym }; topColor = first.color;
      drawPile = deck;
      turn = 0; dir = 1; botDelay = 0; flash = 0.4;
      oneWindow = false; oneTimer = 0; wordWildUsed = false; botOne = [null, null, null, null]; pendingWild = -1; pendingPlus4 = null;
      hideOne(); hud();
    }
    function startMatch() {
      points = [0, 0, 0, 0]; round = 1; over = false; paused = false; banked = false; matchWinner = -1; deflectUsed = false;
      cardEl.style.display = "none"; qEl.style.display = "none"; pickEl.style.display = "none";
      dealRound();
      big("🃏 Wild Cards — match color or symbol!", "#8ecdf7");
    }

    function refillFrom(discardIfEmpty) {
      if (drawPile.length) return;
      var keep = discard.pop();
      drawPile = shuffle(discard);
      discard = keep ? [keep] : [];
    }
    function drawCards(seat, n) {
      for (var i = 0; i < n; i++) { refillFrom(); if (!drawPile.length) break; hands[seat].push(drawPile.pop()); }
    }

    // ---------- playing a card ----------
    function doPlay(seat, i, colorPick) {
      var c = hands[seat].splice(i, 1)[0];
      discard.push(c); flash = 0.5;
      if (c.color === "wild") { topColor = colorPick || bestColor(seat); top = { color: topColor, sym: c.sym }; washColor(topColor); }
      else { topColor = c.color; top = { color: c.color, sym: c.sym }; }
      if (sfx && sfx.pop) sfx.pop();
      if (juice) juice.burst(W / 2, H / 2, COLORS[topColor] || "#fff", 8);
      if (hands[seat].length === 0) { roundWin(seat); return; }
      if (hands[seat].length === 1) {
        if (seat === 0) openOneWindow();
        else maybeBotForgetOne(seat);
      }
      applyEffectAndAdvance(seat, c, colorPick);
      hud();
    }
    function applyEffectAndAdvance(seat, c, colorPick) {
      var skip = false;
      if (c.sym === "rev") { dir *= -1; if (juice) juice.text(W / 2, H * 0.5, "🔄 REVERSE!", "#ffd23f"); }
      else if (c.sym === "skip") { skip = true; }
      else if (c.sym === "+2") { var t2 = nextSeat(seat); drawCards(t2, 2); skip = true; if (t2 === 0) big("😬 You drew 2!", "#ff8a8a"); }
      else if (c.sym === "+4") {
        var t4 = nextSeat(seat); skip = true;
        if (t4 === 0 && seat !== 0 && !deflectUsed && !testMode()) { pendingPlus4 = { from: seat, target: 0 }; advanceTurn(seat, true); openDeflect(); return; }
        drawCards(t4, 4); if (t4 === 0) big("😬 +4! You drew four!", "#ff8a8a");
      }
      advanceTurn(seat, skip);
    }
    function advanceTurn(seat, skip) {
      turn = nextSeat(seat);
      if (skip) turn = nextSeat(turn);
      botDelay = turn >= 1 ? 0.7 : 0;
      if (turn === 0 && !over) msg("Your turn — tap a card that matches " + topColor + " or " + prettySym());
    }
    function prettySym() { return /^[0-9]$/.test(top.sym) ? top.sym : symGlyph(top); }
    function msg(m) { msgEl.textContent = "🃏 " + m; }

    // public play (returns true if the play was legal and taken)
    function play(i, colorPick) {
      if (over || paused || turn !== 0) return false;
      var c = hands[0][i];
      if (!c) return false;
      if (!matches(c)) { shakeHand(i); return false; }
      if (c.color === "wild" && !colorPick && !testMode()) { openColorPicker(i); return true; }
      doPlay(0, i, colorPick || (c.color === "wild" ? bestColor(0) : null));
      return true;
    }
    function playerDraw() {
      if (over || paused || turn !== 0) return;
      drawCards(0, 1);
      var last = hands[0][hands[0].length - 1];
      if (juice) juice.text(W / 2, H - 90, "drew a card", "#cfd6dd");
      if (sfx && sfx.pop) sfx.pop();
      if (matches(last)) { msg("Playable! Tap it, or keep it."); hud(); return; } // let kids play what they drew
      advanceTurn(0, false); hud();
    }
    function bestColor(seat) {
      var cnt = { red: 0, yellow: 0, green: 0, blue: 0 };
      hands[seat].forEach(function (c) { if (cnt[c.color] !== undefined) cnt[c.color]++; });
      var best = CORDER[0]; CORDER.forEach(function (col) { if (cnt[col] > cnt[best]) best = col; });
      return best;
    }

    // ---------- ONE! window ----------
    function openOneWindow() { oneWindow = true; oneTimer = 2.0; showOne(); if (sfx && sfx.chime) sfx.chime(); }
    function showOne() { if (!testMode()) oneBtn.style.display = "block"; }
    function hideOne() { oneBtn.style.display = "none"; }
    function callOne() { if (!oneWindow) return; oneWindow = false; oneTimer = 0; hideOne(); big("🃏 ONE! Safe!", "#69f0ae"); if (sfx && sfx.coin) sfx.coin(); }
    function onePenalty() { oneWindow = false; hideOne(); drawCards(0, 2); big("😅 Forgot to call ONE — draw 2!", "#ff8a8a"); if (sfx && sfx.buzz) sfx.buzz(); hud(); }

    // ---------- bots ----------
    function botTurn() { if (!over && !paused && turn >= 1) doBotTurn(turn); }
    function doBotTurn(seat) {
      if (over || paused || turn !== seat) return;
      var hand = hands[seat], skill = botAt(seat).skill || 0.4;
      var legal = [];
      for (var i = 0; i < hand.length; i++) if (matches(hand[i])) legal.push(i);
      if (!legal.length) { // draw one, play it if it fits, else pass
        drawCards(seat, 1);
        var li = hand.length - 1;
        if (matches(hand[li])) doPlay(seat, li, hand[li].color === "wild" ? bestColor(seat) : null);
        else advanceTurn(seat, false);
        hud(); return;
      }
      // score legal cards: shed minority colors (hoard the dominant one), value ties,
      // and — for sharper bots — disrupt a player who is nearly out.
      var cnt = { red: 0, yellow: 0, green: 0, blue: 0 };
      hand.forEach(function (c) { if (cnt[c.color] !== undefined) cnt[c.color]++; });
      var threat = skill > 0.55 && (hands[nextSeat(seat)] || []).length <= 2;
      var bestI = legal[0], bestS = -1e9;
      legal.forEach(function (i) {
        var c = hand[i], sc = cardValue(c);
        if (c.color === "wild") sc -= 60 + skill * 40; // hold wilds unless forced
        else sc -= cnt[c.color] * 6;                    // keep the colors you hoard
        if (threat && isAction(c)) sc += 30;            // punish the leader
        if (sc > bestS) { bestS = sc; bestI = i; }
      });
      var pick = hand[bestI];
      doPlay(seat, bestI, pick.color === "wild" ? bestColor(seat) : null);
      hud();
    }
    function maybeBotForgetOne(seat) {
      var skill = botAt(seat).skill || 0.4;
      if (rand() < 0.5 * (1 - skill)) { botOne[seat] = { t: 2.2 }; big("👀 " + botAt(seat).name + " has ONE card — CATCH them!", "#ffd23f"); }
      else big(botAt(seat).name + ": ONE!", "#8ecdf7");
    }
    function catchBot(idx) {
      var seat = idx + 1;
      if (botOne[seat]) { botOne[seat] = null; drawCards(seat, 2); big("🎯 Caught " + botAt(seat).name + " — they draw 2!", "#69f0ae"); if (sfx && sfx.fanfare) sfx.fanfare(); if (juice) juice.shake(5); return true; }
      return false;
    }

    // ---------- round / match end ----------
    function roundWin(winner) {
      var got = 0;
      for (var s = 0; s < 4; s++) if (s !== winner) hands[s].forEach(function (c) { got += cardValue(c); });
      points[winner] += got;
      if (winner === 0) { stats.roundsWon += 1; store.save(); }
      round += 1;
      var who = winner === 0 ? "You" : botAt(winner).name;
      if (points[winner] >= TARGET) { matchEnd(winner); return; }
      big("🏁 " + who + " won the round! +" + got + " pts", winner === 0 ? "#69f0ae" : "#ffd23f");
      if (sfx && (winner === 0 ? sfx.fanfare : sfx.chime)) (winner === 0 ? sfx.fanfare : sfx.chime)();
      if (testMode()) { dealRound(); } // specs drive rounds directly — no button gate
      else showRoundSummary(who, got);
    }
    function showRoundSummary(who, got) {
      paused = true;
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:40px">🏁</div>' +
        '<div class="wqtitle">' + who + ' won the round! +' + got + ' pts</div>' +
        scoreboardHTML() +
        '<button class="submit big-next" id="wcnext" type="button">Next round ➜</button></div>';
      cardEl.style.display = "flex";
      document.getElementById("wcnext").onclick = function () { cardEl.style.display = "none"; paused = false; dealRound(); big("🃏 Round " + round + "!", "#8ecdf7"); };
    }
    function scoreboardHTML() {
      var names = ["You", botAt(1).name, botAt(2).name, botAt(3).name];
      return '<div style="margin:8px 0;font-size:14px">' + names.map(function (n, i) {
        return '<div style="display:flex;justify-content:space-between;gap:20px;' + (i === 0 ? "font-weight:900;color:#2f7be0" : "") + '"><span>' + n + '</span><span>' + points[i] + ' / ' + TARGET + '</span></div>';
      }).join("") + "</div>";
    }
    function rewards() {
      var won = matchWinner === 0;
      return {
        win: won, score: points[0],
        rankPtsDelta: won ? 10 : (matchWinner < 0 ? 2 : 3),
        xp: Math.min(80, 8 + (stats.roundsWon ? 0 : 0) + Math.floor(points[0] / 12) + (won ? 20 : 0)),
        gems: 3 + Math.floor(points[0] / 20) + (won ? 15 : 0)
      };
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = rewards();
      var res = store.recordGame ? store.recordGame("wildcards", rw) : null;
      return { rw: rw, res: res };
    }
    function matchEnd(winner) {
      if (over) return;
      over = true; paused = true; matchWinner = winner;
      if (winner === 0) { stats.matchWinsW += 1; store.save(); }
      var bank = bankRun() || { rw: rewards(), res: null };
      showEndCard(bank.rw, bank.res);
    }
    function showEndCard(rw, res) {
      var won = matchWinner === 0;
      cardEl.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:46px">' + (won ? "🏆" : "🃏") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (won ? "YOU WIN THE MATCH!" : botAt(matchWinner < 1 ? 1 : matchWinner).name + " took the match") + '</div>' +
        scoreboardHTML() +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP' + (res && res.rankedUp ? ' · 🎖 RANK UP!' : '') + '</div>' +
        '<div style="font-size:12px;color:#5a6b7a">🏆 ' + (stats.matchWinsW || 0) + ' match wins · 🏁 ' + (stats.roundsWon || 0) + ' rounds won all-time</div>' +
        '<button class="submit big-next" id="wcrematch" type="button">Rematch ➜</button>' +
        '<button class="wqskip" id="wcleave" type="button">Leave</button></div>';
      cardEl.style.display = "flex";
      if (won && sfx && sfx.fanfare) sfx.fanfare();
      if (won && juice) { juice.shake(7); for (var f = 0; f < 5; f++) juice.burst(W * (0.2 + f * 0.15), H * 0.35, [COLORS.red, COLORS.yellow, COLORS.green, COLORS.blue, "#b06dff"][f], 16); }
      document.getElementById("wcrematch").onclick = function () { cardEl.style.display = "none"; startMatch(); };
      document.getElementById("wcleave").onclick = exit;
    }

    // ---------- word hooks ----------
    function wordWildQuiz() {
      if (wordWildUsed || over || paused) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "🎴 WORD WILD! Answer to turn a card into a Wild!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            var idx = -1; for (var i = 0; i < hands[0].length; i++) if (hands[0][i].color !== "wild") { idx = i; break; }
            if (idx < 0) idx = 0;
            if (hands[0][idx]) { hands[0][idx] = { color: "wild", sym: "wild" }; wordWildUsed = true; big("🎴 A card became a 🌈 WILD!", "#c9b6ff"); if (juice) juice.shake(4); }
          } else big("The magic fizzled…", "#ff8a8a");
          hud();
        }
      });
    }
    function openDeflect() { deflectQuiz(); }
    function deflectQuiz() {
      if (deflectUsed || over) return;
      paused = true;
      var from = pendingPlus4 ? pendingPlus4.from : 1;
      cv._lastQ = VQ.miniQuiz(qEl, words, store, {
        title: "🛡 DEFLECT! Answer to bounce the +4 back!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false; deflectUsed = true; pendingPlus4 = null;
          if (ok) { drawCards(from, 4); big("🛡 DEFLECTED! " + botAt(from).name + " draws 4!", "#69f0ae"); if (sfx && sfx.fanfare) sfx.fanfare(); if (juice) juice.shake(6); }
          else { drawCards(0, 4); big("So close — you draw 4. No worries!", "#ffd23f"); }
          hud();
        }
      });
    }

    // ---------- color picker (real-play wilds) ----------
    function openColorPicker(i) {
      pendingWild = i; paused = true;
      pickEl.innerHTML = '<div style="color:#fff;font-weight:900;font-size:20px;margin-bottom:14px">🌈 Pick a color</div>' +
        '<div style="display:flex;gap:14px">' + CORDER.map(function (col) {
          return '<button data-col="' + col + '" style="width:74px;height:74px;border-radius:16px;border:4px solid #fff8;background:' + COLORS[col] + ';cursor:pointer"></button>';
        }).join("") + "</div>";
      pickEl.style.display = "flex";
      Array.prototype.forEach.call(pickEl.querySelectorAll("[data-col]"), function (b) {
        b.onclick = function () { pickEl.style.display = "none"; paused = false; var idx = pendingWild; pendingWild = -1; if (idx >= 0 && hands[0][idx]) doPlay(0, idx, b.dataset.col); };
      });
      washColor(null);
    }
    var wash = { col: null, t: 0 };
    function washColor(col) { wash.col = col; wash.t = col ? 0.6 : 0; }

    // ---------- simulation ----------
    function step(dt) {
      if (paused || over) return;
      flash = Math.max(0, flash - dt);
      if (wash.t > 0) wash.t = Math.max(0, wash.t - dt);
      if (oneWindow) { oneTimer -= dt; if (oneTimer <= 0) onePenalty(); }
      for (var s = 1; s <= 3; s++) if (botOne[s]) { botOne[s].t -= dt; if (botOne[s].t <= 0) botOne[s] = null; }
      if (turn >= 1) { botDelay -= dt; if (botDelay <= 0) doBotTurn(turn); }
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function cardFace(x, y, w, h, c, faceUp) {
      rrect(x, y, w, h, w * 0.16);
      ctx.fillStyle = faceUp ? (c.color === "wild" ? "#2b2b3a" : COLORS[c.color]) : "#20304a";
      ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(2, w * 0.06); ctx.stroke();
      if (!faceUp) { ctx.fillStyle = "#e94b4b"; ctx.font = "900 " + Math.round(w * 0.4) + "px Trebuchet MS"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🃏", x + w / 2, y + h / 2); return; }
      if (c.color === "wild") { // rainbow corner wedge
        var q = CORDER.map(function (col) { return COLORS[col]; });
        for (var k = 0; k < 4; k++) { ctx.fillStyle = q[k]; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 2); ctx.arc(x + w / 2, y + h / 2, w * 0.42, k * Math.PI / 2, (k + 1) * Math.PI / 2); ctx.closePath(); ctx.fill(); }
      }
      ctx.fillStyle = c.color === "wild" ? "#fff" : "#fff";
      ctx.font = "900 " + Math.round(w * (isAction(c) ? 0.34 : 0.52)) + "px Trebuchet MS";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(symGlyph(c), x + w / 2, y + h / 2);
    }
    // layout the player's fanned hand → array of {x,y,w,h,i}
    function handLayout() {
      var n = hands ? hands[0].length : 0, out = [];
      var cw = Math.min(W * 0.16, 78), ch = cw * 1.45;
      var spread = Math.min(W * 0.62, n * cw * 0.62);
      var step = n > 1 ? spread / (n - 1) : 0, x0 = W / 2 - spread / 2;
      var by = H - ch * 0.72;
      for (var i = 0; i < n; i++) { out.push({ x: (n > 1 ? x0 + i * step : W / 2) - cw / 2, y: by, w: cw, h: ch, i: i }); }
      return out;
    }
    function seatPos(seat) {
      if (seat === 0) return { x: W / 2, y: H - 40 };
      if (seat === 1) return { x: 44, y: H * 0.45 };
      if (seat === 2) return { x: W / 2, y: 54 };
      return { x: W - 44, y: H * 0.45 };
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#16603a"); g.addColorStop(1, "#0c3a24");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (wash.t > 0 && wash.col) { ctx.fillStyle = COLORS[wash.col]; ctx.globalAlpha = wash.t * 0.4; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      if (!hands) return;
      // center discard pile
      var cw = Math.min(W * 0.16, 84), ch = cw * 1.45;
      if (top) {
        ctx.save();
        if (flash > 0) { var s2 = 1 + flash * 0.4; ctx.translate(W / 2, H / 2); ctx.scale(s2, s2); ctx.translate(-W / 2, -H / 2); }
        cardFace(W / 2 - cw / 2, H / 2 - ch / 2, cw, ch, { color: topColor, sym: top.sym }, true);
        ctx.restore();
      }
      // draw pile
      cardFace(W / 2 - cw * 1.5, H / 2 - ch / 2, cw, ch, { color: "wild", sym: "" }, false);
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.font = "bold 12px Trebuchet MS"; ctx.textAlign = "center";
      ctx.fillText("DRAW", W / 2 - cw, H / 2 + ch * 0.62);
      // opponents: badge + card-count + name; catch-halo if they forgot ONE
      for (var seat = 1; seat <= 3; seat++) {
        var p = seatPos(seat), b = botAt(seat), n = hands[seat].length;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (botOne[seat]) { ctx.strokeStyle = "rgba(255,210,60," + (0.5 + Math.sin(performance.now() / 120) * 0.4) + ")"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = turn === seat ? "#ffd23f" : "#20304a"; rrect(p.x - 30, p.y - 22, 60, 44, 10); ctx.fill();
        ctx.fillStyle = turn === seat ? "#5a3d00" : "#fff"; ctx.font = "900 20px Trebuchet MS"; ctx.fillText("🃏 " + n, p.x, p.y);
        ctx.fillStyle = "#dfeee6"; ctx.font = "bold 12px Trebuchet MS"; ctx.fillText(b.name + (n === 1 ? " · ONE!" : ""), p.x, p.y + 30);
      }
      // your fanned hand
      var lay = handLayout();
      lay.forEach(function (r) {
        var c = hands[0][r.i]; if (!c) return;
        var lift = matches(c) && turn === 0 ? 8 : 0;
        cardFace(r.x, r.y - lift, r.w, r.h, c, true);
      });
      if (turn === 0) { ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = "bold 13px Trebuchet MS"; ctx.textAlign = "center"; ctx.fillText("YOUR TURN", W / 2, H - Math.min(W * 0.16, 78) * 1.45 - 12); }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- input ----------
    function shakeHand(i) { flash = 0; if (juice) juice.shake(4); if (sfx && sfx.buzz) sfx.buzz(); big("Doesn't match — try another!", "#ff8a8a"); }
    function tap(x, y) {
      if (over || paused) return;
      // catch a forgetful bot
      for (var seat = 1; seat <= 3; seat++) { if (botOne[seat]) { var p = seatPos(seat); if (Math.abs(x - p.x) < 40 && Math.abs(y - p.y) < 40) { catchBot(seat - 1); return; } } }
      if (turn !== 0) return;
      var cw = Math.min(W * 0.16, 84), ch = cw * 1.45;
      if (Math.abs(x - (W / 2 - cw)) < cw * 0.6 && Math.abs(y - H / 2) < ch * 0.6) { playerDraw(); return; } // draw pile
      var lay = handLayout();
      for (var k = lay.length - 1; k >= 0; k--) { var r = lay[k]; if (x >= r.x && x <= r.x + r.w && y >= r.y - 12 && y <= r.y + r.h) { play(r.i); return; } }
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var r = cv.getBoundingClientRect(); tap(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top); }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); tap(e.clientX - r.left, e.clientY - r.top); });
    oneBtn.onclick = callOne;
    wwBtn.onclick = wordWildQuiz;

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
      if (over || !hands || banked) return; // an in-progress match banks as a loss
      matchWinner = -1;
      var b = bankRun();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🃏 Wild Cards banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
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

    // ---------- test API ----------
    cv._wildcards = {
      state: function () {
        return {
          round: round, yourCards: hands ? hands[0].length : 0,
          botCards: hands ? [hands[1].length, hands[2].length, hands[3].length] : [0, 0, 0],
          top: top ? { color: topColor, sym: top.sym } : null, turn: turn, points: points ? points.slice() : [0, 0, 0, 0],
          over: over, won: matchWinner === 0, banked: banked, oneWindow: oneWindow,
          wordWildUsed: wordWildUsed, deflectUsed: deflectUsed
        };
      },
      begin: startMatch,
      hand: function () { return hands[0].map(function (c) { return { color: c.color, sym: c.sym }; }); },
      play: play,
      draw: playerDraw,
      botTurn: botTurn,
      setHand: function (cards) { hands[0] = cards.map(function (c) { return { color: c.color, sym: c.sym }; }); hud(); },
      setTop: function (c) { top = { color: c.color, sym: c.sym }; topColor = c.color; discard = [{ color: c.color, sym: c.sym }]; },
      callOne: callOne,
      catchBot: catchBot,
      wordWildQuiz: wordWildQuiz,
      deflectQuiz: deflectQuiz,
      tick: function (seconds) { var left = seconds; while (left > 0 && !over) { var d = Math.min(0.05, left); step(d); left -= d; } }
    };

    // ---------- boot ----------
    startMatch();
    if (global._wildcardsdemo) { // screenshot seed: a lively paused mid-round
      global._wildcardsdemo = 0;
      hands[0] = [{ color: "red", sym: "7" }, { color: "red", sym: "skip" }, { color: "blue", sym: "3" }, { color: "green", sym: "+2" }, { color: "wild", sym: "wild" }, { color: "yellow", sym: "9" }];
      top = { color: "green", sym: "+2" }; topColor = "green"; flash = 0.5; // a +2 just played, glowing
      hands[2] = [{ color: "blue", sym: "5" }]; botOne[2] = { t: 2.0 }; // a bot at ONE, catch window open
      turn = 0; paused = true; hud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxWildCards = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
