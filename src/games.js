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
  global.VobloxGames = games;
})(typeof window !== "undefined" ? window : globalThis);
