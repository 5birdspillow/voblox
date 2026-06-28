/*
 * Voblox — shared progress store + gamification.
 * Uses the SAME save key and shape as the 2D study game, so progress is shared.
 */
(function (global) {
  var Engine = global.VobloxEngine;
  var SAVE_KEY = "voblox.save.v1";

  var RANKS = [
    { name: "Pawn", icon: "♟", at: 0 },
    { name: "Knight", icon: "♞", at: 15 },
    { name: "Bishop", icon: "♝", at: 35 },
    { name: "Rook", icon: "♜", at: 70 },
    { name: "Queen", icon: "♛", at: 120 },
    { name: "Grandmaster", icon: "👑", at: 200 }
  ];
  var LOOT = ["🗡️", "🛡️", "💎", "🐉", "🐺", "🐱", "🎩", "👑", "🧱", "🌳", "⚡", "🔥", "🍄", "🏰", "🚀", "🦖"];

  function freshState(words) {
    var cards = {};
    words.forEach(function (w) { cards[w.word] = Engine.createCard(w.word); });
    return { cards: cards, gems: 0, totalCorrect: 0, bestCombo: 0, combo: 0, collection: [], lastPlayed: 0 };
  }
  function load() {
    try { var raw = global.localStorage.getItem(SAVE_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return null;
  }

  function Store(words) {
    this.words = words;
    this.state = load() || freshState(words);
    this.ensureCards();
  }
  Store.prototype.ensureCards = function () {
    var s = this.state;
    this.words.forEach(function (w) { if (!s.cards[w.word]) s.cards[w.word] = Engine.createCard(w.word); });
  };
  Store.prototype.save = function () {
    this.state.lastPlayed = Date.now();
    try { global.localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch (e) {}
  };
  Store.prototype.reset = function () { this.state = freshState(this.words); this.save(); };
  Store.prototype.cardList = function () {
    var s = this.state;
    return this.words.map(function (w) { return s.cards[w.word]; });
  };
  Store.prototype.predicted = function () { return Engine.predictedScore(this.cardList()); };
  Store.prototype.rank = function () { var r = RANKS[0]; var n = this.state.totalCorrect; RANKS.forEach(function (x) { if (n >= x.at) r = x; }); return r; };

  // record a graded answer; returns { earned, loot }
  Store.prototype.record = function (q, correct) {
    var s = this.state;
    Engine.grade(s.cards[q.word], q.format, correct, Date.now());
    var earned = 0, loot = null;
    if (correct) {
      s.combo += 1;
      if (s.combo > s.bestCombo) s.bestCombo = s.combo;
      s.totalCorrect += 1;
      var base = q.kind === "text" ? (q.format === "audio_spell" ? 25 : 20) : 10;
      var bonus = Math.min(Math.max(s.combo - 1, 0) * 2, 20);
      earned = base + bonus;
      s.gems += earned;
      if (s.totalCorrect % 5 === 0) { loot = LOOT[Math.floor(Math.random() * LOOT.length)]; s.collection.push(loot); }
    } else {
      s.combo = 0;
    }
    this.save();
    return { earned: earned, loot: loot };
  };

  var API = { Store: Store, RANKS: RANKS, LOOT: LOOT, SAVE_KEY: SAVE_KEY, freshState: freshState };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.VobloxStore = API;
})(typeof window !== "undefined" ? window : globalThis);
