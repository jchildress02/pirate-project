/* Pirate Chronicle — quest leads and the journal (§12.5, §30.6, §30.7).
 *
 * A quest record lives in state.quests by id; leads are ids in its list.
 * The journal's wording is §41.14, in content/quests.js.
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
    state.journalDot = true; // the Journal button's dot (§41.12)
    PC.state.addLog(state, "Journal: " + q.name + ", a lead (" + r.leads.length + " of " + q.needed + ").");
    return true;
  }

  // The journal (§41.12, §41.14): every quest with its one-line objective,
  // its leads, where the trail goes and its deadline.
  function seasonIdx(year, season) { return year * 4 + season; }
  function nowIdx(state) { return seasonIdx(state.time.year, state.time.season); }
  function deadlineOf(q) { return q.deadline ? seasonIdx(q.deadline.year, q.deadline.season) : null; }
  function deadlineLine(q) {
    return q.deadline ? "By the end of " + PC.state.SEASONS[q.deadline.season] + " " + q.deadline.year : null;
  }

  // The loss quest is delivered at creation whether or not it is pursued
  // (§16.2), so it is in the journal before its first lead.
  function ids(state) {
    var list = Object.keys(state.quests || {}).filter(function (id) { return PC.data.quests[id]; });
    if (state.captain && state.captain.loss && list.indexOf("what_was_lost") < 0) list.unshift("what_was_lost");
    return list;
  }

  // The Trident's hunting waters (§30.6), seeded per world (ruled November
  // 18): the Hatteras Banks or the Bahama Channel. She can be met on a hunt
  // from any port on those waters (§22.1).
  function tridentWaters(state) {
    var W = PC.data.hunt.WATERS;
    var k = PC.rng.fromKey(state.world.seed + "|trident-waters")() < 0.5 ? "north" : "south";
    return { id: k, name: W[k].name };
  }
  function leadText(state, t) { return String(t || "").replace(/\[Trident Waters\]/g, tridentWaters(state).name); }

  function journal(state) {
    var out = ids(state).map(function (id) {
      var q = Q(id), r = (state.quests || {})[id] || { status: "open", leads: [] }, v = state.captain.loss;
      var entries = r.leads.map(function (l) {
        var e = q.leads[l].journal;
        return leadText(state, typeof e === "string" ? e : (e[v] || e.any || ""));
      });
      var hereLeft = Object.keys(q.leads).filter(function (l) {
        var ld = q.leads[l];
        return ld.node === "ocracoke" && (!ld.variants || ld.variants.indexOf(v) >= 0) && r.leads.indexOf(l) < 0;
      });
      var summary = typeof q.summary === "string" ? q.summary : (q.summary[v] || "");
      // The prototype carries only Ocracoke's beats (§37.5).
      var beyond = r.leads.length > 0 && !hereLeft.length ? q.beyond : null;
      var step = q.here && hereLeft.length ? q.here[v] : beyond;
      var dl = deadlineOf(q);
      return {
        id: id, name: q.name, status: r.status, leads: r.leads.length, needed: q.needed,
        summary: step ? summary : "", objective: step || summary,
        entries: entries, beyond: step === beyond ? null : beyond,
        deadline: r.status !== "done" ? deadlineLine(q) : null,
        lastSeason: dl != null && nowIdx(state) === dl,
      };
    });
    return startupJournal(state).concat(out);
  }

  // The startup quests read their scenes and flags (content/quests.js).
  function inScene(state, prefix, before) {
    var c = state.current;
    return !!(c && c.screen === "scene" && c.sceneId && c.sceneId.indexOf(prefix) === 0 && (before || []).indexOf(c.sceneId) < 0);
  }
  function seenAny(state, prefix, before) {
    return Object.keys(state.seen || {}).some(function (k) { return k.indexOf(prefix) === 0 && (before || []).indexOf(k) < 0; });
  }
  function startupJournal(state) {
    var S = PC.data.startupQuests || {}, f = state.flags, out = [];
    var entry = function (key, status, objective) {
      return { id: key, name: S[key].name, status: status, leads: 0, needed: 0, summary: "", objective: objective, entries: [], beyond: null, deadline: null };
    };
    var w = S.dying_wish;
    if (w && (f[w.done] || inScene(state, w.scenes, w.beforeOffer) || seenAny(state, w.scenes, w.beforeOffer))) {
      if (f[w.done]) out.push(entry("dying_wish", "done", w.doneLine));
      else {
        var atYard = (state.seen || {}).ocr_dpw_4 || (inScene(state, w.scenes) && /Graveyard/.test((PC.data.scenes[state.current.sceneId] || {}).where || ""));
        out.push(entry("dying_wish", "open", f.dpw_retry ? w.steps.retry : atYard ? w.steps.dive : w.steps.follow));
      }
    }
    var u = S.underworld;
    if (u && (f[u.done] || inScene(state, u.scenes, u.beforeOffer) || seenAny(state, u.scenes, u.beforeOffer))) {
      out.push(f[u.done] ? entry("underworld", "done", u.doneLine) : entry("underworld", "open", u.steps.collect));
    }
    // A Wanted Man (Norfolk Scene Records §3): assigned at Key's introduction.
    // D2: Freddy isn't at sea until Milestone 9 (PH29).
    var wm = S.a_wanted_man;
    if (wm && f.a_wanted_man_assigned) out.push(f.a_wanted_man_done ? entry("a_wanted_man", "done", wm.doneLine) : entry("a_wanted_man", "open", wm.steps.assigned));
    var rr = S.restless;
    if (rr && PC.officers) {
      var aboard = PC.officers.aboard ? PC.officers.aboard(state).some(function (o) { return o.id === "davey"; }) : false;
      if (aboard) out.push(entry("restless", "done", rr.doneLine));
      else if (f.davey_at_tavern) out.push(entry("restless", "open", (state.seen || {}).ocr_rr_tab && !f.rr_paid ? rr.steps.tab : rr.steps.waiting));
    }
    return out;
  }

  // A quest whose deadline falls this season gets one warning, at the start
  // of that season (§41.12). Returns the quests to warn about now.
  function expiringNow(state) {
    var now = nowIdx(state);
    return ids(state).filter(function (id) {
      var q = PC.data.quests[id], r = (state.quests || {})[id] || {};
      return r.status !== "done" && deadlineOf(q) === now && r.warned !== now;
    }).map(function (id) { record(state, id).warned = now; return Q(id).name; });
  }

  PC.quests = { tridentWaters: tridentWaters, leadText: leadText, record: record, addLead: addLead, hasLead: hasLead, journal: journal, expiringNow: expiringNow };
})();
