/*
 * Voblox arcade game — 🥋 BJJ Dojo.
 * Turn-based grappling on a position ladder: standing → clinch → guard →
 * side control → mount → back → SUBMISSION. Pick technique cards (each shows
 * its odds); succeed to climb, fail and get countered. Real BJJ points
 * (takedown 2 · pass 3 · mount/back 4). Answer a word for 🧠 Focus (+25% on
 * your next move). Win by submission or points after 10 rounds. Wins earn
 * stripes on a kids belt ladder: white → grey → yellow → orange → green → BLACK.
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar, Bots = global.VobloxBots, P = global.VobloxProfile;
  var BELTS = [
    { name: "White Belt", color: "#f2f4f8", at: 0 }, { name: "Grey Belt", color: "#9aa7b0", at: 15 },
    { name: "Yellow Belt", color: "#ffd740", at: 35 }, { name: "Orange Belt", color: "#ff8c42", at: 60 },
    { name: "Green Belt", color: "#2f9e44", at: 90 }, { name: "BLACK BELT", color: "#23272e", at: 150 }
  ];
  function beltFor(pts) { var b = BELTS[0]; BELTS.forEach(function (x) { if (pts >= x.at) b = x; }); return b; }
  // position names by advantage (-6..+6, from MY side)
  function posName(a) {
    var n = Math.abs(a);
    var who = a > 0 ? "You have" : a < 0 ? "They have" : "";
    return n === 0 ? "🧍 Standing" :
      n === 1 ? "🤼 Clinch" + (a > 0 ? " (your grips!)" : " (their grips)") :
      n === 2 ? (a > 0 ? "🛡️ You're in their guard" : "🛡️ You're playing guard") :
      n === 3 ? who + " side control" :
      n === 4 ? who + " MOUNT" :
      n === 5 ? who + " the BACK" : "Submission!";
  }
  // technique cards by |advantage| tier (mirrored for defender)
  function cardsFor(a) {
    if (a === 0) return [
      { name: "Double-leg takedown", emoji: "🦵", d: 2, odds: 0.5, pts: 2 },
      { name: "Foot-sweep trip", emoji: "🌀", d: 1, odds: 0.7, pts: 0 },
      { name: "Snap-down", emoji: "⬇️", d: 1, odds: 0.65, pts: 0 }
    ];
    if (a > 0) { // I'm ahead — attack
      if (a === 1) return [
        { name: "Body-lock takedown", emoji: "🤗", d: 1, odds: 0.62, pts: 2 },
        { name: "Lift & slam (gently!)", emoji: "🏋️", d: 2, odds: 0.42, pts: 2 },
        { name: "Keep control", emoji: "✊", d: 0, odds: 0.9, pts: 0 }
      ];
      if (a === 2) return [
        { name: "Knee-cut pass", emoji: "🔪", d: 1, odds: 0.55, pts: 3 },
        { name: "Toreando pass", emoji: "🧣", d: 1, odds: 0.5, pts: 3 },
        { name: "Stand & stack", emoji: "🗼", d: 0, odds: 0.85, pts: 0 }
      ];
      if (a === 3) return [
        { name: "Climb to mount", emoji: "⛰️", d: 1, odds: 0.55, pts: 4 },
        { name: "Knee on belly", emoji: "🦵", d: 0, odds: 0.8, pts: 2 },
        { name: "Attack the far arm", emoji: "💪", d: 1, odds: 0.45, pts: 0 }
      ];
      if (a === 4) return [
        { name: "Take the back!", emoji: "🎒", d: 1, odds: 0.5, pts: 4 },
        { name: "Armbar setup", emoji: "🔧", d: 2, odds: 0.38, pts: 0 },
        { name: "Heavy hips (hold)", emoji: "🪨", d: 0, odds: 0.9, pts: 0 }
      ];
      return [ // a === 5 — finish!
        { name: "Rear-naked choke", emoji: "🐍", d: 1, odds: 0.5, pts: 0 },
        { name: "Collar choke", emoji: "🧥", d: 1, odds: 0.45, pts: 0 },
        { name: "Keep the hooks", emoji: "🪝", d: 0, odds: 0.9, pts: 0 }
      ];
    }
    // I'm behind — defend/escape
    var n = Math.abs(a);
    if (n === 1) return [
      { name: "Break their grips", emoji: "✂️", d: 1, odds: 0.65, pts: 0 },
      { name: "Counter-throw!", emoji: "🔄", d: 3, odds: 0.3, pts: 2 },
      { name: "Circle away", emoji: "💃", d: 1, odds: 0.6, pts: 0 }
    ];
    if (n === 2) return [
      { name: "Scissor sweep", emoji: "✂️", d: 4, odds: 0.42, pts: 2 },
      { name: "Stand up in base", emoji: "🧍", d: 2, odds: 0.55, pts: 0 },
      { name: "Lock full guard", emoji: "🔒", d: 0, odds: 0.85, pts: 0 }
    ];
    if (n === 3) return [
      { name: "Shrimp escape", emoji: "🦐", d: 1, odds: 0.55, pts: 0 },
      { name: "Bridge & roll", emoji: "🌉", d: 2, odds: 0.4, pts: 2 },
      { name: "Frame & breathe", emoji: "🖼️", d: 0, odds: 0.85, pts: 0 }
    ];
    if (n === 4) return [
      { name: "Buck & roll!", emoji: "🐎", d: 3, odds: 0.38, pts: 2 },
      { name: "Elbow escape", emoji: "🦐", d: 1, odds: 0.5, pts: 0 },
      { name: "Protect your neck", emoji: "🧣", d: 0, odds: 0.85, pts: 0 }
    ];
    return [
      { name: "Peel the choke hand!", emoji: "🖐️", d: 2, odds: 0.45, pts: 0 },
      { name: "Turn into them", emoji: "🔄", d: 1, odds: 0.5, pts: 0 },
      { name: "Tuck your chin", emoji: "😤", d: 0, odds: 0.8, pts: 0 }
    ];
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("bjj");
    var bot = Bots.pickOpponents(1, P.botSkillFor(stats.rankPts))[0];
    var myBelt = beltFor(stats.rankPts), botBelt = beltFor(Math.round(bot.skill * 140));

    var wrap = document.createElement("div"); wrap.className = "gamewrap bjj";
    wrap.innerHTML =
      '<canvas id="bjcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="bjmsg">🥋 BJJ Dojo</div>' +
      '<div class="grow"><span id="bjscore">0 : 0</span><span id="bjround">R1/10</span>' +
      '<button class="replay" id="bjfocus" type="button" title="Answer a word for Focus">🧠 Focus</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="bjbig"></div>' +
      '<div class="gover" id="bjq" style="display:none"></div>' +
      '<div class="bjcards" id="bjcards"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#bjcv"), ctx = cv.getContext("2d");
    var W, H;
    function resize() { W = cv.width = wrap.clientWidth; H = cv.height = wrap.clientHeight; }
    resize(); window.addEventListener("resize", resize);

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;
    var myCfg = AV.resolve(store.state);
    var gi = (function () { var g = store.state.equipped["gear.bjj"]; var it = g && global.VobloxItems ? global.VobloxItems.byId[g] : null; return it; })();

    var running = true, raf = 0, lastT = performance.now(), run = 0;
    var adv = 0, myPts = 0, botPts = 0, round = 1, focus = false, busy = false, over = false, lastFmt = null, bubble = null;
    var anim = { t: 9, ok: true, mine: true }; // wiggle animation after each technique

    var msgEl = document.getElementById("bjmsg"), bigEl = document.getElementById("bjbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1050); }
    function hud() {
      document.getElementById("bjscore").textContent = myPts + " : " + botPts;
      document.getElementById("bjround").textContent = "R" + Math.min(round, 10) + "/10";
    }
    function chat(kind) { bubble = { text: Bots.say(bot, kind), age: 0 }; }

    function showCards() {
      if (over) return;
      var cards = cardsFor(adv);
      var el = document.getElementById("bjcards");
      el.innerHTML = '<div class="bjpos">' + posName(adv) + (focus ? ' <span class="bjfoc">🧠 FOCUSED +25%</span>' : "") + "</div>" +
        '<div class="bjrow">' + cards.map(function (c, i) {
          var odds = Math.min(0.95, c.odds + (focus ? 0.25 : 0));
          return '<button class="bjcard" data-i="' + i + '"><span class="bjemoji">' + c.emoji + '</span><span class="bjname">' + c.name + '</span><span class="bjodds">' + Math.round(odds * 100) + "%</span>" + (c.pts ? '<span class="bjpts">+' + c.pts + " pts</span>" : "") + "</button>";
        }).join("") + "</div>";
      Array.prototype.forEach.call(el.querySelectorAll(".bjcard"), function (b) {
        b.onclick = function () { play(cards[parseInt(b.dataset.i, 10)]); };
      });
    }
    function hideCards() { document.getElementById("bjcards").innerHTML = '<div class="bjpos">' + posName(adv) + "</div>"; }

    function play(card) {
      if (busy || over) return;
      busy = true; hideCards();
      var odds = Math.min(0.95, card.odds + (focus ? 0.25 : 0));
      focus = false;
      var ok = Math.random() < odds;
      anim = { t: 0, ok: ok, mine: true };
      if (ok) {
        adv = Math.min(6, adv + card.d);
        if (card.pts) { myPts += card.pts; if (juice) juice.text(W * 0.4, H * 0.3, "+" + card.pts + " pts", "#69f0ae"); }
        big("✅ " + card.name + "!", "#69f0ae");
        if (sfx) sfx.pop();
        if (adv >= 6) return submitWin(true, card.name);
      } else {
        adv = Math.max(-5, adv - (Math.random() < 0.4 ? 2 : 1));
        big("❌ Countered!", "#ff8a8a");
        if (sfx) sfx.thud(); if (juice) juice.shake(5);
        chat("nice");
      }
      hud();
      setTimeout(botTurn, 900);
    }

    function botTurn() {
      if (over) return;
      var cards = cardsFor(-adv); // from the bot's perspective
      // better bots pick by expected value; rookies pick randomly
      var pick;
      if (Math.random() < bot.skill) {
        pick = cards.slice().sort(function (a, b) { return (b.d * b.odds + b.pts * 0.3 * b.odds) - (a.d * a.odds + a.pts * 0.3 * a.odds); })[0];
      } else pick = cards[Math.floor(Math.random() * cards.length)];
      var ok = Math.random() < pick.odds * (0.75 + bot.skill * 0.4);
      anim = { t: 0, ok: ok, mine: false };
      if (ok) {
        adv = Math.max(-6, adv - pick.d);
        if (pick.pts) botPts += pick.pts;
        big("🥋 " + bot.name + ": " + pick.name, "#ffd1a8");
        if (adv <= -6) return submitWin(false, pick.name);
      } else {
        adv = Math.min(5, adv + 1);
        big("💨 You defended it!", "#9fd6ff");
      }
      hud();
      round++;
      if (round > 10) return timeUp();
      busy = false;
      showCards();
    }

    function submitWin(mine, moveName) {
      over = true;
      endScreen(mine ? "sub" : "subbed", moveName);
    }
    function timeUp() {
      over = true;
      endScreen(myPts > botPts ? "pts" : myPts === botPts ? "draw" : "lost", null);
    }

    // ---- Focus (the word hook) ----
    document.getElementById("bjfocus").onclick = function () {
      if (busy || over || focus) return;
      VQ.miniQuiz(document.getElementById("bjq"), words, store, {
        title: "🧠 Focus up! Answer to power your next move!",
        lastFormat: lastFmt, skippable: true,
        cb: function (ok, res, fmt) {
          lastFmt = fmt || lastFmt;
          if (ok) { focus = true; big("🧠 FOCUSED! +25% on your next technique!", "#ffe14d"); if (sfx) sfx.chime(); }
          showCards();
        }
      });
    };

    function endScreen(how, moveName) {
      running = false; cancelAnimationFrame(raf);
      var won = how === "sub" || how === "pts";
      var oldBelt = beltFor(stats.rankPts);
      var res = store.recordGame("bjj", {
        win: won, score: myPts,
        rankPtsDelta: how === "sub" ? 15 : how === "pts" ? 10 : how === "draw" ? 4 : 2,
        xp: how === "sub" ? 32 : won ? 22 : 8,
        gems: (won ? 30 : 6) + myPts * 2
      });
      var newBelt = beltFor(stats.rankPts);
      var stripes = (stats.wins % 4);
      var beltUp = newBelt.at > oldBelt.at;
      wrap.innerHTML = '<div class="card hero" style="max-width:500px;margin:50px auto 0;text-align:center;color:#20303a">' +
        '<div class="big-emoji">' + (how === "sub" ? "🏆" : how === "pts" ? "🥋" : how === "draw" ? "🤝" : "💪") + '</div>' +
        '<div class="hero-line">' + (how === "sub" ? "SUBMISSION by " + moveName + "!" : how === "subbed" ? bot.name + " got the tap — you'll get them next time!" : how === "pts" ? "You win on points " + myPts + "–" + botPts + "!" : how === "draw" ? "Draw " + myPts + "–" + botPts : bot.name + " wins on points " + botPts + "–" + myPts) + "</div>" +
        '<div class="hero-sub">' +
        (beltUp ? "<b style='font-size:18px'>🎉 NEW BELT: " + newBelt.name + "!</b>" :
          "<span style='display:inline-block;padding:2px 14px;border-radius:6px;background:" + newBelt.color + ";color:" + (newBelt.at >= 150 ? "#fff" : "#20303a") + ";font-weight:900'>" + newBelt.name + "</span> · " + stripes + "/4 stripes") +
        (res.rankedUp ? "" : "") + "</div>" +
        '<button id="again" class="submit big-next">Roll again 🥋</button>' +
        '<button id="leave2" class="menubtn" style="margin-top:10px">Back to the Arcade</button></div>';
      document.getElementById("again").onclick = again;
      document.getElementById("leave2").onclick = leave;
      if ((won || beltUp) && sfx) sfx.fanfare();
      chat(won ? "lose" : "win");
    }

    // ---- drawing (mat + posed avatars reflect the position) ----
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      run += dt; anim.t += dt;
      if (bubble) { bubble.age += dt; if (bubble.age > 2.2) bubble = null; }
      if (juice) juice.update(dt);
      draw();
    }
    function draw() {
      var ox = juice ? juice.ox : 0, oy = juice ? juice.oy : 0;
      ctx.save(); ctx.translate(ox, oy);
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#3a4a5e"); bg.addColorStop(1, "#22303e");
      ctx.fillStyle = bg; ctx.fillRect(-10, -10, W + 20, H + 20);
      // mat
      var MY = H * 0.66;
      ctx.fillStyle = "#4a8ac0"; ctx.fillRect(-10, MY, W + 20, H - MY);
      ctx.fillStyle = "#e8b23a"; ctx.fillRect(W * 0.12, MY, W * 0.76, 10);
      ctx.strokeStyle = "#ffffff22"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, H * 0.9, W * 0.2, Math.PI, 0); ctx.stroke();
      // wall art
      ctx.font = Math.round(H * 0.05) + "px serif"; ctx.textAlign = "center";
      ctx.fillText("🥋", W * 0.12, H * 0.2); ctx.fillText("🏆", W * 0.88, H * 0.2);
      ctx.font = "bold " + Math.round(H * 0.028) + "px Trebuchet MS, sans-serif";
      ctx.fillStyle = "#ffffff55"; ctx.fillText("VOBLOX BJJ DOJO", W / 2, H * 0.12);
      // position visual: separation + height by advantage
      var size = H * 0.2;
      var sep = Math.max(30, 130 - Math.abs(adv) * 18);
      var meX = W / 2 - sep, botX = W / 2 + sep;
      var wig = anim.t < 0.5 ? Math.sin(anim.t * 24) * 6 * (anim.ok ? 1 : -1) : 0;
      var mePose = adv >= 4 ? "celebrate" : adv >= 2 ? "kick" : adv <= -3 ? "fall" : adv <= -1 ? "swing" : "idle";
      var botPose = adv <= -4 ? "celebrate" : adv <= -2 ? "kick" : adv >= 3 ? "fall" : adv >= 1 ? "swing" : "idle";
      var meY = MY - (adv >= 3 ? -6 : 0) + (adv <= -3 ? 8 : 0);
      AV.draw(ctx, { x: meX + (anim.mine ? wig : 0), y: meY, size: size, config: Object.assign({}, myCfg, gi && gi.id === "gear.bjj.black" ? { shirt: "#23272e" } : gi ? { shirt: "#3a7bc8" } : {}), pose: mePose, frame: run, name: store.state.profile.name });
      AV.draw(ctx, { x: botX + (anim.mine ? 0 : wig), y: MY + (adv >= 3 ? 8 : 0), size: size, config: bot.avatar, pose: botPose, frame: run + 2, name: bot.name, flip: true });
      // belts under names
      ctx.font = "bold " + Math.round(H * 0.02) + "px Trebuchet MS, sans-serif";
      ctx.fillStyle = myBelt.color; ctx.fillText("■ " + myBelt.name, meX, MY + 22);
      ctx.fillStyle = botBelt.color; ctx.fillText("■ " + botBelt.name, botX, MY + 22);
      if (bubble) Bots.bubble(ctx, { x: botX, y: MY - size - 16, text: bubble.text, age: bubble.age });
      if (juice) juice.draw(ctx);
      ctx.restore();
    }

    function cleanup() {
      running = false; cancelAnimationFrame(raf); VQ.shush();
      window.removeEventListener("resize", resize);
      if (wrap.parentNode) wrap.remove();
    }
    function leave() { cleanup(); if (opts.onExit) opts.onExit(); }
    function again() { cleanup(); start(opts); }
    document.getElementById("quit").onclick = leave;

    msgEl.innerHTML = "🥋 vs <b>" + VQ.esc(bot.name) + "</b> (" + botBelt.name + ") — sub them or win on points!";
    hud(); showCards(); chat("hi");
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxBJJ = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
