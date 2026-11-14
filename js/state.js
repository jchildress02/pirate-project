/* Pirate Chronicle — game state, saving and loading.
 *
 * The whole game lives in one plain object ("the world is the save file").
 * It is saved to the browser after every action, and can be exported to a
 * .json file and imported back.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var SAVE_VERSION = 4;
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
    return state;
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
