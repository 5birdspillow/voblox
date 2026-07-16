/*
 * Voblox arcade game — 🔷 Merge Forge (a Merge-Dragons-lite evolution board).
 * A 6×7 board of gems you fuse two-of-a-kind → one of the next tier, all the way
 * to the 🌌 INFINITY GEM. The catch that makes it a VOBLOX game: the ONLY way to
 * get new pieces is to answer a word — the spawner IS the quiz. Correct = 3 new
 * pieces (biased low), wrong = 1 tier-1 (teaching, never punishing).
 * THE COLLECTOR HOOK is the Forge-Dex (like Fishing's Fishdex): the first time
 * each tier is CREATED you get a "🆕 NEW DISCOVERY!" card, and a 📖 dex overlay
 * tracks all ten with silhouettes for the ones you haven't forged yet.
 * recordGame("merge") banks Vobux once per run — on board-full, on quit, and even
 * on tab-close (Au: Leo must SEE the Vobux he earned; nothing invisible, nothing lost).
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // logical board (fixed) — taller than wide, so PORTRAIT is the hero orientation
  var COLS = 6, ROWS = 7, N = COLS * ROWS;
  var BW = 600, BH = 700; // logical board pixels; letterboxed uniformly to the screen

  // 10 tiers. tier 10 is the glorious cap (can't merge past it).
  var TIERS = [
    { id: 1, name: "Pebble", emoji: "🪨" },
    { id: 2, name: "Shiny Stone", emoji: "💠" },
    { id: 3, name: "Ember Core", emoji: "🔥" },
    { id: 4, name: "Frost Orb", emoji: "❄️" },
    { id: 5, name: "Storm Crystal", emoji: "⚡" },
    { id: 6, name: "Life Bloom", emoji: "🌸" },
    { id: 7, name: "Star Shard", emoji: "⭐" },
    { id: 8, name: "Moon Relic", emoji: "🌙" },
    { id: 9, name: "Sun Idol", emoji: "☀️" },
    { id: 10, name: "INFINITY GEM", emoji: "🌌" }
  ];
  function T(tier) { return TIERS[tier - 1]; } // tier is 1-based; array is 0-based

  // one short, fun flavor line per tier for the NEW DISCOVERY card
  var FLAVOR = {
    1: "Just a rock. But it's YOUR rock, and it dreams big.",
    2: "Rub two pebbles together and — poof — a little shine!",
    3: "Warm to the touch. Do not put it in your pocket.",
    4: "So cold it squeaks. The Ember Core is very jealous.",
    5: "Crackle! It hums when a storm is coming (always).",
    6: "A flower that grew from a thunderstorm. Science!",
    7: "A chip off a real star. Still a little bit warm.",
    8: "Older than the moon it's named after. Somehow.",
    9: "Bright enough to need sunglasses indoors. Wow.",
    10: "🌌 THE INFINITY GEM. The whole universe fits inside. You made it!"
  };

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("merge");
    // additive persistent fields only — never collide with the platform's stats.best
    if (!stats.dex) stats.dex = {};       // { tierId: 1 } — discovered tiers
    if (!stats.made) stats.made = {};     // { tierId: count } — lifetime "times made"
    stats.bestTier = stats.bestTier || 0; // highest tier ever reached
    stats.bestScore = stats.bestScore || 0;

    var wrap = document.createElement("div"); wrap.className = "gamewrap merge";
    wrap.innerHTML =
      '<canvas id="mgcv"></canvas>' +
      '<i id="mgsafeb" style="position:absolute;left:0;width:1px;height:1px;opacity:0;pointer-events:none;bottom:calc(env(safe-area-inset-bottom,0px) + 24px)"></i>' +
      '<div class="ghud"><div class="clue" id="mgmsg">🔷 Merge Forge</div>' +
      '<div class="grow"><span id="mgscore">✨ 0</span>' +
      '<button class="replay" id="mgforge" type="button" title="Forge pieces">🔤 FORGE PIECES</button>' +
      '<button class="replay" id="mgdex" type="button" title="Forge-Dex">📖</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="mgbig"></div>' +
      '<div class="gover" id="mgq" style="display:none"></div>' +
      '<div class="gover" id="mgend" style="display:none"></div>';
    document.body.appendChild(wrap);
    var cv = wrap.querySelector("#mgcv"), ctx = cv.getContext("2d");
    // The shared .gamewrap has padding (env safe-area insets + 12-16px). An in-flow canvas
    // sits INSIDE that padding and overflows the viewport, clipping the rightmost board
    // column under a scrollbar on iPhone. Take the canvas out of flow (like every other
    // canvas game does in CSS) so it fills the whole wrap and nothing can scroll.
    cv.style.position = "absolute"; cv.style.left = "0"; cv.style.top = "0"; cv.style.display = "block";
    var ghudEl = wrap.querySelector(".ghud");          // top HUD (its padding clears the Dynamic Island)
    var safeProbe = wrap.querySelector("#mgsafeb");     // probes env(safe-area-inset-bottom)

    // touch targets: HUD action buttons default to ~25px tall (.replay 13px). Bump to >=44px.
    (function () {
      var f = wrap.querySelector("#mgforge"); if (f) { f.style.minHeight = "44px"; f.style.fontSize = "14px"; f.style.padding = "4px 12px"; }
      var d = wrap.querySelector("#mgdex"); if (d) { d.style.minWidth = "44px"; d.style.minHeight = "44px"; d.style.fontSize = "20px"; d.style.lineHeight = "1"; }
      var q = wrap.querySelector("#quit"); if (q) { q.style.minHeight = "44px"; q.style.marginTop = "0"; q.style.padding = "6px 14px"; }
    })();

    // ---------- responsive letterbox: ONE logical board, both orientations ----------
    var W, H, S, OX, OY, CELL, DPR = 1;
    function resize() {
      var cssW = wrap.clientWidth, cssH = wrap.clientHeight;
      W = cssW; H = cssH;
      // retina: back the canvas with up to 2x device pixels; ALL game math stays in CSS px.
      DPR = Math.min(global.devicePixelRatio || 1, 2);
      cv.style.width = cssW + "px"; cv.style.height = cssH + "px";
      cv.width = Math.round(cssW * DPR); cv.height = Math.round(cssH * DPR);
      // portrait fits width, landscape fits height; center the leftover — uniform scale.
      // reserveTop = the ACTUAL HUD height (its top padding already includes
      // env(safe-area-inset-top), so it clears the Dynamic Island); reserveBot = the
      // home-indicator inset. The board is centered INSIDE this safe band — never clipped.
      var reserveTop = (ghudEl ? ghudEl.offsetHeight : 66) + 6;
      var safeB = safeProbe ? Math.max(0, (parseFloat(getComputedStyle(safeProbe).bottom) || 24) - 24) : 0;
      var reserveBot = safeB + 10;
      var availH = Math.max(10, H - reserveTop - reserveBot);
      S = Math.min(W / BW, availH / BH);
      OX = (W - BW * S) / 2;
      OY = reserveTop + (availH - BH * S) / 2;
      CELL = BW / COLS; // logical cell size (square-ish; board region is BW x BH)
    }
    resize(); window.addEventListener("resize", resize);
    // logical board point → screen point
    function SX(x) { return OX + x * S; }
    function SY(y) { return OY + y * S; }
    function cellX(c) { return c * CELL + CELL / 2; }
    function cellY(r) { return r * (BH / ROWS) + (BH / ROWS) / 2; }

    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var running = true, raf = 0, lastT = performance.now(), run = 0;
    var grid = new Array(N);        // tier | null, indexed 0..N-1 (row-major)
    for (var g0 = 0; g0 < N; g0++) grid[g0] = null;
    var score = 0, sel = null, over = false, banked = false, cd = 0, endShown = false;
    var bursts = [];                // {c, r, born} merge/celebration juice markers
    var lastFmt = null;

    var msgEl = document.getElementById("mgmsg"), bigEl = document.getElementById("mgbig");
    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1200); }
    function hud() { document.getElementById("mgscore").textContent = "✨ " + score + (highestOnBoard() ? "   " + T(highestOnBoard()).emoji : ""); }
    function highestOnBoard() { var h = 0; for (var i = 0; i < N; i++) if (grid[i] && grid[i] > h) h = grid[i]; return h; }
    function emptyCells() { var out = []; for (var i = 0; i < N; i++) if (grid[i] === null) out.push(i); return out; }

    // ---------- discovery / dex ----------
    // record a tier being CREATED: bump "times made", and on the FIRST ever make of
    // that tier, fire the collector reveal (this is the hook Leo plays for).
    function recordMake(tier) {
      stats.made[tier] = (stats.made[tier] || 0) + 1;
      if (tier > stats.bestTier) stats.bestTier = tier;
      var isNew = !stats.dex[tier];
      if (isNew) stats.dex[tier] = 1;
      store.save();
      if (isNew) showDiscovery(tier);
    }
    function showDiscovery(tier) {
      var d = T(tier);
      var end = document.getElementById("mgend");
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:360px"><div class="wqtitle">🆕 NEW DISCOVERY!</div>' +
        '<div style="font-size:64px;line-height:1.1">' + d.emoji + '</div>' +
        '<div style="font-weight:900;font-size:22px;color:#20303a">' + VQ.esc(d.name) + '</div>' +
        '<div style="font-style:italic;color:#5a6b7a;margin:6px 10px">"' + VQ.esc(FLAVOR[tier] || "A mysterious new gem!") + '"</div>' +
        '<button class="wqskip" id="mgdisc" type="button">Keep forging 🔷</button></div>';
      end.style.display = "flex";
      if (sfx && sfx.chime) sfx.chime();
      if (juice) juice.burst(W / 2, H / 2, "#ffd740", 20);
      document.getElementById("mgdisc").onclick = function () { end.style.display = "none"; end.innerHTML = ""; };
    }
    function showDex() {
      var end = document.getElementById("mgend");
      var cells = TIERS.map(function (d) {
        var got = !!stats.dex[d.id];
        var made = stats.made[d.id] || 0;
        return '<div class="dexcell" style="border-color:' + (got ? "#ffb300" : "#c8d2dc") + '">' +
          (got ? '<div class="dexe">' + d.emoji + '</div><div class="dexn">' + VQ.esc(d.name) + '</div><div class="dexs">made ×' + made + "</div>"
               : '<div class="dexe">❓</div><div class="dexn">???</div><div class="dexs">&nbsp;</div>') + "</div>";
      }).join("");
      var found = Object.keys(stats.dex).length;
      end.innerHTML = '<div class="wqcard" style="max-height:78vh;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y">' +
        '<div class="wqtitle">📖 Forge-Dex — ' + found + " / 10</div>" +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:4px">Merge two of a kind to forge the next gem. Can you reach the 🌌 INFINITY GEM?</div>' +
        '<div class="dexgrid">' + cells + "</div>" +
        '<button class="wqskip" id="mgdexback" type="button">Close</button></div>';
      end.style.display = "flex";
      document.getElementById("mgdexback").onclick = function () { end.style.display = "none"; end.innerHTML = ""; };
    }
    document.getElementById("mgdex").onclick = showDex;

    // ---------- placing / spawning ----------
    function placeAt(tier, cell) {
      grid[cell] = tier;
      bursts.push({ c: cell % COLS, r: Math.floor(cell / COLS), born: run, kind: "spawn" });
      if (sfx && sfx.pop) sfx.pop();
    }
    // odds for a CORRECT answer's 3 pieces: mostly tier 1, some 2, a few 3
    function rollTier() { var x = Math.random(); return x < 0.55 ? 1 : x < 0.85 ? 2 : 3; }
    // spawn into random empty cells; returns how many actually landed. If the board
    // couldn't take all of them AND no merge is possible, the run is over.
    function spawnPieces(n, forceTier) {
      var landed = 0;
      for (var i = 0; i < n; i++) {
        var empt = emptyCells();
        if (!empt.length) break;
        var cell = empt[Math.floor(Math.random() * empt.length)];
        placeAt(forceTier || rollTier(), cell);
        landed++;
      }
      hud();
      if (!emptyCells().length && !hasMergePair()) endRun();
      return landed;
    }
    // any two same-tier pieces (below the cap) left on the board?
    function hasMergePair() {
      var seen = {};
      for (var i = 0; i < N; i++) {
        var v = grid[i];
        if (v === null || v >= 10) continue; // two tier-10s can't merge — not a valid pair
        if (seen[v]) return true;
        seen[v] = 1;
      }
      return false;
    }

    // ---------- the FORGE quiz (the only piece source) ----------
    function spawnQuiz() {
      if (over) return;
      cd = 2; // small cooldown so he can't hammer the button mindlessly
      cv._lastQ = VQ.miniQuiz(document.getElementById("mgq"), words, store, {
        title: "🔤 Answer to forge new pieces!",
        lastFormat: lastFmt,
        // NOT skippable: the quiz is the whole game — no bailing out for free pieces
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          if (over) return;
          if (ok) {
            spawnPieces(3);
            big("🔤 Correct! +3 pieces forged!", "#69f0ae");
            if (sfx && sfx.coin) sfx.coin();
            if (juice) juice.burst(60, 60, "#69f0ae", 12);
          } else {
            spawnPieces(1, 1); // still a piece — teaching, not punishing
            big("Not quite — here's a Pebble to keep going!", "#ffd740");
          }
        }
      });
    }
    document.getElementById("mgforge").onclick = function () {
      if (over || cd > 0) { if (cd > 0) big("🔨 Forge is cooling… " + Math.ceil(cd) + "s", "#ffd740"); return; }
      spawnQuiz();
    };

    // ---------- merging ----------
    function tapCell(cell) {
      if (over || cell < 0 || cell >= N) return;
      var v = grid[cell];
      if (sel === null) {
        if (v === null) return;      // tapping empty with nothing selected = nothing
        sel = cell;                  // select a piece (glow ring)
        if (sfx && sfx.pop) sfx.pop();
        return;
      }
      // something is already selected:
      if (cell === sel) { sel = null; return; }          // tap same piece = deselect
      if (v === null) { sel = null; return; }            // tap empty cell = deselect
      if (grid[sel] === v && v < 10) { merge(sel, cell); return; } // SAME tier (not capped) = fuse
      sel = cell; // different-tier (or a capped 10) piece → move selection to it
      if (sfx && sfx.pop) sfx.pop();
    }
    // fuse a→b: b becomes tier+1, a empties. Score by tier*tier*5.
    function merge(a, b) {
      var tier = grid[a];
      var next = tier + 1;
      grid[a] = null;
      grid[b] = next;
      sel = null;
      score += tier * tier * 5;
      bursts.push({ c: b % COLS, r: Math.floor(b / COLS), born: run, kind: "merge" });
      hud();
      if (sfx && sfx.pop) sfx.pop();
      if (juice) juice.burst(SX(cellX(b % COLS)), SY(cellY(Math.floor(b / COLS))), "#ffd23f", 14);
      recordMake(next); // may fire a NEW DISCOVERY card
      if (next === 10) celebrateInfinity();
    }
    function celebrateInfinity() {
      big("🌌 INFINITY GEM FORGED! LEGENDARY!", "#c9b6ff");
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(9); for (var i = 0; i < 6; i++) juice.burst(W * (0.15 + i * 0.14), H * 0.4, ["#ffd23f", "#69f0ae", "#40c4ff", "#ff6b6b", "#e040fb", "#c9b6ff"][i], 18); }
    }

    // ---------- economy: bank once, SHOW the Vobux, never lose a run ----------
    function runRewards() {
      var hi = highestOnBoard();
      var gems = Math.min(80, Math.round(5 + score / 40 + hi * 4));
      var xp = Math.min(80, Math.round(8 + score / 50 + hi * 3));
      return {
        win: hi >= 10, score: score,
        rankPtsDelta: Math.min(10, 2 + hi),
        xp: xp, gems: gems, hiTier: hi
      };
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      // persist personal bests (additive fields; the platform owns stats.best)
      if (score > stats.bestScore) stats.bestScore = score;
      store.save();
      var rw = runRewards();
      var res = store.recordGame ? store.recordGame("merge", rw) : null;
      return { rw: rw, res: res };
    }
    function endRun() {
      if (over) return; over = true; sel = null;
      var bank = bankRun() || { rw: runRewards(), res: null };
      var rw = bank.rw;
      var hi = rw.hiTier;
      var end = document.getElementById("mgend");
      end.innerHTML = '<div class="wqcard" style="text-align:center;max-width:400px"><div style="font-size:44px">' + (hi >= 10 ? "🌌" : "🔷") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (hi >= 10 ? "INFINITY REACHED!" : "The forge is full!") + '</div>' +
        '<div style="margin:4px 0">Best gem this run: ' + (hi ? T(hi).emoji + " " + VQ.esc(T(hi).name) : "—") + '</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="font-size:13px;color:#5a6b7a">✨ ' + score + " score · 📖 " + Object.keys(stats.dex).length + "/10 discovered</div>" +
        '<button class="submit big-next" id="mgnew" type="button">🔁 New board</button></div>';
      end.style.display = "flex";
      if (sfx && sfx.fanfare) sfx.fanfare();
      if (juice) { juice.shake(5); for (var cf = 0; cf < 4; cf++) juice.burst(W * (0.2 + cf * 0.2), H * 0.35, ["#ffd23f", "#69f0ae", "#40c4ff", "#e040fb"][cf], 14); }
      document.getElementById("mgnew").onclick = resetBoard;
    }
    function resetBoard() {
      for (var i = 0; i < N; i++) grid[i] = null;
      score = 0; sel = null; over = false; banked = false; cd = 0; bursts = [];
      document.getElementById("mgend").style.display = "none";
      document.getElementById("mgend").innerHTML = "";
      big("🔷 Fresh forge! 🔤 FORGE PIECES to begin!", "#8ecdf7");
      hud();
    }

    // ---------- input (phantom-tap safe) ----------
    function tapScreen(px, py) {
      // screen → logical board, then to a cell
      var lx = (px - OX) / S, ly = (py - OY) / S;
      if (lx < 0 || lx >= BW || ly < 0 || ly >= BH) { sel = null; return; }
      var c = Math.floor(lx / CELL), r = Math.floor(ly / (BH / ROWS));
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) { sel = null; return; }
      tapCell(r * COLS + c);
    }
    // discrete board taps: touchstart preventDefault (single-fire) kills the iOS
    // synthetic mouse event; mousedown covers desktop. Never both for one tap.
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var b = cv.getBoundingClientRect(); tapScreen(e.changedTouches[0].clientX - b.left, e.changedTouches[0].clientY - b.top); }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var b = cv.getBoundingClientRect(); tapScreen(e.clientX - b.left, e.clientY - b.top); });

    // ---------- drawing ----------
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function draw(dt) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // retina scale; everything below is in CSS px
      ctx.clearRect(0, 0, W, H);
      // warm forge background gradient (bright enough that the gem emoji POP)
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#7a4f2e"); bg.addColorStop(0.55, "#9a6a3c"); bg.addColorStop(1, "#6b4224");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // board frame
      var fx = SX(0) - 6, fy = SY(0) - 6, fw = BW * S + 12, fh = BH * S + 12;
      ctx.fillStyle = "rgba(20,12,6,.55)"; rrect(fx, fy, fw, fh, 18 * S + 6); ctx.fill();
      var cw = CELL * S, chh = (BH / ROWS) * S;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var x = SX(c * CELL) + 3, y = SY(r * (BH / ROWS)) + 3;
        ctx.fillStyle = (r + c) % 2 ? "rgba(255,238,210,.30)" : "rgba(255,238,210,.18)";
        rrect(x, y, cw - 6, chh - 6, 12 * S + 2); ctx.fill();
        var cell = r * COLS + c, v = grid[cell];
        if (v === null) continue;
        var cx = SX(cellX(c)), cy = SY(cellY(r));
        var bob = Math.sin(run * 3 + c * 1.3 + r * 0.7) * 3 * S; // gentle bob
        var sizePx = Math.min(cw, chh) * 0.62;
        // tier-10 shimmer ring
        if (v >= 10) {
          ctx.save();
          ctx.strokeStyle = "hsl(" + ((run * 90) % 360) + ",90%,70%)"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(cx, cy + bob, sizePx * 0.66, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        // selected glow ring (pulse)
        if (sel === cell) {
          ctx.save();
          ctx.strokeStyle = "rgba(255,214,64," + (0.55 + Math.sin(run * 6) * 0.3) + ")"; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(cx, cy + bob, sizePx * 0.72, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        ctx.font = Math.round(sizePx) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(T(v).emoji, cx, cy + bob);
      }
      // merge / spawn bursts (short-lived rings)
      for (var bi = bursts.length - 1; bi >= 0; bi--) {
        var bu = bursts[bi];
        var age = run - bu.born;
        if (age > 0.5) { bursts.splice(bi, 1); continue; }
        var bx = SX(cellX(bu.c)), by = SY(cellY(bu.r));
        var rad = (age / 0.5) * cw * 0.7;
        ctx.strokeStyle = "rgba(255,220,120," + (1 - age / 0.5) + ")"; ctx.lineWidth = 4 * (1 - age / 0.5) + 1;
        ctx.beginPath(); ctx.arc(bx, by, rad, 0, Math.PI * 2); ctx.stroke();
      }
      if (juice) { juice.update(Math.min(dt, 0.05)); juice.draw(ctx); }
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; // clamp for animation only
      run += dt;
      if (!over && cd > 0) cd = Math.max(0, cd - dt);
      draw(dt);
    }

    // ---------- exit / banking (mid-run + tab-close both bank & say so) ----------
    function bankExit() {
      if (over || banked || score === 0) return; // an untouched board isn't a "run"
      var bank = bankRun();
      if (bank && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🔷 Forge run banked: +" + bank.rw.gems + " Vobux · +" + bank.rw.xp + " XP");
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

    // ---------- test hook ----------
    cv._merge = {
      state: function () {
        var out = new Array(N);
        for (var i = 0; i < N; i++) out[i] = grid[i];
        return { grid: out, score: score, over: over, sel: sel, discovered: Object.keys(stats.dex).length, bestTier: stats.bestTier || 0, banked: banked, cd: cd };
      },
      give: function (tier, cell) { // place a piece directly; cell optional = random empty
        if (cell === undefined || cell === null) { var e = emptyCells(); if (!e.length) return -1; cell = e[Math.floor(Math.random() * e.length)]; }
        grid[cell] = tier;
        hud();
        return cell;
      },
      tap: function (cell) { tapCell(cell); },
      spawnQuiz: function () { cd = 0; spawnQuiz(); }, // open the forge quiz NOW, ignore cooldown
      clear: function () { for (var i = 0; i < N; i++) grid[i] = null; sel = null; hud(); },
      fill: function (tier) { for (var i = 0; i < N; i++) if (grid[i] === null) grid[i] = tier; hud(); }
    };

    big("🔷 Merge Forge! Tap 🔤 FORGE PIECES to begin!", "#8ecdf7");
    hud();
    if (global._mergedemo) setTimeout(function () { // test hook: a lively seeded board incl a t7
      global._mergedemo = 0;
      cv._merge.clear();
      cv._merge.give(1, 0); cv._merge.give(1, 1); cv._merge.give(2, 2); cv._merge.give(2, 3);
      cv._merge.give(3, 6); cv._merge.give(4, 7); cv._merge.give(5, 12); cv._merge.give(6, 13);
      cv._merge.give(7, 18); cv._merge.give(1, 19); cv._merge.give(3, 20); cv._merge.give(2, 25);
    }, 700);
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxMerge = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
