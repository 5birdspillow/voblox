/*
 * Voblox mini-game — Memory Match.
 * Flip cards to match each word to its meaning. Tests meaning recognition.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  function start(opts) {
    var words = opts.words, store = opts.store;
    var six = VQ.shuffle(words).slice(0, Math.min(6, words.length));
    var cards = [];
    six.forEach(function (w, i) {
      cards.push({ id: i, kind: "w", word: w.word, html: w.emoji + " <b>" + VQ.esc(w.word) + "</b>", say: w.word });
      cards.push({ id: i, kind: "d", word: w.word, html: VQ.esc(w.senses[0].def), say: w.senses[0].def });
    });
    cards = VQ.shuffle(cards);
    var flipped = [], matched = {}, moves = 0, busy = false;
    var wrap = document.createElement("div"); wrap.className = "gamewrap memory"; document.body.appendChild(wrap);
    function teardown() { if (wrap.parentNode) wrap.remove(); }
    function leave() { teardown(); if (opts.onExit) opts.onExit(); }
    function again() { teardown(); start(opts); }
    function render(msg) {
      var cells = cards.map(function (c, i) {
        var face = matched[i] || flipped.indexOf(i) >= 0;
        return '<div class="mcard ' + (face ? "face" : "back") + (matched[i] ? " matched" : "") + (face && c.kind === "d" ? " def" : "") + '" data-i="' + i + '">' + (face ? c.html : '<span class="qm">?</span>') + "</div>";
      }).join("");
      wrap.innerHTML = '<div class="mem-head">🃏 Memory Match — match each word to its meaning <span class="moves">Moves: ' + moves + " · Pairs: " + (Object.keys(matched).length / 2) + "/" + six.length + '</span></div><div class="mgrid">' + cells + '</div><div class="mem-msg">' + (msg || "") + '</div><button class="bossquit" id="quit">Leave</button>';
      document.getElementById("quit").onclick = leave;
      Array.prototype.forEach.call(wrap.querySelectorAll(".mcard"), function (el) { el.onclick = function () { flip(parseInt(el.dataset.i, 10)); }; });
    }
    function flip(i) {
      if (busy || matched[i] || flipped.indexOf(i) >= 0) return;
      flipped.push(i); render(); VQ.speak(cards[i].say);
      if (flipped.length === 2) {
        moves++; busy = true;
        var a = cards[flipped[0]], b = cards[flipped[1]];
        if (a.id === b.id && a.kind !== b.kind) {
          matched[flipped[0]] = true; matched[flipped[1]] = true;
          store.record({ word: a.word, format: "word2def", kind: "mc" }, true);
          flipped = []; busy = false; render("✅ Match!");
          if (Object.keys(matched).length === cards.length) return win();
        } else {
          setTimeout(function () { flipped = []; busy = false; render("Not a match — keep going!"); }, 850);
        }
      }
    }
    function win() { store.state.gems += 60; store.save(); wrap.innerHTML = '<div class="card hero" style="max-width:480px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">🏆</div><div class="hero-line">All matched in ' + moves + ' moves!</div><div class="hero-sub">+60 💎</div><button id="again" class="submit big-next">Play again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>'; document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave; }
    render("");
  }
  global.VobloxMemory = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
