/*
 * Voblox — mini-game registry. A game appears as a world portal + menu entry only
 * if its module is loaded, so adding a new game = load its script + one add() line.
 */
(function (global) {
  var games = [];
  function add(modName, def) {
    if (global[modName] && global[modName].start) { def.start = function (o) { return global[modName].start(o); }; games.push(def); }
  }
  add("VobloxQuizShow", { id: "quiz", name: "Quiz Show", emoji: "📺", color: 0xffc233 });
  add("VobloxMemory", { id: "memory", name: "Memory Match", emoji: "🃏", color: 0x9b6dff });
  add("VobloxHunt", { id: "hunt", name: "Word Hunt", emoji: "🦌", color: 0x9a6a32 });
  add("VobloxRun", { id: "run", name: "Word Run", emoji: "🏃", color: 0x5fd35f });
  add("VobloxWhack", { id: "whack", name: "Whack-a-Word", emoji: "🔨", color: 0xff7a3d });
  add("VobloxHoops", { id: "hoops", name: "Word Hoops", emoji: "🏀", color: 0xff9933 });
  add("VobloxSnake", { id: "snake", name: "Word Snake", emoji: "🐍", color: 0x3fbf6f });
  add("VobloxSpell", { id: "spell", name: "Spell Quest", emoji: "🔤", color: 0x33b5e5 });
  global.VobloxGames = games;
})(typeof window !== "undefined" ? window : globalThis);
