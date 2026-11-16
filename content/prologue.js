/* The prologues (§40): the author's text, the screens' cues, and the
 * placeholder chart drawn in code (§40.1; the author's map art replaces it).
 *
 * Text is final (§40.2, §40.4). The screen code is js/prologue.js.
 * Closing-prologue tokens: {city}, {loss}, {mentor}, {mentor.he}, {mentor.He},
 * {ship} (the game adds "the").
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  // ---- The opening prologue (§40.2-§40.3) ----
  var OPENING = [
    { bg: "night", paras: [
      { cls: "quote", html: "“Where there is a sea, there are <b>pirates</b>.”" },
      { cls: "attr", html: "— Ancient Greek proverb", with: true }] },
    { bg: "night", paras: [
      { html: "For two hundred years, pirates have ruled the seas. Great kingdoms of the old world have been brought to their knees." },
      { html: "The kingdoms that survived learned to work with these seaborne terrors, hiring privateers—pirates with a government license—to guard their trade and lay waste to their enemies. The shrewdest of these kingdoms have grown into empires that span the globe. Even still, they live at the mercy of those who command the seas." }] },
    { bg: "night", paras: [
      { html: "England is long gone, swallowed by Scotland, which now rules all of Britain. Spain, once master of the Caribbean, has lost most of its islands to Frisia, the merchant kingdom of the Low Countries and the richest power in the world. The young Swedish Republic, born of revolution, rules the far north, from the shores of the Baltic to the vast colonies of Vinland." }] },
    { bg: "night", paras: [
      { html: "Many say the Golden Age of Piracy is coming to an end. The great powers now build powerful navies to rival the mightiest pirate fleets: colossal warships, heavily armed trading fleets, and hunters sworn to end piracy by any means necessary." },
      { html: "The legendary pirate fleets of the Mediterranean, the North Sea, and the Indian Ocean have been hunted to near-extinction. The noose tightens around those that remain, driving them to remote hunting grounds along the coast of West Africa and the Horn of South America." }] },
    { bg: "night", paras: [{ cls: "year", html: "1754", rule: true }] },
    { bg: "page", paras: [
      { html: "The east coast of North America is one of the last great hotbeds of piracy. For decades, the leaders of the region’s four major colonial powers—the merchant companies of <span class=\"pw pw-frisia\">Frisia</span>, the noble families of <span class=\"pw pw-avalon\">Scotland</span>, the senators of the <span class=\"pw pw-sweden\">Swedish Republic</span>, and the princes of <span class=\"pw pw-france\">France</span>—have made extensive use of privateers in a bid to expand their New World empires.", cue: "powers" }] },
    { bg: "page", portrait: { src: "assets/art/amberjack_1745.webp", cap: "Amber Jack", sub: "Privateer of Avalon, 1745" }, paras: [
      { html: "The governors of Scotland’s colonies in the New World, collectively known as Avalon, hired privateers to choke off trade between France and its colonies. The leader of these privateers, a powerful and cunning archpirate known as Amber Jack, laid waste to the coasts of French Mexico and Louisiana for nearly a decade.", cue: "jackRaids" }] },
    { bg: "page", portrait: { src: "assets/art/deadman_1751.webp", cap: "Captain Deadman", sub: "French Privateer, 1751" }, paras: [
      { html: "Two years ago, France answered with the largest privateer fleet ever assembled in the region, led by a fearsome and experienced seafarer the colonists call Captain Deadman. At Cape Fear, Deadman broke Amber Jack’s fleet and crushed Avalon’s disorganized colonial navy soon after. Disgraced, Amber Jack slipped away across the sea.", cue: "capeFear" }] },
    { bg: "page", paras: [
      { html: "For nearly two years, Deadman’s fleet ravaged Avalon’s coast. Baltimore fell first. Savannah burned the following summer. Then Charleston, the jewel of southern Avalon, was put to the torch.", cue: "route" }] },
    { bg: "page", paras: [
      { html: "As 1754 dawns, the French fleet has gone home, leaving only a few stragglers turned pirate. A large Scottish fleet under the ambitious Admiral James Key has arrived to restore order. Still, an uneasy quiet hangs over the colonies, and in Europe, Frisia’s war against Sweden threatens to spread.", cue: "dawn" },
      { html: "But in the ashes of Avalon, new legends rise. The Golden Age of Piracy is not over yet.", cue: "ocracoke", end: "Make your captain" }] },
  ];

  // ---- The closing prologue (§40.4) ----
  var CLOSING = [
    { bg: "page", paras: [
      { html: "After months spent trying to pick up the pieces in the ashes of {city}, you realize you can’t stay any longer. There’s nothing left for you here, and you still need to find {loss}.", cue: "home" },
      { html: "You sell just enough of what you have left to buy a battered old sloop. She has holes in her sails and splinters in her deck, but she’ll float and she’ll sail, and that’s all you need." }] },
    { bg: "page", paras: [
      { html: "As you say your goodbyes to your old friend {mentor}, {mentor.he} stops you. “Don’t think you’re leaving without me,” {mentor.he} says, and {mentor.he} won’t take no for an answer." },
      { html: "The two of you find a dozen men down at the docks who are as desperate to leave {city} as you are, and they sign aboard for nothing more than a handshake. {mentor} suggests the pirate haven of Ocracoke as a first stop: a place to hear the latest rumors, hire more crew, and refit the {ship} cheaply." },
      { html: "You sail from {city} aboard the {ship}, with {mentor} and your new crew beside you, and leave what’s left of home behind.", cue: "sail" }] },
    { bg: "night", paras: [{ cls: "ember", html: "Your destiny lies at sea.", end: "Continue" }] },
  ];

  // {loss} by variant (§40.4).
  var LOSS_WORDS = { A: "your brother", B: "your family’s fortune", C: "the man who shot you" };

  // ---- The placeholder chart (§40.1, §40.3) ----
  var CHART = {
    MAINLAND: [[-128,64],[-62,64],[-56.5,54],[-56.2,52.6],[-57.2,51.5],[-59.5,50.4],[-62,50.2],[-64.5,50.2],[-66.6,49.9],[-68.6,48.9],[-70.4,47.4],
      [-68.6,48.5],[-66.3,49.1],[-64.4,48.9],[-64.9,47.9],[-64.9,47.2],[-64.6,46.6],[-63.5,46.0],[-62.2,45.7],[-61.2,45.9],[-60.4,46.6],[-59.9,46.0],[-60.9,45.4],
      [-63.0,44.6],[-64.6,43.9],[-65.6,43.6],[-66.2,44.4],[-64.8,45.2],[-64.3,45.4],[-65.6,45.4],[-66.9,45.0],[-68.4,44.3],[-69.9,43.8],[-70.7,43.0],[-70.6,42.6],
      [-71.0,42.3],[-70.6,41.9],[-70.0,42.05],[-69.95,41.65],[-70.4,41.6],[-71.1,41.45],[-72.6,41.25],[-73.7,40.9],[-72.0,41.0],[-72.6,40.8],[-73.9,40.55],[-74.05,40.05],
      [-74.4,39.4],[-74.95,38.95],[-75.5,39.45],[-75.1,38.75],[-75.1,38.2],[-75.6,37.5],[-75.98,37.13],[-75.95,37.9],[-76.15,38.6],[-76.3,39.3],[-76.6,39.27],
      [-76.45,38.5],[-76.35,37.8],[-76.05,36.95],[-75.75,36.3],[-75.5,35.6],[-75.5,35.25],[-76.0,35.05],[-76.55,34.65],[-77.4,34.45],[-77.95,33.85],[-78.9,33.6],
      [-79.25,33.1],[-79.9,32.75],[-80.7,32.25],[-81.1,31.9],[-81.4,31.0],[-81.45,30.1],[-81.25,29.6],[-80.6,28.4],[-80.4,27.5],[-80.05,26.7],[-80.15,25.75],[-80.45,25.2],
      [-81.1,25.15],[-81.75,25.95],[-82.4,27.0],[-82.75,28.2],[-83.3,29.25],[-84.0,30.05],[-84.9,29.75],[-85.5,29.75],[-86.5,30.35],[-87.6,30.25],[-88.1,30.6],[-89.0,30.35],
      [-89.6,30.2],[-89.3,29.2],[-90.2,29.05],[-91.4,29.4],[-93.0,29.75],[-94.6,29.35],[-95.6,28.75],[-96.7,28.2],[-97.3,27.4],[-97.4,26.2],[-97.6,24.6],[-97.75,22.4],
      [-97.2,20.8],[-96.15,19.15],[-95.2,18.6],[-94.3,18.15],[-92.6,18.6],[-91.6,18.6],[-90.6,19.7],[-90.4,20.9],[-89.4,21.3],[-88.0,21.55],[-87.05,21.45],[-86.85,20.6],
      [-87.4,19.5],[-87.6,18.5],[-88.2,17.6],[-88.4,15.5],[-89,10],[-128,10]],
    ISLANDS: {
      newfoundland: [[-59.35,47.6],[-58.2,48.5],[-57.8,49.5],[-57.1,50.6],[-56.0,51.6],[-55.5,51.3],[-55.6,50.0],[-54.0,49.5],[-53.4,48.3],[-52.65,47.5],[-52.95,46.65],[-53.7,46.65],[-54.0,47.4],[-55.4,46.9],[-56.0,47.6],[-57.8,47.6]],
      cuba: [[-84.95,21.85],[-84.0,22.75],[-83.0,23.0],[-82.3,23.17],[-80.6,23.1],[-79.3,22.6],[-78.0,22.3],[-77.1,21.6],[-75.6,21.1],[-74.15,20.25],[-74.5,20.0],[-75.6,19.9],[-77.7,19.85],[-77.25,20.6],[-78.2,21.4],[-79.6,21.7],[-81.2,22.1],[-82.0,22.6],[-83.4,22.2],[-84.35,21.85]],
      jamaica: [[-78.35,18.3],[-77.6,18.5],[-76.8,18.45],[-76.2,18.05],[-76.9,17.85],[-77.8,17.9]],
      hispaniola: [[-74.45,18.45],[-73.3,19.7],[-72.8,19.95],[-71.6,19.9],[-70.4,19.7],[-69.9,19.65],[-69.2,19.2],[-68.35,18.6],[-69.0,18.4],[-70.0,18.25],[-71.0,18.2],[-71.4,17.6],[-71.8,18.0],[-72.8,18.15],[-74.3,18.2]],
      puertoRico: [[-67.25,18.5],[-66.2,18.48],[-65.6,18.35],[-65.65,18.02],[-66.6,17.95],[-67.2,18.0]],
    },
    BAHAMAS: [[-78.4,26.65,.5,.12],[-77.15,26.4,.18,.45],[-77.95,24.55,.25,.5],[-77.35,25.05,.13,.07],[-76.25,25.1,.08,.4],[-76.1,23.9,.08,.3],[-75.1,23.3,.07,.3],[-74.5,24.0,.12,.08],[-73.4,21.05,.3,.15],[-72.6,22.4,.25,.12],[-75.7,22.4,.14,.07]],
    LAKES: [
      [[-92.1,46.75],[-90.0,46.55],[-87.4,46.5],[-84.7,46.5],[-84.8,47.2],[-86.4,48.7],[-88.3,48.5],[-89.6,48.0],[-91.4,47.3]],
      [[-87.8,41.7],[-87.5,43.3],[-87.7,44.5],[-86.6,45.6],[-85.0,45.8],[-86.2,44.2],[-86.4,42.6],[-87.0,41.65]],
      [[-84.6,45.8],[-83.5,45.9],[-81.5,45.5],[-80.2,44.7],[-81.7,44.4],[-82.4,43.1],[-83.3,43.9],[-83.9,44.2]],
      [[-83.4,41.75],[-81.6,41.5],[-79.9,42.25],[-79.0,42.85],[-80.4,42.6],[-82.4,42.0]],
      [[-79.8,43.3],[-78.0,43.35],[-76.3,43.5],[-76.2,44.2],[-77.6,43.95],[-79.4,43.65]]],
    // The Florida panhandle is drawn French (ruled November 15; §2 still says
    // "all of Florida" and is pinned for the doc sweep, §13.2).
    TERR: {
      sweden: [[-101,64],[-40,64],[-40,43],[-66.9,43],[-67.0,45.2],[-71.5,45.05],[-74.6,45.0],[-76.2,44.0],[-79.2,43.25],[-79.8,42.4],[-83.0,41.7],[-85.5,39.5],[-90,37.6],[-96,38.5],[-101,38.8]],
      avalon: [[-66.9,43],[-66.9,45.2],[-71.5,45.05],[-74.6,45.0],[-76.2,44.0],[-79.2,43.25],[-79.8,42.4],[-80.6,40.6],[-81.6,38.6],[-83.0,36.6],[-84.2,34.8],[-84.6,32.8],[-83.2,31.0],[-81.6,30.7],[-60,30.7],[-60,43]],
      frisia: [[-81.6,30.7],[-84.95,30.75],[-85.05,29.4],[-82,23.6],[-78.5,24.5],[-79.2,30.7]],
      france: [[-85.05,29.4],[-84.95,30.75],[-85.3,35.0],[-90,37.6],[-96,38.5],[-101,38.8],[-101.5,31],[-104,29],[-128,26],[-128,10],[-86,10],[-86,24]],
    },
    CITY: { baltimore: [-76.6,39.28], savannah: [-81.09,32.08], charleston: [-79.93,32.78], ocracoke: [-75.99,35.11],
      pensacola: [-87.2,30.42], mobile: [-88.04,30.69], neworleans: [-90.07,29.95], galveston: [-94.8,29.3], campeche: [-90.53,19.85], belize: [-88.2,17.5], veracruz: [-96.13,19.2] },
    // Deadman's route (screen 9): up the coast to Baltimore, then out to sea
    // and back in at Savannah and Charleston.
    LEGS: [
      [[-80.3,24.35],[-79.75,25.6],[-79.75,27.0],[-80.15,28.6],[-80.75,30.1],[-80.75,31.35],[-80.15,32.15],[-79.0,32.95],[-78.1,33.55],[-77.3,34.0],[-76.4,34.35],[-75.4,34.95],[-75.05,35.5],[-75.1,36.2],[-75.6,36.85],[-75.95,37.05],[-76.15,37.7],[-76.25,38.5],[-76.5,39.2]],
      [[-76.5,39.2],[-76.12,38.5],[-76.0,37.7],[-75.82,37.05],[-75.2,36.75],[-73.6,35.8],[-73.1,33.9],[-74.6,31.9],[-77.4,30.9],[-79.9,31.15],[-80.8,31.7],[-80.95,32.0],[-80.6,32.3],[-80.1,32.55],[-79.9,32.72]]],
    // The closing prologue's voyage, from the home city to Ocracoke (§40.4).
    HOME_LEGS: {
      Baltimore: [[-76.6,39.27],[-76.3,38.6],[-76.1,37.8],[-75.85,37.1],[-75.45,36.5],[-75.35,35.7],[-75.7,35.2],[-75.99,35.11]],
      Charleston: [[-79.93,32.78],[-79.5,32.55],[-78.5,33.15],[-77.5,33.85],[-76.6,34.4],[-76.15,34.85],[-75.99,35.11]],
      Savannah: [[-81.09,32.08],[-80.7,31.85],[-79.9,32.3],[-78.8,33.05],[-77.6,33.75],[-76.6,34.4],[-76.15,34.85],[-75.99,35.11]],
    },
    VIEWS: { full: [-106, -52, 17, 53], gulf: [-103.5, -79, 16.5, 33], capeFear: [-88, -67, 26, 41], route: [-92, -68, 24, 41], coast: [-85, -71, 29, 40], home: [-84, -70, 30, 41] },
  };

  PC.data.prologue = { OPENING: OPENING, CLOSING: CLOSING, LOSS_WORDS: LOSS_WORDS, CHART: CHART };
})();
