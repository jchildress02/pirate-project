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

  PC.devtools = { skipQuests: skipQuests };
})();
