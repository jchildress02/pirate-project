/* Pirate Chronicle — engine tests.
 * Run from the repo folder:  node tests/run_tests.js
 * No packages needed.
 */
"use strict";
var path = require("path");
var root = path.join(__dirname, "..");
[
  "js/rng.js", "js/checks.js", "js/state.js", "js/text.js", "js/scenes.js", "js/validate.js", "js/creator.js",
  "content/check_types.js", "content/modifiers.js", "content/creator.js", "content/test_captain.js", "content/test_scenes.js",
].forEach(function (f) { require(path.join(root, f)); });
var PC = globalThis.PC;

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + e.message); }
}
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || "") + " expected " + JSON.stringify(b) + ", got " + JSON.stringify(a));
}
function ok(v, msg) { if (!v) throw new Error(msg || "expected true"); }
function fresh(seed) { return PC.state.newGame(PC.data.testCaptain, { seed: seed || "test-seed" }); }

console.log("Checks (§11)");

test("roll reading: 5 setback, 6-8 partial, 9+ clean", function () {
  eq([5, 6, 8, 9, 12].map(PC.checks.readTotal), ["setback", "partial", "partial", "clean", "clean"]);
});

test("odds match the §11.1 table for every edge", function () {
  // [edge, partial-or-better %, clean %] from the design doc
  var table = [[-4, 17, 0], [-3, 28, 3], [-2, 42, 8], [-1, 58, 17], [0, 72, 28], [1, 83, 42],
               [2, 92, 58], [3, 97, 72], [4, 100, 83], [5, 100, 92], [6, 100, 97]];
  table.forEach(function (r) {
    var o = PC.checks.odds(r[0]);
    eq([Math.round(o.partialOrBetter * 100), Math.round(o.clean * 100)], [r[1], r[2]], "edge " + r[0]);
  });
});

test("tiers match §11.3", function () {
  eq([6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4].map(PC.checks.tier),
     ["Trivial", "Trivial", "Very Easy", "Very Easy", "Easy", "Easy", "Medium", "Medium", "Hard", "Very Hard", "Very Hard"]);
});

test("edge = stat + training + modifiers - DR (Brute on Intimidate)", function () {
  var s = fresh();
  var a = PC.checks.assess(s, { type: "Intimidate", dr: 2 });
  // Command 2 + training 1 + Brute 1 - DR 2 = 2
  eq(a.edge, 2);
  eq(a.tier, "Easy");
});

test("Brute's -1 applies to Persuade", function () {
  var a = PC.checks.assess(fresh(), { type: "Persuade", dr: 2 });
  // Charm 2 + training 1 - Brute 1 - DR 2 = 0
  eq(a.edge, 0);
});

test("two stats average, rounded up", function () {
  var s = fresh();
  s.captain.stats.Cunning = 3; s.captain.stats.Charm = 1;
  var a = PC.checks.assess(s, { type: "Read People", stat2: "Charm", dr: 0 });
  eq(a.parts[0].value, 2);
  s.captain.stats.Grit = 1; s.captain.stats.Daring = 2;
  eq(PC.checks.assess(s, { type: "Haul & Labor", stat2: "Daring", dr: 0 }).parts[0].value, 2, "1 and 2 rounds up to 2");
});

test("scene stat override replaces the home stat", function () {
  var a = PC.checks.assess(fresh(), { type: "Persuade", stat: "Seamanship", dr: 0 });
  eq(a.stats, ["Seamanship"]);
});

test("captain modifiers cap at ±3; same name never applies twice", function () {
  var s = fresh();
  PC.data.modifiers["T1"] = { name: "T1", edge: [{ type: "Endure", value: 2 }] };
  PC.data.modifiers["T2"] = { name: "T2", edge: [{ stat: "Grit", value: 2 }] };
  PC.data.modifiers["T2b"] = { name: "T2", edge: [{ stat: "Grit", value: 2 }] };
  s.captain.tags.push("T1", "T2", "T2b");
  var a = PC.checks.assess(s, { type: "Endure", dr: 0 });
  // Grit 1 + capped(2 + 2) = 1 + 3
  eq(a.rawEdge, 4);
  ok(a.modsCapped, "should report the cap");
});

