/*
 * Voblox mini-game — Whack-a-Word.
 * A clue (definition) shows; word-moles pop from holes. Whack (tap) the mole whose
 * word matches the clue. 45-second score attack.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  function start(opts) {
    var words = opts.words, store = opts.store;
    var wrap = document.createElement("div"); wrap.className = "gamewrap whack";
    wrap.innerHTML = '<div class="wk-head"><div class="clue" id="wclue"></div>' +
      '<div class="grow"><span id="wscore">⭐ 0</span><span id="wtime">⏱️ 45</span><button class="replay" id="wspeak" type="button" title="Read again">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="holes" id="holes"></div>';
    document.body.appendChild(wrap);
    var HOLES = 8, holesEl = document.getElementById("holes"), holes = [];
    for (var i = 0; i < HOLES; i++) {
      var h = document.createElement("div"); h.className = "hole";
      var m = document.createElement("button"); m.className = "mole"; m.type = "button";
      h.appendChild(m); holesEl.appendChild(h); holes.push({ mole: m, word: null, up: false });
    }
    var target = null, score = 0, timeLeft = 45, lastSpoken = "", running = true, popT = null, tickT = null;
    document.getElementById("quit").onclick = leave;
    document.getElementById("wspeak").onclick = function () { VQ.speak(lastSpoken); };

    function newTarget() {
      var w = VQ.shuffle(words)[0], s = w.senses[Math.floor(Math.random() * w.senses.length)];
      target = { word: w.word, def: s.def, pos: s.pos };
      document.getElementById("wclue").innerHTML = '🔨 Whack the word that means:<br><b>“' + VQ.esc(s.def) + '”</b> <span class="posclue">(' + s.pos + ")</span>";
      lastSpoken = "Whack the word that means. " + s.def; VQ.speak(lastSpoken);
    }
    function popOne() {
      if (!running) return;
      var free = holes.filter(function (h) { return !h.up; });
      if (!free.length) return;
      var h = free[Math.floor(Math.random() * free.length)];
      var useTarget = Math.random() < 0.45;
      h.word = useTarget ? target.word : VQ.shuffle(words.filter(function (x) { return x.word !== target.word; }))[0].word;
      h.up = true; h.mole.textContent = h.word; h.mole.classList.add("up");
      setTimeout(function () { if (h.up) { h.up = false; h.mole.classList.remove("up"); } }, 1100 + Math.random() * 600);
    }
    holes.forEach(function (h) {
      h.mole.onclick = function () {
        if (!h.up || !running) return;
        h.up = false; h.mole.classList.remove("up");
        if (h.word === target.word) {
          score++; store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, true);
          document.getElementById("wscore").textContent = "⭐ " + score; bump(h.mole, true); newTarget();
        } else { store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, false); bump(h.mole, false); }
      };
    });
    function bump(el, ok) { el.classList.add(ok ? "hit" : "badhit"); setTimeout(function () { el.classList.remove("hit"); el.classList.remove("badhit"); }, 300); }
    function tick() { timeLeft--; document.getElementById("wtime").textContent = "⏱️ " + timeLeft; if (timeLeft <= 0) end(); }
    function end() {
      running = false; clearInterval(popT); clearInterval(tickT);
      store.state.gems += score * 5; store.save();
      wrap.innerHTML = '<div class="card hero" style="max-width:460px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">🔨</div><div class="hero-line">Time! You whacked ' + score + '</div><div class="hero-sub">+' + (score * 5) + ' 💎</div><button id="again" class="submit big-next">Play again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
    }
    function cleanup() { running = false; clearInterval(popT); clearInterval(tickT); if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }

    newTarget(); popT = setInterval(popOne, 620); tickT = setInterval(tick, 1000);
  }
  global.VobloxWhack = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
