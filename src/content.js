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

  // Registry of lessons. Only lessons with a `words` array are "available" / playable.
  // To add a lesson: define it like LESSON5/LESSON6 and add it here.
  var LESSONS = { "5": LESSON5, "6": LESSON6, "8": LESSON8, "9": LESSON9, "10": LESSON10, "11": LESSON11 };

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
