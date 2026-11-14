/* Pirate Chronicle — seeded randomness.
 *
 * Every roll in the game comes from a "key": a string built from the world
 * seed plus where the roll happens (season, scene, choice, attempt). The same
 * key always gives the same dice, so reloading a save never changes a result
 * (§11.1: "The dice are hidden and seeded per scene").
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  // Turn any string into a 32-bit number (cyrb53-style mixing).
  function hashString(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ (h2 >>> 1)) >>> 0;
  }

  // Small, fast seeded generator. Returns a function giving 0 <= x < 1.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fromKey(key) {
    return mulberry32(hashString(String(key)));
  }

  function rollDice(key, count, sides) {
    var r = fromKey(key);
    var out = [];
    for (var i = 0; i < count; i++) out.push(1 + Math.floor(r() * sides));
    return out;
  }

  // A fresh world seed for a new game.
  function newWorldSeed() {
    if (globalThis.crypto && globalThis.crypto.getRandomValues) {
      var a = new Uint32Array(1);
      globalThis.crypto.getRandomValues(a);
      return a[0].toString(36);
    }
    return Math.floor(Math.random() * 4294967296).toString(36);
  }

  PC.rng = {
    hashString: hashString,
    fromKey: fromKey,
    rollDice: rollDice,
    roll2d6: function (key) { return rollDice(key, 2, 6); },
    newWorldSeed: newWorldSeed,
  };
})();
