/*
 * Voblox — app controller (UI, question generation, gamification, saving)
 * Uses VobloxEngine (the brain) + VOBLOX_CONTENT (the words).
 */
(function () {
  "use strict";

  var Engine = window.VobloxEngine;
  var Content = window.VOBLOX_CONTENT;

  var SAVE_KEY = "voblox.save.v1";

  // Which lesson to study. Respect the shared active lesson (set by the 3D world,
  // Craft World, the dashboard, or the picker below); default to the earliest available.
  var _saved = loadState();
  var _avail = Content.availableLessons();
  var LESSON_ID = String((_saved && _saved.activeLesson) || (_avail[0] ? _avail[0].lesson : 5));
  if (!Content.getLesson(LESSON_ID)) LESSON_ID = String(_avail[0] ? _avail[0].lesson : 5);
  var lesson = Content.getLesson(LESSON_ID);
  var WORDS = lesson.words;

  // ---- State ---------------------------------------------------------------
  var state = _saved || freshState();
  if (!state.activeLesson) state.activeLesson = LESSON_ID;
  ensureCards();

  var session = null; // practice session
  var mock = null;     // mock quiz
  var keyHandler = null;

  // ---- Save / load ---------------------------------------------------------
  function freshState() {
    var cards = {};
    WORDS.forEach(function (w) { cards[w.word] = Engine.createCard(w.word); });
    return { cards: cards, gems: 0, totalCorrect: 0, bestCombo: 0, combo: 0, collection: [], lastPlayed: 0 };
  }
  function ensureCards() {
    WORDS.forEach(function (w) {
      if (!state.cards[w.word]) state.cards[w.word] = Engine.createCard(w.word);
    });
  }
  function loadState() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }
  function save() {
    state.lastPlayed = Date.now();
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---- Small helpers -------------------------------------------------------
  function el(id) { return document.getElementById(id); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(a, n) { return shuffle(a).slice(0, n); }
  function wordData(w) { for (var i = 0; i < WORDS.length; i++) if (WORDS[i].word === w) return WORDS[i]; }
  function cardList() { return WORDS.map(function (w) { return state.cards[w.word]; }); }
  function norm(s) { return (s || "").toLowerCase().replace(/[^a-z]/g, ""); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function boldWord(sentence, word) {
    var re = new RegExp("(" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*)", "ig");
    return esc(sentence).replace(re, "<b>$1</b>");
  }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [];
    for (var i = 0; i <= m; i++) d[i] = [i];
    for (var j = 0; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[m][n];
  }

  // ---- Audio (free browser text-to-speech) --------------------------------
  function speak(text) {
    try {
      if (!("speechSynthesis" in window)) return;
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      var voices = window.speechSynthesis.getVoices();
      var v = voices.filter(function (x) { return /en[-_]?US/i.test(x.lang); })[0] ||
              voices.filter(function (x) { return /^en/i.test(x.lang); })[0];
      if (v) u.voice = v;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ---- Gamification --------------------------------------------------------
  var RANKS = [
    { name: "Pawn", icon: "♟", at: 0 },
    { name: "Knight", icon: "♞", at: 15 },
    { name: "Bishop", icon: "♝", at: 35 },
    { name: "Rook", icon: "♜", at: 70 },
    { name: "Queen", icon: "♛", at: 120 },
    { name: "Grandmaster", icon: "👑", at: 200 }
  ];
  var LOOT = ["🗡️", "🛡️", "💎", "🐉", "🐺",
    "🐱", "🎩", "👑", "🧱", "🌳", "⚡",
    "🔥", "🍄", "🏰", "🚀", "🦖"];
  function rankFor(n) { var r = RANKS[0]; RANKS.forEach(function (x) { if (n >= x.at) r = x; }); return r; }
  function nextRank(n) { for (var i = 0; i < RANKS.length; i++) if (n < RANKS[i].at) return RANKS[i]; return null; }

  function predicted() { return Engine.predictedScore(cardList()); }

  // ---- HUD -----------------------------------------------------------------
  function renderHUD() {
    var r = rankFor(state.totalCorrect);
    var p = predicted();
    el("hud").innerHTML =
      '<div class="hud-left">' +
        '<span class="chip">' + r.icon + ' ' + r.name + '</span>' +
        '<span class="chip"><img class="vbx" src="icons/vobux.png" alt="V"> ' + state.gems + '</span>' +
        (state.combo > 1 ? '<span class="chip combo">🔥 x' + state.combo + '</span>' : '') +
      '</div>' +
      '<div class="meter" title="Predicted quiz score">' +
        '<div class="meter-fill" style="width:' + p + '%"></div>' +
        '<div class="meter-tick" style="left:80%"></div>' +
        '<div class="meter-tick a" style="left:90%"></div>' +
        '<div class="meter-label">' + p + '% — predicted quiz score</div>' +
      '</div>';
  }

  // ---- Screen router -------------------------------------------------------
  function show(html) { el("screen").innerHTML = html; renderHUD(); }
  function setKeys(fn) { keyHandler = fn; }

  // ---- Lesson picker (lets Leo switch which lesson the study game drills) ---
  function lessonPicker() {
    var avail = Content.availableLessons();
    if (avail.length < 2) return "";
    return '<div class="lessonpick">' + avail.map(function (L) {
      var on = String(L.lesson) === LESSON_ID;
      return '<button class="lpick' + (on ? " on" : "") + '" data-l="' + L.lesson + '">' +
        esc(L.title) + (on ? " ✓" : "") + '</button>';
    }).join("") + '</div>';
  }
  function wireLessonPicker() {
    Array.prototype.forEach.call(document.querySelectorAll(".lpick"), function (b) {
      b.onclick = function () {
        var n = String(b.dataset.l);
        if (n === LESSON_ID) return;
        state.activeLesson = n; save();   // shared with the 3D world / Craft World / dashboard
        window.location.reload();         // clean re-init on the chosen lesson
      };
    });
  }

  // ---- HOME ----------------------------------------------------------------
  function goHome() {
    session = null; mock = null;
    var p = predicted();
    var grade = p >= 90 ? "an A 🌟" : p >= 80 ? "a B 👍" : "below a B yet";
    var ready = cardList().filter(Engine.isQuizReady).length;
    show(
      '<div class="logo">VOBLOX</div>' +
      '<div class="subtitle">' + esc(lesson.title) + ' • ' + WORDS.length + ' words</div>' +
      lessonPicker() +
      '<div class="card hero">' +
        '<div class="hero-line">You’re predicted to get <b>' + grade + '</b></div>' +
        '<div class="hero-sub">' + ready + ' of ' + WORDS.length + ' words are quiz-ready. ' +
          (p >= 90 ? "Amazing — keep it sharp!" : p >= 80 ? "Push to 90% for an A!" : "Play Practice to level them up!") +
        '</div>' +
      '</div>' +
      '<div class="menu">' +
        btn("play", "▶ Practice", "Earn Vobux while the game quizzes you") +
        btn("mock", "📝 Mock Quiz", "A pretend test — see your grade") +
        btn("words", "📖 Word List", "See all the words and hear them") +
        btn("settings", "⚙️ Backup / Settings", "Save or move progress") +
      '</div>' +
      '<div class="tip">Tip: a little tonight and a little before the quiz beats one long cram.</div>'
    );
    el("play").onclick = startPractice;
    el("mock").onclick = startMock;
    el("words").onclick = renderWords;
    el("settings").onclick = renderSettings;
    wireLessonPicker();
    setKeys(function (e) { if (e.key === "Enter") startPractice(); });
  }
  function btn(id, label, sub) {
    return '<button class="big" id="' + id + '"><span class="bl">' + label + '</span>' +
      '<span class="bs">' + sub + '</span></button>';
  }

  // ---- Question generation -------------------------------------------------
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function meaningClue(sense) { return "“" + esc(sense.def) + "” <span class=\"posclue\">(" + sense.pos + ")</span>"; }

  // rotate through a word's meanings so repeated questions cover each one
  function nextSense(word) {
    var d = wordData(word);
    if (d.senses.length <= 1) return 0;
    if (!session) return Math.floor(Math.random() * d.senses.length);
    var cur = session.senseCursor[word] || 0;
    session.senseCursor[word] = (cur + 1) % d.senses.length;
    return cur;
  }

  // turn an example sentence into a fill-in-the-blank (handles word endings like -ed/-s)
  function makeCloze(example, word) {
    var re = new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*\\b", "i");
    var m = example.match(re);
    if (!m) return null;
    return { text: example.replace(re, "____"), removed: m[0] };
  }
  function clozeFor(d, si) {
    var order = [si];
    for (var i = 0; i < d.senses.length; i++) if (i !== si) order.push(i);
    for (var k = 0; k < order.length; k++) {
      var c = makeCloze(d.senses[order[k]].example, d.word);
      if (c) return c;
    }
    return { text: "(" + d.senses[si].def + ")  ____", removed: d.word };
  }

  function genQuestion(card, opts) {
    opts = opts || {};
    var d = wordData(card.word);
    var lastFmt = session && session.lastFormat[card.word];
    var fmt = opts.format || Engine.pickFormat(card, d, lastFmt);
    var F = Engine.FORMATS;
    var si = (typeof opts.senseIdx === "number") ? opts.senseIdx : nextSense(card.word);
    si = si % d.senses.length;
    var sense = d.senses[si];
    var q = { format: fmt, word: card.word, data: d, sense: sense, audio: null, hintAllowed: false, answers: [norm(d.word)] };

    function defChoices(correctDef) {
      var wrong = sample(WORDS.filter(function (w) { return w.word !== d.word; }), 3);
      return shuffle(wrong.map(function (w) { return { label: w.definition, correct: false }; })
        .concat([{ label: correctDef, correct: true }]));
    }
    function wordChoices() {
      var wrong = sample(WORDS.filter(function (w) { return w.word !== d.word; }), 3);
      return shuffle(wrong.map(function (w) { return { label: w.word, correct: false }; })
        .concat([{ label: d.word, correct: true }]));
    }
    function relatedChoices(correctPool, avoidPool) {
      var answer = pick(correctPool);
      var pool = [];
      WORDS.forEach(function (w) {
        if (w.word === d.word) return;
        pool.push(w.word);
        (w.synonyms || []).forEach(function (s) { pool.push(s); });
      });
      pool = uniq(pool).filter(function (x) { return avoidPool.indexOf(x) === -1 && x !== answer; });
      var wrong = sample(pool, 3);
      return shuffle(wrong.map(function (x) { return { label: x, correct: false }; })
        .concat([{ label: answer, correct: true }]));
    }

    if (fmt === F.WORD2DEF) {
      q.kind = "mc";
      q.promptHTML = "Which of these is a meaning of <b class=\"target\">" + esc(d.word) + "</b>?";
      q.choices = defChoices(sense.def);
    } else if (fmt === F.DEF2WORD_MC) {
      q.kind = "mc";
      q.promptHTML = "Which word means:<br><span class=\"quote\">" + meaningClue(sense) + "</span>";
      q.choices = wordChoices();
    } else if (fmt === F.CLOZE_MC) {
      q.kind = "mc";
      q.promptHTML = "Pick the word that fits:<br><span class=\"quote\">" + esc(clozeFor(d, si).text) + "</span>";
      q.choices = wordChoices();
    } else if (fmt === F.AUDIO_PICK) {
      q.kind = "mc"; q.audio = d.word;
      q.promptHTML = "🔊 Which word did you hear? <button class=\"replay\" type=\"button\">🔊 again</button>";
      q.choices = wordChoices();
    } else if (fmt === F.SYNONYM) {
      q.kind = "mc";
      q.promptHTML = "Which word means about the <b>SAME</b> as <b class=\"target\">" + esc(d.word) + "</b>?";
      q.choices = relatedChoices(d.synonyms, d.synonyms.concat([d.word]));
    } else if (fmt === F.ANTONYM) {
      q.kind = "mc";
      q.promptHTML = "Which word is the <b>OPPOSITE</b> of <b class=\"target\">" + esc(d.word) + "</b>?";
      q.choices = relatedChoices(d.antonyms, d.antonyms.concat([d.word]));
    } else if (fmt === F.CLOZE_TYPE) {
      var cz = clozeFor(d, si);
      q.kind = "text"; q.hintAllowed = true;
      q.answers = uniq([norm(d.word), norm(cz.removed)]);
      q.promptHTML = "Type the word that fits:<br><span class=\"quote\">" + esc(cz.text) + "</span>";
    } else if (fmt === F.DEF2WORD_TYPE) {
      q.kind = "text"; q.hintAllowed = true;
      q.promptHTML = "Type the word that means:<br><span class=\"quote\">" + meaningClue(sense) + "</span>";
    } else if (fmt === F.AUDIO_SPELL) {
      q.kind = "text"; q.hintAllowed = true; q.audio = d.word;
      q.promptHTML = "🔊 Spell the word you hear. <button class=\"replay\" type=\"button\">🔊 again</button>";
    } else {
      q.kind = "mc";
      q.promptHTML = "Which of these is a meaning of <b class=\"target\">" + esc(d.word) + "</b>?";
      q.choices = defChoices(sense.def);
    }
    return q;
  }

  // full dictionary-style entry: all meanings + related forms (used in feedback & word list)
  function entryHTML(d, opts) {
    opts = opts || {};
    var senses = d.senses.map(function (s, i) {
      return '<div class="sense">' + (d.senses.length > 1 ? '<span class="snum">' + (i + 1) + '</span>' : '') +
        '<span class="pos">' + s.pos + '.</span> ' + esc(s.def) +
        '<div class="rex">“' + boldWord(s.example, d.word) + '”</div></div>';
    }).join("");
    var forms = (d.forms || []).map(function (f) {
      return '<div class="form">↳ <b>' + esc(f.word) + '</b> <span class="pos">(' + f.pos + ')</span> ' + esc(f.def) +
        '<div class="rex">“' + boldWord(f.example, f.word) + '”</div></div>';
    }).join("");
    return '<div class="rword">' + d.emoji + " " + esc(d.word) +
      (d.pron ? ' <span class="pron">' + esc(d.pron) + '</span>' : "") +
      (d.senses.length > 1 ? ' <span class="badge">' + d.senses.length + ' meanings</span>' : "") + '</div>' +
      '<div class="senses">' + senses + '</div>' +
      (forms ? '<div class="forms-h">Related words to know:</div>' + forms : "") +
      (opts.mnem && d.mnemonic ? '<div class="rmnem">💡 ' + esc(d.mnemonic) + '</div>' : "");
  }

  // ---- PRACTICE (Quiz Crunch) ---------------------------------------------
  function startPractice() {
    session = { queue: shuffle(WORDS.map(function (w) { return w.word; })), lastFormat: {}, senseCursor: {}, asked: 0 };
    askQuestion();
  }
  function askQuestion() {
    if (predicted() >= 100 || session.queue.length === 0) return endSession();
    var word = session.queue.shift();
    var card = state.cards[word];
    var q = genQuestion(card);
    session.current = q;
    session.lastFormat[word] = q.format;
    session.asked++;
    renderQuestion(q, { stop: true });
    if (q.audio) speak(q.audio);
  }

  function renderQuestion(q, opt) {
    var body;
    if (q.kind === "mc") {
      body = q.choices.map(function (c, i) {
        return '<button class="choice" data-i="' + i + '"><span class="num">' + (i + 1) + '</span>' + esc(c.label) + '</button>';
      }).join("");
      body = '<div class="choices">' + body + '</div>';
    } else {
      body = '<div class="typebox">' +
        '<input id="answer" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="type here…">' +
        '<button id="submit" class="submit">Enter ⏎</button>' +
        '<div id="hint" class="hint"></div></div>';
    }
    show(
      '<div class="qhead">' + (opt && opt.label ? opt.label : "Practice") +
        (opt && opt.stop ? '<button id="stop" class="stop">✕ Stop</button>' : "") + '</div>' +
      '<div class="card qcard"><div class="prompt">' + q.promptHTML + '</div>' + body + '</div>'
    );
    q._born = Date.now(); q._ready = q.kind !== "mc";
    var stop = el("stop");
    if (stop) stop.onclick = function () {
      // stopping mid-question is fine, but the word counts as "not known yet"
      // so it comes back sooner (otherwise Stop becomes a free skip button)
      Engine.grade(state.cards[q.word], q.format, false, Date.now());
      save(); goHome();
    };
    var replay = document.querySelector(".replay");
    if (replay) replay.onclick = function () { if (q.audio) speak(q.audio); };

    if (q.kind === "mc") {
      var btns = Array.prototype.slice.call(document.querySelectorAll(".choice"));
      btns.forEach(function (b) { b.onclick = function () { answerMC(q, parseInt(b.dataset.i, 10)); }; });
      // brief lock while the question gets read — no reflex-guessing
      btns.forEach(function (b) { b.disabled = true; b.style.opacity = "0.4"; });
      setTimeout(function () { q._ready = true; btns.forEach(function (b) { b.disabled = false; b.style.opacity = ""; }); }, 1200);
      setKeys(function (e) {
        if (!q._ready) return;
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= q.choices.length) answerMC(q, n - 1);
      });
    } else {
      var input = el("answer"); input.focus();
      el("submit").onclick = function () { answerText(q); };
      setKeys(function (e) { if (e.key === "Enter") answerText(q); });
    }
  }

  function answerMC(q, i) {
    var correct = !!q.choices[i].correct;
    document.querySelectorAll(".choice").forEach(function (b, idx) {
      b.disabled = true;
      if (q.choices[idx].correct) b.classList.add("right");
      else if (idx === i) b.classList.add("wrong");
    });
    grade(q, correct);
  }

  function answerText(q) {
    var input = el("answer");
    var val = norm(input.value);
    if (!val) return;
    if (q.answers.indexOf(val) >= 0) { input.disabled = true; return grade(q, true); }
    // near miss -> one gentle retry
    var near = q.answers.some(function (a) { return a.length >= 4 && lev(val, a) === 1; });
    if (q.hintAllowed && !q._retried && near) {
      q._retried = true;
      el("hint").textContent = "So close — check the spelling and try once more!";
      input.classList.add("almost");
      input.select();
      return;
    }
    input.disabled = true;
    grade(q, false);
  }

  function grade(q, correct) {
    Engine.grade(state.cards[q.word], q.format, correct, Date.now());
    var earned = 0, loot = null;
    if (correct) {
      state.combo += 1;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      state.totalCorrect += 1;
      earned = gemsFor(q);
      state.gems += earned;
      loot = maybeLoot();
      burst(correct);
    } else {
      state.combo = 0;
      // wrong answers cost Vobux (guessing isn't free anymore)
      q._lost = Math.min(5, state.gems || 0);
      state.gems = (state.gems || 0) - q._lost;
      state.vobuxLost = (state.vobuxLost || 0) + q._lost;
      if (Date.now() - (q._born || 0) < 2500) state.fastWrong = (state.fastWrong || 0) + 1;
    }
    save();
    showFeedback(q, correct, earned, loot);
  }

  function gemsFor(q) {
    var base = q.kind === "text" ? (q.format === Engine.FORMATS.AUDIO_SPELL ? 25 : 20) : 10;
    var bonus = Math.min(Math.max(state.combo - 1, 0) * 2, 20);
    return base + bonus;
  }
  function maybeLoot() {
    if (state.totalCorrect > 0 && state.totalCorrect % 5 === 0) {
      var item = pick(LOOT); state.collection.push(item); return item;
    }
    return null;
  }

  function showFeedback(q, correct, earned, loot) {
    var d = q.data;
    var head = correct
      ? '<div class="fb good">✅ ' + pick(["Nice!", "Yes!", "Boom!", "Correct!", "You got it!"]) +
        (earned ? ' <span class="gain">+' + earned + ' 💎</span>' : "") + '</div>'
      : '<div class="fb bad">❌ Not quite' + (q._lost ? " (−" + q._lost + " 💎)" : "") + ' — read the word, then one quick check:</div>';
    var lootHTML = loot ? '<div class="loot">🎁 Loot chest! You found ' + loot + ' <span class="muted">(added to your collection)</span></div>' : "";
    show(
      '<div class="qhead">Practice' + (correct ? '<button id="stop" class="stop">✕ Stop</button>' : "") + '</div>' +
      '<div class="card qcard">' + head + '<div class="reveal">' + entryHTML(d, { mnem: true }) + '</div>' + lootHTML +
      '<button id="next" class="submit big-next"' + (correct ? "" : " disabled") + '>Next ⏎</button></div>'
    );
    var stopBtn = el("stop"); if (stopBtn) stopBtn.onclick = function () { save(); goHome(); };
    if (correct) {
      el("next").onclick = nextAfterFeedback;
      setKeys(function (e) { if (e.key === "Enter") nextAfterFeedback(); });
    } else {
      // reading gate: a short countdown while the entry is read aloud, then a
      // one-tap echo check on the definition. Passing pays a little back.
      speak(d.word + ". " + d.senses[0].def);
      setKeys(function () {});
      var nx = el("next"), left = 4;
      (function tick() {
        if (left <= 0) { nx.disabled = false; nx.textContent = "Quick check ➜"; nx.onclick = echoCheck; return; }
        nx.textContent = "👀 Read it… " + left;
        left--; setTimeout(tick, 1000);
      })();
      function echoCheck() {
        var def = d.senses[0].def;
        var decoys = shuffle(WORDS.filter(function (w) { return w.word !== d.word; })).slice(0, 2).map(function (w) { return w.word; });
        var chs = shuffle([d.word].concat(decoys));
        show(
          '<div class="qhead">Practice</div>' +
          '<div class="card qcard"><div class="fb">🔎 Quick check — which word means:<br><b>“' + esc(def) + '”</b></div>' +
          '<div class="choices">' + chs.map(function (w, i) { return '<button class="choice" data-w="' + esc(w) + '"><span class="num">' + (i + 1) + '</span>' + esc(w) + '</button>'; }).join("") + '</div></div>'
        );
        document.querySelectorAll(".choice").forEach(function (b) {
          b.onclick = function () {
            if (b.dataset.w === d.word) {
              state.gems += 2; save();
              burst(true);
              nextAfterFeedback();
            } else { b.disabled = true; b.classList.add("wrong"); speak(d.word + ". " + def); }
          };
        });
        setKeys(function (e) {
          var n = parseInt(e.key, 10);
          var bs = document.querySelectorAll(".choice");
          if (n >= 1 && n <= bs.length && !bs[n - 1].disabled) bs[n - 1].click();
        });
      }
    }

    // schedule the word's next appearance in this session
    var card = state.cards[q.word];
    if (!(correct && Engine.isQuizReady(card))) {
      var gaps = { 0: 3, 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 };
      var gap = correct ? gaps[card.box] : 2;
      var posn = Math.min(gap, session.queue.length);
      session.queue.splice(posn, 0, q.word);
    }
  }
  function nextAfterFeedback() { askQuestion(); }

  function endSession() {
    save();
    var p = predicted();
    var grade = p >= 90 ? "an A! 🌟" : p >= 80 ? "a B! 👍" : "almost a B";
    show(
      '<div class="logo small">Session complete!</div>' +
      '<div class="card hero">' +
        '<div class="big-emoji">' + (p >= 90 ? "🏆" : p >= 80 ? "🎉" : "💪") + '</div>' +
        '<div class="hero-line">All words practiced — you’re predicted to get ' + grade + '</div>' +
        '<div class="hero-sub">Predicted quiz score: <b>' + p + '%</b> • Vobux: ' + state.gems + ' • Best combo: ' + state.bestCombo + '</div>' +
      '</div>' +
      '<div class="menu">' +
        btn("mock", "📝 Try the Mock Quiz", "See your real grade") +
        btn("again", "▶ Practice again", "Lock them in even harder") +
        btn("home", "🏠 Home", "") +
      '</div>'
    );
    el("mock").onclick = startMock;
    el("again").onclick = startPractice;
    el("home").onclick = goHome;
    setKeys(function (e) { if (e.key === "Enter") startMock(); });
    if (p >= 80) burst(true);
  }

  // ---- MOCK QUIZ -----------------------------------------------------------
  function startMock() {
    var formats = [Engine.FORMATS.DEF2WORD_TYPE, Engine.FORMATS.CLOZE_TYPE, Engine.FORMATS.DEF2WORD_MC];
    mock = {
      order: shuffle(WORDS.map(function (w) { return w.word; })),
      idx: 0, correct: 0, results: [],
      formatFor: function (i) { return formats[i % formats.length]; }
    };
    mockNext();
  }
  function mockNext() {
    if (mock.idx >= mock.order.length) return mockResults();
    var word = mock.order[mock.idx];
    var card = state.cards[word];
    var d = wordData(word);
    var si = Math.floor(Math.random() * d.senses.length); // test a random meaning
    var q = genQuestion(card, { format: mock.formatFor(mock.idx), senseIdx: si });
    mock.current = q;
    renderQuestion(q, { label: "Mock Quiz • " + (mock.idx + 1) + "/" + mock.order.length });
    if (q.audio) speak(q.audio);
    // override answer handlers to NOT show feedback (real-test feel)
    if (q.kind === "mc") {
      Array.prototype.slice.call(document.querySelectorAll(".choice")).forEach(function (b) {
        b.onclick = function () { mockAnswer(q, !!q.choices[parseInt(b.dataset.i, 10)].correct); };
      });
      setKeys(function (e) {
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= q.choices.length) mockAnswer(q, !!q.choices[n - 1].correct);
      });
    } else {
      var chk = function () { return q.answers.indexOf(norm(el("answer").value)) >= 0; };
      el("submit").onclick = function () { mockAnswer(q, chk()); };
      setKeys(function (e) { if (e.key === "Enter") mockAnswer(q, chk()); });
    }
  }
  function mockAnswer(q, correct) {
    Engine.grade(state.cards[q.word], q.format, correct, Date.now());
    if (correct) mock.correct++;
    mock.results.push({ word: q.word, correct: correct });
    mock.idx++;
    save();
    mockNext();
  }
  function mockResults() {
    save();
    var total = mock.order.length;
    var pct = Math.round((100 * mock.correct) / total);
    var grade = pct >= 90 ? "A 🌟" : pct >= 80 ? "B 👍" : "Keep practicing 💪";
    var missed = mock.results.filter(function (r) { return !r.correct; }).map(function (r) { return r.word; });
    show(
      '<div class="logo small">Mock Quiz Result</div>' +
      '<div class="card hero">' +
        '<div class="bigscore">' + pct + '%</div>' +
        '<div class="hero-line">Grade: <b>' + grade + '</b> (' + mock.correct + '/' + total + ')</div>' +
        (missed.length
          ? '<div class="hero-sub">Review these before the quiz: <b>' + missed.map(esc).join(", ") + '</b></div>'
          : '<div class="hero-sub">Perfect — you know them all! 🎉</div>') +
      '</div>' +
      '<div class="menu">' +
        (missed.length ? btn("drill", "▶ Practice the missed words", "Target the shaky ones") : "") +
        btn("again", "📝 Retake Mock Quiz", "") +
        btn("home", "🏠 Home", "") +
      '</div>'
    );
    var drill = el("drill");
    if (drill) drill.onclick = function () {
      session = { queue: shuffle(missed), lastFormat: {}, senseCursor: {}, asked: 0 };
      askQuestion();
    };
    el("again").onclick = startMock;
    el("home").onclick = goHome;
    setKeys(function (e) { if (e.key === "Enter") goHome(); });
    if (pct >= 80) burst(true);
  }

  // ---- WORD LIST -----------------------------------------------------------
  function renderWords() {
    var rows = WORDS.map(function (d) {
      return '<div class="wrow">' +
        '<button class="say" data-w="' + esc(d.word) + '">🔊</button>' +
        '<div class="winfo">' + entryHTML(d, { mnem: true }) + '</div></div>';
    }).join("");
    show('<div class="qhead">Word List — tap 🔊 to hear each word <button id="home" class="stop">🏠 Home</button></div>' +
      '<div class="wordlist">' + rows + '</div>');
    el("home").onclick = goHome;
    Array.prototype.slice.call(document.querySelectorAll(".say")).forEach(function (b) {
      b.onclick = function () { speak(b.dataset.w); };
    });
    setKeys(function (e) { if (e.key === "Enter") goHome(); });
  }

  // ---- SETTINGS / BACKUP ---------------------------------------------------
  function renderSettings() {
    var code = "";
    try { code = btoa(unescape(encodeURIComponent(JSON.stringify(state)))); } catch (e) { code = JSON.stringify(state); }
    show('<div class="qhead">Backup / Settings <button id="home" class="stop">🏠 Home</button></div>' +
      '<div class="card">' +
      '<p><b>Progress saves automatically</b> on this computer. To move it to another device or keep a backup, copy this code (or download it), and paste/upload it on the other device.</p>' +
      '<textarea id="code" class="code" readonly>' + esc(code) + '</textarea>' +
      '<div class="row"><button id="copy" class="submit">📋 Copy</button>' +
      '<button id="dl" class="submit">⬇️ Download backup</button></div>' +
      '<hr><p><b>Restore</b> from a code or file:</p>' +
      '<textarea id="paste" class="code" placeholder="paste a backup code here…"></textarea>' +
      '<div class="row"><button id="restore" class="submit">♻️ Restore from code</button>' +
      '<label class="submit filelabel">📁 Restore from file<input id="file" type="file" accept="application/json" hidden></label></div>' +
      '<hr><p class="muted">Words look wrong? They’re editable in <code>src/content.js</code> — verify against Leo’s worksheet.</p>' +
      '<button id="reset" class="danger">⚠️ Reset all progress</button>' +
      '</div>');
    el("home").onclick = goHome;
    el("copy").onclick = function () { el("code").select(); try { document.execCommand("copy"); } catch (e) {} el("copy").textContent = "✅ Copied"; };
    el("dl").onclick = function () {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "voblox-progress.json"; a.click();
    };
    el("restore").onclick = function () { applyRestore(el("paste").value.trim()); };
    el("file").onchange = function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      var r = new FileReader(); r.onload = function () { applyRestore(r.result); }; r.readAsText(f);
    };
    el("reset").onclick = function () {
      if (window.confirm("Reset ALL of Leo’s progress? This cannot be undone.")) {
        state = freshState(); ensureCards(); save(); goHome();
      }
    };
    setKeys(null);
  }
  function applyRestore(text) {
    var obj = null;
    try { obj = JSON.parse(text); } catch (e) {
      try { obj = JSON.parse(decodeURIComponent(escape(atob(text)))); } catch (e2) {}
    }
    if (!obj || !obj.cards) { window.alert("Hmm, that backup didn’t look right."); return; }
    state = obj; ensureCards(); save();
    window.alert("Restored! ✅"); goHome();
  }

  // ---- Little juice: confetti / shake -------------------------------------
  function burst(good) {
    if (!good) return;
    var fx = el("fx");
    var colors = ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb", "#ffab40"];
    for (var i = 0; i < 18; i++) {
      var s = document.createElement("div");
      s.className = "confetti";
      s.style.left = (10 + Math.random() * 80) + "%";
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = (Math.random() * 0.2) + "s";
      fx.appendChild(s);
      (function (node) { setTimeout(function () { node.remove(); }, 1200); })(s);
    }
  }

  // ---- Boot ----------------------------------------------------------------
  document.addEventListener("keydown", function (e) { if (keyHandler) keyHandler(e); });
  // surface any runtime error visibly (helps debugging headless + parent reports)
  window.onerror = function (msg) {
    var b = el("errbar"); if (b) { b.style.display = "block"; b.textContent = "⚠ " + msg; }
  };
  // some browsers load TTS voices async
  if ("speechSynthesis" in window) { try { window.speechSynthesis.getVoices(); } catch (e) {} }

  // optional deep links (e.g. index.html#practice) for quick access
  var h = (location.hash || "").replace("#", "");
  if (h === "practice") startPractice();
  else if (h === "mock") startMock();
  else if (h === "words") renderWords();
  else if (h === "settings") renderSettings();
  else goHome();
})();
