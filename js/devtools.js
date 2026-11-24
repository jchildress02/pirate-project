/* Pirate Chronicle — Developer tools that change the game state (§41.12).
 *
 * Skip the mandatory quests: A Dying Pirate's Wish, Welcome to the
 * Underworld and Restless & Ruined are marked done, their rewards land with
 * the default choices (gold to crew gold, Davey hired), and they no longer
 * fire on entering a location. One tool, merging §38.10's "auto-complete"
 * with the walkthrough's "skip quest content".
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var PREFIXES = ["ocr_dpw_", "ocr_uw_", "ocr_rr_"];

  // The reward step of each quest: its effects run as if the player had
  // clicked through (a scene's gold goes to crew gold, §27).
  var REWARDS = ["ocr_dpw_end", "ocr_uw_reward"];

  function skipQuests(state) {
    var done = [];
    REWARDS.forEach(function (id) {
      var s = PC.scenes.sceneById(id);
      if (state.seen[id]) return;
      var ch = s.choices[0];
      ((ch.result || {}).effects || []).forEach(function (e) {
        if (!PC.scenes.test(state, e.when)) return;
        var line = PC.scenes.applyEffect(state, e, "crew");
        if (line) PC.state.addLog(state, "  " + line);
      });
      done.push(s.title);
    });
    if (!state.flags.ocr_rr_done || state.flags.davey_at_tavern) {
      var aboard = PC.officers.aboard(state).some(function (o) { return o.id === "davey"; });
      if (!aboard) PC.officers.joinNamed(state, "davey");
      state.flags.davey_at_tavern = false;
      state.flags.ocr_rr_done = true;
      done.push("Restless & Ruined");
    }
    // Every scene of the three counts as seen, so nothing fires on entering.
    Object.keys(PC.data.scenes).forEach(function (id) {
      if (PREFIXES.some(function (p) { return id.indexOf(p) === 0; })) state.seen[id] = true;
    });
    ["ocr_dpw_done", "ocr_underworld_done", "ocr_first_tavern_done", "ocr_first_tavern_action"].forEach(function (f) { state.flags[f] = true; });
    state.flags.dpw_retry = false;
    if (state.location) state.location.queue = [];
    if (state.current && state.current.screen === "scene" && PREFIXES.some(function (p) { return (state.current.sceneId || "").indexOf(p) === 0; })) {
      state.current = { screen: "node" };
    }
    PC.state.addLog(state, "Developer: skipped the mandatory quests.");
    return done.length ? "Skipped: " + done.join(", ") + "." : "Nothing left to skip.";
  }

  // Arrive at Norfolk as if for the first time (Playtest Pins 0.8, #1): the
  // three opening beats' scenes count as unseen again, the ship moves to
  // Norfolk and the arrival runs, so beat 1's inspection fires.
  function arriveNorfolkFirst(state) {
    Object.keys(PC.data.scenes).forEach(function (id) {
      if (/^nor_(fv1|ht_)/.test(id)) delete state.seen[id];
    });
    ["nor_jailed", "saw_howe_advert"].forEach(function (f) { delete state.flags[f]; });
    state.voyage = null;
    state.location = { node: "norfolk", place: null, queue: [] };
    state.current = { screen: "node" };
    PC.node.initNode(state, "norfolk");
    PC.state.addLog(state, "Developer: arrived at Norfolk as a first visit.");
    return PC.node.arrive(state, "norfolk", {});
  }

  // Where a jumped-to scene is set (the place its menu returns to).
  function jumpPlace(id) {
    if (/^ocr_.*_(uw|oap)|^ocr_(uw|oap)|^nor_ht|^nor_godfrey|^fav_/.test(id)) return "tavern";
    if (/_rr_|^nor_appr/.test(id)) return "docks";
    return null;
  }
  function jumpNode(id) { return /^nor_|^fav_norfolk/.test(id) ? "norfolk" : /^ocr_|^fav_ocracoke/.test(id) ? "ocracoke" : null; }
  function jumpTo(state, id) {
    var node = jumpNode(id);
    if (state.location && node && state.location.node !== node) {
      state.location = { node: node, place: null, queue: [] };
      PC.node.initNode(state, node);
    }
    if (state.location) state.location.place = jumpPlace(id);
    PC.scenes.enterScene(state, id);
  }
  function jumpable() {
    return Object.keys(PC.data.scenes).filter(function (id) { return /^(ocr_|nor_|fav_)/.test(id); }).sort();
  }

  // Imprisonment (§43, M8 PR 6): jail the captain at Norfolk on a chosen
  // charge with his ship in port, or have him taken at sea by a flag.
  function jail(state, charge) {
    state.minigame = null;
    return PC.prison.enter(state, { node: "norfolk", faction: "avalon", how: "port", charge: charge });
  }
  function captured(state, flag) {
    state.minigame = null;
    return PC.prison.captureAtSea(state, { battle: { enemies: [{ id: "dev", flag: flag || "Avalon" }], target: "dev" } });
  }

  // The cell (PR 7): fill the escape points; skip to the trial.
  function fillClock(state) { return PC.escape.devFillClock(state); }
  function toTrial(state) { return PC.escape.devToTrial(state); }

  PC.devtools = { skipQuests: skipQuests, arriveNorfolkFirst: arriveNorfolkFirst, jumpTo: jumpTo, jumpable: jumpable, jumpPlace: jumpPlace, jail: jail, captured: captured, fillClock: fillClock, toTrial: toTrial };
})();
