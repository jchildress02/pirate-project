/* The Milestone 0 test captain.
 *
 * The character creator (a later milestone) builds this object from the
 * player's choices. Until then every new game starts with Dewey Test.
 * Starting package from §12.5 and §12.12.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.testCaptain = {
    captain: {
      first: "Dewey",
      last: "Test",
      gender: "m",
      age: 30, // 26-35: two starting tags and one debuff (§12.3)
      homeCity: "Charleston",
      loss: "A", // Lost Family: the one-armed pirate's lead (§12.5)
      portrait: { set: "dewey" }, // his own portrait set (§12.10, ruled November 8)
      // Three stats at 2, three at 1 (§12.6)
      stats: { Cunning: 1, Daring: 2, Command: 2, Seamanship: 1, Charm: 2, Grit: 1 },
      // Six training points, max 2 per type (§12.6)
      training: { "Marksmanship": 2, "Intimidate": 1, "Persuade": 1, "Navigate": 1, "Tavern Talk": 1 },
      traits: [],
      flaws: [],
      tags: ["Ash-Born", "Grief-Stricken", "Brute", "Sharpshooter", "Bad Knee"],
      items: ["Simple Flintlock Pistol", "Buccaneer's Cutlass"],
    },
    money: { crew: 600, purse: 0 },
    provisions: 10,
    ship: { name: "Second Chance", type: "Sloop", hull: 14, hullMax: 20, guns: 6, gunsMax: 10 },
    crew: { count: 12, morale: 50, pressure: 0 },
    meters: {
      dread: 0,
      standing: { frisia: 0, avalon: 0, pirates: 0 },
      heat: { frisia: 0, avalon: 0 },
    },
  };
  // The test mentor (Playtest Pins 0.8, #3): Jesse Dew, on the old Flinty
  // Beard portrait, never the test captain's own set (§12.8, §12.10).
  PC.data.testMentor = {
    id: "mentor", first: "Jesse", last: "Dew", gender: "m",
    portrait: { set: "flinty", band: "old" },
    type: "Navigator", level: 1,
    voice: "Old Salt", secondary: "Yarn-Spinner", unique: "Mentor",
    drive: "Freedom", fear: "Captivity",
    rung: 2, approval: 0, mentor: true, quartermaster: true, aboard: "flagship",
    wounded: false, sacrificeUsed: false, joined: { year: 1754, season: 0 },
  };
})();
