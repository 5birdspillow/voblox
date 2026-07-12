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
  // arcade games (hub: true → launched from the 🕹️ Arcade, no island portal)
  add("VobloxPickle", { id: "pickle", name: "Pickleball Blitz", emoji: "🏓", color: 0x69f0ae, hub: true });
  add("VobloxFishing", { id: "fishing", name: "Fishing Frenzy", emoji: "🎣", color: 0x40c4ff, hub: true });
  add("VobloxSoccer", { id: "soccer", name: "Soccer Strikers", emoji: "⚽", color: 0x2f9e44, hub: true });
  add("VobloxKarts", { id: "karts", name: "Turbo Karts", emoji: "🏎️", color: 0xe8590c, hub: true });
  add("VobloxObby", { id: "obby", name: "Sky Obby", emoji: "🧗", color: 0x8ecbff, hub: true });
  add("VobloxTowerD", { id: "towerd", name: "Word Tower Defense", emoji: "🗼", color: 0x9b6dff, hub: true });
  add("VobloxChess", { id: "chess", name: "Chess Club", emoji: "♟️", color: 0xb58863, hub: true });
  add("VobloxBJJ", { id: "bjj", name: "BJJ Dojo", emoji: "🥋", color: 0x4a8ac0, hub: true });
  add("VobloxChef", { id: "chef", name: "Chef Rush", emoji: "👨‍🍳", color: 0xf0a92e, hub: true });
  add("VobloxPets", { id: "pets", name: "Pet Paradise", emoji: "🐾", color: 0xff7eb9, hub: true });
  add("VobloxEmpire", { id: "empire", name: "Word Empire", emoji: "🏰", color: 0x8a6ad0, hub: true });
  add("VobloxBooks", { id: "books", name: "Books vs Zombies", emoji: "📚", color: 0x6a8ad0, hub: true });
  add("VobloxMerge", { id: "merge", name: "Merge Forge", emoji: "🔷", color: 0xffb300, hub: true });
  add("VobloxDash", { id: "dash", name: "Word Dash", emoji: "⚡", color: 0x40e0d0, hub: true });
  add("VobloxDungeon", { id: "dungeon", name: "Word Dungeon", emoji: "🗡️", color: 0x8a4a9c, hub: true });
  add("VobloxClash", { id: "clash", name: "Card Clash", emoji: "👑", color: 0xd04a6a, hub: true });
  add("VobloxPark", { id: "park", name: "Word Park", emoji: "🎢", color: 0x50b06a, hub: true });
  add("VobloxSlice", { id: "slice", name: "Ninja Slice", emoji: "🥷", color: 0x2c3e50, hub: true });
  add("VobloxBlaster", { id: "blaster", name: "Star Blaster", emoji: "🚀", color: 0x5a3ad0, hub: true });
  add("VobloxBeat", { id: "beat", name: "Beat Bounce", emoji: "🎵", color: 0xd6249b, hub: true });
  global.VobloxGames = games;
})(typeof window !== "undefined" ? window : globalThis);
