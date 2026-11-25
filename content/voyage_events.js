/* Voyage events (§44 and its appendix; §25 appendix for the officer
 * events). The author's language and the approved records; the rules are
 * in js/voyage_events.js.
 *
 * Every approved event is here (§44.10). Written events play; approved but
 * unwritten ones play a placeholder card (their name, the registry's short
 * description, Continue, no effects). Weights are §44.12's placeholders.
 *
 * A record: { id, name, group (S, M or O), cat, status, weight, when,
 * cooldown, once, setup, choices }. A choice: { label, check, approval,
 * shows, cost, clean/partial/setback or result: { text, fx } }.
 * Effects (fx), each an object:
 *   prov: legs (± a fraction; 1 leg = crew ÷ 5 lots) · provPct · morale ·
 *   hullPct · crewLost · wounded · purse · dread · heatZone · pressure ·
 *   rumor: tier · apRefund · flag · tag (temporary) · captainWounded ·
 *   guns · good+n · openStores · item · stormTable · hullOrMorale ·
 *   points/rung with who (officer, qm, winner).
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  function ph(id, name, group, cat, weight, when, placeholder) {
    return { id: id, name: name, group: group, cat: cat, status: "approved", weight: weight || 0, when: when || {}, placeholder: placeholder, cooldown: 4 };
  }

  var STORM_CHOICES = function (dr) {
    return [
      { label: "Take in sail and ride it out.", check: { type: "Ride Out Storm", dr: dr, foulDr: dr + 1 }, approval: ["Order"],
        clean: { text: "The men fight the canvas for hours, and she comes through with nothing worse than a wet hold.", fx: [{ prov: -1 }] },
        partial: { text: "She comes through, but not without a beating.", fx: [{ prov: -1 }, { hullOrMorale: true }] },
        setback: { text: "By the time the wind drops, you're still counting what it cost.", fx: [{ prov: -1 }, { stormTable: true }] } },
      { label: "Run before the wind.", shows: { minAp: 2 }, check: { type: "Ride Out Storm", dr: dr + 1, foulDr: dr + 2 }, approval: ["Risk", "Glory"],
        clean: { text: "She flies before it, and you reach land well ahead of schedule, a few planks the worse for wear.", fx: [{ apRefund: 1 }, { hullPct: -0.05 }, { prov: -1 }] },
        partial: { text: "You make good time, but she groans the whole way.", fx: [{ apRefund: 1 }, { hullPct: -0.10 }, { prov: -1 }] },
        setback: { text: "The wind takes her where it likes, and it isn't kind about it.", fx: [{ prov: -1 }, { stormTable: true }] } },
      { label: "Drop sail and wait it out.", approval: ["Caution", "Retreat"],
        result: { text: "The storm batters you for two miserable days, the men soaked and cursing, until the sea finally lets you go.", fx: [{ prov: -2 }, { morale: -2 }] } },
    ];
  };

  var written = [
    // ---- Weather and sea ----
    { id: "ve_w01_noreaster", reg: "VE-W01", name: "Nor'easter", group: "S", cat: "weather", storm: true,
      setup: "The sky to the northeast goes the color of a bruise. By the second watch the wind is screaming through the rigging and seawater is pouring over the bow. [Quartermaster] has to shout to be heard.\n\n\"She's a nor'easter, Captain! What'll it be?\"",
      variants: [{ when: { firstStorm: true }, text: "[Mentor]: \"Hold fast and keep her steady. It'll pass soon enough.\"" }, { when: { voice: "Old Salt" }, text: "[Officer:Old Salt] spits over the rail. 'Seen worse. Once.'" }],
      choices: STORM_CHOICES(2) },
    { id: "ve_w03_squall", reg: "VE-W03", name: "Summer Squall", group: "S", cat: "weather", storm: true,
      setup: "The afternoon is hot and still until it isn't. A black wall of cloud walks across the water toward you, dragging a curtain of rain behind it. The first gust hits her so hard the cook's pots go flying.",
      variants: [{ when: { firstStorm: true }, text: "[Mentor]: \"Hold fast and keep her steady. It'll pass soon enough.\"" }],
      choices: STORM_CHOICES(1) },
    { id: "ve_w05_becalmed", reg: "VE-W05", name: "Becalmed", group: "S", cat: "weather", weight: 10, cooldown: 4, when: { seasons: ["Summer"], outlookMult: { Fair: 2 } },
      setup: "The wind dies at dawn and doesn't come back. The sails hang like laundry. By noon the tar is bubbling between the deck planks and the men are lying in whatever shade they can find. Someone starts whistling for a wind, which is bad luck, and the crew is quick to shut him up.",
      choices: [
        { label: "Put the men on the oars.", shows: { sweeps: true }, check: { type: "Rally Crew", dr: 1 }, approval: ["Order"],
          clean: { text: "The men row in time to a rude song about the governor, and you lose barely a day.", fx: [] },
          partial: { text: "You make headway, but the men are sore and sour about it.", fx: [{ morale: -2 }] },
          setback: { text: "Arms give out long before the wind comes back.", fx: [{ morale: -4 }, { prov: -1 }] } },
        { label: "Tow her with the boats.", check: { type: "Small Boat Handling", dr: 2 }, approval: ["Risk"],
          clean: { text: "The boats drag her into a breath of wind by evening.", fx: [{ morale: -1 }] },
          partial: { text: "It works, slowly.", fx: [{ prov: -0.5 }] },
          setback: { text: "The towline snaps twice, and the boat crews come back blistered and furious.", fx: [{ prov: -1 }, { morale: -3 }] } },
        { label: "Wait for the wind.", approval: ["Caution"], result: { text: "Three days of glassy sea and short tempers.", fx: [{ prov: -1 }, { morale: -2 }] } },
        { label: "Break out the rum. Might as well enjoy it.", shows: { storesUnopened: true }, approval: ["Revelry"],
          result: { text: "If you're going to sit still, you may as well sit still drunk. The men agree heartily.", fx: [{ prov: -1 }, { openStores: true }] } },
      ] },
    { id: "ve_w07_gulf_stream", reg: "VE-W07", name: "The Gulf Stream Runs Fast", group: "S", cat: "weather", weight: 8, cooldown: 4, when: { northbound: true, outlooks: ["Fair", "Unsettled"], officerMult: { Navigator: 2 } },
      setup: "[Officer:Navigator] taps the chart. \"Stream's running hard this week, Captain. Get her out into the blue water and she'll carry us like a gift from God. Miss it, and we'll waste a day looking for it.\"",
      choices: [
        { label: "Find the Stream.", check: { type: "Navigate", dr: 2 }, approval: ["Risk"],
          clean: { text: "The water turns a deep, warm blue, and the [Ship Name] tears across the sea.", fx: [{ prov: 1 }] },
          partial: { text: "You catch the edge of it.", fx: [{ prov: 0.5 }] },
          setback: { text: "You find nothing but contrary currents and a lot of open sea.", fx: [{ prov: -0.5 }] } },
        { label: "Keep to the coast. No sense gambling.", approval: ["Caution"], result: { text: "You hold your course along the coast, slow and steady.", fx: [] } },
      ] },
    { id: "ve_w11_man_overboard", reg: "VE-W11", name: "Man Overboard", group: "S", cat: "weather", weight: 8, cooldown: 4, when: { outlookMult: { Unsettled: 1.5, Foul: 2 } },
      setup: "A wave comes out of nowhere, taller than the mainmast, and breaks across the deck. When the water drains away, one of the newer hands is gone. Then someone shouts and points: there he is, thrashing in the wake, already falling behind.",
      choices: [
        { label: "Throw him a line!", check: { type: "Strike First", dr: 2 }, approval: ["Mercy"],
          clean: { text: "The line lands across his arms, and the men haul him in like a prize marlin.", fx: [{ morale: 2 }] },
          partial: { text: "You get him aboard, half-drowned and cut up by the barnacles on the hull.", fx: [{ wounded: 1 }] },
          setback: { text: "The line falls short. Then he's gone.", fx: [{ crewLost: 1 }, { morale: -3 }] } },
        { label: "Bring her about and lower a boat.", check: { type: "Small Boat Handling", dr: 3 }, approval: ["Mercy", "Risk"],
          clean: { text: "The boat reaches him just as he goes under, and comes back with him grinning and spitting seawater.", fx: [{ morale: 3 }] },
          partial: { text: "You save him, but lose half a day doing it.", fx: [{ prov: -0.5 }] },
          setback: { text: "The boat nearly swamps. You lose him, and very nearly the boat crew.", fx: [{ crewLost: 1 }, { wounded: 1 }, { morale: -3 }] } },
        { label: "Dive in after him yourself.", check: { type: "Dive", dr: 3 }, approval: ["Glory", "Mercy"],
          clean: { text: "You come up with a fistful of his collar, and the whole ship cheers you back aboard.", fx: [{ morale: 5 }] },
          partial: { text: "You get him, but swallow half the sea doing it.", fx: [{ morale: 3 }, { tag: "Waterlogged" }] },
          setback: { text: "They pull you out alone, choking.", fx: [{ crewLost: 1 }, { morale: -2 }, { captainWounded: true }] } },
        { label: "He's gone. Hold your course.", approval: ["Caution"], result: { text: "The men watch the wake for a long time after he disappears. Nobody says anything to you.", fx: [{ crewLost: 1 }, { morale: -5 }] } },
      ] },

    // ---- Ships met at sea ----
    { id: "ve_s13_fishing_boat", reg: "VE-S13", name: "The Fishing Boat", group: "S", cat: "ships", weight: 8, cooldown: 4, when: { maxAp: 1, seasons: ["Spring", "Summer", "Winter"] },
      setup: "A fishing boat is working the shallows off your bow. Her two-man crew are hauling nets and pretending very hard not to have noticed you.",
      choices: [
        { label: "Buy some of their catch.", cost: { purse: 20 }, check: { type: "Haggle", dr: 1 }, approval: ["Honor"],
          clean: { text: "A fair price for good fish.", fx: [{ prov: 1 }] },
          partial: { text: "They drive a hard bargain.", fx: [{ prov: 0.5 }] },
          setback: { text: "They sell you the bottom of the barrel.", fx: [{ prov: 0.25 }] } },
        { label: "Pay them for news.", cost: { purse: 10 }, check: { type: "Gather Intelligence", dr: 1 }, approval: ["Generosity"],
          clean: { text: "Fishermen see everything.", fx: [{ rumor: "B" }] },
          partial: { text: "Mostly gossip, but some of it's useful.", fx: [{ rumor: "C" }] },
          setback: { text: "They know nothing, or say they don't.", fx: [] } },
        { label: "Take the catch. Take the nets too.", check: { type: "Intimidate", dr: 0 }, approval: ["Cruelty", "Plunder"],
          clean: { text: "They hand it all over without a word.", fx: [{ prov: 1 }, { dread: 3 }, { heatZone: 5 }] },
          partial: { text: "They hand it over, cursing your name, which they'll be sure to repeat in port.", fx: [{ prov: 1 }, { heatZone: 5 }, { rumor: "Reputation" }] },
          setback: { text: "They cut their nets and run for the shallows.", fx: [{ heatZone: 5 }] } },
        { label: "Leave them be.", approval: ["Mercy"], result: { text: "The older one raises a hand as you pass. You return it.", fx: [] } },
      ] },

    // ---- Crew, morale and the Articles ----
    { id: "ve_c01_grumbling", reg: "VE-C01", name: "Talk at the Mess Tables", group: "S", cat: "crew", weight: 6, cooldown: 2, grumbling: true,
      setup: "There's talk below about the shares again. It dies the moment you come down the ladder, which tells you everything.",
      setupGotAway: "Ever since the [Ship Name] slipped away, there's been talk at the mess tables. Not loud. Not yet. One of the hands finally says what the rest are thinking: \"We had her, Captain. We had her, and we let her go.\"",
      choices: [
        { label: "Remind them of the last fat share.", check: { type: "Rally Crew", dr: 2 }, approval: ["Glory"],
          clean: { text: "By the end, they're banging their cups on the table.", fx: [] },
          partial: { text: "They quiet down. They don't cheer.", fx: [{ morale: -3, low: -2 }] },
          setback: { text: "Somebody laughs at the wrong moment, and it spreads.", fx: [{ morale: -6, lowPressure: 1 }] } },
        { label: "Promise them you'll capture a prize soon.", check: { type: "Leadership", dr: 1 }, approval: ["Honor"],
          clean: { text: "They take you at your word.", fx: [{ flag: "promise_next_prize" }] },
          partial: { text: "They'll believe it when they see it.", fx: [{ morale: -2 }, { flag: "promise_next_prize" }] },
          setback: { text: "\"Heard that before,\" someone mutters.", fx: [{ morale: -4, lowPressure: 1 }] } },
        { label: "Find out who's stirring the pot.", shows: { low: true }, check: { type: "Read People", dr: 2 }, approval: ["Order", "Deceit"],
          clean: { text: "You know exactly whose voice it is. So does he, now.", fx: [{ pressure: -1 }, { reveal: "full" }] },
          partial: { text: "You've only got a rough guess.", fx: [{ reveal: "level" }] },
          setback: { text: "Your questions only feed the talk.", fx: [{ pressure: 1 }] } },
        { label: "Let them grumble. Sailors always do.", approval: ["Caution"], result: { text: "It doesn't stop.", fx: [{ morale: -5, lowPressure: 1 }] } },
      ] },
    { id: "ve_c05_fight_below", reg: "VE-C05", name: "Fight Below Decks", group: "S", cat: "crew", weight: 10, cooldown: 4, when: { pressureMult: 1.5, voiceMult: { Prankster: 1.5, Proud: 1.5 } },
      setup: "A crash below decks, then a roar of voices. You find two hands rolling across the gun deck in a puddle of spilled rum, with a ring of men cheering them on and coins changing hands. It's about a woman in [Node]. Or a goat. The accounts differ.",
      choices: [
        { label: "Wade in and break it up.", check: { type: "Brawling", dr: 2 }, approval: ["Order"],
          clean: { text: "Two cracked heads later, it's over, and nobody argues with you.", fx: [{ morale: 2 }] },
          partial: { text: "It's over, but one of them won't be hauling a line for a week.", fx: [{ wounded: 1 }] },
          setback: { text: "You end up on your back in the rum. The fight stops so both men can help you up.", fx: [{ morale: -2 }] } },
        { label: "QUARRELS", labelBy: { captains_judgment: "You'll judge this yourself, by the Articles.", settled_ashore: "They can settle it ashore, as the Articles say.", no_blood: "No blood among brothers. Shake hands." },
          check: { type: "Pirate Code", dr: 1 }, approval: ["Order", "Honor"],
          clean: { text: "Grudging nods all round. The Articles are the Articles.", fx: [{ morale: 1 }] },
          partial: { text: "They stop, but one of them is still muttering about the goat.", fx: [{ morale: -1 }] },
          setback: { text: "Both sides think you've ruled for the other.", fx: [{ morale: -3 }] } },
        { label: "Let them finish it.", approval: ["Revelry"], result: { text: "The big one wins. Everyone else seems to have had a lovely time.", fx: [{ morale: 2 }, { wounded: 1 }] } },
        { label: "Put five on the big one.", cost: { purse: 20 }, check: { type: "Read People", dr: 2 }, approval: ["Risk"],
          clean: { text: "You picked right, and the men like a captain who gambles.", fx: [{ purse: 40 }, { morale: 3 }] },
          partial: { text: "You win, but the loser's mates don't like it.", fx: [{ purse: 40 }, { morale: -1 }] },
          setback: { text: "The small one has a head like an anvil.", fx: [{ morale: 1 }] } },
      ] },
    { id: "ve_c08_asleep_on_watch", reg: "VE-C08", name: "Asleep on Watch", group: "S", cat: "crew", weight: 8, cooldown: 4, when: { voiceMult: { Sot: 1.5 } },
      setup: "In the dead of night you find the lookout wedged in the crosstrees and snoring, an empty bottle tucked into his shirt like a baby. The ship has been sailing blind for an hour.",
      choices: [
        { label: "A light punishment. Six lashes.", approval: ["Mercy", "Order"], result: { text: "He takes his six and thanks you for them. A few of the older hands mutter that he got off easy.", fx: [{ morale: -1 }] } },
        { label: "The standard punishment. Twelve lashes.", breachIf: "lenient", check: { type: "Discipline", dr: 1 }, approval: ["Order"],
          clean: { text: "The men watch in silence. The point is taken.", fx: [{ morale: -2 }] },
          partial: { text: "The point is taken, but some think you went too far.", fx: [{ morale: -4 }] },
          setback: { text: "Too far, by half the crew's reckoning.", fx: [{ morale: -4 }, { pressure: 1 }] } },
        { label: "He could have killed us all. Fifty lashes.", breachIf: "lenient", approval: ["Cruelty"],
          result: { text: "He pleads desperately as you tie him to the rigging, but his pleas fall on deaf ears. He passes out after thirty lashes. You wait for him to come round before giving him the other twenty. The crew watch in complete silence.", fx: [{ dread: 3 }, { morale: -6 }, { wounded: 1 }] } },
        { label: "Climb the rigging and wake him with a bucket of seawater.", approval: ["Revelry"], result: { text: "He comes awake shrieking and nearly falls out of the crosstrees. The whole crew is in stitches.", fx: [{ morale: 3 }] } },
      ] },
    { id: "ve_c09_shanty", reg: "VE-C09", name: "Give Us a Song", group: "S", cat: "crew", weight: 8, cooldown: 4, when: { minBand: "Steady" },
      setup: "The men are hauling up the mainsail in sullen silence. One of the hands calls out from the line: \"Give us a song, Captain! Something to pull to!\" A few of the others laugh. They don't think you'll do it.",
      choices: [
        { label: "Lead them in a shanty.", check: { type: "Rally Crew", dr: 1 }, approval: ["Revelry"],
          clean: { text: "By the second verse the whole ship is roaring it.", fx: [{ morale: 4 }] },
          partial: { text: "You're badly off-key, and they love you for it.", fx: [{ morale: 2 }] },
          setback: { text: "You forget the second verse. And then the third. Someone hums it every time you walk past for the rest of the voyage.", fx: [{ morale: -1 }] } },
        { label: "Let [Officer:Shanty-Singer] lead it.", approval: ["Generosity"], result: { text: "He has a voice like a foghorn, and the men pull like oxen.", fx: [{ morale: 2, shantySinger: 4 }] } },
        { label: "Save your breath for hauling.", approval: ["Order"], result: { text: "They haul. Quietly.", fx: [{ morale: -2 }] } },
        { label: "Fetch your fiddle.", shows: { tag: "Fiddler" }, approval: ["Revelry"], result: { text: "The mainsail goes up in record time, and half the watch below comes up to dance.", fx: [{ morale: 5 }] } },
      ] },

    // ---- Health and provisions ----
    { id: "ve_h01_bread_room", reg: "VE-H01", name: "Water in the Bread Room", group: "S", cat: "health", weight: 8, cooldown: 4, when: { outlookMult: { Unsettled: 1.5, Foul: 1.5 }, lowHullMult: 2 },
      setup: "[Officer:Carpenter] comes up from the hold wet to the knees. \"Seam's opened under the bread room, Captain. Half of it's soup.\" Below, the smell of wet biscuit and spoiled salt pork would turn a strong stomach.",
      choices: [
        { label: "Salvage what you can.", check: { type: "Ration Stores", dr: 2 }, approval: ["Order"],
          clean: { text: "You save most of it, laid out to dry on every flat surface aboard.", fx: [{ provPct: -0.15 }] },
          partial: { text: "You save some.", fx: [{ provPct: -0.25 }] },
          setback: { text: "What you save goes green by morning.", fx: [{ provPct: -0.35 }, { morale: -2 }] } },
        { label: "Serve it anyway. Waste not.", approval: ["Plunder"], result: { text: "The men eat it. Then the men regret it.", fx: [{ provPct: -0.10 }, { morale: -4 }] } },
        { label: "Over the side with all of it.", approval: ["Caution"], result: { text: "Better hungry than poisoned.", fx: [{ provPct: -0.30 }, { morale: -1 }] } },
      ] },
    { id: "ve_h06_mackerel", reg: "VE-H06", name: "The Shoal of Mackerel", group: "S", cat: "health", weight: 8, cooldown: 4, when: { seasons: ["Spring", "Summer"] },
      setup: "The sea around the ship is suddenly boiling with silver: a shoal of mackerel, so thick the men are pulling them up in buckets. [Officer:warm or neutral] holds up a fish in each fist, grinning like he's just taken a Spanish galleon.",
      choices: [
        { label: "All hands fishing! We'll eat well tonight.", approval: ["Revelry"], result: { text: "Fried fish for every man aboard, and singing after.", fx: [{ prov: 0.5, fisherman: true }, { morale: 2 }] } },
        { label: "Fish, gut and salt it down.", check: { type: "Ration Stores", dr: 1 }, approval: ["Order"],
          clean: { text: "Barrel after barrel, salted and stowed.", fx: [{ prov: 1, fisherman: true }] },
          partial: { text: "You put up a fair amount before the shoal moves on.", fx: [{ prov: 0.5, fisherman: true }] },
          setback: { text: "Not enough salt. By morning the whole lot stinks.", fx: [{ morale: -1 }] } },
        { label: "No time. Keep sailing.", approval: ["Caution"], result: { text: "The men watch a free dinner swim away.", fx: [{ morale: -1 }] } },
      ] },

    // ---- Ship trouble ----
    { id: "ve_t03_loose_cannon", reg: "VE-T03", name: "Loose Cannon", group: "S", cat: "ship", weight: 6, cooldown: 4, when: { conditionMult: { Rough: 2, Foul: 2 } },
      setup: "The ship rolls hard to starboard and something below goes CRACK. A gun has torn loose from its ropes and is careening across the gun deck like a drunk bull: half a ton of iron, looking for a leg to break.",
      choices: [
        { label: "Jam a hammock under its wheels!", check: { type: "Strike First", dr: 2 }, approval: ["Risk", "Glory"],
          clean: { text: "The gun bucks once and stops dead. The men stare at you.", fx: [{ morale: 2 }] },
          partial: { text: "You stop it, but not before it catches a man's foot.", fx: [{ wounded: 1 }] },
          setback: { text: "It throws you aside and goes straight out through a gunport.", fx: [{ captainWounded: true }, { guns: -1 }, { hullPct: -0.05 }] } },
        { label: "Order the gun crew to rope her.", check: { type: "Leadership", dr: 2, gunnerDr: 1 }, approval: ["Order"],
          clean: { text: "Four lines, one heave, and she's tied up like a hog.", fx: [] },
          partial: { text: "She's caught, with one man's ribs the worse for it.", fx: [{ wounded: 1 }] },
          setback: { text: "She breaks two men and her own carriage before she stops.", fx: [{ wounded: 2 }, { guns: -1 }] } },
        { label: "Everyone clear! Let her roll.", approval: ["Caution"], result: { text: "She crashes through the gun deck before being stopped in her tracks by the mainmast.", fx: [{ hullPct: -0.05 }] } },
      ] },

    // ---- Discovery and flotsam ----
    { id: "ve_d02_bottle", reg: "VE-D02", name: "Message in a Bottle", group: "S", cat: "discovery", weight: 6, cooldown: 4, bottle: true,
      setup: "[Officer:warm] fishes a green bottle out of the sea with a boathook and presents it to you with great ceremony. There's a paper rolled up inside.",
      choices: [
        { label: "Read it aloud to the crew.", approval: ["Revelry"], bottle: "aloud" },
        { label: "Read it alone in your cabin.", approval: ["Caution"], bottle: "alone" },
        { label: "Throw it back. Dead men's letters are bad luck.", approval: ["Faith"], result: { text: "[Officer:warm] looks crushed. A few of the older hands nod approvingly.", fx: [] } },
      ],
      results: {
        wreck: { text: "\"...and if anyone finds this, the [Wreck Ship] went down at Lilyhook's Graveyard with her hold full.\"", fx: [{ flag: "bottle_wreck_double" }, { rumorLine: "PLACEHOLDER: A wreck at Lilyhook's Graveyard, her hold still full. The next dive there pays double." }] },
        love: { text: "A love letter, very badly spelled.", aloud: [{ morale: 2 }] },
        fool: { text: "\"IF YOU ARE READING THIS YOU ARE A BLOODY FOOL.\"", aloud: [{ morale: 2 }] },
        map: { check: { type: "Decipher & Research", dr: 2 }, text: "A treasure map.",
          clean: { text: "It's a fake, but a beautiful one. It might fetch something from a collector.", fx: [{ item: "Forged Treasure Map" }] },
          partial: { text: "It's a fake. Into the fire.", fx: [] },
          setback: { text: "You're sure it's real.", fx: [{ flag: "fake_map" }] } },
        plea: { text: "\"Help us. We are held on an island south of here.\" A plea, years old.", fx: [{ flag: "bottle_plea" }] },
      } },
    { id: "ve_d06_rum", reg: "VE-D06", name: "Rum on the Water", group: "S", cat: "discovery", weight: 5, cooldown: 4, when: { afterHurricaneMult: 2 },
      setup: "Barrels in the water: a dozen of them, bobbing off the bow in a line like ducklings. The nearest has a distiller's brand burned into the head. Rum. Somebody's very bad day is about to become your crew's very good one.",
      choices: [
        { label: "Get the boats out and haul them in.", check: { type: "Small Boat Handling", dr: 1 }, approval: ["Plunder"],
          clean: { text: "Every one of them, dry and sound.", fx: [{ good: "Kill-devil rum", n: 10 }] },
          partial: { text: "You catch most before the sea scatters them.", fx: [{ good: "Kill-devil rum", n: 5 }] },
          setback: { text: "The boat crew broach the first barrel before they're back alongside, and the rest drift off while they sing.", fx: [{ morale: 1 }] } },
        { label: "Broach one right here.", approval: ["Revelry"], result: { text: "An impromptu party on the open sea. You lose the rest to the current, and nobody cares.", fx: [{ morale: 4 }] } },
        { label: "Leave them. Could be a trap.", approval: ["Caution"], result: { text: "The men watch them bob away with real grief.", fx: [{ morale: -2 }] } },
      ] },
  ];

  // ---- The Hurricane at Sea (VE-W02): approved, unwritten. Its mechanics
  // are §44.7's (foundering); its words are PLACEHOLDERS (PH11).
  var hurricane = { id: "ve_w02_hurricane", reg: "VE-W02", name: "Hurricane at Sea", group: "M", cat: "weather", storm: true, hurricane: true, status: "approved",
    setup: "PLACEHOLDER (VE-W02, the author's Major event): The sky turns green, then black. By nightfall the sea is a mountain range, and every man aboard knows this is no ordinary storm.",
    choices: [
      { label: "PLACEHOLDER: Take in sail and ride it out.", check: { type: "Ride Out Storm", dr: 3, foulDr: 4 }, approval: ["Order"], founder: true,
        clean: { text: "PLACEHOLDER: She comes through it, battered and half-drowned.", fx: [{ prov: -1 }] },
        partial: { text: "PLACEHOLDER: She comes through, but the sea takes its toll.", fx: [{ prov: -1 }, { hullOrMorale: true }] },
        setback: { text: "PLACEHOLDER: A sea stoves in her side. She's breaking up.", fx: [{ prov: -1 }, { breakingUp: true }] } },
      { label: "PLACEHOLDER: Run before it.", shows: { minAp: 2 }, check: { type: "Ride Out Storm", dr: 4, foulDr: 5 }, approval: ["Risk", "Glory"], founder: true,
        clean: { text: "PLACEHOLDER: She flies before the hurricane and outruns the worst of it.", fx: [{ apRefund: 1 }, { hullPct: -0.05 }, { prov: -1 }] },
        partial: { text: "PLACEHOLDER: You outrun it, but she groans the whole way.", fx: [{ apRefund: 1 }, { hullPct: -0.10 }, { prov: -1 }] },
        setback: { text: "PLACEHOLDER: The hurricane catches her. She's breaking up.", fx: [{ prov: -1 }, { breakingUp: true }] } },
    ] };
  var BU = function (label, type, appr) {
    return { label: label, check: { type: type, dr: 3, smallShip: 1 }, approval: appr, founderSecond: true,
      clean: { text: "PLACEHOLDER: She holds together. By dawn the wind has dropped, and she's still afloat.", fx: [{ hullPct: -0.10 }] },
      partial: { text: "PLACEHOLDER: She holds, just. Half the crew are at the pumps until land is sighted.", fx: [{ hullPct: -0.20 }, { morale: -5 }] },
      setback: { text: "PLACEHOLDER: The last of her strength gives out.", fx: [] } };
  };
  var breakingUp = { id: "ve_w02_breaking", name: "She's Breaking Up", group: "M", cat: "weather", status: "approved",
    setup: "PLACEHOLDER (VE-W02): Timbers scream below decks. Water is coming in faster than the pumps can throw it out. She's breaking up.",
    choices: [
      BU("PLACEHOLDER: Hold her together.", "Ride Out Storm", ["Order"]),
      BU("PLACEHOLDER: Shore her up from below.", "Repair & Refit", ["Caution"]),
      BU("PLACEHOLDER: Keep the men at the pumps.", "Leadership", ["Order"]),
    ] };

  // ---- Ships met at sea: the encounter's card (§44.4); the battle is the hunt's.
  var encounters = {
    hunter: { reg: "VE-S02", name: "Pirate Hunter Closing", text: "PLACEHOLDER (VE-S02): A pirate hunter closes in on you, flying her colors and running out her guns." },
    ship: { reg: "VE-S01", name: "Sail on the Horizon", text: "PLACEHOLDER (VE-S01): The lookout calls a sail on the horizon. Engage, or let her pass." },
    pirate: { reg: "VE-S01", name: "Sail on the Horizon", text: "PLACEHOLDER (VE-S01): A pirate! She's seen you, and she doesn't like the odds for you." },
  };

  // ---- The registry: every approved event not written yet (§44.12). ----
  var approved = [
    ph("ve_w04", "Fog Bank", "S", "weather", 8, { seasons: ["Spring"], zone: "north", outlooks: ["Unsettled"] }, "Thick fog closes in. Keep watch, slow down or push on; something may be out there."),
    ph("ve_w06", "Waterspout", "S", "weather", 5, { seasons: ["Summer", "Hurricane"], zone: "south" }, "A waterspout bears down on the ship. Outrun it or brace for the hit."),
    ph("ve_w08", "Diamond Shoals in Poor Light", "S", "weather", 6, { zone: "north" }, "Shoals ahead in failing light. Pick a way through or stand off and lose time."),
    ph("ve_w09", "Lightning in the Rigging", "S", "weather", 5, { outlooks: ["Unsettled", "Foul"] }, "Lightning strikes the mast and fire breaks out aloft. Fight it, cut it away, or pray."),
    ph("ve_w12", "Winter Cold Snap", "S", "weather", 8, { zone: "north", seasons: ["Winter"] }, "Bitter cold at sea. Open the stores, keep the men moving, or let them suffer through it."),
    ph("ve_w13", "The Christmas Winds", "S", "weather", 6, { zone: "south", seasons: ["Winter"], outlooks: ["Fair"] }, "The steady winter trades blow warm and fair. A good passage lifts spirits and saves time."),
    ph("ve_s03", "Navy Ship Bears Down", "S", "ships", 6, { minHeat: 50 }, "A navy warship turns toward you. Fight, flee, or run into a squall."),
    ph("ve_s04", "The Named Hunter", "M", "ships", 0, {}, "A famous hunter has come for you by name."),
    ph("ve_s05", "The Sicilians Come Looking", "M", "ships", 0, {}, "Sicilian ships hunt the captain who took one of theirs."),
    ph("ve_s07", "Frisian Sweep", "S", "ships", 4, { zone: "south" }, "A Frisian squadron sweeping its waters. Show your papers, bluff, hide or run."),
    ph("ve_s08", "A Fellow Pirate Hails", "S", "ships", 6, {}, "A pirate ship hails you. Trade news, trade goods, or watch your back."),
    ph("ve_s09", "Wolf Pack", "S", "ships", 0, {}, "Several pirate sloops shadow you, after your cargo. They'll attack if they like the odds."),
    ph("ve_s10", "False Colors", "S", "ships", 3, {}, "A friendly-looking ship that isn't. Spot the trick before she's alongside."),
    ph("ve_s11", "Merchant in Distress", "S", "ships", 6, {}, "A crippled merchant signals for help. Rescue her, rob her, or sail on."),
    ph("ve_s12", "Captives on Another Ship", "M", "ships", 3, {}, "Another ship carries captives. What you do about it is up to you."),
    ph("ve_s14", "The Swedish Blockade Runner", "M", "ships", 4, {}, "A Swedish runner slipping guns through. Help her, ignore her, or sell her out."),
    ph("ve_s15", "Dettman's Straggler", "M", "ships", 4, { maxYear: 1755 }, "One of Dettman's French pirates, limping home alone."),
    ph("ve_s16", "Jack's Colors", "M", "ships", 0, {}, "Amber Jack's colors on the horizon."),
    ph("ve_s18", "The Rich Man's Yacht", "M", "ships", 3, {}, "A wealthy passenger's vessel. Ransom, charm or let pass."),
    ph("ve_s19", "The Frisian Treasure Fleet", "M", "ships", 1, { zone: "south" }, "The Frisian treasure fleet passes, far too strong to touch."),
    ph("ve_s20", "Someone Flying Your Name", "M", "ships", 0, {}, "Someone is raiding under your name."),
    ph("ve_s21", "The French Treasure Fleet", "M", "ships", 1, { zone: "south" }, "The French treasure fleet passes, far too strong to touch."),
    ph("ve_c02", "A Hand Breaks an Article", "S", "crew", 6, {}, "A hand is caught breaking one of the Articles. Punish him by the book, go easy, or look away."),
    ph("ve_c03", "The Crew Presses to Amend", "S", "crew", 5, { greedAtLeast: 2 }, "The crew wants the Articles changed in their favor. Give ground or hold firm."),
    ph("ve_c04", "Dicing for Shares", "S", "crew", 6, {}, "The hands are gambling their shares below decks. Join in, stop it, or let it run."),
    ph("ve_c06", "A Thief in the Forecastle", "M", "crew", 6, {}, "Something's been stolen from a hand's sea chest. Find the thief and decide his fate."),
    ph("ve_c07", "The Stowaway", "M", "crew", 4, {}, "A stowaway turns up in the hold. Who is he, and what do you do with him?"),
    ph("ve_c11", "A Man Wants His Share Now", "S", "crew", 5, {}, "A hand demands his share early. Pay, refuse, or settle it by the Articles."),
    ph("ve_c12", "Fall from the Rigging", "S", "crew", 6, { outlooks: ["Unsettled", "Foul"] }, "A hand falls from aloft. Treat him, and decide what the ship can spare."),
    ph("ve_c13", "Burial at Sea", "S", "crew", 0, {}, "The dead are buried at sea. Say a few words, or get it done."),
    ph("ve_c15", "Green Hands, Green Faces", "S", "crew", 6, { greenCrew: true }, "The new hands are seasick and useless. Drill them, coddle them, or leave them to it."),
    ph("ve_c16", "A Bad Omen", "S", "crew", 5, { voice: "Superstitious" }, "The crew sees a bad omen. Reassure them, mock it, or take it seriously."),
    ph("ve_c17", "The Captain's Fine Coat", "M", "crew", 0, {}, "The crew has opinions about the captain's expensive new clothes."),
    ph("ve_c18", "Crossing the Line", "S", "crew", 3, { once: true }, "An old sailors' ceremony for the new hands. Join the fun or put a stop to it."),
    ph("ve_h02", "Rats", "S", "health", 6, {}, "Rats have got into the stores. Hunt them down or cut your losses."),
    ph("ve_h03", "Scurvy Signs", "S", "health", 0, {}, "Bleeding gums and loose teeth among the crew. Find fresh food or push on."),
    ph("ve_h05", "Foul Water", "S", "health", 5, { seasons: ["Summer"] }, "The water casks have gone bad. Ration, detour for fresh water, or drink it anyway."),
    ph("ve_h07", "Bad Rum", "S", "health", 4, { storesOpened: true }, "A bad barrel of rum makes the men sick. Strong stomachs only."),
    ph("ve_h08", "Turtle Island", "M", "health", 3, { zone: "south" }, "An island of sea turtles: fresh meat, if you'll spend the time."),
    ph("ve_t01", "A Sprung Plank", "S", "ship", 6, { lowHullMult: 2 }, "A plank springs and the ship takes on water. Patch it, pump, or make for port."),
    ph("ve_t02", "Fouled Bottom", "S", "ship", 5, {}, "Weed and barnacles slow the ship. Scrape what you can, or live with it until port."),
    ph("ve_t04", "Fire in the Galley", "S", "ship", 5, {}, "Fire in the galley. Put it out fast before it reaches the powder."),
    ph("ve_t05", "Damp Powder", "S", "ship", 5, { outlooks: ["Unsettled", "Foul"] }, "Seawater has got into the powder. Dry it, or fight the next battle with what's left."),
    ph("ve_t06", "The Prize Crew Signals Distress", "S", "ship", 6, { prizeShips: true }, "One of your prize ships is in trouble. Help her or leave her."),
    ph("ve_t07", "The Prize Crew Wants Her", "M", "ship", 3, { prizeShips: true }, "Your prize crew wants to keep the ship for themselves."),
    ph("ve_t08", "Hard Aground", "S", "ship", 5, { zone: "north" }, "The ship runs aground on a sandbar. Haul her off or lighten her."),
    ph("ve_d01", "The Castaway", "M", "discovery", 0, {}, "A castaway on a spit of sand. Who is he, and what does he know?"),
    ph("ve_d03", "Floating Wreckage", "S", "discovery", 6, {}, "Wreckage in the water. Salvage what you can; sometimes there's a survivor."),
    ph("ve_d04", "A Longboat of Survivors", "S", "discovery", 4, {}, "Survivors adrift in a ship's boat. Whose men are they, and what's it worth to save them?"),
    ph("ve_d05", "The Empty Ship", "M", "discovery", 3, {}, "A ship adrift with no one aboard, and no sign of why."),
    ph("ve_d07", "An Uncharted Cay", "S", "discovery", 4, { zone: "south" }, "A small island on no chart. Explore it, chart it, or leave it alone."),
    ph("ve_d08", "The Drowned Man's Letter", "M", "discovery", 0, {}, "A drowned man with a letter in his coat."),
    ph("ve_d09", "Canoes off the Coast", "M", "discovery", 0, {}, "Native canoes come out to meet the ship."),
    ph("ve_u01", "Ghost Ship", "M", "uncanny", 2, { conditionMult: { Fog: 3 } }, "A silent ship drifts out of the fog."),
    ph("ve_u04", "The Whale Carcass", "M", "uncanny", 1, {}, "A dead whale with an enormous bite taken out of it."),
    ph("ve_u05", "Something Came Aboard", "M", "uncanny", 1, {}, "Something came aboard in the night."),
    ph("ve_u06", "Serpent in the Wake", "M", "uncanny", 1, {}, "Something long and dark keeps pace with the ship."),
    ph("ve_u07", "Serpent Across the Bow", "M", "uncanny", 1, {}, "A serpent crosses the bow in the fog."),
    ph("ve_u09", "The Singing", "M", "uncanny", 1, { zone: "south" }, "Singing on the water at night. A hand goes to the rail."),
    ph("ve_u10", "The Arm on the Rail", "M", "uncanny", 1, {}, "A huge arm slides over the rail in the dark."),
    ph("ve_u11", "Lights Under the Water", "M", "uncanny", 3, {}, "Lights glow beneath the sea, and nobody can explain them."),
    ph("ve_u12", "Lilyhook's Yarn", "M", "uncanny", 3, { near: "ocracoke" }, "A crew yarn about Lilyhook on a dark night."),
    ph("ve_f01", "News from a Passing Ship", "S", "world", 8, {}, "A passing ship shares the latest news from Europe and the colonies."),
    ph("ve_f02", "Key's Buildup", "M", "world", 0, {}, "Signs that Admiral Key is gathering ships."),
    ph("ve_f03", "French Sails off Florida", "M", "world", 0, {}, "French sails where they shouldn't be."),
    ph("ve_f04", "After the Battle", "M", "world", 0, {}, "The wreckage and survivors of a great battle."),
    ph("ve_f05", "A Friend Under the Same Letter", "S", "world", 0, {}, "A privateer under the same letter hails you as a friend."),
    ph("ve_f06", "The Rendezvous", "M", "world", 0, {}, "A smugglers' meeting at sea that isn't going to plan."),
  ];

  // ---- Officer events (§25.15; the §25 appendix). Each fires only when
  // its trigger is met (§44.4). The priority order (§44.12.9).
  // After an escape on the captain's own ship (3-35 of the build 0.9 pins):
  // a mandatory event before the ocean node. Two versions; the author
  // writes both (PLACEHOLDER lines until then).
  var afterEscape = [
    { id: "ve_escape_officer", reg: "VE-X01", name: "Away with a New Officer", mandatory: true,
      setup: "PLACEHOLDER: The harbor lights fall away astern. [Name], who shared your cell only hours ago, joins you at the rail.",
      choices: [
        { label: "PLACEHOLDER: Welcome [Name] aboard properly", result: { text: "PLACEHOLDER: [Name] grins and shakes your hand.", fx: [] } },
        { label: "PLACEHOLDER: Ask [Name] what landed them in that cell", result: { text: "PLACEHOLDER: [Name] tells you, and you listen.", fx: [] } },
      ] },
    { id: "ve_escape_crew", reg: "VE-X02", name: "Away with the Crew", mandatory: true,
      setup: "PLACEHOLDER: The harbor lights fall away astern. The crew gather on deck, waiting to hear from their captain.",
      choices: [
        { label: "PLACEHOLDER: Thank them for waiting", result: { text: "PLACEHOLDER: A cheer goes up from the deck.", fx: [] } },
        { label: "PLACEHOLDER: Tell them to make sail and keep quiet", result: { text: "PLACEHOLDER: The crew go to their work without a word.", fx: [] } },
      ] },
  ];

  var officerAtSea = [
    { id: "vo_vote", reg: "VE-O03", name: "The Vote", trigger: "vote",
      setup: "As the crew prepares to vote on a new Quartermaster, a few men glance your way, waiting to see if you'll weigh in.", vote: true },
    { id: "vo_qm_opinion", reg: "VE-O04", name: "The Quartermaster's Opinion", trigger: "qmOpinion",
      setup: "As the crew goes about its work, you're approached by [Quartermaster]. {qm.He} tells you that the crew is grumbling about your recent decision.",
      choices: [
        { label: "Gather the crew to explain your decision and take questions", check: { type: "Leadership", dr: 2 },
          clean: { text: "Your words seem to assuage the crew's concerns. [Quartermaster] thanks you for taking their concerns seriously.", fx: [{ morale: 5 }] },
          partial: { text: "You stumble over your words a bit, but the crew seems to understand.", fx: [{ morale: 2 }] },
          setback: { text: "Your defensive explanation doesn't seem to satisfy the crew. Instead, you hear them whispering.", fx: [{ morale: -2 }, { pressure: 1 }] } },
        { label: "Apologize directly to the Quartermaster", result: { text: "[Quartermaster] nods, grateful that you've heard him out.", fx: [{ points: 3, who: "qm" }, { morale: 2 }] } },
        { label: "Reply that you understand the crew's concerns, but your decision is final", result: { text: "[Quartermaster] nods curtly and walks away, unwilling to press the matter further.", fx: [] } },
        { label: "You're the captain of this ship, and it's none of their concern", result: { text: "[Quartermaster] seems taken aback, but doesn't say anything further before storming off.", fx: [{ rung: -1, who: "qm" }, { pressure: 1 }] } },
      ] },
    { id: "vo_fear_poverty", reg: "VE-O07", name: "Fear Trigger: Poverty", trigger: "fear", fear: "Poverty", needs: "provisionsOut",
      setup: "[Name] has been rummaging through the hold for hours, looking for any crumbs that the rats haven't gotten to yet. Now he sits against the hull, rocking back and forth, whispering the same words over and over: \"We won't starve, Mama. We won't starve, Mama.\"",
      choices: [
        { label: "Sit by his side and reassure him", result: { text: "[Name] buries his head in your shoulder and eventually calms down. \"Thank you, Captain.\"", fx: [{ rung: 1, who: "officer" }] } },
        { label: "Convince him you'll make it through", result: { text: "[Name] listens quietly and finally nods, wiping a tear from his eye. \"You're right, I'm sorry to be such a bother.\"", fx: [{ points: 3, who: "officer" }] } },
        { label: "Ignore him", result: { text: "The wailing continues for hours until [Name] finally falls asleep.", fx: [{ points: -2, who: "officer" }] } },
        { label: "Tell him to shut up", result: { text: "He quiets down, but continues rocking back and forth for hours.", fx: [{ rung: -1, who: "officer" }] } },
      ] },
    { id: "vo_fear_violence", reg: "VE-O07", name: "Fear Trigger: Violence & Death", trigger: "fear", fear: "Violence & Death", needs: "executed",
      setup: "After the corpses have been thrown overboard, [Name] storms up to you. \"That was needlessly cruel, Captain! I'm only alive because another captain spared my life in a moment just like that. I can't bear to watch you throw away lives like they're worthless.\"",
      choices: [
        { label: "Apologize and tell [Name] that it won't happen again.", result: { text: "[Name] seems satisfied with your promise. He will hold you to it.", fx: [{ rung: 1, who: "officer" }, { flag: "promised_no_executions" }] } },
        { label: "Apologize, but make no promises about future captured crews.", result: { text: "[Name] nods curtly. \"If you say so.\"", fx: [{ points: 2, who: "officer" }] } },
        { label: "Insist that what you did was necessary.", result: { text: "[Name] shoots you a skeptical look before walking away.", fx: [{ points: -2, who: "officer" }] } },
        { label: "Explain that their lives *were* worthless.", result: { text: "[Name] opens his mouth to protest, but thinks better of it when you give him a menacing look.", fx: [{ rung: -1, who: "officer" }] } },
      ] },
    { id: "vo_fear_disgrace", reg: "VE-O07", name: "Fear Trigger: Disgrace", trigger: "fear", fear: "Disgrace", needs: "standingLost",
      setup: "As you write in your logbook, [Name] throws open the door to your cabin. \"Captain, you've been dragging our name through the mud. You're turning some powerful people against us, and if this continues, I can't be a part of it. My family's name already lies in ruins thanks to my father - my name cannot meet the same fate.\"",
      choices: [
        { label: "Apologize and promise to take more care in the future.", result: { text: "[Name] seems satisfied, for now.", fx: [{ points: 3, who: "officer" }] } },
        { label: "Ask [Name] to trust you. It's all part of the plan.", check: { type: "Persuade", dr: 2 },
          clean: { text: "[Name] nods. \"Don't let me down, Captain.\"", fx: [{ points: 2, who: "officer" }] },
          partial: { text: "[Name] nods. \"Don't let me down, Captain.\"", fx: [{ points: 2, who: "officer" }] },
          setback: { text: "[Name] doesn't seem convinced. You hear him muttering as he walks away.", fx: [{ rung: -1, who: "officer" }] } },
        { label: "Remind [Name] that you're the Captain, and you make the decisions.", result: { text: "[Name] huffs but doesn't question your authority.", fx: [{ points: -3, who: "officer" }] } },
      ] },
    { id: "vo_drive_faith", reg: "VE-O06", name: "A Drive Comes Due: Faith", trigger: "drive", drive: "Faith",
      setup: "As you stand at the railing, looking out over the glistening sea, [Name] walks up next to you. \"Captain, I've noticed that some members of the crew are struggling with their faith and other personal matters. Many ships have a chaplain to help the crew with things like these, and I'd like your permission to take on the role myself. It feels like God is calling me to do this. Of course, this may mean I'll have less time for my other duties.\"",
      choices: [
        { label: "A great idea - [Name] would make an excellent chaplain.", result: { text: "[Name] flashes you a bright smile as you hand over a small amount of gold to buy the proper vestments and a new Bible. He assures you that the chaplain's services are available to you as well.", fx: [{ crewGold: -100 }, { rung: 1, who: "officer" }, { officerFlag: "chaplain" }] } },
        { label: "Grant [Name] their request, but make them swear that it will not interfere with their other duties.", result: { text: "[Name] nods dutifully and heads below deck. Later, you notice him in deep conversation with one of the newer crew members.", fx: [{ points: 2, who: "officer" }, { officerFlag: "chaplain" }] } },
        { label: "This is a pirate ship. You raid, kill, and plunder. You don't need a sniveling priest to help the crew pray over their troubles.", result: { text: "[Name]'s face scrunches in anger. \"I need to go before I take the Lord's name in vain,\" he growls before storming off.", fx: [{ rung: -1, who: "officer" }] } },
      ] },
    { id: "vo_drive_order", reg: "VE-O06", name: "A Drive Comes Due: Order", trigger: "drive", drive: "Order", needs: "signedGreen",
      setup: "Early in the morning, [Name] approaches you. \"These new crewmen seem greener than usual, Captain. The boy over there looks completely lost on deck and barely knows which end of a rope to hold. Permission to drill them harder until they start pulling their weight.\"",
      choices: [
        { label: "Permission granted. Get them up to speed, whatever it takes.", result: { text: "For the next few days, [Name] drills the new recruits hard. They struggle at first, but quickly catch up, although you hear them grumbling at times.", fx: [{ rung: 1, who: "officer" }, { season: 0.10 }, { morale: -5 }] } },
        { label: "Permission granted, but don't be too hard on them.", result: { text: "For the next few days, [Name] drills the new recruits regularly. You notice some modest improvement.", fx: [{ points: 2, who: "officer" }, { season: 0.05 }] } },
        { label: "Permission denied, but keep a close eye on them. They'll learn by watching, and if they don't, we'll throw them overboard.", result: { text: "For the next few days, [Name] watches the new recruits vigilantly, shaking his head.", fx: [{ points: -2, who: "officer" }] } },
        { label: "Permission denied. They'll be fine.", result: { text: "[Name] shakes his head and walks away. Later, you hear him complaining about the undisciplined recruits.", fx: [{ points: -3, who: "officer" }] } },
      ] },
  ];

  // Port events (§44.3): they come due as AP is spent in a place and fire
  // when the captain leaves it.
  var officerInPort = [
    { id: "vp_drive_wealth", name: "A Drive Comes Due: Wealth", trigger: "drive", drive: "Wealth",
      setup: "As you walk through town [Name] suddenly stops and grabs your sleeve. \"Remember when I told you that someone owes me money? That's him.\" {officer.He} points at a thin young man with black hair and small, beady eyes, puffing on a pipe as he strolls out of the tavern.",
      choices: [
        { label: "Corner the sailor and demand [Name]'s due", check: { type: "Intimidate", dr: 2 },
          clean: { text: "The debtor quickly rushes off, and [Name] thanks you profusely for your help.", fx: [{ rung: 1, who: "officer" }] },
          partial: { text: "The debtor complains loudly as he hands over the gold. You feel several pairs of eyes upon you as he storms off.", fx: [{ points: 2, who: "officer" }, { heatHere: 5 }] },
          setback: { text: "The debtor bolts and you give chase, but quickly lose him. [Name] thanks you for trying.", fx: [{ points: 2, who: "officer" }] } },
        { label: "Follow the sailor and ambush him", check: { type: "Plan & Ambush", dr: 2 },
          clean: { text: "You follow closely until the debtor strides through a dark alley. You quickly sneak up behind him and hold your knife to his neck. He pays his debt, and then some.", fx: [{ rung: 1, who: "officer" }, { purse: 50 }] },
          partial: { text: "You follow closely until the debtor strides through a dark alley. You quickly sneak up behind him but he turns around at the last moment. After a brief scuffle, you manage to restrain him and collect the debt.", fx: [{ points: 2, who: "officer" }, { heatHere: 5 }] },
          setback: { text: "You follow closely until the debtor strides through a dark alley. As you attempt to sneak up on him, he looks over his shoulder and sprints away. You quickly lose him in the town's winding back alleys. A disappointed [Name] thanks you for trying.", fx: [{ points: 2, who: "officer" }] } },
        { label: "Assault the man and take whatever he's got on him.", check: { type: "Brawling", dr: 2 },
          clean: { text: "You confront the debtor, and before he can defend himself, you smash his face with your pistol. The bloodied man quickly pays up, with interest.", fx: [{ purse: 150 }, { rung: 1, who: "officer" }, { heatHere: 5 }, { dread: 3 }] },
          partial: { text: "You confront the debtor, and before he can defend himself, you smash his face with your pistol. The bloodied man quickly pays up, but you're forced to flee when the town watch appears.", fx: [{ purse: 150 }, { rung: 1, who: "officer" }, { heatHere: 15 }, { dread: 3 }] },
          setback: { text: "You confront the debtor, but he puts up a fight. You take a punch to the jaw that knocks you out cold. When you awake, the debtor is gone. A disappointed [Name] thanks you for trying.", fx: [{ captainWounded: true }, { heatHere: 5 }, { points: 2, who: "officer" }] } },
        { label: "Tell him to let it go", result: { text: "[Name] hangs his head, but doesn't press the matter further.", fx: [{ points: -3, who: "officer" }] } },
      ] },
    { id: "vp_drive_security", name: "A Drive Comes Due: Security", trigger: "drive", drive: "Security",
      setup: "[Name] finds you on the streets of [Node]. \"Great news, Captain! I won big at dice, and now I've got some gold to spend. I know the crew probably needs it, but I like it here and it seems like a good place to build a life. I was wondering if perhaps I could use the gold to buy some land around here.\"",
      choices: [
        { label: "Agree with [Name]'s proposal - they won the gold, after all", result: { text: "A large grin spreads across [Name]'s face and he runs off. Later, he tells you that he bought a nice parcel of land with a garden and a small cottage.", fx: [{ rung: 1, who: "officer" }, { officerFlag: "land" }] } },
        { label: "Allow [Name] to buy a small parcel, but keep the lion's share for the crew.", result: { text: "[Name] smiles and nods before running off. Later, he tells you that he bought a small townhouse, and hands over the remainder of his winnings.", fx: [{ crewGold: 200 }, { points: 2, who: "officer" }, { officerFlag: "land" }] } },
        { label: "Tell [Name] that he's completely right. The crew does need the gold.", result: { text: "He reluctantly hands over his winnings.", fx: [{ crewGold: 300 }, { points: -3, who: "officer" }] } },
      ] },
    { id: "vp_drive_power", name: "A Drive Comes Due: Power", trigger: "drive", drive: "Power",
      setup: "[Name] and two crewmen find you outside the tavern. The two crewmen are covered in scrapes, cuts, and bruises. \"Captain,\" says [Name], \"These men say that a group of thugs in there was spouting foul slander against us. They apparently attacked our mates most savagely. We must answer this disrespect.\"",
      choices: [
        { label: "Storm in with [Name] and fight the thugs.", check: { type: "Brawling", dr: 2 },
          clean: { text: "You and [Name] burst into the tavern and quickly teach the four thugs a lesson. You leave them on the floor in a bloody heap.", fx: [{ rung: 1, who: "officer" }, { morale: 3 }, { dread: 3 }] },
          partial: { text: "You and [Name] burst into the tavern and quickly teach the four thugs a lesson, but not before one of them delivers a painful blow to your ribs.", fx: [{ rung: 1, who: "officer" }, { morale: 3 }, { dread: 3 }, { captainWounded: true }] },
          setback: { text: "You and [Name] burst into the tavern, intent on teaching the thugs a lesson. It's a valiant attempt, but you're outnumbered, and they beat you both senseless before tossing you back out the front door.", fx: [{ captainWounded: true }, { points: 2, who: "officer" }] } },
        { label: "Approach the thugs and demand restitution for your injured crew.", check: { type: "Intimidate", dr: 2 },
          clean: { text: "The thugs, not wanting to cross you further, quickly offer a pouch of gold pieces as restitution.", fx: [{ crewGold: 100 }, { rung: 1, who: "officer" }] },
          partial: { text: "The thugs grumble but don't seem willing to fight you. They toss you a few coins to go away.", fx: [{ crewGold: 50 }, { points: 2, who: "officer" }] },
          setback: { text: "The thugs laugh in your face, and you hear the other patrons snickering. You and [Name] leave the tavern empty-handed.", fx: [{ morale: -3 }, { points: -2, who: "officer" }] } },
        { label: "The thugs aren't worth the trouble. Focus on tending to your crewmen's wounds.", result: { text: "You bandage the wounded crewmen and bring them back to the ship. Those thugs aren't worth the trouble.", fx: [{ points: -3, who: "officer" }, { morale: 2 }] } },
      ] },
    { id: "vp_drive_knowledge", name: "A Drive Comes Due: Knowledge", trigger: "drive", drive: "Knowledge", place: "merchant",
      setup: "As you walk past the assorted market stalls, [Name] grabs you by the arm. \"Captain, that woman over there is selling some very interesting books. I'd like to peruse her volumes and perhaps buy one or two, but I don't have the coin on me. Do we have any coin to spare?\"",
      choices: [
        { label: "The pursuit of knowledge is a worthwhile endeavor. Give [Name] a handful of gold from your own purse.", needsPurse: 50, result: { text: "[Name] beams as you hand him a hefty pouch of gold. He spends the next hour rummaging through the bookseller's stall and returns with an armful of books.", fx: [{ purse: -50 }, { rung: 1, who: "officer" }, { rumor: "Legend" }] } },
        { label: "Sigh deeply and tell [Name] that they can buy one book only, tossing them a few coins.", needsPurse: 15, result: { text: "[Name] nods as you hand him a few coins. He takes his time looking through the volumes, before selecting a worn old tome about sea creatures.", fx: [{ purse: -15 }, { points: 2, who: "officer" }] } },
        { label: "Tell [Name] that you don't have the coin to spare. They'll have to make do with the books you already have on board.", result: { text: "[Name] says he understands, but you can tell he's disappointed.", fx: [{ points: -2, who: "officer" }] } },
        { label: "Reading is for fools. Laugh at [Name] and continue walking.", result: { text: "[Name] stands there, stunned. \"I didn't know you felt that way, Captain. Your loss.\"", fx: [{ rung: -1, who: "officer" }] } },
      ] },
    { id: "vp_drive_pleasure", name: "A Drive Comes Due: Pleasure", trigger: "drive", drive: "Pleasure",
      setup: "As you walk down the town's main street, the sound of music and mirth carries through the air. \"Hear that?\" says [Name], \"Sounds like there's a party happening nearby. Let's go crash it!\"",
      choices: [
        { label: "Sure, why not?", needsAp: 1, result: { text: "You and [Name] find the raucous party in the garden of a well-off merchant's home and slip in without anyone noticing. It's the birthday celebration of the merchant's beloved father, Eugene, and the attendees are the friends and family he's accumulated over his 90 years. You mingle, make friends, and partake in the merriment until dawn. As you leave, [Name] turns to you and says, \"Thanks, Captain. I really needed that.\"", fx: [{ spendAp: 1 }, { rung: 1, who: "officer" }, { tag: "Hangover" }, { rumor: "C" }] } },
        { label: "We don't have time for this. Let's keep going.", result: { text: "[Name] hangs his head, and seems uncharacteristically quiet for the rest of the day.", fx: [{ points: -3, who: "officer" }] } },
        { label: "Bring the whole crew", needsAp: 1, result: { text: "You gather as many crew members as you can find and bring them to a raucous party in the garden of a well-off merchant’s home. It’s the birthday celebration of the merchant’s beloved father, Eugene, and the attendees are the friends and family he’s accumulated over his 90 years. The arrival of your crew turns heads, but the frightened guests don't dare ask you all to leave. Eugene doesn't seem to mind, instead finding his son's exasperation quite amusing. Your crew drinks the cellar dry and partakes in the merriment until dawn, causing quite a bit of damage in the process. A good amount of fine silverware leaves with them. As you depart, [Name] turns to you and says, “Thanks, Captain. We all needed that.”", fx: [{ spendAp: 1 }, { morale: 5 }, { crewGold: 150 }, { heatHere: 5 }, { rung: 1, who: "officer" }] } },
      ] },
    { id: "vp_fear_loss", name: "Fear Trigger: Loss", trigger: "fear", fear: "Loss",
      setup: "[Name] runs up to you on the street, out of breath. \"Captain, a pickpocket has stolen something precious from me! It's a silver ring, the only thing I have left of my father. Help me find the thief and get it back.\"",
      choices: [
        { label: "Agree immediately and go hunting for the pickpocket, prepared to beat him senseless.", needsAp: 1, check: { type: "Gather Intelligence", dr: 2 }, spendAp: 1,
          clean: { text: "After hours of searching, you finally catch up with the pickpocket and corner him in an alley. You beat him senseless and take back the ring. [Name] thanks you for your help.", fx: [{ rung: 1, who: "officer" }] },
          partial: { text: "After hours of searching, you finally catch up with the pickpocket and corner him in an alley. You beat him senseless and take back the ring, but not before several townsfolk take notice. [Name] thanks you for your help.", fx: [{ heatHere: 5 }] },
          setback: { text: "After hours of searching, you can't find the pickpocket. [Name] is heartbroken.", fx: [{ points: -2, who: "officer" }] } },
        { label: "Agree and search for the pickpocket, prepared to negotiate for the ring.", needsAp: 1, check: { type: "Haggle", dr: 2 }, spendAp: 1,
          clean: { text: "After hours of searching, [Name] points out the suspected pickpocket in the crowded market. He turns to run, but stops when you assure him that you're prepared to pay for the ring. After you explain the ring's sentimental value, he accepts a small amount of coin for it. [Name] is overjoyed and thanks you profusely.", fx: [{ purse: -30 }, { rung: 1, who: "officer" }] },
          partial: { text: "After hours of searching, [Name] points out the suspected pickpocket in the crowded market. He turns to run, but stops when you assure him that you're prepared to pay for the ring. He drives a hard bargain, and you end up a fair bit poorer. [Name], however, is overjoyed and thanks you profusely.", fx: [{ purse: -100 }, { rung: 1, who: "officer" }] },
          setback: { text: "You head into the market to search for the pickpocket. After hours of searching with no luck, [Name] gives up and returns to the ship heartbroken.", fx: [{ points: -2, who: "officer" }] } },
        { label: "Refuse. The thief is probably long gone, and it would take too much time to find him.", result: { text: "[Name] is sorely disappointed.", fx: [{ points: -3, who: "officer" }] } },
      ] },
    { id: "vp_fear_obscurity", name: "Fear Trigger: Obscurity", trigger: "fear", fear: "Obscurity",
      setup: "As you walk past a graveyard, you notice [Name] sitting in front of an unmarked tombstone. As you approach, they turn to you with tears in their eyes. \"This is where my brother is buried. They…they didn't even carve his name. Promise me that when I die, you'll give me a proper funeral, and carve my name into the stone.\"",
      choices: [
        { label: "Promise [Name] a proper funeral and grave, and offer to help carve their brother's name into this tombstone (1 action)", needsAp: 1, result: { text: "You spend the rest of the day helping [Name] carve his brother's name into the stone. You watch as he places a wildflower on the grave and bows his head. As you depart, he thanks you for your help.", fx: [{ spendAp: 1 }, { rung: 1, who: "officer" }, { officerFlag: "funeralPromised" }] } },
        { label: "Promise [Name] a proper funeral and grave, and sit with them for a while.", result: { text: "After promising him a proper funeral, the two of you sit in silence for a long while. Eventually, you leave him to his thoughts.", fx: [{ points: 3, who: "officer" }, { officerFlag: "funeralPromised" }] } },
        { label: "Sit with [Name] silently but make no promises. Sailors usually end up at the bottom of the sea, anyway.", result: { text: "The two of you sit in silence for a long while. Eventually, you leave him to his thoughts.", fx: [{ points: -2, who: "officer" }] } },
        { label: "Roll your eyes and walk away. You don't have the patience for sentimental nonsense.", result: { text: "Unmoved, you leave [Name] to his mourning.", fx: [{ rung: -1, who: "officer" }] } },
      ] },
    { id: "vp_fear_exposure", name: "Fear Trigger: Exposure", trigger: "fear", fear: "Exposure",
      setup: "As you walk down the main street, [Name] is stopped by a man in a fancy coat, who calls him another name. The blood drains from [Name]'s face and he looks to you for help.",
      choices: [
        { label: "Tell the man he's mistaken", check: { type: "Bluff & Disguise", dr: 2 },
          clean: { text: "The confused man continues on his way. [Name] looks grateful, but he doesn't want to talk about it. You drop the subject.", fx: [{ rung: 1, who: "officer" }] },
          partial: { text: "The confused man continues on his way. [Name] looks grateful, but he doesn't want to talk about it. You drop the subject.", fx: [{ rung: 1, who: "officer" }] },
          setback: { text: "\"No, I'm certain it's you! You had to flee town, right?\" [Name] grabs your arm and whisks you away. He looks like he's seen a ghost, but he doesn't want to talk about it. You drop the subject.", fx: [{ points: -2, who: "officer" }, { officerFlag: "exposed" }] } },
        { label: "Pay him to forget", needsPurse: 100, result: { text: "The man quickly takes the coin, then walks away whistling a jaunty tune. [Name] looks grateful, but he doesn't want to talk about it. You drop the subject.", fx: [{ purse: -100 }, { rung: 1, who: "officer" }] } },
        { label: "Threaten him", check: { type: "Intimidate", dr: 2 },
          clean: { text: "The man flees in terror. [Name] looks grateful, but he doesn't want to talk about it. You drop the subject.", fx: [{ rung: 1, who: "officer" }] },
          partial: { text: "The man flees in terror, but the commotion turns a few heads. [Name] looks grateful, but he doesn't want to talk about it. You drop the subject.", fx: [{ rung: 1, who: "officer" }, { heatHere: 5 }] },
          setback: { text: "\"You don't frighten me, sir. I'd know that face anywhere! Did you know he had to flee town?\" [Name] grabs your arm and whisks you away. He looks like he's seen a ghost, but he doesn't want to talk about it. You drop the subject.", fx: [{ points: -2, who: "officer" }, { officerFlag: "exposed" }] } },
        { label: "Let [Name] handle it", result: { text: "[Name] tells the man he's mistaken, and you continue on your way, leaving the confused man scratching his head. He doesn't want to talk about it.", fx: [{ points: -2, who: "officer" }] } },
      ] },
  ];
  // The officer's fear line opens a Fear Trigger (§25 appendix Part 1, §6).
  var fearLines = { "Poverty": "We'll be living on the streets as beggars!", "Violence & Death": "I can't bear to watch this.", "Disgrace": "You're throwing our good names in the gutter!",
    "Betrayal": "I knew I shouldn't have trusted you.", "Loss": "We had it all, and now we'll be left with nothing.", "Uncanny": "I don't want to find out what that eerie feeling is about.",
    "Exposure": "I wish I could go home...", "Obscurity": "Our names will mean nothing after this." };

  // The Vote's reactions (§25 appendix Part 2).
  var voteReact = {
    congratulate: { label: "Congratulate the winner - the crew made the right choice", approval: ["Honor"], text: "The crew seem pleased that you agree with their decision.", fx: [{ morale: 3 }] },
    silent: { label: "Observe and keep silent", approval: ["Caution"], text: "Your silence leaves the crew to guess as to your feelings about the new Quartermaster.", fx: [] },
    sulk: { label: "Sulk in your cabin", approval: ["Retreat"], text: "You don't stick around to watch the crew congratulate their new Quartermaster.", fx: [{ points: -2, who: "winner" }, { morale: -2 }] },
    disagree: { label: "Loudly disagree with the crew's decision", approval: ["Defiance"], text: "The crew grumbles, but nobody challenges you directly.", fx: [{ rung: -1, who: "winner" }, { morale: -5 }, { pressure: 1 }] },
  };

  PC.data.voyageEvents = {
    SLOT_CHANCE: 0.75,               // §44.1 (placeholder)
    STORM: { Fair: 0.05, Unsettled: 0.20, Foul: 0.45, hurricaneFloor: 0.20, perExtraAp: 0.05 }, // §44.7
    ENCOUNTER_CHANCE: 0.20,          // DEFAULT: §44.4 sets no chance for an "other ships" encounter
    OFFICER_CHANCE: 0.25,            // §25.15: 25% a voyage, 2 a season
    OFFICER_SEASON_CAP: 2,
    PORT_OFFICER_CHANCE: 0.25,       // DEFAULT: §44.3 ties port events to AP spent; the same 25% a place
    COOLDOWN: 4,
    STORM_SETBACK: { hull: [0.10, 0.15], hands: [1, 3], hurricaneHull: [0.15, 0.25], hurricaneHands: [2, 5] },
    FOUNDER: { fleetCrewLost: [0.25, 0.50], fleetOfficerLost: 0.10, aloneOfficerSurvive: 0.50, aloneCrewSurvive: [0.10, 0.30] },
    written: written, hurricane: hurricane, breakingUp: breakingUp, encounters: encounters, approved: approved,
    officerAtSea: officerAtSea, officerInPort: officerInPort, afterEscape: afterEscape, fearLines: fearLines, voteReact: voteReact,
    lines: {
      founderedFleet: "PLACEHOLDER: She goes down at last. Your men scramble across to the [Ship] as the sea takes your flagship.",
      founderedAlone: "PLACEHOLDER: She goes down, and you go into the sea with her.",
      rescued: "PLACEHOLDER: A passing ship hauls you out of the water and sets you ashore at [Node], shipless.",
      drowned: "PLACEHOLDER: The sea closes over you.",
      stormTable: { hull: "PLACEHOLDER: A sea stoves in planking along her side.", hands: "PLACEHOLDER: [number] hands are swept overboard.", cargo: "PLACEHOLDER: You throw cargo over the side to keep her afloat.", mast: "PLACEHOLDER: The mainmast is sprung. She'll be slow until a yard fixes it." },
      quietTitle: "At sea",
    },
    passage: [
      { when: { outlook: "Fair" }, text: "The wind carries you across the sea under a clear sky." },
      { text: "Your journey passes uneventfully." },
      { when: { outlook: "Fair", zone: "south" }, text: "The water turns so clear you can see the sand thirty feet below." },
      { when: { outlook: "Fair", zone: "north" }, text: "Gulls follow the ship all the way, arguing over the cook's scraps." },
      { when: { outlook: "Fair", season: "Summer" }, text: "Flying fish skitter across the waves ahead of the bow." },
      { when: { outlook: "Fair", season: "Winter", zone: "south" }, text: "The trade winds blow steady and warm. It's hard to remember it's winter." },
      { when: { outlook: "Unsettled" }, text: "Grey skies and a choppy sea, but she holds her course." },
      { when: { outlook: "Unsettled", zone: "north" }, text: "A cold drizzle follows you most of the way." },
      { when: { outlook: "Foul" }, text: "The sky threatens the whole way, but the worst of it never quite arrives." },
      { text: "The stars are out in their thousands, and the watch is quiet." },
      { text: "Dolphins run in the bow wave for an hour, and the men lean over the rail to watch." },
      { when: { season: "Winter", zone: "north" }, text: "Spray freezes in the rigging, and the men stamp their feet on watch." },
      { when: { season: "Hurricane" }, text: "A long, oily swell rolls in from the southeast. Somewhere out there, a storm is brewing." },
    ],
  };
})();
