/*
 * Voblox arcade game — 🗡️ Word Dungeon (a top-down Zelda-lite crawler).
 * SIX dungeons of escalating menace, each a 5×5 grid of hand-authored rooms.
 * Later floors add 🧩 Zelda-style PUZZLE ROOMS (push-block, torch-order, plate
 * sequence) and tougher bosses with telegraphed, dodgeable new attacks.
 * One room fills the screen at a time; walk through a doorway and it slides to
 * the neighbor. Monsters, keys, treasure, and a boss in the far corner.
 * VOCAB IS THE KEY — literally:
 *   - 📜 WORD-DOORS: some doorways are runed shut; answer a word (miniQuiz,
 *     NOT skippable) to open them forever. Shortcuts + treasure gates.
 *   - BOSS WORD-DUEL: the boss wears a WORD SHIELD. Tap him (or press E near
 *     him) and answer to drop it for 10s — the proven duel pattern.
 *   - 💰 Treasure chests ask NOTHING — pure reward for exploring.
 * recordGame("dungeon") ONCE per run (win, quit, or tab-close), rewards SHOWN.
 * Kind, not punishing: 0 hearts respawns you at the entrance, everything you
 * already cleared/unlocked STAYS cleared. (Au: Leo should feel brave, not sad.)
 */
