/*
 * Voblox arcade game — 🕹️ CLAW CHAMP (a claw machine with REAL prizes).
 * Requested by Au for Leo (8). Side-view glass cabinet full of two-tone capsule
 * balls heaped at the bottom; a claw rig rides a rail up top and a prize CHUTE
 * sits on the left. ONE input: press-and-HOLD anywhere to slide the claw right,
 * RELEASE to stop — then it drops, closes, lifts and carries left with GRIP
 * DRAMA (an off-center grab can wobble free before it reaches the chute).
 *
 * VOCAB IS THE ONLY WAY TO PLAY, NEVER PUNISHMENT:
 *   - 🎟 CREDITS: 1 credit per grab. Answer a word (miniQuiz) for +1 (bank up
 *     to 5). Start with 1 free credit. Wrong = a kind "try another" nudge.
 *   - PITY: every 3rd credit since your last win is a guaranteed-strong grip
 *     (no slip) — kid-kind, so a run of near-misses always pays off.
 * PRIZES: 70% of capsules are Vobux (15–60 💎, banked once per session, cap
 *   300), 30% are golden ITEM capsules — a real cosmetic via VobloxItems
 *   .rollChest(): a fresh item drops straight into the inventory, a dupe pays
 *   that rarity's Vobux (same award pattern as the Backpack arcade).
 * Economy: capsule Vobux accumulate in a session total, banked ONCE via
 *   recordGame("claw") on Leave AND app-close; items are granted immediately.
 */
