/* Pirate Chronicle — the character creator's rules (§12).
 *
 * The creator works on a "draft": a plain object the screens fill in step
 * by step. This file says what is allowed, what is still missing, and turns
 * a finished draft into the starting game. ui.js draws the screens.
 * Data (lists, numbers) lives in content/creator.js.
 *
 * Portrait rulings (November 8 and 13, 2026; S12 still holds the older
 * full-figure modular plan and needs sweeping):
 *   - the captain picks a fixed bust portrait from the sets in his age band;
 *   - the portrait follows the captain's age band, and One Eye swaps in the
 *     eyepatch twin;
 *   - the mentor picks an old portrait from a set the captain didn't take;
 *   - the two female sets are selectable, and gender follows the set.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function D() { return PC.data.creator; }
  function S() { return D().START; }

  var STEPS = [
    { id: "identity", title: "Name and age" },
    { id: "portrait", title: "Portrait" },
    { id: "origin", title: "Origin" },
    { id: "stats", title: "Stats" },
    { id: "training", title: "Training" },
    { id: "character", title: "Traits and flaw" },
    { id: "tags", title: "Tags" },
    { id: "mentor", title: "Your mentor" },
    { id: "ship", title: "Your ship" },
    { id: "review", title: "Review" },
  ];

  function blankDraft() {
    var stats = {};
    PC.checks.STATS.forEach(function (s) { stats[s] = S().statBase; });
    return {
      first: "", last: "", age: 25,
      portraitSet: null,
      homeCity: null, profession: null, freePoint: null, loss: null,
      stats: stats,
      training: {},          // points bought on the training screen
      traits: [], flaw: null,
      tags: [], debuffs: [],
      mentor: { first: "", last: "", portraitSet: null, type: null, voice: null, secondary: null },
      shipName: "",
    };
  }

  // ---- Age and portraits ------------------------------------------------

  function band(age) {
    var a = Number(age);
    var bands = D().AGE_BANDS;
    for (var i = 0; i < bands.length; i++) if (a >= bands[i].min && a <= bands[i].max) return bands[i];
    return null;
  }

  function setById(id) { return D().PORTRAIT_SETS.filter(function (s) { return s.id === id; })[0] || null; }

  function portraitPath(setId, bandName, patch) {
    return "assets/portraits/" + setId + "_" + bandName + (patch ? "_patch" : "") + ".webp";
  }

  // Every portrait file the game can show (the single-file build inlines these).
  function allPortraitPaths() {
    var out = [];
    D().PORTRAIT_SETS.forEach(function (s) {
      D().AGE_BANDS.forEach(function (b) { out.push(portraitPath(s.id, b.band, false), portraitPath(s.id, b.band, true)); });
    });
    return out;
  }

  // The captain's current portrait: his set, his age band, the eyepatch
  // twin once he has One Eye. Ages past 40 stay old.
  function captainPortrait(captain) {
    if (!captain || !captain.portrait || !captain.portrait.set) return null;
    var b = band(captain.age) || (captain.age > 40 ? { band: "old" } : { band: "young" });
    var patch = (captain.tags || []).indexOf("One Eye") >= 0;
    return portraitPath(captain.portrait.set, b.band, patch);
  }

  function officerPortrait(officer) {
    if (!officer || !officer.portrait || !officer.portrait.set) return null;
    return portraitPath(officer.portrait.set, officer.portrait.band || "old", false);
  }

  // Sets the captain may pick from: all eight, in his age band.
  function captainPortraitChoices(draft) {
    var b = band(draft.age);
    if (!b) return [];
    return D().PORTRAIT_SETS.map(function (s) { return { set: s.id, name: s.name, gender: s.gender, path: portraitPath(s.id, b.band, false) }; });
  }

  // Sets the mentor may pick from: old portraits, never the captain's set.
  function mentorPortraitChoices(draft) {
    return D().PORTRAIT_SETS.filter(function (s) { return s.id !== draft.portraitSet; })
      .map(function (s) { return { set: s.id, name: s.name, gender: s.gender, path: portraitPath(s.id, "old", false) }; });
  }

  // ---- Origin -----------------------------------------------------------

  function professionById(id) { return D().PROFESSIONS.filter(function (p) { return p.id === id; })[0] || null; }
  function cityById(id) { return D().HOME_CITIES.filter(function (c) { return c.id === id; })[0] || null; }
  function lossById(id) { return D().LOSSES.filter(function (l) { return l.id === id; })[0] || null; }

  // Loss variants on offer: filtered by profession, Variant D hidden (§12.5).
  function lossChoices(draft) {
    var p = professionById(draft.profession);
    return D().LOSSES.filter(function (l) { return !l.hidden && (!p || p.losses.indexOf(l.id) >= 0); });
  }

  // ---- Stats and training (§12.6) ---------------------------------------

  function statPointsSpent(draft) {
    var n = 0;
    PC.checks.STATS.forEach(function (s) { n += draft.stats[s] - S().statBase; });
    return n;
  }
  function statPointsLeft(draft) { return S().statPoints - statPointsSpent(draft); }
  function canRaiseStat(draft, s) { return statPointsLeft(draft) > 0 && draft.stats[s] < S().statCap; }
  function canLowerStat(draft, s) { return draft.stats[s] > S().statBase; }

  function trainingSpent(draft) {
    var n = 0;
    Object.keys(draft.training).forEach(function (t) { n += draft.training[t]; });
    return n;
  }
  function trainingLeft(draft) { return S().trainingPoints - trainingSpent(draft); }

  // A type's total training: bought points plus the profession's free point.
  function trainingTotal(draft, type) {
    return (draft.training[type] || 0) + (draft.freePoint === type ? 1 : 0);
  }
  function canRaiseType(draft, type) { return trainingLeft(draft) > 0 && trainingTotal(draft, type) < S().trainingCap; }
  function canLowerType(draft, type) { return (draft.training[type] || 0) > 0; }

  // ---- Exclusions (§5.7: blocked picks show greyed out) ------------------

  function allTags() {
    var out = [];
    D().TAG_GROUPS.forEach(function (g) { g.tags.forEach(function (t) { out.push(t); }); });
    return out;
  }
  function allTraits() {
    var out = [];
    D().TRAIT_GROUPS.forEach(function (g) { g.traits.forEach(function (t) { out.push(t); }); });
    return out;
  }
  function entry(id) {
    var lists = [allTags(), allTraits(), D().FLAWS, D().DEBUFFS];
    for (var i = 0; i < lists.length; i++) {
      var hit = lists[i].filter(function (x) { return x.id === id; })[0];
      if (hit) return hit;
    }
    return null;
  }

  function picked(draft) {
    return draft.tags.concat(draft.debuffs, draft.traits, draft.flaw ? [draft.flaw] : []);
  }

  // Why an option can't be taken with the current picks, or null.
  function blockedBy(draft, id) {
    var mine = entry(id);
    var others = picked(draft).filter(function (x) { return x !== id; });
    for (var i = 0; i < others.length; i++) {
      var o = entry(others[i]);
      if ((mine && (mine.excludes || []).indexOf(others[i]) >= 0) || (o && (o.excludes || []).indexOf(id) >= 0)) {
        return "Can't be taken with " + others[i];
      }
    }
    return null;
  }

  function tagsAllowed(draft) { var b = band(draft.age); return b ? b.tags : 0; }
  function debuffsRequired(draft) { var b = band(draft.age); return b ? b.debuffs : 0; }

  // ---- Mentor (§12.8, §25.8) ------------------------------------------

  function isFriction(a, b) {
    return D().FRICTION.some(function (p) { return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a); });
  }
  // Can this trait be the mentor's secondary, given his voice trait?
  function secondaryBlocked(draft, id) {
    var v = draft.mentor.voice;
    if (!v) return null;
    if (id === v) return "Already his voice";
    if (isFriction(v, id)) return "Clashes with " + v;
    return null;
  }

  // ---- What's missing ---------------------------------------------------

  function clean(s) { return String(s || "").trim(); }

  function stepErrors(draft, stepId) {
    var e = [];
    var st = S();
    if (stepId === "identity") {
      if (!clean(draft.first)) e.push("Give your captain a first name.");
      if (clean(draft.first).length > st.nameMax || clean(draft.last).length > st.nameMax) e.push("Names can be at most " + st.nameMax + " letters.");
      var a = Number(draft.age);
      if (!(a >= 15 && a <= 40) || Math.floor(a) !== a) e.push("Age must be a whole number from 15 to 40.");
    }
    if (stepId === "portrait") {
      if (!setById(draft.portraitSet)) e.push("Pick a portrait.");
    }
    if (stepId === "origin") {
      if (!cityById(draft.homeCity)) e.push("Pick a home city.");
      var p = professionById(draft.profession);
      if (!p) e.push("Pick a profession.");
      else if (p.free.indexOf(draft.freePoint) < 0) e.push("Pick your profession's free training point.");
      if (!lossChoices(draft).some(function (l) { return l.id === draft.loss; })) e.push("Pick what was lost.");
    }
    if (stepId === "stats") {
      var left = statPointsLeft(draft);
      if (left > 0) e.push("Spend " + left + " more stat point" + (left > 1 ? "s" : "") + ".");
      if (left < 0) e.push("Too many stat points spent.");
      PC.checks.STATS.forEach(function (s) {
        if (draft.stats[s] > st.statCap || draft.stats[s] < st.statBase) e.push(s + " is out of range.");
      });
    }
    if (stepId === "training") {
      var tl = trainingLeft(draft);
      if (tl > 0) e.push("Spend " + tl + " more training point" + (tl > 1 ? "s" : "") + ".");
      if (tl < 0) e.push("Too many training points spent.");
      Object.keys(draft.training).forEach(function (t) {
        if (!PC.data.checkTypes[t]) e.push("Unknown check type: " + t);
        if (trainingTotal(draft, t) > st.trainingCap) e.push(t + " is over the cap of " + st.trainingCap + ".");
      });
    }
    if (stepId === "character") {
      if (draft.traits.length !== st.traitCount) e.push("Pick " + st.traitCount + " traits.");
      if (!draft.flaw) e.push("Pick a flaw.");
      draft.traits.concat(draft.flaw ? [draft.flaw] : []).forEach(function (id) {
        var b = blockedBy(draft, id);
        if (b) e.push(id + ": " + b + ".");
      });
    }
    if (stepId === "tags") {
      var n = tagsAllowed(draft), d = debuffsRequired(draft);
      if (draft.tags.length !== n) e.push("Pick " + n + " starting tag" + (n > 1 ? "s" : "") + " (you have " + draft.tags.length + ").");
      if (draft.debuffs.length !== d) e.push(d ? "Pick " + d + " debuff" + (d > 1 ? "s" : "") + " (you have " + draft.debuffs.length + ")." : "Captains under 26 take no debuffs.");
      draft.tags.concat(draft.debuffs).forEach(function (id) {
        var b = blockedBy(draft, id);
        if (b) e.push(id + ": " + b + ".");
      });
    }
    if (stepId === "mentor") {
      var m = draft.mentor;
      if (!clean(m.first)) e.push("Give your mentor a name.");
      if (clean(m.first).length > st.nameMax || clean(m.last).length > st.nameMax) e.push("Names can be at most " + st.nameMax + " letters.");
      if (!mentorPortraitChoices(draft).some(function (c) { return c.set === m.portraitSet; })) e.push("Pick your mentor's portrait.");
      if (!D().OFFICER_TYPES.some(function (t) { return t.id === m.type; })) e.push("Pick your mentor's type.");
      if (!m.voice) e.push("Pick your mentor's voice trait.");
      if (!m.secondary) e.push("Pick your mentor's secondary trait.");
      else if (secondaryBlocked(draft, m.secondary)) e.push("His secondary trait " + secondaryBlocked(draft, m.secondary).toLowerCase() + ".");
    }
    if (stepId === "ship") {
      if (!clean(draft.shipName)) e.push("Name your ship.");
      if (clean(draft.shipName).length > st.shipNameMax) e.push("A ship's name can be at most " + st.shipNameMax + " letters.");
    }
    return e;
  }

  function allErrors(draft) {
    var out = [];
    STEPS.forEach(function (s) { stepErrors(draft, s.id).forEach(function (m) { out.push({ step: s.id, message: m }); }); });
    return out;
  }

  // The first step with something missing (for the review screen's links).
  function firstIncomplete(draft) {
    for (var i = 0; i < STEPS.length; i++) if (stepErrors(draft, STEPS[i].id).length) return STEPS[i].id;
    return null;
  }

  // Changing age can leave too many tags or debuffs: trim the extras.
  function fitToAge(draft) {
    draft.tags = draft.tags.slice(0, tagsAllowed(draft));
    draft.debuffs = draft.debuffs.slice(0, debuffsRequired(draft));
  }

  // Changing profession can leave a stale free point or loss.
  function fitToProfession(draft) {
    var p = professionById(draft.profession);
    if (!p || p.free.indexOf(draft.freePoint) < 0) draft.freePoint = null;
    if (!lossChoices(draft).some(function (l) { return l.id === draft.loss; })) draft.loss = null;
    // The free point may push a type over the cap: give the bought point back.
    Object.keys(draft.training).forEach(function (t) {
      while (trainingTotal(draft, t) > S().trainingCap && draft.training[t] > 0) draft.training[t] -= 1;
      if (!draft.training[t]) delete draft.training[t];
    });
  }

  // ---- Building the game -------------------------------------------------

  function pick(list, key) {
    var r = PC.rng.fromKey(key);
    return list[Math.floor(r() * list.length)];
  }

  // A finished draft becomes the starting template for PC.state.newGame.
  // `seed` is the new world's seed, so the mentor's drive and fear are
  // seeded like every other roll.
  function build(draft, seed) {
    var errs = allErrors(draft);
    if (errs.length) throw new Error("The captain isn't finished: " + errs[0].message);
    var st = S();
    var city = cityById(draft.homeCity);
    var loss = lossById(draft.loss);
    var training = {};
    Object.keys(draft.training).forEach(function (t) { if (draft.training[t]) training[t] = draft.training[t]; });
    training[draft.freePoint] = (training[draft.freePoint] || 0) + 1;

    var m = draft.mentor;
    var mset = setById(m.portraitSet);
    var mentor = {
      id: "mentor",
      first: clean(m.first), last: clean(m.last), gender: mset.gender,
      portrait: { set: mset.id, band: "old" },
      type: m.type, level: 1,
      voice: m.voice, secondary: m.secondary, unique: "Mentor",
      drive: pick(D().DRIVES, seed + "|mentor|drive"),
      fear: pick(D().FEARS, seed + "|mentor|fear"),
      rung: 2,               // Friend (§25.5); 0 is Neutral
      approval: 0,
      mentor: true,
      quartermaster: true,   // the first Quartermaster (§25.8-§25.9)
      aboard: "flagship",
      wounded: false, sacrificeUsed: false,
      joined: { year: 1754, season: 0 },
    };

    var npcs = {};
    if (city.friend) npcs[city.friend.id] = { rung: 2, role: city.friend.role, node: city.friend.node, startingFriend: true, serviceLevel: 2 };

    var flags = {};
    flags["profession_" + draft.profession.toLowerCase()] = true; // hidden profession flags (§12.5)
    flags["home_" + draft.homeCity.toLowerCase()] = true;
    flags["loss_" + loss.id.toLowerCase()] = true;

    var set = setById(draft.portraitSet);
    return {
      captain: {
        first: clean(draft.first),
        last: clean(draft.last),
        gender: set.gender,
        age: Number(draft.age),
        origin: "Ash-Born",
        homeCity: draft.homeCity,
        profession: draft.profession,
        loss: loss.id,
        portrait: { set: set.id },
        stats: JSON.parse(JSON.stringify(draft.stats)),
        training: training,
        traits: draft.traits.slice(),
        flaws: [draft.flaw],
        // Ash-Born and the loss tag come on top of the starting tags (§12.3).
        tags: ["Ash-Born", loss.tag].concat(draft.tags, draft.debuffs),
        items: st.items.slice(),
      },
      money: { crew: st.crewGold + (city.gold || 0), purse: st.purse },
      provisions: st.provisions,
      ship: {
        name: clean(draft.shipName), type: st.ship.type,
        hull: st.ship.hull, hullMax: st.ship.hullMax, guns: st.ship.guns, gunsMax: st.ship.gunsMax,
        speed: st.ship.speed, speedMax: st.ship.speedMax, rigging: st.ship.rigging, draft: st.ship.draft, cargo: st.ship.cargo,
      },
      crew: { count: st.crew.count, tiers: { Green: st.crew.count }, morale: st.crew.morale, pressure: st.crew.pressure },
      meters: { dread: 0, standing: { frisia: 0, avalon: 0, pirates: 0 }, heat: { frisia: 0, avalon: 0 } },
      officers: [mentor],
      npcs: npcs,
      flags: flags,
      quests: {
        // The loss quest opens at the end of creation (§12.5).
        what_was_lost: { variant: loss.id, status: "open", leads: [], ends: { year: st.lossQuestEnds.year, season: st.lossQuestEnds.season } },
      },
    };
  }

  // A complete random draft (for testing and a "Surprise me" button).
  function randomDraft(key) {
    var r = PC.rng.fromKey(key);
    function one(list) { return list[Math.floor(r() * list.length)]; }
    var d = blankDraft();
    d.first = one(["Jack", "Ned", "Tom", "Will", "Silas", "Abel"]);
    d.last = one(["Hale", "Cobb", "Rourke", "Teach", "Vane", "Moody"]);
    d.age = 15 + Math.floor(r() * 26);
    d.portraitSet = one(D().PORTRAIT_SETS).id;
    if (setById(d.portraitSet).gender === "f") d.first = one(["Anne", "Mary", "Grace", "Jenny"]);
    d.homeCity = one(D().HOME_CITIES).id;
    var p = one(D().PROFESSIONS);
    d.profession = p.id; d.freePoint = one(p.free); d.loss = one(lossChoices(d)).id;
    while (statPointsLeft(d) > 0) { var s = one(PC.checks.STATS); if (canRaiseStat(d, s)) d.stats[s] += 1; }
    var types = Object.keys(PC.data.checkTypes);
    while (trainingLeft(d) > 0) { var t = one(types); if (canRaiseType(d, t)) d.training[t] = (d.training[t] || 0) + 1; }
    var traits = allTraits();
    while (d.traits.length < S().traitCount) { var tr = one(traits).id; if (d.traits.indexOf(tr) < 0 && !blockedBy(d, tr)) d.traits.push(tr); }
    while (!d.flaw) { var f = one(D().FLAWS).id; if (!blockedBy(d, f)) d.flaw = f; }
    var tags = allTags();
    while (d.tags.length < tagsAllowed(d)) { var tg = one(tags).id; if (d.tags.indexOf(tg) < 0 && !blockedBy(d, tg)) d.tags.push(tg); }
    while (d.debuffs.length < debuffsRequired(d)) { var db = one(D().DEBUFFS).id; if (d.debuffs.indexOf(db) < 0 && !blockedBy(d, db)) d.debuffs.push(db); }
    d.mentor.portraitSet = one(mentorPortraitChoices(d)).set;
    d.mentor.first = setById(d.mentor.portraitSet).gender === "f" ? one(["Bess", "Hester", "Moll"]) : one(["Old Gideon", "Barnaby", "Ezra"]);
    d.mentor.type = one(D().OFFICER_TYPES).id;
    d.mentor.voice = one(D().OFFICER_TRAITS).id;
    while (!d.mentor.secondary) { var sc = one(D().OFFICER_TRAITS).id; if (!secondaryBlocked(d, sc)) d.mentor.secondary = sc; }
    d.shipName = one(["Second Chance", "Ember", "Last Hope", "Ash Wind", "Grudge"]);
    return d;
  }

  PC.creator = {
    STEPS: STEPS,
    blankDraft: blankDraft,
    randomDraft: randomDraft,
    band: band,
    setById: setById,
    portraitPath: portraitPath,
    allPortraitPaths: allPortraitPaths,
    captainPortrait: captainPortrait,
    officerPortrait: officerPortrait,
    captainPortraitChoices: captainPortraitChoices,
    mentorPortraitChoices: mentorPortraitChoices,
    professionById: professionById,
    cityById: cityById,
    lossById: lossById,
    lossChoices: lossChoices,
    statPointsLeft: statPointsLeft,
    canRaiseStat: canRaiseStat,
    canLowerStat: canLowerStat,
    trainingLeft: trainingLeft,
    trainingTotal: trainingTotal,
    canRaiseType: canRaiseType,
    canLowerType: canLowerType,
    allTags: allTags,
    allTraits: allTraits,
    entry: entry,
    blockedBy: blockedBy,
    tagsAllowed: tagsAllowed,
    debuffsRequired: debuffsRequired,
    isFriction: isFriction,
    secondaryBlocked: secondaryBlocked,
    stepErrors: stepErrors,
    allErrors: allErrors,
    firstIncomplete: firstIncomplete,
    fitToAge: fitToAge,
    fitToProfession: fitToProfession,
    build: build,
  };
})();
