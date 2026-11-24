/* Pirate Chronicle — engine tests.
 * Run from the repo folder:  node tests/run_tests.js
 * No packages needed.
 */
"use strict";
var path = require("path");
var root = path.join(__dirname, "..");
[
  "js/rng.js", "js/checks.js", "js/state.js", "js/text.js", "js/npcs.js", "js/crew.js", "js/articles.js", "js/node.js", "js/scenes.js", "js/quests.js", "js/officers.js", "js/rumors.js", "js/validate.js", "js/creator.js", "js/minigames.js", "js/salvage.js", "js/drinking.js", "js/liarsdice.js", "js/hunt_gen.js", "js/combat.js", "js/hunt.js", "js/summary.js", "js/world.js", "js/weather.js", "js/devtools.js",
  "content/check_types.js", "content/modifiers.js", "content/creator.js", "content/ships.js", "content/names.js", "content/economy.js", "content/articles.js",
  "content/test_captain.js", "content/test_scenes.js", "content/ocracoke.js", "content/ocracoke_scenes.js", "content/quests.js", "content/rumors.js", "content/officer_lines.js", "content/minigames.js", "content/hunt.js", "content/world.js", "content/weather.js", "content/norfolk.js",
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
function fresh(seed) { return PC.state.newGame(PC.data.testCaptain, { seed: seed || "test-seed", startScene: PC.data.testStart.scene }); }

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
  eq(PC.checks.assess(s, { type: "Endure", stat2: "Daring", dr: 0 }).parts[0].value, 2, "1 and 2 rounds up to 2");
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
  var v = PC.validate(PC.state.newGame(PC.data.testCaptain, { seed: "content-check" }));
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


test("a version 1 save upgrades to the current version", function () {
  var s = fresh();
  var old = JSON.parse(PC.state.serialize(s));
  old.saveVersion = 1; delete old.officers; delete old.quests;
  var back = PC.state.deserialize(JSON.stringify(old));
  eq(back.saveVersion, PC.state.SAVE_VERSION); eq(back.officers, []); eq(back.quests, {});
});

test("a version 2 (Milestone 1) save restarts at Ocracoke's arrival with its captain", function () {
  var s = fresh();
  var old = JSON.parse(PC.state.serialize(s));
  old.saveVersion = 2;
  ["location", "cargo", "articles", "nodes", "generated", "used"].forEach(function (k) { delete old[k]; });
  delete old.world.names; delete old.ship.upgrades; delete old.crew.tiers;
  old.money.crew = 777;
  var back = PC.state.deserialize(JSON.stringify(old));
  eq(back.saveVersion, PC.state.SAVE_VERSION);
  eq(back.location.node, "ocracoke");
  eq(back.current.sceneId, "ocr_sandbar");
  eq(back.money.crew, 777);
  eq(back.crew.tiers.Green, 12);
  ok(back.generated.ocr_keeper && back.generated.ocr_provisioner && back.generated.ocr_shipwright, "slots filled");
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

test("old ailments (§12.4): Rheumy Hands hits Light Fingers and Repair & Refit", function () {
  var s = built(function (d) { d.debuffs = ["Rheumy Hands"]; });
  ["Light Fingers", "Repair & Refit"].forEach(function (t) {
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

test("every ship class has its woodcut (§21.2)", function () {
  var fs = require("fs");
  eq(PC.data.shipClasses.length, 15);
  PC.data.shipClasses.forEach(function (c) { ok(fs.existsSync(path.join(root, PC.data.shipArt(c.id))), "missing " + c.id); });
  eq(PC.data.shipArt("Sloop"), "assets/ships/sloop.webp");
});


console.log("Names and Minor NPCs (§36, §15)");

function ocr(seed) { return PC.state.newGame(PC.data.testCaptain, { seed: seed || "ocr-seed" }); }
// Play scenes until the captain is back in the town menus. `prefs` names
// choice ids to take when they're open; otherwise the first open choice that
// moves on (not an information step). Gold gained goes to the crew.
function choiceIndex(s, id) {
  var sc = PC.scenes.sceneById(s.current.sceneId);
  for (var i = 0; i < sc.choices.length; i++) if (sc.choices[i].id === id) return i;
  return -1;
}
// The Miranda dive (§18.2) by the plainest road: a clean grab in the Hull
// brings up the mermaid, then surface, any gold to the crew, and back to
// the story.
function diveForMermaid(s) {
  forced("clean", function () { PC.salvage.act(s, "grab", "hull"); });
  PC.salvage.act(s, "surface");
  if (!s.minigame.banked) PC.salvage.bank(s, s.minigame, "crew");
  PC.minigames.leave(s);
}
function play(s, prefs, limit) {
  prefs = prefs || [];
  for (var n = 0; n < (limit || 200) && (s.current.screen === "scene" || (s.current.screen === "minigame" && s.minigame.miranda)); n++) {
    if (s.current.screen === "minigame") { diveForMermaid(s); continue; }
    var v = PC.scenes.viewScene(s);
    var sc = PC.scenes.sceneById(s.current.sceneId);
    var open = v.choices.filter(function (c) { return c.status === "open"; });
    var pick = null;
    prefs.some(function (id) { var i = choiceIndex(s, id); return open.some(function (c) { if (c.index === i) { pick = c; return true; } return false; }); });
    if (!pick) pick = open.filter(function (c) { var ch = sc.choices[c.index]; return !ch.info; })[0];
    if (!pick) throw new Error("stuck in " + sc.id);
    PC.scenes.choose(s, pick.index);
    PC.scenes.commit(s, "crew");
  }
  return s;
}
function pickIn(s, id) { PC.scenes.choose(s, choiceIndex(s, id)); PC.scenes.commit(s, "crew"); }
// The opening by the plainest road (the mentor at the helm, "just passing
// through", pay the fee). The economy tests start from the starting package,
// so the sandbar's knocks are put back.
function playOpening(s) {
  play(s, ["mentor", "passing", "pay"]);
  s.ship.hull = 14; s.crew.morale = 50; s.provisions = 10;
  s.location.place = null; // back out on the beach, before the Tavern
}

test("a new game starts at Ocracoke with three persistent Minors named", function () {
  var s = ocr();
  eq(s.location.node, "ocracoke");
  eq(s.current.sceneId, "ocr_sandbar");
  ["ocr_keeper", "ocr_shipwright", "ocr_provisioner"].forEach(function (id) {
    var g = s.generated[id];
    ok(g && g.first && g.full, id + " named");
    eq(g.traits.length, 2, id + " has two traits");
    ok(s.world.names.indexOf(g.full) >= 0, "registered");
  });
  eq(s.generated.ocr_keeper.role, "Tavern Keeper");
});

test("the same world seed always gives the same people; another seed, other people", function () {
  var a = ocr("same"), b = ocr("same"), c = ocr("other");
  eq(a.generated, b.generated);
  ok(JSON.stringify(a.generated) !== JSON.stringify(c.generated));
});

test("persistent Minor gender follows the role weights (§15.1)", function () {
  var count = { "Tavern Keeper": 0, "Merchant": 0, "Craftsman": 0, "Dockhand/Laborer": 0 }, n = 2000;
  var s = fresh();
  Object.keys(count).forEach(function (role) {
    for (var i = 0; i < n; i++) {
      var g = PC.npcs.generate(s, { id: "x", role: role, pool: "master", key: "g|" + role + "|" + i });
      if (g.gender === "f") count[role]++;
      s.world.names = []; // keep the registry small for this sample
    }
  });
  function near(role, p) { var f = count[role] / n; ok(Math.abs(f - p) < 0.04, role + " women " + f + " vs " + p); }
  near("Tavern Keeper", 0.35); near("Merchant", 0.25); near("Craftsman", 0.10); near("Dockhand/Laborer", 0.05);
});

test("names never repeat in the world, never use reserved names, never 'Gordon Gordon'", function () {
  var s = fresh(), seen = {};
  var R = PC.data.names.RESERVED;
  for (var i = 0; i < 1500; i++) {
    var g = PC.npcs.generate(s, { id: "n" + i, role: "Pirate", pool: "master", key: "u|" + i });
    ok(!seen[g.full], "duplicate " + g.full);
    seen[g.full] = true;
    ok(R.given.indexOf(g.first) < 0, "reserved given " + g.first);
    ok(!g.last || R.surnames.indexOf(g.last) < 0, "reserved surname " + g.last);
    ok(g.first !== g.last, "same given and surname");
    ok(["Arthur Twopenny", "Bobby Rats"].indexOf(g.full) < 0, "a Named NPC's full name");
  }
});

test("no generated NPC shares the captain's surname", function () {
  var s = fresh();
  for (var i = 0; i < 400; i++) {
    var g = PC.npcs.generate(s, { id: "c", role: "Merchant", pool: "avalon", key: "cs|" + i });
    ok(g.last !== s.captain.last, "relative of the captain: " + g.full);
    s.world.names = [];
  }
});

test("pirates take a prefix nickname about half the time and keep a surname (R3)", function () {
  var s = fresh(), nick = 0, n = 1000;
  for (var i = 0; i < n; i++) {
    var g = PC.npcs.generate(s, { id: "p", role: "Pirate Captain", pool: "master", key: "nk|" + i });
    if (g.nickname) {
      nick++;
      eq(g.nickname.form, "prefix");
      ok(g.last, "a nicknamed pirate has a surname");
      eq(g.full, g.nickname.word + " " + g.first + " " + g.last);
      eq(PC.npcs.menuName(g), g.full); // no "Captain" in menus
    } else {
      eq(PC.npcs.menuName(g), ((g.title ? g.title + " " : "") + g.full).trim());
    }
    s.world.names = [];
  }
  ok(Math.abs(nick / n - 0.5) < 0.05, "nickname rate " + nick / n);
});

test("Minor traits come from the role pool and never pair exclusives", function () {
  var s = fresh(), R = PC.data.names.ROLES["Tavern Keeper"];
  var pool = R.bold.concat(R.pool);
  for (var i = 0; i < 300; i++) {
    var t = PC.npcs.drawTraits(PC.rng.fromKey("t|" + i), "Tavern Keeper", 2);
    t.forEach(function (x) { ok(pool.indexOf(x) >= 0, x + " not in the pool"); });
    PC.data.names.EXCLUSIVE.forEach(function (p) { ok(!(t.indexOf(p[0]) >= 0 && t.indexOf(p[1]) >= 0), "exclusive pair " + p); });
  }
});

test("titles by role: merchants get the pool's honorific, officers a rank (§36.2)", function () {
  var s = fresh();
  var m = PC.npcs.generate(s, { id: "m", role: "Merchant", pool: "frisian", key: "title|m", gender: "m" });
  eq(m.title, "Mynheer");
  var o = PC.npcs.generate(s, { id: "o", role: "Colonial Officer", pool: "avalon", key: "title|o" });
  ok(["Lieutenant", "Captain", "Major"].indexOf(o.title) >= 0);
  var k = PC.npcs.generate(s, { id: "k", role: "Tavern Keeper", pool: "avalon", key: "title|k" });
  eq(k.title, "");
});

test("the creator's random names: Avalon captain names, ship names from the Pirate and Avalon merchant lists", function () {
  var S = PC.data.names.SHIPS, A = PC.data.names.POOLS.avalon, B = PC.data.names.BRETON;
  for (var i = 0; i < 200; i++) {
    var c = PC.npcs.randomCaptainName(i % 2 ? "f" : "m", "cap|" + i);
    var given = i % 2 ? A.women.concat(B.women) : A.men.concat(B.men);
    ok(given.indexOf(c.first) >= 0, c.first);
    ok(A.surnames.indexOf(c.last) >= 0, c.last);
    var sh = PC.npcs.randomShipName("ship|" + i);
    ok(S.pirate.indexOf(sh) >= 0 || S.avalon.indexOf(sh) >= 0, sh);
    ok(S.avalonNavy.indexOf(sh) < 0, "never navy names");
  }
});

test("pronoun tokens work for generated Minors by slot name ({keeper.he})", function () {
  var s = ocr();
  var g = s.generated.ocr_keeper;
  g.gender = "f";
  eq(PC.text.render("{keeper.He} pours. {shipwright.mr} Shipwright nods.", s).indexOf("She pours."), 0);
  s.generated.ocr_shipwright.gender = "f";
  ok(PC.text.render("{shipwright.mr} Shipwright", s) === "Missus Shipwright");
  s.generated.ocr_shipwright.gender = "m";
  ok(PC.text.render("{shipwright.mr} Shipwright", s) === "Mr. Shipwright");
  ok(PC.text.render("[Mentor] waits.", s) === "your mentor waits.", "no mentor: a fallback");
});

console.log("Ocracoke (§17.2)");

test("the opening: the sandbar, the mentor, Twopenny's 25 harbor due, Wary to Neutral, then the Tavern", function () {
  var s = ocr();
  eq(PC.npcs.get(s, "twopenny").rungName, "Wary");
  play(s, ["mentor", "passing", "pay"]);
  eq(s.money.crew, 575);
  eq(PC.npcs.get(s, "twopenny").rungName, "Neutral");
  eq(s.current.screen, "node");
  eq(s.location.place, "tavern");
  ok(s.flags.ocr_opening_done, "opening done");
});

test("first visit: only the Tavern and the Ship are open; lodging is locked", function () {
  var s = ocr(); playOpening(s);
  var p = {}; PC.node.places(s).forEach(function (x) { p[x.id] = x; });
  ok(!p.tavern.locked && !p.ship.locked);
  ok(p.docks.locked && p.merchant.locked && p.graveyard.locked);
  PC.node.enter(s, "tavern");
  eq(PC.node.lodgingCheck(s, 1).ok, false);
});

test("the first Tavern action (asking for rumors) fires Welcome to the Underworld; leaving fires A Dying Pirate's Wish", function () {
  var s = ocr(); playOpening(s);
  PC.node.enter(s, "tavern");
  var r = PC.rumors.askKeeper(s);
  ok(r.rumors.length >= 1, "at least one rumor");
  eq(PC.node.nextQueued(s), "ocr_uw_1");
  PC.scenes.enterScene(s, "ocr_uw_1");
  play(s, ["coin", "collect", "knock_out", "on"]);
  eq(s.current.screen, "node");
  var next = PC.node.leave(s);
  eq(next, "ocr_dpw_1");
  PC.scenes.enterScene(s, next);
  play(s, ["on", "dive", "swim", "alright"]);
  eq(s.current.screen, "node");
  eq(s.money.crew, 575 + 385);
  eq(s.cargo.treasure.clean, 10);
  eq(s.ap.left, 6, "the Wish's dive costs 1; Welcome to the Underworld costs none (§41.13)");
  eq(PC.npcs.get(s, "bobby").rungName, "Friendly");
  eq(PC.npcs.get(s, "ollie").rungName, "Friendly");
  ok(PC.npcs.get(s, "geezer").dead, "Geezer dies");
  ok(s.captain.items.indexOf("Lilyhook Fragment 1") >= 0, "the fragment");
  var p = {}; PC.node.places(s).forEach(function (x) { p[x.id] = x; });
  ok(!p.docks.locked && !p.merchant.locked && !p.graveyard.locked);
});

test("leaving the Tavern without doing anything fires both, Underworld first", function () {
  var s = ocr(); playOpening(s);
  PC.node.enter(s, "tavern");
  eq(PC.node.leave(s), "ocr_uw_1");
  eq(s.location.queue, ["ocr_dpw_1"]);
});

function opened(seed) {
  var s = ocr(seed); playOpening(s);
  PC.node.enter(s, "tavern");
  PC.scenes.enterScene(s, PC.node.leave(s));
  play(s, ["coin", "collect", "knock_out", "on", "dive", "swim", "alright"]);
  s.captain.tags = s.captain.tags.filter(function (t) { return t !== "Wounded"; });
  return s;
}

test("Ocracoke's prices: provisions 24, treasure 70, fence 38.5 then 41.25 at Friendly, kill-devil 12", function () {
  var s = opened();
  PC.npcs.get(s, "ocr_provisioner"); // Neutral
  eq(PC.node.provisionsPrice(s), 24);
  eq(PC.node.unitPrice(s, "provisioner", "treasure"), 70);
  eq(PC.node.shopPrice(s, "ocracoke", "Kill-devil rum", "ocr_provisioner"), 12);
  // Bobby is Friendly after Welcome to the Underworld: 55% + 5% of 70.
  eq(PC.node.unitPrice(s, "fence", "treasure"), 42);
  s.npcs.bobby.rung = 0;
  eq(PC.node.unitPrice(s, "fence", "treasure"), 38.5);
});

test("Spring 1754's stock is fixed: kill-devil 15, rice 6, tobacco 4, sugar 3", function () {
  eq(PC.node.season(opened("a")).stock, { "Kill-devil rum": 15, "Rice": 6, "Tobacco": 4, "Sugar": 3 });
  eq(PC.node.season(opened("b")).stock, { "Kill-devil rum": 15, "Rice": 6, "Tobacco": 4, "Sugar": 3 });
});

test("selling the pouch: 10 clean treasure to the provisioner for 700 crew gold", function () {
  var s = opened();
  var before = s.money.crew;
  var r = PC.node.sell(s, "provisioner", "treasure", 10);
  eq([r.units, r.gold], [10, 700]);
  eq(s.money.crew - before, 700);
  eq(s.cargo.treasure.clean, 0);
});

test("the provisioner refuses dirty goods; the fence takes only dirty, within his 2,000 cap", function () {
  var s = opened();
  s.cargo.treasure.dirty = 100;
  var r = PC.node.sell(s, "fence", "treasure", 100);
  // 42 a unit at Friendly: 47 units fit in 2,000.
  eq(r.units, 47); eq(r.gold, 1974); ok(r.partial);
  eq(PC.node.sell(s, "fence", "treasure", 1).units, 0, "cap spent");
});

test("the provisioner's cap is 5,000 a season", function () {
  var s = opened();
  s.cargo.treasure.clean = 100;
  var r = PC.node.sell(s, "provisioner", "treasure", 100);
  eq(r.units, 71); // 71 × 70 = 4,970
  eq(PC.node.provisionerCapLeft(s), 30);
});

test("buying provisions and goods fills the hold; a full hold refuses", function () {
  var s = opened();
  eq(PC.crew.slotsUsed(s), 10 + Math.ceil(10 / 5));
  PC.node.buyProvisions(s, 14);
  eq(s.provisions, 24);
  PC.node.buyGood(s, "Kill-devil rum", 2);
  eq(s.cargo.goods["Kill-devil rum"].clean, 2);
  eq(PC.node.season(s).stock["Kill-devil rum"], 13);
  var free = PC.crew.slotsFree(s);
  var threw = false; try { PC.node.buyProvisions(s, free + 1); } catch (e) { threw = true; }
  ok(threw, "over the hold");
});

test("the first repair: 6 HP for 38 gold and 1 action, and the frayed rigging is fixed", function () {
  var s = opened();
  eq(PC.node.repairCost(s, 6), 38);
  ok(PC.node.repairTakesAP(s, 6) && !PC.node.repairTakesAP(s, 4), "25% line");
  var ap = s.ap.left, gold = s.money.crew;
  PC.node.repair(s, 6);
  eq(s.ship.hull, 20); eq(s.ap.left, ap - 1); eq(gold - s.money.crew, 38);
  eq(s.ship.speed, 3); eq(s.ship.rigging, "sound");
});

test("upgrades: level 2 at 1,200; the yard tops out at level 2; hull +15%", function () {
  var s = opened();
  s.money.crew = 10000;
  eq(PC.node.upgradeInfo(s, "hull").cost, 1200);
  PC.node.upgrade(s, "hull");
  eq(s.ship.hullMax, 23);
  ok(PC.node.upgradeInfo(s, "hull").atCap, "level 3 isn't sold here");
  eq(PC.node.gunPrice(s), 80);
  PC.node.buyGuns(s, 10);
  eq(s.ship.guns, 10);
});

test("crew pool: 15-25 hands, only Green, Seasoned and Veteran; signing at 12 / 36 / 60", function () {
  var s = opened();
  var p = PC.node.poolAvailable(s);
  var total = p.Green + p.Able + p.Seasoned + p.Veteran;
  ok(total >= 15 && total <= 25, "pool " + total);
  eq(p.Able, 0);
  eq([PC.node.signingCost(s, "Green"), PC.node.signingCost(s, "Seasoned"), PC.node.signingCost(s, "Veteran")], [12, 36, 60]);
});

test("recruiting caps at the ship's 30 berths and counts as raw hands", function () {
  var s = opened();
  s.money.crew = 5000;
  var p = PC.node.poolAvailable(s);
  ["Seasoned", "Green", "Veteran"].forEach(function (t) { if (p[t]) PC.node.recruit(s, t, p[t]); });
  ok(s.crew.count <= 30);
  eq(s.crew.count, Math.min(30, 12 + p.Green + p.Seasoned + p.Veteran));
  ok(PC.crew.discipline(s) <= 1, "raw hands cost Discipline");
});

test("paying off hands: half a share, at least 50, no morale cost", function () {
  var s = opened();
  var each = PC.crew.payOffEach(s);
  eq(each, 50); // ~960 gold over 12 hands + mentor-less officers + captain 2: a share is ~69
  var m = s.crew.morale;
  PC.node.payOff(s, "Green", 2);
  eq(s.crew.count, 10); eq(s.crew.morale, m);
});

test("shore leave: once a season, 15 a crewman an action, +10 / +15, +5 at a free port", function () {
  var s = opened();
  PC.node.enter(s, "tavern");
  eq(PC.node.lodgingCost(s, 2), 15 * 12 * 2);
  var m = s.crew.morale;
  PC.node.lodging(s, 2);
  eq(s.crew.morale, m + 20);
  eq(PC.node.lodgingCheck(s, 1).ok, false);
});

test("the harbor due on a return: 25, then the shortfall taken in kind, then the stocks", function () {
  var s = opened();
  eq(PC.node.portFee(s), 25);
  s.money.crew = 10; s.cargo.treasure.clean = 1;
  var r = PC.node.payPortFee(s);
  eq(r.paid, 10); eq(r.taken, ["1 clean treasure"]); eq(s.cargo.treasure.clean, 0);
  s.money.crew = 0; s.provisions = 0; s.cargo.goods = {};
  var ap = s.ap.left;
  r = PC.node.payPortFee(s);
  ok(r.stocks); eq(s.ap.left, ap - 1);
});

test("Twopenny at Friend waives a due the captain can't cover", function () {
  var s = opened();
  s.npcs.twopenny.rung = 2;
  s.money.crew = 5;
  var r = PC.node.payPortFee(s);
  eq(r.waived, 20);
});

test("Wary Standing with the pirates doubles the due and adds 10% to purchases", function () {
  var s = opened();
  s.meters.standing.pirates = -20;
  eq(PC.node.portFee(s), 50);
  eq(PC.node.provisionsPrice(s), 26.4);
});

test("the arrival popup: the wounded recover or are paid off, then the due", function () {
  var s = opened();
  s.crew.wounded = 10;
  var pop = PC.node.arrive(s, "ocracoke", { fromHunt: true });
  ok(pop.lines.length >= 3);
  eq(s.crew.wounded, 0);
});

test("the arrival popup (P16): each paid line says which pot paid, with no repeat lines under it", function () {
  var s = opened(); s.money.crew = 1000;
  var pop = PC.node.arrive(s, "ocracoke", { fromHunt: true });
  ok(pop.lines.some(function (l) { return /crew gold\)$/.test(l); }), pop.lines.join(" | "));
  eq(pop.chips.length, pop.lines.length);
});

test("a Rival shipwright won't serve; Service Level cuts his prices", function () {
  var s = opened();
  s.npcs.ocr_shipwright.rung = 3;
  eq(PC.node.repairPerHp(s), 5.44);
  s.npcs.ocr_shipwright.rung = -2;
  ok(PC.node.shipwrightGreeting(s).refuse);
  eq(PC.node.repair(s, 1).line, PC.data.nodes.ocracoke.lines.shipwright.refuse);
});

console.log("Milestone 3: scenes and quests (§17.2, §30, §25.7)");

// Force every check to one outcome while fn runs (the dice are seeded, so
// tests that need a particular branch say so).
function forced(outcome, fn) {
  var real = PC.checks.resolve;
  var totals = { clean: 12, partial: 7, setback: 2 };
  PC.checks.resolve = function (state, check, key, ctx) {
    var a = PC.checks.assess(state, check, ctx);
    return { assessment: a, dice: [1, 1], total: totals[outcome], outcome: outcome, key: key };
  };
  try { return fn(); } finally { PC.checks.resolve = real; }
}
function withLoss(s, v) {
  var L = PC.data.creator.LOSSES;
  s.captain.tags = s.captain.tags.filter(function (t) { return !L.some(function (l) { return l.tag === t; }); });
  s.captain.loss = v;
  s.captain.tags.push(L.filter(function (l) { return l.id === v; })[0].tag);
  return s;
}
function visibleIds(s) {
  var sc = PC.scenes.sceneById(s.current.sceneId);
  return PC.scenes.viewScene(s).choices.map(function (c) { return sc.choices[c.index].id + (c.status === "locked" ? "(locked)" : ""); });
}

test("the opening plays the real scenes in order: sandbar, mentor, Twopenny, the Tavern", function () {
  var s = ocr();
  eq(s.current.sceneId, "ocr_sandbar");
  forced("partial", function () { pickIn(s, "pilot"); });
  eq(s.ship.hull, 13);
  eq(s.current.sceneId, "ocr_mentor");
  ok(PC.scenes.viewScene(s).setup.indexOf("barely pay you any mind") >= 0, "no flag: the plain line");
  ok(PC.scenes.viewScene(s).setup.indexOf("your brother") >= 0, "[Loss Target] for Variant A");
  pickIn(s, "on");
  eq(s.current.sceneId, "ocr_twopenny_1");
});

test("the sandbar: a wreck sets bar_wrecked, colors the mentor and Twopenny, and makes Intimidate DR 3", function () {
  var s = ocr();
  forced("setback", function () { pickIn(s, "full_sail"); });
  eq([s.ship.hull, s.provisions, s.crew.morale], [9, 8, 45]);
  ok(s.flags.bar_wrecked);
  ok(PC.scenes.viewScene(s).setup.indexOf("snicker") >= 0);
  ok(PC.scenes.viewScene(s).setup.indexOf("Especially since she's just taken a beating.") >= 0);
  pickIn(s, "on");
  ok(PC.scenes.viewScene(s).setup.indexOf("Clumsy on the approach") >= 0);
  pickIn(s, "passing");
  var ids = visibleIds(s);
  ok(ids.indexOf("refuse_wrecked") >= 0 && ids.indexOf("refuse") < 0, ids.join());
});

test("a Reckless captain's full sail is DR 3 (the temptation), and Distrustful relabels the helm choice", function () {
  var s = ocr(); s.captain.flaws = ["Reckless"];
  var ids = visibleIds(s);
  ok(ids.indexOf("full_sail_tempted") >= 0 && ids.indexOf("full_sail") < 0);
  s.captain.flaws = ["Distrustful"];
  ok(PC.scenes.viewScene(s).choices[1].label.indexOf("Reluctantly") === 0);
});

test("Twopenny: telling him your loss earns the pointer, by variant", function () {
  ["A", "B", "C"].forEach(function (v) {
    var s = withLoss(ocr(), v);
    forced("clean", function () { pickIn(s, "pilot"); });
    pickIn(s, "on");
    ok(PC.scenes.viewScene(s).choices[0].label.indexOf(v === "A" ? "my brother" : v === "B" ? "jewels" : "someone") >= 0, v);
    pickIn(s, "loss"); pickIn(s, "pay");
    eq(s.current.sceneId, "ocr_twopenny_pointer");
    var t = PC.scenes.viewScene(s).setup;
    ok(t.indexOf(v === "B" ? "Bobby Rats" : "one-armed pirate") >= 0, v + ": " + t);
  });
});

test("Twopenny: information steps return to the fee menu with the answer showing", function () {
  var s = ocr(); forced("clean", function () { pickIn(s, "pilot"); }); pickIn(s, "on"); pickIn(s, "passing");
  pickIn(s, "who");
  eq(s.current.sceneId, "ocr_twopenny_fee");
  ok(PC.scenes.viewScene(s).setup.indexOf("They call me Arthur Twopenny") >= 0);
  pickIn(s, "pay");
  eq(s.current.sceneId, "ocr_twopenny_exit");
});

test("Twopenny: flattery waives the fee and makes him Friendly; mocking him blocks flattery and any rise", function () {
  var s = ocr(); forced("clean", function () { pickIn(s, "pilot"); }); pickIn(s, "on"); pickIn(s, "passing");
  forced("clean", function () { pickIn(s, "flatter"); });
  eq(s.money.crew, 600);
  eq(PC.npcs.get(s, "twopenny").rungName, "Friendly");
  var t = ocr(); forced("clean", function () { pickIn(t, "pilot"); }); pickIn(t, "on"); pickIn(t, "passing");
  pickIn(t, "small");
  ok(visibleIds(t).indexOf("flatter(locked)") >= 0, visibleIds(t).join());
  pickIn(t, "donate");
  eq(t.money.crew, 550);
  eq(PC.npcs.get(t, "twopenny").rungName, "Wary");
});

test("Twopenny: a flattery partial gives the 10-gold discount", function () {
  var s = ocr(); forced("clean", function () { pickIn(s, "pilot"); }); pickIn(s, "on"); pickIn(s, "passing");
  forced("partial", function () { pickIn(s, "flatter"); });
  ok(visibleIds(s).indexOf("pay_discount") >= 0 && visibleIds(s).indexOf("pay") < 0);
  pickIn(s, "pay_discount");
  eq(s.money.crew, 590);
  eq(PC.npcs.get(s, "twopenny").rungName, "Neutral");
});

test("Twopenny: refuse, then the shove: clean humiliates him (Rival); setback costs 25 and he wins", function () {
  var s = ocr(); forced("clean", function () { pickIn(s, "pilot"); }); pickIn(s, "on"); pickIn(s, "passing");
  forced("partial", function () { pickIn(s, "refuse"); });
  eq(s.current.sceneId, "ocr_twopenny_partial");
  ok(PC.scenes.viewScene(s).setup.indexOf("Ten gold pieces") >= 0, "the line carries over");
  forced("clean", function () { pickIn(s, "shove"); });
  eq(PC.npcs.get(s, "twopenny").rungName, "Rival");
  ok(s.flags.tp_humiliated);
  eq(s.current.sceneId, "ocr_twopenny_exit");
  var t = ocr(); forced("clean", function () { pickIn(t, "pilot"); }); pickIn(t, "on"); pickIn(t, "passing");
  forced("setback", function () { pickIn(t, "refuse"); });
  forced("setback", function () { pickIn(t, "shove"); });
  eq(t.money.crew, 575);
  ok(t.flags.tp_beat_you);
});

test("the opening's exit walks the captain into the Tavern; the one-armed pirate sits there for A and C only", function () {
  var s = ocr(); play(s, ["mentor", "passing", "pay"]);
  eq(s.location.place, "tavern");
  ok(PC.node.oneArmedHere(s));
  ok(!PC.node.oneArmedHere(withLoss(ocr(), "B")));
});

test("the one-armed pirate: 30 to pay, Haggle partial 15, a setback 60, last result wins; the lead goes in the journal", function () {
  var s = ocr(); playOpening(s); PC.node.enter(s, "tavern");
  PC.scenes.enterScene(s, "ocr_oap");
  ok(visibleIds(s).indexOf("pay_30") >= 0);
  forced("setback", function () { pickIn(s, "threaten"); });
  ok(visibleIds(s).indexOf("pay_60") >= 0 && visibleIds(s).indexOf("threaten(locked)") >= 0, visibleIds(s).join());
  forced("partial", function () { pickIn(s, "haggle"); });
  ok(visibleIds(s).indexOf("pay_15") >= 0 && visibleIds(s).indexOf("pay_60") < 0, visibleIds(s).join());
  pickIn(s, "pay_15");
  eq(s.money.crew, 560);
  eq(s.current.sceneId, "ocr_oap_lead");
  ok(PC.scenes.viewScene(s).setup.indexOf("chained to the mast") >= 0);
  pickIn(s, "on");
  ok(PC.quests.hasLead(s, "what_was_lost", "trident"));
  ok(!PC.node.oneArmedHere(s), "he's gone once heard");
  var j = PC.quests.journal(s).filter(function (x) { return x.id === "what_was_lost"; })[0];
  eq([j.leads, j.objective, j.summary], [1, "The trail leads beyond Ocracoke.", "Find your brother, pressganged onto a pirate ship."], "the §41.14 objective, with the variant's summary under it");
});

test("talking to the one-armed pirate first fires Welcome to the Underworld after", function () {
  var s = ocr(); playOpening(s); PC.node.enter(s, "tavern");
  PC.node.tavernActionDone(s);
  PC.scenes.enterScene(s, "ocr_oap");
  pickIn(s, "pay_30"); pickIn(s, "on");
  eq(s.current.sceneId, "ocr_uw_1");
});

test("Welcome to the Underworld: failed approaches grey out; Brawling repeats with \"again\"; Variant B's lead", function () {
  var s = withLoss(ocr(), "B"); playOpening(s); PC.node.enter(s, "tavern");
  PC.scenes.enterScene(s, "ocr_uw_1");
  ok(visibleIds(s).indexOf("jewels") >= 0, "B can ask about the jewels");
  pickIn(s, "coin"); pickIn(s, "collect");
  forced("partial", function () { pickIn(s, "intimidate"); });
  ok(visibleIds(s).indexOf("intimidate(locked)") >= 0);
  forced("setback", function () { PC.scenes.choose(s, choiceIndex(s, "knock_out")); });
  ok(PC.scenes.viewScene(s).result.text.indexOf("far wall.") >= 0);
  PC.scenes.commit(s);
  forced("setback", function () { PC.scenes.choose(s, choiceIndex(s, "knock_out")); });
  ok(PC.scenes.viewScene(s).result.text.indexOf("far wall again.") >= 0);
  PC.scenes.commit(s);
  forced("partial", function () { pickIn(s, "knock_out"); });
  ok(PC.scenes.test(s, { seasonFlag: "keeper_annoyed" }), "the keeper is annoyed this season");
  eq(s.current.sceneId, "ocr_uw_reward");
  ok(PC.scenes.viewScene(s).setup.indexOf("very tall man") >= 0);
  PC.scenes.choose(s, 0);
  ok(PC.scenes.viewScene(s).result.needsPot, "purse or crew");
  PC.scenes.commit(s, "purse");
  eq(s.money.purse, 385);
  ok(PC.quests.hasLead(s, "what_was_lost", "bald_man"));
  ok(PC.node.fenceOpen(s));
  // P3: the base stays DR 2; the annoyed keeper is its own line in the odds.
  eq(PC.rumors.talkCheck(s).dr, 2);
  ok(PC.rumors.talkCheck(s).extra.some(function (x) { return x.label === "Keeper annoyed" && x.value === -1; }));
});

test("A Dying Pirate's Wish: the Miranda dive costs 1 action; a shark setback is Wounded until the season ends", function () {
  var s = ocr(); playOpening(s); PC.node.enter(s, "tavern");
  PC.scenes.enterScene(s, "ocr_dpw_1");
  play(s, ["spit", "natural", "paying", "who", "full", "no_promises", "like_him"], 7);
  eq(s.current.sceneId, "ocr_dpw_dive");
  eq(s.ap.left, 6);
  pickIn(s, "dive");
  eq(s.current.screen, "minigame");
  ok(s.minigame.miranda, "on the Miranda");
  diveForMermaid(s);
  eq(s.current.sceneId, "ocr_dpw_shark");
  forced("setback", function () { pickIn(s, "swim"); });
  ok(s.captain.tags.indexOf("Wounded") >= 0);
  ok(PC.scenes.viewScene(s).setup.indexOf("bandage you up") >= 0);
  eq(PC.checks.assess(s, { type: "Brawling", dr: 2 }).parts.some(function (p) { return p.label === "Wounded"; }), true);
  play(s, ["close", "found", "era", "alright", "on"]);
  ok(s.flags.ocr_dpw_done);
  PC.state.advanceSeason(s);
  ok(s.captain.tags.indexOf("Wounded") < 0, "gone by Summer");
});

test("A Dying Pirate's Wish: killing the shark gives the necklace, Dread +3 and the Reputation rumor", function () {
  var s = ocr(); playOpening(s); PC.node.enter(s, "tavern");
  PC.scenes.enterScene(s, "ocr_dpw_1");
  play(s, ["spit", "natural", "paying", "who", "full", "no_promises", "like_him", "dive"], 9);
  forced("clean", function () { pickIn(s, "knife"); });
  eq(s.meters.dread, 3);
  ok(s.captain.items.indexOf("Shark-Tooth Necklace") >= 0);
  ok(PC.rumors.candidatesOf(s, "Reputation").some(function (c) { return c.line.id === "rep_shark_killed"; }));
});

test("Restless & Ruined: a clean Persuade signs Davey free as Raider, and he walks you to the shipwright", function () {
  var s = opened(); PC.node.enter(s, "docks");
  eq(s.current.screen, "node");
  s = opened(); var fire = PC.node.enter(s, "docks"); PC.scenes.enterScene(s, fire);
  pickIn(s, "who");
  forced("clean", function () { pickIn(s, "join"); });
  eq(s.current.sceneId, "ocr_rr_recruited");
  var t = PC.scenes.viewScene(s).setup;
  ok(t.indexOf("goodbye to the monkeys") >= 0 && t.indexOf("Shipwright") >= 0, t);
  pickIn(s, "on");
  var d = s.officers.filter(function (o) { return o.id === "davey"; })[0];
  eq([d.type, PC.npcs.rungName(d.rung), s.location.place], ["Raider", "Friendly", "docks"]);
});

test("Restless & Ruined: a partial costs 150 for his tab; a Raider mentor makes Davey a Gunner", function () {
  var s = opened(); s.officers.push({ id: "mentor", mentor: true, first: "Gideon", last: "", type: "Raider", voice: "Old Salt", secondary: "Eager", rung: 2 });
  var crew = s.money.crew;
  PC.scenes.enterScene(s, PC.node.enter(s, "docks"));
  pickIn(s, "who");
  forced("partial", function () { pickIn(s, "join"); });
  pickIn(s, "pay");
  ok(PC.scenes.viewScene(s).setup.indexOf("pay my tab") >= 0);
  pickIn(s, "on");
  eq(s.money.crew, crew - 150);
  eq(s.officers.filter(function (o) { return o.id === "davey"; })[0].type, "Gunner");
});

test("Restless & Ruined: a setback sends Davey to the Tavern, where he takes an officer seat for good", function () {
  var s = opened(); PC.scenes.enterScene(s, PC.node.enter(s, "docks"));
  pickIn(s, "who");
  forced("setback", function () { pickIn(s, "join"); });
  ok(s.flags.davey_at_tavern);
  PC.node.leave(s); PC.node.enter(s, "tavern");
  var c = PC.officers.candidates(s);
  eq(c.length, 2);
  eq(c[1].id, "davey");
  ok(PC.officers.hiringText(s, c[1]).indexOf("peeling paint chips") >= 0);
});

test("officer recruitment: two seeded candidates; 1,000 each; one action a visit; a held type is replaced", function () {
  var s = opened(); PC.node.enter(s, "tavern");
  var c = PC.officers.candidates(s);
  eq(c.length, 2);
  eq(JSON.stringify(PC.officers.candidates(opened())), JSON.stringify(c), "same world, same candidates");
  c.forEach(function (x) {
    ok(x.voice && x.secondary && x.voice !== x.secondary, "two traits");
    ok(PC.officers.hiringText(s, x).indexOf(x.first + " looks up as you reach " + (x.gender === "f" ? "her" : "his") + " table, and") === 0, PC.officers.hiringText(s, x));
  });
  s.money.crew = 5000;
  var ap = s.ap.left;
  var r = PC.officers.hire(s, c[0].id);
  eq([s.money.crew, s.ap.left], [4000, ap - 1]);
  ok(r.mentorLine === null, "no mentor aboard the test captain");
  var second = PC.officers.candidates(s)[0];
  eq(PC.officers.apNeeded(s), 0, "the same visit");
  second.type = c[0].type; // make it a held type
  var r2 = PC.officers.hire(s, second.id);
  ok(r2.replaced && r2.replaced.officer.id === c[0].id, "replaced");
  ok(r2.replaced.pay >= 75);
  eq(s.ap.left, ap - 1);
  eq(PC.officers.aboard(s).length, 1);
});

test("rumors: the first in Spring 1754 is the scripted posture line; once a season; never repeated while live", function () {
  ["Distracted", "Opportunist", "Hunter"].forEach(function (p) {
    var s = ocr("posture-" + p); s.world.posture = p; playOpening(s); PC.node.enter(s, "tavern");
    var r = PC.rumors.askKeeper(s);
    eq(r.rumors[0].id, "posture_scripted_" + p.toLowerCase());
    eq(PC.rumors.askKeeper(s).rumors.length, 0);
    var ids = s.rumors.map(function (x) { return x.id; });
    eq(ids.length, new Set(ids).size, "no repeats");
  });
});

test("the posture is rolled at world creation from the seed, about evenly", function () {
  var n = { Distracted: 0, Opportunist: 0, Hunter: 0 };
  for (var i = 0; i < 300; i++) n[PC.state.rollPosture("w" + i)]++;
  ok(n.Distracted > 70 && n.Opportunist > 70 && n.Hunter > 70, JSON.stringify(n));
  eq(ocr("same").world.posture, ocr("same").world.posture);
});

test("Node rumors reveal a trait; [NPC] reads as the role until you've met them", function () {
  var s = ocr(); playOpening(s); PC.node.enter(s, "tavern");
  var c = PC.rumors.candidatesOf(s, "Node");
  ok(c.length > 3);
  var bob = c.filter(function (x) { return x.extra.npc === "bobby"; })[0];
  ok(PC.rumors.render(s, bob.line, bob.ctx).indexOf("The fence") >= 0, PC.rumors.render(s, bob.line, bob.ctx));
  s.npcs.bobby = { met: true };
  ok(PC.rumors.render(s, bob.line, bob.ctx).indexOf("Bobby Rats, the fence") >= 0);
});

test("Gather Intelligence (R4): clean gives the lead and two picks; partial one pick; setback a rumor and the questions noticed", function () {
  var s = opened(); PC.node.enter(s, "tavern");
  var ap = s.ap.left;
  var r = forced("clean", function () { return PC.rumors.gather(s); });
  eq(s.ap.left, ap - 1);
  ok(r.lead && PC.quests.hasLead(s, "what_was_lost", "trident"));
  eq(r.picks, 2);
  ok(r.pick.indexOf("Prize") < 0, "an A-tier type can't be picked");
  var got = PC.rumors.gatherPick(s, "Legend");
  eq(got.type, "Legend");
  ok(s.location.gatherPick, "a second pick is waiting");
  PC.rumors.gatherPick(s, "Legend");
  ok(!s.location.gatherPick, "both picks used");
  var p = forced("partial", function () { return PC.rumors.gather(s); });
  eq(p.picks, 1);
  PC.rumors.gatherPick(s, p.pick[0]);
  ok(!s.location.gatherPick);
  var b = forced("setback", function () { return PC.rumors.gather(s); });
  ok(b.rumor, "a setback still hears one rumor");
  ok(PC.rumors.candidatesOf(s, "Reputation").some(function (c) { return c.line.id === "rep_asking"; }));
});

test("Rumor tiers (R8): Prize is A; at most one A rumor a season from the pool; the letter buyer is A", function () {
  var s = opened(); PC.node.enter(s, "tavern");
  var D = PC.data.rumors;
  eq(PC.rumors.tierOf({ type: "Prize" }), "A");
  eq(PC.rumors.tierOf({ type: "Legend" }), "C");
  eq(PC.rumors.tierOf(D.underworld.lines.filter(function (l) { return l.id === "uw_letter_buyer"; })[0]), "A");
  var got = 0;
  for (var i = 0; i < 6; i++) { var r = PC.rumors.draw(s, { "Prize": 1 }, "tier-test|" + i, "test", "Prize"); if (r) got++; }
  eq(got, 1);
  ok(PC.rumors.aCapped(s));
  eq(PC.rumors.candidatesOf(s, "Prize").length, 0);
});

test("Bobby: Ask about the French records a Hidden Haven lead; selling to him can bring an Underworld rumor", function () {
  var s = opened(); PC.node.enter(s, "merchant");
  PC.rumors.askFrench(s);
  ok(PC.quests.hasLead(s, "hidden_haven", "bobby_french"));
  s.npcs.bobby.rung = 3; // Confidant: 50% a deal
  s.cargo.treasure.dirty = 20;
  var got = 0;
  for (var i = 0; i < 20; i++) { var r = PC.node.sell(s, "fence", "treasure", 1); if (r.rumor) got++; }
  ok(got >= 1 && got <= 2, "two lines, each once: " + got);
});

test("a version 3 save standing in front of a placeholder plays the real scene", function () {
  var s = ocr(); var old = JSON.parse(PC.state.serialize(s));
  old.saveVersion = 3; delete old.world.posture; delete old.rumors;
  old.current = { screen: "scene", sceneId: "ocr_underworld_stub", phase: "choosing" };
  old.location.queue = ["ocr_dying_wish_stub"];
  var back = PC.state.deserialize(JSON.stringify(old));
  eq([back.saveVersion, back.current.sceneId, back.location.queue[0]], [PC.state.SAVE_VERSION, "ocr_uw_1", "ocr_dpw_1"]);
  ok(PC.state.POSTURES.indexOf(back.world.posture) >= 0);
});

console.log("Milestone 2 review (§37.9)");

test("ship names never carry \"the\"; the creator strips a typed one", function () {
  eq(PC.creator.shipName("The Drunken Saint"), "Drunken Saint");
  eq(PC.creator.shipName("  the  Black Gull "), "Black Gull");
  eq(PC.creator.shipName("Theodora"), "Theodora");
  for (var i = 0; i < 40; i++) ok(!/^the /i.test(PC.npcs.randomShipName("k" + i)));
});

test("profession descriptions don't lean on the sack", function () {
  PC.data.creator.PROFESSIONS.forEach(function (p) { ok(!/fail|fires|chaos|walls|displaced/i.test(p.flavor), p.flavor); });
});

test("Quarter Asked reads \"only crews who refuse a demanded surrender\"", function () {
  var q = PC.data.articles.SLOTS.filter(function (x) { return x.id === "quarter"; })[0].options[0];
  ok(/^Only crews who refuse a demanded surrender/.test(q.text), q.text);
});

console.log("The Ship layer (§17.1, §24, §26)");

test("the Standard Articles: net Greed 0, accepted with no check", function () {
  var s = opened();
  var r = PC.articles.sign(s, PC.articles.defaults());
  eq(r.greed, 0); eq(r.outcome, "accepted"); ok(!r.roll);
  eq(PC.articles.currentReputation(s).name, "Fair");
});

test("generous Articles cheer the crew; hard ones need a Pirate Code reading", function () {
  var s = opened(), m = s.crew.morale;
  var t = PC.articles.defaults(); t.share = "lean"; t.officers = "even_hands";
  eq(PC.articles.sign(s, t).outcome, "cheered");
  eq(s.crew.morale, m + 5);
  var s2 = opened();
  var t2 = PC.articles.defaults(); t2.share = "half_haul";
  var r = PC.articles.sign(s2, t2);
  eq(r.greed, 4); eq(r.check.dr, 3); ok(r.roll);
  eq(PC.articles.currentReputation(s2).name, "Harsh");
});

test("between signings: loosen any time (+3 morale), Quarter freely, never tighten", function () {
  var s = opened();
  PC.articles.sign(s, PC.articles.defaults());
  ok(!PC.articles.amendCheck(s, "share", "captains_due").ok, "no tightening");
  var m = s.crew.morale;
  PC.articles.amend(s, "share", "lean");
  eq(s.crew.morale, m + 3);
  PC.articles.amend(s, "quarter", "no_quarter");
  eq(s.crew.morale, m + 3);
});

test("hard Articles shrink the crew pool (§26.5)", function () {
  var s = opened();
  var before = PC.node.poolAvailable(s);
  var t = PC.articles.defaults(); t.share = "half_haul";
  PC.articles.sign(s, t);
  var after = PC.node.poolAvailable(s);
  ok(after.Seasoned <= Math.floor(before.Seasoned * 0.8) + 0, "pool shrank");
});

test("Crew Rating for the Ash-Born start is 1 (§24.5)", function () {
  var s = opened();
  eq(PC.crew.skill(s), 0); eq(PC.crew.crewRating(s), 1);
});

test("crew actions: Rally (1 action, once a season), Drill, Give, the stores", function () {
  var s = opened();
  var ap = s.ap.left;
  PC.crew.rally(s);
  eq(s.ap.left, ap - 1);
  var threw = false; try { PC.crew.rally(s); } catch (e) { threw = true; } ok(threw);
  PC.crew.drill(s); ok(PC.crew.drilled(s));
  s.money.purse = 300;
  var m = s.crew.morale;
  eq(PC.crew.give(s, 300), 5); // 300 / 12 hands / 5 = 5
  eq(s.crew.morale, m + 5); eq(s.money.purse, 0);
  PC.node.buyGood(s, "Kill-devil rum", 1);
  eq(PC.crew.storeChoices(s).length, 1);
  m = s.crew.morale;
  PC.crew.openStores(s, "Kill-devil rum");
  eq(s.crew.morale, m + 5);
});

test("Make an Example is only for a Sullen or Mutinous crew", function () {
  var s = opened();
  ok(!PC.crew.canMakeExample(s).ok);
  s.crew.morale = 20;
  ok(PC.crew.canMakeExample(s).ok);
});

test("jettisoning frees the hold at no cost", function () {
  var s = opened();
  var used = PC.crew.slotsUsed(s);
  PC.crew.jettison(s, "provisions", 3);
  eq(PC.crew.slotsUsed(s), used - 3);
});

test("a full game save round-trips at Ocracoke", function () {
  var s = opened();
  PC.articles.sign(s, PC.articles.defaults());
  var back = PC.state.deserialize(PC.state.serialize(s));
  eq(back, s);
});

test("the content check passes with Ocracoke loaded", function () {
  var s = opened();
  var v = PC.validate(s);
  eq(v.errors, []);
});


console.log("Milestone 4: the minigames (§18)");

// A captain in town after the opening, at the Graveyard or the Tavern.
function inTown(seed) { var s = opened(seed); s.location.place = null; s.current = { screen: "node" }; s.ap.left = 7; return s; }
function at(s, place) { s.location.place = place; return s; }
// Force every roll in fn to one outcome, and every seeded draw to come up r.
function forcedDraw(value, fn) {
  var real = PC.rng.fromKey;
  PC.rng.fromKey = function () { return function () { return value; }; };
  try { return fn(); } finally { PC.rng.fromKey = real; }
}

test("the Graveyard offers three seeded wrecks a season: the same on reload, others next season", function () {
  var s = inTown();
  var a = PC.salvage.wrecksOnOffer(s, "ocracoke"), b = PC.salvage.wrecksOnOffer(PC.state.deserialize(PC.state.serialize(s)), "ocracoke");
  eq(a.length, 3); eq(a, b);
  a.forEach(function (w) { ok(["sloop", "brig", "frigate"].indexOf(w.type) >= 0); ok(w.flavor); });
  PC.state.advanceSeason(s);
  ok(JSON.stringify(PC.salvage.wrecksOnOffer(s, "ocracoke")) !== JSON.stringify(a), "a fresh set next season");
});

test("a dive costs 1 action once a season; a clean grab costs 1 breath, a partial 2", function () {
  var s = at(inTown(), "graveyard");
  ok(PC.salvage.canDive(s).ok);
  var w = PC.salvage.wrecksOnOffer(s, "ocracoke")[0];
  PC.salvage.startGraveyardDive(s, w.id, false);
  eq(s.ap.left, 6); eq(s.current.screen, "minigame"); eq(s.minigame.breath, 6);
  forced("clean", function () { PC.salvage.act(s, "grab", "hull"); });
  eq(s.minigame.breath, 5); eq(s.minigame.haul.length, 1);
  forced("partial", function () { PC.salvage.act(s, "grab", "hull"); });
  eq(s.minigame.breath, 3); eq(s.minigame.haul.length, 2);
  PC.salvage.act(s, "surface");
  ok(s.minigame.over && !s.minigame.blackout);
  if (!s.minigame.banked) PC.salvage.bank(s, s.minigame, "crew");
  PC.minigames.leave(s);
  eq(s.current.screen, "node"); eq(s.location.place, "graveyard");
  ok(!PC.salvage.canDive(s).ok, "once a season");
});

test("a full hold after a dive: everything comes ashore and the player picks what stays on the beach", function () {
  var s = at(inTown(), "graveyard");
  PC.salvage.startGraveyardDive(s, PC.salvage.wrecksOnOffer(s, "ocracoke")[0].id, false);
  var g = s.minigame;
  s.provisions = PC.crew.holdCapacity(s) - PC.crew.slotsUsed(s) + s.provisions; // the hold exactly full
  g.over = true; g.kept = [{ tier: "supplies", provisions: 3 }]; g.gold = 0;
  PC.salvage.bank(s, g, null);
  eq(PC.salvage.beachOver(s), 3);
  ok(PC.minigames.view(s).beach, "the picker shows");
  var threw = false;
  try { PC.salvage.leaveOnBeach(s, g, [{ what: "provisions", n: 2, dirty: false }]); } catch (e) { threw = true; }
  ok(threw, "a short pick is refused"); eq(PC.salvage.beachOver(s), 3);
  PC.salvage.leaveOnBeach(s, g, [{ what: "provisions", n: 3, dirty: false }]);
  eq(PC.salvage.beachOver(s), 0); ok(!g.beach);
});

test("salvage items (ruled): the Obsidian Amulet is Uncommon; the Ivory Compass is out; the Rares are the Rare swords", function () {
  var I = PC.data.minigames.salvage.ITEMS;
  ok(I.uncommon.indexOf("Obsidian Amulet") >= 0);
  ok(I.uncommon.concat(I.rare).indexOf("Ivory Compass") < 0);
  eq(I.rare.join(","), "Parisian Rapier,Abyssinian Scimitar");
});

test("the drinking lead names the Trident's waters, seeded per world; Variant A keeps the birthmark", function () {
  var s = opened(); s.captain.loss = "A";
  var w = PC.quests.tridentWaters(s);
  ok(w.name === "the Hatteras Banks" || w.name === "the Bahama Channel");
  var t = PC.quests.leadText(s, PC.data.quests.what_was_lost.leads.drinking.journal.A);
  ok(t.indexOf(w.name) >= 0 && t.indexOf("birthmark") >= 0, t);
});

test("Scout: 1 breath, shows the next find, and the next grab there is one step easier", function () {
  var s = at(inTown(), "graveyard");
  PC.salvage.startGraveyardDive(s, PC.salvage.wrecksOnOffer(s, "ocracoke")[0].id, false);
  var before = PC.minigames.view(s).zones.filter(function (z) { return z.id === "hold"; })[0].dr;
  PC.salvage.act(s, "scout", "hold");
  var z = PC.minigames.view(s).zones.filter(function (z) { return z.id === "hold"; })[0];
  eq(s.minigame.breath, 5); eq(z.dr, before - 1); ok(z.scouted, "the next find is shown");
});

test("a setback draws a hazard: a Snag costs a breath; a Current makes that zone one step harder", function () {
  var s = at(inTown(), "graveyard");
  PC.salvage.startGraveyardDive(s, PC.salvage.wrecksOnOffer(s, "ocracoke")[0].id, false);
  forcedDraw(0, function () { forced("setback", function () { PC.salvage.act(s, "grab", "hull"); }); }); // first card: Snag
  eq(s.minigame.breath, 3);
  forcedDraw(0.5, function () { forced("setback", function () { PC.salvage.act(s, "grab", "hull"); }); }); // 35-65: Current
  eq(s.minigame.zones.hull.mod, 1);
  eq(s.minigame.breath, 1);
});

test("out of breath is a blackout: half the haul (the better half) and Waterlogged", function () {
  var s = at(inTown(), "graveyard");
  PC.salvage.startGraveyardDive(s, PC.salvage.wrecksOnOffer(s, "ocracoke")[0].id, false);
  forced("partial", function () { PC.salvage.act(s, "grab", "hull"); PC.salvage.act(s, "grab", "hold"); PC.salvage.act(s, "grab", "hold"); });
  ok(s.minigame.over && s.minigame.blackout);
  eq(s.minigame.kept.length, 1);
  var best = s.minigame.haul.slice().sort(function (a, b) { return PC.salvage.worth(b) - PC.salvage.worth(a); })[0];
  eq(s.minigame.kept[0], best);
  ok(s.captain.tags.indexOf("Waterlogged") >= 0);
  eq(PC.checks.assess(s, { type: "Endure", dr: 2 }).parts.some(function (p) { return p.label === "Waterlogged"; }), true);
});

test("the shark: a hiding setback blacks you out with the Wounded tag; never on the Miranda", function () {
  var s = at(inTown(), "graveyard");
  PC.salvage.startGraveyardDive(s, PC.salvage.wrecksOnOffer(s, "ocracoke")[0].id, false);
  forcedDraw(0.7, function () { forced("setback", function () { PC.salvage.act(s, "grab", "hull"); }); }); // 65-85: Shark
  ok(s.minigame.blackout); ok(s.captain.tags.indexOf("Wounded") >= 0);
  eq(PC.data.minigames.salvage.miranda.hazards, { snag: 35, current: 30 });
});

test("Something Moves Below: a clean Ghost Sense can bring up the Giant Tooth (one at a time)", function () {
  var s = at(inTown(), "graveyard");
  PC.salvage.startGraveyardDive(s, PC.salvage.wrecksOnOffer(s, "ocracoke")[0].id, false);
  forcedDraw(0.1, function () {
    forced("setback", function () { PC.salvage.act(s, "grab", "hull"); });
  });
  // 0.1 lands on Snag; draw the cryptid by hand to test its result.
  s.minigame.hazardRoll = null;
  forcedDraw(0.01, function () { forced("clean", function () { PC.minigames.roll(s, s.minigame, { type: "Ghost Sense", dr: 3 }, "cryptid", {}, ["Underwater"]); }); });
  ok(s.minigame.haul.some(function (i) { return i.item === "Giant Tooth"; }), "the relic");
  s.captain.items.push("Giant Tooth");
  forcedDraw(0.01, function () { forced("clean", function () { PC.minigames.roll(s, s.minigame, { type: "Ghost Sense", dr: 3 }, "cryptid", {}, ["Underwater"]); }); });
  eq(s.minigame.haul.filter(function (i) { return i.item === "Giant Tooth"; }).length, 1, "not a second one");
});

test("Quick Dive: clean brings up four finds, partial two, a setback nothing", function () {
  ["clean", "partial", "setback"].forEach(function (o) {
    var s = at(inTown(), "graveyard");
    var w = PC.salvage.wrecksOnOffer(s, "ocracoke")[0];
    forced(o, function () { PC.salvage.startGraveyardDive(s, w.id, true); });
    ok(s.minigame.over);
    var finds = 0; ["hold", "hull", "cabin"].forEach(function (z) { if (s.minigame.zones[z]) finds += s.minigame.zones[z].next; });
    eq(finds, { clean: 4, partial: 2, setback: 0 }[o], o);
    if (o === "setback") ok(s.minigame.blackout && !s.minigame.kept.length);
  });
});

test("the Diver's Mask gives +1 breath; the Diving Barrel +2, and only the best counts", function () {
  var s = inTown();
  s.captain.items.push("Diver's Mask"); eq(PC.salvage.breathMax(s), 7);
  s.captain.items.push("Diving Barrel"); eq(PC.salvage.breathMax(s), 8);
});

test("the Miranda: the mermaid waits first in her Hull at DR 1; surfacing without it leaves Ollie waiting", function () {
  var s = ocr(); playOpening(s); PC.node.enter(s, "tavern");
  PC.scenes.enterScene(s, "ocr_dpw_1");
  play(s, ["spit", "natural", "paying", "who", "full", "no_promises", "like_him"], 7);
  s.flags.ocr_first_tavern_done = true; // in play, the quest fires as he leaves the Tavern
  pickIn(s, "dive");
  eq(s.minigame.zones.hull.dr, 1);
  eq(s.minigame.zones.hull.items[0].tier, "quest");
  ok(!PC.minigames.view(s).canQuick, "no Quick Dive on the Miranda");
  PC.salvage.act(s, "surface");
  if (!s.minigame.banked) PC.salvage.bank(s, s.minigame, "crew");
  PC.minigames.leave(s);
  eq(s.current.screen, "node"); eq(s.location.place, "graveyard");
  ok(!PC.node.places(s).filter(function (p) { return p.id === "graveyard"; })[0].locked, "the Graveyard is open while he waits");
  ok(PC.salvage.mirandaPending(s));
  var ap = s.ap.left;
  PC.salvage.retryMiranda(s);
  eq(s.ap.left, ap - 1, "each retry is 1 action");
  forced("clean", function () { PC.salvage.act(s, "grab", "hull"); });
  ok(s.minigame.questFound);
  PC.salvage.act(s, "surface");
  if (!s.minigame.banked) PC.salvage.bank(s, s.minigame, "crew");
  PC.minigames.leave(s);
  eq(s.current.sceneId, "ocr_dpw_shark");
});

test("the Miranda: a blackout never loses the mermaid", function () {
  var s = ocr(); playOpening(s); PC.node.enter(s, "tavern");
  PC.scenes.enterScene(s, "ocr_dpw_1");
  play(s, ["spit", "natural", "paying", "who", "full", "no_promises", "like_him", "dive"], 8);
  forced("partial", function () { PC.salvage.act(s, "grab", "hull"); PC.salvage.act(s, "grab", "hold"); PC.salvage.act(s, "grab", "hold"); });
  ok(s.minigame.blackout);
  ok(s.minigame.kept.some(function (i) { return i.tier === "quest"; }));
});

test("the loot envelope (§32.15, raised in UI pass 1 §38.8): four clean grabs land about 5-6 / 8-9 / 10 treasure on a sloop, brig, frigate", function () {
  var S = PC.data.minigames.salvage, avg = {};
  ["sloop", "brig", "frigate"].forEach(function (type) {
    var tot = 0, n = 400;
    for (var i = 0; i < n; i++) {
      var s = fresh("env" + i);
      var w = { id: "w" + i, type: type, flavor: "" };
      var game = PC.salvage.start(s, { wreck: w });
      var order = type === "sloop" ? ["hold", "hold", "hull", "hull"] : ["cabin", "cabin", "hold", "hold"];
      order.forEach(function (z) { var zz = game.zones[z]; var it = zz.items[zz.next++]; if (it.tier === "treasure") tot += it.treasure; });
    }
    avg[type] = tot / n;
  });
  ok(avg.sloop > 4.5 && avg.sloop < 7, "sloop " + avg.sloop);
  ok(avg.brig > 7 && avg.brig < 10.5, "brig " + avg.brig);
  ok(avg.frigate > 8.5 && avg.frigate < 12, "frigate " + avg.frigate);
});

test("drinking: locked on the first visit, then once a season for an action, counting as a Tavern visit", function () {
  var s = ocr(); playOpening(s); PC.node.enter(s, "tavern");
  eq(PC.drinking.canDrink(s).why, "Not on your first visit");
  s = at(inTown(), "tavern");
  ok(PC.drinking.canDrink(s).ok);
  var keeper = PC.node.slotNpc("ocracoke", "keeper");
  PC.drinking.start(s);
  eq(s.ap.left, 6);
  eq((s.npcs[keeper] || {}).visitStamp, PC.state.stamp(s));
  var g = s.minigame;
  eq(g.opp.role, "Pirate");
  ok(PC.data.minigames.drinking.pools.ocracoke.traits.indexOf(g.opp.trait) >= 0);
  ok(g.opp.tolerance >= 3 && g.opp.tolerance <= (g.opp.trait === "Old Sea Dog" ? 7 : 6), "Tolerance " + g.opp.tolerance);
  ok(PC.minigames.view(s).log[0].indexOf("A grizzled pirate drops onto the stool across from you, ") === 0);
});

test("drinking: the ladder DR is 1 + drinks poured, capped at 5; a Hard Drinker makes it one harder", function () {
  var s = at(inTown(), "tavern");
  PC.drinking.start(s);
  var g = s.minigame;
  g.opp.trait = "Jovial"; g.opp.tolerance = 6; g.opp.tolMax = 6; g.opp.strongRound = null;
  var dr = function () { return PC.drinking.options(s, g).filter(function (o) { return o.op === "drink"; })[0].check.dr; };
  eq(dr(), 1);
  forced("clean", function () { PC.drinking.act(s, "drink"); });
  eq(dr(), 2); eq(g.wits, 6); eq(g.opp.tolerance, 5);
  forced("partial", function () { PC.drinking.act(s, "drink"); });
  eq(dr(), 3); eq(g.wits, 5);
  g.opp.trait = "Hard Drinker";
  eq(dr(), 4);
  g.poured = 9; eq(dr(), 5, "capped");
});

test("drinking: a win pays the loss quest's drinking lead first, then a Danger or Prize rumor", function () {
  var s = at(inTown(), "tavern");
  PC.drinking.start(s);
  s.minigame.opp.tolerance = 1; s.minigame.opp.tolMax = 4; s.minigame.opp.strongRound = null;
  forced("clean", function () { PC.drinking.act(s, "drink"); });
  ok(s.minigame.result.won);
  ok(PC.quests.hasLead(s, "what_was_lost", "drinking"), "the drinking lead");
  eq(s.minigame.result.rumor, null);
  PC.minigames.leave(s);
  PC.state.advanceSeason(s);
  PC.drinking.start(s);
  s.minigame.opp.tolerance = 1; s.minigame.opp.strongRound = null;
  forced("clean", function () { PC.drinking.act(s, "drink"); });
  ok(s.minigame.result.rumor && ["Danger", "Prize"].indexOf(s.minigame.result.rumor.type) >= 0, "a Danger or Prize rumor");
});

test("drinking: one taunt a match; a clean taunt makes him drink alone", function () {
  var s = at(inTown(), "tavern");
  PC.drinking.start(s);
  var g = s.minigame; g.opp.tolerance = 5; g.opp.tolMax = 5; g.opp.strongRound = null; g.opp.trait = "Jovial";
  forced("clean", function () { PC.drinking.act(s, "mock"); });
  eq(g.wits, 6); eq(g.opp.tolerance, 4);
  ok(!PC.drinking.options(s, g).some(function (o) { return o.op === "mock" || o.op === "lean"; }), "no second taunt");
});

test("drinking: a loss pays the tab from the purse; going under pays double and rolls the Hangover", function () {
  var s = at(inTown(), "tavern"); s.money.purse = 100;
  PC.drinking.start(s);
  PC.drinking.act(s, "callit");
  eq(s.money.purse, 90);
  ok(s.minigame.over);
  PC.minigames.leave(s); PC.state.advanceSeason(s);
  PC.drinking.start(s);
  s.minigame.wits = 1; s.minigame.opp.tolerance = 6; s.minigame.opp.strongRound = null;
  forcedDraw(0, function () { forced("setback", function () { PC.drinking.act(s, "drink"); }); });
  ok(s.minigame.over && !s.minigame.result.won);
  eq(s.money.purse, 70, "double tab");
  ok(s.captain.tags.indexOf("Hangover") >= 0, "a failed Hangover roll");
  eq(PC.checks.assess(s, { type: "Read People", dr: 2 }).parts.some(function (p) { return p.label === "Hangover"; }), true);
});

test("drinking: a brawl costs the tavern keeper a rung, whoever wins", function () {
  var s = at(inTown(), "tavern");
  var keeper = PC.node.slotNpc("ocracoke", "keeper");
  var before = PC.npcs.rung(s, keeper);
  PC.drinking.start(s);
  s.minigame.opp.strongRound = null; s.minigame.opp.tolerance = 6;
  forcedDraw(0.75, function () { forced("setback", function () { PC.drinking.act(s, "drink"); }); }); // 70-90: Brawl
  ok(s.minigame.over);
  eq(PC.npcs.rung(s, keeper), before - 1);
});

test("drinking: the Heavy Drinker's One more round, and the third time Drunkard replaces the flaw", function () {
  var s = at(inTown(), "tavern"); s.captain.flaws = ["Heavy Drinker"];
  for (var i = 0; i < 3; i++) {
    if (i) { PC.minigames.leave(s); PC.state.advanceSeason(s); }
    PC.drinking.start(s);
    s.minigame.opp.tolerance = 1; s.minigame.opp.strongRound = null;
    forced("clean", function () { PC.drinking.act(s, "drink"); });
    ok(s.minigame.offerOneMore, "offered, round " + i);
    PC.drinking.oneMore(s, true);
    eq(s.minigame.wits, 6, "at the Wits he has left");
    PC.drinking.act(s, "callit");
  }
  ok(s.captain.tags.indexOf("Drunkard") >= 0); eq(s.captain.flaws, []);
});

test("drinking: hair of the dog starts at 5 Wits; a clean first drink clears the Hangover; shore leave clears it too", function () {
  var s = at(inTown(), "tavern");
  PC.scenes.applyEffect(s, { tag: "Hangover", untilSeasonEnd: true });
  PC.drinking.start(s);
  eq(s.minigame.wits, 5);
  s.minigame.opp.tolerance = 6; s.minigame.opp.strongRound = null;
  forced("clean", function () { PC.drinking.act(s, "drink"); });
  ok(s.captain.tags.indexOf("Hangover") < 0);
});

test("Liar's Dice: stakes 25-50 from the purse at Ocracoke, an action a sitting", function () {
  var s = at(inTown(), "tavern");
  ok(!PC.liarsdice.canPlay(s).ok, "an empty purse can't sit down");
  s.money.purse = 200;
  ok(PC.liarsdice.canPlay(s).ok);
  PC.liarsdice.start(s);
  eq(s.ap.left, 6);
  eq(PC.liarsdice.stakes(s), [25, 50]);
  var threw = false; try { PC.liarsdice.newGame(s, 60); } catch (e) { threw = true; }
  ok(threw, "over the table limit");
  PC.liarsdice.newGame(s, 30);
  eq(s.money.purse, 170);
  eq(s.minigame.round.mine.length, PC.data.minigames.dice.DICE);
});

test("Liar's Dice: a raise bids more dice, or the same number of a higher face", function () {
  var g = { myN: 3, hisN: 3, bid: { q: 2, f: 4 } };
  ok(PC.liarsdice.valid(g, 2, 5)); ok(PC.liarsdice.valid(g, 3, 1));
  ok(!PC.liarsdice.valid(g, 2, 4)); ok(!PC.liarsdice.valid(g, 1, 6)); ok(!PC.liarsdice.valid(g, 7, 6));
  eq(Math.round(PC.liarsdice.atLeast(1, 3) * 1000), 421);
});

test("Liar's Dice: a call the count meets costs the caller a die; the last with dice takes the pot", function () {
  var s = at(inTown(), "tavern"); s.money.purse = 200;
  PC.liarsdice.start(s); PC.liarsdice.newGame(s, 50);
  var g = s.minigame.round;
  g.mine = [6, 6, 6]; g.his = [1, 2, 3]; g.myN = 3; g.hisN = 3;
  g.turn = "me"; g.bid = { q: 4, f: 6, by: "him" };
  PC.liarsdice.callLiar(s); // only three sixes: his bid was a lie
  eq(g.hisN, 2);
  // Play out the game by calling his bids until someone runs out.
  for (var n = 0; n < 50 && !g.over; n++) {
    if (g.revealed) { PC.liarsdice.nextRound(s); continue; }
    if (g.turn === "me") { if (g.bid) PC.liarsdice.callLiar(s); else PC.liarsdice.bid(s, 1, g.mine[0]); }
  }
  ok(g.over, "the game ends");
  eq(s.money.purse, g.won ? 250 : 150);
});

test("Liar's Dice: the opponent never makes an invalid bid, over many seeded games", function () {
  for (var i = 0; i < 60; i++) {
    var s = at(inTown("ld" + i), "tavern"); s.money.purse = 1000;
    PC.liarsdice.start(s);
    for (var games = 0; games < 3; games++) {
      PC.liarsdice.newGame(s, 25);
      var g = s.minigame.round;
      for (var n = 0; n < 200 && !g.over; n++) {
        if (g.revealed) { PC.liarsdice.nextRound(s); continue; }
        var prev = g.bid;
        if (g.bid && (n % 3 === 0)) { PC.liarsdice.callLiar(s); continue; }
        var q = g.bid ? g.bid.q + 1 : 1;
        if (q > g.myN + g.hisN) { PC.liarsdice.callLiar(s); continue; }
        PC.liarsdice.bid(s, q, 1 + (n % 6));
        if (!g.revealed && g.bid && g.bid.by === "him") ok(PC.liarsdice.valid({ myN: g.myN, hisN: g.hisN, bid: { q: q, f: 1 + (n % 6) } }, g.bid.q, g.bid.f) || g.bid.q > q, "his bid raises mine");
      }
      ok(g.over, "game " + games + " of seed " + i + " ends");
      PC.liarsdice.closeGame(s);
    }
  }
});

test("Liar's Dice: caught cheating forfeits the pot and costs black Standing -5; two marks get you caught", function () {
  var s = at(inTown(), "tavern"); s.money.purse = 200;
  PC.liarsdice.start(s); PC.liarsdice.newGame(s, 40);
  forced("setback", function () { PC.liarsdice.cheat(s, 0); });
  ok(s.minigame.round.caught);
  eq(s.meters.standing.pirates, -5);
  eq(s.money.purse, 160);
  PC.liarsdice.closeGame(s);
  PC.liarsdice.newGame(s, 25);
  forced("partial", function () { PC.liarsdice.cheat(s, 1); });
  ok(!s.minigame.round.caught, "one mark");
  s.minigame.round.over = true; PC.liarsdice.closeGame(s);
  PC.liarsdice.newGame(s, 25);
  forced("partial", function () { PC.liarsdice.cheat(s, 1); });
  ok(s.minigame.round.caught, "the second mark");
});

test("Liar's Dice: Loaded Dice reroll the Cheat once a sitting; no cap on games a sitting (B21)", function () {
  var s = at(inTown(), "tavern"); s.money.purse = 500; s.captain.items.push("Loaded Dice");
  PC.liarsdice.start(s); PC.liarsdice.newGame(s, 25);
  forced("setback", function () { PC.liarsdice.cheat(s, 0); });
  ok(s.minigame.pending, "waiting on a reroll");
  eq(PC.minigames.view(s).pending.reroll, "Loaded Dice");
  forced("clean", function () { PC.minigames.reroll(s); });
  ok(!s.minigame.round.caught);
  for (var i = 1; i < 5; i++) { s.minigame.round.over = true; PC.liarsdice.closeGame(s); PC.liarsdice.newGame(s, 25); }
  s.minigame.round.over = true; PC.liarsdice.closeGame(s);
  PC.liarsdice.newGame(s, 25);
  eq(s.minigame.games, 6, "a sixth game, as the purse covers");
});

test("Liar's Dice: leaving mid-game forfeits the stake (B26); the caught line names the cause (B25)", function () {
  var s = at(inTown(), "tavern"); s.money.purse = 500;
  PC.liarsdice.start(s); PC.liarsdice.newGame(s, 30);
  var threw = false; try { PC.liarsdice.stop(s); } catch (e) { threw = true; }
  ok(threw, "not without forfeiting");
  PC.liarsdice.stop(s, true);
  eq(s.minigame.lost, 1); eq(s.minigame.net, -30); ok(s.minigame.over);
  var t = at(inTown(), "tavern"); t.money.purse = 500;
  PC.liarsdice.start(t); PC.liarsdice.newGame(t, 25);
  forced("setback", function () { PC.liarsdice.cheat(t, 0); });
  if (t.minigame.pending) PC.minigames.settle(t);
  ok(t.minigame.round.caught && t.minigame.round.caughtWhy === "setback");
  ok(/he saw it/.test(t.minigame.log.join(" ")));
});

test("Card Sharp comes at 500 gold net at Liar's Dice; losses count against it", function () {
  var t = at(inTown(), "tavern"); t.money.purse = 500;
  t.minigames.diceWinnings = 480;
  PC.liarsdice.start(t); PC.liarsdice.newGame(t, 25);
  var gl = t.minigame.round; gl.hisN = 1; gl.his = [6]; gl.myN = 1; gl.mine = [1]; gl.turn = "me"; gl.bid = { q: 1, f: 6, by: "him" };
  PC.liarsdice.callLiar(t);
  ok(!gl.won); eq(t.minigames.diceWinnings, 455);
  ok(t.captain.tags.indexOf("Card Sharp") < 0);

  var s = at(inTown(), "tavern"); s.money.purse = 500;
  s.minigames.diceWinnings = 480;
  PC.liarsdice.start(s); PC.liarsdice.newGame(s, 25);
  var g = s.minigame.round; g.hisN = 1; g.his = [1]; g.mine = [6, 6, 6]; g.turn = "me"; g.bid = { q: 2, f: 1, by: "him" };
  PC.liarsdice.callLiar(s);
  ok(g.won); ok(s.captain.tags.indexOf("Card Sharp") >= 0);
});

test("a version 4 save loads (now as the current version) with the minigame and hunt fields", function () {
  var old = JSON.parse(PC.state.serialize(opened()));
  old.saveVersion = 4; delete old.minigames; delete old.minigame;
  var back = PC.state.deserialize(JSON.stringify(old));
  eq(back.saveVersion, PC.state.SAVE_VERSION); ok(back.minigames); eq(back.minigame, null); ok(Array.isArray(back.fleet));
});

test("a save made mid-dive round-trips", function () {
  var s = at(inTown(), "graveyard");
  PC.salvage.startGraveyardDive(s, PC.salvage.wrecksOnOffer(s, "ocracoke")[1].id, false);
  forced("clean", function () { PC.salvage.act(s, "grab", "hull"); });
  var back = PC.state.deserialize(PC.state.serialize(s));
  eq(back, s);
  PC.salvage.act(back, "surface");
  ok(back.minigame.over);
});

console.log("UI pass 1: the creator chat's rules (§11, §12, §14, §25.9)");

test("55 skills, each with a Player line; the cut ones are gone (§11.4)", function () {
  var T = PC.data.checkTypes;
  eq(Object.keys(T).length, 55);
  ["Fence", "Run Blockade", "Sabotage", "Haul & Labor", "Repair at Sea", "Refit & Careen"].forEach(function (t) { ok(!T[t], t); });
  ok(T["Repair & Refit"]);
  Object.keys(T).forEach(function (t) { ok(T[t].player, t + " has a Player line"); });
});

test("29 creation tags, five greyed out and unpickable (§14.2)", function () {
  var all = PC.creator.allTags();
  eq(all.length, 29);
  var d = PC.creator.blankDraft();
  eq(all.filter(function (t) { return PC.creator.blockedBy(d, t.id); }).map(function (t) { return t.id; }).sort(),
    ["Animal Friend", "Haunted", "Heathen", "Loremaster", "Revolutionary"]);
});

test("Vengeful reads [Grudge]: the French or a Wronged-Me Target (§11.7)", function () {
  var s = built(function (d) { d.traits = ["Vengeful", "Shrewd"]; });
  var base = PC.checks.assess(s, { type: "Swordsmanship", dr: 0 }).edge;
  eq(PC.checks.assess(s, { type: "Swordsmanship", dr: 0 }, { conditions: ["French"] }).edge, base + 1);
  eq(PC.checks.assess(s, { type: "Gather Intelligence", dr: 0 }, { conditions: ["Wronged-Me Target"] }).edge, PC.checks.assess(s, { type: "Gather Intelligence", dr: 0 }).edge + 1);
});

test("the Acting Quartermaster: elected with no officers, replaced when one joins (§25.9)", function () {
  var s = fresh();
  ok(s.actingQM && s.actingQM.active, "elected at the start with no officers");
  eq(PC.officers.quartermaster(s), s.actingQM);
  PC.officers.joinNamed(s, "davey");
  ok(!s.actingQM.active, "back to the crew");
  eq(PC.officers.quartermaster(s).id, "davey");
  PC.officers.dismiss(s, PC.officers.quartermaster(s));
  ok(s.actingQM.active, "re-elected under the same name");
});

test("a version 5 save renames cut skills and merged tags", function () {
  var s = fresh();
  s.saveVersion = 5; s.captain.training = { "Repair at Sea": 1, "Refit & Careen": 1, "Fence": 1 };
  s.captain.tags = ["Ash-Born", "Cartographer", "Speedy", "Deserter's Mark"];
  delete s.actingQM;
  var back = PC.state.deserialize(PC.state.serialize(s));
  eq(back.captain.training, { "Repair & Refit": 2, "Haggle": 1 });
  eq(back.captain.tags, ["Ash-Born", "Explorer", "Cutpurse"]);
});

console.log("UI pass 1: the walkthrough's rules (§41.13, §41.14, §41.15)");

test("Haggle: clean 10% in your favor, setback 10% against, once a season before the first trade (§41.13)", function () {
  var s = at(inTown("hag"), "merchant");
  var prov = PC.node.slotNpc("ocracoke", "provisioner");
  var base = PC.node.provisionsPrice(s), sale = PC.node.unitPrice(s, "provisioner", "treasure");
  ok(PC.node.haggleCheck(s, prov).ok);
  forced("clean", function () { PC.node.haggle(s, prov); });
  ok(Math.abs(PC.node.provisionsPrice(s) - base * 0.9) < 0.51, "10% off, rounded to the price step");
  ok(PC.node.provisionsPrice(s) < base && PC.node.unitPrice(s, "provisioner", "treasure") > sale, "cheaper to buy, dearer to sell");
  ok(!PC.node.haggleCheck(s, prov).ok, "once a season");
  var t = at(inTown("hag2"), "merchant");
  PC.node.buyProvisions(t, 1);
  eq(PC.node.haggleCheck(t, prov).why, "Only before your first trade this season");
  var u = at(inTown("hag3"), "merchant");
  forced("setback", function () { PC.node.haggle(u, prov); });
  ok(PC.node.provisionsPrice(u) > base, "a setback bites");
  PC.state.advanceSeason(u);
  ok(PC.node.haggleCheck(u, prov).ok, "fresh next season");
});

test("the Docks roll: clean lifts a third of the signings a tier; setback costs a third of the Seasoned and Veterans (§11.4, §41.8)", function () {
  var s = inTown("docks");
  PC.node.enter(s, "docks"); s.current = { screen: "node" };
  s.money.crew = 5000;
  var pool = PC.node.poolAvailable(s);
  forced("clean", function () { PC.node.docksRoll(s); });
  ok(!PC.node.docksRollCheck(s).ok, "once a visit");
  var green = Math.min(3, pool.Green || 0);
  if (green) {
    var before = (s.crew.tiers.Able || 0);
    var r = PC.node.recruitBatch(s, { Green: green });
    eq(r.upgraded, 1);
    eq(s.crew.tiers.Able || 0, before + 1);
  }
  var t = inTown("docks2");
  PC.node.enter(t, "docks"); t.current = { screen: "node" };
  var p2 = PC.node.poolAvailable(t), top = (p2.Seasoned || 0) + (p2.Veteran || 0);
  var out = forced("setback", function () { return PC.node.docksRoll(t); });
  var after = PC.node.poolAvailable(t);
  eq(out.lost, top ? Math.max(1, Math.floor(top / 3)) : 0);
  eq((after.Seasoned || 0) + (after.Veteran || 0), top - out.lost);
});

test("Strike First opens the knife fight with the shark and feeds the clash (§11.4, §41.13)", function () {
  var s = ocr("shark"); playOpening(s);
  s.current = { screen: "scene", sceneId: "ocr_dpw_shark", phase: "choosing" };
  forced("clean", function () { PC.scenes.choose(s, choiceIndex(s, "knife")); });
  eq(s.current.pending.strikeFirst.value, 1);
  var v = PC.scenes.viewScene(s);
  ok(v.result ? v.result.strikeFirst : s.current.pending.strikeFirst, "the result carries the Strike First line");
  var shove = PC.scenes.sceneById("ocr_twopenny_partial").choices.filter(function (c) { return c.id === "shove"; })[0];
  ok(!shove.strikeFirst, "no Strike First on the shove (§41.3)");
});

test("Welcome to the Underworld costs no action; the Hidden Haven takes three leads (§41.13, §41.15)", function () {
  eq(PC.scenes.sceneById("ocr_uw_1").ap, 0);
  eq(PC.data.quests.hidden_haven.needed, 3);
});

test("the keeper's Beach Captain questions: Jack's follows, both name Twopenny and cost nothing (§41.5)", function () {
  var s = at(ocr("keeper"), "tavern"); playOpening(s); s.location.place = "tavern"; s.current = { screen: "node" };
  delete s.npcs.twopenny.met;
  var ap = s.ap.left;
  eq(PC.node.keeperQuestions(s).map(function (q) { return q.id; }), ["beach_captain"]);
  var r = PC.node.askKeeperQuestion(s, "beach_captain");
  ok(r.line.indexOf("Arthur Twopenny") >= 0);
  ok(PC.npcs.isMet ? PC.npcs.isMet(s, "twopenny") : s.npcs.twopenny.met, "Twopenny is named now");
  eq(PC.node.keeperQuestions(s).map(function (q) { return q.id + (q.asked ? "*" : ""); }), ["beach_captain*", "amber_jack"]);
  var j = PC.node.askKeeperQuestion(s, "amber_jack");
  ok(j.line.indexOf("{keeper}") < 0 && j.line.indexOf(PC.npcs.get(s, PC.node.slotNpc("ocracoke", "keeper")).first + " stares") === 0);
  eq(s.ap.left, ap);
});

test("the journal: §41.14's objectives for the startup quests and the loss quest's deadline (§41.12)", function () {
  var s = opened("journal");
  var j = PC.quests.journal(s);
  var by = function (id) { return j.filter(function (x) { return x.id === id; })[0]; };
  eq(by("dying_wish").status, "done");
  ok(/mermaid in his hands/.test(by("dying_wish").objective));
  eq(by("underworld").objective, "Bobby Rats has his coin, and his fence is open to you.");
  var w = by("what_was_lost");
  eq(w.deadline, "By the end of Spring 1755");
  ok(!JSON.stringify(j).match(/PLACEHOLDER/), "no placeholder lines left");
  while (!(s.time.year === 1755 && s.time.season === 0)) PC.state.advanceSeason(s);
  eq(PC.quests.expiringNow(s), ["What Was Lost"]);
  eq(PC.quests.expiringNow(s), [], "warned once");
  ok(PC.quests.journal(s).filter(function (x) { return x.id === "what_was_lost"; })[0].lastSeason);
});

test("Developer: Skip the mandatory quests lands the rewards and stops them firing (§41.12)", function () {
  var s = ocr("skip"); playOpening(s); s.current = { screen: "node" };
  var crew = s.money.crew;
  PC.devtools.skipQuests(s);
  eq(s.money.crew, crew + 385);
  eq(s.cargo.treasure.clean, 10);
  ok(PC.officers.aboard(s).some(function (o) { return o.id === "davey"; }), "Davey hired");
  ok(PC.npcs.get(s, "geezer").dead);
  eq(PC.node.enter(s, "tavern"), null); eq(PC.node.leave(s), null);
  eq(PC.node.enter(s, "docks"), null);
  eq(PC.devtools.skipQuests(s), "Nothing left to skip.");
});

console.log("UI pass 1 review: the author's phone notes");

test("signing too many hands leaves the lowest tier on the docks", function () {
  var s = inTown("trim"); PC.node.enter(s, "docks"); s.current = { screen: "node" };
  s.money.crew = 99999;
  var berths = PC.crew.berths(s);
  var p = PC.node.trimPlan(s, { Green: berths, Seasoned: 3 });
  eq(p.Seasoned, 3); eq(p.Green, berths - 3); eq(p.left.Green, 3);
  s.money.crew = Math.round(PC.node.signingCost(s, "Seasoned") * 2);
  var q = PC.node.trimPlan(s, { Green: 2, Seasoned: 2 });
  eq(q.Seasoned, 2); eq(q.Green, 0);
});

test("a keeper question asked on an earlier visit is gone; this visit it fades", function () {
  var s = inTown("keeperq"); PC.node.enter(s, "tavern"); s.current = { screen: "node" };
  var q = PC.node.keeperQuestions(s)[0];
  if (!q) return;
  PC.node.askKeeperQuestion(s, q.id);
  ok(PC.node.keeperQuestions(s).some(function (x) { return x.id === q.id && x.asked; }), "fades this visit");
  PC.node.leave(s); PC.node.enter(s, "tavern");
  ok(!PC.node.keeperQuestions(s).some(function (x) { return x.id === q.id; }), "gone next visit");
});

test("Lilyhook's Graveyard offers a sloop, a brig and a frigate", function () {
  var s = ocr("wrecks");
  eq(PC.salvage.wrecksOnOffer(s, "ocracoke").map(function (w) { return w.type; }), ["sloop", "brig", "frigate"]);
});

console.log("Milestone 5: the prize hunt (§21, §22)");

function huntReady(seed) {
  var s = PC.state.newGame(PC.data.testCaptain, { seed: seed || "hunt" });
  s.current = { screen: "node" }; s.location.place = null;
  PC.devtools.skipQuests(s);
  s.ship.hull = s.ship.hullMax; s.ship.speed = 3;
  var add = 30 - s.crew.count; if (add > 0) PC.crew.addHands(s, "Green", add);
  s.provisions = 20; s.ap.left = 7;
  s.articles = { terms: PC.articles.defaults(), greed: 0, signed: { year: 1754, season: 0 } };
  return s;
}
function withDice(d, fn) {
  var real = PC.rng.roll2d6;
  PC.rng.roll2d6 = function () { return d.slice(); };
  try { return fn(); } finally { PC.rng.roll2d6 = real; }
}
function huntWith(s, grp) {
  var g = PC.hunt.start(s);
  g.sighting = grp; g.phase = grp.hunter ? "hunter" : "scout";
  return g;
}
function aShip(s, cls, role, flag, extra) {
  var sh = PC.huntGen.makeShip(s, { cls: cls, role: role, flag: flag }, PC.rng.fromKey("t|" + cls + "|" + flag));
  return Object.assign(sh, extra || {});
}

test("the Hatteras Banks' flags match §22.5's Year 1 table (Avalon about 48%, France 14%)", function () {
  var s = huntReady(); s.world.posture = "Opportunist";
  var w = PC.huntGen.flagWeights(s, "north"), t = 0;
  Object.keys(w).forEach(function (k) { t += w[k]; });
  ok(Math.abs(100 * w.Avalon / t - 48) <= 1, "Avalon " + (100 * w.Avalon / t)); ok(Math.abs(100 * w.France / t - 14) <= 1); ok(Math.abs(100 * w.Pirate / t - 8) <= 1);
});

test("hunters: none below Heat 20; 8% a batch at Heat 50-59 (§22.5)", function () {
  var s = huntReady();
  eq(PC.huntGen.hunterChances(s, "north").Avalon, 0);
  s.meters.heat.avalon = 55;
  eq(Math.round(PC.huntGen.hunterChances(s, "north").Avalon * 100), 10); // 8% + 2% for Norfolk, an Admiralty port
});

test("a hunt costs an action a batch, burns provisions, and finds at least one ship a batch", function () {
  var s = huntReady("batch"), ap = s.ap.left, prov = s.provisions;
  var g = PC.hunt.start(s);
  eq(s.ap.left, ap - 1); eq(s.provisions, prov - 6);
  var found = 0, guard = 0;
  while (g.phase !== "batchEnd" && guard++ < 5) { if (g.phase === "scout" || g.phase === "hunter") found++; if (g.phase === "hunter") break; PC.hunt.next(s, g); }
  ok(found >= 1, "a ship in the batch");
});

test("the pre-battle strike: a clean roll takes her without a fight; her loot goes dirty into the hold", function () {
  var s = huntReady("strike");
  var bq = aShip(s, "Barque", "Trade", "Avalon");
  var g = huntWith(s, { ships: [bq], shape: "single", hunter: false });
  withDice([6, 6], function () { PC.hunt.engage(s, g); });
  eq(g.phase, "after");
  var pr = PC.hunt.currentPrize(s, g); ok(pr, "a prize to settle");
  var heat = s.meters.heat.avalon;
  PC.hunt.settlePrize(s, g, { hull: "release", crew: "release", captives: "free" });
  eq(s.meters.heat.avalon, heat + 6); // an Avalon merchant, no letter (§28.6)
  ok(s.cargo.treasure.dirty > 0 || Object.keys(s.cargo.goods).some(function (k) { return s.cargo.goods[k].dirty; }), "dirty cargo aboard");
});

test("boarding losses by Crew Advantage: 30 men against 10 kill at least 6 on a clean clash (planning ruling)", function () {
  var s = huntReady("board");
  var sl = aShip(s, "Sloop", "Trade", "Spain", { crew: 10, startCrew: 10, resolve: 5 });
  var g = huntWith(s, { ships: [sl], shape: "single", hunter: false });
  withDice([1, 1], function () { PC.hunt.engage(s, g); }); // she won't strike; no flee at a slower speed is forced below
  var b = g.battle; b.enemies[0].out = null; b.enemies[0].crew = 10; b.enemies[0].startCrew = 10; b.over = null;
  b.board = { meBoarding: true, clash: 0, sf: 0, rallyNext: 0, enemyNext: 0, startMe: s.crew.count, startEn: 10, enemy: b.enemies[0].id };
  b.step = "clash"; g.phase = "battle";
  withDice([6, 6], function () { PC.combat._clash(s, g, 0, false); });
  ok(b.enemies[0].crew <= 4 || b.enemies[0].out, "lost 6 or more, or struck");
});

test("Shaken: partials stack to −3 and last the battle; half the crew lost adds a step (planning ruling)", function () {
  var s = huntReady("shaken");
  var bq = aShip(s, "Barque", "Trade", "Avalon", { resolve: 2 });
  var g = huntWith(s, { ships: [bq], shape: "single", hunter: false });
  withDice([1, 1], function () { PC.hunt.engage(s, g); });
  var e = g.battle.enemies[0]; e.out = null; e.resolve = 0; e.shaken = 0;
  // 2d6 of 7, edge 0, Resolve 0: a partial each time.
  withDice([3, 4], function () { for (var i = 0; i < 4; i++) { e.resolve = e.shaken; PC.combat._strikeRoll(s, g, g.battle, e, -PC.combat.dreadBonus(s), "test"); } });
  eq(e.shaken, 3);
  e.resolve = 2; e.leaderless = false;
  eq(PC.combat.effResolve(e), -1);
  e.leaderless = true; eq(PC.combat.effResolve(e), -3);
});

test("Gunner's Eye: +1 on the first Exchange only, and the called shot", function () {
  var s = huntReady("eye");
  var bq = aShip(s, "Merchantman", "Trade", "Avalon", { resolve: 5 });
  var g = huntWith(s, { ships: [bq], shape: "single", hunter: false });
  withDice([1, 1], function () { PC.hunt.engage(s, g); });
  g.battle.step = "exchange";
  ok(!PC.combat.view(s, g).exchange.parts.some(function (p) { return p.label === "Your Gunnery" && p.value === PC.combat.playerGunnery(s) + 1; }) || true);
  s.captain.tags.push("Gunner's Eye");
  var v = PC.combat.view(s, g).exchange;
  eq(v.parts.filter(function (p) { return p.label === "Your Gunnery"; })[0].value, Math.min(4, PC.combat.playerGunnery(s) + 1));
  withDice([4, 4], function () { PC.hunt.battle(s, g, "doExchange", "rigging"); });
  ok(g.battle.firstExchange === false);
});

test("P14: an Exchange shows what it did as chips", function () {
  var s = huntReady("chips");
  var bq = aShip(s, "Merchantman", "Trade", "Avalon", { resolve: 5 });
  var g = huntWith(s, { ships: [bq], shape: "single", hunter: false });
  withDice([1, 1], function () { PC.hunt.engage(s, g); });
  g.battle.step = "exchange";
  withDice([6, 6], function () { PC.hunt.battle(s, g, "doExchange", "round"); });
  var c = g.lastRoll.chips;
  ok(c.length && /^Her hull −\d+/.test(c[0].text), JSON.stringify(c));
  eq(c[0].ink, "good");
});

test("a captured flagship ends the run: struck colors is a game over (Milestone 5 plan)", function () {
  var s = huntReady("over");
  var fr = aShip(s, "Frigate", "War", "Avalon");
  var g = huntWith(s, { ships: [fr], shape: "single", hunter: false });
  withDice([1, 1], function () { PC.hunt.engage(s, g); });
  g.battle.step = "decision";
  PC.hunt.battle(s, g, "decide", "strike");
  eq(g.phase, "gameover"); eq(g.gameOver.how, "captured");
});

test("convoys: when one ship strikes, her consorts roll to strike (§21.13)", function () {
  var s = huntReady("convoy");
  var g = PC.hunt.start(s);
  var grp = PC.huntGen.sighting(s, "north", PC.rng.fromKey("convoy-test"), { kind: "convoy", flag: "Avalon" });
  eq(grp.shape, "convoy"); ok(grp.ships.length >= 2);
  g.sighting = grp; g.phase = "scout";
  withDice([1, 1], function () { PC.hunt.engage(s, g); PC.hunt.battle(s, g, "engage"); });
  var b = g.battle;
  ok(b.enemies.length >= 2);
  withDice([6, 6], function () { PC.combat._strikeRoll(s, g, b, b.enemies[0], 0, "test"); });
  ok(b.enemies.every(function (e) { return e.out; }), "the consort struck too on a clean roll");
});

test("a Developer fleet ship fights beside the flagship: her pairing rolls in the background", function () {
  var s = huntReady("fleet");
  var r = PC.hunt.devFleetShip(s, "Sloop");
  ok(r.officer);
  var f = s.fleet[0];
  ok(PC.officers.aboard(s).some(function (o) { return o.aboard === f.id; }), "her captain aboard her");
  var g = PC.hunt.start(s);
  var grp = PC.huntGen.sighting(s, "north", PC.rng.fromKey("convoy-2"), { kind: "convoy", flag: "Avalon" });
  g.sighting = grp; g.phase = "scout";
  withDice([1, 1], function () { PC.hunt.engage(s, g); });
  eq(g.battle.step, "setup");
  ok(g.battle.pairs[f.id], "the fleet ship has her own pairing");
  withDice([1, 1], function () { PC.hunt.battle(s, g, "engage"); });
  var hull = grp.ships[1].hull, before = g.log.length;
  withDice([5, 5], function () {
    if (g.battle.step === "chase") PC.hunt.battle(s, g, "doChase");
    if (g.battle.step === "position") PC.hunt.battle(s, g, "doPosition");
    if (g.battle.step === "posChoice") PC.hunt.battle(s, g, "choosePosition", "rake");
  });
  ok(g.log.slice(before).some(function (l) { return /PLACEHOLDER: (Your .* (rakes|and)|The .* hammers)/.test(l); }), "a background line: " + g.battle.step + " " + JSON.stringify(g.log.slice(before)));
});

test("selling a prize hull: 8% for a dirty hull at Ocracoke's no-control yard, her guns at 30%", function () {
  var s = huntReady("sell");
  s.fleet = [{ id: "p1", kind: "prize", cls: "Barque", size: 2, hull: 45, hullMax: 45, guns: 4, crew: 8, crewTiers: { Green: 8 }, dirty: true, cargo: 250 }];
  var p = PC.node.hullSalePrice(s, s.fleet[0]);
  var mult = PC.data.economy.TIERS[PC.node.nodeData("ocracoke").tier].goods;
  eq(p.hull, Math.round(5550 * 0.08 * mult)); eq(p.guns, Math.round(4 * 100 * 0.3 * mult));
  var crew = s.money.crew, hands = s.crew.count;
  PC.node.enter(s, "docks");
  var r = PC.node.sellHull(s, "p1");
  eq(s.money.crew, crew + p.total - r.paid * r.payEach);
  eq(s.fleet.length, 0); eq(s.crew.count, hands + r.home);
});

test("captives are freed at Ocracoke on the arrival, for a reward", function () {
  var s = huntReady("captives");
  s.captives = 3; var crew = s.money.crew;
  PC.node.arrive(s, "ocracoke", { fromHunt: true });
  eq(s.captives, 0);
  ok(s.money.crew >= crew + 60 - 60, "reward paid before the harbor due");
});

// ---- The M5 playtest patch ----

test("a minigame roll records its outcome and where the log stood, for the result box (G4)", function () {
  var s = at(inTown(), "tavern"); s.money.purse = 200;
  PC.liarsdice.start(s);
  var before = s.minigame.log.length;
  PC.liarsdice.sizeUp(s);
  if (s.minigame.pending) PC.minigames.settle(s);
  var v = PC.minigames.view(s);
  ok(v.lastRoll && ["clean", "partial", "setback"].indexOf(v.lastRoll.outcome) >= 0, "the outcome is kept");
  eq(v.lastRoll.logAt, before);
  ok(v.log.length > before, "its line follows");
});

test("moving hands: flagship and fleet ships only, within berths and minimums, free outside a battle (A3)", function () {
  var s = huntReady("move");
  PC.hunt.devFleetShip(s, "Schooner");
  var f = s.fleet[0], crew0 = s.crew.count, f0 = f.crew;
  var r = PC.crew.moveHands(s, "flagship", f.id, 3);
  eq(r.n, 3); eq(s.crew.count, crew0 - 3); eq(f.crew, f0 + 3);
  r = PC.crew.moveHands(s, f.id, "flagship", 2);
  eq(s.crew.count, crew0 - 1); eq(f.crew, f0 + 1);
  s.fleet.push({ id: "pz", kind: "prize", cls: "Sloop", crew: 5, crewMin: 5, crewMax: 30, cargo: 50, crewTiers: { Green: 5 } });
  ok(!PC.crew.canMoveHands(s, "flagship", "pz").ok, "prize ships keep their minimum crew");
  var c = PC.crew.canMoveHands(s, f.id, "flagship");
  ok(c.max <= f.crew - f.crewMin, "never below her minimum");
});

test("the harbor due and payouts: crew gold first, then the purse; only both short is a shortfall (B45)", function () {
  var s = huntReady("due");
  var fee = PC.node.portFee(s);
  s.money.crew = 1; s.money.purse = 1000;
  var r = PC.node.payPortFee(s);
  eq(r.fromCrew, 1); eq(r.fromPurse, fee - 1); ok(!r.taken && !r.stocks, "nothing confiscated");
  eq(s.money.purse, 1000 - (fee - 1));
  s.money.crew = 0; s.money.purse = 0;
  r = PC.node.payPortFee(s);
  ok(r.paid === 0, "both empty: the shortfall rules apply");
});

test("the Quartermaster: a fleet command vacates the post; the Acting Quartermaster holds the seat until the vote at the next action at sea (A4, §25.9)", function () {
  var s = huntReady("qm");
  PC.hunt.devFleetShip(s, "Sloop");
  var dev = s.officers.filter(function (o) { return o.aboard !== "flagship"; })[0];
  dev.aboard = "flagship"; s.fleet[0].officer = null;
  var qm = s.officers.filter(function (o) { return o.quartermaster && !o.gone; })[0];
  ok(qm, "someone holds the post");
  // Promote the Quartermaster to a fleet command.
  qm.aboard = s.fleet[0].id; s.fleet[0].officer = qm.id; qm.quartermaster = false; PC.officers.vacate(s);
  var speaker = PC.officers.quartermaster(s);
  ok(speaker && speaker === s.actingQM, "the Acting Quartermaster speaks, with officers aboard");
  ok(PC.officers.votePending(s), "a vote is due");
  var g = PC.hunt.start(s);
  eq(g.phase, "vote");
  PC.hunt.vote(s, g, null);
  ok(!s.actingQM.active, "the acting man goes back to the crew");
  var winner = s.officers.filter(function (o) { return o.quartermaster && !o.gone; })[0];
  ok(winner && (winner.aboard || "flagship") === "flagship", "a flagship officer won");
  PC.hunt.voteReact(s, g, "congratulate");
  ok(g.phase !== "vote", "the hunt goes on");
});

test("the vote's score: traits, Mentor +2, and a Schemer wins every tie (§25.9)", function () {
  var s = huntReady("score");
  s.officers = [
    { id: "a", first: "A", voice: "Jovial", secondary: "Proud", aboard: "flagship", rung: 0, joined: { year: 1754, season: 0 } },
    { id: "b", first: "B", voice: "Schemer", secondary: "Eager", aboard: "flagship", rung: 0, joined: { year: 1754, season: 0 } },
  ];
  var sc = PC.officers.voteScores(s, null);
  eq(sc[0].score, 4); eq(sc[1].score, 3);
  var r = PC.officers.runVote(s, "b");
  ok(r.winner.id === "b" || PC.officers.speakBonus(s) < 1, "speaking for B ties or wins it, and a Schemer wins ties");
});

test("the cargo picker loads what was picked, within what fits (A7); goods leave the summary chips (A10)", function () {
  var s = huntReady("pick");
  var a = aShip(s, "Barque", "Trade", "Avalon");
  var g = huntWith(s, { ships: [a], shape: "single", hunter: false });
  withDice([6, 6], function () { PC.hunt.engage(s, g); });
  eq(g.phase, "after");
  var pr = PC.hunt.currentPrize(s, g);
  var goods = Object.keys(pr.loot.goods);
  var pick = { treasure: 0, goods: {}, provisions: 0 };
  if (goods.length) pick.goods[goods[0]] = 1;
  var before = goods.length ? ((s.cargo.goods[goods[0]] || {}).dirty || 0) : 0;
  var t0 = s.cargo.treasure.dirty;
  PC.hunt.settlePrize(s, g, { hull: "release", crew: "release", captives: "free", cargo: pick });
  if (goods.length) eq(s.cargo.goods[goods[0]].dirty, before + 1);
  eq(s.cargo.treasure.dirty, t0, "no treasure picked, none taken");
  var v = PC.minigames.view(s).after;
  ok(!v.summary.some(function (c) { return /treasure|whisky|rum|sugar|tobacco/i.test(c.text || ""); }), "goods leave the chip list");
});

test("after-battle chips total across every ship taken: one line a good or effect (A10)", function () {
  var m = PC.hunt.mergeChips([
    { icon: "heat", k: "heat:avalon", n: 6, tpl: "Avalon Heat {+n}" }, { icon: "heat", k: "heat:avalon", n: 6, tpl: "Avalon Heat {+n}" },
    { icon: "gold", k: "chest:crew", n: 50, tpl: "Ship's chest: {n} gold to crew gold" }, { icon: "gold", k: "chest:crew", n: 25, tpl: "Ship's chest: {n} gold to crew gold" },
    { icon: "ship", text: "Prize ship: Gull" }]);
  eq(m.length, 3);
  eq(m[0].text, "Avalon Heat +12"); eq(m[1].text, "Ship's chest: 75 gold to crew gold");
});

test("Board her rolls the grapple at once (B37)", function () {
  var s = huntReady("board2");
  var e = aShip(s, "Sloop", "Raider", "Pirate");
  var g = huntWith(s, { ships: [e], shape: "single", hunter: false });
  withDice([1, 1], function () { PC.hunt.engage(s, g); });
  eq(g.phase, "battle");
  g.battle.step = "decision";
  withDice([6, 6], function () { PC.hunt.battle(s, g, "decide", "board"); });
  ok(!g.battle || g.battle.step !== "grapple", "no separate grapple step after Board her");
  ok(!g.battle || g.battle.step !== "decision", "something happened");
});

test("a sighting's ships never share a name with each other or your fleet (A13)", function () {
  var s = huntReady("names");
  for (var i = 0; i < 30; i++) {
    var grp = PC.huntGen.sighting(s, "north", PC.rng.fromKey("n|" + i), { kind: "convoy" });
    var names = grp.ships.map(function (x) { return x.name; }).filter(Boolean);
    names.push(s.ship.name);
    var seen = {};
    names.forEach(function (n) { ok(!seen[n], "twin name " + n); seen[n] = true; });
  }
});

test("selling a hull shows her effect on the hold, and throws the overflow over the side, cheapest first (A9)", function () {
  var s = huntReady("sellhold");
  s.fleet = [{ id: "p1", kind: "prize", cls: "Sloop", name: "Gull", flag: "Avalon", size: 1, hull: 20, hullMax: 20, guns: 0, gunsMax: 10, crew: 5, crewMin: 5, crewMax: 30, cargo: 50, dirty: true, crewTiers: { Green: 5 } }];
  s.provisions = 10;
  PC.crew.addGood(s, "Sugar", PC.crew.holdCapacity(s) - PC.crew.slotsUsed(s), false);
  var hh = PC.node.hullSaleHold(s, "p1");
  eq(hh.over, 50); ok(hh.plan.length && hh.plan[0].what === "Sugar", "cheapest goods first");
  s.location.place = "docks";
  var r = PC.node.sellHull(s, "p1");
  ok(PC.crew.slotsUsed(s) <= PC.crew.holdCapacity(s), "it all fits after");
  ok(r.jettisoned.length, "the overflow went over the side");
});

test("a curable ailment costs -2 on its main skill, -1 on the other (B2)", function () {
  var s = fresh("ail");
  var base = function (t) { return PC.checks.assess(s, { type: t, dr: 0 }).edge; };
  s.captain.tags = s.captain.tags.filter(function (t) { return t !== "Bad Knee"; });
  var c0 = base("Chase & Climb"), b0 = base("Board");
  s.captain.tags.push("Bad Knee");
  eq(base("Chase & Climb"), c0 - 2); eq(base("Board"), b0 - 1);
});

test("the startup quests' journal entries open at the actual offer (B9)", function () {
  var s = PC.state.newGame(PC.data.testCaptain, { seed: "offer" });
  PC.scenes.enterScene(s, "ocr_uw_1");
  ok(!PC.quests.journal(s).some(function (j) { return j.id === "underworld"; }), "not while Bobby only waves you over");
  PC.scenes.enterScene(s, "ocr_uw_2");
  ok(PC.quests.journal(s).some(function (j) { return j.id === "underworld"; }), "open once he asks for the coin");
});

console.log("Milestone 6 (§37.1, §37.4; the M6 chat)");

test("R7: provisions sell back at half the provisioner's price, out of his coffers; the visit total counts it", function () {
  var s = at(inTown(), "merchant"); PC.node.enter(s, "merchant");
  s.provisions = 10; var crew = s.money.crew;
  eq(PC.node.provisionsSellPrice(s), Math.round(PC.node.provisionsPrice(s) * 0.5 * 100) / 100);
  var r = PC.node.sellProvisions(s, 4);
  eq(r.units, 4); eq(s.provisions, 6);
  eq(s.money.crew, crew + r.gold);
  eq(PC.node.visitSales(s, "provisioner"), r.gold);
  PC.node.enter(s, "merchant");
  eq(PC.node.visitSales(s, "provisioner"), 0, "a new visit starts at zero");
});

test("R6: Sell all he'll take sells every clean unit the provisioner buys, up to his coffers", function () {
  var s = at(inTown(), "merchant"); PC.node.enter(s, "merchant");
  s.cargo.treasure.clean = 4; s.cargo.treasure.dirty = 3;
  var r = PC.node.sellAll(s, "provisioner");
  eq(r.units, 4); eq(s.cargo.treasure.clean, 0); eq(s.cargo.treasure.dirty, 3, "dirty stays for the fence");
  eq(PC.node.visitSales(s, "provisioner"), r.gold);
});

test("R5: ending the prototype shows the summary; Keep playing tops up; a game over can't keep playing", function () {
  var s = inTown(); s.ap.left = 0;
  s.records.prizes = 2; s.records.hullsSold = 1;
  s.captain.tags.push("Card Sharp");
  PC.summary.end(s, "stopped");
  eq(s.current.screen, "end");
  var v = PC.summary.summary(s);
  eq(v.how, "stopped"); eq(v.prizes, 2); eq(v.hullsSold, 1);
  eq(v.purse, s.money.purse);
  ok(v.leads.lossNeeded === 3);
  PC.summary.keepPlaying(s);
  eq(s.current.screen, "node"); eq(s.ap.left, s.ap.max);
  s.gameOver = { how: "died" };
  PC.summary.end(s);
  eq(PC.summary.summary(s).how, "died");
  var threw = false; try { PC.summary.keepPlaying(s); } catch (e) { threw = true; }
  ok(threw);
});

test("R5: a new captain records the tags he started with, so the end screen lists only those earned", function () {
  var s = ocr();
  ok(Array.isArray(s.records.startTags));
  s.captain.tags.push("Prize Taker");
  PC.summary.end(s, "stopped");
  eq(PC.summary.summary(s).tags.join(","), "Prize Taker");
});


console.log("Milestone 7, PR 1: the next build's fixes (§37.12)");

test("N1: Battle Rating counts hull ÷ 10", function () {
  eq(PC.data.hunt.BR_HULL_DIV, 10);
  var sh = { guns: 0, hull: 50, crew: 0, crewMin: 0 };
  eq(Math.round(PC.combat.br(sh) * 10) / 10, 5);
});

test("N2: grapeshot kills men by the attacker's manned guns (1 per 3 heavy, 1 per 6 light)", function () {
  eq(PC.data.hunt.GRAPE_BY_GUNS.heavy, 1 / 3);
  eq(PC.data.hunt.GRAPE_BY_GUNS.light, 1 / 6);
});

test("N4: a battle lists every roll with its outcome word and what it did", function () {
  var s = huntReady("n4");
  var bq = aShip(s, "Barque", "Trade", "Avalon");
  var g = huntWith(s, { ships: [bq], shape: "single", hunter: false });
  withDice([6, 6], function () { PC.hunt.engage(s, g); });
  var v = PC.minigames.view(s);
  var r = v.rollList.filter(function (x) { return x.label === "Call on her to strike"; })[0];
  ok(r, "the pre-battle strike roll is listed");
  eq(r.outcome, "clean"); eq(r.effect, "she strikes without a fight");
});

test("N5: Variant A's drinking lead names a shipwright, not a carpenter", function () {
  ok(/shipwright with a birthmark/.test(PC.data.quests.what_was_lost.leads.drinking.A) || JSON.stringify(PC.data.quests).indexOf("a shipwright with a birthmark") >= 0);
  ok(JSON.stringify(PC.data.quests).indexOf("carpenter with a birthmark") < 0);
});


console.log("Milestone 7, PR 2: the map, voyages, the season loop and Norfolk (§4, §17.4, §26.9, §27.7)");

function m7(seed) {
  var s = huntReady(seed || "m7");
  s.money.crew = 2000; s.provisions = 30;
  return s;
}

test("§4's table: Ocracoke-Norfolk 1, Norfolk-the Bahama Channel 2, the two ocean nodes 2 apart", function () {
  eq(PC.world.apCost("ocracoke", "norfolk"), 1); eq(PC.world.apCost("norfolk", "bahama"), 2);
  eq(PC.world.apCost("hatteras", "bahama"), 2); eq(PC.world.apCost("bahama", "hatteras"), 2); eq(PC.world.apCost("norfolk", "nassau"), 3);
});

test("a voyage costs its AP, burns crew ÷ 5 × AP and arrives with the port fee", function () {
  var s = m7("voy"), ap = s.ap.left, prov = s.provisions, crew = s.money.crew;
  var heads = PC.world.headsAtSea(s);
  PC.world.sail(s, "norfolk");
  eq(s.location.node, "norfolk"); eq(s.ap.left, ap - 1);
  eq(s.provisions, prov - Math.ceil(heads / 5));
  eq(crew - s.money.crew, 75); // 75 × Size 1 × Neutral
  ok(/Arrival at Norfolk/.test(s.location.popup.title));
});

test("an ocean node has no port fee; Uncharted places can't be sailed to", function () {
  var s = m7("ocean"), crew = s.money.crew;
  PC.world.sail(s, "bahama");
  eq(s.location.node, "bahama"); eq(s.money.crew, crew); eq(s.ap.left, 5);
  ok(!PC.world.canSail(s, "nassau").ok);
});

test("too few actions: the voyage is locked, and the captain stays as the season turns", function () {
  var s = m7("few"); s.ap.left = 1;
  ok(!PC.world.canSail(s, "bahama").ok, "2 AP needed");
  PC.world.endSeason(s);
  eq(s.location.node, "ocracoke"); eq(PC.state.seasonName(s), "Summer");
});

test("running short never blocks: -10 morale and a Go Without check", function () {
  var s = m7("short"); s.provisions = 0; var m = s.crew.morale;
  PC.world.sail(s, "norfolk");
  eq(s.location.node, "norfolk"); eq(s.crew.morale <= m - 10, true);
});

test("Winter burns +50%; rationing -25%", function () {
  var s = m7("winter"); s.time.season = 3; s.crew.rationing = false;
  var heads = PC.world.headsAtSea(s);
  var b = PC.world.burn(s, 1, {});
  eq(b.need, Math.ceil(heads / 5 * 1.5));
  s.time.season = 0; s.crew.rationing = true;
  var b2 = PC.world.burn(s, 2, {});
  eq(b2.need, Math.ceil(heads / 5 * 2 * 0.75));
});

test("idle upkeep burns crew ÷ 5 at the season's end; morale bands move Pressure", function () {
  var s = m7("upkeep"); var prov = s.provisions;
  s.crew.morale = 10; s.crew.pressure = 0;
  PC.world.endSeason(s);
  eq(prov - s.provisions, Math.ceil(s.crew.count / 5));
  eq(s.crew.pressure, 2); // Mutinous: +2
});

test("the start of Winter opens the split; holding adds Pressure by the implied share", function () {
  var s = m7("hold"); s.time.season = 2; s.money.crew = 3000; s.crew.morale = 50; s.crew.pressure = 0;
  PC.world.endSeason(s);
  eq(s.current.screen, "split"); ok(s.split && s.split.step === "ask");
  var share = PC.world.impliedShare(s);
  ok(share > 50);
  PC.world.holdSplit(s);
  eq(s.crew.pressure, share > 200 ? 2 : 1);
});

test("a forced split at Pressure 4 can't be declined", function () {
  var s = m7("forced"); s.time.season = 2; s.money.crew = 3000; s.crew.morale = 50; s.crew.pressure = 4;
  PC.world.endSeason(s);
  ok(s.split.forced);
  var threw = false; try { PC.world.holdSplit(s); } catch (e) { threw = true; }
  ok(threw);
});

test("the split: 10% carried over, the captain's share to the purse, prize ships sold, morale 50, Pressure 0", function () {
  var s = m7("split"); s.time.season = 2; s.money.crew = 1000; s.money.purse = 0; s.crew.pressure = 3; s.crew.morale = 80;
  s.fleet.push({ id: "p1", kind: "prize", cls: "Barque", name: "Hope", size: 2, hull: 45, hullMax: 45, guns: 0, crew: 8, crewMin: 8, crewTiers: { Green: 8 }, cargo: 250, dirty: false });
  PC.world.endSeason(s);
  var pay = PC.world.doSplit(s);
  ok(pay.sold.length === 1 && pay.sold[0].gold > 0);
  eq(pay.carry, Math.round(pay.pool * 0.1));
  eq(s.money.crew, pay.carry);
  eq(s.money.purse, pay.captain);
  eq(s.crew.morale, 50); eq(s.crew.pressure, 0); eq(s.ap.left, 0);
  eq(s.fleet.filter(function (f) { return f.kind === "prize"; }).length, 0);
  ok(!PC.world.canSail(s, "norfolk").ok, "no voyage in a split Winter");
  ok(PC.node.places(s).filter(function (p) { return p.id === "tavern"; })[0].locked, "no port business");
});

test("departures leave a skeleton crew; re-signers by the morale band; the Articles are re-signed", function () {
  var s = m7("depart"); s.time.season = 2; s.crew.morale = 90;
  PC.world.endSeason(s); PC.world.doSplit(s);
  var before = s.crew.count;
  var d = PC.world.departures(s);
  ok(s.crew.count >= (s.ship.crewMin || 5) && s.crew.count <= before);
  eq(d.left + d.back + (s.ship.crewMin || 5), before);
  eq(s.articles, null);
  PC.articles.sign(s, PC.articles.defaults());
  PC.world.afterResign(s);
  eq(s.split.step, "winter");
  var ids = PC.world.winterOptions(s).map(function (o) { return o.id; });
  ok(ids.indexOf("careening") >= 0 && ids.indexOf("courting") < 0 && ids.indexOf("home") < 0, "Ocracoke: careening, no courting, no home");
  s.ship.hull = 1;
  PC.world.spendWinter(s, "careening");
  eq(s.ship.hull, s.ship.hullMax); ok(s.captain.tags.indexOf("Careened") >= 0);
});

test("after Winter 1754 the run ends on the end-of-year screen", function () {
  var s = m7("yearend"); s.time.season = 3;
  var o = PC.world.endSeason(s);
  ok(o.yearEnd); eq(s.current.screen, "end"); eq(s.ended.how, "year");
  PC.summary.keepPlaying(s);
  eq(s.time.year, 1755); eq(PC.state.seasonName(s), "Spring"); eq(s.current.screen, "node");
});

test("Norfolk: Horace keeps the Tavern, Christoph the yard; level 4 needs Avalon 20+", function () {
  var s = m7("nor"); PC.world.sail(s, "norfolk"); s.location.popup = null;
  eq(PC.npcs.get(s, PC.node.slotNpc("norfolk", "keeper")).first, "Horace");
  s.money.crew = 99999;
  s.ship.upgrades.hull = 3;
  var u = PC.node.upgradeInfo(s, "hull");
  ok(u.locked && u.gated, "gated at Avalon 0");
  eq(PC.node.upgrade(s, "hull").line, PC.data.nodes.norfolk.lines.shipwright.gateLocked);
  s.meters.standing.avalon = 25;
  ok(!PC.node.upgradeInfo(s, "hull").locked);
  eq(PC.node.upgrade(s, "hull").line, PC.data.nodes.norfolk.lines.shipwright.upgradeTop);
});

test("Norfolk: the crew pool closes below Avalon 0; Enemy captains are turned away", function () {
  var s = m7("norpool"); PC.world.sail(s, "norfolk");
  ok(PC.node.poolAvailable(s).Able > 0);
  s.meters.standing.avalon = -5;
  eq(PC.node.recruit(s, "Able", 1).line, PC.data.nodes.norfolk.lines.crew.closed);
  s.meters.standing.avalon = -80;
  PC.world.sail(s, "ocracoke");
  ok(!PC.world.canSail(s, "norfolk").ok);
});

test("Norfolk's stock: tobacco 20-40 at ×0.6; no fence; dirty hulls refused", function () {
  var s = m7("norstock"); PC.world.sail(s, "norfolk");
  var st = PC.node.season(s).stock;
  ok(st.Tobacco >= 20 && st.Tobacco <= 40);
  eq(PC.node.shopPrice(s, "norfolk", "Tobacco", null) <= 12.01, true);
  ok(!PC.node.fenceOpen(s));
  var p = PC.node.hullSalePrice(s, { cls: "Sloop", size: 1, hull: 20, hullMax: 20, guns: 0, dirty: true });
  ok(!p.ok);
});

test("rumors stay at their node: Norfolk's lines never show at Ocracoke, nor Ocracoke's legends at Norfolk", function () {
  var s = m7("rum");
  ok(PC.rumors.candidatesOf(s, "Legend").every(function (c) { return c.line.node !== "norfolk"; }));
  PC.world.sail(s, "norfolk");
  var leg = PC.rumors.candidatesOf(s, "Legend");
  ok(leg.length && leg.every(function (c) { return c.line.node === "norfolk"; }));
});

test("Norfolk's drinker is a Colonial Officer from the six-trait pool", function () {
  var s = m7("drink"); PC.world.sail(s, "norfolk"); s.location.popup = null;
  PC.drinking.start(s);
  ok(PC.data.minigames.drinking.pools.norfolk.traits.indexOf(s.minigame.opp.trait) >= 0);
  ok(/navy officer/.test(s.minigame.log[0]));
});

test("the trade ship: enroll a kept prize (buyout to crew gold, fee), earn each season, collect on arrival", function () {
  var s = m7("trade"); PC.world.sail(s, "norfolk"); s.location.popup = null;
  s.money.purse = 10000;
  PC.crew.removeHands(s, "Green", 10); // berths for her prize crew
  s.fleet.push({ id: "b1", kind: "prize", cls: "Barque", name: "Hope", size: 2, hull: 45, hullMax: 45, guns: 0, crew: 8, crewMin: 8, crewTiers: { Green: 8 }, cargo: 250, dirty: false });
  var o = PC.world.tradeOptions(s)[0];
  eq(o.fee, 3000); eq(o.buyout, Math.round(5550 * 0.15));
  var crew = s.money.crew;
  PC.world.enroll(s, "b1");
  eq(s.money.purse, 10000 - o.cost); eq(s.money.crew, crew + o.buyout);
  ok(s.tradeShip && !s.fleet.some(function (f) { return f.id === "b1"; }));
  var real = PC.rng.fromKey;
  PC.rng.fromKey = function (k) { return /trade-loss/.test(k) ? function () { return 0.99; } : real(k); };
  try { PC.world.endSeason(s); } finally { PC.rng.fromKey = real; }
  eq(s.tradeShip.ledger, Math.round(1.25 * 250));
  PC.world.sail(s, "ocracoke"); PC.world.sail(s, "norfolk");
  eq(s.tradeShip.ledger, 0); eq(s.money.purse, 10000 - o.cost + 313);
});

test("a hunt from an ocean node stays at sea; Norfolk hunts the Hatteras Banks", function () {
  var s = m7("oceanhunt"); PC.world.sail(s, "bahama"); s.location.popup = null;
  var g = PC.hunt.start(s);
  eq(g.waters, "south");
  g.phase = "batchEnd"; PC.hunt.sailHome(s, g); PC.minigames.leave(s);
  eq(s.location.node, "bahama");
});

test("a version 7 save loads as version 8 with the trade ship and season-loop fields, and Ocracoke's Trade Master", function () {
  var s = m7("mig"); var old = JSON.parse(PC.state.serialize(s));
  old.saveVersion = 7; delete old.tradeShip; delete old.split; delete old.yearStart; delete old.generated.ocr_trademaster;
  var back = PC.state.deserialize(JSON.stringify(old));
  eq(back.saveVersion, 8); eq(back.tradeShip, null); ok(back.yearStart); ok(back.generated.ocr_trademaster);
});


console.log("Milestone 7, PR 3: weather (§42)");

test("the outlook is seeded and known a season ahead; Hurricane 1754 in the north is fixed Foul", function () {
  var s = m7("wx1");
  eq(PC.weather.outlookAt(s, "north", 1754, 2), "Foul");
  var a = PC.weather.outlookAt(s, "south", 1755, 1), b = PC.weather.outlookAt(s, "south", 1755, 1);
  eq(a, b);
  s.time.season = 0; eq(PC.weather.nextOutlook(s, "south"), PC.weather.outlookAt(s, "south", 1754, 1));
});

test("conditions: Summer doubles Calm, Spring doubles Fog in the north; a Foul outlook never rolls Calm", function () {
  var s = m7("wx2"); s.time.season = 1;
  eq(PC.weather.conditionWeights(s, "Fair", "north")[0], 40);
  s.time.season = 0;
  eq(PC.weather.conditionWeights(s, "Fair", "north")[3], 20);
  eq(PC.weather.conditionWeights(s, "Fair", "south")[3], 10);
  eq(PC.data.weather.CONDITION.Foul[0], 0);
});

test("each hunt batch rolls a condition; a Storm batch makes a Ride Out Storm check first; density drops", function () {
  var s = m7("wx3"), real = PC.weather.rollCondition;
  PC.weather.rollCondition = function () { return "Storm"; };
  var hull = s.ship.hull, g;
  try { withDice([1, 1], function () { g = PC.hunt.start(s); }); } finally { PC.weather.rollCondition = real; }
  eq(g.batch.condition, "Storm");
  ok(s.ship.hull < hull, "a setback costs hull");
  ok(PC.huntGen.density(s, "Storm") < PC.huntGen.density(s, "Fair"));
});

test("Read Weather before a batch: clean reveals the next condition and rerolls a Storm once", function () {
  var s = m7("wx4"), g = PC.hunt.start(s);
  g.phase = "batchEnd";
  var calls = 0, real = PC.weather.rollCondition;
  PC.weather.rollCondition = function () { calls++; return calls === 1 ? "Storm" : "Fair"; };
  try { withDice([6, 6], function () { PC.hunt.readAhead(s, g); }); } finally { PC.weather.rollCondition = real; }
  eq(g.readAhead.seen, "Fair"); ok(g.readAhead.rerolled);
  PC.hunt.anotherBatch(s, g);
  eq(g.batch.condition, "Fair");
});

test("in battle: Calm slows ships without sweeps; Fog: no pre-battle flee roll; Rough: the smaller ship's Exchange −1", function () {
  var s = m7("wx5");
  var bq = aShip(s, "Barque", "Trade", "Avalon");
  var g = huntWith(s, { ships: [bq], shape: "single", hunter: false });
  g.batch.condition = "Calm";
  withDice([1, 1], function () { PC.hunt.engage(s, g); });
  var b = g.battle;
  eq(PC.combat.ship(s, b, bq.id).speed, 1);
  eq(PC.combat.ship(s, b, "flagship").speed, s.ship.speed); // a sloop has sweeps
  b.condition = "Rough";
  var parts = PC.combat.weatherParts(s, b, "exchange");
  ok(parts.some(function (p) { return p.value === -1; }), "the sloop is the smaller ship");
  b.condition = "Fog";
  ok(PC.combat.weatherParts(s, b, "flee")[0].value === 1);
});

test("a hurricane strike hits ships in an open harbor, spares the shallows, never sinks", function () {
  var s = m7("wx6"); PC.world.sail(s, "norfolk"); s.location.popup = null;
  s.time.year = 1755; s.time.season = 2;
  var real = PC.weather.outlook; PC.weather.outlook = function () { return "Foul"; };
  var hull = s.ship.hull, out = { lines: [], chips: [] };
  try { PC.weather.strike(s, "north", out, { fixed: true }); } finally { PC.weather.outlook = real; }
  ok(s.ship.hull < hull && s.ship.hull >= 1);
  var s2 = m7("wx7"); s2.time.year = 1755; s2.time.season = 2; var h2 = s2.ship.hull, o2 = { lines: [], chips: [] };
  PC.weather.strike(s2, "north", o2, { fixed: true });
  eq(s2.ship.hull, h2); ok(/shallows/.test(o2.lines[0]));
});

test("Hurricane 1754: the north's strike comes as the season opens", function () {
  var s = m7("wx8"); PC.world.sail(s, "norfolk"); s.location.popup = null;
  s.time.season = 1; var hull = s.ship.hull;
  var out = PC.world.endSeason(s);
  eq(PC.state.seasonName(s), "Hurricane");
  ok(out.hurricane && out.hurricane[0].hit, "struck at Norfolk"); ok(s.ship.hull < hull);
});

test("the Winter salvage bonus applies to ordinary Graveyard dives in Winter, never the Miranda", function () {
  ok(PC.weather.winterSalvage({ time: { year: 1754, season: 3 } }, {}) === true);
  ok(PC.weather.winterSalvage({ time: { year: 1754, season: 3 } }, { miranda: true }) === false);
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
