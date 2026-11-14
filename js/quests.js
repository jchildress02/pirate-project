/* Pirate Chronicle — quest leads and the journal (§12.5, §30.6, §30.7).
 *
 * A quest record lives in state.quests by id; leads are ids in its list.
 * The journal's wording is the UI chat's job (§37.9): until then each entry
 * is a plain placeholder line from content/quests.js.
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function Q(id) { var q = PC.data.quests[id]; if (!q) throw new Error("Unknown quest: " + id); return q; }

  function record(state, id) {
    state.quests = state.quests || {};
    if (!state.quests[id]) {
      state.quests[id] = { status: "open", leads: [] };
      if (id === "what_was_lost") state.quests[id].variant = state.captain.loss || null;
    }
    return state.quests[id];
  }

  function hasLead(state, quest, lead) {
    var r = state.quests && state.quests[quest];
    return !!(r && r.leads.indexOf(lead) >= 0);
  }

  function addLead(state, quest, lead) {
    var q = Q(quest);
    if (!q.leads[lead]) throw new Error("Unknown lead: " + quest + "/" + lead);
    var r = record(state, quest);
    if (r.leads.indexOf(lead) >= 0) return false;
    r.leads.push(lead);
    PC.state.addLog(state, "Journal: " + q.name + ", a lead (" + r.leads.length + " of " + q.needed + ").");
    return true;
  }

  // The journal: every open quest, its leads heard, and where the trail goes.
  function journal(state) {
    return Object.keys(state.quests || {}).filter(function (id) { return PC.data.quests[id]; }).map(function (id) {
      var q = Q(id), r = state.quests[id];
      var entries = r.leads.map(function (l) {
        var e = q.leads[l].journal;
        return typeof e === "string" ? e : (e[state.captain.loss] || e.any || "");
      });
      var hereLeft = Object.keys(q.leads).filter(function (l) {
        var ld = q.leads[l];
        return ld.node === "ocracoke" && (!ld.variants || ld.variants.indexOf(state.captain.loss) >= 0) && r.leads.indexOf(l) < 0;
      });
      return {
        id: id, name: q.name, status: r.status, leads: r.leads.length, needed: q.needed,
        summary: typeof q.summary === "string" ? q.summary : (q.summary[state.captain.loss] || ""),
        entries: entries,
        // The prototype carries only Ocracoke's beats (§37.5).
        beyond: r.leads.length > 0 && !hereLeft.length ? q.beyond : null,
      };
    });
  }

  PC.quests = { record: record, addLead: addLead, hasLead: hasLead, journal: journal };
})();
