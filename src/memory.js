/*
 * Voblox mini-game — 🃏 Memory Match, versus edition.
 * 8 word↔meaning pairs, TURN-BASED against an AI rival with a realistically
 * imperfect memory (it remembers cards it has seen… usually). Match = keep
 * your turn + combo streak bonus. Most pairs wins the duel.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("memory");
    var bot = Bots.pickOpponents(1, P.botSkillFor(stats.rankPts))[0];
    var sfx = global.VobloxSfx || null;
    var picks = VQ.shuffle(words).slice(0, Math.min(8, words.length));
    var cards = [];
    picks.forEach(function (w, i) {
      cards.push({ id: i, kind: "w", word: w.word, html: w.emoji + " <b>" + VQ.esc(w.word) + "</b>", say: w.word });
      cards.push({ id: i, kind: "d", word: w.word, html: VQ.esc(w.senses[0].def), say: w.senses[0].def });
    });
    cards = VQ.shuffle(cards);
    var flipped = [], matched = {}, moves = 0, busy = false, ended = false;
    var myPairs = 0, botPairs = 0, combo = 0, bestCombo = 0, myTurn = true, botMsg = "", botTimers = [];
    // the rival's memory: card index -> remembered? (rolled once per reveal)
    var botMemory = {};
    function botSees(i) { if (botMemory[i] === undefined) botMemory[i] = Math.random() < 0.35 + bot.skill * 0.5; }

    var wrap = document.createElement("div"); wrap.className = "gamewrap memory"; document.body.appendChild(wrap);
    function teardown() { botTimers.forEach(clearTimeout); VQ.shush(); if (wrap.parentNode) wrap.remove(); }
    function leave() { teardown(); if (opts.onExit) opts.onExit(); }
    function again() { teardown(); start(opts); }

    function render(msg) {
      var cells = cards.map(function (c, i) {
        var face = matched[i] || flipped.indexOf(i) >= 0;
        return '<div class="mcard ' + (face ? "face" : "back") + (matched[i] ? " matched" : "") + (face && c.kind === "d" ? " def" : "") + '" data-i="' + i + '">' + (face ? c.html : '<span class="qm">?</span>') + "</div>";
      }).join("");
      wrap.innerHTML =
        '<div class="mem-vs"><div class="mem-side' + (myTurn ? " turn" : "") + '"><canvas id="mmc0" width="38" height="38"></canvas><b>' + VQ.esc(store.state.profile.name) + "</b> " + myPairs + (combo > 1 ? ' <span class="mem-combo">🔥x' + combo + "</span>" : "") + "</div>" +
        '<div class="mem-mid">' + (myTurn ? "YOUR TURN" : VQ.esc(bot.name) + " is thinking…") + "</div>" +
        '<div class="mem-side' + (!myTurn ? " turn" : "") + '" style="justify-content:flex-end"><b>' + VQ.esc(bot.name) + "</b> " + botPairs + ' <canvas id="mmc1" width="38" height="38"></canvas></div></div>' +
        '<div class="mgrid m16">' + cells + "</div>" +
        '<div class="mem-msg">' + (msg || botMsg || "") + "</div>" +
        '<button class="bossquit" id="quit">Leave</button>';
      var c0 = document.getElementById("mmc0"); if (c0) AV.drawHead(c0.getContext("2d"), { x: 19, y: 21, size: 26, config: AV.resolve(store.state) });
      var c1 = document.getElementById("mmc1"); if (c1) AV.drawHead(c1.getContext("2d"), { x: 19, y: 21, size: 26, config: bot.avatar });
      document.getElementById("quit").onclick = leave;
      Array.prototype.forEach.call(wrap.querySelectorAll(".mcard"), function (el) { el.onclick = function () { flip(parseInt(el.dataset.i, 10)); }; });
    }

    function resolvePair(who) {
      var a = cards[flipped[0]], b = cards[flipped[1]];
      var hit = a.id === b.id && a.kind !== b.kind;
      if (hit) {
        matched[flipped[0]] = true; matched[flipped[1]] = true;
        if (who === "me") {
          myPairs++; combo++; bestCombo = Math.max(bestCombo, combo);
          store.record({ word: a.word, format: "word2def", kind: "mc" }, true);
          if (sfx) sfx.coin();
        } else {
          botPairs++; botMsg = "🃏 " + bot.name + ": " + Bots.say(bot, "win");
          if (sfx) sfx.pop();
        }
      } else if (who === "me") combo = 0;
      flipped = [];
      var done = Object.keys(matched).length === cards.length;
      if (done) return finish();
      if (hit) { // matcher keeps the turn
        if (who === "me") { busy = false; render("✅ Match! Go again!"); }
        else botGo(650);
      } else {
        myTurn = who !== "me";
        if (myTurn) { busy = false; render("Your turn — where was that pair?"); }
        else { render("Miss! " + bot.name + "'s turn…"); botGo(800); }
      }
    }

    function flip(i) {
      if (!myTurn || busy || ended || matched[i] || flipped.indexOf(i) >= 0) return;
      flipped.push(i); botSees(i); render(); VQ.speak(cards[i].say);
      if (flipped.length === 2) {
        moves++; busy = true;
        var a = cards[flipped[0]], b = cards[flipped[1]];
        var hit = a.id === b.id && a.kind !== b.kind;
        setTimeout(function () { if (wrap.parentNode && !ended) resolvePair("me"); }, hit ? 500 : 950);
      }
    }

    // ---- the rival's turn ----
    function botKnownPair() {
      for (var i = 0; i < cards.length; i++) {
        if (matched[i] || !botMemory[i]) continue;
        for (var j = 0; j < cards.length; j++) {
          if (j === i || matched[j] || !botMemory[j]) continue;
          if (cards[i].id === cards[j].id && cards[i].kind !== cards[j].kind) return [i, j];
        }
      }
      return null;
    }
    function unmatchedUnknowns() {
      var out = [];
      for (var i = 0; i < cards.length; i++) if (!matched[i] && flipped.indexOf(i) === -1) out.push(i);
      return VQ.shuffle(out);
    }
    function botGo(delay) {
      botTimers.push(setTimeout(function () {
        if (ended || !wrap.parentNode) return;
        var pair = botKnownPair(), first, second;
        if (pair) { first = pair[0]; second = pair[1]; if (botMsg === "") botMsg = "🃏 " + bot.name + ": I saw that one!"; }
        else {
          first = unmatchedUnknowns()[0];
          botSees(first);
          // if it now knows the partner, grab it
          second = null;
          for (var j = 0; j < cards.length; j++) {
            if (j !== first && !matched[j] && botMemory[j] && cards[j].id === cards[first].id && cards[j].kind !== cards[first].kind) { second = j; break; }
          }
          if (second === null) second = unmatchedUnknowns().filter(function (x) { return x !== first; })[0];
        }
        if (first === undefined || second === undefined || second === null) return finish();
        flipped = [first]; render();
        botTimers.push(setTimeout(function () {
          if (ended || !wrap.parentNode) return;
          botSees(second);
          flipped = [first, second]; render();
          botTimers.push(setTimeout(function () { if (!ended && wrap.parentNode) resolvePair("bot"); }, 900));
        }, 700));
      }, delay || 700));
    }

    function finish() {
      if (ended) return; ended = true;
      var win = myPairs > botPairs, draw = myPairs === botPairs;
      var res = store.recordGame("memory", {
        win: win, score: myPairs,
        rankPtsDelta: win ? 10 : draw ? 4 : 2,
        xp: 6 + myPairs * 3 + bestCombo * 2 + (win ? 10 : 0),
        gems: myPairs * 8 + bestCombo * 4 + (win ? 20 : 0)
      });
      wrap.innerHTML = '<div class="card hero" style="max-width:480px;margin:60px auto 0;text-align:center;color:#20303a">' +
        '<div class="big-emoji">' + (win ? "🏆" : draw ? "🤝" : "🃏") + '</div>' +
        '<div class="hero-line">' + (win ? "You out-remembered " + VQ.esc(bot.name) + "!" : draw ? "A draw!" : VQ.esc(bot.name) + " wins " + botPairs + "–" + myPairs) + "</div>" +
        '<div class="hero-sub">' + myPairs + "–" + botPairs + " · best streak 🔥x" + bestCombo +
        (res.rankedUp ? " · <b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + "</div>" +
        '<button id="again" class="submit big-next">Rematch 🃏</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
      if (win && sfx) sfx.fanfare();
    }

    render("Match each word to its meaning — beat " + bot.name + "!");
  }
  global.VobloxMemory = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
