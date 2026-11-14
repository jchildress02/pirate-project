/* Pirate Chronicle — the scene runner.
 *
 * Scenes are data (content/*.js), written to the §33 template:
 *   setup text, 2-4 choices, each with an optional check and outcomes
 *   (clean / partial / setback, or a single result), effects, and an exit.
 * This file reads that data, rolls checks, applies effects and moves on.
 * It never touches the screen; ui.js asks it what to show.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function sceneById(id) {
    var s = PC.data.scenes[id];
    if (!s) throw new Error("Unknown scene: " + id);
    return s;
  }

  // ---- Conditions ------------------------------------------------------
  // Used by "fires when", choice gates (locked / hidden) and variant lines.
  //   { flag: "x" }            flag is true
  //   { notFlag: "x" }         flag is not true
  //   { tag: "Brute" }         captain has the tag (also trait / flaw / item)
  //   { trait: "..." } { flaw: "..." } { item: "..." }
  //   { notTag: "..." }
  //   { season: "Spring" }     or a list: { season: ["Spring", "Summer"] }
  //   { gold: { pot: "crew", atLeast: 20 } }
  //   { gender: "f" }          the captain's
  //   { all: [...] } { any: [...] } { not: {...} }
  function test(state, cond) {
    if (!cond) return true;
    if (Array.isArray(cond)) return cond.every(function (c) { return test(state, c); });
    var c = state.captain;
    if (cond.all) return cond.all.every(function (x) { return test(state, x); });
    if (cond.any) return cond.any.some(function (x) { return test(state, x); });
    if (cond.not) return !test(state, cond.not);
    if (cond.flag) return state.flags[cond.flag] === true;
    if (cond.notFlag) return state.flags[cond.notFlag] !== true;
    if (cond.tag) return (c.tags || []).indexOf(cond.tag) >= 0;
    if (cond.notTag) return (c.tags || []).indexOf(cond.notTag) < 0;
    if (cond.trait) return (c.traits || []).indexOf(cond.trait) >= 0;
    if (cond.flaw) return (c.flaws || []).indexOf(cond.flaw) >= 0;
    if (cond.item) return (c.items || []).indexOf(cond.item) >= 0;
    if (cond.gender) return c.gender === cond.gender;
    if (cond.season) {
      var s = PC.state.seasonName(state);
      return Array.isArray(cond.season) ? cond.season.indexOf(s) >= 0 : cond.season === s;
    }
    if (cond.gold) return (state.money[cond.gold.pot] || 0) >= cond.gold.atLeast;
    throw new Error("Unknown condition: " + JSON.stringify(cond));
  }

  // ---- Entering and leaving scenes ------------------------------------

  function canEnter(state, id) {
    var s = sceneById(id);
    if (s.repeat !== "season" && state.seen[id]) return { ok: false, why: "Already done" };
    if (s.repeat === "season" && state.seen[id] === seasonStamp(state)) return { ok: false, why: "Done this season" };
    if (!test(state, s.firesWhen)) return { ok: false, why: "Not available" };
    if ((s.ap || 0) > state.ap.left) return { ok: false, why: "Not enough time this season" };
    return { ok: true };
  }

  function seasonStamp(state) { return state.time.year + "-" + state.time.season; }

  function enterScene(state, id) {
    var s = sceneById(id);
    if (s.ap) state.ap.left -= s.ap;
    state.current = { screen: "scene", sceneId: id, phase: "choosing", pending: null };
  }

  function goTo(state, exit) {
    if (!exit || exit === "hub") {
      state.current = { screen: "hub", hubId: PC.data.start.hub };
      return;
    }
    enterScene(state, exit);
  }

  // ---- What the player sees -------------------------------------------

  function setupText(state, s) {
    var text = s.setup || "";
    (s.variants || []).forEach(function (v) {
      if (!test(state, v.when)) return;
      if (v.replace) text = text.split(v.replace).join(v.line);
      else text = text + "\n\n" + v.line;
    });
    return PC.text.render(text, state);
  }

  function costProblem(state, cost) {
    if (!cost) return null;
    if (cost.gold && (state.money[cost.pot || "crew"] || 0) < cost.gold) {
      return "Needs " + cost.gold + " gold (" + (cost.pot === "purse" ? "your purse" : "crew gold") + ")";
    }
    return null;
  }

  function choiceView(state, s, ch, index) {
    var v = { index: index, label: PC.text.render(ch.label, state), status: "open", reason: null, check: null, cost: ch.cost || null };
    if (ch.hiddenUnless && !test(state, ch.hiddenUnless)) v.status = "hidden";
    else if (ch.lockedUnless && !test(state, ch.lockedUnless)) { v.status = "locked"; v.reason = ch.lockedReason || "Locked"; }
    else {
      var cp = costProblem(state, ch.cost);
      if (cp) { v.status = "locked"; v.reason = cp; }
    }
    if (ch.check && v.status !== "hidden") {
      v.check = PC.checks.assess(state, ch.check, { conditions: s.conditions || [] });
      if (v.status === "open" && v.check.locked) { v.status = "locked"; v.reason = "Needs a tag or a clock"; }
    }
    return v;
  }

  function viewScene(state) {
    var s = sceneById(state.current.sceneId);
    var view = {
      id: s.id, kind: s.kind, title: s.title || "", where: s.where || "",
      setup: setupText(state, s),
      choices: s.choices.map(function (ch, i) { return choiceView(state, s, ch, i); })
                        .filter(function (c) { return c.status !== "hidden"; }),
      phase: state.current.phase,
      result: null,
    };
    if (state.current.phase === "result") view.result = resultView(state, s);
    return view;
  }

  function outcomeFor(ch, outcome) {
    if (!ch.check) return ch.result;
    return ch.outcomes[outcome];
  }

  function resultView(state, s) {
    var p = state.current.pending;
    var ch = s.choices[p.choiceIndex];
    var o = outcomeFor(ch, p.outcome);
    var reroll = ch.check ? PC.checks.availableReroll(state, ch.check, p.outcome) : null;
    if (p.rerolled) reroll = null; // at most one reroll per roll
    return {
      choiceLabel: PC.text.render(ch.label, state),
      outcome: p.outcome, // "clean" | "partial" | "setback" | "result"
      roll: p.roll || null,
      firstRoll: p.firstRoll || null,
      text: PC.text.render(o.text, state),
      effects: (o.effects || []).map(function (e) { return describeEffect(state, e); }),
      needsPot: (o.effects || []).some(function (e) { return e.gold > 0 && (!e.pot || e.pot === "prompt"); }),
      reroll: reroll,
    };
  }

  // ---- Making a choice -------------------------------------------------

  function rollKey(state, sceneId, choiceId) {
    var point = sceneId + "|" + choiceId;
    var n = state.rolls[point] || 0;
    state.rolls[point] = n + 1;
    return [state.world.seed, state.time.year, state.time.season, point, n].join("|");
  }

  function choose(state, index) {
    if (state.current.phase !== "choosing") throw new Error("Not choosing right now.");
    var s = sceneById(state.current.sceneId);
    var ch = s.choices[index];
    if (!ch) throw new Error("No such choice.");
    var v = choiceView(state, s, ch, index);
    if (v.status !== "open") throw new Error("That choice is " + v.status + ".");

    if (ch.cost && ch.cost.gold) state.money[ch.cost.pot || "crew"] -= ch.cost.gold;

    var pending = { choiceIndex: index, outcome: "result" };
    if (ch.check) {
      var key = rollKey(state, s.id, ch.id || index);
      var r = PC.checks.resolve(state, ch.check, key, { conditions: s.conditions || [] });
      pending.outcome = r.outcome;
      pending.roll = { dice: r.dice, total: r.total, edge: r.assessment.edge, tier: r.assessment.tier, type: ch.check.type };
      pending.key = key;
    }
    state.current.phase = "result";
    state.current.pending = pending;
  }

  function reroll(state) {
    var s = sceneById(state.current.sceneId);
    var p = state.current.pending;
    var ch = s.choices[p.choiceIndex];
    var r = PC.checks.availableReroll(state, ch.check, p.outcome);
    if (!r || p.rerolled) throw new Error("No reroll available.");
    state.rerollsUsed[r.id] = (state.rerollsUsed[r.id] || 0) + 1;
    var res = PC.checks.resolve(state, ch.check, p.key + "|reroll", { conditions: s.conditions || [] });
    p.firstRoll = { roll: p.roll, outcome: p.outcome, by: r.name };
    p.outcome = res.outcome; // the new result stands
    p.roll = { dice: res.dice, total: res.total, edge: res.assessment.edge, tier: res.assessment.tier, type: ch.check.type };
    p.rerolled = true;
  }

  // Apply the outcome's effects and follow its exit. `pot` answers the
  // purse-or-crew prompt for any gold gained ("purse" or "crew").
  function commit(state, pot) {
    var s = sceneById(state.current.sceneId);
    var p = state.current.pending;
    var ch = s.choices[p.choiceIndex];
    var o = outcomeFor(ch, p.outcome);
    PC.state.addLog(state, PC.text.render(ch.label, state) + " — " + labelFor(p.outcome));
    (o.effects || []).forEach(function (e) {
      var line = applyEffect(state, e, pot);
      if (line) PC.state.addLog(state, "  " + line);
    });
    state.seen[s.id] = s.repeat === "season" ? seasonStamp(state) : true;
    goTo(state, o.exit);
  }

  function labelFor(outcome) {
    return { clean: "clean success", partial: "partial success", setback: "setback", result: "done" }[outcome];
  }

  // ---- Effects (§33.1.4) ----------------------------------------------

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function signed(n) { return (n > 0 ? "+" : "") + n; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var FACTIONS = { frisia: "Frisia", avalon: "Avalon", pirates: "the pirates" };

  function describeEffect(state, e) {
    if ("gold" in e) {
      var where = e.pot === "purse" ? " (your purse)" : e.pot === "crew" ? " (crew gold)" : "";
      return (e.gold > 0 ? "+" : "") + e.gold + " gold" + where;
    }
    if ("provisions" in e) return "Provisions " + signed(e.provisions);
    if ("hull" in e) return "Hull " + signed(e.hull);
    if ("morale" in e) return "Crew morale " + signed(e.morale);
    if ("pressure" in e) return "Crew pressure " + signed(e.pressure);
    if ("dread" in e) return "Dread " + signed(e.dread);
    if ("standing" in e) return "Standing with " + FACTIONS[e.standing.faction] + " " + signed(e.standing.delta);
    if ("heat" in e) return "Heat with " + FACTIONS[e.heat.faction] + " " + signed(e.heat.delta);
    if ("ladder" in e) {
      var n = PC.data.npcs[e.ladder.npc];
      return (n ? n.first : e.ladder.npc) + (e.ladder.delta > 0 ? " warms to you" : " cools on you");
    }
    if ("tag" in e) return e.tell === false ? null : (e.remove ? "Lost tag: " : "New tag: ") + e.tag;
    if ("item" in e) return "Gained: " + e.item;
    if ("ap" in e) return "Time " + signed(e.ap);
    if ("flag" in e) return null; // flags are silent
    return null;
  }

  function applyEffect(state, e, pot) {
    if ("gold" in e) {
      var p = e.pot && e.pot !== "prompt" ? e.pot : (pot || "crew");
      state.money[p] = (state.money[p] || 0) + e.gold;
      return (e.gold > 0 ? "+" : "") + e.gold + " gold to " + (p === "purse" ? "your purse" : "crew gold");
    }
    if ("provisions" in e) { state.provisions = Math.max(0, state.provisions + e.provisions); }
    else if ("hull" in e) { state.ship.hull = clamp(state.ship.hull + e.hull, 0, state.ship.hullMax); }
    else if ("morale" in e) { state.crew.morale = clamp(state.crew.morale + e.morale, 0, 100); }
    else if ("pressure" in e) { state.crew.pressure = Math.max(0, state.crew.pressure + e.pressure); }
    else if ("dread" in e) { state.meters.dread = clamp(state.meters.dread + e.dread, 0, 100); }
    else if ("standing" in e) {
      var f = e.standing.faction;
      state.meters.standing[f] = clamp(state.meters.standing[f] + e.standing.delta, -100, 100);
    }
    else if ("heat" in e) {
      var h = e.heat.faction;
      state.meters.heat[h] = clamp((state.meters.heat[h] || 0) + e.heat.delta, 0, 100);
    }
    else if ("ladder" in e) {
      var npc = (state.npcs[e.ladder.npc] = state.npcs[e.ladder.npc] || { rung: 0 });
      npc.rung += e.ladder.delta;
    }
    else if ("tag" in e) {
      var tags = state.captain.tags;
      var i = tags.indexOf(e.tag);
      if (e.remove) { if (i >= 0) tags.splice(i, 1); }
      else if (i < 0) tags.push(e.tag);
    }
    else if ("item" in e) { state.captain.items.push(e.item); }
    else if ("ap" in e) { state.ap.left = Math.max(0, state.ap.left + e.ap); }
    else if ("flag" in e) { state.flags[e.flag] = e.value !== false; return null; }
    else return "[engine note: this effect isn't built yet: " + JSON.stringify(e) + "]";
    return describeEffect(state, e);
  }

  // ---- The hub (a placeholder location menu) --------------------------

  function viewHub(state) {
    var hub = PC.data.hubs[state.current.hubId];
    return {
      title: hub.title,
      text: PC.text.render(hub.text, state),
      entries: hub.entries.map(function (en) {
        var ce = canEnter(state, en.scene);
        var s = sceneById(en.scene);
        return { label: en.label, scene: en.scene, ap: s.ap || 0, ok: ce.ok, why: ce.why || null };
      }).filter(function (en) { return en.ok || en.why !== "Not available"; }),
    };
  }

  function endSeason(state) {
    PC.state.advanceSeason(state);
    state.current = { screen: "hub", hubId: PC.data.start.hub };
  }

  PC.scenes = {
    test: test,
    sceneById: sceneById,
    canEnter: canEnter,
    enterScene: enterScene,
    viewScene: viewScene,
    viewHub: viewHub,
    choose: choose,
    reroll: reroll,
    commit: commit,
    endSeason: endSeason,
    applyEffect: applyEffect,
  };
})();