test("gun bonus sits outside the cap", function () {
  var s = fresh();
  PC.data.modifiers["Big Gun"] = { name: "Big Gun", edge: [{ type: "Marksmanship", value: 2, outsideCap: true }] };
  PC.data.modifiers["T3"] = { name: "T3", edge: [{ type: "Marksmanship", value: 3 }] };
  s.captain.items.push("Big Gun"); s.captain.tags.push("T3");
  // Daring 2 + training 2 + 3 (capped) + 2 (outside) - 0
  eq(PC.checks.assess(s, { type: "Marksmanship", dr: 0 }).rawEdge, 9);
  eq(PC.checks.assess(s, { type: "Marksmanship", dr: 0 }).edge, 6, "clamped to +6");
});

test("modifiers can depend on a scene condition", function () {
  var s = fresh();
  PC.data.modifiers["Night Owl"] = { name: "Night Owl", edge: [{ type: "Keep Watch", value: 1, when: { condition: "Night" } }] };
  s.captain.tags.push("Night Owl");
  eq(PC.checks.assess(s, { type: "Keep Watch", dr: 0 }, { conditions: [] }).edge, 1);
  eq(PC.checks.assess(s, { type: "Keep Watch", dr: 0 }, { conditions: ["Night"] }).edge, 2);
});

test("edge at -4 or lower is a locked option", function () {
  var s = fresh();
  var a = PC.checks.assess(s, { type: "Dive", dr: 5 }); // Grit 1 - 5 = -4
  eq(a.edge, -4); ok(a.locked);
  ok(!PC.checks.assess(s, { type: "Dive", dr: 4 }).locked);
});

test("DR outside 0-8 is rejected", function () {
  var threw = false;
  try { PC.checks.assess(fresh(), { type: "Dive", dr: 9 }); } catch (e) { threw = true; }
  ok(threw);
});

console.log("Seeded dice");

test("same key, same dice; different key, (almost always) different dice", function () {
  eq(PC.rng.roll2d6("abc"), PC.rng.roll2d6("abc"));
  var same = 0;
  for (var i = 0; i < 200; i++) if (JSON.stringify(PC.rng.roll2d6("k" + i)) === JSON.stringify(PC.rng.roll2d6("j" + i))) same++;
  ok(same < 30, "too many collisions: " + same);
});

test("2d6 is fair over many keys", function () {
  var counts = {};
  var N = 36000;
  for (var i = 0; i < N; i++) { var d = PC.rng.roll2d6("fair" + i); counts[d[0] + d[1]] = (counts[d[0] + d[1]] || 0) + 1; }
  // P(7) = 6/36
  var p7 = counts[7] / N;
  ok(Math.abs(p7 - 6 / 36) < 0.01, "P(7) = " + p7);
  ok(Math.abs(counts[2] / N - 1 / 36) < 0.005, "P(2) = " + counts[2] / N);
});

test("reloading before a choice gives the same roll", function () {
  var s = fresh("reload");
  var saved = PC.state.serialize(s);
  PC.scenes.choose(s, 1);
  var first = s.current.pending.roll;
  var s2 = PC.state.deserialize(saved);
  PC.scenes.choose(s2, 1);
  eq(s2.current.pending.roll, first);
});

console.log("Scenes");

test("content passes the content check", function () {
  var v = PC.validate(fresh());
  eq(v.errors, []);
});

test("the start scene shows its choices: hidden one shown for Ash-Born, letter locked", function () {
  var v = PC.scenes.viewScene(fresh());
  var labels = v.choices.map(function (c) { return c.label; });
  ok(labels.indexOf("Tell him you're from Charleston.") >= 0, "Ash-Born choice with [Home City]");
  var letter = v.choices.filter(function (c) { return /letter/.test(c.label); })[0];
  eq(letter.status, "locked");
  eq(letter.reason, "Needs a letter of marque");
});

test("hidden choice disappears without the tag", function () {
  var s = fresh();
  s.captain.tags = s.captain.tags.filter(function (t) { return t !== "Ash-Born"; });
  ok(!PC.scenes.viewScene(s).choices.some(function (c) { return /from/.test(c.label); }));
});

test("variant line added for a Brute", function () {
  var v = PC.scenes.viewScene(fresh());
  ok(/size of you/.test(v.setup));
});

test("paying from crew gold: cost taken, then on to the beat, then the hub", function () {
  var s = fresh();
  PC.scenes.choose(s, 3);
  eq(s.money.crew, 580);
  PC.scenes.commit(s);
  eq(s.current.sceneId, "eng_test_beat");
  PC.scenes.choose(s, 0); PC.scenes.commit(s);
  eq(s.current.screen, "hub");
  ok(s.seen.eng_test_gangway === true);
});

