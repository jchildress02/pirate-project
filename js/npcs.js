/* Pirate Chronicle — NPCs: the name generator (§36), Minor generation
 * (§15.1, §15.4) and the friend ladder (§15.6).
 *
 * A generated NPC is drawn from a seeded key, so reloading never renames
 * anyone (§36.1). Persistent Minors use the world seed plus the slot ID;
 * ephemeral ones (opponents, prize captains) use the scene plus the season.
 * The save keeps the generated records and a registry of every full name
 * used, so no two NPCs anywhere share a full name (§36.2).
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function N() { return PC.data.names; }

  // ---- Small seeded helpers ---------------------------------------------

  function one(r, list) { return list[Math.floor(r() * list.length)]; }

  // Pick a key from { key: weight }.
  function weighted(r, weights) {
    var keys = Object.keys(weights), total = 0;
    keys.forEach(function (k) { total += weights[k]; });
    var x = r() * total;
    for (var i = 0; i < keys.length; i++) { x -= weights[keys[i]]; if (x < 0) return keys[i]; }
    return keys[keys.length - 1];
  }

  // ---- The friend ladder (§15.6) ---------------------------------------
  // Rungs are stored as numbers: Neutral is 0.

  var RUNGS = { "-3": "Enemy", "-2": "Rival", "-1": "Wary", "0": "Neutral", "1": "Friendly", "2": "Friend", "3": "Confidant" };
  var RUNG_VALUE = { Enemy: -3, Rival: -2, Wary: -1, Neutral: 0, Friendly: 1, Friend: 2, Confidant: 3 };

  function rungName(n) { return RUNGS[String(n)] || "Neutral"; }

  // ---- The reserved-name filter (§36.2) --------------------------------
  // The starting list plus every Named NPC on the roster, so a new Named
  // NPC joins the filter automatically.

  function reserved(state) {
    var R = N().RESERVED;
    var given = {}, sur = {}, full = {};
    R.given.forEach(function (x) { given[x.toLowerCase()] = true; });
    R.surnames.forEach(function (x) { sur[x.toLowerCase()] = true; });
    R.names.forEach(function (x) { full[x.toLowerCase()] = true; });
    // The captain's and the officers' surnames too: no random relatives.
    if (state && state.captain && state.captain.last) sur[state.captain.last.toLowerCase()] = true;
    ((state && state.officers) || []).forEach(function (o) { if (o.last) sur[o.last.toLowerCase()] = true; });
    var roster = PC.data.npcs || {};
    Object.keys(roster).forEach(function (id) {
      var n = roster[id];
      if (n.test) return;
      if (n.last) { sur[n.last.toLowerCase()] = true; full[(n.first + " " + n.last).toLowerCase()] = true; }
      else if (n.first) full[n.first.toLowerCase()] = true;
    });
    return { given: given, surnames: sur, full: full };
  }

  // ---- Assembling a name (§36.1) -----------------------------------------

  function poolFor(r, poolId) {
    if (poolId === "master" || !poolId) return weighted(r, N().MASTER_WEIGHTS);
    if (!N().POOLS[poolId]) throw new Error("Unknown name pool: " + poolId);
    return poolId;
  }

  function givenName(r, poolId, gender, role) {
    var P = N().POOLS[poolId];
    var women = gender === "f";
    if (P.breton) {
      var gentry = N().GENTRY_ROLES.indexOf(role) >= 0;
      var rate = gentry ? N().BRETON_RATE_GENTRY : N().BRETON_RATE;
      if (r() < rate) {
        // Frisian gentry, officials and officers draw the royal names
        // instead (§36.4). The royal list is men's names only.
        if (gentry && poolId === "frisian" && !women) return one(r, P.royal);
        return one(r, women ? N().BRETON.women : N().BRETON.men);
      }
    }
    if (P.wordChance && r() < P.wordChance) return one(r, women ? P.womenWords : P.menWords);
    if (P.avalonGivenShare && r() < P.avalonGivenShare) {
      var A = N().POOLS.avalon;
      return one(r, women ? A.women : A.men);
    }
    return one(r, women ? P.women : P.men);
  }

  function nicknameRate(role, node) {
    var rates = N().NICKNAME_RATES;
    if (rates[role] != null) return rates[role];
    if (node === "ocracoke" && N().NICKNAME_RATES_OCRACOKE[role] != null) return N().NICKNAME_RATES_OCRACOKE[role];
    return 0;
  }

  // "Black Tom", "Bobby Rats", "Robert the Mast" (§36.14).
  function nickname(r, poolId) {
    var K = N().NICKNAMES;
    var form = one(r, ["prefix", "suffix", "the"]);
    if (form === "the") {
      var list = K.the.concat(K.theByPool[poolId] || []);
      return { form: "the", word: one(r, list) };
    }
    return { form: form, word: one(r, K[form]) };
  }

  function displayName(rec) {
    if (rec.nickname) {
      if (rec.nickname.form === "prefix") return rec.nickname.word + " " + rec.first;
      return rec.first + " " + rec.nickname.word;
    }
    return (rec.first + " " + (rec.last || "")).trim();
  }

  function titleFor(r, role, poolId, gender) {
    var t = N().TITLES[role];
    if (!t) return "";
    if (t.fixed) return t.fixed;
    if (t.captain) return poolId === "spanish" ? "Don" : poolId === "sicilian" ? "Signor" : "Captain";
    if (t.ranks) { var w = {}; t.ranks.forEach(function (x) { w[x[0]] = x[1]; }); return weighted(r, w); }
    if (t.honor) return (N().POOLS[poolId].honor || {})[gender] || "";
    return "";
  }

  // ---- Traits (§15.4) --------------------------------------------------

  function exclusiveWith(trait) {
    var out = [];
    N().EXCLUSIVE.forEach(function (p) {
      if (p[0] === trait) out.push(p[1]);
      if (p[1] === trait) out.push(p[0]);
    });
    return out;
  }

  function drawTraits(r, role, count) {
    var R = N().ROLES[role];
    if (!R) throw new Error("Unknown NPC role: " + role);
    var weights = {};
    (R.bold || []).forEach(function (t) { weights[t] = 3; });
    (R.pool || []).forEach(function (t) { weights[t] = 1; });
    (R.rare || []).forEach(function (t) { weights[t] = 0.3; });
    var out = [];
    while (out.length < count && Object.keys(weights).length) {
      var t = weighted(r, weights);
      out.push(t);
      delete weights[t];
      exclusiveWith(t).forEach(function (x) { delete weights[x]; });
    }
    return out;
  }

  // ---- The registry (§36.2) ----------------------------------------------

  function registry(state) {
    state.world.names = state.world.names || [];
    return state.world.names;
  }

  function livingGivenInNode(state, node) {
    var out = {};
    Object.keys(state.generated || {}).forEach(function (id) {
      var g = state.generated[id];
      var d = (state.npcs || {})[id] || {};
      if (g.node === node && !d.dead && !d.departed) out[g.first.toLowerCase()] = true;
    });
    return out;
  }

  // ---- Generating one Minor NPC ------------------------------------------
  // spec: { id, role, pool ("master" or a pool id), node, key,
  //         persistent (2 traits) or not (1 trait), genderRole (which
  //         §15.1 weight to use, default the role), gender (to force one) }

  function generate(state, spec) {
    var res = reserved(state);
    var used = {};
    registry(state).forEach(function (n) { used[n.toLowerCase()] = true; });
    var nodeGiven = spec.node ? livingGivenInNode(state, spec.node) : {};
    var role = spec.role;
    var womenRate = N().WOMEN_BY_ROLE[spec.genderRole || role];
    if (womenRate == null) womenRate = 0;

    for (var attempt = 0; attempt < 200; attempt++) {
      var r = PC.rng.fromKey(spec.key + "|name|" + attempt);
      var poolId = poolFor(r, spec.pool);
      var gender = spec.gender || (r() < womenRate ? "f" : "m");
      var first = givenName(r, poolId, gender, role);
      var rec = { id: spec.id, tier: "Minor", role: role, node: spec.node || null, pool: poolId,
        gender: gender, first: first, last: "", nickname: null, persistent: !!spec.persistent };
      if (r() < nicknameRate(role, spec.node)) {
        rec.nickname = nickname(r, poolId);
      } else if (poolId === "bondsman") {
        if (spec.freed && r() < 0.5) rec.last = one(r, N().POOLS.bondsman.surnames);
      } else {
        var P = N().POOLS[poolId];
        var tries = 0;
        do { rec.last = one(r, P.surnames); tries++; } while (rec.last === first && tries < 20);
        if (rec.last === first) continue; // never "Gordon Gordon"
      }
      var full = displayName(rec);
      if (res.given[first.toLowerCase()]) continue;
      if (rec.last && res.surnames[rec.last.toLowerCase()]) continue;
      if (rec.nickname && res.surnames[rec.nickname.word.toLowerCase()]) continue; // no second "Rats"
      if (res.full[full.toLowerCase()]) continue;
      if (used[full.toLowerCase()]) continue;               // unique in the world
      if (spec.node && nodeGiven[first.toLowerCase()]) continue; // unique given name in the node
      var R = N().ROLES[role] || { age: [20, 50] };
      var ra = PC.rng.fromKey(spec.key + "|traits");
      rec.age = R.age[0] + Math.floor(ra() * (R.age[1] - R.age[0] + 1));
      rec.traits = N().ROLES[role] ? drawTraits(ra, role, spec.persistent ? 2 : 1) : [];
      rec.title = titleFor(ra, role, poolId, gender);
      rec.full = full;
      rec.attempt = attempt;
      registry(state).push(full);
      return rec;
    }
    throw new Error("Couldn't find a free name for " + spec.id);
  }

  // A persistent Minor in a node slot (§15.1): the world seed plus the slot
  // ID plus a replacement counter. Locked once drawn.
  function fillSlot(state, slot) {
    state.generated = state.generated || {};
    if (state.generated[slot.id]) return state.generated[slot.id];
    var d = (state.npcs[slot.id] = state.npcs[slot.id] || {});
    var rec = generate(state, {
      id: slot.id, role: slot.role, pool: slot.pool || "master", node: slot.node,
      key: state.world.seed + "|slot|" + slot.id + "|" + (d.replacements || 0), persistent: true,
    });
    rec.slot = slot.key;
    rec.label = slot.label;
    state.generated[slot.id] = rec;
    if (d.rung == null) d.rung = slot.startRung || 0;
    return rec;
  }

  // ---- The creator's random-name buttons (§36.2) -------------------------

  function randomCaptainName(gender, key) {
    var r = PC.rng.fromKey(key);
    var res = reserved();
    for (var i = 0; i < 50; i++) {
      var first = givenName(r, "avalon", gender, "Captain");
      var last = one(r, N().POOLS.avalon.surnames);
      if (last === first || res.given[first.toLowerCase()] || res.surnames[last.toLowerCase()]) continue;
      return { first: first, last: last };
    }
    return { first: "Jamie", last: "Fraser" };
  }

  // Ship names: the player's button draws Pirate 60% / Avalon merchant 40%,
  // never navy names or reserved ones.
  function randomShipName(key, flag) {
    var r = PC.rng.fromKey(key);
    var S = N().SHIPS;
    var banned = {};
    N().RESERVED.ships.forEach(function (x) { banned[x] = true; });
    for (var i = 0; i < 50; i++) {
      var f = flag || weighted(r, N().PLAYER_SHIP_WEIGHTS);
      var name = one(r, S[f]);
      if (!banned[name]) return name;
    }
    return one(r, S.pirate);
  }

  // ---- Looking people up -------------------------------------------------

  // Short names scenes use for a node's persistent Minors: {keeper.he},
  // {shipwright.his}, {provisioner.He}. They point at the current node's
  // slot (Ocracoke by default).
  function resolveId(state, who) {
    var node = (state && state.location && state.location.node) || "ocracoke";
    var n = PC.data.nodes && PC.data.nodes[node];
    if (n && n.slots) {
      for (var i = 0; i < n.slots.length; i++) if (n.slots[i].key === who) return n.slots[i].id;
    }
    return who;
  }

  // The NPC as the game sees it: the roster's authored record or the
  // generated one, with the save's deltas (rung, flags).
  function get(state, who) {
    var id = resolveId(state, who);
    var base = (state && state.generated && state.generated[id]) || (PC.data.npcs && PC.data.npcs[id]);
    if (!base) return null;
    var d = (state && state.npcs && state.npcs[id]) || {};
    var rung = d.rung != null ? d.rung : (base.startRung != null ? RUNG_VALUE[base.startRung] : 0);
    var full = base.full || displayName(base);
    return {
      id: id, first: base.first, last: base.last || "", gender: base.gender || "m",
      full: full, title: base.title || "", role: base.role || "", traits: base.traits || [],
      age: base.age, label: base.label || "", rung: rung, rungName: rungName(rung),
      named: !base.tier, dead: !!d.dead,
    };
  }

  function rung(state, who) { var n = get(state, who); return n ? n.rung : 0; }

  // Service Level (§15.6): Wary -1, Neutral 0, Friendly 1, Friend 2,
  // Confidant 3. Enemy and Rival refuse service (null).
  function serviceLevel(state, who) {
    var r = rung(state, who);
    if (r <= -2) return null;
    return r;
  }

  function moveRung(state, who, delta) {
    var id = resolveId(state, who);
    var d = (state.npcs[id] = state.npcs[id] || {});
    if (d.rung == null) d.rung = rung(state, id);
    d.rung = Math.max(-3, Math.min(3, d.rung + delta));
    return d.rung;
  }

  PC.npcs = {
    RUNGS: RUNGS, RUNG_VALUE: RUNG_VALUE,
    rungName: rungName,
    weighted: weighted,
    generate: generate,
    fillSlot: fillSlot,
    displayName: displayName,
    drawTraits: drawTraits,
    randomCaptainName: randomCaptainName,
    randomShipName: randomShipName,
    resolveId: resolveId,
    get: get,
    rung: rung,
    serviceLevel: serviceLevel,
    moveRung: moveRung,
  };
})();
