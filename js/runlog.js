/* Pirate Chronicle — the run log (the build 0.9 playtest pins, PR A).
 *
 * Records what happened in a run so a build session can see it exactly: every
 * choice the player makes, every roll (with its seeded key, so it can be
 * replayed), every screen change, a short summary of the state after each
 * choice, and any error. The Developer menu shows the count and exports it
 * as a text file to attach in the playtest chat (§37).
 *
 * Engine side only (no DOM): js/ui.js feeds it choices, screens and errors;
 * this file wraps the dice and the checks so every roll is caught wherever it
 * happens. It records only while `PC.runlog.on` is true (the game turns it
 * on; the tests and simulators leave it off).
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var MAX = 6000;            // entries kept (the oldest drop off)
  var STORE = "pirate-chronicle-runlog";
  var entries = [];
  var seq = 0;
  var lastSummary = null;
  var started = Date.now();

  function now() { return Math.round((Date.now() - started) / 1000); }

  function add(kind, text) {
    if (!api.on) return;
    seq += 1;
    entries.push({ n: seq, t: now(), k: kind, x: String(text) });
    if (entries.length > MAX) entries.splice(0, entries.length - MAX);
  }

  // ---- Rolls: every die goes through PC.rng; named checks through PC.checks.

  // While a named check is rolling, its dice are reported with the check.
  var inCheck = 0;
  function wrapDice() {
    if (!PC.rng || PC.rng._logged) return;
    var roll2d6 = PC.rng.roll2d6, rollDice = PC.rng.rollDice;
    PC.rng.roll2d6 = function (key) {
      var d = roll2d6.apply(null, arguments);
      if (!inCheck) add("dice", "2d6 " + d.join("+") + " · key " + key);
      return d;
    };
    PC.rng.rollDice = function (key, count, sides) {
      var d = rollDice.apply(null, arguments);
      add("dice", count + "d" + sides + " " + d.join(",") + " · key " + key);
      return d;
    };
    PC.rng._logged = true;
  }
  function wrapChecks() {
    if (!PC.checks || PC.checks._logged) return;
    var resolve = PC.checks.resolve;
    PC.checks.resolve = function (state, check, key, ctx) {
      inCheck++;
      var r;
      try { r = resolve.apply(null, arguments); } finally { inCheck--; }
      if (r) add("check", (check.type || "check") + " DR " + (check.dr != null ? check.dr : "?") + " · edge " + r.assessment.edge +
        " · dice " + r.dice.join("+") + " = " + r.total + " → " + r.outcome + " · key " + key);
      return r;
    };
    PC.checks._logged = true;
  }

  // ---- The state, in brief -----------------------------------------------------

  // A one-line picture of the numbers that matter; logged when it changes.
  function summary(state) {
    if (!state || !state.captain) return null;
    var p = [];
    var t = state.time || {};
    p.push((PC.state && PC.state.seasonName ? PC.state.seasonName(state) : t.season) + " " + t.year);
    if (state.location) p.push("at " + (state.location.node || "?") + (state.location.place ? "/" + state.location.place : ""));
    if (state.ap) p.push("AP " + state.ap.left);
    if (state.money) p.push("purse " + state.money.purse + " · crew gold " + state.money.crew);
    if (state.crew) p.push("crew " + state.crew.count + (state.crew.wounded ? "+" + state.crew.wounded + "w" : "") + " · morale " + state.crew.morale + " · Pressure " + (state.crew.pressure || 0));
    p.push("provisions " + (state.provisions || 0));
    if (state.ship) p.push("hull " + Math.round(state.ship.hull) + "/" + state.ship.hullMax);
    if (state.meters) {
      var m = state.meters, h = m.heat || {}, s = m.standing || {};
      p.push("Heat A" + (h.avalon || 0) + " F" + (h.frisia || 0) + " · Standing A" + (s.avalon || 0) + " F" + (s.frisia || 0) + " P" + (s.pirates || 0) + " · Dread " + (m.dread || 0));
    }
    if (state.captain.tags && state.captain.tags.length) p.push("tags " + state.captain.tags.join(", "));
    return p.join(" · ");
  }

  // ---- What js/ui.js reports ----------------------------------------------------

  function choice(name, data, screen, label) {
    var bits = Object.keys(data || {}).filter(function (k) { return k !== "act" && data[k] !== "" && data[k] != null; })
      .map(function (k) { return k + "=" + data[k]; });
    add("choice", (label ? "\"" + label + "\" · " : "") + name + (bits.length ? " (" + bits.join(", ") + ")" : "") + (screen ? " · on " + screen : ""));
  }
  function screen(key) { add("screen", key); }
  function after(state) {
    var s = summary(state);
    if (s && s !== lastSummary) { add("state", s); lastSummary = s; }
  }
  function error(text) { add("error", text); }
  function note(text) { add("note", text); }

  // ---- Keeping it across reloads, and the export ------------------------------

  function save() {
    if (!api.on) return;
    try { globalThis.localStorage.setItem(STORE, JSON.stringify({ seq: seq, entries: entries })); } catch (e) { /* storage full or blocked */ }
  }
  function load() {
    try {
      var d = JSON.parse(globalThis.localStorage.getItem(STORE) || "null");
      if (d && d.entries) { entries = d.entries; seq = d.seq || entries.length; }
    } catch (e) { /* ignore */ }
  }
  function clear() { entries = []; seq = 0; lastSummary = null; save(); }
  // A new game starts a new log.
  function newRun(state) {
    clear();
    add("note", "New game · world seed " + (state && state.world ? state.world.seed : "?"));
  }

  var KIND = { choice: "CHOICE", dice: "DICE  ", check: "CHECK ", screen: "SCREEN", state: "STATE ", error: "ERROR ", note: "NOTE  " };
  function exportText(state, build) {
    var head = [
      "Pirate Chronicle run log",
      (build || "") + " · exported " + new Date().toISOString(),
      "World seed: " + (state && state.world ? state.world.seed : "?") + " · save version " + (state ? state.saveVersion : "?"),
      "Captain: " + (state && state.captain ? (state.captain.first + " " + state.captain.last + " · loss " + (state.captain.loss || "-")) : "?"),
      "Browser: " + ((globalThis.navigator && globalThis.navigator.userAgent) || "?"),
      entries.length + " entries" + (entries.length && entries[0].n > 1 ? " (the first " + (entries[0].n - 1) + " dropped off)" : ""),
      "Times are seconds since the game was opened.",
      "",
    ];
    var body = entries.map(function (e) { return "#" + e.n + " [" + e.t + "s] " + (KIND[e.k] || e.k) + " " + e.x; });
    var tail = state && PC.state ? ["", "---- The save at export (load it to pick up the run) ----", PC.state.serialize(state)] : [];
    return head.concat(body, tail).join("\n");
  }

  var api = {
    on: false,
    start: function () { wrapDice(); wrapChecks(); load(); api.on = true; },
    newRun: newRun,
    choice: choice, screen: screen, after: after, error: error, note: note,
    save: save, clear: clear, count: function () { return entries.length; },
    entries: function () { return entries.slice(); },
    summary: summary,
    exportText: exportText,
    // For the tests: wrap without the browser's storage.
    wrap: function () { wrapDice(); wrapChecks(); },
  };
  PC.runlog = api;
})();
