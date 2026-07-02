/*
 * Voblox mini-game — 🔨 Whack-a-Word, fever edition.
 * Whack the mole whose word matches the clue. 5 in a row ignites 🔥FEVER
 * (double points, faster moles) — and watch for the 💎 golden mole (+10 gems,
 * always safe to bop). Moles pop faster as your score climbs. 45 seconds.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  function start(opts) {
    var words = opts.words, store = opts.store;
    var sfx = global.VobloxSfx || null;
    var wrap = document.createElement("div"); wrap.className = "gamewrap whack";
    wrap.innerHTML = '<div class="wk-head"><div class="clue" id="wclue"></div>' +
      '<div class="grow"><span id="wscore">⭐ 0</span><span id="wtime">⏱️ 45</span><span id="wcombo" style="display:none"></span><button class="replay" id="wspeak" type="button" title="Read again">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="holes" id="holes"></div>';
    document.body.appendChild(wrap);
    var HOLES = 8, holesEl = document.getElementById("holes"), holes = [];
    for (var i = 0; i < HOLES; i++) {
      var h = document.createElement("div"); h.className = "hole";
      var m = document.createElement("button"); m.className = "mole"; m.type = "button";
      h.appendChild(m); holesEl.appendChild(h); holes.push({ mole: m, word: null, up: false, golden: false });
    }
    var target = null, score = 0, timeLeft = 45, lastSpoken = "", running = true, popT = null, tickT = null;
    var combo = 0, bestCombo = 0, feverUntil = 0, gemsBank = 0;
    document.getElementById("quit").onclick = leave;
    document.getElementById("wspeak").onclick = function () { VQ.speak(lastSpoken); };
    function fever() { return performance.now() < feverUntil; }

    function newTarget() {
      var w = VQ.shuffle(words)[0], s = w.senses[Math.floor(Math.random() * w.senses.length)];
      target = { word: w.word, def: s.def, pos: s.pos };
      document.getElementById("wclue").innerHTML = (fever() ? "🔥 FEVER x2! " : "🔨 ") + 'Whack the word that means:<br><b>“' + VQ.esc(s.def) + '”</b> <span class="posclue">(' + s.pos + ")</span>";
      lastSpoken = "Whack the word that means. " + s.def; VQ.speak(lastSpoken);
    }
    function hud() {
      document.getElementById("wscore").textContent = "⭐ " + score;
      var wc = document.getElementById("wcombo");
      if (fever()) { wc.style.display = ""; wc.textContent = "🔥 FEVER!"; }
      else if (combo > 1) { wc.style.display = ""; wc.textContent = "🔥 x" + combo; }
      else wc.style.display = "none";
    }
    function popOne() {
      if (!running) return;
      var free = holes.filter(function (h) { return !h.up; });
      if (!free.length) return;
      var h = free[Math.floor(Math.random() * free.length)];
      h.golden = Math.random() < 0.06;
      if (h.golden) { h.word = null; h.mole.textContent = "💎"; h.mole.classList.add("gold"); }
      else {
        var useTarget = Math.random() < 0.45;
        h.word = useTarget ? target.word : VQ.shuffle(words.filter(function (x) { return x.word !== target.word; }))[0].word;
        h.mole.textContent = h.word; h.mole.classList.remove("gold");
      }
      h.up = true; h.mole.classList.add("up");
      // moles get snappier as you score (and during fever)
      var upFor = (1100 + Math.random() * 600) * Math.max(0.55, 1 - score * 0.025) * (fever() ? 0.8 : 1);
      setTimeout(function () { if (h.up) { h.up = false; h.mole.classList.remove("up"); h.mole.classList.remove("gold"); } }, upFor);
      if (fever() && Math.random() < 0.5) popOne(); // fever floods the field
    }
    holes.forEach(function (h) {
      h.mole.onclick = function () {
        if (!h.up || !running) return;
        h.up = false; h.mole.classList.remove("up");
        if (h.golden) {
          h.mole.classList.remove("gold");
          gemsBank += 10; bump(h.mole, true);
          if (sfx) sfx.coin();
          flashScore("+10 💎");
          return;
        }
        if (h.word === target.word) {
          var pts = fever() ? 2 : 1;
          score += pts; combo++; bestCombo = Math.max(bestCombo, combo);
          gemsBank += 3 + Math.min(6, combo);
          store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, true);
          if (combo >= 5 && !fever()) { feverUntil = performance.now() + 6000; if (sfx) sfx.fanfare(); flashScore("🔥 FEVER x2!!"); }
          else if (sfx) sfx.coin();
          hud(); bump(h.mole, true); newTarget();
        } else {
          combo = 0;
          store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, false);
          if (sfx) sfx.buzz();
          hud(); bump(h.mole, false);
        }
      };
    });
    function flashScore(t) { var el = document.getElementById("wscore"); var old = el.textContent; el.textContent = t; setTimeout(function () { if (running) hud(); }, 800); }
    function bump(el, ok) { el.classList.add(ok ? "hit" : "badhit"); setTimeout(function () { el.classList.remove("hit"); el.classList.remove("badhit"); }, 300); }
    function tick() { timeLeft--; document.getElementById("wtime").textContent = "⏱️ " + timeLeft; if (timeLeft <= 0) end(); }
    function end() {
      running = false; clearInterval(popT); clearInterval(tickT);
      var res = store.recordGame("whack", {
        win: score >= 12, score: score,
        rankPtsDelta: score >= 12 ? 10 : score >= 6 ? 5 : 2,
        xp: 5 + score * 2 + bestCombo * 2,
        gems: gemsBank + score * 3
      });
      wrap.innerHTML = '<div class="card hero" style="max-width:460px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">🔨</div><div class="hero-line">Time! You whacked ' + score + '</div><div class="hero-sub">best combo 🔥x' + bestCombo + " · +" + (gemsBank + score * 3) + ' 💎' +
        ((res && res.rankedUp) ? " · <b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + '</div><button id="again" class="submit big-next">Play again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
      if (score >= 12 && sfx) sfx.fanfare();
    }
    function cleanup() { running = false; clearInterval(popT); clearInterval(tickT); VQ.shush(); if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }

    newTarget(); popT = setInterval(popOne, 620); tickT = setInterval(tick, 1000);
  }
  global.VobloxWhack = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
