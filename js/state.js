/* Pirate Chronicle — game state, saving and loading.
 *
 * The whole game lives in one plain object ("the world is the save file").
 * It is saved to the browser after every action, and can be exported to a
 * .json file and imported back.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var SAVE_VERSION = 16;
  var STORAGE_KEY = "pirate-chronicle-save";
  var SEASONS = ["Spring", "Summer", "Hurricane", "Winter"];
  var AP_PER_SEASON = 7; // §4; under review in playtesting

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // A new game from a starting template: the character creator's build
  // (PC.creator.build), or the fixed test captain the engine tests use.
  function newGame(captainTemplate, opts) {
    opts = opts || {};
    var c = clone(captainTemplate);
    var startScene = opts.startScene || PC.data.start.scene;
    // A game that starts in a node (Ocracoke) lives there; the engine tests
    // start in the test harbor instead (location null).
    var startNode = opts.startScene ? (opts.node || null) : (opts.node || PC.data.start.node || null);
    var state = {
      saveVersion: SAVE_VERSION,
      world: { seed: opts.seed || PC.rng.newWorldSeed(), createdAt: new Date().toISOString() },
      time: { year: 1754, season: 0 }, // index into SEASONS
      ap: { max: AP_PER_SEASON, left: AP_PER_SEASON },
      captain: c.captain,
      money: c.money,           // { crew, purse } — §27
      provisions: c.provisions, // lots — §20.6
      jail: null, shipless: false, secretsExposed: {}, fenceShut: {}, // §43, §30.12 (M8 PR 6)
      ship: c.ship,
      crew: c.crew,
      meters: c.meters,         // Dread, Standing, Heat — §28
      officers: c.officers || [], // the mentor first (§25); rung 0 is Neutral, 2 Friend
      npcs: c.npcs || {},       // per-NPC deltas only (ladder rung, flags)
      flags: c.flags || {},
      quests: c.quests || {},   // open quests by id (the loss quest, §12.5)
      seen: {},                 // scenes finished (for "Once" scenes)
      rolls: {},                // how many times each roll point has fired
      rerollsUsed: {},          // per source, reset each season
      log: [],
      current: { screen: "scene", sceneId: startScene, phase: "choosing" },
      settings: { showDice: false },
    };
    addMilestone2Fields(state, startNode);
    addMilestone3Fields(state);
    addMilestone4Fields(state);
    addMilestone5Fields(state);
    addMilestone7Fields(state);
    if (PC.officers && state.world) PC.officers.ensureQuartermaster(state);
    return state;
  }

  // Milestone 7: the map, voyages and the season loop (§4, §26.9, §27.7).
  function addMilestone7Fields(state) {
    if (state.tradeShip === undefined) state.tradeShip = null;   // §27.7
    if (state.split === undefined) state.split = null;           // the Winter split in progress (§26.9)
    if (state.splitWinter === undefined) state.splitWinter = null;
    if (state.voyage === undefined) state.voyage = null;
    state.yearStart = state.yearStart || { year: state.time.year, purse: state.money.purse, crew: state.money.crew, prizes: (state.records && state.records.prizes) || 0 };
    if (state.crew && state.crew.pressure == null) state.crew.pressure = 0;
    // A node's later-added slots (the Trade Master) fill now.
    if (state.location && state.location.node && PC.node) PC.node.initNode(state, state.location.node);
  }

  // UI pass 1 (the Creator chat, §11.4, §14.2): five skills cut or merged,
  // two tags merged, Deserter's Mark gone.
  var SKILL_RENAMES = { "Repair at Sea": "Repair & Refit", "Refit & Careen": "Repair & Refit", "Fence": "Haggle", "Run Blockade": "Outrun", "Sabotage": "Plan & Ambush", "Haul & Labor": "Endure" };
  var TAG_RENAMES = { "Cartographer": "Explorer", "Speedy": "Cutpurse", "Deserter's Mark": null };
  function renameSkillsAndTags(data) {
    var c = data.captain || {};
    var tr = c.training || {};
    Object.keys(SKILL_RENAMES).forEach(function (old) {
      if (!tr[old]) return;
      var to = SKILL_RENAMES[old];
      tr[to] = Math.min(3, (tr[to] || 0) + tr[old]);
      delete tr[old];
    });
    c.tags = (c.tags || []).map(function (t) { return t in TAG_RENAMES ? TAG_RENAMES[t] : t; })
      .filter(function (t, i, a) { return t && a.indexOf(t) === i; });
  }

  // Milestone 4: the minigames (§18). The game in play (state.minigame) and
  // what carries across sessions: Liar's Dice winnings toward Card Sharp,
  // the Heavy Drinker's "One more round" count, session counters.
  function addMilestone5Fields(state) {
    state.fleet = state.fleet || [];          // fleet and prize ships (§21.8)
    state.captives = state.captives || 0;     // captives aboard, to free at a free port (§22.7)
    state.records = state.records || { prizes: 0, duels: 0 }; // Prize Taker, Duelist (§14.4)
    // The end-of-prototype screen (R5): hulls sold, and the tags the captain
    // started with, so it can show the ones earned. Older saves don't know
    // their starting tags (null: the screen lists every tag).
    if (state.records.hullsSold == null) state.records.hullsSold = 0;
    if (state.records.startTags === undefined) state.records.startTags = state.log && state.log.length ? null : (state.captain.tags || []).slice();
    state.world.grudge = state.world.grudge || { France: 0, Sicily: 0 }; // §22.5
    state.gameOver = state.gameOver || null;
  }

  function addMilestone4Fields(state) {
    state.minigames = state.minigames || { diceWinnings: 0, oneMoreRounds: 0, drinkSessions: 0, diceSessions: 0 };
    if (state.minigame === undefined) state.minigame = null;
  }

  // Milestone 3: Frisia's posture, rolled at world creation (§8; equal odds
  // until §8 sets weights, ruled November 14), the rumors heard, and the
  // quest leads (§30).
  var POSTURES = ["Distracted", "Opportunist", "Hunter"];
  function rollPosture(seed) {
    var r = PC.rng.fromKey(seed + "|frisian-posture");
    return POSTURES[Math.floor(r() * POSTURES.length)];
  }
  function addMilestone3Fields(state) {
    state.world.posture = state.world.posture || rollPosture(state.world.seed);
    state.rumors = state.rumors || [];       // heard rumors, newest last (§30.12)
    state.quests = state.quests || {};
    state.officerVisit = state.officerVisit || null; // the Tavern visit an officer hire was paid for
  }

  // Milestone 2's placeholder beats were renamed when the real scenes came in.
  var STUB_TO_SCENE = {
    ocr_opening: "ocr_sandbar",
    ocr_underworld_stub: "ocr_uw_1",
    ocr_dying_wish_stub: "ocr_dpw_1",
    ocr_restless_stub: "ocr_rr_1",
  };

  // Milestone 2: the node, the hold, the ship's upgrades, the crew's tiers,
  // the Articles and the persistent Minors (§17, §21.6, §24, §26, §36).
  function addMilestone2Fields(state, node) {
    state.location = node ? { node: node, place: null } : null;
    state.cargo = state.cargo || { treasure: { clean: 0, dirty: 0 }, goods: {} };
    var sh = state.ship;
    sh.upgrades = sh.upgrades || { hull: 1, rigging: 1, guns: 1 };
    if (sh.baseHull == null) sh.baseHull = sh.hullMax;
    if (sh.cargo == null) sh.cargo = 50;
    if (sh.size == null) sh.size = 1;
    if (sh.crewMin == null) sh.crewMin = 5;
    if (sh.crewMax == null) sh.crewMax = 30;
    if (sh.speed == null) sh.speed = 2;
    if (sh.speedMax == null) sh.speedMax = 3;
    if (sh.rigging == null) sh.rigging = "frayed";
    var cr = state.crew;
    if (!cr.tiers) cr.tiers = { Green: cr.count };
    ["Green", "Able", "Seasoned", "Veteran"].forEach(function (t) { cr.tiers[t] = cr.tiers[t] || 0; });
    cr.wounded = cr.wounded || 0;
    cr.raw = cr.raw || 0;
    cr.floor = cr.floor || 0;
    cr.rationing = !!cr.rationing;
    state.articles = state.articles || null;
    state.mutiny = state.mutiny || null; // while a mutiny plays (M9 PR 2)
    state.prisoners = state.prisoners || []; // bounty targets and French captains held for Howe (M9 PR 3)
    state.nodes = state.nodes || {};
    state.generated = state.generated || {};
    state.world.names = state.world.names || [];
    state.used = state.used || {};       // once-a-season actions, by season stamp
    if (node && PC.node) PC.node.initNode(state, node);
  }

  function stamp(state) { return state.time.year + "-" + state.time.season; }

  function seasonName(state) { return SEASONS[state.time.season]; }

  function advanceSeason(state) {
    // Temporary tags that last "until the end of the season" lapse (§5.3).
    var until = (state.captain && state.captain.tagsUntil) || {};
    Object.keys(until).forEach(function (t) {
      if (until[t] !== stamp(state)) return;
      var i = state.captain.tags.indexOf(t);
      if (i >= 0) state.captain.tags.splice(i, 1);
      delete until[t];
    });
    state.time.season += 1;
    if (state.time.season >= SEASONS.length) { state.time.season = 0; state.time.year += 1; }
    state.ap.left = state.ap.max;
    state.rerollsUsed = {};
    if (state.time.season === 0) state.yearStart = { year: state.time.year, purse: state.money.purse, crew: state.money.crew, prizes: (state.records && state.records.prizes) || 0 };
    addLog(state, "— " + seasonName(state) + " " + state.time.year + " begins. —");
  }

  function addLog(state, line) {
    state.log.push(line);
    if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
  }

  // ---- Saving ----------------------------------------------------------

  function serialize(state) { return JSON.stringify(state); }

  // Upgrade an old save to the current shape. Add a step here whenever the
  // save shape changes, so old saves keep loading.
  function migrate(data) {
    if (!data || typeof data !== "object") throw new Error("Not a save file.");
    if (typeof data.saveVersion !== "number") throw new Error("Not a Pirate Chronicle save file.");
    if (data.saveVersion > SAVE_VERSION) throw new Error("This save is from a newer version of the game.");
    if (data.saveVersion === 1) {
      // Version 2 (Milestone 1): officers, quests and the captain's portrait.
      data.officers = data.officers || [];
      data.quests = data.quests || {};
      data.saveVersion = 2;
    }
    if (data.saveVersion === 2) {
      // Version 3 (Milestone 2): Ocracoke. A Milestone 1 game was still in
      // the placeholder scenes, so its captain starts over at Ocracoke's
      // arrival with everything he had.
      addMilestone2Fields(data, PC.data.start.node || null);
      if (data.location) data.current = { screen: "scene", sceneId: PC.data.start.scene, phase: "choosing" };
      data.saveVersion = 3;
    }
    if (data.saveVersion === 3) {
      // Version 4 (Milestone 3): the real opening scenes. A captain who already
      // played a placeholder beat keeps what it paid; one standing in front
      // of a placeholder plays the real scene instead.
      addMilestone3Fields(data);
      if (data.current && STUB_TO_SCENE[data.current.sceneId]) data.current = { screen: "scene", sceneId: STUB_TO_SCENE[data.current.sceneId], phase: "choosing" };
      if (data.location && data.location.queue) data.location.queue = data.location.queue.map(function (q) { return STUB_TO_SCENE[q] || q; });
      data.saveVersion = 4;
    }
    if (data.saveVersion === 4) {
      // Version 5 (Milestone 4): the minigames. Nothing a version 4 save holds
      // changes; a captain standing at the stand-in dive plays the real one.
      addMilestone4Fields(data);
      data.saveVersion = 5;
    }
    if (data.saveVersion === 5) {
      // Version 6 (UI pass 1): the skill cuts and tag merges, and the
      // Acting Quartermaster when no officer is aboard (§25.9).
      renameSkillsAndTags(data);
      if (PC.officers && data.world) PC.officers.ensureQuartermaster(data);
      data.saveVersion = 6;
    }
    if (data.saveVersion === 6) {
      // Milestone 5: the fleet, captives aboard, prize records, grudges.
      addMilestone5Fields(data);
      data.saveVersion = 7;
    }
    if (data.saveVersion === 7) {
      // Milestone 7: voyages and the season loop; Ocracoke's Trade Master.
      addMilestone7Fields(data);
      data.saveVersion = 8;
    }
    if (data.saveVersion === 8) {
      // Milestone 8: letters of marque and Legendary regard (PR 4).
      data.regard = data.regard || {};
      data.letter = data.letter || null;
      data.saveVersion = 9;
    }
    if (data.saveVersion === 9) {
      // The build 0.9 playtest pins: hardtack (P11) and the morale band notice (P7).
      data.hardtack = data.hardtack || 0;
      data.saveVersion = 10;
    }
    if (data.saveVersion === 10) {
      // Milestone 8, PR 6: imprisonment (§43) and the Secrets tab (§30.12).
      data.jail = data.jail || null; data.shipless = !!data.shipless;
      data.secretsExposed = data.secretsExposed || {}; data.fenceShut = data.fenceShut || {};
      data.saveVersion = 11;
    }
    if (data.saveVersion === 11) {
      // The build 0.9 playtest (#51): hardtack is cut; any aboard becomes
      // ordinary provisions lots.
      data.provisions = (data.provisions || 0) + (data.hardtack || 0);
      delete data.hardtack;
      data.saveVersion = 12;
    }
    if (data.saveVersion === 12) {
      // The build 0.9 playtest (#5): the Cook is the Surgeon now.
      (data.officers || []).forEach(function (o) { if (o.type === "Cook") o.type = "Surgeon"; });
      (data.captain && data.captain.mentor && data.captain.mentor.type === "Cook") && (data.captain.mentor.type = "Surgeon");
      Object.keys(data.generated || {}).forEach(function (k) { var g = data.generated[k]; if (g && g.type === "Cook") g.type = "Surgeon"; });
      data.saveVersion = 13;
    }
    if (data.saveVersion === 13) {
      // M9 PR 2: the mutiny (state.mutiny while one plays; the crew's
      // warning signs and a known ringleader).
      data.mutiny = data.mutiny || null;
      if (data.crew) { data.crew.mutinySigns = !!data.crew.mutinySigns; data.crew.ringleaderKnown = data.crew.ringleaderKnown || null; }
      data.saveVersion = 14;
    }
    if (data.saveVersion === 14) {
      // M9 PR 3: the notice board's notices, prisoners aboard, and the
      // Admiralty segments the bounties record (D3).
      data.bounties = data.bounties || null;
      data.prisoners = data.prisoners || [];
      if (data.world) data.world.segments = data.world.segments || {};
      data.saveVersion = 15;
    }
    if (data.saveVersion === 15) {
      // M9 PR 4: A Wanted Man at sea (the rumor's guarantee).
      data.wanted = data.wanted || null;
      data.saveVersion = 16;
    }
    return data;
  }

  function deserialize(text) { return migrate(JSON.parse(text)); }

  // Browser storage can be missing or blocked; never let that crash the game.
  function saveToBrowser(state) {
    try { globalThis.localStorage.setItem(STORAGE_KEY, serialize(state)); return true; }
    catch (e) { return false; }
  }

  function loadFromBrowser() {
    try {
      var t = globalThis.localStorage.getItem(STORAGE_KEY);
      return t ? deserialize(t) : null;
    } catch (e) { return null; }
  }

  function clearBrowserSave() {
    try { globalThis.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  PC.state = {
    SAVE_VERSION: SAVE_VERSION,
    SEASONS: SEASONS,
    POSTURES: POSTURES,
    rollPosture: rollPosture,
    newGame: newGame,
    seasonName: seasonName,
    stamp: stamp,
    advanceSeason: advanceSeason,
    addLog: addLog,
    serialize: serialize,
    deserialize: deserialize,
    saveToBrowser: saveToBrowser,
    loadFromBrowser: loadFromBrowser,
    clearBrowserSave: clearBrowserSave,
  };
})();
