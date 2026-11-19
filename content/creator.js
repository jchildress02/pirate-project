/* Character creator data (§12, §14.2-§14.3, §25.2-§25.4).
 *
 * Everything the creator offers lives here; js/creator.js holds the rules.
 * Effects on checks are in content/modifiers.js, keyed by the same names.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  // ---- Portraits (ruled November 8 and 13, 2026) ----------------------
  // Eight sets, each young / mid / old with an eyepatch twin. The captain
  // picks one in his age band; the mentor picks an old portrait from a set
  // the captain didn't take. Gender follows the set.
  var PORTRAIT_SETS = [
    { id: "flinty", name: "Flinty Beard", gender: "m" },
    { id: "dewey", name: "Dewey Test", gender: "m" },
    { id: "rat_bastard", name: "Rat Bastard", gender: "m" },
    { id: "hugh", name: "Hugh Mungus", gender: "m" },
    { id: "gallant", name: "Gallant Le Fleur", gender: "m" },
    { id: "skully", name: "Skully Bones", gender: "m" },
    { id: "anne", name: "Anne Reed", gender: "f" },
    { id: "mary", name: "Mary Bonny", gender: "f" },
  ];

  // Age bands (§12.3). The portrait band uses the same breaks.
  var AGE_BANDS = [
    { band: "young", min: 15, max: 25, tags: 1, debuffs: 0 },
    { band: "mid", min: 26, max: 35, tags: 2, debuffs: 1 },
    { band: "old", min: 36, max: 40, tags: 3, debuffs: 2 },
  ];

  // ---- Origin: Ash-Born (§12.5) ----------------------------------------
  // Card text as written in the Creator chat; no card says "rung" (§38.6).
  var ORIGINS = [
    { id: "Ash-Born", text: "You survived Captain Deadman's raids. Which city burned around you?" },
    { id: "Noble", locked: "After the Slice" },
    { id: "Foreigner", locked: "After the Slice" },
  ];

  var HOME_CITIES = [
    { id: "Baltimore", burned: "Burned September 1752.", effect: "You got out with more than most: +500 gold to start.", gold: 500 },
    { id: "Savannah", burned: "Burned June 1753.", effect: "Savannah's tavern keeper is an old friend: more rumors and better service there.", friend: { id: "savannah_tavern_keeper", role: "tavern keeper", node: "Savannah" } },
    { id: "Charleston", burned: "Burned June 1753.", effect: "A Charleston merchant is an old friend: better prices when you trade there.", friend: { id: "charleston_merchant", role: "merchant", node: "Charleston" } },
  ];

  // Each card shows only the name and its two free-point skills (§12.5).
  var PROFESSIONS = [
    { id: "Official", free: ["Petition", "Forge"] },
    { id: "Merchant", free: ["Haggle", "Appraise"] },
    { id: "Farmer", free: ["Endure", "Go Without"] },
    { id: "Artisan", free: ["Repair & Refit", "Appraise"] },
    { id: "Sailor", free: ["Navigate", "Ride Out Storm"] },
    { id: "Soldier", free: ["Hold Your Ground", "Marksmanship"] },
    { id: "Smuggler", free: ["Smuggle", "Ship Concealment"] },
    { id: "Thief", free: ["Light Fingers", "Chase & Climb"] },
    { id: "Aristocrat", free: ["Court", "Swordsmanship"] },
  ];

  // What the fire took (§12.5). Variant D (Lost Honor) is scrapped.
  var LOSSES = [
    { id: "A", name: "Lost Family", tag: "Grief-Stricken", penalty: "−1 Rally Crew, Tavern Talk", text: "Your brother, a skilled craftsman, was pressganged aboard one of Captain Deadman's stragglers." },
    { id: "B", name: "Lost Wealth", tag: "Dispossessed", penalty: "−1 Haggle, Bribe", text: "Deadman's men plundered a chest of your family's heirloom jewels and coin." },
    { id: "C", name: "Lost Health", tag: "Deep Scar", penalty: "−1 Hold Your Ground and Strike First under fire", text: "You were shot at close range and left for dead in the street." },
  ];

  // ---- Old ailments (debuffs, §12.4) ------------------------------------
  var DEBUFFS = [
    { id: "Bad Knee", text: "−2 Chase & Climb, −1 Board, until cured", life: "Curable" },
    { id: "Old Wound", text: "−2 Endure, −1 Swordsmanship, until cured", life: "Curable" },
    { id: "Failing Eyes", text: "−1 Keep Watch, Appraise", life: "For life" },
    { id: "Weak Chest", text: "−2 Endure, −1 Dive and any check in the cold, until cured", life: "Curable" },
    { id: "Bad Back", text: "−2 Hold Your Ground, −1 Brawling, until cured", life: "Curable" },
    { id: "Rheumy Hands", text: "−1 Light Fingers, Repair & Refit", life: "For life" },
    { id: "Hard of Hearing", text: "−1 Notice Danger, and Leadership under fire or in a storm", life: "For life" },
    { id: "Marsh Fever", text: "Fever flares hit you more often and last two seasons", life: "For life" },
  ];

  // ---- Creation-menu tags (§14.2): 29 ----------------------------------
  // excludes: names of tags, debuffs, traits or flaws that can't be taken
  // with it. greyed: shown but not pickable in the prototype.
  var GREYED = "Its story isn't written yet.";
  var TAG_GROUPS = [
    { group: "Knowledge and craft", tags: [
      { id: "Dead Reckoner", text: "Reroll Navigate in fog or open water. Dead-reckoning approaches and hidden routes." },
      { id: "Storm-Born", text: "Reroll Ride Out Storm. Hurricane-only options." },
      { id: "Explorer", text: "Reroll Wilderness Survival, and Navigate when charting unknown waters. Unmarked landings and hidden coves." },
      { id: "Surgeon's Hands", text: "Reroll Treat Wounds. You can treat yourself." },
      { id: "Healer", text: "Medical costs −15%. “Tend the sick” scenes." },
      { id: "Gunner's Eye", text: "+1 Gunnery on the opening broadside of every battle. Called shots at her rigging or rudder." },
      { id: "Sharpshooter", text: "Reroll Marksmanship. Long shots and the boarding shot." },
      { id: "Eagle Eyed", text: "Reroll Keep Watch. An extra hook on the destination screen.", excludes: ["Failing Eyes"] },
      { id: "Calligrapher", text: "Reroll Forge. Forged letters and commissions." },
      { id: "Cutpurse", text: "Reroll Light Fingers and Chase & Climb. Pickpocketing, burglary, and slipping away on foot." },
      { id: "Hauler", text: "Keep the whole haul when you black out on a dive. Reroll Endure when hauling.", excludes: ["Bad Back"] },
      { id: "Investigator", text: "Reroll Gather Intelligence. Hidden clue branches." },
      { id: "Treasure Hunter", text: "Reroll Decipher & Research and Dive on treasure hunts." },
      { id: "Loremaster", text: "Special dialogue options and checks that succeed outright.", greyed: true },
      { id: "Dead Man's Luck", text: "Reroll Endure while Wounded, the mortal-wound check included." },
    ] },
    { group: "Social and political", tags: [
      { id: "Silver Tongue", text: "Reroll Persuade and Negotiate. Talk your way out." },
      { id: "Smuggler's Friend", text: "Reroll Smuggle. Hidden drops and contacts." },
      { id: "Flatterer", text: "Reroll Court. Flatter vain NPCs." },
      { id: "Gossipy", text: "Reroll Tavern Talk; −1 on checks kept secret. An extra rumor per port." },
      { id: "Revolutionary", text: "−1 Petition and Negotiate with Avalon officials. Unique scenes in Charleston, Ocracoke, Edenton.", greyed: true },
      { id: "Animal Friend", text: "Pet prices −15%. Unique scenes in Ocracoke, Nassau, St. Augustine.", greyed: true },
    ] },
    { group: "Violence", tags: [
      { id: "Brute", text: "+1 Intimidate; −1 Persuade." },
    ] },
    { group: "Spiritual and uncanny", tags: [
      { id: "Touched", text: "Reroll Ghost Sense; Dread floor +5. Hidden uncanny scenes." },
      { id: "Haunted", text: "−1 Persuade. Hidden uncanny scenes on the Lilyhook thread.", greyed: true },
      { id: "Heathen", text: "−1 Persuade and Petition with the pious. Scenes with outcasts and natives.", excludes: ["Pious"], greyed: true },
    ] },
    { group: "Crew and provisions", tags: [
      { id: "Drunkard", text: "One reroll a season across Cast-Iron Stomach, Cards & Dice, Tavern Talk; −1 Court with romances who aren't tolerant.", excludes: ["Heavy Drinker"] },
      { id: "Gourmand", text: "Reroll Rally Crew in Winter; −1 Go Without." },
      { id: "Fisherman", text: "Provisions burn −10%. Fish the banks when stores run low." },
      { id: "Fiddler", text: "Crew morale floor +10; reroll Rally Crew in Winter." },
    ] },
  ];

  // ---- Traits and flaws (§12.7, §11.8.3-§11.8.4) -----------------------
  var TRAIT_GROUPS = [
    { group: "Mind", traits: [
      { id: "Shrewd", text: "+1 Read People, Appraise, Negotiate" },
      { id: "Patient", text: "+1 Plan & Ambush, Decipher & Research" },
      { id: "Bookish", text: "+1 Decipher & Research, Forge, Navigate" },
      { id: "Inventive", text: "+1 Repair & Refit" },
      { id: "Wary", text: "+1 Notice Danger, Read People" },
    ] },
    { group: "Nerve", traits: [
      { id: "Bold", text: "+1 Board, Strike First; −1 on the mortal-wound check" },
      { id: "Cool-Headed", text: "+1 Hold Your Ground, Ride Out Storm" },
      { id: "Hardtack Gut", text: "+1 Go Without, Immune System" },
      { id: "Stubborn", text: "+1 Resist Interrogation, Hold Your Ground" },
      { id: "Fearless", text: "+1 Ghost Sense, Gambit" },
    ] },
    { group: "Social", traits: [
      { id: "Easy Laugh", text: "+1 Tavern Talk; +1 Persuade with strangers" },
      { id: "Honest Face", text: "+1 Persuade, Bluff & Disguise" },
      { id: "Hard Bargainer", text: "+1 Haggle, Appraise" },
      { id: "Generous", text: "+1 Pirate Code, Recruit" },
      { id: "Storyteller", text: "+1 Rally Crew, Tavern Talk" },
      { id: "Stern", text: "+1 Discipline, Intimidate" },
      { id: "Compassionate", text: "+1 Rescue & Breakout, Parley, Treat Wounds" },
    ] },
    { group: "Sea and code", traits: [
      { id: "Weatherwise", text: "+1 Read Weather, Ride Out Storm" },
      { id: "Steady Hand", text: "+1 Marksmanship, Treat Wounds" },
      { id: "Idealist", text: "+1 Rally Crew; +1 Persuade with the upstanding" },
      { id: "Pragmatist", text: "+1 Pirate Code, Bribe" },
      { id: "Loyal", text: "+1 Rescue & Breakout; +1 Leadership with two officers at Friend aboard" },
      { id: "Vengeful", text: "+1 Combat and Gather Intelligence against the French and those who wronged you" },
    ] },
    { group: "Manner and faith", traits: [
      { id: "Refined", text: "+1 Petition, Court; +1 Negotiate with officials", excludes: ["Wild"] },
      { id: "Wild", text: "+1 Brawling, Tavern Talk", excludes: ["Refined"] },
      { id: "Pious", text: "+1 Ghost Sense, Endure; +1 Persuade with the pious", excludes: ["Heathen"] },
    ] },
  ];

  var FLAWS = [
    { id: "Hot-Tempered", text: "−1 Negotiate, Parley, Petition. Lash out when insulted." },
    { id: "Greedy", text: "−1 Pirate Code, Rally Crew. Skim the take." },
    { id: "Proud", text: "−1 Petition, Bribe, Persuade with officials. Refuse help." },
    { id: "Soft-Hearted", text: "−1 Intimidate, Discipline. Spare prisoners." },
    { id: "Reckless", text: "−1 Plan & Ambush, Notice Danger. The gamble is always on offer." },
    { id: "Heavy Drinker", text: "−1 Notice Danger, Read People in harbor. One more round.", excludes: ["Drunkard"] },
    { id: "Distrustful", text: "−1 Leadership, Recruit. Refuse officer help." },
    { id: "Gambler", text: "−1 Appraise, Ration Stores. Stake coin at the dice." },
    { id: "Grudge-Holder", text: "−1 Negotiate; −1 Parley with the French and those who wronged you. Refuse peace." },
    { id: "Superstitious", text: "−1 Ghost Sense, Read Weather, Rally Crew in uncanny moments. Heed omens." },
    { id: "Glory-Hungry", text: "−1 Plan & Ambush, Ship Concealment. Choose the glorious option." },
    { id: "Easily Flattered", text: "−1 Read People, Negotiate with strangers. Accept the flattering offer." },
  ];

  // ---- Officers, for the mentor mini-creator (§25.2-§25.4, §25.8) -------
  var OFFICER_TYPES = [
    { id: "Gunner", perk: "+1 Gunnery", lessons: "the Exchange; Marksmanship" },
    { id: "Raider", perk: "+1 to boarding clashes", lessons: "boarding clashes; Lead the Charge" },
    { id: "Cook", perk: "Ship's surgeon: Treat Wounds after battle; crew recovery 45%", lessons: "Treat Wounds; Immune System" },
    { id: "Cooper", perk: "Provisions burn -15%", lessons: "Ration Stores; Go Without; Haggle" },
    { id: "Navigator", perk: "+1 Position and +1 Outrun", lessons: "Position; Outrun; Navigate" },
    { id: "Carpenter", perk: "+1 Repair & Refit after battle; better repairs", lessons: "Repair & Refit" },
  ];

  // Old Lessons: the check types the mentor's reroll covers (§25.8). The
  // Exchange, Position, boarding clashes and Lead the Charge are ship and
  // battle rolls that don't exist yet; Position is rolled as Maneuver.
  var MENTOR_LESSONS = {
    Gunner: ["Marksmanship"],
    Raider: [],
    Cook: ["Treat Wounds", "Immune System"],
    Cooper: ["Ration Stores", "Go Without", "Haggle"],
    Navigator: ["Maneuver", "Outrun", "Navigate"],
    Carpenter: ["Repair & Refit"],
  };

  var OFFICER_TRAITS = [
    { id: "Jovial", warmth: "warm", hook: "Opening crew stores +5 morale", likes: "Revelry", dislikes: "Cruelty" },
    { id: "Kindly", warmth: "warm", hook: "Morale lost to crew deaths halved", likes: "Mercy", dislikes: "Cruelty" },
    { id: "Yarn-Spinner", warmth: "warm", hook: "+3 morale each season's end", likes: "Glory", dislikes: "Order" },
    { id: "Shanty-Singer", warmth: "warm", hook: "Morale floor +5", likes: "Revelry", dislikes: "Order" },
    { id: "Eager", warmth: "warm", hook: "None", likes: "Honor", dislikes: "Deceit" },
    { id: "Prankster", warmth: "warm", hook: "Rally Crew +1", likes: "Revelry", dislikes: "Order" },
    { id: "Sot", warmth: "warm", hook: "Lodging +5 morale; -1 on the voyage watch", likes: "Revelry", dislikes: "Caution" },
    { id: "Gossip", warmth: "warm", hook: "Read People +1 in Pressure events", likes: "Revelry", dislikes: "Caution" },
    { id: "Daredevil", warmth: "warm", hook: "A prize taken +5 morale", likes: "Risk", dislikes: "Caution" },
    { id: "Old Salt", warmth: "neutral", hook: "Crew checks in storms +1", likes: "Caution", dislikes: "Risk" },
    { id: "Devout", warmth: "neutral", hook: "Morale lost to uncanny events halved", likes: "Faith", dislikes: "Revelry" },
    { id: "By-the-Book", warmth: "neutral", hook: "Counts as Stern for crew Discipline", likes: "Order", dislikes: "Revelry" },
    { id: "Penny-Pincher", warmth: "neutral", hook: "Provisions burn -10%", likes: "Plunder", dislikes: "Generosity" },
    { id: "Ambitious", warmth: "neutral", hook: "None; sulks when passed over", likes: "Glory", dislikes: "Retreat" },
    { id: "Proud", warmth: "neutral", hook: "None; Retreat costs double", likes: "Glory", dislikes: "Retreat" },
    { id: "Superstitious", warmth: "neutral", hook: "Notice Danger +1 on uncanny events", likes: "Faith", dislikes: "Uncanny" },
    { id: "Godless", warmth: "neutral", hook: "None", likes: "Defiance", dislikes: "Faith" },
    { id: "Paranoid", warmth: "cold", hook: "Voyage watch +1", likes: "Caution", dislikes: "Deceit" },
    { id: "Secretive", warmth: "cold", hook: "None; a hidden past", likes: "Caution", dislikes: "Glory" },
    { id: "Frightening", warmth: "cold", hook: "Make an Example +1", likes: "Cruelty", dislikes: "Mercy" },
    { id: "Bloodthirsty", warmth: "cold", hook: "Dread floor +5", likes: "Cruelty", dislikes: "Mercy" },
    { id: "Schemer", warmth: "cold", hook: "At Wary or below, +1 Pressure a season", likes: "Deceit", dislikes: "Honor" },
    { id: "Lonesome", warmth: "cold", hook: "None", likes: "Caution", dislikes: "Revelry" },
    { id: "Grudge-Keeper", warmth: "cold", hook: "None; his feuds end only by an event", likes: "Defiance", dislikes: "Retreat" },
  ];

  // Friction pairs (§25.6): a voice and secondary trait never form one.
  var FRICTION = [
    ["Kindly", "Bloodthirsty"], ["Kindly", "Frightening"], ["Devout", "Godless"], ["Superstitious", "Godless"],
    ["By-the-Book", "Prankster"], ["By-the-Book", "Sot"], ["Paranoid", "Gossip"], ["Paranoid", "Schemer"],
    ["Gossip", "Secretive"], ["Eager", "Schemer"], ["Old Salt", "Daredevil"], ["Penny-Pincher", "Sot"],
    ["Proud", "Prankster"], ["Lonesome", "Yarn-Spinner"], ["Ambitious", "Ambitious"], ["Ambitious", "Proud"],
  ];

  // Drives and fears, randomized for the mentor (§25.4).
  var DRIVES = ["Wealth", "Security", "Status", "Power", "Freedom", "Revenge", "Kin & Love", "Faith", "Knowledge", "Glory", "Order", "Pleasure"];
  var FEARS = ["Poverty", "Violence & Death", "Disgrace", "Betrayal", "Loss", "Captivity", "The Uncanny", "Exposure", "Obscurity"];

  // ---- Starting package (§12.5, §12.12, §21.7) --------------------------
  var START = {
    crewGold: 600,
    purse: 0,
    provisions: 10,
    ship: { type: "Sloop", hull: 14, hullMax: 20, guns: 6, gunsMax: 10, speed: 2, speedMax: 3, rigging: "frayed", draft: "shallow", cargo: 50 },
    crew: { count: 12, tier: "Green", morale: 50, pressure: 0 },
    items: ["Simple Flintlock Pistol", "Buccaneer's Cutlass"],
    lossQuestEnds: { year: 1755, season: "Spring" },
    statPoints: 3, statBase: 1, statCap: 2,
    trainingPoints: 6, trainingCap: 2,
    traitCount: 2, flawCount: 1,
    nameMax: 24, shipNameMax: 30,
    startKit: "a flintlock pistol and a cutlass",
  };

  PC.data.creator = {
    PORTRAIT_SETS: PORTRAIT_SETS,
    ORIGINS: ORIGINS,
    GREYED: GREYED,
    AGE_BANDS: AGE_BANDS,
    HOME_CITIES: HOME_CITIES,
    PROFESSIONS: PROFESSIONS,
    LOSSES: LOSSES,
    DEBUFFS: DEBUFFS,
    TAG_GROUPS: TAG_GROUPS,
    TRAIT_GROUPS: TRAIT_GROUPS,
    FLAWS: FLAWS,
    OFFICER_TYPES: OFFICER_TYPES,
    MENTOR_LESSONS: MENTOR_LESSONS,
    OFFICER_TRAITS: OFFICER_TRAITS,
    FRICTION: FRICTION,
    DRIVES: DRIVES,
    FEARS: FEARS,
    START: START,
  };
})();
