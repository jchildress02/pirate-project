/* Pirate Chronicle — text tokens and pronouns (§33.3.12).
 *
 * Authors write the male form and the engine swaps it for a woman.
 *   {captain.first} {captain.last} {captain.full}
 *   {captain.he} {captain.him} {captain.his} {captain.hers} {captain.himself}
 *   {captain.he's} {captain.he'll} {captain.he'd}
 *   {captain.man} {captain.sir} {captain.lad}
 * Capitalise the form to capitalise the word: {captain.He} -> "He" / "She".
 * The same forms work for any NPC by id: {davey_dell.he}.
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
  };

  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function person(state, who) {
    if (who === "captain") {
      var c = state.captain;
      return { first: c.first, last: c.last, gender: c.gender };
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
    s = s.replace(/\{([a-z0-9_]+)\.([A-Za-z']+)\}/g, function (whole, who, form) {
      var r = resolveToken(state, who, form);
      return r === null ? whole : r;
    });
    s = s.replace(/\[Ship Name\]/g, state.ship.name);
    s = s.replace(/\[Home City\]/g, state.captain.homeCity || "your home");
    return s;
  }

  // Tokens left unresolved after rendering (used by the content validator).
  function unresolved(text) {
    var m = String(text).match(/\{[^}]*\}|\[[A-Z][^\]]*\]/g);
    return m || [];
  }

  PC.text = { render: render, unresolved: unresolved, FORMS: FORMS };
})();
