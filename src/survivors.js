/*
 * Voblox arcade game — 🧟 WORD SURVIVORS (a kid-friendly Vampire-Survivors-lite).
 * A 🧙 wizard kid walks an endless meadow while cute monsters swarm in. Your
 * WEAPONS AUTO-FIRE — the game is DODGING and positioning. Killed monsters drop
 * 💎 XP gems that vacuum to you; the bar fills → LEVEL UP.
 *
 * VOCAB IS THE POWER, NEVER PUNISHMENT:
 *   - Every LEVEL UP asks a word (miniQuiz). CORRECT → pick 1 of 3 upgrades (a new
 *     weapon or a boost). WRONG → you STILL level and get a random small boost —
 *     never nothing, always kind.
 * THREE MODES: ⚔️ Classic (10 min), 🌙 Nightmare (20 min, tougher), ♾️ Endless (forever).
 * Survive the clock to WIN (Endless never wins — score is survival time). Death ends the run.
 * Economy: study pays via miniQuiz (store.record) plus ONE recordGame("survivors")
 * per run, banked on death, win, quit, AND app-close. Best time/kills/mode-bests persist.
 */
(function (global) {
  var VQ = global.VobloxQuestions;

  // cute monster roster (emoji + splash color + base stats). big:true are bosses.
  var MOBS = {
    slime: { e: "🟢", c: "#6ad46a", hp: 10, speed: 42, dmg: 1, r: 16 },
    bat: { e: "🦇", c: "#9a7ad4", hp: 7, speed: 74, dmg: 1, r: 14 },
    ghost: { e: "👻", c: "#cfd6ff", hp: 14, speed: 54, dmg: 1, r: 17 },
    mushroom: { e: "🍄", c: "#ff7a7a", hp: 22, speed: 34, dmg: 1, r: 18 },
    // ---- new tougher monsters ----
    knight: { e: "🛡", c: "#b8c0d0", hp: 50, speed: 26, dmg: 2, r: 18 },     // slow wall, hp x5
    charger: { e: "🐗", c: "#d99a5b", hp: 16, speed: 24, dmg: 2, r: 16 },    // windup then dash
    wisp: { e: "💨", c: "#bfeaff", hp: 5, speed: 12, dmg: 1, r: 14 },        // blinks closer, fragile
    splitter: { e: "🟣", c: "#c07adf", hp: 18, speed: 40, dmg: 1, r: 17 },   // splits into 2 minis
    stinger: { e: "🦂", c: "#e0b24a", hp: 12, speed: 30, dmg: 1, r: 15 },    // fires slow darts
    skeleton: { e: "🦴", c: "#e8e8f0", hp: 20, speed: 60, dmg: 1, r: 15 },   // bone-king summon
    // ---- bosses (rotate) ----
    boss: { e: "👹", c: "#ff5b5b", hp: 900, speed: 40, dmg: 2, r: 40, big: true, bk: "brute" },
    grabboss: { e: "🐙", c: "#c86bd4", hp: 1100, speed: 34, dmg: 2, r: 42, big: true, bk: "grab" },
    boneking: { e: "💀", c: "#e8e8f0", hp: 1000, speed: 38, dmg: 2, r: 42, big: true, bk: "bone" }
  };
  var MOB_KINDS = ["slime", "bat", "ghost", "mushroom"];
  var BOSS_KINDS = ["boss", "grabboss", "boneking"];

  // modes: Classic keeps the shipped balance; Nightmare/Endless are the long haul
  var MODES = {
    classic: { id: "classic", name: "Classic", emoji: "⚔️", len: 600, ramp: 1, eliteMul: 1, mobCap: 120, bossEvery: 0 },
    nightmare: { id: "nightmare", name: "Nightmare", emoji: "🌙", len: 1200, ramp: 1.5, eliteMul: 2, mobCap: 150, bossEvery: 180 },
    endless: { id: "endless", name: "Endless", emoji: "♾️", len: 0, ramp: 1.25, eliteMul: 1.5, mobCap: 150, bossEvery: 240 }
  };

  // upgrades offered on level-up: auto weapons + boosts (plus weapon level-ups)
  var UPGRADES = {
    wand: { name: "Magic Wand", emoji: "🪄", weapon: true, tip: "+bolt power" },
    firering: { name: "Fire Ring", emoji: "🔥", weapon: true, tip: "orbiting flames" },
    starrain: { name: "Star Rain", emoji: "⭐", weapon: true, tip: "falling stars" },
    boomerang: { name: "Boomerang", emoji: "🌀", weapon: true, tip: "sweeps out & back" },
    aura: { name: "Garlic Aura", emoji: "🧄", weapon: true, tip: "damage circle" },
    bow: { name: "Piercing Bow", emoji: "🏹", weapon: true, tip: "line shot pierces" },
    zap: { name: "Chain Zap", emoji: "⚡", weapon: true, tip: "jumps between foes" },
    frost: { name: "Frost Shards", emoji: "🧊", weapon: true, tip: "slows what it hits" },
    bomb: { name: "Cherry Bombs", emoji: "💣", weapon: true, tip: "boom on a crowd" },
    speed: { name: "Swift Boots", emoji: "👟", tip: "+move speed" },
    magnet: { name: "Gem Magnet", emoji: "🧲", tip: "+pickup range" },
    maxheart: { name: "Extra Heart", emoji: "❤️", tip: "+1 max heart" },
    fasterfire: { name: "Quick Cast", emoji: "⚡", tip: "weapons fire faster" },
    armor: { name: "Armor", emoji: "🛡", tip: "-12% damage each" },
    lucky: { name: "Lucky Gems", emoji: "🍀", tip: "+20% gem value" },
    regen: { name: "Regen", emoji: "💖", tip: "heal over time" }
  };

  // evolutions: weapon at Lv4 + a paired boost → a golden evolved form (one-time)
  var EVOS = {
    wand: { id: "scepter", need: "fasterfire", name: "Star Scepter", emoji: "🌟" },
    firering: { id: "solar", need: "maxheart", name: "Solar Crown", emoji: "☄️" },
    bow: { id: "stormvolley", need: "armor", name: "Storm Volley", emoji: "🎯" },
    zap: { id: "tempest", need: "lucky", name: "Tempest", emoji: "🌩" }
  };
  var EVO_BY_ID = {};
  for (var _ek in EVOS) { if (EVOS.hasOwnProperty(_ek)) EVO_BY_ID[EVOS[_ek].id] = _ek; }

  function start(opts) {
    var words = opts.words, store = opts.store;
    var stats = store.game("survivors");
    // additive, never-renamed save fields
    stats.bestTimeS = stats.bestTimeS || 0;
    stats.bestKills = stats.bestKills || 0;
    stats.wins = stats.wins || 0;
    stats.bestNightmareS = stats.bestNightmareS || 0;
    stats.bestEndlessS = stats.bestEndlessS || 0;
    stats.evolutions = stats.evolutions || 0;

    var wrap = document.createElement("div");
    wrap.className = "gamewrap survivors";
    // full-screen canvas + touch lockdown, inline so this game needs no new CSS
    wrap.style.padding = "0"; wrap.style.overflow = "hidden"; wrap.style.touchAction = "none";
    wrap.innerHTML =
      '<canvas id="svcv" style="position:absolute;inset:0;display:block;width:100%;height:100%"></canvas>' +
      '<div class="ghud"><div class="clue" id="svmsg">🧟 Word Survivors — dodge the swarm!</div>' +
      '<div class="grow" style="flex-wrap:wrap"><span id="svhearts">❤️❤️❤️❤️❤️</span><span id="svtime">10:00</span>' +
      '<span id="svelapsed">⏱ 0:00</span><span id="svkills">🧟 0</span>' +
      '<span id="svlvl">Lv 1</span>' +
      '<button class="bossquit" id="quit">Leave</button></div></div>' +
      '<div class="gmsg" id="svbig"></div>' +
      // 💥🌀 active-ability buttons (bottom-right, die with the wrap)
      '<div id="svab" style="position:absolute;right:calc(env(safe-area-inset-right, 0px) + 10px);bottom:calc(env(safe-area-inset-bottom, 0px) + 14px);display:flex;flex-direction:column;gap:10px;z-index:8">' +
      '<button type="button" id="svnova" style="width:64px;height:64px;background:rgba(40,20,60,.72);border:2px solid rgba(255,210,63,.6);border-radius:16px;color:#ffd23f;font-family:inherit;padding:0;line-height:1.05;cursor:pointer"><div style="font-size:24px">💥</div><div class="abt" id="svnovat" style="font-size:10px;font-weight:900">NOVA</div></button>' +
      '<button type="button" id="svdash" style="width:64px;height:64px;background:rgba(20,36,60,.72);border:2px solid rgba(120,220,255,.6);border-radius:16px;color:#8ef;font-family:inherit;padding:0;line-height:1.05;cursor:pointer"><div style="font-size:24px">🌀</div><div class="abt" id="svdasht" style="font-size:10px;font-weight:900">DASH</div></button>' +
      '</div>' +
      '<div class="gover" id="svmode" style="display:none"></div>' +
      '<div class="gover" id="svq" style="display:none"></div>' +
      '<div class="gover" id="svpick" style="display:none"></div>' +
      '<div class="gover" id="svcard" style="display:none"></div>';
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

    var cv = wrap.querySelector("#svcv"), ctx = cv.getContext("2d");
    var svq = document.getElementById("svq"), svpick = document.getElementById("svpick"), svcard = document.getElementById("svcard");
    var msgEl = document.getElementById("svmsg"), bigEl = document.getElementById("svbig");
    var juice = global.VobloxJuice ? global.VobloxJuice() : null;
    var sfx = global.VobloxSfx || null;

    var ghudEl = wrap.querySelector(".ghud"), svabEl = document.getElementById("svab");
    var W, H, hudH = 60, safeB = 0;
    var DPR = Math.min(global.devicePixelRatio || 1, 2); // retina sharpen; game code stays in CSS px
    function measureHud() { hudH = ghudEl ? Math.round(ghudEl.getBoundingClientRect().height) : 60; }
    function resize() {
      W = wrap.clientWidth || global.innerWidth || 360;
      H = wrap.clientHeight || global.innerHeight || 640;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      measureHud();
      // home-indicator inset, probed off the ability buttons' env()-based bottom (14px base)
      try { safeB = Math.max(0, (parseFloat(getComputedStyle(svabEl).bottom) || 14) - 14); } catch (_) { safeB = 0; }
    }
    resize();
    window.addEventListener("resize", resize);

    var RUN_LEN = 600, MOBCAP = 120, NOVA_R = 140; // RUN_LEN/MOBCAP reset per mode
    var HERO_R = 18, INVULN = 1.2, MAGNET0 = 46;

    // ---------- run state (reused arrays, no per-frame allocation churn) ----------
    var running = true, raf = 0, lastT = performance.now();
    var mobs = [], shots = [], drops = [], flames = [], darts = [], zones = []; // reused
    var hero = { x: 0, y: 0, fx: 1, fy: 0 };
    var mvx = 0, mvy = 0; // resolved input this frame (programmatic/test)
    var keys = {}, stick = null;
    var hearts, maxHearts, invuln, runT, kills, level, xp, xpNeed, pendingLevels;
    var weapons, speedMul, magnetR, fireRateMul, boss;
    var over, won, paused, banked, spawnT, bossFlags, lastFmt, started;
    var fireT, starT, boomT, ringAng, bowT, zapT, frostT, bombT;
    var curMode = MODES.classic, novaCd, dashCd, dashInvuln, armorStacks, luckMul, regenT, dmgCarry, boostsOwned;
    var bossCount, lastMin, mobId;

    function setTxt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
    function big(m, col) {
      bigEl.textContent = m; bigEl.style.color = col || "#fff"; bigEl.style.opacity = "1";
      setTimeout(function () { bigEl.style.opacity = "0"; }, 1200);
    }
    function fmtSecs(s) { s = Math.floor(s || 0); var m = Math.floor(s / 60), ss = s % 60; return m + ":" + (ss < 10 ? "0" : "") + ss; }
    function fmtTime(s) {
      if (!RUN_LEN) return "∞";
      var left = Math.max(0, Math.ceil(RUN_LEN - s));
      var m = Math.floor(left / 60), ss = left % 60;
      return m + ":" + (ss < 10 ? "0" : "") + ss;
    }
    function updateHud() {
      var hs = "", i;
      for (i = 0; i < maxHearts; i++) hs += i < hearts ? "❤️" : "🖤";
      setTxt("svhearts", hs);
      setTxt("svtime", fmtTime(runT));
      setTxt("svelapsed", "⏱ " + fmtSecs(runT));
      setTxt("svkills", "🧟 " + kills);
      setTxt("svlvl", "Lv " + level);
      var nt = document.getElementById("svnovat"), dt2 = document.getElementById("svdasht");
      if (nt) nt.textContent = novaCd > 0 ? Math.ceil(novaCd) + "s" : "NOVA";
      if (dt2) dt2.textContent = dashCd > 0 ? Math.ceil(dashCd) + "s" : "DASH";
      var nb = document.getElementById("svnova"), db = document.getElementById("svdash");
      if (nb) nb.style.opacity = novaCd > 0 ? "0.5" : "1";
      if (db) db.style.opacity = dashCd > 0 ? "0.5" : "1";
      measureHud(); // hearts row can wrap taller as max hearts grow
    }

    function begin(mode) {
      curMode = MODES[mode] || MODES.classic;
      RUN_LEN = curMode.len; MOBCAP = curMode.mobCap;
      mobs.length = 0; shots.length = 0; drops.length = 0; flames.length = 0; darts.length = 0; zones.length = 0;
      hero.x = 0; hero.y = 0; hero.fx = 1; hero.fy = 0;
      mvx = 0; mvy = 0; keys = {}; stick = null;
      maxHearts = 5; hearts = 5; invuln = 0; dashInvuln = 0;
      runT = 0; kills = 0; level = 1; xp = 0; xpNeed = 5; pendingLevels = 0;
      weapons = { wand: 1 }; speedMul = 1; magnetR = MAGNET0; fireRateMul = 1; boss = null;
      armorStacks = 0; luckMul = 1; boostsOwned = {}; regenT = 45; dmgCarry = 0;
      novaCd = 0; dashCd = 0; bossCount = 0; lastMin = 0; mobId = 0;
      over = false; won = false; paused = false; banked = false; started = true;
      spawnT = 0.6; bossFlags = {}; fireT = 0; starT = 1.4; boomT = 1; ringAng = 0;
      bowT = 0.6; zapT = 1; frostT = 0.7; bombT = 1.4;
      svcard.style.display = "none"; svq.style.display = "none"; svpick.style.display = "none";
      var mm = document.getElementById("svmode"); if (mm) mm.style.display = "none";
      msgEl.textContent = curMode.emoji + " " + curMode.name + " — dodge the swarm!";
      updateHud();
      big("🧙 SURVIVE!", "#8ef");
    }

    // ---------- mode select (shown only on the real initial boot) ----------
    function showModeSelect() {
      started = false; paused = true; over = false;
      var el = document.getElementById("svmode");
      var rows = [
        ["classic", "⚔️", "Classic", "10 minutes · the classic run"],
        ["nightmare", "🌙", "Nightmare", "20 min · elites & bosses galore"],
        ["endless", "♾️", "Endless", "survive forever · beat your time"]
      ];
      el.innerHTML = '<div class="wqcard" style="text-align:center;max-width:560px">' +
        '<div style="font-size:42px">🧟</div><div class="wqtitle" style="font-size:22px">Word Survivors</div>' +
        '<div style="margin:2px 0 10px;color:#5a6b7a;font-weight:bold">Best 🌙 ' + fmtSecs(stats.bestNightmareS) + ' · ♾️ ' + fmtSecs(stats.bestEndlessS) + ' · 🏆 ' + (stats.wins || 0) + ' wins</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
        rows.map(function (r) {
          return '<button class="embtn" style="min-width:150px" data-mode="' + r[0] + '"><span class="ebl">' + r[1] + " " + r[2] + '</span><span class="ebs">' + r[3] + "</span></button>";
        }).join("") + '</div>' +
        '<div style="font-size:11px;color:#8a98a8;margin-top:8px">WASD/arrows or drag · 💥 NOVA & 🌀 DASH buttons</div></div>';
      el.style.display = "flex";
      Array.prototype.forEach.call(el.querySelectorAll("[data-mode]"), function (b) {
        b.onclick = function () { begin(b.getAttribute("data-mode")); };
      });
    }

    // ---------- economy: ONE guarded bank path ----------
    function rewards(w) {
      var mins = Math.floor(runT / 60);
      return {
        win: !!w, score: kills + mins,
        rankPtsDelta: w ? 12 : Math.min(8, 1 + mins),
        xp: Math.min(80, 6 + kills + mins * 4 + (w ? 20 : 0)),
        gems: 3 + Math.floor(kills / 3) + mins * 2 + (w ? 20 : 0)
      };
    }
    function persistBests() {
      var ts = Math.floor(runT);
      if (ts > (stats.bestTimeS || 0)) stats.bestTimeS = ts;
      if (kills > (stats.bestKills || 0)) stats.bestKills = kills;
      if (curMode.id === "nightmare" && ts > (stats.bestNightmareS || 0)) stats.bestNightmareS = ts;
      if (curMode.id === "endless" && ts > (stats.bestEndlessS || 0)) stats.bestEndlessS = ts;
      if (won) stats.wins = (stats.wins || 0) + 1;
      if (store.save) store.save();
    }
    function bankRun(w) {
      if (banked) return null;
      banked = true;
      var rw = rewards(w);
      var res = store.recordGame ? store.recordGame("survivors", rw) : null;
      return { rw: rw, res: res };
    }

    function endRun(w) {
      if (over) return;
      over = true; won = !!w; paused = true;
      var bank = bankRun(w) || { rw: rewards(w) };
      persistBests();
      showCard(bank.rw);
      if (w) { if (sfx && sfx.fanfare) sfx.fanfare(); if (juice) juice.shake(6); }
      else { if (sfx && sfx.buzz) sfx.buzz(); if (juice) juice.shake(10); }
    }
    function showCard(rw) {
      var survived = Math.floor(runT), sm = Math.floor(survived / 60), ss = survived % 60;
      var wl = [], k;
      for (k in weapons) if (weapons.hasOwnProperty(k)) {
        var u = UPGRADES[k]; wl.push(u ? u.emoji : (EVO_BY_ID[k] ? EVOS[EVO_BY_ID[k]].emoji : "✨"));
      }
      var endlessLine = "";
      if (curMode.id === "endless") {
        var pb = stats.bestEndlessS || 0;
        endlessLine = '<div style="font-size:13px;color:#5a6b7a;margin:2px 0">♾️ Best survival <b>' + fmtSecs(pb) + '</b>' + (survived >= pb ? ' — NEW BEST! 🎉' : '') + '</div>';
      }
      svcard.innerHTML = '<div class="wqcard" style="text-align:center">' +
        '<div style="font-size:46px">' + (won ? "🏆" : "🧟") + '</div>' +
        '<div class="wqtitle" style="font-size:20px">' + (won ? "YOU SURVIVED " + curMode.name.toUpperCase() + "!" : "The swarm got you…") + '</div>' +
        '<div style="margin:3px 0;color:#5a6b7a;font-weight:bold">' + curMode.emoji + ' ' + curMode.name + ' mode</div>' +
        '<div style="margin:6px 0;font-weight:900;color:#2f9e44;font-size:17px">+' + rw.gems +
        ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> · +' + rw.xp + ' XP</div>' +
        '<div style="margin:4px 0;font-size:15px">⏱ Survived <b>' + sm + ":" + (ss < 10 ? "0" : "") + ss +
        '</b> · 🧟 <b>' + kills + '</b> munched · Lv <b>' + level + '</b></div>' +
        '<div style="font-size:17px;margin:2px 0">' + (wl.join(" ") || "🪄") + '</div>' +
        endlessLine +
        '<div style="font-size:12px;color:#5a6b7a;margin-bottom:6px">🏅 Best time <b>' + fmtSecs(stats.bestTimeS || 0) +
        '</b> · best kills ' + (stats.bestKills || 0) + '</div>' +
        '<button class="submit big-next" id="svreplay" type="button">Play again ➜</button>' +
        '<button class="wqskip" id="svleave" type="button">Leave</button></div>';
      svcard.style.display = "flex";
      document.getElementById("svreplay").onclick = function () { svcard.style.display = "none"; showModeSelect(); };
      document.getElementById("svleave").onclick = exit;
    }

    // ---------- level up: word gate → upgrade picker (or kind boost) ----------
    function addXp(amount) {
      xp += amount;
      while (xp >= xpNeed) { xp -= xpNeed; pendingLevels++; xpNeed = 5 + level * 3 + pendingLevels * 2; }
      if (pendingLevels > 0 && !paused && !over) openLevelQuiz();
    }
    function openLevelQuiz() {
      if (over) return;
      paused = true;
      cv._lastQ = VQ.miniQuiz(svq, words, store, {
        title: "⭐ LEVEL UP! Answer a word to power up!",
        lastFormat: lastFmt,
        cb: function (ok, res, fmt) {
          lastFmt = fmt;
          level++; updateHud();
          if (ok) { showPicker(); }
          else { applyRandomBoost(); afterLevel(); }
        }
      });
    }
    function boostIds() { return ["speed", "magnet", "maxheart", "fasterfire", "armor", "lucky", "regen"]; }
    function applyRandomBoost() {
      var b = boostIds();
      var id = b[Math.floor(Math.random() * b.length)];
      applyUpgrade(id);
      big("✨ " + UPGRADES[id].emoji + " " + UPGRADES[id].name + " (bonus)!", "#8ecdf7");
    }
    function afterLevel() {
      pendingLevels--;
      if (pendingLevels > 0 && !over) openLevelQuiz();
      else { paused = false; svq.style.display = "none"; svpick.style.display = "none"; }
    }
    // 3 offers: prefer new weapons, then owned-weapon level-ups + boosts
    function offerOptions() {
      var pool = [], w;
      ["firering", "starrain", "boomerang", "aura", "bow", "zap", "frost", "bomb"].forEach(function (id) { if (!weapons[id]) pool.push(id); });
      for (w in weapons) if (weapons.hasOwnProperty(w) && !EVO_BY_ID[w] && UPGRADES[w]) pool.push(w);
      boostIds().forEach(function (id) { pool.push(id); });
      // shuffle, then de-dup keeping variety, take 3
      for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
      var out = [];
      for (var k = 0; k < pool.length && out.length < 3; k++) if (out.indexOf(pool[k]) < 0) out.push(pool[k]);
      var bi = boostIds();
      while (out.length < 3) out.push(bi[out.length % bi.length]);
      return out;
    }
    function showPicker() {
      var picks = offerOptions();
      var evo = evolveReady();
      if (evo && picks.indexOf(evo) < 0) { picks = [evo].concat(picks); picks = picks.slice(0, 3); }
      svpick.innerHTML = '<div class="wqcard" style="text-align:center"><div style="font-size:34px">⭐</div>' +
        '<div class="wqtitle" style="font-size:19px">Correct! Choose your power-up:</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px">' +
        picks.map(function (id) {
          if (EVO_BY_ID[id]) {
            var e = EVOS[EVO_BY_ID[id]];
            return '<button class="embtn" style="min-width:132px;background:linear-gradient(135deg,#ffe98a,#ffb347);border:2px solid #ff9f1c;color:#5a3a00" data-up="' + id + '"><span class="ebl">' + e.emoji + " " + e.name + '</span><span class="ebs">✨ EVOLVE!</span></button>';
          }
          var u = UPGRADES[id], lv = weapons[id] || 0;
          var sub = u.weapon ? (lv > 0 ? "Lv " + (lv + 1) + " · " + u.tip : "NEW! " + u.tip) : u.tip;
          return '<button class="embtn" style="min-width:132px" data-up="' + id + '"><span class="ebl">' + u.emoji + " " + u.name + '</span><span class="ebs">' + sub + "</span></button>";
        }).join("") + "</div></div>";
      svpick.style.display = "flex";
      if (sfx && sfx.chime) sfx.chime();
      Array.prototype.forEach.call(svpick.querySelectorAll("[data-up]"), function (b) {
        b.onclick = function () { pick(b.getAttribute("data-up")); };
      });
    }
    function pick(id) {
      if (svpick.style.display === "none" && !pendingLevels) return;
      if (EVO_BY_ID[id]) { forceEvolve(EVO_BY_ID[id]); }
      else {
        applyUpgrade(id);
        var u = UPGRADES[id] || { emoji: "✨", name: id };
        big(u.emoji + " " + u.name + "!", "#69f0ae");
      }
      if (juice) juice.burst(W / 2, H / 2, "#ffd23f", 18);
      if (sfx && sfx.fanfare) sfx.fanfare();
      svpick.style.display = "none";
      afterLevel();
    }
    function applyUpgrade(id) {
      var u = UPGRADES[id];
      if (u && u.weapon) { weapons[id] = (weapons[id] || 0) + 1; }
      else if (id === "speed") { speedMul += 0.12; boostsOwned.speed = 1; }
      else if (id === "magnet") { magnetR += 34; boostsOwned.magnet = 1; }
      else if (id === "maxheart") { maxHearts++; hearts = Math.min(maxHearts, hearts + 1); boostsOwned.maxheart = 1; }
      else if (id === "fasterfire") { fireRateMul = Math.max(0.35, fireRateMul * 0.85); boostsOwned.fasterfire = 1; }
      else if (id === "armor") { armorStacks = Math.min(4, armorStacks + 1); boostsOwned.armor = 1; }
      else if (id === "lucky") { luckMul += 0.2; boostsOwned.lucky = 1; }
      else if (id === "regen") { if (!boostsOwned.regen) { boostsOwned.regen = 1; regenT = 45; } }
      updateHud();
    }

    // ---------- evolutions ----------
    function wLevel(base) { var e = EVOS[base]; if (e && weapons[e.id]) return weapons[e.id]; return weapons[base] || 0; }
    function isEvo(base) { var e = EVOS[base]; return !!(e && weapons[e.id]); }
    function evolveReady() {
      var order = ["wand", "firering", "bow", "zap"];
      for (var i = 0; i < order.length; i++) {
        var base = order[i], e = EVOS[base];
        if (!e || weapons[e.id]) continue;
        if ((weapons[base] || 0) >= 4 && boostsOwned[e.need]) return e.id;
      }
      return null;
    }
    function forceEvolve(base) {
      var e = EVOS[base]; if (!e) return null;
      if (weapons[e.id]) return e.id;
      var lv = weapons[base] || 1;
      delete weapons[base];
      weapons[e.id] = lv;
      stats.evolutions = (stats.evolutions || 0) + 1;
      if (store.save) store.save();
      big("🌟 EVOLVED! " + e.emoji + " " + e.name + "!", "#ffd23f");
      if (juice) { juice.shake(8); juice.burst(W / 2, H / 2, "#ffd23f", 26); }
      if (sfx && sfx.fanfare) sfx.fanfare();
      updateHud();
      return e.id;
    }

    // ---------- combat helpers ----------
    function pickKind() {
      var mins = Math.floor(runT / 60) * (curMode.ramp || 1);
      var pool = ["slime", "bat", "ghost", "mushroom"];
      if (mins >= 1) pool.push("wisp");
      if (mins >= 2) pool.push("charger", "splitter");
      if (mins >= 3) pool.push("knight", "stinger");
      if (mins >= 5) pool.push("knight", "charger", "stinger");
      return pool[Math.floor(Math.random() * pool.length)];
    }
    function spawnMob(kind, ox, oy, opt) {
      opt = opt || {};
      if (mobs.length >= MOBCAP) return null;
      var def = MOBS[kind] || MOBS.slime;
      var mins = Math.floor(runT / 60);
      var diff = mins * (curMode.ramp || 1);
      var m = {
        id: ++mobId, kind: kind, e: def.e, c: def.c, r: def.r, big: !!def.big, bk: def.bk || null,
        x: hero.x + ox, y: hero.y + oy,
        hp: Math.round(def.hp * (1 + diff * 0.18)),
        maxHp: 1, speed: def.speed * (1 + diff * 0.05), dmg: def.dmg,
        hitCd: 0, bob: Math.random() * 6, slowT: 0, slowMul: 1, boomCd: 0, elite: false, mini: !!opt.mini
      };
      if (kind === "charger") { m.chPhase = "aim"; m.chT = 0.9 + Math.random() * 0.4; m.dvx = 0; m.dvy = 0; }
      else if (kind === "wisp") { m.blinkT = 2; }
      else if (kind === "stinger") { m.shootT = 1.0 + Math.random(); }
      if (opt.mini) { m.hp = Math.max(3, Math.round(m.hp * 0.4)); m.r = m.r * 0.7; m.dmg = 1; }
      var elite = opt.elite;
      if (elite === undefined && !m.big && !opt.mini) {
        var ch = Math.min(0.4, mins * 0.03) * (curMode.eliteMul || 1);
        elite = Math.random() < ch;
      }
      if (elite && !m.big) { m.elite = true; m.r = m.r * 1.6; m.hp = Math.round(m.hp * 4); m.dmg = m.dmg + 1; }
      m.maxHp = m.hp;
      mobs.push(m);
      return m;
    }
    function ringSpawn(kind) {
      var rad = Math.max(W, H) / 2 + 70;
      var a = Math.random() * Math.PI * 2;
      return spawnMob(kind || pickKind(), Math.cos(a) * rad, Math.sin(a) * rad);
    }
    function dropGem(x, y, val, heart) {
      drops.push({ x: x, y: y, val: val || 1, heart: !!heart });
    }
    function killMob(idx) {
      var m = mobs[idx];
      kills++;
      if (m.big) { dropGem(m.x, m.y, 10, false); if (boss === m) boss = null; }
      else if (m.elite) {
        for (var eg = 0; eg < 5; eg++) dropGem(m.x + (Math.random() - 0.5) * 24, m.y + (Math.random() - 0.5) * 24, 2, false);
        if (Math.random() < 0.25) dropGem(m.x, m.y, 1, true);
      } else { dropGem(m.x, m.y, 1, Math.random() < 0.06); }
      if (m.kind === "splitter" && !m.mini) {
        for (var sp = 0; sp < 2; sp++) spawnMob("splitter", (m.x - hero.x) + (Math.random() - 0.5) * 30, (m.y - hero.y) + (Math.random() - 0.5) * 30, { mini: true, elite: false });
      }
      if (juice) juice.burst(sx(m.x), sy(m.y), m.c, m.big ? 24 : (m.elite ? 16 : 8));
      if (sfx && sfx.pop && Math.random() < 0.4) sfx.pop();
      mobs.splice(idx, 1);
    }
    function damageMob(m, dmg) {
      m.hp -= dmg;
      if (m.hp <= 0) { var i = mobs.indexOf(m); if (i >= 0) killMob(i); return true; }
      return false;
    }
    function takeHit(dmg) {
      if (invuln > 0 || over || dashInvuln > 0) return;
      var eff = (dmg || 1) * (1 - 0.12 * armorStacks);
      dmgCarry += eff;
      var whole = Math.floor(dmgCarry + 1e-9); dmgCarry -= whole;
      if (whole > 0) hearts = Math.max(0, hearts - whole);
      invuln = INVULN;
      updateHud();
      if (juice) juice.shake(9);
      if (sfx && sfx.buzz) sfx.buzz();
      if (hearts <= 0) endRun(false);
    }

    // screen transforms (camera centered on hero)
    function sx(wx) { return W / 2 + (wx - hero.x); }
    function sy(wy) { return H / 2 + (wy - hero.y); }
    function nearest() {
      var best = null, bd = 1e9;
      for (var i = 0; i < mobs.length; i++) {
        var m = mobs[i], dx = m.x - hero.x, dy = m.y - hero.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = m; }
      }
      return best;
    }
    function nearestExcept(x, y, hit, maxR) {
      var best = null, bd = maxR * maxR;
      for (var i = 0; i < mobs.length; i++) {
        var m = mobs[i]; if (hit[m.id]) continue;
        var dx = m.x - x, dy = m.y - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = m; }
      }
      return best;
    }
    function clusterCenter() { if (!mobs.length) return null; var m = mobs[Math.floor(Math.random() * mobs.length)]; return { x: m.x, y: m.y }; }

    // ---------- active abilities ----------
    function nova() {
      if (novaCd > 0 || over || !started) return;
      novaCd = 18;
      for (var i = mobs.length - 1; i >= 0; i--) {
        var m = mobs[i], dx = m.x - hero.x, dy = m.y - hero.y;
        if (dx * dx + dy * dy < NOVA_R * NOVA_R) damageMob(m, 80);
      }
      if (juice) { juice.shake(12); juice.burst(W / 2, H / 2, "#ffd23f", 30); }
      if (sfx && sfx.buzz) sfx.buzz();
      big("💥 NOVA BLAST!", "#ffd23f");
      updateHud();
    }
    function dash() {
      if (dashCd > 0 || over || !started) return;
      dashCd = 12;
      var fx = hero.fx, fy = hero.fy, fl = Math.sqrt(fx * fx + fy * fy) || 1;
      fx /= fl; fy /= fl;
      hero.x += fx * 120; hero.y += fy * 120;
      dashInvuln = 1.0; invuln = Math.max(invuln, 1.0);
      if (juice) { juice.shake(6); juice.burst(W / 2, H / 2, "#8ef", 18); }
      if (sfx && sfx.pop) sfx.pop();
      big("🌀 DASH!", "#8ef");
      updateHud();
    }

    // ---------- weapons (auto-fire) ----------
    function doZap() {
      var lv = wLevel("zap"); var chains = 2 + lv; if (isEvo("zap")) chains *= 2;
      var dmg = 8 + lv * 3;
      var cur = nearest(); if (!cur) return;
      var hit = {}, fx = hero.x, fy = hero.y;
      for (var c = 0; c <= chains && cur; c++) {
        shots.push({ type: "zaparc", x: fx, y: fy, x2: cur.x, y2: cur.y, life: 0.16 });
        hit[cur.id] = 1;
        var cx = cur.x, cy = cur.y;
        damageMob(cur, dmg);
        fx = cx; fy = cy;
        cur = nearestExcept(cx, cy, hit, 190);
      }
      if (sfx && sfx.pop && Math.random() < 0.3) sfx.pop();
    }
    function fireWeapons(dt) {
      // 🪄 WAND / 🌟 STAR SCEPTER — bolt(s) at the nearest monster (scepter pierces + bigger)
      fireT -= dt;
      if (fireT <= 0) {
        var wl = wLevel("wand") || 1, evoW = isEvo("wand");
        var tgt = nearest();
        if (tgt) {
          fireT = (evoW ? 0.5 : 0.6) * fireRateMul;
          var count = 1 + Math.floor(wl / 3) + (evoW ? 1 : 0);
          for (var b = 0; b < count; b++) {
            var ang = Math.atan2(tgt.y - hero.y, tgt.x - hero.x) + (b - (count - 1) / 2) * 0.18;
            shots.push({ type: "bolt", x: hero.x, y: hero.y, vx: Math.cos(ang) * 360, vy: Math.sin(ang) * 360, dmg: 5 + wl * 2, r: evoW ? 12 : 8, life: 1.4, pierce: evoW ? 3 : 0, hit: {} });
          }
          if (sfx && sfx.pop && Math.random() < 0.2) sfx.pop();
        } else { fireT = 0.2; }
      }
      // ⭐ STAR RAIN — stars fall onto random spots near the swarm
      if (weapons.starrain) {
        starT -= dt;
        if (starT <= 0) {
          starT = 1.4 * fireRateMul;
          var sl = weapons.starrain;
          for (var s = 0; s < sl; s++) {
            var tx = hero.x + (Math.random() - 0.5) * 260, ty = hero.y + (Math.random() - 0.5) * 200;
            shots.push({ type: "star", x: tx, y: ty - 220, tx: tx, ty: ty, dmg: 16 + sl * 4, r: 46, life: 2 });
          }
        }
      }
      // 🌀 BOOMERANG — sweeps out in the facing direction and comes back
      if (weapons.boomerang) {
        boomT -= dt;
        if (boomT <= 0) {
          boomT = 2.2 * fireRateMul;
          var bl = weapons.boomerang;
          shots.push({ type: "boom", x: hero.x, y: hero.y, fx: hero.fx, fy: hero.fy, dmg: 12 + bl * 3, r: 18, t: 0, out: 1, dist: 0, hit: {} });
        }
      }
      // 🏹 PIERCING BOW / 🎯 STORM VOLLEY — line shot(s) through everything toward nearest
      if (weapons.bow || weapons.stormvolley) {
        bowT -= dt;
        if (bowT <= 0) {
          bowT = 0.95 * fireRateMul;
          var tb = nearest();
          if (tb) {
            var bwl = wLevel("bow"), lines = isEvo("bow") ? 3 : 1;
            var base = Math.atan2(tb.y - hero.y, tb.x - hero.x);
            for (var li = 0; li < lines; li++) {
              var aa = base + (li - (lines - 1) / 2) * 0.22;
              shots.push({ type: "arrow", x: hero.x, y: hero.y, vx: Math.cos(aa) * 520, vy: Math.sin(aa) * 520, dmg: 7 + bwl * 3, r: 14, life: 0.85, hit: {} });
            }
          }
        }
      }
      // ⚡ CHAIN ZAP / 🌩 TEMPEST — hits nearest then chains outward
      if (weapons.zap || weapons.tempest) {
        zapT -= dt;
        if (zapT <= 0) { zapT = 1.05 * fireRateMul; doZap(); }
      }
      // 🧊 FROST SHARDS — slow whatever they hit
      if (weapons.frost) {
        frostT -= dt;
        if (frostT <= 0) {
          frostT = 0.9 * fireRateMul;
          var fl = weapons.frost, tf = nearest();
          if (tf) {
            for (var fi = 0; fi < fl; fi++) {
              var fa = Math.atan2(tf.y - hero.y, tf.x - hero.x) + (fi - (fl - 1) / 2) * 0.16;
              shots.push({ type: "frost", x: hero.x, y: hero.y, vx: Math.cos(fa) * 300, vy: Math.sin(fa) * 300, dmg: 5 + fl * 2, r: 9, life: 1.3 });
            }
          }
        }
      }
      // 💣 CHERRY BOMBS — lob an AoE onto a random cluster
      if (weapons.bomb) {
        bombT -= dt;
        if (bombT <= 0) {
          bombT = 1.9 * fireRateMul;
          var cl = clusterCenter();
          if (cl) {
            var bml = weapons.bomb;
            shots.push({ type: "bomb", cx: hero.x, cy: hero.y - 40, tx: cl.x, ty: cl.y, dmg: 18 + bml * 5, r: 74, life: 0.9, boomed: false });
          }
        }
      }
    }
    function stepShots(dt) {
      for (var i = shots.length - 1; i >= 0; i--) {
        var s = shots[i];
        if (s.type === "bolt") {
          s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
          var gone = s.life <= 0;
          for (var m = 0; m < mobs.length; m++) {
            var mo = mobs[m];
            if (s.hit[mo.id]) continue;
            if ((mo.x - s.x) * (mo.x - s.x) + (mo.y - s.y) * (mo.y - s.y) < (mo.r + s.r) * (mo.r + s.r)) {
              s.hit[mo.id] = 1; damageMob(mo, s.dmg);
              if (s.pierce > 0) { s.pierce--; } else { gone = true; break; }
            }
          }
          if (gone) shots.splice(i, 1);
        } else if (s.type === "star") {
          s.life -= dt;
          var fall = Math.min(1, (2 - s.life) / 0.5);
          s.y = (s.ty - 220) + (s.ty - (s.ty - 220)) * fall;
          if (!s.boomed && fall >= 1) { // land: AoE splash
            s.boomed = true;
            for (var k = mobs.length - 1; k >= 0; k--) {
              var mk = mobs[k];
              if ((mk.x - s.tx) * (mk.x - s.tx) + (mk.y - s.ty) * (mk.y - s.ty) < s.r * s.r) damageMob(mk, s.dmg);
            }
            if (juice) juice.burst(sx(s.tx), sy(s.ty), "#ffd23f", 14);
          }
          if (s.life <= 0) shots.splice(i, 1);
        } else if (s.type === "boom") {
          s.t += dt;
          var reach = 190;
          if (s.out) { s.dist += 260 * dt; if (s.dist >= reach) s.out = 0; }
          else { s.dist -= 300 * dt; if (s.dist <= 0) { shots.splice(i, 1); continue; } }
          s.x = hero.x + s.fx * s.dist; s.y = hero.y + s.fy * s.dist;
          for (var bmi = mobs.length - 1; bmi >= 0; bmi--) {
            var bm = mobs[bmi];
            if ((bm.x - s.x) * (bm.x - s.x) + (bm.y - s.y) * (bm.y - s.y) < (bm.r + s.r) * (bm.r + s.r)) {
              if ((bm.boomCd || 0) <= 0) { damageMob(bm, s.dmg); bm.boomCd = 0.25; }
            }
          }
        } else if (s.type === "arrow") {
          s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
          for (var am = mobs.length - 1; am >= 0; am--) {
            var amo = mobs[am]; if (s.hit[amo.id]) continue;
            if ((amo.x - s.x) * (amo.x - s.x) + (amo.y - s.y) * (amo.y - s.y) < (amo.r + s.r) * (amo.r + s.r)) { s.hit[amo.id] = 1; damageMob(amo, s.dmg); }
          }
          if (s.life <= 0) shots.splice(i, 1);
        } else if (s.type === "frost") {
          s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
          var fgone = s.life <= 0;
          for (var fm = 0; fm < mobs.length && !fgone; fm++) {
            var fmo = mobs[fm];
            if ((fmo.x - s.x) * (fmo.x - s.x) + (fmo.y - s.y) * (fmo.y - s.y) < (fmo.r + s.r) * (fmo.r + s.r)) { fmo.slowT = 2; fmo.slowMul = 0.6; damageMob(fmo, s.dmg); fgone = true; }
          }
          if (fgone) shots.splice(i, 1);
        } else if (s.type === "bomb") {
          s.life -= dt;
          var prog = Math.min(1, (0.9 - s.life) / 0.9);
          s.cx = hero.x + (s.tx - hero.x) * prog;
          s.cy = (hero.y - 40) + (s.ty - (hero.y - 40)) * prog - Math.sin(prog * Math.PI) * 40;
          if (!s.boomed && prog >= 1) {
            s.boomed = true;
            for (var bk = mobs.length - 1; bk >= 0; bk--) {
              var bmo = mobs[bk];
              if ((bmo.x - s.tx) * (bmo.x - s.tx) + (bmo.y - s.ty) * (bmo.y - s.ty) < s.r * s.r) damageMob(bmo, s.dmg);
            }
            if (juice) juice.burst(sx(s.tx), sy(s.ty), "#ff5b6b", 16);
          }
          if (s.life <= 0) shots.splice(i, 1);
        } else if (s.type === "zaparc") {
          s.life -= dt; if (s.life <= 0) shots.splice(i, 1);
        }
      }
    }
    // continuous-damage weapons (fire ring / solar crown, garlic aura)
    function stepAuras(dt) {
      ringAng += dt * 2.4;
      var frl = wLevel("firering");
      if (frl > 0) {
        var evoF = isEvo("firering"), rings = evoF ? 2 : 1;
        flames.length = 0;
        for (var rr = 0; rr < rings; rr++) {
          var n = frl + 1, ringR = 74 + rr * 30, dps = 16 + frl * 6;
          for (var f = 0; f < n; f++) {
            var a = ringAng * (rr ? -1 : 1) + (f / n) * Math.PI * 2;
            var fx = hero.x + Math.cos(a) * ringR, fy = hero.y + Math.sin(a) * ringR;
            flames.push({ x: fx, y: fy });
            for (var m = mobs.length - 1; m >= 0; m--) {
              var mo = mobs[m];
              if ((mo.x - fx) * (mo.x - fx) + (mo.y - fy) * (mo.y - fy) < (mo.r + 20) * (mo.r + 20)) damageMob(mo, dps * dt);
            }
          }
        }
      } else flames.length = 0;
      if (weapons.aura) {
        var ar = 62 + weapons.aura * 12, adps = 9 + weapons.aura * 5;
        for (var k = mobs.length - 1; k >= 0; k--) {
          var mk = mobs[k];
          if ((mk.x - hero.x) * (mk.x - hero.x) + (mk.y - hero.y) * (mk.y - hero.y) < ar * ar) damageMob(mk, adps * dt);
        }
      }
    }
    function stepDarts(dt) {
      for (var i = darts.length - 1; i >= 0; i--) {
        var d = darts[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt;
        var ddx = hero.x - d.x, ddy = hero.y - d.y;
        if (ddx * ddx + ddy * ddy < (HERO_R + 8) * (HERO_R + 8)) { takeHit(1); darts.splice(i, 1); continue; }
        if (d.life <= 0) darts.splice(i, 1);
      }
    }
    function stepZones(dt) { for (var i = zones.length - 1; i >= 0; i--) { zones[i].life -= dt; if (zones[i].life <= 0) zones.splice(i, 1); } }

    function inputVec() {
      if (stick) return stick;
      var kx = 0, ky = 0;
      if (keys.left) kx -= 1; if (keys.right) kx += 1; if (keys.up) ky -= 1; if (keys.down) ky += 1;
      if (kx || ky) return { x: kx, y: ky };
      return { x: mvx, y: mvy };
    }

    // ---------- bosses ----------
    function bossName(bk) { return bk === "grab" ? "GRAB BOSS" : bk === "bone" ? "BONE KING" : "BIG BOSS"; }
    function spawnBossKind(kind) {
      var m = ringSpawn(kind || "boss");
      if (m) boss = m;
      return m;
    }
    function spawnScheduledBoss() {
      var k = BOSS_KINDS[bossCount % BOSS_KINDS.length]; bossCount++;
      var m = spawnBossKind(k);
      big(MOBS[k].e + " " + bossName(MOBS[k].bk) + " APPROACHES!", "#ff8a8a");
      if (sfx && sfx.buzz) sfx.buzz();
      return m;
    }
    function maybeBoss() {
      if (curMode.id === "classic") {
        if (runT >= 300 && !bossFlags.b1) { bossFlags.b1 = 1; spawnScheduledBoss(); }
        if (runT >= 540 && !bossFlags.b2) { bossFlags.b2 = 1; spawnScheduledBoss(); }
      } else {
        var every = curMode.bossEvery || 240;
        var idx = Math.floor(runT / every);
        if (idx >= 1 && !bossFlags["k" + idx]) { bossFlags["k" + idx] = 1; spawnScheduledBoss(); }
      }
    }

    // ---------- simulation ----------
    function step(dt) {
      runT += dt;
      if (invuln > 0) invuln = Math.max(0, invuln - dt);
      if (dashInvuln > 0) dashInvuln = Math.max(0, dashInvuln - dt);
      if (novaCd > 0) novaCd = Math.max(0, novaCd - dt);
      if (dashCd > 0) dashCd = Math.max(0, dashCd - dt);
      if (boostsOwned.regen) { regenT -= dt; if (regenT <= 0) { regenT = 45; if (hearts < maxHearts) { hearts = Math.min(maxHearts, hearts + 1); big("💖 +1 heart (regen)", "#ff8ab0"); } } }
      updateHud();
      // minute announcements
      var mins = Math.floor(runT / 60);
      if (mins > lastMin) { lastMin = mins; if (mins > 0) big("🌙 MINUTE " + mins + " — the horde thickens!", "#ffd23f"); }
      // move hero (tentacle zones slow you)
      var zoneSlow = 1;
      for (var zi = 0; zi < zones.length; zi++) { var z = zones[zi], zdx = hero.x - z.x, zdy = hero.y - z.y; if (zdx * zdx + zdy * zdy < z.r * z.r) { zoneSlow = 0.55; break; } }
      var iv = inputVec(), il = Math.sqrt(iv.x * iv.x + iv.y * iv.y);
      if (il > 0.01) {
        var nx = iv.x / il, ny = iv.y / il;
        hero.fx = nx; hero.fy = ny;
        var hspeed = 150 * speedMul * zoneSlow;
        hero.x += nx * hspeed * dt; hero.y += ny * hspeed * dt;
      }
      // spawns: stream in, ramping every 60s (mode-scaled)
      var diff = mins * (curMode.ramp || 1);
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = Math.max(0.32, 1.15 - diff * 0.09);
        var batch = 1 + Math.floor(diff / 2);
        for (var s = 0; s < batch; s++) ringSpawn();
      }
      // bosses (mode-aware schedule + rotation)
      maybeBoss();
      // weapons
      fireWeapons(dt);
      stepShots(dt);
      stepAuras(dt);
      stepDarts(dt);
      stepZones(dt);
      // monsters chase + special behaviors + touch-damage
      for (var i = mobs.length - 1; i >= 0; i--) {
        var mob = mobs[i];
        if (mob.boomCd) mob.boomCd = Math.max(0, mob.boomCd - dt);
        if (mob.slowT > 0) mob.slowT = Math.max(0, mob.slowT - dt);
        var spd = mob.speed * (mob.slowT > 0 ? mob.slowMul : 1);
        var dx = hero.x - mob.x, dy = hero.y - mob.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (mob.kind === "charger") {
          mob.chT -= dt;
          if (mob.chPhase === "aim") { if (mob.chT <= 0) { mob.dvx = dx / d; mob.dvy = dy / d; mob.chPhase = "dash"; mob.chT = 0.55; } }
          else if (mob.chPhase === "dash") { mob.x += mob.dvx * 360 * dt; mob.y += mob.dvy * 360 * dt; if (mob.chT <= 0) { mob.chPhase = "rest"; mob.chT = 0.9; } }
          else { if (mob.chT <= 0) { mob.chPhase = "aim"; mob.chT = 0.9; } }
        } else if (mob.kind === "wisp") {
          mob.blinkT -= dt;
          if (mob.blinkT <= 0) { mob.blinkT = 2; mob.x += (dx / d) * 80; mob.y += (dy / d) * 80; }
          else { mob.x += (dx / d) * spd * dt; mob.y += (dy / d) * spd * dt; }
        } else {
          mob.x += (dx / d) * spd * dt; mob.y += (dy / d) * spd * dt;
        }
        if (mob.kind === "stinger") {
          mob.shootT -= dt;
          if (mob.shootT <= 0) { mob.shootT = 2.4; var sa = Math.atan2(dy, dx); darts.push({ x: mob.x, y: mob.y, vx: Math.cos(sa) * 130, vy: Math.sin(sa) * 130, life: 6 }); }
        }
        if (mob.big) {
          if (mob.bk === "grab") { mob.zoneT = (mob.zoneT == null ? 2.6 : mob.zoneT) - dt; if (mob.zoneT <= 0) { mob.zoneT = 2.8; zones.push({ x: hero.x + (Math.random() - 0.5) * 140, y: hero.y + (Math.random() - 0.5) * 140, r: 70, life: 5 }); } }
          else if (mob.bk === "bone") {
            if (!mob.summoned && mob.hp < mob.maxHp * 0.5) {
              mob.summoned = true;
              for (var skk = 0; skk < 4; skk++) { var ska = skk / 4 * 6.283; spawnMob("skeleton", (mob.x - hero.x) + Math.cos(ska) * 60, (mob.y - hero.y) + Math.sin(ska) * 60, { elite: false }); }
              big("💀 BONE KING summons skeletons!", "#e8e8f0");
            }
          }
        }
        var ndx = hero.x - mob.x, ndy = hero.y - mob.y, nd = Math.sqrt(ndx * ndx + ndy * ndy);
        if (nd < mob.r + HERO_R) takeHit(mob.dmg);
      }
      // gems/hearts vacuum + collect
      for (var g = drops.length - 1; g >= 0; g--) {
        var gm = drops[g];
        var gdx = hero.x - gm.x, gdy = hero.y - gm.y, gd = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
        if (gd < magnetR) { gm.x += (gdx / gd) * 260 * dt; gm.y += (gdy / gd) * 260 * dt; }
        if (gd < HERO_R + 6) {
          drops.splice(g, 1);
          if (gm.heart) { hearts = Math.min(maxHearts, hearts + 1); big("❤️ +1 heart!", "#ff8a8a"); if (sfx && sfx.coin) sfx.coin(); }
          else { addXp(gm.val * luckMul); if (sfx && sfx.coin && Math.random() < 0.3) sfx.coin(); }
          updateHud();
        }
      }
      if (juice) juice.update(dt);
      // WIN: survive the full clock (Endless has no clock → never wins)
      if (RUN_LEN > 0 && runT >= RUN_LEN && !over) endRun(true);
    }

    // ---------- drawing ----------
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // buffer is retina; all drawing stays in CSS px
      ctx.clearRect(0, 0, W, H);
      // tiled grass meadow (checker pattern, scrolls with the camera)
      var ts = 64;
      var ox = ((hero.x % ts) + ts) % ts, oy = ((hero.y % ts) + ts) % ts;
      var cols = Math.ceil(W / ts) + 2, rows = Math.ceil(H / ts) + 2;
      var baseC = Math.floor(hero.x / ts), baseR = Math.floor(hero.y / ts);
      for (var r = -1; r < rows; r++) for (var c = -1; c < cols; c++) {
        var gx = c * ts - ox, gy = r * ts - oy;
        var cell = (baseC + c + baseR + r) & 1;
        ctx.fillStyle = cell ? "#7bbf5a" : "#71b552";
        ctx.fillRect(gx, gy, ts, ts);
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      // tentacle slow-zones (under everything)
      for (var zz = 0; zz < zones.length; zz++) {
        var z = zones[zz];
        ctx.fillStyle = "rgba(150,80,180,.22)";
        ctx.beginPath(); ctx.arc(sx(z.x), sy(z.y), z.r, 0, Math.PI * 2); ctx.fill();
        ctx.font = "24px serif"; ctx.fillText("🕸", sx(z.x), sy(z.y));
      }
      // drops (gems + hearts)
      for (var g = 0; g < drops.length; g++) {
        var gm = drops[g];
        ctx.font = "18px serif";
        ctx.fillText(gm.heart ? "❤️" : "💎", sx(gm.x), sy(gm.y));
      }
      // fire ring flames
      for (var f = 0; f < flames.length; f++) { ctx.font = "26px serif"; ctx.fillText("🔥", sx(flames[f].x), sy(flames[f].y)); }
      // garlic aura circle
      if (weapons && weapons.aura) {
        var ar = 62 + weapons.aura * 12;
        ctx.fillStyle = "rgba(200,255,180,.14)";
        ctx.beginPath(); ctx.arc(W / 2, H / 2, ar, 0, Math.PI * 2); ctx.fill();
      }
      // shots
      for (var i = 0; i < shots.length; i++) {
        var s = shots[i];
        if (s.type === "bolt") { ctx.font = "18px serif"; ctx.fillText("✨", sx(s.x), sy(s.y)); }
        else if (s.type === "star") { ctx.font = "26px serif"; ctx.fillText("⭐", sx(s.x), sy(s.y)); }
        else if (s.type === "boom") { ctx.font = "24px serif"; ctx.fillText("🌀", sx(s.x), sy(s.y)); }
        else if (s.type === "arrow") { ctx.font = "20px serif"; ctx.fillText("➤", sx(s.x), sy(s.y)); }
        else if (s.type === "frost") { ctx.font = "18px serif"; ctx.fillText("🧊", sx(s.x), sy(s.y)); }
        else if (s.type === "bomb") { ctx.font = "22px serif"; ctx.fillText("🍒", sx(s.cx), sy(s.cy)); }
        else if (s.type === "zaparc") { ctx.strokeStyle = "#9ef"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx(s.x), sy(s.y)); ctx.lineTo(sx(s.x2), sy(s.y2)); ctx.stroke(); }
      }
      // darts
      for (var dd = 0; dd < darts.length; dd++) { ctx.font = "16px serif"; ctx.fillText("🔺", sx(darts[dd].x), sy(darts[dd].y)); }
      // monsters (cull off-screen)
      for (var m = 0; m < mobs.length; m++) {
        var mo = mobs[m], msx = sx(mo.x), msy = sy(mo.y);
        if (msx < -40 || msx > W + 40 || msy < -40 || msy > H + 40) continue;
        var wob = Math.sin(runT * 6 + mo.bob) * 2;
        if (mo.elite) { ctx.strokeStyle = "rgba(255,215,64,.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(msx, msy, mo.r + 6, 0, Math.PI * 2); ctx.stroke(); }
        if (mo.kind === "charger" && mo.chPhase === "aim") { ctx.strokeStyle = "rgba(255,120,60,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(msx, msy, mo.r + 4, 0, Math.PI * 2); ctx.stroke(); }
        ctx.font = Math.round(mo.big ? 56 : (mo.elite ? 42 : 30)) + "px serif";
        ctx.fillText(mo.e, msx, msy + wob);
        if (mo.hp < mo.maxHp) {
          var bw = mo.big ? 60 : (mo.elite ? 34 : 26);
          ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(msx - bw / 2, msy - (mo.big ? 40 : 22), bw, 4);
          ctx.fillStyle = "#ff8a8a"; ctx.fillRect(msx - bw / 2, msy - (mo.big ? 40 : 22), bw * Math.max(0, mo.hp / mo.maxHp), 4);
        }
      }
      // hero (blinks while invulnerable)
      if (!(invuln > 0 && Math.floor(runT * 12) % 2)) {
        ctx.font = "34px serif"; ctx.fillText("🧙", W / 2, H / 2 + Math.sin(runT * 5) * 2);
      }
      // boss health bar — sit BELOW the HUD (which clears the Dynamic Island via env safe-top)
      if (boss && mobs.indexOf(boss) >= 0) {
        var bby = hudH + 6;
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(W * 0.14, bby, W * 0.72, 16);
        ctx.fillStyle = "#ff6b6b"; ctx.fillRect(W * 0.14 + 2, bby + 2, (W * 0.72 - 4) * Math.max(0, boss.hp / boss.maxHp), 12);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px Trebuchet MS"; ctx.textAlign = "center";
        ctx.fillText((boss.e || "👹") + " " + bossName(boss.bk), W / 2, bby + 9);
      }
      // xp bar hugging the bottom (above the home indicator via env safe-bottom)
      var bw2 = Math.min(360, W * 0.7), bx2 = (W - bw2) / 2, by2 = H - 14 - safeB;
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(bx2, by2, bw2, 8);
      ctx.fillStyle = "#5bd0ff"; ctx.fillRect(bx2, by2, bw2 * Math.max(0, Math.min(1, xp / xpNeed)), 8);
      if (juice) juice.draw(ctx);
    }

    // ---------- loop ----------
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      if (started && !paused && !over) step(dt);
      if (started) draw();
    }

    // ---------- input (phantom-tap safe: canvas is a hold/mover) ----------
    function stickFrom(x, y) {
      // vector from the touch's start point; capped to a unit stick
      var dx = x - stickOX, dy = y - stickOY, len = Math.sqrt(dx * dx + dy * dy);
      if (len < 6) return { x: 0, y: 0 };
      var cap = Math.min(len, 60);
      return { x: (dx / len) * (cap / 60), y: (dy / len) * (cap / 60) };
    }
    var stickOX = 0, stickOY = 0;
    function rel(e, touch) { var r = cv.getBoundingClientRect(); var s = touch || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
    cv.addEventListener("touchstart", function (e) {
      e.preventDefault(); var p = rel(e, e.changedTouches[0]);
      stickOX = p.x; stickOY = p.y; stick = { x: 0, y: 0 };
    }, { passive: false });
    cv.addEventListener("touchmove", function (e) {
      e.preventDefault(); var p = rel(e, e.changedTouches[0]); stick = stickFrom(p.x, p.y);
    }, { passive: false });
    cv.addEventListener("touchend", function (e) { e.preventDefault(); stick = null; }, { passive: false });
    cv.addEventListener("mousedown", function (e) { var p = rel(e); stickOX = p.x; stickOY = p.y; stick = { x: 0, y: 0 }; });
    cv.addEventListener("mousemove", function (e) { if (stick) { var p = rel(e); stick = stickFrom(p.x, p.y); } });
    cv.addEventListener("mouseup", function () { stick = null; });
    cv.addEventListener("mouseleave", function () { stick = null; });

    // ability buttons (inside the wrap → they die with it; discrete taps)
    function wireAbility(id, fn) {
      var b = document.getElementById(id);
      if (!b) return;
      function tap(e) { e.preventDefault(); fn(); }
      b.addEventListener("touchstart", tap, { passive: false });
      b.addEventListener("mousedown", tap);
    }
    wireAbility("svnova", function () { nova(); });
    wireAbility("svdash", function () { dash(); });

    function onKey(down) {
      return function (e) {
        var k = e.key;
        if (down && (k === "q" || k === "Q")) { nova(); return; }
        if (down && (k === "e" || k === "E")) { dash(); return; }
        if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = down;
        else if (k === "ArrowRight" || k === "d" || k === "D") keys.right = down;
        else if (k === "ArrowUp" || k === "w" || k === "W") keys.up = down;
        else if (k === "ArrowDown" || k === "s" || k === "S") keys.down = down;
        else return;
        if (down) e.preventDefault();
      };
    }
    var keyDown = onKey(true), keyUp = onKey(false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    // ---------- exit / banking (mid-run quit + app-close both bank) ----------
    function bankExit() {
      if (over) return; // an ended run already banked
      if (!started || (kills === 0 && runT < 1)) return; // untouched / unstarted run banks nothing
      var b = bankRun(false);
      persistBests();
      if (b && global.VobloxSfx && global.VobloxSfx.toast) global.VobloxSfx.toast("🧟 Survivors run banked: +" + b.rw.gems + " Vobux · +" + b.rw.xp + " XP");
    }
    function onUnload() { bankExit(); }
    window.addEventListener("beforeunload", onUnload);
    function exit() {
      bankExit();
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("beforeunload", onUnload);
      if (wrap.parentNode) wrap.remove();
      if (opts.onExit) opts.onExit();
    }
    document.getElementById("quit").onclick = exit;

    // ---------- test API (on the canvas) ----------
    cv._survivors = {
      state: function () {
        var ws = [], k; for (k in weapons) if (weapons.hasOwnProperty(k)) ws.push(k);
        var el = 0, i; for (i = 0; i < mobs.length; i++) if (mobs[i].elite) el++;
        return {
          t: runT, hearts: hearts, level: level, xpFrac: Math.max(0, Math.min(1, xp / xpNeed)),
          kills: kills, weapons: ws, over: over, won: won, banked: banked,
          monsters: mobs.length, boss: (boss && mobs.indexOf(boss) >= 0) ? { hp: boss.hp } : null,
          mode: curMode.id, elites: el, novaCd: novaCd, dashCd: dashCd,
          darts: darts.length, drops: drops.length, hx: hero.x, hy: hero.y
        };
      },
      begin: function (mode) { begin(mode || "classic"); },
      move: function (dx, dy) { mvx = dx; mvy = dy; stick = null; },
      spawn: function (n, kind) { for (var i = 0; i < (n || 1); i++) ringSpawn(kind); },
      spawnElite: function (kind) { var a = Math.random() * Math.PI * 2, rad = 100; return spawnMob(kind || "slime", Math.cos(a) * rad, Math.sin(a) * rad, { elite: true, mini: false }); },
      spawnBossKind: spawnBossKind,
      killAll: function () { for (var i = mobs.length - 1; i >= 0; i--) killMob(i); },
      gainXp: function (frac) { addXp((frac || 0) * xpNeed); },
      levelUpQuiz: function () { if (pendingLevels < 1) pendingLevels = 1; openLevelQuiz(); },
      pick: pick,
      hurt: function () { invuln = 0; takeHit(1); },
      warp: function (t) { runT = t; updateHud(); },
      nova: nova,
      dash: dash,
      evolveReady: evolveReady,
      forceEvolve: forceEvolve
    };

    // ---------- boot ----------
    if (global._survivorsdemo) { // screenshot seed: a busy Nightmare tableau, frozen, with an elite + abilities
      global._survivorsdemo = 0;
      begin("nightmare");
      runT = 240; level = 6; xp = 3.5; xpNeed = 5; kills = 90;
      weapons = { wand: 3, firering: 2, bow: 2 }; magnetR = 90; armorStacks = 2; boostsOwned = { fasterfire: 1, armor: 1 };
      for (var d = 0; d < 34; d++) {
        var a = Math.random() * Math.PI * 2, rad = 90 + Math.random() * 300;
        spawnMob(MOB_KINDS[d % 4], Math.cos(a) * rad, Math.sin(a) * rad, { elite: false });
      }
      spawnMob("knight", 120, -40, { elite: true }); // a glowing elite on screen
      spawnBossKind("grabboss");
      for (var g2 = 0; g2 < 10; g2++) dropGem(hero.x + (Math.random() - 0.5) * 200, hero.y + (Math.random() - 0.5) * 160, 1, false);
      stepAuras(0.016); // seed the flame positions so the ring shows
      paused = true; // freeze the tableau — the demo exists for screenshots
      updateHud();
    } else if (global.__VOBLOX_TEST__) {
      begin("classic"); // specs expect play to start immediately
    } else {
      showModeSelect(); // real players choose a mode first
    }
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }

  global.VobloxSurvivors = { start: start };
})(typeof window !== "undefined" ? window : globalThis);
