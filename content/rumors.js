/* Rumor lines for the prototype (S17 appendix §7, the rows marked for the
 * prototype; §30). The author's language; tokens marked:
 *   [NPC]    the NPC's name and role, or the role alone until met (§30.3)
 *   {npc.his} and the other forms: that NPC's pronouns
 *   [Player] the captain's name; [Ship] the captain's ship
 *   [Node], [Faction], [Waters] from the danger spot
 *
 * Each line: { id, type, text, when (a scene condition, optional) }.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.rumors = {
    // §30.8 The scripted Frisian posture rumor: Spring 1754 at Ocracoke, the
    // first rumor the tavern keeper gives in the game.
    scripted: [
      { id: "posture_scripted_distracted", type: "World State", posture: "Distracted", node: "ocracoke", season: "Spring", year: 1754,
        text: "\"They're saying Jongstra's fleet sailed back north. The war with Sweden doesn't seem to be going well for Frisia.\"" },
      { id: "posture_scripted_opportunist", type: "World State", posture: "Opportunist", node: "ocracoke", season: "Spring", year: 1754,
        text: "\"Jongstra's got the *Leviathan* at harbor in Nassau. They say his crew is drinking every tavern in town dry. I didn't think that was even possible.\"" },
      { id: "posture_scripted_hunter", type: "World State", posture: "Hunter", node: "ocracoke", season: "Spring", year: 1754,
        text: "\"Jongstra's got the Frisian warships out hunting. Best to keep your distance - they don't seem too picky.\"" },
    ],

    pool: [
      // Legend
      { id: "legend_lantern", type: "Legend", text: "\"They say that you can see a lantern burning out on the wrecks at night. I don't know who could be lighting it.\"" },
      { id: "legend_voice", type: "Legend", text: "\"Fisherman swears he heard a voice coming from the Graveyard last night. Said it kept saying the same thing over and over again. Wouldn't tell me what.\"" },
      { id: "legend_giant_shark", type: "Legend", text: "\"Heard some sailors say they saw a shark the length of a frigate. Sharks can't grow that big, can they?\"" },

      // Danger (they name a real danger spot this season, §30.9)
      { id: "danger_patrol", type: "Danger", spot: "Patrol", text: "\"They're saying the guards at [Node] are cracking down on smuggling. Best not to have any dirty goods in your hold when you dock there.\"" },
      { id: "danger_hunters", type: "Danger", spot: "Hunter's Waters", text: "\"[Faction] has their hunters out in force near the [Waters].\"" },

      // World State: the posture, true about last season (two lines each), and the loyalists
      { id: "ws_distracted_1", type: "World State", posture: "Distracted", text: "\"Heard the Frisians lost a big battle in Sweden. Now they're putting out a call for more reinforcements.\"" },
      { id: "ws_distracted_2", type: "World State", posture: "Distracted", text: "\"War in the Baltic is bleeding Frisia's coffers dry. The Van Helsings are having to send more of their gold back to Europe, and Morgana isn't happy.\"" },
      { id: "ws_opportunist_1", type: "World State", posture: "Opportunist", text: "\"Frisia's paying good coin for ships this season. Their privateers are getting rich.\"" },
      { id: "ws_opportunist_2", type: "World State", posture: "Opportunist", text: "\"Business is booming in Nassau. Prices are higher for just about everything.\"" },
      { id: "ws_hunter_1", type: "World State", posture: "Hunter", text: "\"Seems like Frisian warships are everywhere down south. They're hanging pirates in St. Augustine by the dozen.\"" },
      { id: "ws_hunter_2", type: "World State", posture: "Hunter", text: "\"Frisians seem mad about something. Mad enough to scour the seas looking for pirates to hang.\"" },
      { id: "ws_loyalists", type: "World State", text: "\"Lot of speculation from these boys about where Amber Jack is hiding and whether he'll come back for them. I think he's long gone.\"" },

      // Reputation (§30.11: a recent deed, then the Dread band, then the newcomer)
      { id: "rep_tp_humiliated", type: "Reputation", deed: true, when: { flag: "tp_humiliated" }, text: "\"Did you hear about the newcomer that pushed Twopenny over? Whole beach is still laughing about it.\"" },
      { id: "rep_tp_beat_you", type: "Reputation", deed: true, when: { flag: "tp_beat_you" }, text: "\"Twopenny's been telling everyone he whipped the new captain in a fight. It's a bit hard to believe.\"" },
      { id: "rep_shark_killed", type: "Reputation", deed: true, when: { flag: "shark_killed" }, text: "\"Ollie's been telling everyone that Captain [Player] killed a huge shark with just {captain.his} knife. He's not one to exaggerate, either.\"" },
      { id: "rep_asking", type: "Reputation", deed: true, when: { seasonFlag: "gi_asked" }, text: "PLACEHOLDER (line to write, §30.4): the next Reputation rumor here is about the captain asking questions." },
      { id: "rep_dread_20", type: "Reputation", dread: [20, 39], text: "\"[Player] is definitely not someone you want to cross.\"" },
      { id: "rep_dread_40", type: "Reputation", dread: [40, 69], text: "\"Merchants from here to Havana are terrified of the [Ship].\"" },
      { id: "rep_dread_70", type: "Reputation", dread: [70, 100], text: "\"Even just hearing the name [Player] strikes fear in the hearts of sailors.\"" },
      { id: "rep_newcomer_1", type: "Reputation", newcomer: true, text: "\"Did you see that new sloop in the cove? Doesn't look all that fast to me.\"" },
      { id: "rep_newcomer_2", type: "Reputation", newcomer: true, text: "\"New fellow that just arrived is looking for someone. Him and everyone else here.\"" },

      // Prize (rare): the special ship joins the next hunt in her waters (Milestone 5)
      { id: "prize_licorne", type: "Prize", ship: "Licorne", waters: "northern", text: "\"Heard the *Licorne* is still running loose up the banks, full of Charleston silver.\"" },
    ],

    // Node rumors reveal one trait of an NPC (§30.2). One line per trait.
    traits: {
      "Suspicious": "\"[NPC] doesn't trust a soul.\"",
      "Vain": "\"All it takes for [NPC] to let {npc.his} guard down is to tell {npc.him} {npc.he} looks good.\"",
      "Greedy": "\"[NPC] would sell {npc.his} mother for a few coins.\"",
      "Fickle": "\"Don't put too much trust in [NPC]. Only one that matters is the last person who paid {npc.him}.\"",
      "Cool-Headed": "\"Never seen [NPC] rattled. Not once.\"",
      "Humble": "\"[NPC] doesn't judge. {npc.He}'ll hear anybody out.\"",
      "Jovial": "\"[NPC] is fun. Always loves a good chat.\"",
      "Taciturn": "\"It's tough to get [NPC] to even crack a smile.\"",
      "Gossipy": "\"[NPC] can't wait to tell you everything {npc.he} knows.\"",
      "Discreet": "\"Try as you might, you'll never get any information out of [NPC].\"",
      "Hard Drinker": "\"I've never seen anyone drink as much rum as [NPC].\"",
      "Observant": "\"[NPC] has sharp eyes, never misses a thing.\"",
      "Candid": "\"[NPC] will always be straight with you.\"",
      "Inscrutable": "\"It's always hard to tell what [NPC] is thinking.\"",
      "Generous": "\"[NPC] never hesitates to help someone in need.\"",
      "Loyal": "\"[NPC] is loyal to the last.\"",
      "Tolerant": "\"[NPC] is an accepting sort. Don't need to hide anything with {npc.him}.\"",
      "Shrewd": "\"[NPC] drives a hard bargain.\"",
      "Proud": "\"[NPC] is a pompous ass. Thinks {npc.he}'s the greatest thing since spiced rum.\"",
      "Honorable": "\"[NPC] is a real upstanding citizen. No fun, though.\"",
      "Stubborn": "\"You won't get [NPC] to change {npc.his} mind. {npc.He}'ll just dig {npc.his} heels in.\"",
      "Bookish": "\"[NPC] always has {npc.his} nose in a book.\"",
      "Gullible": "\"[NPC] keeps getting scammed. {npc.He}'ll fall for anything.\"",
      "Corrupt": "\"[NPC] is a slimy bastard. Pockets are heavy with bribes.\"",
      "Pragmatic": "\"You can always make a fair deal with [NPC].\"",
    },

    // Bobby's Underworld rumors: a chance on each deal (§30.4).
    underworld: {
      leadIn: "\"Bobby's been hearing things lately.\"",
      lines: [
        { id: "uw_maelis_wants", type: "Underworld", text: "\"Bobby hears the pretty miss Maelis is paying double for anything old and strange. Bobby wishes he had something like that.\"" },
        { id: "uw_letter_buyer", type: "Underworld", text: "\"Got a letter of marque you aren't using? Bobby knows a quiet house in [Node] that pays for papers. Bobby doesn't know what they do with them. Bobby doesn't want to know.\"" },
      ],
      chance: { "0": 0.10, "1": 0.20, "2": 0.35, "3": 0.50 },
      askFrench: "\"Bobby hears that those Frenchmen are still skulking about somewhere.\"",
    },

    // Danger spots (§30.9): where a Patrol can sit. This build's list of
    // Avalon and Frisian ports (assumption, flagged in the Milestone 3 PR).
    patrolNodes: { "Norfolk": "Avalon", "Edenton": "Avalon", "Wilmington": "Avalon", "Charleston": "Avalon", "Savannah": "Avalon", "Nassau": "Frisia", "St. Augustine": "Frisia" },
    // Where the letter buyer's quiet house is (assumption).
    letterBuyerNodes: ["Edenton", "Wilmington", "Charleston", "Savannah"],
    waters: { northern: "Hatteras Banks", southern: "Bahama Channel" },

    // §30.3 Expiry by type.
    expires: { "Danger": 0, "Merchant": 0, "World State": 0, "Prize": 1 }, // seasons after this one; absent means never
  };
})();
