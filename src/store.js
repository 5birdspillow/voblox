/*
 * Voblox — shared progress store + gamification (multi-lesson).
 * One save (SAME key/shape as before) holds cards for ALL words across lessons.
 */
(function (global) {
  var Engine = global.VobloxEngine;
  var SAVE_KEY = "voblox.save.v1";

  var RANKS = [
    { name: "Pawn", icon: "♟", at: 0 }, { name: "Knight", icon: "♞", at: 15 },
    { name: "Bishop", icon: "♝", at: 35 }, { name: "Rook", icon: "♜", at: 70 },
    { name: "Queen", icon: "♛", at: 120 }, { name: "Grandmaster", icon: "👑", at: 200 }
  ];
  var LOOT = ["🗡️", "🛡️", "💎", "🐉", "🐺", "🐱", "🎩", "👑", "🧱", "🌳", "⚡", "🔥", "🍄", "🏰", "🚀", "🦖"];

  function freshState(words) {
    var cards = {};
    words.forEach(function (w) { cards[w.word] = Engine.createCard(w.word); });
    return { cards: cards, gems: 0, totalCorrect: 0, bestCombo: 0, combo: 0, collection: [], lastPlayed: 0, playDays: [] };
  }
  function load() {
    try { var raw = global.localStorage.getItem(SAVE_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return null;
  }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }

  function Store(allWords) {
    this.allWords = allWords;
    this.state = load() || freshState(allWords);
    if (!this.state.playDays) this.state.playDays = [];
    this.ensureCards();
  }
  Store.prototype.ensureCards = function () {
    var s = this.state;
    this.allWords.forEach(function (w) { if (!s.cards[w.word]) s.cards[w.word] = Engine.createCard(w.word); });
  };
  Store.prototype.save = function () {
    var now = Date.now();
    this.state.lastPlayed = now;
    var dk = dayKey(now);
    if (this.state.playDays.indexOf(dk) === -1) this.state.playDays.push(dk);
    try { global.localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch (e) {}
  };
  Store.prototype.reset = function () { this.state = freshState(this.allWords); this.save(); };

  Store.prototype.cardsFor = function (words) {
    var s = this.state;
    return words.map(function (w) { return s.cards[w.word]; });
  };
  Store.prototype.predicted = function (words) { return Engine.predictedScore(this.cardsFor(words)); };
  Store.prototype.readyCount = function (words) { return this.cardsFor(words).filter(Engine.isQuizReady).length; };
  Store.prototype.atRisk = function (words) {
    var s = this.state;
    return words.filter(function (w) { return !Engine.isQuizReady(s.cards[w.word]); }).map(function (w) { return w.word; });
  };
  // Cards due for review (across any given word list), soonest first. New cards count as due.
  Store.prototype.dueCards = function (words, now) {
    var s = this.state;
    return words.filter(function (w) { var c = s.cards[w.word]; return (c.attempts > 0) && c.due <= now; })
      .sort(function (a, b) { return s.cards[a.word].due - s.cards[b.word].due; });
  };
  Store.prototype.rank = function () { var r = RANKS[0], n = this.state.totalCorrect; RANKS.forEach(function (x) { if (n >= x.at) r = x; }); return r; };

  // streak of consecutive days played, counting back from today
  Store.prototype.streak = function () {
    var days = (this.state.playDays || []).slice();
    if (!days.length) return 0;
    var set = {}; days.forEach(function (d) { set[d] = true; });
    var n = 0, cur = new Date();
    for (var i = 0; i < 400; i++) {
      var k = cur.getFullYear() + "-" + (cur.getMonth() + 1) + "-" + cur.getDate();
      if (set[k]) { n++; cur.setDate(cur.getDate() - 1); } else break;
    }
    return n;
  };

  // record a graded answer; returns { earned, loot }
  Store.prototype.record = function (q, correct) {
    var s = this.state;
    Engine.grade(s.cards[q.word], q.format, correct, Date.now());
    var earned = 0, loot = null;
    if (correct) {
      s.combo += 1; if (s.combo > s.bestCombo) s.bestCombo = s.combo;
      s.totalCorrect += 1;
      var base = q.kind === "text" ? (q.format === "audio_spell" ? 25 : 20) : 10;
      earned = base + Math.min(Math.max(s.combo - 1, 0) * 2, 20);
      s.gems += earned;
      if (s.totalCorrect % 5 === 0) { loot = LOOT[Math.floor(Math.random() * LOOT.length)]; s.collection.push(loot); }
    } else { s.combo = 0; }
    this.save();
    return { earned: earned, loot: loot };
  };

  var API = { Store: Store, RANKS: RANKS, LOOT: LOOT, SAVE_KEY: SAVE_KEY, freshState: freshState };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.VobloxStore = API;
})(typeof window !== "undefined" ? window : globalThis);
