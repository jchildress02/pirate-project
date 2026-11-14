/* Pirate Chronicle — the Articles (§26).
 *
 * The captain dictates seven terms; net Greed sets the reading (a Pirate
 * Code check when the terms are hard) and the Articles' reputation, which
 * changes crew pools everywhere. Signed once in Spring 1754 (0 AP), then
 * only at a split. Between signings a term can be loosened any time (+3
 * morale a slot), Quarter and Quarrels changed freely, and nothing
 * tightened. No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function A() { return PC.data.articles; }

  function slot(id) { return A().SLOTS.filter(function (s) { return s.id === id; })[0]; }
  function option(slotId, optId) { return slot(slotId).options.filter(function (o) { return o.id === optId; })[0]; }

  function defaults() {
    var t = {};
    A().SLOTS.forEach(function (s) { t[s.id] = s.options[0].id; });
    return t;
  }

  function greed(terms) {
    var g = 0;
    A().SLOTS.forEach(function (s) {
      var o = option(s.id, terms[s.id]);
      if (!o) throw new Error("Unknown option for " + s.name + ": " + terms[s.id]);
      if (o.greed != null) g += o.greed;
    });
    return g;
  }

  function readingFor(g) { return A().READING.filter(function (r) { return g <= r.max; })[0]; }
  function reputation(g) { return A().REPUTATION.filter(function (r) { return g <= r.max; })[0]; }

  // The current reputation band, or Fair before the first signing.
  function currentReputation(state) {
    return reputation(state.articles ? state.articles.greed : 0);
  }

  // Sign the Articles. Returns what happened for the screen.
  function sign(state, terms) {
    if (state.articles) throw new Error("The Articles are signed. New terms wait for the next split.");
    var g = greed(terms);
    var rd = readingFor(g);
    var out = { greed: g, outcome: "accepted", effects: [] };
    var approvals = [];
    A().SLOTS.forEach(function (s) { approvals = approvals.concat(option(s.id, terms[s.id]).approval || []); });
    if (rd.cheer) {
      PC.crew.addMorale(state, rd.cheer);
      out.outcome = "cheered";
      out.effects.push("Crew morale +" + rd.cheer);
    } else if (rd.dr != null) {
      var key = [state.world.seed, PC.state.stamp(state), "articles", "reading"].join("|");
      var check = { type: "Pirate Code", dr: rd.dr };
      var r = PC.checks.resolve(state, check, key);
      out.roll = r;
      out.check = check;
      out.outcome = r.outcome;
      var eff = r.outcome === "clean" ? null : rd[r.outcome];
      if (eff) {
        if (eff.morale) { PC.crew.addMorale(state, eff.morale); out.effects.push("Crew morale " + eff.morale); }
        if (eff.pressure) { state.crew.pressure += eff.pressure; out.effects.push("Crew pressure +" + eff.pressure); }
      }
    }
    state.articles = {
      terms: JSON.parse(JSON.stringify(terms)),
      greed: g,
      signed: { year: state.time.year, season: state.time.season },
      reading: out.outcome,
      approvals: approvals, // recorded for the officers' approval system (§25.4); not read yet
    };
    PC.state.addLog(state, "Signed the Articles (net Greed " + (g > 0 ? "+" : "") + g + ", " + reputation(g).name + "): " + out.outcome + ".");
    return out;
  }

  // What a change to one slot would do between signings (§26.6).
  function amendCheck(state, slotId, optId) {
    if (!state.articles) return { ok: false, why: "Sign the Articles first" };
    var s = slot(slotId);
    var cur = option(slotId, state.articles.terms[slotId]);
    var next = option(slotId, optId);
    if (!next) return { ok: false, why: "Unknown option" };
    if (cur.id === next.id) return { ok: false, why: "Already in force" };
    if (s.noGreed) return { ok: true, morale: 0 };
    if (next.greed < cur.greed) return { ok: true, morale: A().LOOSEN_MORALE };
    return { ok: false, why: "Harder terms wait for the next split" };
  }

  function amend(state, slotId, optId) {
    var c = amendCheck(state, slotId, optId);
    if (!c.ok) throw new Error(c.why);
    state.articles.terms[slotId] = optId;
    state.articles.greed = greed(state.articles.terms);
    if (c.morale) PC.crew.addMorale(state, c.morale);
    var o = option(slotId, optId);
    state.articles.approvals = (state.articles.approvals || []).concat(o.approval || []);
    PC.state.addLog(state, "Changed the Articles: " + slot(slotId).name + " is now " + o.label + (c.morale ? " (+" + c.morale + " morale)" : "") + ".");
    return c;
  }

  PC.articles = {
    slot: slot,
    option: option,
    defaults: defaults,
    greed: greed,
    readingFor: readingFor,
    reputation: reputation,
    currentReputation: currentReputation,
    sign: sign,
    amendCheck: amendCheck,
    amend: amend,
  };
})();
