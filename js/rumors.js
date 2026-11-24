/* Pirate Chronicle — rumors (§30): the tavern keeper's rumors, the Tavern
 * Talk check, Gather Intelligence, the fence's Underworld rumors, the danger
 * spots and the rumor log.
 *
 * Every rumor is true about its moment (§30.1). Draw order: scripted, then
 * leads at this node, then the node's pool by its weights (§30.5). No
 * repeats while a rumor is live.
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function R() { return PC.data.rumors; }
  function stamp(state) { return PC.state.stamp(state); }
  function seasonIndex(state) { return state.time.year * 4 + state.time.season; }

  // ---- The log (§30.12) ------------------------------------------------------

  function live(state, id) {
    return (state.rumors || []).some(function (r) { return r.id === id && (r.expires == null || r.expires >= seasonIndex(state)); });
  }

  function remember(state, line, text, source, extra) {
    var e = R().expires[line.type];
    var rec = { id: line.id, type: line.type, text: text, source: source, heard: { year: state.time.year, season: state.time.season },
      expires: e == null ? null : seasonIndex(state) + e };
    Object.keys(extra || {}).forEach(function (k) { rec[k] = extra[k]; });
    state.rumors.push(rec);
    return rec;
  }

  function liveRumors(state) {
    return (state.rumors || []).filter(function (r) { return r.expires == null || r.expires >= seasonIndex(state); });
  }

  // ---- Tiers (ruled November 18, M6 chat R8) ---------------------------------

  function tierOf(line) { return line.tier || (R().tiers || {})[line.type] || "C"; }
  function aCount(state) { var m = state.world.aRumors || {}; return m[stamp(state)] || 0; }
  function aCapped(state) { return aCount(state) >= (R().A_CAP == null ? 1 : R().A_CAP); }
  function noteA(state) {
    var st = stamp(state);
    state.world.aRumors = {}; // only this season's count matters
    state.world.aRumors[st] = aCount(state) + 1;
  }

  // ---- Danger spots (§30.9) ----------------------------------------------------
  // One base spot a season. Faction spots by Heat band, Hunter's Waters and
  // the Frisian Sweep wait for Heat and the hunt (Milestone 5); at Heat 0
  // the base spot is a Patrol.

  function dangerSpots(state) {
    state.world.danger = state.world.danger || {};
    var st = stamp(state);
    if (!state.world.danger[st]) {
      var r = PC.rng.fromKey([state.world.seed, st, "danger"].join("|"));
      var nodes = Object.keys(R().patrolNodes);
      var node = nodes[Math.floor(r() * nodes.length)];
      state.world.danger = {}; // only this season's spots matter
      state.world.danger[st] = [{ spot: "Patrol", node: node, faction: R().patrolNodes[node] }];
    }
    return state.world.danger[st];
  }

  // ---- Rendering a line ----------------------------------------------------------

  function npcLabel(state, id) {
    var n = PC.npcs.get(state, id);
    var d = state.npcs[id] || {};
    var role = n.label || ("the " + (n.role || "stranger").toLowerCase());
    return d.met ? n.full + ", " + role : role;
  }

  function render(state, line, ctx) {
    ctx = ctx || {};
    var t = line.text;
    if (ctx.npc) {
      var n = PC.npcs.get(state, ctx.npc);
      t = t.replace(/\{npc\.([A-Za-z']+)\}/g, function (w, form) {
        var lower = form.toLowerCase(), f = PC.text.FORMS[lower];
        if (!f) return w;
        var out = f[n.gender === "f" ? 1 : 0];
        return form !== lower ? out.charAt(0).toUpperCase() + out.slice(1) : out;
      });
      var label = npcLabel(state, ctx.npc);
      // Capitalise a label that opens the line ("The tavern keeper ...").
      // The name-plus-label form ("Elise Bonnet, the tavern keeper") closes
      // its comma when the sentence carries on (Playtest Pins 0.8, #10).
      var appos = label.indexOf(", ") >= 0;
      t = t.replace(/(^"?)?\[NPC\](.?)/g, function (w, q, next, at) {
        var l = at === 0 ? label.charAt(0).toUpperCase() + label.slice(1) : label;
        if (appos && next && !/[.,;:!?"'\u201d)]/.test(next)) l += ",";
        return (q || "") + l + next;
      });
    }
    var c = state.captain;
    t = t.replace(/\[Player\]/g, (c.first + " " + c.last).trim()).replace(/\[Ship\]/g, state.ship.name);
    if (ctx.node) t = t.replace(/\[Node\]/g, ctx.node);
    if (ctx.faction) t = t.replace(/\[Faction\]/g, ctx.faction);
    if (ctx.waters) t = t.replace(/\[Waters\]/g, ctx.waters);
    return PC.text.render(t, state);
  }

  // ---- What can be told right now -----------------------------------------------

  // Ocracoke's NPCs whose traits a Node rumor can reveal (alive, with a line
  // for a trait not yet known). 80% here, 20% a neighbor (§30.5): no
  // neighbor's people exist in the prototype, so every one is from here.
  function traitSubjects(state, node) {
    var ids = Object.keys(PC.data.npcs).filter(function (id) { var n = PC.data.npcs[id]; return n.node === node && !n.test; });
    (PC.node.nodeData(node).slots || []).forEach(function (s) { ids.push(s.id); });
    var out = [];
    ids.forEach(function (id) {
      var n = PC.npcs.get(state, id);
      if (!n || n.dead || id === "davey" || (PC.data.npcs[id] || {}).scripted) return;
      var known = (state.npcs[id] || {}).knownTraits || [];
      n.traits.forEach(function (t) {
        if (R().traits[t] && known.indexOf(t) < 0) out.push({ npc: id, trait: t });
      });
    });
    return out;
  }

  // Candidates of one type, each { line, ctx, extra }. opts.noA leaves out
  // A-tier lines (a picked type, R8); the season's A cap does the same.
  function candidatesOf(state, type, opts) {
    var all = candidatesAll(state, type);
    var noA = (opts && opts.noA) || aCapped(state);
    return noA ? all.filter(function (c) { return tierOf(c.line) !== "A"; }) : all;
  }

  function candidatesAll(state, type) {
    var out = [];
    var node = PC.node.here(state);
    if (type === "Node") {
      return traitSubjects(state, node).map(function (s) {
        return { line: { id: "node_" + s.npc + "_" + s.trait, type: "Node", text: R().traits[s.trait] }, ctx: { npc: s.npc }, extra: { npc: s.npc, trait: s.trait } };
      });
    }
    if (type === "Reputation") {
      var lines = R().pool.filter(function (l) { return l.type === "Reputation" && !live(state, l.id) && (!l.node || l.node === node); });
      var deeds = lines.filter(function (l) { return l.deed && PC.scenes.test(state, l.when); });
      if (deeds.length) return deeds.map(function (l) { return { line: l }; });
      var d = state.meters.dread;
      var dread = lines.filter(function (l) { return l.dread && d >= l.dread[0] && d <= l.dread[1]; });
      if (dread.length) return dread.map(function (l) { return { line: l }; });
      // The newcomer: a first-season captain who has done nothing yet.
      if (state.time.year === 1754 && state.time.season === 0) return lines.filter(function (l) { return l.newcomer; }).map(function (l) { return { line: l }; });
      return [];
    }
    R().pool.forEach(function (l) {
      if (l.type !== type || live(state, l.id)) return;
      if (l.node && l.node !== node) return; // a node's own lines stay at that node
      if (l.posture && l.posture !== state.world.posture) return;
      if (l.when && !PC.scenes.test(state, l.when)) return;
      if (l.spot) {
        dangerSpots(state).forEach(function (sp) {
          if (sp.spot === l.spot) out.push({ line: l, ctx: { node: sp.node, faction: sp.faction }, extra: { node: sp.node } });
        });
        return;
      }
      out.push({ line: l, extra: l.ship ? { ship: l.ship, waters: l.waters } : null });
    });
    return out;
  }

  function scriptedFor(state) {
    var node = PC.node.here(state);
    return R().scripted.filter(function (l) {
      return l.node === node && l.posture === state.world.posture && l.year === state.time.year &&
        PC.state.seasonName(state) === l.season && !live(state, l.id) && !(state.rumors || []).some(function (r) { return r.id === l.id; });
    });
  }

  function tell(state, c, source) {
    var text = render(state, c.line, c.ctx);
    var rec = remember(state, c.line, text, source, c.extra);
    if (c.line.type === "Node") {
      var d = (state.npcs[c.extra.npc] = state.npcs[c.extra.npc] || {});
      d.knownTraits = (d.knownTraits || []).concat([c.extra.trait]);
    }
    return rec;
  }

  // One rumor from a source's pool, by its type weights (§30.5). With a
  // tier mix (opts.mix, R8) the tier is drawn first, among tiers that have
  // something to tell, then the type within it. opts.noA: no A-tier lines
  // (a type the player picked).
  function drawOne(state, weights, key, source, onlyType, opts) {
    opts = opts || {};
    var sc = scriptedFor(state);
    if (sc.length && !onlyType) return tell(state, { line: sc[0] }, source);
    var r = PC.rng.fromKey(key);
    var w = {}, byTier = {};
    Object.keys(weights).forEach(function (t) {
      if (onlyType && t !== onlyType) return;
      var cands = candidatesOf(state, t, opts);
      if (!cands.length) return;
      w[t] = weights[t];
      cands.forEach(function (c) { var tr = tierOf(c.line); (byTier[tr] = byTier[tr] || {})[t] = weights[t]; });
    });
    if (!Object.keys(w).length) return null;
    var tier = null;
    if (opts.mix) {
      var mw = {};
      Object.keys(byTier).forEach(function (tr) { if (opts.mix[tr]) mw[tr] = opts.mix[tr]; });
      if (Object.keys(mw).length) { tier = PC.npcs.weighted(r, mw); w = byTier[tier]; }
    }
    var type = PC.npcs.weighted(r, w);
    var cands = candidatesOf(state, type, opts);
    if (tier) cands = cands.filter(function (c) { return tierOf(c.line) === tier; });
    var c = cands[Math.floor(r() * cands.length)];
    if (tierOf(c.line) === "A") noteA(state);
    return tell(state, c, source);
  }

  // The tavern keeper's tier mix: the node's own (Norfolk's, §17.4.1) or
  // the shared one.
  function keeperMix(state) { var m = R().tierMix || {}; var n = state && PC.node.here(state); return (n && m[n]) || m.keeper; }

  // ---- The tavern keeper (§30.4) ------------------------------------------------

  function keeperId(state) { return PC.node.slotNpc(PC.node.here(state), "keeper"); }

  // Tavern Talk: Medium by default (DR 2, this build's reading), one step
  // easier for a Gossipy or Jovial keeper, harder for Discreet or Taciturn
  // (within ±2), and one step harder this season if he's annoyed (§17.2).
  // P3: the base stays DR 2, and each cause shows as its own line in the
  // odds ("Keeper: Taciturn −1", "Keeper annoyed −1") instead of hiding in
  // the Difficulty line.
  function talkCheck(state) {
    var k = PC.npcs.get(state, keeperId(state));
    var t = k.traits || [], extra = [];
    var easy = t.filter(function (x) { return x === "Gossipy" || x === "Jovial"; });
    var hard = t.filter(function (x) { return x === "Discreet" || x === "Taciturn"; });
    var shift = Math.max(-2, Math.min(2, hard.length - easy.length));
    if (shift) extra.push({ label: "Keeper: " + (shift > 0 ? hard : easy).join(", "), value: -shift });
    if (PC.scenes.test(state, { seasonFlag: "keeper_annoyed" })) extra.push({ label: "Keeper annoyed", value: -1 });
    return { type: "Tavern Talk", dr: 2, extra: extra };
  }

  function keeperAsked(state) {
    var s = PC.node.season(state);
    return !!s.rumorsAsked;
  }

  // Ask the tavern keeper (0 AP): 1 plus Service Level rumors, at least one,
  // and a clean Tavern Talk adds one. Once a season (this build's reading).
  function askKeeper(state) {
    var node = PC.node.here(state), who = keeperId(state);
    var L = PC.node.nodeData(node).lines.keeper;
    var sl = PC.npcs.serviceLevel(state, who);
    if (sl == null) return { refuse: true, line: L.refuse, rumors: [] };
    var s = PC.node.season(state);
    if (s.rumorsAsked) return { line: L.outOfRumors, rumors: [], again: true };
    s.rumorsAsked = true;
    var weights = PC.node.nodeData(node).rumorWeights;
    var n = Math.max(1, 1 + sl);
    var key = [state.world.seed, stamp(state), node, "keeper-rumor"].join("|");
    var out = [];
    for (var i = 0; i < n; i++) { var r = drawOne(state, weights, key + "|" + i, "tavern keeper", null, { mix: keeperMix(state) }); if (r) out.push(r); }
    var chk = talkCheck(state);
    var res = PC.checks.resolve(state, chk, key + "|talk", { conditions: ["Harbor"] });
    var extra = null;
    if (res.outcome === "clean") extra = drawOne(state, weights, key + "|talk-extra", "tavern keeper", null, { mix: keeperMix(state) });
    PC.node.tavernActionDone(state);
    return { line: L.askRumors, rumors: out, talk: { outcome: res.outcome, dice: res.dice, edge: res.assessment.edge, dr: chk.dr }, extra: extra,
      extraLine: extra ? L.talkClean : null, out: L.outOfRumors };
  }

  // ---- Gather Intelligence (§30.4, §30.6) -----------------------------------------

  function gatherCheck(state) { return { type: "Gather Intelligence", dr: 2 }; } // DR: this build's reading

  // The types the player can pick: C and B only, never an A rumor (R8).
  function gatherTypes(state) {
    var w = PC.node.nodeData(PC.node.here(state)).rumorWeights;
    return Object.keys(w).filter(function (t) { return candidatesOf(state, t, { noA: true }).length; });
  }

  // The unheard loss-quest lead at this node that a clean result can give
  // (§30.6). At Ocracoke: the one-armed pirate's lead for A and C.
  function fallbackLead(state) {
    if (PC.node.here(state) !== "ocracoke") return null;
    var loss = state.captain.loss;
    if ((loss === "A" || loss === "C") && !PC.quests.hasLead(state, "what_was_lost", "trident")) return "trident";
    return null;
  }

  function gather(state) {
    if (state.ap.left < 1) throw new Error("Not enough time this season.");
    PC.crew.spendAP(state, 1);
    var key = [state.world.seed, stamp(state), PC.node.here(state), "gather", state.rolls.gather = (state.rolls.gather || 0) + 1].join("|");
    var res = PC.checks.resolve(state, gatherCheck(state), key, { conditions: ["Harbor"] });
    // Retuned November 18 (M6 chat R4): never empty. Clean: two rumors, the
    // player picks both types. Partial: one, the player picks. Setback: one
    // from the tavern keeper's pool, and the questions get noticed.
    var out = { outcome: res.outcome, dice: res.dice, edge: res.assessment.edge, rumor: null, pick: null, picks: 0, lead: null };
    if (res.outcome === "clean") {
      var lead = fallbackLead(state);
      if (lead) {
        PC.quests.addLead(state, "what_was_lost", lead);
        state.flags.lead_trident_heard = true;
        out.lead = PC.data.quests.what_was_lost.leads[lead].journal[state.captain.loss];
      }
    }
    if (res.outcome !== "setback") {
      out.pick = gatherTypes(state);
      out.picks = out.pick.length ? (res.outcome === "clean" ? 2 : 1) : 0;
      state.location.gatherPick = out.picks ? { key: key, left: out.picks, n: 0 } : null;
    } else {
      out.rumor = drawOne(state, PC.node.nodeData(PC.node.here(state)).rumorWeights, key + "|setback", "gather intelligence", null, { mix: keeperMix(state) });
      state.flags.gi_asked = stamp(state); // the next Reputation rumor here is about the questions
    }
    PC.node.tavernActionDone(state);
    PC.node.tavernVisit(state);
    PC.state.addLog(state, "Gathered intelligence around town (1 action): " + res.outcome + ".");
    return out;
  }

  function gatherPick(state, type) {
    var gp = state.location.gatherPick;
    if (typeof gp === "string") gp = { key: gp, left: 1, n: 0 }; // an older save mid-pick
    if (!gp) throw new Error("Nothing to pick.");
    gp.left -= 1; gp.n += 1;
    state.location.gatherPick = gp.left > 0 ? gp : null;
    var rec = drawOne(state, PC.node.nodeData(PC.node.here(state)).rumorWeights, gp.key + "|pick" + (gp.n > 1 ? gp.n : ""), "gather intelligence", type, { noA: true });
    // Nothing left to pick from: the second pick is dropped.
    if (state.location.gatherPick && !gatherTypes(state).length) state.location.gatherPick = null;
    return rec;
  }

  // ---- The fence (§30.4, §30.7) ------------------------------------------------------

  function fenceDealRumor(state, fenceNpc) {
    var U = R().underworld;
    var sl = PC.npcs.serviceLevel(state, fenceNpc);
    var chance = U.chance[String(sl)] || 0;
    var key = [state.world.seed, stamp(state), "fence-rumor", state.rolls.fenceRumor = (state.rolls.fenceRumor || 0) + 1].join("|");
    var r = PC.rng.fromKey(key);
    if (r() >= chance) return null;
    var lines = U.lines.filter(function (l) { return !live(state, l.id) && !(tierOf(l) === "A" && aCapped(state)); });
    if (!lines.length) return null;
    var l = lines[Math.floor(r() * lines.length)];
    var where = R().letterBuyerNodes[Math.floor(PC.rng.fromKey(state.world.seed + "|letter-buyer")() * R().letterBuyerNodes.length)];
    if (tierOf(l) === "A") noteA(state);
    var rec = tell(state, { line: l, ctx: { node: where } }, "fence");
    return { leadIn: U.leadIn, rumor: rec };
  }

  function askFrench(state) {
    PC.quests.addLead(state, "hidden_haven", "bobby_french");
    state.flags.bobby_french_heard = true;
    return R().underworld.askFrench;
  }

  PC.rumors = {
    dangerSpots: dangerSpots,
    liveRumors: liveRumors,
    candidatesOf: candidatesOf,
    tierOf: tierOf,
    aCapped: aCapped,
    talkCheck: talkCheck,
    keeperAsked: keeperAsked,
    askKeeper: askKeeper,
    gatherCheck: gatherCheck,
    gatherTypes: gatherTypes,
    gather: gather,
    gatherPick: gatherPick,
    fenceDealRumor: fenceDealRumor,
    askFrench: askFrench,
    render: render,
    draw: drawOne, // one rumor by type weights, for the minigames (§18.2, §18.4.6)
  };
})();
