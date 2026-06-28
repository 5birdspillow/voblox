/*
 * Voblox — 3D Word World (Phase 2)
 * A blocky Minecraft/Roblox-style island. Walk to glowing chests ("Vocab Gates"),
 * answer a word question to open them. Master all 15 to reach an A and unlock chess.
 * Reuses VobloxEngine (spaced repetition), VobloxQuestions, VobloxStore.
 */
(function () {
  "use strict";
  var THREE = window.THREE;
  var Content = window.VOBLOX_CONTENT, Engine = window.VobloxEngine, VQ = window.VobloxQuestions;
  var lesson = Content.getLesson("5");
  var WORDS = lesson.words;
  var store = new window.VobloxStore.Store(WORDS);

  window.onerror = function (m) { var b = document.getElementById("errbar"); if (b) { b.style.display = "block"; b.textContent = "⚠ " + m; } };

  // ---------- renderer / scene ----------
  var canvas = document.getElementById("c");
  var renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd6ff);
  scene.fog = new THREE.Fog(0x9fd6ff, 26, 60);

  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6f9e57, 1.0));
  var sun = new THREE.DirectionalLight(0xfff3d0, 0.85);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  var sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80;
  scene.add(sun);

  // ---------- helpers ----------
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function labelTex(text, bg) {
    var c = document.createElement("canvas"); c.width = 256; c.height = 64;
    var x = c.getContext("2d");
    x.fillStyle = bg; rr(x, 4, 4, 248, 56, 16); x.fill();
    x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 4; x.stroke();
    x.fillStyle = "#fff"; x.font = "bold 34px Trebuchet MS, sans-serif";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, 128, 34, 236);
    var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function faceTex() {
    var c = document.createElement("canvas"); c.width = 64; c.height = 64;
    var x = c.getContext("2d");
    x.fillStyle = "#ffcc88"; x.fillRect(0, 0, 64, 64);
    x.fillStyle = "#26323a"; x.fillRect(16, 24, 8, 10); x.fillRect(40, 24, 8, 10);
    x.strokeStyle = "#26323a"; x.lineWidth = 4; x.beginPath(); x.arc(32, 40, 12, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    return new THREE.CanvasTexture(c);
  }
  function box(w, h, d, color) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: color }));
    m.castShadow = true; return m;
  }

  // ---------- ground (instanced blocks) ----------
  var HALF = 11;
  (function buildGround() {
    var n = (HALF * 2 + 1) * (HALF * 2 + 1);
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.receiveShadow = true;
    var d = new THREE.Object3D(); var col = new THREE.Color(); var i = 0;
    for (var gx = -HALF; gx <= HALF; gx++) {
      for (var gz = -HALF; gz <= HALF; gz++) {
        var edge = (Math.abs(gx) === HALF || Math.abs(gz) === HALF);
        d.position.set(gx, -0.5, gz); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
        var shade = 0.92 + ((gx * 7 + gz * 13) % 5) * 0.018;
        if (edge) col.setHex(0x8a8f98); else col.setRGB(0.36 * shade, 0.66 * shade, 0.30 * shade);
        mesh.setColorAt(i, col); i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    // a little pond
    var water = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0x3aa0e6, transparent: true, opacity: 0.85 }));
    water.position.set(-6.5, -0.15, -6.5); water.receiveShadow = true; scene.add(water);
    // border wall (stops you walking off)
    var wallMat = new THREE.MeshLambertMaterial({ color: 0x9aa0aa });
    var wallGeo = new THREE.BoxGeometry((HALF * 2 + 1), 1.2, 1);
    [[0, HALF + 0.5, 0], [0, -(HALF + 0.5), 0]].forEach(function (p) { var w = new THREE.Mesh(wallGeo, wallMat); w.position.set(p[0], 0.6, p[1]); w.castShadow = true; w.receiveShadow = true; scene.add(w); });
    var wallGeo2 = new THREE.BoxGeometry(1, 1.2, (HALF * 2 + 1));
    [[HALF + 0.5, 0], [-(HALF + 0.5), 0]].forEach(function (p) { var w = new THREE.Mesh(wallGeo2, wallMat); w.position.set(p[0], 0.6, p[1]); w.castShadow = true; w.receiveShadow = true; scene.add(w); });
  })();

  var obstacles = []; // {x,z,r}

  function makeTree(x, z) {
    var g = new THREE.Group();
    var trunk = box(0.5, 1.6, 0.5, 0x8a5a3b); trunk.position.y = 0.8; g.add(trunk);
    var l1 = box(1.8, 1.0, 1.8, 0x4ea83e); l1.position.y = 2.0; g.add(l1);
    var l2 = box(1.1, 0.9, 1.1, 0x57c04a); l2.position.y = 2.8; g.add(l2);
    g.position.set(x, 0, z); scene.add(g);
    obstacles.push({ x: x, z: z, r: 0.6 });
  }
  [[3.2, 2.6], [-3.4, 3.2], [2.6, -3.6], [-2.4, -2.2], [0.4, 4.2]].forEach(function (p) { makeTree(p[0], p[1]); });

  // ---------- chests (vocab gates) ----------
  var chests = [], chestByWord = {};
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
    g.position.set(x, 0, z); scene.add(g);
    obstacles.push({ x: x, z: z, r: 0.7 });
    var c = { group: g, lidPivot: lidPivot, ring: ring, spr: spr, word: word, data: data, ready: false, _r: null, sense: 0, lastFormat: null };
    chests.push(c); chestByWord[word] = c; refreshChest(c); return c;
  }
  function refreshChest(c) {
    var ready = Engine.isQuizReady(store.state.cards[c.word]);
    c.ready = ready;
    if (c._r !== ready) {
      c._r = ready;
      c.spr.material.map = labelTex((ready ? "✓ " : c.data.emoji + " ") + c.word, ready ? "#2f9e44" : "#1f6fd0");
      c.spr.material.needsUpdate = true;
      c.ring.visible = !ready;
    }
  }
  (function placeChests() {
    var N = WORDS.length, R = 8.2;
    for (var i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2;
      makeChest(WORDS[i].word, WORDS[i], Math.cos(a) * R, Math.sin(a) * R);
    }
  })();

  // ---------- avatar ----------
  var avatar = (function () {
    var g = new THREE.Group();
    var skin = 0xffcc88, shirt = 0x2f7be0, pants = 0x394063;
    function limb(w, h, d, color, px, py, pz) {
      var pivot = new THREE.Group(); pivot.position.set(px, py, pz);
      var m = box(w, h, d, color); m.position.y = -h / 2; pivot.add(m); return pivot;
    }
    var ll = limb(0.34, 1.0, 0.34, pants, -0.22, 1.0, 0), rl = limb(0.34, 1.0, 0.34, pants, 0.22, 1.0, 0);
    var torso = box(0.9, 1.05, 0.5, shirt); torso.position.y = 1.52;
    var la = limb(0.3, 1.0, 0.3, skin, -0.62, 2.02, 0), ra = limb(0.3, 1.0, 0.3, skin, 0.62, 2.02, 0);
    var side = new THREE.MeshLambertMaterial({ color: skin }), face = new THREE.MeshLambertMaterial({ map: faceTex() });
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.82, 0.82), [side, side, side, side, face, side]);
    head.position.y = 2.5; head.castShadow = true;
    g.add(ll, rl, torso, la, ra, head);
    scene.add(g);
    return { group: g, ll: ll, rl: rl, la: la, ra: ra, head: head };
  })();
  var pos = avatar.group.position; pos.set(0, 0, 0);

  // ---------- camera follow ----------
  var camYaw = Math.PI, camPitch = 0.52, camDist = 7.2;
  function updateCamera() {
    var cp = Math.cos(camPitch);
    camera.position.set(pos.x + camDist * Math.sin(camYaw) * cp, 1.4 + camDist * Math.sin(camPitch), pos.z + camDist * Math.cos(camYaw) * cp);
    camera.lookAt(pos.x, pos.y + 1.5, pos.z);
  }

  // ---------- input ----------
  var keys = {}, joy = { active: false, x: 0, y: 0, id: null, ox: 0, oy: 0 };
  var overlayOpen = false, walkPhase = 0;

  document.addEventListener("keydown", function (e) {
    if (overlayOpen) { if (overlayKey) overlayKey(e); return; }
    var k = e.key.toLowerCase();
    keys[k] = true;
    if (k === "e" || k === " ") { e.preventDefault(); tryInteract(); }
  });
  document.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });

  // mouse look (drag) + click interact
  var pdown = null;
  canvas.addEventListener("mousedown", function (e) { pdown = { x: e.clientX, y: e.clientY, moved: 0 }; });
  window.addEventListener("mousemove", function (e) {
    if (!pdown || overlayOpen) return;
    var dx = e.movementX || 0, dy = e.movementY || 0;
    pdown.moved += Math.abs(dx) + Math.abs(dy);
    camYaw -= dx * 0.005; camPitch = Math.max(0.16, Math.min(1.2, camPitch + dy * 0.004));
  });
  window.addEventListener("mouseup", function (e) {
    if (pdown && pdown.moved < 6 && !overlayOpen) raycastInteract(e.clientX, e.clientY);
    pdown = null;
  });

  // touch: left half = joystick, right half = look, tap on chest = interact
  var look = { id: null, x: 0, y: 0 };
  canvas.addEventListener("touchstart", function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.clientX < window.innerWidth * 0.5 && !joy.active) {
        joy.active = true; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = 0; joy.y = 0;
        showJoy(t.clientX, t.clientY);
      } else if (look.id === null) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; look.tap = { x: t.clientX, y: t.clientY, moved: 0 }; }
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === joy.id) {
        var dx = t.clientX - joy.ox, dy = t.clientY - joy.oy, mag = Math.hypot(dx, dy) || 1, cl = Math.min(mag, 48) / 48;
        joy.x = (dx / mag) * cl; joy.y = -(dy / mag) * cl; moveNub(dx, dy);
      } else if (t.identifier === look.id) {
        var ddx = t.clientX - look.x, ddy = t.clientY - look.y; look.x = t.clientX; look.y = t.clientY;
        if (look.tap) look.tap.moved += Math.abs(ddx) + Math.abs(ddy);
        camYaw -= ddx * 0.006; camPitch = Math.max(0.16, Math.min(1.2, camPitch + ddy * 0.004));
      }
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
    for (var i = 0; i < chests.length; i++) {
      if (raycaster.intersectObject(chests[i].group, true).length) {
        if (dist2(chests[i].group.position) < 16) openGate(chests[i]); else flashPrompt("Walk closer to that chest!");
        return;
      }
    }
  }
  function dist2(p) { var dx = p.x - pos.x, dz = p.z - pos.z; return dx * dx + dz * dz; }

  // ---------- player update ----------
  var nearest = null;
  function updatePlayer(dt) {
    var ix = 0, iz = 0;
    if (keys["w"] || keys["arrowup"]) iz += 1;
    if (keys["s"] || keys["arrowdown"]) iz -= 1;
    if (keys["a"] || keys["arrowleft"]) ix -= 1;
    if (keys["d"] || keys["arrowright"]) ix += 1;
    ix += joy.x; iz += joy.y;
    var mag = Math.hypot(ix, iz);
    if (mag > 1) { ix /= mag; iz /= mag; mag = 1; }

    if (mag > 0.05) {
      var s = Math.sin(camYaw), c = Math.cos(camYaw);
      var wx = -s * iz + c * ix, wz = -c * iz - s * ix;
      var spd = 4.2 * dt;
      pos.x += wx * spd; pos.z += wz * spd;
      // obstacle + bounds collision
      for (var o = 0; o < obstacles.length; o++) {
        var ob = obstacles[o], dx = pos.x - ob.x, dz = pos.z - ob.z, dd = Math.hypot(dx, dz), min = ob.r + 0.45;
        if (dd < min && dd > 0.0001) { pos.x = ob.x + (dx / dd) * min; pos.z = ob.z + (dz / dd) * min; }
      }
      pos.x = Math.max(-HALF + 0.6, Math.min(HALF - 0.6, pos.x));
      pos.z = Math.max(-HALF + 0.6, Math.min(HALF - 0.6, pos.z));
      avatar.group.rotation.y = Math.atan2(wx, wz);
      walkPhase += dt * 10;
      var sw = Math.sin(walkPhase) * 0.5;
      avatar.ll.rotation.x = sw; avatar.rl.rotation.x = -sw; avatar.la.rotation.x = -sw; avatar.ra.rotation.x = sw;
    } else {
      avatar.ll.rotation.x *= 0.8; avatar.rl.rotation.x *= 0.8; avatar.la.rotation.x *= 0.8; avatar.ra.rotation.x *= 0.8;
    }

    // nearest chest prompt
    var best = null, bd = 1e9;
    for (var i = 0; i < chests.length; i++) { var d = dist2(chests[i].group.position); if (d < bd) { bd = d; best = chests[i]; } }
    nearest = (bd < 5.3) ? best : null;
    var prompt = document.getElementById("prompt"), act = document.getElementById("actbtn");
    if (nearest) {
      prompt.style.display = "block";
      prompt.innerHTML = (nearest.ready ? "Review" : "Open") + ": <b>" + nearest.word + "</b> — press E";
      act.style.display = "block"; act.textContent = (nearest.ready ? "REVIEW ✦" : "OPEN ✦");
    } else { prompt.style.display = "none"; act.style.display = "none"; }
  }
  function tryInteract() { if (nearest) openGate(nearest); }
  function flashPrompt(msg) { var p = document.getElementById("prompt"); p.style.display = "block"; p.innerHTML = msg; setTimeout(function () { if (!nearest) p.style.display = "none"; }, 1200); }

  // ---------- chest animation ----------
  function animateChests(dt, t) {
    for (var i = 0; i < chests.length; i++) {
      var c = chests[i];
      var target = c.ready ? -2.0 : 0;
      c.lidPivot.rotation.x += (target - c.lidPivot.rotation.x) * Math.min(1, dt * 8);
      c.spr.position.y = 1.75 + Math.sin(t * 2 + i) * 0.06;
      if (c.ring.visible) c.ring.rotation.z += dt * 1.5;
    }
  }

  // ========== OVERLAY: gates, menu, word list, chess ==========
  var overlay = document.getElementById("overlay"), obox = document.getElementById("overlaybox"), overlayKey = null;
  function openOverlay(html, keyFn) { obox.innerHTML = html; overlay.style.display = "flex"; overlayOpen = true; overlayKey = keyFn || null; }
  function closeOverlay() { overlay.style.display = "none"; overlayOpen = false; overlayKey = null; keys = {}; }

  function speak(text) {
    try {
      if (!("speechSynthesis" in window)) return;
      var u = new SpeechSynthesisUtterance(text); u.rate = 0.9;
      var v = (speechSynthesis.getVoices() || []).filter(function (x) { return /en[-_]?US/i.test(x.lang); })[0];
      if (v) u.voice = v; speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }

  function openGate(chest) {
    var word = chest.word, card = store.state.cards[word], data = chest.data;
    var fmt = Engine.pickFormat(card, data, chest.lastFormat); chest.lastFormat = fmt;
    var si = chest.sense % data.senses.length; chest.sense = (chest.sense + 1) % data.senses.length;
    var q = VQ.gen(card, WORDS, { format: fmt, senseIdx: si });
    renderGate(chest, q);
    if (q.audio) speak(q.audio);
  }
  function renderGate(chest, q) {
    var body;
    if (q.kind === "mc") {
      body = '<div class="choices">' + q.choices.map(function (ch, i) {
        return '<button class="choice" data-i="' + i + '"><span class="num">' + (i + 1) + '</span>' + VQ.esc(ch.label) + '</button>';
      }).join("") + '</div>';
    } else {
      body = '<div class="typebox"><input id="answer" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="type here…"><button id="submit" class="submit">Enter ⏎</button><div id="hint" class="hint"></div></div>';
    }
    openOverlay(
      '<div class="gatehead">✦ Vocab Gate: ' + VQ.esc(chest.word) + ' <span class="x" id="gx">✕</span></div>' +
      '<div class="card qcard"><div class="prompt">' + q.promptHTML + '</div>' + body + '</div>',
      null
    );
    document.getElementById("gx").onclick = function () { closeOverlay(); };
    var replay = obox.querySelector(".replay"); if (replay) replay.onclick = function () { if (q.audio) speak(q.audio); };
    if (q.kind === "mc") {
      var btns = obox.querySelectorAll(".choice");
      Array.prototype.forEach.call(btns, function (b) { b.onclick = function () { pickMC(chest, q, parseInt(b.dataset.i, 10)); }; });
      overlayKey = function (e) { var n = parseInt(e.key, 10); if (n >= 1 && n <= q.choices.length) pickMC(chest, q, n - 1); };
    } else {
      var inp = document.getElementById("answer"); if (inp && !("ontouchstart" in window)) inp.focus();
      document.getElementById("submit").onclick = function () { submitText(chest, q); };
      overlayKey = function (e) { if (e.key === "Enter") submitText(chest, q); };
    }
  }
  function pickMC(chest, q, i) {
    var correct = !!q.choices[i].correct;
    Array.prototype.forEach.call(obox.querySelectorAll(".choice"), function (b, idx) { b.disabled = true; if (q.choices[idx].correct) b.classList.add("right"); else if (idx === i) b.classList.add("wrong"); });
    resolveGate(chest, q, correct);
  }
  function submitText(chest, q) {
    var inp = document.getElementById("answer"), r = VQ.checkText(q, inp.value);
    if (r === "empty") return;
    if (r === "near" && q.hintAllowed && !q._retried) { q._retried = true; document.getElementById("hint").textContent = "So close — check the spelling and try once more!"; inp.classList.add("almost"); inp.select(); return; }
    inp.disabled = true; resolveGate(chest, q, r === "correct");
  }
  function resolveGate(chest, q, correct) {
    var res = store.record(q, correct);
    if (correct) confetti();
    refreshChest(chest); updateHUD();
    var d = q.data;
    var head = correct ? '<div class="fb good">✅ ' + ["Nice!", "Yes!", "Boom!", "You got it!"][Math.floor(Math.random() * 4)] + (res.earned ? ' <span class="gain">+' + res.earned + ' 💎</span>' : "") + '</div>'
      : '<div class="fb bad">❌ Not quite — here’s the word:</div>';
    var loot = res.loot ? '<div class="loot">🎁 Loot! You found ' + res.loot + '</div>' : "";
    var done = chest.ready ? '<div class="loot" style="background:#dff5e1;border-color:#7fce8a">✓ <b>' + chest.word + '</b> mastered — chest opened!</div>' : "";
    openOverlay(
      '<div class="gatehead">✦ Vocab Gate <span class="x" id="gx">✕</span></div>' +
      '<div class="card qcard">' + head + '<div class="reveal">' + VQ.entryHTML(d, { mnem: true }) + '</div>' + loot + done +
      '<button id="next" class="submit big-next">Continue ⏎</button></div>',
      function (e) { if (e.key === "Enter") afterGate(); }
    );
    document.getElementById("gx").onclick = afterGate;
    document.getElementById("next").onclick = afterGate;
  }
  function afterGate() { closeOverlay(); checkVictory(); }

  // ---------- HUD ----------
  function updateHUD() {
    var r = store.rank(), p = store.predicted();
    document.getElementById("rankchip").textContent = r.icon + " " + r.name;
    document.getElementById("gemchip").textContent = "💎 " + store.state.gems;
    var cc = document.getElementById("combochip");
    if (store.state.combo > 1) { cc.style.display = "inline-block"; cc.textContent = "🔥 x" + store.state.combo; } else cc.style.display = "none";
    document.getElementById("meterfill").style.width = p + "%";
    document.getElementById("meterlabel").textContent = p + "%";
  }

  // ---------- menu ----------
  document.getElementById("menubtn").addEventListener("click", openMenu);
  function openMenu() {
    var unlocked = store.state.chessUnlocked || store.predicted() >= 90;
    openOverlay(
      '<div class="card menucard"><h2>☰ Menu</h2>' +
      '<button class="menubtn" id="m_resume">▶ Back to the world</button>' +
      '<button class="menubtn" id="m_words">📖 Word List (all meanings)</button>' +
      '<button class="menubtn ' + (unlocked ? "" : "locked") + '" id="m_chess">♟ Chess Puzzle ' + (unlocked ? "" : "🔒 reach 90% to unlock") + '</button>' +
      '<a class="menubtn" href="study.html">📚 Study Mode (quiz &amp; mock test)</a>' +
      '<button class="menubtn" id="m_help">🎮 How to play</button>' +
      '<button class="menubtn" id="m_reset">🔄 Reset progress</button>' +
      '<div class="help">Predicted grade: <b>' + gradeText(store.predicted()) + '</b> • open all chests to reach an A.</div></div>',
      function (e) { if (e.key === "Escape" || e.key === "Enter") closeOverlay(); }
    );
    document.getElementById("m_resume").onclick = closeOverlay;
    document.getElementById("m_words").onclick = openWordList;
    document.getElementById("m_help").onclick = openHelp;
    document.getElementById("m_chess").onclick = function () { if (unlocked) openChess(); else flash("Reach 90% (open more chests) to unlock chess!"); };
    document.getElementById("m_reset").onclick = function () { if (window.confirm("Reset ALL progress?")) { store.reset(); chests.forEach(refreshChest); updateHUD(); closeOverlay(); } };
  }
  function gradeText(p) { return p >= 90 ? "A 🌟" : p >= 80 ? "B 👍" : "keep going 💪"; }
  function flash(msg) { var p = document.getElementById("prompt"); p.style.display = "block"; p.innerHTML = msg; setTimeout(function () { p.style.display = "none"; }, 1600); }

  function openWordList() {
    var rows = WORDS.map(function (d) {
      return '<div class="wrow"><button class="say" data-w="' + VQ.esc(d.word) + '">🔊</button><div class="winfo">' + VQ.entryHTML(d, { mnem: true }) + '</div></div>';
    }).join("");
    openOverlay('<div class="gatehead">📖 Word List <span class="x" id="gx">✕</span></div><div class="card"><div class="wordlist">' + rows + '</div></div>',
      function (e) { if (e.key === "Escape") closeOverlay(); });
    document.getElementById("gx").onclick = openMenu;
    Array.prototype.forEach.call(obox.querySelectorAll(".say"), function (b) { b.onclick = function () { speak(b.dataset.w); }; });
  }
  function openHelp() {
    openOverlay('<div class="card"><h2>🎮 How to play</h2><p><b>Move:</b> on a phone/tablet, drag the <b>left side</b> to walk and the <b>right side</b> to look around. On a computer, use <b>W A S D</b> (or arrows) to move and <b>drag the mouse</b> to look.</p><p><b>Open a chest:</b> walk up to a glowing chest and tap <b>OPEN</b> (or press <b>E</b>). Answer the word question to open it and earn 💎.</p><p>Open all 15 chests to fill the bar past the <b>A</b> line and unlock the ♟ chess puzzle!</p><button class="submit big-next" id="ok">Got it ⏎</button></div>',
      function (e) { if (e.key === "Enter") openMenu(); });
    document.getElementById("ok").onclick = openMenu;
  }

  // ---------- chess reward (mate in 1) ----------
  function openChess() {
    // back-rank mate: White to move, Ra1-a8#
    var board = { a1: "R", g1: "K", g8: "k", f7: "p", g7: "p", h7: "p" };
    var solution = { from: "a1", to: "a8" };
    var sel = null;
    var files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    var glyph = { R: "♖", K: "♔", Q: "♕", B: "♗", N: "♘", P: "♙", r: "♜", k: "♚", q: "♛", b: "♝", n: "♞", p: "♟" };
    function render(msg, ok) {
      var cells = "";
      for (var rank = 8; rank >= 1; rank--) for (var f = 0; f < 8; f++) {
        var sqid = files[f] + rank, lightSq = (f + rank) % 2 === 1;
        var pc = board[sqid] ? glyph[board[sqid]] : "";
        var cls = "sq " + (lightSq ? "light" : "dark") + (sel === sqid ? " sel" : "");
        cells += '<div class="' + cls + '" data-sq="' + sqid + '">' + pc + '</div>';
      }
      openOverlay('<div class="gatehead">♟ Chess Puzzle — White to move, mate in 1 <span class="x" id="gx">✕</span></div>' +
        '<div class="card"><div class="chess">' + cells + '</div><div class="chess-msg" style="color:' + (ok ? "#2f9e44" : "#c0392b") + '">' + (msg || "Move the rook to checkmate the black king!") + '</div>' +
        '<button class="menubtn" id="hintb">💡 Hint</button></div>',
        function (e) { if (e.key === "Escape") openMenu(); });
      document.getElementById("gx").onclick = openMenu;
      document.getElementById("hintb").onclick = function () { var c = obox.querySelector('[data-sq="a1"]'); if (c) c.classList.add("hint"); };
      Array.prototype.forEach.call(obox.querySelectorAll(".sq"), function (cell) {
        cell.onclick = function () {
          var sq = cell.dataset.sq;
          if (!sel) { if (board[sq] && board[sq] === board[sq].toUpperCase()) { sel = sq; render(); } return; }
          if (sel === solution.from && sq === solution.to) { board[sq] = board[sel]; delete board[sel]; sel = null; render("Checkmate! 🏆 You win!", true); confetti(); }
          else { sel = null; render("Not checkmate — try again! (Hint: trap the king on the back row.)", false); }
        };
      });
    }
    render();
  }

  // ---------- victory ----------
  function checkVictory() {
    if (store.predicted() >= 90 && !store.state.chessUnlocked) { store.state.chessUnlocked = true; store.save(); }
    if (store.predicted() >= 100 && !store.state._won) {
      store.state._won = true; store.save(); confetti(); confetti();
      openOverlay('<div class="card hero" style="text-align:center"><div class="big-emoji">🏆</div><div class="hero-line">You mastered all 15 words!</div><div class="hero-sub">Predicted grade: <b>A 🌟</b> — amazing! The ♟ chess arena is unlocked.</div><button class="submit big-next" id="ok">Play chess ⏎</button></div>',
        function (e) { if (e.key === "Enter") openChess(); });
      document.getElementById("ok").onclick = openChess;
    }
  }

  // ---------- confetti ----------
  function confetti() {
    var cols = ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb", "#ffab40"];
    for (var i = 0; i < 22; i++) {
      var s = document.createElement("div");
      s.style.cssText = "position:fixed;z-index:40;top:-16px;width:11px;height:11px;border-radius:3px;pointer-events:none;left:" + (8 + Math.random() * 84) + "vw;background:" + cols[i % 6] + ";transition:transform 1.1s ease-in,opacity 1.1s";
      document.body.appendChild(s);
      (function (node) { requestAnimationFrame(function () { node.style.transform = "translateY(110vh) rotate(540deg)"; node.style.opacity = "0.2"; }); setTimeout(function () { node.remove(); }, 1200); })(s);
    }
  }

  // ---------- loop / resize ----------
  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  var clock = new THREE.Clock(), tAcc = 0;
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05); tAcc += dt;
    if (!overlayOpen) updatePlayer(dt);
    animateChests(dt, tAcc);
    updateCamera();
    renderer.render(scene, camera);
  }

  // boot
  updateHUD();
  document.getElementById("loading").style.display = "none";
  if (!store.state.lastPlayed && location.hash !== "#play") openHelp(); // first run: show controls
  animate();

  // PWA service worker (only on secure origins, e.g. the hosted https link)
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
