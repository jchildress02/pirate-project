/* Pirate Chronicle — the end-of-prototype summary (§37.1; ruled in the
 * Milestone 6 chat, R5). The prototype ends here: when the player stops,
 * or when the captain is captured or killed (the old game over screen,
 * absorbed). No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  // End the run: how is "stopped", "captured" or "died".
  function end(state, how) {
    var go = state.gameOver || null;
    state.ended = { how: how || (go ? (go.how === "died" ? "died" : "captured") : "stopped"), from: state.current, at: { year: state.time.year, season: state.time.season } };
    state.current = { screen: "end" };
    PC.state.addLog(state, state.ended.how === "stopped" ? "— The end of the prototype. —" : state.ended.how === "year" ? "— The end of the year. —" : "— Your story ends here. —");
    return state.ended;
  }

  // Developer mode's Keep playing: back to where the run stopped, with the
  // season's actions topped up. A captured or dead captain can't go on.
  function keepPlaying(state) {
    if (!state.ended || (state.ended.how !== "stopped" && state.ended.how !== "year")) throw new Error("This captain's story is over.");
    // Past the end of 1754 (Milestone 7): on into Spring 1755.
    if (state.ended.how === "year") {
      state.keepPlaying = true;
      PC.state.advanceSeason(state);
      state.splitWinter = null;
      state.ended = null;
      state.current = { screen: "node" };
      if (state.location) state.location.place = null;
      return;
    }
    state.current = state.ended.from && state.ended.from.screen !== "end" ? state.ended.from : { screen: "node" };
    state.ended = null;
    state.ap.left = state.ap.max;
  }

  function leadCount(state, id) { var q = (state.quests || {})[id]; return q && q.leads ? q.leads.length : 0; }

  // A Reputation-style line about the captain (R5): the first Reputation
  // rumor that fits him, or a placeholder for a captain nobody talks about.
  function reputationLine(state) {
    var c = PC.rumors.candidatesOf(state, "Reputation").filter(function (x) { return !x.line.newcomer && x.line.id !== "rep_asking"; })[0];
    if (c) return PC.rumors.render(state, c.line, c.ctx);
    return PC.data.endLines ? PC.data.endLines.nobody : "";
  }

  function yearRecap(state) {
    var y = state.yearStart || {};
    return { year: state.time.year, prizes: (state.records.prizes || 0) - (y.prizes || 0), purse: state.money.purse - (y.purse || 0),
      split: !!state.splitDone, tradeShip: state.tradeShip ? (state.tradeShip.ship.name || state.tradeShip.ship.cls) : null,
      visited: Object.keys(state.nodes || {}).filter(function (n) { return PC.data.nodes[n] && PC.data.nodes[n].kind !== "ocean"; }).map(function (n) { return PC.data.nodes[n].name; }) };
  }

  function summary(state) {
    var e = state.ended || { how: "stopped" };
    var start = state.records.startTags;
    var tags = state.captain.tags || [];
    return {
      how: e.how,
      season: PC.state.seasonName ? PC.state.seasonName(state) + " " + state.time.year : String(state.time.year),
      captain: (state.captain.first + " " + (state.captain.last || "")).trim(),
      ship: { name: state.ship.name, type: state.ship.type },
      purse: state.money.purse, crew: state.money.crew,
      // The captain's worth (§27.9) is purse, stash and holdings; the
      // prototype has only the purse.
      worth: state.money.purse,
      prizes: state.records.prizes || 0, hullsSold: state.records.hullsSold || 0,
      dread: state.meters.dread,
      standing: state.meters.standing, heat: state.meters.heat,
      // Temporary tags (Careened, a Hangover) aren't earned.
      tags: (start ? tags.filter(function (t) { return start.indexOf(t) < 0; }) : tags.slice()).filter(function (t) { return !((state.captain.tagsUntil || {})[t]); }),
      tagsAreNew: !!start,
      leads: { loss: leadCount(state, "what_was_lost"), lossNeeded: PC.data.quests.what_was_lost.needed, haven: leadCount(state, "hidden_haven"), havenNeeded: PC.data.quests.hidden_haven.needed },
      reputation: reputationLine(state),
      // The year's numbers for the end-of-year screen (Milestone 7).
      year: yearRecap(state),
    };
  }

  PC.summary = { end: end, keepPlaying: keepPlaying, summary: summary };
})();
