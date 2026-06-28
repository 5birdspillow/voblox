/*
 * Voblox mini-game — Word Hoops (basketball).
 * A definition clue shows; 3 hoops are labeled with words. Tap the hoop whose word
 * matches — the ball flies in for a basket. 3 lives.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  function start(opts) {
    var words = opts.words, store = opts.store;
    var wrap = document.createElement("div"); wrap.className = "gamewrap hoops";
    wrap.innerHTML = '<div class="hp-head"><div class="clue" id="hclue"></div>' +
      '<div class="grow"><span id="hlives"></span><span id="hscore">🏀 0</span><button class="replay" id="hspeak2" type="button" title="Read again">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="court"><div class="hoops3" id="hoops3"></div><div class="ball" id="ball">🏀</div><div class="gmsg" id="hmsg"></div></div>';
    document.body.appendChild(wrap);
    var lives = 3, score = 0, lastSpoken = "", busy = false, target = null;
    var hoops3 = document.getElementById("hoops3"), ball = document.getElementById("ball"), msg = document.getElementById("hmsg");
    document.getElementById("quit").onclick = leave;
    document.getElementById("hspeak2").onclick = function () { VQ.speak(lastSpoken); };

    function updateHud() { var h = ""; for (var i = 0; i < 3; i++) h += (i < lives ? "❤️" : "🖤"); document.getElementById("hlives").textContent = h; document.getElementById("hscore").textContent = "🏀 " + score; }
    function newRound() {
      busy = false;
      var pool = VQ.shuffle(words); target = pool[0];
      var s = target.senses[Math.floor(Math.random() * target.senses.length)];
      var opts3 = VQ.shuffle([target.word, pool[1].word, pool[2].word]);
      document.getElementById("hclue").innerHTML = '🏀 Shoot the basket for:<br><b>“' + VQ.esc(s.def) + '”</b> <span class="posclue">(' + s.pos + ")</span>";
      lastSpoken = "Shoot the basket that means. " + s.def; VQ.speak(lastSpoken);
      hoops3.innerHTML = opts3.map(function (w, i) { return '<div class="hoop" data-i="' + i + '"><div class="board"><div class="ring"></div></div><div class="hlabel">' + VQ.esc(w) + "</div></div>"; }).join("");
      ball.style.transition = "none"; ball.style.transform = "none";
      Array.prototype.forEach.call(hoops3.querySelectorAll(".hoop"), function (el) { el.onclick = function () { shoot(el, opts3[parseInt(el.dataset.i, 10)]); }; });
    }
    function shoot(el, word) {
      if (busy) return; busy = true;
      var hr = el.querySelector(".ring").getBoundingClientRect(), br = ball.getBoundingClientRect();
      var dx = (hr.left + hr.width / 2) - (br.left + br.width / 2), dy = (hr.top + hr.height / 2) - (br.top + br.height / 2);
      ball.style.transition = "transform .5s cubic-bezier(.25,-0.45,.6,1)";
      ball.style.transform = "translate(" + dx + "px," + dy + "px) scale(.5)";
      var ok = word === target.word;
      setTimeout(function () { resolve(el, ok); }, 520);
    }
    function resolve(el, ok) {
      store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, ok);
      if (ok) { score++; el.classList.add("made"); flash("🏀 Swish! +1", "#69f0ae"); updateHud(); setTimeout(newRound, 750); }
      else { lives--; el.classList.add("miss"); flash("❌ Miss!", "#ff8a8a"); updateHud(); if (lives <= 0) setTimeout(end, 850); else setTimeout(newRound, 950); }
    }
    function flash(m, c) { msg.textContent = m; msg.style.color = c || "#fff"; msg.style.opacity = "1"; setTimeout(function () { msg.style.opacity = "0"; }, 800); }
    function end() { store.state.gems += score * 8; store.save(); wrap.innerHTML = '<div class="card hero" style="max-width:460px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">🏀</div><div class="hero-line">Game over!</div><div class="hero-sub">You made <b>' + score + "</b> baskets · +" + (score * 8) + ' 💎</div><button id="again" class="submit big-next">Play again</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>'; document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave; }
    function cleanup() { if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }
    updateHud(); newRound();
  }
  global.VobloxHoops = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
