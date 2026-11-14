/* Pirate Chronicle — engine tests.
 * Run from the repo folder:  node tests/run_tests.js
 * No packages needed.
 */
"use strict";
var path = require("path");
var root = path.join(__dirname, "..");
[
  "js/rng.js", "js/checks.js", "js/state.js", "js/text.js", "js/scenes.js", "js/validate.js",
  "content/check_types.js", "content/modifiers.js", "content/test_captain.js", "content/test_scenes.js",
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

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
