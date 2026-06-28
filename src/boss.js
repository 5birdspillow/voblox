/*
 * Voblox — Boss Battle (gamified quiz / test-prep).
 * VobloxBoss.start({ words, store, mode:'boss'|'review', title, onExit })
 * Answer words to damage the monster; wrong answers cost a heart.
 * Defeat (boss mode) = every word in the set is "quiz-ready" (i.e. mastered).
 */
(function (global) {
  var Engine = global.VobloxEngine, VQ = global.VobloxQuestions;
  var MONSTERS = [["🐉", "Vocab Dragon"], ["👹", "Word Ogre"], ["🦖", "Spelling Rex"], ["👾", "Glitch Goblin"], ["🐲", "Meaning Wyrm"], ["🧟", "Quiz Zombie"]];

  function speak(t) {
    try {
      if (!("speechSynthesis" in global)) return;
      var u = new SpeechSynthesisUtterance(t); u.rate = 0.9;
      var v = (speechSynthesis.getVoices() || []).filter(function (x) { return /en[-_]?US/i.test(x.lang); })[0];
      if (v) u.voice = v; speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }

  function start(opts) {
    var words = opts.words, store = opts.store, mode = opts.mode || "boss";
    var wd = {}; words.forEach(function (w) { wd[w.word] = w; });
    var hearts = 3, cleared = {}, lastFmt = {}, senseCur = {}, correct = 0, total = 0;
    var mon = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];

    function isCleared(w) { return mode === "boss" ? Engine.isQuizReady(store.state.cards[w]) : !!cleared[w]; }
    function pending() { return words.filter(function (w) { return !isCleared(w.word); }); }
    var maxHP = Math.max(1, pending().length);
    var queue = VQ.shuffle(pending().map(function (w) { return w.word; }));

    var wrap = document.createElement("div"); wrap.className = "bosswrap"; document.body.appendChild(wrap);
    var keyFn = null;
    function onKey(e) { if (keyFn) keyFn(e); }
    document.addEventListener("keydown", onKey);
    function teardown() { document.removeEventListener("keydown", onKey); if (wrap.parentNode) wrap.remove(); }
    function leave() { teardown(); if (opts.onExit) opts.onExit(); }
    function again() { teardown(); start(opts); }

    function scene(body, extra) {
      var hp = pending().length, frac = Math.max(0, Math.min(1, hp / maxHP));
      var h = ""; for (var i = 0; i < 3; i++) h += (i < hearts ? "❤️" : "🖤");
      return '<div class="bosstop ' + (extra || "") + '">' +
        '<div class="bossname">⚔️ ' + VQ.esc(opts.title || mon[1]) + '</div>' +
        '<div class="monster" id="mon">' + mon[0] + '</div>' +
        '<div class="hpbar"><div class="hpfill" style="width:' + (frac * 100) + '%"></div><span>' + (maxHP - hp) + ' / ' + maxHP + ' beaten</span></div>' +
        '<div class="hearts">' + h + '</div></div>' +
        '<div class="bossbody">' + body + '</div>' +
        '<button class="bossquit" id="quit">Leave battle</button>';
    }
    function wireQuit() { var q = document.getElementById("quit"); if (q) q.onclick = leave; }

    function ask() {
      if (!pending().length) return victory();
      if (hearts <= 0) return defeat();
      queue = queue.filter(function (w) { return !isCleared(w); });
      if (!queue.length) queue = VQ.shuffle(pending().map(function (w) { return w.word; }));
      var word = queue.shift(), card = store.state.cards[word], data = wd[word];
      var fmt = Engine.pickFormat(card, data, lastFmt[word]); lastFmt[word] = fmt;
      var si = (senseCur[word] || 0) % data.senses.length; senseCur[word] = (si + 1) % data.senses.length;
      var q = VQ.gen(card, words, { format: fmt, senseIdx: si });
      var body;
      if (q.kind === "mc") {
        body = '<div class="qcard card"><div class="prompt">' + q.promptHTML + ' <button class="replay" type="button" title="Read again">🔊</button></div><div class="choices">' +
          q.choices.map(function (c, i) { return '<button class="choice" data-i="' + i + '"><span class="num">' + (i + 1) + '</span>' + VQ.esc(c.label) + '</button>'; }).join("") +
          '</div></div>';
      } else {
        body = '<div class="qcard card"><div class="prompt">' + q.promptHTML + ' <button class="replay" type="button" title="Read again">🔊</button></div><div class="typebox"><input id="answer" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="type the word…"><button id="submit" class="submit">Strike! ⏎</button><div id="hint" class="hint"></div></div></div>';
      }
      wrap.innerHTML = scene(body); wireQuit();
      var replay = wrap.querySelector(".replay"); if (replay) replay.onclick = function () { VQ.readQ(q); };
      if (q.kind === "mc") {
        Array.prototype.forEach.call(wrap.querySelectorAll(".choice"), function (b) { b.onclick = function () { answerMC(q, parseInt(b.dataset.i, 10)); }; });
        keyFn = function (e) { var n = parseInt(e.key, 10); if (n >= 1 && n <= q.choices.length) answerMC(q, n - 1); };
      } else {
        var inp = document.getElementById("answer"); if (inp && !("ontouchstart" in global)) inp.focus();
        document.getElementById("submit").onclick = function () { submitText(q); };
        keyFn = function (e) { if (e.key === "Enter") submitText(q); };
      }
      VQ.readQ(q);
    }

    function answerMC(q, i) {
      Array.prototype.forEach.call(wrap.querySelectorAll(".choice"), function (b, idx) { b.disabled = true; if (q.choices[idx].correct) b.classList.add("right"); else if (idx === i) b.classList.add("wrong"); });
      resolve(q, !!q.choices[i].correct);
    }
    function submitText(q) {
      var inp = document.getElementById("answer"), r = VQ.checkText(q, inp.value);
      if (r === "empty") return;
      if (r === "near" && q.hintAllowed && !q._r) { q._r = true; document.getElementById("hint").textContent = "So close — check the spelling!"; inp.classList.add("almost"); inp.select(); return; }
      inp.disabled = true; resolve(q, r === "correct");
    }

    function resolve(q, ok) {
      total++; keyFn = null;
      var res = store.record(q, ok);
      if (mode === "review" && ok) cleared[q.word] = true;
      if (ok) {
        correct++;
        var becameClear = isCleared(q.word);
        wrap.innerHTML = scene('<div class="hittoast">💥 <b>Hit!</b> +' + res.earned + ' 💎' +
          (res.loot ? '<div class="mastered">🎁 ' + res.loot + '</div>' : "") +
          (becameClear ? '<div class="mastered">✓ <b>' + VQ.esc(q.word) + '</b> beaten!</div>' : "") + '</div>', "hit");
        wireQuit();
        if (becameClear) confetti();
        setTimeout(function () { if (wrap.parentNode) ask(); }, becameClear ? 1100 : 800);
      } else {
        hearts--;
        wrap.innerHTML = scene('<div class="qcard card"><div class="fb bad">❌ The ' + VQ.esc(mon[1]) + ' hits back! Study the word:</div><div class="reveal">' + VQ.entryHTML(q.data, { mnem: true }) + '</div><button id="next" class="submit big-next">Fight on ⏎</button></div>', "playerhit");
        wireQuit();
        document.getElementById("next").onclick = ask;
        keyFn = function (e) { if (e.key === "Enter") ask(); };
      }
    }

    function victory() {
      var grade = store.predicted(words);
      store.state.gems += 50; if (grade >= 90) store.state.chessUnlocked = true; store.save();
      confetti(); confetti();
      wrap.innerHTML = scene('<div class="qcard card hero" style="text-align:center"><div class="big-emoji">🏆</div>' +
        '<div class="hero-line">' + mon[1] + ' defeated!</div>' +
        '<div class="hero-sub">You mastered every word in this set.<br>Predicted grade: <b>' + (grade >= 90 ? "A 🌟" : grade >= 80 ? "B 👍" : grade + "%") + '</b> • +50 💎 bonus</div>' +
        '<button id="again" class="submit big-next">Battle again ⏎</button>' +
        '<button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>', "win");
      document.getElementById("mon").textContent = "💥";
      document.getElementById("again").onclick = again;
      document.getElementById("leave2").onclick = leave;
      document.getElementById("quit").onclick = leave;
      keyFn = function (e) { if (e.key === "Enter") again(); };
    }
    function defeat() {
      var left = pending().map(function (w) { return w.word; });
      wrap.innerHTML = scene('<div class="qcard card hero" style="text-align:center"><div class="big-emoji">💫</div>' +
        '<div class="hero-line">You fainted — but you got stronger!</div>' +
        '<div class="hero-sub">Got ' + correct + ' right. Still to beat: <b>' + (left.length ? VQ.esc(left.join(", ")) : "none!") + '</b></div>' +
        '<button id="again" class="submit big-next">Try again ⏎</button>' +
        '<button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>', "lose");
      document.getElementById("again").onclick = again;
      document.getElementById("leave2").onclick = leave;
      document.getElementById("quit").onclick = leave;
      keyFn = function (e) { if (e.key === "Enter") again(); };
    }

    function confetti() {
      var cols = ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb", "#ffab40"];
      for (var i = 0; i < 18; i++) {
        var s = document.createElement("div");
        s.style.cssText = "position:fixed;z-index:60;top:-16px;width:11px;height:11px;border-radius:3px;pointer-events:none;left:" + (8 + Math.random() * 84) + "vw;background:" + cols[i % 6] + ";transition:transform 1.1s ease-in,opacity 1.1s";
        document.body.appendChild(s);
        (function (n) { requestAnimationFrame(function () { n.style.transform = "translateY(110vh) rotate(540deg)"; n.style.opacity = "0.2"; }); setTimeout(function () { n.remove(); }, 1200); })(s);
      }
    }

    if (!pending().length) { victory(); } else { ask(); }
  }

  global.VobloxBoss = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
