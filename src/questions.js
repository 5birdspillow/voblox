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

  var VQ = {
    pick: pick, shuffle: shuffle, sample: sample, uniq: uniq, norm: norm, esc: esc,
    boldWord: boldWord, lev: lev, meaningClue: meaningClue, makeCloze: makeCloze,
    clozeFor: clozeFor, wordData: wordData, gen: gen, checkText: checkText, entryHTML: entryHTML
  };
  if (typeof module !== "undefined" && module.exports) module.exports = VQ;
  global.VobloxQuestions = VQ;
})(typeof window !== "undefined" ? window : globalThis);
