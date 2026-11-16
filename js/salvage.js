/* Pirate Chronicle — the salvage dive (§18.2; loot §32.15).
 *
 * Lilyhook's Graveyard offers three wrecks a season (seeded). The captain
 * picks one and dives it: each turn he Grabs from a zone (a Dive check),
 * Scouts a zone (1 breath, no roll), or Surfaces. Breath runs out, a shark
 * or the cryptid can black him out, and a blackout keeps half the haul.
 * A Quick Dive skips the loop with one Dive check.
 *
 * The *Miranda* (A Dying Pirate's Wish) runs on the same loop: the only
 * wreck offered, the ivory mermaid first in her Hull, only Snag and Current.
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  function D() { return PC.data.minigames.salvage; }
  function M() { return PC.minigames; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  var COND = ["Underwater"];

  // ---- What's on offer ------------------------------------------------------

  // Three wrecks a season, seeded by the world and the season (§18.2).
  function wrecksOnOffer(state, site) {
    var r = PC.rng.fromKey([state.world.seed, PC.state.stamp(state), site, "wrecks"].join("|"));
    var out = [];
    // A site with a fixed mix offers one of each (Ocracoke: a sloop, a brig
    // and a frigate, the author's phone notes); otherwise the weights.
    var mix = (D().WRECK_MIX || {})[site];
    var n = mix ? mix.length : D().WRECKS_OFFERED;
    for (var i = 0; i < n; i++) {
      var type = mix ? mix[i] : M().weighted(r, D().WRECK_WEIGHTS);
      out.push({ id: site + "-" + PC.state.stamp(state) + "-" + i, type: type, flavor: M().pick(r, D().flavor[type]) });
    }
    return out;
  }

  // The Miranda is the only wreck until the mermaid comes up (§18.2).
  function mirandaPending(state) { return !state.flags.ocr_dpw_done && !state.flags.dpw_mermaid; }

  // Once a season at 1 AP after A Dying Pirate's Wish (§18.2). The quest's
  // own dives don't use it up (DEFAULT).
  function canDive(state) {
    if (!state.flags.ocr_dpw_done) return { ok: false, why: "Locked until A Dying Pirate's Wish" };
    if (PC.crew.usedThisSeason(state, "dive")) return { ok: false, why: D().lines.already };
    if (state.ap.left < 1) return { ok: false, why: "Not enough time this season" };
    return { ok: true };
  }

  function canRetryMiranda(state) {
    if (!state.flags.dpw_retry || !mirandaPending(state)) return { ok: false, why: "" };
    if (state.ap.left < 1) return { ok: false, why: "Not enough time this season" };
    return { ok: true };
  }

  // ---- Loot ----------------------------------------------------------------

  function tableFor(zone, type) { return zone === "cabin" ? zone + "_" + (type === "frigate" ? "frigate" : "brig") : zone; }

  function rollItem(r, zone, type) {
    var t = tableFor(zone, type);
    var tier = M().weighted(r, D().TIERS[t]);
    var y = D().YIELDS[t] || {};
    if (tier === "junk") return { tier: "junk", line: M().pick(r, D().junk) };
    if (tier === "supplies") return { tier: "supplies", provisions: M().between(r, y.supplies[0], y.supplies[1]) };
    if (tier === "goods") {
      var w = {}; y.goods.forEach(function (g, i) { w[i] = g[3]; });
      var g = y.goods[M().weighted(r, w)];
      return { tier: "goods", good: g[0], n: M().between(r, g[1], g[2]) };
    }
    if (tier === "treasure") return { tier: "treasure", treasure: M().between(r, y.treasure[0], y.treasure[1]), gold: M().between(r, y.gold[0], y.gold[1]) };
    var rare = r() < (y.rare || 0);
    return { tier: "item", item: M().pick(r, D().ITEMS[rare ? "rare" : "uncommon"]), rare: rare };
  }

  function worth(it) {
    var W = D().WORTH;
    if (it.tier === "quest") return Infinity;
    if (it.tier === "treasure") return it.treasure * W.treasureUnit + it.gold;
    if (it.tier === "goods") return ((PC.data.goods[it.good] || {}).base || 0) * it.n;
    if (it.tier === "supplies") return it.provisions * W.provisions;
    if (it.tier === "item") return it.rare ? W.rare : W.uncommon;
    return 0;
  }

  function describe(it) {
    if (it.tier === "junk") return it.line;
    if (it.tier === "supplies") return it.provisions + " provisions lot" + (it.provisions > 1 ? "s" : "");
    if (it.tier === "goods") return it.n + " " + it.good;
    if (it.tier === "treasure") return it.treasure + " treasure and " + it.gold + " gold";
    if (it.tier === "item") return it.item;
    if (it.tier === "quest") return "the " + it.item;
    return "?";
  }

  // ---- Starting a dive -----------------------------------------------------

  function breathMax(state) {
    var best = 0;
    (state.captain.items || []).forEach(function (i) { best = Math.max(best, D().GEAR[i] || 0); });
    return D().BREATH + best;
  }

  // opts: { site, wreck } for an ordinary dive, or { miranda: true }.
  function newDive(state, opts) {
    var site = opts.site || "ocracoke";
    var w = opts.miranda ? D().miranda : opts.wreck;
    var key = "dive|" + (opts.miranda ? "miranda-" + ((state.rolls.miranda = (state.rolls.miranda || 0) + 1)) : w.id);
    var r = PC.rng.fromKey([state.world.seed, PC.state.stamp(state), key, "loot"].join("|"));
    var zones = {};
    D().ZONES[w.type].forEach(function (z) {
      var items = [];
      for (var i = 0; i < D().SLOTS; i++) items.push(rollItem(r, z, w.type));
      zones[z] = { dr: (w.zoneDr && w.zoneDr[z] != null) ? w.zoneDr[z] : D().ZONE_DR[z], mod: 0, items: items, next: 0, scouted: -1 };
    });
    if (opts.miranda) zones[D().miranda.quest.zone].items[0] = { tier: "quest", item: D().miranda.quest.item };
    var bm = breathMax(state);
    return {
      kind: "dive", key: key, site: site, miranda: !!opts.miranda,
      wreck: { id: w.id, type: w.type, name: w.name || null, flavor: w.flavor },
      hazards: w.hazards || D().HAZARDS,
      breath: bm, breathMax: bm, zones: zones, haul: [], over: false, blackout: false, result: null,
      quick: false, log: [],
    };
  }

  function start(state, opts) {
    var game = newDive(state, opts);
    M().start(state, game, opts.back);
    M().say(state, game, D().lines.goingUnder);
    if (game.wreck.flavor) M().say(state, game, game.wreck.flavor);
    return game;
  }

  // From the Graveyard menu: pay the action and mark the season's dive.
  function startGraveyardDive(state, wreckId, quick) {
    var c = canDive(state);
    if (!c.ok) throw new Error(c.why);
    var w = wrecksOnOffer(state, "ocracoke").filter(function (x) { return x.id === wreckId; })[0];
    if (!w) throw new Error("No such wreck.");
    PC.crew.spendAP(state, 1);
    PC.crew.markUsed(state, "dive");
    var game = start(state, { site: "ocracoke", wreck: w, back: "node" });
    if (quick) quickDive(state);
    return game;
  }

  // A retry on the Miranda (1 AP each, §18.2).
  function retryMiranda(state) {
    var c = canRetryMiranda(state);
    if (!c.ok) throw new Error(c.why || "Not now.");
    PC.crew.spendAP(state, 1);
    return start(state, { miranda: true, back: "node" });
  }

  // ---- The loop ------------------------------------------------------------

  function zoneDr(game, z) { return clamp(game.zones[z].dr + game.zones[z].mod, 0, D().DR_MAX); }
  function grabCheck(game, z) { return { type: "Dive", dr: zoneDr(game, z) }; }

  function act(state, op, zone) {
    var game = state.minigame;
    if (!game || game.kind !== "dive") throw new Error("Not diving.");
    if (game.over) throw new Error("The dive is over.");
    if (game.pending) throw new Error("Finish the last roll first.");
    if (op === "surface") return endDive(state, game, false);
    var z = game.zones[zone];
    if (!z) throw new Error("No such zone.");
    if (op === "scout") {
      if (z.next >= z.items.length) throw new Error("Nothing left there.");
      game.breath = Math.max(0, game.breath - 1);
      z.mod = clamp(z.mod - 1, -D().ZONE_MOD_CLAMP, D().ZONE_MOD_CLAMP);
      z.scouted = z.next;
      M().say(state, game, D().lines.scout);
      M().say(state, game, "You make out " + describe(z.items[z.next]) + " in the " + D().ZONE_NAMES[zone] + ".");
      return afterAction(state, game);
    }
    if (op === "grab") {
      if (z.next >= z.items.length) throw new Error("Nothing left there.");
      return M().roll(state, game, grabCheck(game, zone), "grab", { zone: zone }, COND);
    }
    throw new Error("Unknown dive action: " + op);
  }

  function take(state, game, zone) {
    var z = game.zones[zone];
    var it = z.items[z.next];
    z.next += 1;
    game.haul.push(it);
    if (it.tier === "quest") game.questFound = true; // its beat comes before the grab line (settle)
    else if (it.tier !== "junk") M().say(state, game, "You come up with " + describe(it) + ".");
    // Junk prints on surfacing: "You surface with [line]." (S17 appendix §8).
  }

  function settle(state, game, p) {
    if (p.op === "grab") {
      var z = p.data.zone;
      // The mermaid's beat comes first, then "you manage to work it loose"
      // (the author's phone notes).
      var zz = game.zones[z], next = zz.items[zz.next];
      if (p.outcome !== "setback" && next && next.tier === "quest") M().say(state, game, D().lines.mermaid);
      M().say(state, game, D().lines.grab[p.outcome]);
      if (p.outcome === "clean") { take(state, game, z); game.breath = Math.max(0, game.breath - 1); }
      else if (p.outcome === "partial") { take(state, game, z); game.breath = Math.max(0, game.breath - 2); }
      else { game.breath = Math.max(0, game.breath - 2); drawHazard(state, game, z); }
      return afterAction(state, game);
    }
    if (p.op === "shark") {
      M().say(state, game, D().lines.shark[p.outcome]);
      if (p.outcome === "partial") game.breath = Math.max(0, game.breath - 1);
      if (p.outcome === "setback") {
        PC.scenes.applyEffect(state, { tag: "Wounded", untilSeasonEnd: true }); // never the mortal-wound check (§18.2)
        return endDive(state, game, true);
      }
      return afterAction(state, game);
    }
    if (p.op === "cryptid") {
      var L = D().lines.cryptid;
      M().say(state, game, L[p.outcome]);
      if (p.outcome === "clean") cryptidReward(state, game);
      if (p.outcome === "setback") return endDive(state, game, true);
      return afterAction(state, game);
    }
    if (p.op === "quick") return settleQuick(state, game, p);
    throw new Error("Unknown dive roll: " + p.op);
  }

  // Hazards draw only on a setback (§18.2).
  function drawHazard(state, game, zone) {
    var r = M().rand(state, game, "hazard");
    var h = M().weighted(r, game.hazards);
    if (h === "snag") { M().say(state, game, D().lines.snag); game.breath = Math.max(0, game.breath - 1); return; }
    if (h === "current") {
      M().say(state, game, D().lines.current);
      var z = game.zones[zone];
      z.mod = clamp(z.mod + 1, -D().ZONE_MOD_CLAMP, D().ZONE_MOD_CLAMP);
      return;
    }
    if (h === "shark") { M().say(state, game, D().lines.shark.draw); game.hazardRoll = "shark"; return; }
    if (h === "cryptid") { M().say(state, game, D().lines.cryptid.draw); game.hazardRoll = "cryptid"; return; }
  }

  // The site's relic if not held (40%), otherwise a Legend rumor (§35.4).
  function cryptidReward(state, game) {
    var site = D().sites[game.site];
    var r = M().rand(state, game, "relic");
    var held = (state.captain.items || []).indexOf(site.relic) >= 0;
    if (!held && r() < D().RELIC_CHANCE) {
      M().say(state, game, D().lines.cryptid.relic);
      game.haul.push({ tier: "item", item: site.relic, relic: true });
      return;
    }
    var rec = PC.rumors.draw(state, { "Legend": 1 }, M().key(state, game, "legend"), "the dive", "Legend");
    if (rec) { game.rumors = (game.rumors || []).concat([rec]); M().say(state, game, rec.text); }
  }

  function afterAction(state, game) {
    if (game.over) return game;
    if (game.hazardRoll) {
      var h = game.hazardRoll; game.hazardRoll = null;
      var check = h === "shark" ? D().SHARK_CHECK : D().CRYPTID_CHECK;
      return M().roll(state, game, check, h, {}, h === "cryptid" ? COND.concat(["Uncanny"]) : COND);
    }
    if (game.breath <= 0) return endDive(state, game, true);
    var left = Object.keys(game.zones).some(function (z) { return game.zones[z].next < game.zones[z].items.length; });
    if (!left) return endDive(state, game, false);
    return game;
  }

  // ---- Quick Dive (§18.2) --------------------------------------------------
  // One Dive check at the wreck's Hold DR. DEFAULT: clean brings up four
  // grabs' worth (the Hold, Hull, Hold, then the Cabin or the Hull), partial
  // two (the Hold and the Hull); junk is left behind. A setback is a blackout
  // with nothing banked. No hazards, never a relic.

  function quickDive(state) {
    var game = state.minigame;
    if (game.miranda) throw new Error("Not on the Miranda.");
    if (game.haul.length || game.over) throw new Error("Too late for a Quick Dive.");
    game.quick = true;
    return M().roll(state, game, { type: "Dive", dr: game.zones.hold.dr }, "quick", {}, COND);
  }

  function settleQuick(state, game, p) {
    if (p.outcome === "setback") return endDive(state, game, true, true);
    var order = p.outcome === "clean" ? ["hold", "hull", "hold", game.zones.cabin ? "cabin" : "hull"] : ["hold", "hull"];
    order.forEach(function (z) {
      var zz = game.zones[z];
      if (zz.next >= zz.items.length) return;
      var it = zz.items[zz.next++];
      if (it.tier !== "junk") game.haul.push(it);
    });
    M().say(state, game, D().lines.quick);
    return endDive(state, game, false);
  }

  // ---- Ending: surface or black out ----------------------------------------

  function endDive(state, game, blackout, nothing) {
    game.over = true;
    game.blackout = !!blackout;
    var kept = game.haul.slice();
    if (blackout) {
      // Half the haul, rounded down; the most valuable half (§18.2
      // proposal). The quest keepsake is never lost.
      var quest = kept.filter(function (i) { return i.tier === "quest"; });
      var rest = nothing ? [] : kept.filter(function (i) { return i.tier !== "quest"; }).sort(function (a, b) { return worth(b) - worth(a); });
      // The Hauler tag keeps the whole haul (§14.2).
      var hauler = (state.captain.tags || []).indexOf("Hauler") >= 0;
      kept = quest.concat(hauler ? rest : rest.slice(0, Math.floor(rest.length / 2)));
      M().say(state, game, D().lines.blackout);
      PC.scenes.applyEffect(state, { tag: "Waterlogged", untilSeasonEnd: true });
    } else {
      M().say(state, game, D().lines.surface);
    }
    game.kept = kept;
    kept.filter(function (i) { return i.tier === "junk"; }).forEach(function (i) { M().say(state, game, D().lines.junkPrefix + i.line + "."); });
    var valuable = kept.filter(function (i) { return i.tier === "treasure" || i.tier === "item" || i.tier === "goods"; }).length;
    if (!game.miranda) M().say(state, game, valuable ? D().lines.goodHaul : D().lines.poorHaul);
    if (game.miranda && !game.questFound) M().say(state, game, D().lines.mermaidMissed);
    game.gold = kept.reduce(function (s, i) { return s + (i.gold || 0); }, 0);
    if (!game.gold) bank(state, game, null);
    return game;
  }

  // Bank what was kept. Gold takes the purse-or-crew choice (§33.1.4;
  // DEFAULT for salvage). Whatever won't fit in the hold stays on the beach.
  function bank(state, game, pot) {
    if (game.banked) return game.bankedReport;
    var report = [], left = [];
    game.kept.forEach(function (it) {
      if (it.tier === "treasure") {
        var room = PC.crew.treasureRoom(state);
        var n = Math.min(room, it.treasure);
        state.cargo.treasure.clean += n;
        if (n < it.treasure) left.push((it.treasure - n) + " treasure");
      } else if (it.tier === "supplies") {
        var p = Math.min(PC.crew.slotsFree(state), it.provisions);
        state.provisions += p;
        if (p < it.provisions) left.push((it.provisions - p) + " provisions");
      } else if (it.tier === "goods") {
        var g = Math.min(PC.crew.slotsFree(state), it.n);
        if (g) PC.crew.addGood(state, it.good, g, false);
        if (g < it.n) left.push((it.n - g) + " " + it.good);
      } else if (it.tier === "item") {
        state.captain.items.push(it.item);
      } else if (it.tier === "quest") {
        state.flags.dpw_mermaid = true;
      }
      if (it.tier !== "junk") report.push(describe(it));
    });
    if (game.gold) {
      var to = pot === "purse" ? "purse" : "crew";
      state.money[to] += game.gold;
    }
    game.banked = true;
    game.bankedReport = { got: report, left: left, gold: game.gold || 0, pot: pot || null };
    PC.state.addLog(state, "Salvage dive" + (game.wreck.name ? " on " + game.wreck.name : " (" + game.wreck.type + ")") + ": " +
      (report.length ? report.join(", ") : "nothing") + (game.blackout ? " (blacked out)" : "") + ".");
    if (left.length) M().say(state, game, "No room in the hold for " + left.join(", ") + ". You leave it on the beach.");
    return game.bankedReport;
  }

  // Where the player goes when he leaves the dive screen.
  function exit(state, game) {
    if (!game.banked) bank(state, game, "crew");
    if (game.miranda) {
      if (state.flags.dpw_mermaid) { state.flags.dpw_retry = false; return "ocr_dpw_shark"; }
      state.flags.dpw_retry = true; // Ollie waits on the beach; each retry is 1 AP
      state.location.place = "graveyard";
      return "node";
    }
    return game.back;
  }

  function view(state, game) {
    var zones = Object.keys(game.zones).map(function (z) {
      var zz = game.zones[z];
      var check = grabCheck(game, z);
      return {
        id: z, name: D().ZONE_NAMES[z], dr: check.dr, left: zz.items.length - zz.next, mod: zz.mod,
        assess: M().assess(state, check, COND),
        scouted: zz.scouted === zz.next && zz.next < zz.items.length ? describe(zz.items[zz.next]) : null,
      };
    });
    return {
      title: game.wreck.name ? game.wreck.name.replace(/^the /, "The ") : "A " + game.wreck.type,
      wreckType: game.wreck.type,
      breath: game.breath, breathMax: game.breathMax, zones: zones,
      haul: game.haul.map(describe), kept: game.kept ? game.kept.map(describe) : null,
      blackout: game.blackout, quick: game.quick, miranda: game.miranda, questFound: !!game.questFound,
      needsPot: game.over && !game.banked && game.gold > 0, gold: game.gold || 0,
      banked: game.bankedReport || null,
      canQuick: !game.miranda && !game.haul.length && !game.over && !game.quick,
    };
  }

  M().register("dive", { settle: settle, view: view, exit: exit });

  PC.salvage = {
    wrecksOnOffer: wrecksOnOffer,
    canDive: canDive,
    canRetryMiranda: canRetryMiranda,
    mirandaPending: mirandaPending,
    start: start,
    startGraveyardDive: startGraveyardDive,
    retryMiranda: retryMiranda,
    act: act,
    quickDive: quickDive,
    bank: bank,
    describe: describe,
    worth: worth,
    breathMax: breathMax,
  };
})();
