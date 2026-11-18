/* Pirate Chronicle — what the player meets at sea, and what a capture
 * yields (§22.5, §22.6). Seven short steps make a ship; the loot calculator
 * fills her hold. Pure rules: every draw takes a seeded rng function r().
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  function H() { return PC.data.hunt; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function weighted(r, w) { return PC.npcs.weighted(r, w); }
  function between(r, lo, hi) { return lo + r() * (hi - lo); }
  function intBetween(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function pick(r, list) { return list[Math.floor(r() * list.length)]; }

  function yearOf(state) { return clamp(state.time.year - 1753, 1, 3); }
  function seasonOf(state) { return PC.state.seasonName(state); }

  // ---- Step 1: pirate hunters (§22.5) --------------------------------------

  function heatChance(heat) {
    var c = H().HEAT_CURVE;
    for (var i = 0; i < c.length; i++) if (heat < c[i][0]) return c[i][1];
    return c[c.length - 1][1];
  }

  function grudge(state) { return (state.world.grudge = state.world.grudge || { France: 0, Sicily: 0 }); }

  // Each faction's chance this batch. Returns the winner (highest chance
  // that succeeds), or null.
  function hunterChances(state, waters) {
    var m = state.meters, W = H().WATERS[waters], out = {};
    var admiralty = W.ports.filter(function (p) { return p.admiralty; }).length;
    var av = heatChance(m.heat.avalon || 0);
    if ((m.heat.avalon || 0) >= 20) av += H().AVALON_HUNTER_PER_ADMIRALTY_PORT * admiralty;
    out.Avalon = av;
    var fr = heatChance(m.heat.frisia || 0) * (H().FRISIAN_HUNTER_POSTURE[state.world.posture] || 1);
    if (waters === "north") fr *= H().FRISIAN_HUNTER_NORTH;
    out.Frisia = fr;
    var g = grudge(state), G = H().GRUDGE;
    out.Sicily = Math.min(G.Sicily.cap, G.Sicily.chance * g.Sicily);
    out.France = Math.min(G.France.cap, G.France.chance * Math.floor(g.France));
    return out;
  }

  function rollHunter(state, waters, r) {
    var ch = hunterChances(state, waters), best = null, bestP = 0;
    Object.keys(ch).forEach(function (f) { var p = ch[f]; if (p > 0 && r() < p && p > bestP) { best = f; bestP = p; } });
    return best;
  }

  // ---- Step 2-4 -------------------------------------------------------------

  function density(state) {
    var D = H().DENSITY;
    return clamp(D.base + (D.season[seasonOf(state)] || 0), D.min, D.max) / 100;
  }

  function flagWeights(state, waters) {
    var W = H().WATERS[waters], w = { Avalon: H().BASE_FLAGS.Avalon, Frisia: H().BASE_FLAGS.Frisia, Sicily: yearOf(state) >= 3 ? 3 : H().BASE_FLAGS.Sicily, Pirate: 0 };
    W.ports.forEach(function (p) {
      var add = H().PORT_WEIGHT[p.faction] || 0;
      if (p.faction === "Avalon") w.Avalon += add;
      else if (p.faction === "Frisia") w.Frisia += add;
      else if (/pirate/.test(p.faction)) w.Pirate += add;
    });
    w.Frisia *= H().FRISIA_POSTURE[state.world.posture] || 1;
    w.France = W.france; w.Spain = W.spain;
    var A = H().ALLY_SHARE;
    w.Ireland = w[A.Ireland[0]] * A.Ireland[1] + W.irelandExtra;
    w.Burgundy = w[A.Burgundy[0]] * A.Burgundy[1];
    w.Sweden = w[A.Sweden[0]] * A.Sweden[1] + W.swedenExtra;
    return w;
  }

  // ---- A ship ---------------------------------------------------------------

  var CAPTAIN_TITLE = { Trade: "Master", Hybrid: "Captain", War: "Captain", Raider: "Captain" };

  // Names from the §36 pools, by flag. Pirates draw from the master pool.
  var POOL_BY_FLAG = { Avalon: "avalon", Frisia: "frisian", France: "french", Ireland: "irish", Spain: "spanish", Sicily: "sicilian", Burgundy: "burgundian", Sweden: "swedish", Pirate: "master" };
  function captainName(state, flag, role, r) {
    try {
      var rec = PC.npcs.generate(state, { id: null, role: flag === "Pirate" ? "Pirate Captain" : "Ship Captain", pool: POOL_BY_FLAG[flag] || "master",
        node: null, key: [state.world.seed, "captain", state.world.shipSeq || 0, Math.floor(r() * 1e9)].join("|"), persistent: false });
      return rec.full;
    } catch (e) { return null; }
  }

  function shipName(state, flag, role, r) {
    var S = (PC.data.names || {}).SHIPS || {};
    var key = flag === "Pirate" ? "pirate" : POOL_BY_FLAG[flag];
    var list = flag === "Avalon" && role === "War" && S.avalonNavy ? S.avalonNavy.concat(S.avalon.slice(0, 5)) : S[key];
    return list && list.length ? pick(r, list) : null;
  }

  function fitout(cls, role, r) {
    var c = H().CLASSES[cls], F = H().FITOUT[role];
    var guns = Math.max(1, Math.round(c.guns * between(r, F.guns[0], F.guns[1])));
    var crew = F.crew === "minToDouble" ? intBetween(r, c.crewMin, c.crewMin * 2) : Math.round(c.crewMax * between(r, F.crew[0], F.crew[1]));
    crew = Math.max(c.crewMin, crew);
    var hull = Math.round(c.hull * between(r, F.hull[0], F.hull[1]));
    return { guns: guns, crew: crew, hull: hull };
  }

  var SEQ = 0;
  function makeShip(state, opts, r) {
    var c = H().CLASSES[opts.cls];
    var fit = opts.full ? { guns: c.guns, crew: c.crewMax, hull: c.hull } : fitout(opts.cls, opts.role, r);
    var res = opts.resolve != null ? opts.resolve : intBetween(r, H().RESOLVE[opts.role][0], H().RESOLVE[opts.role][1]);
    var s = {
      id: "s" + (state.world.shipSeq = (state.world.shipSeq || 0) + 1),
      cls: opts.cls, role: opts.role, flag: opts.flag, size: c.size, draft: c.draft,
      hull: fit.hull, hullMax: c.hull, guns: fit.guns, gunsMax: c.guns, crew: fit.crew, crewMin: c.crewMin, crewMax: c.crewMax,
      cargo: c.cargo, speed: c.speed, handling: c.handling,
      rating: opts.rating != null ? opts.rating : H().RATING[opts.role],
      gunnery: opts.gunnery != null ? opts.gunnery : H().GUNNERY[opts.role],
      resolve: res, hunter: !!opts.hunter, shape: opts.shape || "single",
      name: shipName(state, opts.flag, opts.role, r), captain: captainName(state, opts.flag, opts.role, r), title: CAPTAIN_TITLE[opts.role],
      cue: pick(r, PC.data.huntLines.cue[clamp(res, 1, 5)]),
    };
    s.startCrew = s.crew;
    s.lootLevel = lootLevel(state, s, r);
    return s;
  }

  function hunterShip(state, faction, r) {
    var h = H().HUNTERS[faction];
    var cls = weighted(r, h.types);
    var s = makeShip(state, { cls: cls, role: "War", flag: faction, full: true, hunter: true, rating: h.rating, gunnery: h.gunnery, resolve: 5 }, r);
    return s;
  }

  // One roll of the batch: a ship (or group of ships), or null for an empty
  // horizon. force: { kind: "hunter"|"convoy"|"escort"|"warship", flag? }
  // from the Developer panel.
  function sighting(state, waters, r, force) {
    force = force || {};
    if (force.kind === "hunter") return group(state, [hunterShip(state, force.flag || "Avalon", r)], "single", true, r);
    var flag = force.flag || weighted(r, flagWeights(state, waters));
    var R0 = H().ROLE[flag], adm = H().WATERS[waters].ports.filter(function (p) { return p.admiralty; }).length;
    var rw = { Trade: R0[0], Hybrid: R0[1], War: R0[2], Raider: R0[3] };
    if (flag === "Avalon") { rw.Trade -= 10 * adm; rw.War += 10 * adm; }
    if (flag === "Frisia" && state.world.posture === "Hunter") { rw.Trade -= 15; rw.War += 15; }
    if (flag === "Frisia" && state.world.posture === "Distracted") { rw.War -= 10; rw.Trade += 10; }
    var role = force.kind === "warship" ? "War" : force.kind === "convoy" || force.kind === "escort" ? "Trade" : weighted(r, rw);
    if (flag === "Pirate" && role === "Trade") role = "Raider";
    var shape = "single";
    if (role === "Trade" && flag !== "Pirate") {
      var S = H().SHAPE[yearOf(state)], sp = seasonOf(state) === "Spring" ? H().SHAPE.springBonus : 0, x = r();
      if (force.kind === "escort" || flag === "Sicily" || x < S.escort + sp) shape = "escort";
      else if (force.kind === "convoy" || x < S.escort + S.convoy + 2 * sp) shape = "convoy";
      if (force.kind === "convoy") shape = "convoy";
    }
    var cls = weighted(r, role === "Trade" ? H().TYPES.Trade[yearOf(state)] : H().TYPES[role]);
    if (force.kind === "warship" && !force.cls) cls = weighted(r, { "Royal Sloop": 55, "Frigate": 45 });
    if (force.cls) cls = force.cls;
    var lead = makeShip(state, { cls: cls, role: role, flag: flag, shape: shape }, r);
    var ships = [lead];
    if (shape === "convoy") {
      var n = yearOf(state) >= 3 && r() < 0.5 ? 3 : 2;
      for (var i = 1; i < n; i++) ships.push(makeShip(state, { cls: cls, role: role, flag: flag, shape: shape }, r));
    } else if (shape === "escort") {
      var ec = flag === "Sicily" ? (r() < 0.5 ? "Frigate" : "Royal Sloop") : weighted(r, { "Royal Sloop": 55, "Frigate": 25, "Brigantine": 10, "Brig": 10 });
      var erole = ec === "Brigantine" || ec === "Brig" ? "Hybrid" : "War";
      var esc = makeShip(state, { cls: ec, role: erole, flag: flag, shape: shape }, r);
      esc.escort = true;
      ships.push(esc);
    }
    return group(state, ships, shape, false, r);
  }

  // Escorts, convoys and your own fleet never share a name with another
  // ship in the same group (A13 of the M5 playtest): a clash rerolls.
  function group(state, ships, shape, hunter, r) {
    var taken = {};
    [state.ship && state.ship.name].concat((state.fleet || []).map(function (f) { return f.name; })).forEach(function (n) { if (n) taken[n] = true; });
    ships.forEach(function (s) {
      for (var i = 0; i < 12 && s.name && taken[s.name]; i++) s.name = shipName(state, s.flag, s.role, r);
      if (s.name && taken[s.name]) s.name = null; // a nameless ship rather than a twin
      if (s.name) taken[s.name] = true;
    });
    return { ships: ships, shape: shape, hunter: hunter };
  }

  // ---- The loot calculator (§22.6) ------------------------------------------

  function lootLevel(state, s, r) {
    var b = H().LEVEL_BASE[s.role];
    var lvl = b === "0or1" ? (r() < 0.5 ? 0 : 1) : b;
    if (s.shape !== "single") lvl += 1;
    if (yearOf(state) >= 2 && (s.cls === "West Indiaman" || s.cls === "Galleon")) lvl += 1;
    if (s.flag === "Sicily") lvl += 2;
    var w = 1 + Math.floor(r() * 6);
    lvl += w === 1 ? -1 : w === 6 ? 1 : 0;
    return clamp(lvl, 0, 4);
  }

  // What her hold actually holds, rolled at the capture. Goods are split
  // across one bulk and one fine good from her flag's lists (a build
  // simplification: §22.6 names the lists, not how many lines).
  function rollLoot(state, s, r) {
    var lvl = s.lootLevel, yr = yearOf(state);
    var fill = H().FILL[yr][lvl];
    var units = s.cargo * between(r, fill[0], fill[1]);
    var comp = H().COMP[s.role];
    if (!Array.isArray(comp)) comp = comp[yr];
    var p = comp[0], b = comp[1], f = comp[2] * (H().FINE_MULT[s.flag] || 1), t = comp[3];
    var tot = p + b + f + t;
    var prov = units * p / tot, bulk = units * b / tot, fine = units * f / tot, treas = units * t / tot, prec = 0;
    var G = H().GOODS[s.flag] || H().GOODS.Pirate;
    if ((lvl === 4 || (yr >= 2 && lvl === 3)) && G.precious.length) { prec = treas * 0.25; treas *= 0.75; }
    var goods = {};
    var add = function (name, n) { n = Math.round(n); if (n > 0 && PC.data.goods[name]) goods[name] = (goods[name] || 0) + n; };
    add(pick(r, G.bulk), bulk);
    add(pick(r, G.fine), fine);
    if (prec) add(pick(r, G.precious), prec);
    var chestLvl = clamp(lvl + (s.role === "War" || s.role === "Raider" ? 1 : 0), 0, 4);
    var loot = {
      level: lvl, provisions: Math.round(prov), goods: goods,
      treasure: Math.round(treas * PC.data.economy.TREASURE_PER_SLOT), // slots × 5 units a slot
      chest: Math.round(H().CHEST_BASE * s.size * H().CHEST_MULT[chestLvl]),
      captives: r() < (H().CAPTIVES[s.role] || 0) ? 1 + Math.floor(r() * 6) : 0,
      item: null,
    };
    var ip = H().HIDDEN_ITEM[lvl] + (s.flag === "Sicily" ? H().HIDDEN_ITEM_SICILY : 0);
    if (r() < ip) loot.item = hiddenItem(s, r);
    return loot;
  }

  // The hidden item (§32.16): this build draws from the items the prototype
  // already knows (DEFAULT: the full pools arrive with the items work).
  var ITEM_POOL = { War: ["Sea-Service Pistol", "Spyglass", "Octant"], Pirate: ["Gold Tooth", "Shark-Tooth Necklace", "Eyepatch"], other: ["Silver Pocket Watch", "Spyglass", "Octant", "Sea-Service Pistol"] };
  function hiddenItem(s, r) {
    var pool = s.role === "War" ? ITEM_POOL.War : s.flag === "Pirate" ? ITEM_POOL.Pirate : ITEM_POOL.other;
    return pick(r, pool);
  }

  // ---- What the scouting screen shows (§22.3) -------------------------------

  function range(n, r) {
    // ±30% for a green captain (proposal, §22.3).
    var lo = Math.max(0, Math.round(n * 0.7)), hi = Math.round(n * 1.3);
    return lo === hi ? String(n) : lo + "-" + hi;
  }

  function hullWord(s) {
    var f = s.hull / s.hullMax;
    return f >= 0.95 ? "sound" : f >= 0.6 ? "damaged" : "low in the water";
  }

  function lootTypes(s) {
    var comp = H().COMP[s.role];
    if (!Array.isArray(comp)) comp = comp[1];
    var out = [];
    if (comp[0]) out.push("provisions");
    if (comp[1] || comp[2]) out.push("goods");
    if (comp[3]) out.push("treasure");
    return out;
  }

  PC.huntGen = {
    yearOf: yearOf,
    heatChance: heatChance,
    hunterChances: hunterChances,
    rollHunter: rollHunter,
    density: density,
    flagWeights: flagWeights,
    sighting: sighting,
    makeShip: makeShip,
    hunterShip: hunterShip,
    rollLoot: rollLoot,
    lootLevel: lootLevel,
    range: range,
    hullWord: hullWord,
    lootTypes: lootTypes,
    grudge: grudge,
    weighted: weighted,
  };
})();