test("a cost you can't afford locks the choice", function () {
  var s = fresh();
  s.money.crew = 5;
  var pay = PC.scenes.viewScene(s).choices.filter(function (c) { return /Pay/.test(c.label); })[0];
  eq(pay.status, "locked");
});

test("gold gained goes to the pot the player picks", function () {
  // Find a seed where the shot comes up clean (it pays 40 with a prompt).
  for (var i = 0; i < 200; i++) {
    var s = fresh("shot" + i);
    PC.scenes.choose(s, 2);
    if (s.current.pending.outcome !== "clean") continue;
    ok(PC.scenes.viewScene(s).result.needsPot);
    PC.scenes.commit(s, "purse");
    eq(s.money.purse, 40); eq(s.money.crew, 600); eq(s.crew.morale, 55); eq(s.meters.dread, 3);
    return;
  }
  throw new Error("no clean shot in 200 seeds");
});

test("Sharpshooter rerolls a missed shot once a season; the new result stands", function () {
  for (var i = 0; i < 200; i++) {
    var s = fresh("miss" + i);
    PC.scenes.choose(s, 2);
    if (s.current.pending.outcome === "clean") continue;
    var r = PC.scenes.viewScene(s).result.reroll;
    ok(r && r.name === "Sharpshooter", "reroll offered");
    PC.scenes.reroll(s);
    eq(s.rerollsUsed.Sharpshooter, 1);
    ok(!PC.scenes.viewScene(s).result.reroll, "only one reroll per roll");
    ok(s.current.pending.firstRoll, "first roll kept for display");
    // Used up for the season
    eq(PC.checks.availableReroll(s, { type: "Marksmanship" }, "setback"), null);
    PC.scenes.commit(s, "crew");
    PC.scenes.endSeason(s);
    ok(PC.checks.availableReroll(s, { type: "Marksmanship" }, "setback"), "back next season");
    return;
  }
  throw new Error("no missed shot in 200 seeds");
});

test("hub: tavern costs 1 action and is once a season", function () {
  var s = fresh();
  s.current = { screen: "hub", hubId: "test_harbor" };
  ok(PC.scenes.canEnter(s, "eng_test_tavern").ok);
  PC.scenes.enterScene(s, "eng_test_tavern");
  eq(s.ap.left, 6);
  PC.scenes.choose(s, 1); PC.scenes.commit(s, "crew");
  var c = PC.scenes.canEnter(s, "eng_test_tavern");
  ok(!c.ok); eq(c.why, "Done this season");
  PC.scenes.endSeason(s);
  ok(PC.scenes.canEnter(s, "eng_test_tavern").ok, "open again next season");
  eq(s.ap.left, 7);
  eq(PC.state.seasonName(s), "Summer");
});

test("seasons roll over into a new year after Winter", function () {
  var s = fresh();
  for (var i = 0; i < 4; i++) PC.state.advanceSeason(s);
  eq([PC.state.seasonName(s), s.time.year], ["Spring", 1755]);
});

test("no AP, no entry", function () {
  var s = fresh(); s.ap.left = 0;
  eq(PC.scenes.canEnter(s, "eng_test_tavern").why, "Not enough time this season");
});

console.log("Text");

test("captain tokens and the pronoun swap", function () {
  var s = fresh();
  var t = "{captain.He} said {captain.he}'s a {captain.man}, {captain.sir}. {captain.full}, [Ship Name].";
  eq(PC.text.render(t, s), "He said he's a man, sir. Dewey Test, Second Chance.");
  s.captain.gender = "f";
  eq(PC.text.render(t, s), "She said she's a woman, madam. Dewey Test, Second Chance.");
  eq(PC.text.render("{captain.his} / {captain.hers} / {captain.himself} / {captain.he'll}", s), "her / hers / herself / she'll");
});

test("NPC tokens", function () {
  eq(PC.text.render("{hob.He} moves {hob.his} crate.", fresh()), "He moves his crate.");
});

console.log("Saving");

test("save round-trips exactly", function () {
  var s = fresh();
  PC.scenes.choose(s, 3); PC.scenes.commit(s);
  var back = PC.state.deserialize(PC.state.serialize(s));
  eq(back, s);
});

test("bad files are rejected with a clear message", function () {
  ["{}", "[1,2]", JSON.stringify({ saveVersion: 999 })].forEach(function (t) {
    var threw = false;
    try { PC.state.deserialize(t); } catch (e) { threw = true; }
    ok(threw, "should reject " + t);
  });
});


