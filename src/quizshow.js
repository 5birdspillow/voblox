/*
 * Voblox mini-game — Quiz Show ("Vocab Millionaire").
 * Climb a points ladder by answering multiple-choice vocab questions. 3 lives, one 50:50.
 * The word is NOT shown in advance, so "which word means…" style questions are fair here.
 */
(function (global) {
  var Engine = global.VobloxEngine, VQ = global.VobloxQuestions;
  var LADDER = [100, 250, 500, 1000, 2000, 4000, 8000, 16000, 50000, 100000];

  function speak(t) { try { if (!("speechSynthesis" in global)) return; var u = new SpeechSynthesisUtterance(t); u.rate = 0.9; var v = (speechSynthesis.getVoices() || []).filter(function (x) { return /en[-_]?US/i.test(x.lang); })[0]; if (v) u.voice = v; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }
  function confetti() { var cols = ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb", "#ffab40"]; for (var i = 0; i < 18; i++) { var s = document.createElement("div"); s.style.cssText = "position:fixed;z-index:70;top:-16px;width:11px;height:11px;border-radius:3px;pointer-events:none;left:" + (8 + Math.random() * 84) + "vw;background:" + cols[i % 6] + ";transition:transform 1.1s ease-in,opacity 1.1s"; document.body.appendChild(s); (function (n) { requestAnimationFrame(function () { n.style.transform = "translateY(110vh) rotate(540deg)"; n.style.opacity = "0.2"; }); setTimeout(function () { n.remove(); }, 1200); })(s); } }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var ALLOWED = [Engine.FORMATS.DEF2WORD_MC, Engine.FORMATS.WORD2DEF, Engine.FORMATS.CLOZE_MC, Engine.FORMATS.SYNONYM, Engine.FORMATS.ANTONYM];
    var level = 0, lives = 3, fifty = true, lastWord = null;
    var wrap = document.createElement("div"); wrap.className = "gamewrap quizshow"; document.body.appendChild(wrap);
    var keyFn = null; function onKey(e) { if (keyFn) keyFn(e); } document.addEventListener("keydown", onKey);
    function teardown() { document.removeEventListener("keydown", onKey); if (wrap.parentNode) wrap.remove(); }
    function leave() { teardown(); if (opts.onExit) opts.onExit(); }
    function again() { teardown(); start(opts); }

    function ladderHTML() { var h = ""; for (var i = LADDER.length - 1; i >= 0; i--) h += '<div class="rung' + (i === level ? " cur" : "") + (i < level ? " done" : "") + '">' + (i + 1) + ". " + LADDER[i].toLocaleString() + "</div>"; return '<div class="ladder">' + h + "</div>"; }

    function nextQ() {
      if (level >= LADDER.length) return win();
      if (lives <= 0) return over();
      var pool = words.filter(function (x) { return x.word !== lastWord; });
      var w = VQ.shuffle(pool.length ? pool : words)[0]; lastWord = w.word;
      var card = store.state.cards[w.word];
      var fmt = Engine.pickFormat(card, w, null, ALLOWED);
      var q = VQ.gen(card, words, { format: fmt, senseIdx: Math.floor(Math.random() * w.senses.length) });
      render(q); VQ.readQ(q);
    }
    function render(q) {
      var hearts = ""; for (var i = 0; i < 3; i++) hearts += (i < lives ? "❤️" : "🖤");
      var letters = ["A", "B", "C", "D"];
      var ans = q.choices.map(function (c, i) { return '<button class="ans" data-i="' + i + '"><span class="let">' + letters[i] + "</span>" + VQ.esc(c.label) + "</button>"; }).join("");
      wrap.innerHTML = '<div class="qs-head"><div class="host">🎤 Quiz Show <span class="muted2">— Q' + (level + 1) + " for " + LADDER[level].toLocaleString() + "</span></div><div class=\"lives\">" + hearts + "</div></div>" +
        '<div class="qs-main">' + ladderHTML() +
        '<div class="qs-q"><div class="prompt card">' + q.promptHTML + ' <button class="replay" type="button" title="Read again">🔊</button></div><div class="answers">' + ans + "</div>" +
        '<div class="qs-tools"><button id="fifty" class="lifeline"' + (fifty ? "" : " disabled") + ">50:50</button><button id=\"quit\" class=\"lifeline\">Leave</button></div></div></div>";
      document.getElementById("quit").onclick = leave;
      var replay = wrap.querySelector(".replay"); if (replay) replay.onclick = function () { VQ.readQ(q); };
      var btns = wrap.querySelectorAll(".ans");
      Array.prototype.forEach.call(btns, function (b) { b.onclick = function () { answer(q, parseInt(b.dataset.i, 10), btns); }; });
      document.getElementById("fifty").onclick = function () { if (!fifty) return; fifty = false; this.disabled = true; var wrong = []; q.choices.forEach(function (c, i) { if (!c.correct) wrong.push(i); }); VQ.shuffle(wrong).slice(0, 2).forEach(function (i) { btns[i].disabled = true; btns[i].classList.add("gone"); }); };
      keyFn = function (e) { var k = (e.key || "").toUpperCase(), idx = letters.indexOf(k); if (idx < 0) { var n = parseInt(e.key, 10); if (n >= 1 && n <= q.choices.length) idx = n - 1; } if (idx >= 0 && btns[idx] && !btns[idx].disabled) answer(q, idx, btns); };
    }
    function answer(q, i, btns) {
      var ok = !!q.choices[i].correct; keyFn = null;
      Array.prototype.forEach.call(btns, function (b, idx) { b.disabled = true; if (q.choices[idx].correct) b.classList.add("right"); else if (idx === i) b.classList.add("wrong"); });
      store.record(q, ok);
      setTimeout(function () { if (!wrap.parentNode) return; if (ok) { level++; nextQ(); } else { lives--; if (lives <= 0) over(); else nextQ(); } }, 850);
    }
    function banner(emoji, title, sub) {
      wrap.innerHTML = '<div class="qs-head"><div class="host">🎤 Quiz Show</div></div><div class="card hero" style="max-width:520px;margin:30px auto 0;text-align:center;color:#20303a"><div class="big-emoji">' + emoji + '</div><div class="hero-line">' + VQ.esc(title) + '</div><div class="hero-sub">' + VQ.esc(sub) + '</div><button id="again" class="submit big-next">Play again ⏎</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave; keyFn = function (e) { if (e.key === "Enter") again(); };
    }
    function win() { store.state.gems += 100; store.save(); confetti(); confetti(); banner("🏆", "You won the top prize!", "All " + LADDER.length + " questions right! +100 💎"); }
    function over() { var bank = level > 0 ? LADDER[level - 1] : 0; banner("💫", "Game over", "You reached level " + level + " (" + bank.toLocaleString() + " pts). Try again!"); }

    nextQ();
  }
  global.VobloxQuizShow = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
