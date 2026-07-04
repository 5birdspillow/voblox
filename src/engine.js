/*
 * Voblox — learning engine (the "brain")
 * --------------------------------------
 * A lightweight Leitner spaced-repetition system + mastery scoring.
 * Pure logic, no DOM — so it can be unit-tested in Node and reused by the
 * 2D MVP today and the 3D world later.
 *
 * Evidence base baked in here:
 *   - Spaced repetition (Leitner boxes, expanding intervals)
 *   - Desirable difficulty (question format escalates with the box)
 *   - Mastery criterion (a word is "quiz-ready" only after correct recall
 *     in 2+ different formats)
 */
(function (global) {
  // Question formats, grouped by difficulty tier (recognition -> recall -> production).
  const FORMATS = {
    WORD2DEF: "word2def",       // see word, choose its meaning (recognition)
    CLOZE_MC: "cloze_mc",       // fill the blank, multiple choice (recognition)
    AUDIO_PICK: "audio_pick",   // hear it, choose the word (recognition)
    DEF2WORD_MC: "def2word_mc", // see meaning, choose the word (recognition+)
    SYNONYM: "synonym",         // choose the synonym (recognition+)
    ANTONYM: "antonym",         // choose the opposite (recognition+)
    CLOZE_TYPE: "cloze_type",   // fill the blank, TYPE it (recall)
    DEF2WORD_TYPE: "def2word_type", // see meaning, TYPE the word (recall)
    AUDIO_SPELL: "audio_spell"  // hear it, SPELL it (production + spelling)
  };

  // Which formats are allowed at each Leitner box. Higher box = harder recall.
  // NOTE: spelling is deliberately NOT part of mastery — the school quiz tests
  // MEANING. Typed formats accept close spellings (see checkText), and the
  // hear-it-spell-it format lives only in the opt-in Spell Quest game.
  const TIERS = {
    0: [FORMATS.WORD2DEF, FORMATS.CLOZE_MC, FORMATS.AUDIO_PICK],
    1: [FORMATS.DEF2WORD_MC, FORMATS.SYNONYM, FORMATS.ANTONYM],
    2: [FORMATS.CLOZE_TYPE],
    3: [FORMATS.DEF2WORD_TYPE],
    4: [FORMATS.DEF2WORD_TYPE, FORMATS.CLOZE_TYPE],
    5: [FORMATS.CLOZE_TYPE, FORMATS.DEF2WORD_TYPE]
  };

  // Real-time intervals per box. Tuned for Leo's ACTUAL school cadence: words arrive
  // Monday, quiz is Tuesday — so the whole ladder (including the typed/production
  // tiers at boxes 2-4) must be climbable in ONE day across 2-3 short sessions.
  // Old day-scale intervals stranded words at box 2 until after the quiz.
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const INTERVALS_MS = [1 * MIN, 8 * MIN, 25 * MIN, 90 * MIN, 4 * HOUR, 1 * DAY];

  const MAX_BOX = 5;

  function createCard(word) {
    return {
      word: word,
      box: 0,
      due: 0,                 // ms timestamp when this word is next due (real-time mode)
      attempts: 0,
      corrects: 0,
      correctStreak: 0,
      lastCorrect: false,
      correctFormats: {},     // set of formats answered correctly at least once
      seenFormats: {}         // set of formats shown at least once
    };
  }

  function nextDue(box, now) {
    return now + INTERVALS_MS[Math.min(box, MAX_BOX)];
  }

  // Record one answer. Mutates + returns the card.
  function grade(card, format, correct, now) {
    now = now || 0;
    card.attempts += 1;
    card.seenFormats[format] = true;
    card.lastCorrect = !!correct;
    if (correct) {
      card.corrects += 1;
      card.correctStreak += 1;
      card.correctFormats[format] = true;
      card.box = Math.min(card.box + 1, MAX_BOX);
    } else {
      card.correctStreak = 0;
      card.box = 0; // missed words go back to the start of the line
    }
    card.due = nextDue(card.box, now);
    return card;
  }

  // A word counts as ready for tomorrow's quiz once Leo has recalled it correctly
  // in at least two different formats AND got it right the last time he saw it.
  function isQuizReady(card) {
    return Object.keys(card.correctFormats).length >= 2 && card.lastCorrect === true;
  }

  // Long-term mastery (for retention across lessons).
  function isMastered(card) {
    return card.box >= 4;
  }

  // Predicted quiz score = share of lesson words that are quiz-ready, 0..100.
  function predictedScore(cards) {
    if (!cards.length) return 0;
    const ready = cards.filter(isQuizReady).length;
    return Math.round((100 * ready) / cards.length);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Choose a question format for this card, respecting the box tier and the data
  // available on the word (e.g. skip ANTONYM if the word has no antonyms). Tries
  // not to repeat the exact format shown last time.
  // `allowed` (optional) restricts to a fixed set of formats — used by contexts
  // where the target word is already known (e.g. chest gates), so we only ask
  // meaning-testing questions and skip ones whose answer is the word itself.
  function pickFormat(card, wordData, lastFormat, allowed) {
    let options;
    if (allowed && allowed.length) {
      options = allowed.filter((f) => hasDataFor(f, wordData));
    } else {
      const tier = TIERS[Math.min(card.box, MAX_BOX)] || TIERS[0];
      options = tier.filter((f) => hasDataFor(f, wordData));
    }
    if (!options.length) options = Object.values(FORMATS).filter((f) => hasDataFor(f, wordData));
    const fresh = options.filter((f) => f !== lastFormat);
    const pool = fresh.length ? fresh : options;
    return pick(pool);
  }

  function hasDataFor(format, w) {
    switch (format) {
      case FORMATS.SYNONYM: return !!(w.synonyms && w.synonyms.length);
      case FORMATS.ANTONYM: return !!(w.antonyms && w.antonyms.length);
      case FORMATS.CLOZE_MC:
      case FORMATS.CLOZE_TYPE:
        return !!(w.senses && w.senses.some(function (s) { return !!s.example; }));
      default: return true;
    }
  }

  // Real-time selection for Adventure mode: the most-overdue word, avoiding an
  // immediate repeat. (Practice/Crunch mode uses its own spacing queue in app.js.)
  function selectDue(cards, now, avoidWord) {
    const sorted = cards
      .filter((c) => c.word !== avoidWord)
      .sort((a, b) => (a.due - b.due) || (a.box - b.box));
    return sorted[0] || cards[0];
  }

  const Engine = {
    FORMATS, TIERS, INTERVALS_MS, MAX_BOX,
    createCard, nextDue, grade, isQuizReady, isMastered,
    predictedScore, pickFormat, hasDataFor, selectDue
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  global.VobloxEngine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
