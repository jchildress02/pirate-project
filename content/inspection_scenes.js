/* Pirate Chronicle — the general arrival inspection (§28.5; Milestone 8, PR 3).
 *
 * Plays when an inspection finds a dirty hold at an Admiralty or governor
 * port (js/inspections.js). Norfolk's first arrival has its own written
 * scene (records §5); this is the slimmed version for every later
 * inspection. Every line is a PLACEHOLDER for the author (PH25).
 *
 * The rules: the bribe before the search is 4× the port fee at an
 * Admiralty port (2× at a governor's), Bribe DR 1 +1; after the goods are
 * found, half their fence value (a quarter), DR 1 +2; a partial doubles it.
 * Heat's DR step joins Bribe and Ship Concealment by itself (§28.4, D6).
 * "Take it, then" confiscates with Heat +5 and never jails, and locks above
 * the jail threshold. A setback confiscates, Heat +5, fines the port fee
 * again, and jails above the threshold.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};
  PC.data.scenes = PC.data.scenes || {};

  PC.data.inspectionRules = {
    // §28.4's table: Admiralty ports from Heat 20.
    CHANCE: { "Cold": 0, "Noticed": 0.10, "Wanted": 0.25, "Hunted": 0.50, "Most Wanted": 0.75 },
    GOVERNOR_FROM: 40, GOVERNOR_MULT: 0.5,           // governor ports: half the chance, from Heat 40
    BRIBE_BEFORE: { admiralty: 4, governor: 2 },      // × the port fee
    BRIBE_FOUND: { admiralty: 0.5, governor: 0.25 },  // × the fence value of the goods found
    BRIBE_FOUND_MIN: 20,                              // the floor on the found bribe (PH23, ruled D6)
    JAIL_ABOVE: { admiralty: 1500, governor: 3000 },  // fence value of the goods found
    HEAT_CONFISCATED: 5,
    lines: {
      clean: "PLACEHOLDER: Customs men come aboard and poke through your hold. They find nothing worth their time.",
    },
  };

  var scenes = {};
  function S(id, o) {
    o.id = id; o.ap = o.ap || 0; o.repeat = o.repeat || "always"; o.kind = o.kind || "check";
    o.title = o.title || "Customs"; o.where = o.where || "The docks";
    o.conditions = o.conditions || ["Harbor", "Official"];
    o.choices.forEach(function (c, i) { c.id = c.id || "c" + i; c.approval = c.approval || []; });
    scenes[id] = o;
  }
  function R(text, effects, exit, more) { return Object.assign({ text: text || "", effects: effects || [], exit: exit || "hub" }, more || {}); }
  function K(label, approval, check, clean, partial, setback, more) {
    return Object.assign({ label: label, approval: approval, check: check, outcomes: { clean: clean, partial: partial, setback: setback } }, more || {});
  }
  function C(label, approval, result, more) { return Object.assign({ label: label, approval: approval, result: result }, more || {}); }

  var LEAVE = "PLACEHOLDER: The officer tucks his ledger under his arm and leads his men back down the gangplank.";
  var PAID = "PLACEHOLDER: The pouch disappears into his coat. \"Everything appears to be in order, Captain.\"";
  var afford = function (what, mult) { return { lockedUnless: { fn: "inspAfford:" + what + ":" + mult }, lockedReason: "Not enough gold" }; };
  var take = C("Take it, then.", ["Retreat"], R("{insp_take_line}", [{ hook: "insp_take" }]),
    { lockedUnless: { fn: "inspUnder" }, lockedReason: "Too much to walk away from" });
  var bribeFound = K("PLACEHOLDER: Surely there's a fee for the paperwork. ({insp_found})", ["Caution"], { type: "Bribe", dr: 3 },
    R(PAID, [{ hook: "insp_pay", what: "found", mult: 1 }]),
    R("PLACEHOLDER: He lowers his voice. \"Double.\"", [], "insp_double_found", { carry: true }),
    R("", [], "insp_setback"),
    afford("found", 1));

  S("insp_search", {
    setup: "PLACEHOLDER: Customs officers come down the dock as your crew makes fast. Their officer opens his ledger. \"Orders from the Admiralty, Captain. We'll be searching your hold.\"",
    manyChoices: true,
    choices: [
      C("Search away.", ["Caution"], R("", [], "insp_found")),
      K("PLACEHOLDER: I think I owe a little more on the port fee. ({insp_before})", ["Caution"], { type: "Bribe", dr: 2 },
        R(PAID, [{ hook: "insp_pay", what: "before", mult: 1 }]),
        R("PLACEHOLDER: He lowers his voice. \"Double.\"", [], "insp_double_before", { carry: true }),
        R("PLACEHOLDER: \"Put your purse away, Captain.\" His men head for your hatch.", [], "insp_found"),
        afford("before", 1)),
      K("PLACEHOLDER: We've been searched twice this month. Surely you have better uses for your men.", ["Deceit"], { type: "Persuade", dr: 2 },
        R(LEAVE),
        R("PLACEHOLDER: \"Nice try.\" His men head for your hatch.", [], "insp_found"),
        R("PLACEHOLDER: \"Now I'm curious.\" His men head for your hatch.", [], "insp_found")),
      K("PLACEHOLDER: Cast off before they reach the gangplank.", ["Risk"], { type: "Ship Concealment", dr: 2 },
        R("PLACEHOLDER: By the time they reach your berth, you're halfway across the harbor with another ship between you. They don't bother coming after you."),
        R("PLACEHOLDER: They catch your lines before you're clear, and come aboard red-faced.", [], "insp_found"),
        R("PLACEHOLDER: A guard boat cuts you off. They come aboard red-faced.", [], "insp_found")),
    ],
  });

  S("insp_double_before", {
    setup: "PLACEHOLDER: He lowers his voice. \"Double.\"",
    choices: [
      C("Deal. ({insp_before_2})", ["Caution"], R(PAID, [{ hook: "insp_pay", what: "before", mult: 2 }]), afford("before", 2)),
      C("That's too much.", ["Defiance"], R("PLACEHOLDER: \"Then we search.\"", [], "insp_found")),
    ],
  });

  S("insp_found", {
    manyChoices: true,
    setup: "PLACEHOLDER: His men come up from your hold carrying a crate of {insp_crate}. \"No customs seal on this, Captain.\"",
    choices: [
      take,
      bribeFound,
      K("PLACEHOLDER: That's a clerk's mistake, nothing more. Check your ledger again.", ["Deceit"], { type: "Persuade", dr: 3 },
        R("PLACEHOLDER: He frowns at his ledger for a long moment, then waves his men off. \"Keep it below decks.\""),
        R("PLACEHOLDER: He glances along the dock. \"I might be persuaded.\"", [], "insp_limited", { carry: true }),
        R("", [], "insp_setback")),
    ],
  });

  S("insp_limited", {
    setup: "PLACEHOLDER: He glances along the dock. \"I might be persuaded.\"",
    choices: [take, bribeFound],
  });

  S("insp_double_found", {
    setup: "PLACEHOLDER: He lowers his voice. \"Double.\"",
    choices: [
      C("Deal. ({insp_found_2})", ["Caution"], R(PAID, [{ hook: "insp_pay", what: "found", mult: 2 }]), afford("found", 2)),
      take,
      C("That's too much.", ["Defiance"], R("", [], "insp_setback")),
    ],
  });

  // The setback: confiscation, Heat +5, the fee again; jail above the
  // threshold (to the end screen until §43 is built, PR 6).
  S("insp_setback", {
    kind: "beat",
    setup: [
      { when: { fn: "inspUnder" }, text: "PLACEHOLDER: \"Smuggling is a serious matter, Captain.\" His men haul the goods away, and he writes out a fine." },
      { when: { not: { fn: "inspUnder" } }, text: "PLACEHOLDER: \"This much contraband? You're coming with us, Captain.\" Soldiers seize you by the arms as your crew looks on." },
    ],
    choices: [C("Continue", [], R("", [{ hook: "insp_setback" }], [{ when: { fn: "inspUnder" }, to: "hub" }, "end"]))], // the exit is read before the effects land
  });

  Object.keys(scenes).forEach(function (id) { PC.data.scenes[id] = scenes[id]; });

  // Shown at each port's arrival banner (§41.1), wherever an inspection plays.
  Object.keys(PC.data.nodes || {}).forEach(function (n) {
    var pr = PC.data.nodes[n].present;
    if (!pr || !pr.scenes || !(pr.places || {}).arrival) return;
    Object.keys(scenes).forEach(function (id) { pr.scenes[id] = pr.scenes[id] || { place: "arrival" }; });
  });
})();
