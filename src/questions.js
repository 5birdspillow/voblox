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
    // Forgiving spelling: knowing the WORD is what counts (school quizzes test
    // meaning, not orthography). Same first letter + a close edit distance =
    // full credit, with the right spelling shown as a friendly tip.
    for (var i = 0; i < q.answers.length; i++) {
      var a = q.answers[i];
      if (a.length >= 4 && val.charAt(0) === a.charAt(0) && lev(val, a) <= (a.length >= 6 ? 2 : 1)) {
        q._spellFix = a;
        return "correct";
      }
    }
    var near = q.answers.some(function (a) { return a.length >= 4 && lev(val, a) <= 2; });
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
  // Per-player voice settings live on the save (profile.voice) — pages copy them
  // into window.__VOBLOX_VOICE at boot, and the Style panel updates it live.
  function voiceConfig() {
    var V = global.__VOBLOX_VOICE || {};
    return {
      name: V.name || null,
      rate: (V.rate >= 0.5 && V.rate <= 2) ? V.rate : 0.92,
      pitch: (V.pitch >= 0.3 && V.pitch <= 2) ? V.pitch : 1
    };
  }
  function speak(text) {
    try {
      if (!text || !("speechSynthesis" in global)) return;
      var cfg = voiceConfig();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = cfg.rate; u.pitch = cfg.pitch;
      var voices = speechSynthesis.getVoices() || [];
      var v = null;
      if (cfg.name) v = voices.filter(function (x) { return x.name === cfg.name; })[0];
      if (!v) v = voices.filter(function (x) { return /en[-_]?US/i.test(x.lang); })[0] || voices.filter(function (x) { return /^en/i.test(x.lang); })[0];
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
  // escalating penalty: each wrong-in-a-row costs more (5, 8, 11, 14, 17, 20 cap);
  // any correct answer anywhere resets the streak
  function penalizeWrong(store) {
    if (!store || !store.state) return { lost: 0, streak: 1 };
    var st = store.state;
    st.wrongStreak = (st.wrongStreak || 0) + 1;
    var want = Math.min(20, COSTS.wrong + 3 * (st.wrongStreak - 1));
    var lost = Math.min(want, st.gems || 0);
    st.gems = (st.gems || 0) - lost;
    st.vobuxLost = (st.vobuxLost || 0) + lost;
    if (store.save) store.save();
    return { lost: lost, want: want, streak: st.wrongStreak };
  }
  function clearWrongStreak(store) { if (store && store.state) store.state.wrongStreak = 0; }
  // 🎡 the Vobux Wheel: a rare little jackpot on correct answers (pure upside)
  var WHEEL = [
    { label: "+5", pay: 5, w: 30, c: "#69b7f0" }, { label: "+8", pay: 8, w: 22, c: "#76d275" },
    { label: "+10", pay: 10, w: 16, c: "#ffd23f" }, { label: "+12", pay: 12, w: 10, c: "#f79ad3" },
    { label: "+15", pay: 15, w: 8, c: "#9d8df1" }, { label: "+20", pay: 20, w: 6, c: "#5fd7c9" },
    { label: "+30", pay: 30, w: 5, c: "#ff9f43" }, { label: "💰75", pay: 75, w: 3, c: "#ff6b6b" }
  ];
  function maybeWheel(opts) {
    opts = opts || {};
    var chance = opts.chance == null ? 0.15 : opts.chance;
    if ((testMode() && !opts.force) || Math.random() >= chance) { if (opts.onSkip) opts.onSkip(); return false; }
    // weighted prize pick
    var total = WHEEL.reduce(function (a, s) { return a + s.w; }, 0), roll = Math.random() * total, idx = 0;
    for (var i = 0; i < WHEEL.length; i++) { roll -= WHEEL[i].w; if (roll <= 0) { idx = i; break; } }
    var prize = WHEEL[idx], seg = 360 / WHEEL.length;
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:95;background:rgba(10,16,28,.72);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Trebuchet MS',sans-serif";
    var grad = WHEEL.map(function (s, i) { return s.c + " " + (i * seg) + "deg " + ((i + 1) * seg) + "deg"; }).join(",");
    ov.innerHTML =
      '<div style="color:#ffd23f;font-weight:900;font-size:22px;text-shadow:0 2px 8px #000;margin-bottom:8px">🎡 BONUS SPIN!</div>' +
      '<div style="position:relative;width:250px;height:250px">' +
      '<div id="vwheel" style="width:250px;height:250px;border-radius:50%;border:8px solid #fff;box-shadow:0 8px 30px #000a;background:conic-gradient(' + grad + ')">' +
      WHEEL.map(function (s, i) {
        var a = (i + 0.5) * seg;
        return '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(' + a + 'deg) translateY(-86px) rotate(90deg);font-weight:900;font-size:15px;color:#1c2330;text-shadow:0 1px 0 #fff9">' + s.label + "</div>";
      }).join("") + "</div>" +
      '<div style="position:absolute;left:50%;top:-14px;transform:translateX(-50%);font-size:30px;text-shadow:0 2px 4px #000">🔻</div></div>' +
      '<div id="vwres" style="min-height:44px;margin-top:12px;color:#fff;font-weight:900;font-size:20px"></div>';
    document.body.appendChild(ov);
    var wheel = ov.querySelector("#vwheel");
    // land the chosen segment's center under the pointer (pointer = top = 0deg)
    var final = 5 * 360 + (360 - (idx + 0.5) * seg);
    wheel.style.transition = "transform 3s cubic-bezier(.12,.8,.2,1)";
    requestAnimationFrame(function () { requestAnimationFrame(function () { wheel.style.transform = "rotate(" + final + "deg)"; }); });
    if (global.VobloxSfx) { var tk = 0; var tick = setInterval(function () { global.VobloxSfx.tone && global.VobloxSfx.tone(300 + (tk++ % 5) * 60, 0.03, 0.03); }, 140); setTimeout(function () { clearInterval(tick); }, 2900); }
    var closed = false;
    function finish() {
      if (closed) return; closed = true;
      ov.remove();
      if (opts.onDone) opts.onDone(prize);
    }
    setTimeout(function () {
      if (opts.pay) opts.pay(prize.pay);
      ov.querySelector("#vwres").innerHTML = "🎉 " + prize.label + ' Vobux! <button style="margin-left:10px;padding:8px 20px;border-radius:12px;border:3px solid #0004;border-bottom-width:6px;background:linear-gradient(#9be15d,#4fb944);font-weight:900;font-size:17px;cursor:pointer" id="vwok">COLLECT</button>';
      if (global.VobloxSfx && global.VobloxSfx.fanfare) global.VobloxSfx.fanfare();
      ov.querySelector("#vwok").onclick = finish;
      setTimeout(finish, 4500); // auto-collect so gameplay never stalls
    }, 3150);
    return true;
  }
  // lock answer buttons briefly while the question is read — kills reflex-clicking
  function lockChoices(btns, ms) {
    if (!ms) return;
    Array.prototype.forEach.call(btns, function (b) { b.disabled = true; b.style.opacity = "0.4"; });
    setTimeout(function () { Array.prototype.forEach.call(btns, function (b) { b.disabled = false; b.style.opacity = ""; }); }, ms);
  }
  // parent rescue hatch: 5 quick taps on an overlay title force the exit handler.
  // Nothing in the game may ever hard-lock — this is the last-resort guarantee.
  function rescueTap(el, fn) {
    if (!el) return;
    var n = 0, t = 0;
    el.addEventListener("click", function () {
      var now = Date.now();
      if (now - t > 1300) n = 0;
      t = now; n++;
      if (n >= 5) { n = 0; fn(); }
    });
  }
  // After a miss: a "read it" pause with countdown, then a one-tap echo check on the
  // SAME definition before play continues. Passing pays a small reading reward.
  // Layout contract (the iPhone lesson): the buttons are PINNED at the bottom of a
  // viewport-capped card and the entry text scrolls — exits can never leave the screen.
  function teachGate(container, data, opts, cb) {
    opts = opts || {};
    var secs = opts.seconds != null ? opts.seconds : (testMode() ? 0 : 4);
    var si = Math.min(opts.senseIdx || 0, data.senses.length - 1);
    var def = data.senses[si].def;
    container.style.display = "flex"; container.style.flexDirection = "column"; container.style.minHeight = "0";
    container.style.overflow = "auto"; // NEVER hidden: if pinning can't fit, the card itself scrolls
    container.style.setProperty("-webkit-overflow-scrolling", "touch");
    container.style.overscrollBehavior = "contain";
    container.style.maxHeight = "calc(100vh - 76px)";
    // env()-aware cap so the pinned Hear/Quick-check buttons always clear the home indicator
    // and the head clears the Dynamic Island on iPhone; ignored where unsupported (vh above stays)
    container.style.maxHeight = "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 32px)";
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;min-height:0;flex:1 1 auto";
    container.appendChild(wrap);
    var SCROLLBOX = 'style="flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y"';
    function readStep() {
      // action buttons wrap side-by-side on short screens (landscape phones) so they fit
      wrap.innerHTML = (opts.headHTML || "") +
        '<div class="reveal" ' + SCROLLBOX + ">" + entryHTML(data, { mnem: true }) + "</div>" +
        '<div style="flex:0 0 auto;padding-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="submit" type="button" id="tg_hear" style="flex:1 1 180px;margin:0;background:linear-gradient(#8ecdf7,#3f8fd8)">🔊 Hear the answer (+2 💎)</button>' +
        '<button class="submit big-next" type="button" style="flex:1 1 180px;margin:0" disabled>👀 Read it…</button></div>';
      var heard = false;
      var hearBtn = wrap.querySelector("#tg_hear");
      hearBtn.onclick = function () { // listening pays, once
        var ex = data.senses[si].example || "";
        speak(data.word + ". " + def + ". " + ex);
        if (!heard) { heard = true; if (opts.pay) opts.pay(2); hearBtn.textContent = "🔊 Heard it! +2 💎 (tap to replay)"; }
      };
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
      wrap.innerHTML = '<div style="flex:0 0 auto" class="fb">🔎 Quick check — which word means:<br><b>“' + esc(def) + '”</b></div>' +
        '<div class="choices" ' + SCROLLBOX + ">" + chs.map(function (w) { return '<button class="choice" type="button" data-w="' + esc(w) + '">' + esc(w) + "</button>"; }).join("") + "</div>";
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
  var lastMiniWord = null; // never ask the same word twice in a row, across all games
  // ---- iPhone-16 layout hardening (style/layout only, no logic changes) ----
  // Caps the card to the env() safe viewport so the Dynamic Island / home indicator
  // never clip it, keeps it scrolling INTERNALLY (never clipped in landscape 852×393),
  // and enforces fat-finger-safe touch targets: choices ≥48px, the read-aloud 🔊 and
  // skip ≥44px. A mis-tap here costs a kid his streak, so the minimums are load-bearing.
  function hardenMiniQuiz(container) {
    var card = container.querySelector(".wqcard");
    if (card) {
      card.style.maxHeight = "calc(100vh - 24px)"; // fallback for no-dvh browsers
      card.style.maxHeight = "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px)";
      card.style.overflowY = "auto";
      card.style.setProperty("-webkit-overflow-scrolling", "touch");
      card.style.touchAction = "pan-y";
      card.style.overscrollBehavior = "contain";
    }
    Array.prototype.forEach.call(container.querySelectorAll(".wqc"), function (b) { b.style.minHeight = "48px"; });
    var say = container.querySelector("#wqsay");
    if (say) { say.style.minWidth = "44px"; say.style.minHeight = "44px"; say.style.fontSize = "18px"; say.style.padding = "6px 10px"; say.style.verticalAlign = "middle"; }
    var skip = container.querySelector("#wqskip");
    if (skip) skip.style.minHeight = "44px";
  }
  function miniQuiz(container, words, store, o) {
    o = o || {};
    var Engine = global.VobloxEngine;
    var cards = words.map(function (w) { return store.state.cards[w.word]; }).filter(Boolean);
    var card = (Engine.selectDue && Engine.selectDue(cards, Date.now(), lastMiniWord)) || cards[Math.floor(Math.random() * cards.length)];
    if (card.word === lastMiniWord && cards.length > 1) card = cards.filter(function (c) { return c.word !== lastMiniWord; })[Math.floor(Math.random() * (cards.length - 1))];
    lastMiniWord = card.word;
    var data = words.filter(function (w) { return w.word === card.word; })[0];
    var fmt = Engine.pickFormat(card, data, o.lastFormat || null, MINI_FORMATS);
    var q = gen(card, words, { format: fmt });
    container.innerHTML = '<div class="wqcard"><div class="wqtitle">' + (o.title || "⚡ Word Power!") + '</div>' +
      '<div class="wqprompt">' + q.promptHTML + ' <button class="replay" id="wqsay" type="button">🔊</button></div>' +
      '<div class="wqchoices">' + q.choices.map(function (ch, i) { return '<button class="wqc" data-i="' + i + '">' + esc(ch.label) + "</button>"; }).join("") + "</div>" +
      (o.skippable ? '<button class="wqskip" id="wqskip" type="button">skip (−' + COSTS.skip + ' 💎)</button>' : "") + "</div>";
    container.style.display = "flex";
    hardenMiniQuiz(container);
    readQ(q);
    var born = Date.now();
    var fired = false; // a delayed correct-answer close must not double-fire after a skip
    function done(ok, res) { if (fired) return; fired = true; container.style.display = "none"; container.innerHTML = ""; shush(); if (o.cb) o.cb(ok, res, fmt); }
    var say = container.querySelector("#wqsay"); if (say) say.onclick = function () { readQ(q); };
    var skip = container.querySelector("#wqskip"); if (skip) skip.onclick = function () { chargeVobux(store, COSTS.skip); done(null, null); };
    // last-resort rescue: 5 quick taps on the title always exits (priced like a skip)
    rescueTap(container.querySelector(".wqtitle"), function () { chargeVobux(store, COSTS.skip); done(null, null); });
    lockChoices(container.querySelectorAll(".wqc"), testMode() ? 0 : COSTS.lockMs);
    Array.prototype.forEach.call(container.querySelectorAll(".wqc"), function (b) {
      b.onclick = function () {
        var ok = !!q.choices[parseInt(b.dataset.i, 10)].correct;
        Array.prototype.forEach.call(container.querySelectorAll(".wqc"), function (bb, idx) {
          bb.disabled = true; if (q.choices[idx].correct) bb.classList.add("right"); else if (bb === b) bb.classList.add("wrong");
        });
        var sk2 = container.querySelector("#wqskip"); if (sk2) sk2.remove(); // no skipping out of a wrong answer
        var res = store.record(q, ok);
        if (ok) {
          clearWrongStreak(store);
          if (res && res.streak >= 2 && res.mult > 1) { // show the streak heat
            var st2 = document.createElement("div"); st2.className = "wqtitle"; st2.style.color = "#ff9f43";
            st2.textContent = "🔥 streak " + res.streak + " — ×" + res.mult + " Vobux!";
            container.querySelector(".wqcard").appendChild(st2);
          }
          setTimeout(function () {
            var spun = maybeWheel({ chance: 0.15, pay: function (n) { payVobux(store, n); }, onDone: function () { done(true, res); } });
            if (!spun) done(true, res);
          }, 620);
        }
        else {
          markRushed(store, born);
          var pen = penalizeWrong(store);
          var card2 = container.querySelector(".wqcard");
          if (testMode()) { // harness fast-path: legacy dismiss (the gate has its own spec)
            var teach = document.createElement("div"); teach.className = "wqteach"; teach.innerHTML = entryHTML(q.data, { mnem: true });
            card2.appendChild(teach);
            var btn = document.createElement("button"); btn.className = "wqskip"; btn.type = "button"; btn.textContent = "Got it";
            btn.onclick = function () { done(false, res); };
            card2.appendChild(btn);
          } else {
            // drop the question UI so the gate fits small phones (the entry card
            // repeats the word anyway) — exits must stay on screen
            var pr = card2.querySelector(".wqprompt"); if (pr) pr.remove();
            var ch2 = card2.querySelector(".wqchoices"); if (ch2) ch2.remove();
            teachGate(card2, q.data, {
              words: words, senseIdx: q.senseIdx || 0,
              pay: function (n) { payVobux(store, n); },
              headHTML: '<div class="fb bad" style="flex:0 0 auto">❌ ' + (pen.lost ? "−" + pen.lost + " 💎 " : "") + (pen.streak >= 2 ? "(" + pen.streak + " wrong in a row!) " : "") + "— read the word, then one quick check:</div>"
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
    markRushed: markRushed, COSTS: COSTS,
    penalizeWrong: penalizeWrong, clearWrongStreak: clearWrongStreak, maybeWheel: maybeWheel,
    rescueTap: rescueTap, voiceConfig: voiceConfig
  };
  // stop any speech when the tab/app is hidden (locked screen, app switch, etc.)
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", function () { if (document.hidden) shush(); });
  if (typeof module !== "undefined" && module.exports) module.exports = VQ;
  global.VobloxQuestions = VQ;
})(typeof window !== "undefined" ? window : globalThis);
