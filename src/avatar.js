/*
 * Voblox — blocky avatar renderer (canvas 2D, Roblox-R6 style, fully procedural).
 * Draws the player AND the AI bots in every arcade game, so equipped skins are
 * visible everywhere. No sprite sheets: limbs are rounded rects with per-pose
 * joint angles; hats/faces/held items render as emoji (matches the game's look).
 *
 * config: { skin:"#ffcc88", shirt:"#2f7be0", pants:"#394063",
 *           face:"smile"|<emoji>, hat:<emoji>|null, held:<emoji>|null }
 * draw(ctx, { x, y (FEET anchor), size (total height), config, pose, frame (s),
 *             name, flip (face left) })
 */
(function (global) {
  var DEFAULT = { skin: "#ffcc88", shirt: "#2f7be0", pants: "#394063", face: "smile", hat: null, held: null };

  function shade(hex, f) { // f<1 darkens
    try {
      var n = parseInt(hex.slice(1), 16);
      var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
      return "rgb(" + r + "," + g + "," + b + ")";
    } catch (e) { return hex; }
  }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // Pose functions: frame (seconds) -> joint angles (radians) + body offsets.
  // Limbs hang DOWN from their pivot; ~±2.6 points them up. drop sinks the hips (sit).
  var POSES = {
    idle: function (f) { var s = Math.sin(f * 2.2); return { la: 0.07 + s * 0.04, ra: -0.07 - s * 0.04, ll: 0.03, rl: -0.03, lean: 0, bob: s * 0.012, drop: 0 }; },
    run: function (f) { var sw = Math.sin(f * 11); return { la: -sw * 0.9, ra: sw * 0.9, ll: sw * 0.8, rl: -sw * 0.8, lean: 0.07, bob: Math.abs(Math.cos(f * 11)) * 0.02, drop: 0 }; },
    jump: function () { return { la: 2.5, ra: -2.5, ll: -0.35, rl: 0.3, lean: -0.04, bob: 0, drop: 0 }; },
    kick: function (f) { var k = Math.min(1, f * 6); return { la: 0.5, ra: -0.9, ll: 0.25, rl: -0.4 - k * 1.2, lean: -0.12, bob: 0, drop: 0 }; },
    swing: function (f) { var k = Math.min(1, f * 8); return { la: 0.35, ra: -2.5 + k * 3.1, ll: 0.12, rl: -0.12, lean: 0.1, bob: 0, drop: 0 }; },
    sit: function () { return { la: -0.55, ra: -0.55, ll: -1.35, rl: -1.35, lean: 0.04, bob: 0, drop: 0.5 }; },
    celebrate: function (f) { var s = Math.sin(f * 9); return { la: 2.6 + s * 0.3, ra: -2.6 - s * 0.3, ll: 0.05, rl: -0.05, lean: 0, bob: Math.abs(s) * 0.035, drop: 0 }; },
    fall: function (f) { var s = Math.sin(f * 20); return { la: 2.2 + s * 0.4, ra: -2.2 - s * 0.4, ll: s * 0.5, rl: -s * 0.5, lean: 0.15, bob: 0, drop: 0 }; }
  };

  function limb(c, px, py, w, h, ang, color, outline) {
    c.save(); c.translate(px, py); c.rotate(ang || 0);
    rr(c, -w / 2, 0, w, h, w * 0.32);
    c.fillStyle = color; c.fill();
    c.lineWidth = outline; c.strokeStyle = shade(color, 0.62); c.stroke();
    c.restore();
  }

  function draw(c, o) {
    var s = o.size || 60, cfg = o.config || DEFAULT;
    var pose = POSES[o.pose] ? o.pose : "idle";
    var p = POSES[pose](o.frame || 0);
    var skin = cfg.skin || DEFAULT.skin, shirt = cfg.shirt || DEFAULT.shirt, pants = cfg.pants || DEFAULT.pants;
    var legH = s * 0.34, legW = s * 0.115, torsoH = s * 0.35, torsoW = s * 0.30, armH = s * 0.30, armW = s * 0.095, headS = s * 0.24;
    var out = Math.max(1.4, s * 0.022);
    var drop = (p.drop || 0) * legH;

    c.save();
    c.translate(o.x, o.y + p.bob * s);
    if (o.flip) c.scale(-1, 1);
    c.rotate(p.lean || 0);

    var hipY = -legH + drop;          // hip line (feet at 0, or sunk when sitting)
    var shoY = hipY - torsoH;         // shoulder line
    var headTop = shoY - headS - s * 0.005;

    // far side first (slightly darker), then torso, then near side
    limb(c, -torsoW * 0.34, shoY + armH * 0.06, armW, armH, p.la, shade(skin, 0.82), out);
    limb(c, -torsoW * 0.22, hipY, legW, legH, p.ll, shade(pants, 0.82), out);
    rr(c, -torsoW / 2, shoY, torsoW, torsoH, s * 0.035);
    c.fillStyle = shirt; c.fill(); c.lineWidth = out; c.strokeStyle = shade(shirt, 0.62); c.stroke();
    limb(c, torsoW * 0.22, hipY, legW, legH, p.rl, pants, out);
    limb(c, torsoW * 0.34, shoY + armH * 0.06, armW, armH, p.ra, skin, out);

    // head
    rr(c, -headS / 2, headTop, headS, headS, s * 0.03);
    c.fillStyle = skin; c.fill(); c.lineWidth = out; c.strokeStyle = shade(skin, 0.62); c.stroke();

    // face: keyword -> drawn eyes+smile; emoji -> stamped on the head
    var face = cfg.face || "smile";
    if (/^[a-z]+$/.test(face)) {
      var ex = headS * 0.2, ey = headTop + headS * 0.38;
      c.fillStyle = "#26323a";
      c.fillRect(-ex - headS * 0.07, ey, headS * 0.14, headS * 0.17);
      c.fillRect(ex - headS * 0.07, ey, headS * 0.14, headS * 0.17);
      c.strokeStyle = "#26323a"; c.lineWidth = Math.max(1.4, s * 0.024);
      c.beginPath(); c.arc(0, headTop + headS * 0.6, headS * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    } else {
      c.font = Math.round(headS * 0.78) + "px serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(face, 0, headTop + headS * 0.55);
    }

    // hat sits on the head; held item rides the near hand
    if (cfg.hat) {
      c.font = Math.round(headS * 0.95) + "px serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(cfg.hat, 0, headTop - headS * 0.18);
    }
    var held = o.heldOverride !== undefined ? o.heldOverride : cfg.held;
    if (held) {
      var ha = p.ra || 0;
      var hx = torsoW * 0.34 + Math.sin(ha) * armH, hy = shoY + armH * 0.06 + Math.cos(ha) * armH;
      c.font = Math.round(s * 0.30) + "px serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(held, hx, hy);
    }
    c.restore();

    // name tag (drawn unflipped so text reads correctly)
    if (o.name) {
      c.save();
      c.font = "bold " + Math.max(10, Math.round(s * 0.16)) + "px Trebuchet MS, sans-serif";
      c.textAlign = "center"; c.textBaseline = "middle";
      var ty = o.y + p.bob * s - s * 1.02 + drop * 0.5;
      var w = c.measureText(o.name).width + s * 0.18;
      rr(c, o.x - w / 2, ty - s * 0.1, w, s * 0.2, s * 0.06);
      c.fillStyle = "rgba(0,0,0,.55)"; c.fill();
      c.fillStyle = "#fff"; c.fillText(o.name, o.x, ty);
      c.restore();
    }
  }

  // Head-only (HUD chips, cards, bot rosters)
  function drawHead(c, o) {
    var s = o.size || 34, cfg = o.config || DEFAULT;
    var out = Math.max(1.2, s * 0.05);
    c.save(); c.translate(o.x, o.y);
    rr(c, -s / 2, -s / 2, s, s, s * 0.14);
    c.fillStyle = cfg.skin || DEFAULT.skin; c.fill(); c.lineWidth = out; c.strokeStyle = shade(cfg.skin || DEFAULT.skin, 0.62); c.stroke();
    var face = cfg.face || "smile";
    if (/^[a-z]+$/.test(face)) {
      c.fillStyle = "#26323a";
      c.fillRect(-s * 0.26, -s * 0.12, s * 0.14, s * 0.17); c.fillRect(s * 0.12, -s * 0.12, s * 0.14, s * 0.17);
      c.strokeStyle = "#26323a"; c.lineWidth = Math.max(1.2, s * 0.06);
      c.beginPath(); c.arc(0, s * 0.1, s * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    } else {
      c.font = Math.round(s * 0.74) + "px serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(face, 0, s * 0.06);
    }
    if (cfg.hat) { c.font = Math.round(s * 0.9) + "px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(cfg.hat, 0, -s * 0.62); }
    c.restore();
  }

  // Merge saved avatar colors with equipped items -> a drawable config.
  function resolve(state) {
    state = state || {};
    var av = (state.profile && state.profile.avatar) || {};
    var eq = state.equipped || {};
    var IT = global.VobloxItems;
    function item(id) { return (IT && id && IT.byId[id]) || null; }
    var shirtIt = item(eq.shirt), pantsIt = item(eq.pants), faceIt = item(eq.face), hatIt = item(eq.hat), trailIt = item(eq.trail), petIt = item(eq.pet);
    // hatched Pet Paradise pets equip as "hatch:<index>" and follow like item buddies
    var hatch = /^hatch:(\d+)$/.exec(eq.pet || "");
    var hatchPet = hatch && state.pets && state.pets[+hatch[1]] ? state.pets[+hatch[1]] : null;
    return {
      skin: av.skin || DEFAULT.skin,
      shirt: (shirtIt && shirtIt.color) || av.shirt || DEFAULT.shirt,
      pants: (pantsIt && pantsIt.color) || av.pants || DEFAULT.pants,
      face: faceIt ? faceIt.emoji : (av.face || "smile"),
      hat: hatIt ? hatIt.emoji : (av.hat || null),
      held: null,
      trail: trailIt || null,
      pet: hatchPet ? (hatchPet.shiny ? "✨" : "") + hatchPet.emoji : (petIt ? petIt.emoji : null)
    };
  }

  global.VobloxAvatar = { draw: draw, drawHead: drawHead, resolve: resolve, POSES: Object.keys(POSES), DEFAULT: DEFAULT, shade: shade };
})(typeof window !== "undefined" ? window : globalThis);
