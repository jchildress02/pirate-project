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
  //   { loss: "A" } or { loss: ["A", "C"] }   the captain's loss variant (§12.5)
  //   { seasonFlag: "x" }      a flag set this season (keeper_annoyed)
  //   { rungAtLeast: { npc, rung: "Friend" } }
  //   { all: [...] } { any: [...] } { not: {...} }
  function test(state, cond) {
    if (!cond) return true;
    if (Array.isArray(cond)) return cond.every(function (c) { return test(state, c); });
    var c = state.captain;
    if (cond.all) return cond.all.every(function (x) { return test(state, x); });
    if (cond.any) return cond.any.some(function (x) { return test(state, x); });
    if (cond.not) return !test(state, cond.not);
    if (cond.flag) return state.flags[cond.flag] === true;
    if (cond.seasonFlag) return state.flags[cond.seasonFlag] === seasonStamp(state);
    if (cond.loss) return (Array.isArray(cond.loss) ? cond.loss : [cond.loss]).indexOf(c.loss) >= 0;
    if (cond.rungAtLeast) return PC.npcs.rung(state, cond.rungAtLeast.npc) >= PC.npcs.RUNG_VALUE[cond.rungAtLeast.rung];
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
    if (s.ap) state.ap.left = Math.max(0, state.ap.left - s.ap); // a scene that fires on its own never blocks on time
    state.current = { screen: "scene", sceneId: id, phase: "choosing", pending: null };
  }

  // An exit is a scene id, "hub", or a list of { when, to } tried in order
  // with a plain id as the fallback (the pointer only if he told his loss).
  function resolveExit(state, exit) {
    if (!Array.isArray(exit)) return exit;
    for (var i = 0; i < exit.length; i++) {
      var e = exit[i];
      if (typeof e === "string") return e;
      if (test(state, e.when)) return e.to;
    }
    return "hub";
  }

  // "hub" means back to where the captain is: the node's menus (and any
  // scene queued to fire there next, §17.2), or the engine's test harbor.
  function goTo(state, exit) {
    if (!exit || exit === "hub") {
      if (state.location && state.location.node) {
        var next = PC.node ? PC.node.nextQueued(state) : null;
        if (next) return enterScene(state, next);
        state.current = { screen: "node" };
        return;
      }
      state.current = { screen: "hub", hubId: (PC.data.testStart || {}).hub || "test_harbor" };
      return;
    }
    enterScene(state, exit);
  }

  // ---- What the player sees -------------------------------------------

  // Scene text can be a string, or a list of pieces where some pieces only
  // show under a condition: ["Always. ", { when: { flag: "x" }, text: "Only with x." }].
  // This is how an author's bracketed variant lines ([bar_wrecked] ...) are filed.
  function textOf(state, t) {
    if (t == null) return "";
    if (typeof t === "string") return t;
    if (Array.isArray(t)) return t.map(function (p) { return textOf(state, p); }).join("");
    if (typeof t === "object") return test(state, t.when) ? textOf(state, t.text) : "";
    return String(t);
  }

  function setupText(state, s) {
    // Back at the same menu after an information step: the answer stands in
    // for the setup, so the player isn't shown the whole scene again.
    if (state.current.again != null) return PC.text.render(state.current.again, state);
    var text = textOf(state, s.setup);
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
    var v = { index: index, label: PC.text.render(textOf(state, ch.label), state), status: "open", reason: null, check: null, cost: ch.cost || null };
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
    var reroll = ch.check ? PC.checks.availableReroll(state, ch.check, p.outcome, { conditions: s.conditions || [] }) : null;
    if (p.rerolled) reroll = null; // at most one reroll per roll
    return {
      choiceLabel: PC.text.render(textOf(state, ch.label), state),
      outcome: p.outcome, // "clean" | "partial" | "setback" | "result"
      roll: p.roll || null,
      firstRoll: p.firstRoll || null,
      text: PC.text.render(textOf(state, o.text), state),
      effects: (o.effects || []).filter(function (e) { return test(state, e.when); }).map(function (e) { return describeEffect(state, e); }),
      needsPot: (o.effects || []).some(function (e) { return e.gold > 0 && (!e.pot || e.pot === "prompt") && test(state, e.when); }),
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
    var r = PC.checks.availableReroll(state, ch.check, p.outcome, { conditions: s.conditions || [] });
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
    PC.state.addLog(state, PC.text.render(textOf(state, ch.label), state) + " — " + labelFor(p.outcome));
    var text = PC.text.render(textOf(state, o.text), state);
    var exit = resolveExit(state, o.exit); // read before the effects change the flags
    var after = [];
    var live = (o.effects || []).filter(function (e) { return test(state, e.when); }); // judged before any applies
    live.forEach(function (e) {
      if ("goPlace" in e) { after.push(e); return; }
      var line = applyEffect(state, e, pot);
      if (line) PC.state.addLog(state, "  " + line);
    });
    state.seen[s.id] = s.repeat === "season" ? seasonStamp(state) : true;
    if (exit === s.id) {
      // Back to the same menu (an information step, or a failed approach
      // that greys out): the answer stays on screen above the choices.
      state.current = { screen: "scene", sceneId: s.id, phase: "choosing", pending: null, again: text || state.current.again || null };
    } else {
      goTo(state, exit);
      // carry: the next menu opens on this result's line (Twopenny's "Ten
      // gold pieces, this time only" stays above PAY and the shove).
      if (o.carry && state.current.screen === "scene") state.current.again = text;
    }
    // Walk the captain somewhere once the scene ends (Twopenny's exit: to the Tavern).
    after.forEach(function (e) { if (PC.node && state.current.screen === "node") PC.node.enter(state, e.goPlace, { quiet: false }); });
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
    if ("treasure" in e) return signed(e.treasure) + " " + (e.dirty ? "dirty" : "clean") + " treasure";
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
    if ("rung" in e) {
      var rn = PC.npcs ? PC.npcs.get(state, e.rung.npc) : null;
      return (rn ? rn.first : e.rung.npc) + ": " + e.rung.set;
    }
    if ("join" in e) { var jn = PC.data.npcs[e.join]; return (jn ? jn.first + " " + jn.last : e.join) + " joins your officers"; }
    if ("lead" in e) return "Lead recorded in your journal";
    if ("dies" in e || "seasonFlag" in e || "meet" in e) return null;
    if ("tag" in e) return e.tell === false ? null : (e.remove ? "Lost tag: " : "New tag: ") + e.tag + (e.untilSeasonEnd ? " (until the end of the season)" : "");
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
    else if ("treasure" in e) {
      // Treasure goes into the hold (§20.3). A purse-or-crew prompt for
      // treasure rewards (§33.1.4) waits for the selling milestone.
      var k = e.dirty ? "dirty" : "clean";
      state.cargo.treasure[k] = Math.max(0, state.cargo.treasure[k] + e.treasure);
    }
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
      if (PC.npcs) PC.npcs.moveRung(state, e.ladder.npc, e.ladder.delta);
      else {
        var npc = (state.npcs[e.ladder.npc] = state.npcs[e.ladder.npc] || { rung: 0 });
        npc.rung += e.ladder.delta;
      }
    }
    else if ("tag" in e) {
      var tags = state.captain.tags;
      var i = tags.indexOf(e.tag);
      if (e.remove) { if (i >= 0) tags.splice(i, 1); }
      else if (i < 0) tags.push(e.tag);
      // A temporary tag that lapses when the season turns (§5.3).
      if (e.untilSeasonEnd && !e.remove) { state.captain.tagsUntil = state.captain.tagsUntil || {}; state.captain.tagsUntil[e.tag] = seasonStamp(state); }
    }
    else if ("rung" in e) {
      // Set an NPC's rung outright ("Twopenny Friendly", §15.6).
      var want = PC.npcs.RUNG_VALUE[e.rung.set];
      PC.npcs.moveRung(state, e.rung.npc, want - PC.npcs.rung(state, e.rung.npc));
    }
    else if ("join" in e) { PC.officers.joinNamed(state, e.join); }
    else if ("lead" in e) { PC.quests.addLead(state, e.lead.quest, e.lead.id); }
    else if ("dies" in e) { var dn = (state.npcs[e.dies] = state.npcs[e.dies] || {}); dn.dead = true; return null; }
    else if ("meet" in e) { var mn = (state.npcs[e.meet] = state.npcs[e.meet] || {}); mn.met = true; return null; }
    else if ("seasonFlag" in e) { state.flags[e.seasonFlag] = seasonStamp(state); return null; }
    else if ("item" in e) { state.captain.items.push(e.item); }
    else if ("ap" in e) { state.ap.left = Math.max(0, state.ap.left + e.ap); }
    else if ("flag" in e) { state.flags[e.flag] = e.value !== false; return null; }
    else return "[engine note: this effect isn't built yet: " + JSON.stringify(e) + "]";
    return describeEffect(state, e);
  }

  // ---- The hub (a placeholder location menu) --------------------------

  function viewHub(state) {
    var hub = PC.data.hubs[state.current.hubId || (PC.data.testStart || {}).hub];
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
    goTo(state, "hub");
  }

  PC.scenes = {
    test: test,
    textOf: textOf,
    resolveExit: resolveExit,
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