test("a version 1 save upgrades to version 2", function () {
  var s = fresh();
  var old = JSON.parse(PC.state.serialize(s));
  old.saveVersion = 1; delete old.officers; delete old.quests;
  var back = PC.state.deserialize(JSON.stringify(old));
  eq(back.saveVersion, 2); eq(back.officers, []); eq(back.quests, {});
});

console.log("Character creator (§12)");

var C = PC.creator;
function goodDraft() {
  var d = C.blankDraft();
  d.first = "Ned"; d.last = "Cobb"; d.age = 30; d.portraitSet = "flinty";
  d.homeCity = "Charleston"; d.profession = "Sailor"; d.freePoint = "Navigate"; d.loss = "A";
  d.stats.Daring = 2; d.stats.Command = 2; d.stats.Seamanship = 2;
  d.training = { "Navigate": 1, "Marksmanship": 2, "Intimidate": 1, "Persuade": 1, "Pilot Shoals": 1 };
  d.traits = ["Bold", "Weatherwise"]; d.flaw = "Reckless";
  d.tags = ["Sharpshooter", "Storm-Born"]; d.debuffs = ["Bad Knee"];
  d.mentor = { first: "Gideon", last: "Hale", portraitSet: "skully", type: "Navigator", voice: "Old Salt", secondary: "Lonesome" };
  d.shipName = "Ember";
  return d;
}

test("a finished draft has no errors", function () {
  eq(C.allErrors(goodDraft()), []);
});

test("age bands set starting tags and debuffs (§12.3)", function () {
  eq([15, 25, 26, 35, 36, 40].map(function (a) { var b = C.band(a); return [b.band, b.tags, b.debuffs]; }),
     [["young", 1, 0], ["young", 1, 0], ["mid", 2, 1], ["mid", 2, 1], ["old", 3, 2], ["old", 3, 2]]);
  ok(!C.band(14) && !C.band(41));
});

test("captain portraits follow the age band; all eight sets offered", function () {
  var d = goodDraft();
  var ch = C.captainPortraitChoices(d);
  eq(ch.length, 8);
  ok(ch.every(function (c) { return /_mid\.webp$/.test(c.path); }));
  d.age = 18;
  ok(C.captainPortraitChoices(d).every(function (c) { return /_young\.webp$/.test(c.path); }));
});

test("the mentor's portraits are old and never the captain's set", function () {
  var d = goodDraft();
  var ch = C.mentorPortraitChoices(d);
  eq(ch.length, 7);
  ok(ch.every(function (c) { return c.set !== "flinty" && /_old\.webp$/.test(c.path); }));
  d.mentor.portraitSet = "flinty";
  ok(C.stepErrors(d, "mentor").length > 0);
});

test("every portrait file exists", function () {
  var fs = require("fs");
  C.allPortraitPaths().forEach(function (p) { ok(fs.existsSync(path.join(root, p)), "missing " + p); });
  eq(C.allPortraitPaths().length, 48);
});

test("stats: 3 points, cap 2, three at 2 and three at 1 (§12.6)", function () {
  var d = C.blankDraft();
  eq(C.statPointsLeft(d), 3);
  d.stats.Grit = 2;
  ok(!C.canRaiseStat(d, "Grit"), "cap 2");
  d.stats.Charm = 2; d.stats.Cunning = 2;
  ok(!C.canRaiseStat(d, "Daring"), "no points left");
  eq(C.stepErrors(d, "stats"), []);
});

test("training: 6 points, cap 2 including the free point", function () {
  var d = goodDraft();
  eq(C.trainingTotal(d, "Navigate"), 2);
  ok(!C.canRaiseType(d, "Navigate"), "free point counts toward the cap");
  d.training.Navigate = 2;
  ok(C.stepErrors(d, "training").length > 0);
});

test("changing profession gives back a point that the new free point would push over", function () {
  var d = goodDraft();
  d.training = { "Hold Your Ground": 2, "Navigate": 1, "Persuade": 1, "Intimidate": 1, "Pilot Shoals": 1 };
  d.profession = "Soldier"; d.freePoint = "Hold Your Ground";
  C.fitToProfession(d); // free point still valid for Soldier
  eq(d.freePoint, "Hold Your Ground");
  eq(d.training["Hold Your Ground"], 1);
});

test("Variant D is hidden; losses follow the profession", function () {
  var d = goodDraft();
  d.profession = "Official";
  eq(C.lossChoices(d).map(function (l) { return l.id; }), ["A", "B", "C"]);
  d.loss = "D";
  ok(C.stepErrors(d, "origin").length > 0);
});