(function (global) {
  var VQ = global.VobloxQuestions, AV = global.VobloxAvatar;

  // ONE square logical space (rooms are square-ish; HUD lives outside it).
  var MW = 480, MH = 480;          // logical room size
  var GRID = 5;                    // 5×5 rooms per dungeon
  var TILE = MW / 12;              // wall thickness / doorway math reference
  var PR = 20;                     // player radius (logical)
  var ER = 18;                     // enemy radius (logical)

  // ---------- enemy archetypes ----------
  var MOBS = {
    slime: { emoji: "🟢", hp: 1, speed: 42, r: 18, kind: "wander", touch: 1 },
    bat: { emoji: "🦇", hp: 1, speed: 70, r: 16, kind: "swoop", touch: 1 },
    skel: { emoji: "💀", hp: 2, speed: 52, r: 19, kind: "chase", touch: 1 },
    // deeper-floor mobs (dungeons 4-6)
    spiderling: { emoji: "🕷", hp: 1, speed: 96, r: 15, kind: "chase", touch: 1 }, // fast, 1 hp
    magmablob: { emoji: "🔥", hp: 3, speed: 30, r: 20, kind: "wander", touch: 1 }, // slow, 3 hp, leaves hot floor on death
    shade: { emoji: "👑", hp: 1, speed: 46, r: 40, kind: "wander", touch: 0 }      // KING's harmless decoy (fake:true), shatters in 1 hit
  };
  // ---------- power-up items (found on monsters + in chests; tap to use) ----------
  var ITEMS = {
    potion: { emoji: "🧪", name: "Heart Potion", desc: "refill your hearts" },
    boots: { emoji: "💨", name: "Zoom Boots", desc: "8s super speed" },
    spin: { emoji: "🌀", name: "Spin Slash", desc: "hit EVERYTHING around you" },
    bubble: { emoji: "🛡️", name: "Bubble Shield", desc: "8s protection" }
  };
  var ITEM_KEYS = ["potion", "boots", "spin", "bubble"];

  // bosses: 8-12 hp, a charge-then-pause pattern, and a re-arming WORD SHIELD
  var BOSSES = {
    1: { emoji: "👹", name: "GRUMP", hp: 8, speed: 60, r: 40, touch: 1 },
    2: { emoji: "🐍", name: "FANG", hp: 10, speed: 78, r: 42, touch: 1 },
    3: { emoji: "🐲", name: "VOWELZILLA", hp: 12, speed: 92, r: 46, touch: 1 },
    // deeper bosses: extra telegraphed attacks layered on the charge/word-shield duel
    4: { emoji: "🕷", name: "WEBSPINNER", hp: 14, speed: 66, r: 44, touch: 1 },        // web slow-zones + baby spiders
    5: { emoji: "🌋", name: "CINDERJAW", hp: 16, speed: 96, r: 46, touch: 1 },         // charge + telegraphed fire pools
    6: { emoji: "👑", name: "THE WORDLESS KING", hp: 20, speed: 84, r: 46, touch: 1 }  // teleport + shadow-bolt cross + splits
  };

  // dungeon display names, indexed 1..6 (index 0 unused)
  var DG_NAMES = ["", "The Slime Cellar", "The Fang Warren", "VOWELZILLA'S Lair", "The Web Depths", "The Magma Halls", "The Shadow Keep"];

  // ---------- hand-authored dungeon layouts (deterministic → tests are stable) ----------
  // Each dungeon is a 5×5 map. Rooms addressed [r][c], r=row (0 top), c=col.
  // Room fields:
  //   t: "start" | "normal" | "key" | "treasure" | "boss" | "puzzle"
  //   puzzle: {kind:"block"|"torch"|"plates", ...} — a Zelda-style room (no mobs).
  //     A door flagged {plate:true} stays sealed until THIS room's puzzle is solved.
  //   mobs: [{type,x,y}] spawn offsets in logical room space (defaults center-ish)
  //   doors: which neighbors connect: any of "N","S","E","W". A door object may
  //          carry {word:true} (📜 rune-locked) or {lock:true} (needs the 🗝️ key).
  //   Doors are authored on BOTH sides for the pair (mirror) so travel is symmetric.
  // Design rule the prompt demands: there is ALWAYS a non-word path to the key
  // and to the boss. Word-doors are shortcuts + treasure gates, never a wall.
  // Puzzles may gate a path ONLY when always solvable (no word, no dead-end) —
  // here they gate treasure/side rewards, keeping the main crawl word-free.
  var OPP = { N: "S", S: "N", E: "W", W: "E" };
  var STEP = { N: { dr: -1, dc: 0 }, S: { dr: 1, dc: 0 }, E: { dr: 0, dc: 1 }, W: { dr: 0, dc: -1 } };
  function layout(n) {
    // helper builders keep the data terse and readable
    function room(t, mobs, extra) { var o = { t: t, doors: {}, mobs: mobs || [] }; if (extra) for (var k in extra) o[k] = extra[k]; return o; }
    function m(type, x, y) { return { type: type, x: x, y: y }; }
    var G = [], r, c;
    for (r = 0; r < GRID; r++) { G.push([]); for (c = 0; c < GRID; c++) G[r].push(null); }
    // link(r,c,dir,flags): opens a door BOTH ways so travel is always symmetric.
    // flags: {word:true} 📜 rune-locked · {lock:true} 🗝️ key-locked.
    function link(fr, fc, dir, flags) {
      var st = STEP[dir], tr = fr + st.dr, tc = fc + st.dc;
      if (!G[fr][fc] || tr < 0 || tr >= GRID || tc < 0 || tc >= GRID || !G[tr][tc]) return;
      var a = { open: true }, b = { open: true };
      if (flags) for (var k in flags) { a[k] = flags[k]; b[k] = flags[k]; }
      G[fr][fc].doors[dir] = a;
      G[tr][tc].doors[OPP[dir]] = b;
    }

    if (n === 1) {
      // Dungeon 1 — gentle. Entrance bottom-left; boss top-right.
      G[4][0] = room("start");
      G[4][1] = room("normal", [m("slime", 200, 240), m("slime", 300, 200)]);
      G[4][2] = room("key", [m("slime", 240, 240)]);                       // holds the 🗝️
      G[3][0] = room("normal", [m("bat", 260, 220)]);
      G[3][2] = room("treasure", []);                                      // 💰 pure reward
      G[2][0] = room("normal", [m("slime", 220, 260), m("bat", 300, 200)]);
      G[2][1] = room("normal", [m("skel", 260, 240)]);
      G[2][2] = room("normal", [m("slime", 240, 240)]);
      G[1][2] = room("normal", [m("bat", 240, 220)]);
      G[1][3] = room("normal", [m("skel", 260, 240)]);
      G[1][4] = room("normal", [m("slime", 260, 240)]);
      G[0][4] = room("boss");
      // the plain path: start → key → up the left, across the middle, to the boss
      link(4, 0, "E"); link(4, 1, "E");
      link(4, 0, "N"); link(3, 0, "N"); link(2, 0, "E");
      link(2, 1, "E"); link(2, 2, "N"); link(1, 2, "E"); link(1, 3, "E"); link(1, 4, "N");
      // 📜 word-door SHORTCUT to the treasure (a detour, never the only way)
      link(4, 2, "N"); link(3, 2, "N", { word: true });
    } else if (n === 2) {
      // Dungeon 2 — a loop with a heart-treasure behind a 🗝️ locked door.
      G[4][0] = room("start");
      G[4][1] = room("normal", [m("skel", 220, 240), m("slime", 320, 220)]);
      G[4][2] = room("normal", [m("bat", 240, 200), m("bat", 300, 260)]);
      G[3][0] = room("normal", [m("slime", 240, 240)]);
      G[3][2] = room("key", [m("skel", 260, 240)]);                        // 🗝️
      G[2][0] = room("normal", [m("bat", 260, 220), m("skel", 320, 260)]);
      G[2][1] = room("normal", [m("slime", 240, 240)]);
      G[2][2] = room("treasure", [], { heart: true });                     // 💰 + ❤️ behind a lock
      G[1][2] = room("normal", [m("skel", 240, 240)]);
      G[1][3] = room("normal", [m("bat", 240, 220), m("slime", 300, 260)]);
      G[1][4] = room("normal", [m("skel", 260, 240)]);
      G[0][4] = room("boss");
      link(4, 0, "E"); link(4, 1, "E"); link(4, 2, "N");                   // reach the key
      link(4, 0, "N"); link(3, 0, "N"); link(2, 0, "E"); link(2, 1, "E"); // the plain path up-left
      link(3, 2, "N");                                                     // key room straight up to the boss column (no word)
      link(2, 2, "S");                                                     // 💰 room down to (3,2)
      link(2, 2, "W", { lock: true });                                     // 🗝️ locked heart-treasure door
      link(1, 2, "E"); link(1, 3, "E"); link(1, 4, "N");                   // across the top to the boss
      link(2, 2, "N", { word: true });                                     // 📜 shortcut up from the treasure
    } else if (n === 3) {
      // Dungeon 3 — the gauntlet: more mobs, a heart treasure, two 📜 word-doors.
      G[4][0] = room("start");
      G[4][1] = room("normal", [m("skel", 220, 240), m("skel", 320, 220), m("bat", 260, 300)]);
      G[4][2] = room("key", [m("slime", 220, 240), m("bat", 300, 260)]);   // 🗝️
      G[3][0] = room("normal", [m("bat", 240, 220), m("skel", 300, 260)]);
      G[3][2] = room("normal", [m("skel", 260, 240), m("slime", 320, 220)]);
      G[2][0] = room("normal", [m("bat", 240, 220), m("bat", 300, 260)]);
      G[2][1] = room("treasure", [], { heart: true });                     // 💰 + ❤️
      G[2][2] = room("normal", [m("skel", 240, 240), m("slime", 300, 260)]);
      G[1][2] = room("normal", [m("skel", 240, 240), m("bat", 300, 220)]);
      G[1][3] = room("normal", [m("skel", 240, 240), m("skel", 300, 260)]);
      G[1][4] = room("normal", [m("bat", 260, 240)]);
      G[0][4] = room("boss");
      link(4, 0, "E"); link(4, 1, "E");                                    // reach the key
      link(4, 0, "N"); link(3, 0, "N"); link(2, 0, "E");                   // plain path up-left
      link(2, 1, "E"); link(2, 2, "N"); link(1, 2, "E"); link(1, 3, "E"); link(1, 4, "N"); // across to the boss
      link(4, 2, "N"); link(3, 2, "N", { word: true });                    // 📜 shortcut #1 (key col → middle)
      link(2, 2, "W", { word: true });                                     // 📜 shortcut #2 into the treasure
    } else if (n === 4) {
      // Dungeon 4 "The Web Depths" — 🕷 WEBSPINNER. Denser mobs + all 3 puzzle rooms.
      // puzzle configs: block/torch gate a {plate:true} treasure door; plates pays out.
      G[4][0] = room("start");
      G[4][1] = room("normal", [m("skel", 200, 240), m("spiderling", 300, 210), m("bat", 260, 320)]);
      G[4][2] = room("key", [m("spiderling", 220, 240), m("slime", 320, 250)]);            // 🗝️
      G[4][3] = room("puzzle", [], { puzzle: { kind: "torch", door: "N",
        torches: [{ x: 140, y: 250, rune: 2 }, { x: 240, y: 250, rune: 1 }, { x: 340, y: 250, rune: 3 }] } });
      G[3][0] = room("puzzle", [], { puzzle: { kind: "block", door: "N",
        start: { x: 240, y: 360 }, plate: { x: 240, y: 120 }, lever: { x: 70, y: 410 } } });
      G[3][2] = room("normal", [m("spiderling", 220, 230), m("spiderling", 320, 250), m("skel", 250, 330)]);
      G[3][3] = room("treasure", [], { heart: true });                                     // behind the 🕯 torch door
      G[2][0] = room("treasure", []);                                                       // behind the 🟫 block door
      G[2][2] = room("normal", [m("skel", 200, 220), m("spiderling", 320, 220), m("bat", 260, 320), m("slime", 200, 330)]);
      G[2][3] = room("normal", [m("spiderling", 220, 240), m("spiderling", 320, 240), m("skel", 260, 330)]);
      G[2][4] = room("puzzle", [], { puzzle: { kind: "plates", seq: [0, 2, 3, 1],
        plates: [{ x: 150, y: 160 }, { x: 330, y: 160 }, { x: 150, y: 340 }, { x: 330, y: 340 }] } });
      G[1][3] = room("normal", [m("skel", 220, 240), m("skel", 320, 240), m("spiderling", 260, 330)]);
      G[1][4] = room("normal", [m("spiderling", 240, 240), m("bat", 300, 250)]);
      G[0][4] = room("boss");
      // main non-word, non-puzzle path: start → key → boss
      link(4, 0, "E"); link(4, 1, "E");
      link(4, 2, "N"); link(3, 2, "N"); link(2, 2, "E");
      link(2, 3, "N"); link(1, 3, "E"); link(1, 4, "N");
      // 🟫 block puzzle branch → treasure
      link(4, 0, "N"); link(3, 0, "N", { plate: true });
      // 🕯 torch puzzle branch → treasure
      link(4, 2, "E"); link(4, 3, "N", { plate: true });
      // plates puzzle side room + a 📜 runed shortcut up to the boss row
      link(2, 3, "E"); link(2, 4, "N", { word: true });
    } else if (n === 5) {
      // Dungeon 5 "The Magma Halls" — 🌋 CINDERJAW. Magma-heavy, torch + block puzzles.
      G[4][0] = room("start");
      G[4][1] = room("normal", [m("magmablob", 200, 240), m("skel", 320, 220), m("spiderling", 260, 320)]);
      G[4][2] = room("key", [m("magmablob", 230, 240), m("spiderling", 320, 250)]);         // 🗝️
      G[3][0] = room("puzzle", [], { puzzle: { kind: "torch", door: "N",
        torches: [{ x: 140, y: 250, rune: 3 }, { x: 240, y: 250, rune: 1 }, { x: 340, y: 250, rune: 2 }] } });
      G[3][2] = room("normal", [m("magmablob", 200, 220), m("magmablob", 320, 250), m("skel", 260, 330)]);
      G[3][3] = room("puzzle", [], { puzzle: { kind: "block", door: "N",
        start: { x: 240, y: 360 }, plate: { x: 240, y: 120 }, lever: { x: 70, y: 410 } } });
      G[2][0] = room("treasure", [], { heart: true });                                      // behind the 🕯 torch door
      G[2][2] = room("normal", [m("skel", 200, 220), m("spiderling", 320, 220), m("magmablob", 250, 330), m("bat", 310, 320)]);
      G[2][3] = room("treasure", []);                                                        // behind the 🟫 block door / 📜 shortcut
      G[1][2] = room("normal", [m("magmablob", 210, 240), m("skel", 320, 230), m("spiderling", 260, 330)]);
      G[1][3] = room("normal", [m("skel", 220, 240), m("spiderling", 320, 240), m("bat", 260, 330)]);
      G[1][4] = room("normal", [m("magmablob", 240, 240), m("spiderling", 300, 250)]);
      G[0][4] = room("boss");
      // main non-word path
      link(4, 0, "E"); link(4, 1, "E");
      link(4, 2, "N"); link(3, 2, "N"); link(2, 2, "N");
      link(1, 2, "E"); link(1, 3, "E"); link(1, 4, "N");
      // 🕯 torch branch → heart treasure
      link(4, 0, "N"); link(3, 0, "N", { plate: true });
      // 🟫 block branch → treasure, plus a 📜 runed shortcut into it
      link(3, 2, "E"); link(3, 3, "N", { plate: true });
      link(2, 2, "E", { word: true });
    } else {
      // Dungeon 6 "The Shadow Keep" — 👑 THE WORDLESS KING, the finale. Every mob type,
      // all three puzzle kinds, two heart treasures, a 📜 runed treasure shortcut.
      G[4][0] = room("start");
      G[4][1] = room("normal", [m("skel", 190, 230), m("spiderling", 300, 210), m("magmablob", 250, 330), m("bat", 330, 320)]);
      G[4][2] = room("key", [m("skel", 210, 240), m("spiderling", 320, 240), m("magmablob", 260, 330)]); // 🗝️
      G[3][0] = room("puzzle", [], { puzzle: { kind: "plates", seq: [2, 0, 3, 1],
        plates: [{ x: 150, y: 160 }, { x: 330, y: 160 }, { x: 150, y: 340 }, { x: 330, y: 340 }] } });
      G[3][2] = room("normal", [m("magmablob", 200, 220), m("magmablob", 320, 240), m("skel", 240, 320), m("spiderling", 320, 320)]);
      G[3][3] = room("puzzle", [], { puzzle: { kind: "block", door: "E",
        start: { x: 120, y: 240 }, plate: { x: 360, y: 240 }, lever: { x: 70, y: 410 } } });
      G[3][4] = room("treasure", [], { heart: true });                                       // behind the 🟫 block door
      G[2][2] = room("normal", [m("skel", 200, 220), m("skel", 320, 230), m("magmablob", 250, 330), m("spiderling", 320, 330)]);
      G[2][3] = room("normal", [m("spiderling", 210, 240), m("skel", 320, 240), m("magmablob", 260, 330)]);
      G[1][2] = room("puzzle", [], { puzzle: { kind: "torch", door: "N",
        torches: [{ x: 130, y: 250, rune: 2 }, { x: 230, y: 250, rune: 3 }, { x: 330, y: 250, rune: 1 }] } });
      G[1][3] = room("normal", [m("magmablob", 210, 230), m("skel", 320, 230), m("spiderling", 250, 330), m("bat", 320, 320)]);
      G[1][4] = room("normal", [m("skel", 230, 240), m("spiderling", 310, 250)]);
      G[0][2] = room("treasure", [], { heart: true });                                       // behind the 🕯 torch door
      G[0][3] = room("treasure", []);                                                         // behind a 📜 runed door
      G[0][4] = room("boss");
      // main non-word, non-puzzle path: start → key → boss
      link(4, 0, "E"); link(4, 1, "E");
      link(4, 2, "N"); link(3, 2, "N"); link(2, 2, "E");
      link(2, 3, "N"); link(1, 3, "E"); link(1, 4, "N");
      // 🎛 plates puzzle side room
      link(4, 0, "N");
      // 🟫 block puzzle → heart treasure
      link(3, 2, "E"); link(3, 3, "E", { plate: true });
      // 🕯 torch puzzle → heart treasure
      link(1, 3, "W"); link(1, 2, "N", { plate: true });
      // 📜 runed treasure shortcut off the top row
      link(1, 3, "N", { word: true });
    }
    return G;
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("dungeon");
    if (!stats.lvl) stats.lvl = 1;         // highest dungeon unlocked (start 1). NOT stats.best.
    stats.clears = stats.clears || 0;
    stats.deaths = stats.deaths || 0;
    // persistent power-up satchel (additive save field) — found items KEEP across runs
    stats.items = stats.items || { potion: 0, boots: 0, spin: 0, bubble: 0 };
    ITEM_KEYS.forEach(function (k) { if (!stats.items[k]) stats.items[k] = 0; });

    var cfg = AV && AV.resolve ? AV.resolve(store.state) : { skin: "#ffcc88", shirt: "#2f7be0", pants: "#394063", face: "smile" };

    var wrap = document.createElement("div"); wrap.className = "gamewrap dungeon";
    wrap.innerHTML =
      '<canvas id="dgcv"></canvas>' +
      '<div class="ghud"><div class="clue" id="dgmsg">🗡️ Word Dungeon</div>' +
      '<div class="grow"><span id="dghearts">❤️❤️❤️</span><span id="dgkeys">🗝️ 0</span>' +
      '<span id="dgcoins">💰 0</span><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="dgbig"></div>' +
      // ⚔ attack cross (bottom-right): four buttons, one per direction
      '<div id="dgpad" style="position:absolute;right:10px;bottom:calc(env(safe-area-inset-bottom, 0px) + 12px);width:156px;height:156px;z-index:8">' +
      ['N;top:0;left:52px;▲', 'W;top:52px;left:0;◀', 'E;top:52px;right:0;▶', 'S;bottom:0;left:52px;▼'].map(function (s) {
        var p = s.split(";");
        return '<button type="button" class="dgatk" data-atk="' + p[0] + '" style="position:absolute;' + p[1] + ';' + p[2] + ';width:52px;height:52px;' +
          'background:rgba(20,16,30,.72);border:2px solid rgba(255,225,77,.5);border-radius:14px;color:#ffd23f;' +
          'font-size:22px;font-weight:900;font-family:inherit;padding:0;line-height:1;cursor:pointer">' + p[3] + '</button>';
      }).join("") +
      '<div style="position:absolute;top:52px;left:52px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:24px;opacity:.8;pointer-events:none">⚔️</div>' +
      '</div>' +
      // 🎒 power-up satchel (bottom-left): tap an item to use it
      '<div id="dginv" style="position:absolute;left:10px;bottom:calc(env(safe-area-inset-bottom, 0px) + 12px);display:flex;gap:6px;z-index:8"></div>' +
      '<div class="gover" id="dgq" style="display:none"></div>' +
      '<div class="gover" id="dgend" style="display:none"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#dgcv"), ctx = cv.getContext("2d");

    // ---------- responsive letterbox (both orientations fit the SAME square) ----------
    var W, H, S, OX, OY, compact = false;
    function resize() {
      W = cv.width = wrap.clientWidth || 480;
      H = cv.height = wrap.clientHeight || 640;
      compact = Math.min(W, H) < 520;
      // reserve room top (HUD) and a little bottom breathing space; then fit the
      // square uniformly and center it. No transpose — a square reads fine in
      // portrait OR landscape; the mini-map/HUD never overlap the room.
      var top = compact ? 88 : 118, bot = 14;
      var availW = W - 12, availH = H - top - bot;
      S = Math.min(availW / MW, availH / MH);
      if (S <= 0) S = 1;
      OX = Math.max(0, (W - MW * S) / 2);
      OY = top + Math.max(0, (availH - MH * S) / 2);
    }
    resize(); window.addEventListener("resize", resize);
    // logical → screen. Square space, so this is a plain scale+offset (no swap).
    function X(x) { return OX + x * S; }
    function Y(y) { return OY + y * S; }
    function pz(n) { return n * S; }

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var dungeon = 0, map = null, over = false, won = false, banked = false, paused = false;
    var room = { r: 4, c: 0 }, entrance = { r: 4, c: 0 };
    var player = { x: MW / 2, y: MH / 2, dir: "N", inv: 0 };
    var hearts = 3, maxHearts = 3, deaths = 0, keys = 0, coins = 0, roomsCleared = 0;
    var mobs = [], swingT = 0, swingCd = 0, kb = { x: 0, y: 0 };
    var speedT = 0, shieldT = 0, spinT = 0;   // power-up effect timers
    var moveVec = { x: 0, y: 0 };            // current movement input (-1..1)
    var cleared = {}, doorsUnlocked = {}, visited = {}, chestOpened = {};
    var puzzles = {};                        // per-room 🧩 puzzle state (keyed like cleared)
    var zones = [];                          // active hazard zones (web slow / fire pool / shadow bolts)
    var trans = null;                        // room-slide transition {dr,dc,t}
    var lastFmt = null;
    var keyHeld = {};                        // WASD/arrow state

    function big(m, col) { var e = document.getElementById("dgbig"); e.textContent = m; e.style.color = col || "#fff"; e.style.opacity = "1"; setTimeout(function () { e.style.opacity = "0"; }, 1200); }
    function roomKey(r, c) { return dungeon + ":" + r + ":" + c; }
    function curRoom() { return map && map[room.r] && map[room.r][room.c]; }
    function hud() {
      document.getElementById("dghearts").textContent = "❤️".repeat(hearts) + "🖤".repeat(Math.max(0, maxHearts - hearts));
      document.getElementById("dgkeys").textContent = "🗝️ " + keys;
      document.getElementById("dgcoins").textContent = "💰 " + coins;
    }

    // ---------- dungeon select ----------
    function showSelect() {
      dungeon = 0; map = null; paused = true; over = false; won = false;
      var end = document.getElementById("dgend");
      var rows = [1, 2, 3, 4, 5, 6].map(function (n) {
        var open = n <= stats.lvl;
        var name = DG_NAMES[n];
        var boss = ["👹 GRUMP", "🐍 FANG", "🐲 VOWELZILLA", "🕷 WEBSPINNER", "🌋 CINDERJAW", "👑 THE WORDLESS KING"][n - 1];
        return '<button class="embtn" style="min-width:140px' + (open ? "" : ";opacity:.45") + '" data-dg="' + n + '">' +
          '<span class="ebl">' + (open ? "🗡️ " : "🔒 ") + "Dungeon " + n + '</span>' +
          '<span class="ebs">' + name + " · " + boss + "</span></button>";
      }).join("");
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:560px"><div style="font-size:40px">🗡️🏰</div>' +
        '<div class="wqtitle" style="font-size:20px">Word Dungeon</div>' +
        '<div style="margin:4px 0 10px;color:#5a6b7a;font-weight:bold">Crawl the dungeon. Runed doors 📜 open for a WORD. Beat the boss to unlock the next.</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' + rows + "</div>" +
        '<div style="font-size:11px;color:#8a98a8;margin-top:8px">Move: drag / WASD · Sword: tap, Space, or the ⚔ cross · Tap a 🎒 power-up to use it · Doors 📜 & the boss ask a word</div></div>';
      end.style.display = "flex";
      Array.prototype.forEach.call(end.querySelectorAll("[data-dg]"), function (b) {
        b.onclick = function () {
          var n = +b.dataset.dg;
          if (n > stats.lvl) { big("🔒 Beat Dungeon " + (n - 1) + " first!", "#ffd740"); return; }
          begin(n);
        };
      });
    }

    // ---------- start a dungeon ----------
    function begin(n) {
      // progression gate (same lock message path as the select buttons)
      if (n > stats.lvl) { big("🔒 Beat Dungeon " + (n - 1) + " first!", "#ffd740"); return; }
      dungeon = n; map = layout(n);
      over = false; won = false; banked = false; paused = false;
      // dungeon 4+ grants a courtesy heart for the harder rooms
      maxHearts = n >= 4 ? 4 : 3; hearts = maxHearts;
      deaths = 0; keys = 0; coins = 0; roomsCleared = 0;
      cleared = {}; doorsUnlocked = {}; visited = {}; chestOpened = {};
      puzzles = {}; zones = [];
      swingT = 0; swingCd = 0; kb = { x: 0, y: 0 }; moveVec = { x: 0, y: 0 };
      trans = null; player.inv = 0;
      speedT = 0; shieldT = 0; spinT = 0; invUI();
      // find the start room
      for (var r = 0; r < GRID; r++) for (var c = 0; c < GRID; c++) {
        if (map[r][c] && map[r][c].t === "start") { entrance = { r: r, c: c }; }
      }
      room = { r: entrance.r, c: entrance.c };
      player.x = MW / 2; player.y = MH - TILE * 1.6; player.dir = "N";
      document.getElementById("dgend").style.display = "none";
      enterRoom(true);
      big("🗡️ " + DG_NAMES[n], "#ffe14d");
      document.getElementById("dgmsg").innerHTML = "🗡️ <b>Dungeon " + n + "</b> — find the 🗝️, open the 📜, beat the boss!";
      hud();
    }

    // ---------- room entry: spawn (or restore) this room's monsters ----------
    function enterRoom(fresh) {
      var rm = curRoom(); if (!rm) return;
      visited[roomKey(room.r, room.c)] = true;
      mobs = [];
      zones = [];                                  // hazard zones never carry between rooms
      if (rm.t === "puzzle") {
        // 🧩 thinking room: no mobs. Spin up (or restore) its puzzle state.
        var pk = roomKey(room.r, room.c);
        if (!puzzles[pk]) puzzles[pk] = initPuzzle(rm.puzzle);
        hud();
        return;
      }
      if (rm.t === "boss") {
        // face the boss from a safe distance (the arena is tall enough to breathe)
        player.x = MW / 2; player.y = MH - TILE * 2; player.dir = "N";
        if (!cleared[roomKey(room.r, room.c)]) spawnBoss();
      } else if (!cleared[roomKey(room.r, room.c)]) {
        rm.mobs.forEach(function (s) {
          var d = MOBS[s.type];
          mobs.push({ type: s.type, x: s.x, y: s.y, hp: d.hp, maxHp: d.hp, phase: Math.random() * 6, hit: 0 });
        });
      }
      // an empty room counts as cleared the moment you set foot in it
      if (mobs.length === 0 && rm.t !== "boss" && !cleared[roomKey(room.r, room.c)]) markCleared();
      hud();
    }

    function spawnBoss() {
      var b = BOSSES[dungeon];
      mobs = [{ type: "boss", x: MW / 2, y: MH / 2 - 30, hp: b.hp, maxHp: b.hp, phase: 0, hit: 0,
        shield: true, shieldT: 0, charge: 0, chargeCd: 1.5, cvx: 0, cvy: 0,
        // deeper-boss attack timers (unused by bosses 1-3)
        webCd: 0.6, fireCd: 2.4, tpCd: 2.6, boltCd: 1.8, split: false }];
      big("⚔️ " + b.emoji + " " + b.name + " — tap him & answer a word to drop his shield!", "#c9b6ff");
      if (sfx && sfx.buzz) sfx.buzz();
    }
    function boss() { for (var i = 0; i < mobs.length; i++) if (mobs[i].type === "boss") return mobs[i]; return null; }

    function markCleared() {
      var k = roomKey(room.r, room.c);
      if (cleared[k]) return;
      cleared[k] = true; roomsCleared++;
      var rm = curRoom();
      if (rm.t === "key") { keys++; big("🗝️ You found a KEY!", "#ffe14d"); if (sfx && sfx.coin) sfx.coin(); hud(); }
    }

    // ---------- movement input helpers ----------
    function setDir(dx, dy) {
      if (Math.abs(dx) > Math.abs(dy)) player.dir = dx < 0 ? "W" : "E";
      else if (Math.abs(dy) > 0.001) player.dir = dy < 0 ? "N" : "S";
    }

    // ---------- sword swing ----------
    function swing() {
      if (over || paused || trans || swingCd > 0) return;
      swingT = 0.3; swingCd = 0.3;                 // ~0.3s arc + ~0.3s cooldown
      if (sfx && sfx.whoosh) sfx.whoosh();
      // a short arc in the facing direction; enemies within range + arc take 1 hit
      var ax = { N: 0, S: 0, E: 1, W: -1 }[player.dir], ay = { N: -1, S: 1, E: 0, W: 0 }[player.dir];
      var reach = PR + 42;
      for (var i = mobs.length - 1; i >= 0; i--) {
        var mob = mobs[i];
        var mr = mob.type === "boss" ? BOSSES[dungeon].r : MOBS[mob.type].r;
        var dx = mob.x - player.x, dy = mob.y - player.y, dist = Math.hypot(dx, dy);
        if (dist > reach + mr) continue;
        var dot = dist > 0 ? (dx * ax + dy * ay) / dist : 1;
        if (dot < 0.35) continue;                  // roughly a forward cone
        hitMob(mob, 1);
      }
      if (juice) juice.burst(X(player.x + ax * 30), Y(player.y + ay * 30), "#e8f0ff", 6);
    }
    function hitMob(mob, dmg) {
      if (mob.fake) {                              // a decoy shade — one tap and it's gone; real king unharmed
        var fi = mobs.indexOf(mob); if (fi >= 0) mobs.splice(fi, 1);
        big("✨ the shade shatters!", "#c9b6ff");
        if (juice) juice.burst(X(mob.x), Y(mob.y), "#c9b6ff", 12);
        if (sfx && sfx.pop) sfx.pop();
        return;
      }
      if (mob.type === "boss" && mob.shield) {     // WORD SHIELD blocks everything
        if (juice && Math.random() < 0.5) juice.text(X(mob.x), Y(mob.y - 50), "🛡 WORD-LOCKED", "#c9b6ff");
        return;
      }
      mob.hp -= dmg; mob.hit = 0.15;
      if (juice) juice.text(X(mob.x), Y(mob.y - 30), "-" + dmg, "#ffd740");
      if (mob.hp <= 0) killMob(mob);
    }
    function killMob(mob) {
      var i = mobs.indexOf(mob); if (i >= 0) mobs.splice(i, 1);
      if (juice) juice.burst(X(mob.x), Y(mob.y), "#9aa86a", 10);
      if (sfx && sfx.pop && Math.random() < 0.6) sfx.pop();
      // 🔥 a slain magmablob leaves a brief patch of hot floor
      if (mob.type === "magmablob") zones.push({ kind: "fire", x: mob.x, y: mob.y, r: 42, life: 2.2, warn: 0 });
      if (mob.type === "boss") { bossDefeated(); return; }
      // loot: a heart (25%), coins (35%), or a power-up (12%)
      var roll = Math.random();
      if (roll < 0.25 && hearts < maxHearts) { hearts = Math.min(maxHearts, hearts + 1); big("❤️ +1 heart!", "#ff6b6b"); hud(); }
      else if (roll < 0.6) { var c = 3 + Math.floor(Math.random() * 5); coins += c; big("💰 +" + c, "#ffd23f"); hud(); }
      else if (roll < 0.72) findItem(ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)]);
      // room cleared?
      if (mobs.length === 0) markCleared();
    }

    // ---------- power-up satchel ----------
    function findItem(k) {
      stats.items[k] = (stats.items[k] || 0) + 1; store.save();
      big(ITEMS[k].emoji + " Found a " + ITEMS[k].name + "! (tap it to use)", "#9be870");
      if (sfx && sfx.coin) sfx.coin();
      invUI();
    }
    function useItem(k) {
      if (over || paused || trans || !map) return false;
      if (!stats.items[k]) return false;
      if (k === "potion") {
        if (hearts >= maxHearts) { big("Hearts already full!", "#ffd740"); return false; }
        hearts = maxHearts; big("🧪 Hearts refilled!", "#ff6b6b");
      } else if (k === "boots") {
        speedT = 8; big("💨 ZOOM! Super speed!", "#8ecdf7");
      } else if (k === "spin") {
        spinT = 0.35;
        var hitAny = false;
        for (var i = mobs.length - 1; i >= 0; i--) {
          var mob = mobs[i];
          if (Math.hypot(mob.x - player.x, mob.y - player.y) < 170) { hitMob(mob, 2); hitAny = true; }
        }
        big(hitAny ? "🌀 SPIN SLASH!" : "🌀 Whoosh! (nothing close)", "#c9b6ff");
        if (juice) juice.shake(6);
      } else if (k === "bubble") {
        shieldT = 8; big("🛡️ Bubble Shield — 8s safe!", "#69f0ae");
      }
      stats.items[k]--; store.save();
      if (sfx && sfx.chime) sfx.chime();
      hud(); invUI();
      return true;
    }
    function invUI() {
      var bar = document.getElementById("dginv"); if (!bar) return;
      bar.innerHTML = ITEM_KEYS.map(function (k) {
        var n = stats.items[k] || 0;
        return '<button type="button" class="dgitem" data-item="' + k + '" title="' + ITEMS[k].name + " — " + ITEMS[k].desc + '" style="position:relative;width:48px;height:48px;' +
          'background:rgba(20,16,30,.72);border:2px solid ' + (n ? "rgba(155,232,112,.6)" : "rgba(255,255,255,.14)") + ';border-radius:14px;' +
          'font-size:22px;padding:0;line-height:1;font-family:inherit;cursor:pointer;' + (n ? "" : "opacity:.4;") + '">' + ITEMS[k].emoji +
          (n ? '<span style="position:absolute;right:-4px;top:-6px;background:#ffd23f;color:#3a2a00;border-radius:9px;font-size:11px;font-weight:900;padding:1px 5px">' + n + "</span>" : "") +
          "</button>";
      }).join("");
      Array.prototype.forEach.call(bar.querySelectorAll("[data-item]"), function (b) {
        function useIt(e) { e.preventDefault(); useItem(b.dataset.item); }
        b.addEventListener("touchstart", useIt, { passive: false }); // + mousedown below — preventDefault kills the phantom mouse tap
        b.addEventListener("mousedown", useIt);
      });
    }

    // ---------- taking damage / respawn ----------
    function hurt(n) {
      if (over || player.inv > 0 || shieldT > 0) return;
      n = n || 1;
      hearts -= n; player.inv = 1.1;               // invulnerability blink window
      if (juice) juice.shake(6);
      if (sfx && sfx.buzz) sfx.buzz();
      hud();
      if (hearts <= 0) respawn();
    }
    function respawn() {
      // KIND death: back to the entrance, hearts restored, everything cleared STAYS.
      deaths++; stats.deaths = (stats.deaths || 0) + 1; store.save();
      hearts = maxHearts; player.inv = 1.2; trans = null;
      room = { r: entrance.r, c: entrance.c };
      player.x = MW / 2; player.y = MH - TILE * 1.6; player.dir = "N";
      enterRoom(false);
      big("💫 You fainted — back to the entrance (nothing lost)", "#8ecdf7");
      if (sfx && sfx.buzz) sfx.buzz();
      hud();
    }

    // ---------- doors ----------
    // door geometry: a gap centered on each wall. Returns the door object or null.
    function doorOf(rm, dir) { return rm && rm.doors && rm.doors[dir]; }
    function doorCenter(dir) {
      if (dir === "N") return { x: MW / 2, y: 0 };
      if (dir === "S") return { x: MW / 2, y: MH };
      if (dir === "E") return { x: MW, y: MH / 2 };
      return { x: 0, y: MH / 2 };
    }
    function doorUnlockedKey(dir) { return roomKey(room.r, room.c) + ":" + dir; }
    // nudge the player back off a door threshold so a gate can't re-fire every frame
    function pushOff(dir) {
      var bump = TILE * 0.9;
      if (dir === "N") player.y = bump; else if (dir === "S") player.y = MH - bump;
      else if (dir === "W") player.x = bump; else player.x = MW - bump;
    }
    // walk toward a door: gate it (word/key) or slide to the neighbor. returns
    // true only when a slide actually started.
    function tryDoor(dir) {
      var rm = curRoom(), d = doorOf(rm, dir); if (!d || !d.open) return false;
      if (mobs.length > 0 && !cleared[roomKey(room.r, room.c)]) { pushOff(dir); big("Clear the room first!", "#ffd740"); return false; }
      var uk = doorUnlockedKey(dir);
      if (d.plate && !doorsUnlocked[uk]) { pushOff(dir); big("🔷 Solve the room's puzzle to open this door!", "#ffd740"); return false; }
      if (d.word && !doorsUnlocked[uk]) { pushOff(dir); openWordDoor(dir); return false; }
      if (d.lock && !doorsUnlocked[uk]) {
        pushOff(dir);
        if (keys > 0) { keys--; doorsUnlocked[uk] = true; big("🗝️ Unlocked!", "#ffe14d"); if (sfx && sfx.coin) sfx.coin(); hud(); slideTo(dir); return true; }
        big("🔒 You need a 🗝️ key!", "#ffd740");
        return false;
      }
      slideTo(dir);
      return true;
    }
    function slideTo(dir) {
      var v = STEP[dir], nr = room.r + v.dr, nc = room.c + v.dc;
      if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID || !map[nr][nc]) return;
      trans = { dr: v.dr, dc: v.dc, dir: dir, t: 0 };
      if (sfx && sfx.whoosh) sfx.whoosh();
    }
    // 📜 WORD-DOOR: the rune asks a word. NOT skippable. Correct → open forever.
    function openWordDoor(dir) {
      if (paused || over) return;
      paused = true;
      var uk = doorUnlockedKey(dir);
      cv._lastQ = VQ.miniQuiz(document.getElementById("dgq"), words, store, {
        title: "📜 The rune asks a word…",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            doorsUnlocked[uk] = true;
            big("📜 The rune glows and the door swings open!", "#c9b6ff");
            if (juice) juice.burst(W / 2, H / 2, "#c9b6ff", 18);
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else big("📜 The rune stays sealed — try another route or word.", "#ff8a8a");
        }
      });
    }

    // ---------- boss word-duel ----------
    function duel() {
      var b = boss(); if (!b || !b.shield || paused || over) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("dgq"), words, store, {
        title: "⚔️ The boss demands a WORD! Answer to drop his shield!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            b.shield = false; b.shieldT = 10;      // shield down for 10s, then re-arms
            big("💥 SHIELD DOWN — 10 seconds, GO!", "#69f0ae");
            if (juice) { juice.shake(8); juice.burst(X(b.x), Y(b.y), "#c9b6ff", 24); }
            if (sfx && sfx.fanfare) sfx.fanfare();
            // 🕷 WEBSPINNER calls two baby spiders the moment his shield drops
            if (dungeon === 4) summonSpiders(2, b);
          } else big("The boss laughs at your spelling…", "#ff8a8a");
        }
      });
    }

    function bossDefeated() {
      cleared[roomKey(room.r, room.c)] = true;
      won = true;
      if (dungeon >= stats.lvl && dungeon < 6) { stats.lvl = dungeon + 1; store.save(); }
      if (dungeon === 3) { stats.beatAll = true; store.save(); }   // backward-compat flag (D3 cleared)
      if (dungeon === 6) { stats.beatAll6 = true; store.save(); }  // the whole keep conquered
      stats.clears = (stats.clears || 0) + 1; store.save();
      endRun(true);
    }

    // ---------- reward economy (books.js bankRun pattern) ----------
    function runRewards(w) {
      var gems = (w ? 25 + dungeon * 8 : Math.min(18, 4 + roomsCleared * 2)) + coins;
      var xp = Math.min(90, (w ? 20 + dungeon * 8 : 6 + roomsCleared * 2) + coins);
      var rankPtsDelta = w ? Math.min(12, 4 + dungeon * 2) : Math.min(6, 1 + Math.floor(roomsCleared / 2));
      return { win: !!w, score: roomsCleared * 20 + coins * 2 + (w ? dungeon * 120 : 0), rankPtsDelta: rankPtsDelta, xp: xp, gems: gems };
    }
    function bankRun(w) {
      if (banked) return null;
      banked = true;
      var rw = runRewards(w);
      var res = store.recordGame ? store.recordGame("dungeon", rw) : null;
      return { rw: rw, res: res };
    }
    function bankExit() {
      if (!map || over || (roomsCleared === 0 && coins === 0)) return;
      var b = bankRun(false);
      if (b && sfx && sfx.toast) sfx.toast("🗡️ Dungeon run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }

    function endRun(w) {
      if (over) return; over = true; paused = true; won = w;
      var bank = bankRun(w) || { rw: runRewards(w), res: null };
      var rw = bank.rw, res = bank.res;
      var end = document.getElementById("dgend");
      var title = w ? (dungeon === 6 ? "👑 THE WORDLESS KING FALLS! You conquered the whole keep!" : dungeon === 3 ? "🐲 VOWELZILLA IS SLAIN! Three dungeons down!" : "🏆 " + BOSSES[dungeon].emoji + " " + BOSSES[dungeon].name + " is defeated!") : "💀 The dungeon was too much…";
      var payRow = '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP</div>";
      end.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:44px">' + (w ? "🏆" : "💀") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + title + "</div>" + payRow +
        '<div style="margin:2px 0">🚪 ' + roomsCleared + " rooms cleared · 💀 " + deaths + " faints · 📜 " + Object.keys(doorsUnlocked).length + " doors opened" + (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        '<button class="submit big-next" id="dgnext">' + (w && dungeon < 6 ? "Next dungeon ➜" : "Dungeon select") + "</button></div>";
      end.style.display = "flex";
      if (w && sfx && sfx.fanfare) sfx.fanfare();
      if (w && juice) { juice.shake(6); for (var i = 0; i < 5; i++) juice.burst(W * (0.2 + i * 0.15), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][i], 16); }
      document.getElementById("dgnext").onclick = function () {
        if (w && dungeon < 6) begin(dungeon + 1); else showSelect();
      };
    }

    // ---------- treasure chest (asks nothing — pure reward) ----------
    function openChest() {
      var rm = curRoom(); if (!rm || rm.t !== "treasure") return;
      var k = roomKey(room.r, room.c);
      if (chestOpened[k]) return;
      chestOpened[k] = true;
      var pay = 8 + dungeon * 4 + Math.floor(Math.random() * 6);
      coins += pay;
      big("💰 Treasure! +" + pay + (rm.heart ? " and a ❤️!" : ""), "#ffd23f");
      if (rm.heart) { maxHearts = Math.min(5, maxHearts + 1); hearts = Math.min(maxHearts, hearts + 1); }
      findItem(ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)]); // chests always hold a power-up
      if (juice) juice.burst(X(MW / 2), Y(MH / 2), "#ffd23f", 20);
      if (sfx && sfx.coin) sfx.coin();
      hud();
    }

    // ---------- 🧩 Zelda-style puzzle rooms (block / torch / plates) ----------
    var BLOCKSTEP = 80, BLOCKMIN = 120, BLOCKMAX = 360;
    function curPuzzle() { var rm = curRoom(); if (!rm || rm.t !== "puzzle") return null; return puzzles[roomKey(room.r, room.c)] || null; }
    // build fresh runtime state from a room's puzzle config
    function initPuzzle(cfg) {
      if (!cfg) return null;
      if (cfg.kind === "block") {
        return { kind: "block", solved: false, bx: cfg.start.x, by: cfg.start.y,
          plate: cfg.plate, door: cfg.door, lever: cfg.lever, pushCd: 0 };
      }
      if (cfg.kind === "torch") {
        // ascending-rune solution order (indices sorted by rune)
        var order = cfg.torches.map(function (tt, i) { return i; }).sort(function (a, b) { return cfg.torches[a].rune - cfg.torches[b].rune; });
        return { kind: "torch", solved: false, torches: cfg.torches, order: order, lit: [], door: cfg.door, flick: 0 };
      }
      // plates: flash a sequence, then step them in order (wrong just replays)
      return { kind: "plates", solved: false, seq: cfg.seq.slice(), plates: cfg.plates, step: 0, onPlate: -1,
        showT: 0.6 * cfg.seq.length + 0.8, flashIdx: -1 };
    }
    // seal/open the {plate:true} doors of a room (both sides) once its puzzle is solved
    function unlockPlateDoors(r, c) {
      var rm = map[r] && map[r][c]; if (!rm) return;
      ["N", "S", "E", "W"].forEach(function (dir) {
        var d = rm.doors[dir]; if (!d || !d.plate) return;
        doorsUnlocked[roomKey(r, c) + ":" + dir] = true;
        var st = STEP[dir], nr = r + st.dr, nc = c + st.dc;
        if (map[nr] && map[nr][nc]) doorsUnlocked[roomKey(nr, nc) + ":" + OPP[dir]] = true;
      });
    }
    function solvePuzzle(ps) {
      if (!ps || ps.solved) return;
      ps.solved = true;
      unlockPlateDoors(room.r, room.c);
      var pay = 5 + dungeon * 2; coins += pay;
      big("✨ Puzzle solved! +💰" + pay, "#9be870");
      if (juice) juice.burst(X(MW / 2), Y(MH / 2), "#9be870", 22);
      if (sfx && sfx.fanfare) sfx.fanfare();
      // the plate-sequence room hands out a bonus power-up
      if (ps.kind === "plates") findItem(ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)]);
      hud();
    }
    // 🟫 shove the push-block one grid step; snaps to grid, stops at walls, solves on the plate
    function pushBlock(dir) {
      var ps = curPuzzle(); if (!ps || ps.kind !== "block" || ps.solved) return;
      var st = STEP[dir]; var nx = ps.bx + st.dc * BLOCKSTEP, ny = ps.by + st.dr * BLOCKSTEP;
      if (nx < BLOCKMIN || nx > BLOCKMAX || ny < BLOCKMIN || ny > BLOCKMAX) return; // wall — cornered? use the 🔄 lever
      ps.bx = nx; ps.by = ny;
      if (sfx && sfx.thud) sfx.thud(); else if (sfx && sfx.pop) sfx.pop();
      if (Math.abs(ps.bx - ps.plate.x) < 12 && Math.abs(ps.by - ps.plate.y) < 12) solvePuzzle(ps);
    }
    function resetBlock() {
      var ps = curPuzzle(); if (!ps || ps.kind !== "block" || ps.solved) return;
      var cfg = curRoom().puzzle; ps.bx = cfg.start.x; ps.by = cfg.start.y;
      big("🔄 The block resets.", "#8ecdf7"); if (sfx && sfx.buzz) sfx.buzz();
    }
    // 🕯 light torches in ascending-rune order; a wrong tap flickers them all out
    function tapTorch(i) {
      var ps = curPuzzle(); if (!ps || ps.kind !== "torch" || ps.solved) return;
      if (ps.lit.indexOf(i) >= 0) return;
      var expect = ps.order[ps.lit.length];
      if (i === expect) {
        ps.lit.push(i);
        if (sfx && sfx.chime) sfx.chime();
        if (juice) juice.burst(X(ps.torches[i].x), Y(ps.torches[i].y - 20), "#ffb347", 8);
        if (ps.lit.length >= ps.order.length) solvePuzzle(ps);
      } else {
        ps.lit = []; ps.flick = 0.5;
        big("🕯 A gust! The torches flicker out — try ascending order.", "#ffd740");
        if (sfx && sfx.buzz) sfx.buzz();
      }
    }
    // 🎛 step the memory plates in the flashed order; a wrong step just replays (never hurts)
    function stepPlate(i) {
      var ps = curPuzzle(); if (!ps || ps.kind !== "plates" || ps.solved) return;
      if (ps.showT > 0) return;                    // still demonstrating the sequence
      if (i === ps.seq[ps.step]) {
        ps.step++;
        if (juice) juice.burst(X(ps.plates[i].x), Y(ps.plates[i].y), "#69f0ae", 8);
        if (sfx && sfx.chime) sfx.chime();
        if (ps.step >= ps.seq.length) solvePuzzle(ps);
      } else {
        ps.step = 0; ps.showT = 0.6 * ps.seq.length + 0.8;   // replay the sequence, kindly
        big("🎛 Not quite — watch the lights again!", "#ffd740");
        if (sfx && sfx.buzz) sfx.buzz();
      }
    }
    // update per-frame puzzle timers + in-room interactions (block shove, plate stepping)
    function stepPuzzle(dt, rm) {
      var ps = puzzles[roomKey(room.r, room.c)]; if (!ps) return;
      if (ps.kind === "block" && !ps.solved) {
        ps.pushCd = Math.max(0, ps.pushCd - dt);
        // solid block: resolve overlap + shove it when the player walks into it
        var half = 30, dx = player.x - ps.bx, dy = player.y - ps.by;
        if (Math.abs(dx) < half + PR && Math.abs(dy) < half + PR) {
          var pushDir = null;
          if (Math.abs(moveVec.x) > Math.abs(moveVec.y)) { if (Math.abs(moveVec.x) > 0.1) pushDir = moveVec.x > 0 ? "E" : "W"; }
          else if (Math.abs(moveVec.y) > 0.1) pushDir = moveVec.y > 0 ? "S" : "N";
          if (pushDir && ps.pushCd <= 0) { pushBlock(pushDir); ps.pushCd = 0.28; }
          // keep the player from sliding through the block (push out on the lesser-penetration axis)
          var ox = (half + PR) - Math.abs(dx), oy = (half + PR) - Math.abs(dy);
          if (ox < oy) player.x = ps.bx + (dx < 0 ? -1 : 1) * (half + PR);
          else player.y = ps.by + (dy < 0 ? -1 : 1) * (half + PR);
        }
      } else if (ps.kind === "plates" && !ps.solved) {
        if (ps.showT > 0) {
          ps.showT -= dt;
          var t = ps.showT; var idx = Math.floor((0.6 * ps.seq.length + 0.8 - t) / 0.6);
          ps.flashIdx = (idx >= 0 && idx < ps.seq.length && ((0.6 * ps.seq.length + 0.8 - t) % 0.6) < 0.4) ? ps.seq[idx] : -1;
        } else {
          ps.flashIdx = -1;
          // stand on a plate to register a step (must leave before it counts again)
          var on = -1;
          for (var pi = 0; pi < ps.plates.length; pi++) {
            if (Math.hypot(player.x - ps.plates[pi].x, player.y - ps.plates[pi].y) < 34) { on = pi; break; }
          }
          if (on >= 0 && on !== ps.onPlate) stepPlate(on);
          ps.onPlate = on;
        }
      } else if (ps.kind === "torch" && !ps.solved) {
        ps.flick = Math.max(0, ps.flick - dt);
      }
    }

    // ---------- hazard zones (web slow-fields, fire pools, shadow bolts) ----------
    function stepZones(dt) {
      for (var zi = zones.length - 1; zi >= 0; zi--) {
        var z = zones[zi];
        if (z.warn > 0) { z.warn -= dt; continue; }   // telegraph wind-up: no damage yet
        if (z.vx || z.vy) { z.x += z.vx * dt; z.y += z.vy * dt; }
        z.life -= dt;
        if (z.life <= 0 || z.x < -20 || z.x > MW + 20 || z.y < -20 || z.y > MH + 20) { zones.splice(zi, 1); continue; }
        if ((z.kind === "fire" || z.kind === "bolt") && player.inv <= 0 && shieldT <= 0) {
          if (Math.hypot(player.x - z.x, player.y - z.y) < z.r + PR - 6) hurt(1);
        }
      }
    }
    // is the player standing in an active 🕸 web slow-field?
    function inWeb() {
      for (var i = 0; i < zones.length; i++) {
        var z = zones[i];
        if (z.kind === "web" && z.warn <= 0 && Math.hypot(player.x - z.x, player.y - z.y) < z.r + PR - 4) return true;
      }
      return false;
    }

    // ---------- deeper-boss attacks (all telegraphed + dodgeable; clean up on room exit) ----------
    function summonSpiders(n, b) {
      for (var i = 0; i < n; i++) {
        var a = Math.PI * (0.5 + i * 0.6);
        mobs.push({ type: "spiderling", x: Math.max(ER, Math.min(MW - ER, b.x + Math.cos(a) * 60)),
          y: Math.max(ER, Math.min(MH - ER, b.y + Math.sin(a) * 60)), hp: 1, maxHp: 1, phase: Math.random() * 6, hit: 0 });
      }
      big("🕷 WEBSPINNER calls baby spiders!", "#c9b6ff");
    }
    // 🕷 WEBSPINNER: sticky web blobs that slow the floor
    function webspinner(mob, dt) {
      mob.webCd -= dt;
      if (mob.webCd <= 0) {
        mob.webCd = 1.5;
        // a blob lands where the player is standing (dodge by keeping moving)
        zones.push({ kind: "web", x: player.x, y: player.y, r: 62, life: 6, warn: 0 });
        if (sfx && sfx.whoosh) sfx.whoosh();
      }
    }
    // 🌋 CINDERJAW: telegraphed fire pools (target circle, then a burning zone)
    function cinderjaw(mob, dt) {
      mob.fireCd -= dt;
      if (mob.fireCd <= 0) {
        mob.fireCd = 2.6;
        zones.push({ kind: "fire", x: player.x, y: player.y, r: 52, life: 4, warn: 1 }); // 1s warn, then 4s burn
        big("🌋 Fire pool incoming — step off the circle!", "#ff8a5c");
        if (sfx && sfx.buzz) sfx.buzz();
      }
    }
    // 👑 THE WORDLESS KING: teleport, a 4-way shadow-bolt cross, and a half-hp split
    function wordlessKing(mob, dt) {
      // teleport: vanish → reappear near the player
      mob.tpCd -= dt;
      if (mob.tpCd <= 0) {
        mob.tpCd = 2.8;
        var a = Math.random() * Math.PI * 2, dist = 120;
        mob.x = Math.max(BOSSES[6].r, Math.min(MW - BOSSES[6].r, player.x + Math.cos(a) * dist));
        mob.y = Math.max(BOSSES[6].r, Math.min(MH - BOSSES[6].r, player.y + Math.sin(a) * dist));
        mob.charge = 0; mob.chargeCd = 1.4;
        if (juice) { juice.burst(X(mob.x), Y(mob.y), "#b39ddb", 16); juice.shake(4); }
      }
      // shadow bolts in a telegraphed 4-way cross
      mob.boltCd -= dt;
      if (mob.boltCd <= 0) {
        mob.boltCd = 2.2;
        var sp = 150;
        [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].forEach(function (d) {
          zones.push({ kind: "bolt", x: mob.x, y: mob.y, r: 15, life: 3, warn: 0.5, vx: d.x * sp, vy: d.y * sp });
        });
        big("👑 Shadow cross — mind the bolts!", "#c9b6ff");
      }
      // at half hp: split into decoy shades (only the real king takes damage)
      if (!mob.split && mob.hp <= mob.maxHp / 2) {
        mob.split = true;
        for (var i = 0; i < 2; i++) {
          var a2 = Math.PI * (0.4 + i * 0.9);
          mobs.push({ type: "shade", fake: true, x: Math.max(40, Math.min(MW - 40, mob.x + Math.cos(a2) * 110)),
            y: Math.max(40, Math.min(MH - 40, mob.y + Math.sin(a2) * 110)), hp: 1, maxHp: 1, phase: Math.random() * 6, hit: 0 });
        }
        big("👑 The king splits into shades — find the real one!", "#c9b6ff");
        if (juice) juice.shake(6);
      }
    }

    // ---------- simulation ----------
    function step(dt) {
      player.inv = Math.max(0, player.inv - dt);
      swingT = Math.max(0, swingT - dt);
      swingCd = Math.max(0, swingCd - dt);
      speedT = Math.max(0, speedT - dt);
      shieldT = Math.max(0, shieldT - dt);
      spinT = Math.max(0, spinT - dt);

      // room transition slide: freeze play, glide the camera, then land the player
      if (trans) {
        trans.t += dt / 0.32;
        if (trans.t >= 1) {
          room.r += trans.dr; room.c += trans.dc;
          // land just inside the opposite door
          var dir = trans.dir;
          if (dir === "N") { player.y = MH - PR * 2; player.x = MW / 2; }
          else if (dir === "S") { player.y = PR * 2; player.x = MW / 2; }
          else if (dir === "E") { player.x = PR * 2; player.y = MH / 2; }
          else { player.x = MW - PR * 2; player.y = MH / 2; }
          trans = null;
          enterRoom(false);
        }
        return;
      }

      // hazard zones (web/fire/bolts) tick every live frame, dt-driven
      stepZones(dt);

      // ---------- movement (keyboard OR drag stick, unified into moveVec) ----------
      var mvx = moveVec.x, mvy = moveVec.y;
      if (keyHeld.W || keyHeld.ArrowUp) mvy -= 1;
      if (keyHeld.S || keyHeld.ArrowDown) mvy += 1;
      if (keyHeld.A || keyHeld.ArrowLeft) mvx -= 1;
      if (keyHeld.D || keyHeld.ArrowRight) mvx += 1;
      var mag = Math.hypot(mvx, mvy);
      if (mag > 1) { mvx /= mag; mvy /= mag; mag = 1; }
      if (mag > 0.05) {
        setDir(mvx, mvy);
        var SPD = speedT > 0 ? 270 : 180;  // 💨 Zoom Boots
        if (inWeb()) SPD *= 0.5;            // 🕸 web slow-field halves your speed
        player.x += mvx * SPD * dt;
        player.y += mvy * SPD * dt;
      }
      // knockback decays
      if (kb.x || kb.y) {
        player.x += kb.x * dt; player.y += kb.y * dt;
        kb.x *= Math.max(0, 1 - dt * 8); kb.y *= Math.max(0, 1 - dt * 8);
        if (Math.abs(kb.x) < 4 && Math.abs(kb.y) < 4) { kb.x = 0; kb.y = 0; }
      }

      // walls + doorway crossing. A wall margin; a gap centered on each door.
      // In a door gap: pushing past the threshold triggers tryDoor (which slides
      // or asks the word/key). Otherwise the wall stops you flat.
      var margin = TILE * 0.7, doorHalf = TILE * 1.1, cross = margin * 0.4;
      var rm = curRoom();
      function inHGap() { return Math.abs(player.x - MW / 2) < doorHalf; }
      function inVGap() { return Math.abs(player.y - MH / 2) < doorHalf; }
      if (player.y < margin) {
        if (inHGap() && doorOf(rm, "N")) { if (player.y < cross) tryDoor("N"); }
        else player.y = margin;
      }
      if (player.y > MH - margin) {
        if (inHGap() && doorOf(rm, "S")) { if (player.y > MH - cross) tryDoor("S"); }
        else player.y = MH - margin;
      }
      if (player.x < margin) {
        if (inVGap() && doorOf(rm, "W")) { if (player.x < cross) tryDoor("W"); }
        else player.x = margin;
      }
      if (player.x > MW - margin) {
        if (inVGap() && doorOf(rm, "E")) { if (player.x > MW - cross) tryDoor("E"); }
        else player.x = MW - margin;
      }

      // treasure: standing near the chest opens it
      if (rm && rm.t === "treasure" && !chestOpened[roomKey(room.r, room.c)]) {
        if (Math.hypot(player.x - MW / 2, player.y - MH / 2) < 50) openChest();
      }
      // 🧩 puzzle rooms: block shove / plate stepping / timers
      if (rm && rm.t === "puzzle") stepPuzzle(dt, rm);

      // ---------- enemies ----------
      // snapshot the list: a touch can trigger respawn(), which swaps in a whole
      // new room's mobs mid-loop — iterating the fresh array would read garbage.
      var bdef = BOSSES[dungeon], list = mobs;
      for (var i = list.length - 1; i >= 0; i--) {
        if (mobs !== list) break;                    // respawned / changed rooms — bail
        var mob = list[i];
        mob.hit = Math.max(0, mob.hit - dt);
        mob.phase += dt;
        if (mob.type === "boss") {
          if (mob.shieldT > 0) { mob.shieldT -= dt; if (mob.shieldT <= 0 && !mob.shield) { mob.shield = true; big("🛡 THE SHIELD RE-ARMS!", "#ff8a8a"); if (sfx && sfx.buzz) sfx.buzz(); } }
          // charge-then-pause: wind up toward the player, dash, then rest.
          // (The WORDLESS KING moves by teleport instead — bosses 1-5 keep the charge.)
          if (dungeon !== 6) {
            mob.chargeCd -= dt;
            if (mob.charge > 0) {
              mob.charge -= dt;
              mob.x += mob.cvx * dt; mob.y += mob.cvy * dt;
            } else if (mob.chargeCd <= 0) {
              var ddx = player.x - mob.x, ddy = player.y - mob.y, dd = Math.hypot(ddx, ddy) || 1;
              mob.cvx = ddx / dd * bdef.speed; mob.cvy = ddy / dd * bdef.speed;
              mob.charge = 0.9; mob.chargeCd = 1.6;
            }
          }
          // deeper bosses layer on their signature telegraphed attacks
          if (dungeon === 4) webspinner(mob, dt);
          else if (dungeon === 5) cinderjaw(mob, dt);
          else if (dungeon === 6) wordlessKing(mob, dt);
          mob.x = Math.max(bdef.r, Math.min(MW - bdef.r, mob.x));
          mob.y = Math.max(bdef.r, Math.min(MH - bdef.r, mob.y));
        } else {
          var d = MOBS[mob.type];
          if (d.kind === "wander") {
            if (!mob.wt || mob.wt <= 0) { mob.wa = Math.random() * Math.PI * 2; mob.wt = 0.8 + Math.random(); }
            mob.wt -= dt;
            mob.x += Math.cos(mob.wa) * d.speed * dt; mob.y += Math.sin(mob.wa) * d.speed * dt;
          } else if (d.kind === "swoop") {
            var bx = player.x - mob.x, by = player.y - mob.y, bl = Math.hypot(bx, by) || 1;
            var perp = Math.sin(mob.phase * 4) * 40;      // sine-swoop toward the player
            mob.x += (bx / bl * d.speed + (-by / bl) * perp) * dt;
            mob.y += (by / bl * d.speed + (bx / bl) * perp) * dt;
          } else { // chase
            var cx = player.x - mob.x, cy = player.y - mob.y, cl = Math.hypot(cx, cy) || 1;
            mob.x += cx / cl * d.speed * dt; mob.y += cy / cl * d.speed * dt;
          }
          // keep the little guys on the floor
          mob.x = Math.max(ER, Math.min(MW - ER, mob.x));
          mob.y = Math.max(ER, Math.min(MH - ER, mob.y));
        }
        // touch damage + knockback + brief invuln
        var mr = mob.type === "boss" ? bdef.r : MOBS[mob.type].r;
        var tx = player.x - mob.x, ty = player.y - mob.y, td = Math.hypot(tx, ty);
        if (td < PR + mr && player.inv <= 0 && !mob.fake) {   // decoy shades never hurt you
          hurt(1);
          var kl = td || 1; kb.x = tx / kl * 260; kb.y = ty / kl * 260;
        }
      }
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // dungeon backdrop
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#241d2e"); g.addColorStop(1, "#15101c");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (!map) return;

      // camera offset during a slide transition (the room glides in)
      var camx = 0, camy = 0;
      if (trans) { var e = trans.t * trans.t * (3 - 2 * trans.t); camx = -trans.dc * MW * e; camy = -trans.dr * MH * e; }
      drawRoom(room.r, room.c, camx, camy, true);
      if (trans) drawRoom(room.r + trans.dr, room.c + trans.dc, camx + trans.dc * MW, camy + trans.dr * MH, false);

      drawMiniMap();
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    function drawRoom(rr, rc, camx, camy, live) {
      var rm = map[rr] && map[rr][rc]; if (!rm) return;
      var ox = OX + camx * S, oy = OY + camy * S;
      function LX(x) { return ox + x * S; }
      function LY(y) { return oy + y * S; }
      // floor
      ctx.fillStyle = rm.t === "boss" ? "#3a2434" : rm.t === "treasure" ? "#3a3320" : rm.t === "puzzle" ? "#1f3038" : "#2c2438";
      ctx.fillRect(LX(0), LY(0), MW * S, MH * S);
      // stone tile grid
      ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1;
      for (var gx = 1; gx < 8; gx++) { ctx.beginPath(); ctx.moveTo(LX(gx * MW / 8), LY(0)); ctx.lineTo(LX(gx * MW / 8), LY(MH)); ctx.stroke(); }
      for (var gy = 1; gy < 8; gy++) { ctx.beginPath(); ctx.moveTo(LX(0), LY(gy * MH / 8)); ctx.lineTo(LX(MW), LY(gy * MH / 8)); ctx.stroke(); }
      // walls with doorway gaps
      var wall = "#4a3a5c", wt = pz(TILE * 0.5);
      ctx.fillStyle = wall;
      ["N", "S", "E", "W"].forEach(function (dir) {
        var horiz = dir === "N" || dir === "S";
        var has = doorOf(rm, dir);
        if (horiz) {
          var yy = dir === "N" ? LY(0) : LY(MH) - wt;
          if (has) {
            var gapc = LX(MW / 2), gw = pz(TILE * 2.2);
            ctx.fillRect(LX(0), yy, gapc - gw / 2 - LX(0), wt);
            ctx.fillRect(gapc + gw / 2, yy, LX(MW) - (gapc + gw / 2), wt);
          } else ctx.fillRect(LX(0), yy, MW * S, wt);
        } else {
          var xx = dir === "W" ? LX(0) : LX(MW) - wt;
          if (has) {
            var gapcy = LY(MH / 2), gh = pz(TILE * 2.2);
            ctx.fillRect(xx, LY(0), wt, gapcy - gh / 2 - LY(0));
            ctx.fillRect(xx, gapcy + gh / 2, wt, LY(MH) - (gapcy + gh / 2));
          } else ctx.fillRect(xx, LY(0), wt, MH * S);
        }
        // door glyph: 📜 rune (word) / 🔒 locked / open arch
        if (has) {
          var dc = doorCenter(dir);
          var ulk = doorsUnlocked[roomKey(rr, rc) + ":" + dir];
          var locked = (has.word && !ulk) || (has.lock && !ulk) || (has.plate && !ulk);
          if (locked) {
            ctx.font = Math.round(pz(30)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(has.word ? "📜" : has.plate ? "🔷" : "🔒", LX(dc.x), LY(dc.y));
          }
        }
      });
      // room contents
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (rm.t === "treasure") {
        var opened = chestOpened[roomKey(rr, rc)];
        ctx.font = Math.round(pz(46)) + "px serif";
        ctx.fillText(opened ? "📭" : "💰", LX(MW / 2), LY(MH / 2));
      } else if (rm.t === "key") {
        // the 🗝️ hovers as the reward; dims once collected (room cleared)
        var got = cleared[roomKey(rr, rc)];
        if (got) ctx.globalAlpha = 0.3;
        ctx.font = Math.round(pz(28)) + "px serif";
        ctx.fillText("🗝️", LX(MW / 2), LY(56));
        if (got) ctx.globalAlpha = 1;
      } else if (rm.t === "puzzle") {
        drawPuzzle(rr, rc, LX, LY);
      }
      // hazard zones (web/fire/bolts) — only in the live room
      if (live) drawZones(LX, LY);
      // enemies (only for the live room)
      if (live) {
        mobs.forEach(function (mob) {
          var isBoss = mob.type === "boss";
          var mr = isBoss ? BOSSES[dungeon].r : MOBS[mob.type].r;
          var sc = pz(mr * (isBoss ? 2.2 : 1.7));
          if (mob.hit > 0) { ctx.save(); ctx.globalAlpha = 0.5; }
          ctx.font = Math.round(sc) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(isBoss ? BOSSES[dungeon].emoji : MOBS[mob.type].emoji, LX(mob.x), LY(mob.y) + Math.sin(mob.phase * 3) * pz(3));
          if (mob.hit > 0) ctx.restore();
          // hp bar
          if (mob.maxHp > 1 || isBoss) {
            var f = Math.max(0, mob.hp / mob.maxHp), bw = sc * 0.9;
            ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(LX(mob.x) - bw / 2, LY(mob.y) - sc * 0.62, bw, 5);
            ctx.fillStyle = "#ff8a8a"; ctx.fillRect(LX(mob.x) - bw / 2, LY(mob.y) - sc * 0.62, bw * f, 5);
          }
          // boss word-shield ring + prompt
          if (isBoss && mob.shield) {
            ctx.strokeStyle = "rgba(201,182,255," + (0.5 + Math.sin(mob.phase * 6) * 0.25) + ")"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(LX(mob.x), LY(mob.y), sc * 0.62, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "#c9b6ff"; ctx.font = "bold " + Math.round(pz(16)) + "px Trebuchet MS"; ctx.textAlign = "center";
            ctx.fillText("TAP + WORD!", LX(mob.x), LY(mob.y) - sc * 0.75);
          }
        });
        // 🌀 spin-slash flash: a full ring around the player
        if (spinT > 0) {
          ctx.strokeStyle = "rgba(201,182,255," + (spinT / 0.35) + ")"; ctx.lineWidth = pz(8); ctx.lineCap = "round";
          ctx.beginPath(); ctx.arc(LX(player.x), LY(player.y), pz(PR + 30 + (0.35 - spinT) * 260), 0, Math.PI * 2); ctx.stroke();
        }
        // 🛡️ bubble shield
        if (shieldT > 0) {
          ctx.strokeStyle = "rgba(105,240,174," + (0.35 + Math.sin(player.phase * 6) * 0.2) + ")"; ctx.lineWidth = pz(4);
          ctx.beginPath(); ctx.arc(LX(player.x), LY(player.y), pz(PR + 14), 0, Math.PI * 2); ctx.stroke();
        }
        // 💨 zoom trail
        if (speedT > 0 && juice && Math.random() < 0.4) juice.burst(LX(player.x), LY(player.y) + pz(PR), "#8ecdf7", 2);
        // sword arc
        if (swingT > 0) {
          var ax = { N: 0, S: 0, E: 1, W: -1 }[player.dir], ay = { N: -1, S: 1, E: 0, W: 0 }[player.dir];
          var base = Math.atan2(ay, ax), sweep = (1 - swingT / 0.3) * 1.4 - 0.7;
          ctx.strokeStyle = "rgba(230,240,255,.85)"; ctx.lineWidth = pz(6); ctx.lineCap = "round";
          ctx.beginPath(); ctx.arc(LX(player.x), LY(player.y), pz(PR + 30), base + sweep - 0.5, base + sweep + 0.5); ctx.stroke();
        }
        // player avatar (feet-anchored)
        if (AV && AV.draw) {
          var pose = swingT > 0 ? "swing" : (Math.hypot(moveVec.x + (keyHeld.A ? -1 : 0) + (keyHeld.D ? 1 : 0), moveVec.y + (keyHeld.W ? -1 : 0) + (keyHeld.S ? 1 : 0)) > 0.1 ? "run" : "idle");
          var blink = player.inv > 0 && Math.floor(player.inv * 12) % 2 === 0;
          if (blink) ctx.globalAlpha = 0.4;
          AV.draw(ctx, { x: LX(player.x), y: LY(player.y) + pz(PR), size: pz(PR * 3), config: cfg, pose: pose, frame: player.phase || (lastT / 1000), flip: player.dir === "W", name: "" });
          if (blink) ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = "#40c4ff"; ctx.beginPath(); ctx.arc(LX(player.x), LY(player.y), pz(PR), 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // 🧩 draw a puzzle room's contents (block+plate+lever / torches / plates)
    function drawPuzzle(rr, rc, LX, LY) {
      var ps = puzzles[roomKey(rr, rc)]; if (!ps) return;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (ps.kind === "block") {
        // glowing pressure plate
        var pulse = 0.4 + Math.sin((lastT / 200)) * 0.2;
        ctx.strokeStyle = ps.solved ? "rgba(105,240,174,.9)" : "rgba(255,225,77," + pulse + ")"; ctx.lineWidth = pz(4);
        ctx.beginPath(); ctx.arc(LX(ps.plate.x), LY(ps.plate.y), pz(26), 0, Math.PI * 2); ctx.stroke();
        // the push-block
        ctx.font = Math.round(pz(52)) + "px serif"; ctx.fillText("🟫", LX(ps.bx), LY(ps.by));
        // reset lever
        if (!ps.solved && ps.lever) { ctx.font = Math.round(pz(26)) + "px serif"; ctx.fillText("🔄", LX(ps.lever.x), LY(ps.lever.y)); }
      } else if (ps.kind === "torch") {
        for (var i = 0; i < ps.torches.length; i++) {
          var tt = ps.torches[i], lit = ps.solved || ps.lit.indexOf(i) >= 0;
          if (ps.flick > 0 && !ps.solved) { ctx.save(); ctx.globalAlpha = 0.5; }
          ctx.font = Math.round(pz(34)) + "px serif"; ctx.fillText(lit ? "🔥" : "🕯", LX(tt.x), LY(tt.y));
          if (ps.flick > 0 && !ps.solved) ctx.restore();
          ctx.fillStyle = "#ffe14d"; ctx.font = "bold " + Math.round(pz(18)) + "px Trebuchet MS";
          ctx.fillText(String(tt.rune), LX(tt.x), LY(tt.y) - pz(34));
        }
      } else if (ps.kind === "plates") {
        for (var j = 0; j < ps.plates.length; j++) {
          var pl = ps.plates[j], flash = ps.flashIdx === j, done = j < ps.step;
          ctx.fillStyle = flash ? "rgba(105,240,174,.9)" : done ? "rgba(105,240,174,.4)" : "rgba(255,255,255,.16)";
          ctx.beginPath(); ctx.arc(LX(pl.x), LY(pl.y), pz(24), 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = pz(3);
          ctx.beginPath(); ctx.arc(LX(pl.x), LY(pl.y), pz(24), 0, Math.PI * 2); ctx.stroke();
        }
        if (ps.solved) { ctx.font = Math.round(pz(30)) + "px serif"; ctx.fillText("✨", LX(MW / 2), LY(MH / 2)); }
      }
    }

    // draw active hazard zones (🕸 web slow-field, 🔥 fire pool, shadow bolts)
    function drawZones(LX, LY) {
      for (var i = 0; i < zones.length; i++) {
        var z = zones[i];
        if (z.kind === "web") {
          ctx.fillStyle = "rgba(210,225,255,.18)"; ctx.beginPath(); ctx.arc(LX(z.x), LY(z.y), pz(z.r), 0, Math.PI * 2); ctx.fill();
          ctx.font = Math.round(pz(30)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.globalAlpha = 0.7; ctx.fillText("🕸", LX(z.x), LY(z.y)); ctx.globalAlpha = 1;
        } else if (z.kind === "fire") {
          if (z.warn > 0) {   // telegraph: a target circle you can still step off
            ctx.strokeStyle = "rgba(255,120,80," + (0.4 + Math.sin(lastT / 90) * 0.3) + ")"; ctx.lineWidth = pz(4);
            ctx.beginPath(); ctx.arc(LX(z.x), LY(z.y), pz(z.r), 0, Math.PI * 2); ctx.stroke();
          } else {
            ctx.fillStyle = "rgba(255,110,50,.28)"; ctx.beginPath(); ctx.arc(LX(z.x), LY(z.y), pz(z.r), 0, Math.PI * 2); ctx.fill();
            ctx.font = Math.round(pz(28)) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🔥", LX(z.x), LY(z.y));
          }
        } else if (z.kind === "bolt") {
          ctx.fillStyle = z.warn > 0 ? "rgba(179,157,219,.5)" : "rgba(120,90,180,.9)";
          ctx.beginPath(); ctx.arc(LX(z.x), LY(z.y), pz(z.r), 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // mini-map: visited rooms + your position. TOP-right just under the HUD —
    // the bottom-right corner now belongs to the ⚔ attack cross.
    function drawMiniMap() {
      var cell = compact ? 12 : 15, pad = 4, mw = GRID * cell + pad * 2;
      var mx = W - mw - 8, my = (compact ? 92 : 122) + pad;
      ctx.fillStyle = "rgba(0,0,0,.45)"; rrect(mx - pad, my - pad, mw, GRID * cell + pad * 2, 6); ctx.fill();
      for (var r = 0; r < GRID; r++) for (var c = 0; c < GRID; c++) {
        var rm = map[r] && map[r][c]; if (!rm) continue;
        var vx = mx + c * cell, vy = my + r * cell;
        var vis = visited[roomKey(r, c)];
        ctx.fillStyle = !vis ? "rgba(255,255,255,.12)" : rm.t === "boss" ? "#c0518a" : rm.t === "treasure" ? "#c6a94e" : rm.t === "key" ? "#5b8ac6" : rm.t === "puzzle" ? "#3fb6a8" : "#6a5a7c";
        ctx.fillRect(vx + 1, vy + 1, cell - 2, cell - 2);
        if (r === room.r && c === room.c) { ctx.fillStyle = "#ffe14d"; ctx.beginPath(); ctx.arc(vx + cell / 2, vy + cell / 2, cell * 0.25, 0, Math.PI * 2); ctx.fill(); }
      }
    }

    // ---------- input (phantom-tap safe) ----------
    // Sword = a SHORT discrete tap (<150ms, <10px). Movement = a longer/moving drag
    // (virtual stick: move toward the drag direction, relative to the start point).
    var touchStart = null, touchTime = 0, dragging = false;
    function screenToLogical(sx, sy) { return { x: (sx - OX) / S, y: (sy - OY) / S }; }
    function tapAt(sx, sy) {
      // did we tap the boss (through his shield)? open the duel.
      var b = boss();
      if (b) {
        var lg = screenToLogical(sx, sy);
        if (Math.hypot(lg.x - b.x, lg.y - b.y) < BOSSES[dungeon].r + 24 && b.shield) { duel(); return; }
      }
      // 🧩 puzzle taps: light a torch / flip the reset lever
      var ps = curPuzzle();
      if (ps && !paused && !trans) {
        var lg2 = screenToLogical(sx, sy);
        if (ps.kind === "torch") {
          for (var i = 0; i < ps.torches.length; i++) {
            if (Math.hypot(lg2.x - ps.torches[i].x, lg2.y - ps.torches[i].y) < 40) { tapTorch(i); return; }
          }
        } else if (ps.kind === "block" && ps.lever && !ps.solved) {
          if (Math.hypot(lg2.x - ps.lever.x, lg2.y - ps.lever.y) < 36) { resetBlock(); return; }
        }
      }
      swing();
    }
    cv.addEventListener("touchstart", function (e) {
      e.preventDefault();
      var r = cv.getBoundingClientRect(), tch = e.changedTouches[0];
      touchStart = { x: tch.clientX - r.left, y: tch.clientY - r.top };
      touchTime = performance.now(); dragging = false;
    }, { passive: false });
    cv.addEventListener("touchmove", function (e) {
      if (!touchStart) return;
      e.preventDefault();
      var r = cv.getBoundingClientRect(), tch = e.changedTouches[0];
      var cx = tch.clientX - r.left, cy = tch.clientY - r.top;
      var dx = cx - touchStart.x, dy = cy - touchStart.y;
      if (Math.hypot(dx, dy) > 10) dragging = true;
      if (dragging) {
        var mag = Math.hypot(dx, dy) || 1, cl = Math.min(1, mag / 60);
        moveVec.x = dx / mag * cl; moveVec.y = dy / mag * cl;
      }
    }, { passive: false });
    function endTouch(e) {
      if (!touchStart) return;
      e.preventDefault();
      var quick = performance.now() - touchTime < 150;
      if (!dragging && quick) { tapAt(touchStart.x, touchStart.y); }
      touchStart = null; dragging = false; moveVec.x = 0; moveVec.y = 0;
    }
    cv.addEventListener("touchend", endTouch, { passive: false });
    cv.addEventListener("touchcancel", endTouch, { passive: false });
    // desktop: click = swing/duel; WASD/arrows = move
    cv.addEventListener("mousedown", function (e) { var r = cv.getBoundingClientRect(); tapAt(e.clientX - r.left, e.clientY - r.top); });
    // ⚔ attack cross: tap a button to face that way and swing (discrete taps —
    // touchstart preventDefault suppresses the iOS phantom mouse tap)
    function attackDir(dir) {
      if (over || paused || trans || !map) return;
      player.dir = dir;
      swing();
    }
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-atk]"), function (b) {
      function atk(e) { e.preventDefault(); attackDir(b.dataset.atk); }
      b.addEventListener("touchstart", atk, { passive: false });
      b.addEventListener("mousedown", atk);
    });
    function onKeyDown(e) {
      var k = e.key;
      if (k === " " || k === "Spacebar") { e.preventDefault(); swing(); return; }
      if (k === "e" || k === "E") { duel(); return; }
      if (k === "w" || k === "W" || k === "ArrowUp") keyHeld.W = keyHeld.ArrowUp = true;
      else if (k === "s" || k === "S" || k === "ArrowDown") keyHeld.S = keyHeld.ArrowDown = true;
      else if (k === "a" || k === "A" || k === "ArrowLeft") keyHeld.A = keyHeld.ArrowLeft = true;
      else if (k === "d" || k === "D" || k === "ArrowRight") keyHeld.D = keyHeld.ArrowRight = true;
      else return;
      e.preventDefault();
    }
    function onKeyUp(e) {
      var k = e.key;
      if (k === "w" || k === "W" || k === "ArrowUp") keyHeld.W = keyHeld.ArrowUp = false;
      else if (k === "s" || k === "S" || k === "ArrowDown") keyHeld.S = keyHeld.ArrowDown = false;
      else if (k === "a" || k === "A" || k === "ArrowLeft") keyHeld.A = keyHeld.ArrowLeft = false;
      else if (k === "d" || k === "D" || k === "ArrowRight") keyHeld.D = keyHeld.ArrowRight = false;
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      player.phase = (player.phase || 0) + dt;
      if (!paused && !over && map) step(dt);
      draw();
    }

    // ---------- exit / cleanup ----------
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API ----------
    cv._dungeon = {
      state: function () {
        return {
          dungeon: dungeon, room: { r: room.r, c: room.c }, hearts: hearts, maxHearts: maxHearts,
          deaths: deaths, roomsCleared: roomsCleared, coins: coins, over: over, won: won, banked: banked,
          best: stats.lvl, bossShield: (function () { var b = boss(); return b ? !!b.shield : null; })(),
          doorsUnlocked: Object.keys(doorsUnlocked).length, paused: paused, keys: keys
        };
      },
      begin: begin,
      warpRoom: function (r, c) { trans = null; room = { r: r, c: c }; player.x = MW / 2; player.y = MH / 2; enterRoom(false); },
      enemies: function () { return mobs; },
      swing: function () { swingCd = 0; swing(); },
      move: function (dx, dy) { moveVec.x = dx; moveVec.y = dy; },
      hurt: function (n) { player.inv = 0; hurt(n); },
      openDoor: function () {
        // force the nearest authored word-door in the current room
        var rm = curRoom(); if (!rm) return;
        var dir = ["N", "S", "E", "W"].filter(function (d) { var o = doorOf(rm, d); return o && o.word && !doorsUnlocked[doorUnlockedKey(d)]; })[0];
        if (dir) openWordDoor(dir);
      },
      duel: duel,
      boss: boss,
      player: function () { return { x: player.x, y: player.y, dir: player.dir }; },
      attack: attackDir,
      items: function () { return stats.items; },
      giveItem: findItem,
      useItem: useItem,
      effects: function () { return { speedT: speedT, shieldT: shieldT, spinT: spinT }; },
      // 🧩 puzzle + hazard test hooks (dungeons 4-6)
      puzzle: curPuzzle,
      pushBlock: pushBlock,
      tapTorch: tapTorch,
      stepPlate: stepPlate,
      zones: function () { return zones; },
      setLvl: function (n) { stats.lvl = n; }
    };

    hud();
    invUI();
    showSelect();
    if (global._dungeondemo) setTimeout(function () { // test hook: a lively mid-fight board
      global._dungeondemo = 0;
      begin(1);
      cv._dungeon.warpRoom(4, 1); // a monster room, swords already swinging in demos
      cv._dungeon.move(0.4, -0.2);
    }, 700);
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxDungeon = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
