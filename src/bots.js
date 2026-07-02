/*
 * Voblox — AI player roster. Bots are DATA + tiny helpers; each game implements
 * its own behavior parameterized by bot.skill (0..1), e.g.
 *   reactionMs = 500 - 400*skill;  aimError = (1-skill)*30px
 * Bots render with VobloxAvatar (their configs use raw emoji for face/hat) and
 * get name tags + friendly chat bubbles so games feel multiplayer.
 */
(function (global) {
  function bot(id, name, skill, av, extra) {
    return {
      id: id, name: name, skill: skill,
      avatar: { skin: av[0], shirt: av[1], pants: av[2], face: av[3] || "smile", hat: av[4] || null },
      chat: extra || {}
    };
  }
  var CHAT = {
    hi: ["let's go!", "good luck!", "hi!!", "this is fun", "ready?", "you got this!"],
    gg: ["gg!", "good game!", "rematch soon?", "that was close!", "nice playing!"],
    win: ["yes!!", "woohoo!", "I did it!", "gg!"],
    lose: ["aww", "nice one!", "you're good!", "next time!"],
    nice: ["wow!", "no way!", "so cool!", "nice!!", "amazing!"]
  };

  var ALL = [
    bot("blaze", "Blaze", 0.34, ["#e0ac69", "#e74c3c", "#2c3e50", "😎", "🧢"]),
    bot("zippy", "Zippy_99", 0.22, ["#ffdbac", "#ff8c42", "#394063", "😜", null]),
    bot("luna", "LunaCraft", 0.45, ["#f1c27d", "#9b59b6", "#23272e", "smile", "🌸"]),
    bot("pete", "PixelPete", 0.30, ["#ffcc88", "#2ecc71", "#7a5230", "smile", "🧢"]),
    bot("rex", "RoboRex", 0.62, ["#c68642", "#5a6b7a", "#23272e", "🤖", null]),
    bot("carla", "CoachCarla", 0.55, ["#8d5524", "#ff7eb9", "#2c3e50", "smile", "⛑️"]),
    bot("bricks", "SirBricks", 0.48, ["#ffcc88", "#b3392f", "#5b6d4a", "smile", "🪖"]),
    bot("noodle", "NoodleNed", 0.18, ["#ffdbac", "#ffd740", "#2f7d4f", "😜", null]),
    bot("mia", "MegaMia", 0.70, ["#f1c27d", "#40c4ff", "#23272e", "🤩", "⭐"]),
    bot("tom", "TurboTom", 0.58, ["#e0ac69", "#ff5252", "#eef0f4", "😎", null]),
    bot("gg", "GrandmaGG", 0.85, ["#ffdbac", "#6b4fa8", "#7a5230", "smile", "👒"]),
    bot("cleats", "CaptainCleats", 0.52, ["#c68642", "#2f9e44", "#23272e", "smile", null]),
    bot("dara", "DiamondDara", 0.75, ["#f1c27d", "#40e0d0", "#394063", "🤩", "👑"]),
    bot("sam", "SneakySam", 0.40, ["#ffcc88", "#23272e", "#23272e", "😏", null]),
    bot("paws", "ProfessorPaws", 0.66, ["#e0ac69", "#8a5a3b", "#2c3e50", "😺", "🎓"]),
    bot("waffle", "WaffleWill", 0.26, ["#ffdbac", "#e8a33d", "#b3392f", "😋", null]),
    bot("ria", "RocketRia", 0.60, ["#8d5524", "#ff7a3d", "#23272e", "smile", "⛑️"]),
    bot("ben", "BlockyBen", 0.36, ["#ffcc88", "#5cab3e", "#394063", "smile", null]),
    bot("emma", "EchoEmma", 0.44, ["#f1c27d", "#e040fb", "#23272e", "🥳", null]),
    bot("finn", "FrostyFinn", 0.50, ["#ffdbac", "#9fd6ff", "#eef0f4", "smile", "❄️"]),
    bot("gus", "GigaGus", 0.78, ["#c68642", "#2c3e50", "#b3392f", "😤", "🪖"]),
    bot("hana", "HappyHana", 0.32, ["#f1c27d", "#ffd1dc", "#6b4fa8", "🥳", "🎀"]),
    bot("jax", "JollyJax", 0.42, ["#e0ac69", "#0abde3", "#23272e", "😄", null]),
    bot("queenq", "QueenQuinn", 0.92, ["#ffdbac", "#b06dff", "#23272e", "smile", "👑"])
  ];
  var byId = {}; ALL.forEach(function (b) { b.chat = CHAT; byId[b.id] = b; });

  // Opponents near a target skill (with a little jitter so lineups vary).
  function pickOpponents(count, targetSkill, excludeIds) {
    var ex = excludeIds || [];
    var pool = ALL.filter(function (b) { return ex.indexOf(b.id) === -1; });
    pool.sort(function (a, b) {
      return (Math.abs(a.skill - targetSkill) + Math.random() * 0.15) -
             (Math.abs(b.skill - targetSkill) + Math.random() * 0.15);
    });
    return pool.slice(0, count || 1);
  }
  function say(b, key) { var lines = (b.chat && b.chat[key]) || CHAT[key] || ["!"]; return lines[Math.floor(Math.random() * lines.length)]; }

  // Canvas speech bubble; call every frame while active. age in seconds (fades ~1.8-2.4s).
  function bubble(c, o) {
    var age = o.age || 0; if (age > 2.4) return false;
    var alpha = age < 1.8 ? 1 : 1 - (age - 1.8) / 0.6;
    var text = o.text || "", maxW = o.maxW || 180;
    c.save(); c.globalAlpha = Math.max(0, alpha);
    c.font = "bold 13px Trebuchet MS, sans-serif";
    var w = Math.min(maxW, c.measureText(text).width) + 16, h = 24, x = o.x - w / 2, y = o.y - h;
    c.beginPath(); c.moveTo(x + 8, y);
    c.arcTo(x + w, y, x + w, y + h, 8); c.arcTo(x + w, y + h, x, y + h, 8);
    c.arcTo(x, y + h, x, y, 8); c.arcTo(x, y, x + w, y, 8); c.closePath();
    c.fillStyle = "#fff"; c.fill(); c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(o.x - 5, y + h); c.lineTo(o.x + 5, y + h); c.lineTo(o.x, y + h + 7); c.closePath(); c.fill();
    c.fillStyle = "#20303a"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(text, o.x, y + h / 2, maxW);
    c.restore();
    return true;
  }

  global.VobloxBots = { ALL: ALL, byId: byId, pickOpponents: pickOpponents, say: say, bubble: bubble };
})(typeof window !== "undefined" ? window : globalThis);
