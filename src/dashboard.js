/* Voblox — parent dashboard (read-only view of the shared save) */
(function () {
  var Content = window.VOBLOX_CONTENT, Engine = window.VobloxEngine, VQ = window.VobloxQuestions;
  var store = new window.VobloxStore.Store(Content.allWords());
  var s = store.state;

  function esc(x) { return VQ.esc(x); }
  function gradeClass(p) { return p >= 90 ? "A" : p >= 80 ? "B" : "low"; }
  function gradeLabel(p) { return p >= 90 ? "A" : p >= 80 ? "B" : p >= 70 ? "C" : "—"; }
  function lastPlayed() { if (!s.lastPlayed) return "not yet"; var d = new Date(s.lastPlayed); return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

  var avail = Content.availableLessons();
  var masteredAll = Content.allWords().filter(function (w) { return Engine.isMastered(s.cards[w.word]); }).length;

  var html = "";
  // overall
  html += '<div class="card"><div class="lessonhead"><h2 style="margin:0">Overall</h2>' +
    '<div>' +
    '<span class="stat">' + store.rank().icon + " " + store.rank().name + '</span>' +
    '<span class="stat"><img class="vbx" src="icons/vobux.png" alt=""> ' + s.gems + ' Vobux</span>' +
    '<span class="stat">🔥 ' + store.streak() + '-day streak</span>' +
    '</div></div>' +
    '<div class="row2"><span class="stat">✅ ' + s.totalCorrect + ' correct answers</span>' +
    '<span class="stat">🏅 best combo ' + (s.bestCombo || 0) + '</span>' +
    '<span class="stat">📚 ' + masteredAll + ' words long-term mastered</span>' +
    '<span class="stat">🕒 last played: ' + esc(lastPlayed()) + '</span>' +
    '<span class="stat" title="wrong answers given within 2.5s — a guessing signal">⚡ ' + (s.fastWrong || 0) + ' rushed guesses</span>' +
    '<span class="stat" title="Vobux lost to wrong answers and skips">💸 ' + (s.vobuxLost || 0) + ' Vobux lost</span></div></div>';

  if (!avail.length) html += '<div class="card">No lessons loaded yet.</div>';

  avail.forEach(function (L) {
    var p = store.predicted(L.words);
    var ready = store.readyCount(L.words);
    var atRisk = store.atRisk(L.words);
    var isActive = String(L.lesson) === String(s.activeLesson);
    html += '<div class="card">' +
      '<div class="lessonhead"><h2 style="margin:0">' + esc(L.title) + (isActive ? ' <span class="pill ready">active</span>' : "") + '</h2>' +
      '<div style="text-align:right"><div class="gradebig ' + gradeClass(p) + '">' + p + '%</div>' +
      '<div class="' + gradeClass(p) + '" style="font-weight:bold">predicted: ' + gradeLabel(p) + '</div></div></div>' +
      '<div class="barwrap"><div class="bar" style="width:' + p + '%"></div></div>' +
      '<div class="summary">' + summary(p, ready, L.words.length, atRisk) + '</div>';

    // per-word table
    html += '<table><tr><th>Word</th><th>Quiz-ready?</th><th>Level</th><th>Tries</th><th>Correct</th></tr>';
    L.words.forEach(function (w) {
      var c = s.cards[w.word], ok = Engine.isQuizReady(c);
      html += '<tr><td><b>' + esc(w.word) + '</b>' + (w.senses.length > 1 ? ' <span class="muted">(' + w.senses.length + " meanings)</span>" : "") + '</td>' +
        '<td>' + (ok ? '<span class="pill ready">ready ✓</span>' : '<span class="pill notready">practice</span>') + '</td>' +
        '<td>box ' + c.box + '/5</td><td>' + c.attempts + '</td><td>' + c.corrects + '</td></tr>';
    });
    html += '</table>';

    html += '<div class="row2"><a class="btn" href="index.html" onclick="VOBLOX_setActive(' + L.lesson + ')">▶ Make active &amp; open game</a>' +
      '<a class="btn alt" href="index.html#boss" onclick="VOBLOX_setActive(' + L.lesson + ')">⚔️ Boss Battle this lesson</a></div>';
    html += '</div>';
  });

  html += '<div class="card"><h2>Add more lessons</h2><p>To keep words 100% accurate to Leo’s book, the best way to add a lesson is to send a photo of the workbook’s word-list page — it gets added in a couple of minutes. (The cumulative word-list poster’s lesson numbers don’t match the workbook, so photos are the reliable source.)</p></div>';

  function summary(p, ready, total, atRisk) {
    var lead = p >= 90 ? "On track for an <b>A</b> 🌟" : p >= 80 ? "On track for a <b>B</b> 👍 — a little more for an A." : "Needs more practice to reach a B.";
    var risk = atRisk.length ? " Still to master (" + ready + "/" + total + " ready): <b>" + atRisk.map(esc).join(", ") + "</b>." : " All " + total + " words are quiz-ready! 🎉";
    return lead + risk;
  }

  document.getElementById("dash").innerHTML = html;

  window.VOBLOX_setActive = function (n) {
    store.state.activeLesson = String(n); store.save();
  };
})();
