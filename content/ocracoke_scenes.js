/* Ocracoke's first visit, both Startup quests, Restless & Ruined and the
 * one-armed pirate (§17.2), filed from the S17 appendix. The author's
 * language is final: lines are copied exactly, with tokens marked.
 *
 * Fields follow the §33 template (see content/test_scenes.js), plus:
 *   setup, labels and result text may be a list of pieces, some shown only
 *     { when: condition } (the author's [bar_wrecked] variant lines);
 *   an exit may be a list of { when, to } with a fallback id;
 *   exiting to the same scene id returns to its menu (an information step),
 *     with the answer shown above the choices;
 *   carry: true opens the next scene with this result's text as its setup;
 *   info: true marks an information step (no approval tags, §33.1.3).
 * The Miranda dive hands over to the salvage minigame (js/salvage.js, §18.2).
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};
  PC.data.scenes = PC.data.scenes || {};
  var scenes = {
    "ocr_sandbar": {
      "kind": "check",
      "title": "Ocracoke",
      "where": "Ocracoke, arrival",
      "ap": 0,
      "repeat": "once",
      "conditions": [
        "Shoals",
        "Shallow Draft"
      ],
      "cast": [
        "mentor"
      ],
      "setup": [
        "A cool, crisp sea breeze greets you as your sloop navigates toward the small island of Ocracoke. The wreckage of unfortunate ships litters the shoals. Beyond the hazardous shallows lies a smattering of ramshackle huts just past the beach, nestled amongst gentle, leafy trees.",
        {
          "when": {
            "any": [
              {
                "flaw": "Reckless"
              },
              {
                "flaw": "Glory-Hungry"
              }
            ]
          },
          "text": " You notice several people watching you from the beach, and you're confident you can make a strong first impression."
        },
        "\n\n\"Ocracoke isn't what it used to be,\" says [Mentor]. \"It was never prosperous, but at least it was fun. Now it's just a sad haunt for lonely pirates. Still, we can find some crew here and fix up this old sloop.\""
      ],
      "choices": [
        {
          "id": "pilot",
          "label": "Pilot her through the shallows yourself.",
          "check": {
            "type": "Pilot Shoals",
            "dr": 2
          },
          "approval": [
            "Glory"
          ],
          "outcomes": {
            "clean": {
              "text": "Your sloop glides between two sandbars. You wait for the scrape of hull on sand, but it doesn't come. You're through.",
              "effects": [],
              "exit": "ocr_mentor"
            },
            "partial": {
              "text": "Your sloop jolts and scrapes along a sandbar, but she keeps moving. You're through, barely.",
              "effects": [
                {
                  "hull": -1
                }
              ],
              "exit": "ocr_mentor"
            },
            "setback": {
              "text": "She skids along the bottom with a sickening scrape and begins to slow. A strong gust from astern fills your sails and shoves her clumsily over the sandbar.",
              "effects": [
                {
                  "hull": -3
                },
                {
                  "morale": -3
                }
              ],
              "exit": "ocr_mentor"
            }
          }
        },
        {
          "id": "mentor",
          "label": [
            {
              "when": {
                "not": {
                  "flaw": "Distrustful"
                }
              },
              "text": "Give [Mentor] the helm."
            },
            {
              "when": {
                "flaw": "Distrustful"
              },
              "text": "Reluctantly give [Mentor] the helm."
            }
          ],
          "check": {
            "type": "Leadership",
            "dr": 2
          },
          "approval": [
            "Caution"
          ],
          "outcomes": {
            "clean": {
              "text": "Your sloop glides between two sandbars. You wait for the scrape of hull on sand, but it doesn't come. You're through.",
              "effects": [],
              "exit": "ocr_mentor"
            },
            "partial": {
              "text": "Your sloop jolts and scrapes along a sandbar, but she keeps moving. You're through, barely.",
              "effects": [
                {
                  "hull": -1
                }
              ],
              "exit": "ocr_mentor"
            },
            "setback": {
              "text": "She skids along the bottom with a sickening scrape and begins to slow. A strong gust from astern fills your sails and shoves her clumsily over the sandbar.",
              "effects": [
                {
                  "hull": -3
                },
                {
                  "morale": -3
                }
              ],
              "exit": "ocr_mentor"
            }
          }
        },
        {
          "id": "full_sail",
          "label": "Full sail! We'll push straight through.",
          "hiddenUnless": {
            "not": {
              "any": [
                {
                  "flaw": "Reckless"
                },
                {
                  "flaw": "Glory-Hungry"
                }
              ]
            }
          },
          "check": {
            "type": "Gambit",
            "dr": 4
          },
          "approval": [
            "Risk"
          ],
          "outcomes": {
            "clean": {
              "text": "You pick up speed as you approach a gap in the shallows and sail straight through. Your crew exhales.",
              "effects": [
                {
                  "morale": 5
                },
                {
                  "flag": "bar_run_clean"
                }
              ],
              "exit": "ocr_mentor"
            },
            "partial": {
              "text": "As your ship picks up speed, she bumps and scrapes along the bottom of the shallows. You have just enough speed to successfully reach deeper water.",
              "effects": [
                {
                  "hull": -2
                }
              ],
              "exit": "ocr_mentor"
            },
            "setback": {
              "text": "A strong wind hits the sails and you speed toward the treacherous shallows. Almost immediately, the ship hits a sandbar and lurches violently, throwing you and your crew down onto the deck. She just barely makes it through and limps to shore, sinking lower as water rushes into a deep gash in her hull.",
              "effects": [
                {
                  "hull": -5
                },
                {
                  "provisions": -2
                },
                {
                  "morale": -5
                },
                {
                  "flag": "bar_wrecked"
                }
              ],
              "exit": "ocr_mentor"
            }
          }
        },
        {
          "id": "full_sail_tempted",
          "label": "Full sail! We'll push straight through.",
          "hiddenUnless": {
            "any": [
              {
                "flaw": "Reckless"
              },
              {
                "flaw": "Glory-Hungry"
              }
            ]
          },
          "temptation": true,
          "check": {
            "type": "Gambit",
            "dr": 3
          },
          "approval": [
            "Risk"
          ],
          "outcomes": {
            "clean": {
              "text": "You pick up speed as you approach a gap in the shallows and sail straight through. Your crew exhales.",
              "effects": [
                {
                  "morale": 5
                },
                {
                  "flag": "bar_run_clean"
                }
              ],
              "exit": "ocr_mentor"
            },
            "partial": {
              "text": "As your ship picks up speed, she bumps and scrapes along the bottom of the shallows. You have just enough speed to successfully reach deeper water.",
              "effects": [
                {
                  "hull": -2
                }
              ],
              "exit": "ocr_mentor"
            },
            "setback": {
              "text": "A strong wind hits the sails and you speed toward the treacherous shallows. Almost immediately, the ship hits a sandbar and lurches violently, throwing you and your crew down onto the deck. She just barely makes it through and limps to shore, sinking lower as water rushes into a deep gash in her hull.",
              "effects": [
                {
                  "hull": -5
                },
                {
                  "provisions": -2
                },
                {
                  "morale": -5
                },
                {
                  "flag": "bar_wrecked"
                }
              ],
              "exit": "ocr_mentor"
            }
          }
        }
      ],
      "id": "ocr_sandbar"
    },
    "ocr_mentor": {
      "kind": "beat",
      "title": "Ocracoke",
      "where": "Ocracoke, the beach",
      "ap": 0,
      "repeat": "once",
      "cast": [
        "mentor"
      ],
      "setup": [
        {
          "when": {
            "flag": "bar_run_clean"
          },
          "text": "The pirates lounging about on the beach whisper to each other as you splash down from your skiff in the clear, ankle-deep water. A few meet your gaze and nod."
        },
        {
          "when": {
            "all": [
              {
                "notFlag": "bar_run_clean"
              },
              {
                "notFlag": "bar_wrecked"
              }
            ]
          },
          "text": "The pirates lounging about on the beach barely pay you any mind as you splash down from your skiff in the clear, ankle-deep water."
        },
        {
          "when": {
            "flag": "bar_wrecked"
          },
          "text": "The pirates lounging about on the beach snicker to each other as you splash down from your skiff in the clear, ankle-deep water."
        },
        "\n\n\"Not much of a welcoming party,\" [Mentor] observes. \"We should head to the tavern first to get the latest news and see if anybody knows anything about [Loss Target]. We can also see about earning some coin.\"",
        "\n\n\"It also wouldn't hurt to recruit more men for our crew,\" {Mentor.he} continues. \"There seem to be a few strong-looking hands down by the dock. And there should be a shipwright around here who can do something about the sorry state of our ship.",
        {
          "when": {
            "flag": "bar_wrecked"
          },
          "text": " Especially since she's just taken a beating."
        },
        "\""
      ],
      "choices": [
        {
          "id": "on",
          "label": "Head up the beach.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_twopenny_1"
          }
        }
      ],
      "id": "ocr_mentor"
    },
    "ocr_twopenny_1": {
      "kind": "choice",
      "title": "Arthur Twopenny",
      "where": "Ocracoke, the beach",
      "ap": 0,
      "repeat": "once",
      "conditions": [
        "Vain NPC"
      ],
      "cast": [
        "twopenny",
        "mentor"
      ],
      "setup": [
        "As you and [Mentor] step onto the beach, you spot a short man in a dark coat and broad-brimmed black hat kicking up sand as he marches in your direction. An eyepatch covers his left eye, and a feather is tucked into his hat, which would be stylish if it weren't a gull feather. A few of the lounging pirates on the beach turn their heads to watch, seemingly amused.\n\n",
        {
          "when": {
            "flag": "bar_wrecked"
          },
          "text": "\"Clumsy on the approach, but I've seen worse. State your business,\" the man commands with as much authority as he can muster, coming to a halt a few feet away."
        },
        {
          "when": {
            "notFlag": "bar_wrecked"
          },
          "text": "\"State your business,\" the man commands with as much authority as he can muster, coming to a halt a few feet away."
        },
        "\n\nDespite the hat and the eyepatch, you can't imagine he's a day older than twenty-five. His oversized coat gives you the impression of a boy wearing his father's clothes."
      ],
      "choices": [
        {
          "id": "loss",
          "label": [
            {
              "when": {
                "loss": "A"
              },
              "text": "I'm looking for my brother. He was pressganged onto a pirate ship."
            },
            {
              "when": {
                "loss": "B"
              },
              "text": "My family's jewels were stolen by pirates. I've come to get them back."
            },
            {
              "when": {
                "loss": [
                  "C"
                ]
              },
              "text": "I'm looking for someone."
            }
          ],
          "approval": [
            "Honor"
          ],
          "result": {
            "text": "The man rolls his eyes. \"Don't need your whole sob story. Everyone here seems to have one.\"",
            "effects": [
              {
                "flag": "tp_told_loss"
              }
            ],
            "exit": "ocr_twopenny_fee"
          }
        },
        {
          "id": "passing",
          "label": "Just passing through, we won't be staying long.",
          "approval": [
            "Caution"
          ],
          "result": {
            "text": "The man raises a skeptical eyebrow. \"Appreciate all the detail, it makes me feel a lot better.\"",
            "effects": [],
            "exit": "ocr_twopenny_fee"
          }
        },
        {
          "id": "none_of_yours",
          "label": "My business doesn't concern you.",
          "approval": [
            "Defiance"
          ],
          "hiddenUnless": {
            "notFlag": "tp_warned"
          },
          "result": {
            "text": "The man stares you down. \"Careful, stranger. Crossing me may be the last thing you do. I'll give you one more chance.\"",
            "effects": [
              {
                "flag": "tp_warned"
              }
            ],
            "exit": "ocr_twopenny_1"
          }
        }
      ],
      "id": "ocr_twopenny_1"
    },
    "ocr_twopenny_fee": {
      "kind": "check",
      "title": "Arthur Twopenny",
      "where": "Ocracoke, the beach",
      "ap": 0,
      "repeat": "once",
      "conditions": [
        "Vain NPC"
      ],
      "cast": [
        "twopenny"
      ],
      "setup": "\"As Captain of this beach, it's my job to keep out the riffraff,\" he says. \"And as such, it's my duty to inform you that there's a fee to dock here, just like in a real port. Er, I mean, *because* this is a real port.\" You hear the pirates snickering.\n\n\"Twenty-five gold pieces is the standard fee, although you're welcome to make an additional donation to the Freedom Fund.\"",
      "choices": [
        {
          "id": "who",
          "label": "Who are you, and who made you Captain?",
          "approval": [],
          "info": true,
          "result": {
            "text": "He narrows his eyes. \"They call me Arthur Twopenny, and I'll have you know that it was Amber Jack himself that named me Captain of the beach. You should show some respect.\"",
            "effects": [
              {
                "meet": "twopenny"
              }
            ],
            "exit": "ocr_twopenny_fee"
          }
        },
        {
          "id": "fund",
          "label": "The Freedom Fund? What does that mean?",
          "approval": [],
          "info": true,
          "result": {
            "text": "\"Well, as you may have noticed, the town's been in rather a sorry state ever since Amber Jack disappeared. Or, I mean, since he made a *tactical retreat* to parts unknown. All gold donated to the Freedom Fund goes toward renovations.\" He points at a ladder and a lonely bucket of paint near one of the shacks.",
            "effects": [],
            "exit": "ocr_twopenny_fee"
          }
        },
        {
          "id": "small",
          "label": "You're a bit small for a Captain.",
          "approval": [
            "Defiance"
          ],
          "hiddenUnless": {
            "notFlag": "tp_mocked"
          },
          "result": {
            "text": "You hear a guffaw from one of the nearby pirates. The \"Captain\" grows beet red and places his hand on the hilt of his sword. \"I will not tolerate such insolence on my beach! Pay the fee and be on your way.\"",
            "effects": [
              {
                "flag": "tp_mocked"
              }
            ],
            "exit": "ocr_twopenny_fee"
          }
        },
        {
          "id": "flatter",
          "label": "Ocracoke is lucky to have such a strong leader.",
          "approval": [
            "Deceit"
          ],
          "lockedUnless": {
            "all": [
              {
                "notFlag": "tp_mocked"
              },
              {
                "notFlag": "tp_flattered"
              }
            ]
          },
          "lockedReason": "Not now",
          "check": {
            "type": "Persuade",
            "dr": 2
          },
          "outcomes": {
            "clean": {
              "text": "\"Oh, well I'm glad someone appreciates the work I put in around here. Tell you what, I'm willing to waive the fee just this once.\"",
              "effects": [
                {
                  "rung": {
                    "npc": "twopenny",
                    "set": "Friendly"
                  }
                }
              ],
              "exit": [
                {
                  "when": {
                    "flag": "tp_told_loss"
                  },
                  "to": "ocr_twopenny_pointer"
                },
                "ocr_twopenny_exit"
              ]
            },
            "partial": {
              "text": "\"Oh, well I'm glad someone appreciates the work I put in around here. Tell you what, I'm willing to give you a special discount since it's your first time here.\"",
              "effects": [
                {
                  "flag": "tp_flattered"
                },
                {
                  "flag": "tp_discount"
                }
              ],
              "exit": "ocr_twopenny_fee"
            },
            "setback": {
              "text": "\"Save your breath. Fee applies to everyone, I don't play favorites.\"",
              "effects": [
                {
                  "flag": "tp_flattered"
                }
              ],
              "exit": "ocr_twopenny_fee"
            }
          }
        },
        {
          "id": "pay",
          "label": "Pay the fee.",
          "approval": [
            "Caution"
          ],
          "hiddenUnless": {
            "notFlag": "tp_discount"
          },
          "cost": {
            "gold": 25,
            "pot": "crew"
          },
          "result": {
            "text": "He holds up a gold piece and inspects it closely. \"Satisfactory,\" he says. \"Welcome to Ocracoke.\"",
            "effects": [
              {
                "rung": {
                  "npc": "twopenny",
                  "set": "Neutral"
                },
                "when": {
                  "notFlag": "tp_mocked"
                }
              }
            ],
            "exit": [
              {
                "when": {
                  "flag": "tp_told_loss"
                },
                "to": "ocr_twopenny_pointer"
              },
              "ocr_twopenny_exit"
            ]
          }
        },
        {
          "id": "pay_discount",
          "label": "Pay the fee.",
          "approval": [
            "Caution"
          ],
          "hiddenUnless": {
            "flag": "tp_discount"
          },
          "cost": {
            "gold": 10,
            "pot": "crew"
          },
          "result": {
            "text": "He holds up a gold piece and inspects it closely. \"Satisfactory,\" he says. \"Welcome to Ocracoke.\"",
            "effects": [
              {
                "rung": {
                  "npc": "twopenny",
                  "set": "Neutral"
                },
                "when": {
                  "notFlag": "tp_mocked"
                }
              }
            ],
            "exit": [
              {
                "when": {
                  "flag": "tp_told_loss"
                },
                "to": "ocr_twopenny_pointer"
              },
              "ocr_twopenny_exit"
            ]
          }
        },
        {
          "id": "donate",
          "label": "Pay the fee, and make a donation.",
          "approval": [
            "Generosity"
          ],
          "cost": {
            "gold": 50,
            "pot": "crew"
          },
          "result": {
            "text": "\"Quite generous of you!\" he proclaims, bowing theatrically as he accepts the gold. \"Please, make yourself at home. Anything you need, Captain Twopenny is your man!\"",
            "effects": [
              {
                "rung": {
                  "npc": "twopenny",
                  "set": "Friendly"
                },
                "when": {
                  "notFlag": "tp_mocked"
                }
              }
            ],
            "exit": [
              {
                "when": {
                  "flag": "tp_told_loss"
                },
                "to": "ocr_twopenny_pointer"
              },
              "ocr_twopenny_exit"
            ]
          }
        },
        {
          "id": "refuse",
          "label": "I'm not giving you anything.",
          "approval": [
            "Defiance"
          ],
          "hiddenUnless": {
            "all": [
              {
                "notFlag": "bar_run_clean"
              },
              {
                "notFlag": "bar_wrecked"
              }
            ]
          },
          "check": {
            "type": "Intimidate",
            "dr": 2
          },
          "outcomes": {
            "clean": {
              "text": "The man holds up his arms. \"Okay, okay, calm down. Since it's your first visit, I'm willing to waive the fee, just this once.\"",
              "effects": [
                {
                  "dread": 2
                }
              ],
              "exit": [
                {
                  "when": {
                    "flag": "tp_told_loss"
                  },
                  "to": "ocr_twopenny_pointer"
                },
                "ocr_twopenny_exit"
              ]
            },
            "partial": {
              "text": "He scrunches his nose. \"Since you're clearly a bit touched in the head, I'll give you a discount. Ten gold pieces, this time only.\"",
              "effects": [],
              "exit": "ocr_twopenny_partial",
              "carry": true
            },
            "setback": {
              "text": "\"Perhaps you didn't hear me,\" he says, growing tense. \"Pay up, or you're in for trouble.\"",
              "effects": [],
              "exit": "ocr_twopenny_setback",
              "carry": true
            }
          }
        },
        {
          "id": "refuse_clean_run",
          "label": "I'm not giving you anything.",
          "approval": [
            "Defiance"
          ],
          "hiddenUnless": {
            "flag": "bar_run_clean"
          },
          "check": {
            "type": "Intimidate",
            "dr": 1
          },
          "outcomes": {
            "clean": {
              "text": "The man holds up his arms. \"Okay, okay, calm down. Since it's your first visit, I'm willing to waive the fee, just this once.\"",
              "effects": [
                {
                  "dread": 2
                }
              ],
              "exit": [
                {
                  "when": {
                    "flag": "tp_told_loss"
                  },
                  "to": "ocr_twopenny_pointer"
                },
                "ocr_twopenny_exit"
              ]
            },
            "partial": {
              "text": "He scrunches his nose. \"Since you're clearly a bit touched in the head, I'll give you a discount. Ten gold pieces, this time only.\"",
              "effects": [],
              "exit": "ocr_twopenny_partial",
              "carry": true
            },
            "setback": {
              "text": "\"Perhaps you didn't hear me,\" he says, growing tense. \"Pay up, or you're in for trouble.\"",
              "effects": [],
              "exit": "ocr_twopenny_setback",
              "carry": true
            }
          }
        },
        {
          "id": "refuse_wrecked",
          "label": "I'm not giving you anything.",
          "approval": [
            "Defiance"
          ],
          "hiddenUnless": {
            "flag": "bar_wrecked"
          },
          "check": {
            "type": "Intimidate",
            "dr": 3
          },
          "outcomes": {
            "clean": {
              "text": "The man holds up his arms. \"Okay, okay, calm down. Since it's your first visit, I'm willing to waive the fee, just this once.\"",
              "effects": [
                {
                  "dread": 2
                }
              ],
              "exit": [
                {
                  "when": {
                    "flag": "tp_told_loss"
                  },
                  "to": "ocr_twopenny_pointer"
                },
                "ocr_twopenny_exit"
              ]
            },
            "partial": {
              "text": "He scrunches his nose. \"Since you're clearly a bit touched in the head, I'll give you a discount. Ten gold pieces, this time only.\"",
              "effects": [],
              "exit": "ocr_twopenny_partial",
              "carry": true
            },
            "setback": {
              "text": "\"Perhaps you didn't hear me,\" he says, growing tense. \"Pay up, or you're in for trouble.\"",
              "effects": [],
              "exit": "ocr_twopenny_setback",
              "carry": true
            }
          }
        }
      ],
      "id": "ocr_twopenny_fee"
    },
    "ocr_twopenny_partial": {
      "kind": "check",
      "title": "Arthur Twopenny",
      "where": "Ocracoke, the beach",
      "ap": 0,
      "repeat": "once",
      "cast": [
        "twopenny"
      ],
      "setup": "",
      "choices": [
        {
          "id": "pay",
          "label": "Pay the fee.",
          "approval": [
            "Caution"
          ],
          "cost": {
            "gold": 10,
            "pot": "crew"
          },
          "result": {
            "text": "He holds up a gold piece and inspects it closely. \"Satisfactory,\" he says. \"Welcome to Ocracoke.\"",
            "effects": [],
            "exit": [
              {
                "when": {
                  "flag": "tp_told_loss"
                },
                "to": "ocr_twopenny_pointer"
              },
              "ocr_twopenny_exit"
            ]
          }
        },
        {
          "id": "shove",
          "label": "Push him over.",
          "approval": [
            "Risk"
          ],
          "check": {
            "type": "Brawling",
            "dr": 2
          },
          "outcomes": {
            "clean": {
              "text": "You catch him off guard and push him straight back. He flails his arms helplessly as he falls backward onto the sand. You step over him and head for the tavern as the pirates laugh hysterically.",
              "effects": [
                {
                  "dread": 3
                },
                {
                  "rung": {
                    "npc": "twopenny",
                    "set": "Rival"
                  }
                },
                {
                  "flag": "tp_humiliated"
                }
              ],
              "exit": "ocr_twopenny_exit"
            },
            "partial": {
              "text": "You give him a hard shove and he stumbles backward, but not before he grabs your collar. You both tumble to the ground and grapple pathetically in the sand as the nearby pirates howl with laughter. After several minutes, you're both too tired to continue and lie on your backs staring up at the sky. \"We'll call it a draw,\" he pants. \"Welcome to Ocracoke.\"",
              "effects": [
                {
                  "rung": {
                    "npc": "twopenny",
                    "set": "Neutral"
                  },
                  "when": {
                    "notFlag": "tp_mocked"
                  }
                }
              ],
              "exit": "ocr_twopenny_exit"
            },
            "setback": {
              "text": "He grabs your arm and twists, throwing you to the ground. He's surprisingly strong for his size. The pirates laugh hysterically as he scoops up a few of your gold pieces off the sand and walks off, whistling a jaunty tune.",
              "effects": [
                {
                  "gold": -25,
                  "pot": "crew"
                },
                {
                  "rung": {
                    "npc": "twopenny",
                    "set": "Neutral"
                  },
                  "when": {
                    "notFlag": "tp_mocked"
                  }
                },
                {
                  "flag": "tp_beat_you"
                }
              ],
              "exit": "ocr_twopenny_exit"
            }
          }
        }
      ],
      "id": "ocr_twopenny_partial"
    },
    "ocr_twopenny_setback": {
      "kind": "check",
      "title": "Arthur Twopenny",
      "where": "Ocracoke, the beach",
      "ap": 0,
      "repeat": "once",
      "cast": [
        "twopenny"
      ],
      "setup": "",
      "choices": [
        {
          "id": "pay",
          "label": "Pay the fee.",
          "approval": [
            "Caution"
          ],
          "cost": {
            "gold": 25,
            "pot": "crew"
          },
          "result": {
            "text": "He holds up a gold piece and inspects it closely. \"Satisfactory,\" he says. \"Welcome to Ocracoke.\"",
            "effects": [],
            "exit": [
              {
                "when": {
                  "flag": "tp_told_loss"
                },
                "to": "ocr_twopenny_pointer"
              },
              "ocr_twopenny_exit"
            ]
          }
        },
        {
          "id": "shove",
          "label": "Push him over.",
          "approval": [
            "Risk"
          ],
          "check": {
            "type": "Brawling",
            "dr": 2
          },
          "outcomes": {
            "clean": {
              "text": "You catch him off guard and push him straight back. He flails his arms helplessly as he falls backward onto the sand. You step over him and head for the tavern as the pirates laugh hysterically.",
              "effects": [
                {
                  "dread": 3
                },
                {
                  "rung": {
                    "npc": "twopenny",
                    "set": "Rival"
                  }
                },
                {
                  "flag": "tp_humiliated"
                }
              ],
              "exit": "ocr_twopenny_exit"
            },
            "partial": {
              "text": "You give him a hard shove and he stumbles backward, but not before he grabs your collar. You both tumble to the ground and grapple pathetically in the sand as the nearby pirates howl with laughter. After several minutes, you're both too tired to continue and lie on your backs staring up at the sky. \"We'll call it a draw,\" he pants. \"Welcome to Ocracoke.\"",
              "effects": [
                {
                  "rung": {
                    "npc": "twopenny",
                    "set": "Neutral"
                  },
                  "when": {
                    "notFlag": "tp_mocked"
                  }
                }
              ],
              "exit": "ocr_twopenny_exit"
            },
            "setback": {
              "text": "He grabs your arm and twists, throwing you to the ground. He's surprisingly strong for his size. The pirates laugh hysterically as he scoops up a few of your gold pieces off the sand and walks off, whistling a jaunty tune.",
              "effects": [
                {
                  "gold": -25,
                  "pot": "crew"
                },
                {
                  "rung": {
                    "npc": "twopenny",
                    "set": "Neutral"
                  },
                  "when": {
                    "notFlag": "tp_mocked"
                  }
                },
                {
                  "flag": "tp_beat_you"
                }
              ],
              "exit": "ocr_twopenny_exit"
            }
          }
        }
      ],
      "id": "ocr_twopenny_setback"
    },
    "ocr_twopenny_pointer": {
      "kind": "beat",
      "title": "Arthur Twopenny",
      "where": "Ocracoke, the beach",
      "ap": 0,
      "repeat": "once",
      "cast": [
        "twopenny"
      ],
      "setup": [
        "\"Your best bet to find what you're looking for would be the tavern.\" He points at a structure that appears to be several smaller shacks pushed together, with a door that's falling off its hinges. A crude wooden sign hanging near the door depicts a cup.",
        {
          "when": {
            "loss": [
              "A",
              "C"
            ]
          },
          "text": " \"There's a one-armed pirate in there who mentioned something like that.\""
        },
        {
          "when": {
            "loss": "B"
          },
          "text": " \"Talk to Bobby Rats. Stolen treasure tends to find its way to him.\""
        }
      ],
      "choices": [
        {
          "id": "on",
          "label": "Continue.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_twopenny_exit"
          }
        }
      ],
      "id": "ocr_twopenny_pointer"
    },
    "ocr_twopenny_exit": {
      "kind": "beat",
      "title": "Ocracoke",
      "where": "Ocracoke, the beach",
      "ap": 0,
      "repeat": "once",
      "setup": "Your business with the Captain resolved, you make your way toward the tavern.",
      "choices": [
        {
          "id": "on",
          "label": "Continue.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [
              {
                "meet": "twopenny"
              },
              {
                "flag": "ocr_opening_done"
              },
              {
                "goPlace": "tavern"
              }
            ],
            "exit": "hub"
          }
        }
      ],
      "id": "ocr_twopenny_exit"
    },
    "ocr_rr_1": {
      "kind": "choice",
      "title": "Restless & Ruined",
      "where": "Ocracoke, Docks",
      "ap": 0,
      "repeat": "once",
      "cast": [
        "davey",
        "shipwright"
      ],
      "setup": "You head toward the docks, where an assortment of barefoot pirates talk quietly amongst themselves. Some of them eye you with suspicion as you approach.\n\nApart from this group, however, you notice a broad-shouldered young man with close-cropped blonde hair on all fours, attempting to lure a small black monkey with a piece of hardtack. The suspicious monkey is keeping its distance.\n\n\"We're friends, remember?\" he reminds the monkey. \"I've got some food for you. Here, buddy.\"\n\nHe tosses the piece of hardtack at the monkey, and it bolts. The young man lets out a heavy sigh.\n\nAs he notices you approaching, he stands up straight and his immense size becomes apparent. He's at least six and a half feet tall, with powerful forearms and calves nearly as big as your head. He beams a gleaming smile as he towers over you.\n\n\"Hello, {captain.sir}! You wouldn't happen to be looking for strong crewmen, would you?\"",
      "choices": [
        {
          "id": "hardtack",
          "label": "I don't think monkeys like hardtack. In fact, I don't think anybody does.",
          "approval": [],
          "result": {
            "text": "The man appears confused. \"What do you mean? It's salty and delicious, and it keeps you busy for hours!\" He scoops the sandy piece of hardtack off the ground and pops it in his mouth.",
            "effects": [],
            "exit": "ocr_rr_2"
          }
        },
        {
          "id": "enormous",
          "label": "Goodness, you're enormous!",
          "approval": [],
          "result": {
            "text": "His smile widens. \"Been this big since I was a boy. Most people are scared of me, but the monkeys don't mind.\"",
            "effects": [],
            "exit": "ocr_rr_2"
          }
        },
        {
          "id": "who",
          "label": "As a matter of fact, I am. Who might you be?",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_rr_2"
          }
        }
      ],
      "id": "ocr_rr_1"
    },
    "ocr_rr_2": {
      "kind": "check",
      "title": "Restless & Ruined",
      "where": "Ocracoke, Docks",
      "ap": 0,
      "repeat": "once",
      "cast": [
        "davey"
      ],
      "setup": "The man extends a tremendous hand in your direction. \"I'm Davey Dell, pleased to meet you.\" He nearly crushes your hand before letting go.",
      "choices": [
        {
          "id": "why",
          "label": "Why are you looking for a new crew?",
          "approval": [],
          "info": true,
          "result": {
            "text": "Davey's face drops, and he appears saddened by your question. \"My last crew went their separate ways a while ago, and by now I'm all out of gold to spend. And as much as I like the monkeys here, I'm starting to get bored.\"",
            "effects": [],
            "exit": "ocr_rr_2"
          }
        },
        {
          "id": "qualifications",
          "label": "You certainly seem eager. What are your qualifications?",
          "approval": [],
          "info": true,
          "result": {
            "text": "\"Well, mainly I've got a big axe and I love a good fight. I've sailed with a few different crews but they never seemed to stay together long. Looking for the right crew to sign on with.\"",
            "effects": [],
            "exit": "ocr_rr_2"
          }
        },
        {
          "id": "join",
          "label": "You look like you could be quite useful in a fight. You should join my crew.",
          "approval": [],
          "check": {
            "type": "Persuade",
            "dr": 2
          },
          "outcomes": {
            "clean": {
              "text": "Davey grins and gives you a heavy pat on the shoulder. \"Fantastic!\"",
              "effects": [
                {
                  "join": "davey"
                }
              ],
              "exit": "ocr_rr_recruited"
            },
            "partial": {
              "text": "\"Fantastic!\" Davey says, leaning in closer. \"Although I do owe a wee bit of money to the tavern keeper. I'll sign on if you pay my tab.\"",
              "effects": [],
              "exit": "ocr_rr_tab",
              "carry": true
            },
            "setback": {
              "text": "Davey frowns and glances over at the other pirates. \"Wait a minute, are you the new captain those fellows were talking about? The one with the sloop that's falling apart? I think I'd rather wait for a better captain to come along, sorry.\" He heads for the tavern.",
              "effects": [
                {
                  "flag": "davey_at_tavern"
                },
                {
                  "flag": "ocr_rr_done"
                }
              ],
              "exit": "hub"
            }
          }
        },
        {
          "id": "no",
          "label": "Not interested.",
          "approval": [],
          "result": {
            "text": "Davey hangs his head in disappointment. \"Oh, alright then. Thought I had gotten lucky. If you change your mind, I'll be in the tavern.\"",
            "effects": [
              {
                "flag": "davey_at_tavern"
              },
              {
                "flag": "ocr_rr_done"
              }
            ],
            "exit": "hub"
          }
        }
      ],
      "id": "ocr_rr_2"
    },
    "ocr_rr_tab": {
      "kind": "choice",
      "title": "Restless & Ruined",
      "where": "Ocracoke, Docks",
      "ap": 0,
      "repeat": "once",
      "cast": [
        "davey"
      ],
      "setup": "",
      "choices": [
        {
          "id": "pay",
          "label": "I'd be happy to.",
          "approval": [],
          "cost": {
            "gold": 150,
            "pot": "crew"
          },
          "result": {
            "text": "",
            "effects": [
              {
                "join": "davey"
              },
              {
                "flag": "rr_paid"
              }
            ],
            "exit": "ocr_rr_recruited"
          }
        },
        {
          "id": "never",
          "label": "On second thought, never mind.",
          "approval": [],
          "result": {
            "text": "Davey hangs his head in disappointment. \"Oh, alright then. Thought I had gotten lucky. If you change your mind, I'll be in the tavern.\"",
            "effects": [
              {
                "flag": "davey_at_tavern"
              },
              {
                "flag": "ocr_rr_done"
              }
            ],
            "exit": "hub"
          }
        }
      ],
      "id": "ocr_rr_tab"
    },
    "ocr_rr_recruited": {
      "kind": "beat",
      "title": "Restless & Ruined",
      "where": "Ocracoke, Docks",
      "ap": 0,
      "repeat": "once",
      "cast": [
        "davey",
        "shipwright"
      ],
      "setup": [
        "\"Come with me while I gather my things!\" he says, marching onto the long, crooked wooden dock. You follow, not wanting to disappoint your newest and largest crew member.\n\n\"If you're new here, you oughta speak with the shipwright too,\" he remarks as he walks toward a flimsy wooden warehouse perched further down the dock. \"He's the best person to talk to about repairing a damaged ship, and he's got new rigging and strong wood, so your ship sails better. He also sells cannons and buys old ships. A great guy to know. I'll introduce you!\"\n\nDavey steps into the soggy warehouse, where the shipwright is busy nailing together several wooden planks. {shipwright.He} looks up as you and Davey approach. \"Captain, this is {shipwright.mr} Shipwright,\" says Davey. \"{shipwright.mr} Shipwright, this is Captain...uh...\" he glances in your direction. \"This is my new Captain, whose name I will learn soon!\" He turns back toward the shipwright. \"I'm here for my axe back.\"\n\nWithout waiting for a response, Davey gingerly steps over the assorted tools on the floor and picks up a large iron battleaxe from among the shipwright's tools. He holds it aloft and smiles at you. \"{shipwright.He} said {shipwright.he} didn't need it, but {shipwright.he} works with so much wood! I let {shipwright.him} borrow it just in case.\" The shipwright rolls {shipwright.his} eyes.\n\n",
        {
          "when": {
            "flag": "rr_paid"
          },
          "text": "\"Well, I'm off to pay my tab,\" Davey announces. \"I'll meet you at the ship, Captain!\""
        },
        {
          "when": {
            "notFlag": "rr_paid"
          },
          "text": "\"Well, I'm off to say goodbye to the monkeys,\" Davey announces. \"I'll meet you at the ship, Captain!\""
        },
        "\n\nWith that, Davey Dell marches off back down the dock, leaving you in the warehouse with the shipwright, who sighs heavily.\n\n\"Good luck with that one,\" {shipwright.he} says. \"Now, what can I do for you?\""
      ],
      "choices": [
        {
          "id": "on",
          "label": "Continue.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [
              {
                "flag": "ocr_rr_done"
              }
            ],
            "exit": "hub"
          }
        }
      ],
      "id": "ocr_rr_recruited"
    },
    "ocr_dpw_1": {
      "kind": "choice",
      "where": "Ocracoke, outside the Tavern",
      "setup": "As you and [Mentor] leave the tavern, you notice a stocky young man running up the beach. He appears to spot you, then slows down, wheezing with exhaustion.\n\n\"Hello...there,\" he greets you, catching his breath. \"Just...just the {captain.man} I was looking for. You're the one who arrived in...that sloop earlier, right?\"\n\n\"I was wondering if you might want to make a bit of coin,\" the man says as he collects himself. He's about as wide as he is tall, built like a barrel, with a tuft of light blonde hair atop his head. \"There's something my father needs your help with.\"",
      "choices": [
        {
          "id": "why_me",
          "label": "And why me specifically? I just got here.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_2"
          }
        },
        {
          "id": "detail",
          "label": "Happy to help, if you give me a bit more detail.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_2"
          }
        },
        {
          "id": "whole_story",
          "label": "Feels like you're not giving me the whole story.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_2"
          }
        },
        {
          "id": "spit",
          "label": "Well then, spit it out already.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_2"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie",
        "mentor"
      ],
      "id": "ocr_dpw_1"
    },
    "ocr_dpw_2": {
      "kind": "choice",
      "where": "Ocracoke, outside the Tavern",
      "setup": "\"Well, you see, my father needs help retrieving something from the wrecks further up the beach,\" he says sheepishly. \"Do you know how to swim?\"\n\nYou look past him and spot a forest of broken masts rising like barren trees in the distance.",
      "choices": [
        {
          "id": "natural",
          "label": "Absolutely, I'm a natural in the water.",
          "approval": [],
          "result": {
            "text": "\"Oh, fantastic! You'll be a perfect fit for this then.\"",
            "effects": [],
            "exit": "ocr_dpw_3"
          }
        },
        {
          "id": "of_course",
          "label": "Of course I know how to swim.",
          "approval": [],
          "result": {
            "text": "\"Good, good. That's all this job requires!\"",
            "effects": [],
            "exit": "ocr_dpw_3"
          }
        },
        {
          "id": "enough",
          "label": "I know enough to not drown.",
          "approval": [],
          "result": {
            "text": "\"Hmm, I think that should be good enough.\"",
            "effects": [],
            "exit": "ocr_dpw_3"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie"
      ],
      "id": "ocr_dpw_2"
    },
    "ocr_dpw_3": {
      "kind": "choice",
      "where": "Ocracoke, outside the Tavern",
      "setup": "\"It's just...well...it's been hard to find anyone to help around here. They're a superstitious lot, and they think those wrecks are haunted. I assure you they aren't. And my father isn't doing so well. He may not be long for this world, and I want to grant him this one last wish before he goes.\"\n\n\"Seems simple enough,\" [Mentor] whispers. \"We could use the money to fix up our ship.\"",
      "choices": [
        {
          "id": "happy",
          "label": "I'd be happy to help! Sounds like it's important to your father.",
          "approval": [
            "Mercy"
          ],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_4"
          }
        },
        {
          "id": "paying",
          "label": "I'll do it, but only because you're paying.",
          "approval": [
            "Plunder"
          ],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_4"
          }
        },
        {
          "id": "pay_well",
          "label": "Fine. It had better pay well.",
          "approval": [
            "Plunder"
          ],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_4"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie",
        "mentor"
      ],
      "id": "ocr_dpw_3"
    },
    "ocr_dpw_4": {
      "kind": "choice",
      "where": "Ocracoke, the beach",
      "setup": "\"Huzzah!\" the man cheers. \"This way, I'll lead you to the wrecks.\"\n\n\"I'll go see to the crew,\" says [Mentor]. {mentor.He} heads back toward the *[Ship Name]*.\n\nYou both trudge up the beach for a long while - you guess a mile or two - during which the man introduces himself as Ollie Flanagan, born and raised in Ocracoke and his father's caretaker. He keeps repeating how grateful he is for your help, and when you attempt to get more information, he changes the subject, asking instead if you've seen a small black monkey anywhere.\n\nAs you approach the wrecks, you realize that the forest of masts is more grotesque than it looks from afar. It stretches out past the surf, with a dozen small ships wrecked just off the beach and an unknown number of larger wrecks further out in the depths. Gulls perch on the broken masts, screeching as you grow near. Every ship you can see is green with rot, half-buried in sand, or both.\n\n\"This was the site of a huge battle,\" Ollie says, noticing you staring. \"It's the exact spot where Captain Lilyhook met his end over thirty years ago. That's why the pirates on the beach think it's haunted - Lilyhook's Graveyard, they call it. Won't come near it.\"",
      "choices": [
        {
          "id": "icy_terror",
          "label": "Captain Lilyhook, the Icy Terror, Scourge of the Spanish Coast? He's down there somewhere?",
          "approval": [],
          "result": {
            "text": "\"You know your pirate history! Yes, that's what they say. Along with the rest of his fleet, after Admiral Rose blasted them to bits.\"",
            "effects": [
              {
                "meet": "ollie"
              }
            ],
            "exit": "ocr_dpw_5"
          }
        },
        {
          "id": "familiar",
          "label": "Lilyhook...sounds familiar.",
          "approval": [],
          "result": {
            "text": "\"You don't know him? He's only one of the greatest, most fearsome pirates to ever sail the Atlantic! At least, until his fleet was blown to smithereens by Admiral Rose in this very spot.\"",
            "effects": [
              {
                "meet": "ollie"
              }
            ],
            "exit": "ocr_dpw_5"
          }
        },
        {
          "id": "who",
          "label": "Who is Captain Lilyhook?",
          "approval": [],
          "result": {
            "text": "Ollie looks at you incredulously. \"Only one of the greatest, most fearsome pirates to ever sail the Atlantic! Terrorized Spain for years before crossing to this side of the sea. His fleet was blown to smithereens by Admiral Rose in this very spot.\"",
            "effects": [
              {
                "meet": "ollie"
              }
            ],
            "exit": "ocr_dpw_5"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie"
      ],
      "id": "ocr_dpw_4"
    },
    "ocr_dpw_5": {
      "kind": "choice",
      "where": "Ocracoke, Lilyhook's Graveyard",
      "setup": "You follow Ollie past the wrecks to a small tent on the beach, surrounded by barrels and an assortment of tools. \"Can't wait for you to meet Pops!\" Ollie says excitedly.\n\nOllie's Pops, you see as you peer inside the tent, is a small, shriveled man with a long white beard. He's missing both legs, and lies motionless on his back, seemingly oblivious to you. You look at Ollie, and he smiles. \"Go on, he won't bite! Doesn't have teeth any more.\"\n\nYou gingerly push aside the tent flap and enter the tent. As you do, the old man suddenly jolts awake, startling you as he sits up. He peers directly at you with cloudy eyes.\n\n\"Arr, avast ye,\" he growls in a thick, antiquated accent. \"Who goes thar? That be the devil, here to take me below?\"\n\n\"It's just me, Pops,\" Ollie announces. \"And I've brought someone who can help you find your treasure.\"\n\n\"Yarrr,\" the old man coos approvingly, wiggling his leg stumps. \"That be the best news since me Martha died. Old hag, yer mother was.\" Ollie shifts uncomfortably. \"What be yer name, newcomer?\"",
      "choices": [
        {
          "id": "yarr",
          "label": "Erm, *yarr*. I be Captain {captain.last}. Ye be wantin' a favor?",
          "approval": [
            "Revelry"
          ],
          "result": {
            "text": "\"I can hear in yer voice, ye be a true pirate. Ye speak true,\" the old man says. Ollie smiles approvingly.",
            "effects": [],
            "exit": "ocr_dpw_6"
          }
        },
        {
          "id": "full",
          "label": "I'm {captain.full}. Ollie tells me you need a favor?",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_6"
          }
        },
        {
          "id": "gold",
          "label": "{captain.full}. Ollie says you've got gold for me?",
          "approval": [
            "Plunder"
          ],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_6"
          }
        },
        {
          "id": "no_time",
          "label": "I don't have time for this. Just tell me what you need.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_6"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie",
        "geezer"
      ],
      "id": "ocr_dpw_5"
    },
    "ocr_dpw_6": {
      "kind": "choice",
      "where": "Ocracoke, Lilyhook's Graveyard",
      "setup": "\"Aye, a favor I ask. Me last wish 'fore the devil takes me below. See, one of them wrecks out thar, the *Miranda*, she was once me true love. Sailed aboard her, many years, under the dread Cap'n Lilyhook. Tossed me ashore, they did, after me legs was blown off on the first day o' battle. Fer three days they fought the bastard Rose out thar,\" he points toward the wrecks. \"Me, lyin' on the sand, no legs, not a chance o' helpin' me crew or defendin' me love.\"\n\n\"In me bloody daze, I left somethin' aboard.\" He scrunches his face and hacks up a nasty cough.\n\n\"A mermaid, she was. Small and ivory, beautiful as the sea. I've missed her every day since, but ne'er has she been found among the wrecks. Me landlubber of a son can't swim worth a damn. Need someone to dive down and find 'er, 'fore the devil takes me. One last wish fer ol' Geezer Flanagan.\"",
      "choices": [
        {
          "id": "lass",
          "label": "Yarr, I'll do me best to find yer mermaid lass.",
          "approval": [
            "Revelry"
          ],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_7"
          }
        },
        {
          "id": "figurine",
          "label": "You need me to dive into the wrecks and find an ivory mermaid figurine? I'd be happy to look for her.",
          "approval": [
            "Mercy"
          ],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_7"
          }
        },
        {
          "id": "no_promises",
          "label": "An ivory mermaid? I'll try, but if she hasn't been found by now, I can't make any promises.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_7"
          }
        },
        {
          "id": "worth_it",
          "label": "Ugh, fine. This had better be worth it.",
          "approval": [
            "Plunder"
          ],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_7"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "geezer"
      ],
      "id": "ocr_dpw_6"
    },
    "ocr_dpw_7": {
      "kind": "choice",
      "where": "Ocracoke, Lilyhook's Graveyard",
      "setup": "The old man wiggles his leg stumps once more. \"Yarr, ye be a fine sailor to help ol' Geezer. The winds be in yer favor.\"\n\nWith that, Ollie takes you by the arm and leads you back out of the tent. \"Sorry, he can be a bit hard to understand,\" he says. \"He's one of the old pirates. Not many left. It would mean the world to him if you could find his ivory mermaid figurine.\"",
      "choices": [
        {
          "id": "really",
          "label": "Did your father really sail with Lilyhook?",
          "approval": [],
          "result": {
            "text": "\"Aye, and he's never stopped talking about it. Must have been hard to watch his friends die out there. That story has always made me sad.\"",
            "effects": [],
            "exit": "ocr_dpw_7"
          },
          "info": true
        },
        {
          "id": "legs",
          "label": "How did your father survive with both his legs blown off?",
          "approval": [],
          "result": {
            "text": "\"He'll tell you that a sea turtle swam ashore and stitched him up. More likely, it was one of the locals that stopped the bleeding. But to this day, the turtle gets all the credit.\"",
            "effects": [],
            "exit": "ocr_dpw_7"
          },
          "info": true
        },
        {
          "id": "old",
          "label": "How old is your father, anyway?",
          "approval": [],
          "result": {
            "text": "\"Oh, he's ancient. Has to be at least fifty-five, maybe even sixty.\"",
            "effects": [],
            "exit": "ocr_dpw_7"
          },
          "info": true
        },
        {
          "id": "like_him",
          "label": "He talks a bit funny, but I like him.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_dive"
          }
        },
        {
          "id": "get_on",
          "label": "Let's just get on with it. I need the coin.",
          "approval": [
            "Plunder"
          ],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_dive"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie"
      ],
      "manyChoices": true,
      "id": "ocr_dpw_7"
    },
    "ocr_dpw_dive": {
      "kind": "beat",
      "where": "Ocracoke, Lilyhook's Graveyard",
      "setup": "Ollie leads you to the shore and points out toward the middle of the wrecks, where two giant masts barely peek above the waterline. \"That big one is the *Miranda* out there. She was one of Lilyhook's ships. Pops sailed on her for years. Look for as long as you need to.\"\n\nYou wade out past the surf, and dive into the water.",
      "choices": [
        {
          "id": "dive",
          "label": "Dive for the mermaid.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [
              {
                "minigame": "miranda"
              }
            ],
            "exit": "hub"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 1,
      "conditions": [
        "Underwater"
      ],
      "cast": [
        "ollie"
      ],
      "id": "ocr_dpw_dive"
    },
    "ocr_dpw_shark": {
      "note": "One step easier in UI pass 1 (§38.8): Swim DR 1 (was 2), the knife DR 2 (was 3).",
      "kind": "check",
      "where": "Ocracoke, Lilyhook's Graveyard",
      "setup": "You surface and take big gulps of air. You hold the ivory mermaid aloft for Ollie on the beach, who whoops and cheers. Suddenly, he stops cheering. \"Look behind you!\" he shouts.\n\nYou turn around and spot a large, grey fin rapidly cutting through the water, heading right toward you.",
      "choices": [
        {
          "id": "swim",
          "label": "Swim for the beach!",
          "approval": [
            "Caution"
          ],
          "check": {
            "type": "Dive",
            "dr": 1
          },
          "outcomes": {
            "clean": {
              "text": "You swim as hard as you can and make it to shore as the shark turns away.",
              "effects": [],
              "exit": "ocr_dpw_8"
            },
            "partial": {
              "text": "You swim as hard as you can and just barely make it to shore, gulping a large amount of seawater in the process.",
              "effects": [],
              "exit": "ocr_dpw_8"
            },
            "setback": {
              "text": "You swim as hard as you can, but the tide pulls you backward toward the shark. You cry out as it sinks its jagged teeth into your leg, but it finally relents as the waves push you into shallower water, taking a chunk of your thigh with it.",
              "effects": [
                {
                  "tag": "Wounded",
                  "untilSeasonEnd": true
                },
                {
                  "flag": "dpw_bitten"
                }
              ],
              "exit": "ocr_dpw_8"
            }
          }
        },
        {
          "id": "knife",
          "label": "Draw your knife and prepare to fight it off.",
          "strikeFirst": { "dr": 2 },
          "approval": [
            "Risk"
          ],
          "check": {
            "type": "Brawling",
            "dr": 2
          },
          "outcomes": {
            "clean": {
              "text": "As the shark nears, you kick out your foot and connect with its nose. As it reels back, stunned, you sink your knife deep into its neck. As the shark thrashes in a cloud of bright red blood, you manage to twist yourself onto its backside, stabbing it again and again, until it eventually stops moving and floats limply to the surface. Ollie, standing on the shore, is gobsmacked.",
              "effects": [
                {
                  "dread": 3
                },
                {
                  "item": "Shark-Tooth Necklace"
                },
                {
                  "flag": "shark_killed"
                }
              ],
              "exit": "ocr_dpw_8"
            },
            "partial": {
              "text": "As the shark nears, you kick out your foot and connect with its nose. Stunned, the shark turns to flee, delivering a heavy blow to your head with its tail as it goes.",
              "effects": [],
              "exit": "ocr_dpw_8"
            },
            "setback": {
              "text": "You flail your legs but the shark is undeterred. You cry out as its jagged teeth sink into your leg, but it finally relents as the waves push you into shallower water, taking a chunk of your thigh with it.",
              "effects": [
                {
                  "tag": "Wounded",
                  "untilSeasonEnd": true
                },
                {
                  "flag": "dpw_bitten"
                }
              ],
              "exit": "ocr_dpw_8"
            }
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "conditions": [
        "Underwater"
      ],
      "cast": [
        "ollie"
      ],
      "id": "ocr_dpw_shark"
    },
    "ocr_dpw_8": {
      "kind": "choice",
      "where": "Ocracoke, Lilyhook's Graveyard",
      "setup": [
        "You collapse on shore with the ivory mermaid in hand as Ollie runs over to you.",
        {
          "when": {
            "flag": "dpw_bitten"
          },
          "text": "\n\n\"It's not so bad,\" he assures you. \"Here, I'll bandage you up. Hold still.\" As he wraps your leg tight with a linen bandage, he remarks, \"You're lucky it didn't take the whole leg.\""
        },
        {
          "when": {
            "flag": "shark_killed"
          },
          "text": "\n\n\"That was the most amazing thing I've ever seen!\" he exclaims. \"You killed a shark that size with just a knife. I'll make sure everyone hears about this!\""
        }
      ],
      "choices": [
        {
          "id": "close",
          "label": "That was a close call.",
          "approval": [],
          "result": {
            "text": "\"Yes, you got lucky this time.\"",
            "effects": [],
            "exit": "ocr_dpw_9"
          }
        },
        {
          "id": "haunted",
          "label": "The others don't avoid these wrecks because they're haunted, do they?",
          "approval": [],
          "result": {
            "text": "Ollie casts his eyes downward. \"Uh, well that's part of it. Mostly it's the sharks.\"",
            "effects": [],
            "exit": "ocr_dpw_9"
          }
        },
        {
          "id": "fault",
          "label": "I almost died, and it's all your fault!",
          "approval": [],
          "result": {
            "text": "Ollie casts his eyes downward. \"I know, I know. But you did a very brave deed, and we're both grateful for it.\"",
            "effects": [],
            "exit": "ocr_dpw_9"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie"
      ],
      "id": "ocr_dpw_8"
    },
    "ocr_dpw_9": {
      "kind": "choice",
      "where": "Ocracoke, Lilyhook's Graveyard",
      "setup": "He helps you to your feet, and the both of you head back to the tent.\n\nGeezer is lying flat on his back again, hacking another heavy cough. He tries to sit up, but collapses back onto the sand. His leg stumps are no longer wiggling.\n\n\"Yarr, he returns,\" he says softly. \"What be yer luck?\"",
      "choices": [
        {
          "id": "gorgeous",
          "label": "Yarr, she be gorgeous. A proper sea maiden, she is.",
          "approval": [
            "Revelry"
          ],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_10"
          }
        },
        {
          "id": "found",
          "label": "I found your mermaid. Wasn't too much trouble.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_10"
          }
        },
        {
          "id": "barely",
          "label": "I just barely made it out alive.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_10"
          }
        },
        {
          "id": "died",
          "label": "I could have died out there. This better have been worth it.",
          "approval": [
            "Plunder"
          ],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_dpw_10"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie",
        "geezer"
      ],
      "id": "ocr_dpw_9"
    },
    "ocr_dpw_10": {
      "kind": "choice",
      "where": "Ocracoke, Lilyhook's Graveyard",
      "setup": "You kneel down and place the figurine in the old man's hand. As he runs his fingers along it, he begins to cry.\n\n\"Aye, she be just as I remembered,\" he whispers. \"A bonny lass, from better days...\"\n\nHe closes his eyes, caressing the mermaid, until he grows still, clutching it close to his chest as he drifts off. You and Ollie watch on as he takes his final breaths.\n\n\"I'll miss you, Pops,\" Ollie says quietly, and you both share a brief moment of silence.",
      "choices": [
        {
          "id": "era",
          "label": "The end of an era. He'll be missed.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [
              {
                "dies": "geezer"
              }
            ],
            "exit": "ocr_dpw_11"
          }
        },
        {
          "id": "glad",
          "label": "I'm glad I could do something for him before he died.",
          "approval": [
            "Mercy"
          ],
          "result": {
            "text": "",
            "effects": [
              {
                "dies": "geezer"
              }
            ],
            "exit": "ocr_dpw_11"
          }
        },
        {
          "id": "strange",
          "label": "What a strange old man.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [
              {
                "dies": "geezer"
              }
            ],
            "exit": "ocr_dpw_11"
          }
        },
        {
          "id": "gold",
          "label": "Alright, enough of this. Where's my gold?",
          "approval": [
            "Plunder"
          ],
          "result": {
            "text": "",
            "effects": [
              {
                "dies": "geezer"
              }
            ],
            "exit": "ocr_dpw_11"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie",
        "geezer"
      ],
      "id": "ocr_dpw_10"
    },
    "ocr_dpw_11": {
      "kind": "choice",
      "where": "Ocracoke, Lilyhook's Graveyard",
      "setup": "Ollie startles, remembering that you're still there.\n\n\"Ah, of course. I can't thank you enough for your help.\" He reaches into his belt and pulls out a hefty pouch of old coins and jewelry. \"I hope this is enough for your troubles.\"\n\nAs you inspect the pouch, he pipes up again. \"Oh! I almost forgot! Pops would want you to have this.\" He reaches down and pulls a piece of worn parchment from the pocket of his father's breeches, and places it in your hand. It looks to be a piece of a map, and you can make out the word \"Ocracoke\" written on it.\n\n\"Pops said a local found this on the beach after the battle and gave it to him. He's held onto it his whole life. Said it leads to buried treasure. I don't know if I believe that, but I've got no desire to go out looking for it. Who knows, perhaps in your travels you'll find the other fragments out there.\"",
      "choices": [
        {
          "id": "map",
          "label": "A treasure map? Where would I find the other pieces?",
          "approval": [],
          "result": {
            "text": "\"How should I know? Ask around for rumors, or talk to well-traveled folks. They might be able to point you in the right direction.\"",
            "effects": [],
            "exit": "ocr_dpw_11"
          },
          "info": true
        },
        {
          "id": "alright",
          "label": "Thanks, Ollie. Will you be alright?",
          "approval": [],
          "result": {
            "text": "\"Oh, don't worry about me. Pops was dying for a long time, and I'd already made my peace with it. I'm just glad you were able to grant him his dying wish.\"",
            "effects": [],
            "exit": "ocr_dpw_end"
          }
        },
        {
          "id": "pleasure",
          "label": "It's been a pleasure.",
          "approval": [],
          "result": {
            "text": "\"Likewise. You're a good person for doing this.\"",
            "effects": [],
            "exit": "ocr_dpw_end"
          }
        },
        {
          "id": "done",
          "label": "Are we done here?",
          "approval": [],
          "result": {
            "text": "\"Wow, I didn't realize you were in such a hurry. Yes, you can go.\"",
            "effects": [],
            "exit": "ocr_dpw_end"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie"
      ],
      "id": "ocr_dpw_11"
    },
    "ocr_dpw_end": {
      "kind": "beat",
      "where": "Ocracoke, Lilyhook's Graveyard",
      "setup": "\"I'll make sure Pops gets a proper sea burial,\" he says as you depart. \"And there's more treasure out there in the wrecks, should you ever want to come back and dive again. I'll be here!\"",
      "choices": [
        {
          "id": "on",
          "label": "Continue.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [
              {
                "treasure": 10,
                "dirty": false
              },
              {
                "item": "Lilyhook Fragment 1"
              },
              {
                "rung": {
                  "npc": "ollie",
                  "set": "Friendly"
                }
              },
              {
                "dies": "geezer"
              },
              {
                "meet": "ollie"
              },
              {
                "flag": "ocr_dpw_done"
              }
            ],
            "exit": "hub"
          }
        }
      ],
      "title": "A Dying Pirate's Wish",
      "repeat": "once",
      "ap": 0,
      "cast": [
        "ollie"
      ],
      "id": "ocr_dpw_end"
    },
    "ocr_oap": {
      "kind": "check",
      "title": "The one-armed pirate",
      "where": "Ocracoke, Tavern",
      "ap": 0,
      "repeat": "once",
      "cast": [
        "one_armed_pirate"
      ],
      "firesWhen": {
        "all": [
          {
            "loss": [
              "A",
              "C"
            ]
          },
          {
            "notFlag": "lead_trident_heard"
          }
        ]
      },
      "setup": [
        "You approach the one-armed pirate as he sits at a table among his mates. He's leathery as a bat, and squints at you in the dim light.\n\n",
        {
          "when": {
            "loss": "A"
          },
          "text": "\"I'm looking for my brother. He's a shipwright, about this tall, and has a birthmark on his right cheek. Have you seen anyone matching that description?\""
        },
        {
          "when": {
            "loss": "C"
          },
          "text": "\"I'm looking for the man who shot me. He's tall, mean-looking, and the right side of his face is severely burned. Have you seen anyone like that?\""
        },
        "\n\n\"I see many things,\" the man responds in a heavy French accent as his mates stare you down. \"What is it worth to you?\""
      ],
      "choices": [
        {
          "id": "french",
          "label": "You're French? Were you part of the fleet that attacked [Home City]?",
          "approval": [],
          "info": true,
          "result": {
            "text": "\"No. But I know many who were. A great victory for France, they say.\"",
            "effects": [],
            "exit": "ocr_oap"
          }
        },
        {
          "id": "pay_30",
          "label": "Would some coin loosen your tongue?",
          "approval": [],
          "hiddenUnless": {
            "all": [
              {
                "notFlag": "oap_p15"
              },
              {
                "notFlag": "oap_p60"
              }
            ]
          },
          "cost": {
            "gold": 30,
            "pot": "crew"
          },
          "result": {
            "text": "\"It certainly would,\" he says as he accepts your gold.",
            "effects": [],
            "exit": "ocr_oap_lead"
          }
        },
        {
          "id": "pay_15",
          "label": "Would some coin loosen your tongue?",
          "approval": [],
          "hiddenUnless": {
            "flag": "oap_p15"
          },
          "cost": {
            "gold": 15,
            "pot": "crew"
          },
          "result": {
            "text": "\"It certainly would,\" he says as he accepts your gold.",
            "effects": [],
            "exit": "ocr_oap_lead"
          }
        },
        {
          "id": "pay_60",
          "label": "Would some coin loosen your tongue?",
          "approval": [],
          "hiddenUnless": {
            "all": [
              {
                "flag": "oap_p60"
              },
              {
                "notFlag": "oap_p15"
              }
            ]
          },
          "cost": {
            "gold": 60,
            "pot": "crew"
          },
          "result": {
            "text": "\"It certainly would,\" he says as he accepts your gold.",
            "effects": [],
            "exit": "ocr_oap_lead"
          }
        },
        {
          "id": "haggle",
          "label": "I'm sure we can come to an agreement.",
          "approval": [],
          "lockedUnless": {
            "notFlag": "oap_haggled"
          },
          "lockedReason": "You've tried that",
          "check": {
            "type": "Haggle",
            "dr": 2
          },
          "outcomes": {
            "clean": {
              "text": "\"You seem like a reasonable man. I'll tell you, in the interest of friendship.\"",
              "effects": [],
              "exit": "ocr_oap_lead"
            },
            "partial": {
              "text": "\"You seem like a reasonable man. All it will take is a few coins.\"",
              "effects": [
                {
                  "flag": "oap_haggled"
                },
                {
                  "flag": "oap_p15"
                },
                {
                  "flag": "oap_p60",
                  "value": false
                }
              ],
              "exit": "ocr_oap"
            },
            "setback": {
              "text": "He shakes his head. \"This is valuable information. You'll have to pay if you want me to tell you what I know.\"",
              "effects": [
                {
                  "flag": "oap_haggled"
                },
                {
                  "flag": "oap_p60"
                },
                {
                  "flag": "oap_p15",
                  "value": false
                }
              ],
              "exit": "ocr_oap"
            }
          }
        },
        {
          "id": "threaten",
          "label": "Tell me now or I'll knock your teeth out.",
          "approval": [
            "Defiance"
          ],
          "lockedUnless": {
            "notFlag": "oap_threatened"
          },
          "lockedReason": "You've tried that",
          "check": {
            "type": "Intimidate",
            "dr": 2
          },
          "outcomes": {
            "clean": {
              "text": "The one-armed Frenchman and his mates share a nervous look. \"Calm down, friend. We're just talking. I'll tell you what you need to know.\"",
              "effects": [],
              "exit": "ocr_oap_lead"
            },
            "partial": {
              "text": "The man narrows his eyes. \"You're lucky I like this tavern, otherwise I'd spill your blood all over the floor.\"",
              "effects": [
                {
                  "flag": "oap_threatened"
                }
              ],
              "exit": "ocr_oap"
            },
            "setback": {
              "text": "The man and his mates share a hearty laugh. \"Oh, very scary,\" the one-armed pirate snorts. \"Did your grandmother teach you that line?\"",
              "effects": [
                {
                  "flag": "oap_threatened"
                },
                {
                  "flag": "oap_p60"
                },
                {
                  "flag": "oap_p15",
                  "value": false
                }
              ],
              "exit": "ocr_oap"
            }
          }
        }
      ],
      "id": "ocr_oap"
    },
    "ocr_oap_lead": {
      "kind": "beat",
      "title": "The one-armed pirate",
      "where": "Ocracoke, Tavern",
      "ap": 0,
      "repeat": "once",
      "cast": [
        "one_armed_pirate"
      ],
      "setup": [
        "\"Yes, I have seen this man you speak of.\"\n\n",
        {
          "when": {
            "loss": "A"
          },
          "text": "\"The man with the birthmark was aboard a French ship that docked here not a week past. A brigantine called the *Trident*. They had him chained to the mast, repairing her deck. I do not know where the ship went.\""
        },
        {
          "when": {
            "loss": "C"
          },
          "text": "\"The man with the burned face sails aboard a French brigantine called the *Trident*. His name is Gregoire. I tried to play dice with him once, but he was too dumb to understand the rules.\""
        }
      ],
      "choices": [
        {
          "id": "on",
          "label": "Continue.",
          "approval": [],
          "result": {
            "text": "You thank the one-armed pirate and leave him be. Hopefully you can find more information about the *Trident* elsewhere.",
            "effects": [
              {
                "flag": "lead_trident_heard"
              },
              {
                "lead": {
                  "quest": "what_was_lost",
                  "id": "trident"
                }
              }
            ],
            "exit": "hub"
          }
        }
      ],
      "id": "ocr_oap_lead"
    },
    "ocr_uw_1": {
      "kind": "choice",
      "ap": 0,
      "title": "Welcome to the Underworld",
      "where": "Ocracoke, Tavern",
      "repeat": "once",
      "cast": [
        "bobby"
      ],
      "setup": "An unusually small man in the corner waves you over. He's about the size of a large child, but his face is wrinkled with age, and one of his eyes is bigger than the other. A lonesome strand of hair combed over the top of his bald head and a wiry goatee complete the slightly deranged look.\n\n\"You there! Come, come. Bobby has work, if you want to make some coin.\"\n\nAs soon as you come near him, he grabs you by the collar and pulls you in until you're inches away from his big eye. He's stronger than he looks.\n\n\"Have you ever killed a man? No, don't answer that.\" He releases your collar, causing you to stagger back. \"Of course you have killed a man. You have the look of a killer. A real assassin. Unlike Bobby. Bobby doesn't get his hands dirty.\" He rubs his hands together.",
      "choices": [
        {
          "id": "jewels",
          "label": "My family's jewels were stolen, and I'm looking for them. Have you seen an emerald necklace, linked with gold, bearing the mark of {captain.last}? That's the most distinct item.",
          "approval": [],
          "info": true,
          "hiddenUnless": {
            "loss": "B"
          },
          "result": {
            "text": "He ponders for a moment, then perks up. \"Yes, yes, Bobby has seen such a necklace. And many other jewels with it besides. But Bobby sold them. To who? Well, Bobby only tells such things to Bobby's friends.\"",
            "effects": [],
            "exit": "ocr_uw_1"
          }
        },
        {
          "id": "okay",
          "label": "Uh, are you okay?",
          "approval": [],
          "info": true,
          "result": {
            "text": "\"Bobby is angry. Very, very angry.\"",
            "effects": [],
            "exit": "ocr_uw_1"
          }
        },
        {
          "id": "asylum",
          "label": "What kind of insane asylum did you escape from?",
          "approval": [],
          "info": true,
          "result": {
            "text": "\"Ha! Yes, you are a killer, and you are funny.\"",
            "effects": [],
            "exit": "ocr_uw_1"
          }
        },
        {
          "id": "coin",
          "label": "You said something about earning some coin?",
          "approval": [],
          "result": {
            "text": "",
            "effects": [],
            "exit": "ocr_uw_2"
          }
        }
      ],
      "id": "ocr_uw_1"
    },
    "ocr_uw_2": {
      "kind": "choice",
      "ap": 0,
      "title": "Welcome to the Underworld",
      "where": "Ocracoke, Tavern",
      "repeat": "once",
      "cast": [
        "bobby"
      ],
      "setup": "He takes a moment to think to himself. \"Hmm...yes...you'll do just fine,\" he muses aloud, straightening his back. \"Bobby Rats stands before you, begging a favor. Bobby Rats pays well for favors. Bobby Rats is a good friend to have.\"\n\n\"You see, the man at the bar owes Bobby a lot of money.\" He points at a large, lumpy sailor sitting at the bar, swaying on his stool. \"The man is very drunk, but also very big, so he does not pay Bobby the money he owes. It may surprise you to learn that Bobby is rather small. This is why Bobby has friends like you!\" He pokes you in the chest with a long, gnarled finger.\n\nYou gather that this strange fellow wants you to collect the debt from the drunkard at the bar.",
      "choices": [
        {
          "id": "what",
          "label": "And what exactly would I get in return?",
          "approval": [],
          "info": true,
          "result": {
            "text": "\"A friend of Bobby Rats gets many things! Bobby pays gold, yes. But Bobby also buys anything the merchants won't touch. *Anything.* And Bobby has friends who also buy things without questions. Bobby has many friends and knows many things.\"",
            "effects": [
              {
                "meet": "bobby"
              }
            ],
            "exit": "ocr_uw_2"
          }
        },
        {
          "id": "collect",
          "label": "No problem, I can collect the debt for you.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [
              {
                "meet": "bobby"
              }
            ],
            "exit": "ocr_uw_drunk"
          }
        },
        {
          "id": "try",
          "label": "I'll do what I can. No promises.",
          "approval": [],
          "result": {
            "text": "",
            "effects": [
              {
                "meet": "bobby"
              }
            ],
            "exit": "ocr_uw_drunk"
          }
        }
      ],
      "id": "ocr_uw_2"
    },
    "ocr_uw_drunk": {
      "kind": "check",
      "ap": 0,
      "title": "Welcome to the Underworld",
      "where": "Ocracoke, Tavern",
      "repeat": "once",
      "cast": [
        "bobby"
      ],
      "setup": "You walk over to the man at the bar and tap him on the shoulder. He rolls his head to look at you sideways. His round face is fully pink, and his eyes seem to point in different directions.",
      "choices": [
        {
          "id": "intimidate",
          "label": "I'm here to collect the money you owe Bobby Rats. Time to pay up.",
          "approval": [
            "Defiance"
          ],
          "lockedUnless": {
            "notFlag": "uw_intimidate_tried"
          },
          "lockedReason": "That didn't work",
          "check": {
            "type": "Intimidate",
            "dr": 2
          },
          "outcomes": {
            "clean": {
              "text": "The man's eyes flutter as he uses up the last of his brainpower. Finally, he reaches down to his belt and tosses his coin purse on the floor.",
              "effects": [],
              "exit": "ocr_uw_reward"
            },
            "partial": {
              "text": "The man ignores you and takes another hefty swig of grog from his cup.",
              "effects": [
                {
                  "flag": "uw_intimidate_tried"
                }
              ],
              "exit": "ocr_uw_drunk"
            },
            "setback": {
              "text": "The man swats you away as if you were a fly on his shoulder. \"Go 'way,\" he mumbles.",
              "effects": [
                {
                  "flag": "uw_intimidate_tried"
                }
              ],
              "exit": "ocr_uw_drunk"
            }
          }
        },
        {
          "id": "persuade",
          "label": "Hello, good sir. You seem to have forgotten about the coin you owe little Bobby over there. I can help you solve that problem.",
          "approval": [],
          "lockedUnless": {
            "notFlag": "uw_persuade_tried"
          },
          "lockedReason": "That didn't work",
          "check": {
            "type": "Persuade",
            "dr": 1
          },
          "outcomes": {
            "clean": {
              "text": "The man closes his eyes as he thinks as hard as he possibly can. Finally, he reaches down to his belt and tosses his coin purse on the floor.",
              "effects": [],
              "exit": "ocr_uw_reward"
            },
            "partial": {
              "text": "\"You talkin' to me?\" the man inquires. \"I...I'm not Bobby.\" He doesn't seem to understand.",
              "effects": [
                {
                  "flag": "uw_persuade_tried"
                }
              ],
              "exit": "ocr_uw_drunk"
            },
            "setback": {
              "text": "\"You talk too much,\" he says as he gives you a hard push backward, causing you to fall to the ground.",
              "effects": [
                {
                  "flag": "uw_persuade_tried"
                }
              ],
              "exit": "ocr_uw_drunk"
            }
          }
        },
        {
          "id": "snatch",
          "label": "Snatch the man's coin purse straight off his belt.",
          "approval": [
            "Deceit"
          ],
          "lockedUnless": {
            "notFlag": "uw_snatch_tried"
          },
          "lockedReason": "That didn't work",
          "check": {
            "type": "Light Fingers",
            "dr": 1
          },
          "outcomes": {
            "clean": {
              "text": "The man doesn't even seem to notice as you deftly swipe his gold.",
              "effects": [],
              "exit": "ocr_uw_reward"
            },
            "partial": {
              "text": "You swipe the man's gold, but the tavern keeper notices and gives you a stern look.",
              "effects": [
                {
                  "seasonFlag": "keeper_annoyed"
                }
              ],
              "exit": "ocr_uw_reward"
            },
            "setback": {
              "text": "The man feels your hand on his belt and takes a big swing, landing a heavy left hook on your jaw that sends you reeling backward. You hear the other patrons snickering as he returns to his drink, seemingly unbothered.",
              "effects": [
                {
                  "flag": "uw_snatch_tried"
                }
              ],
              "exit": "ocr_uw_drunk"
            }
          }
        },
        {
          "id": "knock_out",
          "label": "Knock him out cold and take the money.",
          "approval": [
            "Cruelty"
          ],
          "check": {
            "type": "Brawling",
            "dr": 2
          },
          "outcomes": {
            "clean": {
              "text": "You give him a hard sucker punch from behind and he falls off his stool, hitting his meaty head on the bar as he goes down. The tavern's patrons glance up, then return to what they were doing as you pick his coin purse off the floor.",
              "effects": [],
              "exit": "ocr_uw_reward"
            },
            "partial": {
              "text": "You give him a hard sucker punch from behind and he falls off his stool. The tavern keeper shakes {keeper.his} head, but the patrons don't pay it much mind.",
              "effects": [
                {
                  "seasonFlag": "keeper_annoyed"
                }
              ],
              "exit": "ocr_uw_reward"
            },
            "setback": {
              "text": [
                "You give him a hard sucker punch from behind, but it bounces right off his cheek. He turns around and roars with anger, before picking you up by the collar and throwing you across the tavern. You crash into a stack of crates on the far wall",
                {
                  "when": {
                    "flag": "uw_thrown"
                  },
                  "text": " again"
                },
                "."
              ],
              "effects": [
                {
                  "flag": "uw_thrown"
                }
              ],
              "exit": "ocr_uw_drunk"
            }
          }
        }
      ],
      "id": "ocr_uw_drunk"
    },
    "ocr_uw_reward": {
      "kind": "beat",
      "ap": 0,
      "title": "Welcome to the Underworld",
      "where": "Ocracoke, Tavern",
      "repeat": "once",
      "cast": [
        "bobby"
      ],
      "setup": [
        "You return to Bobby Rats with the coin purse in hand.\n\n\"Ooh, Bobby was watching you. You make Bobby very happy.\" He smiles wide, exposing approximately six-and-a-half teeth. \"You can keep it. The man did not actually owe Bobby any money. Bobby just wanted to know if you are a good friend. And yes, yes you are!\"\n\nHe grabs you by the collar and pulls you in, again. \"Bobby is good to his pirate friends,\" he whispers. \"Many pirates have a letter of marque, very official. The letter says who you can steal from. It's a very good deal.\"\n\n\"But if you have no letter, or if you steal from someone you aren't supposed to steal from, the loot is dirty. Merchants won't buy it. But Bobby will! Bobby buys anything from his friends, as long as he has the coin! So will Bobby's best friend Declan Wells in Edenton. Find Bobby or Declan when you have icky, dirty loot on your hands.\"",
        {
          "when": {
            "loss": "B"
          },
          "text": "\n\n\"Oh, and about your jewels. Bobby sold them to a very tall man. Very thin, very bald. He is not one of Bobby's friends, only a man with many coins. Said he was heading home to Edenton. Look for him there!\""
        }
      ],
      "choices": [
        {
          "id": "on",
          "label": "Continue.",
          "approval": [],
          "result": {
            "text": "With his business concluded, Bobby waddles out of the tavern, leaving you scratching your head. He's either quite useful, extremely crazy, or both.",
            "effects": [
              {
                "gold": 385
              },
              {
                "rung": {
                  "npc": "bobby",
                  "set": "Friendly"
                }
              },
              {
                "meet": "bobby"
              },
              {
                "flag": "ocr_underworld_done"
              },
              {
                "lead": {
                  "quest": "what_was_lost",
                  "id": "bald_man"
                },
                "when": {
                  "loss": "B"
                }
              },
              {
                "flag": "lead_bald_man_heard",
                "when": {
                  "loss": "B"
                }
              }
            ],
            "exit": "hub"
          }
        }
      ],
      "id": "ocr_uw_reward"
    }
  };
  Object.keys(scenes).forEach(function (id) { PC.data.scenes[id] = scenes[id]; });
})();
