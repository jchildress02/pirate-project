/* Ship classes and their woodcuts (§21.2).
 *
 * Only what the game shows so far: each class's size (1-5) and its picture.
 * The full stat block (hull, guns, crew, cargo, speed, handling, draft)
 * arrives with the prize hunt milestone. The pictures are all drawn at the
 * same size; `size` lets the screens scale them so a sloop looks small
 * beside a merchantman.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  var CLASSES = [
    { id: "Cutter", size: 1, art: "cutter" },
    { id: "Sloop", size: 1, art: "sloop" },
    { id: "Schooner", size: 1, art: "schooner" },
    { id: "Royal Sloop", size: 2, art: "royal_sloop" },
    { id: "Brigantine", size: 2, art: "brigantine" },
    { id: "Barque", size: 2, art: "barque" },
    { id: "Brig", size: 2, art: "brig" },
    { id: "Merchantman", size: 3, art: "merchantman" },
    { id: "Frigate", size: 3, art: "frigate" },
    { id: "Galleon", size: 4, art: "galleon" },
    { id: "West Indiaman", size: 4, art: "west_indiaman" },
    { id: "4th Rate", size: 4, art: "4th_rate" },
    { id: "3rd Rate", size: 5, art: "3rd_rate" },
    { id: "2nd Rate", size: 5, art: "2nd_rate" },
    { id: "1st Rate", size: 5, art: "1st_rate" },
  ];

  function shipClass(id) { return CLASSES.filter(function (c) { return c.id === id; })[0] || null; }
  function shipArt(id) { var c = shipClass(id); return c ? "assets/ships/" + c.art + ".webp" : null; }

  PC.data.shipClasses = CLASSES;
  PC.data.shipClass = shipClass;
  PC.data.shipArt = shipArt;
})();
