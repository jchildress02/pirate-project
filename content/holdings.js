/* Pirate Chronicle — holdings and homes (§27.5, §27.6; M9 PR 7).
 *
 * Numbers from §27.5's tables (placeholders, the Tuning Table). Prices and
 * income follow the node's current prosperity tier. Sellers: the Official
 * (warehouses and homes) and the tavern keeper (a tavern share). The
 * distiller's share waits for the distiller (D4).
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.holdings = {
    TYPES: {
      warehouse: { name: "Warehouse", seller: "official",
        price: { "Very poor": 3000, "Poor": 7500, "Modest": 15000, "Wealthy": 37500 },
        income: { "Very poor": 120, "Poor": 300, "Modest": 600, "Wealthy": 1500 } },
      tavern: { name: "Tavern share", seller: "keeper",
        price: { "Very poor": 1800, "Poor": 4500, "Modest": 9000, "Wealthy": 22500 },
        income: { "Very poor": 63, "Poor": 160, "Modest": 315, "Wealthy": 790 }, rumors: 1 },
      home: { name: "Home", seller: "official",
        price: { "Very poor": 2000, "Poor": 5000, "Modest": 10000, "Wealthy": 25000 }, income: null },
    },
    // Two paid upgrades, in order (§27.5): cost × the current price; income × base.
    UPGRADE_COST: [0.5, 1.0],
    UPGRADE_INCOME: [1, 1.75, 3.25],
    // Upgrade names are placeholders (PH34; the author writes them).
    UPGRADE_NAMES: {
      warehouse: ["PLACEHOLDER: New Roof", "PLACEHOLDER: Second Floor"],
      tavern: ["PLACEHOLDER: A Bigger Cellar", "PLACEHOLDER: The Back Room (+1 rumor)"],
    },
    SELL_BACK: 0.5,             // 50% of everything put in, at the current tier (§27.5)
    FRIENDSHIP: { "-1": 0.05, "0": 0, "1": -0.05, "2": -0.10, "3": -0.15 }, // the seller's Service Level
    // Home display spots by the home's price (§32.6): 2,000 / 5,000 / 10,000 / 25,000+.
    HOME_SPOTS: { "Very poor": 1, "Poor": 2, "Modest": 3, "Wealthy": 4 },

    // Who sells what at each node, and where his card sits.
    NODES: {
      ocracoke: { official: { slot: "official", place: "clerk", lines: "clerk" }, keeper: { slot: "keeper", place: "tavern", lines: "keeperShare" }, types: ["warehouse", "tavern", "home"] },
      norfolk: { official: { npc: "snodgrass", place: "docks", lines: "harbormaster" }, keeper: { slot: "keeper", place: "tavern", lines: "keeperShare" }, types: ["warehouse", "tavern", "home"] },
    },

    lines: {
      ledger: "PLACEHOLDER: Your holdings here have earned {gold} gold since your last visit. It goes into your purse.",
      warn: "PLACEHOLDER: Word reaches you from {node}: with your Standing so low, your holdings there will be seized if nothing changes by next season.",
      seized: "PLACEHOLDER: Your holdings at {node} have been seized. Everything you put into them is gone.",
    },
  };

  // ---- The sellers' lines ----
  var O = PC.data.nodes.ocracoke, N = PC.data.nodes.norfolk;
  // Ocracoke's harbor clerk (the author's ruling, M9 PR 7): the Official there.
  // Twopenny's planned tent becomes his. PLACEHOLDER lines throughout.
  O.lines.clerk = {
    greet: { "-1": "PLACEHOLDER: \"Oh. You. What is it?\"", "0": "PLACEHOLDER: \"Harbor business? I keep the books here, such as they are.\"", "1": "PLACEHOLDER: \"Captain! Come in, mind the ink.\"", "2": "PLACEHOLDER: \"Captain! Come in, mind the ink.\"", "3": "PLACEHOLDER: \"My best customer. Sit, sit.\"" },
    refuse: "PLACEHOLDER: \"I've got nothing for you. Out.\"",
    offered: "PLACEHOLDER: \"There's a roof or two for sale, if you don't mind the leaks.\"",
    bought: { warehouse: "PLACEHOLDER: \"The warehouse is yours. Try not to let the tide in.\"", home: "PLACEHOLDER: \"A home on Ocracoke. Brave of you.\"" },
    upgraded: "PLACEHOLDER: \"I'll get the work started. It'll be done by next season.\"",
    soldBack: "PLACEHOLDER: \"Half of what you put in. That's the going rate.\"",
    locked: "PLACEHOLDER: \"The Beach Captain's men wouldn't like me selling to you.\"",
    broke: "PLACEHOLDER: \"Come back with the gold.\"",
    allSold: "PLACEHOLDER: \"You own everything I've got to sell.\"",
  };
  O.locations.clerk = { name: "Harbor Clerk's Tent", blurb: "PLACEHOLDER: A patched canvas tent above the dock, stacked with ledgers and damp maps. The harbor clerk keeps Ocracoke's books, such as they are." };
  O.present.places.clerk = { heading: "The Harbor Clerk's Tent", banner: "the harbor clerk's tent", hint: "A warehouse and a home for sale" };
  O.slots.push({ key: "official", id: "ocr_clerk", role: "Official", label: "the harbor clerk", place: "clerk", node: "ocracoke" });
  O.placeOrder = ["tavern", "docks", "merchant", "clerk", "graveyard", "ship"];

  // Norfolk's Harbormaster: the author's lines (Part 4, §9). The upgrade and
  // sell-back lines are PLACEHOLDER.
  N.lines.harbormaster = {
    greet: { "-1": "\"Can't you see I'm busy? Make it quick.\"", "0": "\"Can't you see I'm busy? Make it quick.\"", "1": "\"Can't you see I'm busy? Make it quick.\"", "2": "\"Can't you see I'm busy? Make it quick.\"", "3": "\"Can't you see I'm busy? Make it quick.\"" },
    refuse: "\"I'm afraid you'll need to look elsewhere.\"",
    offered: "\"Oh, yes. We've got a few places for sale.\"",
    bought: { warehouse: "\"A fine warehouse. It's dry, at the very least.\"", home: "\"A house of your own. Respectable, I suppose.\"" },
    upgraded: "PLACEHOLDER: \"The work will be done by next season. Don't hover.\"",
    soldBack: "PLACEHOLDER: \"Half what you paid. Take it or leave it.\"",
    locked: "\"I'm afraid you'll need to look elsewhere.\"",
    broke: "\"The price is firm. Any more talking, and I'll call the guard.\"",
    allSold: "\"You've bought everything I have. Pity. I was enjoying spending your gold.\"",
    earnings: "The official counts twice before handing it over.",
  };
  // The tavern keepers' share lines (PH34: Horace's to write; Ocracoke's too).
  var share = {
    offered: "PLACEHOLDER: \"A share in the place? For the right price, I could part with a piece.\"",
    bought: { tavern: "PLACEHOLDER: \"Welcome aboard, partner. Your cut comes every season.\"" },
    upgraded: "PLACEHOLDER: \"I'll have it done by next season.\"",
    soldBack: "PLACEHOLDER: \"Buying you out at half. No hard feelings.\"",
    locked: "PLACEHOLDER: \"Not with your name what it is around here.\"",
    broke: "PLACEHOLDER: \"You're a little short, friend.\"",
    refuse: null, // the keeper's own refusal line serves
  };
  O.lines.keeperShare = share;
  N.lines.keeperShare = share;
})();
