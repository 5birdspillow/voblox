/*
 * Voblox — Craft World (voxel sandbox), Phase 1: generate/mine/place/move/save.
 * Chunked voxel world with face-culled meshing, first-person physics + collision,
 * PC (pointer-lock + WASD) and touch (joystick + look + buttons) controls.
 * Reuses VobloxStore (gems/progress) and (later) VobloxQuestions for word-mining.
 */
(function () {
  "use strict";
  var THREE = window.THREE;
  var StoreAPI = window.VobloxStore, Content = window.VOBLOX_CONTENT;
  window.onerror = function (m) { var b = document.getElementById("errbar"); if (b) { b.style.display = "block"; b.textContent = "⚠ " + m; } };

  // ---------- constants ----------
  var CHUNK = 16, WH = 48, SEA = 11, RENDER = ("ontouchstart" in window) ? 3 : 4;
  var B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, PLANK: 8, GLASS: 9, COBBLE: 10, BRICK: 11, SANDSTONE: 12, WORD: 13 };
  var NAMES = { 1: "Grass", 2: "Dirt", 3: "Stone", 4: "Sand", 6: "Wood", 7: "Leaves", 8: "Planks", 9: "Glass", 10: "Cobble", 11: "Brick", 12: "Sandstone" };
  function transparent(id) { return id === B.AIR || id === B.WATER || id === B.GLASS || id === B.LEAVES; }
  function opaque(id) { return id !== B.AIR && !transparent(id); }
  function solid(id) { return id !== B.AIR && id !== B.WATER; } // collidable

  var COL = {
    1: { top: [0.40, 0.72, 0.33], side: [0.52, 0.40, 0.26], bot: [0.45, 0.33, 0.21] },
    2: { all: [0.50, 0.36, 0.23] }, 3: { all: [0.50, 0.50, 0.53] }, 4: { all: [0.85, 0.79, 0.55] },
    5: { all: [0.20, 0.45, 0.85] }, 6: { top: [0.55, 0.42, 0.25], side: [0.48, 0.35, 0.21] },
    7: { all: [0.26, 0.55, 0.27] }, 8: { all: [0.78, 0.62, 0.40] }, 9: { all: [0.78, 0.88, 0.96] },
    10: { all: [0.43, 0.43, 0.46] }, 11: { all: [0.70, 0.33, 0.28] }, 12: { all: [0.90, 0.84, 0.60] },
    13: { all: [1.0, 0.84, 0.20] }
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
  scene.fog = new THREE.Fog(0x8fd2ff, RENDER * CHUNK * 0.6, RENDER * CHUNK * 1.05);
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
    return Math.max(2, Math.min(WH - 6, Math.floor(6 + n * 18)));
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
      for (var ly = 0; ly <= h; ly++) {
        var id = B.STONE;
        if (ly === h) id = (h < SEA) ? B.SAND : B.GRASS;
        else if (ly > h - 3) id = (h < SEA) ? B.SAND : B.DIRT;
        blocks[idx(lx, ly, lz)] = id;
      }
      if (h < SEA) for (var wy = h + 1; wy <= SEA; wy++) blocks[idx(lx, wy, lz)] = B.WATER;
      // trees on grass
      if (h >= SEA && lx > 1 && lx < CHUNK - 2 && lz > 1 && lz < CHUNK - 2 && hash(wx, 7, wz) > 0.978) {
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
        var col = faceCol(id, F.k), s = isW ? 0.9 : shade(F.k);
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
  var player = { pos: new THREE.Vector3(save.px, save.py, save.pz), vel: new THREE.Vector3(), onGround: false, yaw: save.yaw || 0, pitch: save.pitch || 0 };
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
    var blockedY = moveAxis("y", player.vel.y * dt);
    if (blockedY) { if (player.vel.y < 0) player.onGround = true; player.vel.y = 0; } else player.onGround = false;
    // clamp into world vertically
    if (player.pos.y < -8) { player.pos.set(player.pos.x, heightAt(player.pos.x, player.pos.z) + 3, player.pos.z); player.vel.set(0, 0, 0); }
  }
  function updateCamera() {
    camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
    var cp = Math.cos(player.pitch);
    camera.lookAt(player.pos.x - Math.sin(player.yaw) * cp, player.pos.y + EYE + Math.sin(player.pitch), player.pos.z - Math.cos(player.yaw) * cp);
  }

  // ---------- raycast (voxel DDA) ----------
  function ray() {
    var dir = new THREE.Vector3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
    var ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
    var x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    var sx = dir.x > 0 ? 1 : -1, sy = dir.y > 0 ? 1 : -1, sz = dir.z > 0 ? 1 : -1;
    var tdx = Math.abs(1 / (dir.x || 1e-9)), tdy = Math.abs(1 / (dir.y || 1e-9)), tdz = Math.abs(1 / (dir.z || 1e-9));
    var mx = ((dir.x > 0 ? (x + 1 - ox) : (ox - x)) * tdx), my = ((dir.y > 0 ? (y + 1 - oy) : (oy - y)) * tdy), mz = ((dir.z > 0 ? (z + 1 - oz) : (oz - z)) * tdz);
    var px = x, py = y, pz = z;
    for (var i = 0; i < 80; i++) {
      var bid = getBlock(x, y, z);
      if (bid !== B.AIR && bid !== B.WATER) return { x: x, y: y, z: z, px: px, py: py, pz: pz, id: bid };
      px = x; py = y; pz = z;
      if (mx < my && mx < mz) { x += sx; mx += tdx; } else if (my < mz) { y += sy; my += tdy; } else { z += sz; mz += tdz; }
      if (Math.abs(x - px) + Math.abs(y - py) + Math.abs(z - pz) > 7 && (Math.hypot(x - Math.floor(ox), y - Math.floor(oy), z - Math.floor(oz)) > 6)) break;
    }
    return null;
  }
  function doMine() { var h = ray(); if (!h) return; setBlock(h.x, h.y, h.z, B.AIR); }
  function doPlace() {
    var h = ray(); if (!h) return;
    var nx = h.px, ny = h.py, nz = h.pz;
    // don't place inside the player
    var fex = player.pos.x, fey = player.pos.y, fez = player.pos.z;
    if (nx === Math.floor(fex) && nz === Math.floor(fez) && (ny === Math.floor(fey) || ny === Math.floor(fey + 1))) return;
    setBlock(nx, ny, nz, hotbar[sel]);
  }

  // ---------- input ----------
  var keys = {}, jumpReq = false, joy = { x: 0, y: 0 };
  function readMove() {
    var x = 0, z = 0;
    if (keys["w"] || keys["arrowup"]) z -= 1; if (keys["s"] || keys["arrowdown"]) z += 1;
    if (keys["a"] || keys["arrowleft"]) x -= 1; if (keys["d"] || keys["arrowright"]) x += 1;
    x += joy.x; z += joy.y;
    return { x: x, z: z };
  }
  // keyboard
  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase(); keys[k] = true;
    if (k === " ") { jumpReq = true; e.preventDefault(); }
    if (k >= "1" && k <= "9") { var i = +k - 1; if (i < hotbar.length) { sel = i; renderHotbar(); } }
  });
  document.addEventListener("keyup", function (e) { keys[(e.key || "").toLowerCase()] = false; });
  // pointer lock look + mouse mine/place (PC)
  canvas.addEventListener("click", function () { if (!("ontouchstart" in window) && document.pointerLockElement !== canvas) canvas.requestPointerLock(); });
  document.addEventListener("mousemove", function (e) {
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
  var hotbar = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANK, B.LOG, B.SAND, B.GLASS, B.BRICK], sel = 0;
  function renderHotbar() {
    var el = document.getElementById("hotbar");
    el.innerHTML = hotbar.map(function (id, i) {
      var c = faceCol(id, "side"), css = "rgb(" + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + ")";
      return '<div class="slot' + (i === sel ? " sel" : "") + '" data-i="' + i + '"><div class="sw" style="background:' + css + '"></div><div class="nm">' + (NAMES[id] || "") + "</div></div>";
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll(".slot"), function (s) { s.onclick = function () { sel = +s.dataset.i; renderHotbar(); }; });
  }

  // ---------- HUD ----------
  function updateHud() {
    document.getElementById("cgems").textContent = "💎 " + store.state.gems;
    var p = store.predicted(Content.getLesson(store.state.activeLesson || "5").words);
    document.getElementById("cgrade").textContent = (p >= 90 ? "A" : p >= 80 ? "B" : p + "%");
  }

  // ---------- loop ----------
  function resize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
  window.addEventListener("resize", resize);
  var clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    updatePlayer(dt); updateCamera(); streamChunks();
    saveTimer -= dt; if (saveTimer < 0 && saveTimer > -1) { save.px = player.pos.x; save.py = player.pos.y; save.pz = player.pos.z; save.yaw = player.yaw; save.pitch = player.pitch; persist(); saveTimer = -2; }
    renderer.render(scene, camera);
  }

  // ---------- lights (Basic material is unlit; add a faint sun via fog/clear only) ----------
  // (solid colors are pre-shaded per face, so no lights needed)

  // ---------- boot ----------
  // spawn safely on the surface near saved/origin x,z
  (function spawn() {
    streamChunks(); // generate around spawn
    var h = heightAt(Math.floor(player.pos.x), Math.floor(player.pos.z));
    if (!save.edits || Object.keys(save.edits).length === 0 || save.py < -5) { player.pos.y = h + 2; }
  })();
  renderHotbar(); updateHud();
  var v = document.getElementById("ver"); if (v) v.textContent = "build " + (window.VOBLOX_VERSION || "dev");
  document.getElementById("loading").style.display = "none";
  setInterval(updateHud, 1500);
  frame();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
