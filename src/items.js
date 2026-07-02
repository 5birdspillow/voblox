/*
 * Voblox — cosmetic item catalog: avatar wear (hats/faces/shirts/pants/trails),
 * pet buddies, and per-game gear. Cosmetic-only by design: power comes from
 * learning words, gems come mostly from answering, items are what gems buy.
 * Prices vs the economy: answers pay 10–45 gems, so common ≈ a few minutes of
 * words and legendary ≈ a great week.
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
    I("hat.knight", "Knight Helm", "🪖", "hat", "rare", 300),
    I("hat.tophat", "Fancy Top Hat", "🎩", "hat", "rare", 260),
    I("hat.headphones", "DJ Phones", "🎧", "hat", "rare", 280),
    I("hat.mush", "Mushroom Cap", "🍄", "hat", "rare", 320),
    I("hat.pumpkin", "Pumpkin Head", "🎃", "hat", "epic", 650),
    I("hat.star", "Star Pin", "⭐", "hat", "epic", 700),
    I("hat.pirate", "Pirate Flag Hat", "🏴‍☠️", "hat", "epic", 600),
    I("hat.grad", "Scholar Cap", "🎓", "hat", "epic", 0, { unlock: { level: 10 } }),
    I("hat.crown", "Golden Crown", "👑", "hat", "legendary", 1500),

    // ---- faces (slot: face) ----
    I("face.wink", "Winky", "😉", "face", "common", 90),
    I("face.silly", "Silly Tongue", "😜", "face", "common", 100),
    I("face.cool", "Cool Shades", "😎", "face", "rare", 250),
    I("face.cat", "Cat Face", "😺", "face", "rare", 280),
    I("face.party", "Party Time", "🥳", "face", "rare", 300),
    I("face.angel", "Little Angel", "😇", "face", "rare", 300),
    I("face.ghost", "Spooky", "👻", "face", "rare", 320),
    I("face.star", "Star Eyes", "🤩", "face", "epic", 600),
    I("face.alien", "Alien", "👽", "face", "epic", 700),
    I("face.robot", "Robo Face", "🤖", "face", "epic", 0, { unlock: { level: 5 } }),

    // ---- shirts (slot: shirt; color drives the torso) ----
    I("shirt.red", "Red Tee", "👕", "shirt", "common", 80, { color: "#e74c3c" }),
    I("shirt.green", "Green Tee", "👕", "shirt", "common", 80, { color: "#2ecc71" }),
    I("shirt.orange", "Orange Tee", "👕", "shirt", "common", 80, { color: "#ff8c42" }),
    I("shirt.white", "White Tee", "👕", "shirt", "common", 80, { color: "#f2f4f8" }),
    I("shirt.pink", "Pink Tee", "👕", "shirt", "common", 90, { color: "#ff7eb9" }),
    I("shirt.purple", "Purple Tee", "👕", "shirt", "rare", 250, { color: "#9b59b6" }),
    I("shirt.black", "Ninja Black", "👕", "shirt", "rare", 250, { color: "#2c3e50" }),
    I("shirt.gold", "Golden Shirt", "👕", "shirt", "legendary", 1500, { color: "#ffb020" }),

    // ---- pants (slot: pants) ----
    I("pants.brown", "Brown Pants", "👖", "pants", "common", 70, { color: "#7a5230" }),
    I("pants.black", "Black Pants", "👖", "pants", "common", 70, { color: "#23272e" }),
    I("pants.red", "Red Pants", "👖", "pants", "common", 70, { color: "#b3392f" }),
    I("pants.green", "Green Pants", "👖", "pants", "common", 70, { color: "#2f7d4f" }),
    I("pants.white", "White Pants", "👖", "pants", "common", 70, { color: "#eef0f4" }),
    I("pants.purple", "Purple Pants", "👖", "pants", "rare", 220, { color: "#6b4fa8" }),
    I("pants.camo", "Camo Pants", "👖", "pants", "rare", 240, { color: "#5b6d4a" }),
    I("pants.gold", "Golden Pants", "👖", "pants", "epic", 600, { color: "#d8a020" }),

    // ---- trails (slot: trail; games emit these while you move) ----
    I("trail.bubbles", "Bubble Trail", "🫧", "trail", "common", 150, { color: "#9fd6ff" }),
    I("trail.hearts", "Heart Trail", "💖", "trail", "rare", 300, { color: "#ff7eb9" }),
    I("trail.snow", "Snow Trail", "❄️", "trail", "rare", 300, { color: "#cfe8ff" }),
    I("trail.sparkle", "Sparkle Trail", "✨", "trail", "rare", 350, { color: "#ffe14d" }),
    I("trail.stars", "Star Trail", "⭐", "trail", "rare", 350, { color: "#ffd740" }),
    I("trail.fire", "Fire Trail", "🔥", "trail", "epic", 600, { color: "#ff7a3d" }),
    I("trail.zap", "Lightning Trail", "⚡", "trail", "epic", 700, { color: "#ffe14d" }),
    I("trail.rainbow", "Rainbow Trail", "🌈", "trail", "epic", 800, { color: "#b06dff" }),

    // ---- pet buddies (slot: pet; cosmetic follower shown in arcade games) ----
    I("pet.bird", "Birdy", "🐦", "pet", "common", 200),
    I("pet.turtle", "Sheldon", "🐢", "pet", "common", 220),
    I("pet.bunny", "Hoppy", "🐰", "pet", "rare", 380),
    I("pet.dog", "Buddy", "🐶", "pet", "rare", 400),
    I("pet.cat", "Whiskers", "🐱", "pet", "rare", 400),
    I("pet.fox", "Foxy", "🦊", "pet", "epic", 700),
    I("pet.panda", "Bamboo", "🐼", "pet", "epic", 750),
    I("pet.trex", "Rexy", "🦖", "pet", "epic", 800),
    I("pet.dragon", "Ember", "🐉", "pet", "legendary", 1500),
    I("pet.unicorn", "Sparkle", "🦄", "pet", "legendary", 1500),

    // ---- per-game gear (slot: gear.<gameId>) ----
    I("gear.pickle.wood", "Wood Paddle", "🏓", "gear.pickle", "common", 100),
    I("gear.pickle.pro", "Pro Paddle", "🏓", "gear.pickle", "rare", 300),
    I("gear.pickle.gold", "Golden Paddle", "🏓", "gear.pickle", "epic", 0, { unlock: { game: "pickle", rankPts: 100 } }),
    I("gear.fishing.rod", "Bamboo Rod", "🎣", "gear.fishing", "common", 100),
    I("gear.fishing.zap", "Zap Rod", "🎣", "gear.fishing", "rare", 350),
    I("gear.fishing.star", "Star Rod", "🎣", "gear.fishing", "epic", 0, { unlock: { game: "fishing", rankPts: 100 } }),
    I("gear.soccer.boots", "Speed Boots", "👟", "gear.soccer", "rare", 300),
    I("gear.soccer.gold", "Golden Ball", "⚽", "gear.soccer", "epic", 0, { unlock: { game: "soccer", rankPts: 100 } }),
    I("gear.karts.horn", "Duck Horn", "🦆", "gear.karts", "common", 150),
    I("gear.karts.flame", "Flame Kart", "🏎️", "gear.karts", "rare", 0, { unlock: { game: "karts", rankPts: 50 } }),
    I("gear.karts.gold", "Gold Kart", "🏎️", "gear.karts", "epic", 800),
    I("gear.obby.wings", "Cloud Wings", "🪽", "gear.obby", "epic", 700),
    I("gear.chess.candy", "Candy Pieces", "🍬", "gear.chess", "rare", 300),
    I("gear.chess.blocky", "Blocky Pieces", "🟩", "gear.chess", "rare", 300),
    I("gear.chess.neon", "Neon Board", "🌌", "gear.chess", "epic", 600),
    I("gear.bjj.blue", "Blue Gi", "🥋", "gear.bjj", "rare", 300),
    I("gear.bjj.black", "Black Gi", "🥋", "gear.bjj", "epic", 0, { unlock: { game: "bjj", rankPts: 100 } }),
    I("gear.chef.apron", "Flame Apron", "🍳", "gear.chef", "rare", 280),
    I("gear.chef.gold", "Golden Spatula", "🏆", "gear.chef", "epic", 0, { unlock: { game: "chef", rankPts: 100 } }),
    I("gear.towerd.candy", "Candy Towers", "🍭", "gear.towerd", "rare", 300),
    I("gear.towerd.space", "Space Towers", "🛸", "gear.towerd", "epic", 650)
  ];

  var byId = {}; ALL.forEach(function (it) { byId[it.id] = it; });
  var RARITY = {
    common: { w: 62, color: "#9aa7b0", label: "Common" },
    rare: { w: 26, color: "#4aa3ff", label: "Rare" },
    epic: { w: 10, color: "#b06dff", label: "Epic" },
    legendary: { w: 2, color: "#ffb020", label: "LEGENDARY" }
  };

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

  // Reward-chest roll: rarity-weighted, skews to items you don't own yet.
  // Returns { item, dupe } — dupes pay out gems instead (caller handles).
  function rollChest(rand, state) {
    rand = rand || Math.random;
    var roll = rand() * 100, rarity;
    if (roll < RARITY.legendary.w) rarity = "legendary";
    else if (roll < RARITY.legendary.w + RARITY.epic.w) rarity = "epic";
    else if (roll < RARITY.legendary.w + RARITY.epic.w + RARITY.rare.w) rarity = "rare";
    else rarity = "common";
    var owned = (state && state.inventory) || [];
    var pool = ALL.filter(function (it) { return it.rarity === rarity && !it.unlock; });
    var fresh = pool.filter(function (it) { return owned.indexOf(it.id) === -1; });
    var pick = (fresh.length ? fresh : pool)[Math.floor(rand() * (fresh.length ? fresh.length : pool.length))];
    return { item: pick, dupe: owned.indexOf(pick.id) !== -1 };
  }

  global.VobloxItems = { ALL: ALL, byId: byId, RARITY: RARITY, canGet: canGet, shopToday: shopToday, rollChest: rollChest };
})(typeof window !== "undefined" ? window : globalThis);
