/*
 * Voblox — cosmetic item catalog: avatar wear (hats/faces/shirts/pants/trails),
 * pet buddies, and per-game gear. Cosmetic-only by design: power comes from
 * learning words, Vobux come mostly from answering, items are what Vobux buy.
 * Economy: a mastered lesson ≈ 2,500–3,500 Vobux (answers + quests + matches).
 * Commons stay pocket-money cheap; RARE ≈ a good day; EPIC ≈ a whole lesson;
 * LEGENDARY ≈ 3–4 lessons of real saving. That's the point.
 * Item: { id, name, emoji, slot, rarity, price? , unlock?{level | game+rankPts}, color? }
 */
(function (global) {
  function I(id, name, emoji, slot, rarity, price, extra) {
    var o = { id: id, name: name, emoji: emoji, slot: slot, rarity: rarity };
    if (price) o.price = price;
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }

  var ALL = [
    // ---- hats (slot: hat) ----
    I("hat.cap", "Blue Cap", "🧢", "hat", "common", 80),
    I("hat.sun", "Sun Hat", "👒", "hat", "common", 90),
    I("hat.bow", "Big Bow", "🎀", "hat", "common", 80),
    I("hat.flower", "Flower Clip", "🌸", "hat", "common", 90),
    I("hat.rescue", "Rescue Helmet", "⛑️", "hat", "common", 100),
    I("hat.knight", "Knight Helm", "🪖", "hat", "rare", 700),
    I("hat.tophat", "Fancy Top Hat", "🎩", "hat", "rare", 650),
    I("hat.headphones", "DJ Phones", "🎧", "hat", "rare", 680),
    I("hat.mush", "Mushroom Cap", "🍄", "hat", "rare", 750),
    I("hat.pumpkin", "Pumpkin Head", "🎃", "hat", "epic", 2800),
    I("hat.star", "Star Pin", "⭐", "hat", "epic", 3000),
    I("hat.pirate", "Pirate Flag Hat", "🏴‍☠️", "hat", "epic", 2600),
    I("hat.grad", "Scholar Cap", "🎓", "hat", "epic", 0, { unlock: { level: 10 } }),
    I("hat.crown", "Golden Crown", "👑", "hat", "legendary", 9500),

    // ---- faces (slot: face) ----
    I("face.wink", "Winky", "😉", "face", "common", 90),
    I("face.silly", "Silly Tongue", "😜", "face", "common", 100),
    I("face.cool", "Cool Shades", "😎", "face", "rare", 650),
    I("face.cat", "Cat Face", "😺", "face", "rare", 700),
    I("face.party", "Party Time", "🥳", "face", "rare", 750),
    I("face.angel", "Little Angel", "😇", "face", "rare", 750),
    I("face.ghost", "Spooky", "👻", "face", "rare", 800),
    I("face.star", "Star Eyes", "🤩", "face", "epic", 2800),
    I("face.alien", "Alien", "👽", "face", "epic", 3200),
    I("face.robot", "Robo Face", "🤖", "face", "epic", 0, { unlock: { level: 5 } }),

    // ---- shirts (slot: shirt; color drives the torso) ----
    I("shirt.red", "Red Tee", "👕", "shirt", "common", 80, { color: "#e74c3c" }),
    I("shirt.green", "Green Tee", "👕", "shirt", "common", 80, { color: "#2ecc71" }),
    I("shirt.orange", "Orange Tee", "👕", "shirt", "common", 80, { color: "#ff8c42" }),
    I("shirt.white", "White Tee", "👕", "shirt", "common", 80, { color: "#f2f4f8" }),
    I("shirt.pink", "Pink Tee", "👕", "shirt", "common", 90, { color: "#ff7eb9" }),
    I("shirt.purple", "Purple Tee", "👕", "shirt", "rare", 600, { color: "#9b59b6" }),
    I("shirt.black", "Ninja Black", "👕", "shirt", "rare", 650, { color: "#2c3e50" }),
    I("shirt.gold", "Golden Shirt", "👕", "shirt", "legendary", 8500, { color: "#ffb020" }),

    // ---- pants (slot: pants) ----
    I("pants.brown", "Brown Pants", "👖", "pants", "common", 70, { color: "#7a5230" }),
    I("pants.black", "Black Pants", "👖", "pants", "common", 70, { color: "#23272e" }),
    I("pants.red", "Red Pants", "👖", "pants", "common", 70, { color: "#b3392f" }),
    I("pants.green", "Green Pants", "👖", "pants", "common", 70, { color: "#2f7d4f" }),
    I("pants.white", "White Pants", "👖", "pants", "common", 70, { color: "#eef0f4" }),
    I("pants.purple", "Purple Pants", "👖", "pants", "rare", 550, { color: "#6b4fa8" }),
    I("pants.camo", "Camo Pants", "👖", "pants", "rare", 600, { color: "#5b6d4a" }),
    I("pants.gold", "Golden Pants", "👖", "pants", "epic", 2500, { color: "#d8a020" }),

    // ---- trails (slot: trail; games emit these while you move) ----
    I("trail.bubbles", "Bubble Trail", "🫧", "trail", "common", 150, { color: "#9fd6ff" }),
    I("trail.hearts", "Heart Trail", "💖", "trail", "rare", 700, { color: "#ff7eb9" }),
    I("trail.snow", "Snow Trail", "❄️", "trail", "rare", 700, { color: "#cfe8ff" }),
    I("trail.sparkle", "Sparkle Trail", "✨", "trail", "rare", 800, { color: "#ffe14d" }),
    I("trail.stars", "Star Trail", "⭐", "trail", "rare", 800, { color: "#ffd740" }),
    I("trail.fire", "Fire Trail", "🔥", "trail", "epic", 2600, { color: "#ff7a3d" }),
    I("trail.zap", "Lightning Trail", "⚡", "trail", "epic", 3000, { color: "#ffe14d" }),
    I("trail.rainbow", "Rainbow Trail", "🌈", "trail", "epic", 3500, { color: "#b06dff" }),

    // ---- pet buddies (slot: pet; cosmetic follower shown in arcade games) ----
    I("pet.bird", "Birdy", "🐦", "pet", "common", 200),
    I("pet.turtle", "Sheldon", "🐢", "pet", "common", 220),
    I("pet.bunny", "Hoppy", "🐰", "pet", "rare", 900),
    I("pet.dog", "Buddy", "🐶", "pet", "rare", 950),
    I("pet.cat", "Whiskers", "🐱", "pet", "rare", 950),
    I("pet.fox", "Foxy", "🦊", "pet", "epic", 2800),
    I("pet.panda", "Bamboo", "🐼", "pet", "epic", 3000),
    I("pet.trex", "Rexy", "🦖", "pet", "epic", 3200),
    I("pet.dragon", "Ember", "🐉", "pet", "legendary", 10000),
    I("pet.unicorn", "Sparkle", "🦄", "pet", "legendary", 10000),

    // ---- per-game gear (slot: gear.<gameId>) ----
    I("gear.pickle.wood", "Wood Paddle", "🏓", "gear.pickle", "common", 100),
    I("gear.pickle.pro", "Pro Paddle", "🏓", "gear.pickle", "rare", 700),
    I("gear.pickle.gold", "Golden Paddle", "🏓", "gear.pickle", "epic", 0, { unlock: { game: "pickle", rankPts: 100 } }),
    I("gear.fishing.rod", "Bamboo Rod", "🎣", "gear.fishing", "common", 100),
    I("gear.fishing.zap", "Zap Rod", "🎣", "gear.fishing", "rare", 800),
    I("gear.fishing.star", "Star Rod", "🎣", "gear.fishing", "epic", 0, { unlock: { game: "fishing", rankPts: 100 } }),
    I("gear.soccer.boots", "Speed Boots", "👟", "gear.soccer", "rare", 700),
    I("gear.soccer.gold", "Golden Ball", "⚽", "gear.soccer", "epic", 0, { unlock: { game: "soccer", rankPts: 100 } }),
    I("gear.karts.horn", "Duck Horn", "🦆", "gear.karts", "common", 150),
    I("gear.karts.flame", "Flame Kart", "🏎️", "gear.karts", "rare", 0, { unlock: { game: "karts", rankPts: 50 } }),
    I("gear.karts.gold", "Gold Kart", "🏎️", "gear.karts", "epic", 3000),
    I("gear.obby.wings", "Cloud Wings", "🪽", "gear.obby", "epic", 2800),
    I("gear.chess.candy", "Candy Pieces", "🍬", "gear.chess", "rare", 700),
    I("gear.chess.blocky", "Blocky Pieces", "🟩", "gear.chess", "rare", 700),
    I("gear.chess.neon", "Neon Board", "🌌", "gear.chess", "epic", 2500),
    I("gear.bjj.blue", "Blue Gi", "🥋", "gear.bjj", "rare", 700),
    I("gear.bjj.black", "Black Gi", "🥋", "gear.bjj", "epic", 0, { unlock: { game: "bjj", rankPts: 100 } }),
    I("gear.chef.apron", "Flame Apron", "🍳", "gear.chef", "rare", 650),
    I("gear.chef.gold", "Golden Spatula", "🏆", "gear.chef", "epic", 0, { unlock: { game: "chef", rankPts: 100 } }),
    I("gear.towerd.candy", "Candy Towers", "🍭", "gear.towerd", "rare", 700),
    I("gear.towerd.space", "Space Towers", "🛸", "gear.towerd", "epic", 2500),

    // ---- EXPANSION PACK: more to collect, topped by 🌈 MYTHIC (the ultimate chase) ----
    // hats
    I("hat.wizard", "Wizard Hat", "🧙", "hat", "rare", 700),
    I("hat.cowboy", "Cowboy Hat", "🤠", "hat", "rare", 680),
    I("hat.santa", "Santa Hat", "🎅", "hat", "rare", 720),
    I("hat.beanie", "Cozy Beanie", "🧶", "hat", "common", 90),
    I("hat.party", "Party Hat", "🎉", "hat", "common", 100),
    I("hat.jester", "Jester Hat", "🃏", "hat", "epic", 2700),
    I("hat.galaxy", "Galaxy Crown", "🌌", "hat", "mythic", 25000),
    // faces
    I("face.nerd", "Smarty Specs", "🤓", "face", "common", 100),
    I("face.money", "Money Eyes", "🤑", "face", "rare", 700),
    I("face.zombie", "Zombie Face", "🧟", "face", "rare", 780),
    I("face.clown", "Clown Face", "🤡", "face", "rare", 760),
    I("face.melt", "Melting", "🫠", "face", "epic", 2900),
    I("face.dragon", "Dragon Face", "🐲", "face", "mythic", 25000),
    // shirts (color drives the torso)
    I("shirt.teal", "Teal Tee", "👕", "shirt", "common", 80, { color: "#17a2b8" }),
    I("shirt.navy", "Navy Tee", "👕", "shirt", "common", 80, { color: "#2c3e6b" }),
    I("shirt.lime", "Lime Tee", "👕", "shirt", "common", 90, { color: "#9bd644" }),
    I("shirt.magenta", "Magenta Tee", "👕", "shirt", "rare", 620, { color: "#d6249b" }),
    I("shirt.rainbow", "Rainbow Jersey", "👕", "shirt", "epic", 3200, { color: "#b06dff" }),
    I("shirt.galaxy", "Galaxy Robe", "👕", "shirt", "mythic", 25000, { color: "#3a2b7a" }),
    // pants
    I("pants.teal", "Teal Pants", "👖", "pants", "common", 70, { color: "#178a9c" }),
    I("pants.navy", "Navy Pants", "👖", "pants", "common", 70, { color: "#26314f" }),
    I("pants.pink", "Pink Pants", "👖", "pants", "common", 80, { color: "#e06aa0" }),
    I("pants.silver", "Silver Pants", "👖", "pants", "rare", 600, { color: "#aeb6c2" }),
    I("pants.rainbow", "Rainbow Pants", "👖", "pants", "epic", 2600, { color: "#8a5ad0" }),
    // trails
    I("trail.music", "Music Trail", "🎵", "trail", "common", 160, { color: "#7ec8ff" }),
    I("trail.leaf", "Leaf Trail", "🍃", "trail", "rare", 700, { color: "#7bd66a" }),
    I("trail.candy", "Candy Trail", "🍬", "trail", "rare", 720, { color: "#ff9ecb" }),
    I("trail.coins", "Coin Trail", "🪙", "trail", "epic", 2700, { color: "#ffd23f" }),
    I("trail.galaxy", "Galaxy Trail", "🌌", "trail", "mythic", 25000, { color: "#a06bff" }),
    // pets
    I("pet.penguin", "Waddles", "🐧", "pet", "common", 220),
    I("pet.owl", "Hoot", "🦉", "pet", "rare", 900),
    I("pet.lion", "Leo the Lion", "🦁", "pet", "rare", 980),
    I("pet.monkey", "Coco", "🐵", "pet", "rare", 900),
    I("pet.koala", "Eucalyptus", "🐨", "pet", "epic", 2900),
    I("pet.axolotl", "Axel", "🦎", "pet", "epic", 3100),
    I("pet.wolf", "Shadow", "🐺", "pet", "legendary", 10000),
    I("pet.whale", "Star Whale", "🐋", "pet", "mythic", 26000)
  ];

  var byId = {}; ALL.forEach(function (it) { byId[it.id] = it; });
  var RARITY = {
    common: { w: 61.5, color: "#9aa7b0", label: "Common" },
    rare: { w: 26, color: "#4aa3ff", label: "Rare" },
    epic: { w: 10, color: "#b06dff", label: "Epic" },
    legendary: { w: 2, color: "#ffb020", label: "LEGENDARY" },
    mythic: { w: 0.5, color: "#ff4db8", label: "MYTHIC" }
  };
  var RARITY_ORDER = ["mythic", "legendary", "epic", "rare", "common"]; // rarest → most common

  // Can this item be obtained right now? -> { ok, why } (why explains the lock)
  function canGet(item, state) {
    if ((state.inventory || []).indexOf(item.id) !== -1) return { ok: false, why: "owned" };
    if (item.unlock) {
      if (item.unlock.level) {
        if ((state.level || 1) >= item.unlock.level) return { ok: true, why: "" };
        return { ok: false, why: "Reach level " + item.unlock.level };
      }
      if (item.unlock.game) {
        var P = global.VobloxProfile;
        var pts = ((state.gameStats || {})[item.unlock.game] || {}).rankPts || 0;
        if (pts >= item.unlock.rankPts) return { ok: true, why: "" };
        var rk = P ? P.gameRank(item.unlock.rankPts).name : item.unlock.rankPts + " pts";
        return { ok: false, why: "Reach " + rk + " in that game" };
      }
    }
    if ((state.gems || 0) >= (item.price || 0)) return { ok: true, why: "" };
    return { ok: false, why: (item.price || 0) + " Vobux needed" };
  }

  // 6 featured items, seeded by the date — the same shop on every device, all day.
  function shopToday(dayKeyStr) {
    var P = global.VobloxProfile;
    var rand = P ? P.rng(P.hashStr("shop:" + dayKeyStr)) : Math.random;
    var priced = ALL.filter(function (it) { return it.price; });
    function pickBy(rarities, n, taken) {
      var pool = priced.filter(function (it) { return rarities.indexOf(it.rarity) !== -1 && taken.indexOf(it) === -1; });
      var out = [];
      for (var i = 0; i < n && pool.length; i++) { var k = Math.floor(rand() * pool.length); out.push(pool[k]); pool.splice(k, 1); }
      return out;
    }
    var taken = [];
    taken = taken.concat(pickBy(["common"], 3, taken));
    taken = taken.concat(pickBy(["rare"], 2, taken));
    taken = taken.concat(pickBy(rand() < 0.12 ? ["legendary"] : ["epic"], 1, taken));
    return taken;
  }

  // Default drop table (the free 🪵 Wooden chest). Tiered chests pass their own.
  // Each entry is [rarity, weight]; weights need not sum to 100.
  var WOODEN_ODDS = [["mythic", 0.5], ["legendary", 2], ["epic", 10], ["rare", 26], ["common", 61.5]];

  // Reward-chest roll: rarity-weighted, skews HARD to items you don't own yet.
  // `odds` is an optional [rarity, weight] table (defaults to the Wooden chest).
  // Returns { item, dupe } — dupes pay out Vobux instead (caller handles).
  function rollChest(rand, state, odds) {
    rand = rand || Math.random;
    odds = odds || WOODEN_ODDS;
    var total = odds.reduce(function (s, o) { return s + o[1]; }, 0);
    var roll = rand() * total, acc = 0, rarity = odds[odds.length - 1][0];
    for (var i = 0; i < odds.length; i++) { acc += odds[i][1]; if (roll < acc) { rarity = odds[i][0]; break; } }
    var owned = (state && state.inventory) || [];
    function poolFor(rar) { return ALL.filter(function (it) { return it.rarity === rar && !it.unlock; }); }
    // fall DOWN the ladder if a rarity has no chest-eligible items (robustness)
    var pool = poolFor(rarity), gi = RARITY_ORDER.indexOf(rarity);
    while (!pool.length && gi < RARITY_ORDER.length - 1) { gi++; pool = poolFor(RARITY_ORDER[gi]); }
    if (!pool.length) pool = ALL.filter(function (it) { return !it.unlock; });
    var fresh = pool.filter(function (it) { return owned.indexOf(it.id) === -1; });
    var arr = fresh.length ? fresh : pool;
    var pick = arr[Math.floor(rand() * arr.length)];
    return { item: pick, dupe: owned.indexOf(pick.id) !== -1 };
  }

  global.VobloxItems = { ALL: ALL, byId: byId, RARITY: RARITY, RARITY_ORDER: RARITY_ORDER, WOODEN_ODDS: WOODEN_ODDS, canGet: canGet, shopToday: shopToday, rollChest: rollChest };
})(typeof window !== "undefined" ? window : globalThis);
