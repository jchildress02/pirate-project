/* Pirate Chronicle — game state, saving and loading.
 *
 * The whole game lives in one plain object ("the world is the save file").
 * It is saved to the browser after every action, and can be exported to a
 * .json file and imported back.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var SAVE_VERSION = 1;
  var STORAGE_KEY = "pirate-chronicle-save";
  var SEASONS = ["Spring", "Summer", "Hurricane", "Winter"];
  var AP_PER_SEASON = 7; // §4; under review in playtesting

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // A new game from a captain template (Milestone 0 uses a fixed test
  // captain; the character creator replaces this in a later milestone).
  function newGame(captainTemplate, opts) {
    opts = opts || {};
    var c = clone(captainTemplate);
    return {
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
      npcs: {},                 // per-NPC deltas only (ladder rung, flags)
      flags: {},
      seen: {},                 // scenes finished (for "Once" scenes)
      rolls: {},                // how many times each roll point has fired
      rerollsUsed: {},          // per source, reset each season
      log: [],
      current: { screen: "scene", sceneId: opts.startScene || PC.data.start.scene, phase: "choosing" },
      settings: { showDice: false },
    };
  }

  function seasonName(state) { return SEASONS[state.time.season]; }

  function advanceSeason(state) {
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
    // (no migrations yet: version 1 is the first)
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
    newGame: newGame,
    seasonName: seasonName,
    advanceSeason: advanceSeason,
    addLog: addLog,
    serialize: serialize,
    deserialize: deserialize,
    saveToBrowser: saveToBrowser,
    loadFromBrowser: loadFromBrowser,
    clearBrowserSave: clearBrowserSave,
  };
})();
