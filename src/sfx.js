/*
 * Voblox — shared sound + "juice" kit.
 * One WebAudio context for the whole app (iOS unlock handled once, on first gesture).
 * No game may create its own AudioContext. Tones schedule via the audio clock
 * (not setTimeout) so they stay correct under the test harness's virtual timers.
 * VobloxJuice() gives each canvas game floating text / particle bursts / screen shake.
 */
(function (global) {
  var actx = null, muted = false;

  function ctx() {
    if (!actx) { try { actx = new (global.AudioContext || global.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === "suspended") { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  function unlock() { ctx(); }
  // iOS starts audio suspended until a user gesture — self-install one-shot unlockers.
  if (global.document && global.document.addEventListener) {
    ["touchstart", "mousedown", "keydown"].forEach(function (ev) {
      global.document.addEventListener(ev, unlock, { once: true, passive: true });
    });
  }

  function tone(freq, dur, type, vol, delayS) {
    if (muted) return;
    try {
      var a = ctx(); if (!a) return;
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      o.connect(g); g.connect(a.destination);
      var t = a.currentTime + (delayS || 0);
      g.gain.setValueAtTime(vol || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.09));
      o.start(t); o.stop(t + (dur || 0.1) + 0.02);
    } catch (e) {}
  }
  function sweep(f1, f2, dur, type, vol) {
    if (muted) return;
    try {
      var a = ctx(); if (!a) return;
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || "sine"; o.frequency.value = f1;
      o.connect(g); g.connect(a.destination);
      var t = a.currentTime;
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
      g.gain.setValueAtTime(vol || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }

  var Sfx = {
    unlock: unlock,
    tone: tone,
    sweep: sweep,
    mute: function (on) { muted = !!on; },
    chime: function () { tone(660, 0.12, "triangle", 0.06); tone(990, 0.16, "triangle", 0.06, 0.11); },
    buzz: function () { tone(130, 0.2, "sawtooth", 0.06); },
    pop: function () { tone(540, 0.05, "square", 0.05); },
    coin: function () { tone(880, 0.06, "square", 0.05); tone(1318, 0.1, "square", 0.05, 0.07); },
    whoosh: function () { sweep(400, 90, 0.18, "sine", 0.05); },
    thud: function () { tone(110, 0.18, "sawtooth", 0.07); },
    fanfare: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.16, "triangle", 0.07, i * 0.1); });
      tone(1318, 0.3, "triangle", 0.06, 0.42);
    },
    // small DOM toast (shared look across pages)
    toast: function (msg) {
      try {
        var t = global.document.createElement("div");
        t.className = "vtoast"; t.innerHTML = msg; // internal strings only (may carry the Vobux icon)
        global.document.body.appendChild(t);
        requestAnimationFrame(function () { t.style.opacity = "1"; });
        setTimeout(function () { t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 400); }, 2400);
      } catch (e) {}
    }
  };

  // Per-game canvas juice: call j.update(dt) + j.draw(ctx) from the game loop;
  // add j.ox / j.oy to your camera for screen shake.
  function Juice() {
    var parts = [], texts = [], shakeP = 0;
    var j = {
      ox: 0, oy: 0,
      text: function (x, y, str, color) { texts.push({ x: x, y: y, str: str, color: color || "#fff", life: 1 }); },
      burst: function (x, y, color, n) {
        for (var i = 0; i < (n || 10); i++) {
          parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 260, vy: -60 - Math.random() * 200,
                       color: color || "#ffd740", life: 0.55 + Math.random() * 0.25, size: 4 + Math.random() * 5 });
        }
      },
      trail: function (x, y, item) { // item: {emoji, color} from the equipped trail
        if (!item) return;
        parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 40, vy: -10 - Math.random() * 30,
                     emoji: item.emoji, color: item.color || "#fff", life: 0.5, size: 11 + Math.random() * 4 });
      },
      shake: function (p) { shakeP = Math.max(shakeP, p || 6); },
      update: function (dt) {
        for (var i = parts.length - 1; i >= 0; i--) {
          var p = parts[i]; p.life -= dt * 1.4; p.vy += 480 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.life <= 0) parts.splice(i, 1);
        }
        for (var k = texts.length - 1; k >= 0; k--) {
          var tx = texts[k]; tx.life -= dt * 1.0; tx.y -= 46 * dt;
          if (tx.life <= 0) texts.splice(k, 1);
        }
        shakeP = Math.max(0, shakeP - dt * 26);
        j.ox = (Math.random() - 0.5) * shakeP; j.oy = (Math.random() - 0.5) * shakeP;
      },
      draw: function (c) {
        c.save();
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i]; c.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
          if (p.emoji) { c.font = Math.round(p.size + 4) + "px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(p.emoji, p.x, p.y); }
          else { c.fillStyle = p.color; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
        }
        c.globalAlpha = 1;
        for (var k = 0; k < texts.length; k++) {
          var t = texts[k]; c.globalAlpha = Math.max(0, Math.min(1, t.life * 1.4));
          c.font = "bold 20px Trebuchet MS, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
          c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,.55)"; c.strokeText(t.str, t.x, t.y);
          c.fillStyle = t.color; c.fillText(t.str, t.x, t.y);
        }
        c.restore();
      }
    };
    return j;
  }

  global.VobloxSfx = Sfx;
  global.VobloxJuice = Juice;
})(typeof window !== "undefined" ? window : globalThis);
