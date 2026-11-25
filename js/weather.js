/* Pirate Chronicle — weather (§42; Milestone 7, PR 3).
 *
 * Two layers: a season outlook for each zone (Fair, Unsettled, Foul),
 * rolled one season ahead from the world seed, and a condition for each
 * hunt batch and each battle met on a voyage (Calm, Fair, Rough, Fog,
 * Storm). Read Weather rolls itself before every voyage and port hunt;
 * before a hunt batch it's an optional 0 AP roll. Hurricane strikes hit
 * ships in open harbors as Hurricane season turns (the north's 1754 strike
 * comes as the season opens). In Winter, Lilyhook's Graveyard pays better.
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function D() { return PC.data.weather; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function weighted(r, names, weights) {
    var w = {};
    names.forEach(function (n, i) { if (weights[i] > 0) w[n] = weights[i]; });
    return PC.npcs.weighted(r, w);
  }
  var SEASONS = ["Spring", "Summer", "Hurricane", "Winter"];

  // ---- Layer 1: the outlook (§42.3) ---------------------------------------
  // Seeded by year, season and zone, so next season's is already known (the
  // Almanac shows it).
  function outlookAt(state, zone, year, season) {
    var fixed = D().FIXED[year + "-" + season + "-" + zone];
    if (fixed) return fixed;
    var r = PC.rng.fromKey([state.world.seed, year, season, zone, "outlook"].join("|"));
    return weighted(r, D().OUTLOOKS, D().OUTLOOK[zone][SEASONS[season]]);
  }
  function outlook(state, zone) {
    // The Developer's override for this season (§44's test panel).
    var dev = state.world && state.world.devOutlook;
    if (dev && dev.stamp === PC.state.stamp(state) && dev[zone || "north"]) return dev[zone || "north"];
    return outlookAt(state, zone || "north", state.time.year, state.time.season);
  }
  function nextOutlook(state, zone) {
    var s = state.time.season + 1, y = state.time.year;
    if (s > 3) { s = 0; y += 1; }
    return outlookAt(state, zone || "north", y, s);
  }
  function zoneHere(state) {
    var id = state.location && state.location.node;
    return id ? PC.world.zoneOf(id) : "north";
  }

  // ---- Layer 2: conditions (§42.4) ------------------------------------------

  function conditionWeights(state, outl, zone) {
    var w = D().CONDITION[outl].slice();
    var season = PC.state.seasonName(state);
    if (season === "Summer") w[0] *= 2;
    if (season === "Spring" && zone === "north") w[3] *= 2;
    return w;
  }

  function rollCondition(state, zone, key) {
    var o = outlook(state, zone);
    return weighted(PC.rng.fromKey(key), D().CONDITIONS, conditionWeights(state, o, zone));
  }

  function densityMod(cond) { return (D().DENSITY[cond] || 0) / 100; }

  // ---- Read Weather (§42.6) ------------------------------------------------------

  function readCheck(state, zone) { return { type: "Read Weather", dr: D().READ_DR[outlook(state, zone)] }; }

  // The automatic roll before a voyage or a port hunt. Its result rides on
  // the voyage (storms, PR 4): clean redraws a storm once and +1 on Ride Out
  // Storm; partial +1; setback nothing.
  function autoRead(state, zone, key) {
    var r = PC.checks.resolve(state, readCheck(state, zone), key, { conditions: [] });
    return { outcome: r.outcome, dice: r.dice, edge: r.assessment.edge, outlook: outlook(state, zone) };
  }

  // ---- Ships and the battle effects (§42.4) ----------------------------------------

  function hasSweeps(cls) { return D().SWEEPS.indexOf(cls) >= 0; }

  // A Navigator at level 4 aboard the flagship (§42.9): his side ignores
  // Rough's and Fog's penalties and takes Storm's one smaller.
  function navigatorL4(state) {
    return (state.officers || []).some(function (o) { return !o.gone && o.type === "Navigator" && (o.aboard || "flagship") === "flagship" && (o.level || 1) >= 4; });
  }

  // ---- Hurricane strikes (§42.7) ------------------------------------------------------

  // Where the captain's ships lie as the season turns, and whether that is
  // an open harbor in the zone: the flagship's place decides for the fleet
  // in company (laid-up ships wait for M8's lay-up).
  function exposed(state, zone) {
    var id = state.location && state.location.node;
    if (!id || PC.world.zoneOf(id) !== zone) return { inZone: false };
    var n = PC.data.nodes[id] || {};
    var safe = D().SHELTERED.indexOf(id) >= 0 || n.draft === "Shallow";
    return { inZone: true, safe: safe, node: id };
  }

  function strikeShips(state, rnd) {
    var hits = [];
    var lo = D().STRIKE_HULL[0], hi = D().STRIKE_HULL[1];
    var hitOne = function (s, name, isFlag) {
      var pct = lo + rnd() * (hi - lo);
      var loss = Math.max(1, Math.round(s.hullMax * pct));
      var before = s.hull;
      s.hull = Math.max(1, s.hull - loss);
      hits.push({ name: name, lost: before - s.hull, flagship: isFlag });
    };
    hitOne(state.ship, state.ship.name, true);
    (state.fleet || []).forEach(function (f) { if (!f.out) hitOne(f, f.name || f.cls, false); });
    return hits;
  }

  // One zone's strike roll and its effects; adds lines and chips to out.
  function strike(state, zone, out, opts) {
    opts = opts || {};
    var o = outlook(state, zone);
    var r = PC.rng.fromKey([state.world.seed, PC.state.stamp(state), zone, "hurricane-strike", opts.start ? "start" : "end"].join("|"));
    if (!opts.fixed && r() >= (D().STRIKE[o] || 0)) return false;
    var waters = PC.data.hunt.WATERS[zone].name;
    var ex = exposed(state, zone);
    var fill = function (l) { return l.replace(/\[Waters\]/g, waters).replace(/\[Ship\]/g, state.ship.name); };
    out.hurricane = out.hurricane || [];
    if (!ex.inZone) {
      out.lines.push(fill(D().lines.elsewhere));
      out.hurricane.push({ zone: zone, outlook: o, hit: false, elsewhere: true });
    } else if (ex.safe) {
      out.lines.push(fill(D().lines.spared));
      out.hurricane.push({ zone: zone, outlook: o, hit: false });
    } else {
      var hits = strikeShips(state, r);
      out.lines.push(fill(opts.start ? D().lines.hitStart : D().lines.hit));
      hits.forEach(function (h) { out.chips.push({ icon: "hull", text: "Hurricane: the " + h.name + " loses " + h.lost + " hull", ink: "bad" }); });
      out.hurricane.push({ zone: zone, outlook: o, hit: true, hits: hits });
      PC.state.addLog(state, "A hurricane struck " + waters + ": " + hits.map(function (h) { return h.name + " −" + h.lost; }).join(", ") + ".");
    }
    return true;
  }

  // The season-turn hooks (js/world.js).
  function beforeUpkeep(state, out) {
    if (PC.state.seasonName(state) !== "Hurricane") return;
    ["north", "south"].forEach(function (z) {
      if (z === "north" && state.time.year === 1754) return; // its strike came at the season's start
      strike(state, z, out);
    });
  }
  function afterTurn(state, out) {
    if (PC.state.seasonName(state) === "Hurricane" && state.time.year === 1754) {
      strike(state, "north", out, { fixed: true, start: true });
    }
  }

  // ---- The Winter salvage bonus (§42.8) ------------------------------------------------

  function winterSalvage(state, opts) {
    return PC.state.seasonName(state) === "Winter" && !opts.miranda && (opts.site || "ocracoke") === "ocracoke";
  }

  // ---- What the screen shows ---------------------------------------------------------

  function badge(word) { return D().BADGE[word] || word; }
  function outlookLine(state, zone) {
    var t = (zone === "south" ? "South" : "North") + " this season: " + badge(outlook(state, zone));
    if ((state.captain.items || []).indexOf("Pirate's Almanac") >= 0) t += " · next season: " + badge(nextOutlook(state, zone));
    return t;
  }

  PC.weather = {
    outlook: outlook, outlookAt: outlookAt, nextOutlook: nextOutlook, zoneHere: zoneHere,
    conditionWeights: conditionWeights, rollCondition: rollCondition, densityMod: densityMod,
    readCheck: readCheck, autoRead: autoRead, hasSweeps: hasSweeps, navigatorL4: navigatorL4,
    exposed: exposed, strike: strike, beforeUpkeep: beforeUpkeep, afterTurn: afterTurn,
    winterSalvage: winterSalvage, badge: badge, outlookLine: outlookLine,
  };

  if (PC.world) { PC.world.hook("beforeUpkeep", beforeUpkeep); PC.world.hook("afterTurn", afterTurn); }
})();
