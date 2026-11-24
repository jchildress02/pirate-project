/* Pirate Chronicle — officers: Tavern recruitment, the Named officers and
 * dismissal (§25.1, §25.5, §25.7, §25.10).
 *
 * Generated candidates are drawn from a seeded key (the world, the season and
 * the node), so reloading never changes who sits at the tables. Two a
 * season at each Tavern; Davey Dell takes one of the two seats for good if
 * he wasn't signed at the Docks (§17.2).
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var FEE = 1000; // crew gold, a level 1 officer (§20.4)

  function C() { return PC.data.creator; }
  function L() { return PC.data.officerLines; }
  function traitInfo(id) { return C().OFFICER_TRAITS.filter(function (t) { return t.id === id; })[0] || null; }

  function aboard(state) { return (state.officers || []).filter(function (o) { return !o.gone; }); }
  function holding(state, type) { return aboard(state).filter(function (o) { return o.type === type; })[0] || null; }
  function mentor(state) { return aboard(state).filter(function (o) { return o.mentor; })[0] || null; }

  function friction(a, b) {
    return C().FRICTION.some(function (p) { return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a); });
  }

  // Likes and dislikes: both traits, the drive and the fear (§25.4).
  function likesOf(o) {
    var likes = [], dislikes = [];
    [o.voice, o.secondary, o.third].forEach(function (t) {
      var ti = traitInfo(t);
      if (ti) { likes.push(ti.likes); dislikes.push(ti.dislikes); }
    });
    (o.likes || []).forEach(function (x) { likes.push(x); });
    (o.dislikes || []).forEach(function (x) { dislikes.push(x); });
    if (PC.data.driveLikes[o.drive]) likes.push(PC.data.driveLikes[o.drive]);
    if (PC.data.fearDislikes[o.fear]) dislikes.push(PC.data.fearDislikes[o.fear]);
    return { likes: likes, dislikes: dislikes };
  }

  // Why an officer reacts to a choice's approval tags (B5 of the M5
  // playtest): which trait, drive or fear moved him. A drive or fear the
  // captain hasn't learned stays unnamed.
  function reactions(o, tags) {
    var out = [];
    (tags || []).forEach(function (tag) {
      [o.voice, o.secondary, o.third].forEach(function (t) {
        var ti = traitInfo(t);
        if (ti && ti.likes === tag) out.push({ tag: tag, dir: 1, source: t });
        if (ti && ti.dislikes === tag) out.push({ tag: tag, dir: -1, source: t });
      });
      (o.likes || []).forEach(function (x) { if (x === tag) out.push({ tag: tag, dir: 1, source: null }); });
      (o.dislikes || []).forEach(function (x) { if (x === tag) out.push({ tag: tag, dir: -1, source: null }); });
      if (PC.data.driveLikes[o.drive] === tag) out.push({ tag: tag, dir: 1, source: o.driveKnown ? "Drive: " + o.drive : null, hidden: o.driveKnown ? null : "drive" });
      if (PC.data.fearDislikes[o.fear] === tag) out.push({ tag: tag, dir: -1, source: o.fearKnown ? "Fear: " + o.fear : null, hidden: o.fearKnown ? null : "fear" });
    });
    return out;
  }

  // §25.5 The captain's leaning: count the officer's likes minus dislikes
  // over the captain's traits and flaw; +2 or more, one rung warmer.
  function leaning(state, o) {
    var lk = likesOf(o), n = 0;
    var c = state.captain;
    (c.traits || []).concat(c.flaws || []).forEach(function (t) {
      var tag = PC.data.officerLeaning[t];
      if (!tag) return;
      lk.likes.forEach(function (x) { if (x === tag) n++; });
      lk.dislikes.forEach(function (x) { if (x === tag) n--; });
    });
    return n >= 2 ? 1 : n <= -2 ? -1 : 0;
  }

  // ---- Generated candidates (§25.1, §25.7) ---------------------------------

  // A node can lean its candidates toward some types (Norfolk: Gunner and
  // Navigator at double weight, ex-navy, §17.4.4).
  function officerType(node, r, one) {
    var w = node && PC.data.nodes[node] && PC.data.nodes[node].officerTypeWeights;
    if (!w) return one(C().OFFICER_TYPES).id;
    var weights = {};
    C().OFFICER_TYPES.forEach(function (t) { weights[t.id] = w[t.id] || 1; });
    return PC.npcs.weighted(r, weights);
  }

  function generate(state, node, key, id) {
    var rec = PC.npcs.generate(state, { id: id, role: "Officer", pool: "master", node: null, key: key, persistent: false });
    var r = PC.rng.fromKey(key + "|officer");
    function one(list) { return list[Math.floor(r() * list.length)]; }
    var traits = C().OFFICER_TRAITS.map(function (t) { return t.id; });
    var voice = one(traits);
    var secondary = null;
    for (var i = 0; i < 50 && !secondary; i++) {
      var t = one(traits);
      if (t !== voice && !friction(voice, t)) secondary = t; // never a friction pair on himself (§25.6)
    }
    var o = {
      id: id, first: rec.first, last: rec.last, nickname: rec.nickname || null, full: rec.full, gender: rec.gender,
      age: 20 + Math.floor(r() * 41), // 20-60 (§25.1)
      type: officerType(node, r, one), level: 1,
      voice: voice, secondary: secondary,
      drive: one(C().DRIVES), fear: one(C().FEARS),
      approval: 0, aboard: "flagship", wounded: false, sacrificeUsed: false,
    };
    o.rung = leaning(state, o); // Neutral, shifted by the leaning (§25.5)
    return o;
  }

  // This season's two seats at the node's Tavern.
  function candidates(state) {
    var id = PC.node.here(state);
    var s = PC.node.season(state, id);
    if (!s.candidates) {
      var stamp = PC.state.stamp(state);
      s.candidates = [0, 1].map(function (i) {
        return generate(state, id, [state.world.seed, stamp, id, "officer", i].join("|"), "off_" + stamp + "_" + i);
      });
    }
    var list = s.candidates.filter(function (c) { return !c.hired; });
    // Davey's permanent seat (§17.2): he takes the second chair while he waits.
    if (state.flags.davey_at_tavern && !holdingId(state, "davey")) {
      list = list.slice(0, 1).concat([daveyCandidate(state)]);
    }
    return list;
  }

  function holdingId(state, id) { return aboard(state).some(function (o) { return o.id === id; }); }

  function daveyCandidate(state) {
    var d = PC.data.namedOfficers.davey;
    return { id: "davey", named: true, first: d.first, last: d.last, full: d.first + " " + d.last, gender: d.gender, age: d.age,
      type: namedType(state, d), voice: d.voice, secondary: d.secondary, third: d.third };
  }

  function namedType(state, d) {
    var m = mentor(state);
    return m && m.type === d.type && d.typeIfMentorRaider ? d.typeIfMentorRaider : d.type;
  }

  // ---- Showing a candidate ------------------------------------------------

  var SWAP = { he: "she", his: "her", him: "her", himself: "herself", He: "She", His: "Her", Him: "Her", "he's": "she's", "He's": "She's" };
  function forWoman(text) {
    return text.replace(/\b(he's|He's|himself|he|his|him|He|His|Him)\b/g, function (w) { return SWAP[w] || w; });
  }

  // The hiring scene (§25.7): the stem, the secondary trait's hint, then the
  // voice trait's intro. Davey has his own intro.
  function hiringText(state, c) {
    if (c.id === "davey") return PC.data.namedOfficers.davey.hiringIntro;
    var stemAndHint = L().stem.replace("[Name]", c.first) + ", " + L().hints[c.secondary];
    if (c.gender === "f") stemAndHint = forWoman(stemAndHint);
    return stemAndHint + "\n\n" + PC.text.render(L().intros[c.voice] || "", state);
  }

  // ---- Hiring ---------------------------------------------------------------

  // One action covers every hire on one Tavern visit (§25.7).
  function apNeeded(state) {
    var v = state.location && state.location.visit;
    return state.officerVisit === v ? 0 : 1;
  }

  function hireCheck(state, c) {
    if (state.money.crew < FEE) return { ok: false, why: "Needs " + FEE + " crew gold" };
    if (state.ap.left < apNeeded(state)) return { ok: false, why: "Not enough time this season" };
    return { ok: true };
  }

  function dismissPay(state) {
    var comp = PC.crew.articleOption(state, "compensation");
    return Math.max(comp.min, Math.round(PC.crew.oneShare(state) * comp.shares));
  }

  // Dismiss an officer, paid by the Compensation Article (§25.10). A
  // dismissed Davey goes back to his Tavern seat (§25.7).
  function dismiss(state, o) {
    var pay = dismissPay(state);
    var paid = Math.min(pay, state.money.crew);
    state.money.crew -= paid;
    o.gone = true;
    o.left = "dismissed";
    if (o.quartermaster) { o.quartermaster = false; vacate(state); } // the vote waits for the next voyage event (§25.9)
    if (o.id === "davey") state.flags.davey_at_tavern = true;
    var line = o.id === "davey" ? PC.data.namedOfficers.davey.dismissal : (o.mentor ? (L().dismissal[o.voice] || "") : (L().dismissal[o.voice] || ""));
    PC.state.addLog(state, (o.first + " " + (o.last || "")).trim() + " is dismissed, with " + paid + " crew gold.");
    ensureQuartermaster(state);
    return { officer: o, pay: paid, line: line };
  }

  // ---- The Quartermaster (§25.9) -----------------------------------------
  // There is always a Quartermaster. With no officer aboard the flagship the
  // crew elects one of their own, the Acting Quartermaster: a generated
  // name, no traits, no bonuses, no officer slot. When a real officer joins,
  // the officer wins the vote outright and the acting man goes back to the
  // crew under the same name; if the officers all leave, he's re-elected.
  function onFlagship(state) { return aboard(state).filter(function (o) { return (o.aboard || "flagship") === "flagship"; }); }

  // A playtest ruling (A4 of the M5 playtest): between a vacancy and the
  // crew's vote at the next voyage event, the Acting Quartermaster holds
  // the seat and gives the advice panel, even with officers aboard
  // (actingQM.pending). With no officers aboard at all he is simply the
  // crew's pick; an officer who joins then wins outright (§25.15).
  function actingRecord(state) {
    if (!state.actingQM) {
      var rec = PC.npcs.generate(state, { id: "acting_qm", role: "Sailor", pool: "master", node: null, key: state.world.seed + "|acting-qm", persistent: false });
      state.actingQM = { first: rec.first, last: rec.last || "", full: rec.full || (rec.first + " " + (rec.last || "")).trim(), gender: rec.gender || "m", active: false };
    }
    return state.actingQM;
  }

  // The post falls vacant (a fleet command, a dismissal): the Acting
  // Quartermaster steps in until the vote.
  function vacate(state) {
    var aq = actingRecord(state);
    aq.pending = true;
    ensureQuartermaster(state);
  }

  function ensureQuartermaster(state, winner) {
    var ab = onFlagship(state), aq = state.actingQM;
    if (ab.some(function (o) { return o.quartermaster; })) {
      if (aq) { aq.active = false; aq.pending = false; }
      return null;
    }
    aq = actingRecord(state);
    if (!ab.length) {
      aq.pending = false;
      if (!aq.active) { aq.active = true; PC.state.addLog(state, "With no officers aboard, the crew elects " + aq.full + " their Acting Quartermaster."); }
      return aq;
    }
    if (aq.active && !aq.pending) {
      aq.active = false;
      var w = winner && ab.indexOf(winner) >= 0 ? winner : ab[0];
      w.quartermaster = true;
      PC.state.addLog(state, "The crew vote: " + (w.first + " " + (w.last || "")).trim() + " is your Quartermaster now, and " + aq.full + " goes back to the crew.");
      return null;
    }
    // Officers aboard, no Quartermaster: the seat is vacant until the vote.
    aq.pending = true;
    if (!aq.active) { aq.active = true; PC.state.addLog(state, "The Quartermaster's post is vacant: " + aq.full + " holds the seat until the crew votes."); }
    return aq;
  }

  // ---- The Vote (§25.9, the template §25.15) -------------------------------
  var VOTE_POINTS = { "Jovial": 3, "Kindly": 3, "Old Salt": 3, "Penny-Pincher": 3,
    "Shanty-Singer": 2, "Yarn-Spinner": 2, "Daredevil": 2, "Prankster": 2, "Frightening": 2, "By-the-Book": 2, "Ambitious": 2, "Schemer": 2,
    "Eager": 1, "Sot": 1, "Gossip": 1, "Devout": 1, "Godless": 1, "Superstitious": 1, "Bloodthirsty": 1, "Grudge-Keeper": 1, "Proud": 1,
    "Paranoid": 0, "Secretive": 0, "Lonesome": 0 };

  function votePending(state) {
    var aq = state.actingQM;
    return !!(aq && aq.active && aq.pending && onFlagship(state).length);
  }

  // Speaking for a candidate before the vote (Order): +2 at Eager or
  // Devoted, +1 at Steady, -1 at Sullen or Mutinous.
  function speakBonus(state) {
    var b = PC.crew.band(state.crew.morale);
    return b === "Eager" || b === "Devoted" ? 2 : b === "Steady" ? 1 : -1;
  }

  function seasonsAboard(state, o) {
    var j = o.joined || { year: 1754, season: 0 };
    return (state.time.year - j.year) * 4 + (state.time.season - j.season);
  }

  // Each flagship officer's score: voice + secondary trait points, Mentor
  // +2, +1 a full year aboard, a mutinous officer +3 while morale is
  // Sullen or worse, and the captain's word if he spoke for them.
  function voteScores(state, speakFor) {
    var band = PC.crew.band(state.crew.morale), angry = band === "Sullen" || band === "Mutinous";
    return onFlagship(state).map(function (o) {
      var parts = [];
      [o.voice, o.secondary].forEach(function (t) { if (t && VOTE_POINTS[t]) parts.push({ label: t, value: VOTE_POINTS[t] }); });
      if (o.mentor) parts.push({ label: "Mentor", value: 2 });
      var years = Math.floor(seasonsAboard(state, o) / 4);
      if (years > 0) parts.push({ label: years + " year" + (years === 1 ? "" : "s") + " aboard", value: years });
      var mutinous = o.rung <= PC.npcs.RUNG_VALUE.Enemy || (o.rung <= PC.npcs.RUNG_VALUE.Rival && (state.crew.pressure || 0) >= 3);
      if (mutinous && angry) parts.push({ label: "The angry crew's man", value: 3 });
      if (speakFor && speakFor === o.id) parts.push({ label: "You spoke for " + (o.gender === "f" ? "her" : "him"), value: speakBonus(state) });
      return { id: o.id, name: (o.first + " " + (o.last || "")).trim(), first: o.first, score: parts.reduce(function (a, x) { return a + x.value; }, 0), parts: parts,
        schemer: o.voice === "Schemer" || o.secondary === "Schemer", aboard: seasonsAboard(state, o) };
    });
  }

  // Run the vote: highest wins; a Schemer wins every tie, then the officer
  // aboard longest, then a seeded coin.
  function runVote(state, speakFor, key) {
    var scores = voteScores(state, speakFor);
    if (!scores.length) return null;
    var r = PC.rng.fromKey(key || [state.world.seed, PC.state.stamp(state), "qm-vote"].join("|"));
    scores.forEach(function (x) { x.coin = r(); });
    scores.sort(function (a, b) { return b.score - a.score || (b.schemer ? 1 : 0) - (a.schemer ? 1 : 0) || b.aboard - a.aboard || b.coin - a.coin; });
    var w = onFlagship(state).filter(function (o) { return o.id === scores[0].id; })[0];
    onFlagship(state).forEach(function (o) { o.quartermaster = false; });
    w.quartermaster = true;
    var aq = state.actingQM;
    if (aq) { aq.active = false; aq.pending = false; }
    PC.state.addLog(state, "The crew vote: " + scores[0].name + " is your Quartermaster" + (aq ? ", and " + aq.full + " goes back to the crew" : "") + ".");
    return { winner: w, scores: scores };
  }

  // Who speaks as Quartermaster: the officer, or the Acting Quartermaster.
  function quartermaster(state) {
    var o = onFlagship(state).filter(function (x) { return x.quartermaster; })[0];
    if (o) return o;
    return state.actingQM && state.actingQM.active ? state.actingQM : null;
  }

  function makeOfficer(state, c) {
    if (c.id === "davey") {
      var d = PC.data.namedOfficers.davey;
      return { id: "davey", named: true, first: d.first, last: d.last, gender: d.gender, age: d.age,
        type: namedType(state, d), level: 1, voice: d.voice, secondary: d.secondary, third: d.third, unique: d.unique,
        likes: d.likes.slice(), dislikes: d.dislikes.slice(), warmth: d.warmth,
        drive: d.drive, fear: d.fear, rung: PC.npcs.RUNG_VALUE[d.startRung], approval: 0,
        aboard: "flagship", wounded: false, sacrificeUsed: false,
        joined: { year: state.time.year, season: state.time.season } };
    }
    var o = JSON.parse(JSON.stringify(c));
    delete o.hired;
    o.joined = { year: state.time.year, season: state.time.season };
    return o;
  }

  // Sign an officer on. A hire of a type you already hold replaces the
  // incumbent, who is dismissed (§25.7). Returns what happened.
  function join(state, c) {
    state.officers = state.officers || [];
    var o = makeOfficer(state, c);
    var out = { officer: o, replaced: null };
    var held = holding(state, o.type);
    if (held) out.replaced = dismiss(state, held);
    if (state.officers.some(function (x) { return x.id === o.id; })) {
      state.officers = state.officers.filter(function (x) { return x.id !== o.id; });
    }
    state.officers.push(o);
    if (o.id === "davey") state.flags.davey_at_tavern = false;
    var first = !state.flags.first_officer_hired;
    state.flags.first_officer_hired = true;
    out.mentorLine = first && mentor(state) ? L().mentorFirstHire : null; // §25.8 milestone
    ensureQuartermaster(state, o);
    return out;
  }

  // The Named officer joins through a scene (Restless & Ruined).
  function joinNamed(state, id) {
    if (id !== "davey") throw new Error("Unknown Named officer: " + id);
    var r = join(state, daveyCandidate(state));
    PC.state.addLog(state, "Davey Dell joins as your " + r.officer.type + ".");
    return r;
  }

  function hire(state, candId) {
    var c = candidates(state).filter(function (x) { return x.id === candId; })[0];
    if (!c) throw new Error("That officer isn't here.");
    var chk = hireCheck(state, c);
    if (!chk.ok) throw new Error(chk.why);
    var ap = apNeeded(state);
    if (ap) { PC.crew.spendAP(state, ap); PC.node.tavernVisit(state); } // a season with AP spent here (§30.4)
    state.officerVisit = state.location.visit;
    state.money.crew -= FEE;
    if (c.id !== "davey") c.hired = true;
    var r = join(state, c);
    PC.node.tavernActionDone(state);
    PC.state.addLog(state, "Hired " + (r.officer.first + " " + (r.officer.last || "")).trim() + " (" + r.officer.type + ") for " + FEE + " crew gold" + (ap ? " and an action" : "") + ".");
    return r;
  }

  PC.officers = {
    ensureQuartermaster: ensureQuartermaster,
    vacate: vacate,
    votePending: votePending,
    voteScores: voteScores,
    runVote: runVote,
    speakBonus: speakBonus,
    quartermaster: quartermaster,
    FEE: FEE,
    aboard: aboard,
    holding: holding,
    likesOf: likesOf,
    reactions: reactions,
    leaning: leaning,
    candidates: candidates,
    hiringText: hiringText,
    apNeeded: apNeeded,
    hireCheck: hireCheck,
    hire: hire,
    join: join,
    joinNamed: joinNamed,
    dismiss: dismiss,
    dismissPay: dismissPay,
    namedType: namedType,
    generate: generate,
  };
})();
