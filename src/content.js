/*
 * Voblox — word content
 * ----------------------
 * Lesson data, transcribed from Leo's Wordly Wise 3000 Book 4 workbook (Lessons 5–6).
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

  var LESSON6 = {
    lesson: 6,
    title: "Lesson 6",
    words: [
      entry({
        word: "applaud", emoji: "👏", pron: "ə-PLAWD",
        senses: [
          { pos: "verb", def: "to show approval, especially by clapping the hands",
            example: "The audience applauded until the actors came back on stage to take another bow." }
        ],
        forms: [
          { word: "applause", pos: "noun", def: "the showing of approval or enjoyment by cheering or clapping",
            example: "The theater lights came on after the applause had died down." }
        ],
        synonyms: ["clap", "cheer", "praise"], antonyms: ["boo", "criticize"],
        mnemonic: "Applaud = clap so 'a-loud' that you show you approve!"
      }),
      entry({
        word: "crafty", emoji: "🦊", pron: "KRAF-tee",
        senses: [
          { pos: "adj", def: "skilled at tricking others",
            example: "Templeton, the crafty rat in Charlotte's Web, adds humor to the book." }
        ],
        synonyms: ["sly", "cunning", "sneaky"], antonyms: ["honest", "naive"],
        mnemonic: "A crafty fox uses sneaky 'craft' to trick you."
      }),
      entry({
        word: "disclose", emoji: "🔓", pron: "dis-KLOHZ",
        senses: [
          { pos: "verb", def: "to make known",
            example: "The principal told us we must disclose the names of those who broke the window." }
        ],
        synonyms: ["reveal", "tell", "expose"], antonyms: ["hide", "conceal"],
        mnemonic: "Disclose is the opposite of 'close' — you open a secret up."
      }),
      entry({
        word: "drab", emoji: "🌫️", pron: "DRAB",
        senses: [
          { pos: "adj", def: "dull and without color; not cheerful or colorful",
            example: "A brown sparrow is a drab little bird compared to a bright red cardinal." }
        ],
        synonyms: ["dull", "colorless", "dreary"], antonyms: ["bright", "colorful", "cheerful"],
        mnemonic: "Drab is dull and blah — no color at all."
      }),
      entry({
        word: "entire", emoji: "🧩", pron: "en-TIRE",
        senses: [
          { pos: "adj", def: "having nothing left out; whole; complete",
            example: "I recited the entire Robert Frost poem from memory." }
        ],
        synonyms: ["whole", "complete", "total"], antonyms: ["partial", "incomplete"],
        mnemonic: "Entire means the en-TIRE thing — every bit of it."
      }),
      entry({
        word: "exclaim", emoji: "🗯️", pron: "eks-KLAYM",
        senses: [
          { pos: "verb", def: "to speak suddenly and with strong feeling",
            example: "'Today was the worst day of my life!' she exclaimed." }
        ],
        forms: [
          { word: "exclamation", pos: "noun", def: "a sharp cry of strong feeling",
            example: "Grandpa's exclamation of pain sent me rushing to his side." }
        ],
        synonyms: ["shout", "cry out", "blurt"], antonyms: ["whisper", "mumble"],
        mnemonic: "When you exclaim, you make a loud 'claim'!"
      }),
      entry({
        word: "exquisite", emoji: "🏺", pron: "ek-SKWIZ-it",
        senses: [
          { pos: "adj", def: "finely done or made; very beautiful",
            example: "The exquisite wood carvings on the museum door came from the island of Bali." }
        ],
        synonyms: ["beautiful", "elegant", "delicate"], antonyms: ["crude", "plain", "ugly"],
        mnemonic: "Exquisite = extra-special: finely made and beautiful."
      }),
      entry({
        word: "intend", emoji: "🧭", pron: "in-TEND",
        senses: [
          { pos: "verb", def: "to plan; to have in mind",
            example: "I intend to play in our recital on Monday." }
        ],
        forms: [
          { word: "intention", pos: "noun", def: "an aim, plan, or purpose",
            example: "Theo's intention was to work in a bookstore, but she decided to go to summer camp instead." }
        ],
        synonyms: ["plan", "mean", "aim"], antonyms: [],
        mnemonic: "Intend = it's 'in' your mind as a plan."
      }),
      entry({
        word: "jeer", emoji: "👎", pron: "JEER",
        senses: [
          { pos: "verb", def: "to speak or cry out in scorn; to mock",
            example: "My brother told me to ignore the older boys if they jeered when I sang." },
          { pos: "noun", def: "something said that is meant to hurt or insult",
            example: "A football coach soon learns to ignore the jeers of the crowd." }
        ],
        synonyms: ["mock", "taunt", "ridicule"], antonyms: ["praise", "cheer", "applaud"],
        mnemonic: "Jeer rhymes with sneer — a scornful shout."
      }),
      entry({
        word: "peer", emoji: "🔍", pron: "PEER",
        senses: [
          { pos: "verb", def: "to look closely; to stare, especially at something hard to see or understand",
            example: "Ahmed peered at the sign, trying to read what it said." }
        ],
        synonyms: ["stare", "gaze", "squint"], antonyms: ["glance"],
        mnemonic: "Peer = peek hard at something tough to see."
      }),
      entry({
        word: "progress", emoji: "📈", pron: "PRAH-gres / prə-GRES",
        senses: [
          { pos: "noun", def: "movement toward a goal",
            example: "The story showed the small boat's progress across the lake." },
          { pos: "noun", def: "an improvement",
            example: "I am finally making some progress learning the new app." },
          { pos: "verb", def: "to move forward",
            example: "Work on the new bridge progressed at a faster pace when the weather improved." },
          { pos: "verb", def: "to advance to a higher stage; to improve",
            example: "Maria progressed to the tuba so that she could get into the school band." }
        ],
        synonyms: ["advance", "improve", "develop"], antonyms: ["regress", "decline"],
        mnemonic: "To 'pro-gress' is to step forward."
      }),
      entry({
        word: "refine", emoji: "⚗️", pron: "ri-FINE",
        senses: [
          { pos: "verb", def: "to make pure by removing all unwanted matter",
            example: "We take oil from deep inside the earth and refine it into gasoline." }
        ],
        forms: [
          { word: "refined", pos: "adj", def: "in a pure state, with unwanted matter removed",
            example: "Refined flour has a lot of the wheat germ removed." },
          { word: "refined", pos: "adj", def: "having good manners and good taste",
            example: "He was a noisy, rude boy, but as a young man he is gentle and refined." }
        ],
        synonyms: ["purify", "polish", "improve"], antonyms: ["pollute"],
        mnemonic: "Refine makes something re-FINE: pure and polished."
      }),
      entry({
        word: "scoundrel", emoji: "🦹", pron: "SKOWN-drəl",
        senses: [
          { pos: "noun", def: "a mean or wicked person",
            example: "I am glad the police caught the scoundrel who stole my wallet." }
        ],
        synonyms: ["villain", "rascal", "rogue"], antonyms: ["hero"],
        mnemonic: "A scoundrel is a scummy, wicked rascal."
      }),
      entry({
        word: "uneasy", emoji: "😟", pron: "un-EE-zee",
        senses: [
          { pos: "adj", def: "not comfortable; worried or nervous",
            example: "I felt uneasy walking down the dark street until I saw my dad on the corner." }
        ],
        synonyms: ["nervous", "anxious", "worried"], antonyms: ["calm", "relaxed", "comfortable"],
        mnemonic: "Uneasy = un-easy: not at ease, a little worried."
      }),
      entry({
        word: "vain", emoji: "🪞", pron: "VAYN",
        senses: [
          { pos: "adj", def: "having too high an opinion of one's looks or achievements",
            example: "Charlie is so vain he has a full-length mirror in every room." },
          { pos: "adj", def: "without success or result; useless",
            example: "The firefighters made a vain attempt to keep the fire from spreading." }
        ],
        forms: [
          { word: "in vain", pos: "adv", def: "without success",
            example: "All my hand-waving was in vain — the teacher never called on me." }
        ],
        synonyms: ["conceited", "useless", "futile"], antonyms: ["modest", "humble", "successful"],
        mnemonic: "Vain = stuck on your mirror, or all for nothing."
      })
    ]
  };

  // Registry of lessons. Only lessons with a `words` array are "available" / playable.
  // To add a lesson: define it like LESSON5/LESSON6 and add it here.
  var LESSONS = { "5": LESSON5, "6": LESSON6 };

  function flat() {
    var out = [], seen = {};
    Object.keys(LESSONS).forEach(function (k) {
      (LESSONS[k].words || []).forEach(function (w) { if (!seen[w.word]) { seen[w.word] = k; out.push(w); } });
    });
    return out;
  }

  var Content = {
    LESSONS: LESSONS,
    getLesson: function (n) { return LESSONS[String(n)]; },
    listLessons: function () { return Object.keys(LESSONS).map(function (k) { return LESSONS[k]; }); },
    availableLessons: function () {
      return Object.keys(LESSONS).map(function (k) { return LESSONS[k]; })
        .filter(function (L) { return L.words && L.words.length; })
        .sort(function (a, b) { return a.lesson - b.lesson; });
    },
    allWords: flat,
    lessonOf: function (word) {
      var r = null;
      Object.keys(LESSONS).forEach(function (k) { if ((LESSONS[k].words || []).some(function (w) { return w.word === word; })) r = LESSONS[k].lesson; });
      return r;
    }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Content;
  global.VOBLOX_CONTENT = Content;
})(typeof window !== "undefined" ? window : globalThis);
