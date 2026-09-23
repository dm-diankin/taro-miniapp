(function () {
  "use strict";

  var logic = window.TaroMiniAppLogic;
  var tg = window.Telegram && window.Telegram.WebApp;
  var state = {
    cards: [],
    session: null,
    focusIndex: 0,
    dragStart: null,
    selectedForReveal: null,
    suppressClick: false,
    devMode: false
  };

  var fan = document.getElementById("fan");
  var status = document.getElementById("status");
  var hint = document.getElementById("hint");
  var selected = document.getElementById("selected");
  var revealPanel = document.getElementById("reveal-panel");
  var revealCard = document.getElementById("reveal-card");
  var revealName = document.getElementById("reveal-name");
  var revealButton = document.getElementById("reveal-button");
  var sendButton = document.getElementById("send-button");
  var directionPanel = document.getElementById("direction-panel");
  var sequencePanel = document.getElementById("sequence-panel");
  var sequence = document.getElementById("sequence");
  var errorBox = document.getElementById("error");
  var shuffleButton = document.getElementById("shuffle-button");
  var debugPosition = document.getElementById("debug-position");

  init();

  async function init() {
    try {
      if (tg) {
        tg.ready();
        tg.expand();
        document.body.classList.add("telegram");
      }
      var params = new URLSearchParams(window.location.search);
      var recipeId = params.get("recipe_id") || "card_of_the_day";
      var role = params.get("role");
      state.devMode = params.get("dev") === "1" || params.get("debug") === "1";
      debugPosition.hidden = !state.devMode;
      var recipe = Object.assign({}, logic.RECIPES[recipeId]);
      if (!recipe.recipe_id) throw new Error("Неизвестный рецепт.");
      if (role) recipe.role = role;
      state.cards = await loadCards();
      state.session = logic.createSession(recipe, state.cards);
      attachFanEvents();
      renderFan();
      updateStatus();
      updateShuffle();
    } catch (error) {
      showError(error.message || String(error));
    }
  }

  async function loadCards() {
    var response = await fetch("./assets/meta/cards_index.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить индекс карт.");
    var index = await response.json();
    var cards = logic.deriveCardsFromIndex(index);
    if (cards.length !== 78) throw new Error("Ожидалось 78 карт RWS.");
    return cards;
  }

  function renderFan() {
    fan.innerHTML = "";
    var slots = logic.visualFanSlots(state.session.deck.length, 29);
    var activeSlot = nearestVisualSlot(slots, state.focusIndex);
    slots.forEach(function (slot) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "card-back";
      item.setAttribute("aria-label", "Позиция в веере " + (slot.slot + 1));
      item.dataset.index = String(slot.logicalIndex);
      item.style.setProperty("--slot-index", slot.slot);
      item.style.setProperty("--slot-count", slots.length);
      item.style.setProperty("--offset", slot.offset.toFixed(4));
      item.style.setProperty("--arc-y", slot.arcY.toFixed(4));
      item.style.setProperty("--angle", slot.angle.toFixed(3) + "deg");
      item.style.setProperty("--fan-scale", slot.scale.toFixed(4));
      item.style.setProperty("--focus-scale", (slot.scale + 0.055).toFixed(4));
      item.style.setProperty("--fan-y", fanY(slot.arcY) + "px");
      item.style.setProperty("--focus-y", fanY(slot.arcY, 28) + "px");
      item.style.setProperty("--focus-angle", (slot.angle * 0.42).toFixed(3) + "deg");
      item.style.setProperty("--z", slot.zIndex);
      item.style.setProperty("--focus-z", slot.zIndex + 80);
      if (slot.slot === activeSlot) item.classList.add("focused");
      if (Math.abs(slot.slot - activeSlot) === 1) item.classList.add("near-focused");
      fan.appendChild(item);
    });
    focusCard(Math.min(state.focusIndex, state.session.deck.length - 1), { render: false });
  }

  function attachFanEvents() {
    fan.addEventListener("pointerdown", onPointerDown);
    fan.addEventListener("pointermove", onPointerMove);
    fan.addEventListener("pointerup", onPointerUp);
    fan.addEventListener("pointerleave", onPointerMove);
    fan.addEventListener("click", function (event) {
      if (state.suppressClick) {
        state.suppressClick = false;
        return;
      }
      focusFromPointer(event.clientX);
      selectFocused(state.focusIndex);
    });
  }

  function onPointerDown(event) {
    focusFromPointer(event.clientX);
    state.dragStart = { x: event.clientX, y: event.clientY, index: state.focusIndex };
    fan.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    focusFromPointer(event.clientX);
  }

  function onPointerUp(event) {
    if (!state.dragStart) return;
    var dy = event.clientY - state.dragStart.y;
    var dx = Math.abs(event.clientX - state.dragStart.x);
    var index = state.focusIndex;
    state.dragStart = null;
    if (dy > 34 && dy > dx * 0.75) {
      state.suppressClick = true;
      selectFocused(index);
    }
  }

  function focusFromPointer(clientX) {
    var normalized = logic.normalizedFromPointer(clientX, fan.getBoundingClientRect());
    focusCard(logic.indexFromNormalized(normalized, state.session.deck.length));
  }

  function focusCard(index, options) {
    if (index < 0 || index >= state.session.deck.length) return;
    if (state.focusIndex !== index) hapticSelection();
    state.focusIndex = index;
    if (!options || options.render !== false) {
      updateFanFocus();
    }
    updateDebugPosition();
  }

  function selectFocused(index) {
    var card = state.session.selectCard(index);
    if (!card) return;
    hapticImpact();
    state.focusIndex = Math.max(0, index - 1);
    renderSelected();
    updateShuffle();
    if (state.session.isSelectionComplete()) {
      fan.classList.add("disabled");
      shuffleButton.hidden = true;
      if (state.session.recipe.recipe_id === "banzhaf_fools_game") {
        directionPanel.hidden = false;
        status.textContent = "Выберите направление чтения";
      } else {
        state.selectedForReveal = card;
        showReveal(card);
      }
      return;
    }
    renderFan();
    updateStatus();
  }

  function updateFanFocus() {
    var slots = logic.visualFanSlots(state.session.deck.length, 29);
    var activeSlot = nearestVisualSlot(slots, state.focusIndex);
    Array.prototype.forEach.call(fan.children, function (item, index) {
      item.classList.toggle("focused", index === activeSlot);
      item.classList.toggle("near-focused", Math.abs(index - activeSlot) === 1);
      if (slots[index]) item.dataset.index = String(slots[index].logicalIndex);
    });
    updateDebugPosition();
  }

  function nearestVisualSlot(slots, logicalIndex) {
    var best = 0;
    var bestDistance = Infinity;
    slots.forEach(function (slot, index) {
      var distance = Math.abs(slot.logicalIndex - logicalIndex);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  }

  function renderSelected() {
    selected.innerHTML = "";
    var total = selectionTarget();
    state.session.selected.forEach(function (_, index) {
      var chip = document.createElement("span");
      chip.textContent = String(index + 1);
      selected.appendChild(chip);
    });
    status.textContent = "Выбрано " + state.session.selected.length + " из " + total;
  }

  function showReveal(card) {
    revealPanel.hidden = false;
    revealPanel.classList.remove("is-open");
    revealCard.innerHTML = "";
    var inner = document.createElement("div");
    inner.className = "revealed-inner";
    var back = document.createElement("div");
    back.className = "reveal-face reveal-back";
    var img = document.createElement("img");
    img.className = "reveal-face reveal-front";
    img.src = card.image;
    img.alt = card.name_ru;
    if (card.orientation === "reversed") img.classList.add("reversed");
    inner.appendChild(back);
    inner.appendChild(img);
    revealCard.appendChild(inner);
    revealName.textContent = card.name_ru + (card.orientation === "reversed" ? " · перевернутая" : "");
    revealName.hidden = true;
    revealButton.hidden = false;
    sendButton.hidden = true;
  }

  revealButton.addEventListener("click", function () {
    revealPanel.classList.add("is-open");
    revealName.hidden = false;
    revealButton.hidden = true;
    sendButton.hidden = false;
  });

  sendButton.addEventListener("click", function () {
    sendResult(state.session.result());
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-direction]"), function (button) {
    button.addEventListener("click", function () {
      var direction = button.dataset.direction;
      state.session.chooseDirection(direction);
      directionPanel.hidden = true;
      showSequence();
    });
  });

  function showSequence() {
    sequencePanel.hidden = false;
    sequence.innerHTML = "";
    var result = state.session.result();
    result.cards.forEach(function (card) {
      var full = findCard(card.card_id);
      var item = document.createElement("div");
      item.className = "sequence-card";
      var img = document.createElement("img");
      img.src = full.image;
      img.alt = full.name_ru;
      if (card.orientation === "reversed") img.classList.add("reversed");
      var label = document.createElement("div");
      label.textContent = card.position + ". " + full.name_ru;
      item.appendChild(img);
      item.appendChild(label);
      sequence.appendChild(item);
    });
    status.textContent = "Последовательность готова";
    document.getElementById("send-sequence-button").hidden = false;
  }

  document.getElementById("send-sequence-button").addEventListener("click", function () {
    sendResult(state.session.result());
  });

  shuffleButton.addEventListener("click", function () {
    if (!state.session.manualShuffle()) {
      status.textContent = "Карты уже выбираются.";
      updateShuffle();
      return;
    }
    state.focusIndex = 0;
    fan.classList.remove("just-shuffled");
    renderFan();
    updateStatus();
    updateShuffle();
    window.requestAnimationFrame(function () {
      fan.classList.add("just-shuffled");
    });
  });

  function sendResult(result) {
    var data = JSON.stringify(result);
    if (tg && typeof tg.sendData === "function") {
      tg.sendData(data);
      return;
    }
    hint.textContent = data;
    hint.classList.add("debug");
  }

  function findCard(cardId) {
    for (var i = 0; i < state.cards.length; i += 1) {
      if (state.cards[i].card_id === cardId) return state.cards[i];
    }
    return { card_id: cardId, name_ru: cardId, image: "" };
  }

  function updateStatus() {
    if (state.session.selected.length) {
      status.textContent = "Выбрано " + state.session.selected.length + " из " + selectionTarget();
      return;
    }
    status.textContent = "Проведите пальцем по вееру. Потяните выбранную вниз.";
    updateDebugPosition();
  }

  function updateShuffle() {
    var canShuffle = state.session && state.session.canManualShuffle && state.session.canManualShuffle();
    shuffleButton.disabled = !canShuffle;
    shuffleButton.textContent = canShuffle ? "Перемешать" : "Карты уже выбираются";
  }

  function updateDebugPosition() {
    if (!state.devMode || !debugPosition || !state.session) return;
    var total = state.session.deck.length;
    debugPosition.textContent = total ? (state.focusIndex + 1) + " / " + total : "";
  }

  function fanY(arcY, lift) {
    var y = (1 - arcY) * -38 + arcY * 18 + (lift || 0);
    return y.toFixed(2);
  }

  function selectionTarget() {
    var step = state.session.recipe.steps.filter(function (item) {
      return item.action === "user_select";
    })[0];
    return step ? step.count : 1;
  }

  function hapticSelection() {
    if (tg && tg.HapticFeedback && tg.HapticFeedback.selectionChanged) {
      tg.HapticFeedback.selectionChanged();
    }
  }

  function hapticImpact() {
    if (tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred) {
      tg.HapticFeedback.impactOccurred("light");
    }
  }

  function showError(message) {
    errorBox.hidden = false;
    errorBox.textContent = message;
    status.textContent = "Не удалось открыть выбор карт";
  }
})();
