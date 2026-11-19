/* Name pools (§36), Minor roles (§15.4) and gender weights (§15.1).
 *
 * Every name here is a proposal (§36); none is in the lore files. The
 * rules that use these lists are in js/npcs.js. Lists are written as
 * comma-separated strings so they are easy to edit.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  function L(s) { return s.split(",").map(function (x) { return x.trim(); }).filter(Boolean); }

  // ---- The pools (§36.3-§36.13) ------------------------------------------
  // honor: the pool's honorific for Gentry/Planter, Official and Merchant
  // (§36.2). breton: whether the Breton layer applies (§36.1).
  var POOLS = {
    avalon: {
      name: "Avalon", breton: true, honor: { m: "Mister", f: "Mistress" },
      men: L("Alexander, Alasdair, Andrew, Angus, Archibald, Archie, Benjamin, Callum, Charles, Colin, Daniel, David, Douglas, Duncan, Ebenezer, Edward, Elijah, Ewan, Fergus, Francis, Gavin, George, Gilbert, Gordon, Hamish, Hector, Henry, Hugh, Iain, Isaac, Jacob, James, Jamie, John, Jonah, Josiah, Kenneth, Lachlan, Lewis, Malcolm, Matthew, Murdo, Nathaniel, Neil, Peter, Ralph, Robert, Rory, Samuel, Simon, Thomas, Tobias, Walter, William"),
      women: L("Abigail, Agnes, Alison, Ann, Bethia, Catherine, Dorothy, Effie, Elspeth, Euphemia, Flora, Grizel, Helen, Hester, Isobel, Janet, Jean, Jessie, Kirsty, Lilias, Margaret, Marion, Martha, Morag, Nancy, Patience, Peggy, Prudence, Rachel, Sarah, Susanna"),
      surnames: L("Baird, Barker, Boyd, Brodie, Buchanan, Cameron, Campbell, Carnegie, Chisholm, Cochrane, Cooper, Crawford, Drummond, Dunbar, Elliot, Erskine, Ferguson, Fletcher, Forbes, Fraser, Gordon, Graham, Gray, Guthrie, Hamilton, Harper, Hay, Hunter, Innes, Johnstone, Keith, Kerr, Kincaid, Kirk, Lamont, Lindsay, Lockhart, Logan, MacDonald, MacGregor, MacKay, MacKenzie, MacLean, MacLeod, MacNab, MacRae, Mason, Maxwell, Moffat, Montgomery, Munro, Murray, Napier, Ogilvie, Porter, Pringle, Ramsay, Rennie, Robertson, Rutherford, Scott, Shaw, Sinclair, Stewart, Tait, Tanner, Turner, Urquhart, Wallace, Weir, Wright"),
    },
    frisian: {
      name: "Frisian", breton: true, honor: { m: "Mynheer", f: "Mevrouw" },
      men: L("Adriaan, Anton, Arend, Bastiaan, Benno, Bram, Cornelis, Daan, Dirk, Evert, Floris, Folkert, Frans, Gerrit, Harm, Hendrik, Hidde, Hugo, Jan, Jasper, Jelle, Joost, Joris, Karel, Klaas, Lambert, Lieven, Lucas, Maarten, Marten, Niels, Okke, Otto, Pieter, Reinier, Ruben, Rutger, Sander, Teun, Wiebe, Willem, Wouter"),
      // Drawn in place of Breton names by Frisian gentry, officials and
      // officers in their 30% share (ruled, §36.4).
      royal: L("Adalbrand, Arthmael, Gundebold, Liudger, Reinhold, Wigbold"),
      women: L("Aaltje, Anna, Antje, Elske, Emma, Femke, Fenna, Geertje, Griet, Hanna, Ida, Janna, Jet, Katrijn, Klara, Liesbeth, Lieke, Lotte, Maaike, Marijke, Mies, Neeltje, Roos, Sanne, Saskia, Sofie, Tessa, Wilma, Willemijn"),
      surnames: L("Bakker, Blom, Bosma, Brandsma, Brouwer, Claessen, De Boer, De Vries, De Wit, Dekker, Dijkstra, Faber, Feenstra, Groen, Haan, Haring, Hartog, Hendriks, Hiemstra, Hoekstra, Hofstra, Jansen, Kok, Koster, Kroon, Kuipers, Meyer, Molenaar, Mulder, Pieters, Postma, Roos, Ruiter, Schipper, Sikkema, Smit, Stam, Ten Hove, Terpstra, Tolsma, Van Buren, Van Dam, Van Dijk, Van Loon, Vandenberg, Veenstra, Visser, Vos, Wiersma, Wolters, Zeeman, Zylstra"),
    },
    french: {
      name: "French", breton: true, honor: { m: "Monsieur", f: "Madame" },
      men: L("Antoine, Armand, Bastien, Benoît, Charles, Claude, Denis, Étienne, François, Gaspard, Gaston, Gilles, Guillaume, Henri, Hugues, Jacques, Jean, Julien, Laurent, Louis, Luc, Lucien, Marcel, Mathieu, Michel, Nicolas, Olivier, Pascal, Philippe, Pierre, Raoul, Rémy, René, Thibault, Yves"),
      women: L("Adèle, Agnès, Anne, Babette, Camille, Céleste, Claudine, Colette, Élise, Françoise, Geneviève, Hélène, Isabelle, Jeanne, Juliette, Louise, Margot, Marie, Odette, Sophie, Suzanne, Yvette"),
      surnames: L("Arnaud, Barbier, Bernard, Blanchard, Bonnet, Boucher, Caron, Chevalier, Collet, Delacroix, Deschamps, Dubois, Dufour, Dumont, Durand, Fontaine, Garnier, Gautier, Girard, Lambert, Laurent, Leblanc, Lefèvre, Lemaire, Marchand, Martel, Mercier, Morel, Picard, Renard, Roussel, Rousseau, Vasseur, Deveraux, Lacombe, Beaumont, Lemoine, Rocher, Toussaint, Valois"),
    },
    irish: {
      name: "Irish", breton: true, honor: { m: "Mister", f: "Mistress" },
      men: L("Aidan, Brendan, Brian, Colm, Conor, Cormac, Declan, Dennis, Dermot, Donal, Eamon, Fergal, Finn, Hugh, Kieran, Liam, Lorcan, Michael, Niall, Owen, Patrick, Rory, Seamus, Sean, Kevin"),
      women: L("Aileen, Bridget, Cara, Deirdre, Eileen, Fiona, Grania, Kathleen, Maeve, Moira, Nora, Orla, Rosaleen, Sheila, Una"),
      surnames: L("Brennan, Burke, Byrne, Callahan, Connolly, Daly, Doyle, Fitzgerald, Gallagher, Hennessy, Keane, Kelly, Kennedy, Lynch, McCarthy, Murphy, Nolan, O'Brien, O'Connor, O'Donnell, O'Malley, O'Neill, O'Reilly, O'Sullivan, Quinn, Regan, Ryan, Sheridan, Walsh, Mahoney"),
    },
    spanish: {
      name: "Spanish", breton: false, honor: { m: "Don", f: "Doña" },
      men: L("Alonso, Andrés, Bartolomé, Carlos, Diego, Esteban, Felipe, Fernando, Francisco, Gaspar, Gonzalo, Ignacio, Joaquín, Jorge, José, Juan, Lorenzo, Luis, Manuel, Mateo, Miguel, Pedro, Rafael, Ramón, Rodrigo"),
      women: L("Ana, Beatriz, Catalina, Elena, Inés, Isabel, Juana, Lucía, Luisa, María, Rosa, Teresa, Paloma, Carmen, Dolores"),
      surnames: L("Alvarado, Castillo, Cortés, Delgado, Domínguez, Escobar, Fuentes, Guerrero, Herrera, Ibarra, Lozano, Medina, Mendoza, Molina, Navarro, Ortega, Pacheco, Quintero, Ramírez, Reyes, Salazar, Serrano, Soto, Valdés, Vargas, Aguilar, Cabrera, Montoya, Robles, Vega"),
    },
    sicilian: {
      name: "Sicilian", breton: false, honor: { m: "Signor", f: "Signora" },
      men: L("Alfio, Angelo, Antonio, Calogero, Carmelo, Corrado, Enzo, Filippo, Gaetano, Gianni, Giuseppe, Leonardo, Marco, Massimo, Nicola, Paolo, Pietro, Rosario, Salvatore, Santo, Turi, Vito, Matteo, Bruno, Sergio"),
      women: L("Agata, Carmela, Concetta, Giovanna, Lucia, Nunzia, Rosalia, Santa, Serafina, Tina, Graziella, Pina, Vita, Rosa, Mariuccia"),
      surnames: L("Amato, Barone, Bruno, Caruso, Colombo, Costa, D'Angelo, Ferrara, Gallo, Greco, La Rosa, Lombardo, Mancuso, Marino, Messina, Morello, Palazzolo, Rizzo, Romano, Russo, Santoro, Scalia, Vitale, Cusumano, Lo Bianco, Puglisi, Randazzo, Sciortino, Trapani, Militello"),
    },
    burgundian: {
      name: "Burgundian", breton: true, honor: { m: "Monsieur", f: "Madame" },
      men: L("Achille, Aurélien, Baptiste, Bertrand, Césaire, Damien, Didier, Esprit, Fabien, Félix, Fortuné, Frédéric, Honoré, Léon, Marius, Martin, Raymond, Roch, Sébastien, Théo, Valentin, Vincent, Gustave, Clément, Ferréol"),
      women: L("Aurélie, Blanche, Clémence, Delphine, Estelle, Fanette, Julie, Lise, Magali, Mireille, Nicolette, Roseline, Séverine, Solange, Vivienne"),
      surnames: L("Arnoux, Aubanel, Barral, Bellon, Blanc, Bonfils, Castan, Cazal, Daudet, Fabre, Giraud, Imbert, Jourdan, Maurel, Mistral, Peyre, Pons, Raynaud, Roubaud, Roux, Sabatier, Teissier, Vidal, Audibert, Bonnefoy, Chabaud, Gasquet, Reboul, Signoret, Tardieu"),
    },
    swedish: {
      name: "Swedish", breton: false, honor: { m: "Herr", f: "Fru" },
      men: L("Anders, Arvid, Axel, Bengt, Bertil, Birger, Carl, Erik, Gunnar, Gustav, Hans, Henrik, Ivar, Johan, Lars, Magnus, Mats, Nils, Olof, Per, Sven, Ulf, Viktor, Einar, Torsten"),
      women: L("Astrid, Brita, Elin, Greta, Ingrid, Karin, Kerstin, Linnea, Maja, Signe, Sigrid, Ulla, Frida, Hedvig, Margit"),
      surnames: L("Ahlgren, Andersson, Berg, Bjork, Dahl, Ekman, Engstrom, Falk, Forsberg, Hedlund, Holm, Isaksson, Karlsson, Lind, Lindqvist, Lund, Nyberg, Olsson, Sandberg, Strand, Svensson, Wallin, Wikstrom, Hallberg, Lindgren, Nordin, Rydell, Sundqvist, Ostberg, Blomqvist"),
    },
    // §36.12. About 15% of given names are the word-name exceptions.
    native: {
      name: "Native", breton: false, honor: { m: "Mister", f: "Mistress" },
      men: L("Abel, Ben, Caleb, Eli, Harry, Isaac, Jack, Jacob, Joe, John, Moses, Ned, Noah, Peter, Sam, Will"),
      menWords: L("Otter, Heron, Hawk, Thunder"),
      women: L("Bess, Hannah, Lucy, Mary, Nan, Polly, Rachel, Ruth, Sally, Sarah"),
      womenWords: L("Wren, Willow, Fawn, Rain"),
      wordChance: 0.15,
      surnames: L("Bear-Walker, Black-Fox, Cane-Cutter, Long-Knife, Otter-Tail, Swift-Water, Tall-Pine, Two-Rivers, White-Crane, Night-Heron, Santee, Wateree, Cheraw, Sewee, Winyah, Keowee, Toxaway, Tugaloo, Chauga, Eno"),
    },
    // §36.13. Half of given names come from the Avalon list. An enslaved
    // NPC usually has no surname; a runaway or freed one has a 50% chance
    // of a chosen one.
    bondsman: {
      name: "Bondsman", breton: false, honor: { m: "", f: "" },
      men: L("Kofi, Kwame, Kwaku, Kojo, Yaw, Kwasi, Musa, Ibrahim, Bakary, Obi, Chidi, Femi, Mingo, Cudjoe, Quash, Juba"),
      women: L("Ama, Akua, Abena, Efua, Yaa, Fatima, Mariam, Ayo, Phibbah, Nkem, Binta, Adia"),
      surnames: L("Freeman, Liberty, Hope, Newman, Freedom, Gladwin, Morrow, Strong"),
      avalonGivenShare: 0.5,
    },
  };

  // §36.11. Readable Breton given names, shared by the pools with breton: true.
  var BRETON = {
    men: L("Alan, Alaric, Armel, Brioc, Conan, Corentin, Darien, Erwan, Gildas, Hoel, Judicael, Kilian, Loïc, Mael, Malo, Morvan, Ronan, Tanguy, Treveur, Tristan, Tudal, Uther, Yann, Yves, Briac, Gurvan, Elouan, Riwal, Arthur, Brendan"),
    women: L("Annaig, Aela, Azenor, Enora, Gwen, Gwenola, Katell, Maïwenn, Morwenna, Nolwenn, Rozenn, Tifenn, Anaïs, Emma, Lena, Gaëlle, Soline, Ysolde, Morgane, Clervie"),
  };

  // The master pool (§36.1, placeholder, approved): Ocracoke and anywhere
  // without a pool of its own. Pirate prize captains use it too.
  var MASTER_WEIGHTS = { avalon: 45, irish: 15, french: 15, frisian: 10, spanish: 5, swedish: 4, sicilian: 3, burgundian: 3 };

  // The Breton layer (§36.1): 10%, and 30% for these roles.
  var BRETON_RATE = 0.10;
  var BRETON_RATE_GENTRY = 0.30;
  var GENTRY_ROLES = ["Gentry/Planter", "Official", "Colonial Officer"];

  // §36.2 The reserved-name filter: the starting list. The engine adds the
  // roster's own names (PC.data.npcs) automatically.
  var RESERVED = {
    surnames: L("Clarke, Key, Van Helsing, Jongstra, Dettman, Caradec, Lacy, Rose, Moreau, Ross, Mack, Williams, Flanagan, Twopenny, Dell, Wells, Piper, Saxby, Sawnee, Red-Feather, Lilyhook, Velten, Volta, McBride, Rogard, Kalma, Sutherland, McFee, Prins, Godfrey, Bucket, Berenovsky"),
    given: L("Maelis, Levan, Cael, Morgana, Aldric, Radboud, Venec, Nuri"),
    names: L("Amber Jack, Blackbeard, Calico Jack, Captain Deadman"),
    ships: [], // special prize ships (§30.10) join with the prize hunt milestone
  };

  // §36.14 Pirate nicknames. Generated ones are prefix only and keep the
  // surname ("Black Sam Bellamy"; ruled November 18, M6 chat R3). The suffix
  // and "the" lists are for the author's own Named NPCs (Bobby Rats).
  var NICKNAMES = {
    prefix: L("Black, Red, Long, Short, Mad, Lucky, Gentleman, Dirty, Salty, Old, Pretty, Bloody, Honest, Sly, Lame, Deaf, Squinting, Sweet, Gin-Soaked, Handsome"),
    suffix: L("Rats, Bones, Barrels, Pickles, Teeth, Knuckles, Two-Toes, Nine-Fingers, Gristle, Tar, Biscuits, Sixpence, Buckets, Ribs, Splinters"),
    the: L("the Hammer, the Eel, the Parson, the Ox, the Weasel, the Gull, the Tinker, the Owl, the Preacher, the Cat, the Butcher, the Toad, the Fiddler"),
    theByPool: { frisian: ["the Dutchman"], french: ["the Frenchman"] },
  };
  // Who draws a nickname (§36.2, placeholder): pirates and pirate captains
  // 50%; sailors and dockhands at Ocracoke 15%.
  var NICKNAME_RATES = { "Pirate": 0.5, "Pirate Captain": 0.5 };
  var NICKNAME_RATES_OCRACOKE = { "Sailor": 0.15, "Dockhand/Laborer": 0.15 };

  // §36.15 Ships, 25 per flag; the Avalon merchant names (40) and the
  // Pirate names (50) were doubled (approved November 14). Avalon names
  // marked navy are drawn only by Admiralty ships.
  var SHIPS = {
    avalon: L("Thistle, Fair Isla, Bonnie Jean, Highland Lass, Saltire, Glasgow Merchant, Clyde, Lochaber, Caledonia, Heather Bell, Prosperity, Good Intent, Charming Peggy, Providence, Industry, Two Brothers, Carolina Packet, Albemarle, Wilmington Trader, Speedwell, Hopewell, Mary and Ann, Kelpie, Bluebell, Orkney Lass, Leith Packet, Dundee, Pamlico, Roanoke, Edenton Packet, Betsey, Diligence, Friendship, Endeavour, Kitty, Tweed, Bonnie Annie, Peace and Plenty, Loyal Subject, Ploughman"),
    avalonNavy: L("Valiant, Resolute, Defiance, Intrepid, Unicorn"),
    frisian: L("Morgenster, Zeepaard, Prins Willem, Hoop, Fortuin, Harlingen, Texel, Ameland, Dokkum, Friesland, Gouden Leeuw, Witte Valk, Rode Hert, Vergulde Draak, Zwaan, Pelikaan, Dolfijn, Walvis, Sint Pieter, Koopman, Zeeland, Havana Trader, Vrede, Oranjeboom, Noorderlicht"),
    french: L("Bonne Espérance, Saint-Esprit, Dauphin, Hirondelle, Fleur de Lys, Vengeur, Hardi, Intrépide, Comète, Étoile du Matin, Tonnerre, Renard, Diligente, Jeune Henri, Bon Père, Saint-Louis, Mouette, Aigle, Belle Poule, Junon, Flore, Veracruz, Marquise, Sans Pareil, Gloire"),
    irish: L("Saint Brendan, Saint Patrick, Saint Bridget, Cork Merchant, Galway Lass, Kerry Lass, Wexford, Kinsale, Erin, Banshee, Fianna, Grania, Hibernia, Shannon, Liffey, Connaught, Claddagh, Harp, Tara, Shamrock, Lough Swilly, Gibraltar Packet, Selkie, Dublin Rose, Wild Goose"),
    spanish: L("Nuestra Señora de la Luz, San José, San Felipe, Santa Rosa, Santísima Trinidad, Concepción, Buen Consejo, Esperanza, Gallardo, Paloma, Golondrina, Santo Cristo, San Miguel, Rosario, Castilla, Galicia, Fortuna, Victoria, Princesa, Dragón, San Carlos, Santa Lucía, Halcón, Estrella, Peregrina"),
    sicilian: L("Santa Rosalia, Sant'Agata, Madonna della Lettera, Palermo, Etna, Trinacria, Stella Maris, Scirocco, Delfino, Aquila, Leone, Buona Fortuna, San Nicola, Fenice, Gabbiano, Siracusa, Vespro, Corallo, Carmela, Marsala, Catania, Libeccio, Sirena d'Oro, San Calogero, Tonno"),
    burgundian: L("Belle Provence, Mistral, Rhône, Sainte-Baume, Bonne Mère, Cigale, Lavande, Camargue, Arlésienne, Saintes-Maries, Olivier, Durance, Étoile de Provence, Fortunée, Saint-Victor, Comtesse, Aigle d'Or, Bon Vent, Sardine, Tramontane, Avignon, Lys d'Arles, Marseille, Bouillabaisse, Félibre"),
    swedish: L("Tre Kronor, Kronan, Vasa, Svea, Lejonet, Falken, Lyckan, Hoppet, Freya, Odin, Sleipner, Stockholm, Uppland, Nordstjernan, Prins Carl, Vinland Trader, Gotland, Svarta Ormen, Gripen, Malmo, Riksdag, Hjalmar, Fortuna, Kalmar, Ulrika"),
    pirate: L("Ill Wind, Black Gull, Rum Runner, Drunken Saint, Widow's Kiss, Gallows Bird, Sea Hag, Hangman's Luck, Merry Corpse, Devil's Due, Salt Dog, Rattlesnake, Jolly Bastard, Scurvy Dog, Thieving Magpie, Last Laugh, Bad Penny, Lucky Strumpet, Fortune's Folly, Black Cat, Crooked Mile, Grinning Skull, Red Raven, Midnight Lady, Salty Nan, Rusty Cutlass, Black Joke, Grog Blossom, Salty Meg, Dead Reckoning, Wicked Wench, Bilge Rat, Gallows Jig, Blind Fiddler, Swaggering Sal, Pickled Parson, Hellfire, Rogue's Revenge, Cackling Crow, Brimstone, Lost Wager, Blackguard, Sinner's Luck, Mad Dog, Scarlet Lass, Empty Bottle, Copperhead, Gilded Rat, Gutter Prince, Fool's Gold"),
  };
  // The player's random ship name (§36.2): Pirate 60%, Avalon merchant 40%.
  var PLAYER_SHIP_WEIGHTS = { pirate: 60, avalon: 40 };

  // ---- Minor roles (§15.4) ---------------------------------------------
  // weights: bold traits are "weighted up" (×3); "rare" ones ×0.3. The
  // ×3 and ×0.3 are this build's reading of "weighted up" and "rare"
  // (placeholders, flagged in the Milestone 2 summary).
  var ROLES = {
    "Official": { age: [25, 60], bold: L("Upstanding, Corrupt, Greedy"), pool: L("Ambitious, Proud, Humble, Suspicious, Gullible, Stubborn, Vain, Loyalist") },
    "Colonial Officer": { age: [22, 55], bold: L("Upstanding, Proud, Loyalist, Battle-Hardened, Green"), pool: L("Ambitious, Honorable, Hot-Tempered, Cool-Headed, Fearless, Ruthless, Merciful, Suspicious"), rare: L("Corrupt, Timid") },
    "Merchant": { age: [28, 65], bold: L("Greedy, Shrewd"), pool: L("Generous, Gullible, Honorable, Corrupt, Suspicious, Candid, Inscrutable, Stubborn, Pragmatic, Vain, Jovial") },
    "Tavern Keeper": { age: [28, 60], bold: L("Jovial, Taciturn, Gossipy, Discreet"), pool: L("Hard Drinker, Observant, Candid, Inscrutable, Greedy, Generous, Loyal, Suspicious, Tolerant") },
    "Dockhand/Laborer": { age: [16, 55], bold: L("Jovial, Taciturn, Gossipy"), pool: L("Hard Drinker, Gambler, Hot-Tempered, Fearless, Timid, Rebellious, Humble, Observant, Superstitious, Loyal, Fickle") },
    "Sailor": { age: [16, 50], bold: [], pool: L("Jovial, Taciturn, Hard Drinker, Gambler, Superstitious, Fearless, Timid, Reckless, Wild, Loyal, Fickle, Rebellious, Battle-Hardened, Green, Old Sea Dog") },
    "Ship Captain": { age: [28, 60], bold: L("Fearless, Timid, Proud, Stubborn"), pool: L("Reckless, Cool-Headed, Hot-Tempered, Old Sea Dog, Green, Greedy, Honorable, Merciful, Ruthless, Pragmatic") },
    "Pirate": { age: [18, 55], bold: L("Ruthless, Fearless, Wild, Greedy"), pool: L("Hot-Tempered, Cool-Headed, Reckless, Hard Drinker, Gambler, Loyal, Fickle, Vengeful, Forgiving, Superstitious, Suspicious, Rebellious, Old Sea Dog, Battle-Hardened"), rare: L("Merciful") },
    "Smuggler/Fence": { age: [22, 55], bold: L("Shrewd, Inscrutable, Suspicious, Discreet"), pool: L("Greedy, Corrupt, Pragmatic, Observant, Cool-Headed, Ruthless, Loyal, Fickle, Vengeful") },
    "Gentry/Planter": { age: [30, 65], bold: L("Refined, Proud, Vain"), pool: L("Pious, Tolerant, Generous, Greedy, Upstanding, Honorable, Loyalist, Gullible, Shrewd, Stubborn, Ambitious") },
    "Clergy": { age: [25, 70], bold: L("Pious"), pool: L("Merciful, Humble, Upstanding, Honorable, Bookish, Candid, Discreet, Superstitious, Idealistic, Stubborn, Generous"), rare: L("Tolerant") },
    "Healer": { age: [28, 65], bold: [], pool: L("Merciful, Bookish, Curious, Humble, Observant, Cool-Headed, Greedy, Generous, Candid, Discreet, Tolerant, Pious, Superstitious, Stubborn, Upstanding") },
    "Craftsman": { age: [24, 65], bold: [], pool: L("Shrewd, Candid, Taciturn, Jovial, Proud, Humble, Greedy, Generous, Honorable, Stubborn, Bookish, Observant, Loyal") },
    "Native": { age: [18, 60], bold: [], pool: L("Honorable, Proud, Suspicious, Observant, Cool-Headed, Fearless, Generous, Candid, Inscrutable, Taciturn, Shrewd, Pragmatic, Loyal, Vengeful, Forgiving, Stubborn") },
    "Agitator": { age: [18, 45], bold: L("Idealistic, Rebellious"), pool: L("Fearless, Reckless, Hot-Tempered, Candid, Stubborn, Bookish, Curious, Discreet, Suspicious, Loyal, Vengeful") },
    "Bondsman/Runaway": { age: [16, 55], bold: [], pool: L("Timid, Fearless, Suspicious, Humble, Loyal, Observant, Discreet, Taciturn, Candid, Stubborn, Pious, Forgiving") },
  };

  // §15.3 Mutually exclusive pairs: never drawn together.
  var EXCLUSIVE = [
    ["Upstanding", "Corrupt"], ["Greedy", "Generous"], ["Proud", "Humble"], ["Hot-Tempered", "Cool-Headed"],
    ["Timid", "Fearless"], ["Ruthless", "Merciful"], ["Shrewd", "Gullible"], ["Inscrutable", "Candid"],
    ["Pious", "Tolerant"], ["Rebellious", "Loyalist"], ["Refined", "Wild"], ["Jovial", "Taciturn"],
    ["Gossipy", "Discreet"], ["Loyal", "Fickle"], ["Vengeful", "Forgiving"],
  ];

  // §15.1 Persistent Minor women by role (placeholders), §25.1 generated
  // officers, and minigame opponents 0%. Prize captains are men in the
  // Slice (§36.1). Roles not listed are 0% until a chat rules otherwise.
  var WOMEN_BY_ROLE = {
    "Tavern Keeper": 0.35, "Merchant": 0.25, "Craftsman": 0.10, "Dockhand/Laborer": 0.05,
    "Officer": 0.10, "Opponent": 0, "Ship Captain": 0,
  };

  // §36.2 Titles by role. "honor" means the pool's honorific.
  var TITLES = {
    "Colonial Officer": { ranks: [["Lieutenant", 60], ["Captain", 30], ["Major", 10]] },
    "Ship Captain": { captain: true },
    "Clergy": { fixed: "Father" },
    "Healer": { fixed: "Doctor" },
    "Gentry/Planter": { honor: true }, "Official": { honor: true }, "Merchant": { honor: true },
  };

  PC.data.names = {
    POOLS: POOLS, BRETON: BRETON, MASTER_WEIGHTS: MASTER_WEIGHTS,
    BRETON_RATE: BRETON_RATE, BRETON_RATE_GENTRY: BRETON_RATE_GENTRY, GENTRY_ROLES: GENTRY_ROLES,
    RESERVED: RESERVED, NICKNAMES: NICKNAMES, NICKNAME_RATES: NICKNAME_RATES, NICKNAME_RATES_OCRACOKE: NICKNAME_RATES_OCRACOKE,
    SHIPS: SHIPS, PLAYER_SHIP_WEIGHTS: PLAYER_SHIP_WEIGHTS,
    ROLES: ROLES, EXCLUSIVE: EXCLUSIVE, WOMEN_BY_ROLE: WOMEN_BY_ROLE, TITLES: TITLES,
  };
})();
