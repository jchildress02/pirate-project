/* Pirate Chronicle — the item catalog (§32; Milestone 9, PR 5, D7).
 *
 * The full §32 catalog as data. Each row: name, tier, price, slot and an
 * effect line, plus the modifier the engine reads (edge, reroll, floors,
 * the gun's bonus). Effects are wired wherever their check already exists;
 * the rest show on the card but do nothing yet (`inert` says why).
 *
 * Slots (§32.3): hat, face, top, bottom, pet, melee, ranged, trinket;
 * "inventory" items work from the inventory (consumables, the Pistol
 * Brace); "display" items wait for the cabin and homes (PR 6).
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  // ---- Little builders for the modifier each item carries ----
  function P(types, v, when) { return types.map(function (t) { var e = { type: t, value: v }; if (when) e.when = when; return e; }); }
  function R(types, when) { var r = { types: types, perSeason: 1 }; if (when) r.when = when; return r; }
  var W = {
    lead: { condition: "Lead the Charge" }, duel: { condition: "Duel" }, battle: { condition: "Battle" }, notBattle: { none: ["Battle"] },
    under: { condition: "Underworld" }, official: { condition: "Official" }, refined: { condition: "Refined NPC" }, pious: { condition: "Pious NPC" },
    stranger: { condition: "Stranger" }, demand: { condition: "Demand Surrender" }, rally: { condition: "Boarding Rally" }, repel: { condition: "Repel" },
    frisian: { condition: "Frisian waters" }, land: { none: ["Battle"] },
  };

  // [name, tier, price, slot, effect line, modifier, extra]
  var ROWS = [
    // ---- Swords (§32.8): Swordsmanship ----
    ["Buccaneer's Cutlass", "Uncommon", 500, "melee", "Reroll Lead the Charge", { reroll: R(["Swordsmanship", "Brawling"], W.lead) }, { weapon: "sword" }],
    ["Corsair's Blade", "Uncommon", 800, "melee", "Reroll Strike First on deck", { reroll: R(["Strike First"]) }, { weapon: "sword" }],
    ["Noble Longsword", "Uncommon", 1000, "melee", "Reroll in duels", { reroll: R(["Swordsmanship"], W.duel) }, { weapon: "sword" }],
    ["Steel Greatsword", "Uncommon", 1200, "melee", "A clean Lead the Charge kills one extra enemy; -1 Strike First on deck (heavy)", { edge: P(["Strike First"], -1) }, { weapon: "sword", extraKill: 1 }],
    ["Freddy's Cutlass", "Uncommon", 1000, "melee", "A clean Lead the Charge kills one extra enemy", {}, { weapon: "sword", extraKill: 1, unique: true, notSold: true, line: "A broad, heavy cutlass, its edge notched from a hundred boardings. It was never pretty, and it never needed to be." }],
    ["Parisian Rapier", "Rare", 3500, "melee", "+1 Swordsmanship in duels", { edge: P(["Swordsmanship"], 1, W.duel) }, { weapon: "sword" }],
    ["Abyssinian Scimitar", "Rare", 3500, "melee", "+1 Swordsmanship on Lead the Charge", { edge: P(["Swordsmanship"], 1, W.lead) }, { weapon: "sword" }],
    ["Grandfather's Fencing Sword", "Very Rare", 11000, "melee", "+1 Swordsmanship on every check; reroll in duels", { edge: P(["Swordsmanship"], 1), reroll: R(["Swordsmanship"], W.duel) }, { weapon: "sword", unique: true, cael: true }],
    // ---- Brawling weapons (§32.9) ----
    ["Sailor's Knife", "Uncommon", 400, "melee", "Reroll Brawling outside battle", { reroll: R(["Brawling"], W.notBattle) }, { weapon: "brawl", concealable: true }],
    ["Brass Knuckles", "Uncommon", 500, "melee", "Reroll in duels", { reroll: R(["Brawling"], W.duel) }, { weapon: "brawl", concealable: true }],
    ["Sharp Dagger", "Uncommon", 600, "melee", "Reroll Strike First on deck", { reroll: R(["Strike First"]) }, { weapon: "brawl", concealable: true }],
    ["Boarding Axe", "Uncommon", 700, "melee", "Reroll Repel Boarders", { reroll: R(["Board"], W.repel) }, { weapon: "brawl" }],
    ["Raider's Greataxe", "Uncommon", 1200, "melee", "A clean Lead the Charge kills one extra enemy; -1 Strike First on deck", { edge: P(["Strike First"], -1) }, { weapon: "brawl", extraKill: 1 }],
    ["Medieval Mace", "Rare", 3000, "melee", "+1 Brawling on Lead the Charge", { edge: P(["Brawling"], 1, W.lead) }, { weapon: "brawl" }],
    ["Venetian Stiletto", "Rare", 3500, "melee", "+1 Brawling in duels", { edge: P(["Brawling"], 1, W.duel) }, { weapon: "brawl", concealable: true }],
    ["Barnacle Buster", "Rare", 3000, "melee", "+1 Brawling on Lead the Charge; with Brute, a clean Lead the Charge also kills one extra enemy", { edge: P(["Brawling"], 1, W.lead) }, { weapon: "brawl", unique: true, cael: true, bruteKill: 1 }],
    ["Knife of Youth", "Rare", 2500, "melee", "+1 Strike First on deck", { edge: P(["Strike First"], 1) }, { weapon: "brawl", unique: true, cael: true, concealable: true }],
    ["Necromancer's Staff", "Very Rare", 11000, "melee", "Dread floor +10; +1 Ghost Sense", { dreadFloor: 10, edge: P(["Ghost Sense"], 1) }, { weapon: "brawl", unique: true, cael: true }],
    ["Tomahawk", "Uncommon", 700, "melee", "Can be thrown as the boarding shot (gun +0)", {}, { weapon: "brawl", talanee: true, inert: "the throw waits for the Talanee build" }],
    ["Stone-Headed War Club", "Uncommon", 900, "melee", "Reroll Demand Surrender", { reroll: R(["Intimidate"], W.demand) }, { weapon: "brawl", talanee: true }],
    // ---- Ranged (§32.10): the gun's bonus sits outside the ±3 cap ----
    ["Simple Flintlock Pistol", "Uncommon", 400, "ranged", "Gun +0", {}, { gun: 0, pistol: true, salvage: true }],
    ["Sea-Service Pistol", "Uncommon", 1200, "ranged", "Gun +1", {}, { gun: 1, pistol: true, salvage: true }],
    ["Pistol Brace", "Uncommon", 800, "inventory", "From inventory: a second ranged slot for a pistol; the shot rolls twice", {}, { brace: true }],
    ["Dueling Pistol", "Rare", 3000, "ranged", "Gun +2", {}, { gun: 2, pistol: true }],
    ["Family Pistol", "Rare", 3000, "ranged", "Gun +2", {}, { gun: 2, pistol: true, unique: true, notSold: true }],
    ["Horatio Eaton's Masterwork Pistol", "Rare", 3500, "ranged", "Gun +2; reroll the shot", { reroll: R(["Marksmanship"], W.battle) }, { gun: 2, pistol: true, unique: true, cael: true }],
    ["Guardian Pistol", "Very Rare", 9500, "ranged", "Gun +3; reroll the shot; reroll Repel Boarders", { reroll: R(["Marksmanship", "Board"], W.battle) }, { gun: 3, pistol: true }],
    ["Mahogany Pistol", "Very Rare", 10500, "ranged", "Gun +3; reroll the shot; a hit opening a duel gives +3", { reroll: R(["Marksmanship"], W.battle) }, { gun: 3, pistol: true, duelHit: 3 }],
    ["Blowgun", "Uncommon", 700, "ranged", "Silent; a hit opening a duel gives the enemy captain -1 instead of +2 to you; no clash casualties", {}, { gun: 0, talanee: true, inert: "its dart waits for the Talanee build" }],
    ["Soldier's Musket", "Uncommon", 900, "ranged", "Gun +1; a hit in the first clash kills two extra enemies", {}, { gun: 1, shotKills: 2 }],
    ["Sturdy Crossbow", "Uncommon", 1000, "ranged", "Gun +0; a Storm's firearms -1 doesn't touch it; silent", {}, { gun: 0, stormProof: true }],
    ["Hunter's Musket", "Rare", 3500, "ranged", "Gun +2; a hit in the first clash kills two extra enemies", {}, { gun: 2, shotKills: 2 }],
    ["Hickory Bow", "Rare", 3000, "ranged", "Gun +2; silent; works in rain", {}, { gun: 2, stormProof: true, talanee: true }],
    // ---- Clothing (§32.11) ----
    ["Buccaneer's Bandanna", "Uncommon", 500, "hat", "Reroll Persuade [Underworld]", { reroll: R(["Persuade"], W.under) }],
    ["Classic Tricorne", "Uncommon", 600, "hat", "Reroll Rally Crew", { reroll: R(["Rally Crew"]) }],
    ["Duke's Hat", "Rare", 3000, "hat", "+1 Court", { edge: P(["Court"], 1) }],
    ["Gauthier's Plumed Hat", "Uncommon", 800, "hat", "Reroll Court once a season", { reroll: R(["Court"]) }, { unique: true, notSold: true }],
    ["Majestic Musketeer Hat", "Rare", 3000, "hat", "+1 Court [Stranger]", { edge: P(["Court"], 1, W.stranger) }, { unique: true, cael: true }],
    ["Archpirate's Hat", "Very Rare", 11000, "hat", "Dread floor +15; +1 Intimidate", { dreadFloor: 15, edge: P(["Intimidate"], 1) }],
    ["Clay Pipe", "Uncommon", 400, "face", "Reroll Read People", { reroll: R(["Read People"]) }],
    ["Havana Cigars", "Uncommon", 500, "face", "Reroll Bribe", { reroll: R(["Bribe"]) }],
    ["Eyepatch", "Uncommon", 500, "face", "Dread floor +5", { dreadFloor: 5 }],
    ["Reader's Spectacles", "Uncommon", 600, "face", "Reroll Decipher & Research", { reroll: R(["Decipher & Research"]) }],
    ["Gold Tooth", "Uncommon", 700, "face", "Reroll Intimidate", { reroll: R(["Intimidate"]) }],
    ["Distinguished Quizzing Glass", "Rare", 2500, "face", "+1 Appraise", { edge: P(["Appraise"], 1) }],
    ["Slow-Match Beard", "Rare", 4000, "face", "Dread floor +10; +1 Intimidate when Demanding Surrender", { dreadFloor: 10, edge: P(["Intimidate"], 1, W.demand) }],
    ["Ruffled Shirt", "Uncommon", 600, "top", "Reroll Court", { reroll: R(["Court"]) }],
    ["Leather Vest", "Uncommon", 800, "top", "Reroll Endure", { reroll: R(["Endure"]) }],
    ["Gentleman's Coat", "Rare", 3000, "top", "+1 Persuade", { edge: P(["Persuade"], 1) }],
    ["Velvet Buccaneer Coat", "Rare", 3500, "top", "+1 Rally Crew; Dread floor +5", { edge: P(["Rally Crew"], 1), dreadFloor: 5 }],
    ["Luxurious Silk Robe", "Rare", 2500, "top", "Lodging clears Hangover and Waterlogged; +1 Court [Refined NPC]", { edge: P(["Court"], 1, W.refined) }, { unique: true, cael: true, inert: "the lodging effect comes later" }],
    ["Deerskin Hunting Shirt", "Uncommon", 700, "top", "Reroll Go Without", { reroll: R(["Go Without"]) }, { talanee: true }],
    ["Swashbuckler's Boots", "Uncommon", 700, "bottom", "Reroll Hold the Deck", { reroll: R(["Hold Your Ground"]) }],
    ["Gentleman's Boots", "Rare", 2500, "bottom", "+1 Petition [Official]", { edge: P(["Petition"], 1, W.official) }],
    ["Silk Breeches", "Rare", 2500, "bottom", "+1 Haggle", { edge: P(["Haggle"], 1) }],
    ["Beaded Moccasins", "Uncommon", 600, "bottom", "Reroll Notice Danger on land", { reroll: R(["Notice Danger"], W.land) }, { talanee: true }],
    // ---- Accessories (§32.12) ----
    ["Hip Flask", "Uncommon", 400, "trinket", "Reroll Cast-Iron Stomach", { reroll: R(["Cast-Iron Stomach"]) }],
    ["Cat-o'-Nine-Tails", "Uncommon", 500, "trinket", "Reroll Make an Example; Dread floor +5", { reroll: R(["Discipline", "Intimidate"], { condition: "Make an Example" }), dreadFloor: 5 }, { inert: "the reroll waits for Make an Example to offer rerolls" }],
    ["Shark-Tooth Necklace", "Uncommon", 500, "trinket", "Dread floor +5", { dreadFloor: 5 }, { salvage: true }],
    ["Bosun's Pipe", "Uncommon", 600, "trinket", "Reroll Leadership", { reroll: R(["Leadership"]) }],
    ["Lockpicks", "Uncommon", 600, "trinket", "Reroll Rescue & Breakout; unlocks lock-picking options", { reroll: R(["Rescue & Breakout"]) }, { concealable: true }],
    ["Loaded Dice", "Uncommon", 700, "trinket", "One reroll of the Cheat roll per Liar's Dice session", {}],
    ["Fancy Spyglass", "Uncommon", 900, "trinket", "Reroll Keep Watch; one extra detail per prize on the scouting screen", { reroll: R(["Keep Watch"]) }, { salvage: true, inert: "the extra scouting detail comes later" }],
    ["Forger's Kit", "Uncommon", 900, "trinket", "Reroll Forge and +5 units on Forge a Clearance", { reroll: R(["Forge"]), forgeUnits: 5 }],
    ["Engraver's Seal Matrices", "Rare", 3000, "trinket", "+1 Forge and +10 units on Forge a Clearance", { edge: P(["Forge"], 1), forgeUnits: 10 }],
    ["Key's Spyglass", "Rare", 3000, "trinket", "+1 Keep Watch; the scouting card shows the enemy captain's rating", { edge: P(["Keep Watch"], 1) }, { unique: true, notSold: true, line: "A battered brass spyglass that once belonged to Admiral James Key. Through it, you can get a good measure of every captain." }],
    ["Navigator's Octant", "Uncommon", 1000, "trinket", "Reroll Navigate", { reroll: R(["Navigate"]) }, { salvage: true }],
    ["Surgeon's Bag", "Uncommon", 1000, "trinket", "Reroll Treat Wounds", { reroll: R(["Treat Wounds"]) }],
    ["Smuggler's Belt", "Rare", 3000, "trinket", "+1 Smuggle; dirty goods carried are never found in a search", { edge: P(["Smuggle"], 1) }, { inert: "the search immunity comes with the inspections' next pass" }],
    // Instruments (only the best floor counts)
    ["Tin Whistle", "Uncommon", 400, "trinket", "Morale floor +5", { moraleFloor: 5 }, { instrument: true, salvage: true }],
    ["Boarding Drum", "Uncommon", 800, "trinket", "Reroll the Rally action in a boarding clash", { reroll: R(["Rally Crew"], W.rally) }, { instrument: true }],
    ["Ship's Fiddle", "Uncommon", 1200, "trinket", "Morale floor +5 (+10 with Fiddler); reroll Rally Crew", { moraleFloor: 5, reroll: R(["Rally Crew"]) }, { instrument: true, fiddler: 10 }],
    ["Hurdy-Gurdy", "Rare", 3000, "trinket", "Morale floor +10", { moraleFloor: 10 }, { instrument: true }],
    ["Thomas Swan's Violin", "Rare", 4000, "trinket", "Morale floor +10; reroll Rally Crew", { moraleFloor: 10, reroll: R(["Rally Crew"]) }, { instrument: true, unique: true, cael: true }],
    // Diving gear (the best one counts)
    ["Diver's Mask", "Uncommon", 600, "trinket", "+1 breath", { breath: 1 }],
    ["Diving Barrel", "Rare", 3000, "trinket", "+2 breath", { breath: 2 }],
    // Books
    ["Prayer Book", "Uncommon", 500, "trinket", "Reroll Ghost Sense", { reroll: R(["Ghost Sense"]) }],
    ["Frisian Rutter", "Uncommon", 900, "trinket", "Reroll Navigate and Pilot Shoals in Frisian waters", { reroll: R(["Navigate", "Pilot Shoals"], W.frisian) }, { curio: true, inert: "Frisian waters aren't marked yet" }],
    ["The Mariner's Guide to the Winds", "Uncommon", 900, "trinket", "Reroll Ride Out Storm", { reroll: R(["Ride Out Storm"]) }],
    ["Spanish Rutter", "Rare", 3500, "trinket", "+1 Pilot Shoals; reroll Navigate", { edge: P(["Pilot Shoals"], 1), reroll: R(["Navigate"]) }, { curio: true }],
    ["Pirate's Almanac", "Rare", 2500, "trinket", "Reroll Ride Out Storm; the destination screen shows next season's outlook for both zones", { reroll: R(["Ride Out Storm"]) }, { unique: true, cael: true, inert: "the outlook line comes later" }],
    ["Catch of the Day", "Rare", 2000, "trinket", "Provisions burn -10%", { burnCut: 0.10 }, { unique: true, cael: true }],
    ["The Wooden Mast", "Rare", 2000, "trinket", "Morale floor +5 (a book: it stacks with an instrument)", { moraleFloor: 5 }, { unique: true, cael: true }],
    ["Codex of the Brethren", "Very Rare", 10000, "trinket", "+1 Pirate Code; reroll Persuade [Underworld]", { edge: P(["Pirate Code"], 1), reroll: R(["Persuade"], W.under) }, { curio: true }],
    // Talanee trinkets
    ["Medicine Pouch", "Uncommon", 800, "trinket", "Reroll Immune System", { reroll: R(["Immune System"]) }, { talanee: true }],
    ["Shell Gorget", "Rare", 2500, "trinket", "+1 Persuade at Talanee and with native NPCs", { edge: P(["Persuade"], 1, { condition: "Native" }) }, { talanee: true, inert: "comes with Talanee" }],
    // ---- Consumables (inventory; up to 3 of each) ----
    ["Blackpowder Grenade", "Uncommon", 400, "inventory", "In one boarding clash: win Strike First and kill one extra enemy", {}, { consumable: true }],
    ["Disguise Kit", "Uncommon", 600, "inventory", "Treat one disguise or infiltration check as clean", {}, { consumable: true, inert: "it offers itself once disguise scenes exist" }],
    ["Surgeon's Cordial", "Uncommon", 700, "inventory", "At the next arrival, wounded crew recover at 60%", {}, { consumable: true }],
    ["Rejuvenating Elixir", "Uncommon", 900, "inventory", "Removes the captain's Wounded tag at once", {}, { consumable: true }],
    // ---- Pets ----
    ["Hedgehog", "Uncommon", 400, "pet", "Unlocks naturalist dialogue", {}, { inert: "its scenes come with Talanee" }],
    ["Orange Cat", "Uncommon", 500, "pet", "Provisions burn -5%", { burnCut: 0.05 }],
    ["Tabby Cat", "Uncommon", 500, "pet", "Morale floor +5", { moraleFloor: 5 }],
    ["Black Cat", "Uncommon", 500, "pet", "Dread floor +5; reroll Ghost Sense", { dreadFloor: 5, reroll: R(["Ghost Sense"]) }],
    ["Loyal Spaniel", "Uncommon", 700, "pet", "Reroll Read People", { reroll: R(["Read People"]) }],
    ["Hunting Hound", "Uncommon", 900, "pet", "Reroll Notice Danger", { reroll: R(["Notice Danger"]) }],
    ["Green Parrot", "Uncommon", 900, "pet", "Reroll Tavern Talk", { reroll: R(["Tavern Talk"]) }],
    ["Red Parrot", "Uncommon", 900, "pet", "Reroll Intimidate", { reroll: R(["Intimidate"]) }],
    ["Capuchin Monkey", "Rare", 2500, "pet", "+1 Light Fingers", { edge: P(["Light Fingers"], 1) }],
    ["Blue & Gold Macaw", "Rare", 3500, "pet", "Morale floor +5 and Dread floor +5", { moraleFloor: 5, dreadFloor: 5 }],
    // ---- Art (display) ----
    ["Van Huyt's Island Landscape", "Rare", 3000, "display", "While displayed: lodging +3 morale; morale floor +5", { moraleFloor: 5 }, { art: true }],
    ["Gilded Icon", "Rare", 3000, "display", "While displayed: reroll Persuade [Pious NPC]", { reroll: R(["Persuade"], W.pious) }, { art: true }],
    ["Portrait of Poppo von Rackel", "Rare", 3500, "display", "While displayed: reroll Petition [Official] at a Frisian-held node", { reroll: R(["Petition"], W.official) }, { art: true }],
    ["Tapestry of the Breton Kings", "Very Rare", 11000, "display", "While displayed: +1 Court [Refined NPC]", { edge: P(["Court"], 1, W.refined) }, { art: true }],
    ["Portrait of Beatrice Pavard", "Very Rare", 11000, "display", "Genuine or fake: genuine, +1 Persuade [Refined NPC] while displayed", { edge: P(["Persuade"], 1, W.refined) }, { art: true, unique: true, cael: true }],
    ["Kingly Goblet", "Very Rare", 9000, "display", "Reroll Court; while displayed, +1 Wits in every drinking match", { reroll: R(["Court"]) }, { curio: true, unique: true, cael: true }],
    // ---- Curios ----
    ["Obsidian Amulet", "Uncommon", 700, "trinket", "Dread floor +5", { dreadFloor: 5 }, { curio: true, salvage: true }],
    ["Silver Pocket Watch", "Uncommon", 800, "trinket", "Reroll Haggle", { reroll: R(["Haggle"]) }, { curio: true, salvage: true }],
    ["Map of the Gold Coast", "Rare", 3000, "display", "While displayed: one extra Merchant or World State rumor a season", {}, { curio: true, inert: "its rumor comes with the displays (PR 6)" }],
    ["Ivory Compass", "Rare", 3500, "trinket", "+1 Navigate", { edge: P(["Navigate"], 1) }, { curio: true }],
    ["Jeweled Pocket Watch", "Rare", 4000, "trinket", "+1 Bribe", { edge: P(["Bribe"], 1) }, { curio: true }],
    ["Cursed Aztec Coin", "Very Rare", 9000, "trinket", "Once a season, reroll any check; a seeded 1-in-6 misfortune each season it's carried", { reroll: R(null) }, { curio: true, inert: "the misfortune event comes later" }],
    ["Inca Crown", "Very Rare", 11000, "display", "While displayed: Dread floor +5", { dreadFloor: 5 }, { curio: true }],
    ["Van Helsing Family Ring", "Very Rare", 10000, "trinket", "+1 Persuade [Underworld]; unlocks a scene with Morgana", { edge: P(["Persuade"], 1, W.under) }, { unique: true, cael: true }],
    ["A Special Little Box", "Rare", 2000, "inventory", "Opens with Lockpicks; contents seeded at purchase", {}, { unique: true, cael: true, inert: "opening it comes with Cael" }],
    ["Forged Treasure Map", "Uncommon", 40, "inventory", "None: a beautiful fake. Maelis buys it", {}, { curio: true }],
    // ---- Relics (§35.4): Very Rare, never sold in shops ----
    ["Giant Tooth", "Very Rare", 9000, "display", "While displayed: Dread floor +10", { dreadFloor: 10 }, { relic: true, notSold: true }],
    ["Black Scale", "Very Rare", 8000, "trinket", "+1 Smuggle; reroll Pilot Shoals", { edge: P(["Smuggle"], 1), reroll: R(["Pilot Shoals"]) }, { relic: true, notSold: true }],
    ["Mirror Scale", "Very Rare", 9000, "trinket", "+1 Keep Watch; morale floor +5", { edge: P(["Keep Watch"], 1), moraleFloor: 5 }, { relic: true, notSold: true }],
    ["Giant Squid Eye", "Very Rare", 10000, "display", "While displayed: Dread floor +5; +1 Notice Danger at sea", { dreadFloor: 5, edge: P(["Notice Danger"], 1) }, { relic: true, notSold: true }],
    ["Bone Comb", "Very Rare", 8000, "trinket", "+1 Court", { edge: P(["Court"], 1) }, { relic: true, notSold: true }],
    ["Petrified Gator Egg", "Very Rare", 8000, "display", "While displayed: Dread floor +5", { dreadFloor: 5 }, { relic: true, notSold: true }],
    // ---- The ship's arms locker (3-30 of the build 0.9 pins): ship's stock ----
    ["Ship's Cutlass", "Stock", 0, "melee", "Ship's stock: a plain cutlass, no effect", {}, { weapon: "sword", stock: true, notSold: true }],
    ["Ship's Pistol", "Stock", 0, "ranged", "Ship's stock: a plain pistol, gun +0", {}, { gun: 0, pistol: true, stock: true, notSold: true }],
    // Quest keepsakes
    ["Carved Ivory Mermaid", "Uncommon", 500, "inventory", "Geezer's keepsake, from his days on Lilyhook's crew", {}, { unique: true, notSold: true }],
  ];

  var CAT = {};
  ROWS.forEach(function (r) {
    var extra = r[6] || {};
    CAT[r[0]] = Object.assign({ name: r[0], tier: r[1], price: r[2], slot: r[3], effect: r[4], mod: r[5] || {} }, extra);
  });

  PC.data.items = {
    catalog: CAT,
    SLOTS: ["hat", "face", "top", "bottom", "pet", "melee", "ranged", "trinket"],
    SLOT_NAMES: { hat: "Hat", face: "Face", top: "Top", bottom: "Bottom", pet: "Pet", melee: "Melee", ranged: "Ranged", trinket: "Trinket" },
    STACK: 3,                  // consumables, up to 3 of each
    CORDIAL_RECOVERY: 0.60,    // the Surgeon's Cordial (§24.9)
    BURN_CAP: 0.30,            // combined burn cuts (§25.2)
    // §32.16's hidden-item pools by flag (proposal rows), and the tiers.
    POOLS: {
      Sicily: ["Van Huyt's Island Landscape", "Tapestry of the Breton Kings", "Portrait of Poppo von Rackel", "Gilded Icon", "Jeweled Pocket Watch"],
      Burgundy: ["Ruffled Shirt", "Gentleman's Coat", "Silk Breeches", "Velvet Buccaneer Coat"],
      Spain: ["Spanish Rutter", "Silk Breeches", "Havana Cigars"],
      France: ["Parisian Rapier", "Sea-Service Pistol", "Dueling Pistol", "Mahogany Pistol"],
      Frisia: ["Frisian Rutter", "Silver Pocket Watch", "Portrait of Poppo von Rackel", "Jeweled Pocket Watch"],
      Pirate: ["Gold Tooth", "Cursed Aztec Coin", "Map of the Gold Coast", "Loaded Dice", "Codex of the Brethren", "Eyepatch", "Shark-Tooth Necklace", "Slow-Match Beard"],
      War: ["Sea-Service Pistol", "Dueling Pistol", "Guardian Pistol", "Navigator's Octant", "Fancy Spyglass"],
      Other: ["Silver Pocket Watch", "Navigator's Octant", "Fancy Spyglass", "Sea-Service Pistol", "Ruffled Shirt", "Ivory Compass", "Havana Cigars", "Classic Tricorne"],
    },
    POOL_TIERS: { Uncommon: 75, Rare: 22, "Very Rare": 3 }, // Rare only at Rich+, Very Rare only at Superior
    // The Uncommon a bounty target may carry (§17.4.8): drawn from the Pirate pool's Uncommons.
    lines: {
      equipLocked: "Not now: equipment can't be changed in a battle or a scene.",
      lockerCutlass: "From the ship's arms locker, you take a plain cutlass.",
      lockerPistol: "From the ship's arms locker, you take a plain pistol.",
      elixir: "PLACEHOLDER: You drink the elixir down. The pain fades, and your wound closes.",
      cordial: "PLACEHOLDER: The Surgeon's Cordial works wonders on the wounded.",
      grenade: "PLACEHOLDER: You light the fuse and hurl the grenade into the press of men.",
    },
  };

  // Each item's modifier joins the captain modifiers (content/modifiers.js),
  // keeping any hand-written fields there (forgeUnits).
  var M = PC.data.modifiers = PC.data.modifiers || {};
  Object.keys(CAT).forEach(function (n) {
    var it = CAT[n], m = Object.assign({}, M[n] || {}, it.mod, { name: n });
    if (it.mod.reroll && it.mod.reroll.types === null) { m.reroll = { perSeason: 1 }; } // the Cursed Aztec Coin: any check
    if (it.inert) m.note = it.effect + " (" + it.inert + ")";
    M[n] = m;
  });
})();
