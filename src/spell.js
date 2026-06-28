/*
 * Voblox mini-game — Spell Quest.
 * Hear a word + read its definition, then tap the letter tiles in order to spell it.
 * Builds spelling + recall. ~8 words per round.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  function start(opts) {
    var words = opts.words, store = opts.store;
    var list = VQ.shuffle(words).slice(0, Math.min(8, words.length));
    var idx = 0, score = 0, target = null, tiles = [], answer = [];
    var wrap = document.createElement("div"); wrap.className = "gamewrap spell";
    document.body.appendChild(wrap);
    function speakWord() { VQ.speak(target.word); }

    function newWord() {
      target = list[idx]; answer = [];
      var s = target.senses[0];
      var letters = VQ.shuffle(target.word.split(""));
      tiles = letters.map(function (ch, i) { return { ch: ch, used: false, id: i }; });
      render("Tap the letters to spell the word.");
      VQ.speak(target.word);
    }
    function render(msg, good) {
      var slots = "";
      for (var i = 0; i < target.word.length; i++) slots += '<div class="slot">' + (answer[i] ? VQ.esc(answer[i].ch) : "") + "</div>";
      var tileH = tiles.map(function (t) { return '<button class="tile" data-id="' + t.id + '"' + (t.used ? " disabled" : "") + ">" + VQ.esc(t.ch) + "</button>"; }).join("");
      wrap.innerHTML = '<div class="sp-head"><div class="clue" id="spclue">📖 <b>“' + VQ.esc(target.senses[0].def) + '”</b> <span class="posclue">(' + target.senses[0].pos + ')</span></div>' +
        '<div class="grow"><span id="spscore">⭐ ' + score + '</span><span>' + (idx + 1) + " / " + list.length + '</span><button class="replay" id="sphear" type="button" title="Hear the word">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
        '<div class="sp-main"><div class="slots">' + slots + '</div>' +
        '<div class="sp-msg" style="color:' + (good ? "#2f9e44" : "#c0392b") + '">' + (msg || "") + '</div>' +
        '<div class="tiles">' + tileH + '</div>' +
        '<div class="row"><button class="menubtn" id="back">⌫ Backspace</button><button class="menubtn" id="clear">Clear</button></div></div>';
      document.getElementById("quit").onclick = leave;
      document.getElementById("sphear").onclick = speakWord;
      document.getElementById("back").onclick = backspace;
      document.getElementById("clear").onclick = clearAns;
      Array.prototype.forEach.call(wrap.querySelectorAll(".tile"), function (b) { b.onclick = function () { tap(parseInt(b.dataset.id, 10)); }; });
    }
    function tap(id) {
      var t = tiles[id]; if (t.used) return; t.used = true; answer.push(t);
      if (answer.length === target.word.length) check(); else render();
    }
    function backspace() { if (!answer.length) return; var t = answer.pop(); t.used = false; render(); }
    function clearAns() { answer.forEach(function (t) { t.used = false; }); answer = []; render(); }
    function check() {
      var spelled = answer.map(function (t) { return t.ch; }).join("");
      if (spelled.toLowerCase() === target.word.toLowerCase()) {
        score++; store.record({ word: target.word, format: "audio_spell", kind: "text" }, true);
        render("✅ " + target.word + " — correct!", true);
        setTimeout(function () { idx++; if (idx >= list.length) end(); else newWord(); }, 950);
      } else {
        store.record({ word: target.word, format: "audio_spell", kind: "text" }, false);
        render("❌ Not quite — try again!", false);
        setTimeout(clearAns, 700);
      }
    }
    function end() { store.state.gems += score * 6; store.save(); wrap.innerHTML = '<div class="card hero" style="max-width:460px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">🔤</div><div class="hero-line">Spelling done!</div><div class="hero-sub">You spelled <b>' + score + " / " + list.length + "</b> · +" + (score * 6) + ' 💎</div><button id="again" class="submit big-next">Play again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>'; document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave; }
    function cleanup() { if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }
    newWord();
  }
  global.VobloxSpell = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
