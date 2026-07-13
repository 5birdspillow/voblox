/*
 * Voblox — word content
 * ----------------------
 * Lesson data, transcribed from Leo's Wordly Wise 3000 Book 4 workbook (Lessons 5, 6, 8).
 * (Lesson 7 was skipped in Leo's summer program.)
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

  var LESSON8 = {
    lesson: 8,
    title: "Lesson 8",
    words: [
      entry({
        word: "ancient", emoji: "🏛️", pron: "AYN-chənt",
        senses: [
          { pos: "adj", def: "very old; of a long time ago",
            example: "The ancient city is full of beautiful old buildings." }
        ],
        synonyms: ["very old", "age-old", "antique"], antonyms: ["modern", "new"],
        mnemonic: "Ancient things are from ages and ages ago."
      }),
      entry({
        word: "century", emoji: "🗓️", pron: "SEN-chə-ree",
        senses: [
          { pos: "noun", def: "a period of one hundred years",
            example: "The twenty-first century began on January 1, 2001." }
        ],
        synonyms: ["hundred years"], antonyms: [],
        mnemonic: "A CENTury is 100 years, like 100 CENTs make a dollar."
      }),
      entry({
        word: "chamber", emoji: "🛏️", pron: "CHAYM-bər",
        senses: [
          { pos: "noun", def: "a room",
            example: "The queen always has breakfast in her chamber before she comes downstairs." }
        ],
        forms: [
          { word: "chambers", pos: "noun", def: "an office or group of offices",
            example: "Lawyers for both sides met in the judge's chambers." }
        ],
        synonyms: ["room", "bedroom"], antonyms: [],
        mnemonic: "The queen's chamber is her royal room."
      }),
      entry({
        word: "descend", emoji: "⬇️", pron: "di-SEND",
        senses: [
          { pos: "verb", def: "to go or come down",
            example: "The plane slowly descended to 2,000 feet." }
        ],
        forms: [
          { word: "descendant", pos: "noun", def: "one who has certain persons as one's parents, grandparents, etc.",
            example: "The writer Alex Haley was a descendant of Kunta Kinte, who was enslaved and brought to America from West Africa in 1767." }
        ],
        synonyms: ["go down", "come down", "drop"], antonyms: ["ascend", "climb", "rise"],
        mnemonic: "De-SCEND means go DOWN — like descending the stairs."
      }),
      entry({
        word: "entry", emoji: "🚪", pron: "EN-tree",
        senses: [
          { pos: "noun", def: "a way in",
            example: "The thieves gained entry through an unlocked window." },
          { pos: "noun", def: "each separate item in a diary or list",
            example: "The next entry in her diary simply said, 'My brother returned home today after a long absence.'" }
        ],
        synonyms: ["entrance", "way in"], antonyms: ["exit"],
        mnemonic: "An entry is where you enter — or one item you enter in a list."
      }),
      entry({
        word: "interior", emoji: "🛋️", pron: "in-TEER-ee-ər",
        senses: [
          { pos: "noun", def: "the inside part of something",
            example: "The sun's interior is about 150,000 times hotter than boiling water." },
          { pos: "adj", def: "having to do with the inside part",
            example: "Interior doors do not have to be as strongly made as front or back doors." }
        ],
        synonyms: ["inside", "inner part"], antonyms: ["exterior", "outside"],
        mnemonic: "The interior is the inner part — deep inside."
      }),
      entry({
        word: "intrude", emoji: "🚨", pron: "in-TROOD",
        senses: [
          { pos: "verb", def: "to come or go in without permission or welcome",
            example: "I didn't mean to intrude on you while you were working." }
        ],
        forms: [
          { word: "intrusion", pos: "noun", def: "the act of intruding",
            example: "'Forgive my intrusion,' she said as she came in without knocking." },
          { word: "intruder", pos: "noun", def: "one who intrudes",
            example: "People were so unfriendly that I felt like an intruder at Jeff's party." }
        ],
        synonyms: ["barge in", "trespass"], antonyms: [],
        mnemonic: "It's RUDE to inTRUDE — barging in uninvited."
      }),
      entry({
        word: "locate", emoji: "📍", pron: "LOH-kayt",
        senses: [
          { pos: "verb", def: "to find",
            example: "Marta located the missing books in less than an hour." },
          { pos: "verb", def: "to put or to be found in a place",
            example: "We found out they are going to locate a park across the street from our house." }
        ],
        forms: [
          { word: "location", pos: "noun", def: "the place where something can be found",
            example: "Will you please give me the location of the nearest post office?" }
        ],
        synonyms: ["find", "place"], antonyms: ["lose"],
        mnemonic: "Locate = find the exact location, like a map pin."
      }),
      entry({
        word: "passage", emoji: "📜", pron: "PASS-ij",
        senses: [
          { pos: "noun", def: "a part of a written work or piece of music",
            example: "The final passage of the musical piece brought tears to our eyes." },
          { pos: "noun", def: "the act or process of passing, as through time or from place to place",
            example: "I wanted to slow the passage of time so my vacation would not end." },
          { pos: "noun", def: "a way through which to pass",
            example: "Leon's room was at the end of a long, dimly lit passage." }
        ],
        synonyms: ["excerpt", "corridor", "hallway"], antonyms: [],
        mnemonic: "A passage is where something passes — words, time, or you down a hall."
      }),
      entry({
        word: "portion", emoji: "🍕", pron: "POR-shən",
        senses: [
          { pos: "noun", def: "a part or share of the whole",
            example: "I got the first portion of my allowance last week." },
          { pos: "noun", def: "a serving or helping, as of food",
            example: "My doctor tells me to eat a four-ounce portion of fish or chicken once a day." }
        ],
        synonyms: ["part", "share", "serving"], antonyms: ["whole"],
        mnemonic: "A portion is your part — your slice of the pizza."
      }),
      entry({
        word: "precious", emoji: "💎", pron: "PRESH-əs",
        senses: [
          { pos: "adj", def: "very valuable",
            example: "The necklace was made of diamonds, emeralds, and other precious stones." },
          { pos: "adj", def: "much loved",
            example: "She tried in vain to save her precious books from the fire." }
        ],
        synonyms: ["valuable", "treasured", "beloved"], antonyms: ["worthless", "cheap"],
        mnemonic: "Precious gems are prized — worth a lot or loved a lot."
      }),
      entry({
        word: "quarry", emoji: "⛏️", pron: "KWOR-ee",
        senses: [
          { pos: "noun", def: "a deep pit from which stone is cut out of the ground",
            example: "The rock for this building came from a quarry in Vermont." },
          { pos: "noun", def: "an animal that is being hunted",
            example: "The hunters gave up the chase when they lost sight of their quarry." }
        ],
        synonyms: ["stone pit", "prey"], antonyms: [],
        mnemonic: "A quarry: a pit where rock is mined — or the prey a hunter chases."
      }),
      entry({
        word: "ramp", emoji: "🛹", pron: "RAMP",
        senses: [
          { pos: "noun", def: "a slanted walk or roadway that connects a lower to a higher place",
            example: "Because of my wheelchair, I'm glad there is a law that says there has to be a ramp for those who cannot use the steps." }
        ],
        synonyms: ["slope", "incline"], antonyms: [],
        mnemonic: "A ramp slants up — roll a wheelchair or a skateboard right up it."
      }),
      entry({
        word: "spacious", emoji: "🏟️", pron: "SPAY-shəs",
        senses: [
          { pos: "adj", def: "having lots of room",
            example: "The spacious kitchen had room for a large round table that seated eight." }
        ],
        synonyms: ["roomy", "large", "vast"], antonyms: ["cramped", "tiny", "crowded"],
        mnemonic: "Spacious = full of space — tons of room."
      }),
      entry({
        word: "surface", emoji: "🌕", pron: "SUR-fəs",
        senses: [
          { pos: "noun", def: "the outside layer; the top",
            example: "The surface of the moon is covered with craters." },
          { pos: "noun", def: "an outward look or appearance",
            example: "He seemed cheerful on the surface, but I knew how sad he was inside." },
          { pos: "verb", def: "to rise to the top of a body of water",
            example: "The latest submarines can stay underwater for weeks before they need to surface." }
        ],
        synonyms: ["top", "outside", "exterior"], antonyms: ["interior", "depths"],
        mnemonic: "The SUR-FACE is the outer face of something — like the top of water."
      })
    ]
  };

  var LESSON9 = {
    lesson: 9,
    title: "Lesson 9",
    words: [
      entry({
        word: "advantage", emoji: "💪", pron: "ad-VAN-tij",
        senses: [
          { pos: "noun", def: "something that is helpful or useful",
            example: "It is an advantage to be able to speak French when visiting Paris." }
        ],
        forms: [
          { word: "take advantage of", pos: "verb", def: "to make use of; to benefit oneself by treating others unfairly",
            example: "Martina took advantage of her position as camp leader by giving all the best jobs to her friends." }
        ],
        synonyms: ["a plus", "a help", "an edge"], antonyms: ["disadvantage", "drawback"],
        mnemonic: "An advantage gives you an edge — like a power-up that helps you win."
      }),
      entry({
        word: "astonish", emoji: "😲", pron: "ə-STAHN-ish",
        senses: [
          { pos: "verb", def: "to surprise or amaze",
            example: "It astonished me to discover that my new friend and I were born on the same day in the same town." }
        ],
        forms: [
          { word: "astonishment", pos: "noun", def: "great surprise or amazement",
            example: "The children watched in astonishment as the magician pulled a rabbit out of a hat." }
        ],
        synonyms: ["amaze", "surprise", "stun"], antonyms: ["bore"],
        mnemonic: "Astonish sounds like 'a-STUN-ish' — so amazing it stuns you!"
      }),
      entry({
        word: "confirm", emoji: "✅", pron: "kən-FURM",
        senses: [
          { pos: "verb", def: "to show or prove to be true",
            example: "Before giving me a library card, the librarian asked me to confirm my street address by showing a copy of my phone bill." },
          { pos: "verb", def: "to approve or give one's agreement to",
            example: "The members of Congress vote to confirm the appointment of Supreme Court judges." }
        ],
        synonyms: ["prove", "check", "verify"], antonyms: ["deny", "disprove"],
        mnemonic: "Confirm makes something FIRM and sure — proved true."
      }),
      entry({
        word: "distant", emoji: "🔭", pron: "DIS-tənt",
        senses: [
          { pos: "adj", def: "very far away in time",
            example: "Space travel in the very distant future may involve journeys to the stars." },
          { pos: "adj", def: "very far away; not near or close by",
            example: "Marco Polo's travels took him to many distant lands." }
        ],
        forms: [
          { word: "distance", pos: "noun", def: "the length of the space between two places",
            example: "The distance between Deneen's home and her school was exactly one mile." }
        ],
        synonyms: ["far away", "faraway", "remote"], antonyms: ["near", "close", "nearby"],
        mnemonic: "DISTant things are a big DISTance away."
      }),
      entry({
        word: "founder", emoji: "🏗️", pron: "FOWN-dər",
        senses: [
          { pos: "noun", def: "a person who sets up something that lasts",
            example: "George Washington and Thomas Jefferson are two of the founders of our nation." },
          { pos: "verb", def: "to sink below the surface of the water",
            example: "The ship struck a rock and foundered before a rescue team could reach it." }
        ],
        synonyms: ["starter", "creator", "maker"], antonyms: [],
        mnemonic: "A FOUNDer FOUNDs (starts) something big — but a ship that founders goes down."
      }),
      entry({
        word: "hamlet", emoji: "🏘️", pron: "HAM-lət",
        senses: [
          { pos: "noun", def: "a small village",
            example: "A single street ran through the hamlet, which had one church, a general store, and about a hundred houses." }
        ],
        synonyms: ["small village", "tiny town"], antonyms: ["city", "big town"],
        mnemonic: "A hamlet is a tiny village — like a starter village in Minecraft."
      }),
      entry({
        word: "host", emoji: "🎉", pron: "HOHST",
        senses: [
          { pos: "noun", def: "a large number",
            example: "Graceland is visited by hosts of people from all over the world who come to see the house where Elvis Presley lived." },
          { pos: "noun", def: "one who greets and entertains guests and takes care of their needs at a party or restaurant",
            example: "The guests said goodbye to their host and thanked him for a lovely New Year's Eve party." }
        ],
        synonyms: ["crowd", "a great many", "party-giver"], antonyms: ["few", "guest"],
        mnemonic: "A host throws the party — and a WHOLE host means a huge crowd came."
      }),
      entry({
        word: "misgiving", emoji: "😟", pron: "mis-GIV-ing",
        senses: [
          { pos: "noun", def: "a feeling of doubt, uncertainty, or concern about what may happen in the future",
            example: "If Ellen had any misgivings about joining the group, she gave no sign of it." }
        ],
        synonyms: ["doubt", "worry", "uneasy feeling"], antonyms: ["confidence", "trust"],
        mnemonic: "A misgiving is that 'something MIGHT go wrong' worry in your tummy."
      }),
      entry({
        word: "parch", emoji: "🌵", pron: "PARCH",
        senses: [
          { pos: "verb", def: "to make or become very dry",
            example: "The sun parched the fields and made the grass turn brown." }
        ],
        forms: [
          { word: "parched", pos: "adj", def: "lacking water; thirsty",
            example: "We didn't take enough water with us, and we were parched before we came to the end of our walk." }
        ],
        synonyms: ["dry out", "bake", "scorch"], antonyms: ["soak", "water"],
        mnemonic: "Parched land is dry as a desert — like a cactus with no rain."
      }),
      entry({
        word: "prospect", emoji: "🪙", pron: "PRAHS-pekt",
        senses: [
          { pos: "noun", def: "something that is waited for, expected, or hoped for",
            example: "All the hotels were full, and there seemed little prospect of our finding a place to spend the night." },
          { pos: "verb", def: "to look in the ground for valuable metals like gold and silver",
            example: "The four men camped alongside the river told us they were prospecting for gold." }
        ],
        forms: [
          { word: "prospector", pos: "noun", def: "a person who explores an area to look for valuable metals",
            example: "The prospector let out a whoop of joy when he saw some shiny yellow objects lying on the riverbank." }
        ],
        synonyms: ["hope", "chance", "outlook"], antonyms: [],
        mnemonic: "A prospector digs hoping for gold — a prospect is what you hope is coming."
      }),
      entry({
        word: "scarce", emoji: "🕯️", pron: "SKAIRS",
        senses: [
          { pos: "adj", def: "in short supply; not plentiful",
            example: "When gasoline is scarce, the price goes up." }
        ],
        forms: [
          { word: "scarcity", pos: "noun", def: "a shortage",
            example: "Due to the scarcity of candles in the store when the hurricane struck, customers were allowed only two each." }
        ],
        synonyms: ["rare", "hard to find", "in short supply"], antonyms: ["plentiful", "common", "everywhere"],
        mnemonic: "When something is scarce, it's scarcely (barely) anywhere — like diamonds."
      }),
      entry({
        word: "shrewd", emoji: "🦊", pron: "SHROOD",
        senses: [
          { pos: "adj", def: "clever; good at understanding what is needed and acting on it",
            example: "A shrewd lawyer prepares her client to answer questions she knows the client will be asked in court." }
        ],
        synonyms: ["clever", "smart", "sharp"], antonyms: ["foolish", "silly"],
        mnemonic: "Shrewd like a fox — clever enough to plan the winning move."
      }),
      entry({
        word: "sole", emoji: "1️⃣", pron: "SOHL",
        senses: [
          { pos: "adj", def: "being the only one of its kind; belonging to only one person or group",
            example: "After her husband died, Mrs. Mazoor became the sole owner of the toy store." },
          { pos: "noun", def: "the bottom surface of the foot or of a shoe or boot",
            example: "Shoes with leather soles cost more than those made of plastic." },
          { pos: "noun", def: "a flat fish that is caught and eaten for food",
            example: "Grilled sole is a popular item on the seafood restaurant's menu." }
        ],
        synonyms: ["only", "single", "one and only"], antonyms: ["shared", "many"],
        mnemonic: "SOLE = the Only one — and also the bottom of your shoe, and a flat fish!"
      }),
      entry({
        word: "torment", emoji: "😖", pron: "TOR-ment",
        senses: [
          { pos: "noun", def: "great pain or suffering",
            example: "I cannot imagine the torment suffered by a wild animal caught in a steel trap." },
          { pos: "verb", def: "to cause pain or suffering",
            example: "The thought that she might have been the cause of the accident tormented the driver of the car." }
        ],
        synonyms: ["suffering", "agony", "torture"], antonyms: ["comfort", "soothe"],
        mnemonic: "Torment = TORture that stays on your MENTal mind — big-time suffering."
      }),
      entry({
        word: "typical", emoji: "🏠", pron: "TIP-i-kəl",
        senses: [
          { pos: "adj", def: "being like others of its kind",
            example: "A typical home in this area has three bedrooms, a kitchen, a living room, and one bathroom." }
        ],
        synonyms: ["normal", "usual", "ordinary"], antonyms: ["unusual", "rare", "odd"],
        mnemonic: "Typical = the usual TYPE — nothing surprising about it."
      })
    ]
  };

  var LESSON10 = {
    lesson: 10,
    title: "Lesson 10",
    words: [
      entry({
        word: "ail", emoji: "🤒", pron: "AYL",
        senses: [
          { pos: "verb", def: "to cause sickness, pain, or trouble",
            example: "\"What ails you?\" the doctor asked." }
        ],
        forms: [
          { word: "ailment", pos: "noun", def: "an illness; a disease",
            example: "The flu is a common childhood ailment." },
          { word: "ailing", pos: "adj", def: "in poor health",
            example: "I have been ailing all winter." }
        ],
        synonyms: ["bother", "trouble", "sicken"], antonyms: ["heal", "cure"],
        mnemonic: "To ail is to feel ill — ail and ill both mean not well."
      }),
      entry({
        word: "banish", emoji: "🚫", pron: "BAN-ish",
        senses: [
          { pos: "verb", def: "to force someone out of the country",
            example: "After the revolution, France banished the royal family." },
          { pos: "verb", def: "to get rid of completely",
            example: "Joe was such a cheerful person, he banished gloom wherever he went." }
        ],
        synonyms: ["exile", "cast out", "get rid of"], antonyms: ["welcome", "invite", "keep"],
        mnemonic: "To banish is to BAN someone and make them vanish — gone!"
      }),
      entry({
        word: "communicate", emoji: "💬", pron: "kə-MYOO-ni-kayt",
        senses: [
          { pos: "verb", def: "to make known; to give or exchange information",
            example: "Because I hate to write letters, we communicate mostly by telephone." }
        ],
        forms: [
          { word: "communication", pos: "noun", def: "the exchange of information between people",
            example: "The fight was caused by a lack of communication between us." },
          { word: "communicative", pos: "adj", def: "willing to speak; eager to talk",
            example: "When I asked her where she had been, she was not very communicative, replying only, \"Out.\"" }
        ],
        synonyms: ["talk", "share", "connect"], antonyms: ["ignore", "stay silent"],
        mnemonic: "To communicate is to send a message — like using comms to talk to your team in a game."
      }),
      entry({
        word: "console", emoji: "🤗", pron: "kən-SOHL",
        senses: [
          { pos: "verb", def: "to make less sad; to comfort",
            example: "My parents tried to console me when my best friend moved away." }
        ],
        forms: [
          { word: "consolation", pos: "noun", def: "comfort",
            example: "I knew I could always turn to my aunt for consolation whenever I was upset." }
        ],
        synonyms: ["comfort", "soothe", "cheer up"], antonyms: ["upset", "sadden"],
        mnemonic: "Console sounds like your game console, but it means to comfort someone who is sad."
      }),
      entry({
        word: "cower", emoji: "😨", pron: "KOW-ər",
        senses: [
          { pos: "verb", def: "to shrink from, as if from fear",
            example: "Our poor dog cowers every time Dad turns the vacuum cleaner on." }
        ],
        synonyms: ["shrink", "cringe", "crouch in fear"], antonyms: ["stand tall", "face bravely"],
        mnemonic: "A coward cowers — it shrinks down low in fear."
      }),
      entry({
        word: "deliberate", emoji: "🤔", pron: "di-LIB-ər-it",
        senses: [
          { pos: "adj", def: "carefully thought out; not hasty",
            example: "Although my mother was angry, she spoke in a calm and deliberate manner." },
          { pos: "verb", def: "to think carefully in order to make up one's mind",
            example: "We deliberated a long time before deciding to move to Arizona." }
        ],
        synonyms: ["on purpose", "planned", "thought-out"], antonyms: ["hasty", "accidental", "rushed"],
        mnemonic: "Something deliberate is done on purpose after careful thinking — slow and sure."
      }),
      entry({
        word: "depth", emoji: "🌊", pron: "DEPTH",
        senses: [
          { pos: "noun", def: "distance from top to bottom or front to back; deepness",
            example: "The floodwaters reached a depth of several feet." }
        ],
        forms: [
          { word: "depths", pos: "noun", def: "the innermost part or the deepest part",
            example: "The treasure chest lay buried in the depths of the sea." }
        ],
        synonyms: ["deepness", "drop"], antonyms: ["shallowness", "surface"],
        mnemonic: "Depth is how DEEP something goes — from the top all the way down."
      }),
      entry({
        word: "desire", emoji: "🤩", pron: "di-ZYR",
        senses: [
          { pos: "verb", def: "to wish for; to want very much",
            example: "A person who is famished desires just one thing — food!" },
          { pos: "noun", def: "a strong wish",
            example: "Pizarro's desire for gold was so great he ordered the Inca king, Atahualpa, to fill three rooms with it." }
        ],
        forms: [
          { word: "desirable", pos: "adj", def: "pleasing; agreeable",
            example: "My new school is in a very desirable location." }
        ],
        synonyms: ["want", "crave", "wish for"], antonyms: ["dislike", "reject"],
        mnemonic: "A desire is a strong wish — you really, really want it, like a rare item drop."
      }),
      entry({
        word: "livelihood", emoji: "💼", pron: "LYV-lee-hood",
        senses: [
          { pos: "noun", def: "the means of supporting oneself",
            example: "The store owners in my neighborhood depend on shoppers for their livelihood." }
        ],
        synonyms: ["living", "income", "way to earn"], antonyms: [],
        mnemonic: "Your livelihood is how you make a LIVING — the work that pays for your life."
      }),
      entry({
        word: "misfortune", emoji: "🌧️", pron: "mis-FOR-chən",
        senses: [
          { pos: "noun", def: "bad luck; trouble",
            example: "He had the misfortune to break his leg right before the big game." },
          { pos: "noun", def: "an unlucky event",
            example: "Hurricane Sandy in 2012 was New Jersey's worst misfortune in many years." }
        ],
        synonyms: ["bad luck", "hardship", "trouble"], antonyms: ["luck", "good fortune", "blessing"],
        mnemonic: "Misfortune is bad luck — 'mis-' means wrong, so your fortune went wrong."
      }),
      entry({
        word: "orphan", emoji: "🧒", pron: "OR-fən",
        senses: [
          { pos: "noun", def: "a child whose parents are dead",
            example: "Tom Sawyer lived with his Aunt Polly because he was an orphan." }
        ],
        synonyms: ["parentless child"], antonyms: [],
        mnemonic: "An orphan is a child with no parents — like Tom Sawyer or Harry Potter."
      }),
      entry({
        word: "precipice", emoji: "⛰️", pron: "PRES-ə-pis",
        senses: [
          { pos: "noun", def: "a very high and steep cliff",
            example: "We stood watchfully on the edge of the precipice and looked down." }
        ],
        forms: [
          { word: "precipitous", pos: "adj", def: "very steep",
            example: "The waterfall hiking trail has many precipitous slopes." },
          { word: "precipitous", pos: "adj", def: "hasty; abrupt; done without careful thought",
            example: "Getting a kitten so suddenly was a precipitous act." }
        ],
        synonyms: ["cliff", "steep drop", "ledge"], antonyms: ["flatland", "plain"],
        mnemonic: "A precipice is a scary-steep cliff edge — one step and you would drop straight down."
      }),
      entry({
        word: "regain", emoji: "🔄", pron: "ri-GAYN",
        senses: [
          { pos: "verb", def: "to get back",
            example: "By following the doctor's orders, I slowly regained my health." }
        ],
        synonyms: ["get back", "recover", "win back"], antonyms: ["lose", "give up"],
        mnemonic: "To regain is to gain something AGAIN — get it back."
      }),
      entry({
        word: "slay", emoji: "🐉", pron: "SLAY",
        senses: [
          { pos: "verb", def: "to kill violently",
            example: "The scene where George slays the dragon comes right at the end of the play." }
        ],
        forms: [
          { word: "slain", pos: "verb", def: "past participle of slay; killed",
            example: "The mighty dragon was finally slain by the brave knight." }
        ],
        synonyms: ["defeat", "strike down", "kill"], antonyms: ["spare", "save"],
        mnemonic: "To slay is to defeat — the hero slays the dragon at the end!"
      }),
      entry({
        word: "symptom", emoji: "🩺", pron: "SIMP-təm",
        senses: [
          { pos: "noun", def: "a sign of something",
            example: "Headaches can be a symptom of not enough sleep." }
        ],
        synonyms: ["sign", "signal", "clue"], antonyms: [],
        mnemonic: "A symptom is a sign that something is wrong — a sneeze is a symptom of a cold."
      })
    ]
  };

  var LESSON11 = {
    lesson: 11,
    title: "Lesson 11",
    words: [
      entry({
        word: "annual", emoji: "📅", pron: "AN-yoo-əl",
        senses: [
          { pos: "adj", def: "happening once a year",
            example: "The school holds an annual talent show every spring." },
          { pos: "noun", def: "a plant that lives for only one year",
            example: "We planted annuals that bloomed all summer and then died." }
        ],
        forms: [
          { word: "annually", pos: "adv", def: "once a year",
            example: "The town fair is held annually in June." }
        ],
        synonyms: ["yearly", "once a year"], antonyms: ["daily", "one-time"],
        mnemonic: "An annual event comes around once a year — like your birthday."
      }),
      entry({
        word: "artificial", emoji: "🤖", pron: "ar-tə-FISH-əl",
        senses: [
          { pos: "adj", def: "made by people; not natural",
            example: "The flowers looked real, but they were artificial." }
        ],
        synonyms: ["fake", "man-made", "not real"], antonyms: ["natural", "real"],
        mnemonic: "Artificial things are made by people (ART), not by nature."
      }),
      entry({
        word: "blend", emoji: "🥤", pron: "BLEND",
        senses: [
          { pos: "verb", def: "to mix together completely",
            example: "Blend the fruit and yogurt to make a smoothie." },
          { pos: "noun", def: "a mixture of things",
            example: "This drink is a blend of orange and mango juice." }
        ],
        synonyms: ["mix", "combine", "stir together"], antonyms: ["separate", "split apart"],
        mnemonic: "A blender blends — it mixes everything into one."
      }),
      entry({
        word: "bore", emoji: "🥱", pron: "BOR",
        senses: [
          { pos: "verb", def: "to make someone tired by being dull",
            example: "The long, slow movie bored me." },
          { pos: "verb", def: "to make a hole by drilling or digging",
            example: "Workers bored a tunnel straight through the mountain." }
        ],
        forms: [
          { word: "boredom", pos: "noun", def: "the feeling of being bored",
            example: "On the rainy day, boredom set in and we ran out of things to do." }
        ],
        synonyms: ["tire out", "drill", "dig"], antonyms: ["excite", "interest"],
        mnemonic: "A boring thing makes you yawn — and a drill can bore a hole."
      }),
      entry({
        word: "considerable", emoji: "🗻", pron: "kən-SID-ər-ə-bəl",
        senses: [
          { pos: "adj", def: "large in size or amount",
            example: "It took a considerable amount of money to fix the car." }
        ],
        forms: [
          { word: "considerably", pos: "adv", def: "by a large amount",
            example: "She is considerably taller than her little brother." }
        ],
        synonyms: ["large", "big", "a lot of"], antonyms: ["tiny", "small", "slight"],
        mnemonic: "Considerable means a large amount — big enough to think about."
      }),
      entry({
        word: "crude", emoji: "🛢️", pron: "KROOD",
        senses: [
          { pos: "adj", def: "in a raw, natural state; not cleaned up",
            example: "Crude oil is cleaned before it becomes gasoline." },
          { pos: "adj", def: "rough or rude; not polite",
            example: "He made a crude joke that upset everyone." }
        ],
        synonyms: ["raw", "rough", "rude"], antonyms: ["refined", "polished", "polite"],
        mnemonic: "Crude oil is raw — and crude manners are rough."
      }),
      entry({
        word: "evaporate", emoji: "💨", pron: "i-VAP-ə-rayt",
        senses: [
          { pos: "verb", def: "to change from a liquid into a gas or vapor",
            example: "The puddle evaporated in the hot sun." }
        ],
        forms: [
          { word: "evaporation", pos: "noun", def: "the act of changing into vapor",
            example: "Evaporation turns water from the ocean into clouds." }
        ],
        synonyms: ["dry up", "vaporize"], antonyms: ["condense", "freeze"],
        mnemonic: "A liquid evaporates — it turns to vapor and vanishes into the air."
      }),
      entry({
        word: "foliage", emoji: "🍃", pron: "FOH-lee-ij",
        senses: [
          { pos: "noun", def: "the leaves of plants and trees",
            example: "In the fall, the foliage turns red, orange, and gold." }
        ],
        synonyms: ["leaves", "greenery"], antonyms: ["bare branches"],
        mnemonic: "Foliage is all the leaves — a forest is full of green foliage."
      }),
      entry({
        word: "gash", emoji: "🩹", pron: "GASH",
        senses: [
          { pos: "noun", def: "a long, deep cut",
            example: "He got a gash on his knee when he fell off his bike." },
          { pos: "verb", def: "to make a long, deep cut",
            example: "The sharp rock gashed the side of the boat." }
        ],
        synonyms: ["deep cut", "slash", "wound"], antonyms: ["scratch", "nick"],
        mnemonic: "A gash is a big, deep cut — much worse than a scratch."
      }),
      entry({
        word: "hue", emoji: "🎨", pron: "HYOO",
        senses: [
          { pos: "noun", def: "a color or shade",
            example: "The sky turned a deep orange hue at sunset." }
        ],
        synonyms: ["color", "shade", "tint"], antonyms: [],
        mnemonic: "A hue is a color — every shade of paint has its own hue."
      }),
      entry({
        word: "increase", emoji: "📈", pron: "in-KREES",
        senses: [
          { pos: "verb", def: "to make or become greater in size or amount",
            example: "The team increased their score in the last minute." },
          { pos: "noun", def: "a rise in amount",
            example: "There was a big increase in the number of students this year." }
        ],
        synonyms: ["grow", "go up", "add to"], antonyms: ["decrease", "shrink", "drop"],
        mnemonic: "To increase is to grow bigger — the numbers go up."
      }),
      entry({
        word: "nourish", emoji: "🍎", pron: "NUR-ish",
        senses: [
          { pos: "verb", def: "to give what is needed to live and grow; to feed",
            example: "Healthy food nourishes your body." }
        ],
        forms: [
          { word: "nourishment", pos: "noun", def: "food and other things needed to live and grow",
            example: "Plants get their nourishment from soil, water, and sunlight." }
        ],
        synonyms: ["feed", "sustain", "help grow"], antonyms: ["starve"],
        mnemonic: "Good food nourishes you — it gives your body what it needs to grow."
      }),
      entry({
        word: "vary", emoji: "🔀", pron: "VAIR-ee",
        senses: [
          { pos: "verb", def: "to change; to be different",
            example: "The weather varies from day to day." }
        ],
        forms: [
          { word: "variety", pos: "noun", def: "a number of different things",
            example: "The store sells a wide variety of toys." }
        ],
        synonyms: ["change", "differ", "mix up"], antonyms: ["stay the same", "match"],
        mnemonic: "When things vary, they change — no two are quite the same."
      }),
      entry({
        word: "vision", emoji: "👁️", pron: "VIZH-ən",
        senses: [
          { pos: "noun", def: "the ability to see; eyesight",
            example: "Glasses help people with poor vision see clearly." },
          { pos: "noun", def: "something seen in the imagination or a dream",
            example: "She had a vision of a better, kinder future." }
        ],
        synonyms: ["eyesight", "sight", "imagination"], antonyms: ["blindness"],
        mnemonic: "Your vision is your eyesight — and also a dream you picture in your mind."
      }),
      entry({
        word: "yield", emoji: "🌾", pron: "YEELD",
        senses: [
          { pos: "verb", def: "to give or produce",
            example: "The apple tree yields fruit every fall." },
          { pos: "verb", def: "to give way to force or pressure",
            example: "The old door finally yielded when we pushed hard." },
          { pos: "noun", def: "the amount produced",
            example: "This year's crop had a huge yield." }
        ],
        synonyms: ["produce", "give", "give way"], antonyms: ["resist", "hold firm"],
        mnemonic: "A field yields crops — and you yield (give way) at a yield sign."
      })
    ]
  };

  var LESSON12 = {
    lesson: 12,
    title: "Lesson 12",
    words: [
      entry({
        word: "ability", emoji: "💪", pron: "ə-BIL-ə-tee",
        senses: [{ pos: "noun", def: "the power or skill to do something",
          example: "She has the ability to solve really hard math problems." }],
        synonyms: ["skill", "talent", "power"], antonyms: ["inability", "weakness"],
        mnemonic: "Your ability is what you are able to do."
      }),
      entry({
        word: "amiable", emoji: "😊", pron: "AY-mee-ə-bəl",
        senses: [{ pos: "adj", def: "friendly and pleasant",
          example: "Our amiable neighbor always waves hello." }],
        synonyms: ["friendly", "kind", "good-natured"], antonyms: ["grumpy", "unfriendly"],
        mnemonic: "An amiable person makes friends easily — think 'aim to be a friend.'"
      }),
      entry({
        word: "bliss", emoji: "😇", pron: "BLIS",
        senses: [{ pos: "noun", def: "perfect happiness; great joy",
          example: "Lying on the warm beach was pure bliss." }],
        synonyms: ["joy", "delight", "happiness"], antonyms: ["misery", "sorrow"],
        mnemonic: "Bliss is the biggest, blissful kind of happy."
      }),
      entry({
        word: "caress", emoji: "🤗", pron: "kə-RES",
        senses: [
          { pos: "verb", def: "to touch or stroke gently and lovingly",
            example: "She caressed the puppy's soft fur." },
          { pos: "noun", def: "a gentle, loving touch",
            example: "He gave the baby a soft caress on the cheek." }
        ],
        synonyms: ["stroke", "pet", "cuddle"], antonyms: ["hit", "shove"],
        mnemonic: "A caress is a careful, loving touch."
      }),
      entry({
        word: "clutch", emoji: "✊", pron: "KLUCH",
        senses: [
          { pos: "verb", def: "to hold on to tightly",
            example: "He clutched his backpack as the bus bumped along." },
          { pos: "noun", def: "a tight grasp",
            example: "The hawk held the mouse in its clutch." }
        ],
        synonyms: ["grip", "grab", "clasp"], antonyms: ["release", "let go"],
        mnemonic: "To clutch is to grab and hold tight — like clutching a prize."
      }),
      entry({
        word: "coax", emoji: "🥺", pron: "KOHKS",
        senses: [{ pos: "verb", def: "to gently and kindly persuade someone",
          example: "I coaxed my little sister into eating her vegetables." }],
        synonyms: ["persuade", "urge", "sweet-talk"], antonyms: ["force", "bully"],
        mnemonic: "To coax is to softly talk someone into it."
      }),
      entry({
        word: "furious", emoji: "😡", pron: "FYOOR-ee-əs",
        senses: [{ pos: "adj", def: "very, very angry",
          example: "Dad was furious when the dog chewed his new shoes." }],
        forms: [{ word: "fury", pos: "noun", def: "wild, powerful anger",
          example: "The storm hit the coast with great fury." }],
        synonyms: ["enraged", "mad", "raging"], antonyms: ["calm", "pleased"],
        mnemonic: "Furious is full of fury — boiling-mad angry."
      }),
      entry({
        word: "gesture", emoji: "👋", pron: "JES-chər",
        senses: [
          { pos: "noun", def: "a movement of the body that shows a feeling or idea",
            example: "She gave a friendly gesture — a big wave." },
          { pos: "verb", def: "to move the body to show a feeling or idea",
            example: "He gestured toward the door to show us the way out." }
        ],
        synonyms: ["signal", "motion", "sign"], antonyms: [],
        mnemonic: "A gesture is a hand or body signal, like a wave."
      }),
      entry({
        word: "mope", emoji: "😔", pron: "MOHP",
        senses: [{ pos: "verb", def: "to be gloomy and quiet; to sulk",
          example: "He moped around all day after losing the game." }],
        synonyms: ["sulk", "brood", "pout"], antonyms: ["cheer up", "brighten"],
        mnemonic: "To mope is to mooch around feeling sad and slow."
      }),
      entry({
        word: "prefer", emoji: "👍", pron: "pri-FUR",
        senses: [{ pos: "verb", def: "to like one thing better than another",
          example: "I prefer apples to oranges." }],
        forms: [{ word: "preference", pos: "noun", def: "the thing you like better",
          example: "Her preference is chocolate ice cream." }],
        synonyms: ["favor", "like better", "choose"], antonyms: ["dislike", "reject"],
        mnemonic: "When you prefer something, you pick it first."
      }),
      entry({
        word: "recover", emoji: "🩹", pron: "ri-KUV-ər",
        senses: [
          { pos: "verb", def: "to get well again after being sick or hurt",
            example: "She recovered quickly after the flu." },
          { pos: "verb", def: "to get back something that was lost",
            example: "The police recovered the stolen bike." }
        ],
        forms: [{ word: "recovery", pos: "noun", def: "the act of getting well or getting back",
          example: "His recovery from the broken leg took six weeks." }],
        synonyms: ["heal", "get back", "regain"], antonyms: ["worsen", "lose"],
        mnemonic: "To recover is to get better — or to cover the loss and get it back."
      }),
      entry({
        word: "replace", emoji: "🔁", pron: "ri-PLAYS",
        senses: [
          { pos: "verb", def: "to put something back where it belongs",
            example: "Please replace the books on the shelf when you finish." },
          { pos: "verb", def: "to put a new thing in place of another",
            example: "We had to replace the broken window." }
        ],
        forms: [{ word: "replacement", pos: "noun", def: "a new thing that takes another's place",
          example: "The coach sent in a replacement for the tired player." }],
        synonyms: ["swap", "switch", "put back"], antonyms: ["keep", "remove"],
        mnemonic: "To replace is to put something back in its place — or in place of another."
      }),
      entry({
        word: "request", emoji: "🙏", pron: "ri-KWEST",
        senses: [
          { pos: "verb", def: "to ask for something politely",
            example: "She requested a glass of water." },
          { pos: "noun", def: "the act of asking politely",
            example: "He made a request for help with his homework." }
        ],
        synonyms: ["ask for", "appeal", "beg"], antonyms: ["demand", "refuse"],
        mnemonic: "A request is a polite ask — you request, not demand."
      }),
      entry({
        word: "separate", emoji: "✂️", pron: "SEP-ə-rayt",
        senses: [
          { pos: "verb", def: "to set or keep apart",
            example: "Separate the red socks from the white ones before washing." },
          { pos: "adj", def: "not joined; apart",
            example: "The twins sleep in separate rooms." }
        ],
        forms: [{ word: "separation", pos: "noun", def: "the act of keeping apart",
          example: "A fence marks the separation between the two yards." }],
        synonyms: ["divide", "split", "part"], antonyms: ["join", "combine"],
        mnemonic: "To separate is to split into apart pieces — there's 'a rat' in sepARATe."
      }),
      entry({
        word: "shun", emoji: "🙅", pron: "SHUN",
        senses: [{ pos: "verb", def: "to keep away from on purpose; to avoid",
          example: "The other geese shunned the odd little duckling." }],
        synonyms: ["avoid", "snub", "ignore"], antonyms: ["welcome", "include"],
        mnemonic: "To shun someone is to shut them out on purpose."
      })
    ]
  };

  var LESSON13 = {
    lesson: 13,
    title: "Lesson 13",
    words: [
      entry({
        word: "appall", emoji: "😱", pron: "ə-PAWL",
        senses: [{ pos: "verb", def: "to shock or horrify",
          example: "The huge mess in the kitchen appalled Mom." }],
        forms: [{ word: "appalling", pos: "adj", def: "shocking; truly terrible",
          example: "The flooded street was in appalling condition." }],
        synonyms: ["horrify", "shock", "dismay"], antonyms: ["please", "delight"],
        mnemonic: "Something appalling makes your face go pale — it's shocking."
      }),
      entry({
        word: "dejected", emoji: "😞", pron: "di-JEK-tid",
        senses: [{ pos: "adj", def: "sad and discouraged; low in spirits",
          example: "He felt dejected after striking out in the big game." }],
        synonyms: ["gloomy", "downhearted", "glum"], antonyms: ["cheerful", "upbeat"],
        mnemonic: "Dejected feels down and rejected — sad and discouraged."
      }),
      entry({
        word: "dependable", emoji: "🤝", pron: "di-PEN-də-bəl",
        senses: [{ pos: "adj", def: "able to be trusted or relied on",
          example: "A dependable friend always keeps a promise." }],
        synonyms: ["reliable", "trustworthy", "steady"], antonyms: ["unreliable", "flaky"],
        mnemonic: "You can depend on someone dependable."
      }),
      entry({
        word: "dreary", emoji: "🌧️", pron: "DREER-ee",
        senses: [{ pos: "adj", def: "dull, gloomy, and boring",
          example: "It was a cold, gray, dreary day." }],
        synonyms: ["gloomy", "dismal", "bleak"], antonyms: ["bright", "cheerful"],
        mnemonic: "A dreary day is dull and dreary — you might feel weary."
      }),
      entry({
        word: "fanatical", emoji: "🤪", pron: "fə-NAT-i-kəl",
        senses: [{ pos: "adj", def: "having wild, extreme enthusiasm",
          example: "He is fanatical about his favorite sports team." }],
        forms: [{ word: "fanatic", pos: "noun", def: "a person with wild, extreme enthusiasm",
          example: "She is such a fanatic that she never misses a single game." }],
        synonyms: ["extreme", "obsessed", "wild"], antonyms: ["mild", "casual"],
        mnemonic: "A fanatical fan is over-the-top crazy about something."
      }),
      entry({
        word: "impact", emoji: "💥", pron: "IM-pakt",
        senses: [
          { pos: "noun", def: "the striking of one thing against another",
            example: "The impact of the crash bent the car's fender." },
          { pos: "noun", def: "a strong effect",
            example: "The book had a big impact on the way I think." }
        ],
        synonyms: ["crash", "effect", "influence"], antonyms: [],
        mnemonic: "An impact is a big hit — a crash or a strong effect."
      }),
      entry({
        word: "invade", emoji: "🗡️", pron: "in-VAYD",
        senses: [{ pos: "verb", def: "to enter with force in order to attack or take over",
          example: "Ants invaded our picnic and marched off with the crumbs." }],
        forms: [{ word: "invasion", pos: "noun", def: "the act of invading",
          example: "The invasion caught the town completely by surprise." }],
        synonyms: ["attack", "storm", "overrun"], antonyms: ["retreat", "defend"],
        mnemonic: "To invade is to force your way IN to attack."
      }),
      entry({
        word: "isolate", emoji: "🏝️", pron: "EYE-sə-layt",
        senses: [{ pos: "verb", def: "to set apart from others; to keep alone",
          example: "The sick calf was isolated from the rest of the herd." }],
        forms: [
          { word: "isolated", pos: "adj", def: "alone; far from others",
            example: "The cabin sat on an isolated mountain with no neighbors." },
          { word: "isolation", pos: "noun", def: "the state of being alone or apart",
            example: "Living on the tiny island, they felt a real sense of isolation." }
        ],
        synonyms: ["separate", "cut off", "set apart"], antonyms: ["join", "mix in"],
        mnemonic: "To isolate is to make into an island — all alone."
      }),
      entry({
        word: "occupy", emoji: "🏠", pron: "AHK-yə-pye",
        senses: [
          { pos: "verb", def: "to live in or fill a space",
            example: "A family of five occupies the house next door." },
          { pos: "verb", def: "to take and hold by force",
            example: "The soldiers occupied the captured town." }
        ],
        forms: [{ word: "occupation", pos: "noun", def: "a job, or the act of taking over a place",
          example: "Her occupation is teaching; his is fixing cars." }],
        synonyms: ["fill", "live in", "take over"], antonyms: ["leave", "vacate"],
        mnemonic: "To occupy a space is to fill it or hold it."
      }),
      entry({
        word: "reveal", emoji: "🎁", pron: "ri-VEEL",
        senses: [{ pos: "verb", def: "to make known; to show something hidden",
          example: "She finally revealed her secret birthday plan." }],
        synonyms: ["show", "uncover", "disclose"], antonyms: ["hide", "conceal"],
        mnemonic: "To reveal is to pull back the veil and show what was hidden."
      }),
      entry({
        word: "rout", emoji: "🏃", pron: "ROWT",
        senses: [
          { pos: "verb", def: "to defeat completely",
            example: "Our team routed the visitors ten to one." },
          { pos: "noun", def: "a complete defeat",
            example: "The game turned into a total rout by halftime." }
        ],
        synonyms: ["crush", "thrash", "beat badly"], antonyms: ["lose to"],
        mnemonic: "A rout sends the losers running — a crushing defeat."
      }),
      entry({
        word: "suspect", emoji: "🕵️", pron: "sə-SPEKT",
        senses: [
          { pos: "verb", def: "to think something is true or likely, without proof",
            example: "I suspect it is going to rain later today." },
          { pos: "noun", def: "a person thought to be guilty",
            example: "The police questioned the main suspect." }
        ],
        synonyms: ["guess", "doubt", "distrust"], antonyms: ["trust", "know for sure"],
        mnemonic: "To suspect is to have a hunch without proof."
      }),
      entry({
        word: "temporary", emoji: "⏳", pron: "TEM-pə-rer-ee",
        senses: [{ pos: "adj", def: "lasting only a short time; not permanent",
          example: "We put up a temporary tent just for the night." }],
        synonyms: ["short-term", "passing", "brief"], antonyms: ["permanent", "lasting"],
        mnemonic: "Temporary things last only a short time — like a time-out."
      }),
      entry({
        word: "terror", emoji: "😨", pron: "TER-ər",
        senses: [{ pos: "noun", def: "very great fear",
          example: "The loud thunder filled the puppy with terror." }],
        forms: [{ word: "terrorize", pos: "verb", def: "to fill with great fear",
          example: "The bully terrorized the younger kids at recess." }],
        synonyms: ["fear", "dread", "panic"], antonyms: ["calm", "comfort"],
        mnemonic: "Terror is terrible fear — the kind that makes you freeze."
      }),
      entry({
        word: "tragic", emoji: "😢", pron: "TRAJ-ik",
        senses: [{ pos: "adj", def: "very sad; bringing great suffering",
          example: "The movie had a tragic ending that made everyone cry." }],
        forms: [{ word: "tragedy", pos: "noun", def: "a very sad event",
          example: "The flood was a tragedy for the whole town." }],
        synonyms: ["sad", "heartbreaking", "terrible"], antonyms: ["happy", "joyful"],
        mnemonic: "A tragic story is deeply sad — a tragedy."
      })
    ]
  };

  var LESSON14 = {
    lesson: 14,
    title: "Lesson 14",
    words: [
      entry({
        word: "afford", emoji: "💰", pron: "ə-FORD",
        senses: [
          { pos: "verb", def: "to have enough money for",
            example: "We can't afford a new car this year." },
          { pos: "verb", def: "to be able to spare or give",
            example: "Can you afford the time to help me clean up?" }
        ],
        synonyms: ["pay for", "manage", "spare"], antonyms: [],
        mnemonic: "If you can afford it, you have enough to pay for it."
      }),
      entry({
        word: "boast", emoji: "😤", pron: "BOHST",
        senses: [
          { pos: "verb", def: "to brag; to talk with too much pride",
            example: "He boasted about winning the race." },
          { pos: "noun", def: "bragging talk",
            example: "Her boast about being fastest turned out to be true." }
        ],
        forms: [{ word: "boastful", pos: "adj", def: "always bragging",
          example: "No one likes a boastful winner." }],
        synonyms: ["brag", "show off", "crow"], antonyms: ["be modest"],
        mnemonic: "To boast is to brag — both puff you up with pride."
      }),
      entry({
        word: "chord", emoji: "🎸", pron: "KORD",
        senses: [{ pos: "noun", def: "a group of musical notes played together",
          example: "She strummed a happy chord on her guitar." }],
        synonyms: ["harmony", "notes"], antonyms: [],
        mnemonic: "A chord is notes played together — a 'chord' for music, a 'cord' for rope."
      }),
      entry({
        word: "exceptional", emoji: "⭐", pron: "ik-SEP-shə-nəl",
        senses: [{ pos: "adj", def: "much better than usual; unusual",
          example: "She is an exceptional artist for her age." }],
        synonyms: ["outstanding", "excellent", "remarkable"], antonyms: ["ordinary", "average"],
        mnemonic: "Exceptional means so good it's the exception, not the rule."
      }),
      entry({
        word: "fortunate", emoji: "🍀", pron: "FOR-chə-nit",
        senses: [{ pos: "adj", def: "lucky",
          example: "We were fortunate to catch the very last bus." }],
        forms: [{ word: "fortunately", pos: "adv", def: "luckily",
          example: "Fortunately, no one was hurt in the fall." }],
        synonyms: ["lucky", "blessed"], antonyms: ["unlucky", "unfortunate"],
        mnemonic: "A fortunate person has good fortune — good luck."
      }),
      entry({
        word: "fringe", emoji: "🧵", pron: "FRINJ",
        senses: [
          { pos: "noun", def: "a border of hanging threads",
            example: "The rug had a fringe of tassels along each edge." },
          { pos: "noun", def: "the outer edge of something",
            example: "They camped on the fringe of the forest." }
        ],
        synonyms: ["border", "edge", "trim"], antonyms: ["center", "middle"],
        mnemonic: "The fringe is the edge — like the fringe on the rim of a rug."
      }),
      entry({
        word: "humble", emoji: "🙇", pron: "HUM-bəl",
        senses: [
          { pos: "adj", def: "not proud; modest",
            example: "Even after winning, she stayed humble." },
          { pos: "adj", def: "plain or simple",
            example: "They lived in a humble little cottage." }
        ],
        synonyms: ["modest", "meek", "plain"], antonyms: ["proud", "boastful"],
        mnemonic: "A humble person doesn't brag — they stay low-key."
      }),
      entry({
        word: "meadow", emoji: "🌼", pron: "MED-oh",
        senses: [{ pos: "noun", def: "a field of grass",
          example: "Cows grazed lazily in the green meadow." }],
        synonyms: ["field", "pasture", "grassland"], antonyms: [],
        mnemonic: "A meadow is a grassy field — picture cows munching in it."
      }),
      entry({
        word: "melancholy", emoji: "😔", pron: "MEL-ən-kol-ee",
        senses: [
          { pos: "noun", def: "a feeling of deep sadness",
            example: "A quiet melancholy came over her on the gray day." },
          { pos: "adj", def: "sad and gloomy",
            example: "The slow song had a melancholy tune." }
        ],
        synonyms: ["sadness", "gloom", "sorrow"], antonyms: ["joy", "cheer"],
        mnemonic: "Melancholy is a heavy, deep-down sadness."
      }),
      entry({
        word: "obstinate", emoji: "🐴", pron: "OB-stə-nit",
        senses: [{ pos: "adj", def: "stubborn; refusing to change your mind",
          example: "The obstinate mule would not move an inch." }],
        synonyms: ["stubborn", "headstrong", "unyielding"], antonyms: ["flexible", "agreeable"],
        mnemonic: "An obstinate person is an obstacle — they won't budge."
      }),
      entry({
        word: "plead", emoji: "🙏", pron: "PLEED",
        senses: [
          { pos: "verb", def: "to beg earnestly",
            example: "She pleaded with her parents for one more chance." },
          { pos: "verb", def: "to answer a charge in a court of law",
            example: "The driver pleaded not guilty." }
        ],
        synonyms: ["beg", "appeal", "implore"], antonyms: ["demand"],
        mnemonic: "To plead is to please-please-please beg."
      }),
      entry({
        word: "plunge", emoji: "🤿", pron: "PLUNJ",
        senses: [
          { pos: "verb", def: "to dive or throw yourself suddenly into something",
            example: "He plunged into the cold lake with a huge splash." },
          { pos: "noun", def: "a sudden dive",
            example: "She took a quick plunge off the diving board." }
        ],
        synonyms: ["dive", "jump", "dunk"], antonyms: ["rise", "climb out"],
        mnemonic: "To plunge is to dive down suddenly — plunk into the water!"
      }),
      entry({
        word: "relent", emoji: "🕊️", pron: "ri-LENT",
        senses: [{ pos: "verb", def: "to become less harsh or strict; to give in",
          example: "Dad finally relented and let us stay up late." }],
        forms: [{ word: "relentless", pos: "adj", def: "never stopping; harsh",
          example: "The relentless rain fell for three days straight." }],
        synonyms: ["give in", "soften", "yield"], antonyms: ["persist", "hold firm"],
        mnemonic: "To relent is to let up and give in."
      }),
      entry({
        word: "submit", emoji: "📥", pron: "səb-MIT",
        senses: [
          { pos: "verb", def: "to give in to power or control; to yield",
            example: "The wrestler submitted when he was firmly pinned." },
          { pos: "verb", def: "to hand in",
            example: "Please submit your homework by Friday." }
        ],
        synonyms: ["give in", "hand in", "surrender"], antonyms: ["resist", "fight"],
        mnemonic: "To submit is to give in — or to send in your work."
      }),
      entry({
        word: "trudge", emoji: "🥾", pron: "TRUJ",
        senses: [{ pos: "verb", def: "to walk slowly and with heavy effort",
          example: "We trudged through the deep, wet snow." }],
        synonyms: ["plod", "tramp", "slog"], antonyms: ["skip", "dash"],
        mnemonic: "To trudge is to drag your feet along — slow and tiring."
      })
    ]
  };

  var LESSON15 = {
    lesson: 15,
    title: "Lesson 15",
    words: [
      entry({
        word: "apparent", emoji: "👀", pron: "ə-PAIR-ənt",
        senses: [
          { pos: "adj", def: "easy to see or understand; clear",
            example: "It was apparent that she was tired." },
          { pos: "adj", def: "seeming to be true, but maybe not",
            example: "His apparent calm hid how nervous he really was." }
        ],
        forms: [{ word: "apparently", pos: "adv", def: "as it seems; clearly",
          example: "Apparently the game was canceled because of rain." }],
        synonyms: ["clear", "obvious", "plain"], antonyms: ["hidden", "unclear"],
        mnemonic: "If something is apparent, it appears plainly — easy to see."
      }),
      entry({
        word: "ban", emoji: "🚫", pron: "BAN",
        senses: [
          { pos: "verb", def: "to forbid, especially by a law or rule",
            example: "The school banned gum chewing in class." },
          { pos: "noun", def: "an official rule against something",
            example: "There is a ban on littering in the park." }
        ],
        synonyms: ["forbid", "prohibit", "outlaw"], antonyms: ["allow", "permit"],
        mnemonic: "A ban says NO — it forbids something."
      }),
      entry({
        word: "concentrate", emoji: "🧠", pron: "KON-sən-trayt",
        senses: [
          { pos: "verb", def: "to focus all your thoughts or effort on something",
            example: "It's hard to concentrate on homework when the TV is on." },
          { pos: "verb", def: "to bring together in one place",
            example: "Most of the shops are concentrated downtown." }
        ],
        forms: [{ word: "concentration", pos: "noun", def: "full focus of the mind",
          example: "Chess takes a lot of concentration." }],
        synonyms: ["focus", "pay attention"], antonyms: ["daydream", "scatter"],
        mnemonic: "To concentrate is to bring your focus to one center."
      }),
      entry({
        word: "concern", emoji: "😟", pron: "kən-SURN",
        senses: [
          { pos: "verb", def: "to be about; to have to do with",
            example: "This book concerns a boy who travels to space." },
          { pos: "noun", def: "worry, or something that matters to you",
            example: "Safety is our number one concern." }
        ],
        synonyms: ["worry", "interest", "matter"], antonyms: ["unconcern"],
        mnemonic: "A concern is something you care or worry about."
      }),
      entry({
        word: "consider", emoji: "🤔", pron: "kən-SID-ər",
        senses: [
          { pos: "verb", def: "to think about carefully",
            example: "Consider all your choices before you decide." },
          { pos: "verb", def: "to believe or regard as",
            example: "I consider her my best friend." }
        ],
        forms: [{ word: "considerate", pos: "adj", def: "thoughtful of other people",
          example: "It was considerate of you to save me a seat." }],
        synonyms: ["think about", "weigh", "regard"], antonyms: ["ignore"],
        mnemonic: "To consider is to think it over carefully."
      }),
      entry({
        word: "contrast", emoji: "🌗", pron: "kən-TRAST",
        senses: [
          { pos: "verb", def: "to compare in order to show differences",
            example: "The teacher asked us to contrast summer with winter." },
          { pos: "noun", def: "a clear difference between things",
            example: "There is a big contrast between the quiet twin and the loud one." }
        ],
        synonyms: ["difference", "compare", "distinction"], antonyms: ["similarity", "likeness"],
        mnemonic: "A contrast shows how two things stand apart — their difference."
      }),
      entry({
        word: "fragile", emoji: "🥚", pron: "FRAJ-əl",
        senses: [{ pos: "adj", def: "easily broken or damaged; delicate",
          example: "Handle the fragile glass ornaments with care." }],
        synonyms: ["delicate", "breakable", "flimsy"], antonyms: ["strong", "sturdy", "tough"],
        mnemonic: "Fragile things break easily — stamp 'FRAGILE' on the box!"
      }),
      entry({
        word: "menace", emoji: "👹", pron: "MEN-is",
        senses: [
          { pos: "noun", def: "a threat or danger",
            example: "That wobbly, broken step is a real menace." },
          { pos: "verb", def: "to threaten",
            example: "Dark storm clouds menaced the picnic." }
        ],
        forms: [{ word: "menacing", pos: "adj", def: "threatening; scary",
          example: "The dog gave a low, menacing growl." }],
        synonyms: ["threat", "danger", "hazard"], antonyms: ["safety"],
        mnemonic: "A menace is a danger that threatens — it 'means' harm."
      }),
      entry({
        word: "pounce", emoji: "🐱", pron: "POWNS",
        senses: [
          { pos: "verb", def: "to jump on suddenly in order to grab",
            example: "The cat pounced on the little toy mouse." },
          { pos: "noun", def: "a sudden leap to grab something",
            example: "With one quick pounce, the fox caught the rabbit." }
        ],
        synonyms: ["leap", "spring", "swoop"], antonyms: [],
        mnemonic: "To pounce is to bounce onto your target and grab it."
      }),
      entry({
        word: "prompt", emoji: "⏰", pron: "PROMPT",
        senses: [
          { pos: "adj", def: "quick and on time; without delay",
            example: "She sent a prompt reply the same day." },
          { pos: "verb", def: "to cause someone to do something",
            example: "The rain prompted us to run inside." }
        ],
        forms: [{ word: "promptly", pos: "adv", def: "quickly; right on time",
          example: "The bus arrived promptly at eight o'clock." }],
        synonyms: ["quick", "on time", "punctual"], antonyms: ["late", "slow"],
        mnemonic: "Prompt means right away — a prompt reply comes fast."
      }),
      entry({
        word: "recent", emoji: "🆕", pron: "REE-sənt",
        senses: [{ pos: "adj", def: "happening a short time ago",
          example: "In recent days it has been very hot." }],
        forms: [{ word: "recently", pos: "adv", def: "a short time ago; not long ago",
          example: "We recently moved to a new house." }],
        synonyms: ["new", "latest", "fresh"], antonyms: ["old", "ancient", "long ago"],
        mnemonic: "Recent means it just happened — brand new news."
      }),
      entry({
        word: "symbol", emoji: "❤️", pron: "SIM-bəl",
        senses: [{ pos: "noun", def: "something that stands for something else",
          example: "A heart is a symbol of love." }],
        synonyms: ["sign", "emblem", "mark"], antonyms: [],
        mnemonic: "A symbol is a sign that stands for an idea — like ❤️ for love."
      }),
      entry({
        word: "talon", emoji: "🦅", pron: "TAL-ən",
        senses: [{ pos: "noun", def: "the sharp claw of a bird of prey",
          example: "The eagle snatched the fish in its talons." }],
        synonyms: ["claw", "clutch"], antonyms: [],
        mnemonic: "A talon is an eagle's claw — sharp and grabbing."
      }),
      entry({
        word: "trophy", emoji: "🏆", pron: "TROH-fee",
        senses: [{ pos: "noun", def: "a prize given for winning or for a great deed",
          example: "She lifted the gold trophy over her head." }],
        synonyms: ["prize", "award", "cup"], antonyms: [],
        mnemonic: "A trophy is a winner's prize — you hoist it up high."
      }),
      entry({
        word: "widespread", emoji: "🌍", pron: "WYDE-spred",
        senses: [{ pos: "adj", def: "found or spread over a large area",
          example: "The storm caused widespread damage across the state." }],
        synonyms: ["far-reaching", "extensive", "all over"], antonyms: ["limited", "local"],
        mnemonic: "Widespread means spread out wide — all over the place."
      })
    ]
  };

  var LESSON16 = {
    lesson: 16,
    title: "Lesson 16",
    words: [
      entry({
        word: "apt", emoji: "🎯", pron: "APT",
        senses: [
          { pos: "adj", def: "well suited; fitting; just right",
            example: "Marta's skill at fixing things earned her the apt nickname of Ms. Fix-It." },
          { pos: "adj", def: "likely or almost certain",
            example: "I am apt to do better on tests if I make vocabulary cards to study." }
        ],
        synonyms: ["fitting", "suitable", "likely"], antonyms: ["unsuitable", "unlikely"],
        mnemonic: "An apt name fits perfectly — and if you're apt to do something, you probably will."
      }),
      entry({
        word: "blossom", emoji: "🌸", pron: "BLAH-sum",
        senses: [
          { pos: "noun", def: "a flower",
            example: "The white blossom stands out against the green leaves." },
          { pos: "verb", def: "to come into bloom",
            example: "Dogwood trees blossom in May." },
          { pos: "verb", def: "to grow and develop",
            example: "After two years of small parts, she blossomed into the star of the school play." }
        ],
        synonyms: ["flower", "bloom", "develop"], antonyms: ["wilt", "fade"],
        mnemonic: "A blossom is a flower — and people blossom when they grow into their best."
      }),
      entry({
        word: "bough", emoji: "🌳", pron: "BOW (rhymes with cow)",
        senses: [{ pos: "noun", def: "a large branch of a tree",
          example: "The boughs of the apple tree were heavy with fruit." }],
        synonyms: ["branch", "limb"], antonyms: [],
        mnemonic: "A bough BOWS down when it's heavy with apples — a big branch."
      }),
      entry({
        word: "content", emoji: "😌", pron: "kun-TENT",
        senses: [{ pos: "adj", def: "happy with what one has; satisfied",
          example: "Give me a good book and a comfy armchair and I am content." }],
        forms: [{ word: "contentment", pos: "noun", def: "the state of being satisfied and at peace",
          example: "After a yummy dinner and a warm bath, I relaxed in total contentment." }],
        synonyms: ["satisfied", "happy", "at peace"], antonyms: ["unhappy", "restless"],
        mnemonic: "Content means you're happy with what's in your tent — satisfied."
      }),
      entry({
        word: "detest", emoji: "🤢", pron: "dih-TEST",
        senses: [{ pos: "verb", def: "to dislike strongly; to hate",
          example: "Many people think they detest spinach until they try it." }],
        forms: [{ word: "detestable", pos: "adj", def: "causing or deserving strong dislike",
          example: "Lying to a friend is detestable behavior." }],
        synonyms: ["hate", "loathe", "despise"], antonyms: ["love", "adore", "enjoy"],
        mnemonic: "To detest something is to give it the thumbs-down TEST — you really dislike it."
      }),
      entry({
        word: "dusk", emoji: "🌆", pron: "DUSK",
        senses: [{ pos: "noun", def: "the time at the end of the day just before dark",
          example: "The streetlights go on at dusk." }],
        synonyms: ["twilight", "sundown", "evening"], antonyms: ["dawn", "sunrise"],
        mnemonic: "Dusk is when the day gets dusty-dark — right before night."
      }),
      entry({
        word: "extinguish", emoji: "🧯", pron: "ek-STING-gwish",
        senses: [{ pos: "verb", def: "to put out, as a fire or a light",
          example: "Before leaving, make sure you extinguish your campfire." }],
        synonyms: ["put out", "douse", "quench"], antonyms: ["light", "ignite"],
        mnemonic: "EXtinguish makes the flame EXit — the fire goes out."
      }),
      entry({
        word: "familiar", emoji: "👋", pron: "fuh-MIL-yer",
        senses: [
          { pos: "adj", def: "often seen or experienced; known",
            example: "I was happy to see a familiar face in the crowd." },
          { pos: "adj", def: "having a good knowledge of something",
            example: "Dad is familiar with the game because he has played it for many years." }
        ],
        synonyms: ["known", "well-known", "recognized"], antonyms: ["strange", "unknown", "new"],
        mnemonic: "Familiar things feel like FAMILY — you know them well."
      }),
      entry({
        word: "obtain", emoji: "🤲", pron: "ub-TAYN",
        senses: [{ pos: "verb", def: "to gain or get by making an effort",
          example: "We were lucky to obtain tickets for the concert because they sold out quickly." }],
        synonyms: ["get", "gain", "acquire"], antonyms: ["lose", "give up"],
        mnemonic: "To obtain is to get it by trying — effort earns it."
      }),
      entry({
        word: "orchard", emoji: "🍎", pron: "OR-churd",
        senses: [{ pos: "noun", def: "a place where fruit trees grow",
          example: "Every fall we go to an orchard where you can pick your own apples." }],
        synonyms: ["fruit farm", "grove"], antonyms: [],
        mnemonic: "An orchard is rows and rows of fruit trees — apple-picking country."
      }),
      entry({
        word: "practice", emoji: "🔁", pron: "PRAK-tis",
        senses: [
          { pos: "verb", def: "to do something over and over to get better at it",
            example: "If you practice Spanish every day, you'll speak it with ease." },
          { pos: "verb", def: "to do; to carry on or perform",
            example: "He was raised from an early age to practice politeness." },
          { pos: "verb", def: "to work at as a profession",
            example: "Aunt Marianna is licensed to practice law in two states." },
          { pos: "noun", def: "a repeated action or usual way of doing something",
            example: "It's my mother's practice to swim thirty laps every morning." },
          { pos: "noun", def: "the work of a profession",
            example: "The practice of medicine has changed a lot recently." }
        ],
        synonyms: ["train", "rehearse", "habit"], antonyms: [],
        mnemonic: "Practice makes progress — do it again and again until it's easy."
      }),
      entry({
        word: "prune", emoji: "✂️", pron: "PROON",
        senses: [
          { pos: "verb", def: "to cut off branches",
            example: "We had to prune the shrubs so we could see out the window." },
          { pos: "noun", def: "a dried plum",
            example: "Elijah soaks the prunes overnight and serves them for breakfast." }
        ],
        synonyms: ["trim", "clip", "cut back"], antonyms: [],
        mnemonic: "Prune the branches with a snip — and a prune is a wrinkly dried plum."
      }),
      entry({
        word: "stout", emoji: "💪", pron: "STOWT",
        senses: [
          { pos: "adj", def: "heavily built; thickset",
            example: "He used to be thin, but he grew stout as he got older." },
          { pos: "adj", def: "strong; not easily bent or broken",
            example: "The roof of the barn was supported by six stout posts." }
        ],
        synonyms: ["sturdy", "strong", "solid"], antonyms: ["thin", "flimsy", "weak"],
        mnemonic: "Stout means thick and strong — like a post that won't bend."
      }),
      entry({
        word: "threadbare", emoji: "🧵", pron: "THRED-bair",
        senses: [{ pos: "adj", def: "shabby and worn out",
          example: "The threadbare blankets on the bed failed to keep us warm." }],
        synonyms: ["worn out", "shabby", "ragged"], antonyms: ["brand-new", "plush"],
        mnemonic: "Threadbare cloth is worn down to its bare threads."
      }),
      entry({
        word: "wander", emoji: "🚶", pron: "WAHN-der",
        senses: [
          { pos: "verb", def: "to go from place to place with no plan or purpose",
            example: "We wandered around downtown, waiting for the post office to open." },
          { pos: "verb", def: "to drift off the subject; to stop working in the normal way",
            example: "Luis tried to concentrate on his homework, but his mind began to wander." }
        ],
        synonyms: ["roam", "drift", "ramble"], antonyms: ["stay", "focus"],
        mnemonic: "To wander is to walk (or think) wherever the wind takes you."
      })
    ]
  };

  var LESSON17 = {
    lesson: 17,
    title: "Lesson 17",
    words: [
      entry({
        word: "address", emoji: "📬", pron: "uh-DRES",
        senses: [
          { pos: "verb", def: "to direct your words to someone",
            example: "The head of the honor society addressed all the students." },
          { pos: "verb", def: "to put your effort into something; to deal with it",
            example: "As soon as Ms. Lu finishes solving one problem, she has to address a new one." },
          { pos: "noun", def: "a written or spoken speech",
            example: "President Lincoln scribbled the Gettysburg Address on an envelope." },
          { pos: "noun", def: "the place where someone lives or gets mail",
            example: "Let the post office know if you change your address." }
        ],
        synonyms: ["speak to", "deal with", "speech"], antonyms: ["ignore"],
        mnemonic: "You address a letter, address a crowd, or address a problem — you point your words or effort AT it."
      }),
      entry({
        word: "approve", emoji: "👍", pron: "uh-PROOV",
        senses: [{ pos: "verb", def: "to think well of; to agree to",
          example: "My friend Lucia approved my choice of a dress for the party." }],
        forms: [{ word: "approval", pos: "noun", def: "thinking well of; agreeing to",
          example: "My parents' approval is important to me." }],
        synonyms: ["agree to", "accept", "okay"], antonyms: ["disapprove", "reject"],
        mnemonic: "To approve is to give it the thumbs-up — you think it's good."
      }),
      entry({
        word: "conclude", emoji: "🏁", pron: "kun-KLOOD",
        senses: [
          { pos: "verb", def: "to bring or come to an end",
            example: "It took us ten minutes to reach the exit after the concert concluded." },
          { pos: "verb", def: "to form an opinion after thinking",
            example: "Jan concluded that mowing lawns was the best way to earn money next summer." }
        ],
        forms: [
          { word: "conclusion", pos: "noun", def: "the end; or a judgment you reach",
            example: "A bow by the magician marked the conclusion of the show." }
        ],
        synonyms: ["end", "finish", "decide"], antonyms: ["begin", "start"],
        mnemonic: "To conclude is to CLOSE it out — the show ends, or your thinking lands on an answer."
      }),
      entry({
        word: "deprive", emoji: "🚫", pron: "dih-PRYVE",
        senses: [{ pos: "verb", def: "to keep from having; to take away from",
          example: "The thunderstorm at 3:00 a.m. deprived me of a good night's sleep." }],
        synonyms: ["take away", "deny", "rob"], antonyms: ["give", "provide"],
        mnemonic: "To deprive is to take away something someone needs."
      }),
      entry({
        word: "elder", emoji: "👴", pron: "EL-dur",
        senses: [
          { pos: "noun", def: "a person who is older",
            example: "Sometimes we can learn a lot from our elders just by watching how they live." },
          { pos: "noun", def: "a respected older leader",
            example: "The elders of the town met to decide what to do about the need for new schools." },
          { pos: "adj", def: "older",
            example: "My elder brother is a senior in high school." }
        ],
        synonyms: ["older person", "senior"], antonyms: ["youngster", "junior"],
        mnemonic: "An elder is older — and often wiser."
      }),
      entry({
        word: "escort", emoji: "🛡️", pron: "es-KORT",
        senses: [
          { pos: "verb", def: "to travel with someone to guide or protect them",
            example: "Anna asked her older sister to escort her to a movie with her friends." },
          { pos: "noun", def: "a person (or group) who travels along to guard someone",
            example: "The president always has a police escort when he travels by car." }
        ],
        synonyms: ["guide", "accompany", "guard"], antonyms: [],
        mnemonic: "An escort goes along to keep you safe — like a guard by your side."
      }),
      entry({
        word: "fare", emoji: "🎫", pron: "FAIR",
        senses: [
          { pos: "noun", def: "the money paid for a trip",
            example: "What is the fare from Chicago to Orlando by plane?" },
          { pos: "noun", def: "food and drink",
            example: "The new restaurant serves Chinese fare." },
          { pos: "verb", def: "to get along; to do well or badly",
            example: "I wonder how my sister is faring on her mountain-climbing trip." }
        ],
        synonyms: ["ticket price", "food", "get along"], antonyms: [],
        mnemonic: "Bus fare is what you pay; restaurant fare is what you eat; and 'how did you fare?' asks how it went."
      }),
      entry({
        word: "forlorn", emoji: "🐶", pron: "for-LORN",
        senses: [{ pos: "adj", def: "sad and lonely",
          example: "Sam looked lost and forlorn as he sat waiting for his mother." }],
        synonyms: ["lonely", "miserable", "abandoned"], antonyms: ["cheerful", "happy"],
        mnemonic: "Forlorn is how a lost puppy looks — sad and all alone."
      }),
      entry({
        word: "hearty", emoji: "💪", pron: "HAR-tee",
        senses: [
          { pos: "adj", def: "healthy; strong",
            example: "At eighty-five, Grandpa still had a hearty appetite at every meal." },
          { pos: "adj", def: "satisfying and full of flavor; tasty",
            example: "The hearty vegetable chili hit the spot on a cold day." },
          { pos: "adj", def: "friendly and enthusiastic",
            example: "Uncle Pete gave a hearty chuckle when my little brother told a joke." }
        ],
        synonyms: ["strong", "filling", "warm"], antonyms: ["weak", "bland", "cold"],
        mnemonic: "Hearty comes from HEART — strong, warm, and full."
      }),
      entry({
        word: "inhale", emoji: "🌬️", pron: "in-HAYL",
        senses: [{ pos: "verb", def: "to breathe in",
          example: "I tried to catch my breath by inhaling deeply several times." }],
        synonyms: ["breathe in"], antonyms: ["exhale", "breathe out"],
        mnemonic: "Inhale pulls air IN; exhale lets it out."
      }),
      entry({
        word: "merit", emoji: "🏅", pron: "MER-it",
        senses: [
          { pos: "verb", def: "to deserve",
            example: "The students' ideas for the sports program merit the principal's attention." },
          { pos: "noun", def: "good qualities; worth",
            example: "Dalal's teacher thought his fund-raising idea had merit." },
          { pos: "noun", def: "(the merits) the actual facts of a case",
            example: "The school board judged the case for a shorter school day on its merits." }
        ],
        synonyms: ["deserve", "worth", "value"], antonyms: ["fault", "flaw"],
        mnemonic: "Merit means worth — a good idea merits (deserves) attention."
      }),
      entry({
        word: "stingy", emoji: "🪙", pron: "STIN-jee",
        senses: [{ pos: "adj", def: "not generous",
          example: "Azania is too stingy to share her candy with anyone." }],
        synonyms: ["selfish", "cheap", "tight"], antonyms: ["generous", "giving"],
        mnemonic: "A stingy person clings to every coin — no sharing."
      }),
      entry({
        word: "summon", emoji: "📣", pron: "SUM-un",
        senses: [
          { pos: "verb", def: "to call or send for someone",
            example: "My father summoned me to the phone." },
          { pos: "verb", def: "to call forth; to gather up",
            example: "I summoned all my courage and walked out on the stage." }
        ],
        synonyms: ["call", "send for", "gather"], antonyms: ["dismiss"],
        mnemonic: "To summon is to call it to you — a person, or your own courage."
      }),
      entry({
        word: "valiant", emoji: "🦸", pron: "VAL-yunt",
        senses: [{ pos: "adj", def: "full of courage; brave",
          example: "The firefighters were honored for their valiant deeds." }],
        synonyms: ["brave", "courageous", "heroic"], antonyms: ["cowardly", "fearful"],
        mnemonic: "Valiant heroes have valor — big brave hearts."
      }),
      entry({
        word: "waft", emoji: "🍃", pron: "WAHFT",
        senses: [{ pos: "verb", def: "to move or drift lightly through air or over water",
          example: "Petals from the cherry blossoms wafted over the path on the gentle breeze." }],
        synonyms: ["drift", "float", "glide"], antonyms: ["plummet", "sink"],
        mnemonic: "Smells and petals waft — they float by on the breeze."
      })
    ]
  };

  var LESSON18 = {
    lesson: 18,
    title: "Lesson 18",
    words: [
      entry({
        word: "abreast", emoji: "👥", pron: "uh-BREST",
        senses: [
          { pos: "adj", def: "side by side",
            example: "We walked three abreast, except where the path was too narrow." },
          { pos: "adj", def: "up-to-date; keeping up with the news",
            example: "I stay abreast of what is happening in the world by reading the news every day." }
        ],
        synonyms: ["side by side", "up-to-date", "informed"], antonyms: ["behind"],
        mnemonic: "Walking abreast = shoulder to shoulder; staying abreast = keeping up."
      }),
      entry({
        word: "barrier", emoji: "🚧", pron: "BAIR-ee-ur",
        senses: [{ pos: "noun", def: "anything that stops progress or blocks the way",
          example: "Lack of education is often a barrier to success in life." }],
        synonyms: ["block", "obstacle", "wall"], antonyms: ["opening", "path"],
        mnemonic: "A barrier BARS the way — a wall between you and where you're going."
      }),
      entry({
        word: "breadth", emoji: "📏", pron: "BREDTH",
        senses: [
          { pos: "noun", def: "the distance from side to side; width",
            example: "The arrow missed the target by no more than a hand's breadth." },
          { pos: "noun", def: "wide range; largeness",
            example: "Carlos got the job because of his breadth of experience." }
        ],
        synonyms: ["width", "range", "span"], antonyms: ["narrowness"],
        mnemonic: "Breadth is how BROAD something is — side to side, or how wide your knowledge reaches."
      }),
      entry({
        word: "capital", emoji: "🏛️", pron: "KAP-ih-tul",
        senses: [
          { pos: "noun", def: "money or wealth used to make more wealth",
            example: "You don't need much capital to buy that pizza business." },
          { pos: "noun", def: "the city where a state or country's government sits",
            example: "The capital of Montana is Helena." },
          { pos: "adj", def: "punishable by death",
            example: "Murder is a capital crime in only a few countries." }
        ],
        synonyms: ["funds", "seat of government"], antonyms: [],
        mnemonic: "Capital: the money that builds a business, or the city that runs the state."
      }),
      entry({
        word: "ensure", emoji: "✅", pron: "in-SHOOR",
        senses: [{ pos: "verb", def: "to make sure or certain",
          example: "Wearing a seat belt will help ensure your safety in case of an accident." }],
        synonyms: ["make sure", "guarantee", "secure"], antonyms: [],
        mnemonic: "To ensure is to make SURE it happens."
      }),
      entry({
        word: "external", emoji: "🧱", pron: "ek-STUR-nul",
        senses: [{ pos: "adj", def: "on or related to the outside",
          example: "The external walls of the building are brick." }],
        synonyms: ["outside", "outer"], antonyms: ["internal", "inner"],
        mnemonic: "External = the EXterior — the outside part."
      }),
      entry({
        word: "feud", emoji: "⚔️", pron: "FYOOD",
        senses: [
          { pos: "noun", def: "a long, bitter quarrel, especially between two families",
            example: "We did not want the argument between neighbors to turn into a feud." },
          { pos: "verb", def: "to be enemies; to quarrel",
            example: "The former friends feuded for years over a small disagreement." }
        ],
        synonyms: ["quarrel", "grudge", "conflict"], antonyms: ["friendship", "peace"],
        mnemonic: "A feud is a fight that never cools — a grudge that goes on and on."
      }),
      entry({
        word: "fortress", emoji: "🏰", pron: "FOR-trus",
        senses: [{ pos: "noun", def: "a building with strong walls made to be defended against attack; a fort",
          example: "Rather than attack the fortress directly, the invaders went around it." }],
        synonyms: ["fort", "stronghold", "castle"], antonyms: [],
        mnemonic: "A fortress is a super-strong fort — thick walls, hard to break."
      }),
      entry({
        word: "frequent", emoji: "🔂", pron: "FREE-kwent",
        senses: [
          { pos: "adj", def: "happening often, over and over",
            example: "My mother's business requires her to make frequent visits to Japan." },
          { pos: "verb", def: "to go to a place over and over",
            example: "We frequent the local bakery for whole-grain bread." }
        ],
        forms: [{ word: "frequency", pos: "noun", def: "the number of times something is repeated",
          example: "My clarinet playing improved with the frequency of my practicing." }],
        synonyms: ["often", "regular", "repeated"], antonyms: ["rare", "seldom"],
        mnemonic: "Frequent means again and again — you frequent the places you visit a lot."
      }),
      entry({
        word: "frontier", emoji: "🤠", pron: "frun-TEER",
        senses: [
          { pos: "noun", def: "the line between two countries",
            example: "We said goodbye to France and crossed the frontier into Spain." },
          { pos: "noun", def: "the outer edge of the settled part of a country",
            example: "The American frontier moved slowly westward in the nineteenth century." },
          { pos: "noun", def: "the outer limits of what we know",
            example: "The frontiers of medicine are being pushed back at a rapidly increasing rate." }
        ],
        synonyms: ["border", "edge", "unknown territory"], antonyms: ["heartland"],
        mnemonic: "The frontier is the FRONT line — of a country, the settled land, or what we know."
      }),
      entry({
        word: "peasant", emoji: "🌾", pron: "PEZ-unt",
        senses: [{ pos: "noun", def: "a person who makes a living working the soil, especially long ago or in poorer countries",
          example: "The peasants of the Middle Ages worked hard to feed their families." }],
        synonyms: ["farmer", "farmworker"], antonyms: ["noble", "lord"],
        mnemonic: "A peasant worked the fields in the days of castles and kings."
      }),
      entry({
        word: "petty", emoji: "🤏", pron: "PET-ee",
        senses: [{ pos: "adj", def: "of little importance; small",
          example: "A petty disagreement over a game of kickball led to an argument." }],
        synonyms: ["small", "minor", "trivial"], antonyms: ["important", "major"],
        mnemonic: "Petty problems are itty-bitty — too small to fight about."
      }),
      entry({
        word: "threat", emoji: "⚠️", pron: "THRET",
        senses: [{ pos: "noun", def: "a warning that one may do harm",
          example: "Olivia tried to quiet her dog after her neighbor's threat to call the police." }],
        forms: [
          { word: "threaten", pos: "verb", def: "to make a threat",
            example: "My brother threatened to tell my mother that I ate all the cake." },
          { word: "threatening", pos: "adj", def: "suggesting harm or danger",
            example: "The dark clouds looked very threatening." }
        ],
        synonyms: ["warning", "danger"], antonyms: ["promise", "reassurance"],
        mnemonic: "A threat warns that trouble is coming."
      }),
      entry({
        word: "utilize", emoji: "🔧", pron: "YOO-tuh-lize",
        senses: [{ pos: "verb", def: "to put to use",
          example: "We utilized whatever scraps of fabric we had to make a costume." }],
        synonyms: ["use", "employ", "make use of"], antonyms: ["waste"],
        mnemonic: "To utilize is to USE it — put it to work."
      }),
      entry({
        word: "vast", emoji: "🌊", pron: "VAST",
        senses: [{ pos: "adj", def: "very great in area or amount",
          example: "The Pacific Ocean is a vast body of water." }],
        synonyms: ["huge", "enormous", "immense"], antonyms: ["tiny", "small"],
        mnemonic: "Vast is VERY big — ocean-sized big."
      })
    ]
  };

  var LESSON19 = {
    lesson: 19,
    title: "Lesson 19",
    words: [
      entry({
        word: "audition", emoji: "🎤", pron: "aw-DISH-un",
        senses: [
          { pos: "noun", def: "a short tryout performance by an actor or musician",
            example: "Auditions for the school band will be held tomorrow." },
          { pos: "verb", def: "to try out for a part",
            example: "Six people auditioned for the part of Helen Keller in the fourth-grade play." }
        ],
        synonyms: ["tryout", "test performance"], antonyms: [],
        mnemonic: "An audition is your tryout on stage — they listen (AUDIO) to pick you."
      }),
      entry({
        word: "create", emoji: "🎨", pron: "kree-AYT",
        senses: [{ pos: "verb", def: "to bring into being; to make for the first time",
          example: "The computer industry has created many new jobs." }],
        forms: [
          { word: "creative", pos: "adj", def: "having new and original ideas",
            example: "Picasso was one of the most creative artists ever." },
          { word: "creation", pos: "noun", def: "the act of making something; the thing made",
            example: "The creation of three new schools means classrooms will be less crowded." }
        ],
        synonyms: ["make", "invent", "produce"], antonyms: ["destroy"],
        mnemonic: "To create is to make something brand new exist."
      }),
      entry({
        word: "elevate", emoji: "🛗", pron: "EL-uh-vayt",
        senses: [{ pos: "verb", def: "to lift up; to raise to a higher level",
          example: "The new director elevated the school play to new heights." }],
        forms: [{ word: "elevation", pos: "noun", def: "height",
          example: "I have to look up the elevation of Mt. Monadnock for my chart." }],
        synonyms: ["raise", "lift", "boost"], antonyms: ["lower", "drop"],
        mnemonic: "An elevator elevates you — up you go."
      }),
      entry({
        word: "eliminate", emoji: "🗑️", pron: "ih-LIM-uh-nayt",
        senses: [{ pos: "verb", def: "to get rid of; to remove or leave out",
          example: "Zeb decided to eliminate the last paragraph because his report was too long." }],
        forms: [{ word: "elimination", pos: "noun", def: "a getting rid of",
          example: "The elimination of the Red Sox from the pennant race upset my mother terribly." }],
        synonyms: ["remove", "cut", "get rid of"], antonyms: ["add", "include", "keep"],
        mnemonic: "To eliminate is to knock it out of the lineup — gone."
      }),
      entry({
        word: "engage", emoji: "🤝", pron: "in-GAYJ",
        senses: [
          { pos: "verb", def: "to put to work; to hire",
            example: "The Beachfront Restaurant engages extra help every summer." },
          { pos: "verb", def: "to keep busy or active",
            example: "Wen Lin tried to engage her cousin in conversation, but she was very shy." },
          { pos: "verb", def: "to promise to do something — especially to marry",
            example: "My parents got engaged on the roof of a building." }
        ],
        synonyms: ["hire", "occupy", "involve"], antonyms: ["dismiss", "release"],
        mnemonic: "Engage means to pull someone IN — into a job, a chat, or a promise."
      }),
      entry({
        word: "entrance", emoji: "🤩", pron: "in-TRANS",
        senses: [{ pos: "verb", def: "to fill with joy or delight",
          example: "The young dancers entranced the audience with their grace and beauty." }],
        forms: [{ word: "entrancing", pos: "adj", def: "delightful",
          example: "The songs were so entrancing that we hated to see the performance end." }],
        synonyms: ["delight", "charm", "enchant"], antonyms: ["bore"],
        mnemonic: "To entrance is to put someone in a happy TRANCE — spellbound with delight."
      }),
      entry({
        word: "essential", emoji: "🔑", pron: "ih-SEN-shul",
        senses: [
          { pos: "adj", def: "most important; very necessary",
            example: "Fresh fruit and vegetables are essential to a good diet." },
          { pos: "noun", def: "(essentials) the things you can't do without",
            example: "I packed my overnight bag with my toothbrush and other essentials." }
        ],
        synonyms: ["necessary", "vital", "must-have"], antonyms: ["unnecessary", "optional"],
        mnemonic: "Essential things are of the ESSENCE — you can't skip them."
      }),
      entry({
        word: "foremost", emoji: "🥇", pron: "FOR-mohst",
        senses: [{ pos: "adj", def: "first in importance, time, or place",
          example: "This new book by Nigeria's foremost writer is wonderful." }],
        synonyms: ["leading", "top", "first"], antonyms: ["least", "last"],
        mnemonic: "Foremost = the one MOST at the FORE — out in front of all the rest."
      }),
      entry({
        word: "forsake", emoji: "🚪", pron: "for-SAYK",
        senses: [{ pos: "verb", def: "to have nothing more to do with; to turn your back on",
          example: "I'd never forsake my old friends if I became rich and famous." }],
        synonyms: ["abandon", "desert", "leave behind"], antonyms: ["stand by", "stay with"],
        mnemonic: "To forsake is to walk away for good — never do it to your friends."
      }),
      entry({
        word: "recognize", emoji: "🫡", pron: "REK-ig-nize",
        senses: [
          { pos: "verb", def: "to know and remember upon seeing",
            example: "I recognized the name, but not the face." },
          { pos: "verb", def: "to admit the truth of; to accept that something exists",
            example: "My friends recognize my need to be by myself." },
          { pos: "verb", def: "to accept and approve of",
            example: "The company recognizes the good job my mother does." }
        ],
        synonyms: ["know", "identify", "acknowledge"], antonyms: ["overlook", "ignore"],
        mnemonic: "To RE-cognize is to know it AGAIN when you see it."
      }),
      entry({
        word: "sentimental", emoji: "🥲", pron: "sen-tuh-MEN-tul",
        senses: [{ pos: "adj", def: "expressing feelings of love or pity — sometimes too much",
          example: "The movie was so sentimental that everyone was in tears." }],
        synonyms: ["emotional", "mushy", "tender"], antonyms: ["cold", "unemotional"],
        mnemonic: "Sentimental is all about sentiments — big soft feelings."
      }),
      entry({
        word: "source", emoji: "⛲", pron: "SORS",
        senses: [{ pos: "noun", def: "the thing or place something comes from",
          example: "We decided to research the source of the Nile River." }],
        synonyms: ["origin", "start", "beginning"], antonyms: ["end", "mouth"],
        mnemonic: "The source is where it all starts — a river's spring, a story's start."
      }),
      entry({
        word: "tour", emoji: "🚌", pron: "TOOR",
        senses: [
          { pos: "noun", def: "a trip that usually returns to its starting point",
            example: "The band played over twenty concerts on its tour of the Midwest." },
          { pos: "verb", def: "to travel to different places",
            example: "My cousin Anna and I toured the old part of Montreal in a horse-drawn carriage." }
        ],
        synonyms: ["trip", "journey", "travel"], antonyms: [],
        mnemonic: "A tour takes you around and brings you home again."
      }),
      entry({
        word: "tradition", emoji: "🎆", pron: "truh-DISH-un",
        senses: [{ pos: "noun", def: "a belief, custom, or usual way of doing things, handed down in families or groups",
          example: "Fireworks on July 4 are an American tradition." }],
        forms: [{ word: "traditional", pos: "adj", def: "handed down from age to age",
          example: "My whole family enjoys getting together for a traditional Sunday dinner." }],
        synonyms: ["custom", "practice", "heritage"], antonyms: ["novelty"],
        mnemonic: "A tradition is handed down like a family recipe — again every year."
      }),
      entry({
        word: "trio", emoji: "🎻", pron: "TREE-oh",
        senses: [{ pos: "noun", def: "a group of three people",
          example: "Luis plays the cello in a trio." }],
        synonyms: ["threesome", "triple"], antonyms: ["solo", "duo"],
        mnemonic: "TRI means three — a trio is three together, like a tricycle's three wheels."
      })
    ]
  };

  var LESSON20 = {
    lesson: 20,
    title: "Lesson 20",
    words: [
      entry({
        word: "arrest", emoji: "🛑", pron: "uh-REST",
        senses: [
          { pos: "verb", def: "to stop the movement or progress of",
            example: "The doctors were able to arrest the spread of the disease." },
          { pos: "verb", def: "to seize and charge with breaking the law",
            example: "When the police arrested the suspect, they found the stolen jewelry in his pocket." },
          { pos: "noun", def: "the act of arresting",
            example: "The police officer made the arrest at the scene of the crime." }
        ],
        synonyms: ["stop", "halt", "capture"], antonyms: ["release", "free"],
        mnemonic: "To arrest is to bring it to a REST — a disease stops spreading, a suspect stops running."
      }),
      entry({
        word: "capable", emoji: "🛠️", pron: "KAY-puh-bul",
        senses: [
          { pos: "adj", def: "able to do things well; skilled",
            example: "Companies try to hire the most capable workers." },
          { pos: "adj", def: "(capable of) ready and able to; having what it takes for",
            example: "Although she's only fourteen, Samantha is capable of babysitting two small children." }
        ],
        synonyms: ["able", "skilled", "competent"], antonyms: ["unable", "helpless"],
        mnemonic: "Capable people are CAPtains of the job — they can handle it."
      }),
      entry({
        word: "congratulate", emoji: "🎉", pron: "kun-GRACH-uh-layt",
        senses: [{ pos: "verb", def: "to express pleasure at someone's success or good fortune",
          example: "Allow me to congratulate you on your victory." }],
        forms: [{ word: "congratulations", pos: "noun", def: "good wishes for a success",
          example: "Our class made Zel a card that said, 'Congratulations on winning the 10K race!'" }],
        synonyms: ["cheer", "praise", "applaud"], antonyms: [],
        mnemonic: "You congratulate the winner — 'Way to go!'"
      }),
      entry({
        word: "despise", emoji: "😤", pron: "dih-SPYZE",
        senses: [{ pos: "verb", def: "to scorn and dislike strongly; to look down on",
          example: "The French nobles despised the peasants, who were fighting to gain their freedom." }],
        synonyms: ["scorn", "hate", "look down on"], antonyms: ["admire", "respect"],
        mnemonic: "To despise is to look DOWN on someone — deep dislike plus no respect."
      }),
      entry({
        word: "dispute", emoji: "🗣️", pron: "dih-SPYOOT",
        senses: [
          { pos: "noun", def: "a strong difference of opinion; an argument",
            example: "The feuding neighbors were unable to settle their dispute." },
          { pos: "verb", def: "to question the truth or value of",
            example: "When her parents disputed the value of her new bike, Rona produced an article that praised it." }
        ],
        synonyms: ["argument", "quarrel", "challenge"], antonyms: ["agreement"],
        mnemonic: "A dispute is a war of words — and to dispute a claim is to say 'prove it!'"
      }),
      entry({
        word: "eventual", emoji: "⏳", pron: "ih-VEN-choo-ul",
        senses: [{ pos: "adj", def: "coming at a later time; happening in the end as a result",
          example: "Years of practice led to his eventual success as a Wimbledon tennis champion." }],
        synonyms: ["final", "later", "resulting"], antonyms: ["immediate"],
        mnemonic: "Eventual success EVENTUALLY arrives — after the work, in the end."
      }),
      entry({
        word: "helm", emoji: "⚓", pron: "HELM",
        senses: [
          { pos: "noun", def: "the wheel or tiller used to steer a boat",
            example: "The skipper said I could take the helm because the sea was calm." },
          { pos: "noun", def: "a position of control",
            example: "With a new coach at the helm, our swim team can expect some changes." }
        ],
        synonyms: ["wheel", "controls", "command"], antonyms: [],
        mnemonic: "Whoever holds the helm steers the ship — or the team."
      }),
      entry({
        word: "humiliate", emoji: "😳", pron: "hyoo-MIL-ee-ayt",
        senses: [{ pos: "verb", def: "to treat in a way that takes away a person's pride or self-respect",
          example: "The workers humiliated the newcomer because he seemed so strange." }],
        forms: [{ word: "humiliation", pos: "noun", def: "the state of being humiliated",
          example: "The queen tried to hide her humiliation at the way the villagers jeered at her." }],
        synonyms: ["embarrass", "shame", "disgrace"], antonyms: ["honor", "praise"],
        mnemonic: "To humiliate is to stomp on someone's pride — never kind."
      }),
      entry({
        word: "implore", emoji: "🙏", pron: "im-PLOR",
        senses: [{ pos: "verb", def: "to plead with or beg for with much feeling",
          example: "I implored my parents to let me go with them." }],
        synonyms: ["beg", "plead", "beseech"], antonyms: ["demand"],
        mnemonic: "To implore is to beg with your whole heart — 'PLEASE!'"
      }),
      entry({
        word: "insert", emoji: "🔑", pron: "in-SURT",
        senses: [
          { pos: "verb", def: "to put in",
            example: "Please insert the key into the lock so we can get out of the rain." },
          { pos: "noun", def: "an extra piece sewn or put in place",
            example: "My new shirt has a lace insert at the neck." }
        ],
        synonyms: ["put in", "slot in", "add"], antonyms: ["remove", "take out"],
        mnemonic: "Insert = IN it goes — a key, a coin, a bookmark."
      }),
      entry({
        word: "outrage", emoji: "😡", pron: "OWT-rayj",
        senses: [
          { pos: "noun", def: "anger caused by injury or insult",
            example: "The decision to close the school caused outrage among the parents." },
          { pos: "noun", def: "a wicked or very unfair act or remark",
            example: "Shutting the playground all summer felt like an outrage to the kids." },
          { pos: "verb", def: "to fill with anger or resentment",
            example: "The way some people let their dogs run without a leash outrages me." }
        ],
        synonyms: ["fury", "anger", "scandal"], antonyms: ["delight", "calm"],
        mnemonic: "Outrage is anger that bursts OUT — at something truly unfair."
      }),
      entry({
        word: "pierce", emoji: "📍", pron: "PEERS",
        senses: [
          { pos: "verb", def: "to pass or break through",
            example: "A beam of light suddenly pierced the darkness." },
          { pos: "verb", def: "to make a hole through",
            example: "The needle pierced the thick fabric easily." }
        ],
        forms: [{ word: "piercing", pos: "adj", def: "very loud and shrill",
          example: "The piercing cries of the seagulls woke me up." }],
        synonyms: ["puncture", "stab", "break through"], antonyms: [],
        mnemonic: "To pierce is to poke through — light through dark, a needle through cloth."
      }),
      entry({
        word: "quiver", emoji: "🏹", pron: "KWIV-ur",
        senses: [
          { pos: "verb", def: "to shake with small, rapid movements; to tremble",
            example: "The child's lip quivered as if he were about to cry." },
          { pos: "noun", def: "a trembling",
            example: "There was a quiver in her voice as Mira told us about the accident." },
          { pos: "noun", def: "a case for holding arrows",
            example: "Each archer was equipped with a bow and a quiver full of arrows." }
        ],
        synonyms: ["tremble", "shake", "shiver"], antonyms: ["hold still"],
        mnemonic: "A lip can quiver, a voice can quiver — and an archer's arrows live in one."
      }),
      entry({
        word: "release", emoji: "🕊️", pron: "rih-LEES",
        senses: [
          { pos: "verb", def: "to let go; to set free",
            example: "The pigeons flew away as soon as I released them from their cages." },
          { pos: "verb", def: "to make known to the public",
            example: "A copy of the governor's speech was released to reporters at noon." },
          { pos: "noun", def: "a setting free",
            example: "Four years after his release from prison, Nelson Mandela was sworn in as South Africa's first black president." },
          { pos: "noun", def: "an announcement of news",
            example: "The governor's office sent a press release about the new program." }
        ],
        synonyms: ["free", "let go", "publish"], antonyms: ["capture", "hold", "arrest"],
        mnemonic: "Release lets it go — a bird from a cage, or news to the world."
      }),
      entry({
        word: "sullen", emoji: "😒", pron: "SUL-un",
        senses: [{ pos: "adj", def: "silent from anger or hurt",
          example: "Tom grew from a sullen teenager into a friendly and outgoing young man." }],
        synonyms: ["grumpy", "moody", "gloomy"], antonyms: ["cheerful", "friendly"],
        mnemonic: "Sullen is the silent sulk — arms crossed, not talking."
      })
    ]
  };

  // ===== BOOK 2 (Liana) — 10 words per lesson =====
  var BOOK2_L10 = {
    lesson: 10, book: 2, title: "Lesson 10",
    words: [
      entry({
        word: "astronomy", emoji: "🌠", pron: "ə-STRON-ə-mee",
        senses: [{ pos: "noun", def: "the study of planets, stars, and space",
          example: "Many people who take up astronomy first became interested when they were children." }],
        forms: [{ word: "astronomer", pos: "noun", def: "a person who studies astronomy",
          example: "An astronomer uses a telescope to study space." }],
        synonyms: ["space science", "star study"], antonyms: [],
        mnemonic: "Astronomy is the study of the stars — 'astro' means star."
      }),
      entry({
        word: "besides", emoji: "➕", pron: "bih-SYDZ",
        senses: [{ pos: "prep", def: "in addition to; also",
          example: "Besides being on the soccer team, Sean loves playing basketball." }],
        synonyms: ["also", "in addition", "plus"], antonyms: [],
        mnemonic: "Besides means 'and also' — one more thing beside the rest."
      }),
      entry({
        word: "crater", emoji: "🌋", pron: "KRAY-tər",
        senses: [{ pos: "noun", def: "a bowl-shaped hole in the ground or at the top of a volcano",
          example: "The hikers walked to the top of the volcano to look down into the large crater." }],
        synonyms: ["pit", "hole", "bowl"], antonyms: ["hill", "mound"],
        mnemonic: "A crater is a big bowl-shaped hole — like on the moon or a volcano."
      }),
      entry({
        word: "degree", emoji: "🌡️", pron: "dih-GREE",
        senses: [
          { pos: "noun", def: "a unit for measuring how warm something is",
            example: "Cindy heated the oven to 350 degrees before she put the bread in to bake." },
          { pos: "noun", def: "a stage or step in a series",
            example: "By degrees, Malcolm slowly got better at doing his math problems." }
        ],
        synonyms: ["unit", "step", "stage"], antonyms: [],
        mnemonic: "A degree measures heat (like 90°) — or a step you take little by little."
      }),
      entry({
        word: "diameter", emoji: "⭕", pron: "dy-AM-ə-tər",
        senses: [{ pos: "noun", def: "the distance from side to side through the center of a circle or round object",
          example: "The diameter of the trunk of our old oak tree was at least thirty inches." }],
        synonyms: ["width", "distance across"], antonyms: [],
        mnemonic: "The diameter goes straight across a circle, through the middle."
      }),
      entry({
        word: "gaze", emoji: "👀", pron: "GAYZ",
        senses: [{ pos: "verb", def: "to look steadily at something for a long time",
          example: "Sam and Julie gazed at the polar bears swimming in a large pool at the zoo." }],
        synonyms: ["stare", "watch", "look"], antonyms: ["glance"],
        mnemonic: "To gaze is to look and look — a long, steady stare."
      }),
      entry({
        word: "gravity", emoji: "🌍", pron: "GRAV-ih-tee",
        senses: [
          { pos: "noun", def: "the force that pulls things toward the center of Earth",
            example: "Gravity causes an apple to fall to the ground." },
          { pos: "noun", def: "the condition of being serious",
            example: "Celia understood later the gravity of what she had done by playing too close to the large waves." }
        ],
        synonyms: ["pull", "force", "seriousness"], antonyms: [],
        mnemonic: "Gravity pulls everything down — it's why things fall."
      }),
      entry({
        word: "reflect", emoji: "🪞", pron: "rih-FLEKT",
        senses: [
          { pos: "verb", def: "to turn or throw back, such as light or sound",
            example: "The mirror reflected Tyler's face when he looked into it." },
          { pos: "verb", def: "to think carefully about something",
            example: "Paul reflected on the next chess piece he would move." }
        ],
        synonyms: ["mirror", "bounce back", "think about"], antonyms: [],
        mnemonic: "A mirror reflects your face — and you reflect by thinking hard."
      }),
      entry({
        word: "telescope", emoji: "🔭", pron: "TEL-ə-skohp",
        senses: [{ pos: "noun", def: "a tool that makes distant things seem closer and larger, using mirrors and lenses",
          example: "On a cool October night, Dad and Molly set up the telescope in the backyard to view the stars." }],
        synonyms: ["spyglass", "scope"], antonyms: [],
        mnemonic: "A telescope lets you see far — 'tele' means far away."
      }),
      entry({
        word: "universe", emoji: "🌌", pron: "YOO-nih-vurs",
        senses: [{ pos: "noun", def: "all of space and all the objects in space",
          example: "The Milky Way is just one of many large groups of stars in our universe." }],
        synonyms: ["space", "cosmos", "everything"], antonyms: [],
        mnemonic: "The universe is EVERYTHING — all the stars and space there is."
      })
    ]
  };

  var BOOK2_L12 = {
    lesson: 12, book: 2, title: "Lesson 12",
    words: [
      entry({
        word: "arch", emoji: "🌉", pron: "ARCH",
        senses: [{ pos: "noun", def: "a curved piece of wood, stone, or metal over an open space; it holds up the weight above it",
          example: "We walked beneath the stone arch to enter the small garden." }],
        synonyms: ["curve", "archway"], antonyms: [],
        mnemonic: "An arch is a curve you can walk under — like a rainbow made of stone."
      }),
      entry({
        word: "attention", emoji: "👂", pron: "uh-TEN-shun",
        senses: [{ pos: "noun", def: "thinking, listening, or watching carefully",
          example: "Nothing could draw Tan's attention away from the mystery he was reading." }],
        synonyms: ["focus", "notice", "care"], antonyms: [],
        mnemonic: "Pay attention — point your ears and eyes at it and really listen."
      }),
      entry({
        word: "award", emoji: "🏆", pron: "uh-WORD",
        senses: [
          { pos: "noun", def: "something given for doing well; a prize",
            example: "Shelley thanked the judges for the dictionary, her award for winning the state spelling contest." },
          { pos: "verb", def: "to give something as a prize or a reward",
            example: "The judges awarded our dog Morgan the first prize for how well he obeyed commands." }
        ],
        synonyms: ["prize", "reward", "trophy"], antonyms: [],
        mnemonic: "An award is what you win for doing something well — like a shiny trophy."
      }),
      entry({
        word: "collapse", emoji: "🏚️", pron: "kuh-LAPS",
        senses: [
          { pos: "verb", def: "to fall down suddenly or to cave in",
            example: "My brothers and I built a tent from tree branches, but it collapsed when we all tried to crawl inside." },
          { pos: "verb", def: "to fold together",
            example: "These chairs collapse so they are easy to store in the closet." }
        ],
        synonyms: ["fall down", "cave in", "fold up"], antonyms: ["stand", "hold up"],
        mnemonic: "Collapse = it all comes crashing down — or folds flat like a beach chair."
      }),
      entry({
        word: "demolish", emoji: "🧨", pron: "dih-MOL-ish",
        senses: [{ pos: "verb", def: "to destroy or tear something down",
          example: "The hurricane demolished a dozen houses close to the beach." }],
        synonyms: ["destroy", "wreck", "knock down"], antonyms: ["build", "make"],
        mnemonic: "Demolish means smash it to bits — like a wrecking ball on a building."
      }),
      entry({
        word: "excess", emoji: "🧳", pron: "EK-ses",
        senses: [
          { pos: "adj", def: "more than is needed or allowed",
            example: "Dad had to pay extra for his plane ticket because he had excess baggage." },
          { pos: "noun", def: "an amount that is too much or more than is needed",
            example: "Charlotte quickly licked the excess from the edge of the jelly sandwich." }
        ],
        synonyms: ["extra", "too much", "leftover"], antonyms: ["too little", "not enough"],
        mnemonic: "Excess is EXTRA — more than you need, spilling over the edge."
      }),
      entry({
        word: "outline", emoji: "✏️", pron: "OWT-lyne",
        senses: [
          { pos: "noun", def: "a line showing the outside edge of an object or figure",
            example: "Gary drew an outline of Asia, and then he filled in the different countries." },
          { pos: "noun", def: "a short list or plan that gives the main ideas of a longer report",
            example: "Our outline will show you what we want to do for our report on turtles." }
        ],
        synonyms: ["edge", "shape", "plan"], antonyms: [],
        mnemonic: "An outline is the OUTside LINE of a shape — or a quick plan of your ideas."
      }),
      entry({
        word: "sculpture", emoji: "🗿", pron: "SKULP-chur",
        senses: [{ pos: "noun", def: "a work of art made by shaping wood, stone, or other material into a certain form",
          example: "The sculpture of the knight on a horse stood near the entrance to the museum." }],
        synonyms: ["statue", "carving"], antonyms: [],
        mnemonic: "A sculpture is art you can walk around — a statue carved into a shape."
      }),
      entry({
        word: "spade", emoji: "⛏️", pron: "SPAYD",
        senses: [{ pos: "noun", def: "a tool for digging, with a long handle fastened to a flat metal blade",
          example: "Using a spade, Omar helped his mom dig holes to plant seeds in the garden." }],
        synonyms: ["shovel", "digger"], antonyms: [],
        mnemonic: "A spade is a digging tool — grab it when it's time to dig in the garden."
      }),
      entry({
        word: "utensil", emoji: "🍴", pron: "yoo-TEN-sul",
        senses: [{ pos: "noun", def: "a tool or container that is used for a special purpose",
          example: "Esperanza put the can opener in a drawer with the other kitchen utensils." }],
        synonyms: ["tool", "gadget"], antonyms: [],
        mnemonic: "Forks, spoons, and can openers are utensils — little tools with a job to do."
      })
    ]
  };

  // Registry of lessons. Only lessons with a `words` array are "available" / playable.
  // Keys are unique lesson IDs (Book 4 uses the plain number; other books are prefixed,
  // e.g. "b2-10") so two books can both have a "Lesson 10" without colliding.
  var LESSONS = {
    "5": LESSON5, "6": LESSON6, "8": LESSON8, "9": LESSON9, "10": LESSON10,
    "11": LESSON11, "12": LESSON12, "13": LESSON13, "14": LESSON14, "15": LESSON15,
    "16": LESSON16, "17": LESSON17, "18": LESSON18, "19": LESSON19, "20": LESSON20,
    "b2-10": BOOK2_L10, "b2-12": BOOK2_L12
  };
  // which kid each book belongs to (used to label the lesson pickers)
  var BOOK_LABELS = { 2: "Liana", 4: "Leo" };
  // enrich every lesson with a stable id (= registry key), a book (default 4 = Leo),
  // and ready-made display strings for the pickers.
  Object.keys(LESSONS).forEach(function (k) {
    var L = LESSONS[k];
    L.id = k;
    if (!L.book) L.book = 4;
    L.bookName = BOOK_LABELS[L.book] || "";
    L.label = "Book " + L.book + (L.bookName ? " (" + L.bookName + ")" : "") + " · " + L.title;
    L.tag = "B" + L.book + " L" + L.lesson;
  });

  function flat() {
    var out = [], seen = {};
    Object.keys(LESSONS).forEach(function (k) {
      (LESSONS[k].words || []).forEach(function (w) { if (!seen[w.word]) { seen[w.word] = k; out.push(w); } });
    });
    return out;
  }

  var Content = {
    LESSONS: LESSONS,
    BOOK_LABELS: BOOK_LABELS,
    getLesson: function (n) { return LESSONS[String(n)]; },
    listLessons: function () { return Object.keys(LESSONS).map(function (k) { return LESSONS[k]; }); },
    availableLessons: function () {
      return Object.keys(LESSONS).map(function (k) { return LESSONS[k]; })
        .filter(function (L) { return L.words && L.words.length; })
        .sort(function (a, b) { return (a.book - b.book) || (a.lesson - b.lesson); });
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