(function (global) {
  var VQ = global.VobloxQuestions;
  // dupe payout by rarity — copied verbatim from the Backpack arcade award path
  var DUPE_GEMS = { common: 40, rare: 150, epic: 500, legendary: 1500, mythic: 4000 };
  var CAP_COLORS = [
    ["#ff5b6e", "#ffd23f"], ["#4aa3ff", "#bfe4ff"], ["#8ed44f", "#e6ffcf"],
    ["#b06aff", "#ecd8ff"], ["#ff9f43", "#ffe0b0"], ["#ff4d94", "#ffd4e6"], ["#2ee0c8", "#c9fff6"]
  ];
  var CAP_PEEK = ["🎁", "⭐", "💎", "🐢", "🚀", "🎈", "🍬", "🐥", "🦖", "🐬", "🎀", "🔮", "🌈", "🍭"];
  var GOLD = ["#ffcf3f", "#fff1b8"]; // the exciting item-capsule two-tone

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("claw");
    // additive, never-renamed save fields
    stats.grabs = stats.grabs || 0;
    stats.wins = stats.wins || 0;
    stats.itemsWon = stats.itemsWon || 0;
    // credits PERSIST (additive save field) — the welcome credit is one-time EVER,
    // so quitting and re-entering never mints a fresh one (Au caught the farm)
    if (stats.credits == null) stats.credits = 1;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap claw";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="clcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="clmsg">🕹️ Claw Champ — HOLD to slide, RELEASE to grab!</div>' +
      '<div class="grow"><span id="clcred">🎟 1/5</span><span id="clsess">💎 0</span>' +
      '<button class="bossquit" id="clget">🎟 Get a credit</button>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="clbig"></div>' +
      '<div class="gover" id="clq" style="display:none"></div>' +
      '<div class="gover" id="clcard" style="display:none"></div>';
    document.body.appendChild(wrap);

    var cv = wrap.querySelector("#clcv"), ctx = cv.getContext("2d");
    var clq = document.getElementById("clq"), clcard = document.getElementById("clcard");
    var msgEl = document.getElementById("clmsg"), bigEl = document.getElementById("clbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // ---------- layout ----------
    var W, H, r, railY, chuteX, grabY, maxClawX, minClawX, pileBottom;
    var moveSpeed, dropSpeed, liftSpeed, carrySpeed;
    function resize() {
      W = cv.width = wrap.clientWidth || global.innerWidth || 360;
      H = cv.height = wrap.clientHeight || global.innerHeight || 640;
      r = Math.max(15, Math.min(W, H) * 0.05);       // capsule radius
      railY = Math.max(44, H * 0.13);                 // horizontal rail line
      chuteX = Math.max(42, W * 0.11);                // drop chute (left)
      grabY = H * 0.6;                                // claw closes near the pile top
      pileBottom = H - r * 1.25;
      minClawX = chuteX; maxClawX = W - r - 16;
      moveSpeed = W * 0.42; dropSpeed = H * 0.95; liftSpeed = H * 0.95; carrySpeed = W * 0.5;
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now(), t = 0;
    var credits = stats.credits, sessionGems = 0, grabsWon = 0, itemsWonSession = 0, grabsSinceWin = 0;
    function syncCredits() { stats.credits = credits; if (store.save) store.save(); }
    var banked = false, paused = false, over = false, lastFmt = null;
    var phase = "idle"; // idle | moving | dropping | carrying | result
    var lifting = false; // internal sub-state of "dropping" (claw rising back to the rail)
    var clawX, clawY, fingerT = 0, carriedCap = null, gripped = false;
    var pendingOutcome = null, slipDone = false, carryFromX = 0, forcedPrize = null;
    var caps = [];
    clawX = chuteX + r; clawY = railY;

    // a heap of capsules in tidy rows (precomputed settled slots; only a light
    // vertical bob at runtime — no physics engine, just cozy jiggle)
    function buildPile(n) {
      caps = [];
      var gap = r * 2.05;
      var usableL = chuteX + r * 2.2, usableR = W - r * 1.3;
      var perRow = Math.max(3, Math.floor((usableR - usableL) / gap) + 1);
      var idx = 0, row = 0;
      while (idx < n) {
        var count = Math.min(perRow - row, n - idx);
        if (count <= 0) count = Math.min(2, n - idx);
        var rowW = (count - 1) * gap;
        var startX = (usableL + usableR) / 2 - rowW / 2;
        var by = pileBottom - row * (r * 1.3);
        for (var c = 0; c < count && idx < n; c++) {
          var bx = startX + c * gap; // exact grid x (grab alignment stays honest)
          caps.push({
            baseX: bx, baseY: by + (Math.random() - 0.5) * r * 0.2,
            x: bx, y: by, phase: Math.random() * 6.28,
            ci: Math.floor(Math.random() * CAP_COLORS.length),
            peek: CAP_PEEK[Math.floor(Math.random() * CAP_PEEK.length)],
            kind: Math.random() < 0.3 ? "item" : "gems", // golden item vs Vobux
            gone: false
          });
          caps[caps.length - 1].y = caps[caps.length - 1].baseY;
          idx++;
        }
        row++;
      }
    }
    buildPile(14);

    // ---------- HUD / messages ----------
    function hud() {
      document.getElementById("clcred").textContent = "🎟 " + Math.max(0, credits) + "/5";
      document.getElementById("clsess").textContent = "💎 " + sessionGems;
    }
    function clue(m) { msgEl.textContent = m; }
    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1200);
    }

    // ---------- credit quiz (never skippable) ----------
    function creditQuiz() {
      if (over) return;
      paused = true;
      clcard.style.display = "none"; clcard.innerHTML = "";
      cv._lastQ = VQ.miniQuiz(clq, words, store, {
        title: "🎟 Answer a word to earn a claw credit!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            credits = Math.min(5, credits + 1); syncCredits();
            big("🎟 +1 credit! Go grab a prize!", "#69f0ae");
            if (sfx && sfx.coin) sfx.coin();
            if (juice) juice.burst(W * 0.5, H * 0.4, "#ffd23f", 14);
            clue("🕹️ HOLD to slide the claw, RELEASE to drop!");
          } else {
            big("So close — answer another word for a credit!", "#ffd23f");
          }
          hud();
        }
      });
    }

    // ---------- grab logic ----------
    // Which capsule (if any) sits under the claw, and does it hold?
    function computeOutcome(x, perfect, strong) {
      var oc = { aligned: false, capIndex: -1, off: 0, slip: false, kind: null };
      var idx = -1, best = 1e9;
      for (var i = 0; i < caps.length; i++) {
        if (caps[i].gone) continue;
        var dx = Math.abs(caps[i].x - x);
        if (dx < best) { best = dx; idx = i; }
      }
      if (idx < 0) return oc;
      var off = best / (r * 0.6); // 0 dead-center … 1 at the edge of the catch window
      if (off > 1) return oc;      // whiffed — claw closes on nothing
      oc.aligned = true; oc.capIndex = idx; oc.off = off;
      // slip scales with how off-center you grabbed; dead-center never slips,
      // and a strong (pity) or perfect grip never slips either.
      oc.slip = !perfect && !strong && off > 0.5;
      if (!oc.slip) { oc.kind = forcedPrize || caps[idx].kind || "gems"; forcedPrize = null; }
      return oc;
    }

    function startGrab(o) {
      o = o || {};
      if (over || phase === "result") return;
      if (credits <= 0) { creditQuiz(); return; }
      credits -= 1; syncCredits(); stats.grabs += 1; // the credit IS spent — that's claw machines
      var strong = !!o.perfect || ((grabsSinceWin + 1) % 3 === 0); // PITY: every 3rd is sturdy
      var oc = computeOutcome(clawX, !!o.perfect, strong);
      pendingOutcome = oc; slipDone = false;
      clue(strong ? "💪 Extra-strong grip on this one!" : "🕹️ Grabbing…");
      if (o.animate) { phase = "dropping"; lifting = false; fingerT = 0; gripped = false; carriedCap = null; if (sfx && sfx.pop) sfx.pop(); }
      else resolveOutcome(oc); // deterministic path (test API): no animation, resolve now
      hud();
    }
    function resolveOutcome(oc) {
      if (!oc.aligned) finalizeMiss();
      else if (oc.slip) finalizeSlip();
      else finalizeWin(oc);
    }

    function restockIfNeeded() {
      var live = 0; for (var i = 0; i < caps.length; i++) if (!caps[i].gone) live++;
      if (live < 6) { buildPile(14); big("🚚 RESTOCK! Fresh capsules loaded!", "#ffd23f"); if (sfx && sfx.chime) sfx.chime(); }
    }

    function finalizeMiss() { endLoss(false); }
    function finalizeSlip() { endLoss(true); }
    function endLoss(slipped) {
      grabsSinceWin += 1;
      gripped = false; carriedCap = null; fingerT = 0; clawY = railY; phase = "result";
      store.save();
      if (sfx && sfx.buzz) sfx.buzz();
      clue(slipped ? "😵‍💫 The grip wobbled free!" : "🕳️ Whiffed — nothing in the claw.");
      showMissCard();
      hud();
    }
    function finalizeWin(oc) {
      var cap = caps[oc.capIndex];
      grabsWon += 1; stats.wins += 1; grabsSinceWin = 0;
      if (cap) cap.gone = true; // consumed into the chute
      gripped = false; carriedCap = null; fingerT = 0; clawY = railY; phase = "result";
      var IT = global.VobloxItems;
      if (oc.kind === "item" && IT) {
        // a REAL cosmetic — same award pattern as the Backpack arcade
        var roll = IT.rollChest(Math.random, store.state, undefined);
        var rc = IT.RARITY[roll.item.rarity] || { color: "#9aa7b0", label: "Common" };
        if (!roll.dupe) {
          if (!store.state.inventory) store.state.inventory = [];
          store.state.inventory.push(roll.item.id); // granted immediately, NOT via the bank
          itemsWonSession += 1; stats.itemsWon += 1;
          store.save();
          showItemCard(roll.item, rc, false, 0);
        } else {
          var g = DUPE_GEMS[roll.item.rarity] || 40; // dupe → pay that rarity's Vobux
          store.state.gems = (store.state.gems || 0) + g;
          store.save();
          showItemCard(roll.item, rc, true, g);
        }
        if (sfx && sfx.fanfare) sfx.fanfare();
        if (juice) juice.burst(chuteX + r, H * 0.5, rc.color, 24);
      } else {
        var amt = 15 + Math.floor(Math.random() * 46); // 15..60 💎 into the session pot
        sessionGems += amt;
        store.save();
        showGemCard(amt);
        if (sfx && sfx.coin) sfx.coin();
        if (juice) for (var k = 0; k < 3; k++) juice.burst(chuteX + r, H * 0.5, "#ffd23f", 12);
      }
      clue("🎉 Prize in the chute!");
      restockIfNeeded();
      hud();
    }

    // ---------- result cards ----------
    function cardButtons() {
      return '<button class="submit" id="clagain" type="button">🎟 Grab again</button>' +
        '<button class="wqskip" id="clleave" type="button">Leave</button>';
    }
    function showCard(html) {
      clcard.innerHTML = html; clcard.style.display = "flex";
      var a = document.getElementById("clagain"); if (a) a.onclick = grabAgain;
      var l = document.getElementById("clleave"); if (l) l.onclick = exit;
    }
    function showGemCard(amt) {
      showCard('<div class="wqcard" style="text-align:center"><div style="font-size:52px">🪙</div>' +
        '<div class="wqtitle">Prize grabbed!</div>' +
        '<div style="font-size:22px;font-weight:900;color:#2f9e44">+' + amt + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"></div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin:4px 0">Coins burst out of the capsule!</div>' +
        cardButtons() + '</div>');
    }
    function showItemCard(item, rc, dupe, g) {
      showCard('<div class="wqcard" style="text-align:center"><div style="font-size:56px">' + item.emoji + '</div>' +
        '<div class="wqtitle" style="color:' + rc.color + '">' + (dupe ? "Duplicate!" : "✨ NEW!") + " " + esc(item.name) + '</div>' +
        '<div style="font-weight:900;color:' + rc.color + '">' + rc.label + '</div>' +
        (dupe
          ? '<div style="margin:4px 0;font-weight:900;color:#2f9e44">dupe · +' + g + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"></div>'
          : '<div style="font-size:12px;color:#5a6b7a;margin:4px 0">Added to your inventory!</div>') +
        cardButtons() + '</div>');
    }
    function showMissCard() {
      showCard('<div class="wqcard" style="text-align:center"><div style="font-size:52px">😵‍💫</div>' +
        '<div class="wqtitle">So close! The claw wobbled…</div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin:4px 0">That one got away — but every 3rd grab grips EXTRA hard!</div>' +
        cardButtons() + '</div>');
    }
    function grabAgain() {
      clcard.style.display = "none"; clcard.innerHTML = "";
      phase = "idle"; gripped = false; carriedCap = null; fingerT = 0;
      clawX = chuteX + r; clawY = railY;
      if (credits <= 0) creditQuiz();
      else clue("🕹️ HOLD to slide, RELEASE to grab!");
    }

    // ---------- input (phantom-tap safe; a HOLD, not a discrete tap) ----------
    function pointerDown() {
      if (over || paused) return;
      if (clcard.style.display === "flex") return; // a card is up — ignore canvas
      if (phase !== "idle") return;
      if (credits <= 0) { creditQuiz(); return; }
      phase = "moving";
      if (sfx && sfx.pop) sfx.pop();
    }
    function pointerUp() {
      if (phase === "moving") { carryFromX = clawX; startGrab({ animate: true }); }
    }
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); pointerDown(); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); pointerUp(); }, { passive: false });
    cv.addEventListener("mousedown", function () { pointerDown(); });
    window.addEventListener("mouseup", pointerUp);

    // ---------- simulation (dt-driven, clamped upstream) ----------
    function step(dt) {
      t += dt;
      for (var i = 0; i < caps.length; i++) {
        var cc = caps[i];
        if (cc.gone || cc === carriedCap) continue;
        cc.x = cc.baseX; cc.y = cc.baseY + Math.sin(t * 3 + cc.phase) * (r * 0.07); // cozy bob
      }
      if (phase === "moving") {
        clawX += moveSpeed * dt; if (clawX >= maxClawX) clawX = maxClawX;
      } else if (phase === "dropping") {
        if (!lifting) {
          clawY += dropSpeed * dt;
          if (clawY >= grabY) {
            clawY = grabY; fingerT = Math.min(1, fingerT + dt * 5); // fingers close
            if (fingerT >= 1) {
              if (pendingOutcome && pendingOutcome.aligned) { gripped = true; carriedCap = caps[pendingOutcome.capIndex]; }
              lifting = true;
            }
          }
        } else {
          clawY -= liftSpeed * dt; // rising back to the rail
          if (carriedCap) { carriedCap.x = clawX; carriedCap.y = clawY + r * 1.5; }
          if (clawY <= railY) {
            clawY = railY; lifting = false;
            if (!gripped) finalizeMiss();
            else { phase = "carrying"; carryFromX = clawX; }
          }
        }
      } else if (phase === "carrying") {
        clawX -= carrySpeed * dt; if (clawX < chuteX + r * 0.15) clawX = chuteX + r * 0.15;
        var wob = Math.sin(t * 18) * (pendingOutcome ? pendingOutcome.off * 7 : 0); // grip drama
        if (carriedCap) { carriedCap.x = clawX + wob; carriedCap.y = clawY + r * 1.5; }
        var mid = chuteX + (carryFromX - chuteX) * 0.5;
        if (pendingOutcome && pendingOutcome.slip && !slipDone && clawX <= mid) { slipDone = true; finalizeSlip(); return; }
        if (clawX <= chuteX + r * 0.2) finalizeWin(pendingOutcome);
      }
    }

    // ---------- drawing ----------
    function rrect(x, y, w, h, rad) {
      ctx.beginPath(); ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
    }
    function drawLights(x, y, w, h) {
      var cols = ["#ff5b6e", "#ffd23f", "#4aa3ff", "#8ed44f", "#b06aff"];
      var per = 26, pts = [], xx, yy;
      for (xx = x; xx < x + w; xx += per) pts.push([xx, y]);
      for (yy = y; yy < y + h; yy += per) pts.push([x + w, yy]);
      for (xx = x + w; xx > x; xx -= per) pts.push([xx, y + h]);
      for (yy = y + h; yy > y; yy -= per) pts.push([x, yy]);
      for (var p = 0; p < pts.length; p++) {
        var on = (Math.floor(t * 6) + p) % 3 === 0; // chase!
        ctx.beginPath(); ctx.arc(pts[p][0], pts[p][1], on ? 4 : 2.5, 0, 6.283);
        ctx.fillStyle = on ? cols[p % cols.length] : "rgba(255,255,255,.2)"; ctx.fill();
      }
    }
    function drawCap(c) {
      var golden = c.kind === "item";
      var pair = golden ? GOLD : CAP_COLORS[c.ci];
      if (golden) { ctx.fillStyle = "rgba(255,215,64,.22)"; ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.35, 0, 6.283); ctx.fill(); }
      ctx.save();
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 6.283); ctx.closePath(); ctx.clip();
      ctx.fillStyle = pair[0]; ctx.fillRect(c.x - r, c.y - r, r * 2, r);
      ctx.fillStyle = pair[1]; ctx.fillRect(c.x - r, c.y, r * 2, r);
      ctx.restore();
      ctx.strokeStyle = golden ? "#b8860b" : "rgba(0,0,0,.25)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 6.283); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x - r, c.y); ctx.lineTo(c.x + r, c.y); ctx.stroke(); // seam
      ctx.font = Math.round(r * 0.9) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.85; ctx.fillText(c.peek, c.x, c.y - r * 0.08); ctx.globalAlpha = 1; // emoji peek
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.beginPath(); ctx.arc(c.x - r * 0.35, c.y - r * 0.4, r * 0.18, 0, 6.283); ctx.fill(); // shine
    }
    function drawClaw() {
      ctx.strokeStyle = "#8a9ab8"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(clawX, railY); ctx.lineTo(clawX, clawY); ctx.stroke(); // cable
      ctx.fillStyle = "#c0402f"; rrect(clawX - 16, railY - 10, 32, 14, 4); ctx.fill();     // trolley
      ctx.fillStyle = "#d8dee8"; ctx.beginPath(); ctx.arc(clawX, clawY, 9, 0, 6.283); ctx.fill(); // hub
      var spread = (1 - fingerT) * 0.6 + 0.15; // three fingers articulate open→closed
      var len = r * 1.7, angles = [-1, 0, 1];
      for (var f = 0; f < 3; f++) {
        var a = angles[f] * spread;
        var mx = clawX + Math.sin(a) * len * 0.5, my = clawY + Math.cos(a) * len * 0.5;
        var ex = clawX + Math.sin(a) * len * 1.15, ey = clawY + Math.cos(a) * len;
        ctx.strokeStyle = "#aeb8c8"; ctx.lineWidth = 5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(clawX, clawY); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#12203a"); g.addColorStop(1, "#0a1428");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var gx = 12, gy = 30, gw = W - 24, gh = H - 44;
      ctx.fillStyle = "rgba(120,180,255,.06)"; rrect(gx, gy, gw, gh, 16); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = "#2a3f66"; ctx.stroke();
      drawLights(gx, gy, gw, gh);
      ctx.strokeStyle = "#5b6b88"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(gx + 8, railY); ctx.lineTo(gx + gw - 8, railY); ctx.stroke(); // rail
      ctx.fillStyle = "rgba(0,0,0,.4)"; rrect(gx + 6, H - 96, r * 2.4, 66, 10); ctx.fill();     // chute
      ctx.fillStyle = "#ffd23f"; ctx.font = "bold 12px Trebuchet MS"; ctx.textAlign = "center";
      ctx.fillText("PRIZES", gx + 6 + r * 1.2, H - 60);
      for (var i = 0; i < caps.length; i++) if (!caps[i].gone && caps[i] !== carriedCap) drawCap(caps[i]);
      if (carriedCap) drawCap(carriedCap);
      drawClaw();
      if (juice) { juice.update(0.016); juice.draw(ctx); }
    }

    // ---------- banking / exit ----------
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = {
        win: itemsWonSession > 0,             // "won any item this session"
        score: grabsWon,                       // grabs won
        rankPtsDelta: Math.min(8, 1 + grabsWon + itemsWonSession),
        xp: Math.min(60, 5 + grabsWon * 4 + itemsWonSession * 8),
        gems: Math.min(300, sessionGems)       // session Vobux total, capped
      };
      var res = store.recordGame ? store.recordGame("claw", rw) : null;
      return { rw: rw, res: res };
    }
    function onUnload() { bankRun(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankRun();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("mouseup", pointerUp);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;
    document.getElementById("clget").onclick = creditQuiz;

    // ---------- main loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) step(dt);
      draw();
    }

    // ---------- test API (on the canvas) ----------
    cv._claw = {
      state: function () {
        return {
          credits: credits, session: sessionGems, phase: phase, clawX: clawX,
          gripped: gripped, pity: grabsSinceWin, banked: banked, itemsWon: itemsWonSession
        };
      },
      creditQuiz: creditQuiz,
      give: function (n) { credits += (n === undefined ? 1 : n); syncCredits(); hud(); },
      hold: function () { pointerDown(); },
      release: function () { pointerUp(); },
      moveTo: function (x) { clawX = x; },
      dropAt: function (x, perfect) { if (credits <= 0) return; clawX = x; startGrab({ perfect: !!perfect, animate: false }); },
      forcePrize: function (kind) { forcedPrize = kind; },
      capsules: function () { return caps.filter(function (c) { return !c.gone; }).map(function (c) { return { x: c.x, y: c.y }; }); },
      tick: function (sec) { var left = sec; while (left > 0) { var d = Math.min(0.05, left); if (!paused && !over) step(d); left -= d; } },
      again: function () { var a = document.getElementById("clagain"); if (a) a.click(); }
    };

    hud();

    // demo hook: seed a lively mid-carry board (golden capsule gripped, paused)
    if (global._clawdemo) {
      global._clawdemo = 0;
      credits = 2; sessionGems = 35; paused = true;
      var demoCap = caps[0]; demoCap.kind = "item";
      carriedCap = demoCap; gripped = true; phase = "carrying"; fingerT = 1;
      clawX = chuteX + W * 0.4; clawY = railY; carryFromX = W * 0.7;
      demoCap.x = clawX; demoCap.y = clawY + r * 1.5;
      clue("🕹️ Demo — carrying a golden prize to the chute!");
      hud();
    }

    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxClaw = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
