(function () {
  "use strict";

  var logic = window.TaroMiniAppLogic;
  var tg = window.Telegram && window.Telegram.WebApp;
  var state = {
    cards: [],
    session: null,
    focusIndex: 0,
    dragStart: null,
    devMode: false,
    question: "",
    focusText: "",
    headerText: "",
    hintText: "",
    focusLabel: ""
    ,busy: false
    ,cutOrder: []
  };

  var fan = document.getElementById("fan");
  var status = document.getElementById("status");
  var deckStateLine = document.getElementById("deck-state");
  var hint = document.getElementById("hint");
  var selected = document.getElementById("selected");
  var revealPanel = document.getElementById("reveal-panel");
  var revealCard = document.getElementById("reveal-card");
  var revealName = document.getElementById("reveal-name");
  var revealButton = document.getElementById("reveal-button");
  var sendButton = document.getElementById("send-button");
  var questionPanel = document.getElementById("question-panel");
  var questionLabel = document.getElementById("question-label");
  var questionText = document.getElementById("question-text");
  var directionPanel = document.getElementById("direction-panel");
  var sequencePanel = document.getElementById("sequence-panel");
  var sequence = document.getElementById("sequence");
  var spreadPanel = document.getElementById("spread-panel");
  var spread = document.getElementById("spread");
  var revealSpreadButton = document.getElementById("reveal-spread-button");
  var sendSpreadButton = document.getElementById("send-spread-button");
  var errorBox = document.getElementById("error");
  var shuffleButton = document.getElementById("shuffle-button");
  var cutButton = document.getElementById("cut-button");
  var resetButton = document.getElementById("reset-button");
  var deckCount = document.getElementById("deck-count");
  var debugPosition = document.getElementById("debug-position");
  var mechanicStage = document.getElementById("mechanic-stage");
  var mechanicTitle = document.getElementById("mechanic-title");
  var mechanicPiles = document.getElementById("mechanic-piles");
  var mechanicProgress = document.getElementById("mechanic-progress");
  var mechanicCancel = document.getElementById("mechanic-cancel");
  var deckControls = document.getElementById("deck-controls");

  init();

  async function init() {
    try {
      if (tg) {
        tg.ready();
        tg.expand();
        document.body.classList.add("telegram");
      }
      var params = new URLSearchParams(window.location.search);
      var recipeId = params.get("recipe_id") || params.get("spread_type") || "card_of_the_day";
      var role = params.get("role");
      state.question = (params.get("question") || "").trim();
      state.focusText = (params.get("focus_text") || "").trim();
      state.headerText = (params.get("header_text") || "").trim();
      state.hintText = (params.get("hint_text") || "").trim();
      state.focusLabel = (params.get("focus_label") || "").trim();
      state.devMode = params.get("dev") === "1" || params.get("debug") === "1";
      debugPosition.hidden = !state.devMode;
      var recipe = Object.assign({}, logic.RECIPES[recipeId]);
      if (!recipe.recipe_id) throw new Error("Неизвестный рецепт.");
      if (role) recipe.role = role;
      if (state.question) recipe.question = state.question;
      renderQuestion();
      state.cards = await loadCards();
      var deckState = parseDeckState(params.get("deck_state"));
      state.session = logic.createSession(recipe, state.cards, null, deckState);
      attachFanEvents();
      renderFan();
      updateStatus();
      updateShuffle();
      if (state.devMode && params.get("demo") === "shuffle") {
        showMechanic("Части вплетаются небольшими группами", false);
        renderShuffleHalves();
        renderShufflePackets();
      } else if (state.devMode && params.get("demo") === "cut") {
        state.busy = true;
        state.cutOrder = [];
        showMechanic("Колода снята на пять стопок", true);
        mechanicProgress.textContent = "Нажимайте стопки в порядке, в котором хотите собрать колоду";
        renderCutPiles();
      }
    } catch (error) {
      showError(error.message || String(error));
    }
  }

  function parseDeckState(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { throw new Error("Не удалось открыть личную колоду."); }
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
    var candidateSlot = state.session.candidate
      ? nearestVisualSlot(slots, state.session.deck.indexOf(state.session.candidate))
      : -1;
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
      if (slot.slot === candidateSlot) item.classList.add("candidate");
      if (Math.abs(slot.slot - activeSlot) === 1) item.classList.add("near-focused");
      fan.appendChild(item);
    });
    focusCard(Math.min(state.focusIndex, state.session.deck.length - 1), { render: false });
    deckCount.textContent = state.session.deck.length + " карт";
  }

  function attachFanEvents() {
    fan.addEventListener("pointerdown", onPointerDown);
    fan.addEventListener("pointermove", onPointerMove);
    fan.addEventListener("pointerup", onPointerUp);
    fan.addEventListener("pointercancel", onPointerCancel);
    fan.addEventListener("click", function (event) { event.preventDefault(); });
  }

  function onPointerDown(event) {
    focusFromPointer(event.clientX);
    state.dragStart = { x: event.clientX, y: event.clientY, index: state.focusIndex };
    fan.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!state.dragStart) return;
    focusFromPointer(event.clientX);
  }

  function onPointerUp(event) {
    if (!state.dragStart) return;
    focusFromPointer(event.clientX);
    state.dragStart = null;
    state.session.setCandidate(state.focusIndex);
    hapticImpact();
    updateFanFocus();
    updateStatus();
    updateShuffle();
  }

  function onPointerCancel() {
    state.dragStart = null;
    if (!state.session.candidate) return;
    state.focusIndex = state.session.deck.indexOf(state.session.candidate);
    updateFanFocus();
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

  function openCandidate() {
    var card = state.session.commitCandidate();
    if (!card) return;
    hapticImpact();
    state.focusIndex = Math.min(state.focusIndex, Math.max(0, state.session.deck.length - 1));
    renderSelected();
    updateShuffle();
    if (state.session.isSelectionComplete()) {
      fan.classList.add("disabled");
      shuffleButton.hidden = true;
      if (state.session.recipe.recipe_id === "banzhaf_fools_game") {
        directionPanel.hidden = false;
        status.textContent = "Выберите направление чтения";
      } else {
        if (state.session.recipe.layout === "row_3") {
          showSpread(false);
        } else {
          showReveal(card, true);
        }
      }
      return;
    }
    renderFan();
    updateStatus();
  }

  function updateFanFocus() {
    var slots = logic.visualFanSlots(state.session.deck.length, 29);
    var activeSlot = nearestVisualSlot(slots, state.focusIndex);
    var candidateSlot = state.session.candidate
      ? nearestVisualSlot(slots, state.session.deck.indexOf(state.session.candidate))
      : -1;
    Array.prototype.forEach.call(fan.children, function (item, index) {
      item.classList.toggle("focused", index === activeSlot);
      item.classList.toggle("near-focused", Math.abs(index - activeSlot) === 1);
      if (slots[index]) item.dataset.index = String(slots[index].logicalIndex);
      item.classList.toggle("candidate", index === candidateSlot);
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

  function showReveal(card, open) {
    revealPanel.hidden = false;
    revealPanel.classList.toggle("is-open", !!open);
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
    revealName.hidden = !open;
    revealButton.hidden = !!open;
    sendButton.hidden = !open;
  }

  function renderQuestion() {
    var text = state.question || state.focusText;
    if (!text) {
      questionPanel.hidden = true;
      return;
    }
    hint.textContent = state.question
      ? (state.hintText || "Проведите пальцем по колоде и выберите карту.")
      : (state.hintText || "Проведите пальцем по колоде и выберите карту.");
    questionLabel.textContent = state.focusLabel || (state.question ? "Вопрос" : "Фокус");
    questionText.textContent = text;
    questionPanel.hidden = false;
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

  revealSpreadButton.addEventListener("click", function () {
    showSpread(true);
  });

  sendSpreadButton.addEventListener("click", function () {
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

  function showSpread(open) {
    spreadPanel.hidden = false;
    spreadPanel.classList.toggle("is-open", !!open);
    spread.innerHTML = "";
    var result = state.session.result();
    result.cards.forEach(function (card, index) {
      var full = findCard(card.card_id);
      var item = document.createElement("div");
      item.className = "spread-card";
      var label = document.createElement("div");
      label.className = "spread-label";
      label.textContent = spreadPositionLabel(card.position, index);
      var cardBox = document.createElement("div");
      cardBox.className = "spread-card-box";
      var back = document.createElement("div");
      back.className = "spread-face spread-back";
      var img = document.createElement("img");
      img.className = "spread-face spread-front";
      img.src = full.image;
      img.alt = full.name_ru;
      if (card.orientation === "reversed") img.classList.add("reversed");
      var name = document.createElement("div");
      name.className = "spread-name";
      name.textContent = full.name_ru + (card.orientation === "reversed" ? " · перевернутая" : "");
      cardBox.appendChild(back);
      cardBox.appendChild(img);
      item.appendChild(label);
      item.appendChild(cardBox);
      item.appendChild(name);
      spread.appendChild(item);
    });
    revealSpreadButton.hidden = !!open;
    sendSpreadButton.hidden = !open;
    status.textContent = open ? "Расклад готов" : "Три карты выбраны";
  }

  document.getElementById("send-sequence-button").addEventListener("click", function () {
    sendResult(state.session.result());
  });

  shuffleButton.addEventListener("click", async function () {
    if (state.session.candidate) {
      openCandidate();
      return;
    }
    if (!state.session.canManualShuffle() || state.busy) {
      status.textContent = "Карты уже выбираются.";
      updateShuffle();
      return;
    }
    state.busy = true;
    showMechanic("Колода разделяется на две части", false);
    renderShuffleHalves();
    state.session.manualShuffle();
    await wait(650);
    mechanicTitle.textContent = "Части вплетаются небольшими группами";
    renderShufflePackets();
    await wait(1180);
    mechanicPiles.classList.add("consume-left");
    await wait(280);
    mechanicPiles.classList.add("consume-right");
    await wait(520);
    mechanicTitle.textContent = "Колода снова собрана";
    mechanicProgress.textContent = "Порядок карт изменён и будет сохранён";
    await wait(520);
    state.focusIndex = 0;
    fan.classList.remove("just-shuffled", "from-shuffle");
    fan.classList.add("from-shuffle");
    renderFan();
    state.busy = false;
    hideMechanic();
    deckStateLine.textContent = "Колода перемешана.";
    updateStatus();
    updateShuffle();
    window.setTimeout(function () { fan.classList.remove("from-shuffle"); }, 1150);
  });

  cutButton.addEventListener("click", function () {
    if (!state.session.canManualShuffle() || state.busy) return;
    state.busy = true;
    state.cutOrder = [];
    showMechanic("Колода снята на пять стопок", true);
    mechanicProgress.textContent = "Нажимайте стопки в порядке, в котором хотите собрать колоду";
    renderCutPiles();
  });

  mechanicCancel.addEventListener("click", function () {
    if (!state.busy || !state.cutOrder) return;
    state.busy = false;
    state.cutOrder = [];
    hideMechanic();
    updateStatus();
    updateShuffle();
  });

  resetButton.addEventListener("click", async function () {
    if (!state.session.canManualShuffle() || state.busy) return;
    state.busy = true;
    showMechanic("Пять канонических стопок", false);
    renderCanonicalPiles();
    state.session.canonicalReset();
    await wait(560);
    mechanicPiles.classList.add("assemble-canonical");
    mechanicTitle.textContent = "Стопки собираются в каноническом порядке";
    await wait(900);
    state.focusIndex = 0;
    renderFan();
    hideMechanic();
    deckStateLine.textContent = "Пять канонических стопок собраны заново.";
    state.busy = false;
    updateStatus();
    updateShuffle();
    hapticImpact();
  });

  function showMechanic(title, cancellable) {
    fan.hidden = true;
    mechanicStage.hidden = false;
    mechanicTitle.textContent = title;
    mechanicPiles.innerHTML = "";
    mechanicPiles.className = "mechanic-piles";
    mechanicProgress.textContent = "";
    mechanicCancel.hidden = !cancellable;
    deckControls.hidden = true;
    shuffleButton.disabled = true;
    cutButton.disabled = true;
    resetButton.disabled = true;
    deckCount.textContent = state.cards.length + " карт";
  }

  function hideMechanic() {
    mechanicStage.hidden = true;
    fan.hidden = false;
    deckControls.hidden = false;
    mechanicPiles.innerHTML = "";
    shuffleButton.disabled = false;
    cutButton.disabled = false;
    resetButton.disabled = false;
  }

  function renderShuffleHalves() {
    ["left", "right"].forEach(function (side) {
      var pile = document.createElement("div");
      pile.className = "deck-pile shuffle-half " + side;
      mechanicPiles.appendChild(pile);
    });
    mechanicProgress.textContent = "Две части сохраняют внутренний порядок карт";
  }

  function renderShufflePackets() {
    for (var i = 0; i < 14; i += 1) {
      var packet = document.createElement("div");
      packet.className = "shuffle-packet";
      packet.style.setProperty("--packet-index", String(10 + i));
      packet.style.setProperty("--packet-from", (i % 2 ? "42px" : "calc(-100% - 42px)"));
      packet.style.setProperty("--packet-delay", (i * 105) + "ms");
      packet.style.setProperty("--packet-lift", (i * 1.7) + "px");
      mechanicPiles.appendChild(packet);
    }
    mechanicProgress.textContent = "Группы по несколько карт приходят то слева, то справа";
  }

  function renderCutPiles() {
    var size = state.session.deck.length;
    for (var i = 0; i < 5; i += 1) {
      var start = Math.floor(size * i / 5);
      var end = Math.floor(size * (i + 1) / 5);
      var pile = document.createElement("button");
      pile.type = "button";
      pile.className = "deck-pile cut-pile";
      pile.textContent = String(i + 1);
      pile.dataset.pileIndex = String(i);
      pile.dataset.count = String(end - start);
      pile.style.setProperty("--pile-left", (10 + i * 20) + "%");
      pile.style.setProperty("--pile-angle", ((i - 2) * 2.2) + "deg");
      pile.addEventListener("click", chooseCutPile);
      mechanicPiles.appendChild(pile);
    }
  }

  function renderCanonicalPiles() {
    var labels = ["Старшие", "Жезлы", "Кубки", "Мечи", "Пентакли"];
    var counts = [22, 14, 14, 14, 14];
    labels.forEach(function (label, index) {
      var pile = document.createElement("div");
      pile.className = "deck-pile canonical-pile";
      pile.dataset.label = label;
      pile.dataset.count = String(counts[index]);
      pile.style.setProperty("--pile-left", (10 + index * 20) + "%");
      pile.style.setProperty("--pile-angle", ((index - 2) * 2.2) + "deg");
      pile.style.setProperty("--canonical-index", String(index));
      mechanicPiles.appendChild(pile);
    });
    mechanicProgress.textContent = "Старшие арканы и четыре масти лежат отдельно";
  }

  async function chooseCutPile(event) {
    var pile = event.currentTarget;
    var index = parseInt(pile.dataset.pileIndex, 10);
    if (state.cutOrder.indexOf(index) !== -1) return;
    state.cutOrder.push(index);
    pile.classList.add("selected");
    pile.style.setProperty("--selection-index", String(state.cutOrder.length));
    pile.textContent = String(state.cutOrder.length);
    hapticSelection();
    mechanicProgress.textContent = "Порядок сборки: " + state.cutOrder.map(function (value) { return value + 1; }).join(" → ");
    if (state.cutOrder.length < 5) return;
    mechanicTitle.textContent = "Пять стопок собраны в выбранном порядке";
    var size = state.session.deck.length;
    var boundaries = [];
    for (var boundary = 1; boundary < 5; boundary += 1) boundaries.push(Math.floor(size * boundary / 5));
    state.session.pileCut(boundaries, state.cutOrder);
    await wait(650);
    state.focusIndex = 0;
    renderFan();
    hideMechanic();
    deckStateLine.textContent = "Пять стопок собраны в выбранном порядке.";
    state.busy = false;
    updateStatus();
    updateShuffle();
  }

  function wait(milliseconds) {
    return new Promise(function (resolve) { window.setTimeout(resolve, milliseconds); });
  }

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
    if (state.session.candidate) {
      status.textContent = "Карта выбрана. Можно открыть или выбрать другую.";
      updateDebugPosition();
      return;
    }
    if (state.session.selected.length) {
      status.textContent = "Выбрано " + state.session.selected.length + " из " + selectionTarget();
      return;
    }
    status.textContent = state.headerText || "Выберите карту";
    if (state.hintText && questionPanel.hidden) hint.textContent = state.hintText;
    updateDebugPosition();
  }

  function updateShuffle() {
    if (state.session && state.session.candidate) {
      shuffleButton.hidden = false;
      shuffleButton.disabled = false;
      shuffleButton.textContent = "Открыть";
      return;
    }
    var canShuffle = !state.busy && state.session && state.session.canManualShuffle && state.session.canManualShuffle();
    shuffleButton.hidden = false;
    shuffleButton.disabled = !canShuffle;
    shuffleButton.textContent = canShuffle ? "Перемешать" : "Выберите карту";
    cutButton.hidden = !canShuffle;
    resetButton.hidden = !canShuffle;
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

  function spreadPositionLabel(position, index) {
    var labels = state.session.recipe.position_labels_ru || {};
    return labels[position] || position || String(index + 1);
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