test("exclusions: Refined/Wild, Pious/Heathen, Drunkard/Heavy Drinker, Eagle Eyed/Failing Eyes", function () {
  var d = goodDraft();
  d.traits = ["Refined"]; ok(C.blockedBy(d, "Wild"));
  d.traits = ["Pious"]; ok(C.blockedBy(d, "Heathen"));
  d.flaw = "Heavy Drinker"; ok(C.blockedBy(d, "Drunkard"));
  d.debuffs = ["Failing Eyes"]; ok(C.blockedBy(d, "Eagle Eyed"));
  d.debuffs = ["Bad Back"]; ok(C.blockedBy(d, "Hauler"));
  d.traits = ["Bold", "Wild"]; d.flaw = "Reckless"; d.debuffs = ["Bad Knee"];
  ok(!C.blockedBy(d, "Sharpshooter"));
});

test("younger captains can't keep extra tags or debuffs", function () {
  var d = goodDraft();
  d.age = 20; C.fitToAge(d);
  eq(d.tags.length, 1); eq(d.debuffs.length, 0);
  eq(C.stepErrors(d, "tags"), []);
});

test("mentor: secondary trait can't clash with the voice (§25.6)", function () {
  var d = goodDraft();
  d.mentor.voice = "Kindly";
  eq(C.secondaryBlocked(d, "Bloodthirsty"), "Clashes with Kindly");
  eq(C.secondaryBlocked(d, "Kindly"), "Already his voice");
  eq(C.secondaryBlocked(d, "Jovial"), null);
});

test("building the captain: starting package (§12.12)", function () {
  var t = C.build(goodDraft(), "seed-1");
  var s = PC.state.newGame(t, { seed: "seed-1" });
  eq(s.captain.tags, ["Ash-Born", "Grief-Stricken", "Sharpshooter", "Storm-Born", "Bad Knee"]);
  eq(s.captain.training.Navigate, 2);
  eq(s.captain.gender, "m");
  eq(s.money, { crew: 600, purse: 0 });
  eq(s.provisions, 10);
  eq([s.ship.name, s.ship.hull, s.ship.hullMax, s.ship.guns], ["Ember", 14, 20, 6]);
  eq(s.crew.count, 12);
  eq(s.officers.length, 1);
  var m = s.officers[0];
  eq([m.type, m.rung, m.mentor, m.quartermaster, m.unique, m.portrait.band], ["Navigator", 2, true, true, "Mentor", "old"]);
  ok(PC.data.creator.DRIVES.indexOf(m.drive) >= 0 && PC.data.creator.FEARS.indexOf(m.fear) >= 0);
  eq(s.npcs.charleston_merchant.rung, 2);
  ok(s.flags.profession_sailor && s.flags.loss_a);
  eq(s.quests.what_was_lost.status, "open");
  eq(C.build(goodDraft(), "seed-1").officers[0].drive, m.drive, "drive is seeded");
});

test("Baltimore adds 500 gold; women's portraits make a woman captain", function () {
  var d = goodDraft();
  d.homeCity = "Baltimore"; d.portraitSet = "mary"; d.mentor.portraitSet = "anne";
  var t = C.build(d, "s");
  eq(t.money.crew, 1100);
  eq(t.captain.gender, "f"); eq(t.officers[0].gender, "f");
  eq(Object.keys(t.npcs), []);
});

test("an unfinished draft won't build", function () {
  var threw = false;
  try { C.build(C.blankDraft(), "s"); } catch (e) { threw = true; }
  ok(threw);
});

test("the captain's portrait ages and takes the eyepatch with One Eye", function () {
  var s = PC.state.newGame(C.build(goodDraft(), "s"), { seed: "s" });
  eq(C.captainPortrait(s.captain), "assets/portraits/flinty_mid.webp");
  s.captain.age = 37;
  eq(C.captainPortrait(s.captain), "assets/portraits/flinty_old.webp");
  s.captain.tags.push("One Eye");
  eq(C.captainPortrait(s.captain), "assets/portraits/flinty_old_patch.webp");
  eq(C.officerPortrait(s.officers[0]), "assets/portraits/skully_old.webp");
});

test("random drafts are always complete and build", function () {
  for (var i = 0; i < 200; i++) {
    var d = C.randomDraft("r" + i);
    eq(C.allErrors(d), [], "draft " + i);
    C.build(d, "w" + i);
  }
});

