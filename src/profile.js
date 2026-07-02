/*
 * Voblox — player profile: XP/levels, per-game stats & ranks, inventory/equipped,
 * quests, reward chests, and Zelda-style save slots.
 * Pure logic — no DOM. Every function takes `state` explicitly so the study app,
 * dashboard, and tests can share them. Storage is injectable (`_ls`) for tests.
 * All fields are ADDITIVE to the existing voblox.save.v1 shape — never rename.
 */
(function (global) {
  var SAVE_KEY = "voblox.save.v1", CRAFT_KEY = "voblox.craft.v1";

  var DEFAULT_AVATAR = { skin: "#ffcc88", shirt: "#2f7be0", pants: "#394063", face: "smile", hat: null, trail: null };
  var GAME_RANKS = [
    { name: "Rookie", icon: "🌱", at: 0 }, { name: "Bronze", icon: "🥉", at: 20 },
    { name: "Silver", icon: "🥈", at: 50 }, { name: "Gold", icon: "🥇", at: 100 },
    { name: "Champ", icon: "🏆", at: 200 }, { name: "Legend", icon: "👑", at: 350 }
  ];

  // XP needed to go from level n to n+1. Early levels come fast (dopamine), later ones cap out.
  function xpForLevel(n) { return Math.min(50 + (n - 1) * 25, 400); }
  function levelForXP(xp) {
    var lv = 1, need = xpForLevel(1);
    while (xp >= need && lv < 99) { xp -= need; lv++; need = xpForLevel(lv); }
    return lv;
  }
  // progress inside the current level, for XP meters: { have, need, level }
  function xpInto(state) {
    var xp = state.xp || 0, lv = 1, need = xpForLevel(1);
    while (xp >= need && lv < 99) { xp -= need; lv++; need = xpForLevel(lv); }
    return { have: xp, need: need, level: lv };
  }

  // Fill ONLY missing keys (never overwrite), recompute level from xp (self-healing).
  // Idempotent; called from the Store constructor so every entry point migrates old saves.
  function ensure(state) {
    if (!state) return state;
    if (!state.profile) state.profile = {};
    if (!state.profile.name) state.profile.name = "Leo";
    if (!state.profile.avatar) state.profile.avatar = {};
    var av = state.profile.avatar;
    Object.keys(DEFAULT_AVATAR).forEach(function (k) { if (av[k] === undefined) av[k] = DEFAULT_AVATAR[k]; });
    if (typeof state.xp !== "number") state.xp = 0;
    state.level = levelForXP(state.xp);
    if (!state.inventory) state.inventory = [];
    if (!state.equipped) state.equipped = {};
    if (!state.pets) state.pets = [];
    if (!state.gameStats) state.gameStats = {};
    if (!state.quests) state.quests = { day: "", list: [] };
    if (typeof state.chests !== "number") state.chests = 0;
    state.schema = 2;
    return state;
  }

  function addXP(state, n) {
    var before = levelForXP(state.xp || 0);
    state.xp = (state.xp || 0) + Math.max(0, Math.round(n || 0));
    var after = levelForXP(state.xp);
    state.level = after;
    var chestsEarned = Math.max(0, after - before);
    state.chests = (state.chests || 0) + chestsEarned; // every level-up gifts a reward chest
    return { leveledUp: after > before, level: after, chestsEarned: chestsEarned };
  }

  function gameStat(state, gameId) {
    if (!state.gameStats) state.gameStats = {};
    if (!state.gameStats[gameId]) state.gameStats[gameId] = { plays: 0, wins: 0, best: 0, rankPts: 0, resume: null };
    return state.gameStats[gameId];
  }
  function gameRank(pts) { var r = GAME_RANKS[0]; GAME_RANKS.forEach(function (x) { if ((pts || 0) >= x.at) r = x; }); return r; }

  // Once-per-match result. res: { win, score, rankPtsDelta, xp, gems }
  function applyGameResult(state, gameId, res) {
    res = res || {};
    var st = gameStat(state, gameId);
    var oldRank = gameRank(st.rankPts);
    st.plays += 1;
    if (res.win) st.wins += 1;
    if (typeof res.score === "number" && res.score > (st.best || 0)) st.best = res.score;
    st.rankPts = Math.max(0, (st.rankPts || 0) + (res.rankPtsDelta || 0));
    var newRank = gameRank(st.rankPts);
    if (res.gems) state.gems = (state.gems || 0) + Math.max(0, Math.round(res.gems));
    var lvl = addXP(state, res.xp || 0);
    return {
      leveledUp: lvl.leveledUp, level: lvl.level, chestsEarned: lvl.chestsEarned,
      rankedUp: newRank.at > oldRank.at, oldRank: oldRank, newRank: newRank
    };
  }

  // Opponents scale with Leo's rank: always beatable-but-close.
  function botSkillFor(rankPts) { return Math.max(0.25, Math.min(0.95, 0.25 + (rankPts || 0) / 300)); }

  // Deterministic RNG (mulberry32) — shared by the shop rotation, chest rolls, and the test harness.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function dayKey(ts) { var d = new Date(ts || Date.now()); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }

  // ---------- daily quests ----------
  var QUEST_DEFS = [
    { id: "answers", text: "Answer {n} word questions", ns: [8, 12, 16], kind: "answers" },
    { id: "wins", text: "Win {n} arcade matches", ns: [1, 2], kind: "wins" },
    { id: "games", text: "Play {n} different games", ns: [2, 3], kind: "games" },
    { id: "gems", text: "Earn {n} gems", ns: [60, 100, 150], kind: "gems" }
  ];
  // 3 quests per day, seeded by the date (same on every device)
  function ensureQuests(state, dk) {
    dk = dk || dayKey();
    if (state.quests && state.quests.day === dk && state.quests.list && state.quests.list.length) return state.quests;
    var rand = rng(hashStr("quests:" + dk));
    var defs = QUEST_DEFS.slice().sort(function () { return rand() - 0.5; }).slice(0, 3);
    state.quests = {
      day: dk,
      list: defs.map(function (d) {
        var n = d.ns[Math.floor(rand() * d.ns.length)];
        return { kind: d.kind, text: d.text.replace("{n}", n), goal: n, n: 0, claimed: false, played: {} };
      })
    };
    return state.quests;
  }
  function bumpQuest(state, kind, amount, gameId) {
    ensureQuests(state);
    state.quests.list.forEach(function (q) {
      if (q.kind !== kind || q.claimed) return;
      if (kind === "games") { if (gameId && !q.played[gameId]) { q.played[gameId] = 1; q.n++; } }
      else q.n = Math.min(q.goal, q.n + (amount || 1));
    });
  }
  // -> {ok, gems} — a claimed quest pays gems AND a reward chest
  function claimQuest(state, idx) {
    ensureQuests(state);
    var q = state.quests.list[idx];
    if (!q || q.claimed || q.n < q.goal) return { ok: false };
    q.claimed = true;
    var pay = 30;
    state.gems = (state.gems || 0) + pay;
    state.chests = (state.chests || 0) + 1;
    return { ok: true, gems: pay };
  }

  // ---------- Zelda-style save slots ----------
  // Each slot snapshots BOTH saves (word world + craft world) atomically so they never desync.
  function ls() { return P._ls || global.localStorage; }
  function slotKey(n) { return "voblox.slot." + n; }
  function readSlot(n) {
    try { var raw = ls().getItem(slotKey(n)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  var slots = {
    // -> [slot1|null, slot2|null, slot3|null, auto|null] (metas only)
    list: function () {
      return [1, 2, 3, "auto"].map(function (n) { var b = readSlot(n); return b ? b.meta : null; });
    },
    save: function (n, now) {
      try {
        var rawSave = ls().getItem(SAVE_KEY), rawCraft = ls().getItem(CRAFT_KEY);
        if (!rawSave) return { error: "nothing to save yet" };
        var st = JSON.parse(rawSave);
        var meta = {
          when: now || Date.now(),
          level: levelForXP(st.xp || 0),
          gems: st.gems || 0,
          name: (st.profile && st.profile.name) || "Leo",
          label: "Lv " + levelForXP(st.xp || 0) + " · " + (st.gems || 0) + " 💎"
        };
        ls().setItem(slotKey(n), JSON.stringify({ meta: meta, save: st, craft: rawCraft ? JSON.parse(rawCraft) : null }));
        return meta;
      } catch (e) {
        // iOS quota is real with 4 slots × craft edit maps — never fail silently
        return { error: "Slot is too full — try deleting a slot first." };
      }
    },
    // Writes both keys back. CALLER must location.reload() — live pages hold state in memory.
    load: function (n) {
      var b = readSlot(n);
      if (!b || !b.save) return false;
      try {
        ls().setItem(SAVE_KEY, JSON.stringify(b.save));
        if (b.craft) ls().setItem(CRAFT_KEY, JSON.stringify(b.craft));
        return true;
      } catch (e) { return false; }
    },
    del: function (n) { try { ls().removeItem(slotKey(n)); } catch (e) {} },
    // Rolling safety-net snapshot (undo for accidental resets). Throttled to >= 60s apart.
    auto: function (now) {
      now = now || Date.now();
      var prev = readSlot("auto");
      if (prev && prev.meta && now - prev.meta.when < 60000) return;
      slots.save("auto", now);
    }
  };

  var P = {
    SCHEMA: 2,
    DEFAULT_AVATAR: DEFAULT_AVATAR,
    GAME_RANKS: GAME_RANKS,
    ensure: ensure,
    xpForLevel: xpForLevel,
    levelForXP: levelForXP,
    xpInto: xpInto,
    addXP: addXP,
    gameStat: gameStat,
    gameRank: gameRank,
    applyGameResult: applyGameResult,
    ensureQuests: ensureQuests,
    bumpQuest: bumpQuest,
    claimQuest: claimQuest,
    botSkillFor: botSkillFor,
    rng: rng,
    hashStr: hashStr,
    dayKey: dayKey,
    slots: slots,
    _ls: null // test harness injects a memory shim here
  };

  if (typeof module !== "undefined" && module.exports) module.exports = P;
  global.VobloxProfile = P;
})(typeof window !== "undefined" ? window : globalThis);
