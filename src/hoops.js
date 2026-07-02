/*
 * Voblox mini-game — 🏀 Word Hoops, shootout edition.
 * Pick the hoop whose word matches, then time the power meter: the green zone
 * is a SWISH (+2)! You're in a shootout vs an AI baller who shoots after you.
 * 3 makes in a row sets your ball ON FIRE (+1 bonus). First to 10 wins.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;
  var GOAL = 10;

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("hoops");
    var rival = Bots.pickOpponents(1, P.botSkillFor(stats.rankPts))[0];
    var sfx = global.VobloxSfx || null;
    var wrap = document.createElement("div"); wrap.className = "gamewrap hoops";
    wrap.innerHTML = '<div class="hp-head"><div class="clue" id="hclue"></div>' +
      '<div class="grow"><span id="hlives"></span><span id="hscore">🏀 0</span><span id="hrival">🤖 0</span><span id="hfire" style="display:none">🔥</span><button class="replay" id="hspeak2" type="button" title="Read again">🔊</button><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="court"><div class="hoops3" id="hoops3"></div><div class="ball" id="ball">🏀</div><div class="gmsg" id="hmsg"></div>' +
      '<div class="hmeter" id="hmeter" style="display:none"><div class="hmz"></div><div class="hmn" id="hmn"></div></div></div>';
    document.body.appendChild(wrap);
    var lives = 3, score = 0, rScore = 0, streak = 0, lastSpoken = "", busy = false, target = null, running = true, meterRaf = 0;
    var hoops3 = document.getElementById("hoops3"), ball = document.getElementById("ball"), msg = document.getElementById("hmsg");
    document.getElementById("quit").onclick = leave;
    document.getElementById("hspeak2").onclick = function () { VQ.speak(lastSpoken); };

    function updateHud() {
      var h = ""; for (var i = 0; i < 3; i++) h += (i < lives ? "❤️" : "🖤");
      document.getElementById("hlives").textContent = h;
      document.getElementById("hscore").textContent = "🏀 " + score + "/" + GOAL;
      document.getElementById("hrival").textContent = "🤖 " + rival.name.split(/[_ ]/)[0] + " " + rScore;
      document.getElementById("hfire").style.display = streak >= 3 ? "" : "none";
      ball.textContent = streak >= 3 ? "🔥" : "🏀";
    }
    function newRound() {
      busy = false;
      var pool = VQ.shuffle(words); target = pool[0];
      var s = target.senses[Math.floor(Math.random() * target.senses.length)];
      var opts3 = VQ.shuffle([target.word, pool[1].word, pool[2].word]);
      document.getElementById("hclue").innerHTML = '🏀 Shoot the basket for:<br><b>“' + VQ.esc(s.def) + '”</b> <span class="posclue">(' + s.pos + ")</span>";
      lastSpoken = "Shoot the basket that means. " + s.def; VQ.speak(lastSpoken);
      hoops3.innerHTML = opts3.map(function (w, i) { return '<div class="hoop" data-i="' + i + '"><div class="board"><div class="ring"></div></div><div class="hlabel">' + VQ.esc(w) + "</div></div>"; }).join("");
      ball.style.transition = "none"; ball.style.transform = "none";
      Array.prototype.forEach.call(hoops3.querySelectorAll(".hoop"), function (el) { el.onclick = function () { pickHoop(el, opts3[parseInt(el.dataset.i, 10)]); }; });
    }
    // stage 1: pick the word; stage 2 (if right): time the power meter
    function pickHoop(el, word) {
      if (busy || !running) return; busy = true;
      var ok = word === target.word;
      store.record({ word: target.word, format: "def2word_mc", kind: "mc" }, ok);
      if (!ok) {
        lives--; streak = 0; el.classList.add("miss");
        flash("❌ It was “" + target.word + "”", "#ff8a8a");
        if (sfx) sfx.buzz();
        updateHud();
        if (lives <= 0) return setTimeout(end, 900);
        return afterMyShot(false, el);
      }
      // meter time!
      var meter = document.getElementById("hmeter"), needle = document.getElementById("hmn");
      meter.style.display = "";
      var t0 = performance.now(), released = false;
      function tickMeter() {
        if (released || !running) return;
        var f = (Math.sin((performance.now() - t0) / 260) + 1) / 2; // 0..1 swing
        needle.style.left = (f * 100) + "%";
        meterRaf = requestAnimationFrame(tickMeter);
      }
      tickMeter();
      function release() {
        if (released) return; released = true;
        cancelAnimationFrame(meterRaf);
        meter.style.display = "none";
        document.removeEventListener("keydown", keyRel);
        meter.removeEventListener("mousedown", release);
        meter.removeEventListener("touchstart", release);
        wrap.removeEventListener("mousedown", relOnce);
        wrap.removeEventListener("touchstart", relOnce);
        var f = (Math.sin((performance.now() - t0) / 260) + 1) / 2;
        var sweet = f > 0.38 && f < 0.62;
        throwBall(el, sweet);
      }
      function relOnce(e) { release(); }
      function keyRel(e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); release(); } }
      setTimeout(function () { // brief delay so the answering tap doesn't instantly release
        if (released || !running) return;
        wrap.addEventListener("mousedown", relOnce);
        wrap.addEventListener("touchstart", relOnce, { passive: true });
        document.addEventListener("keydown", keyRel);
      }, 220);
      setTimeout(function () { if (!released && running) release(); }, 3400); // auto-release for daydreamers
      flash("⏱ TAP in the GREEN for a SWISH!", "#ffe14d");
    }
    function throwBall(el, sweet) {
      var hr = el.querySelector(".ring").getBoundingClientRect(), br = ball.getBoundingClientRect();
      var dx = (hr.left + hr.width / 2) - (br.left + br.width / 2), dy = (hr.top + hr.height / 2) - (br.top + br.height / 2);
      ball.style.transition = "transform .5s cubic-bezier(.25,-0.45,.6,1)";
      ball.style.transform = "translate(" + dx + "px," + dy + "px) scale(.5)";
      setTimeout(function () {
        if (!running) return;
        var pts = (sweet ? 2 : 1) + (streak >= 3 ? 1 : 0);
        score += pts; streak++;
        el.classList.add("made");
        flash(sweet ? "💦 SWISH! +" + pts : "🏀 Bucket! +" + pts, "#69f0ae");
        if (sfx) (sweet ? sfx.fanfare() : sfx.coin());
        updateHud();
        afterMyShot(true, el);
      }, 520);
    }
    function afterMyShot(made, el) {
      if (score >= GOAL) return setTimeout(end, 900);
      // rival shoots off-screen
      setTimeout(function () {
        if (!running) return;
        var hit = Math.random() < 0.35 + rival.skill * 0.45;
        if (hit) { rScore += Math.random() < 0.25 ? 2 : 1; flash("🤖 " + rival.name + " scores!", "#9fd6ff"); if (sfx) sfx.pop(); }
        else flash("🤖 " + rival.name + " bricks it!", "#ffd1a8");
        updateHud();
        if (rScore >= GOAL) return setTimeout(end, 900);
        setTimeout(function () { if (running) newRound(); }, 700);
      }, 800);
    }
    function flash(m, c) { msg.textContent = m; msg.style.color = c || "#fff"; msg.style.opacity = "1"; setTimeout(function () { msg.style.opacity = "0"; }, 900); }
    function end() {
      if (!running) return; running = false; cancelAnimationFrame(meterRaf);
      var win = score > rScore;
      var res = store.recordGame("hoops", {
        win: win, score: score,
        rankPtsDelta: win ? 10 : score >= 5 ? 5 : 2,
        xp: 6 + score * 2 + (win ? 10 : 0),
        gems: score * 6 + (win ? 20 : 0)
      });
      wrap.innerHTML = '<div class="card hero" style="max-width:460px;margin:60px auto 0;text-align:center;color:#20303a"><div class="big-emoji">' + (win ? "🏆" : "🏀") + '</div><div class="hero-line">' + (win ? "You win the shootout!" : VQ.esc(rival.name) + " takes it " + rScore + "–" + score) + '</div><div class="hero-sub">' + score + "–" + rScore + " · +" + (score * 6 + (win ? 20 : 0)) + ' 💎' +
        ((res && res.rankedUp) ? " · <b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + '</div><button id="again" class="submit big-next">Rematch 🏀</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
      if (win && sfx) sfx.fanfare();
    }
    function cleanup() { running = false; cancelAnimationFrame(meterRaf); VQ.shush(); if (wrap.parentNode) wrap.remove(); }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }
    updateHud(); newRound();
  }
  global.VobloxHoops = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
