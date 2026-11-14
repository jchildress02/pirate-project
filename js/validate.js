/* Pirate Chronicle — content checker.
 *
 * Reads every scene and hub and reports mistakes before a player finds them:
 * unknown check types, DRs out of range, missing outcomes, exits that go
 * nowhere, unknown effects, tokens that don't resolve. Run by the tests, and
 * from the game's Developer panel.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var KINDS = ["check", "choice", "beat"];
  var EFFECT_KEYS = ["gold", "provisions", "treasure", "hull", "morale", "pressure", "dread", "standing", "heat",
    "ladder", "tag", "item", "ap", "flag"];
  var FACTIONS = ["frisia", "avalon", "pirates"];

  function validate(sampleState) {
    var errors = [], warnings = [];
    var d = PC.data;
    function err(where, msg) { errors.push(where + ": " + msg); }
    function warn(where, msg) { warnings.push(where + ": " + msg); }

    function checkExit(where, exit) {
      if (!exit) return err(where, "missing exit");
      if (exit !== "hub" && !d.scenes[exit]) err(where, "exit goes to unknown scene '" + exit + "'");
    }

    function checkText(where, text) {
      if (!text) return;
      var out = PC.text.render(text, sampleState);
      PC.text.unresolved(out).forEach(function (t) { err(where, "unresolved token " + t); });
    }

    function checkEffects(where, effects) {
      (effects || []).forEach(function (e) {
        var keys = Object.keys(e).filter(function (k) { return EFFECT_KEYS.indexOf(k) >= 0; });
        if (keys.length !== 1) return err(where, "effect needs exactly one known kind: " + JSON.stringify(e));
        if (e.gold < 0 && e.pot !== "crew" && e.pot !== "purse") err(where, "gold spent needs pot 'crew' or 'purse'");
        if (e.standing && FACTIONS.indexOf(e.standing.faction) < 0) err(where, "unknown faction " + e.standing.faction);
        if (e.heat && ["frisia", "avalon"].indexOf(e.heat.faction) < 0) err(where, "Heat is Frisia or Avalon only");
        if (e.ladder && !d.npcs[e.ladder.npc]) err(where, "unknown NPC " + e.ladder.npc);
      });
    }

    function checkCond(where, cond) {
      if (!cond) return;
      try { PC.scenes.test(sampleState, cond); } catch (ex) { err(where, ex.message); }
    }

    Object.keys(d.scenes).forEach(function (id) {
      var s = d.scenes[id];
      var w = "scene " + id;
      if (s.id !== id) err(w, "id field doesn't match its key");
      if (/[^a-z0-9_]/.test(id)) err(w, "IDs are plain lowercase ASCII with underscores (§33.1.3)");
      if (KINDS.indexOf(s.kind) < 0) err(w, "kind must be check, choice or beat");
      if (s.repeat && ["once", "season"].indexOf(s.repeat) < 0) err(w, "repeat must be once or season");
      checkCond(w, s.firesWhen);
      checkText(w + " setup", s.setup);
      (s.variants || []).forEach(function (v, i) { checkCond(w + " variant " + i, v.when); checkText(w + " variant " + i, v.line); });
      if (!s.choices || !s.choices.length) return err(w, "no choices");
      if (s.kind === "beat" && s.choices.length !== 1) err(w, "a beat has exactly one choice");
      if (s.kind !== "beat" && s.choices.length > 4) warn(w, s.choices.length + " choices (the template says 2-4)");
      if (s.kind === "check" && !s.choices.some(function (c) { return c.check; })) warn(w, "a check scene with no checks");
      s.choices.forEach(function (ch, i) {
        var cw = w + " choice " + (ch.id || i);
        checkText(cw + " label", ch.label);
        checkCond(cw + " lockedUnless", ch.lockedUnless);
        checkCond(cw + " hiddenUnless", ch.hiddenUnless);
        if (s.kind !== "beat" && !(ch.approval && ch.approval.length)) warn(cw, "no approval tags (§33.1.3)");
        if (ch.check) {
          if (s.kind !== "check") err(cw, "only check scenes roll");
          if (!d.checkTypes[ch.check.type]) err(cw, "unknown check type '" + ch.check.type + "'");
          ["stat", "stat2"].forEach(function (k) {
            if (ch.check[k] && PC.checks.STATS.indexOf(ch.check[k]) < 0) err(cw, "unknown stat " + ch.check[k]);
          });
          var dr = ch.check.dr;
          if (typeof dr !== "number" || dr < 0 || dr > 8) err(cw, "DR must be 0-8");
          else if (dr > 5) warn(cw, "DR " + dr + " is above the Year 1 range (0-5)");
          ["clean", "partial", "setback"].forEach(function (o) {
            var oc = ch.outcomes && ch.outcomes[o];
            if (!oc) return err(cw, "missing " + o + " outcome");
            checkText(cw + " " + o, oc.text);
            checkEffects(cw + " " + o, oc.effects);
            checkExit(cw + " " + o, oc.exit);
          });
        } else {
          if (!ch.result) return err(cw, "a choice without a check needs a result");
          checkText(cw + " result", ch.result.text);
          checkEffects(cw + " result", ch.result.effects);
          checkExit(cw + " result", ch.result.exit);
        }
      });
    });

    Object.keys(d.hubs).forEach(function (id) {
      d.hubs[id].entries.forEach(function (en) {
        if (!d.scenes[en.scene]) err("hub " + id, "entry goes to unknown scene '" + en.scene + "'");
      });
    });
    if (!d.scenes[d.start.scene]) err("start", "unknown start scene");
    if (d.start.node && !(d.nodes || {})[d.start.node]) err("start", "unknown start node");
    if (d.testStart && !d.hubs[d.testStart.hub]) err("start", "unknown test hub");

    // Nodes: slots name real roles, lines render, places exist.
    Object.keys(d.nodes || {}).forEach(function (id) {
      var n = d.nodes[id], w = "node " + id;
      (n.slots || []).forEach(function (s) {
        if (!d.names.ROLES[s.role]) err(w, "slot " + s.id + " has unknown role " + s.role);
      });
      if (n.fence && !d.npcs[n.fence.npc]) err(w, "fence NPC unknown: " + n.fence.npc);
      if (n.leader && !d.npcs[n.leader]) err(w, "leader unknown: " + n.leader);
      Object.keys((n.market || {}).demand || {}).forEach(function (g) { if (!d.goods[g]) warn(w, "demand for a good with no price: " + g); });
      Object.keys(((n.market || {}).bulk || {}).weights || {}).forEach(function (g) { if (!d.goods[g]) err(w, "stock weight for unknown good: " + g); });
      if (!d.economy.TIERS[n.tier]) err(w, "unknown prosperity tier " + n.tier);
    });

    return { errors: errors, warnings: warnings };
  }

  PC.validate = validate;
})();
