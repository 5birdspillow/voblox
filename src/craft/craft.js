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
  var B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, PLANK: 8, GLASS: 9, COBBLE: 10, BRICK: 11, SANDSTONE: 12, WORD: 13, COAL: 14, IRON: 15, GOLD: 16, SNOW: 17, FURNACE: 18, TORCH: 19, DIAMOND: 20, BOUNCE: 21, CHEST: 22, RAINBOW: 23, GLOW: 24, CANDY: 25, ICE: 26, TNT: 27 };
  var NAMES = { 1: "Grass", 2: "Dirt", 3: "Stone", 4: "Sand", 6: "Wood", 7: "Leaves", 8: "Planks", 9: "Glass", 10: "Cobble", 11: "Brick", 12: "Sandstone", 14: "Coal", 15: "Iron", 16: "Gold", 17: "Snow", 18: "Furnace", 19: "Torch", 20: "Diamond", 21: "Bounce!", 22: "Treasure", 23: "Rainbow", 24: "Glow", 25: "Candy", 26: "Ice", 27: "TNT" };
  // non-placeable items (ids >= 100)
  var IT = { STICK: 100, WPICK: 101, SPICK: 102, IPICK: 103, SWORD: 104, FOOD: 105, DPICK: 106, WOOL: 107, BAG: 108, SLIME: 109, DSWORD: 110 };
  var ITNAME = { 100: "Stick", 101: "Wood Pick", 102: "Stone Pick", 103: "Iron Pick", 104: "Sword", 105: "Food", 106: "DIAMOND Pick", 107: "Wool", 108: "Sleeping Bag", 109: "Slimeball", 110: "Diamond Sword" };
  var ITEMOJI = { 100: "🪵", 101: "⛏️", 102: "⛏️", 103: "⛏️", 104: "🗡️", 105: "🍖", 106: "💠", 107: "🧶", 108: "🛏️", 109: "🟢", 110: "⚔️" };
  function transparent(id) { return id === B.AIR || id === B.WATER || id === B.GLASS || id === B.LEAVES; }
  function opaque(id) { return id !== B.AIR && !transparent(id); }
  function solid(id) { return id !== B.AIR && id !== B.WATER; } // collidable

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
    27: { all: [0.85, 0.24, 0.20] }
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
        if (ly > 1 && ly < h - 4 && noise3(wx / 13, ly / 9, wz / 13) > 0.78) id = B.AIR; // caves
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
        var glow = (id === B.WORD || id === B.TORCH || id === B.GLOW || id === B.DIAMOND);
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
  function updatePlayer(dt) {
    if (paused) return;
    var input = readMove();
    var sp = 4.6, s = Math.sin(player.yaw), c = Math.cos(player.yaw);
    // forward = -z when yaw 0; right = +x
    var wx = (input.x * c - input.z * s), wz = (input.x * s + input.z * c);
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
    // clamp into world vertically
    if (player.pos.y < -8) { player.pos.set(player.pos.x, heightAt(player.pos.x, player.pos.z) + 3, player.pos.z); player.vel.set(0, 0, 0); }
  }
  function updateCamera() {
    camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
    var cp = Math.cos(player.pitch);
    camera.lookAt(player.pos.x - Math.sin(player.yaw) * cp, player.pos.y + EYE + Math.sin(player.pitch), player.pos.z - Math.cos(player.yaw) * cp);
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
    if (id === B.LEAVES || id === B.WATER) return null;
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
  function doMine() {
    if (paused) return;
    var mi = attackTarget(); if (mi != null) { hitMob(mi); return; }
    var h = ray(); if (!h) return;
    if (h.id === B.WORD) { openWordGate(h.x, h.y, h.z); return; }
    if (h.id === B.CHEST) { openTreasure(h); return; }
    var tier = pickTier();
    var drop = dropFor(h.id, tier);
    if (drop) {
      addInv(drop, 1);
      // the diamond pick sometimes strikes double ore
      if (tier >= 4 && (drop === B.COAL || drop === B.IRON || drop === B.GOLD || drop === B.DIAMOND) && Math.random() < 0.3) addInv(drop, 1);
      if (drop === B.DIAMOND) { stats.diamonds = (stats.diamonds || 0) + 1; toast("💠 DIAMOND!"); chime(); }
      if (drop === B.LOG) { stats.logs = (stats.logs || 0) + 1; bumpJob("logs", 1); }
    }
    stats.mined = (stats.mined || 0) + 1;
    if (h.y < (stats.deepest === undefined ? 99 : stats.deepest)) stats.deepest = h.y;
    sess.mined++;
    bumpJob("mine", 1);
    puff(h.x, h.y, h.z, h.id); sfx(170, 0.07, "square", 0.045);
    setBlock(h.x, h.y, h.z, B.AIR); renderHotbar();
    checkAch();
  }
  function doPlace() {
    if (paused) return;
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
    COVB.innerHTML = '<div class="gatehead">✨ Word Crystal! <span class="x" id="wx">✕</span></div><div class="card qcard"><div class="prompt">' + q.promptHTML + ' <button class="replay" type="button" title="Read again">🔊</button></div>' + body + '</div>';
    COV.style.display = "flex";
    document.getElementById("wx").onclick = closeWordGate;
    var rep = COVB.querySelector(".replay"); if (rep) rep.onclick = function () { VQ.readQ(q); };
    if (q.kind === "mc") {
      Array.prototype.forEach.call(COVB.querySelectorAll(".choice"), function (b) { b.onclick = function () { answerWord(bx, by, bz, q, !!q.choices[+b.dataset.i].correct, b); }; });
      wordKey = function (e) { var n = parseInt(e.key, 10); if (n >= 1 && n <= q.choices.length) answerWord(bx, by, bz, q, !!q.choices[n - 1].correct); };
    } else {
      var inp = document.getElementById("wans"); if (inp && !("ontouchstart" in window)) inp.focus();
      var sub = function () { var r = VQ.checkText(q, inp.value); if (r === "empty") return; if (r === "near" && !q._r) { q._r = true; document.getElementById("whint").textContent = "So close — check the spelling!"; inp.select(); return; } answerWord(bx, by, bz, q, r === "correct"); };
      document.getElementById("wsub").onclick = sub;
      wordKey = function (e) { if (e.key === "Enter") sub(); };
    }
  }
  function answerWord(bx, by, bz, q, correct, btn) {
    store.record(q, correct);
    if (q.kind === "mc") Array.prototype.forEach.call(COVB.querySelectorAll(".choice"), function (b, idx) { b.disabled = true; if (q.choices[idx].correct) b.classList.add("right"); else if (b === btn) b.classList.add("wrong"); });
    var head;
    if (correct) {
      setBlock(bx, by, bz, B.AIR); store.state.gems += 15; addInv(B.IRON, 2); store.save(); cfetti(); chime(); renderHotbar();
      stats.crystals = (stats.crystals || 0) + 1; sess.crystals++;
      bumpJob("crystals", 1); checkAch();
      head = '<div class="fb good">✅ Crystal cracked! <span class="gain">+15 <img class="vbx" src="icons/vobux.png" alt="Vobux"> &amp; 2 iron ⛏️</span></div>';
    }
    else { head = '<div class="fb bad">❌ The crystal holds — learn the word:</div>'; VQ.speak(q.data.word + ". " + q.data.senses[0].def); }
    COVB.innerHTML = '<div class="gatehead">✨ Word Crystal <span class="x" id="wx">✕</span></div><div class="card qcard">' + head + '<div class="reveal">' + VQ.entryHTML(q.data, { mnem: true }) + '</div><button id="wnext" class="submit big-next">Continue ⏎</button></div>';
    document.getElementById("wx").onclick = closeWordGate; document.getElementById("wnext").onclick = closeWordGate;
    wordKey = function (e) { if (e.key === "Enter") closeWordGate(); };
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
    if (e.button === 0) doMine(); else if (e.button === 2) doPlace();
  });
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // touch controls
  var touchEl = document.getElementById("touch");
  var joyEl, nubEl, joyId = null, jox = 0, joy0y = 0, lookId = null, lx0 = 0, ly0 = 0;
  if ("ontouchstart" in window) {
    joyEl = document.createElement("div"); joyEl.id = "tjoy"; nubEl = document.createElement("div"); nubEl.id = "tnub"; joyEl.appendChild(nubEl); document.body.appendChild(joyEl);
    addBtn("bMine", "⛏", function () { doMine(); });
    addBtn("bPlace", "▦", function () { doPlace(); });
    addBtn("bJump", "⤒", function () { jumpReq = true; });
    addBtn("bCraft", "📦", function () { openCraft(); });
    addBtn("bEat", "🍖", function () { eat(); });
    addBtn("bBook", "📖", function () { openBook(); });
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
    { name: "Bounce Block ×2", out: { id: B.BOUNCE, n: 2 }, in: [{ id: IT.SLIME, n: 2 }, { id: B.PLANK, n: 2 }], unlock: true }
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
  function makeMob(type, x, y, z) {
    var g = new THREE.Group();
    var col = { pig: 0xe79aa6, cow: 0x6e4a34, sheep: 0xeae6dc, zombie: 0x5a8f4a, slime: 0x59c94f }[type] || 0xcccccc;
    var M = new THREE.MeshLambertMaterial({ color: col });
    function bx(w, h, d, px, py, pz) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M); m.position.set(px, py, pz); g.add(m); }
    if (type === "zombie") { bx(0.6, 1.0, 0.35, 0, 1.05, 0); bx(0.5, 0.5, 0.5, 0, 1.8, 0); bx(0.18, 0.8, 0.18, -0.39, 1.05, 0.22); bx(0.18, 0.8, 0.18, 0.39, 1.05, 0.22); bx(0.2, 0.85, 0.2, -0.17, 0.42, 0); bx(0.2, 0.85, 0.2, 0.17, 0.42, 0); }
    else if (type === "slime") {
      var jelly = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.85), new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: 0.85 }));
      jelly.position.y = 0.36; g.add(jelly); g._jelly = jelly;
      var eye = new THREE.MeshLambertMaterial({ color: 0x20303a });
      var e1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), eye); e1.position.set(-0.18, 0.46, 0.44); g.add(e1);
      var e2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), eye); e2.position.set(0.18, 0.46, 0.44); g.add(e2);
    }
    else { bx(0.75, 0.6, 1.05, 0, 0.6, 0); bx(0.5, 0.5, 0.5, 0, 0.78, 0.62); [[-0.27, 0.38], [0.27, 0.38], [-0.27, -0.38], [0.27, -0.38]].forEach(function (p) { bx(0.18, 0.42, 0.18, p[0], 0.21, p[1]); }); if (type === "pig") bx(0.2, 0.16, 0.1, 0, 0.74, 0.9); }
    g.position.set(x, y, z); scene.add(g);
    return { type: type, pos: new THREE.Vector3(x, y, z), vel: 0, dir: Math.random() * 6.28, hp: type === "zombie" ? 6 : type === "slime" ? 3 : 4, group: g, wander: 0, moving: true, atkCd: 0, hopT: Math.random() * 2 };
  }
  function tryMove(m, dx, dz) { var nx = m.pos.x + dx, nz = m.pos.z + dz, gy = groundY(nx, nz, m.pos.y + 1); if (gy - m.pos.y > 1.3) return; m.pos.x = nx; m.pos.z = nz; }
  function updateMob(m, dt) {
    m.vel -= 20 * dt; var ny = m.pos.y + m.vel * dt, gy = groundY(m.pos.x, m.pos.z, m.pos.y + 1);
    if (ny <= gy) { ny = gy; m.vel = 0; } m.pos.y = ny;
    if (m.type === "zombie") {
      var dx = player.pos.x - m.pos.x, dz = player.pos.z - m.pos.z, d = Math.hypot(dx, dz) || 1;
      m.dir = Math.atan2(dx, dz); tryMove(m, (dx / d) * 1.6 * dt, (dz / d) * 1.6 * dt);
      m.atkCd -= dt; if (d < 1.2 && m.atkCd <= 0) { hurtPlayer(1); m.atkCd = 1.1; }
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
    if (spawnT <= 0) {
      spawnT = 3;
      var an = 0, zo = 0; mobs.forEach(function (m) { if (m.type === "zombie") zo++; else an++; });
      if (!isNight() && an < 6) spawnNear(["pig", "cow", "sheep", "slime"][Math.floor(Math.random() * 4)], 8, 22);
      if (isNight() && zo < 4) spawnNear("zombie", 9, 17);
    }
    for (var i = mobs.length - 1; i >= 0; i--) { var m = mobs[i], dd = Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z); if (dd > 50 || (m.type === "zombie" && !isNight() && dd > 7)) removeMob(i); }
  }
  function attackTarget() {
    var d = fwd(), best = null, bd = 4;
    for (var i = 0; i < mobs.length; i++) { var m = mobs[i], ex = m.pos.x - camera.position.x, ey = (m.pos.y + 0.8) - camera.position.y, ez = m.pos.z - camera.position.z, dist = Math.hypot(ex, ey, ez); if (dist > 3.6) continue; var dot = (ex * d.x + ey * d.y + ez * d.z) / (dist || 1); if (dot > 0.82 && dist < bd) { bd = dist; best = i; } }
    return best;
  }
  function hitMob(i) {
    var m = mobs[i]; m.hp -= (inv[IT.DSWORD] ? 7 : inv[IT.SWORD] ? 4 : 2); m.group.position.y += 0.1;
    if (m.hp <= 0) {
      if (m.type === "zombie") {
        store.state.gems += 3; store.save(); updateHud();
        stats.zkills = (stats.zkills || 0) + 1; sess.kills++;
        bumpJob("zombies", 1);
      } else if (m.type === "slime") {
        addInv(IT.SLIME, 1 + Math.floor(Math.random() * 2));
        toast("🟢 Slimeball! Craft Bounce Blocks with it!");
      } else if (m.type === "sheep") {
        addInv(IT.WOOL, 2); addInv(IT.FOOD, 1);
        toast("🧶 Wool! 3 wool = a Sleeping Bag.");
      } else {
        addInv(IT.FOOD, 1 + Math.floor(Math.random() * 2));
      }
      renderHotbar(); removeMob(i); checkAch();
    }
  }
  function hurtPlayer(n) { if (dead) return; player.health = Math.max(0, player.health - n); survFlash(); sfx(110, 0.18, "sawtooth", 0.07); updateSurvHud(); if (player.health <= 0) die(); }
  function eat() { if (player.hunger >= MAXHUNGER || dead) return; if (takeInv(IT.FOOD, 1)) { player.hunger = Math.min(MAXHUNGER, player.hunger + 3); updateSurvHud(); renderHotbar(); } }
  function updateSurvival(dt) {
    if (dead) return;
    hungerT += dt; if (hungerT > 7) { hungerT = 0; player.hunger = Math.max(0, player.hunger - 1); updateSurvHud(); }
    hpT += dt; if (hpT > 3) { hpT = 0; if (player.hunger >= 8 && player.health < MAXHP) { player.health++; updateSurvHud(); } else if (player.hunger <= 0 && player.health > 0) { player.health--; updateSurvHud(); if (player.health <= 0) die(); } }
  }
  function survFlash() { survEl.classList.add("hurt"); setTimeout(function () { survEl.classList.remove("hurt"); }, 220); }
  function updateSurvHud() { var f = inv[IT.FOOD] || 0; survEl.innerHTML = "❤️ " + player.health + "/" + MAXHP + " &nbsp; 🍖 " + player.hunger + "/" + MAXHUNGER + (f ? ' &nbsp; <span class="eatable">🍗×' + f + " (F)</span>" : ""); }
  function die() { dead = true; paused = true; if (document.pointerLockElement) document.exitPointerLock(); COVB.innerHTML = '<div class="card hero" style="text-align:center"><div class="big-emoji">💫</div><div class="hero-line">You fainted!</div><div class="hero-sub">No worries — you keep everything you collected.</div><button id="resp" class="submit big-next">Wake up ⏎</button></div>'; COV.style.display = "flex"; document.getElementById("resp").onclick = respawn; wordKey = function (e) { if (e.key === "Enter") respawn(); }; }
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
    { id: "sleep1", name: "Cozy Camper", emoji: "🛏️", pay: 15, cond: function () { return (stats.slept || 0) >= 1; } }
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
    { kind: "chests", text: "Open {n} treasure chest", ns: [1], pay: 35 }
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
    { id: B.CANDY, name: "Candy Block", price: 100 },
    { id: B.ICE, name: "Ice Block", price: 100 },
    { id: B.GLOW, name: "Glow Block", price: 250 },
    { id: B.TNT, name: "TNT (gentle!)", price: 250 },
    { id: B.RAINBOW, name: "Rainbow Block", price: 300 }
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
    COVB.innerHTML = '<div class="card"><h2>⛏️ Welcome to VOCRAFT!</h2><p><b>Move:</b> on a computer use <b>W A S D</b> and click to look with the mouse. On a tablet, drag the <b>left side</b> to walk and the <b>right side</b> to look.</p><p><b>Mine</b> blocks (left-click / ⛏) and <b>place</b> them (right-click / ▦). <b>Jump</b> with Space / ⤒. <b>Craft</b> with <b>E</b> / 📦, eat with <b>F</b> / 🍖.</p><p><b>📖 Your Vocraft Book (Q)</b> has daily jobs, trophies, and a Vobux block shop — dig deep for 💠 diamonds and 🎁 buried treasure!</p><p><b>✨ Crack glowing Word Crystals</b> — answer the word for Vobux and iron!</p><button id="okh" class="submit big-next">Let’s go! ⏎</button></div>';
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
    tod = (tod + dt / 240) % 1;
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
    if (!paused) { updateSurvival(dt); for (var mi = 0; mi < mobs.length; mi++) updateMob(mobs[mi], dt); spawnMobs(dt); }
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
  var v = document.getElementById("ver"); if (v) v.textContent = "build " + (window.VOBLOX_VERSION || "dev");
  document.getElementById("loading").style.display = "none";
  if (!location.hash && !save.craftSeen) showHelp();
  setInterval(updateHud, 1500);
  frame();
  if (location.hash === "#word") setTimeout(function () { openWordGate(0, 5, 0); }, 300); // test hook for the word-mining overlay
  if (location.hash === "#craft") setTimeout(function () { inv[B.LOG] = 4; inv[B.PLANK] = 8; inv[IT.STICK] = 4; inv[B.COBBLE] = 10; inv[B.COAL] = 2; inv[B.IRON] = 3; openCraft(); }, 300); // test hook for crafting screen
  if (location.hash === "#mob") setTimeout(function () { var px = player.pos.x, pz = player.pos.z; mobs.push(makeMob("pig", px - 1.5, groundY(px - 1.5, pz - 4, WH - 1), pz - 4)); mobs.push(makeMob("zombie", px + 1.6, groundY(px + 1.6, pz - 4, WH - 1), pz - 4)); mobs.push(makeMob("slime", px, groundY(px, pz - 5, WH - 1), pz - 5)); mobs.forEach(function (m) { m.group.position.copy(m.pos); }); }, 400); // test hook: spawn mobs in view
  if (location.hash === "#book") setTimeout(function () { stats.mined = 34; stats.logs = 3; stats.crafted = 1; store.state.gems = Math.max(store.state.gems, 420); ensureJobs(); bumpJob("mine", 34); openBook(); }, 300); // test hook: the Vocraft Book
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