test("every creator option has a modifier entry, and every modifier names real check types", function () {
  var ids = C.allTags().concat(C.allTraits(), PC.data.creator.FLAWS, PC.data.creator.DEBUFFS).map(function (x) { return x.id; });
  PC.data.creator.LOSSES.forEach(function (l) { ids.push(l.tag); });
  ids.forEach(function (id) { ok(PC.data.modifiers[id], "no modifier entry for " + id); });
  Object.keys(PC.data.modifiers).forEach(function (k) {
    var m = PC.data.modifiers[k];
    (m.edge || []).forEach(function (e) {
      if (e.type) ok(PC.data.checkTypes[e.type], k + ": unknown type " + e.type);
      if (e.group) ok(PC.data.checkGroups[e.group], k + ": unknown group " + e.group);
    });
    ((m.reroll && m.reroll.types) || []).forEach(function (t) { ok(PC.data.checkTypes[t], k + ": unknown reroll type " + t); });
  });
});

console.log("Modifiers from the creator");

function built(edit) {
  var d = goodDraft(); if (edit) edit(d);
  return PC.state.newGame(C.build(d, "s"), { seed: "s" });
}

test("a trait adds +1 on its types; a flaw -1", function () {
  var s = built();
  // Daring 2 + Bold 1 + Bad Knee -1 on Board = 2
  eq(PC.checks.assess(s, { type: "Board", dr: 0 }).edge, 2);
  // Cunning 1 + Reckless -1 on Notice Danger
  eq(PC.checks.assess(s, { type: "Notice Danger", dr: 0 }).edge, 0);
});

test("group modifiers: Rheumy Hands hits all of Fine Work", function () {
  var s = built(function (d) { d.debuffs = ["Rheumy Hands"]; });
  ["Forge", "Repair at Sea", "Treat Wounds"].forEach(function (t) {
    var a = PC.checks.assess(s, { type: t, dr: 0 });
    ok(a.parts.some(function (p) { return p.label === "Rheumy Hands" && p.value === -1; }), t);
  });
});

test("conditions: Deep Scar only under fire; Weak Chest on any check in the Cold", function () {
  var s = built(function (d) { d.loss = "C"; d.debuffs = ["Weak Chest"]; });
  var calm = PC.checks.assess(s, { type: "Hold Your Ground", dr: 0 });
  var fire = PC.checks.assess(s, { type: "Hold Your Ground", dr: 0 }, { conditions: ["Under Fire"] });
  eq(fire.edge, calm.edge - 1);
  var cold = PC.checks.assess(s, { type: "Persuade", dr: 0 }, { conditions: ["Cold"] });
  eq(cold.edge, PC.checks.assess(s, { type: "Persuade", dr: 0 }).edge - 1);
});

test("the season counts as a condition: Fiddler's reroll is Winter only", function () {
  var s = built(function (d) { d.tags = ["Fiddler", "Storm-Born"]; });
  ok(!PC.checks.availableReroll(s, { type: "Rally Crew" }, "setback"));
  s.time.season = 3; // Winter
  eq(PC.checks.availableReroll(s, { type: "Rally Crew" }, "setback").name, "Fiddler");
});

test("Dead Reckoner rerolls Navigate only in fog or open water", function () {
  var s = built(function (d) { d.tags = ["Dead Reckoner", "Storm-Born"]; d.mentor.type = "Gunner"; });
  ok(!PC.checks.availableReroll(s, { type: "Navigate" }, "partial", { conditions: ["Harbor"] }));
  ok(PC.checks.availableReroll(s, { type: "Navigate" }, "partial", { conditions: ["Fog"] }));
});

test("the mentor's Old Lessons rerolls a setback (not a partial) on what he taught", function () {
  var s = built(); // a Navigator mentor teaches Navigate, Outrun, Maneuver
  eq(PC.checks.availableReroll(s, { type: "Outrun" }, "setback").name, "Old Lessons (Gideon)");
  ok(!PC.checks.availableReroll(s, { type: "Outrun" }, "partial"));
  ok(!PC.checks.availableReroll(s, { type: "Haggle" }, "setback"));
  s.rerollsUsed["mentor:Old Lessons"] = 1;
  ok(!PC.checks.availableReroll(s, { type: "Outrun" }, "setback"), "once a season");
});

test("a built captain can play the test scenes", function () {
  var s = built();
  eq(PC.validate(s).errors, []);
  PC.scenes.choose(s, 0);
  PC.scenes.commit(s, "crew");
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
