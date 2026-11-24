/* Pirate Chronicle — text tokens and pronouns (§33.3.12).
 *
 * Authors write the male form and the engine swaps it for a woman.
 *   {captain.first} {captain.last} {captain.full}
 *   {captain.he} {captain.him} {captain.his} {captain.hers} {captain.himself}
 *   {captain.he's} {captain.he'll} {captain.he'd}
 *   {captain.man} {captain.sir} {captain.lad}
 * Capitalise the form to capitalise the word: {captain.He} -> "He" / "She".
 * The same forms work for any NPC by id: {davey_dell.he}, and for a node's
 * persistent Minors by their slot name: {keeper.he}, {shipwright.His}.
 * {shipwright.mr} gives "Mr." or "Missus".
 * Bracket tokens: [Ship Name], [Home City].
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var FORMS = {
    he: ["he", "she"],
    him: ["him", "her"],
    his: ["his", "her"],
    hers: ["his", "hers"],
    himself: ["himself", "herself"],
    "he's": ["he's", "she's"],
    "he'll": ["he'll", "she'll"],
    "he'd": ["he'd", "she'd"],
    man: ["man", "woman"],
    sir: ["sir", "madam"],
    lad: ["lad", "lass"],
    mr: ["Mr.", "Missus"], // Davey's "Mr. Shipwright" / "Missus Shipwright" (ruled)
  };

  var LOSS_TARGET = { A: "your brother", B: "your family jewels", C: "the man who shot you" };

  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function person(state, who) {
    who = who.toLowerCase();
    if (who === "mentor") {
      var m = (state.officers || []).filter(function (o) { return o.mentor && !o.gone; })[0];
      // No mentor (the test captain): a plain fallback, so his lines still read.
      return m ? { first: m.first, last: m.last || "", gender: m.gender || "m" } : { first: "your mentor", last: "", gender: "m" };
    }
    if (who === "captain") {
      var c = state.captain;
      return { first: c.first, last: c.last, gender: c.gender };
    }
    // Named NPCs from the roster, generated Minors from the save, and the
    // short slot names ({keeper.he}, {shipwright.his}) (js/npcs.js).
    if (PC.npcs) {
      var g = PC.npcs.get(state, who);
      return g ? { first: g.first, last: g.last, gender: g.gender } : null;
    }
    var n = PC.data.npcs && PC.data.npcs[who];
    if (n) return { first: n.first, last: n.last || "", gender: n.gender || "m" };
    return null;
  }

  function resolveToken(state, who, form) {
    var p = person(state, who);
    if (!p) return null;
    var lower = form.toLowerCase();
    var caps = form !== lower;
    var out;
    if (lower === "first") out = p.first;
    else if (lower === "last") out = p.last;
    else if (lower === "full") out = (p.first + " " + p.last).trim();
    else if (FORMS[lower]) out = FORMS[lower][p.gender === "f" ? 1 : 0];
    else return null;
    return caps ? capFirst(out) : out;
  }

  function render(template, state) {
    if (!template) return "";
    var s = String(template);
    s = s.replace(/\{([A-Za-z0-9_]+)\.([A-Za-z'.]+)\}/g, function (whole, who, form) {
      var r = resolveToken(state, who, form);
      return r === null ? whole : r;
    });
    s = s.replace(/\[Ship Name\]/g, state.ship.name);
    var mentor = person(state, "mentor");
    s = s.replace(/\[Mentor\]/g, mentor ? mentor.first : "your mentor");
    s = s.replace(/\[Home City\]/g, state.captain.homeCity || "your home");
    // [Loss Target] by loss variant (S17 appendix, the mentor beat).
    s = s.replace(/\[Loss Target\]/g, LOSS_TARGET[state.captain.loss] || "what you lost");
    // [Quartermaster]: the officer's first name, or the Acting Quartermaster.
    if (s.indexOf("[Quartermaster]") >= 0) {
      var q = PC.officers && PC.officers.quartermaster ? PC.officers.quartermaster(state) : null;
      s = s.replace(/\[Quartermaster\]/g, q ? (q.first || q.full) : "your Quartermaster");
    }
    // A node's computed values (js/norfolk.js): {port_fee}, {dirty_good}, {waters}.
    s = s.replace(/\{([a-z_0-9]+)\}/g, function (whole, k) {
      var f = PC.text.vars && PC.text.vars[k];
      return f ? String(f(state)) : whole;
    });
    return s;
  }

  // Tokens left unresolved after rendering (used by the content validator).
  function unresolved(text) {
    var m = String(text).match(/\{[^}]*\}|\[[A-Z][^\]]*\]/g);
    return m || [];
  }

  PC.text = { render: render, unresolved: unresolved, FORMS: FORMS, vars: (PC.text && PC.text.vars) || {} };
})();
