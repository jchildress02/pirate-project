/* Pirate Chronicle — the crew (§24) and the hold (§20.6, §22.7).
 *
 * Morale bands, Skill, Discipline and Crew Rating; shares; the crew
 * actions on the Ship layer; and cargo space. No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function E() { return PC.data.economy; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  var TIER_VALUE = { Green: 0, Able: 1, Seasoned: 2, Veteran: 3 };

  // ---- Morale (§24.2) --------------------------------------------------

  var BANDS = [
    { name: "Mutinous", min: 0 }, { name: "Sullen", min: 15 }, { name: "Steady", min: 35 },
    { name: "Eager", min: 65 }, { name: "Devoted", min: 85 },
  ];

  function band(morale) {
    var b = BANDS[0];
    BANDS.forEach(function (x) { if (morale >= x.min) b = x; });
    return b.name;
  }

  function addMorale(state, n) {
    var c = state.crew;
    c.morale = clamp(c.morale + n, c.floor || 0, 100);
    return c.morale;
  }

  // ---- The Quartermaster's mutiny warning (§24.13, §24.14; P7c) ----------
  // At Pressure 3 or more the Quartermaster warns the captain, only at
  // Neutral or better, and never a ringleader. The Acting Quartermaster
  // warns too, in the neutral voice. Once per climb: Pressure has to fall
  // below 3 before he warns again. Returns { who, line } or null.
  function mutinyWarning(state) {
    var c = state.crew, p = c.pressure || 0;
    if (p < 3) { c.qmWarned = false; return null; }
    if (c.qmWarned) return null;
    var qm = PC.officers && PC.officers.quartermaster ? PC.officers.quartermaster(state) : null;
    if (!qm) return null;
    var acting = !qm.id || qm === state.actingQM;
    if (!acting && ((qm.rung != null && qm.rung < 0) || qm.ringleader)) return null;
    var w = "neutral";
    if (!acting) {
      w = qm.warmth || ((PC.data.creator.OFFICER_TRAITS || []).filter(function (t) { return t.id === qm.voice; })[0] || {}).warmth || "neutral";
    }
    var L = PC.data.world.lines.mutinyWarning;
    c.qmWarned = true;
    // The warning opens Strike First and names an officer ringleader (§24.13, §25.14; M9 PR 2).
    if (PC.mutiny) PC.mutiny.noteWarning(state, { name: true });
    var who = (qm.full || ((qm.first || "") + " " + (qm.last || ""))).trim();
    return { who: who, acting: acting, line: who + (acting ? ", the Acting Quartermaster" : ", your Quartermaster") + ", takes you aside: " + (L[w] || L.neutral) };
  }

  // ---- Skill, Discipline, Crew Rating (§24.3-§24.5) -----------------------

  function headcount(state) { return state.crew.count; }

  function skill(state) {
    var c = state.crew, n = 0, sum = 0;
    Object.keys(TIER_VALUE).forEach(function (t) { n += c.tiers[t] || 0; sum += (c.tiers[t] || 0) * TIER_VALUE[t]; });
    return n ? clamp(Math.round(sum / n), 0, 4) : 0;
  }

  function quartermasterAboard(state) {
    return (state.officers || []).some(function (o) { return o.quartermaster && !o.gone && o.aboard === "flagship"; });
  }

  function discipline(state) {
    var d = 1;
    if (quartermasterAboard(state)) d += 1;
    var captainInputs = 0;
    if ((state.captain.traits || []).indexOf("Stern") >= 0) captainInputs = 1;
    if ((state.officers || []).some(function (o) { return !o.gone && (o.voice === "By-the-Book" || o.secondary === "By-the-Book"); })) captainInputs = 1;
    d += Math.min(1, captainInputs);
    if (state.articles && state.articles.terms.discipline === "strict") d += 1;
    var stamp = PC.state.stamp(state);
    if (state.used.makeExampleClean === stamp) d += 1;
    if ((state.crew.raw || 0) > 0.25 * Math.max(1, state.crew.count)) d -= 1; // raw hands (§24.4)
    return clamp(d, 0, 4);
  }

  function crewRating(state) {
    var cr = Math.ceil((skill(state) + discipline(state)) / 2);
    var b = band(state.crew.morale);
    if (b === "Mutinous") cr -= 1;
    if (b === "Devoted") cr += 1;
    return clamp(cr, 0, 4);
  }

  // ---- Shares (§24.1, §26.3) ---------------------------------------------
  // One share = crew gold ÷ the total shares aboard by the Articles'
  // weights. Before the Articles are signed, the Standard weights apply.

  function articleOption(state, slotId) {
    var A = PC.data.articles;
    var slot = A.SLOTS.filter(function (s) { return s.id === slotId; })[0];
    var chosen = state.articles ? state.articles.terms[slotId] : null;
    return slot.options.filter(function (o) { return o.id === chosen; })[0] || slot.options[0];
  }

  function totalShares(state) {
    var hands = state.crew.count + (state.crew.wounded || 0);
    var officers = (state.officers || []).filter(function (o) { return !o.gone; }).length;
    var cap = articleOption(state, "share");
    // The percentage options take their cut off the pool; for a share's
    // size this build counts the captain at the Standard 2 (assumption).
    var capShares = cap.shares || 2;
    return hands + officers * articleOption(state, "officers").officer + capShares;
  }

  function oneShare(state) {
    var t = totalShares(state);
    return t ? state.money.crew / t : 0;
  }

  // Paying off a healthy hand: half a share, minimum 50 (§24.7).
  function payOffEach(state) { return Math.max(50, Math.round(oneShare(state) / 2)); }

  // ---- The hold (§20.6, §22.6, §22.7) ------------------------------------
  // A provisions lot and a unit of goods each take a slot; treasure packs
  // five units to a slot.

  function treasureUnits(state) { var t = state.cargo.treasure; return (t.clean || 0) + (t.dirty || 0); }

  function goodsUnits(state, filter) {
    var n = 0;
    Object.keys(state.cargo.goods).forEach(function (g) {
      var e = state.cargo.goods[g];
      if (!filter || filter === "clean") n += e.clean || 0;
      if (!filter || filter === "dirty") n += e.dirty || 0;
    });
    return n;
  }

  // Every lot of food aboard. (Hardtack, P11, was cut by the build 0.9
  // playtest, #51: provisions are the only food again.)
  function food(state) { return state.provisions || 0; }

  // Take n lots of food. Returns what went.
  function takeFood(state, n) {
    var p = Math.min(state.provisions || 0, n);
    state.provisions -= p;
    return { provisions: p, total: p };
  }

  function slotsUsed(state) {
    return food(state) + goodsUnits(state) + Math.ceil(treasureUnits(state) / E().TREASURE_PER_SLOT);
  }

  // The hold is pooled across the flagship, fleet ships and prize ships (§22.7).
  function holdCapacity(state) {
    var n = state.ship.cargo;
    (state.fleet || []).forEach(function (f) { if (!f.out) n += f.cargo || 0; });
    return n;
  }

  function slotsFree(state) { return Math.max(0, holdCapacity(state) - slotsUsed(state)); }

  // How many treasure units still fit.
  function treasureRoom(state) {
    var used = food(state) + goodsUnits(state);
    return Math.max(0, (holdCapacity(state) - used) * E().TREASURE_PER_SLOT - treasureUnits(state));
  }

  function addGood(state, good, n, dirty) {
    var e = (state.cargo.goods[good] = state.cargo.goods[good] || { clean: 0, dirty: 0 });
    e[dirty ? "dirty" : "clean"] += n;
  }

  function removeGood(state, good, n, dirty) {
    var e = state.cargo.goods[good];
    var k = dirty ? "dirty" : "clean";
    if (!e || e[k] < n) throw new Error("Not enough " + good + " aboard.");
    e[k] -= n;
    if (!e.clean && !e.dirty) delete state.cargo.goods[good];
  }

  function jettison(state, what, n, dirty) {
    n = Math.max(0, Math.floor(n));
    if (!n) return;
    if (what === "provisions") state.provisions = Math.max(0, state.provisions - n);
    else if (what === "treasure") {
      var k = dirty ? "dirty" : "clean";
      state.cargo.treasure[k] = Math.max(0, state.cargo.treasure[k] - n);
    } else removeGood(state, what, n, dirty);
    PC.state.addLog(state, "Jettisoned " + n + " " + (what === "treasure" ? (dirty ? "dirty " : "clean ") + "treasure" : what) + ".");
  }

  // What each ship adds to the pooled hold (A8 of the M5 playtest).
  function holdByShip(state) {
    var out = [{ id: "flagship", name: state.ship.name, cls: state.ship.type, kind: "flagship", cargo: state.ship.cargo }];
    (state.fleet || []).forEach(function (f) { if (!f.out) out.push({ id: f.id, name: f.name || f.cls, cls: f.cls, kind: f.kind, cargo: f.cargo || 0, dirty: !!f.dirty }); });
    return out;
  }

  // What would go over the side to free `slots` of hold space (A9). The
  // cheapest goods go first, then provisions, then treasure (DEFAULT, the
  // M5 playtest patch). Returns [{ what, n, dirty }]; changes nothing.
  function jettisonPlan(state, slots) {
    var plan = [];
    if (slots <= 0) return plan;
    var goods = [];
    Object.keys(state.cargo.goods).forEach(function (g) {
      var e = state.cargo.goods[g], base = (PC.data.goods[g] || {}).base || 0;
      if (e.clean) goods.push({ what: g, n: e.clean, dirty: false, base: base });
      if (e.dirty) goods.push({ what: g, n: e.dirty, dirty: true, base: base });
    });
    goods.sort(function (a, b) { return a.base - b.base || (a.dirty ? -1 : 1); });
    goods.forEach(function (g) { if (slots <= 0) return; var k = Math.min(g.n, slots); plan.push({ what: g.what, n: k, dirty: g.dirty }); slots -= k; });
    if (slots > 0 && state.provisions) { var p = Math.min(state.provisions, slots); plan.push({ what: "provisions", n: p, dirty: false }); slots -= p; }
    if (slots > 0) {
      var per = E().TREASURE_PER_SLOT, t = state.cargo.treasure;
      // Treasure packs five to a slot: freeing a slot can take up to five units.
      ["dirty", "clean"].forEach(function (k) {
        if (slots <= 0 || !t[k]) return;
        var units = Math.min(t[k], slots * per);
        plan.push({ what: "treasure", n: units, dirty: k === "dirty" });
        slots -= Math.ceil(units / per);
      });
    }
    return plan;
  }

  // Throw what no longer fits over the side (after a hull is sold, A9).
  function jettisonOverflow(state) {
    var over = slotsUsed(state) - holdCapacity(state);
    if (over <= 0) return [];
    var plan = jettisonPlan(state, over);
    plan.forEach(function (x) { jettison(state, x.what, x.n, x.dirty); });
    return plan;
  }

  // Pay a sum the crew owes as a crew: crew gold first, any shortfall from
  // the captain's purse automatically (B45 of the M5 playtest, replacing the
  // optional purse gift of §24.9). Returns { crew, purse, short }: what each
  // pot paid, and what neither could cover (nothing is taken then).
  function payFrom(state, amount, partial) {
    amount = Math.max(0, Math.round(amount));
    var have = state.money.crew + state.money.purse;
    if (have < amount && !partial) return { crew: 0, purse: 0, short: amount - have };
    var fromCrew = Math.min(state.money.crew, amount);
    var fromPurse = Math.min(state.money.purse, amount - fromCrew);
    state.money.crew -= fromCrew;
    state.money.purse -= fromPurse;
    return { crew: fromCrew, purse: fromPurse, short: amount - fromCrew - fromPurse };
  }
  function canPay(state, amount) { return state.money.crew + state.money.purse >= amount; }

  // ---- Moving hands between your own ships (A3 of the M5 playtest) ---------
  // Between the flagship and fleet ships only: a prize ship keeps exactly
  // her minimum crew until she's sold. Free (no action) whenever no battle
  // is being fought. The greenest hands move first (DEFAULT).
  function shipCrew(state, id) {
    if (id === "flagship") return { id: id, crew: state.crew.count, wounded: state.crew.wounded || 0, min: state.ship.crewMin || 5, max: state.ship.crewMax, tiers: state.crew.tiers };
    var f = (state.fleet || []).filter(function (x) { return x.id === id && !x.out; })[0];
    if (!f) return null;
    f.crewTiers = f.crewTiers || { Green: f.crew };
    return { id: id, crew: f.crew, wounded: f.wounded || 0, min: f.crewMin, max: f.crewMax, tiers: f.crewTiers, kind: f.kind, rec: f };
  }
  function canMoveHands(state, from, to) {
    var g = state.minigame;
    if (g && g.kind === "hunt" && g.phase === "battle") return { ok: false, why: "Not during a battle", max: 0 };
    var a = shipCrew(state, from), b = shipCrew(state, to);
    if (!a || !b || from === to) return { ok: false, why: "No such ship", max: 0 };
    if ((a.kind && a.kind !== "fleet") || (b.kind && b.kind !== "fleet")) return { ok: false, why: "A prize ship keeps her minimum crew until she's sold", max: 0 };
    var max = Math.min(a.crew - a.min, b.max - b.crew - b.wounded);
    if (max <= 0) return { ok: false, why: a.crew - a.min <= 0 ? "She can't spare a hand" : "No berths free", max: 0 };
    return { ok: true, max: max };
  }
  function moveHands(state, from, to, n) {
    n = Math.floor(n);
    var c = canMoveHands(state, from, to);
    if (!c.ok) throw new Error(c.why);
    if (n <= 0) throw new Error("Move at least one hand.");
    n = Math.min(n, c.max);
    var a = shipCrew(state, from), b = shipCrew(state, to), moved = {};
    E().TIER_ORDER.forEach(function (t) {
      var k = Math.min(n, a.tiers[t] || 0);
      if (!k) return;
      a.tiers[t] -= k; b.tiers[t] = (b.tiers[t] || 0) + k; moved[t] = k; n -= k;
    });
    var total = Object.keys(moved).reduce(function (s, t) { return s + moved[t]; }, 0);
    if (from === "flagship") state.crew.count -= total; else a.rec.crew -= total;
    if (to === "flagship") state.crew.count += total; else b.rec.crew += total;
    PC.state.addLog(state, "Moved " + total + " hand" + (total === 1 ? "" : "s") + " to " + (to === "flagship" ? "the flagship" : "the " + (b.rec.name || b.rec.cls)) + ".");
    return { n: total, tiers: moved };
  }

  // ---- Joining and leaving -------------------------------------------------

  // New hands join at the crew's morale or 50 + the floor, whichever is
  // higher (§24.7). Morale is one number, so this build blends the two by
  // headcount (assumption).
  function addHands(state, tier, n) {
    var c = state.crew;
    var joinAt = Math.max(c.morale, 50 + (c.floor || 0));
    c.morale = Math.round((c.morale * c.count + joinAt * n) / (c.count + n));
    c.tiers[tier] = (c.tiers[tier] || 0) + n;
    c.count += n;
    c.raw = (c.raw || 0) + n;
  }

  function removeHands(state, tier, n) {
    var c = state.crew;
    if ((c.tiers[tier] || 0) < n) throw new Error("Not that many " + tier + " hands aboard.");
    c.tiers[tier] -= n;
    c.count -= n;
  }

  function berths(state) { return Math.max(0, state.ship.crewMax - state.crew.count - (state.crew.wounded || 0)); }

  // ---- Crew actions (§24.12) -----------------------------------------------

  function usedThisSeason(state, key) { return state.used[key] === PC.state.stamp(state); }
  function markUsed(state, key) { state.used[key] = PC.state.stamp(state); }

  function spendAP(state, n) {
    if (state.ap.left < n) throw new Error("Not enough time left this season.");
    state.ap.left -= n;
  }

  // Rally Crew: 1 AP, once a season. +5 partial, +10 clean. The DR isn't
  // set in the docs; this build uses DR 2 (Moderate), -1 at Devoted
  // (§24.2). Flagged for a ruling.
  var RALLY_DR = 2;
  function rallyCheck(state) {
    return { type: "Rally Crew", dr: Math.max(0, RALLY_DR - (band(state.crew.morale) === "Devoted" ? 1 : 0)) };
  }

  function rally(state) {
    if (usedThisSeason(state, "rally")) throw new Error("Already rallied the crew this season.");
    spendAP(state, 1);
    markUsed(state, "rally");
    var key = [state.world.seed, PC.state.stamp(state), "rally"].join("|");
    var r = PC.checks.resolve(state, rallyCheck(state), key);
    var gain = r.outcome === "clean" ? 10 : r.outcome === "partial" ? 5 : 0;
    addMorale(state, gain);
    PC.state.addLog(state, "Rallied the crew: " + r.outcome + (gain ? " (+" + gain + " morale)" : "") + ".");
    return { outcome: r.outcome, gain: gain, roll: r };
  }

  // Drill the Guns: 1 AP, once a season; +1 drill to Gunnery this season.
  function drill(state) {
    if (usedThisSeason(state, "drill")) throw new Error("Already drilled the guns this season.");
    spendAP(state, 1);
    markUsed(state, "drill");
    PC.state.addLog(state, "Drilled the guns: the crew count as drilled for the rest of the season.");
  }

  function drilled(state) { return skill(state) >= 2 || usedThisSeason(state, "drill"); }

  // Give to the crew (§27.4): purse gold into crew gold, +1 morale per 3
  // gold a head (3-38 of the build 0.9 pins; was 5), at most +10 a gift
  // and +15 from gifts a season.
  function giftMorale(state, gold) {
    var heads = Math.max(1, state.crew.count);
    var raw = Math.floor(gold / heads / (E().GIFT_GOLD_PER_MORALE || 3));
    var seasonLeft = 15 - (state.used.giftStamp === PC.state.stamp(state) ? state.used.giftMorale || 0 : 0);
    return Math.max(0, Math.min(raw, 10, seasonLeft));
  }

  function give(state, gold) {
    gold = Math.floor(gold);
    if (gold <= 0) throw new Error("Give at least 1 gold.");
    if (state.money.purse < gold) throw new Error("Your purse doesn't hold that much.");
    var m = giftMorale(state, gold);
    state.money.purse -= gold;
    state.money.crew += gold;
    var st = PC.state.stamp(state);
    if (state.used.giftStamp !== st) { state.used.giftStamp = st; state.used.giftMorale = 0; }
    state.used.giftMorale += m;
    addMorale(state, m);
    PC.state.addLog(state, "Gave " + gold + " gold from your purse to the crew" + (m ? " (+" + m + " morale)" : "") + ".");
    return m;
  }

  // Open the stores: once a season, 1 unit per 5 crew (rounded up).
  // One unit per 5 crew, rounded up (Playtest Pins 0.8, #24; was 15).
  var STORES_PER = 5;
  function storesNeeded(state) { return Math.max(1, Math.ceil(state.crew.count / STORES_PER)); }

  function storeChoices(state) {
    var need = storesNeeded(state);
    return Object.keys(state.cargo.goods).filter(function (g) {
      var info = PC.data.goods[g];
      var e = state.cargo.goods[g];
      return info && info.stores && (e.clean + e.dirty) >= need;
    }).map(function (g) { return { good: g, morale: PC.data.goods[g].stores, need: need }; });
  }

  function openStores(state, good) {
    if (usedThisSeason(state, "stores")) throw new Error("The stores were opened already this season.");
    var info = PC.data.goods[good];
    if (!info || !info.stores) throw new Error(good + " isn't a crew store.");
    var need = storesNeeded(state), e = state.cargo.goods[good];
    if (!e || e.clean + e.dirty < need) throw new Error("Not enough " + good + " aboard.");
    var fromClean = Math.min(e.clean, need);
    if (fromClean) removeGood(state, good, fromClean, false);
    if (need - fromClean) removeGood(state, good, need - fromClean, true);
    markUsed(state, "stores");
    addMorale(state, info.stores);
    PC.state.addLog(state, "Opened the stores: " + need + " " + good + " (+" + info.stores + " morale).");
    // The Drunkard and Heavy Drinker temptations are not built yet.
    return info.stores;
  }

  // Make an Example: 0 AP, once a season, only at Sullen or Mutinous
  // (Strict Discipline adds Steady). Not offered under Lenient.
  function canMakeExample(state) {
    var b = band(state.crew.morale);
    var terms = state.articles ? state.articles.terms : {};
    if (terms.discipline === "lenient") return { ok: false, why: "Your Articles forbid it (Lenient)" };
    var allowed = b === "Sullen" || b === "Mutinous" || (b === "Steady" && terms.discipline === "strict");
    if (!allowed) return { ok: false, why: "Only when the crew is Sullen or Mutinous" };
    if (usedThisSeason(state, "example")) return { ok: false, why: "Once a season" };
    return { ok: true };
  }

  // Discipline or Intimidate (the player picks); DR 2 in this build
  // (not set in the docs; flagged).
  function makeExample(state, type) {
    var c = canMakeExample(state);
    if (!c.ok) throw new Error(c.why);
    markUsed(state, "example");
    var key = [state.world.seed, PC.state.stamp(state), "example"].join("|");
    var r = PC.checks.resolve(state, { type: type || "Discipline", dr: 2 }, key);
    if (r.outcome === "clean") {
      state.crew.pressure = Math.max(0, state.crew.pressure - 2);
      state.used.makeExampleClean = PC.state.stamp(state);
      PC.meters.fearDeed(state, 3); // a fear deed: Dread +3, black +1 (§28.8, §24.12)
    } else if (r.outcome === "partial") {
      state.crew.pressure = Math.max(0, state.crew.pressure - 1);
      addMorale(state, -5);
    } else addMorale(state, -5);
    PC.state.addLog(state, "Made an example of a troublemaker: " + r.outcome + ".");
    return { outcome: r.outcome, roll: r };
  }

  function toggleRationing(state) {
    state.crew.rationing = !state.crew.rationing;
    PC.state.addLog(state, state.crew.rationing ? "Rationing ordered." : "Rationing lifted.");
  }

  PC.crew = {
    BANDS: BANDS,
    band: band,
    addMorale: addMorale,
    skill: skill,
    discipline: discipline,
    crewRating: crewRating,
    headcount: headcount,
    articleOption: articleOption,
    totalShares: totalShares,
    oneShare: oneShare,
    payOffEach: payOffEach,
    treasureUnits: treasureUnits,
    goodsUnits: goodsUnits,
    slotsUsed: slotsUsed,
    slotsFree: slotsFree,
    holdCapacity: holdCapacity,
    treasureRoom: treasureRoom,
    addGood: addGood,
    removeGood: removeGood,
    jettison: jettison,
    holdByShip: holdByShip,
    jettisonPlan: jettisonPlan,
    jettisonOverflow: jettisonOverflow,
    payFrom: payFrom,
    canPay: canPay,
    food: food,
    mutinyWarning: mutinyWarning,
    takeFood: takeFood,
    shipCrew: shipCrew,
    canMoveHands: canMoveHands,
    moveHands: moveHands,
    addHands: addHands,
    removeHands: removeHands,
    berths: berths,
    usedThisSeason: usedThisSeason,
    markUsed: markUsed,
    spendAP: spendAP,
    rallyCheck: rallyCheck,
    rally: rally,
    drill: drill,
    drilled: drilled,
    giftMorale: giftMorale,
    give: give,
    storesNeeded: storesNeeded,
    storeChoices: storeChoices,
    openStores: openStores,
    canMakeExample: canMakeExample,
    makeExample: makeExample,
    toggleRationing: toggleRationing,
  };
})();
