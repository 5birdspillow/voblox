/*
 * Voblox — 3D Word World (Phase 2 + Phase 3)
 * Blocky island; chests = "Vocab Gates" for the active lesson; a Boss Totem in the
 * center launches the Boss Battle. Menu has lesson picker, daily review, dashboard.
 */
(function () {
  "use strict";
  var THREE = window.THREE;
  var Content = window.VOBLOX_CONTENT, Engine = window.VobloxEngine, VQ = window.VobloxQuestions;
  var VOBLOX_VERSION = window.VOBLOX_VERSION || "dev";

  var store = new window.VobloxStore.Store(Content.allWords());
  // players: name a freshly created player + make sure the registry exists
  if (window.VobloxProfile && window.VobloxProfile.players) {
    window.VobloxProfile.players.applyPending(store.state, function () { store.save(); });
    window.VobloxProfile.players.list((store.state.profile && store.state.profile.name) || "Leo");
  }
  window.__VOBLOX_VOICE = (store.state.profile && store.state.profile.voice) || null; // per-player voice settings
  var available = Content.availableLessons();
  var activeLesson = String(store.state.activeLesson || (available[0] ? available[0].id : 5));
  if (!Content.getLesson(activeLesson)) activeLesson = String(available[0] ? available[0].id : 5);
  store.state.activeLesson = activeLesson;
  var lesson = Content.getLesson(activeLesson);
  var WORDS = lesson.words;
  // At a chest you already see the word, so only ask meaning-testing questions here
  // (skip "which word…/spell it/hear it" — those are trivial when the word is known).
  var CHEST_FORMATS = [Engine.FORMATS.WORD2DEF, Engine.FORMATS.SYNONYM, Engine.FORMATS.ANTONYM];

  window.onerror = function (m) { var b = document.getElementById("errbar"); if (b) { b.style.display = "block"; b.textContent = "⚠ " + m; } };

  // ---------- renderer / scene ----------
  var canvas = document.getElementById("c");
  var renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd6ff);
  scene.fog = new THREE.Fog(0x9fd6ff, 54, 150);
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6f9e57, 1.0));
  var sun = new THREE.DirectionalLight(0xfff3d0, 0.85);
  sun.position.set(30, 48, 22); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  var scam = sun.shadow.camera; scam.left = -46; scam.right = 46; scam.top = 46; scam.bottom = -46; scam.near = 1; scam.far = 150;
  scene.add(sun);

  // ---------- helpers ----------
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function labelTex(text, bg) {
    var c = document.createElement("canvas"); c.width = 256; c.height = 64; var x = c.getContext("2d");
    x.fillStyle = bg; rr(x, 4, 4, 248, 56, 16); x.fill();
    x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 4; x.stroke();
    x.fillStyle = "#fff"; x.font = "bold 34px Trebuchet MS, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, 128, 34, 236);
    var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function faceTex(skinHex, face) {
    var c = document.createElement("canvas"); c.width = 64; c.height = 64; var x = c.getContext("2d");
    x.fillStyle = skinHex || "#ffcc88"; x.fillRect(0, 0, 64, 64);
    if (face && !/^[a-z]+$/.test(face)) { // equipped emoji face
      x.font = "44px serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(face, 32, 36);
    } else {
      x.fillStyle = "#26323a"; x.fillRect(16, 24, 8, 10); x.fillRect(40, 24, 8, 10);
      x.strokeStyle = "#26323a"; x.lineWidth = 4; x.beginPath(); x.arc(32, 40, 12, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    }
    return new THREE.CanvasTexture(c);
  }
  function emojiTex(emoji) {
    var c = document.createElement("canvas"); c.width = 64; c.height = 64; var x = c.getContext("2d");
    x.font = "52px serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(emoji, 32, 36);
    return new THREE.CanvasTexture(c);
  }
  function box(w, h, d, color) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: color })); m.castShadow = true; return m; }

  // ---------- ground ----------
  var HALF = 32; // island sized for the six themed game districts (two rows each)
  (function buildGround() {
    var n = (HALF * 2 + 1) * (HALF * 2 + 1);
    var mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    mesh.receiveShadow = true;
    var d = new THREE.Object3D(), col = new THREE.Color(), i = 0;
    for (var gx = -HALF; gx <= HALF; gx++) for (var gz = -HALF; gz <= HALF; gz++) {
      var edge = (Math.abs(gx) === HALF || Math.abs(gz) === HALF);
      d.position.set(gx, -0.5, gz); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      var sh = 0.92 + ((gx * 7 + gz * 13) % 5) * 0.018;
      if (edge) col.setHex(0x8a8f98); else col.setRGB(0.36 * sh, 0.66 * sh, 0.30 * sh);
      mesh.setColorAt(i, col); i++;
    }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    // the pond anchors the fishing dock in Critter Cove (south-west corner)
    var water = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 8), new THREE.MeshLambertMaterial({ color: 0x3aa0e6, transparent: true, opacity: 0.85 }));
    water.position.set(-24, -0.15, -24); water.receiveShadow = true; scene.add(water);
    var wallMat = new THREE.MeshLambertMaterial({ color: 0x9aa0aa });
    [[0, HALF + 0.5], [0, -(HALF + 0.5)]].forEach(function (p) { var w = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 1, 1.2, 1), wallMat); w.position.set(p[0], 0.6, p[1]); w.receiveShadow = true; scene.add(w); });
    [[HALF + 0.5, 0], [-(HALF + 0.5), 0]].forEach(function (p) { var w = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, HALF * 2 + 1), wallMat); w.position.set(p[0], 0.6, p[1]); w.receiveShadow = true; scene.add(w); });
  })();

  var treeObstacles = [], chestObstacles = [], obstacles = [];
  function makeTree(x, z) {
    var g = new THREE.Group();
    var trunk = box(0.5, 1.6, 0.5, 0x8a5a3b); trunk.position.y = 0.8; g.add(trunk);
    var l1 = box(1.8, 1.0, 1.8, 0x4ea83e); l1.position.y = 2.0; g.add(l1);
    var l2 = box(1.1, 0.9, 1.1, 0x57c04a); l2.position.y = 2.8; g.add(l2);
    g.position.set(x, 0, z); scene.add(g); treeObstacles.push({ x: x, z: z, r: 0.6 });
  }
  [[3.8, 2.6], [-3.8, 3.4], [3.0, -3.9], [-3.2, -2.6], [-6.6, 6.6],
   [10.5, 2.5], [-10.5, 3.5], [2.5, 10.5], [-3, -10.5], [11, -10], [-11.5, 9.5],
   [14, 4], [-14, -3], [5.5, 14], [-5.5, -14], [9, 9], [-9, -9],
   [20, 8], [-20, 6], [8, -20], [-6, 20], [16, 16], [16, -16], [-19, 14], [20, -6],
   // outer trees mark the district boundaries on the bigger island
   [31, 0], [15.5, 26.8], [-15.5, 26.8], [-31, 0], [-15.5, -26.8], [15.5, -26.8]].forEach(function (p) { makeTree(p[0], p[1]); });

  // ---------- boss totem (center) ----------
  var totem = (function () {
    var g = new THREE.Group();
    var dark = new THREE.MeshLambertMaterial({ color: 0x4a3b6b });
    [0.4, 1.2, 2.0].forEach(function (y, i) { var b = new THREE.Mesh(new THREE.BoxGeometry(1.2 - i * 0.18, 0.8, 1.2 - i * 0.18), dark); b.position.y = y; b.castShadow = true; g.add(b); });
    var crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xff4d6d }));
    crystal.position.y = 2.9; g.add(crystal); g._crystal = crystal;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex("⚔ BOSS BATTLE", "#b3123c"), depthWrite: false }));
    spr.scale.set(2.6, 0.7, 1); spr.position.set(0, 3.8, 0); g.add(spr);
    g.position.set(0, 0, 0); scene.add(g);
    return g;
  })();

  // ---------- chests ----------
  var chests = [], chestByWord = {}, portals = [];
  function makeChest(word, data, x, z) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: 0x9c6b3f });
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.7), bodyMat); body.position.y = 0.3; body.castShadow = true; g.add(body);
    var trim = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.12, 0.76), new THREE.MeshLambertMaterial({ color: 0xe0a93c })); trim.position.y = 0.6; g.add(trim);
    var lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.62, -0.35);
    var lid = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.32, 0.7), bodyMat); lid.position.set(0, 0.16, 0.35); lid.castShadow = true; lidPivot.add(lid); g.add(lidPivot);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(data.emoji + " " + word, "#1f6fd0"), depthWrite: false }));
    spr.scale.set(2.3, 0.64, 1); spr.position.set(0, 1.75, 0); g.add(spr);
    g.position.set(x, 0, z); scene.add(g); chestObstacles.push({ x: x, z: z, r: 0.7 });
    var c = { group: g, lidPivot: lidPivot, ring: ring, spr: spr, word: word, data: data, ready: false, _r: null, sense: 0, lastFormat: null };
    chests.push(c); chestByWord[word] = c; refreshChest(c); return c;
  }
  function refreshChest(c) {
    var ready = Engine.isQuizReady(store.state.cards[c.word]); c.ready = ready;
    if (c._r !== ready) {
      c._r = ready;
      c.spr.material.map = labelTex((ready ? "✓ " : c.data.emoji + " ") + c.word, ready ? "#2f9e44" : "#1f6fd0");
      c.spr.material.needsUpdate = true; c.ring.visible = !ready;
    }
  }
  function clearChests() {
    chests.forEach(function (c) { scene.remove(c.group); });
    chests = []; chestByWord = {}; chestObstacles = [];
  }
  function buildChests(words) {
    clearChests();
    var N = words.length, R = 13;
    for (var i = 0; i < N; i++) { var a = (i / N) * Math.PI * 2; makeChest(words[i].word, words[i], Math.cos(a) * R, Math.sin(a) * R); }
    obstacles = treeObstacles.concat(chestObstacles).concat(buildingObstacles).concat([{ x: 0, z: 0, r: 0.9 }]);
  }

  // ---------- mini-game portals ----------
  function makePortal(game, x, z) {
    var g = new THREE.Group();
    var hex = "#" + ("000000" + game.color.toString(16)).slice(-6);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.16, 12, 28), new THREE.MeshBasicMaterial({ color: game.color }));
    ring.position.y = 1.3; g.add(ring); g._ring = ring;
    var inner = new THREE.Mesh(new THREE.CircleGeometry(0.82, 24), new THREE.MeshBasicMaterial({ color: game.color, transparent: true, opacity: 0.32, side: THREE.DoubleSide }));
    inner.position.y = 1.3; g.add(inner);
    var base = box(1.1, 0.3, 0.5, 0x3a3550); base.position.y = 0.15; g.add(base);
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(game.emoji + " " + game.name, hex), depthWrite: false }));
    spr.scale.set(2.7, 0.72, 1); spr.position.set(0, 2.5, 0); g.add(spr);
    g.position.set(x, 0, z); scene.add(g);
    return { group: g, game: game };
  }
  function buildPortals() {
    // quick games keep their classic portal ring; the big arcade games get BUILDINGS (below)
    var games = (window.VobloxGames || []).filter(function (g) { return !g.hub; });
    portals.forEach(function (p) { scene.remove(p.group); });
    portals = [];
    var R = 9.5, N = games.length;
    // ring the portals around the island; the spawn sits near the center so none overlap it
    for (var i = 0; i < N; i++) { var a = (i / Math.max(N, 1)) * Math.PI * 2 + 0.4; portals.push(makePortal(games[i], Math.cos(a) * R, Math.sin(a) * R)); }
  }

  // ---------- game district buildings (every arcade game lives IN the world) ----------
  var buildings = [], buildingObstacles = [];
  function hexStr(n) { return "#" + ("000000" + n.toString(16)).slice(-6); }
  function makeBuilding(def, x, z) {
    var g = new THREE.Group();
    var ang = Math.atan2(-x, -z); // door faces the island center
    var wallMat = new THREE.MeshLambertMaterial({ color: def.wall });
    var roofMat = new THREE.MeshLambertMaterial({ color: def.roof });
    var W2 = 3.6, D = 3.0, Hh = 2.3;
    var back = new THREE.Mesh(new THREE.BoxGeometry(W2, Hh, 0.3), wallMat); back.position.set(0, Hh / 2, -D / 2); back.castShadow = true; g.add(back);
    var l = new THREE.Mesh(new THREE.BoxGeometry(0.3, Hh, D), wallMat); l.position.set(-W2 / 2, Hh / 2, 0); l.castShadow = true; g.add(l);
    var r2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, Hh, D), wallMat); r2.position.set(W2 / 2, Hh / 2, 0); r2.castShadow = true; g.add(r2);
    var fl = new THREE.Mesh(new THREE.BoxGeometry(1.0, Hh, 0.3), wallMat); fl.position.set(-W2 / 2 + 0.5, Hh / 2, D / 2); g.add(fl);
    var fr = new THREE.Mesh(new THREE.BoxGeometry(1.0, Hh, 0.3), wallMat); fr.position.set(W2 / 2 - 0.5, Hh / 2, D / 2); g.add(fr);
    var lintel = new THREE.Mesh(new THREE.BoxGeometry(W2, 0.5, 0.3), wallMat); lintel.position.set(0, Hh - 0.25, D / 2); g.add(lintel);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(W2 + 0.7, 0.35, D + 0.7), roofMat); roof.position.y = Hh + 0.17; roof.castShadow = true; g.add(roof);
    var roof2 = new THREE.Mesh(new THREE.BoxGeometry(W2 * 0.62, 0.32, D * 0.62), roofMat); roof2.position.y = Hh + 0.5; g.add(roof2);
    // glowing doorway = the "portal" feel
    var door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.75), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    door.position.set(0, 0.9, D / 2 + 0.02); g.add(door); g._door = door;
    // sign + big emoji
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(def.emoji + " " + def.name, hexStr(def.color)), depthWrite: false }));
    spr.scale.set(3.1, 0.82, 1); spr.position.set(0, Hh + 1.35, 0); g.add(spr);
    var em = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(def.emoji), depthWrite: false, transparent: true }));
    em.scale.set(1.15, 1.15, 1); em.position.set(0, Hh + 0.65, D / 2 - 0.6); g.add(em);
    // one flavor prop per district
    switch (def.flavor) {
      case "goal": var gp = box(0.14, 1.1, 0.14, 0xffffff); gp.position.set(-2.9, 0.55, 0.6); g.add(gp); var gp2 = box(0.14, 1.1, 0.14, 0xffffff); gp2.position.set(-2.9, 0.55, -0.6); g.add(gp2); var bar = box(0.14, 0.14, 1.34, 0xffffff); bar.position.set(-2.9, 1.1, 0); g.add(bar); break;
      case "arch": var a1 = box(0.24, 2.4, 0.24, 0x222222); a1.position.set(-2.6, 1.2, 0); g.add(a1); var a2 = box(0.24, 2.4, 0.24, 0x222222); a2.position.set(-3.9, 1.2, 0); g.add(a2); var chk = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.4, 0.3), new THREE.MeshLambertMaterial({ map: (function () { var c = document.createElement("canvas"); c.width = 64; c.height = 16; var xx = c.getContext("2d"); for (var q2 = 0; q2 < 8; q2++) { xx.fillStyle = q2 % 2 ? "#fff" : "#111"; xx.fillRect(q2 * 8, 0, 8, 16); } return new THREE.CanvasTexture(c); })() })); chk.position.set(-3.25, 2.5, 0); g.add(chk); break;
      case "dock": var pl = box(1.4, 0.16, 4.4, 0x8a5a3b); pl.position.set(0, 0.1, D / 2 + 2.6); g.add(pl); break;
      case "fence": [[-2.6, 1.2], [-2.6, -1.2], [2.6, 1.2], [2.6, -1.2]].forEach(function (p2) { var f2 = box(0.14, 0.7, 0.14, 0xb08a5a); f2.position.set(p2[0], 0.35, p2[1]); g.add(f2); }); var rail = box(5.2, 0.1, 0.1, 0xb08a5a); rail.position.set(0, 0.62, 1.2); g.add(rail); var rail2 = box(5.2, 0.1, 0.1, 0xb08a5a); rail2.position.set(0, 0.62, -1.2); g.add(rail2); break;
      case "tower": var t1 = box(1.1, 2.2, 1.1, 0x6a5acd); t1.position.set(-2.7, 1.1, 0); g.add(t1); var t2 = box(1.4, 0.4, 1.4, 0x4a3aad); t2.position.set(-2.7, 2.4, 0); g.add(t2); break;
      case "cloud": [[1.9, 3.4, 0.9], [2.7, 4.3, -0.4], [3.4, 5.2, 0.5]].forEach(function (p3) { var cl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), new THREE.MeshLambertMaterial({ color: 0xffffff })); cl.position.set(p3[0], p3[1], p3[2]); g.add(cl); }); break;
      case "board": var bd = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.6), new THREE.MeshLambertMaterial({ map: (function () { var c = document.createElement("canvas"); c.width = 64; c.height = 64; var xx = c.getContext("2d"); for (var yy = 0; yy < 8; yy++) for (var xq = 0; xq < 8; xq++) { xx.fillStyle = (xq + yy) % 2 ? "#b58863" : "#f0d9b5"; xx.fillRect(xq * 8, yy * 8, 8, 8); } return new THREE.CanvasTexture(c); })() })); bd.position.set(2.9, 0.4, 0.4); g.add(bd); var tbl = box(0.3, 0.4, 0.3, 0x6a4a2e); tbl.position.set(2.9, 0.18, 0.4); g.add(tbl); break;
      case "awning": var aw = new THREE.Mesh(new THREE.BoxGeometry(W2 + 0.4, 0.14, 1.1), new THREE.MeshLambertMaterial({ color: 0xff5252 })); aw.position.set(0, Hh - 0.4, D / 2 + 0.6); g.add(aw); break;
    }
    g.position.set(x, 0, z); g.rotation.y = ang; scene.add(g);
    // door world-position for proximity checks
    var doorPos = new THREE.Vector3(0, 0, D / 2 + 1.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).add(g.position);
    buildingObstacles.push({ x: x, z: z, r: 2.2 });
    var b = { group: g, def: def, door: doorPos };
    buildings.push(b);
    return b;
  }
  function makeSignpost(name, color, x, z) {
    var g = new THREE.Group();
    var post = box(0.18, 2.6, 0.18, 0x8a5a3b); post.position.y = 1.3; g.add(post);
    var top = box(0.5, 0.18, 0.5, 0x6a4a2e); top.position.y = 2.65; g.add(top);
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(name, color), depthWrite: false }));
    spr.scale.set(3.6, 0.95, 1); spr.position.y = 3.2; g.add(spr);
    g.position.set(x, 0, z); scene.add(g);
    buildingObstacles.push({ x: x, z: z, r: 0.4 });
  }
  function buildBuildings() {
    // Six themed districts, one wedge each. Buildings sit in two staggered rows
    // ~8 units apart so no doorway is ever crowded; each district gets a signpost.
    // New hub games join the district that fits their genre (7-8 fit per wedge).
    var DISTRICTS = [
      { name: "⚔ Battle Row", color: "#b3123c", defs: [
        { gameId: "empire", flavor: "tower", wall: 0xd8ccf4, roof: 0x6b5ac0 },
        { gameId: "books", flavor: "awning", wall: 0xf4e8cc, roof: 0x6a8ad0 },
        { gameId: "clash", flavor: "board", wall: 0xf4ccd8, roof: 0xb03a5a },
        { gameId: "towerd", flavor: "tower", wall: 0x9a8ad0, roof: 0x4a3aad },
        { gameId: "dungeon", flavor: "tower", wall: 0xd8c4e8, roof: 0x5a3a7c },
        { gameId: "survivors", flavor: "fence", wall: 0xc8d8a8, roof: 0x4a6c2a }
      ] },
      { name: "🏟 Sports Zone", color: "#2f7d4f", defs: [
        { gameId: "soccer", flavor: "goal", wall: 0x7ec86a, roof: 0x2f6b1f },
        { gameId: "pickle", flavor: null, wall: 0x63c78a, roof: 0x2f7d4f },
        { gameId: "bjj", flavor: null, wall: 0xe8e2d6, roof: 0xb3392f },
        { gameId: "karts", flavor: "arch", wall: 0xd97b4a, roof: 0x8a3a1a },
        { gameId: "slice", flavor: null, wall: 0x3a4a5c, roof: 0x22303c }
      ] },
      { name: "🎠 Arcade Ave", color: "#f0a92e", defs: [
        { gameId: "dash", flavor: "arch", wall: 0xc8f4ee, roof: 0x30c0b0 },
        { gameId: "obby", flavor: "cloud", wall: 0xbfe3ff, roof: 0x5aa6f0 },
        { gameId: "merge", flavor: "tower", wall: 0xf4d8a8, roof: 0xffb300 },
        { gameId: "chess", flavor: "board", wall: 0xcaa876, roof: 0x5a3a22 },
        { gameId: "blaster", flavor: "tower", wall: 0xc4baf0, roof: 0x3a2b7a },
        { gameId: "beat", flavor: "awning", wall: 0xf4c4e4, roof: 0xa8186e }
      ] },
      { name: "🌿 Critter Cove", color: "#3a9c50", defs: [
        { gameId: "pets", flavor: "fence", wall: 0xf0b8d8, roof: 0xb06a9a },
        { gameId: "fishing", flavor: "dock", wall: 0x7ab8d8, roof: 0x2a6a8a },
        { gameId: "gobble", flavor: null, wall: 0xb8ecc8, roof: 0x2a9c50 }
      ] },
      { name: "🎢 Tycoon Town", color: "#6b5ac0", defs: [
        { gameId: "park", flavor: "arch", wall: 0xd0f4c8, roof: 0x3a9c50 },
        { gameId: "chef", flavor: "awning", wall: 0xf2dcb8, roof: 0xb3392f },
        { gameId: "digger", flavor: "tower", wall: 0xd8b88a, roof: 0x8a5a2a }
      ] },
      { name: "🏪 Town Square", color: "#5aa6f0", defs: [
        { tab: "shop", name: "Item Shop", emoji: "🛍️", color: 0xf0a92e, flavor: "awning", wall: 0xffe2a8, roof: 0xf0a92e },
        { tab: "locker", name: "Wardrobe", emoji: "🧢", color: 0x5aa6f0, flavor: null, wall: 0xcfe0f4, roof: 0x3a6ab0 },
        { href: "craft.html", name: "Vocraft Mine", emoji: "⛏️", color: 0x6fae3e, flavor: "tower", wall: 0x8a5a3b, roof: 0x57c04a }
      ] }
    ];
    var FRONT_R = 23, BACK_R = 28.5, SPACING = 8.2; // arc distance between building centers
    DISTRICTS.forEach(function (D, di) {
      var theta = (di / DISTRICTS.length) * Math.PI * 2 + Math.PI / DISTRICTS.length;
      makeSignpost(D.name, D.color, Math.cos(theta) * 17, Math.sin(theta) * 17);
      var defs = D.defs.filter(function (d) {
        if (!d.gameId) return true;
        var gm = (window.VobloxGames || []).filter(function (x) { return x.id === d.gameId; })[0];
        if (!gm) return false;
        d.name = gm.name; d.emoji = gm.emoji; d.color = gm.color; d.game = gm;
        return true;
      });
      var frontN = defs.length > 6 ? 4 : Math.min(3, defs.length);
      var rows = [{ list: defs.slice(0, frontN), radius: FRONT_R, stagger: 0 },
                  { list: defs.slice(frontN), radius: BACK_R, stagger: 0.5 }];
      rows.forEach(function (row) {
        var n = row.list.length; if (!n) return;
        var dA = SPACING / row.radius;
        row.list.forEach(function (d, i) {
          var a = theta + (i - (n - 1) / 2 + row.stagger) * dA;
          var x = Math.cos(a) * row.radius, z = Math.sin(a) * row.radius;
          if (d.gameId === "fishing") { x = -20; z = -20; } // the dock sits by the pond
          makeBuilding(d, x, z);
        });
      });
    });
  }

  // ---------- wandering citizens (AI players hanging out in the world) ----------
  var walkers = [];
  function makeWalker(bot) {
    function hexn(h) { return parseInt(String(h).slice(1), 16) || 0xffffff; }
    var g = new THREE.Group();
    var pantsMat = new THREE.MeshLambertMaterial({ color: hexn(bot.avatar.pants) });
    var shirtMat = new THREE.MeshLambertMaterial({ color: hexn(bot.avatar.shirt) });
    var skinMat = new THREE.MeshLambertMaterial({ color: hexn(bot.avatar.skin) });
    var faceMat = new THREE.MeshLambertMaterial({ map: faceTex(bot.avatar.skin, bot.avatar.face) });
    function limb(w, h, d, mat, px, py) { var p = new THREE.Group(); p.position.set(px, py, 0); var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.y = -h / 2; p.add(m); return p; }
    var s = 0.82; // slightly smaller than Leo
    var ll = limb(0.34 * s, s, 0.34 * s, pantsMat, -0.22 * s, s), rl = limb(0.34 * s, s, 0.34 * s, pantsMat, 0.22 * s, s);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 1.05 * s, 0.5 * s), shirtMat); torso.position.y = 1.52 * s;
    var la = limb(0.3 * s, s, 0.3 * s, skinMat, -0.62 * s, 2.02 * s), ra = limb(0.3 * s, s, 0.3 * s, skinMat, 0.62 * s, 2.02 * s);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.82 * s, 0.82 * s, 0.82 * s), [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat]); head.position.y = 2.5 * s;
    var name = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(bot.name, "#20303acc"), depthWrite: false }));
    name.scale.set(1.9, 0.5, 1); name.position.y = 3.15 * s; g.add(name);
    if (bot.avatar.hat) { var hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(bot.avatar.hat), depthWrite: false, transparent: true })); hs.scale.set(0.75, 0.75, 1); hs.position.y = 2.72 * s + 0.28; g.add(hs); }
    var bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex("hi!", "#ffffff"), depthWrite: false, transparent: true }));
    bub.scale.set(2.0, 0.55, 1); bub.position.y = 3.7 * s; bub.visible = false; g.add(bub);
    g.add(ll, rl, torso, la, ra, head);
    var a0 = Math.random() * Math.PI * 2, r0 = 6 + Math.random() * 18;
    g.position.set(Math.cos(a0) * r0, 0, Math.sin(a0) * r0);
    scene.add(g);
    return { group: g, bot: bot, ll: ll, rl: rl, la: la, ra: ra, bub: bub, tx: g.position.x, tz: g.position.z, wait: Math.random() * 3, phase: Math.random() * 6, bubT: 0, greeted: 0 };
  }
  function initWalkers() {
    if (!window.VobloxBots) return;
    window.VobloxBots.pickOpponents(5, 0.5).forEach(function (b) { walkers.push(makeWalker(b)); });
  }
  function updateWalkers(dt, t) {
    walkers.forEach(function (w) {
      var g = w.group;
      var dx = w.tx - g.position.x, dz = w.tz - g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.4) {
        w.wait -= dt;
        w.ll.rotation.x *= 0.8; w.rl.rotation.x *= 0.8; w.la.rotation.x *= 0.8; w.ra.rotation.x *= 0.8;
        if (w.wait <= 0) {
          var a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 20;
          w.tx = Math.cos(a) * r; w.tz = Math.sin(a) * r; w.wait = 1.5 + Math.random() * 4;
        }
      } else {
        var sp = 1.7 * dt;
        g.position.x += (dx / d) * sp; g.position.z += (dz / d) * sp;
        g.rotation.y = Math.atan2(dx / d, dz / d);
        w.phase += dt * 9;
        var sw = Math.sin(w.phase) * 0.5;
        w.ll.rotation.x = sw; w.rl.rotation.x = -sw; w.la.rotation.x = -sw; w.ra.rotation.x = sw;
      }
      // wave hello when Leo walks close by
      var pd = Math.hypot(g.position.x - pos.x, g.position.z - pos.z);
      if (pd < 3.2 && t - w.greeted > 14) {
        w.greeted = t;
        w.bub.material.map = labelTex(window.VobloxBots.say(w.bot, Math.random() < 0.5 ? "hi" : "nice"), "#ffffff");
        w.bub.material.needsUpdate = true;
        w.bubT = 2.4;
      }
      if (w.bubT > 0) { w.bubT -= dt; w.bub.visible = true; } else w.bub.visible = false;
    });
  }

  // ---------- avatar (colors/face/hat come from the equipped Locker items) ----------
  var avatar = (function () {
    var g = new THREE.Group();
    var cfg0 = window.VobloxAvatar ? window.VobloxAvatar.resolve(store.state)
      : { skin: "#ffcc88", shirt: "#2f7be0", pants: "#394063", face: "smile", hat: null };
    function hex(h) { return parseInt(String(h).slice(1), 16) || 0xffffff; }
    var pantsMat = new THREE.MeshLambertMaterial({ color: hex(cfg0.pants) });
    var shirtMat = new THREE.MeshLambertMaterial({ color: hex(cfg0.shirt) });
    var skinMat = new THREE.MeshLambertMaterial({ color: hex(cfg0.skin) });
    var faceMat = new THREE.MeshLambertMaterial({ map: faceTex(cfg0.skin, cfg0.face) });
    function limb(w, h, d, mat, px, py, pz) {
      var p = new THREE.Group(); p.position.set(px, py, pz);
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.position.y = -h / 2;
      p.add(m); return p;
    }
    var ll = limb(0.34, 1.0, 0.34, pantsMat, -0.22, 1.0, 0), rl = limb(0.34, 1.0, 0.34, pantsMat, 0.22, 1.0, 0);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.5), shirtMat); torso.castShadow = true; torso.position.y = 1.52;
    var la = limb(0.3, 1.0, 0.3, skinMat, -0.62, 2.02, 0), ra = limb(0.3, 1.0, 0.3, skinMat, 0.62, 2.02, 0);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.82, 0.82), [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat]);
    head.position.y = 2.5; head.castShadow = true;
    var hatSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(cfg0.hat || " "), depthWrite: false, transparent: true }));
    hatSpr.scale.set(0.9, 0.9, 1); hatSpr.position.set(0, 3.2, 0); hatSpr.visible = !!cfg0.hat;
    // hair — style parts toggle per config (Liana's ponytail is REAL)
    var hairMat = new THREE.MeshLambertMaterial({ color: hex(cfg0.hairColor || "#6b4a2f") });
    var hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.3, 0.94), hairMat); hairCap.position.y = 2.86;
    var hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.18), hairMat); hairBack.position.set(0, 2.45, -0.42);
    var hairPony = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), hairMat); hairPony.position.set(0, 2.2, -0.55);
    var hairL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.52), hairMat); hairL.position.set(-0.54, 2.35, 0);
    var hairR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.52), hairMat); hairR.position.set(0.54, 2.35, 0);
    var tailL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), hairMat); tailL.position.set(-0.62, 2.5, -0.12);
    var tailR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), hairMat); tailR.position.set(0.62, 2.5, -0.12);
    var hairParts = [hairCap, hairBack, hairPony, hairL, hairR, tailL, tailR];
    hairParts.forEach(function (m) { m.castShadow = true; g.add(m); });
    function applyHair(cfg) {
      hairMat.color.setHex(hex(cfg.hairColor || "#6b4a2f"));
      var hs = cfg.hair && cfg.hair !== "none" ? cfg.hair : null;
      hairCap.visible = !!hs;
      hairCap.scale.y = hs === "spiky" ? 1.6 : 1;
      hairBack.visible = !!hs && hs !== "spiky";
      hairPony.visible = hs === "pony";
      hairL.visible = hairR.visible = (hs === "long" || hs === "bob");
      hairL.scale.y = hairR.scale.y = (hs === "bob" ? 0.6 : 1);
      tailL.visible = tailR.visible = hs === "pigtails";
    }
    applyHair(cfg0);
    g.add(ll, rl, torso, la, ra, head, hatSpr); scene.add(g);
    function applyConfig(cfg) {
      pantsMat.color.setHex(hex(cfg.pants)); shirtMat.color.setHex(hex(cfg.shirt)); skinMat.color.setHex(hex(cfg.skin));
      faceMat.map = faceTex(cfg.skin, cfg.face); faceMat.needsUpdate = true;
      if (cfg.hat) { hatSpr.material.map = emojiTex(cfg.hat); hatSpr.material.needsUpdate = true; hatSpr.visible = true; }
      else hatSpr.visible = false;
      applyHair(cfg);
    }
    return { group: g, ll: ll, rl: rl, la: la, ra: ra, applyConfig: applyConfig };
  })();
  var pos = avatar.group.position; pos.set(0, 0, 3.0);

  // ---------- camera ----------
  var camYaw = 0, camPitch = 0.52, camDist = 7.2;
  function updateCamera() {
    var cp = Math.cos(camPitch);
    camera.position.set(pos.x + camDist * Math.sin(camYaw) * cp, 1.4 + camDist * Math.sin(camPitch), pos.z + camDist * Math.cos(camYaw) * cp);
    camera.lookAt(pos.x, pos.y + 1.5, pos.z);
  }

  // ---------- input ----------
  var keys = {}, joy = { active: false, x: 0, y: 0, id: null, ox: 0, oy: 0 }, overlayOpen = false, walkPhase = 0;
  document.addEventListener("keydown", function (e) {
    if (overlayOpen) { if (overlayKey) overlayKey(e); return; }
    var k = e.key.toLowerCase(); keys[k] = true;
    if (k === "e" || k === " ") { e.preventDefault(); tryInteract(); }
  });
  document.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
  var pdown = null;
  canvas.addEventListener("mousedown", function (e) { pdown = { x: e.clientX, y: e.clientY, moved: 0 }; });
  window.addEventListener("mousemove", function (e) {
    if (!pdown || overlayOpen) return;
    var dx = e.movementX || 0, dy = e.movementY || 0; pdown.moved += Math.abs(dx) + Math.abs(dy);
    camYaw -= dx * 0.005; camPitch = Math.max(0.16, Math.min(1.2, camPitch + dy * 0.004));
  });
  window.addEventListener("mouseup", function (e) { if (pdown && pdown.moved < 6 && !overlayOpen) raycastInteract(e.clientX, e.clientY); pdown = null; });
  var look = { id: null, x: 0, y: 0 };
  canvas.addEventListener("touchstart", function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.clientX < window.innerWidth * 0.5 && !joy.active) { joy.active = true; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = 0; joy.y = 0; showJoy(t.clientX, t.clientY); }
      else if (look.id === null) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; look.tap = { x: t.clientX, y: t.clientY, moved: 0 }; }
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === joy.id) { var dx = t.clientX - joy.ox, dy = t.clientY - joy.oy, mag = Math.hypot(dx, dy) || 1, cl = Math.min(mag, 48) / 48; joy.x = (dx / mag) * cl; joy.y = -(dy / mag) * cl; moveNub(dx, dy); }
      else if (t.identifier === look.id) { var ddx = t.clientX - look.x, ddy = t.clientY - look.y; look.x = t.clientX; look.y = t.clientY; if (look.tap) look.tap.moved += Math.abs(ddx) + Math.abs(ddy); camYaw -= ddx * 0.006; camPitch = Math.max(0.16, Math.min(1.2, camPitch + ddy * 0.004)); }
    }
  }, { passive: true });
  canvas.addEventListener("touchend", function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === joy.id) { joy.active = false; joy.id = null; joy.x = 0; joy.y = 0; hideJoy(); }
      else if (t.identifier === look.id) { if (look.tap && look.tap.moved < 10) raycastInteract(look.tap.x, look.tap.y); look.id = null; look.tap = null; }
    }
  }, { passive: true });
  var joyEl, nubEl;
  function showJoy(x, y) { if (!joyEl) { joyEl = document.createElement("div"); joyEl.id = "joy"; nubEl = document.createElement("div"); nubEl.id = "joynub"; joyEl.appendChild(nubEl); document.body.appendChild(joyEl); } joyEl.style.left = (x - 60) + "px"; joyEl.style.top = (y - 60) + "px"; joyEl.style.display = "block"; moveNub(0, 0); }
  function hideJoy() { if (joyEl) joyEl.style.display = "none"; }
  function moveNub(dx, dy) { if (!nubEl) return; var mag = Math.hypot(dx, dy) || 1, cl = Math.min(mag, 48); nubEl.style.left = (33 + (dx / mag) * cl) + "px"; nubEl.style.top = (33 + (dy / mag) * cl) + "px"; }
  document.getElementById("actbtn").addEventListener("click", tryInteract);

  var raycaster = new THREE.Raycaster();
  function raycastInteract(px, py) {
    var ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.intersectObject(totem, true).length && dist2(totem.position) < 18) return startBoss(WORDS, "boss", "Boss: " + lesson.title);
    for (var pj = 0; pj < portals.length; pj++) if (raycaster.intersectObject(portals[pj].group, true).length && dist2(portals[pj].group.position) < 20) return launchGame(portals[pj].game);
    for (var bj = 0; bj < buildings.length; bj++) if (raycaster.intersectObject(buildings[bj].group, true).length) { if (dist2(buildings[bj].door) < 26) return enterBuilding(buildings[bj]); flash("Walk up to the " + esc(buildings[bj].def.name) + " door!"); return; }
    for (var i = 0; i < chests.length; i++) if (raycaster.intersectObject(chests[i].group, true).length) { if (dist2(chests[i].group.position) < 16) openGate(chests[i]); else flash("Walk closer to that chest!"); return; }
  }
  function dist2(p) { var dx = p.x - pos.x, dz = p.z - pos.z; return dx * dx + dz * dz; }

  // ---------- player ----------
  var nearest = null;
  function updatePlayer(dt) {
    var ix = 0, iz = 0;
    if (keys["w"] || keys["arrowup"]) iz += 1;
    if (keys["s"] || keys["arrowdown"]) iz -= 1;
    if (keys["a"] || keys["arrowleft"]) ix -= 1;
    if (keys["d"] || keys["arrowright"]) ix += 1;
    ix += joy.x; iz += joy.y;
    var mag = Math.hypot(ix, iz); if (mag > 1) { ix /= mag; iz /= mag; mag = 1; }
    if (mag > 0.05) {
      var s = Math.sin(camYaw), c = Math.cos(camYaw), wx = -s * iz + c * ix, wz = -c * iz - s * ix, spd = 4.8 * dt; // a touch quicker for the bigger island
      pos.x += wx * spd; pos.z += wz * spd;
      for (var o = 0; o < obstacles.length; o++) { var ob = obstacles[o], dx = pos.x - ob.x, dz = pos.z - ob.z, dd = Math.hypot(dx, dz), mn = ob.r + 0.45; if (dd < mn && dd > 0.0001) { pos.x = ob.x + (dx / dd) * mn; pos.z = ob.z + (dz / dd) * mn; } }
      pos.x = Math.max(-HALF + 0.6, Math.min(HALF - 0.6, pos.x)); pos.z = Math.max(-HALF + 0.6, Math.min(HALF - 0.6, pos.z));
      avatar.group.rotation.y = Math.atan2(wx, wz); walkPhase += dt * 10;
      var sw = Math.sin(walkPhase) * 0.5; avatar.ll.rotation.x = sw; avatar.rl.rotation.x = -sw; avatar.la.rotation.x = -sw; avatar.ra.rotation.x = sw;
    } else { avatar.ll.rotation.x *= 0.8; avatar.rl.rotation.x *= 0.8; avatar.la.rotation.x *= 0.8; avatar.ra.rotation.x *= 0.8; }

    var best = null, bd = 1e9, kind = null;
    for (var i = 0; i < chests.length; i++) { var d = dist2(chests[i].group.position); if (d < bd) { bd = d; best = chests[i]; kind = "chest"; } }
    var dt2 = dist2(totem.position); if (dt2 < bd) { bd = dt2; best = totem; kind = "boss"; }
    for (var pi = 0; pi < portals.length; pi++) { var pd = dist2(portals[pi].group.position); if (pd < bd) { bd = pd; best = portals[pi]; kind = "game"; } }
    for (var bi = 0; bi < buildings.length; bi++) { var bdd = dist2(buildings[bi].door); if (bdd < bd) { bd = bdd; best = buildings[bi]; kind = "building"; } }
    nearest = (bd < 5.6) ? { kind: kind, ref: best } : null;
    var prompt = document.getElementById("prompt"), act = document.getElementById("actbtn");
    if (nearest) {
      prompt.style.display = "block"; act.style.display = "block";
      if (nearest.kind === "boss") { prompt.innerHTML = "⚔️ <b>Fight the Boss</b> — press E"; act.textContent = "FIGHT ⚔️"; }
      else if (nearest.kind === "game") { prompt.innerHTML = "🎮 <b>Enter " + esc(nearest.ref.game.name) + "</b> — press E"; act.textContent = "ENTER 🎮"; }
      else if (nearest.kind === "building") { var bdef = nearest.ref.def; prompt.innerHTML = bdef.emoji + " <b>" + (bdef.game ? "Play " : "Open ") + esc(bdef.name) + "</b> — press E"; act.textContent = bdef.game ? "PLAY " + bdef.emoji : "OPEN " + bdef.emoji; }
      else { prompt.innerHTML = (nearest.ref.ready ? "Review" : "Open") + ": <b>" + nearest.ref.word + "</b> — press E"; act.textContent = (nearest.ref.ready ? "REVIEW ✦" : "OPEN ✦"); }
    } else { prompt.style.display = "none"; act.style.display = "none"; }
  }
  function enterBuilding(b) {
    var g = b.def.game;
    // defensive: a def may carry an id string — resolve it, and NEVER throw into
    // the world loop (an unresolvable game froze the whole island once)
    if (typeof g === "string") g = (window.VobloxGames || []).filter(function (x) { return x.id === g; })[0];
    if (g && g.start) launchGame(g);
    else if (b.def.href) location.href = b.def.href;
    else if (b.def.tab) openBackpack(b.def.tab);
    else flash("🚧 This building isn't open yet!");
  }
  function tryInteract() { if (!nearest) return; if (nearest.kind === "boss") startBoss(WORDS, "boss", "Boss: " + lesson.title); else if (nearest.kind === "game") launchGame(nearest.ref.game); else if (nearest.kind === "building") enterBuilding(nearest.ref); else openGate(nearest.ref); }
  function flash(msg) { var p = document.getElementById("prompt"); p.style.display = "block"; p.innerHTML = msg; setTimeout(function () { if (!nearest) p.style.display = "none"; }, 1400); }

  function animateChests(dt, t) {
    for (var i = 0; i < chests.length; i++) { var c = chests[i]; c.lidPivot.rotation.x += ((c.ready ? -2.0 : 0) - c.lidPivot.rotation.x) * Math.min(1, dt * 8); c.spr.position.y = 1.75 + Math.sin(t * 2 + i) * 0.06; if (c.ring.visible) c.ring.rotation.z += dt * 1.5; }
    if (totem._crystal) { totem._crystal.rotation.y += dt * 1.4; totem._crystal.position.y = 2.9 + Math.sin(t * 2) * 0.08; }
    for (var pi = 0; pi < portals.length; pi++) { var pr = portals[pi].group._ring; if (pr) pr.rotation.z += dt * 1.2; }
  }

  // ========== OVERLAYS ==========
  var overlay = document.getElementById("overlay"), obox = document.getElementById("overlaybox"), overlayKey = null;
  function openOverlay(html, keyFn) { obox.innerHTML = html; overlay.style.display = "flex"; overlayOpen = true; overlayKey = keyFn || null; }
  function closeOverlay() { VQ.shush(); overlay.style.display = "none"; overlayOpen = false; overlayKey = null; keys = {}; }
  function speak(text) { try { if (!("speechSynthesis" in window)) return; var cfg = (window.VobloxQuestions && window.VobloxQuestions.voiceConfig) ? window.VobloxQuestions.voiceConfig() : { rate: 0.9, pitch: 1, name: null }; var u = new SpeechSynthesisUtterance(text); u.rate = cfg.rate; u.pitch = cfg.pitch; var vs = speechSynthesis.getVoices() || []; var v = (cfg.name && vs.filter(function (x) { return x.name === cfg.name; })[0]) || vs.filter(function (x) { return /en[-_]?US/i.test(x.lang); })[0]; if (v) u.voice = v; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }

  // ---- vocab gate ----
  function openGate(chest) {
    var word = chest.word, card = store.state.cards[word], data = chest.data;
    var fmt = Engine.pickFormat(card, data, chest.lastFormat, CHEST_FORMATS); chest.lastFormat = fmt;
    var si = chest.sense % data.senses.length; chest.sense = (chest.sense + 1) % data.senses.length;
    var q = VQ.gen(card, WORDS, { format: fmt, senseIdx: si });
    renderGate(chest, q); VQ.readQ(q);
  }
  function renderGate(chest, q) {
    var body = q.kind === "mc"
      ? '<div class="choices">' + q.choices.map(function (ch, i) { return '<button class="choice" data-i="' + i + '"><span class="num">' + (i + 1) + '</span>' + VQ.esc(ch.label) + '</button>'; }).join("") + '</div>'
      : '<div class="typebox"><input id="answer" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="type here…"><button id="submit" class="submit">Enter ⏎</button><div id="hint" class="hint"></div></div>';
    openOverlay('<div class="gatehead">✦ Vocab Gate: ' + VQ.esc(chest.word) + ' <span class="x" id="gx">✕</span></div><div class="card qcard"><div class="prompt">' + q.promptHTML + ' <button class="replay" type="button" title="Read again">🔊</button></div>' + body + '</div>', null);
    document.getElementById("gx").onclick = function () { closeOverlay(); };
    var replay = obox.querySelector(".replay"); if (replay) replay.onclick = function () { VQ.readQ(q); };
    if (q.kind === "mc") {
      Array.prototype.forEach.call(obox.querySelectorAll(".choice"), function (b) { b.onclick = function () { pickMC(chest, q, parseInt(b.dataset.i, 10)); }; });
      overlayKey = function (e) { var n = parseInt(e.key, 10); if (n >= 1 && n <= q.choices.length) pickMC(chest, q, n - 1); };
    } else {
      var inp = document.getElementById("answer"); if (inp && !("ontouchstart" in window)) inp.focus();
      document.getElementById("submit").onclick = function () { submitText(chest, q); };
      overlayKey = function (e) { if (e.key === "Enter") submitText(chest, q); };
    }
  }
  function pickMC(chest, q, i) { Array.prototype.forEach.call(obox.querySelectorAll(".choice"), function (b, idx) { b.disabled = true; if (q.choices[idx].correct) b.classList.add("right"); else if (idx === i) b.classList.add("wrong"); }); resolveGate(chest, q, !!q.choices[i].correct); }
  function submitText(chest, q) { var inp = document.getElementById("answer"), r = VQ.checkText(q, inp.value); if (r === "empty") return; if (r === "near" && q.hintAllowed && !q._retried) { q._retried = true; document.getElementById("hint").textContent = "So close — check the spelling and try once more!"; inp.classList.add("almost"); inp.select(); return; } inp.disabled = true; resolveGate(chest, q, r === "correct"); }
  function resolveGate(chest, q, correct) {
    var res = store.record(q, correct); if (correct) confetti(); refreshChest(chest); updateHUD();
    var head = correct ? '<div class="fb good">✅ ' + ["Nice!", "Yes!", "Boom!", "You got it!"][Math.floor(Math.random() * 4)] + (res.earned ? ' <span class="gain">+' + res.earned + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"></span>' : "") + '</div>' : '<div class="fb bad">❌ Not quite — here’s the word:</div>';
    var loot = res.loot ? '<div class="loot">🎁 Loot! You found ' + res.loot + '</div>' : "";
    var done = chest.ready ? '<div class="loot" style="background:#dff5e1;border-color:#7fce8a">✓ <b>' + chest.word + '</b> mastered — chest opened!</div>' : "";
    openOverlay('<div class="gatehead">✦ Vocab Gate <span class="x" id="gx">✕</span></div><div class="card qcard">' + head + '<div class="reveal">' + VQ.entryHTML(q.data, { mnem: true }) + '</div>' + loot + done + '<button id="next" class="submit big-next">Continue ⏎</button></div>', function (e) { if (e.key === "Enter") afterGate(); });
    document.getElementById("gx").onclick = afterGate; document.getElementById("next").onclick = afterGate;
  }
  function afterGate() { closeOverlay(); checkVictory(); }

  // ---- boss launch ----
  function gameExit() { VQ.shush(); overlayOpen = false; keys = {}; chests.forEach(refreshChest); updateHUD(); if (window.VobloxProfile) window.VobloxProfile.slots.auto(); checkVictory(); }
  function startBoss(words, mode, title) {
    closeOverlay(); overlayOpen = true;
    window.VobloxBoss.start({ words: words, store: store, mode: mode || "boss", title: title, onExit: gameExit });
  }
  function launchGame(game, xtra) { closeOverlay(); overlayOpen = true; game.start({ words: WORDS, store: store, onExit: gameExit, resume: !!(xtra && xtra.resume) }); }
  function openBackpack(tab, lockerSlot) {
    window.VobloxArcade.open({
      store: store,
      tab: tab,
      lockerSlot: lockerSlot,
      openOverlay: openOverlay,
      closeOverlay: closeOverlay,
      launch: launchGame,
      startBoss: function () { startBoss(WORDS, "boss", "Boss: " + lesson.title); },
      startReview: startReview,
      back: openMenu,
      onEquip: function () { if (window.VobloxAvatar) avatar.applyConfig(window.VobloxAvatar.resolve(store.state)); }
    });
  }
  function startReview() {
    var due = store.dueCards(Content.allWords(), Date.now());
    var set = due.length ? due : WORDS;
    startBoss(set, "review", "Daily Review (" + set.length + " words)");
  }

  // ---------- HUD ----------
  function updateHUD() {
    var r = store.rank(), p = store.predicted(WORDS);
    document.getElementById("rankchip").textContent = r.icon + " " + r.name;
    var lc = document.getElementById("lvlchip"); if (lc) lc.textContent = "⭐ Lv " + (store.state.level || 1);
    document.getElementById("gemchip").innerHTML = '<img class="vbx" src="icons/vobux.png" alt="V"> ' + store.state.gems;
    var cc = document.getElementById("combochip");
    if (store.state.combo > 1) { cc.style.display = "inline-block"; cc.textContent = "🔥 x" + store.state.combo; } else cc.style.display = "none";
    document.getElementById("meterfill").style.width = p + "%";
    document.getElementById("meterlabel").textContent = (lesson.tag || ("L" + activeLesson)) + " • " + p + "%";
  }

  // ---------- menu ----------
  document.getElementById("menubtn").addEventListener("click", openMenu);
  function openMenu() {
    var unlocked = store.state.chessUnlocked || store.predicted(WORDS) >= 90;
    openOverlay('<div class="card menucard"><h2>☰ Menu — ' + esc(lesson.title) + '</h2>' +
      '<button class="menubtn" id="m_resume">▶ Back to the world</button>' +
      '<button class="menubtn" id="m_arcade" style="background:linear-gradient(#ffd76a,#f0a92e);border-color:#a06a12;color:#3a2a00">🎒 Backpack (quests · locker · shop · saves)</button>' +
      '<a class="menubtn" href="craft.html" style="background:linear-gradient(#9ad06a,#6fae3e);border-color:#4f7e2a">⛏️ Vocraft (build · mine · treasure!)</a>' +
      '<button class="menubtn" id="m_boss">⚔️ Boss Battle (beat the lesson!)</button>' +
      '<button class="menubtn" id="m_review">🔁 Daily Review (mix of words)</button>' +
      '<button class="menubtn" id="m_lessons">🗺️ Choose Lesson</button>' +
      '<button class="menubtn" id="m_words">📖 Word List (all meanings)</button>' +
      '<button class="menubtn ' + (unlocked ? "" : "locked") + '" id="m_chess">♟ Chess Puzzle ' + (unlocked ? "" : "🔒 reach 90%") + '</button>' +
      '<button class="menubtn" id="m_players" style="background:linear-gradient(#c9b6ff,#9d8df1);border-color:#6b5ac0">👥 Players — playing as <b>' + esc((store.state.profile && store.state.profile.name) || "Leo") + '</b></button>' +
      '<a class="menubtn" href="dashboard.html">👪 For Grown-ups (progress)</a>' +
      '<button class="menubtn" id="m_help">🎮 How to play</button>' +
      '<button class="menubtn" id="m_reset">🔄 Reset progress</button>' +
      '<div class="help">Predicted grade for ' + esc(lesson.title) + ': <b>' + gradeText(store.predicted(WORDS)) + '</b></div></div>',
      function (e) { if (e.key === "Escape") closeOverlay(); });
    document.getElementById("m_resume").onclick = closeOverlay;
    document.getElementById("m_arcade").onclick = function () { openBackpack("quests"); };
    document.getElementById("m_boss").onclick = function () { startBoss(WORDS, "boss", "Boss: " + lesson.title); };
    document.getElementById("m_review").onclick = startReview;
    document.getElementById("m_lessons").onclick = openLessons;
    document.getElementById("m_words").onclick = openWordList;
    document.getElementById("m_help").onclick = openHelp;
    document.getElementById("m_players").onclick = openPlayers;
    document.getElementById("m_chess").onclick = function () { if (unlocked) openChess(); else flash("Reach 90% to unlock chess!"); };
    document.getElementById("m_reset").onclick = function () {
      if (!window.confirm("Reset ALL progress? This erases words, Vobux, level, items, pets, ranks AND Vocraft. (Your 3 manual save slots are kept — delete those in Backpack → Slots.)")) return;
      var typed = window.prompt("Grown-up check — type RESET to erase everything:");
      if ((typed || "").trim().toUpperCase() !== "RESET") { flash("Reset cancelled — nothing was erased."); return; }
      try {
        localStorage.removeItem("voblox.save.v1");
        localStorage.removeItem("voblox.craft.v1");
        localStorage.removeItem("voblox.slot.auto"); // the rolling auto-backup goes too, or it would undo the reset
      } catch (e) {}
      location.reload();
    };
  }
  function esc(s) { return VQ.esc(s); }
  function gradeText(p) { return p >= 90 ? "A 🌟" : p >= 80 ? "B 👍" : "keep going 💪"; }

  // ---------- 👥 players: everyone in the family gets their OWN save ----------
  function openPlayers() {
    var PP = window.VobloxProfile;
    var liveName = (store.state.profile && store.state.profile.name) || "Leo";
    var list = PP.players.list(liveName);
    var cur = PP.players.current();
    var rows = list.map(function (pl) {
      var isCur = pl.id === cur;
      return '<button class="menubtn' + (isCur ? "" : "") + '" data-pl="' + pl.id + '"' + (isCur ? ' style="background:linear-gradient(#d8f7d6,#b0e8ae);border-color:#43c34a"' : "") + '>' +
        (isCur ? "▶ " : "") + "🧒 " + esc(pl.name) + (isCur ? ' <span class="muted">— playing now</span>' : "") + "</button>";
    }).join("");
    openOverlay('<div class="card menucard"><h2>👥 Players <span class="x" id="gx" style="float:right">✕</span></h2>' + rows +
      '<button class="menubtn" id="pl_new">＋ New player</button>' +
      '<button class="menubtn" id="pl_rename">✏️ Rename ' + esc(liveName) + '</button>' +
      '<div class="help">Every player has their OWN Vobux, words, pets, ranks and Vocraft world. Switching saves everything first — nothing is ever lost.</div></div>',
      function (e) { if (e.key === "Escape") openMenu(); });
    document.getElementById("gx").onclick = openMenu;
    Array.prototype.forEach.call(obox.querySelectorAll("[data-pl]"), function (b) {
      b.onclick = function () {
        if (b.dataset.pl === cur) { flash("That's who's playing now!"); return; }
        var target = list.filter(function (x) { return x.id === b.dataset.pl; })[0];
        if (PP.players.switchTo(b.dataset.pl)) { flash("Switching to " + target.name + "…"); setTimeout(function () { location.reload(); }, 300); }
      };
    });
    document.getElementById("pl_new").onclick = function () {
      var name = (window.prompt("New player's name?") || "").trim();
      if (!name) return;
      if (name.length > 14) name = name.slice(0, 14);
      var id = PP.players.create(name);
      if (PP.players.switchTo(id)) { flash("Welcome, " + name + "! Building your world…"); setTimeout(function () { location.reload(); }, 400); }
    };
    document.getElementById("pl_rename").onclick = function () {
      var name = (window.prompt("New name for this player?", liveName) || "").trim();
      if (!name) return;
      if (name.length > 14) name = name.slice(0, 14);
      PP.players.rename(cur, name);
      store.state.profile.name = name; store.save();
      flash("You are now " + name + "!");
      openPlayers();
    };
  }

  function openLessons() {
    var avail = Content.availableLessons();
    var curBook = null, rows = "";
    avail.forEach(function (L) {
      if (L.book !== curBook) { // group Leo's Book 4 and Liana's Book 2 under clear headers
        curBook = L.book;
        rows += '<div class="lessonbook" style="font-weight:900;color:#6a5ac0;margin:10px 0 4px;font-size:15px">' + (L.book === 2 ? "📘" : "📗") + " Book " + L.book + (L.bookName ? " · " + esc(L.bookName) : "") + "</div>";
      }
      var p = store.predicted(L.words);
      rows += '<button class="menubtn" data-l="' + L.id + '">' + (String(L.id) === activeLesson ? "▶ " : "") + esc(L.title) + ' <span class="muted">— ' + p + '% · ' + L.words.length + ' words</span></button>';
    });
    openOverlay('<div class="card menucard"><h2>🗺️ Choose Lesson <span class="x" id="gx" style="float:right">✕</span></h2>' + rows +
      '<div class="help">Want another lesson in the game? A grown-up can add any lesson from a photo of the workbook page — just ask. (Words must match the book exactly.)</div></div>',
      function (e) { if (e.key === "Escape") openMenu(); });
    document.getElementById("gx").onclick = openMenu;
    Array.prototype.forEach.call(obox.querySelectorAll("[data-l]"), function (b) { b.onclick = function () { switchLesson(b.dataset.l); }; });
  }
  function switchLesson(n) {
    activeLesson = String(n); store.state.activeLesson = activeLesson; store.save();
    lesson = Content.getLesson(activeLesson); WORDS = lesson.words;
    buildChests(WORDS); updateHUD(); closeOverlay();
  }

  function openWordList() {
    var rows = WORDS.map(function (d) { return '<div class="wrow"><button class="say" data-w="' + esc(d.word) + '">🔊</button><div class="winfo">' + VQ.entryHTML(d, { mnem: true }) + '</div></div>'; }).join("");
    openOverlay('<div class="gatehead">📖 ' + esc(lesson.title) + ' Words <span class="x" id="gx">✕</span></div><div class="card"><div class="wordlist">' + rows + '</div></div>', function (e) { if (e.key === "Escape") openMenu(); });
    document.getElementById("gx").onclick = openMenu;
    Array.prototype.forEach.call(obox.querySelectorAll(".say"), function (b) { b.onclick = function () { speak(b.dataset.w); }; });
  }
  function openHelp() {
    openOverlay('<div class="card"><h2>🎮 How to play</h2><p><b>Move:</b> phone/tablet — drag the <b>left side</b> to walk, <b>right side</b> to look. Computer — <b>W A S D</b> + drag the mouse.</p><p><b>Chests</b> = words. Walk up and tap <b>OPEN</b> (or press <b>E</b>) to answer and earn 💎.</p><p><b>🏘️ The buildings around the island</b> are the big games — soccer stadium, chess club, pet meadow, fishing dock and more. Walk up to a door and press <b>PLAY</b>!</p><p><b>⚔️ Boss Battle</b> (the totem in the middle) is the fast way to beat a whole lesson before a quiz!</p><button class="submit big-next" id="ok">Got it ⏎</button></div>', function (e) { if (e.key === "Enter") closeOverlay(); });
    document.getElementById("ok").onclick = closeOverlay;
  }

  // ---------- chess ----------
  // Each puzzle: moves alternate White(you), Black(auto-reply), White… The last move is mate.
  var CHESS = [
    { mate: 1, note: "Checkmate on the back row.", board: { a1: "R", e1: "K", g8: "k", f7: "p", g7: "p", h7: "p" }, moves: [{ from: "a1", to: "a8" }] },
    { mate: 1, note: "Two rooks make a ladder.", board: { a1: "R", b7: "R", e1: "K", h8: "k" }, moves: [{ from: "a1", to: "a8" }] },
    { mate: 1, note: "Your king guards the escape squares.", board: { d1: "Q", g6: "K", g8: "k" }, moves: [{ from: "d1", to: "d8" }] },
    { mate: 1, note: "King and rook box the king in.", board: { a1: "R", f6: "K", f8: "k" }, moves: [{ from: "a1", to: "a8" }] },
    { mate: 1, note: "Queen to the corner — your king does the rest.", board: { a1: "Q", g6: "K", h8: "k" }, moves: [{ from: "a1", to: "a8" }] },
    { mate: 2, note: "Check, the king runs to h7, then Qg7 mate (your king guards g7).", board: { f6: "K", b1: "Q", h8: "k" }, moves: [{ from: "b1", to: "b8" }, { from: "h8", to: "h7" }, { from: "b8", to: "g7" }] },
    { mate: 2, note: "Drive the king to a7, then Qb7 mate (your king guards b7).", board: { c6: "K", g1: "Q", a8: "k" }, moves: [{ from: "g1", to: "g8" }, { from: "a8", to: "a7" }, { from: "g8", to: "b7" }] }
  ];
  var chessIdx = -1;
  function openChess() {
    chessIdx = (chessIdx + 1) % CHESS.length;
    var P = CHESS[chessIdx];
    var files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    var glyph = { R: "♖", K: "♔", Q: "♕", B: "♗", N: "♘", P: "♙", r: "♜", k: "♚", q: "♛", b: "♝", n: "♞", p: "♟" };
    var board = {}, moveIndex = 0, sel = null, busy = false;
    function reset() { board = {}; Object.keys(P.board).forEach(function (k) { board[k] = P.board[k]; }); moveIndex = 0; sel = null; }
    function applyMove(from, to) { board[to] = board[from]; delete board[from]; }
    reset();
    function render(msg, solved) {
      var cells = "";
      for (var rank = 8; rank >= 1; rank--) for (var f = 0; f < 8; f++) {
        var id = files[f] + rank, light = (f + rank) % 2 === 1, pc = board[id] ? glyph[board[id]] : "";
        cells += '<div class="sq ' + (light ? "light" : "dark") + (sel === id ? " sel" : "") + '" data-sq="' + id + '">' + pc + '</div>';
      }
      openOverlay('<div class="gatehead">♟ Chess — White to move, <b>mate in ' + P.mate + '</b> <span class="x" id="gx">✕</span></div>' +
        '<div class="card"><div class="chess">' + cells + '</div>' +
        '<div class="chess-msg" style="color:' + (solved ? "#2f9e44" : "#c0392b") + '">' + (msg || (P.mate > 1 ? "Find the move that forces mate." : "Find the checkmate!")) + '</div>' +
        '<div class="row"><button class="menubtn" id="hintb">💡 Hint</button>' + (solved ? '<button class="menubtn" id="nextp">➡ Next puzzle</button>' : '<button class="menubtn" id="resetb">↺ Reset</button>') + '<button class="menubtn" id="menub">☰ Menu</button></div>' +
        '<div class="help">Puzzle ' + (chessIdx + 1) + ' of ' + CHESS.length + '</div></div>',
        function (e) { if (e.key === "Escape") openMenu(); });
      document.getElementById("gx").onclick = openMenu;
      document.getElementById("menub").onclick = openMenu;
      document.getElementById("hintb").onclick = function () { var c = obox.querySelector('[data-sq="' + P.moves[moveIndex].from + '"]'); if (c) c.classList.add("hint"); document.querySelector(".chess-msg").textContent = P.note; };
      var nb = document.getElementById("nextp"); if (nb) nb.onclick = openChess;
      var rb = document.getElementById("resetb"); if (rb) rb.onclick = function () { reset(); render(); };
      if (solved) return;
      Array.prototype.forEach.call(obox.querySelectorAll(".sq"), function (cell) {
        cell.onclick = function () {
          if (busy) return;
          var sq = cell.dataset.sq;
          if (!sel) { if (board[sq] && board[sq] === board[sq].toUpperCase()) { sel = sq; render(); } return; }
          var exp = P.moves[moveIndex];
          if (sel === exp.from && sq === exp.to) {
            applyMove(sel, sq); sel = null; moveIndex++;
            if (moveIndex >= P.moves.length) { render("Checkmate! 🏆 You solved it!", true); confetti(); return; }
            busy = true; render("Black runs away…");
            var bm = P.moves[moveIndex];
            setTimeout(function () { applyMove(bm.from, bm.to); moveIndex++; busy = false; render("Now finish the mate!"); }, 750);
          } else { reset(); render("Not the mate — try again!", false); }
        };
      });
    }
    render();
  }

  function checkVictory() {
    if (store.predicted(WORDS) >= 90 && !store.state.chessUnlocked) { store.state.chessUnlocked = true; store.save(); }
    if (store.predicted(WORDS) >= 100 && store.state._wonLesson !== activeLesson) {
      store.state._wonLesson = activeLesson; store.save(); confetti(); confetti();
      openOverlay('<div class="card hero" style="text-align:center"><div class="big-emoji">🏆</div><div class="hero-line">You mastered ' + esc(lesson.title) + '!</div><div class="hero-sub">Predicted grade: <b>A 🌟</b> — amazing! Chess is unlocked.</div><button class="submit big-next" id="ok">Play chess ⏎</button></div>', function (e) { if (e.key === "Enter") openChess(); });
      document.getElementById("ok").onclick = openChess;
    }
  }

  function confetti() {
    var cols = ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb", "#ffab40"];
    for (var i = 0; i < 22; i++) { var s = document.createElement("div"); s.style.cssText = "position:fixed;z-index:40;top:-16px;width:11px;height:11px;border-radius:3px;pointer-events:none;left:" + (8 + Math.random() * 84) + "vw;background:" + cols[i % 6] + ";transition:transform 1.1s ease-in,opacity 1.1s"; document.body.appendChild(s); (function (n) { requestAnimationFrame(function () { n.style.transform = "translateY(110vh) rotate(540deg)"; n.style.opacity = "0.2"; }); setTimeout(function () { n.remove(); }, 1200); })(s); }
  }

  // ---------- loop ----------
  window.addEventListener("resize", function () { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
  var clock = new THREE.Clock(), tAcc = 0;
  function animate() { requestAnimationFrame(animate); var dt = Math.min(clock.getDelta(), 0.05); tAcc += dt; if (!overlayOpen) updatePlayer(dt); animateChests(dt, tAcc); updateWalkers(dt, tAcc); updateCamera(); renderer.render(scene, camera); }

  // ---------- boot ----------
  buildBuildings();
  buildChests(WORDS);
  buildPortals();
  initWalkers();
  updateHUD();
  var verEl = document.getElementById("ver"); if (verEl) verEl.textContent = "build " + VOBLOX_VERSION;
  document.getElementById("loading").style.display = "none";
  if (!store.state.lastPlayed && !location.hash) openHelp();
  animate();
  if (location.hash === "#boss") startBoss(WORDS, "boss", "Boss: " + lesson.title);
  else if (location.hash === "#review") startReview();
  else if (location.hash.indexOf("#game=") === 0) { var gid = location.hash.slice(6); var gm = (window.VobloxGames || []).filter(function (x) { return x.id === gid; })[0]; if (gm) launchGame(gm); }
  else if (location.hash === "#chess") openChess();
  else if (location.hash === "#arcade") openBackpack("quests");
  else if (location.hash.indexOf("#hair=") === 0) { // test hook: preview a hairstyle on the 3D avatar
    var hs2 = location.hash.slice(6);
    store.state.profile.avatar.hair = hs2; store.state.profile.avatar.hairColor = "#e884c8"; store.save();
    if (window.VobloxAvatar) avatar.applyConfig(window.VobloxAvatar.resolve(store.state));
  }
  else if (location.hash === "#overview") { camPitch = 1.2; camDist = 34; } // test hook: bird's-eye of the island
  else if (location.hash === "#players") openPlayers(); // test hook: the players overlay
  else if (location.hash === "#locker") openBackpack("locker"); // test hook: the locker
  else if (location.hash === "#shop") openBackpack("shop"); // test hook: the shop (daily + whole-store browse)
  else if (location.hash === "#collection") openBackpack("collection"); // test hook: the Collection Book
  else if (location.hash === "#style") openBackpack("locker", "style"); // test hook: Style panel (hair + voice)
  else if (location.hash === "#bvzdemo" || location.hash === "#bvznight" || location.hash === "#bvzschool") { // test hooks: BvZ boards
    if (location.hash === "#bvznight") window._bvznight = 1;
    else if (location.hash === "#bvzschool") window._bvzschool = 1;
    else window._bvzdemo = 1;
    var bkgm = (window.VobloxGames || []).filter(function (x) { return x.id === "books"; })[0];
    if (bkgm) launchGame(bkgm);
  }
  else if (/^#(merge|dash|dungeon|clash|park|slice|blaster|beat|survivors|digger|gobble)demo$/.test(location.hash)) { // test hooks: seeded new-game boards
    var ngid = location.hash.slice(1).replace("demo", "");
    window["_" + ngid + "demo"] = 1;
    var ngm = (window.VobloxGames || []).filter(function (x) { return x.id === ngid; })[0];
    if (ngm) launchGame(ngm);
  }
  else if (location.hash.indexOf("#enter=") === 0) { // test hook: walk in through a building's DOOR (the path that once froze)
    var wantId = location.hash.slice(7);
    var bTarget = buildings.filter(function (b) { return b.def && (b.def.gameId === wantId || b.def.tab === wantId); })[0];
    if (bTarget) setTimeout(function () { enterBuilding(bTarget); }, 600);
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
