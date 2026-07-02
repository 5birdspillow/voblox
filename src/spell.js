/*
 * Voblox mini-game — Spell Quest.
 * Hear a word + read its definition, then tap the letter tiles in order to spell it.
 * Builds spelling + recall. ~8 words per round.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  function start(opts) {
    var words = opts.words, store = opts.store;
    var sfx = global.VobloxSfx || null;
    var list = VQ.shuffle(words).slice(0, Math.min(8, words.length));
    // the boss word (longest) goes last, worth double
    list.sort(function (a, b) { return a.word.length - b.word.length; });
    var idx = 0, score = 0, target = null, tiles = [], answer = [], hints = 2, streak = 0, bestStreak = 0, firstTry = true, wordT0 = 0, gemsBank = 0;
    var wrap = document.createElement("div"); wrap.className = "gamewrap spell";
    document.body.appendChild(wrap);
    function speakWord() { VQ.speak(target.word); }
    function isBoss() { return idx === list.length - 1; }

    function newWord() {
      target = list[idx]; answer = []; firstTry = true; wordT0 = performance.now();
      var letters = VQ.shuffle(target.word.split(""));
      tiles = letters.map(function (ch, i) { return { ch: ch, used: false, id: i }; });
      render(isBoss() ? "👑 BOSS WORD — double Vobux!" : "Tap the letters to spell the word.");
      VQ.speak(target.word);
    }
    function render(msg, good) {
      var slots = "";
      for (var i = 0; i < target.word.length; i++) slots += '<div class="slot">' + (answer[i] ? VQ.esc(answer[i].ch) : "") + "</div>";
      var tileH = tiles.map(function (t) { return '<button class="tile" data-id="' + t.id + '"' + (t.used ? " disabled" : "") + ">" + VQ.esc(t.ch) + "</button>"; }).join("");
      wrap.innerHTML = '<div class="sp-head"><div class="clue" id="spclue">' + (isBoss() ? "👑 " : "📖 ") + '<b>“' + VQ.esc(target.senses[0].def) + '”</b> <span class="posclue">(' + target.senses[0].pos + ')</span></div>' +
        '<div class="grow"><span id="spscore">⭐ ' + score + '</span><span>' + (idx + 1) + " / " + list.length + "</span>" + (streak > 1 ? '<span style="background:#ffce3a;color:#3a2a00;border-radius:8px;padding:2px 8px;font-weight:900">🔥x' + streak + "</span>" : "") + '<button class="replay" id="sphear" type="button" title="Hear the word">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
        '<div class="sp-main"><div class="slots">' + slots + '</div>' +
        '<div class="sp-msg" style="color:' + (good ? "#2f9e44" : "#c0392b") + '">' + (msg || "") + '</div>' +
        '<div class="tiles">' + tileH + '</div>' +
        '<div class="row"><button class="menubtn" id="back">⌫ Backspace</button><button class="menubtn" id="clear">Clear</button><button class="menubtn" id="hint">💡 Hint (' + hints + ')</button></div></div>';
      document.getElementById("quit").onclick = leave;
      document.getElementById("sphear").onclick = speakWord;
      document.getElementById("back").onclick = backspace;
      document.getElementById("clear").onclick = clearAns;
      document.getElementById("hint").onclick = useHint;
      Array.prototype.forEach.call(wrap.querySelectorAll(".tile"), function (b) { b.onclick = function () { tap(parseInt(b.dataset.id, 10)); }; });
    }
    function useHint() {
      if (hints <= 0) return;
      var need = target.word[answer.length];
      if (need === undefined) return;
      for (var i = 0; i < tiles.length; i++) {
        if (!tiles[i].used && tiles[i].ch.toLowerCase() === need.toLowerCase()) {
          hints--; firstTry = false;
          if (sfx) sfx.pop();
          tap(tiles[i].id);
          return;
        }
      }
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
        score++;
        var quick = (performance.now() - wordT0) < 9000;
        if (firstTry) { streak++; bestStreak = Math.max(bestStreak, streak); } else streak = 0;
        var g = (6 + (quick ? 4 : 0) + Math.min(8, streak * 2)) * (isBoss() ? 2 : 1);
        gemsBank += g;
        store.record({ word: target.word, format: "audio_spell", kind: "text" }, true);
        if (sfx) (isBoss() ? sfx.fanfare() : sfx.coin());
        render("✅ " + target.word + "! +" + g + " 💎" + (quick ? " ⚡quick!" : "") + (isBoss() ? " 👑BOSS!" : ""), true);
        setTimeout(function () { idx++; if (idx >= list.length) end(); else newWord(); }, 950);
      } else {
        firstTry = false; streak = 0;
        store.record({ word: target.word, format: "audio_spell", kind: "text" }, false);
        if (sfx) sfx.buzz();
        render("❌ Not quite — try again!", false);
        setTimeout(clearAns, 700);
      }
    }
    function end() {
      var res = store.recordGame("spell", {
        win: score === list.length, score: score,
        rankPtsDelta: score === list.length ? 10 : score >= 5 ? 5 : 2,
        xp: 6 + score * 4 + bestStreak * 2,
        gems: gemsBank
      });
      wrap.innerHTML = '<div class="card hero" style="max-width:460px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">' + (score === list.length ? "🏆" : "🔤") + '</div><div class="hero-line">Spelling done!</div><div class="hero-sub">You spelled <b>' + score + " / " + list.length + "</b> · best streak 🔥x" + bestStreak + " · +" + gemsBank + ' 💎' + ((res && res.rankedUp) ? " · <b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + '</div><button id="again" class="submit big-next">Play again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
      if (score === list.length && sfx) sfx.fanfare();
    }
    function cleanup() { if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }
    newWord();
  }
  global.VobloxSpell = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
