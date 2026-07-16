/*
 * Voblox mini-game — 🏭 WORD FACTORY (a kid-friendly conveyor automation tycoon).
 * A fixed 8×6 tile factory floor, letterboxed to fit any orientation. ORE SPAWNERS
 * on the left drip raw blobs 🟤; the SELL DOCK 🚚 on the right pays factory-gold for
 * whatever rides off the edge. Leo BUILDS the route: ➡️ conveyors carry items, 🔥
 * smelters turn blobs → ingots, 🔨 pressers ingots → gears, ✨ polishers gears →
 * gizmos. Machines auto-process; the joy is designing a line that runs itself.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT (park.js/books.js pattern):
 *   - 🧾 BLUEPRINTS: the smelter is free from the start, but the 🔨 presser and ✨
 *     polisher are word-gated PERMITS — answer a word (miniQuiz) to unlock the
 *     blueprint. Unlocks persist in stats across sessions.
 *   - ⚡ OVERDRIVE: answer a word → 20s of DOUBLE conveyor + machine speed, then a
 *     30s cooldown before it can charge again.
 *
 * SESSION-only economy (a hard rule from Au): the run's Vobux payout scales with the
 * gold EARNED this window (items sold), not the factory's stored wealth. bankRun()
 * fires on 💰 Cash out, on quit, and on tab-close, and always SHOWS the payout card.
 * The LAYOUT + gold persist via stats.factorySave, so returning resumes your factory.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  var COLS = 8, ROWS = 6, TILE = 100;      // one logical space, letterboxed
  var MW = COLS * TILE, MH = ROWS * TILE;
  var START_GOLD = 100;
  var ITEM_CAP = 80;                        // perf ceiling on live items
  var BELT_CROSS = 0.5;                     // seconds to cross one belt tile
  var SPAWN_ROWS = [1, 3, 4];              // left-edge ore spawners (col 0)
  var SPAWN_INTERVAL = 2.6;                 // deterministic drip cadence (fixed)
  var OVERDRIVE_T = 20, OVERDRIVE_CD = 30;  // ⚡ active seconds / cooldown seconds

  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // 0→ 1↓ 2← 3↑
  var ARROWS = ["➡️", "⬇️", "⬅️", "⬆️"];

  var COST = { belt: 5, smelter: 40, presser: 120, polisher: 300 };
  var MACH = { smelter: 1, presser: 1, polisher: 1 };            // machine tile types
  var INPUT = { smelter: "blob", presser: "ingot", polisher: "gear" };
  var OUTPUT = { smelter: "ingot", presser: "gear", polisher: "gizmo" };
  var PROC = { smelter: 2, presser: 3, polisher: 4 };            // process seconds
  var MEMOJI = { belt: "➡️", smelter: "🔥", presser: "🔨", polisher: "✨" };
  var VALUE = { blob: 1, ingot: 4, gear: 12, gizmo: 30 };        // dock payout
  var IEMOJI = { blob: "🟤", ingot: "🟨", gear: "⚙️", gizmo: "💎" };

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("factory");
    stats.bestGold = stats.bestGold || 0;   // additive fields, never stats.best
    var save = stats.factorySave || null;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap factory";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="fccv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="fcmsg">🏭 Word Factory</div>' +
      '<div class="grow" style="flex-wrap:wrap"><span id="fcgold">🪙 0</span><span id="fcinfo"></span>' +
      '<button class="replay" id="fcover" type="button">⚡ Overdrive</button>' +
      '<button class="replay" id="fccash" type="button">💰 Cash out</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="fcbig"></div>' +
      '<div class="gover" id="fcq" style="display:none"></div>' +
      '<div class="gover" id="fccard" style="display:none"></div>' +
      '<div id="fcbar" style="position:absolute;left:0;right:0;bottom:0;z-index:6;display:flex;' +
      'gap:6px;justify-content:center;flex-wrap:wrap;padding:6px 6px calc(env(safe-area-inset-bottom) + 6px);' +
      'pointer-events:auto"></div>';
    document.body.appendChild(wrap);
    // compact, wrap-safe HUD chips so the row FITS 393px (Leave never clips) — digger pattern
    (function () {
      var gr = wrap.querySelector(".ghud .grow"); if (!gr) return;
      gr.style.flexWrap = "wrap"; gr.style.gap = "6px";
      Array.prototype.forEach.call(gr.children, function (el) {
        el.style.flexShrink = "0"; el.style.whiteSpace = "nowrap";
        if (el.tagName === "SPAN") { el.style.fontSize = "14px"; el.style.padding = "4px 8px"; }
      });
    })();

    var cv = wrap.querySelector("#fccv"), ctx = cv.getContext("2d");
    var msgEl = document.getElementById("fcmsg"), bigEl = document.getElementById("fcbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- responsive letterbox (dungeon.js-style X/Y helpers) ----------
    var ghudEl = wrap.querySelector(".ghud"), barEl = wrap.querySelector("#fcbar");
    var W, H, S, OX, OY;
    var DPR = Math.min(global.devicePixelRatio || 1, 2); // retina sharpen; game code stays in CSS px
    function resize() {
      W = wrap.clientWidth || global.innerWidth || 360;
      H = wrap.clientHeight || global.innerHeight || 640;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      // keep the floor below the HUD (Dynamic Island via env safe-top) and above the
      // build bar (which clears the home indicator via env safe-bottom)
      var safeT = 0, safeB = 0;
      try { safeT = Math.max(0, (parseFloat(getComputedStyle(ghudEl).paddingTop) || 10) - 10); } catch (_) { safeT = 0; }
      try { safeB = Math.max(0, (parseFloat(getComputedStyle(barEl).paddingBottom) || 6) - 6); } catch (_) { safeB = 0; }
      var top = 64 + safeT, bot = 78 + safeB;       // HUD up top, build bar below
      S = Math.min((W - 16) / MW, (H - top - bot) / MH);
      if (!(S > 0)) S = 0.1;
      OX = (W - MW * S) / 2;
      OY = top + (H - top - bot - MH * S) / 2;
    }
    resize(); window.addEventListener("resize", resize);
    function X(x) { return OX + x * S; }
    function Y(y) { return OY + y * S; }
    function pz(n) { return n * S; }
    function tileCX(c) { return (c + 0.5) * TILE; }   // logical tile center
    function tileCY(r) { return (r + 0.5) * TILE; }

    // ---------- factory state ----------
    var running = true, raf = 0, lastT = performance.now();
    var grid = [];                                   // grid[c][r] = {type,dir} | null
    for (var gc = 0; gc < COLS; gc++) { grid.push([]); for (var gr = 0; gr < ROWS; gr++) grid[gc].push(null); }
    var items = [];                                  // {c,r,kind,prog,processed}
    var floats = [];                                 // "+N" sold-gold texts
    var gold = START_GOLD;
    var earned = 0;                                  // gold EARNED this banking window
    var unlocks = { presser: false, polisher: false };
    var overdriveT = 0, overCd = 0;                  // ⚡ active / cooldown remaining
    var spawnT = SPAWN_ROWS.map(function (r, i) { return 1 + i * 0.7; }); // staggered drip
    var selected = "belt";
    var banked = false, paused = false, lastFmt = null;

    // restore a saved factory (layout + gold + unlocks) so returning resumes it
    if (save) {
      if (typeof save.gold === "number") gold = save.gold;
      if (save.unlocks) { unlocks.presser = !!save.unlocks.presser; unlocks.polisher = !!save.unlocks.polisher; }
      if (save.grid) save.grid.forEach(function (g) {
        if (g && inGrid(g.c, g.r)) grid[g.c][g.r] = { type: g.type, dir: g.dir || 0 };
      });
    }

    function inGrid(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
    function keyOf(c, r) { return c + "_" + r; }
    function isMachine(t) { return t && MACH[t]; }
    function builtCount() { var n = 0; for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) if (grid[c][r]) n++; return n; }
    function itemAt(c, r) { for (var i = 0; i < items.length; i++) if (items[i].c === c && items[i].r === r) return items[i]; return null; }

    // ---------- persistence (additive, never stats.best) ----------
    function persist() {
      var gs = [];
      for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) if (grid[c][r]) gs.push({ c: c, r: r, type: grid[c][r].type, dir: grid[c][r].dir });
      stats.factorySave = { grid: gs, gold: gold, unlocks: { presser: unlocks.presser, polisher: unlocks.polisher } };
      store.save();
    }

    // ---------- HUD ----------
    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1200);
    }
    function hud() {
      document.getElementById("fcgold").textContent = "🪙 " + Math.floor(gold);
      var info = "";
      if (overdriveT > 0) info = "⚡×2 " + Math.ceil(overdriveT) + "s";
      else if (overCd > 0) info = "⚡ cooldown " + Math.ceil(overCd) + "s";
      document.getElementById("fcinfo").textContent = info;
      var ob = document.getElementById("fcover");
      if (ob) ob.style.opacity = overdriveT > 0 || overCd > 0 ? "0.55" : "1";
    }

    // ---------- building (the REAL path — checks unlock + gold, returns bool) ----------
    function locked(type) { return (type === "presser" && !unlocks.presser) || (type === "polisher" && !unlocks.polisher); }
    function rawPlace(c, r, type, dir) { grid[c][r] = { type: type, dir: dir || 0 }; }
    function buyBuild(c, r, type) {
      if (!inGrid(c, r) || grid[c][r]) return false;
      if (!COST[type]) return false;
      if (locked(type)) { big("🔒 Answer a word to unlock the " + type + " blueprint!", "#ffd740"); return false; }
      if (gold < COST[type]) { big("Not enough 🪙 gold for a " + type + "!", "#ffd740"); return false; }
      gold -= COST[type];
      rawPlace(c, r, type, 0);
      if (juice) juice.burst(X(tileCX(c)), Y(tileCY(r)), "#ffd23f", 12);
      if (sfx && sfx.pop) sfx.pop();
      persist(); hud();
      return true;
    }
    function rotate(c, r) {
      var g = grid[c][r]; if (!g) return;
      g.dir = (g.dir + 1) % 4;
      if (sfx && sfx.click) sfx.click();
      persist();
    }
    function demolish(c, r) {
      var g = grid[c][r]; if (!g) return;
      var back = Math.floor((COST[g.type] || 0) * 0.5);   // 50% refund
      gold += back; grid[c][r] = null;
      for (var i = items.length - 1; i >= 0; i--) if (items[i].c === c && items[i].r === r) items.splice(i, 1);
      if (juice) juice.burst(X(tileCX(c)), Y(tileCY(r)), "#cfd6dd", 12);
      if (sfx && sfx.whoosh) sfx.whoosh();
      big("🧹 Demolished — +" + back + " 🪙 back", "#8ecdf7");
      persist(); hud();
    }

    // ---------- items ----------
    function addItem(c, r, kind) {
      if (items.length >= ITEM_CAP) return false;
      items.push({ c: c, r: r, kind: kind, prog: 0, processed: false });
      return true;
    }
    function sell(it) {
      var v = VALUE[it.kind] || 0;
      gold += v; earned += v;
      floats.push({ c: COLS - 0.2, r: it.r, t: 1.1, n: v });
      if (sfx && sfx.coin && Math.random() < 0.5) sfx.coin();
      hud();
    }
    // will tile (nc,nr) accept an item of this kind arriving from a belt/machine?
    function canAccept(nc, nr, kind) {
      if (nc >= COLS) return true;                 // off the RIGHT edge = the sell dock
      if (!inGrid(nc, nr)) return false;
      var g = grid[nc][nr];
      if (!g) return false;                        // never push onto empty floor — item waits
      if (g.type === "belt") return true;
      if (isMachine(g.type)) return kind === INPUT[g.type];
      return false;
    }

    // ---------- the simulation step (dt-driven; NO wall-clock) ----------
    function spawnStep(dt) {
      for (var i = 0; i < SPAWN_ROWS.length; i++) {
        spawnT[i] -= dt;
        if (spawnT[i] <= 0) {
          spawnT[i] += SPAWN_INTERVAL;
          var r = SPAWN_ROWS[i];
          if (!itemAt(0, r) && items.length < ITEM_CAP) addItem(0, r, "blob");
        }
      }
    }
    function moveItems(dt, spd) {
      var occ = {}, i;
      for (i = 0; i < items.length; i++) occ[keyOf(items[i].c, items[i].r)] = 1;
      for (i = items.length - 1; i >= 0; i--) {
        var it = items[i], g = grid[it.c][it.r];
        // machines eat a matching item, then push the OUTPUT along their arrow
        if (g && isMachine(g.type) && !it.processed && it.kind === INPUT[g.type]) {
          it.prog += dt * spd;
          if (it.prog >= PROC[g.type]) { it.kind = OUTPUT[g.type]; it.processed = true; it.prog = 0; }
          continue;
        }
        // pushing phase: belts and finished-machine outputs ride the arrow
        var dir = g ? g.dir : -1;
        if (dir < 0) { continue; }                 // on empty floor: WAIT (never crash)
        it.prog += dt * spd;
        if (it.prog < BELT_CROSS) continue;
        var nc = it.c + DIRS[dir][0], nr = it.r + DIRS[dir][1];
        if (nc >= COLS) { sell(it); items.splice(i, 1); delete occ[keyOf(it.c, it.r)]; continue; }
        if (!canAccept(nc, nr, it.kind) || occ[keyOf(nc, nr)]) { it.prog = BELT_CROSS; continue; } // dead-end / busy → wait
        delete occ[keyOf(it.c, it.r)];
        it.c = nc; it.r = nr; it.prog = 0; it.processed = false;
        occ[keyOf(nc, nr)] = 1;
      }
    }
    function step(dt) {
      var spd = overdriveT > 0 ? 2 : 1;
      if (overdriveT > 0) { overdriveT -= dt; if (overdriveT <= 0) { overdriveT = 0; overCd = OVERDRIVE_CD; } }
      else if (overCd > 0) { overCd -= dt; if (overCd < 0) overCd = 0; }
      spawnStep(dt);
      moveItems(dt, spd);
      for (var f = floats.length - 1; f >= 0; f--) { floats[f].t -= dt; floats[f].r -= 0.6 * dt; if (floats[f].t <= 0) floats.splice(f, 1); }
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, rr) { ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath(); }
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // buffer is retina; all drawing stays in CSS px
      ctx.clearRect(0, 0, W, H);
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#3a4453"); bg.addColorStop(1, "#232a35");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // factory floor panel
      ctx.fillStyle = "#4a5568"; rrect(X(-8), Y(-8), pz(MW + 16), pz(MH + 16), pz(14)); ctx.fill();
      // tile grid
      var c, r;
      for (c = 0; c < COLS; c++) for (r = 0; r < ROWS; r++) {
        var px = X(c * TILE), py = Y(r * TILE), tw = pz(TILE);
        ctx.fillStyle = (c + r) % 2 ? "#556072" : "#5c687c";
        rrect(px + pz(3), py + pz(3), tw - pz(6), tw - pz(6), pz(8)); ctx.fill();
      }
      // spawners (left) + dock (right)
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = Math.round(pz(46)) + "px serif";
      for (var si = 0; si < SPAWN_ROWS.length; si++) ctx.fillText("⛰️", X(-46), Y(tileCY(SPAWN_ROWS[si])));
      ctx.fillText("🚚", X(MW + 44), Y(MH / 2));
      // machines + belt arrows
      for (c = 0; c < COLS; c++) for (r = 0; r < ROWS; r++) {
        var gg = grid[c][r]; if (!gg) continue;
        var cx = X(tileCX(c)), cy = Y(tileCY(r));
        if (gg.type === "belt") { ctx.font = Math.round(pz(40)) + "px serif"; ctx.fillText(ARROWS[gg.dir], cx, cy); }
        else {
          ctx.font = Math.round(pz(52)) + "px serif"; ctx.fillText(MEMOJI[gg.type], cx, cy);
          ctx.font = Math.round(pz(20)) + "px serif"; ctx.fillText(ARROWS[gg.dir], cx + pz(30), cy + pz(30));
        }
      }
      // items (interpolated along their belt/exit for a smooth ride)
      ctx.font = Math.round(pz(34)) + "px serif";
      items.forEach(function (it) {
        var g = grid[it.c][it.r], ox = 0, oy = 0;
        if (g && !(isMachine(g.type) && !it.processed)) {
          var f = Math.min(1, it.prog / BELT_CROSS);
          ox = DIRS[g.dir][0] * f * TILE * 0.5; oy = DIRS[g.dir][1] * f * TILE * 0.5;
        }
        ctx.fillText(IEMOJI[it.kind] || "❔", X(tileCX(it.c) + ox), Y(tileCY(it.r) + oy));
      });
      // floaty "+N" sold texts
      floats.forEach(function (fl) {
        ctx.globalAlpha = Math.max(0, Math.min(1, fl.t));
        ctx.font = "bold " + Math.round(pz(20)) + "px Trebuchet MS"; ctx.fillStyle = "#ffd23f";
        ctx.fillText("+" + fl.n + " 🪙", X(tileCX(fl.c)), Y(tileCY(fl.r)));
        ctx.globalAlpha = 1;
      });
      if (overdriveT > 0) { ctx.fillStyle = "rgba(255,210,63,.14)"; ctx.fillRect(0, 0, W, H); }
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- build bar (DOM, reuses .embtn/.ebl/.ebs) ----------
    var tools = [
      { k: "belt", e: "➡️", n: "Conveyor" },
      { k: "smelter", e: "🔥", n: "Smelter" },
      { k: "presser", e: "🔨", n: "Presser" },
      { k: "polisher", e: "✨", n: "Polisher" },
      { k: "broom", e: "🧹", n: "Demolish" }
    ];
    function renderBar() {
      var bar = document.getElementById("fcbar");
      bar.innerHTML = tools.map(function (t) {
        var lockTag = (t.k === "presser" || t.k === "polisher") && locked(t.k);
        var label = t.k === "broom" ? "½ back" : (COST[t.k] + " 🪙" + (lockTag ? " 🔒" : ""));
        return '<button class="embtn' + (selected === t.k ? " mode" : "") + '" style="min-width:78px" data-tool="' + t.k + '">' +
          '<span class="ebl">' + t.e + " " + label + '</span><span class="ebs">' + t.n + (lockTag ? " · permit" : "") + "</span></button>";
      }).join("");
      Array.prototype.forEach.call(bar.querySelectorAll("[data-tool]"), function (b) {
        b.onclick = function () {
          var k = b.dataset.tool;
          if ((k === "presser" || k === "polisher") && locked(k)) { openPermit(k); return; }
          selected = selected === k ? "belt" : k;
          renderBar();
        };
      });
    }

    // ---------- 🧾 permit quiz + ⚡ overdrive quiz (the learning hooks) ----------
    function openPermit(which) {
      if (paused || unlocks[which]) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("fcq"), words, store, {
        title: "🧾 Blueprint permit! Answer to unlock the " + which + "!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            unlocks[which] = true;
            big("🧾 PERMIT GRANTED! " + MEMOJI[which] + " " + which + " blueprint unlocked!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.burst(W / 2, H / 2, "#ffd23f", 20);
            persist();
          } else big("🧾 Permit denied — try again any time!", "#ff8a8a");
          hud(); renderBar();
        }
      });
    }
    function openOverdrive() {
      if (paused) return;
      if (overdriveT > 0 || overCd > 0) { big("⚡ Overdrive is " + (overdriveT > 0 ? "already running!" : "cooling down!"), "#ffd740"); return; }
      paused = true;
      cv._lastQ = VQ.miniQuiz(document.getElementById("fcq"), words, store, {
        title: "⚡ OVERDRIVE! Answer to DOUBLE all speeds for 20s!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok && overdriveT <= 0 && overCd <= 0) {
            overdriveT = OVERDRIVE_T;
            big("⚡ OVERDRIVE! Belts & machines ×2 for 20s!", "#69f0ae");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.shake(6);
          } else if (!ok) big("⚡ Fizzled — study up and try again!", "#ff8a8a");
          hud();
        }
      });
    }

    // ---------- the economy: bank the run, SHOW the payout (park.js pattern) ----------
    function runRewards() {
      var unlockBonus = (unlocks.presser ? 6 : 0) + (unlocks.polisher ? 6 : 0);
      var gems = Math.min(70, Math.round(5 + earned / 40 + unlockBonus));
      return {
        win: true,
        score: Math.round(earned),
        rankPtsDelta: Math.min(10, 2 + Math.floor(earned / 200)),
        xp: Math.min(70, Math.round(8 + earned / 30 + unlockBonus)),
        gems: gems
      };
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      if (earned > (stats.bestGold || 0)) { stats.bestGold = Math.round(earned); }
      var rw = runRewards();
      var res = store.recordGame ? store.recordGame("factory", rw) : null;
      persist();
      return { rw: rw, res: res };
    }
    // 💰 Cash out: bank + SHOW the card so Leo SEES his Vobux, then Keep Building
    function cashOut() {
      var bank = bankRun();
      if (!bank) return;
      var rw = bank.rw, res = bank.res;
      paused = true;
      var end = document.getElementById("fccard");
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:420px">' +
        '<div style="font-size:44px">💰🏭</div>' +
        '<div class="wqtitle" style="font-size:20px">Factory payout!</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + " XP</div>" +
        '<div style="margin:2px 0;font-size:13px;color:#5a6b7a">🪙 ' + Math.round(earned) + ' gold shipped this run · best cash-out ' + (stats.bestGold || 0) + (res && res.rankedUp ? "<br>🎖 RANK UP!" : "") + "</div>" +
        '<button class="submit big-next" id="fc_keep">Keep building ➜</button>' +
        '<br><button class="wqskip" id="fc_leave" type="button">Leave the factory</button></div>';
      end.style.display = "flex";
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(5); for (var cf = 0; cf < 4; cf++) juice.burst(W * (0.25 + cf * 0.18), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b"][cf], 14); }
      document.getElementById("fc_keep").onclick = keepBuilding;
      document.getElementById("fc_leave").onclick = exit;
    }
    // Keep Building: fresh banking window — the NEXT stretch of earnings can bank again
    function keepBuilding() {
      var end = document.getElementById("fccard");
      end.style.display = "none"; end.innerHTML = "";
      banked = false; earned = 0; paused = false;
      hud();
    }

    // ---------- input (single-fire discrete taps, phantom-tap safe) ----------
    function tileFromScreen(sx, sy) {
      var c = Math.floor((sx - OX) / (TILE * S)), r = Math.floor((sy - OY) / (TILE * S));
      if (!inGrid(c, r)) return null;
      return { c: c, r: r };
    }
    function tap(sx, sy) {
      if (paused) return;
      var t = tileFromScreen(sx, sy); if (!t) return;
      if (selected === "broom") { demolish(t.c, t.r); return; }
      if (grid[t.c][t.r]) { rotate(t.c, t.r); return; }   // tap a built tile → rotate its arrow
      buyBuild(t.c, t.r, selected);
    }
    cv.addEventListener("touchstart", function (e) {
      e.preventDefault();
      var rc = cv.getBoundingClientRect();
      tap(e.changedTouches[0].clientX - rc.left, e.changedTouches[0].clientY - rc.top);
    }, { passive: false });
    cv.addEventListener("mousedown", function (e) {
      var rc = cv.getBoundingClientRect();
      tap(e.clientX - rc.left, e.clientY - rc.top);
    });

    document.getElementById("fcover").onclick = openOverdrive;
    document.getElementById("fccash").onclick = cashOut;

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;   // clamp, no Date.now logic
      if (!paused) step(dt);
      draw();
    }

    // ---------- exit / banking on close ----------
    function bankExit() {
      if (earned <= 0) return;                    // nothing worth banking
      var bank = bankRun();
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) {
        global.VobloxSfx.toast("🏭 Factory run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
      }
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      persist();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test hook ----------
    cv._factory = {
      state: function () {
        return {
          gold: gold, earned: earned, banked: banked,
          items: items.length,
          unlocks: { presser: unlocks.presser, polisher: unlocks.polisher },
          overdriveT: overdriveT, grid: builtCount(), bestGold: stats.bestGold || 0
        };
      },
      begin: function () {
        // fresh deterministic run (keeps persisted unlocks/bestGold)
        for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) grid[c][r] = null;
        items = []; floats = []; gold = START_GOLD; earned = 0;
        overdriveT = 0; overCd = 0; banked = false; paused = false;
        spawnT = SPAWN_ROWS.map(function (rr, i) { return 1 + i * 0.7; });
        hud(); renderBar();
      },
      tick: function (s) { var left = s; while (left > 1e-9) { var d = Math.min(0.05, left); step(d); left -= d; } }, // <=0.05s substeps
      build: function (c, r, type) { return buyBuild(c, r, type); },   // real path, returns bool
      rotate: function (c, r) { rotate(c, r); },
      demolish: function (c, r) { demolish(c, r); },
      give: function (n) { gold += n; hud(); },
      spawnItem: function (c, r, kind) { return addItem(c, r, kind); },
      permitQuiz: function (which) { openPermit(which); },
      overdriveQuiz: function () { openOverdrive(); },
      cashOut: cashOut,
      keepBuilding: keepBuilding
    };

    renderBar(); hud();
    big("🏭 Build belts, smelt ore, ship it — spell for 🧾 permits & ⚡ overdrive!", "#ffe14d");

    // guarded demo hook: seed a lively mid-game factory (paused) so a glance shows it alive
    if (global._factorydemo) setTimeout(function () {
      global._factorydemo = 0;
      unlocks.presser = true;
      gold = 260;
      // a spawner→dock line on row 3: belt, smelter, belt, presser, belts to the dock
      rawPlace(0, 3, "belt", 0); rawPlace(1, 3, "smelter", 0); rawPlace(2, 3, "belt", 0);
      rawPlace(3, 3, "presser", 0); rawPlace(4, 3, "belt", 0); rawPlace(5, 3, "belt", 0);
      rawPlace(6, 3, "belt", 0); rawPlace(7, 3, "belt", 0);
      addItem(0, 3, "blob"); addItem(2, 3, "ingot"); addItem(4, 3, "gear");
      addItem(5, 3, "gear"); addItem(7, 3, "gear");
      overdriveT = OVERDRIVE_T; paused = true;
      hud(); renderBar(); draw();
    }, 500);

    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxFactory = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
