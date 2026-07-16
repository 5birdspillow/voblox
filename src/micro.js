/*
 * Voblox arcade game — 🎪 MICRO MANIA (a WarioWare-style microgame gauntlet).
 * A run is an endless CHAIN of ~5-second microgames. Each one is announced by a
 * one-word command banner ("TAP!", "DODGE!", "CATCH!"…). Beat it and the next
 * one arrives a little FASTER (a speed multiplier creeps up). Three lives; fail
 * a microgame and you lose one. Score = microgames cleared. Endless until you
 * run out of lives.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - Every 5 cleared microgames a 📚 WORD BREAK appears (VQ.miniQuiz). Answer
 *     it right and you win BOTH a +1 life (max 5) AND a ⭐ SUPER ROUND — the very
 *     next microgame pays double. Answer wrong and nothing is lost; the chain
 *     rolls on.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("micro")
 * per run, banked on run-over, quit, AND app-close. Stats persist additively.
 *
 * Each microgame is a self-contained object:
 *   { id, verb, survive?, limit?, init(g), step(g,dt), draw(g,ctx),
 *     point(g,type,x,y), check(g) -> "win"|"fail"|null }
 * The engine owns the clock, lives, speed, banner and banking; a microgame only
 * knows its own tiny world.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // ---------- tiny shared draw / math helpers (no per-instance state) ----------
  function label(ctx, s, x, y, size, color, align) {
    ctx.fillStyle = color || "#fff";
    ctx.font = "bold " + Math.round(size) + "px Trebuchet MS, Arial, sans-serif";
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(s, x, y);
  }
  function emoji(ctx, s, x, y, size, align) {
    ctx.font = Math.round(size) + "px serif";
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(s, x, y);
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function unit(g) { return Math.min(g.W, g.H); }
  function sfxp(g, name) { var s = g.sfx; if (s && s[name]) s[name](); }
  function jb(g, x, y, c, n) { if (g.juice) g.juice.burst(x, y, c || "#ffd23f", n || 12); }

  // ================= THE TEN MICROGAMES =================
  var MICROS = [
    // 1) TAP! — pop every balloon before time runs out.
    {
      id: "tap", verb: "TAP!",
      init: function (g) {
        var u = unit(g), n = 3 + Math.floor(Math.random() * 3), i;
        g.m.balloons = [];
        for (i = 0; i < n; i++) {
          g.m.balloons.push({
            x: g.W * (0.12 + 0.76 * (i + 0.5) / n) + rnd(-g.W * 0.04, g.W * 0.04),
            y: g.H * rnd(0.3, 0.78), r: u * 0.1, ph: rnd(0, 6.28), popped: false,
            c: ["#ff5b6e", "#ffd23f", "#40c4ff", "#69f0ae", "#e040fb"][i % 5]
          });
        }
      },
      step: function (g, dt) {
        var u = unit(g);
        g.m.balloons.forEach(function (b) { if (!b.popped) { b.y -= u * 0.14 * dt; if (b.y < g.H * 0.12) b.y = g.H * 0.12; } });
      },
      point: function (g, type, x, y) {
        if (type !== "down") return;
        g.m.balloons.forEach(function (b) {
          if (!b.popped && dist(x, y, b.x, b.y) < b.r * 1.15) { b.popped = true; jb(g, b.x, b.y, b.c, 14); sfxp(g, "pop"); }
        });
      },
      check: function (g) { for (var i = 0; i < g.m.balloons.length; i++) if (!g.m.balloons[i].popped) return null; return "win"; },
      draw: function (g, ctx) {
        var u = unit(g), left = 0;
        g.m.balloons.forEach(function (b) {
          if (b.popped) return; left++;
          ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(b.x, b.y + b.r * 0.7); ctx.lineTo(b.x, b.y + b.r * 1.5); ctx.stroke();
          ctx.fillStyle = b.c; ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * 0.82, b.r, 0, 0, 6.2832); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.25, b.y - b.r * 0.3, b.r * 0.2, b.r * 0.3, 0, 0, 6.2832); ctx.fill();
        });
        label(ctx, "POP THEM ALL! " + left + " left", g.W / 2, g.H * 0.1, u * 0.06, "#fff");
      }
    },
    // 2) DODGE! — drag your blob to survive the falling anvils.
    {
      id: "dodge", verb: "DODGE!", survive: true,
      init: function (g) {
        var u = unit(g);
        g.m.blob = { x: g.W / 2, y: g.H * 0.82, r: u * 0.075 };
        g.m.tx = g.W / 2; g.m.anvils = []; g.m.spawn = 0.2; g.m.hit = false;
      },
      step: function (g, dt) {
        var u = unit(g), b = g.m.blob;
        b.x += (g.m.tx - b.x) * Math.min(1, dt * 14);
        b.x = Math.max(b.r, Math.min(g.W - b.r, b.x));
        g.m.spawn -= dt;
        if (g.m.spawn <= 0) { g.m.spawn = 0.42; g.m.anvils.push({ x: g.W * rnd(0.08, 0.92), y: -u * 0.1, vy: g.H * rnd(0.5, 0.85), r: u * 0.06 }); }
        for (var i = g.m.anvils.length - 1; i >= 0; i--) {
          var a = g.m.anvils[i]; a.y += a.vy * dt;
          if (dist(a.x, a.y, b.x, b.y) < a.r + b.r * 0.85) { g.m.hit = true; jb(g, b.x, b.y, "#ff5b5b", 20); sfxp(g, "buzz"); }
          if (a.y > g.H + a.r * 2) g.m.anvils.splice(i, 1);
        }
      },
      point: function (g, type, x, y) { if (type === "down" || type === "move") g.m.tx = x; },
      check: function (g) { return g.m.hit ? "fail" : null; },
      draw: function (g, ctx) {
        var u = unit(g), b = g.m.blob;
        g.m.anvils.forEach(function (a) { emoji(ctx, "🪨", a.x, a.y, a.r * 2.1); });
        ctx.fillStyle = g.m.hit ? "#ff5b5b" : "#69f0ae";
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
        emoji(ctx, "😳", b.x, b.y, b.r * 1.3);
        label(ctx, "DON'T GET SQUISHED!", g.W / 2, g.H * 0.1, u * 0.06, "#fff");
      }
    },
    // 3) CATCH! — drag the basket to catch 3 apples.
    {
      id: "catch", verb: "CATCH!",
      init: function (g) {
        var u = unit(g);
        g.m.basket = { x: g.W / 2, y: g.H * 0.85, r: u * 0.11 };
        g.m.tx = g.W / 2; g.m.apples = []; g.m.spawn = 0.15; g.m.caught = 0;
      },
      step: function (g, dt) {
        var u = unit(g), bk = g.m.basket;
        bk.x += (g.m.tx - bk.x) * Math.min(1, dt * 14);
        bk.x = Math.max(bk.r, Math.min(g.W - bk.r, bk.x));
        g.m.spawn -= dt;
        if (g.m.spawn <= 0) { g.m.spawn = 0.62; g.m.apples.push({ x: g.W * rnd(0.12, 0.88), y: -u * 0.08, vy: g.H * rnd(0.4, 0.55), r: u * 0.05 }); }
        for (var i = g.m.apples.length - 1; i >= 0; i--) {
          var a = g.m.apples[i]; a.y += a.vy * dt;
          if (a.y > bk.y - u * 0.05 && a.y < bk.y + u * 0.08 && Math.abs(a.x - bk.x) < bk.r) { g.m.caught++; g.m.apples.splice(i, 1); jb(g, a.x, bk.y, "#ff5b5b", 12); sfxp(g, "coin"); continue; }
          if (a.y > g.H + a.r * 2) g.m.apples.splice(i, 1);
        }
      },
      point: function (g, type, x, y) { if (type === "down" || type === "move") g.m.tx = x; },
      check: function (g) { return g.m.caught >= 3 ? "win" : null; },
      draw: function (g, ctx) {
        var u = unit(g), bk = g.m.basket;
        g.m.apples.forEach(function (a) { emoji(ctx, "🍎", a.x, a.y, a.r * 2.2); });
        emoji(ctx, "🧺", bk.x, bk.y, bk.r * 1.7);
        label(ctx, "CATCH 3 🍎  (" + g.m.caught + "/3)", g.W / 2, g.H * 0.1, u * 0.06, "#fff");
      }
    },
    // 4) WHACK! — bonk the mole, NEVER the bunny.
    {
      id: "whack", verb: "WHACK!",
      init: function (g) {
        var u = unit(g), i;
        g.m.holes = [];
        for (i = 0; i < 3; i++) g.m.holes.push({ x: g.W * (0.25 + 0.25 * i), y: g.H * 0.62, r: u * 0.11, up: false, kind: null });
        g.m.timer = 0.35; g.m.whacks = 0; g.m.bad = false;
      },
      step: function (g, dt) {
        g.m.timer -= dt;
        if (g.m.timer <= 0) {
          g.m.timer = 0.72;
          g.m.holes.forEach(function (h) { h.up = false; });
          var h = g.m.holes[Math.floor(Math.random() * g.m.holes.length)];
          h.up = true; h.kind = Math.random() < 0.68 ? "mole" : "bunny";
        }
      },
      point: function (g, type, x, y) {
        if (type !== "down") return;
        g.m.holes.forEach(function (h) {
          if (h.up && dist(x, y, h.x, h.y - h.r * 0.4) < h.r) {
            if (h.kind === "mole") { g.m.whacks++; h.up = false; jb(g, h.x, h.y, "#c48f5a", 12); sfxp(g, "pop"); }
            else { g.m.bad = true; jb(g, h.x, h.y, "#ff8a8a", 14); sfxp(g, "buzz"); }
          }
        });
      },
      check: function (g) { return g.m.bad ? "fail" : (g.m.whacks >= 3 ? "win" : null); },
      draw: function (g, ctx) {
        var u = unit(g);
        g.m.holes.forEach(function (h) {
          ctx.fillStyle = "#5a3d24"; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.5, 0, 0, 6.2832); ctx.fill();
          if (h.up) emoji(ctx, h.kind === "mole" ? "🐹" : "🐰", h.x, h.y - h.r * 0.45, h.r * 1.5);
        });
        label(ctx, "WHACK 🐹  NOT 🐰   (" + g.m.whacks + "/3)", g.W / 2, g.H * 0.1, u * 0.055, "#fff");
      }
    },
    // 5) TIMING! — tap the instant the needle sweeps the green zone.
    {
      id: "timing", verb: "TIMING!",
      init: function (g) { g.m.res = null; g.m.tapped = false; g.m.p = 0; g.m.lo = 0.42; g.m.hi = 0.58; },
      step: function (g, dt) { g.m.p = 0.5 - 0.5 * Math.cos(g.t * 4.2); },
      point: function (g, type, x, y) {
        if (type !== "down" || g.m.tapped) return;
        g.m.tapped = true;
        g.m.res = (g.m.p >= g.m.lo && g.m.p <= g.m.hi) ? "win" : "fail";
        jb(g, g.W / 2, g.H * 0.5, g.m.res === "win" ? "#69f0ae" : "#ff5b5b", 16);
        sfxp(g, g.m.res === "win" ? "coin" : "buzz");
      },
      check: function (g) { return g.m.res; },
      draw: function (g, ctx) {
        var u = unit(g), tw = g.W * 0.72, tx = (g.W - tw) / 2, ty = g.H * 0.5, th = u * 0.09;
        rrect(ctx, tx, ty - th / 2, tw, th, th / 2); ctx.fillStyle = "#22314a"; ctx.fill();
        ctx.fillStyle = "#69f0ae"; ctx.fillRect(tx + tw * g.m.lo, ty - th / 2, tw * (g.m.hi - g.m.lo), th);
        var nx = tx + tw * (g.m.res ? g.m.p : (0.5 - 0.5 * Math.cos(g.t * 4.2)));
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(nx, ty - th * 0.9); ctx.lineTo(nx, ty + th * 0.9); ctx.stroke();
        label(ctx, "TAP IN THE GREEN!", g.W / 2, g.H * 0.1, u * 0.06, "#fff");
      }
    },
    // 6) FEED! — drag the bone to the DOG's mouth (not the cat!).
    {
      id: "feed", verb: "FEED!",
      init: function (g) {
        var u = unit(g);
        g.m.dog = { x: g.W * 0.3, y: g.H * 0.32, r: u * 0.14 };
        g.m.cat = { x: g.W * 0.7, y: g.H * 0.32, r: u * 0.14 };
        g.m.food = { x: g.W / 2, y: g.H * 0.75, r: u * 0.07, held: false };
        g.m.res = null;
      },
      point: function (g, type, x, y) {
        var f = g.m.food;
        if (type === "down") { if (dist(x, y, f.x, f.y) < f.r * 2) f.held = true; }
        else if (type === "move") { if (f.held) { f.x = x; f.y = y; } }
        else if (type === "up") {
          if (!f.held) return; f.held = false;
          if (dist(f.x, f.y, g.m.dog.x, g.m.dog.y) < g.m.dog.r) { g.m.res = "win"; jb(g, g.m.dog.x, g.m.dog.y, "#69f0ae", 16); sfxp(g, "coin"); }
          else if (dist(f.x, f.y, g.m.cat.x, g.m.cat.y) < g.m.cat.r) { g.m.res = "fail"; jb(g, g.m.cat.x, g.m.cat.y, "#ff5b5b", 16); sfxp(g, "buzz"); }
          else { f.x = g.W / 2; f.y = g.H * 0.75; }
        }
      },
      check: function (g) { return g.m.res; },
      draw: function (g, ctx) {
        var u = unit(g);
        emoji(ctx, "🐶", g.m.dog.x, g.m.dog.y, g.m.dog.r * 1.7);
        emoji(ctx, "🐱", g.m.cat.x, g.m.cat.y, g.m.cat.r * 1.7);
        emoji(ctx, "🦴", g.m.food.x, g.m.food.y, g.m.food.r * 2.3);
        label(ctx, "DRAG 🦴 TO 🐶", g.W / 2, g.H * 0.1, u * 0.06, "#fff");
      }
    },
    // 7) COUNT! — how many fish? tap the right number, 1–4.
    {
      id: "count", verb: "COUNT!",
      init: function (g) {
        var u = unit(g), i; g.m.n = 1 + Math.floor(Math.random() * 4); g.m.fish = []; g.m.res = null;
        for (i = 0; i < g.m.n; i++) g.m.fish.push({ x: g.W * rnd(0.2, 0.8), y: g.H * rnd(0.28, 0.55), s: u * 0.12, ph: rnd(0, 6.28) });
      },
      point: function (g, type, x, y) {
        if (type !== "down" || g.m.res) return;
        if (y < g.H * 0.68) return; // tapped the pond, not a number
        var val = Math.floor(x / (g.W / 4)) + 1;
        if (val < 1) val = 1; if (val > 4) val = 4;
        g.m.picked = val;
        g.m.res = val === g.m.n ? "win" : "fail";
        sfxp(g, g.m.res === "win" ? "coin" : "buzz");
      },
      check: function (g) { return g.m.res; },
      draw: function (g, ctx) {
        var u = unit(g), k;
        g.m.fish.forEach(function (f) { emoji(ctx, "🐟", f.x, f.y + Math.sin(g.t * 3 + f.ph) * u * 0.02, f.s); });
        for (k = 0; k < 4; k++) {
          var bx = g.W * k / 4, bw = g.W / 4;
          ctx.fillStyle = "#2f7be0"; rrect(ctx, bx + bw * 0.08, g.H * 0.74, bw * 0.84, g.H * 0.18, u * 0.03); ctx.fill();
          label(ctx, "" + (k + 1), bx + bw / 2, g.H * 0.83, u * 0.09, "#fff");
        }
        label(ctx, "HOW MANY 🐟 ?", g.W / 2, g.H * 0.1, u * 0.06, "#fff");
      }
    },
    // 8) MATCH! — tap the ONE emoji that matches the banner, ignore the decoys.
    {
      id: "match", verb: "MATCH!",
      init: function (g) {
        var u = unit(g), pool = ["🍎", "⭐", "🐶", "🚗", "🌸", "⚽", "🎈", "🍌"], i, j;
        // shuffle a small copy, first is the target, rest are decoys
        pool = pool.slice(); for (i = pool.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
        g.m.target = pool[0]; g.m.items = []; g.m.res = null;
        var count = 5, cols = 3;
        for (i = 0; i < count; i++) {
          g.m.items.push({
            e: i === 0 ? g.m.target : pool[1 + ((i - 1) % (pool.length - 1))],
            x: g.W * (0.22 + 0.56 * ((i % cols) / (cols - 1))),
            y: g.H * (0.34 + 0.26 * Math.floor(i / cols)),
            r: u * 0.1, isT: i === 0
          });
        }
        // scatter so the target isn't always first-position
        for (i = g.m.items.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); var t2 = g.m.items[i]; var xa = t2.x, ya = t2.y; t2.x = g.m.items[j].x; t2.y = g.m.items[j].y; g.m.items[j].x = xa; g.m.items[j].y = ya; }
      },
      point: function (g, type, x, y) {
        if (type !== "down" || g.m.res) return;
        g.m.items.forEach(function (it) {
          if (dist(x, y, it.x, it.y) < it.r) { g.m.res = it.isT ? "win" : "fail"; jb(g, it.x, it.y, it.isT ? "#69f0ae" : "#ff5b5b", 14); sfxp(g, it.isT ? "coin" : "buzz"); }
        });
      },
      check: function (g) { return g.m.res; },
      draw: function (g, ctx) {
        var u = unit(g);
        label(ctx, "TAP THE", g.W / 2, g.H * 0.11, u * 0.05, "#fff");
        emoji(ctx, g.m.target, g.W / 2, g.H * 0.19, u * 0.11);
        g.m.items.forEach(function (it) { emoji(ctx, it.e, it.x, it.y, it.r * 1.7); });
      }
    },
    // 9) HOLD! — press and hold until the bar fills the green band, then release.
    {
      id: "hold", verb: "HOLD!",
      init: function (g) { g.m.hold = 0; g.m.holding = false; g.m.res = null; g.m.target = 1.6; g.m.band = 0.32; },
      step: function (g, dt) {
        if (g.m.holding && !g.m.res) {
          g.m.hold += dt;
          if (g.m.hold > g.m.target + g.m.band) { g.m.res = "fail"; g.m.holding = false; jb(g, g.W / 2, g.H * 0.55, "#ff5b5b", 14); sfxp(g, "buzz"); }
        }
      },
      point: function (g, type, x, y) {
        if (g.m.res) return;
        if (type === "down") { g.m.holding = true; g.m.hold = 0; }
        else if (type === "up") {
          if (!g.m.holding) return; g.m.holding = false;
          var ok = g.m.hold >= g.m.target - g.m.band && g.m.hold <= g.m.target + g.m.band;
          g.m.res = ok ? "win" : "fail"; jb(g, g.W / 2, g.H * 0.55, ok ? "#69f0ae" : "#ff5b5b", 16); sfxp(g, ok ? "coin" : "buzz");
        }
      },
      check: function (g) { return g.m.res; },
      draw: function (g, ctx) {
        var u = unit(g), bw = g.W * 0.7, bx = (g.W - bw) / 2, by = g.H * 0.55, bh = u * 0.11, max = g.m.target + g.m.band;
        rrect(ctx, bx, by - bh / 2, bw, bh, bh / 2); ctx.fillStyle = "#22314a"; ctx.fill();
        var g0 = (g.m.target - g.m.band) / max, g1 = (g.m.target + g.m.band) / max;
        ctx.fillStyle = "#3f8f4f"; ctx.fillRect(bx + bw * g0, by - bh / 2, bw * (g1 - g0), bh);
        ctx.fillStyle = g.m.res === "win" ? "#69f0ae" : "#ffd23f";
        ctx.fillRect(bx, by - bh / 2, bw * Math.min(1, g.m.hold / max), bh);
        label(ctx, g.m.holding ? "…HOLD…" : "PRESS & HOLD TO THE GREEN!", g.W / 2, g.H * 0.1, u * 0.055, "#fff");
      }
    },
    // 10) SORT! — drag the fruit to its matching bin in one stroke.
    {
      id: "sort", verb: "SORT!",
      init: function (g) {
        var u = unit(g), apple = Math.random() < 0.5;
        g.m.fruit = { kind: apple ? "apple" : "banana", e: apple ? "🍎" : "🍌", x: g.W / 2, y: g.H * 0.42, r: u * 0.08, held: false };
        g.m.correct = apple ? "red" : "yellow";
        g.m.red = { key: "red", x: g.W * 0.22, y: g.H * 0.82, r: u * 0.16, c: "#e64545" };
        g.m.yellow = { key: "yellow", x: g.W * 0.78, y: g.H * 0.82, r: u * 0.16, c: "#e6c033" };
        g.m.res = null;
      },
      point: function (g, type, x, y) {
        var f = g.m.fruit;
        if (type === "down") { if (dist(x, y, f.x, f.y) < f.r * 2) f.held = true; }
        else if (type === "move") { if (f.held) { f.x = x; f.y = y; } }
        else if (type === "up") {
          if (!f.held) return; f.held = false;
          var bins = [g.m.red, g.m.yellow], i;
          for (i = 0; i < 2; i++) {
            if (dist(f.x, f.y, bins[i].x, bins[i].y) < bins[i].r) {
              g.m.res = bins[i].key === g.m.correct ? "win" : "fail";
              jb(g, bins[i].x, bins[i].y, g.m.res === "win" ? "#69f0ae" : "#ff5b5b", 16); sfxp(g, g.m.res === "win" ? "coin" : "buzz"); return;
            }
          }
          f.x = g.W / 2; f.y = g.H * 0.42; // dropped in no bin — try again
        }
      },
      check: function (g) { return g.m.res; },
      draw: function (g, ctx) {
        var u = unit(g);
        [g.m.red, g.m.yellow].forEach(function (bn) {
          ctx.fillStyle = bn.c; rrect(ctx, bn.x - bn.r, bn.y - bn.r * 0.7, bn.r * 2, bn.r * 1.4, u * 0.03); ctx.fill();
          emoji(ctx, bn.key === "red" ? "🍎" : "🍌", bn.x, bn.y, bn.r * 0.9);
        });
        emoji(ctx, g.m.fruit.e, g.m.fruit.x, g.m.fruit.y, g.m.fruit.r * 2.3);
        label(ctx, "SORT 🍎→red   🍌→yellow", g.W / 2, g.H * 0.1, u * 0.05, "#fff");
      }
    }
  ];

  // ================= THE ENGINE =================
  var MICRO_LIMIT = 5;    // scaled seconds per microgame
  var READY_DUR = 1.15;   // "GET READY → verb" interstitial (real seconds)
  var WORD_EVERY = 5;     // a Word Break after every N clears
  var CREEP = 0.05, SPEED_CAP = 2.4;
  var START_LIVES = 3, MAX_LIVES = 5;

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("micro");
    // additive, never-renamed persistence
    stats.bestScore = stats.bestScore || 0;
    stats.totalCleared = stats.totalCleared || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap micro";
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="mmcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="mmmsg">🎪 Micro Mania</div>' +
      '<div class="grow" style="flex-wrap:wrap"><span id="mmscore">🏆 0</span><span id="mmlives">❤️❤️❤️</span>' +
      '<span id="mmsuper"></span><button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="mmbig"></div>' +
      '<div class="gover" id="mmq" style="display:none"></div>' +
      '<div class="gover" id="mmcard" style="display:none"></div>';
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

    var cv = wrap.querySelector("#mmcv"), ctx = cv.getContext("2d");
    var mmq = document.getElementById("mmq"), mmcard = document.getElementById("mmcard");
    var msgEl = document.getElementById("mmmsg"), bigEl = document.getElementById("mmbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    // shared context handed to every microgame
    var g = { W: 0, H: 0, t: 0, speed: 1, m: {}, superRound: false, sfx: sfx, juice: juice };
    var ghudEl = wrap.querySelector(".ghud");
    var DPR = Math.min(global.devicePixelRatio || 1, 2); // retina sharpen; game code stays in CSS px
    var safeT = 0; // Dynamic-Island top inset, probed off the .ghud env() padding

    function resize() {
      g.W = wrap.clientWidth || global.innerWidth || 360;
      g.H = wrap.clientHeight || global.innerHeight || 640;
      cv.width = Math.round(g.W * DPR); cv.height = Math.round(g.H * DPR);
      try { safeT = Math.max(0, (parseFloat(getComputedStyle(ghudEl).paddingTop) || 10) - 10); } catch (_) { safeT = 0; }
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- run state ----------
    var running = true, raf = 0, lastT = performance.now();
    var phase = "idle";        // idle | ready | play | word | over
    var cur = null, curId = null, verb = "", lastId = null;
    var lives = START_LIVES, score = 0, cleared = 0, speed = 1, superRound = false;
    var readyT = 0, over = false, paused = false, banked = false, statsSaved = false;
    var lastFmt = null;

    function big(m, col) { bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1"; setTimeout(function () { bigEl.style.opacity = "0"; }, 1000); }
    function updateHud() {
      document.getElementById("mmscore").textContent = "🏆 " + score;
      var hs = "", i; for (i = 0; i < lives; i++) hs += "❤️"; if (lives < START_LIVES) for (i = lives; i < START_LIVES; i++) hs += "🖤";
      document.getElementById("mmlives").textContent = hs;
      document.getElementById("mmsuper").textContent = superRound ? "⭐x2" : "";
    }

    // ---------- microgame flow ----------
    function pickNext() {
      var choices = MICROS.filter(function (mm) { return mm.id !== lastId; });
      var mm = choices[Math.floor(Math.random() * choices.length)];
      lastId = mm.id;
      return mm;
    }
    function nextMicro() {
      if (over) return;
      cur = pickNext(); curId = cur.id; verb = cur.verb;
      phase = "ready"; readyT = 0;
      msgEl.textContent = "🎪 " + verb;
    }
    function startPlay() {
      g.m = {}; g.t = 0; cur.init(g);
      phase = "play"; g.speed = speed; g.superRound = superRound;
    }
    // force straight into a microgame (test/demo hook)
    function forceMicro(id) {
      var mm = null, i; for (i = 0; i < MICROS.length; i++) if (MICROS[i].id === id) mm = MICROS[i];
      if (!mm || over) return;
      cur = mm; curId = mm.id; verb = mm.verb; lastId = mm.id;
      msgEl.textContent = "🎪 " + verb;
      startPlay();
    }

    function onWin() {
      if (over) return;
      var pts = superRound ? 2 : 1;
      score += pts; cleared++;
      speed = Math.min(SPEED_CAP, speed + CREEP);
      big(pts > 1 ? "⭐ SUPER! +2" : "NICE! +1", "#69f0ae");
      sfxp(g, "coin"); if (juice) juice.shake(4);
      superRound = false; // the super round is consumed by this microgame
      updateHud();
      if (cleared % WORD_EVERY === 0) openWordBreak(); else nextMicro();
    }
    function onFail() {
      if (over) return;
      lives -= 1; superRound = false;
      big("OUCH! 💔", "#ff6b6b"); sfxp(g, "buzz"); if (juice) juice.shake(9);
      updateHud();
      if (lives <= 0) runOver(); else nextMicro();
    }
    // poll the current microgame's verdict (also enforces the time limit)
    function tryResolve() {
      if (phase !== "play" || !cur) return;
      var v = cur.check(g);
      if (!v && g.t >= (cur.limit || MICRO_LIMIT)) v = cur.survive ? "win" : "fail";
      if (v === "win") onWin(); else if (v === "fail") onFail();
    }

    // ---------- 📚 word break ----------
    function openWordBreak() {
      if (over || !VQ) { nextMicro(); return; }
      phase = "word"; paused = true;
      msgEl.textContent = "📚 WORD BREAK!";
      cv._lastQ = VQ.miniQuiz(mmq, words, store, {
        title: "🎪 WORD BREAK — answer for a ⭐ SUPER ROUND & +1 ❤!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt; paused = false;
          if (ok) {
            lives = Math.min(MAX_LIVES, lives + 1);
            superRound = true;
            big("⭐ SUPER ROUND! +1 ❤ — next game pays DOUBLE!", "#ffd23f");
            if (sfx && sfx.fanfare) sfx.fanfare();
            if (juice) juice.shake(6);
          } else big("No worries — the chain rolls on!", "#8ecdf7");
          updateHud();
          nextMicro();
        }
      });
    }

    // ---------- banking (ONE guarded path) ----------
    function rewards() {
      return {
        win: cleared >= 15, score: score,
        rankPtsDelta: Math.min(10, 2 + Math.floor(cleared / 3)),
        xp: Math.min(80, 6 + cleared * 4),
        gems: 4 + cleared * 2
      };
    }
    function bankRun() {
      if (banked) return null;
      banked = true;
      var rw = rewards();
      var res = store.recordGame ? store.recordGame("micro", rw) : null;
      return { rw: rw, res: res };
    }
    function endRunStats() {
      if (statsSaved) return; statsSaved = true;
      if (score > (stats.bestScore || 0)) stats.bestScore = score;
      stats.totalCleared = (stats.totalCleared || 0) + cleared;
      if (store.save) store.save();
    }
    function runOver() {
      if (over) return;
      over = true; paused = true; phase = "over";
      endRunStats();
      var b = bankRun();
      if (sfx && sfx.buzz) sfx.buzz();
      if (juice) juice.shake(12);
      showEnd(b ? b.rw : rewards());
    }
    function showEnd(rw) {
      mmcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">🎪</div>' +
        '<div class="wqtitle" style="font-size:20px">Run over!</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">🏆 Score <b>' + score + '</b> · 🥇 Best <b>' + (stats.bestScore || 0) + '</b></div>' +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">' + cleared + ' microgames cleared · ' + (stats.totalCleared || 0) + ' all-time</div>' +
        '<button class="submit big-next" id="mmreplay" type="button">Replay ➜</button>' +
        '<button class="wqskip" id="mmleave" type="button">Leave</button></div>';
      mmcard.style.display = "flex";
      if (sfx && sfx.fanfare && score >= (stats.bestScore || 0) && score > 0) sfx.fanfare();
      document.getElementById("mmreplay").onclick = function () { mmcard.style.display = "none"; begin(); };
      document.getElementById("mmleave").onclick = exit;
    }

    // ---------- run lifecycle ----------
    function begin() {
      lives = START_LIVES; score = 0; cleared = 0; speed = 1; superRound = false;
      over = false; paused = false; banked = false; statsSaved = false;
      lastId = null; cur = null; curId = null; verb = "";
      mmcard.style.display = "none"; mmq.style.display = "none";
      updateHud();
      big("🎪 MICRO MANIA!", "#ffd23f");
      nextMicro();
    }

    // ---------- input: ONE dispatcher, canvas-only listeners ----------
    function dispatch(type, x, y) {
      if (paused || over || phase !== "play" || !cur) return;
      cur.point(g, type, x, y);
      tryResolve();
    }
    function pt(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    cv.addEventListener("mousedown", function (e) { var p = pt(e); dispatch("down", p.x, p.y); });
    cv.addEventListener("mousemove", function (e) { var p = pt(e); dispatch("move", p.x, p.y); });
    cv.addEventListener("mouseup", function (e) { var p = pt(e); dispatch("up", p.x, p.y); });
    cv.addEventListener("touchstart", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); dispatch("down", p.x, p.y); }, { passive: false });
    cv.addEventListener("touchmove", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); dispatch("move", p.x, p.y); }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); var p = pt(e, e.changedTouches[0]); dispatch("up", p.x, p.y); }, { passive: false });

    // ---------- simulation ----------
    function update(dt) {
      if (phase === "ready") {
        readyT += dt;
        if (readyT >= READY_DUR) startPlay();
      } else if (phase === "play") {
        var sdt = dt * speed;
        g.t += sdt;
        if (cur.step) cur.step(g, sdt); // input-only micros (feed/count/match/sort) have no per-frame sim
        tryResolve();
      }
      if (juice) juice.update(dt);
    }

    // ---------- drawing ----------
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // buffer is retina; all drawing stays in CSS px
      var u = Math.min(g.W, g.H);
      var hue = (cleared * 40) % 360;
      var bg = ctx.createLinearGradient(0, 0, 0, g.H);
      bg.addColorStop(0, "hsl(" + hue + ",45%,22%)"); bg.addColorStop(1, "hsl(" + ((hue + 40) % 360) + ",50%,10%)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, g.W, g.H);
      if (phase === "play" && cur) {
        cur.draw(g, ctx);
        // 5-second clock as a thin top bar
        var frac = Math.max(0, 1 - g.t / (cur.limit || MICRO_LIMIT));
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, safeT, g.W, u * 0.02);
        ctx.fillStyle = frac < 0.3 ? "#ff6b6b" : "#ffd23f"; ctx.fillRect(0, safeT, g.W * frac, u * 0.02);
        if (g.superRound) { label(ctx, "⭐ SUPER ROUND ×2", g.W / 2, g.H * 0.94, u * 0.055, "#ffd23f"); }
      } else if (phase === "ready") {
        label(ctx, readyT < 0.5 ? "GET READY" : verb, g.W / 2, g.H * 0.46, u * (readyT < 0.5 ? 0.11 : 0.2), "#fff");
        if (readyT >= 0.5) label(ctx, "❤ " + lives + "   speed ×" + speed.toFixed(2), g.W / 2, g.H * 0.62, u * 0.05, "#ffd23f");
      }
      if (juice) juice.draw(ctx);
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (!paused && !over) update(dt);
      draw();
    }

    // ---------- exit / banking ----------
    function bankExit() {
      if (over) return; // run-over already banked
      if (score <= 0 && cleared === 0) return; // an untouched run banks nothing
      endRunStats();
      var b = bankRun();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🎪 Micro run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
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
    cv._micro = {
      state: function () {
        return {
          current: curId, verb: verb, score: score, lives: lives, speed: speed,
          t: g.t, banked: banked, over: over, superRound: superRound, cleared: cleared
        };
      },
      begin: begin,
      force: function (id) { forceMicro(id); },
      win: function () { onWin(); },
      fail: function () { onFail(); },
      point: function (type, x, y) { dispatch(type, x, y); },
      wordBreak: function () { openWordBreak(); },
      micros: function () { return MICROS.map(function (mm) { return mm.id; }); }
    };

    // ---------- boot ----------
    begin();
    if (global._microdemo) { // screenshot seed: DODGE! mid-action, mid-chain, super round armed
      global._microdemo = 0;
      score = 7; cleared = 7; superRound = true;
      forceMicro("dodge");
      var u = Math.min(g.W, g.H), i;
      for (i = 0; i < 4; i++) g.m.anvils.push({ x: g.W * (0.2 + 0.2 * i), y: g.H * (0.18 + 0.16 * i), vy: g.H * 0.5, r: u * 0.06 });
      g.superRound = true;
      paused = true;
      updateHud();
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxMicro = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
