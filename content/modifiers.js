/* Captain modifiers: traits, flaws, tags and items that change checks.
 *
 * Each entry:
 *   name:   shown in the check breakdown
 *   edge:   [{ type: "Persuade", value: -1 }], [{ stat: "Charm", value: 1 }],
 *           [{ group: "Combat", value: 1 }] (a §11.6 group) or [{ any: true, value: -1 }]
 *           optional `when: { condition: "Harbor" }` or `when: { anyOf: ["Fog", "Open Water"] }`
 *           (the season counts as a condition: "Winter"),
 *           optional `outsideCap: true` (a gun's bonus sits outside the ±3 cap, §32.10)
 *   reroll: { types: ["Marksmanship"], perSeason: 1, when?: {...} }  (on a setback or partial)
 *   note:   what the entry does that the engine doesn't model yet (economy,
 *           Gunnery, Dread floors, unlocks). Shown nowhere; for the record.
 *
 * Sources: traits §11.8.3, flaws §11.8.4, creation tags §14.2, loss tags
 * §14.3, debuffs §12.4, earned tags §14.4-§14.5 (only those the prototype can
 * reach so far).
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  var M = {};
  function plus(types, value, when) {
    return types.map(function (t) { var e = { type: t, value: value }; if (when) e.when = when; return e; });
  }
  function reroll(types, when) { var r = { types: types, perSeason: 1 }; if (when) r.when = when; return r; }
  function add(name, def) { def.name = name; M[name] = def; }

  // ---- Traits (+1, §11.8.3; rebalanced in the Creator chat, November 16) ----
  add("Shrewd", { edge: plus(["Read People", "Appraise", "Negotiate"], 1) });
  add("Patient", { edge: plus(["Plan & Ambush", "Decipher & Research"], 1) });
  add("Bookish", { edge: plus(["Decipher & Research", "Forge", "Navigate"], 1) });
  add("Inventive", { edge: plus(["Repair & Refit"], 1) });
  add("Wary", { edge: plus(["Notice Danger", "Read People"], 1) });
  add("Bold", { edge: plus(["Board", "Strike First"], 1), note: "-1 on the mortal-wound check (§11.9); that check isn't built yet." });
  add("Cool-Headed", { edge: plus(["Hold Your Ground", "Ride Out Storm"], 1) });
  add("Hardtack Gut", { edge: plus(["Go Without", "Immune System"], 1) });
  add("Stubborn", { edge: plus(["Resist Interrogation", "Hold Your Ground"], 1) });
  add("Fearless", { edge: plus(["Ghost Sense", "Gambit"], 1) });
  add("Easy Laugh", { edge: plus(["Tavern Talk"], 1).concat(plus(["Persuade"], 1, { condition: "Stranger" })) });
  add("Honest Face", { edge: plus(["Persuade", "Bluff & Disguise"], 1) });
  add("Hard Bargainer", { edge: plus(["Haggle", "Appraise"], 1) });
  add("Generous", { edge: plus(["Pirate Code", "Recruit"], 1) });
  add("Storyteller", { edge: plus(["Rally Crew", "Tavern Talk"], 1) });
  add("Stern", { edge: plus(["Discipline", "Intimidate"], 1), note: "Also a captain input to crew Discipline (§24.4)." });
  add("Compassionate", { edge: plus(["Rescue & Breakout", "Parley", "Treat Wounds"], 1) });
  add("Weatherwise", { edge: plus(["Read Weather", "Ride Out Storm"], 1) });
  add("Steady Hand", { edge: plus(["Marksmanship", "Treat Wounds"], 1) });
  add("Idealist", { edge: plus(["Rally Crew"], 1).concat(plus(["Persuade"], 1, { condition: "Upstanding NPC" })) });
  add("Pragmatist", { edge: plus(["Pirate Code", "Bribe"], 1) });
  add("Loyal", { edge: plus(["Rescue & Breakout"], 1).concat(plus(["Leadership"], 1, { condition: "Two Friends Aboard" })) });
  add("Vengeful", { edge: [{ group: "Combat", value: 1, when: { condition: "Grudge" } }].concat(plus(["Gather Intelligence"], 1, { condition: "Grudge" })) });
  add("Refined", { edge: plus(["Petition", "Court"], 1).concat(plus(["Negotiate"], 1, { condition: "Official" })) });
  add("Wild", { edge: plus(["Brawling", "Tavern Talk"], 1) });
  add("Pious", { edge: plus(["Ghost Sense", "Endure"], 1).concat(plus(["Persuade"], 1, { condition: "Pious NPC" })) });

  // ---- Flaws (-1, §11.8.4) ----
  add("Hot-Tempered", { edge: plus(["Negotiate", "Parley", "Petition"], -1) });
  add("Greedy", { edge: plus(["Pirate Code", "Rally Crew"], -1) });
  add("Proud", { edge: plus(["Petition", "Bribe"], -1).concat(plus(["Persuade"], -1, { condition: "Official" })) });
  add("Soft-Hearted", { edge: plus(["Intimidate", "Discipline"], -1) });
  add("Reckless", { edge: plus(["Plan & Ambush", "Notice Danger"], -1) });
  add("Heavy Drinker", { edge: plus(["Notice Danger"], -1).concat(plus(["Read People"], -1, { condition: "Harbor" })) });
  add("Distrustful", { edge: plus(["Leadership", "Recruit"], -1) });
  add("Gambler", { edge: plus(["Appraise", "Ration Stores"], -1) });
  add("Grudge-Holder", { edge: plus(["Negotiate"], -1).concat(plus(["Parley"], -1, { condition: "Grudge" })) });
  add("Superstitious", { edge: plus(["Ghost Sense", "Read Weather"], -1).concat(plus(["Rally Crew"], -1, { condition: "Uncanny" })) });
  add("Glory-Hungry", { edge: plus(["Plan & Ambush", "Ship Concealment"], -1) });
  add("Easily Flattered", { edge: plus(["Read People"], -1).concat(plus(["Negotiate"], -1, { condition: "Stranger" })) });

  // ---- Creation-menu tags (§14.2; 29 after the Creator chat) ----
  add("Dead Reckoner", { reroll: reroll(["Navigate"], { anyOf: ["Fog", "Open Water"] }) });
  add("Storm-Born", { reroll: reroll(["Ride Out Storm"]) });
  add("Explorer", { reroll: { types: ["Wilderness Survival", "Navigate"], perSeason: 1, whenByType: { Navigate: { condition: "Charting" } } }, note: "Absorbs Cartographer; chart-selling is pinned (§13.2)." });
  add("Surgeon's Hands", { reroll: reroll(["Treat Wounds"]), note: "The captain can treat himself." });
  add("Healer", { note: "Medical costs -15% (§20.11)." });
  add("Gunner's Eye", { note: "+1 Gunnery on the first Exchange of every battle, and the called shot (§14.2): the Exchange arrives in Milestone 5." });
  add("Sharpshooter", { reroll: reroll(["Marksmanship"]) });
  add("Eagle Eyed", { reroll: reroll(["Keep Watch"]) });
  add("Calligrapher", { reroll: reroll(["Forge"]) });
  add("Cutpurse", { reroll: reroll(["Light Fingers", "Chase & Climb"]) });
  add("Hauler", { reroll: reroll(["Endure"]), note: "Keeps the whole haul on a dive blackout (js/salvage.js)." });
  add("Investigator", { reroll: reroll(["Gather Intelligence"]) });
  add("Treasure Hunter", { reroll: reroll(["Decipher & Research", "Dive"], { condition: "Treasure Hunt" }) });
  add("Loremaster", { note: "Unlocks options that succeed outright." });
  add("Dead Man's Luck", { reroll: reroll(["Endure"], { condition: "Wounded" }) });
  add("Silver Tongue", { reroll: reroll(["Persuade", "Negotiate"]) });
  add("Smuggler's Friend", { reroll: reroll(["Smuggle"]) });
  add("Flatterer", { reroll: reroll(["Court"]) });
  add("Gossipy", { reroll: reroll(["Tavern Talk"]), edge: [{ any: true, value: -1, when: { condition: "Secret" } }] });
  add("Revolutionary", { edge: plus(["Petition", "Negotiate"], -1, { condition: "Official" }), note: "In Avalon ports only, once a faction-port condition exists." });
  add("Animal Friend", { note: "Pet prices -15% (§32.12)." });
  add("Brute", { edge: [{ type: "Intimidate", value: 1 }, { type: "Persuade", value: -1 }] });
  add("Touched", { reroll: reroll(["Ghost Sense"]), note: "Dread floor +5." });
  add("Haunted", { edge: plus(["Persuade"], -1) });
  add("Heathen", { edge: plus(["Persuade", "Petition"], -1, { condition: "Pious NPC" }) });
  add("Drunkard", { reroll: reroll(["Cast-Iron Stomach", "Cards & Dice", "Tavern Talk"]),
    note: "-1 Court with romance NPCs lacking the Tolerant trait (needs a romance condition)." });
  add("Gourmand", { reroll: reroll(["Rally Crew"], { condition: "Winter" }), edge: plus(["Go Without"], -1) });
  add("Fisherman", { note: "Provisions burn -10%." });
  add("Fiddler", { reroll: reroll(["Rally Crew"], { condition: "Winter" }), note: "Crew morale floor +10." });

  // ---- Origin and loss tags (§14.3) ----
  add("Ash-Born", {}); // no check effect; unlocks scenes
  add("Grief-Stricken", { edge: plus(["Rally Crew", "Tavern Talk"], -1) });
  add("Dispossessed", { edge: plus(["Haggle", "Bribe"], -1) });
  add("Deep Scar", { edge: plus(["Hold Your Ground", "Strike First"], -1, { condition: "Under Fire" }) });

  // ---- Debuffs: physical tags (§12.4) ----
  // A curable ailment costs -2 on its main skill (the often-rolled one)
  // and -1 on the other until it's cured; for-life ailments stay -1 on
  // both (ruled in the M5 playtest, B2).
  add("Bad Knee", { edge: plus(["Chase & Climb"], -2).concat(plus(["Board"], -1)) });
  add("Old Wound", { edge: plus(["Endure"], -2).concat(plus(["Swordsmanship"], -1)) });
  add("Failing Eyes", { edge: plus(["Keep Watch", "Appraise"], -1) });
  // Temporary physical tags (§14.5) and items the opening can give (§32).
  add("Wounded", { edge: [{ group: "Combat", value: -1 }].concat(plus(["Endure"], -1)) });
  add("Shark-Tooth Necklace", { note: "Dread floor +5 (§32): Dread floors aren't built yet." });
  // The minigames' tags and items (§14.5, §14.4, §32.12).
  add("Hangover", { edge: plus(["Keep Watch", "Notice Danger", "Read People"], -1) });
  add("Waterlogged", { edge: plus(["Endure"], -1) }); // placeholder (§14.5)
  add("Card Sharp", { reroll: reroll(["Cards & Dice"]) });
  add("Hip Flask", { reroll: reroll(["Cast-Iron Stomach"]) });
  add("Loaded Dice", { note: "One reroll of the Cheat roll per Liar's Dice session (§18.3)." });
  add("Diver's Mask", { note: "+1 breath on a dive (§18.2)." });
  add("Diving Barrel", { note: "+2 breath on a dive (§18.2)." });
  add("Velvet Buccaneer Coat", { edge: plus(["Rally Crew"], 1), note: "Dread floor +5 (§32): Dread floors aren't built yet." });
  add("Tin Whistle", { note: "Morale floor +5 (§32.12)." });
  add("Silver Pocket Watch", { note: "§32: its effect comes with the items work." });
  add("Fancy Spyglass", { reroll: reroll(["Keep Watch"]), note: "One extra detail per prize on the scouting screen." });
  add("Navigator's Octant", { reroll: reroll(["Navigate"]) });
  add("Giant Tooth", { note: "A relic: Dread floor +10 while displayed (§32.12). Displays aren't built yet." });
  // Old ailments, rebalanced in the Creator chat (§12.4): one often-rolled
  // skill and one rarer one each.
  add("Weak Chest", { edge: plus(["Endure"], -2).concat(plus(["Dive"], -1)).concat([{ any: true, value: -1, when: { condition: "Cold" } }]) });
  add("Bad Back", { edge: plus(["Hold Your Ground"], -2).concat(plus(["Brawling"], -1)) });
  add("Rheumy Hands", { edge: plus(["Light Fingers", "Repair & Refit"], -1) });
  add("Hard of Hearing", { edge: plus(["Notice Danger"], -1).concat(plus(["Leadership"], -1, { anyOf: ["Under Fire", "Storm"] })) });
  add("Marsh Fever", { note: "Fever Flares fire more often and last two seasons (§11.9)." });

  // ---- Earned physical tags the prototype can already reach (§14.5) ----
  add("One Eye", { edge: plus(["Keep Watch"], -1), note: "Dread floor +10. Swaps the portrait for its eyepatch twin." });

  PC.data.modifiers = M;
})();
