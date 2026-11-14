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
      type: one(C().OFFICER_TYPES).id, level: 1,
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
    if (o.quartermaster) o.quartermaster = false; // the vote waits for the voyage events
    if (o.id === "davey") state.flags.davey_at_tavern = true;
    var line = o.id === "davey" ? PC.data.namedOfficers.davey.dismissal : (o.mentor ? (L().dismissal[o.voice] || "") : (L().dismissal[o.voice] || ""));
    PC.state.addLog(state, (o.first + " " + (o.last || "")).trim() + " is dismissed, with " + paid + " crew gold.");
    return { officer: o, pay: paid, line: line };
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
    FEE: FEE,
    aboard: aboard,
    holding: holding,
    likesOf: likesOf,
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
  };
})();
