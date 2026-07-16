/*
 * Voblox arcade game — ⛳ WORD GOLF (a top-down drag-to-putt mini-golf course).
 * 12 hand-authored holes on a letterboxed green: banked walls, sand traps,
 * water hazards, spinning windmill blades, boost pads, teleport pipes, and
 * hilly slope zones that curve the roll. Drag BACK from the ball to aim — an
 * arrow shows direction + power (capped) — release to putt. Friction rolls the
 * ball to rest; slow enough over the cup and it PLUNKS in.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - 🎯 MULLIGAN: once per hole, answer a word (miniQuiz) to UNDO your last
 *     stroke — ball back, stroke refunded.
 *   - 🔒 HOLES 7–12 are word-gated the FIRST time: answer at the tee to unlock
 *     that hole forever.
 *   - ⭐ Every hole hides a floating STAR RING — putt THROUGH it and sink within
 *     par for bonus Vobux, then a word offer to DOUBLE it.
 * Economy: gems/XP only via store.record (miniQuiz) + ONE recordGame("golf")
 * per round, banked on course-end, quit, AND app-close. Stats persist additively.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // ---------- logical course space (letterboxed, top-down) ----------
  var MW = 560, MH = 880;                 // logical field
  var PX0 = 30, PY0 = 54, PX1 = 530, PY1 = 846; // playable rect (walls bounce here)
  var R = 9;                              // ball radius
  var DECEL = 340, SAND = 1500, STOP = 13;// rolling friction / sand drag / stop speed
  var REST = 0.68;                        // wall bounce restitution
  var MAXPOWER = 1450, MAXDRAG = 250;     // putt power cap + drag length that maxes it
  var CAPR = 18, CAPS = 560, MAXSPEED = 1900; // cup capture radius / max sink speed / clamp
  var STARBONUS = 8;                      // bonus Vobux for a starred sink (banked)

  var PARS = [2, 3, 3, 3, 4, 3, 3, 4, 4, 4, 4, 4];

  // hand-authored holes (deterministic → stable tests). Missing feature arrays
  // default to empty. Coordinates are logical, inside the playable rect.
  function buildHoles() {
    return [
      { tee: { x: 280, y: 760 }, cup: { x: 280, y: 180 }, star: { x: 280, y: 470, r: 26 } },
      { tee: { x: 120, y: 760 }, cup: { x: 440, y: 160 }, wall: [{ x: 230, y: 300, w: 110, h: 40 }], star: { x: 285, y: 520, r: 26 } },
      { tee: { x: 280, y: 780 }, cup: { x: 280, y: 150 }, sand: [{ x: 200, y: 380, w: 160, h: 120 }], star: { x: 280, y: 610, r: 26 } },
      { tee: { x: 110, y: 760 }, cup: { x: 450, y: 180 }, water: [{ x: 230, y: 360, w: 150, h: 150 }], star: { x: 150, y: 560, r: 24 } },
      { tee: { x: 280, y: 800 }, cup: { x: 280, y: 140 }, windmill: [{ x: 280, y: 430, len: 120, w: 20, speed: 1.4 }], star: { x: 280, y: 620, r: 24 } },
      { tee: { x: 280, y: 800 }, cup: { x: 280, y: 150 }, boost: [{ x: 220, y: 520, w: 120, h: 70, ax: 0, ay: -1400 }], star: { x: 280, y: 680, r: 24 } },
      { tee: { x: 110, y: 780 }, cup: { x: 450, y: 160 }, pipe: [{ inx: 150, iny: 400, outx: 430, outy: 400, r: 26 }], star: { x: 150, y: 610, r: 24 } },
      { tee: { x: 280, y: 800 }, cup: { x: 280, y: 140 }, slope: [{ x: 120, y: 360, w: 320, h: 180, ax: 520, ay: 0 }], star: { x: 280, y: 630, r: 24 } },
      { tee: { x: 110, y: 790 }, cup: { x: 450, y: 150 }, sand: [{ x: 150, y: 520, w: 120, h: 100 }], water: [{ x: 300, y: 340, w: 140, h: 130 }], star: { x: 200, y: 680, r: 22 } },
      { tee: { x: 280, y: 800 }, cup: { x: 280, y: 130 }, windmill: [{ x: 280, y: 400, len: 110, w: 20, speed: -1.8 }], boost: [{ x: 210, y: 610, w: 140, h: 70, ax: 0, ay: -1500 }], star: { x: 280, y: 700, r: 22 } },
      { tee: { x: 100, y: 790 }, cup: { x: 460, y: 150 }, pipe: [{ inx: 150, iny: 560, outx: 430, outy: 300, r: 26 }], slope: [{ x: 250, y: 380, w: 220, h: 160, ax: -400, ay: 0 }], star: { x: 150, y: 680, r: 22 } },
      { tee: { x: 280, y: 800 }, cup: { x: 280, y: 120 }, wall: [{ x: 180, y: 300, w: 60, h: 120 }, { x: 320, y: 470, w: 60, h: 120 }], sand: [{ x: 120, y: 600, w: 110, h: 90 }], windmill: [{ x: 280, y: 220, len: 90, w: 18, speed: 2.0 }], star: { x: 280, y: 690, r: 22 } }
    ];
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("golf");
    // additive, never-renamed save fields
    if (stats.holesUnlocked === undefined || typeof stats.holesUnlocked !== "object") stats.holesUnlocked = {};
    if (stats.holeBest === undefined || typeof stats.holeBest !== "object") stats.holeBest = {};
    // stats.bestRelative left undefined until a course is finished (lower is better)

    var HOLES = buildHoles();

    var wrap = document.createElement("div");
    wrap.className = "gamewrap golf";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="gfcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="gfmsg">⛳ Word Golf — drag back to putt!</div>' +
      '<div class="grow"><span id="gfhole">Hole 1</span><span id="gfpar">Par 2</span>' +
      '<span id="gfstroke">Strokes 0</span><span id="gftot">E</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="gfbig"></div>' +
      '<div id="gfsafe" style="position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top, 0px);padding-bottom:env(safe-area-inset-bottom, 0px);' +
      'padding-left:env(safe-area-inset-left, 0px);padding-right:env(safe-area-inset-right, 0px)"></div>' +
      '<div class="gover" id="gfq" style="display:none"></div>' +
      '<div class="gover" id="gfcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#gfcv"), ctx = cv.getContext("2d");
    var gfq = document.getElementById("gfq"), gfcard = document.getElementById("gfcard");
    var msgEl = document.getElementById("gfmsg"), bigEl = document.getElementById("gfbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- responsive letterbox (both orientations fit the SAME field) ----------
    var W, H, S, OX, OY, compact = false;
    var gfsafe = document.getElementById("gfsafe");
    function resize() {
      W = cv.width = wrap.clientWidth || 480;
      H = cv.height = wrap.clientHeight || 800;
      compact = Math.min(W, H) < 520;
      // safe-area insets (Dynamic Island top / home-indicator bottom / landscape sides)
      var insT = 0, insB = 0, insL = 0, insR = 0;
      try {
        var cs = getComputedStyle(gfsafe);
        insT = parseFloat(cs.paddingTop) || 0; insB = parseFloat(cs.paddingBottom) || 0;
        insL = parseFloat(cs.paddingLeft) || 0; insR = parseFloat(cs.paddingRight) || 0;
      } catch (_) {}
      var top = (compact ? 70 : 96) + insT, bot = 12 + insB;
      var mL = insL + 6, mR = insR + 6;
      var availW = W - mL - mR, availH = H - top - bot;
      S = Math.min(availW / MW, availH / MH);
      if (S <= 0) S = 1;
      OX = mL + Math.max(0, (availW - MW * S) / 2);
      OY = top + Math.max(0, (availH - MH * S) / 2);
    }
    resize(); window.addEventListener("resize", resize);
    function X(x) { return OX + x * S; }
    function Y(y) { return OY + y * S; }
    function pz(n) { return n * S; }
    function toLogical(sx, sy) { return { x: (sx - OX) / S, y: (sy - OY) / S }; }

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now(), animT = 0;
    var hole = 1, cur = null, par = 2;
    var ball = { x: 280, y: 760, vx: 0, vy: 0, moving: false };
    var strokeStartPos = { x: 280, y: 760 }; // where the last putt began (mulligan + water target)
    var strokes = 0, sunk = false, gated = false, mulliganUsed = false, starHit = false;
    var over = false, paused = false, banked = false, pipeCd = 0;
    var completed = [], holeStrokes = {}, runBonusGems = 0, lastFmt = null;
    var aim = { active: false, ox: 0, oy: 0, cx: 0, cy: 0 };

    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1200);
    }
    function totalRel() {
      var s = 0; for (var i = 0; i < completed.length; i++) { var h = completed[i]; s += holeStrokes[h] - PARS[h - 1]; }
      return s;
    }
    function relText(n) { return n === 0 ? "E" : n > 0 ? "+" + n : "" + n; }
    function hud() {
      document.getElementById("gfhole").textContent = "Hole " + hole;
      document.getElementById("gfpar").textContent = "Par " + par;
      document.getElementById("gfstroke").textContent = "Strokes " + strokes;
      document.getElementById("gftot").textContent = relText(totalRel());
    }

    // ---------- hole lifecycle ----------
    function beginHole(n) {
      hole = Math.max(1, Math.min(12, n | 0));
      cur = HOLES[hole - 1]; par = PARS[hole - 1];
      ball.x = cur.tee.x; ball.y = cur.tee.y; ball.vx = 0; ball.vy = 0; ball.moving = false;
      strokeStartPos = { x: ball.x, y: ball.y };
      strokes = 0; sunk = false; mulliganUsed = false; starHit = false; pipeCd = 0;
      aim.active = false;
      gfcard.style.display = "none"; gfq.style.display = "none";
      gated = (hole >= 7 && !stats.holesUnlocked[hole]);
      if (gated) { showGateCard(); big("🔒 Hole " + hole + " is locked — answer to open it!", "#ffd740"); }
      else big("⛳ Hole " + hole + " · Par " + par, "#8ef");
      hud();
    }
    function showGateCard() {
      gfcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:44px">🔒⛳</div>' +
        '<div class="wqtitle" style="font-size:20px">Hole ' + hole + " is locked</div>" +
        '<div style="margin:6px 0;color:#5a6b7a">Answer a word at the tee to unlock this hole forever.</div>' +
        '<button class="submit big-next" id="gfgate" type="button">🔑 Answer to unlock</button></div>';
      gfcard.style.display = "flex";
      document.getElementById("gfgate").onclick = function () { openGate(); };
    }
    function openGate() {
      if (!gated || paused || over) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(gfq, words, store, {
        title: "🔑 Unlock Hole " + hole + " — spell the word!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            gated = false; stats.holesUnlocked[hole] = 1; store.save();
            gfcard.style.display = "none";
            big("🔓 Hole " + hole + " unlocked! Tee off!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
          } else {
            big("Still locked — try another word!", "#ff8a8a");
            showGateCard();
          }
        }
      });
    }

    // ---------- putting ----------
    function shoot(vx, vy) {
      if (gated || over || sunk || ball.moving) return;
      strokeStartPos = { x: ball.x, y: ball.y };
      strokes++;
      ball.vx = vx; ball.vy = vy;
      ball.moving = (Math.abs(vx) + Math.abs(vy)) > 1;
      if (sfx && sfx.pop) sfx.pop();
      hud();
    }
    // sink shortcut for tests/demos: count a stroke and drop the ball in the cup
    function sinkFromClose() {
      if (gated || over || sunk) return;
      strokeStartPos = { x: ball.x, y: ball.y };
      strokes++;
      ball.x = cur.cup.x; ball.y = cur.cup.y; ball.vx = 0; ball.vy = 0; ball.moving = false;
      sinkBall();
    }
    function sinkBall() {
      if (sunk) return;
      sunk = true; ball.moving = false; ball.vx = 0; ball.vy = 0;
      ball.x = cur.cup.x; ball.y = cur.cup.y;
      holeStrokes[hole] = strokes; completed.push(hole);
      if (stats.holeBest[hole] === undefined || strokes < stats.holeBest[hole]) stats.holeBest[hole] = strokes;
      store.save();
      if (sfx && sfx.coin) sfx.coin();
      if (juice) juice.burst(X(cur.cup.x), Y(cur.cup.y), "#ffd23f", 18);
      var starred = starHit && strokes <= par;
      if (starred) runBonusGems += STARBONUS;
      if (hole >= 12) endCourse(); else showHoleCard(starred);
    }
    function scoreLabel(s, p) {
      var d = s - p;
      if (s === 1) return { t: "⛳ HOLE IN ONE!", c: "#ffd23f", cheer: true };
      if (d <= -2) return { t: "🦅 EAGLE!", c: "#ffd23f", cheer: true };
      if (d === -1) return { t: "🐦 Birdie!", c: "#69f0ae", cheer: true };
      if (d === 0) return { t: "Par", c: "#8ecdf7", cheer: false };
      if (d === 1) return { t: "Bogey", c: "#ffd740", cheer: false };
      if (d === 2) return { t: "Double Bogey", c: "#ff9f43", cheer: false };
      return { t: "+" + d, c: "#ff8a8a", cheer: false };
    }
    function scorecardHTML() {
      var cells = "";
      for (var h = 1; h <= 12; h++) {
        var done = holeStrokes[h] !== undefined;
        cells += '<div style="display:inline-block;min-width:30px;text-align:center;font-size:11px;color:' + (h === hole ? "#2f9e44" : "#5a6b7a") + '">' +
          '<div style="opacity:.6">' + h + "</div>" +
          '<div style="font-weight:900;font-size:14px;color:#26313a">' + (done ? holeStrokes[h] : "–") + "</div>" +
          '<div style="opacity:.5">p' + PARS[h - 1] + "</div></div>";
      }
      return '<div style="white-space:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:92vw;padding:4px 0">' + cells + "</div>";
    }
    function showHoleCard(starred) {
      var lab = scoreLabel(strokes, par);
      if (lab.cheer && sfx && sfx.fanfare) sfx.fanfare();
      if (lab.cheer && juice) juice.shake(6);
      gfcard.innerHTML = '<div class="wqcard" style="text-align:center;max-width:560px">' +
        '<div style="font-size:40px">' + (strokes <= par ? "🏌️" : "⛳") + '</div>' +
        '<div class="wqtitle" style="font-size:22px;color:' + lab.c + '">' + lab.t + "</div>" +
        '<div style="margin:4px 0;font-weight:900">Hole ' + hole + " · " + strokes + " strokes (par " + par + ")</div>" +
        (starred ? '<div style="color:#b06a00;font-weight:900;margin:2px 0">⭐ STAR SINK! +' + STARBONUS + ' Vobux banked</div>' +
          '<button class="submit" id="gfdouble" type="button">⭐ Answer a word to DOUBLE it!</button>' : "") +
        '<div style="margin:8px 0 2px;font-size:12px;color:#5a6b7a">Running card · total ' + relText(totalRel()) + "</div>" +
        scorecardHTML() +
        '<button class="submit big-next" id="gfnext" type="button">Next hole ➜</button></div>';
      gfcard.style.display = "flex";
      document.getElementById("gfnext").onclick = function () { nextHole(); };
      var db = document.getElementById("gfdouble");
      if (db) db.onclick = function () { starDoubleQuiz(); };
    }
    function starDoubleQuiz() {
      if (paused || over) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(gfq, words, store, {
        title: "⭐ DOUBLE BONUS! Answer to double your star Vobux!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) { runBonusGems += STARBONUS; big("⭐ DOUBLED! +" + STARBONUS + " more Vobux!", "#ffd23f"); if (sfx && sfx.fanfare) sfx.fanfare(); }
          else big("So close!", "#ff8a8a");
          var db = document.getElementById("gfdouble"); if (db) db.remove();
        }
      });
    }
    function nextHole() {
      if (over) return;
      gfcard.style.display = "none";
      if (hole < 12) beginHole(hole + 1);
    }

    // ---------- 🎯 MULLIGAN (word-powered stroke undo, once per hole) ----------
    function mulliganQuiz() {
      if (over || sunk || gated || paused || mulliganUsed || strokes <= 0) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(gfq, words, store, {
        title: "🎯 MULLIGAN! Answer a word to take that stroke back!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            mulliganUsed = true;
            ball.x = strokeStartPos.x; ball.y = strokeStartPos.y;
            ball.vx = 0; ball.vy = 0; ball.moving = false;
            strokes = Math.max(0, strokes - 1);
            big("🎯 MULLIGAN! Ball's back, stroke refunded.", "#69f0ae");
            if (sfx && sfx.coin) sfx.coin();
            if (juice) juice.burst(X(ball.x), Y(ball.y), "#69f0ae", 14);
            hud();
          } else big("No do-over this time…", "#ff8a8a");
        }
      });
    }

    // ---------- physics ----------
    function pin(r) { return ball.x >= r.x && ball.x <= r.x + r.w && ball.y >= r.y && ball.y <= r.y + r.h; }
    function anyRect(list) { if (!list) return false; for (var i = 0; i < list.length; i++) if (pin(list[i])) return true; return false; }
    function applyField(list, h) { if (!list) return; for (var i = 0; i < list.length; i++) { if (pin(list[i])) { ball.vx += list[i].ax * h; ball.vy += list[i].ay * h; } } }
    function resolveRect(w) {
      var qx = Math.max(w.x, Math.min(w.x + w.w, ball.x)), qy = Math.max(w.y, Math.min(w.y + w.h, ball.y));
      var dx = ball.x - qx, dy = ball.y - qy, d2 = dx * dx + dy * dy;
      if (d2 >= R * R) return;
      var nx, ny;
      if (d2 > 1e-6) { var d = Math.sqrt(d2); nx = dx / d; ny = dy / d; }
      else {
        var l = ball.x - w.x, rr = w.x + w.w - ball.x, tp = ball.y - w.y, bt = w.y + w.h - ball.y;
        var m = Math.min(l, rr, tp, bt);
        if (m === l) { nx = -1; ny = 0; } else if (m === rr) { nx = 1; ny = 0; } else if (m === tp) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
        qx = ball.x; qy = ball.y;
      }
      ball.x = qx + nx * R; ball.y = qy + ny * R;
      var vd = ball.vx * nx + ball.vy * ny;
      if (vd < 0) { ball.vx -= (1 + REST) * vd * nx; ball.vy -= (1 + REST) * vd * ny; }
    }
    function collideBlade(cx, cy, hx, hy, a) {
      var ca = Math.cos(a), sa = Math.sin(a);
      var rx = ball.x - cx, ry = ball.y - cy;
      var lx = rx * ca + ry * sa, ly = -rx * sa + ry * ca;
      var qx = Math.max(-hx, Math.min(hx, lx)), qy = Math.max(-hy, Math.min(hy, ly));
      var ddx = lx - qx, ddy = ly - qy, d2 = ddx * ddx + ddy * ddy;
      if (d2 >= R * R) return;
      var nlx, nly;
      if (d2 > 1e-6) { var d = Math.sqrt(d2); nlx = ddx / d; nly = ddy / d; }
      else {
        var px = hx - Math.abs(lx), py = hy - Math.abs(ly);
        if (px < py) { nlx = lx < 0 ? -1 : 1; nly = 0; qx = nlx * hx; } else { nlx = 0; nly = ly < 0 ? -1 : 1; qy = nly * hy; }
      }
      var nwx = nlx * ca - nly * sa, nwy = nlx * sa + nly * ca;
      var cwx = cx + qx * ca - qy * sa, cwy = cy + qx * sa + qy * ca;
      ball.x = cwx + nwx * R; ball.y = cwy + nwy * R;
      var vdot = ball.vx * nwx + ball.vy * nwy;
      if (vdot < 0) { ball.vx -= (1 + REST) * vdot * nwx; ball.vy -= (1 + REST) * vdot * nwy; }
    }
    function collideWindmills(h) {
      if (!cur.windmill) return;
      for (var i = 0; i < cur.windmill.length; i++) {
        var wm = cur.windmill[i], a0 = animT * wm.speed;
        collideBlade(wm.x, wm.y, wm.len, wm.w, a0);
        collideBlade(wm.x, wm.y, wm.len, wm.w, a0 + Math.PI / 2);
      }
    }
    function dist(ax, ay, bx, by) { return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)); }
    function waterSplash() {
      ball.x = strokeStartPos.x; ball.y = strokeStartPos.y; ball.vx = 0; ball.vy = 0; ball.moving = false;
      strokes += 1; // +1 penalty stroke
      big("🌊 SPLASH! +1 stroke — back you go.", "#8ecdf7");
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.burst(X(strokeStartPos.x), Y(strokeStartPos.y), "#40c4ff", 16);
      hud();
    }
    // ONE substep of integration — walls resolved so a fast ball never tunnels
    function integrate(h) {
      var sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (sp > 0) {
        var dec = DECEL + (anyRect(cur.sand) ? SAND : 0);
        var nsp = sp - dec * h;
        if (nsp <= STOP) { ball.vx = 0; ball.vy = 0; }
        else { var k = nsp / sp; ball.vx *= k; ball.vy *= k; }
      }
      applyField(cur.boost, h);
      applyField(cur.slope, h);
      sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (sp > MAXSPEED) { var k2 = MAXSPEED / sp; ball.vx *= k2; ball.vy *= k2; }
      ball.x += ball.vx * h; ball.y += ball.vy * h;
      collideWindmills(h);
      if (cur.wall) for (var i = 0; i < cur.wall.length; i++) resolveRect(cur.wall[i]);
      if (ball.x < PX0 + R) { ball.x = PX0 + R; ball.vx = -ball.vx * REST; }
      if (ball.x > PX1 - R) { ball.x = PX1 - R; ball.vx = -ball.vx * REST; }
      if (ball.y < PY0 + R) { ball.y = PY0 + R; ball.vy = -ball.vy * REST; }
      if (ball.y > PY1 - R) { ball.y = PY1 - R; ball.vy = -ball.vy * REST; }
      if (pipeCd > 0) pipeCd -= h;
      else if (cur.pipe) {
        for (var p = 0; p < cur.pipe.length; p++) {
          var pp = cur.pipe[p];
          if (dist(ball.x, ball.y, pp.inx, pp.iny) < pp.r) {
            ball.x = pp.outx; ball.y = pp.outy; pipeCd = 0.28;
            big("🕳 WHOOSH — teleported!", "#c9b6ff");
            if (sfx && sfx.whoosh) sfx.whoosh();
            break;
          }
        }
      }
      if (cur.water) for (var wt = 0; wt < cur.water.length; wt++) { if (pin(cur.water[wt])) { waterSplash(); return; } }
      if (!starHit && cur.star && dist(ball.x, ball.y, cur.star.x, cur.star.y) < cur.star.r) {
        starHit = true; big("⭐ Through the star ring!", "#ffd23f");
        if (juice) juice.burst(X(cur.star.x), Y(cur.star.y), "#ffd23f", 12);
      }
      if (ball.vx === 0 && ball.vy === 0) ball.moving = false;
      var dc = dist(ball.x, ball.y, cur.cup.x, cur.cup.y), spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (dc < CAPR) {
        if (spd < CAPS) { sinkBall(); return; }
        else { ball.vx *= 0.4; ball.vy *= 0.4; } // lip-out: too fast to drop
      }
    }
    function stepPhysics(dt) {
      if (!ball.moving) return;
      var sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      var steps = Math.max(1, Math.ceil(sp * dt / 4));
      var h = dt / steps;
      for (var i = 0; i < steps && ball.moving && !sunk; i++) integrate(h);
    }
    function step(dt) { if (ball.moving) stepPhysics(dt); }

    // ---------- banking (ONE path: course-end, quit, app-close) ----------
    function rewards(won) {
      var rel = totalRel(), under = Math.max(0, -rel);
      return {
        win: !!won,
        score: -rel,
        rankPtsDelta: won ? Math.min(14, 4 + under * 2) : 2,
        xp: Math.min(90, 10 + completed.length * 4 + under * 3),
        gems: 6 + completed.length * 2 + runBonusGems + under * 5
      };
    }
    function bankRun(won) {
      if (banked) return null;
      banked = true;
      var rw = rewards(won);
      var res = store.recordGame ? store.recordGame("golf", rw) : null;
      return { rw: rw, res: res };
    }
    function endCourse() {
      if (over) return;
      over = true; paused = true;
      var rel = totalRel();
      if (stats.bestRelative === undefined || rel < stats.bestRelative) stats.bestRelative = rel;
      store.save();
      var bank = bankRun(rel <= 0) || { rw: rewards(rel <= 0) };
      showEndCard(bank.rw, rel);
    }
    function showEndCard(rw, rel) {
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(7); for (var cf = 0; cf < 5; cf++) juice.burst(W * (0.2 + cf * 0.15), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb"][cf], 16); }
      gfcard.innerHTML = '<div class="wqcard" style="text-align:center;max-width:580px">' +
        '<div style="font-size:44px">🏆⛳</div>' +
        '<div class="wqtitle" style="font-size:22px">Course complete — ' + relText(rel) + " " + (rel <= 0 ? "(at/under par!)" : "to par") + "</div>" +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:6px 0 2px;font-size:12px;color:#5a6b7a">Best-ever: ' + relText(stats.bestRelative) + " to par</div>" +
        scorecardHTML() +
        '<button class="submit big-next" id="gfagain" type="button">Play again ➜</button>' +
        '<button class="wqskip" id="gfleave" type="button">Leave</button></div>';
      gfcard.style.display = "flex";
      document.getElementById("gfagain").onclick = function () { newCourse(); };
      document.getElementById("gfleave").onclick = exit;
    }
    function newCourse() {
      over = false; paused = false; banked = false;
      completed = []; holeStrokes = {}; runBonusGems = 0;
      gfcard.style.display = "none";
      beginHole(1);
    }

    // ---------- input: drag BACK from the ball to aim + putt ----------
    function computeAim() {
      var dx = aim.ox - aim.cx, dy = aim.oy - aim.cy; // vector from drag point back to ball origin
      var len = Math.sqrt(dx * dx + dy * dy);
      var power = Math.min(len, MAXDRAG);
      return { dx: dx, dy: dy, len: len, power: power };
    }
    function pointerDown(sx, sy) {
      if (gated || over || sunk || paused || ball.moving) return;
      var p = toLogical(sx, sy);
      aim.active = true; aim.ox = ball.x; aim.oy = ball.y; aim.cx = p.x; aim.cy = p.y;
    }
    function pointerMove(sx, sy) {
      if (!aim.active) return;
      var p = toLogical(sx, sy); aim.cx = p.x; aim.cy = p.y;
    }
    function pointerUp() {
      if (!aim.active) return;
      aim.active = false;
      var a = computeAim();
      if (a.len < 6 || a.power < 6) return; // a tap is not a putt
      var scale = (a.power / MAXDRAG) * MAXPOWER / (a.len || 1);
      shoot(a.dx * scale, a.dy * scale);
    }
    function pt(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    cv.addEventListener("mousedown", function (e) { var p = pt(e); pointerDown(p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { var p = pt(e); pointerMove(p.x, p.y); });
    cv.addEventListener("mouseup", pointerUp);
    cv.addEventListener("mouseleave", pointerUp);
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); pointerDown(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); pointerMove(p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); pointerUp(); }, { passive: false });

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function fillRectL(r, col) { ctx.fillStyle = col; ctx.fillRect(X(r.x), Y(r.y), pz(r.w), pz(r.h)); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // letterbox surround
      ctx.fillStyle = "#123018"; ctx.fillRect(0, 0, W, H);
      // course green
      ctx.fillStyle = "#3aa356"; rrect(X(PX0), Y(PY0), pz(PX1 - PX0), pz(PY1 - PY0), pz(18)); ctx.fill();
      // mow stripes
      ctx.fillStyle = "rgba(255,255,255,.045)";
      for (var st = 0; st < 8; st++) ctx.fillRect(X(PX0), Y(PY0 + st * 100), pz(PX1 - PX0), pz(50));
      if (!cur) return;
      // slopes (shaded, with a drift arrow)
      if (cur.slope) cur.slope.forEach(function (s) {
        fillRectL(s, "rgba(60,40,90,.18)");
        ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 2;
        var mx = X(s.x + s.w / 2), my = Y(s.y + s.h / 2), dx = s.ax, dy = s.ay, dl = Math.sqrt(dx * dx + dy * dy) || 1;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + dx / dl * pz(26), my + dy / dl * pz(26)); ctx.stroke();
      });
      // sand
      if (cur.sand) cur.sand.forEach(function (s) { fillRectL(s, "#e8d59a"); ctx.fillStyle = "#d8c07a"; ctx.font = pz(20) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🏖", X(s.x + s.w / 2), Y(s.y + s.h / 2)); });
      // water
      if (cur.water) cur.water.forEach(function (s) { fillRectL(s, "#3aa0e0"); ctx.font = pz(22) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🌊", X(s.x + s.w / 2), Y(s.y + s.h / 2)); });
      // boost pads
      if (cur.boost) cur.boost.forEach(function (b) {
        fillRectL(b, "rgba(120,200,255,.35)");
        ctx.font = pz(24) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        var arrow = b.ay < 0 ? "⬆️" : b.ay > 0 ? "⬇️" : b.ax < 0 ? "⬅️" : "➡️";
        var wobble = Math.sin(animT * 6) * pz(4);
        ctx.fillText(arrow, X(b.x + b.w / 2), Y(b.y + b.h / 2) + wobble);
      });
      // walls
      if (cur.wall) cur.wall.forEach(function (w) { fillRectL(w, "#7a5a3a"); ctx.strokeStyle = "#5a4028"; ctx.lineWidth = 2; ctx.strokeRect(X(w.x), Y(w.y), pz(w.w), pz(w.h)); });
      // pipes
      if (cur.pipe) cur.pipe.forEach(function (p) {
        ctx.font = pz(30) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🕳", X(p.inx), Y(p.iny)); ctx.fillText("🕳", X(p.outx), Y(p.outy));
        ctx.strokeStyle = "rgba(200,182,255,.5)"; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X(p.inx), Y(p.iny)); ctx.lineTo(X(p.outx), Y(p.outy)); ctx.stroke(); ctx.setLineDash([]);
      });
      // star ring
      if (cur.star && !starHit) {
        var pulse = 1 + Math.sin(animT * 4) * 0.12;
        ctx.strokeStyle = "rgba(255,210,60," + (0.55 + Math.sin(animT * 4) * 0.25) + ")"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(X(cur.star.x), Y(cur.star.y), pz(cur.star.r) * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.font = pz(18) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("⭐", X(cur.star.x), Y(cur.star.y));
      }
      // windmill blades
      if (cur.windmill) cur.windmill.forEach(function (wm) {
        var a0 = animT * wm.speed;
        ctx.save(); ctx.translate(X(wm.x), Y(wm.y));
        [a0, a0 + Math.PI / 2].forEach(function (a) {
          ctx.save(); ctx.rotate(a);
          ctx.fillStyle = "#c0392b"; ctx.fillRect(-pz(wm.len), -pz(wm.w), pz(wm.len * 2), pz(wm.w * 2));
          ctx.restore();
        });
        ctx.fillStyle = "#ecf0f1"; ctx.beginPath(); ctx.arc(0, 0, pz(wm.w * 1.2), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      // cup + waving flag
      var cx = X(cur.cup.x), cy = Y(cur.cup.y);
      ctx.fillStyle = "#0c1b10"; ctx.beginPath(); ctx.arc(cx, cy, pz(CAPR * 0.7), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#dfe6e9"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - pz(48)); ctx.stroke();
      var fw = Math.sin(animT * 5) * pz(4);
      ctx.fillStyle = "#e74c3c"; ctx.beginPath();
      ctx.moveTo(cx, cy - pz(48)); ctx.lineTo(cx + pz(26) + fw, cy - pz(40)); ctx.lineTo(cx, cy - pz(32)); ctx.closePath(); ctx.fill();
      // ball
      if (!sunk) {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X(ball.x), Y(ball.y), pz(R), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.2)"; ctx.lineWidth = 1; ctx.stroke();
      }
      // aim arrow (direction + power, capped)
      if (aim.active) {
        var a = computeAim();
        if (a.len > 4) {
          var ux = a.dx / a.len, uy = a.dy / a.len, plen = pz(a.power) * 1.1;
          var frac = a.power / MAXDRAG;
          var col = frac > 0.85 ? "#ff5b5b" : frac > 0.5 ? "#ffd23f" : "#69f0ae";
          var bx = X(ball.x), by = Y(ball.y), ex = bx + ux * plen, ey = by + uy * plen;
          ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
          // arrowhead
          var ah = pz(12), ang = Math.atan2(uy, ux);
          ctx.beginPath(); ctx.moveTo(ex, ey);
          ctx.lineTo(ex - ah * Math.cos(ang - 0.5), ey - ah * Math.sin(ang - 0.5));
          ctx.lineTo(ex - ah * Math.cos(ang + 0.5), ey - ah * Math.sin(ang + 0.5));
          ctx.closePath(); ctx.fillStyle = col; ctx.fill();
        }
      }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      animT += dt;
      if (!paused && !over) step(dt);
      draw();
    }
    // deterministic test/demo stepping in <=0.05s substeps
    function tick(seconds) {
      var left = seconds;
      while (left > 0) {
        var d = Math.min(0.05, left);
        animT += d;
        if (!paused && !over) step(d);
        left -= d;
      }
    }

    // ---------- exit / banking ----------
    function bankExit() {
      if (over) return; // course-end already banked
      if (strokes === 0 && completed.length === 0) return; // an untouched round banks nothing
      var b = bankRun(false);
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("⛳ Golf round banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._golf = {
      state: function () {
        return {
          hole: hole, strokes: strokes, par: par, total: totalRel(),
          sunk: sunk, mulliganUsed: mulliganUsed, banked: banked, over: over,
          gated: gated, starHit: starHit, bestRelative: stats.bestRelative,
          bounds: { x0: PX0, y0: PY0, x1: PX1, y1: PY1 },
          water: (cur && cur.water) ? cur.water : [],
          sand: (cur && cur.sand) ? cur.sand : [],
          ball: { x: ball.x, y: ball.y, moving: ball.moving, vx: ball.vx, vy: ball.vy }
        };
      },
      begin: beginHole,
      putt: function (dx, dy) { shoot(dx, dy); },
      place: function (x, y) { ball.x = x; ball.y = y; ball.vx = 0; ball.vy = 0; ball.moving = false; strokeStartPos = { x: x, y: y }; },
      holePos: function () { return { x: cur.cup.x, y: cur.cup.y }; },
      sink: sinkFromClose,
      mulliganQuiz: mulliganQuiz,
      gateQuiz: function (h) { if (h && h !== hole) beginHole(h); openGate(); },
      nextHole: nextHole,
      tick: tick
    };

    // ---------- boot ----------
    beginHole(1);
    if (global._golfdemo) { // screenshot seed: paused hole 5, mid-aim, windmill turning
      global._golfdemo = 0;
      beginHole(5);
      // pretend two holes already played, 2 under par
      holeStrokes[1] = PARS[0] - 1; completed.push(1);
      holeStrokes[2] = PARS[1] - 1; completed.push(2);
      // mid-drag aim arrow: pulled back and down for an uphill putt
      ball.x = 280; ball.y = 640;
      aim.active = true; aim.ox = ball.x; aim.oy = ball.y; aim.cx = ball.x + 10; aim.cy = ball.y + 150;
      starHit = false; paused = true; hud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxGolf = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
