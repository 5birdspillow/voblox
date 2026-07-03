/*
 * Voblox — shared question generation + word-entry rendering.
 * Pure (no DOM state); used by both the 3D world and (later) the 2D study game.
 */
(function (global) {
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
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
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
  function meaningClue(sense) { return "“" + esc(sense.def) + "” <span class=\"posclue\">(" + sense.pos + ")</span>"; }
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
  function wordData(words, w) { for (var i = 0; i < words.length; i++) if (words[i].word === w) return words[i]; }

  // Build a question. opts: { format (required), senseIdx (optional) }
  function gen(card, words, opts) {
    opts = opts || {};
    var Engine = global.VobloxEngine;
    var d = wordData(words, card.word);
    var fmt = opts.format || (Engine ? Engine.pickFormat(card, d, opts.lastFormat) : "word2def");
    var F = (Engine && Engine.FORMATS) || {};
    var si = (typeof opts.senseIdx === "number") ? opts.senseIdx % d.senses.length
      : Math.floor(Math.random() * d.senses.length);
    var sense = d.senses[si];
    var q = { format: fmt, word: card.word, data: d, sense: sense, audio: null, hintAllowed: false, answers: [norm(d.word)] };

    function defChoices(correctDef) {
      var wrong = sample(words.filter(function (w) { return w.word !== d.word; }), 3);
      return shuffle(wrong.map(function (w) { return { label: w.definition, correct: false }; })
        .concat([{ label: correctDef, correct: true }]));
    }
    function wordChoices() {
      var wrong = sample(words.filter(function (w) { return w.word !== d.word; }), 3);
      return shuffle(wrong.map(function (w) { return { label: w.word, correct: false }; })
        .concat([{ label: d.word, correct: true }]));
    }
    function relatedChoices(correctPool, avoidPool) {
      var answer = pick(correctPool);
      var pool = [];
      words.forEach(function (w) {
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
      q.promptHTML = "🔊 Which word did you hear?";
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
      q.promptHTML = "🔊 Spell the word you hear.";
    } else {
      q.kind = "mc";
      q.promptHTML = "Which of these is a meaning of <b class=\"target\">" + esc(d.word) + "</b>?";
      q.choices = defChoices(sense.def);
    }
    return q;
  }

  // Returns "correct" | "near" | "wrong" for a typed answer.
  function checkText(q, value) {
    var val = norm(value);
    if (!val) return "empty";
    if (q.answers.indexOf(val) >= 0) return "correct";
    var near = q.answers.some(function (a) { return a.length >= 4 && lev(val, a) === 1; });
    return near ? "near" : "wrong";
  }

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

  // ---- text-to-speech (read questions aloud for early readers) ----
  function stripHtml(h) {
    return String(h)
      .replace(/<br\s*\/?>/gi, ". ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
      .replace(/[“”]/g, '"').replace(/_{2,}/g, " blank ")
      .replace(/\s+/g, " ").trim();
  }
  // Plain-text version of a question to read aloud (prompt + choices for MC;
  // for "hear it" formats, just the word so the listening test still works).
  function spoken(q) {
    var F = (global.VobloxEngine && global.VobloxEngine.FORMATS) || {};
    if (q.format === F.AUDIO_PICK || q.format === F.AUDIO_SPELL) return q.audio || "";
    var t = stripHtml(q.promptHTML);
    if (q.kind === "mc" && q.choices && q.choices.length) {
      var opts = q.choices.map(function (c, i) { return String.fromCharCode(65 + i) + ", " + c.label; }).join(". ");
      t += ". Is it: " + opts + "?";
    }
    return t;
  }
  function speak(text) {
    try {
      if (!text || !("speechSynthesis" in global)) return;
      var u = new SpeechSynthesisUtterance(text); u.rate = 0.92;
      var voices = speechSynthesis.getVoices() || [];
      var v = voices.filter(function (x) { return /en[-_]?US/i.test(x.lang); })[0] || voices.filter(function (x) { return /^en/i.test(x.lang); })[0];
      if (v) u.voice = v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }
  function readQ(q) { speak(spoken(q)); }
  function shush() { try { if ("speechSynthesis" in global) global.speechSynthesis.cancel(); } catch (e) {} }

  // ---- guess guard: the economics of answering ----
  // Wrong answers cost Vobux; escaping costs Vobux; reading pays a little back.
  // (Correct answers pay 10-45, so the numbers sting without wiping anyone out.)
  var COSTS = { wrong: 5, skip: 2, readBack: 2, lockMs: 1200 };
  function testMode() { return !!global.__VOBLOX_TEST__; }
  function chargeVobux(store, n) {
    if (!store || !store.state) return 0;
    var take = Math.min(n, store.state.gems || 0);
    store.state.gems = (store.state.gems || 0) - take;
    store.state.vobuxLost = (store.state.vobuxLost || 0) + take;
    if (store.save) store.save();
    return take;
  }
  function payVobux(store, n) {
    if (!store || !store.state) return;
    store.state.gems = (store.state.gems || 0) + n;
    if (store.save) store.save();
  }
  function markRushed(store, bornMs) {
    // an answer inside 2.5s of the question appearing is a guess, not a read
    if (!store || !store.state || Date.now() - bornMs >= 2500) return;
    store.state.fastWrong = (store.state.fastWrong || 0) + 1;
  }
  // lock answer buttons briefly while the question is read — kills reflex-clicking
  function lockChoices(btns, ms) {
    if (!ms) return;
    Array.prototype.forEach.call(btns, function (b) { b.disabled = true; b.style.opacity = "0.4"; });
    setTimeout(function () { Array.prototype.forEach.call(btns, function (b) { b.disabled = false; b.style.opacity = ""; }); }, ms);
  }
  // After a miss: a "read it" pause with countdown, then a one-tap echo check on the
  // SAME definition before play continues. Passing pays a small reading reward.
  function teachGate(container, data, opts, cb) {
    opts = opts || {};
    var secs = opts.seconds != null ? opts.seconds : (testMode() ? 0 : 4);
    var si = Math.min(opts.senseIdx || 0, data.senses.length - 1);
    var def = data.senses[si].def;
    var wrap = document.createElement("div");
    container.appendChild(wrap);
    function readStep() {
      wrap.innerHTML = (opts.headHTML || "") + '<div class="reveal">' + entryHTML(data, { mnem: true }) + '</div>' +
        '<button class="submit big-next" type="button" disabled>👀 Read it…</button>';
      speak(data.word + ". " + def);
      var btn = wrap.querySelector("button.big-next");
      var left = secs;
      (function tick() {
        if (left <= 0) { btn.disabled = false; btn.textContent = "Quick check ➜"; btn.onclick = echoStep; return; }
        btn.textContent = "👀 Read it… " + left;
        left--; setTimeout(tick, 1000);
      })();
    }
    function echoStep() {
      var pool = (opts.words || []).filter(function (w) { return w.word !== data.word && w.senses; });
      var decoys = sample(pool, 2).map(function (w) { return w.word; });
      var chs = shuffle([data.word].concat(decoys));
      wrap.innerHTML = '<div class="fb">🔎 Quick check — which word means:<br><b>“' + esc(def) + '”</b></div>' +
        '<div class="choices">' + chs.map(function (w) { return '<button class="choice" type="button" data-w="' + esc(w) + '">' + esc(w) + "</button>"; }).join("") + "</div>";
      Array.prototype.forEach.call(wrap.querySelectorAll(".choice"), function (b) {
        b.onclick = function () {
          if (b.dataset.w === data.word) { wrap.innerHTML = ""; cb(true); }
          else { b.disabled = true; b.classList.add("wrong"); speak(data.word + ". " + def); }
        };
      });
    }
    readStep();
  }

  // In-game "word power" mini-quiz used by the arcade games: renders an MC question
  // into `container` (a .gover element), records via store, teaches on a miss, then
  // calls cb(correct, res). Multiple-choice only, so it never stalls the action.
  var MINI_FORMATS = ["word2def", "cloze_mc", "def2word_mc", "synonym", "antonym"];
  function miniQuiz(container, words, store, o) {
    o = o || {};
    var Engine = global.VobloxEngine;
    var cards = words.map(function (w) { return store.state.cards[w.word]; }).filter(Boolean);
    var card = (Engine.selectDue && Engine.selectDue(cards, Date.now())) || cards[Math.floor(Math.random() * cards.length)];
    var data = words.filter(function (w) { return w.word === card.word; })[0];
    var fmt = Engine.pickFormat(card, data, o.lastFormat || null, MINI_FORMATS);
    var q = gen(card, words, { format: fmt });
    container.innerHTML = '<div class="wqcard"><div class="wqtitle">' + (o.title || "⚡ Word Power!") + '</div>' +
      '<div class="wqprompt">' + q.promptHTML + ' <button class="replay" id="wqsay" type="button">🔊</button></div>' +
      '<div class="wqchoices">' + q.choices.map(function (ch, i) { return '<button class="wqc" data-i="' + i + '">' + esc(ch.label) + "</button>"; }).join("") + "</div>" +
      (o.skippable ? '<button class="wqskip" id="wqskip" type="button">skip (−' + COSTS.skip + ' 💎)</button>' : "") + "</div>";
    container.style.display = "flex";
    readQ(q);
    var born = Date.now();
    var fired = false; // a delayed correct-answer close must not double-fire after a skip
    function done(ok, res) { if (fired) return; fired = true; container.style.display = "none"; container.innerHTML = ""; shush(); if (o.cb) o.cb(ok, res, fmt); }
    var say = container.querySelector("#wqsay"); if (say) say.onclick = function () { readQ(q); };
    var skip = container.querySelector("#wqskip"); if (skip) skip.onclick = function () { chargeVobux(store, COSTS.skip); done(null, null); };
    lockChoices(container.querySelectorAll(".wqc"), testMode() ? 0 : COSTS.lockMs);
    Array.prototype.forEach.call(container.querySelectorAll(".wqc"), function (b) {
      b.onclick = function () {
        var ok = !!q.choices[parseInt(b.dataset.i, 10)].correct;
        Array.prototype.forEach.call(container.querySelectorAll(".wqc"), function (bb, idx) {
          bb.disabled = true; if (q.choices[idx].correct) bb.classList.add("right"); else if (bb === b) bb.classList.add("wrong");
        });
        var sk2 = container.querySelector("#wqskip"); if (sk2) sk2.remove(); // no skipping out of a wrong answer
        var res = store.record(q, ok);
        if (ok) { setTimeout(function () { done(true, res); }, 620); }
        else {
          markRushed(store, born);
          var lost = chargeVobux(store, COSTS.wrong);
          var card2 = container.querySelector(".wqcard");
          if (testMode()) { // harness fast-path: legacy dismiss (the gate has its own spec)
            var teach = document.createElement("div"); teach.className = "wqteach"; teach.innerHTML = entryHTML(q.data, { mnem: true });
            card2.appendChild(teach);
            var btn = document.createElement("button"); btn.className = "wqskip"; btn.type = "button"; btn.textContent = "Got it";
            btn.onclick = function () { done(false, res); };
            card2.appendChild(btn);
          } else {
            teachGate(card2, q.data, {
              words: words, senseIdx: q.senseIdx || 0,
              headHTML: '<div class="fb bad">❌ ' + (lost ? "−" + lost + " 💎 — " : "") + "read the word, then one quick check:</div>"
            }, function () {
              payVobux(store, COSTS.readBack);
              done(false, res);
            });
          }
        }
      };
    });
    return q;
  }

  var VQ = {
    pick: pick, shuffle: shuffle, sample: sample, uniq: uniq, norm: norm, esc: esc,
    boldWord: boldWord, lev: lev, meaningClue: meaningClue, makeCloze: makeCloze,
    clozeFor: clozeFor, wordData: wordData, gen: gen, checkText: checkText, entryHTML: entryHTML,
    speak: speak, spoken: spoken, readQ: readQ, shush: shush, miniQuiz: miniQuiz,
    teachGate: teachGate, lockChoices: lockChoices, chargeVobux: chargeVobux, payVobux: payVobux,
    markRushed: markRushed, COSTS: COSTS
  };
  // stop any speech when the tab/app is hidden (locked screen, app switch, etc.)
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", function () { if (document.hidden) shush(); });
  if (typeof module !== "undefined" && module.exports) module.exports = VQ;
  global.VobloxQuestions = VQ;
})(typeof window !== "undefined" ? window : globalThis);
