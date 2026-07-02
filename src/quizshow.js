/*
 * Voblox mini-game — 📺 Quiz Show ("Vocab Millionaire"), podium edition.
 * You race TWO AI contestants up the money ladder. Everyone answers each
 * question; every 3rd rung is a ⚡ BUZZ ROUND — first to slam the buzzer
 * answers for double climb (but a miss drops you a rung!). Lifelines: 50:50
 * and Ask-a-Bot. First to the top wins the show.
 */
(function (global) {
  var Engine = global.VobloxEngine, VQ = global.VobloxQuestions;
  var AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;
  var LADDER = [100, 250, 500, 1000, 2000, 4000, 8000, 16000, 50000, 100000];
  var TOP = LADDER.length;
  var HOST = ["Ooh, tough one!", "For the big points…", "Audience, quiet please!", "No pressure!", "This is a spicy word!"];

  function confetti() { var cols = ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb", "#ffab40"]; for (var i = 0; i < 18; i++) { var s = document.createElement("div"); s.style.cssText = "position:fixed;z-index:70;top:-16px;width:11px;height:11px;border-radius:3px;pointer-events:none;left:" + (8 + Math.random() * 84) + "vw;background:" + cols[i % 6] + ";transition:transform 1.1s ease-in,opacity 1.1s"; document.body.appendChild(s); (function (n) { requestAnimationFrame(function () { n.style.transform = "translateY(110vh) rotate(540deg)"; n.style.opacity = "0.2"; }); setTimeout(function () { n.remove(); }, 1200); })(s); } }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("quiz");
    var ALLOWED = [Engine.FORMATS.DEF2WORD_MC, Engine.FORMATS.WORD2DEF, Engine.FORMATS.CLOZE_MC, Engine.FORMATS.SYNONYM, Engine.FORMATS.ANTONYM];
    var rivals = Bots.pickOpponents(2, P.botSkillFor(stats.rankPts));
    var sfx = global.VobloxSfx || null;
    var me = { name: store.state.profile.name, rung: 0, cfg: AV.resolve(store.state), me: true, flash: "" };
    var pods = [me,
      { name: rivals[0].name, bot: rivals[0], rung: 0, cfg: rivals[0].avatar, flash: "", bub: "" },
      { name: rivals[1].name, bot: rivals[1], rung: 0, cfg: rivals[1].avatar, flash: "", bub: "" }];
    var lives = 3, fifty = true, askBot = true, lastWord = null, qNum = 0, ended = false;

    var wrap = document.createElement("div"); wrap.className = "gamewrap quizshow"; document.body.appendChild(wrap);
    var keyFn = null; function onKey(e) { if (keyFn) keyFn(e); } document.addEventListener("keydown", onKey);
    function teardown() { document.removeEventListener("keydown", onKey); VQ.shush(); if (wrap.parentNode) wrap.remove(); }
    function leave() { teardown(); if (opts.onExit) opts.onExit(); }
    function again() { teardown(); start(opts); }

    function podiumHTML() {
      return '<div class="podiums">' + pods.map(function (p2, i) {
        return '<div class="pod' + (p2.me ? " mine" : "") + '"><canvas id="podc' + i + '" width="40" height="40"></canvas>' +
          '<div class="pod-n">' + VQ.esc(p2.name) + '</div><div class="pod-r">rung ' + p2.rung + "/" + TOP + "</div>" +
          '<div class="pod-f" id="podf' + i + '">' + p2.flash + "</div>" +
          (p2.bub ? '<div class="pod-b">' + VQ.esc(p2.bub) + "</div>" : "") + "</div>";
      }).join("") + "</div>";
    }
    function drawHeads() {
      pods.forEach(function (p2, i) {
        var cv = document.getElementById("podc" + i);
        if (cv) AV.drawHead(cv.getContext("2d"), { x: 20, y: 22, size: 28, config: p2.cfg });
      });
    }
    function ladderHTML() { var h = ""; for (var i = TOP - 1; i >= 0; i--) h += '<div class="rung' + (i === me.rung ? " cur" : "") + (i < me.rung ? " done" : "") + '">' + (i + 1) + ". " + LADDER[i].toLocaleString() + "</div>"; return '<div class="ladder">' + h + "</div>"; }

    function genQ() {
      var pool = words.filter(function (x) { return x.word !== lastWord; });
      var w = VQ.shuffle(pool.length ? pool : words)[0]; lastWord = w.word;
      var card = store.state.cards[w.word];
      var fmt = Engine.pickFormat(card, w, null, ALLOWED);
      return VQ.gen(card, words, { format: fmt, senseIdx: Math.floor(Math.random() * w.senses.length) });
    }
    function botsAnswer(mult) {
      pods.forEach(function (p2) {
        if (p2.me) return;
        var ok = Math.random() < 0.3 + p2.bot.skill * 0.55;
        if (ok) { p2.rung = Math.min(TOP, p2.rung + (mult || 1)); p2.flash = "✅"; if (Math.random() < 0.3) p2.bub = Bots.say(p2.bot, "win"); }
        else { p2.flash = "❌"; if (Math.random() < 0.3) p2.bub = Bots.say(p2.bot, "lose"); }
      });
    }
    function clearFlashes() { pods.forEach(function (p2) { p2.flash = ""; p2.bub = ""; }); }

    function nextQ() {
      if (ended) return;
      clearFlashes();
      if (me.rung >= TOP) return finish();
      if (pods[1].rung >= TOP || pods[2].rung >= TOP) return finish();
      if (lives <= 0) return finish();
      if (qNum >= 14) return finish();
      qNum++;
      var buzz = qNum % 3 === 0;
      var q = genQ();
      if (buzz) buzzRound(q); else render(q);
      VQ.readQ(q);
    }

    function render(q, buzzWinner) {
      var hearts = ""; for (var i = 0; i < 3; i++) hearts += (i < lives ? "❤️" : "🖤");
      var letters = ["A", "B", "C", "D"];
      var ans = q.choices.map(function (c, i) { return '<button class="ans" data-i="' + i + '"><span class="let">' + letters[i] + "</span>" + VQ.esc(c.label) + "</button>"; }).join("");
      var hostLine = buzzWinner ? "⚡ You buzzed first — double or drop!" : HOST[Math.floor(Math.random() * HOST.length)];
      wrap.innerHTML = '<div class="qs-head"><div class="host">🎤 <span class="muted2">' + VQ.esc(hostLine) + '</span></div><div class="lives">' + hearts + "</div></div>" +
        podiumHTML() +
        '<div class="qs-main">' + ladderHTML() +
        '<div class="qs-q"><div class="prompt card">' + q.promptHTML + ' <button class="replay" type="button" title="Read again">🔊</button></div><div class="answers">' + ans + "</div>" +
        '<div class="qs-tools"><button id="fifty" class="lifeline"' + (fifty ? "" : " disabled") + '>50:50</button>' +
        '<button id="askbot" class="lifeline"' + (askBot ? "" : " disabled") + '>🤖 Ask ' + VQ.esc(rivals[0].name) + "</button>" +
        '<button id="quit" class="lifeline">Leave</button></div></div></div>';
      drawHeads();
      document.getElementById("quit").onclick = leave;
      var replay = wrap.querySelector(".replay"); if (replay) replay.onclick = function () { VQ.readQ(q); };
      var btns = wrap.querySelectorAll(".ans");
      Array.prototype.forEach.call(btns, function (b) { b.onclick = function () { answer(q, parseInt(b.dataset.i, 10), btns, buzzWinner); }; });
      document.getElementById("fifty").onclick = function () { if (!fifty) return; fifty = false; this.disabled = true; var wrong = []; q.choices.forEach(function (c, i) { if (!c.correct) wrong.push(i); }); VQ.shuffle(wrong).slice(0, 2).forEach(function (i) { btns[i].disabled = true; btns[i].classList.add("gone"); }); if (sfx) sfx.pop(); };
      document.getElementById("askbot").onclick = function () {
        if (!askBot) return; askBot = false; this.disabled = true;
        // the bot is helpful but not perfect — right ~75% of the time
        var pick, right = -1; q.choices.forEach(function (c, i) { if (c.correct) right = i; });
        if (Math.random() < 0.75) pick = right; else { var wrongs = []; q.choices.forEach(function (c, i) { if (!c.correct) wrongs.push(i); }); pick = VQ.shuffle(wrongs)[0]; }
        pods[1].bub = "I think it's " + letters[pick] + "…";
        var pf = document.getElementById("podf1"); if (pf && pf.parentNode) { var bb = document.createElement("div"); bb.className = "pod-b"; bb.textContent = "I think it's " + letters[pick] + "…"; pf.parentNode.appendChild(bb); }
        if (sfx) sfx.pop();
      };
      keyFn = function (e) { var k = (e.key || "").toUpperCase(), idx = letters.indexOf(k); if (idx < 0) { var n = parseInt(e.key, 10); if (n >= 1 && n <= q.choices.length) idx = n - 1; } if (idx >= 0 && btns[idx] && !btns[idx].disabled) answer(q, idx, btns, buzzWinner); };
    }

    // ⚡ buzz round: fastest finger gets the question for DOUBLE rungs
    function buzzRound(q) {
      var winner = null, timers = [];
      wrap.innerHTML = '<div class="qs-head"><div class="host">⚡ <b>BUZZ ROUND</b> <span class="muted2">— first to buzz answers for DOUBLE!</span></div></div>' +
        podiumHTML() +
        '<div class="buzzarea"><div class="buzzhint">Get ready…</div><button class="buzzbtn" id="buzz">🔴 BUZZ!</button></div>';
      drawHeads();
      var armed = false;
      var armT = setTimeout(function () { armed = true; var bh = wrap.querySelector(".buzzhint"); if (bh) bh.textContent = "GO GO GO!"; if (sfx) sfx.chime(); }, 900 + Math.random() * 700);
      timers.push(armT);
      pods.forEach(function (p2, i) {
        if (p2.me) return;
        timers.push(setTimeout(function () {
          if (winner || ended) return;
          winner = p2;
          timers.forEach(clearTimeout);
          p2.flash = "🔔"; p2.bub = Bots.say(p2.bot, "hi");
          // the bot answers off-screen
          var ok = Math.random() < 0.3 + p2.bot.skill * 0.5;
          if (ok) { p2.rung = Math.min(TOP, p2.rung + 2); p2.flash = "✅ +2"; } else { p2.rung = Math.max(0, p2.rung - 1); p2.flash = "❌ -1"; }
          wrap.querySelector(".buzzarea").innerHTML = '<div class="buzzhint">' + VQ.esc(p2.name) + " buzzed first… " + (ok ? "and got it! +2 rungs" : "and MISSED! -1 rung") + "</div>";
          var ph = wrap.querySelector(".podiums"); if (ph) ph.outerHTML = podiumHTML();
          drawHeads();
          if (sfx) (ok ? sfx.coin() : sfx.buzz());
          setTimeout(function () { if (wrap.parentNode) nextQ(); }, 1300);
        }, 1400 + (1 - p2.bot.skill) * 1600 + Math.random() * 700));
      });
      document.getElementById("buzz").onclick = function () {
        if (winner || ended) return;
        if (!armed) { var bh = wrap.querySelector(".buzzhint"); if (bh) bh.textContent = "Too early — wait for GO!"; return; }
        winner = me;
        timers.forEach(clearTimeout);
        if (sfx) sfx.pop();
        render(q, true);
        VQ.readQ(q);
      };
      keyFn = function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); document.getElementById("buzz") && document.getElementById("buzz").click(); } };
    }

    function answer(q, i, btns, buzzMode) {
      var ok = !!q.choices[i].correct; keyFn = null;
      Array.prototype.forEach.call(btns, function (b, idx) { b.disabled = true; if (q.choices[idx].correct) b.classList.add("right"); else if (idx === i) b.classList.add("wrong"); });
      store.record(q, ok);
      if (ok) {
        me.rung = Math.min(TOP, me.rung + (buzzMode ? 2 : 1));
        me.flash = buzzMode ? "✅ +2!" : "✅";
        confetti(); if (sfx) sfx.coin();
      } else {
        if (buzzMode) { me.rung = Math.max(0, me.rung - 1); me.flash = "❌ -1"; } else me.flash = "❌";
        lives--;
        if (sfx) sfx.buzz();
      }
      if (!buzzMode) botsAnswer(1);
      setTimeout(function () { if (!wrap.parentNode) return; nextQ(); }, 1000);
    }

    function finish() {
      if (ended) return; ended = true;
      var order = pods.slice().sort(function (a, b) { return b.rung - a.rung; });
      var place = order.indexOf(me) + 1;
      var bank = me.rung > 0 ? LADDER[me.rung - 1] : 0;
      var res = store.recordGame("quiz", {
        win: place === 1 && me.rung > 0, score: me.rung,
        rankPtsDelta: place === 1 ? 12 : place === 2 ? 6 : 2,
        xp: 8 + me.rung * 3 + (place === 1 ? 12 : 0),
        gems: 6 + me.rung * 4 + (place === 1 ? 20 : 0) + (me.rung >= TOP ? 60 : 0)
      });
      var rows = order.map(function (p2, i) { return '<div style="font-weight:' + (p2.me ? 900 : 600) + '">' + ["🥇", "🥈", "🥉"][i] + " " + VQ.esc(p2.name) + " — rung " + p2.rung + (p2.me ? " (you)" : "") + "</div>"; }).join("");
      wrap.innerHTML = '<div class="qs-head"><div class="host">🎤 Quiz Show</div></div>' +
        '<div class="card hero" style="max-width:520px;margin:30px auto 0;text-align:center;color:#20303a">' +
        '<div class="big-emoji">' + (place === 1 ? "🏆" : place === 2 ? "🥈" : "💫") + '</div>' +
        '<div class="hero-line">' + (me.rung >= TOP ? "TOP PRIZE!! " + LADDER[TOP - 1].toLocaleString() + "!" : place === 1 ? "You win the show!" : VQ.esc(order[0].name) + " takes the show") + "</div>" +
        '<div class="hero-sub">' + bank.toLocaleString() + " pts banked" + (res.rankedUp ? " · <b>" + res.newRank.icon + " " + res.newRank.name + "!</b>" : "") + "</div>" +
        '<div style="text-align:left;background:#f4f8fc;border-radius:12px;padding:8px 12px;margin:10px 0">' + rows + "</div>" +
        '<button id="again" class="submit big-next">Play again ⏎</button><button id="leave2" class="menubtn" style="margin-top:10px">Back to the world</button></div>';
      document.getElementById("again").onclick = again; document.getElementById("leave2").onclick = leave;
      keyFn = function (e) { if (e.key === "Enter") again(); };
      if (place === 1) { confetti(); confetti(); if (sfx) sfx.fanfare(); }
    }

    nextQ();
  }
  global.VobloxQuizShow = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
