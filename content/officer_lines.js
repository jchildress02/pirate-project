/* Officer lines for recruitment and dismissal (S25 appendix, the author's
 * language), and the captain's leaning (§25.5).
 *
 * Hints are written about the officer ("he"); the engine swaps the pronouns
 * for a woman officer. The Kindly intro's "his crew" is the captain's, so it
 * carries a captain token.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.officerLines = {
    // §25.7: "[Name] looks up as you reach his table," + the hint + the intro.
    stem: "[Name] looks up as you reach his table",
    intros: {
      "Jovial": "“It’s a pleasure to meet you, Captain. Never hurts to make new friends!”",
      "Kindly": "“I’m looking for a captain who takes care of {captain.his} crew, and offers help to those who need it.”",
      "Yarn-Spinner": "“Just got back from a trip ‘round the Horn. They've got riches there like you wouldn't believe, if you don't mind all the sea serpents. I myself killed at least ten of them.”",
      "Shanty-Singer": "“You look like a fellow who enjoys a good song, so here’s one for you. *clears throat* O there once was a cap’n, walked into the tavern, looking for hired hands. Drank a stiff drink, now he cannot think, and he's leaving the tavern a man!”",
      "Eager": "“Looking for a captain that lets me prove myself. I’m ready for anything that comes my way!”",
      "Prankster": "*grinning* “Pull my finger. Aw, don't look at me like that.”",
      "Sot": "“I’ve spent all my earnings on drink and find myself in a bit of a bind. If you've got rum, I’m *hic* your man.”",
      "Gossip": "“I heard the tavern keeper is carrying on with the seamstress down the street. Who I heard it from doesn't matter. I also heard you were looking for hired hands?”",
      "Daredevil": "“You look like a brave captain. Do you have need of an even braver hand?”",
      "Old Salt": "“The sea’s me only love, and she's a devilish one to take for a wife. All this time wastin’ on land is makin’ me miss her cold embrace.”",
      "Devout": "“God has instructed me to sail the seas. Who am I to refuse His command?”",
      "By-the-Book": "“These crews lack discipline. I'll keep ‘em in tip-top shape.”",
      "Penny-Pincher": "“I’ll join your crew as long as the share is good. I ain't paying a penny from my own pocket, so I hope you're well-provisioned.”",
      "Ambitious": "“I want my name to echo through the histories. Is yours the ship where I make my mark?”",
      "Proud": "“A man of my refinement will only accept the finest of captains, and the finest of ships. Does that describe you?”",
      "Superstitious": "“It’s bad luck to have a black cat on board, but even worse to have no cat at all. But I’m in no position to be choosy, I need the coin.”",
      "Godless": "“There's nobody watching over us all. It’s just us, and the sea. We have to take care of ourselves, don't you think?”",
      "Paranoid": "“Did you just walk in here, or have you been following me?”",
      "Secretive": "“I'll be the best hand you ever hired, as long as you don't ask too many questions. A man’s thoughts are his own.”",
      "Frightening": "“The seas hold many terrors, including me. Let's strike fear into the hearts of our enemies.”",
      "Bloodthirsty": "“I’ll do the dirty work for you. Just let me sharpen my knives first.”",
      "Schemer": "“I’ve got a plan to make us rich. You've just got to trust me.”",
      "Lonesome": "“All I need is a hammock and a fair share. I’ll keep quiet and do my work. You'll hardly know I'm aboard.”",
      "Grudge-Keeper": "“I’m loyal to those who earn it, but if you cross me, I won't forget it.”",
    },
    hints: {
      "Jovial": "and he has a bright smile across his face.",
      "Kindly": "and he has kind, gentle eyes.",
      "Yarn-Spinner": "and he talks loudly, like he wants everyone to hear.",
      "Shanty-Singer": "and he’s humming a soft tune to himself.",
      "Eager": "and he’s brimming with energy.",
      "Prankster": "and a sly smirk is fixed on his face.",
      "Sot": "and his cheeks are red as a beet.",
      "Gossip": "and he leans in close, as if to tell you a secret.",
      "Daredevil": "and his eyes blaze with confidence. Or is it arrogance?",
      "Old Salt": "and he puffs forlornly on a sea-worn pipe.",
      "Devout": "and a worn wooden crucifix hangs around his neck.",
      "By-the-Book": "and he stands upright and at attention.",
      "Penny-Pincher": "and he keeps touching his coin purse, checking to make sure it’s still there.",
      "Ambitious": "and his coat is a good deal finer than his boots.",
      "Proud": "and he wears a haughty expression with his nose turned up.",
      "Superstitious": "and he has a lucky rabbit’s foot hanging from his belt.",
      "Godless": "and he’s lighting his pipe with a page torn from a prayer book.",
      "Paranoid": "and his eyes dart around nervously.",
      "Secretive": "and he keeps one hand flat over a letter on the table, though nobody’s near.",
      "Frightening": "and he’s tall and fearsome, with a thick beard and cold eyes.",
      "Bloodthirsty": "and there’s dried blood under his fingernails.",
      "Schemer": "and he seems like he already knows who you are.",
      "Lonesome": "and he’s been sitting alone since you arrived.",
      "Grudge-Keeper": "and he’s cut a long row of notches into the edge of the table.",
    },
    dismissal: {
      "Jovial": "“But…I thought we were having fun?”",
      "Kindly": "“You’re a good man, Captain. I don’t take it personally.”",
      "Yarn-Spinner": "“My tale does not end here, I can assure you of that!”",
      "Shanty-Singer": "“A song of sorrow it is, then.”",
      "Eager": "“I just wanted to help…”",
      "Prankster": "“Was this because of the joke I made? Always putting my foot in my mouth…”",
      "Sot": "“Off to the tavern, then. Farewell.”",
      "Gossip": "“Oh, you’ll regret this. I’ll tell everyone what you’re really like.”",
      "Daredevil": "“You’re letting go of the bravest member of your crew? Big mistake.”",
      "Old Salt": "“But the sea is my home…”",
      "Devout": "“If it’s the Lord’s will, I’ll go. But then I’ll pray for the Lord to smite you.”",
      "By-the-Book": "“Your crew will lack discipline without me.”",
      "Penny-Pincher": "“I’ll go, as long as you pay me.”",
      "Ambitious": "“Guess I’ll have to make my name elsewhere, then.”",
      "Proud": "“How dare you! Ignorant whelp. I’ll make you regret this.”",
      "Superstitious": "“There’s a shadow hanging over your ship…”",
      "Godless": "“There’s nothing for me here…”",
      "Paranoid": "“You’ll have to watch your back now, since I won’t be doing it for you.”",
      "Secretive": "“There’s something important you need to know, but now you never will.”",
      "Frightening": "“You’ll be sorry you crossed me.”",
      "Bloodthirsty": "“The townsfolk will be sorry you left me here…”",
      "Schemer": "“All according to plan…”",
      "Lonesome": "“All by myself, again…”",
      "Grudge-Keeper": "“One day I’ll make you regret this.”",
    },
    // The mentor's fixed-voice milestone (§25.8; S25 appendix, Scenes and beats).
    mentorFirstHire: "“Either a good choice or a bad one. Only one way to find out.”",
    // The first Articles signing (S25 appendix, mentor milestones; §40.5).
    mentorFirstArticles: "“Well done, Captain. Remember, those Articles are binding. Breaking them is a serious betrayal of the crew.”",
  };

  // §25.5 The captain's leaning: each trait or flaw leans toward one tag.
  PC.data.officerLeaning = {
    "Compassionate": "Mercy", "Generous": "Generosity", "Bold": "Risk", "Patient": "Caution", "Wary": "Caution",
    "Stern": "Order", "Honest Face": "Honor", "Wild": "Revelry", "Easy Laugh": "Revelry", "Pious": "Faith",
    "Vengeful": "Cruelty",
    "Soft-Hearted": "Mercy", "Reckless": "Risk", "Hot-Tempered": "Cruelty", "Greedy": "Plunder",
    "Glory-Hungry": "Glory", "Heavy Drinker": "Revelry", "Gambler": "Revelry", "Superstitious": "Faith",
  };

  // §25.4 Drives and fears as likes and dislikes.
  PC.data.driveLikes = { "Wealth": "Plunder", "Security": "Caution", "Status": "Glory", "Power": "Cruelty", "Freedom": "Defiance",
    "Revenge": "Cruelty", "Kin & Love": "Mercy", "Faith": "Faith", "Knowledge": "Uncanny", "Glory": "Glory", "Order": "Order", "Pleasure": "Revelry" };
  PC.data.fearDislikes = { "Poverty": "Generosity", "Violence & Death": "Risk", "Disgrace": "Retreat", "Betrayal": "Deceit", "Loss": "Risk",
    "Captivity": "Risk", "The Uncanny": "Uncanny", "Exposure": "Glory", "Obscurity": "Caution" };

  // Davey Dell, the Named Raider (S17 appendix §5).
  PC.data.namedOfficers = {
    davey: {
      id: "davey", first: "Davey", last: "Dell", gender: "m", age: 25, named: true,
      type: "Raider", typeIfMentorRaider: "Gunner", level: 1,
      voice: "Oddball", warmth: "warm", likes: ["Generosity"], dislikes: ["Cruelty"],
      secondary: "Eager", third: "Jovial", unique: "Oddball",
      drive: "Pleasure", fear: "The Uncanny", startRung: "Friendly",
      hiringIntro: "Davey sits by himself in the corner, peeling paint chips off the wall. His face brightens as he notices you walk up. \"Oh, it's you again! Want me to join your crew?\"",
      dismissal: "\"Oh... okay. The monkeys will keep me company.\"",
    },
  };
})();
