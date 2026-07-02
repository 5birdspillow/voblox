/*
 * Voblox — the 🎒 Backpack overlay: Daily Quests, the Locker (equip skins on
 * a live avatar preview), the daily Shop, Pets, and Zelda-style Save Slots.
 * Games are NOT launched from here — every game is a building in the 3D world.
 *
 * env: { store, tab?, openOverlay(html, keyFn), closeOverlay(), launch(gameDef),
 *        startBoss(), back() }
 */
(function (global) {
  var P = function () { return global.VobloxProfile; };
  var IT = function () { return global.VobloxItems; };
  var AV = function () { return global.VobloxAvatar; };
  var SFX = function () { return global.VobloxSfx || { coin: function () {}, chime: function () {}, fanfare: function () {}, pop: function () {}, toast: function () {} }; };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var DUPE_GEMS = { common: 40, rare: 150, epic: 500, legendary: 1500 };

  var env = null, tab = "quests", lockerSlot = "hat", prevRaf = 0;

  function state() { return env.store.state; }
  function save() { env.store.save(); }
  function games() { return global.VobloxGames || []; }
  function findGame(id) { return games().filter(function (g) { return g.id === id; })[0] || null; }

  function open(e) {
    env = e; tab = e.tab || "quests";
    shell();
  }

  function shell() {
    var html =
      '<div class="gatehead">🎒 Backpack <span class="x" id="ax">✕</span></div>' +
      '<div class="card arcadecard">' +
      '<div class="atabs">' +
      tabBtn("quests", "📋 Quests") + tabBtn("locker", "🧍 Locker") + tabBtn("shop", "🛍️ Shop") +
      tabBtn("pets", "🐾 Pets") + tabBtn("slots", "💾 Slots") +
      '</div><div class="abody" id="abody"></div></div>';
    env.openOverlay(html, function (ev) { if (ev.key === "Escape") env.back(); });
    document.getElementById("ax").onclick = env.back;
    Array.prototype.forEach.call(document.querySelectorAll(".atab"), function (b) {
      b.onclick = function () { tab = b.dataset.t; markTabs(); render(); };
    });
    render();
  }
  function tabBtn(t, label) { return '<button class="atab' + (tab === t ? " on" : "") + '" data-t="' + t + '">' + label + "</button>"; }
  function markTabs() {
    Array.prototype.forEach.call(document.querySelectorAll(".atab"), function (b) {
      b.classList.toggle("on", b.dataset.t === tab);
    });
  }
  function render() {
    cancelAnimationFrame(prevRaf);
    var el = document.getElementById("abody"); if (!el) return;
    if (tab === "quests") renderQuests(el);
    else if (tab === "locker") renderLocker(el);
    else if (tab === "shop") renderShop(el);
    else if (tab === "pets") renderPets(el);
    else renderSlots(el);
  }

  // ---------- header strip (player, level, gems, chests) ----------
  function headerHTML() {
    var st = state(), pr = P().xpInto(st);
    return '<div class="ahead">' +
      '<canvas id="aheadface" width="44" height="44"></canvas>' +
      '<div class="ahead-mid"><b>' + esc(st.profile.name) + '</b> <span class="lvltag">⭐ Lv ' + st.level + '</span>' +
      '<div class="xpbar"><div class="xpfill" style="width:' + Math.round(100 * pr.have / pr.need) + '%"></div><span>' + pr.have + " / " + pr.need + " XP</span></div></div>" +
      '<div class="ahead-right"><span class="chip"><img class="vbx" src="icons/vobux.png" alt="V"> ' + (st.gems || 0) + "</span>" +
      (st.chests > 0 ? '<button class="chestbtn" id="openchest">🎁 ' + st.chests + "</button>" : "") +
      "</div></div>";
  }
  function wireHeader() {
    var cv = document.getElementById("aheadface");
    if (cv) AV().drawHead(cv.getContext("2d"), { x: 22, y: 24, size: 30, config: AV().resolve(state()) });
    var oc = document.getElementById("openchest");
    if (oc) oc.onclick = openChest;
  }
  function openChest() {
    var st = state();
    if ((st.chests || 0) < 1) return;
    st.chests -= 1;
    var roll = IT().rollChest(Math.random, st);
    var got = roll.item, msg;
    if (roll.dupe) { var g = DUPE_GEMS[got.rarity] || 40; st.gems += g; msg = "Already owned — +" + g + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> instead!'; }
    else { st.inventory.push(got.id); msg = "NEW item added to your Locker!"; }
    save(); SFX().fanfare();
    var el = document.getElementById("abody");
    var rc = IT().RARITY[got.rarity];
    el.innerHTML = headerHTML() +
      '<div class="chestreveal"><div class="crlabel">You opened a chest…</div>' +
      '<div class="critem" style="border-color:' + rc.color + '"><div class="cremoji">' + got.emoji + '</div>' +
      '<div class="crname">' + esc(got.name) + '</div><div class="crrar" style="color:' + rc.color + '">' + rc.label + "</div>" +
      '<div class="crmsg">' + msg + "</div></div>" +
      '<button class="submit big-next" id="crok">' + (st.chests > 0 ? "Open another 🎁 (" + st.chests + " left)" : "Nice! ⏎") + "</button></div>";
    wireHeader();
    document.getElementById("crok").onclick = function () { if (st.chests > 0) openChest(); else render(); };
  }

  // ---------- Games tab ----------
  function questStrip() {
    var st = state();
    var qs = P().ensureQuests(st);
    var streak = env.store.streak ? env.store.streak() : 0;
    var rows = qs.list.map(function (q, i) {
      var pct = Math.round(100 * Math.min(1, q.n / q.goal));
      var right = q.claimed ? '<span class="qdone">✓ done</span>'
        : q.n >= q.goal ? '<button class="qclaim" data-q="' + i + '">CLAIM 🎁</button>'
        : '<span class="qprog">' + q.n + "/" + q.goal + "</span>";
      return '<div class="qrow"><div class="qtext">' + esc(q.text) + '<div class="qbar"><div class="qfill" style="width:' + pct + '%"></div></div></div>' + right + "</div>";
    }).join("");
    return '<div class="asec">📋 Daily Quests' + (streak > 1 ? ' <span class="lvltag">🔥 ' + streak + "-day streak!</span>" : "") + "</div>" + rows;
  }
  function wireQuests(el) {
    Array.prototype.forEach.call(el.querySelectorAll("[data-q]"), function (b) {
      b.onclick = function () {
        var r = P().claimQuest(state(), parseInt(b.dataset.q, 10));
        if (r.ok) { save(); SFX().coin(); SFX().toast('🎁 Quest done! +' + r.gems + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"> + a chest!'); render(); }
      };
    });
  }
  function renderQuests(el) {
    var st = state();
    // ranks recap: every game the player has touched, with its rank badge
    var badges = games().map(function (g) {
      var gs = (st.gameStats || {})[g.id];
      if (!gs || !gs.plays) return "";
      var rank = P().gameRank(gs.rankPts);
      return '<div class="qrow" style="gap:6px"><div class="qtext">' + g.emoji + " " + esc(g.name) +
        '</div><span class="qprog">' + rank.icon + " " + rank.name + (gs.best ? " · best " + gs.best : "") + "</span></div>";
    }).join("");
    el.innerHTML = headerHTML() + questStrip() +
      (badges ? '<div class="asec">🏅 Your game ranks</div>' + badges : "") +
      '<div class="shopchest" style="margin-top:8px">🏘️ All the games are <b>buildings in the world</b> — walk up to a door and press PLAY! (Word chests, the Boss Totem and the portal ring are out there too.)</div>';
    wireHeader();
    wireQuests(el);
  }

  // ---------- Locker tab ----------
  var SLOTS = [
    { k: "hat", label: "🎩 Hats" }, { k: "face", label: "😀 Faces" }, { k: "shirt", label: "👕 Shirts" },
    { k: "pants", label: "👖 Pants" }, { k: "trail", label: "✨ Trails" }, { k: "pet", label: "🐾 Pets" }, { k: "gear", label: "⚙️ Gear" }
  ];
  function renderLocker(el) {
    var st = state();
    var items = IT().ALL.filter(function (it) {
      return lockerSlot === "gear" ? it.slot.indexOf("gear.") === 0 : it.slot === lockerSlot;
    });
    // owned first, then buyable, then locked
    items = items.slice().sort(function (a, b) {
      function w(it) { return st.inventory.indexOf(it.id) !== -1 ? 0 : (IT().canGet(it, st).ok ? 1 : 2); }
      return w(a) - w(b);
    });
    var cards = items.map(function (it) {
      var owned = st.inventory.indexOf(it.id) !== -1;
      var equipped = st.equipped[it.slot] === it.id;
      var rc = IT().RARITY[it.rarity];
      var action;
      if (equipped) action = '<button class="ibtn on" data-eq="' + it.id + '">✓ Equipped</button>';
      else if (owned) action = '<button class="ibtn" data-eq="' + it.id + '">Equip</button>';
      else {
        var cg = IT().canGet(it, st);
        if (it.price) action = '<button class="ibtn buy' + (cg.ok ? "" : " no") + '" data-buy="' + it.id + '">' + it.price + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"></button>';
        else action = '<div class="ilock">🔒 ' + esc(cg.why) + "</div>";
      }
      return '<div class="icard' + (owned ? "" : " locked") + '" style="border-color:' + rc.color + '">' +
        '<div class="iemoji">' + it.emoji + '</div><div class="iname">' + esc(it.name) + "</div>" + action + "</div>";
    }).join("");
    var chips = SLOTS.map(function (s) { return '<button class="lchip' + (lockerSlot === s.k ? " on" : "") + '" data-ls="' + s.k + '">' + s.label + "</button>"; }).join("");
    el.innerHTML = headerHTML() +
      '<div class="lockerwrap"><div class="lockerleft"><canvas id="lockerprev" width="170" height="220"></canvas>' +
      '<div class="lname">' + esc(st.profile.name) + "</div></div>" +
      '<div class="lockerright"><div class="lchips">' + chips + '</div><div class="igrid">' + cards + "</div></div></div>";
    wireHeader();
    Array.prototype.forEach.call(el.querySelectorAll("[data-ls]"), function (b) { b.onclick = function () { lockerSlot = b.dataset.ls; render(); }; });
    Array.prototype.forEach.call(el.querySelectorAll("[data-eq]"), function (b) {
      b.onclick = function () {
        var it = IT().byId[b.dataset.eq];
        if (st.equipped[it.slot] === it.id) delete st.equipped[it.slot];
        else st.equipped[it.slot] = it.id;
        save(); SFX().pop();
        if (env.onEquip) env.onEquip();
        render();
      };
    });
    Array.prototype.forEach.call(el.querySelectorAll("[data-buy]"), function (b) { b.onclick = function () { buy(b.dataset.buy); }; });
    // live preview loop — self-terminates when the canvas leaves the DOM
    var t0 = performance.now();
    (function loop() {
      var cv = document.getElementById("lockerprev"); if (!cv) return;
      var c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height);
      AV().draw(c, { x: 85, y: 205, size: 150, config: AV().resolve(state()), pose: "celebrate", frame: (performance.now() - t0) / 1000 });
      prevRaf = requestAnimationFrame(loop);
    })();
  }
  function buy(id) {
    var st = state(), it = IT().byId[id];
    var cg = IT().canGet(it, st);
    if (!cg.ok) { SFX().toast(cg.why || "Not yet!"); return; }
    if (it.price) st.gems -= it.price;
    st.inventory.push(it.id);
    st.equipped[it.slot] = it.id; // auto-equip what you just bought — instant gratification
    save(); SFX().coin(); SFX().toast("🎉 Got " + it.name + "!");
    if (env.onEquip) env.onEquip();
    render();
  }

  // ---------- Shop tab ----------
  function renderShop(el) {
    var st = state();
    var today = IT().shopToday(P().dayKey());
    var cards = today.map(function (it) {
      var owned = st.inventory.indexOf(it.id) !== -1;
      var rc = IT().RARITY[it.rarity];
      return '<div class="icard" style="border-color:' + rc.color + '"><div class="iemoji">' + it.emoji + "</div>" +
        '<div class="iname">' + esc(it.name) + '</div><div class="crrar" style="color:' + rc.color + ';font-size:11px">' + rc.label + "</div>" +
        (owned ? '<div class="ilock">✓ owned</div>' : '<button class="ibtn buy' + (st.gems >= it.price ? "" : " no") + '" data-buy="' + it.id + '">' + it.price + ' <img class="vbx" src="icons/vobux.png" alt="Vobux"></button>') +
        "</div>";
    }).join("");
    el.innerHTML = headerHTML() +
      '<div class="asec">🛍️ Today\'s Shop <span class="muted2">(pay with <img class="vbx" src="icons/vobux.png" alt=""> Vobux — new deals every day!)</span></div>' +
      '<div class="igrid shopgrid">' + cards + "</div>" +
      '<div class="asec">🎁 Reward Chests</div>' +
      '<div class="shopchest">' + (st.chests > 0
        ? "You have <b>" + st.chests + "</b> chest" + (st.chests > 1 ? "s" : "") + " to open! <button class='submit' id='sc_open'>Open one 🎁</button>"
        : "Level up or finish quests to earn chests full of items!") + "</div>";
    wireHeader();
    Array.prototype.forEach.call(el.querySelectorAll("[data-buy]"), function (b) { b.onclick = function () { buy(b.dataset.buy); }; });
    var so = document.getElementById("sc_open"); if (so) so.onclick = openChest;
  }

  // ---------- Pets tab ----------
  function renderPets(el) {
    var st = state();
    var pets = IT().ALL.filter(function (it) { return it.slot === "pet" && st.inventory.indexOf(it.id) !== -1; });
    var cards = pets.map(function (it) {
      var on = st.equipped.pet === it.id;
      return '<div class="icard"><div class="iemoji">' + it.emoji + '</div><div class="iname">' + esc(it.name) + "</div>" +
        '<button class="ibtn' + (on ? " on" : "") + '" data-eq="' + it.id + '">' + (on ? "✓ With you" : "Bring along") + "</button></div>";
    }).join("");
    el.innerHTML = headerHTML() +
      '<div class="asec">🐾 Your Pets</div>' +
      (pets.length ? '<div class="igrid">' + cards + "</div>" : '<div class="shopchest">No pets yet — find pet buddies in the 🛍️ Shop or Locker!</div>') +
      '<div class="shopchest" style="margin-top:10px">🥚 <b>Pet Paradise</b> — hatch, train, and battle pets — is coming to the Arcade soon!</div>';
    wireHeader();
    Array.prototype.forEach.call(el.querySelectorAll("[data-eq]"), function (b) {
      b.onclick = function () {
        var it = IT().byId[b.dataset.eq];
        if (st.equipped.pet === it.id) delete st.equipped.pet; else st.equipped.pet = it.id;
        save(); SFX().pop(); render();
      };
    });
  }

  // ---------- Slots tab ----------
  function renderSlots(el) {
    var metas = P().slots.list();
    function row(n, i, label) {
      var m = metas[i];
      var info = m ? "<b>" + esc(m.label) + "</b> <span class='muted2'>" + new Date(m.when).toLocaleString() + "</span>" : "<span class='muted2'>empty</span>";
      var btns = (n === "auto" ? "" : '<button class="ibtn" data-ss="' + n + '">💾 Save</button>') +
        (m ? '<button class="ibtn" data-sl="' + n + '">📂 Load</button>' : "") +
        (m && n !== "auto" ? '<button class="ibtn no" data-sd="' + n + '">🗑️</button>' : "");
      return '<div class="slotrow"><div class="slotlabel">' + label + "</div><div class='slotinfo'>" + info + "</div><div class='slotbtns'>" + btns + "</div></div>";
    }
    el.innerHTML = headerHTML() +
      '<div class="asec">💾 Save Slots <span class="muted2">— like save files in Zelda!</span></div>' +
      row(1, 0, "Slot 1") + row(2, 1, "Slot 2") + row(3, 2, "Slot 3") + row("auto", 3, "🕐 Auto") +
      '<div class="shopchest">💡 Saving keeps a full copy of ALL progress (words, Vobux, items, Vocraft). Loading brings it back exactly.</div>';
    wireHeader();
    Array.prototype.forEach.call(el.querySelectorAll("[data-ss]"), function (b) {
      b.onclick = function () {
        var n = b.dataset.ss;
        if (metas[Number(n) - 1] && !window.confirm("Overwrite Slot " + n + "?")) return;
        var r = P().slots.save(n);
        if (r && r.error) SFX().toast("⚠ " + r.error);
        else { SFX().chime(); SFX().toast("💾 Saved to Slot " + n + "!"); }
        render();
      };
    });
    Array.prototype.forEach.call(el.querySelectorAll("[data-sl]"), function (b) {
      b.onclick = function () {
        var n = b.dataset.sl;
        if (!window.confirm("Load this save? Anything not saved to a slot will be replaced.")) return;
        if (P().slots.load(n)) location.reload();
        else SFX().toast("⚠ Couldn't load that slot.");
      };
    });
    Array.prototype.forEach.call(el.querySelectorAll("[data-sd]"), function (b) {
      b.onclick = function () {
        var n = b.dataset.sd;
        if (!window.confirm("Delete Slot " + n + " forever?")) return;
        P().slots.del(n); render();
      };
    });
  }

  global.VobloxArcade = { open: open };
})(typeof window !== "undefined" ? window : globalThis);
