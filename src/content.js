/*
 * Voblox — word content
 * ----------------------
 * Lesson data, transcribed from Leo's Wordly Wise 3000 Book 4 workbook (Lesson 5).
 * Definitions and example sentences match the book so practice transfers to the quiz.
 *
 * Each word can have multiple `senses` (the quiz tests alternative meanings), plus
 * related `forms` (e.g. achievement, persistence) that the lesson also teaches.
 *
 * To add a lesson later, copy the shape of lesson "5".
 */
(function (global) {
  function entry(o) {
    // convenience fields used by the engine/UI (primary sense)
    o.pos = o.senses[0].pos;
    o.definition = o.senses[0].def;
    o.example = o.senses[0].example;
    o.multi = o.senses.length > 1;
    o.forms = o.forms || [];
    o.synonyms = o.synonyms || [];
    o.antonyms = o.antonyms || [];
    return o;
  }

  var LESSON5 = {
    lesson: 5,
    title: "Lesson 5",
    words: [
      entry({
        word: "abrupt", emoji: "🛑", pron: "ə-BRUPT",
        senses: [
          { pos: "adj", def: "happening suddenly, without warning",
            example: "When the bus made an abrupt stop, several people were thrown off balance." }
        ],
        synonyms: ["sudden", "unexpected", "sharp"], antonyms: ["gradual", "expected"],
        mnemonic: "An abrupt stop can interrupt you."
      }),
      entry({
        word: "achieve", emoji: "🏆", pron: "ə-CHEEV",
        senses: [
          { pos: "verb", def: "to do what one sets out to do",
            example: "Even though she was blind and deaf, Helen Keller achieved her goal of graduating from college." }
        ],
        forms: [
          { word: "achievement", pos: "noun", def: "something done that takes skill or effort",
            example: "Landing astronauts on the moon was a great achievement." }
        ],
        synonyms: ["accomplish", "reach", "attain"], antonyms: ["fail"],
        mnemonic: "You achieve when you reach your dream."
      }),
      entry({
        word: "attempt", emoji: "🎯", pron: "ə-TEMPT",
        senses: [
          { pos: "verb", def: "to try; to make an effort",
            example: "When I attempted to leave class early, the teacher asked me to wait until the period was over." },
          { pos: "noun", def: "a try",
            example: "The athlete cleared the bar in the high jump on her third attempt." }
        ],
        synonyms: ["try", "effort"], antonyms: ["quit"],
        mnemonic: "An attempt is when you 'a-tempt' to try."
      }),
      entry({
        word: "contempt", emoji: "😒", pron: "kən-TEMPT",
        senses: [
          { pos: "noun", def: "a feeling that someone or something is bad or unworthy",
            example: "Their classmates felt nothing but contempt for those who refused to help the new student." }
        ],
        synonyms: ["scorn", "disrespect"], antonyms: ["respect", "admiration"],
        mnemonic: "Contempt is when you condemn someone as unworthy."
      }),
      entry({
        word: "entertain", emoji: "🎭", pron: "en-ter-TAIN",
        senses: [
          { pos: "verb", def: "to interest and amuse",
            example: "My little brother Ramon entertained himself for hours with his new paints." },
          { pos: "verb", def: "to have guests",
            example: "We entertained some old friends on Thanksgiving weekend." },
          { pos: "verb", def: "to have in mind",
            example: "Lin is entertaining the idea of going to soccer camp next summer." }
        ],
        synonyms: ["amuse", "interest"], antonyms: ["bore"],
        mnemonic: "Entertain guests — and keep ideas 'in' your brain."
      }),
      entry({
        word: "glimpse", emoji: "👀", pron: "GLIMPS",
        senses: [
          { pos: "verb", def: "to get a quick look at",
            example: "I glimpsed a black bear near our campground." },
          { pos: "noun", def: "a quick or hasty look",
            example: "I was excited to get a glimpse of the famous author at the restaurant." }
        ],
        synonyms: ["peek", "glance"], antonyms: ["stare"],
        mnemonic: "A glimpse is a glance you barely catch."
      }),
      entry({
        word: "mock", emoji: "😝", pron: "MOK",
        senses: [
          { pos: "verb", def: "to make fun of",
            example: "Cinderella's stepsisters mocked her for thinking she could go to the ball." },
          { pos: "adj", def: "not real; pretend",
            example: "We had a mock trial at school to learn about the law." }
        ],
        synonyms: ["tease", "ridicule"], antonyms: ["praise"],
        mnemonic: "Mock rhymes with knock — mocking knocks someone down."
      }),
      entry({
        word: "persist", emoji: "🔁", pron: "pər-SIST",
        senses: [
          { pos: "verb", def: "to keep on doing or trying",
            example: "In spite of many falls on the skateboard, she persisted and finally was able to skate backward." },
          { pos: "verb", def: "to go on and on",
            example: "If this rain persists, we'll have to cut our vacation short." }
        ],
        forms: [
          { word: "persistence", pos: "noun", def: "sticking to something; not giving up",
            example: "Ramon's persistence was rewarded when the teacher let him do his magic tricks for the class." },
          { word: "persistent", pos: "adj", def: "refusing to give up",
            example: "The persistent teacher would not stop until we understood long division." }
        ],
        synonyms: ["continue", "persevere"], antonyms: ["quit", "stop"],
        mnemonic: "Persist = keep at it, like rain that won't quit."
      }),
      entry({
        word: "persuade", emoji: "🗣️", pron: "pər-SWADE",
        senses: [
          { pos: "verb", def: "to win someone over by arguing or asking",
            example: "Frank finally persuaded me to read The Adventures of Tom Sawyer." }
        ],
        forms: [
          { word: "persuasive", pos: "adj", def: "having the power to persuade",
            example: "Mary was so persuasive that we agreed to help her paint her room." }
        ],
        synonyms: ["convince", "coax"], antonyms: ["discourage"],
        mnemonic: "per-SWAY-d: you sway someone to your side."
      }),
      entry({
        word: "phase", emoji: "🌓", pron: "FAYZ",
        senses: [
          { pos: "noun", def: "a stage in a series of changes",
            example: "The full moon is one of the phases of the moon." }
        ],
        synonyms: ["stage", "step", "period"], antonyms: [],
        mnemonic: "The moon's phases are its stages."
      }),
      entry({
        word: "quaint", emoji: "🏡", pron: "KWAINT",
        senses: [
          { pos: "adj", def: "odd or unusual in a pleasing or old-fashioned way",
            example: "Wooden shoes seem quaint to Americans, but not to the people of Holland." }
        ],
        synonyms: ["charming", "old-fashioned"], antonyms: ["modern", "ordinary"],
        mnemonic: "A quaint place is cute and 'ain't' new."
      }),
      entry({
        word: "recall", emoji: "🧠", pron: "ri-KAWL",
        senses: [
          { pos: "verb", def: "to remember",
            example: "Do you recall what time we left for the soccer game?" },
          { pos: "verb", def: "to call or take back",
            example: "The builder recalled the baby cribs because they were not safe." }
        ],
        synonyms: ["remember", "recollect"], antonyms: ["forget"],
        mnemonic: "Recall = re-call the memory back."
      }),
      entry({
        word: "reject", emoji: "🚫", pron: "ri-JEKT",
        senses: [
          { pos: "verb", def: "to refuse to accept or use",
            example: "The school board rejected the plan for the new gym because the cost was excessive." },
          { pos: "noun", def: "something that falls short of what is acceptable",
            example: "Peter buys clothing rejects and sews them into better styles." }
        ],
        synonyms: ["refuse", "decline"], antonyms: ["accept", "approve"],
        mnemonic: "Re-JECT — to eject (throw out) an idea."
      }),
      entry({
        word: "revise", emoji: "✏️", pron: "ri-VIZE",
        senses: [
          { pos: "verb", def: "to go over carefully in order to correct or improve",
            example: "I don't like to revise my stories, but they get better when I do." },
          { pos: "verb", def: "to change in order to bring up to date",
            example: "Our soccer league revised the rules to keep more people from getting hurt." }
        ],
        synonyms: ["edit", "improve"], antonyms: [],
        mnemonic: "Re-VISE — look again and fix it."
      }),
      entry({
        word: "sensitive", emoji: "🌡️", pron: "SEN-sə-tiv",
        senses: [
          { pos: "adj", def: "quick to notice or feel",
            example: "My mom is very sensitive to my feelings." },
          { pos: "adj", def: "easily affected by even slight change",
            example: "I wear sunglasses because my eyes are sensitive to light." }
        ],
        synonyms: ["tender", "responsive"], antonyms: ["insensitive"],
        mnemonic: "A sensitive sensor notices the smallest change."
      })
    ]
  };

  var LESSONS = { "5": LESSON5 };

  var Content = {
    LESSONS: LESSONS,
    getLesson: function (n) { return LESSONS[String(n)]; },
    listLessons: function () { return Object.keys(LESSONS).map(function (k) { return LESSONS[k]; }); }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Content;
  global.VOBLOX_CONTENT = Content;
})(typeof window !== "undefined" ? window : globalThis);
