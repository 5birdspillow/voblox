/*
 * Voblox — ⛏️ VOCRAFT (voxel sandbox).
 * Chunked voxel world with face-culled meshing, first-person physics + collision,
 * PC (pointer-lock + WASD) and touch (joystick + look + buttons) controls.
 * Now a full game: diamond tier, treasure chests, slimes + bounce blocks,
 * sleeping bags, achievements, daily jobs, a Vobux block shop, and Miner rank —
 * all wired into the shared Vobux/XP economy (VobloxStore/Profile).
 */
(function () {
  "use strict";
  var THREE = window.THREE;
  var StoreAPI = window.VobloxStore, Content = window.VOBLOX_CONTENT, VQ = window.VobloxQuestions, Engine = window.VobloxEngine;
  window.onerror = function (m) { var b = document.getElementById("errbar"); if (b) { b.style.display = "block"; b.textContent = "⚠ " + m; } };

  // ---------- constants ----------
  var CHUNK = 16, WH = 48, SEA = 8, RENDER = ("ontouchstart" in window) ? 3 : 5;
  var B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, PLANK: 8, GLASS: 9, COBBLE: 10, BRICK: 11, SANDSTONE: 12, WORD: 13, COAL: 14, IRON: 15, GOLD: 16, SNOW: 17, FURNACE: 18, TORCH: 19, DIAMOND: 20, BOUNCE: 21, CHEST: 22, RAINBOW: 23, GLOW: 24, CANDY: 25, ICE: 26, TNT: 27, LAVA: 28 };
  var NAMES = { 1: "Grass", 2: "Dirt", 3: "Stone", 4: "Sand", 6: "Wood", 7: "Leaves", 8: "Planks", 9: "Glass", 10: "Cobble", 11: "Brick", 12: "Sandstone", 14: "Coal", 15: "Iron", 16: "Gold", 17: "Snow", 18: "Furnace", 19: "Torch", 20: "Diamond", 21: "Bounce!", 22: "Treasure", 23: "Rainbow", 24: "Glow", 25: "Candy", 26: "Ice", 27: "TNT", 28: "Lava" };
  // non-placeable items (ids >= 100)
  var IT = { STICK: 100, WPICK: 101, SPICK: 102, IPICK: 103, SWORD: 104, FOOD: 105, DPICK: 106, WOOL: 107, BAG: 108, SLIME: 109, DSWORD: 110, APPLE: 111, GAPPLE: 112, BOW: 113, ARROW: 114, AIRON: 115, ADIA: 116 };
  var ITNAME = { 100: "Stick", 101: "Wood Pick", 102: "Stone Pick", 103: "Iron Pick", 104: "Sword", 105: "Food", 106: "DIAMOND Pick", 107: "Wool", 108: "Sleeping Bag", 109: "Slimeball", 110: "Diamond Sword", 111: "Apple", 112: "GOLDEN Apple", 113: "Bow", 114: "Arrow", 115: "Iron Armor", 116: "DIAMOND Armor" };
  var ITEMOJI = { 100: "🪵", 101: "⛏️", 102: "⛏️", 103: "⛏️", 104: "🗡️", 105: "🍖", 106: "💠", 107: "🧶", 108: "🛏️", 109: "🟢", 110: "⚔️", 111: "🍎", 112: "🍏", 113: "🏹", 114: "➶", 115: "🛡️", 116: "🛡️" };
  function transparent(id) { return id === B.AIR || id === B.WATER || id === B.GLASS || id === B.LEAVES || id === B.LAVA; }
  function opaque(id) { return id !== B.AIR && !transparent(id); }
  function solid(id) { return id !== B.AIR && id !== B.WATER && id !== B.LAVA; } // collidable (you sink into lava — carefully!)

  var COL = {
    1: { top: [0.40, 0.72, 0.33], side: [0.52, 0.40, 0.26], bot: [0.45, 0.33, 0.21] },
    2: { all: [0.50, 0.36, 0.23] }, 3: { all: [0.50, 0.50, 0.53] }, 4: { all: [0.85, 0.79, 0.55] },
    5: { all: [0.20, 0.45, 0.85] }, 6: { top: [0.55, 0.42, 0.25], side: [0.48, 0.35, 0.21] },
    7: { all: [0.26, 0.55, 0.27] }, 8: { all: [0.78, 0.62, 0.40] }, 9: { all: [0.78, 0.88, 0.96] },
    10: { all: [0.43, 0.43, 0.46] }, 11: { all: [0.70, 0.33, 0.28] }, 12: { all: [0.90, 0.84, 0.60] },
    13: { all: [1.0, 0.84, 0.20] }, 14: { all: [0.22, 0.22, 0.24] }, 15: { all: [0.66, 0.56, 0.46] },
    16: { all: [0.88, 0.72, 0.26] }, 17: { all: [0.95, 0.97, 1.0] },
    18: { all: [0.30, 0.30, 0.33] }, 19: { all: [1.0, 0.74, 0.25] },
    20: { all: [0.45, 0.93, 0.95] }, 21: { all: [0.40, 0.85, 0.42] },
    22: { top: [0.80, 0.62, 0.24], side: [0.55, 0.38, 0.18] },
    23: { all: [1.0, 1.0, 1.0] }, 24: { all: [1.0, 0.95, 0.55] },
    25: { all: [0.98, 0.55, 0.75] }, 26: { all: [0.72, 0.90, 1.0] },
    27: { all: [0.85, 0.24, 0.20] }, 28: { all: [1.0, 0.46, 0.10] }
  };
  function faceCol(id, kind) { var c = COL[id] || COL[3]; return c[kind] || c.all || c.side || [1, 1, 1]; }

  var FACES = [
    { n: [0, 1, 0], k: "top", v: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
    { n: [0, -1, 0], k: "bot", v: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
    { n: [1, 0, 0], k: "side", v: [[1, 0, 1], [1, 1, 1], [1, 1, 0], [1, 0, 0]] },
    { n: [-1, 0, 0], k: "side", v: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]] },
    { n: [0, 0, 1], k: "side", v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
    { n: [0, 0, -1], k: "side", v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
  ];
  function shade(k) { return k === "top" ? 1.0 : k === "bot" ? 0.55 : 0.8; }

  // ---------- renderer / scene ----------
  var canvas = document.getElementById("cw");
  var renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd2ff);
  scene.fog = new THREE.Fog(0x8fd2ff, RENDER * CHUNK * 0.85, RENDER * CHUNK * 1.15);
  var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  var solidMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  var waterMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false });

  // ---------- save ----------
  var SAVE = "voblox.craft.v1";
  var save = { seed: 12345, edits: {}, px: 8, py: 30, pz: 8, yaw: 0, pitch: 0 };
  (function loadSave() {
    try { var raw = localStorage.getItem(SAVE); if (raw) { var o = JSON.parse(raw); if (o && o.edits) save = o; } } catch (e) {}
  })();
  var SEED = save.seed;
  var saveTimer = 0;
  function persist() { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) {} }

  var store = new StoreAPI.Store(Content.allWords());
  var inv = (save.inv = save.inv || {}); // collected materials {id:count}
  var unlocked = (save.unlocked = save.unlocked || []); // crafted placeable block ids added to hotbar
  function addInv(id, n) { inv[id] = (inv[id] || 0) + (n || 1); saveTimer = 1.5; }
  function takeInv(id, n) { if ((inv[id] || 0) < n) return false; inv[id] -= n; if (inv[id] <= 0) delete inv[id]; return true; }
  function hasInv(id, n) { return (inv[id] || 0) >= n; }
  function pickTier() { return inv[IT.DPICK] ? 4 : inv[IT.IPICK] ? 3 : inv[IT.SPICK] ? 2 : inv[IT.WPICK] ? 1 : 0; }

  // ---------- noise / generation ----------
  function hash(x, y, z) { var h = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 982451653 + SEED * 1013904223; h = (h ^ (h >>> 13)) >>> 0; h = (h * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  function smooth(a) { return a * a * (3 - 2 * a); }
  function noise2(x, z) {
    var x0 = Math.floor(x), z0 = Math.floor(z), tx = smooth(x - x0), tz = smooth(z - z0);
    var n00 = hash(x0, 0, z0), n10 = hash(x0 + 1, 0, z0), n01 = hash(x0, 0, z0 + 1), n11 = hash(x0 + 1, 0, z0 + 1);
    return (n00 * (1 - tx) + n10 * tx) * (1 - tz) + (n01 * (1 - tx) + n11 * tx) * tz;
  }
  function heightAt(wx, wz) {
    var n = noise2(wx / 26, wz / 26) * 0.6 + noise2(wx / 9, wz / 9) * 0.28 + noise2(wx / 60, wz / 60) * 0.12;
    return Math.max(3, Math.min(WH - 6, Math.floor(8 + n * 12)));
  }
  function noise3(x, y, z) {
    var x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), tx = smooth(x - x0), ty = smooth(y - y0), tz = smooth(z - z0);
    var c000 = hash(x0, y0, z0), c100 = hash(x0 + 1, y0, z0), c010 = hash(x0, y0 + 1, z0), c110 = hash(x0 + 1, y0 + 1, z0);
    var c001 = hash(x0, y0, z0 + 1), c101 = hash(x0 + 1, y0, z0 + 1), c011 = hash(x0, y0 + 1, z0 + 1), c111 = hash(x0 + 1, y0 + 1, z0 + 1);
    var a = (c000 * (1 - tx) + c100 * tx) * (1 - ty) + (c010 * (1 - tx) + c110 * tx) * ty;
    var b = (c001 * (1 - tx) + c101 * tx) * (1 - ty) + (c011 * (1 - tx) + c111 * tx) * ty;
    return a * (1 - tz) + b * tz;
  }

  // ---------- chunk store ----------
  var chunks = {}; // "cx,cz" -> {blocks:Uint8Array, mesh, water, dirty}
  function ckey(cx, cz) { return cx + "," + cz; }
  function idx(lx, ly, lz) { return lx + lz * CHUNK + ly * CHUNK * CHUNK; }
  function getChunk(cx, cz, make) {
    var k = ckey(cx, cz), c = chunks[k];
    if (!c && make) { c = chunks[k] = { blocks: null, mesh: null, water: null, dirty: true }; genChunk(c, cx, cz); }
    return c;
  }
  function genChunk(c, cx, cz) {
    var blocks = new Uint8Array(CHUNK * CHUNK * WH);
    for (var lx = 0; lx < CHUNK; lx++) for (var lz = 0; lz < CHUNK; lz++) {
      var wx = cx * CHUNK + lx, wz = cz * CHUNK + lz, h = heightAt(wx, wz);
      var biome = noise2(wx / 70 + 50, wz / 70 + 50);
      var desert = biome > 0.66 && h < SEA + 6;
      var snowy = (!desert) && (h > SEA + 9 || biome < 0.16);
      var surf = (h < SEA) ? B.SAND : desert ? B.SAND : snowy ? B.SNOW : B.GRASS;
      for (var ly = 0; ly <= h; ly++) {
        var id;
        if (ly === h) id = surf;
        else if (ly > h - 3) id = desert ? B.SANDSTONE : (h < SEA ? B.SAND : B.DIRT);
        else {
          id = B.STONE;
          if (ly > 1) {
            var orr = hash(wx, ly, wz);
            if (hash(wx, ly + 700, wz) > 0.9975) id = B.WORD;
            else if (orr > 0.986) id = (ly < 6 && orr > 0.9986) ? B.DIAMOND : (ly < 8 && orr > 0.996) ? B.GOLD : B.COAL;
            else if (orr < 0.013) id = B.IRON;
            else if (ly > 2 && ly < 16 && hash(wx, ly + 1400, wz) > 0.99955) id = B.CHEST; // buried treasure!
          }
        }
        if (ly > 1 && ly < h - 4) { var n3 = noise3(wx / 13, ly / 9, wz / 13); if (n3 > 0.78) id = (ly < 6 && n3 > 0.815) ? B.LAVA : B.AIR; } // caves, with lava pools at the very bottom
        blocks[idx(lx, ly, lz)] = id;
      }
      if (h < SEA) for (var wy = h + 1; wy <= SEA; wy++) if (blocks[idx(lx, wy, lz)] === B.AIR) blocks[idx(lx, wy, lz)] = B.WATER;
      if (surf === B.GRASS && hash(wx, 333, wz) > 0.995) blocks[idx(lx, h, lz)] = B.WORD; // findable word crystal on the surface
      // trees only on grassy land
      if (surf === B.GRASS && lx > 1 && lx < CHUNK - 2 && lz > 1 && lz < CHUNK - 2 && hash(wx, 7, wz) > 0.978) {
        var th = 4 + Math.floor(hash(wx, 8, wz) * 2);
        for (var t = 1; t <= th; t++) if (h + t < WH) blocks[idx(lx, h + t, lz)] = B.LOG;
        for (var dx = -2; dx <= 2; dx++) for (var dz = -2; dz <= 2; dz++) for (var dy = th - 1; dy <= th + 1; dy++) {
          if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - th) > 3) continue;
          var lxx = lx + dx, lzz = lz + dz, yy = h + dy;
          if (lxx >= 0 && lxx < CHUNK && lzz >= 0 && lzz < CHUNK && yy < WH && blocks[idx(lxx, yy, lzz)] === B.AIR) blocks[idx(lxx, yy, lzz)] = B.LEAVES;
        }
      }
    }
    // ~7% of chunks hide a DUNGEON: a cobblestone room deep underground with loot
    if (hash(cx, 999, cz) > 0.93) {
      var ry = 3;
      for (var ax = 4; ax <= 11; ax++) for (var az = 4; az <= 11; az++) for (var ay = ry; ay <= ry + 4; ay++) {
        var isWall = (ax === 4 || ax === 11 || az === 4 || az === 11 || ay === ry || ay === ry + 4);
        blocks[idx(ax, ay, az)] = isWall ? B.COBBLE : B.AIR;
      }
      blocks[idx(6, ry + 1, 6)] = B.CHEST; blocks[idx(9, ry + 1, 9)] = B.CHEST;
      blocks[idx(6, ry + 1, 9)] = B.GOLD; blocks[idx(9, ry + 1, 6)] = B.WORD;
      blocks[idx(7, ry + 1, 7)] = B.TORCH; blocks[idx(8, ry + 1, 8)] = B.TORCH;
    }
    c.blocks = blocks;
    // apply saved edits in this chunk
    for (var key in save.edits) {
      var p = key.split(","), ex = +p[0], ey = +p[1], ez = +p[2];
      if (Math.floor(ex / CHUNK) === cx && Math.floor(ez / CHUNK) === cz && ey >= 0 && ey < WH) {
        blocks[idx(((ex % CHUNK) + CHUNK) % CHUNK, ey, ((ez % CHUNK) + CHUNK) % CHUNK)] = save.edits[key];
      }
    }
  }

  function getBlock(wx, wy, wz) {
    if (wy < 0) return B.STONE; if (wy >= WH) return B.AIR;
    var cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK), c = chunks[ckey(cx, cz)];
    if (!c || !c.blocks) return B.AIR;
    return c.blocks[idx(((wx % CHUNK) + CHUNK) % CHUNK, wy, ((wz % CHUNK) + CHUNK) % CHUNK)];
  }
  function setBlock(wx, wy, wz, id) {
    if (wy < 0 || wy >= WH) return;
    var cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK), c = getChunk(cx, cz, true);
    var lx = ((wx % CHUNK) + CHUNK) % CHUNK, lz = ((wz % CHUNK) + CHUNK) % CHUNK;
    c.blocks[idx(lx, wy, lz)] = id; c.dirty = true;
    save.edits[wx + "," + wy + "," + wz] = id; saveTimer = 1.5;
    // re-mesh neighbor chunk if on border
    if (lx === 0) markDirty(cx - 1, cz); if (lx === CHUNK - 1) markDirty(cx + 1, cz);
    if (lz === 0) markDirty(cx, cz - 1); if (lz === CHUNK - 1) markDirty(cx, cz + 1);
  }
  function markDirty(cx, cz) { var c = chunks[ckey(cx, cz)]; if (c) c.dirty = true; }

  // ---------- meshing ----------
  function meshChunk(cx, cz) {
    var c = chunks[ckey(cx, cz)]; if (!c || !c.blocks) return;
    var sp = [], sc = [], wp = [], wc = [];
    for (var lx = 0; lx < CHUNK; lx++) for (var ly = 0; ly < WH; ly++) for (var lz = 0; lz < CHUNK; lz++) {
      var id = c.blocks[idx(lx, ly, lz)]; if (id === B.AIR) continue;
      var wx = cx * CHUNK + lx, wy = ly, wz = cz * CHUNK + lz;
      var isW = (id === B.WATER);
      for (var f = 0; f < FACES.length; f++) {
        var F = FACES[f], nb = getBlock(wx + F.n[0], wy + F.n[1], wz + F.n[2]);
        var drawn = isW ? (nb === B.AIR && F.k === "top") : (!opaque(nb) && !(transparent(id) && nb === id));
        if (!drawn) continue;
        var glow = (id === B.WORD || id === B.TORCH || id === B.GLOW || id === B.DIAMOND || id === B.LAVA);
        var col = faceCol(id, F.k), s = isW ? 0.9 : (glow ? 1.0 : shade(F.k));
        if (id === B.RAINBOW) { // every rainbow block gets its own bright hue
          var hu = hash(wx * 3 + 11, wy * 3 + 17, wz * 3 + 23) * 6;
          var hi = Math.floor(hu), hf = hu - hi;
          col = [[1, hf, 0], [1 - hf, 1, 0], [0, 1, hf], [0, 1 - hf, 1], [hf, 0, 1], [1, 0, 1 - hf]][hi % 6];
        }
        if (!isW && !glow && id !== B.RAINBOW) s *= 0.9 + 0.1 * hash(wx * 2 + 1, wy * 2 + 5, wz * 2 + 9); // subtle per-block variation
        var P = isW ? wp : sp, C = isW ? wc : sc, order = [0, 1, 2, 0, 2, 3];
        for (var o = 0; o < 6; o++) { var vv = F.v[order[o]]; P.push(wx + vv[0], wy + vv[1], wz + vv[2]); C.push(col[0] * s, col[1] * s, col[2] * s); }
      }
    }
    if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
    if (c.water) { scene.remove(c.water); c.water.geometry.dispose(); c.water = null; }
    if (sp.length) { var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3)); c.mesh = new THREE.Mesh(g, solidMat); scene.add(c.mesh); }
    if (wp.length) { var gw = new THREE.BufferGeometry(); gw.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3)); gw.setAttribute("color", new THREE.Float32BufferAttribute(wc, 3)); c.water = new THREE.Mesh(gw, waterMat); scene.add(c.water); }
    c.dirty = false;
  }

  // ---------- chunk streaming ----------
  function streamChunks() {
    var pcx = Math.floor(player.pos.x / CHUNK), pcz = Math.floor(player.pos.z / CHUNK);
    // ensure generated within RENDER+1 (for border meshing)
    for (var dx = -RENDER - 1; dx <= RENDER + 1; dx++) for (var dz = -RENDER - 1; dz <= RENDER + 1; dz++) getChunk(pcx + dx, pcz + dz, true);
    // mesh dirty within RENDER (budget a few per frame)
    var did = 0;
    for (var ddx = -RENDER; ddx <= RENDER && did < 3; ddx++) for (var ddz = -RENDER; ddz <= RENDER && did < 3; ddz++) {
      var c = chunks[ckey(pcx + ddx, pcz + ddz)]; if (c && c.dirty) { meshChunk(pcx + ddx, pcz + ddz); did++; }
    }
    // unload far
    for (var k in chunks) { var p = k.split(","), ax = +p[0], az = +p[1]; if (Math.abs(ax - pcx) > RENDER + 2 || Math.abs(az - pcz) > RENDER + 2) { var cc = chunks[k]; if (cc.mesh) { scene.remove(cc.mesh); cc.mesh.geometry.dispose(); } if (cc.water) { scene.remove(cc.water); cc.water.geometry.dispose(); } delete chunks[k]; } }
  }

  // ---------- player ----------
  var player = { pos: new THREE.Vector3(save.px, save.py, save.pz), vel: new THREE.Vector3(), onGround: false, yaw: save.yaw || 0, pitch: save.pitch || 0, health: (typeof save.health === "number" ? save.health : 10), hunger: (typeof save.hunger === "number" ? save.hunger : 10), _fellFrom: null };
  var PW = 0.6, PH = 1.8, EYE = 1.62; // width, height, eye height
  function collides(px, py, pz) {
    var x0 = Math.floor(px - PW / 2), x1 = Math.floor(px + PW / 2);
    var y0 = Math.floor(py), y1 = Math.floor(py + PH);
    var z0 = Math.floor(pz - PW / 2), z1 = Math.floor(pz + PW / 2);
    for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++) if (solid(getBlock(x, y, z))) return true;
    return false;
  }
  function moveAxis(axis, d) {
    var p = player.pos.clone(); p[axis] += d;
    if (!collides(p.x, p.y, p.z)) { player.pos[axis] += d; return false; }
    return true; // blocked
  }
  var speedT = 0, bobPhase = 0, lavaT = 0, sprinting = false;
  function updatePlayer(dt) {
    if (paused) return;
    if (speedT > 0) speedT -= dt;
    var input = readMove();
    sprinting = (keys["shift"] || Math.hypot(joy.x, joy.y) > 0.93) && (input.x !== 0 || input.z !== 0);
    var sp = 4.6 * (sprinting ? 1.42 : 1) * (speedT > 0 ? 1.35 : 1);
    var s = Math.sin(player.yaw), c = Math.cos(player.yaw);
    // camera forward is (-sin yaw, -cos yaw); rotate input by +yaw so W always walks
    // toward the crosshair (the old transposed matrix inverted controls once you turned)
    var wx = (input.x * c + input.z * s), wz = (-input.x * s + input.z * c);
    var len = Math.hypot(wx, wz); if (len > 1) { wx /= len; wz /= len; }
    player.vel.x = wx * sp; player.vel.z = wz * sp;
    player.vel.y -= 22 * dt; if (player.vel.y < -45) player.vel.y = -45;
    if (jumpReq && player.onGround) { player.vel.y = 8.2; player.onGround = false; } jumpReq = false;
    moveAxis("x", player.vel.x * dt);
    moveAxis("z", player.vel.z * dt);
    if (moveAxis("y", player.vel.y * dt)) player.vel.y = 0;
    player.onGround = collides(player.pos.x, player.pos.y - 0.08, player.pos.z); // probe just below feet
    if (player.onGround) {
      var under = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.4), Math.floor(player.pos.z));
      if (under === B.BOUNCE) { // jump pad! boing — and no fall damage
        player.vel.y = 13; player.onGround = false; player._fellFrom = null;
        sfx(520, 0.1, "sine", 0.06); sfx(780, 0.12, "sine", 0.05);
      } else if (player._fellFrom != null) {
        var fd = player._fellFrom - player.pos.y;
        if (fd > 4.5) hurtPlayer(Math.min(6, Math.floor(fd - 4)));
        player._fellFrom = null;
      }
    }
    else player._fellFrom = (player._fellFrom == null) ? player.pos.y : Math.max(player._fellFrom, player.pos.y);
    // lava is HOT (stand clear!)
    var feet = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.1), Math.floor(player.pos.z));
    var waist = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.9), Math.floor(player.pos.z));
    if (feet === B.LAVA || waist === B.LAVA) {
      lavaT += dt; player._fellFrom = null;
      if (lavaT > 0.7) { lavaT = 0; hurtPlayer(1); toast("🔥 HOT HOT HOT — get out of the lava!"); }
    } else lavaT = 0;
    // walk bob + sprint feel
    var hv = Math.hypot(player.vel.x, player.vel.z);
    if (player.onGround && hv > 1) bobPhase += dt * hv * 1.9; else bobPhase *= 0.9;
    var wantFov = sprinting ? 77 : (speedT > 0 ? 78 : 70);
    if (Math.abs(camera.fov - wantFov) > 0.2) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 7); camera.updateProjectionMatrix(); }
    if (sprinting) hungerT += dt * 0.5; // sprinting makes you hungry
    // clamp into world vertically
    if (player.pos.y < -8) { player.pos.set(player.pos.x, heightAt(player.pos.x, player.pos.z) + 3, player.pos.z); player.vel.set(0, 0, 0); }
  }
  function updateCamera() {
    var bob = Math.sin(bobPhase * 2.1) * 0.045;
    camera.position.set(player.pos.x, player.pos.y + EYE + bob, player.pos.z);
    var cp = Math.cos(player.pitch);
    camera.lookAt(player.pos.x - Math.sin(player.yaw) * cp, player.pos.y + EYE + bob + Math.sin(player.pitch), player.pos.z - Math.cos(player.yaw) * cp);
  }

  // ---------- raycast (voxel DDA) ----------
  function fwd() { return { x: -Math.sin(player.yaw) * Math.cos(player.pitch), y: Math.sin(player.pitch), z: -Math.cos(player.yaw) * Math.cos(player.pitch) }; }
  function ray() {
    var d = fwd(), ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
    var pcx = null, pcy = null, pcz = null; // last empty cell (for placement)
    for (var t = 0; t <= 5.5; t += 0.06) {
      var x = Math.floor(ox + d.x * t), y = Math.floor(oy + d.y * t), z = Math.floor(oz + d.z * t);
      if (pcx === x && pcy === y && pcz === z) continue;
      var bid = getBlock(x, y, z);
      if (bid !== B.AIR && bid !== B.WATER) return { x: x, y: y, z: z, px: (pcx === null ? x : pcx), py: (pcy === null ? y : pcy), pz: (pcz === null ? z : pcz), id: bid };
      pcx = x; pcy = y; pcz = z;
    }
    return null;
  }
  function dropFor(id, tier) {
    if (id === B.STONE || id === B.COBBLE || id === B.COAL || id === B.IRON || id === B.BRICK || id === B.SANDSTONE) return tier >= 1 ? (id === B.STONE ? B.COBBLE : id) : null;
    if (id === B.GOLD) return tier >= 3 ? B.GOLD : null;
    if (id === B.DIAMOND) return tier >= 3 ? B.DIAMOND : null; // iron pick unlocks diamonds
    if (id === B.GRASS || id === B.DIRT) return B.DIRT;
    if (id === B.LEAVES || id === B.WATER || id === B.LAVA) return null;
    return id; // sand, log, plank, glass, snow, furnace, torch, shop blocks drop themselves
  }
  function openTreasure(h) {
    setBlock(h.x, h.y, h.z, B.AIR);
    stats.chests = (stats.chests || 0) + 1;
    var roll = Math.random(), msg;
    if (roll < 0.10) { addInv(B.DIAMOND, 1); msg = "💠 a DIAMOND!!"; }
    else if (roll < 0.40) { var v = 10 + Math.floor(Math.random() * 16); store.state.gems += v; store.save(); updateHud(); msg = "+" + v + " Vobux!"; }
    else if (roll < 0.70) { addInv(B.IRON, 3 + Math.floor(Math.random() * 3)); msg = "iron bars!"; }
    else if (roll < 0.9) { addInv(IT.FOOD, 3); msg = "a picnic! 🍖×3"; }
    else { addInv(B.GOLD, 2); msg = "gold!"; }
    toast("🎁 Treasure chest: " + msg);
    cfetti(); chime(); renderHotbar();
    bumpJob("chests", 1); checkAch();
  }
  // ---------- hold-to-mine: blocks take time, better picks mine FASTER ----------
  var PICKBLOCKS = {}; [B.STONE, B.COBBLE, B.BRICK, B.SANDSTONE, B.FURNACE, B.COAL, B.IRON, B.GOLD, B.DIAMOND].forEach(function (b2) { PICKBLOCKS[b2] = 1; });
  var HARDNESS = {};
  [[B.LEAVES, 0.2], [B.GRASS, 0.35], [B.DIRT, 0.35], [B.SAND, 0.35], [B.SNOW, 0.35],
   [B.LOG, 0.5], [B.PLANK, 0.5], [B.GLASS, 0.3], [B.ICE, 0.3], [B.CANDY, 0.3], [B.GLOW, 0.3], [B.RAINBOW, 0.3], [B.BOUNCE, 0.3], [B.TORCH, 0.15], [B.TNT, 0.3],
   [B.STONE, 0.9], [B.COBBLE, 0.9], [B.BRICK, 0.9], [B.SANDSTONE, 0.9], [B.FURNACE, 0.9],
   [B.COAL, 1.1], [B.IRON, 1.1], [B.GOLD, 1.25], [B.DIAMOND, 1.5],
   [B.WORD, 0.25], [B.CHEST, 0.3]].forEach(function (p2) { HARDNESS[p2[0]] = p2[1]; });
  function mineTime(id) {
    var base = HARDNESS[id] || 0.5;
    if (PICKBLOCKS[id]) {
      var tier = pickTier();
      base = tier > 0 ? base / (0.6 + 0.5 * tier) : base * 2.2; // no pick = painfully slow (and no drop)
    }
    return base;
  }
  var mineHeld = false, mineT = 0, mineTarget = null, mineIdle = 0, atkSwing = 0, needPickHintT = 0;
  var crackBox = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0x111111, wireframe: true, transparent: true, opacity: 0.85 }));
  crackBox.visible = false; scene.add(crackBox);
  var ringEl = document.createElement("div"); ringEl.id = "mring"; document.body.appendChild(ringEl);
  function clearMineVis() { crackBox.visible = false; ringEl.style.display = "none"; }
  function updateMining(dt) {
    atkSwing -= dt; needPickHintT -= dt;
    if (!mineHeld || paused || dead) {
      mineIdle += dt; if (mineIdle > 1.1) { mineTarget = null; mineT = 0; } // taps within ~1s keep chipping the same block
      clearMineVis(); return;
    }
    mineIdle = 0;
    var mi = attackTarget();
    if (mi != null) { if (atkSwing <= 0) { hitMob(mi); atkSwing = 0.38; } clearMineVis(); return; }
    var h = ray();
    if (!h) { clearMineVis(); return; }
    if (!mineTarget || mineTarget.x !== h.x || mineTarget.y !== h.y || mineTarget.z !== h.z) { mineTarget = { x: h.x, y: h.y, z: h.z }; mineT = 0.1; } // small head start so taps feel snappy
    mineT += dt;
    var need = mineTime(h.id), pr = Math.min(1, mineT / need);
    crackBox.visible = true; crackBox.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5);
    var cs = 1.02 - pr * 0.16; crackBox.scale.set(cs, cs, cs);
    ringEl.style.display = "block";
    ringEl.style.background = "conic-gradient(#ffce3a " + Math.round(pr * 360) + "deg, #ffffff22 0deg)";
    if ((mineT % 0.24) < dt) { sfx(150 + pr * 90, 0.05, "square", 0.035); puff(h.x, h.y, h.z, h.id); }
    if (PICKBLOCKS[h.id] && pickTier() === 0 && needPickHintT <= 0) { needPickHintT = 4; toast("⛏️ Craft a pickaxe (E) to mine stone properly!"); }
    if (pr >= 1) { finishMine(h); mineTarget = null; mineT = 0; clearMineVis(); }
  }
  function finishMine(h) {
    if (h.id === B.WORD) { mineHeld = false; openWordGate(h.x, h.y, h.z); return; }
    if (h.id === B.CHEST) { mineHeld = false; openTreasure(h); return; }
    var tier = pickTier();
    var drop = dropFor(h.id, tier);
    if (drop) {
      addInv(drop, 1);
      // the diamond pick sometimes strikes double ore
      if (tier >= 4 && (drop === B.COAL || drop === B.IRON || drop === B.GOLD || drop === B.DIAMOND) && Math.random() < 0.3) addInv(drop, 1);
      if (drop === B.DIAMOND) { stats.diamonds = (stats.diamonds || 0) + 1; toast("💠 DIAMOND!"); chime(); }
      if (drop === B.LOG) { stats.logs = (stats.logs || 0) + 1; bumpJob("logs", 1); }
    }
    if (h.id === B.LEAVES && Math.random() < 0.12) { addInv(IT.APPLE, 1); toast("🍎 An apple fell out!"); }
    stats.mined = (stats.mined || 0) + 1;
    if (h.y < (stats.deepest === undefined ? 99 : stats.deepest)) stats.deepest = h.y;
    sess.mined++;
    bumpJob("mine", 1);
    puff(h.x, h.y, h.z, h.id); sfx(170, 0.07, "square", 0.055); sfx(90, 0.09, "square", 0.03);
    setBlock(h.x, h.y, h.z, B.AIR); renderHotbar();
    checkAch();
  }
  function doMine() { // single swing (kept for tests + instant attack on press)
    if (paused) return;
    var mi = attackTarget(); if (mi != null) { hitMob(mi); atkSwing = 0.38; return; }
  }
  function doPlace() {
    if (paused) return;
    // aiming at a wolf? the place button becomes "offer food" (that's how you tame your dog!)
    var mi = attackTarget();
    if (mi != null && mobs[mi].type === "wolf") { feedWolf(mi); return; }
    var h = ray(); if (!h) return;
    var nx = h.px, ny = h.py, nz = h.pz;
    // don't place inside the player
    var fex = player.pos.x, fey = player.pos.y, fez = player.pos.z;
    if (nx === Math.floor(fex) && nz === Math.floor(fez) && (ny === Math.floor(fey) || ny === Math.floor(fey + 1))) return;
    var id = hotbar[sel];
    setBlock(nx, ny, nz, id); sfx(330, 0.05, "triangle", 0.045);
    stats.placed = (stats.placed || 0) + 1; sess.placed++;
    bumpJob("place", 1);
    if (id === B.TNT) armTNT(nx, ny, nz);
    checkAch();
  }
  // gentle, kid-safe TNT: 2s fuse, small crater, no player damage, keeps crystals/chests
  function armTNT(x, y, z) {
    toast("🧨 TNT armed — stand back!");
    setTimeout(function () {
      if (getBlock(x, y, z) !== B.TNT) return; // was mined back up
      for (var dx = -2; dx <= 2; dx++) for (var dy = -2; dy <= 2; dy++) for (var dz = -2; dz <= 2; dz++) {
        if (dx * dx + dy * dy + dz * dz > 5.2) continue;
        var bid = getBlock(x + dx, y + dy, z + dz);
        if (bid !== B.AIR && bid !== B.WATER && bid !== B.WORD && bid !== B.CHEST) setBlock(x + dx, y + dy, z + dz, B.AIR);
      }
      puff(x, y, z, B.TNT); puff(x + 1, y, z, B.TNT); puff(x, y + 1, z, B.TNT);
      sfx(90, 0.4, "sawtooth", 0.09); sfx(60, 0.5, "square", 0.07);
    }, 2000);
  }

  // ---------- word-mining (the learning hook) ----------
  var COV = document.getElementById("coverlay"), COVB = document.getElementById("coverlaybox"), wordKey = null, lastWordAsked = null, wordSense = {};
  function openWordGate(bx, by, bz) {
    paused = true; if (document.pointerLockElement) document.exitPointerLock();
    var lessonWords = Content.getLesson(store.state.activeLesson || "5").words;
    var cards = store.cardsFor(lessonWords);
    var card = Engine.selectDue(cards, Date.now(), lastWordAsked) || cards[0];
    lastWordAsked = card.word;
    var data = VQ.wordData(lessonWords, card.word);
    var si = (wordSense[card.word] || 0) % data.senses.length; wordSense[card.word] = (si + 1) % data.senses.length;
    var q = VQ.gen(card, lessonWords, { format: Engine.pickFormat(card, data, null), senseIdx: si });
    renderWordQ(bx, by, bz, q); VQ.readQ(q);
  }
  function renderWordQ(bx, by, bz, q) {
    var body = q.kind === "mc"
      ? '<div class="choices">' + q.choices.map(function (ch, i) { return '<button class="choice" data-i="' + i + '"><span class="num">' + (i + 1) + '</span>' + VQ.esc(ch.label) + '</button>'; }).join("") + '</div>'
      : '<div class="typebox"><input id="wans" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="type here…"><button id="wsub" class="submit">Enter ⏎</button><div id="whint" class="hint"></div></div>';
    // no ✕ here on purpose: you chose to mine the crystal, so the word gets answered
    // (a wrong answer still gets you out — through the reading gate)
    COVB.innerHTML = '<div class="gatehead">✨ Word Crystal!</div><div class="card qcard"><div class="prompt">' + q.promptHTML + ' <button class="replay" type="button" title="Read again">🔊</button></div>' + body + '</div>';
    COV.style.display = "flex";
    window._lastQ = q; // test hooks peek at this
    var rep = COVB.querySelector(".replay"); if (rep) rep.onclick = function () { VQ.readQ(q); };
    q._born = Date.now(); q._ready = false;
    if (q.kind === "mc") {
      var btns = COVB.querySelectorAll(".choice");
      Array.prototype.forEach.call(btns, function (b) { b.onclick = function () { answerWord(bx, by, bz, q, !!q.choices[+b.dataset.i].correct, b); }; });
      VQ.lockChoices(btns, VQ.COSTS.lockMs);
      setTimeout(function () { q._ready = true; }, VQ.COSTS.lockMs);
      wordKey = function (e) { if (!q._ready) return; var n = parseInt(e.key, 10); if (n >= 1 && n <= q.choices.length) answerWord(bx, by, bz, q, !!q.choices[n - 1].correct); };
    } else {
      q._ready = true;
      var inp = document.getElementById("wans"); if (inp && !("ontouchstart" in window)) inp.focus();
      var sub = function () { var r = VQ.checkText(q, inp.value); if (r === "empty") return; if (r === "near" && !q._r) { q._r = true; document.getElementById("whint").textContent = "So close — check the spelling!"; inp.select(); return; } answerWord(bx, by, bz, q, r === "correct"); };
      document.getElementById("wsub").onclick = sub;
      wordKey = function (e) { if (e.key === "Enter") sub(); };
    }
  }
  function answerWord(bx, by, bz, q, correct, btn) {
    store.record(q, correct);
    if (q.kind === "mc") Array.prototype.forEach.call(COVB.querySelectorAll(".choice"), function (b, idx) { b.disabled = true; if (q.choices[idx].correct) b.classList.add("right"); else if (b === btn) b.classList.add("wrong"); });
    if (correct) {
      setBlock(bx, by, bz, B.AIR); store.state.gems += 15; addInv(B.IRON, 2); store.save(); cfetti(); chime(); renderHotbar();
      stats.crystals = (stats.crystals || 0) + 1; sess.crystals++;
      bumpJob("crystals", 1); checkAch();
      var head = '<div class="fb good">✅ Crystal cracked! <span class="gain">+15 <img class="vbx" src="icons/vobux.png" alt="Vobux"> &amp; 2 iron ⛏️</span></div>';
      COVB.innerHTML = '<div class="gatehead">✨ Word Crystal</div><div class="card qcard">' + head + '<div class="reveal">' + VQ.entryHTML(q.data, { mnem: true }) + '</div><button id="wnext" class="submit big-next">Continue ⏎</button></div>';
      document.getElementById("wnext").onclick = closeWordGate;
      wordKey = function (e) { if (e.key === "Enter") closeWordGate(); };
    } else {
      // guessing costs Vobux, and the only way out is reading + a quick check
      VQ.markRushed(store, q._born || 0);
      var lost = VQ.chargeVobux(store, VQ.COSTS.wrong);
      VQ.speak(q.data.word + ". " + q.data.senses[0].def);
      COVB.innerHTML = '<div class="gatehead">✨ Word Crystal</div><div class="card qcard" id="wgate"></div>';
      wordKey = null;
      VQ.teachGate(document.getElementById("wgate"), q.data, {
        words: Content.getLesson(store.state.activeLesson || "5").words,
        senseIdx: q.senseIdx || 0,
        headHTML: '<div class="fb bad">❌ The crystal holds' + (lost ? " (−" + lost + ' <img class="vbx" src="icons/vobux.png" alt="Vobux">)' : "") + " — learn the word:</div>"
      }, function () {
        VQ.payVobux(store, VQ.COSTS.readBack);
        toast("📖 Nice reading! +" + VQ.COSTS.readBack + " Vobux");
        updateHud();
        closeWordGate();
      });
    }
    updateHud();
  }
  function closeWordGate() { VQ.shush(); COV.style.display = "none"; paused = false; wordKey = null; keys = {}; jumpReq = false; joy.x = 0; joy.y = 0; }
  function cfetti() { var cols = ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"]; for (var i = 0; i < 16; i++) { var s = document.createElement("div"); s.style.cssText = "position:fixed;z-index:60;top:-14px;width:11px;height:11px;border-radius:3px;pointer-events:none;left:" + (8 + Math.random() * 84) + "vw;background:" + cols[i % 5] + ";transition:transform 1.1s ease-in,opacity 1.1s"; document.body.appendChild(s); (function (n) { requestAnimationFrame(function () { n.style.transform = "translateY(110vh) rotate(540deg)"; n.style.opacity = "0.2"; }); setTimeout(function () { n.remove(); }, 1200); })(s); } }

  // ---------- input ----------
  var keys = {}, jumpReq = false, joy = { x: 0, y: 0 }, paused = false;
  function readMove() {
    var x = 0, z = 0;
    if (keys["w"] || keys["arrowup"]) z -= 1; if (keys["s"] || keys["arrowdown"]) z += 1;
    if (keys["a"] || keys["arrowleft"]) x -= 1; if (keys["d"] || keys["arrowright"]) x += 1;
    x += joy.x; z += joy.y;
    return { x: x, z: z };
  }
  // keyboard
  document.addEventListener("keydown", function (e) {
    if (paused) { if (wordKey) wordKey(e); return; }
    var k = (e.key || "").toLowerCase(); keys[k] = true;
    if (k === " ") { jumpReq = true; e.preventDefault(); }
    if (k === "e") { openCraft(); return; }
    if (k === "f") { eat(); return; }
    if (k === "q") { openBook(); return; }
    if (k === "z") { sleep(); return; }
    if (k === "r") { shoot(); return; }
    if (k >= "1" && k <= "9") { var i = +k - 1; if (i < hotbar.length) { sel = i; renderHotbar(); } }
  });
  document.addEventListener("keyup", function (e) { keys[(e.key || "").toLowerCase()] = false; });
  // pointer lock look + mouse mine/place (PC)
  canvas.addEventListener("click", function () { if (paused) return; if (!("ontouchstart" in window) && document.pointerLockElement !== canvas) canvas.requestPointerLock(); });
  document.addEventListener("mousemove", function (e) {
    if (paused) return;
    if (document.pointerLockElement === canvas) { player.yaw -= (e.movementX || 0) * 0.0024; player.pitch = clamp(player.pitch - (e.movementY || 0) * 0.0024, -1.5, 1.5); }
  });
  document.addEventListener("mousedown", function (e) {
    if (document.pointerLockElement !== canvas) return;
    if (e.button === 0) { mineHeld = true; doMine(); } else if (e.button === 2) doPlace();
  });
  document.addEventListener("mouseup", function (e) { if (e.button === 0) mineHeld = false; });
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // touch controls
  var touchEl = document.getElementById("touch");
  var joyEl, nubEl, joyId = null, jox = 0, joy0y = 0, lookId = null, lx0 = 0, ly0 = 0;
  if ("ontouchstart" in window) {
    joyEl = document.createElement("div"); joyEl.id = "tjoy"; nubEl = document.createElement("div"); nubEl.id = "tnub"; joyEl.appendChild(nubEl); document.body.appendChild(joyEl);
    addBtn("bMine", "⛏", function () { doMine(); });
    // the mine button is HOLD-to-mine (blocks chip away while pressed)
    var bm = document.getElementById("bMine");
    bm.addEventListener("touchstart", function () { mineHeld = true; }, { passive: true });
    bm.addEventListener("touchend", function () { mineHeld = false; }, { passive: true });
    bm.addEventListener("touchcancel", function () { mineHeld = false; }, { passive: true });
    addBtn("bPlace", "▦", function () { doPlace(); });
    addBtn("bJump", "⤒", function () { jumpReq = true; });
    addBtn("bCraft", "📦", function () { openCraft(); });
    addBtn("bEat", "🍖", function () { eat(); });
    addBtn("bBook", "📖", function () { openBook(); });
    addBtn("bBow", "🏹", function () { shoot(); });
    canvas.addEventListener("touchstart", function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i];
        if (t.clientX < window.innerWidth * 0.5 && joyId === null) { joyId = t.identifier; jox = t.clientX; joy0y = t.clientY; joyEl.style.display = "block"; joyEl.style.left = (t.clientX - 64) + "px"; joyEl.style.top = (t.clientY - 64) + "px"; moveNub(0, 0); }
        else if (lookId === null) { lookId = t.identifier; lx0 = t.clientX; ly0 = t.clientY; }
      }
    }, { passive: true });
    canvas.addEventListener("touchmove", function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i];
        if (t.identifier === joyId) { var dx = t.clientX - jox, dy = t.clientY - joy0y, m = Math.hypot(dx, dy) || 1, cl = Math.min(m, 50) / 50; joy.x = (dx / m) * cl; joy.y = (dy / m) * cl; moveNub(dx, dy); }
        else if (t.identifier === lookId) { player.yaw -= (t.clientX - lx0) * 0.006; player.pitch = clamp(player.pitch - (t.clientY - ly0) * 0.006, -1.5, 1.5); lx0 = t.clientX; ly0 = t.clientY; }
      }
    }, { passive: true });
    canvas.addEventListener("touchend", function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i];
        if (t.identifier === joyId) { joyId = null; joy.x = 0; joy.y = 0; joyEl.style.display = "none"; } else if (t.identifier === lookId) lookId = null;
      }
    }, { passive: true });
  }
  function addBtn(id, label, fn) { var b = document.createElement("button"); b.id = id; b.className = "tbtn"; b.textContent = label; document.body.appendChild(b); b.addEventListener("touchstart", function (e) { e.preventDefault(); fn(); }, { passive: false }); b.addEventListener("click", fn); }
  function moveNub(dx, dy) { if (!nubEl) return; var m = Math.hypot(dx, dy) || 1, cl = Math.min(m, 50); nubEl.style.left = (33 + (dx / m) * cl) + "px"; nubEl.style.top = (33 + (dy / m) * cl) + "px"; }

  // ---------- hotbar ----------
  var BASE_HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANK, B.LOG, B.SAND, B.GLASS, B.BRICK];
  var hotbar = BASE_HOTBAR.concat(unlocked), sel = 0;
  function refreshHotbar() { hotbar = BASE_HOTBAR.concat(unlocked); if (sel >= hotbar.length) sel = 0; renderHotbar(); }
  function renderHotbar() {
    var el = document.getElementById("hotbar");
    el.innerHTML = hotbar.map(function (id, i) {
      var c = faceCol(id, "side"), css = "rgb(" + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + ")";
      var cnt = inv[id] ? '<div class="cnt">' + inv[id] + "</div>" : "";
      return '<div class="slot' + (i === sel ? " sel" : "") + '" data-i="' + i + '">' + cnt + '<div class="sw" style="background:' + css + '"></div><div class="nm">' + (NAMES[id] || "") + "</div></div>";
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll(".slot"), function (s) { s.onclick = function () { sel = +s.dataset.i; renderHotbar(); }; });
    updateBowBtn();
  }

  // ---------- crafting ----------
  function itemName(id) { return NAMES[id] || ITNAME[id] || ("#" + id); }
  function matChip(id, count) {
    var sw;
    if (id < 100) { var c = faceCol(id, "side"); sw = '<span class="csw" style="background:rgb(' + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + ')"></span>'; }
    else sw = '<span class="cem">' + (ITEMOJI[id] || "❔") + "</span>";
    return '<span class="mchip">' + sw + '<span class="mct">' + itemName(id) + (count ? " ×" + count : "") + "</span></span>";
  }
  var RECIPES = [
    { name: "Planks", out: { id: B.PLANK, n: 4 }, in: [{ id: B.LOG, n: 1 }] },
    { name: "Sticks", out: { id: IT.STICK, n: 4 }, in: [{ id: B.PLANK, n: 2 }] },
    { name: "Wood Pickaxe", out: { id: IT.WPICK, n: 1 }, in: [{ id: B.PLANK, n: 3 }, { id: IT.STICK, n: 2 }] },
    { name: "Stone Pickaxe", out: { id: IT.SPICK, n: 1 }, in: [{ id: B.COBBLE, n: 3 }, { id: IT.STICK, n: 2 }] },
    { name: "Iron Pickaxe", out: { id: IT.IPICK, n: 1 }, in: [{ id: B.IRON, n: 3 }, { id: IT.STICK, n: 2 }] },
    { name: "Sword", out: { id: IT.SWORD, n: 1 }, in: [{ id: B.PLANK, n: 2 }, { id: IT.STICK, n: 1 }] },
    { name: "Furnace", out: { id: B.FURNACE, n: 1 }, in: [{ id: B.COBBLE, n: 8 }], unlock: true },
    { name: "Torch ×4", out: { id: B.TORCH, n: 4 }, in: [{ id: B.COAL, n: 1 }, { id: IT.STICK, n: 1 }], unlock: true },
    { name: "DIAMOND Pickaxe", out: { id: IT.DPICK, n: 1 }, in: [{ id: B.DIAMOND, n: 3 }, { id: IT.STICK, n: 2 }] },
    { name: "Diamond Sword", out: { id: IT.DSWORD, n: 1 }, in: [{ id: B.DIAMOND, n: 2 }, { id: IT.STICK, n: 1 }] },
    { name: "Sleeping Bag", out: { id: IT.BAG, n: 1 }, in: [{ id: IT.WOOL, n: 3 }] },
    { name: "Bounce Block ×2", out: { id: B.BOUNCE, n: 2 }, in: [{ id: IT.SLIME, n: 2 }, { id: B.PLANK, n: 2 }], unlock: true },
    { name: "Bow", out: { id: IT.BOW, n: 1 }, in: [{ id: IT.STICK, n: 3 }, { id: IT.WOOL, n: 2 }] },
    { name: "Arrows ×6", out: { id: IT.ARROW, n: 6 }, in: [{ id: IT.STICK, n: 2 }, { id: B.COBBLE, n: 2 }] },
    { name: "GOLDEN Apple", out: { id: IT.GAPPLE, n: 1 }, in: [{ id: IT.APPLE, n: 1 }, { id: B.GOLD, n: 1 }] },
    { name: "Iron Armor", out: { id: IT.AIRON, n: 1 }, in: [{ id: B.IRON, n: 5 }] },
    { name: "DIAMOND Armor", out: { id: IT.ADIA, n: 1 }, in: [{ id: B.DIAMOND, n: 5 }] }
  ];
  function canCraft(r) { return r.in.every(function (ing) { return hasInv(ing.id, ing.n); }); }
  function craft(r) {
    if (!canCraft(r)) return;
    r.in.forEach(function (ing) { takeInv(ing.id, ing.n); });
    addInv(r.out.id, r.out.n);
    if (r.unlock && unlocked.indexOf(r.out.id) < 0) { unlocked.push(r.out.id); refreshHotbar(); }
    sfx(440, 0.07, "triangle", 0.05);
    if ((r.out.id === IT.WPICK || r.out.id === IT.SPICK || r.out.id === IT.IPICK) && !save.firstPick) { save.firstPick = true; toast("🏆 Crafted your first pickaxe! Now you can mine ore."); }
    stats.crafted = (stats.crafted || 0) + 1;
    checkAch();
    persist(); openCraft();
  }
  function openCraft() {
    if (dead) return;
    paused = true; if (document.pointerLockElement) document.exitPointerLock();
    var mats = Object.keys(inv).filter(function (k) { return inv[k] > 0; });
    var matRows = mats.length ? mats.map(function (k) { return matChip(+k, inv[k]); }).join("") : '<span class="muted">Mine blocks to collect materials!</span>';
    var recRows = RECIPES.map(function (r, i) {
      var ok = canCraft(r);
      return '<button class="crecipe' + (ok ? "" : " dis") + '" data-i="' + i + '"' + (ok ? "" : " disabled") + '>' + matChip(r.out.id, r.out.n) + '<span class="needs">needs ' + r.in.map(function (ing) { return ing.n + "× " + itemName(ing.id); }).join(", ") + "</span></button>";
    }).join("");
    COVB.innerHTML = '<div class="gatehead">🛠️ Crafting <span class="x" id="cx2">✕</span></div><div class="card"><div class="mats"><b>Materials:</b> ' + matRows + '</div><hr><div class="recipes">' + recRows + '</div><div class="help">Punch trees for wood, mine stone with a pickaxe, and crack Word Crystals for iron!</div></div>';
    COV.style.display = "flex";
    document.getElementById("cx2").onclick = closeCraft;
    Array.prototype.forEach.call(COVB.querySelectorAll(".crecipe"), function (b) { if (!b.disabled) b.onclick = function () { craft(RECIPES[+b.dataset.i]); }; });
    wordKey = function (e) { if (e.key === "Escape" || (e.key || "").toLowerCase() === "e") closeCraft(); };
  }
  function closeCraft() { COV.style.display = "none"; paused = false; wordKey = null; keys = {}; jumpReq = false; joy.x = 0; joy.y = 0; renderHotbar(); }

  // ---------- survival & creatures ----------
  var MAXHP = 10, MAXHUNGER = 10, mobs = [], spawnT = 2, hungerT = 0, hpT = 0, dead = false;
  var mobHemi = new THREE.HemisphereLight(0xffffff, 0x557744, 1.15); scene.add(mobHemi); // lights only affect the (Lambert) mobs; the world is unlit/baked
  var sun2 = new THREE.DirectionalLight(0xffffff, 0.45); sun2.position.set(12, 22, 6); scene.add(sun2);
  var survEl = document.createElement("div"); survEl.id = "surv"; document.body.appendChild(survEl);
  function isNight() { return tod < 0.24 || tod > 0.76; }
  function groundY(x, z, fromY) { var fx = Math.floor(x), fz = Math.floor(z); for (var y = Math.min(WH - 1, Math.floor(fromY)); y >= 0; y--) if (solid(getBlock(fx, y, fz))) return y + 1; return 1; }
  function isHostile(t) { return t === "zombie" || t === "bones" || t === "boomy"; }
  function makeMob(type, x, y, z) {
    var g = new THREE.Group();
    var col = { pig: 0xe79aa6, cow: 0x6e4a34, sheep: 0xeae6dc, zombie: 0x5a8f4a, slime: 0x59c94f, boomy: 0x3fae4a, bones: 0xd8dde2, wolf: 0x9aa3ad, dog: 0xb98a5a }[type] || 0xcccccc;
    var M = new THREE.MeshLambertMaterial({ color: col });
    function bx(w, h, d, px, py, pz, mat) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || M); m.position.set(px, py, pz); g.add(m); return m; }
    if (type === "zombie" || type === "bones") {
      bx(0.6, 1.0, 0.35, 0, 1.05, 0); bx(0.5, 0.5, 0.5, 0, 1.8, 0);
      bx(0.18, 0.8, 0.18, -0.39, 1.05, 0.22); bx(0.18, 0.8, 0.18, 0.39, 1.05, 0.22);
      bx(0.2, 0.85, 0.2, -0.17, 0.42, 0); bx(0.2, 0.85, 0.2, 0.17, 0.42, 0);
      if (type === "bones") bx(0.5, 0.1, 0.06, 0, 1.2, 0.45, new THREE.MeshLambertMaterial({ color: 0x8a6a4a })); // its little bow
    }
    else if (type === "slime") {
      var jelly = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.85), new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: 0.85 }));
      jelly.position.y = 0.36; g.add(jelly); g._jelly = jelly;
      var eye = new THREE.MeshLambertMaterial({ color: 0x20303a });
      var e1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), eye); e1.position.set(-0.18, 0.46, 0.44); g.add(e1);
      var e2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), eye); e2.position.set(0.18, 0.46, 0.44); g.add(e2);
    }
    else if (type === "boomy") { // the huggable menace
      bx(0.55, 0.85, 0.5, 0, 1.15, 0); bx(0.5, 0.5, 0.5, 0, 1.85, 0);
      [[-0.16, 0.32], [0.16, 0.32], [-0.16, -0.32], [0.16, -0.32]].forEach(function (p) { bx(0.2, 0.45, 0.2, p[0], 0.5, p[1]); });
      var fm = new THREE.MeshLambertMaterial({ color: 0x123018 });
      bx(0.12, 0.15, 0.05, -0.13, 1.92, 0.26, fm); bx(0.12, 0.15, 0.05, 0.13, 1.92, 0.26, fm); bx(0.1, 0.2, 0.05, 0, 1.72, 0.26, fm);
    }
    else if (type === "wolf" || type === "dog") {
      bx(0.5, 0.45, 0.95, 0, 0.55, 0); bx(0.4, 0.4, 0.42, 0, 0.75, 0.6);
      bx(0.13, 0.13, 0.1, -0.13, 1.0, 0.62); bx(0.13, 0.13, 0.1, 0.13, 1.0, 0.62); // ears
      bx(0.16, 0.14, 0.3, 0, 0.68, 0.86); // snout
      [[-0.16, 0.3], [0.16, 0.3], [-0.16, -0.3], [0.16, -0.3]].forEach(function (p) { bx(0.14, 0.4, 0.14, p[0], 0.18, p[1]); });
      g._tail = bx(0.1, 0.1, 0.35, 0, 0.65, -0.6);
      if (type === "dog") bx(0.46, 0.1, 0.1, 0, 0.83, 0.6, new THREE.MeshLambertMaterial({ color: 0xd23f3f })); // red collar!
    }
    else { bx(0.75, 0.6, 1.05, 0, 0.6, 0); bx(0.5, 0.5, 0.5, 0, 0.78, 0.62); [[-0.27, 0.38], [0.27, 0.38], [-0.27, -0.38], [0.27, -0.38]].forEach(function (p) { bx(0.18, 0.42, 0.18, p[0], 0.21, p[1]); }); if (type === "pig") bx(0.2, 0.16, 0.1, 0, 0.74, 0.9); }
    g.position.set(x, y, z); scene.add(g);
    var hp = type === "zombie" ? 6 : type === "bones" ? 5 : type === "boomy" ? 4 : type === "slime" ? 3 : type === "dog" ? 12 : 4;
    return { type: type, pos: new THREE.Vector3(x, y, z), vel: 0, dir: Math.random() * 6.28, hp: hp, group: g, wander: 0, moving: true, atkCd: 0, hopT: Math.random() * 2, fuse: -1, shootCd: 2, fleeT: 0 };
  }
  function tryMove(m, dx, dz) { var nx = m.pos.x + dx, nz = m.pos.z + dz, gy = groundY(nx, nz, m.pos.y + 1); if (gy - m.pos.y > 1.3) return; m.pos.x = nx; m.pos.z = nz; }
  function updateMob(m, dt) {
    m.vel -= 20 * dt; var ny = m.pos.y + m.vel * dt, gy = groundY(m.pos.x, m.pos.z, m.pos.y + 1);
    if (ny <= gy) { ny = gy; m.vel = 0; } m.pos.y = ny;
    if (m.type === "zombie") {
      var dx = player.pos.x - m.pos.x, dz = player.pos.z - m.pos.z, d = Math.hypot(dx, dz) || 1;
      m.dir = Math.atan2(dx, dz); tryMove(m, (dx / d) * 1.6 * dt, (dz / d) * 1.6 * dt);
      m.atkCd -= dt; if (d < 1.2 && m.atkCd <= 0) { hurtPlayer(1); m.atkCd = 1.1; }
    } else if (m.type === "boomy") {
      var bdx = player.pos.x - m.pos.x, bdz = player.pos.z - m.pos.z, bd = Math.hypot(bdx, bdz) || 1;
      m.dir = Math.atan2(bdx, bdz);
      if (m.fuse >= 0) { // hissing!
        m.fuse -= dt;
        var fl = (Math.sin(m.fuse * 22) > 0) ? 1.12 : 0.95; m.group.scale.set(fl, 2 - fl, fl);
        if (bd > 3.6) { m.fuse = -1; m.group.scale.set(1, 1, 1); } // you escaped — it calms down
        else if (m.fuse <= 0) { boomyExplode(m); return; }
      } else {
        if (bd < 7) tryMove(m, (bdx / bd) * 1.9 * dt, (bdz / bd) * 1.9 * dt);
        else { m.wander -= dt; if (m.wander <= 0) { m.dir = Math.random() * 6.28; m.wander = 2 + Math.random() * 2; } tryMove(m, Math.sin(m.dir) * 0.8 * dt, Math.cos(m.dir) * 0.8 * dt); }
        if (bd < 1.9) { m.fuse = 1.4; sfx(1200, 0.5, "sawtooth", 0.05); sfx(700, 0.55, "sawtooth", 0.04); } // hisssss
      }
    } else if (m.type === "bones") {
      var sdx = player.pos.x - m.pos.x, sdz = player.pos.z - m.pos.z, sd = Math.hypot(sdx, sdz) || 1;
      m.dir = Math.atan2(sdx, sdz);
      if (sd > 9) tryMove(m, (sdx / sd) * 1.4 * dt, (sdz / sd) * 1.4 * dt);
      else if (sd < 5) tryMove(m, (-sdx / sd) * 1.3 * dt, (-sdz / sd) * 1.3 * dt); // keeps its distance
      m.shootCd -= dt;
      if (m.shootCd <= 0 && sd < 14) {
        m.shootCd = 2.2 + Math.random() * 0.8;
        var from = m.pos.clone(); from.y += 1.35;
        var to = player.pos.clone(); to.y += 1.0;
        var v = to.sub(from).normalize().multiplyScalar(8);
        spawnArrow(from, v, false);
        sfx(500, 0.08, "triangle", 0.04);
      }
    } else if (m.type === "dog") {
      var pdx = player.pos.x - m.pos.x, pdz = player.pos.z - m.pos.z, pd = Math.hypot(pdx, pdz) || 1;
      // guard: charge the nearest hostile near its kid
      var target = null, td = 7;
      for (var hi = 0; hi < mobs.length; hi++) { var hm = mobs[hi]; if (!isHostile(hm.type)) continue; var hd = Math.hypot(hm.pos.x - player.pos.x, hm.pos.z - player.pos.z); if (hd < td) { td = hd; target = hm; } }
      if (target) {
        var tdx = target.pos.x - m.pos.x, tdz = target.pos.z - m.pos.z, tdd = Math.hypot(tdx, tdz) || 1;
        m.dir = Math.atan2(tdx, tdz); tryMove(m, (tdx / tdd) * 3.4 * dt, (tdz / tdd) * 3.4 * dt);
        m.atkCd -= dt;
        if (tdd < 1.1 && m.atkCd <= 0) { m.atkCd = 0.8; damageMob(target, 2, false); if (m.vel === 0) m.vel = 4; sfx(260, 0.06, "square", 0.05); }
      } else if (pd > 14) { m.pos.set(player.pos.x + 1.2, player.pos.y + 0.5, player.pos.z + 1.2); } // teleports back to you
      else if (pd > 2.6) { m.dir = Math.atan2(pdx, pdz); tryMove(m, (pdx / pd) * 3.2 * dt, (pdz / pd) * 3.2 * dt); }
      else { m.dir = player.yaw + Math.PI; }
      if (m.group._tail) m.group._tail.rotation.y = Math.sin(performance.now() / 120) * 0.6; // waggy tail
    } else if (m.type === "wolf") {
      m.fleeT -= dt;
      if (m.fleeT > 0) { tryMove(m, Math.sin(m.dir) * 3.5 * dt, Math.cos(m.dir) * 3.5 * dt); }
      else {
        m.wander -= dt; if (m.wander <= 0) { m.dir = Math.random() * 6.28; m.wander = 1.5 + Math.random() * 2.5; m.moving = Math.random() < 0.6; }
        if (m.moving) tryMove(m, Math.sin(m.dir) * 1.2 * dt, Math.cos(m.dir) * 1.2 * dt);
        var wd = Math.hypot(player.pos.x - m.pos.x, player.pos.z - m.pos.z);
        if (wd < 6 && !save.dog && !hintedWolf) { hintedWolf = true; toast("🐺 A wolf! Get close, aim at it, and tap ▦ with 🍖 food to make a friend!"); }
      }
    } else if (m.type === "slime") {
      // slimes bounce around; they only travel while airborne
      m.hopT -= dt;
      if (m.vel === 0 && m.hopT <= 0) { m.vel = 5.4; m.dir = Math.random() * 6.28; m.hopT = 1.2 + Math.random() * 1.6; sfxQuiet(); }
      if (m.vel !== 0) tryMove(m, Math.sin(m.dir) * 2.2 * dt, Math.cos(m.dir) * 2.2 * dt);
      if (m.group._jelly) { var sq = m.vel === 0 ? 1 - Math.max(0, m.hopT - 0.9) * 0.12 : 1.08; m.group._jelly.scale.set(2 - sq, sq, 2 - sq); }
    } else {
      m.wander -= dt; if (m.wander <= 0) { m.dir = Math.random() * 6.28; m.wander = 1.5 + Math.random() * 2.5; m.moving = Math.random() < 0.7; }
      if (m.moving) tryMove(m, Math.sin(m.dir) * 1.1 * dt, Math.cos(m.dir) * 1.1 * dt);
    }
    m.group.position.copy(m.pos); m.group.rotation.y = m.dir;
  }
  function removeMob(i) { var m = mobs[i]; scene.remove(m.group); m.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); mobs.splice(i, 1); }
  function spawnNear(type, minR, maxR) { var a = Math.random() * 6.28, r = minR + Math.random() * (maxR - minR), x = player.pos.x + Math.cos(a) * r, z = player.pos.z + Math.sin(a) * r, gy = groundY(x, z, WH - 1); if (gy <= 2) return; mobs.push(makeMob(type, x, gy, z)); }
  function spawnMobs(dt) {
    spawnT -= dt;
    if (dogAwayT > 0) { dogAwayT -= dt; if (dogAwayT <= 0 && save.dog) { save.dogAway = false; persist(); mobs.push(makeMob("dog", player.pos.x + 1.5, player.pos.y + 0.5, player.pos.z + 1.5)); toast("🐕 Rex is back, all healed!"); chime(); } }
    if (spawnT <= 0) {
      spawnT = 3;
      var an = 0, zo = 0, wolves = 0; mobs.forEach(function (m) { if (isHostile(m.type)) zo++; else { an++; if (m.type === "wolf") wolves++; } });
      if (!isNight() && an < 6) {
        var pick2 = Math.random();
        if (pick2 < 0.14 && wolves < 1 && !save.dog) spawnNear("wolf", 9, 20);
        else spawnNear(["pig", "cow", "sheep", "slime"][Math.floor(Math.random() * 4)], 8, 22);
      }
      if (isNight() && zo < 4) {
        var r2 = Math.random();
        spawnNear(r2 < 0.55 ? "zombie" : r2 < 0.82 ? "bones" : "boomy", 9, 17);
      }
      checkDungeon();
    }
    // day-leftover hostiles fade out only when THEY are on the surface and you're not close
    // (dungeon guards live deep, so they stay; never vanish something the player is fighting)
    for (var i = mobs.length - 1; i >= 0; i--) { var m = mobs[i], dd = Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z); if (m.type === "dog") continue; if (dd > 50 || (isHostile(m.type) && !isNight() && m.pos.y > 12 && dd > 12)) removeMob(i); }
  }
  // 🏚️ walking into a dungeon room announces it (once) and wakes its guards
  function checkDungeon() {
    var pcx = Math.floor(player.pos.x / CHUNK), pcz = Math.floor(player.pos.z / CHUNK);
    if (hash(pcx, 999, pcz) <= 0.93) return;
    var cxw = pcx * CHUNK + 7.5, czw = pcz * CHUNK + 7.5;
    if (Math.abs(player.pos.x - cxw) > 5 || Math.abs(player.pos.z - czw) > 5 || Math.abs(player.pos.y - 5) > 4) return;
    save.dgSeen = save.dgSeen || {};
    var k = pcx + "," + pcz;
    if (save.dgSeen[k]) return;
    save.dgSeen[k] = 1; persist();
    stats.dungeons = (stats.dungeons || 0) + 1;
    toast("🏚️ You found a DUNGEON! Grab the treasure — but watch out…");
    sfx(160, 0.3, "sawtooth", 0.06);
    mobs.push(makeMob("zombie", cxw - 2, 4, czw - 2));
    mobs.push(makeMob("zombie", cxw + 2, 4, czw + 2));
    checkAch();
  }
  function attackTarget() {
    var d = fwd(), best = null, bd = 4;
    for (var i = 0; i < mobs.length; i++) { var m = mobs[i], ex = m.pos.x - camera.position.x, ey = (m.pos.y + 0.8) - camera.position.y, ez = m.pos.z - camera.position.z, dist = Math.hypot(ex, ey, ez); if (dist > 3.6) continue; var dot = (ex * d.x + ey * d.y + ez * d.z) / (dist || 1); if (dot > 0.82 && dist < bd) { bd = dist; best = i; } }
    return best;
  }
  function hitMob(i) {
    var m = mobs[i];
    if (m.type === "dog") { toast("🐕 Rex looks at you funny. (That's your dog!)"); return; }
    if (m.type === "wolf") { m.fleeT = 2; m.dir = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z); }
    damageMob(m, (inv[IT.DSWORD] ? 7 : inv[IT.SWORD] ? 4 : 2), false);
  }
  function damageMob(m, dmg, viaBow) {
    m.hp -= dmg;
    // knockback pop
    var kx = m.pos.x - player.pos.x, kz = m.pos.z - player.pos.z, kd = Math.hypot(kx, kz) || 1;
    tryMove(m, (kx / kd) * 0.45, (kz / kd) * 0.45); if (m.vel === 0) m.vel = 3.4;
    puff(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.5), Math.floor(m.pos.z), B.BRICK);
    if (m.hp > 0) return;
    if (m.type === "zombie" || m.type === "bones" || m.type === "boomy") {
      store.state.gems += (m.type === "zombie" ? 3 : 5); store.save(); updateHud();
      stats.zkills = (stats.zkills || 0) + 1; sess.kills++;
      bumpJob("zombies", 1);
      if (m.type === "bones") { addInv(IT.ARROW, 2 + Math.floor(Math.random() * 2)); toast("💀 Bones dropped arrows!"); }
      if (m.type === "boomy") { stats.boomKills = (stats.boomKills || 0) + 1; if (Math.random() < 0.3) addInv(IT.APPLE, 1); }
      if (viaBow) { stats.bowKills = (stats.bowKills || 0) + 1; bumpJob("bow", 1); }
    } else if (m.type === "slime") {
      addInv(IT.SLIME, 1 + Math.floor(Math.random() * 2));
      toast("🟢 Slimeball! Craft Bounce Blocks with it!");
    } else if (m.type === "sheep") {
      addInv(IT.WOOL, 2); addInv(IT.FOOD, 1);
      toast("🧶 Wool! 3 wool = a Sleeping Bag.");
    } else if (m.type === "dog") {
      // your buddy never dies — he runs home to heal and comes back
      dogAwayT = 45; save.dogAway = true; persist();
      toast("🐕 Rex ran home to heal — he'll be back soon!");
    } else if (m.type === "wolf") {
      // wolves just run away for good (kid-safe: no wolf harming)
    } else {
      addInv(IT.FOOD, 1 + Math.floor(Math.random() * 2));
    }
    renderHotbar();
    var mi2 = mobs.indexOf(m); if (mi2 >= 0) removeMob(mi2);
    checkAch();
  }
  function boomyExplode(m) {
    var bx2 = Math.floor(m.pos.x), by2 = Math.floor(m.pos.y + 1), bz2 = Math.floor(m.pos.z);
    for (var dx = -2; dx <= 2; dx++) for (var dy = -2; dy <= 2; dy++) for (var dz = -2; dz <= 2; dz++) {
      if (dx * dx + dy * dy + dz * dz > 4.2) continue;
      var bid = getBlock(bx2 + dx, by2 + dy, bz2 + dz);
      if (bid !== B.AIR && bid !== B.WATER && bid !== B.LAVA && bid !== B.WORD && bid !== B.CHEST) setBlock(bx2 + dx, by2 + dy, bz2 + dz, B.AIR);
    }
    puff(bx2, by2, bz2, B.TNT); puff(bx2 + 1, by2, bz2, B.TNT); puff(bx2, by2 + 1, bz2, B.TNT); puff(bx2 - 1, by2, bz2, B.LEAVES);
    sfx(80, 0.45, "sawtooth", 0.1); sfx(55, 0.55, "square", 0.08);
    // knock the player back (and hurt a little — armor helps)
    var px2 = player.pos.x - m.pos.x, pz2 = player.pos.z - m.pos.z, pd2 = Math.hypot(px2, pz2) || 1;
    if (pd2 < 5) {
      hurtPlayer(2);
      player.vel.y = 6.5; player.pos.x += (px2 / pd2) * 1.2; player.pos.z += (pz2 / pd2) * 1.2; player._fellFrom = null;
    }
    var mi3 = mobs.indexOf(m); if (mi3 >= 0) removeMob(mi3);
  }
  // 🐺 → 🐕 feed a wolf to tame it
  var hintedWolf = false, dogAwayT = (save.dogAway ? 45 : 0);
  function feedWolf(i) {
    var m = mobs[i];
    if (save.dog) { toast("🐕 You already have Rex — he's the best dog!"); return; }
    if (!takeInv(IT.FOOD, 1)) { toast("You need 🍖 food to make friends! (hunt a pig or cow)"); return; }
    puff(Math.floor(m.pos.x), Math.floor(m.pos.y + 1), Math.floor(m.pos.z), B.BRICK); // hearts-ish
    sfx(520, 0.1, "sine", 0.05); sfx(660, 0.12, "sine", 0.05);
    renderHotbar();
    if (Math.random() < 0.6) {
      var wp = m.pos.clone();
      var wi = mobs.indexOf(m); if (wi >= 0) removeMob(wi);
      mobs.push(makeMob("dog", wp.x, wp.y, wp.z));
      save.dog = true; persist();
      toast("🎉🐕 The wolf is now your dog REX! He follows you and fights monsters!");
      chime(); cfetti(); checkAch();
    } else {
      toast("🐺 Nom nom… it wants MORE food. One more try!");
    }
  }
  // ---------- arrows (yours and the skeletons') ----------
  var projs = [];
  function spawnArrow(from, vel, mine2) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.55), new THREE.MeshBasicMaterial({ color: mine2 ? 0x7a4a1e : 0xcfd6dd }));
    mesh.position.copy(from); scene.add(mesh);
    projs.push({ mesh: mesh, pos: from.clone(), vel: vel.clone(), mine: mine2, life: 2.6 });
  }
  function shoot() {
    if (paused || dead) return;
    if (!hasInv(IT.BOW, 1)) { toast("🏹 Craft a Bow first (3 sticks + 2 wool)!"); return; }
    if (!takeInv(IT.ARROW, 1)) { toast("Out of arrows! Craft more (2 sticks + 2 cobble = 6)."); return; }
    var d = fwd();
    var from = new THREE.Vector3(camera.position.x + d.x * 0.4, camera.position.y + d.y * 0.4 - 0.12, camera.position.z + d.z * 0.4);
    spawnArrow(from, new THREE.Vector3(d.x * 20, d.y * 20 + 0.8, d.z * 20), true);
    sfx(700, 0.09, "triangle", 0.06); sfx(320, 0.06, "square", 0.03);
    renderHotbar(); updateBowBtn();
  }
  function updateProjectiles(dt) {
    for (var i = projs.length - 1; i >= 0; i--) {
      var p = projs[i];
      p.life -= dt; p.vel.y -= 7 * dt;
      // swept movement: arrows are fast, so walk this frame's travel in ≤0.4-block
      // sub-steps or they tunnel straight through mobs and thin walls on slow frames
      var mvx = p.vel.x * dt, mvy = p.vel.y * dt, mvz = p.vel.z * dt;
      var steps = Math.max(1, Math.ceil(Math.hypot(mvx, mvy, mvz) / 0.4));
      var gone = p.life <= 0;
      for (var st = 0; st < steps && !gone; st++) {
        p.pos.x += mvx / steps; p.pos.y += mvy / steps; p.pos.z += mvz / steps;
        if (solid(getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)))) { gone = true; break; }
        if (p.mine) {
          for (var mi4 = 0; mi4 < mobs.length; mi4++) {
            var mm = mobs[mi4]; if (mm.type === "dog") continue;
            // capsule: clamp arrow height into the mob's body span, then radial test
            var cy = Math.max(mm.pos.y + 0.15, Math.min(mm.pos.y + 1.75, p.pos.y));
            var hd2 = Math.hypot(mm.pos.x - p.pos.x, cy - p.pos.y, mm.pos.z - p.pos.z);
            if (window._bd && hd2 < window._bd.v) window._bd.v = hd2;
            if (hd2 < 0.8) { damageMob(mm, 4, true); gone = true; break; }
          }
        } else {
          var py = Math.max(player.pos.y + 0.2, Math.min(player.pos.y + 1.7, p.pos.y));
          if (Math.hypot(player.pos.x - p.pos.x, py - p.pos.y, player.pos.z - p.pos.z) < 0.8) { hurtPlayer(1); gone = true; }
        }
      }
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = Math.atan2(p.vel.x, p.vel.z);
      p.mesh.rotation.x = -Math.atan2(p.vel.y, Math.hypot(p.vel.x, p.vel.z));
      if (gone) { scene.remove(p.mesh); p.mesh.geometry.dispose(); projs.splice(i, 1); }
    }
  }
  function updateBowBtn() { var b = document.getElementById("bBow"); if (b) b.style.display = hasInv(IT.BOW, 1) ? "flex" : "none"; }
  function hurtPlayer(n) {
    if (dead) return;
    if (inv[IT.ADIA]) n = Math.max(1, Math.round(n * 0.5)); // diamond armor halves damage
    else if (inv[IT.AIRON]) n = Math.max(1, Math.round(n * 0.7));
    player.health = Math.max(0, player.health - n); survFlash(); sfx(110, 0.18, "sawtooth", 0.07); updateSurvHud(); if (player.health <= 0) die();
  }
  function eat() {
    if (dead) return;
    // emergency: a golden apple when hurt = FULL heal + full tummy + speed boost
    if (player.health <= 6 && hasInv(IT.GAPPLE, 1)) {
      takeInv(IT.GAPPLE, 1);
      player.health = MAXHP; player.hunger = MAXHUNGER; speedT = 8;
      stats.gapples = (stats.gapples || 0) + 1;
      toast("🍏 GOLDEN APPLE! Fully healed + speed boost!"); chime(); cfetti();
      updateSurvHud(); renderHotbar(); checkAch(); return;
    }
    if (player.hunger >= MAXHUNGER) return;
    if (takeInv(IT.FOOD, 1)) { player.hunger = Math.min(MAXHUNGER, player.hunger + 3); sfx(220, 0.08, "triangle", 0.05); }
    else if (takeInv(IT.APPLE, 1)) { player.hunger = Math.min(MAXHUNGER, player.hunger + 2); sfx(300, 0.07, "triangle", 0.05); }
    else { toast("No food! Hunt animals 🍖 or punch leaves for apples 🍎"); return; }
    updateSurvHud(); renderHotbar();
  }
  function updateSurvival(dt) {
    if (dead) return;
    hungerT += dt; if (hungerT > 7) { hungerT = 0; player.hunger = Math.max(0, player.hunger - 1); updateSurvHud(); }
    hpT += dt; if (hpT > 3) { hpT = 0; if (player.hunger >= 8 && player.health < MAXHP) { player.health++; updateSurvHud(); } else if (player.hunger <= 0 && player.health > 0) { player.health--; updateSurvHud(); if (player.health <= 0) die(); } }
  }
  function survFlash() { survEl.classList.add("hurt"); setTimeout(function () { survEl.classList.remove("hurt"); }, 220); }
  function updateSurvHud() {
    var f = (inv[IT.FOOD] || 0) + (inv[IT.APPLE] || 0);
    var armor = inv[IT.ADIA] ? " 🛡💠" : inv[IT.AIRON] ? " 🛡" : "";
    var depth = player.pos.y < 13 ? ' · <span style="color:#8fd2ff">⛏ y=' + Math.floor(player.pos.y) + "</span>" : "";
    survEl.innerHTML = "❤️ " + player.health + "/" + MAXHP + armor + " &nbsp; 🍖 " + player.hunger + "/" + MAXHUNGER +
      (f ? ' &nbsp; <span class="eatable">🍗×' + f + " (F)</span>" : "") +
      ' &nbsp; <span style="color:#ffe14d">☀️ Day ' + (save.day || 1) + "</span>" + depth;
  }
  function die() { dead = true; mineHeld = false; paused = true; if (document.pointerLockElement) document.exitPointerLock(); COVB.innerHTML = '<div class="card hero" style="text-align:center"><div class="big-emoji">💫</div><div class="hero-line">You fainted on Day ' + (save.day || 1) + '!</div><div class="hero-sub">No worries — you keep everything you collected' + (save.dog ? " and Rex is safe" : "") + '.</div><button id="resp" class="submit big-next">Wake up ⏎</button></div>'; COV.style.display = "flex"; document.getElementById("resp").onclick = respawn; wordKey = function (e) { if (e.key === "Enter") respawn(); }; }
  function respawn() { dead = false; player.health = MAXHP; player.hunger = Math.max(player.hunger, 5); var gy = groundY(0, 0, WH - 1); player.pos.set(0.5, gy + 1, 0.5); player.vel.set(0, 0, 0); player._fellFrom = null; COV.style.display = "none"; paused = false; wordKey = null; keys = {}; updateSurvHud(); }

  // ---------- VOCRAFT progression: stats, achievements, daily jobs, shop, sleep ----------
  var P = window.VobloxProfile;
  var stats = (save.stats = save.stats || {});
  var ach = (save.ach = save.ach || {});
  var sess = { mined: 0, placed: 0, crystals: 0, kills: 0, start: Date.now(), ended: false };
  function sfxQuiet() { sfx(300 + Math.random() * 120, 0.05, "sine", 0.02); }

  var ACH = [
    { id: "log1", name: "First Timber", emoji: "🪵", pay: 10, cond: function () { return (stats.logs || 0) >= 1; } },
    { id: "craft1", name: "Handy", emoji: "🛠️", pay: 10, cond: function () { return (stats.crafted || 0) >= 1; } },
    { id: "wpick", name: "Wood Age", emoji: "⛏️", pay: 10, cond: function () { return pickTier() >= 1; } },
    { id: "spick", name: "Stone Age", emoji: "⛏️", pay: 15, cond: function () { return pickTier() >= 2; } },
    { id: "ipick", name: "Iron Age", emoji: "⛏️", pay: 25, cond: function () { return pickTier() >= 3; } },
    { id: "dpick", name: "DIAMOND AGE!", emoji: "💠", pay: 60, cond: function () { return pickTier() >= 4; } },
    { id: "mine100", name: "Mole Mode", emoji: "🕳️", pay: 25, cond: function () { return (stats.mined || 0) >= 100; } },
    { id: "build50", name: "Master Builder", emoji: "🏗️", pay: 25, cond: function () { return (stats.placed || 0) >= 50; } },
    { id: "crystal1", name: "Word Cracker", emoji: "✨", pay: 20, cond: function () { return (stats.crystals || 0) >= 1; } },
    { id: "crystal10", name: "Word Wizard", emoji: "🧙", pay: 60, cond: function () { return (stats.crystals || 0) >= 10; } },
    { id: "deep", name: "Deep Digger", emoji: "⬇️", pay: 20, cond: function () { return stats.deepest !== undefined && stats.deepest <= 6; } },
    { id: "diamond1", name: "Shiny!!", emoji: "💎", pay: 50, cond: function () { return (stats.diamonds || 0) >= 1; } },
    { id: "zomb5", name: "Night Guard", emoji: "🧟", pay: 25, cond: function () { return (stats.zkills || 0) >= 5; } },
    { id: "chest3", name: "Treasure Hunter", emoji: "🎁", pay: 30, cond: function () { return (stats.chests || 0) >= 3; } },
    { id: "sleep1", name: "Cozy Camper", emoji: "🛏️", pay: 15, cond: function () { return (stats.slept || 0) >= 1; } },
    { id: "bow1", name: "Marksman", emoji: "🏹", pay: 20, cond: function () { return (stats.bowKills || 0) >= 1; } },
    { id: "boom1", name: "Boomy Buster", emoji: "🧨", pay: 25, cond: function () { return (stats.boomKills || 0) >= 1; } },
    { id: "dog", name: "Best Friend", emoji: "🐕", pay: 30, cond: function () { return !!save.dog; } },
    { id: "armor", name: "Armored Up", emoji: "🛡️", pay: 25, cond: function () { return !!(inv[IT.AIRON] || inv[IT.ADIA]); } },
    { id: "dungeon1", name: "Dungeon Raider", emoji: "🏚️", pay: 30, cond: function () { return (stats.dungeons || 0) >= 1; } },
    { id: "gapple", name: "Golden Snack", emoji: "🍏", pay: 20, cond: function () { return (stats.gapples || 0) >= 1; } },
    { id: "day7", name: "Week Survivor", emoji: "📅", pay: 40, cond: function () { return (save.day || 1) >= 7; } }
  ];
  function checkAch() {
    for (var i = 0; i < ACH.length; i++) {
      var a = ACH[i];
      if (ach[a.id] || !a.cond()) continue;
      ach[a.id] = true;
      store.state.gems += a.pay;
      if (store.addXP) store.addXP(Math.round(a.pay * 0.6));
      else store.save();
      toast("🏆 " + a.emoji + " " + a.name + "! +" + a.pay + " Vobux");
      chime(); cfetti(); updateHud(); persist();
    }
  }

  // 3 daily jobs, seeded by the date (fresh every morning)
  var JOBT = [
    { kind: "mine", text: "Mine {n} blocks", ns: [30, 50, 80], pay: 25 },
    { kind: "logs", text: "Chop {n} logs", ns: [6, 10], pay: 25 },
    { kind: "crystals", text: "Crack {n} Word Crystals", ns: [2, 3], pay: 40 },
    { kind: "zombies", text: "Defeat {n} zombies", ns: [2, 3], pay: 30 },
    { kind: "place", text: "Build with {n} blocks", ns: [20, 35], pay: 25 },
    { kind: "chests", text: "Open {n} treasure chest", ns: [1], pay: 35 },
    { kind: "bow", text: "Shoot {n} monsters with your bow", ns: [2, 3], pay: 30 }
  ];
  function ensureJobs() {
    var dk = P ? P.dayKey() : "x";
    if (save.jobs && save.jobs.day === dk) return save.jobs;
    var rand = P ? P.rng(P.hashStr("vocraft:" + dk)) : Math.random;
    var picks = JOBT.slice().sort(function () { return rand() - 0.5; }).slice(0, 3);
    save.jobs = { day: dk, list: picks.map(function (t) { var n = t.ns[Math.floor(rand() * t.ns.length)]; return { kind: t.kind, text: t.text.replace("{n}", n), goal: n, n: 0, pay: t.pay, claimed: false }; }) };
    persist();
    return save.jobs;
  }
  function bumpJob(kind, amt) {
    var jobs = ensureJobs();
    jobs.list.forEach(function (j) { if (j.kind === kind && !j.claimed) j.n = Math.min(j.goal, j.n + (amt || 1)); });
  }
  function claimJob(i) {
    var j = ensureJobs().list[i];
    if (!j || j.claimed || j.n < j.goal) return;
    j.claimed = true;
    store.state.gems += j.pay;
    if (store.addXP) store.addXP(12); else store.save();
    toast("✅ Job done! +" + j.pay + " Vobux");
    chime(); updateHud(); persist(); openBook();
  }

  // the Vobux block shop — special blocks bought with words-earned Vobux
  var SHOP = [
    { id: B.CANDY, name: "Candy Block", price: 200 },
    { id: B.ICE, name: "Ice Block", price: 200 },
    { id: B.GLOW, name: "Glow Block", price: 800 },
    { id: B.TNT, name: "TNT (gentle!)", price: 1500 },
    { id: B.RAINBOW, name: "Rainbow Block", price: 2500 }
  ];
  function buyBlock(i) {
    var s2 = SHOP[i];
    if (unlocked.indexOf(s2.id) >= 0) { toast("Already unlocked — it's in your hotbar!"); return; }
    if (store.state.gems < s2.price) { toast("Not enough Vobux — crack Word Crystals to earn more!"); return; }
    store.state.gems -= s2.price; store.save();
    unlocked.push(s2.id);
    if (!stats.shopped) stats.shopped = 1;
    refreshHotbar(); updateHud(); persist();
    toast("🛍️ " + s2.name + " unlocked — build with it forever!");
    chime(); openBook();
  }

  // 📖 the Vocraft Book: jobs, trophies, shop, miner rank
  function openBook() {
    if (dead) return;
    paused = true; if (document.pointerLockElement) document.exitPointerLock();
    var jobs = ensureJobs();
    var rank = P && store.game ? P.gameRank(store.game("craft").rankPts) : null;
    var jobRows = jobs.list.map(function (j, i) {
      var pct = Math.round(100 * j.n / j.goal);
      return '<div style="display:flex;align-items:center;gap:8px;background:#f4f8fc;border-radius:10px;padding:7px 10px;margin:5px 0">' +
        '<div style="flex:1;min-width:0"><b style="font-size:14px">' + j.text + '</b>' +
        '<div style="height:7px;background:#dde7f0;border-radius:4px;overflow:hidden;margin-top:3px"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#76d275,#43c34a)"></div></div></div>' +
        (j.claimed ? '<span style="color:#2f9e44;font-weight:900">✓</span>'
          : j.n >= j.goal ? '<button class="submit" style="padding:5px 12px" data-job="' + i + '">CLAIM +' + j.pay + '</button>'
          : '<span style="color:#5a6b7a;font-weight:900;font-size:13px">' + j.n + "/" + j.goal + "</span>") + "</div>";
    }).join("");
    var achRows = ACH.map(function (a) {
      var got = !!ach[a.id];
      return '<span style="display:inline-block;margin:3px;padding:5px 9px;border-radius:10px;font-size:12px;font-weight:900;' +
        (got ? "background:#dff5e1;color:#1c7a2e;border:2px solid #7fce8a" : "background:#eef2f7;color:#8a98a8;border:2px solid #dbe5ee") + '">' +
        a.emoji + " " + a.name + (got ? " ✓" : " · " + a.pay + "V") + "</span>";
    }).join("");
    var shopRows = SHOP.map(function (s2, i) {
      var c = faceCol(s2.id, "side");
      var owned = unlocked.indexOf(s2.id) >= 0;
      return '<div style="display:flex;align-items:center;gap:8px;background:#fff;border:2px solid #dbe5ee;border-radius:10px;padding:6px 10px;margin:5px 0">' +
        '<span style="width:22px;height:22px;border-radius:5px;display:inline-block;background:rgb(' + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + ')"></span>' +
        '<b style="flex:1;font-size:14px">' + s2.name + "</b>" +
        (owned ? '<span style="color:#2f9e44;font-weight:900">✓ unlocked</span>'
          : '<button class="submit" style="padding:5px 12px" data-shop="' + i + '">' + s2.price + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"></button>') + "</div>";
    }).join("");
    COVB.innerHTML = '<div class="gatehead">📖 Vocraft Book <span class="x" id="bk_x">✕</span></div>' +
      '<div class="card" style="max-height:76vh;overflow:auto">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + (rank ? rank.icon + " " + rank.name + " Miner" : "") + '</b>' +
      (isNight() && hasInv(IT.BAG, 1) ? '<button class="submit" style="padding:5px 12px" id="bk_sleep">🛏️ Sleep (Z)</button>' : "") +
      '<span><img class="vbx" src="icons/vobux.png" alt="V"> ' + store.state.gems + "</span></div>" +
      '<h3 style="margin:10px 0 2px">📋 Daily Jobs</h3>' + jobRows +
      '<h3 style="margin:12px 0 2px">🏆 Trophies</h3><div>' + achRows + "</div>" +
      '<h3 style="margin:12px 0 2px">🛍️ Block Shop</h3>' + shopRows +
      '<div class="help">Earn Vobux by cracking ✨ Word Crystals, finishing jobs, and winning trophies!</div></div>';
    COV.style.display = "flex";
    document.getElementById("bk_x").onclick = closeBook;
    var bs = document.getElementById("bk_sleep"); if (bs) bs.onclick = function () { closeBook(); sleep(); };
    Array.prototype.forEach.call(COVB.querySelectorAll("[data-job]"), function (b) { b.onclick = function () { claimJob(+b.dataset.job); }; });
    Array.prototype.forEach.call(COVB.querySelectorAll("[data-shop]"), function (b) { b.onclick = function () { buyBlock(+b.dataset.shop); }; });
    wordKey = function (e) { if (e.key === "Escape" || (e.key || "").toLowerCase() === "q") closeBook(); };
  }
  function closeBook() { COV.style.display = "none"; paused = false; wordKey = null; keys = {}; jumpReq = false; joy.x = 0; joy.y = 0; }

  // 🛏️ sleeping bag: skip the night, wake up healed
  function sleep() {
    if (dead || paused) return;
    if (!hasInv(IT.BAG, 1)) { toast("🛏️ Craft a Sleeping Bag first (3 wool from sheep)!"); return; }
    if (!isNight()) { toast("☀️ You're not sleepy — it's daytime!"); return; }
    tod = 0.3; // morning
    player.health = MAXHP;
    stats.slept = (stats.slept || 0) + 1;
    updateSurvHud(); persist();
    toast("☀️ Good morning! Fully rested.");
    chime(); checkAch();
  }

  // session results feed the shared Miner rank + XP when Leo heads back
  function endSession() {
    if (sess.ended) return;
    var activity = sess.mined + sess.placed + sess.crystals * 5 + sess.kills * 3;
    if (activity < 3 || !store.recordGame) { sess.ended = true; return; }
    sess.ended = true;
    store.recordGame("craft", {
      win: sess.crystals > 0,
      score: sess.mined + sess.placed,
      rankPtsDelta: Math.min(12, 2 + Math.floor(sess.mined / 20) + sess.crystals * 2 + sess.kills + Math.floor(sess.placed / 25)),
      xp: Math.min(60, Math.round(sess.mined / 4 + sess.placed / 5 + sess.crystals * 8 + sess.kills * 3)),
      gems: 0 // Vobux were paid live (crystals, jobs, trophies, treasure)
    });
  }
  window.addEventListener("beforeunload", endSession);
  (function hookBack() {
    var back = document.querySelector('a[href="index.html"]');
    if (back) back.addEventListener("click", endSession);
  })();

  // ---------- polish: particles, sound, toasts, help ----------
  var particles = [], pfxPool = [], actx = null;
  function sfx(freq, dur, type, vol) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      var o = actx.createOscillator(), g = actx.createGain(); o.type = type || "square"; o.frequency.value = freq;
      o.connect(g); g.connect(actx.destination); var t = actx.currentTime;
      g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.09));
      o.start(t); o.stop(t + (dur || 0.1));
    } catch (e) {}
  }
  function chime() { sfx(660, 0.12, "triangle", 0.06); setTimeout(function () { sfx(990, 0.16, "triangle", 0.06); }, 110); }
  function puff(x, y, z, id) {
    var c = faceCol(id, "side");
    for (var i = 0; i < 6; i++) {
      var m = pfxPool.pop(); if (!m) m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial());
      m.material.color.setRGB(c[0] * 0.9, c[1] * 0.9, c[2] * 0.9); m.scale.set(1, 1, 1); m.visible = true;
      m.position.set(x + 0.5 + (Math.random() - 0.5) * 0.5, y + 0.5 + (Math.random() - 0.5) * 0.5, z + 0.5 + (Math.random() - 0.5) * 0.5);
      scene.add(m); particles.push({ m: m, vx: (Math.random() - 0.5) * 2, vy: 1.5 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 2, life: 0.5 });
    }
  }
  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i]; p.life -= dt; p.vy -= 7 * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      var s = Math.max(0.05, p.life * 1.8); p.m.scale.set(s, s, s);
      if (p.life <= 0) { scene.remove(p.m); p.m.visible = false; pfxPool.push(p.m); particles.splice(i, 1); }
    }
  }
  function toast(msg) { var t = document.createElement("div"); t.className = "ctoast"; t.textContent = msg; document.body.appendChild(t); requestAnimationFrame(function () { t.style.opacity = "1"; }); setTimeout(function () { t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 400); }, 2400); }
  function showHelp() {
    paused = true;
    COVB.innerHTML = '<div class="card"><h2>⛏️ Welcome to VOCRAFT!</h2><p><b>Move:</b> <b>W A S D</b> + mouse (hold <b>Shift</b> to sprint!). On a tablet, drag the <b>left side</b> to walk (push far = sprint) and the <b>right side</b> to look.</p><p><b>HOLD to mine</b> (left-click / ⛏) — better pickaxes dig faster! <b>Place</b> with right-click / ▦, <b>jump</b> Space / ⤒, <b>craft</b> E / 📦, <b>eat</b> F / 🍖, <b>shoot your bow</b> R / 🏹.</p><p><b>📖 Your Vocraft Book (Q)</b>: daily jobs, trophies, block shop. Find 💠 diamonds, 🎁 treasure, 🏚️ dungeons… and <b>tame a wolf</b> (aim + ▦ with food) to get a dog!</p><p><b>✨ Crack glowing Word Crystals</b> — answer the word for Vobux and iron!</p><button id="okh" class="submit big-next">Let’s go! ⏎</button></div>';
    COV.style.display = "flex";
    function go() { save.craftSeen = true; persist(); COV.style.display = "none"; paused = false; wordKey = null; }
    document.getElementById("okh").onclick = go; wordKey = function (e) { if (e.key === "Enter") go(); };
  }

  // ---------- HUD ----------
  function updateHud() {
    document.getElementById("cgems").innerHTML = '<img class="vbx" src="icons/vobux.png" alt="V"> ' + store.state.gems;
    var p = store.predicted(Content.getLesson(store.state.activeLesson || "5").words);
    document.getElementById("cgrade").textContent = (p >= 90 ? "A" : p >= 80 ? "B" : p + "%");
    var rc = document.getElementById("crank");
    if (rc && P && store.game) { var r = P.gameRank(store.game("craft").rankPts); rc.textContent = r.icon + " " + r.name; }
  }

  // ---------- loop ----------
  function resize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
  window.addEventListener("resize", resize);
  var DAYSKY = new THREE.Color(0x8fd2ff), NIGHTSKY = new THREE.Color(0x0a1330), tod = 0.32;
  function updateDayNight(dt) {
    var prevTod = tod;
    tod = (tod + dt / 240) % 1;
    if (tod < prevTod) { save.day = (save.day || 1) + 1; updateSurvHud(); toast("☀️ Day " + save.day + "!"); checkAch(); persist(); }
    var light = 0.5 - 0.5 * Math.cos(tod * Math.PI * 2);
    var b = 0.34 + 0.66 * light;
    solidMat.color.setRGB(b, b, b); waterMat.color.setRGB(b * 0.85, b * 0.92, b);
    if (typeof mobHemi !== "undefined" && mobHemi) { mobHemi.intensity = 0.55 + 0.7 * light; if (typeof sun2 !== "undefined" && sun2) sun2.intensity = 0.2 + 0.4 * light; }
    var sky = NIGHTSKY.clone().lerp(DAYSKY, light);
    scene.background.copy(sky); scene.fog.color.copy(sky);
  }
  var clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    updateDayNight(dt);
    updatePlayer(dt); updateCamera(); streamChunks();
    if (!paused) { updateMining(dt); updateSurvival(dt); for (var mi = 0; mi < mobs.length; mi++) updateMob(mobs[mi], dt); spawnMobs(dt); updateProjectiles(dt); }
    updateParticles(dt);
    saveTimer -= dt; if (saveTimer < 0 && saveTimer > -1) { save.px = player.pos.x; save.py = player.pos.y; save.pz = player.pos.z; save.yaw = player.yaw; save.pitch = player.pitch; save.health = player.health; save.hunger = player.hunger; persist(); saveTimer = -2; }
    renderer.render(scene, camera);
  }

  // ---------- lights (Basic material is unlit; add a faint sun via fog/clear only) ----------
  // (solid colors are pre-shaded per face, so no lights needed)

  // ---------- boot ----------
  // spawn safely on the surface near saved/origin x,z
  (function spawn() {
    streamChunks(); // generate around spawn
    var h = heightAt(Math.floor(player.pos.x), Math.floor(player.pos.z));
    if (!save.edits || Object.keys(save.edits).length === 0 || save.py < -5) { player.pos.y = h + 2; player.pitch = -0.25; }
  })();
  renderHotbar(); updateHud(); updateSurvHud();
  if (save.dog && !save.dogAway) setTimeout(function () { mobs.push(makeMob("dog", player.pos.x + 1.5, player.pos.y + 0.5, player.pos.z + 1.5)); }, 600); // Rex is waiting for you
  var v = document.getElementById("ver"); if (v) v.textContent = "build " + (window.VOBLOX_VERSION || "dev");
  document.getElementById("loading").style.display = "none";
  if (!location.hash && !save.craftSeen) showHelp();
  setInterval(updateHud, 1500);
  frame();
  if (location.hash === "#move") setTimeout(function () { // test hook: W must move toward the crosshair at ANY yaw
    var results = [];
    function trial(yaw, cb) {
      player.yaw = yaw; player.pitch = 0;
      // hover in open air so terrain can't block the trial
      player.pos.y = groundY(player.pos.x, player.pos.z, WH - 1) + 7; player.vel.set(0, 0, 0);
      var x0 = player.pos.x, z0 = player.pos.z;
      keys["w"] = true;
      setTimeout(function () {
        keys["w"] = false;
        var mx = player.pos.x - x0, mz = player.pos.z - z0;
        var d = fwd(), dot = mx * d.x + mz * d.z, mag = Math.hypot(mx, mz);
        results.push((dot > mag * 0.7 && mag > 0.5) ? "OK" : "BAD(" + yaw.toFixed(1) + ")");
        cb();
      }, 500);
    }
    trial(0, function () { trial(Math.PI / 2, function () { trial(Math.PI, function () { trial(-Math.PI / 2, function () {
      toast("MOVE TEST: " + results.join(" "));
    }); }); }); });
  }, 600);
  if (location.hash === "#word") setTimeout(function () { // test hook: word gate + wrong-answer reading gate demo
    openWordGate(0, 5, 0);
    setTimeout(function () { // deliberately answer WRONG to show the gate
      var q = window._lastQ; if (!q || q.kind !== "mc") return;
      var wrongIdx = -1; q.choices.forEach(function (c, i) { if (!c.correct && wrongIdx < 0) wrongIdx = i; });
      var b = COVB.querySelectorAll(".choice")[wrongIdx]; if (b && !b.disabled) b.click();
    }, 2000);
    setTimeout(function () { var g = COVB.querySelector("#wgate button.big-next"); if (g && !g.disabled) g.click(); }, 8000);
  }, 300);
  if (location.hash === "#craft") setTimeout(function () { inv[B.LOG] = 4; inv[B.PLANK] = 8; inv[IT.STICK] = 4; inv[B.COBBLE] = 10; inv[B.COAL] = 2; inv[B.IRON] = 3; inv[IT.WOOL] = 2; inv[IT.APPLE] = 1; inv[B.GOLD] = 1; openCraft(); setTimeout(function () { var card = COVB.querySelector(".card"); if (card) COVB.scrollTop = COVB.scrollHeight; window.scrollTo(0, 0); var rec = COVB.querySelectorAll(".crecipe"); if (rec.length) rec[rec.length - 1].scrollIntoView(false); }, 300); }, 300); // test hook for crafting screen (scrolled to the new recipes)
  if (location.hash === "#mob") setTimeout(function () { var px = player.pos.x, pz = player.pos.z; player.pos.y = groundY(px, pz, WH - 1) + 2; ["pig", "zombie", "slime", "boomy", "bones", "wolf", "dog"].forEach(function (t2, i2) { var mx = px - 4.5 + i2 * 1.5, mz = pz - 5; mobs.push(makeMob(t2, mx, groundY(mx, mz, WH - 1) + 0.5, mz)); }); mobs.forEach(function (m) { m.group.position.copy(m.pos); }); }, 400); // test hook: the whole zoo in view
  if (location.hash === "#bow") setTimeout(function () { // test hook: arrows fly and hit
    inv[IT.BOW] = 1; inv[IT.ARROW] = 10; renderHotbar();
    var px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
    // sky arena: two glass platforms, nothing in between to block arrows
    for (var gx = -1; gx <= 1; gx++) for (var gz = -1; gz <= 1; gz++) { setBlock(px + gx, 29, pz + gz, B.GLASS); setBlock(px + gx, 29, pz - 8 + gz, B.GLASS); }
    player.pos.set(px + 0.5, 30.2, pz + 0.5); player.vel.set(0, 0, 0);
    var zm = makeMob("zombie", px + 0.5, 30.2, pz - 7.5);
    mobs.push(zm);
    player.yaw = 0;
    function aimAndShoot() { // aim the crosshair at the zombie's chest, then fire
      var dx = zm.pos.x - camera.position.x, dy = (zm.pos.y + 1.0) - camera.position.y, dz = zm.pos.z - camera.position.z;
      player.yaw = Math.atan2(-dx, -dz); player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      shoot();
    }
    var minD = 99, probe = setInterval(function () {
      for (var pi = 0; pi < projs.length; pi++) {
        var pp = projs[pi];
        var dd2 = Math.hypot(zm.pos.x - pp.pos.x, (zm.pos.y + 1) - pp.pos.y, zm.pos.z - pp.pos.z);
        if (dd2 < minD) minD = dd2;
      }
    }, 30);
    setTimeout(aimAndShoot, 200); setTimeout(aimAndShoot, 800); setTimeout(aimAndShoot, 1400);
    window._bd = { v: 99 };
    setTimeout(function () { clearInterval(probe); toast("BOW: left=" + (inv[IT.ARROW] || 0) + " zhp=" + zm.hp + " tested=" + window._bd.v.toFixed(2) + " probe=" + minD.toFixed(2) + " kills=" + (stats.zkills || 0)); }, 2400);
  }, 400);
  if (location.hash === "#dungeon") setTimeout(function () { // test hook: teleport into the nearest dungeon
    var pcx = Math.floor(player.pos.x / CHUNK), pcz = Math.floor(player.pos.z / CHUNK);
    outer: for (var rr = 0; rr < 9; rr++) for (var ddx = -rr; ddx <= rr; ddx++) for (var ddz = -rr; ddz <= rr; ddz++) {
      if (hash(pcx + ddx, 999, pcz + ddz) > 0.93) { pcx += ddx; pcz += ddz; break outer; }
    }
    getChunk(pcx, pcz, true);
    player.pos.set(pcx * CHUNK + 7.5, 4.2, pcz * CHUNK + 7.5); player.vel.set(0, 0, 0); player.yaw = 2.4; player.pitch = -0.15;
  }, 500);
  if (location.hash === "#book") setTimeout(function () { stats.mined = 34; stats.logs = 3; stats.crafted = 1; store.state.gems = Math.max(store.state.gems, 420); ensureJobs(); bumpJob("mine", 34); openBook(); }, 300); // test hook: the Vocraft Book
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
