(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TaroMiniAppLogic = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAJOR_SLUGS = {
    0: "fool",
    1: "magician",
    2: "high_priestess",
    3: "empress",
    4: "emperor",
    5: "hierophant",
    6: "lovers",
    7: "chariot",
    8: "strength",
    9: "hermit",
    10: "wheel_of_fortune",
    11: "justice",
    12: "hanged_man",
    13: "death",
    14: "temperance",
    15: "devil",
    16: "tower",
    17: "star",
    18: "moon",
    19: "sun",
    20: "judgement",
    21: "world"
  };

  var MAJOR_NAMES_RU = {
    0: "Шут",
    1: "Маг",
    2: "Верховная Жрица",
    3: "Императрица",
    4: "Император",
    5: "Иерофант",
    6: "Влюбленные",
    7: "Колесница",
    8: "Сила",
    9: "Отшельник",
    10: "Колесо Фортуны",
    11: "Правосудие",
    12: "Повешенный",
    13: "Смерть",
    14: "Умеренность",
    15: "Дьявол",
    16: "Башня",
    17: "Звезда",
    18: "Луна",
    19: "Солнце",
    20: "Суд",
    21: "Мир"
  };

  var SUIT_NAMES_RU = {
    cups: "Кубков",
    swords: "Мечей",
    wands: "Жезлов",
    pentacles: "Пентаклей"
  };

  var RANK_NAMES_RU = {
    1: "Туз",
    2: "Двойка",
    3: "Тройка",
    4: "Четверка",
    5: "Пятерка",
    6: "Шестерка",
    7: "Семерка",
    8: "Восьмерка",
    9: "Девятка",
    10: "Десятка",
    11: "Паж",
    12: "Рыцарь",
    13: "Королева",
    14: "Король"
  };

  var RECIPES = {
    card_of_the_day: {
      recipe_id: "card_of_the_day",
      role: "morning_card",
      deck: { source: "rws78" },
      steps: [
        { action: "shuffle" },
        { action: "user_select", count: 1, face: "down", ui: "fan" },
        { action: "reveal" }
      ],
      reversals: { enabled: true, probability: 0.5 }
    },
    advice_card: {
      recipe_id: "advice_card",
      role: "advice_card",
      deck: { source: "rws78" },
      steps: [
        { action: "shuffle" },
        { action: "user_select", count: 1, face: "down", ui: "fan" },
        { action: "reveal" }
      ],
      reversals: { enabled: true, probability: 0.5 }
    },
    single_card: {
      recipe_id: "single_card",
      role: "generic_draw",
      spread_type: "single_card",
      layout: "single",
      positions: ["single"],
      deck: { source: "rws78" },
      steps: [
        { action: "shuffle" },
        { action: "user_select", count: 1, face: "down", ui: "fan" },
        { action: "reveal" }
      ],
      reversals: { enabled: true, probability: 0.5 }
    },
    situation_action_direction: {
      recipe_id: "situation_action_direction",
      role: "generic_draw",
      spread_type: "situation_action_direction",
      layout: "row_3",
      positions: ["situation", "action", "direction"],
      position_labels_ru: {
        situation: "Ситуация",
        action: "Действие",
        direction: "Направление"
      },
      deck: { source: "rws78" },
      steps: [
        { action: "shuffle" },
        { action: "user_select", count: 3, face: "down", ui: "fan" },
        { action: "reveal" }
      ],
      reversals: { enabled: true, probability: 0.5 }
    },
    banzhaf_fools_game: {
      recipe_id: "banzhaf_fools_game",
      role: "morning_card",
      deck: { source: "rws78" },
      steps: [
        { action: "remove", card_id: "major_00_fool" },
        { action: "shuffle" },
        { action: "user_select", count: 12, face: "down", ui: "fan" },
        { action: "add", card_id: "major_00_fool" },
        { action: "shuffle" },
        { action: "choose_direction" },
        { action: "reveal_sequence" }
      ],
      reversals: { enabled: true, probability: 0.5 }
    }
  };

  function deriveCardsFromIndex(indexItems) {
    return (indexItems || []).map(function (item) {
      var cardId = cardIdFromIndexItem(item);
      return {
        card_id: cardId,
        name_ru: displayName(cardId),
        image: runtimeImagePath(item)
      };
    }).filter(function (card) {
      return !!card.card_id;
    });
  }

  function cardIdFromIndexItem(item) {
    if (item.arcana === "major") {
      var majorMatch = String(item.new_file || "").match(/^major_(\d{2})_/);
      if (!majorMatch) return null;
      var number = parseInt(majorMatch[1], 10);
      return "major_" + pad2(number) + "_" + MAJOR_SLUGS[number];
    }
    if (item.arcana === "minor") {
      return "minor_" + item.suit + "_" + pad2(item.rank);
    }
    return null;
  }

  function displayName(cardId) {
    var parts = String(cardId || "").split("_");
    if (parts[0] === "major") {
      return MAJOR_NAMES_RU[parseInt(parts[1], 10)] || cardId;
    }
    if (parts[0] === "minor") {
      return (RANK_NAMES_RU[parseInt(parts[2], 10)] || parts[2]) + " " + (SUIT_NAMES_RU[parts[1]] || parts[1]);
    }
    return cardId;
  }

  function runtimeImagePath(item) {
    var path = item.runtime_path || item.target_path || item.source_path || "";
    if (!path) return "";
    if (/^(?:[a-z]+:)?\/\//i.test(path) || path.indexOf("/") === 0 || path.indexOf("./") === 0) {
      return path;
    }
    return "./" + path;
  }

  function buildDeck(source, cards) {
    var all = (cards || []).slice();
    if (source === "rws78") return all;
    if (source === "major22") {
      return all.filter(function (card) {
        return card.card_id.indexOf("major_") === 0;
      });
    }
    throw new Error("Unsupported deck source: " + source);
  }

  function assignOrientations(deck, reversals, randomInt) {
    var enabled = !!(reversals && reversals.enabled);
    var probability = reversals && typeof reversals.probability === "number" ? reversals.probability : 0.5;
    return deck.map(function (card) {
      var roll = randomInt(1000000) / 1000000;
      return Object.assign({}, card, {
        orientation: enabled && roll < probability ? "reversed" : "upright"
      });
    });
  }

  function fisherYates(deck, randomInt) {
    var result = deck.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var j = randomInt(i + 1);
      var tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  }

  function cryptoRandomInt(max) {
    if (!max || max <= 0) throw new Error("max must be positive");
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      var array = new Uint32Array(1);
      var limit = Math.floor(0x100000000 / max) * max;
      do {
        crypto.getRandomValues(array);
      } while (array[0] >= limit);
      return array[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function createSession(recipe, cards, randomInt, deckState) {
    validateRecipe(recipe);
    var rng = randomInt || cryptoRandomInt;
    var orderedCards = orderCards(cards, deckState && deckState.card_order);
    var deck = assignOrientations(buildDeck(recipe.deck.source, orderedCards), recipe.reversals, rng);
    var selected = [];
    var candidate = null;
    var pendingAdd = null;
    var direction = null;
    var managementActions = [];

    recipe.steps.forEach(function (step) {
      if (step.action === "remove") {
        deck = deck.filter(function (card) {
          return card.card_id !== step.card_id;
        });
      } else if (step.action === "shuffle") {
        if (!(deckState && deckState.card_order)) deck = fisherYates(deck, rng);
      } else if (step.action === "add") {
        pendingAdd = step.card_id;
      } else if (["user_select", "choose_direction", "reveal", "reveal_sequence"].indexOf(step.action) === -1) {
        throw new Error("Unsupported recipe action: " + step.action);
      }
    });

    var session = {
      recipe: recipe,
      deck: deck,
      selected: selected,
      candidate: candidate,
      pendingAdd: pendingAdd,
      direction: direction,
      selectCard: function (index) {
        var selectStep = currentSelectStep(recipe);
        if (!selectStep) throw new Error("Recipe does not request user selection.");
        if (selected.length >= selectStep.count) return null;
        if (index < 0 || index >= deck.length) return null;
        var card = deck.splice(index, 1)[0];
        selected.push(card);
        return card;
      },
      setCandidate: function (index) {
        if (index < 0 || index >= deck.length || this.isSelectionComplete()) return null;
        candidate = deck[index];
        this.candidate = candidate;
        return candidate;
      },
      clearCandidate: function () {
        candidate = null;
        this.candidate = null;
      },
      commitCandidate: function () {
        if (!candidate) return null;
        var index = deck.indexOf(candidate);
        if (index < 0) {
          this.clearCandidate();
          return null;
        }
        var card = this.selectCard(index);
        this.clearCandidate();
        return card;
      },
      canManualShuffle: function () {
        return selected.length === 0;
      },
      manualShuffle: function () {
        if (!this.canManualShuffle()) return false;
        deck = humanInterleave(assignOrientations(deck, recipe.reversals, rng), rng);
        this.deck = deck;
        managementActions.push("human_shuffle");
        this.clearCandidate();
        return true;
      },
      pileCut: function (boundaries, pileOrder) {
        if (!this.canManualShuffle()) return false;
        deck = cutIntoPiles(deck, boundaries, pileOrder);
        this.deck = deck;
        managementActions.push("pile_cut");
        this.clearCandidate();
        return true;
      },
      canonicalReset: function () {
        if (!this.canManualShuffle()) return false;
        deck = assignOrientations(orderCards(cards), recipe.reversals, rng);
        this.deck = deck;
        managementActions.push("canonical_reset");
        this.clearCandidate();
        return true;
      },
      isSelectionComplete: function () {
        var selectStep = currentSelectStep(recipe);
        return !selectStep || selected.length >= selectStep.count;
      },
      chooseDirection: function (value) {
        if (value !== "top" && value !== "bottom") throw new Error("Invalid direction.");
        direction = value;
        this.direction = value;
        if (pendingAdd) {
          var added = findCard(cards, pendingAdd);
          if (!added) throw new Error("Cannot add missing card: " + pendingAdd);
          selected.push(assignOrientations([added], recipe.reversals, rng)[0]);
          pendingAdd = null;
          this.pendingAdd = null;
        }
        selected = fisherYates(selected, rng);
        this.selected = selected;
      },
      result: function () {
        var result = buildResult(recipe, selected, direction);
        if (deckState && deckState.version) {
          result.personal_deck = {
            base_version: deckState.version,
            operation_order: deck.concat(selected).map(function (card) { return card.card_id; }),
            actions: managementActions.slice()
          };
        }
        return result;
      },
      deckState: function () {
        return {
          base_version: deckState && deckState.version,
          card_order: deck.concat(selected).map(function (card) { return card.card_id; }),
          actions: managementActions.slice()
        };
      }
    };
    return session;
  }

  function orderCards(cards, cardOrder) {
    var canonical = (cards || []).slice().sort(function (a, b) {
      return canonicalIndex(a.card_id) - canonicalIndex(b.card_id);
    });
    if (!cardOrder || cardOrder.length !== canonical.length) return canonical;
    var byId = {};
    canonical.forEach(function (card) { byId[card.card_id] = card; });
    var ordered = cardOrder.map(function (id) { return byId[id]; });
    return ordered.every(Boolean) ? ordered : canonical;
  }

  function canonicalIndex(cardId) {
    if (cardId.indexOf("major_") === 0) return parseInt(cardId.split("_")[1], 10);
    var parts = cardId.split("_");
    var suits = { wands: 0, cups: 1, swords: 2, pentacles: 3 };
    return 22 + suits[parts[1]] * 14 + parseInt(parts[2], 10) - 1;
  }

  function humanInterleave(deck, randomInt) {
    if (deck.length < 2) return deck.slice();
    var split = Math.max(1, Math.min(deck.length - 1, Math.floor(deck.length / 2) + randomInt(13) - 6));
    var left = deck.slice(0, split);
    var right = deck.slice(split);
    var result = [];
    while (left.length || right.length) {
      var source = left.length && (!right.length || randomInt(2) === 0) ? left : right;
      result = result.concat(source.splice(0, Math.min(source.length, randomInt(4) + 1)));
    }
    if (result.every(function (card, index) { return card === deck[index]; })) {
      result.push(result.shift());
    }
    return result;
  }

  function cutIntoPiles(deck, boundaries, pileOrder) {
    var points = [0].concat(boundaries || [], [deck.length]);
    var piles = [];
    for (var i = 0; i < points.length - 1; i += 1) piles.push(deck.slice(points[i], points[i + 1]));
    if (piles.length < 2 || piles.length > 5 || (pileOrder || []).slice().sort().join(",") !== piles.map(function (_, i) { return i; }).join(",")) {
      throw new Error("Некорректный порядок стопок.");
    }
    return [].concat.apply([], pileOrder.map(function (index) { return piles[index]; }));
  }

  function currentSelectStep(recipe) {
    return recipe.steps.filter(function (step) {
      return step.action === "user_select";
    })[0];
  }

  function normalizedFromPointer(clientX, rect) {
    if (!rect || !rect.width) return 0;
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  }

  function indexFromNormalized(normalized, deckSize) {
    if (!deckSize || deckSize <= 1) return 0;
    return Math.round(clamp(normalized, 0, 1) * (deckSize - 1));
  }

  function visualFanSlots(deckSize, slotCount) {
    var count = Math.min(deckSize || 0, slotCount || 29);
    if (count <= 0) return [];
    if (count === 1) {
      return [{
        slot: 0,
        normalized: 0.5,
        logicalIndex: 0,
        offset: 0,
        arcY: 1,
        angle: 0,
        scale: 1.02,
        zIndex: 100
      }];
    }
    var slots = [];
    for (var i = 0; i < count; i += 1) {
      var normalized = i / (count - 1);
      var offset = irregularFanOffset(normalized);
      var centerPull = 1 - Math.min(1, Math.abs(offset) * 2);
      var arcY = Math.pow(centerPull, 0.72);
      slots.push({
        slot: i,
        normalized: normalized,
        logicalIndex: indexFromNormalized(normalized, deckSize),
        offset: offset,
        arcY: arcY,
        angle: fanAxisAngle(offset, arcY) + stableJitter(i, count) * 2.2,
        scale: 0.965 + centerPull * 0.07,
        zIndex: 100 + i
      });
    }
    return slots;
  }

  function irregularFanOffset(normalized) {
    var centered = normalized - 0.5;
    var shaped = Math.sign(centered) * Math.pow(Math.abs(centered) * 2, 0.84) * 0.5;
    var cluster =
      0.024 * Math.sin(normalized * Math.PI * 5.1) +
      0.014 * Math.sin(normalized * Math.PI * 12.7);
    var handJitter = 0.008 * Math.sin(normalized * Math.PI * 31.3);
    return clamp(shaped + cluster + handJitter, -0.5, 0.5);
  }

  function stableJitter(index, count) {
    var value = Math.sin((index + 1) * 12.9898 + count * 78.233) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  }

  function fanAxisAngle(offset, arcY) {
    var cardX = offset * 500;
    var cardY = fanPlacementY(arcY);
    var pivotX = 0;
    var pivotY = -430;
    var dx = pivotX - cardX;
    var dy = pivotY - cardY;
    return Math.atan2(dx, -dy) * 180 / Math.PI;
  }

  function fanPlacementY(arcY) {
    return (1 - arcY) * -38 + arcY * 18;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function buildResult(recipe, selected, direction) {
    var cards = selected.slice();
    if (recipe.recipe_id === "banzhaf_fools_game") {
      if (!direction) throw new Error("Direction is required.");
      if (direction === "bottom") cards.reverse();
      cards = cards.map(function (card, index) {
        return {
          position: index + 1,
          card_id: card.card_id,
          orientation: card.orientation
        };
      });
    } else {
      cards = cards.map(function (card, index) {
        return {
          position: (recipe.positions || [])[index],
          card_id: card.card_id,
          orientation: card.orientation
        };
      });
    }
    var result = {
      version: 1,
      recipe_id: recipe.recipe_id,
      role: recipe.role,
      cards: cards
    };
    if (recipe.spread_type) result.spread_type = recipe.spread_type;
    if (recipe.question) result.question = recipe.question;
    if (direction) result.direction = direction;
    return result;
  }

  function findCard(cards, cardId) {
    for (var i = 0; i < cards.length; i += 1) {
      if (cards[i].card_id === cardId) return cards[i];
    }
    return null;
  }

  function validateRecipe(recipe) {
    if (!recipe || !recipe.recipe_id || !recipe.deck || !recipe.deck.source || !Array.isArray(recipe.steps)) {
      throw new Error("Invalid recipe.");
    }
    recipe.steps.forEach(function (step) {
      if (!step || !step.action) throw new Error("Invalid recipe step.");
    });
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  return {
    RECIPES: RECIPES,
    deriveCardsFromIndex: deriveCardsFromIndex,
    buildDeck: buildDeck,
    assignOrientations: assignOrientations,
    fisherYates: fisherYates,
    humanInterleave: humanInterleave,
    cutIntoPiles: cutIntoPiles,
    orderCards: orderCards,
    createSession: createSession,
    normalizedFromPointer: normalizedFromPointer,
    indexFromNormalized: indexFromNormalized,
    visualFanSlots: visualFanSlots,
    cardIdFromIndexItem: cardIdFromIndexItem,
    displayName: displayName
  };
});
