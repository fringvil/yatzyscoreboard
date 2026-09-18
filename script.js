import {
  SCORE_CATEGORIES,
  UPPER_CATEGORY_KEYS,
  LOWER_CATEGORY_KEYS,
  CATEGORY_MAX_SCORES,
  STAKES_MULTIPLIERS,
  sanitizeScores,
  getNumericScore,
  calculateTotals,
  computeScoreForCategory,
} from "./logic.js";

const STORAGE_KEY = "yatzy-scoreboard-state-v2";

// ---------------------------------------------------------------------------
// Element references
// ---------------------------------------------------------------------------
const setupLobby = document.getElementById("setupLobby");
const gameArea = document.getElementById("gameArea");

const playerNameInput = document.getElementById("playerName");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const setupPlayerList = document.getElementById("setupPlayerList");

const playerNameInGameInput = document.getElementById("playerNameInGame");
const addPlayerInGameBtn = document.getElementById("addPlayerInGameBtn");

const resetScoresBtn = document.getElementById("resetScoresBtn");
const newGameBtn = document.getElementById("newGameBtn");
const editSetupBtn = document.getElementById("editSetupBtn");

const bettingToggle = document.getElementById("bettingToggle");
const diceToggle = document.getElementById("diceToggle");
const bettingSetup = document.getElementById("bettingSetup");

const betPlayerSelect = document.getElementById("betPlayerSelect");
const betTaskSelect = document.getElementById("betTaskSelect");
const betCustomTaskField = document.getElementById("betCustomTaskField");
const betCustomTaskInput = document.getElementById("betCustomTask");
const betCategorySelect = document.getElementById("betCategorySelect");
const betStakesSelect = document.getElementById("betStakesSelect");
const addBetBtn = document.getElementById("addBetBtn");
const betSummaryList = document.getElementById("betSummaryList");

const startGameBtn = document.getElementById("startGameBtn");

const diceRoller = document.getElementById("diceRoller");
const diceActivePlayerSelect = document.getElementById("diceActivePlayer");
const diceRow = document.getElementById("diceRow");
const rollDiceBtn = document.getElementById("rollDiceBtn");
const resetTurnBtn = document.getElementById("resetTurnBtn");
const rollCounter = document.getElementById("rollCounter");

const betStatusPanel = document.getElementById("betStatusPanel");
const betStatusList = document.getElementById("betStatusList");

const taskLogPanel = document.getElementById("taskLogPanel");
const taskLogList = document.getElementById("taskLogList");

const playerHeaderRow = document.getElementById("playerHeaderRow");
const scoreTableBody = document.getElementById("scoreTableBody");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = loadState();

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------
function createDefaultPlayer(name) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    scores: {},
  };
}

function createDefaultState() {
  return {
    setupComplete: false,
    bettingEnabled: false,
    digitalDiceEnabled: false,
    players: [],
    bets: [],
    taskLog: [],
    currentTurnPlayerId: null,
    dice: {
      values: [1, 1, 1, 1, 1],
      held: [false, false, false, false, false],
      rollsUsed: 0,
      activePlayerId: null,
    },
  };
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.players)) {
      return createDefaultState();
    }

    const players = parsed.players
      .filter((player) => player && typeof player.name === "string")
      .map((player) => ({
        id: typeof player.id === "string" ? player.id : `${Date.now()}-${Math.random()}`,
        name: player.name.trim().slice(0, 30) || "Player",
        scores: sanitizeScores(player.scores),
      }));

    const bets = Array.isArray(parsed.bets)
      ? parsed.bets
          .filter((bet) => bet && typeof bet.playerId === "string" && typeof bet.category === "string")
          .map((bet) => ({
            id: typeof bet.id === "string" ? bet.id : `${Date.now()}-${Math.random()}`,
            playerId: bet.playerId,
            task: typeof bet.task === "string" ? bet.task.slice(0, 60) : "Task",
            category: bet.category,
            condition: typeof bet.condition === "string" ? bet.condition : "Score successfully in this category",
            stakes: STAKES_MULTIPLIERS[bet.stakes] ? bet.stakes : "normal",
            status: ["pending", "won", "lost"].includes(bet.status) ? bet.status : "pending",
          }))
      : [];

    const taskLog = Array.isArray(parsed.taskLog)
      ? parsed.taskLog
          .filter((entry) => entry && typeof entry.playerId === "string")
          .map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : `${Date.now()}-${Math.random()}`,
            playerId: entry.playerId,
            task: typeof entry.task === "string" ? entry.task.slice(0, 60) : "Task",
            category: typeof entry.category === "string" ? entry.category : "",
            status: ["pending", "completed", "forgiven"].includes(entry.status) ? entry.status : "pending",
            timestamp: typeof entry.timestamp === "number" ? entry.timestamp : Date.now(),
          }))
      : [];

    const dice = parsed.dice && typeof parsed.dice === "object" ? parsed.dice : {};

    const currentTurnPlayerId =
      typeof parsed.currentTurnPlayerId === "string" && players.some((player) => player.id === parsed.currentTurnPlayerId)
        ? parsed.currentTurnPlayerId
        : null;

    return {
      setupComplete: Boolean(parsed.setupComplete),
      bettingEnabled: Boolean(parsed.bettingEnabled),
      digitalDiceEnabled: Boolean(parsed.digitalDiceEnabled),
      players,
      bets,
      taskLog,
      currentTurnPlayerId,
      dice: {
        values: Array.isArray(dice.values) && dice.values.length === 5 ? dice.values : [1, 1, 1, 1, 1],
        held: Array.isArray(dice.held) && dice.held.length === 5 ? dice.held : [false, false, false, false, false],
        rollsUsed: typeof dice.rollsUsed === "number" ? dice.rollsUsed : 0,
        activePlayerId: typeof dice.activePlayerId === "string" ? dice.activePlayerId : null,
      },
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function saveAndRender() {
  saveState();
  render();
}

// ---------------------------------------------------------------------------
// Turn management
// ---------------------------------------------------------------------------
function ensureValidCurrentTurn() {
  if (!state.players.length) {
    state.currentTurnPlayerId = null;
    return;
  }

  if (!state.players.some((player) => player.id === state.currentTurnPlayerId)) {
    state.currentTurnPlayerId = state.players[0].id;
  }
}

function advanceTurn() {
  if (!state.players.length) {
    state.currentTurnPlayerId = null;
    return;
  }

  const currentIndex = state.players.findIndex((player) => player.id === state.currentTurnPlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.players.length;
  state.currentTurnPlayerId = state.players[nextIndex].id;

  if (state.digitalDiceEnabled) {
    state.dice.activePlayerId = state.currentTurnPlayerId;
    state.dice.rollsUsed = 0;
    state.dice.held = [false, false, false, false, false];
  }
}

// ---------------------------------------------------------------------------
// Player management
// ---------------------------------------------------------------------------
function addPlayer(name) {
  const trimmed = name.trim().slice(0, 30);
  if (!trimmed) {
    return;
  }

  state.players.push(createDefaultPlayer(trimmed));
  ensureValidCurrentTurn();
  saveAndRender();
}

function removePlayer(playerId) {
  const player = state.players.find((p) => p.id === playerId);
  const playerName = player ? player.name : "this player";
  if (!window.confirm(`Remove ${playerName}? This will delete their scores.`)) {
    return;
  }
  state.players = state.players.filter((player) => player.id !== playerId);
  state.bets = state.bets.filter((bet) => bet.playerId !== playerId);
  state.taskLog = state.taskLog.filter((entry) => entry.playerId !== playerId);
  if (state.dice.activePlayerId === playerId) {
    state.dice.activePlayerId = state.players.length ? state.players[0].id : null;
  }
  ensureValidCurrentTurn();
  saveAndRender();
}

playerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addPlayer(playerNameInput.value);
    playerNameInput.value = "";
  }
});
addPlayerBtn.addEventListener("click", () => {
  addPlayer(playerNameInput.value);
  playerNameInput.value = "";
});

playerNameInGameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addPlayer(playerNameInGameInput.value);
    playerNameInGameInput.value = "";
  }
});
addPlayerInGameBtn.addEventListener("click", () => {
  addPlayer(playerNameInGameInput.value);
  playerNameInGameInput.value = "";
});

// ---------------------------------------------------------------------------
// Setup lobby: toggles
// ---------------------------------------------------------------------------
bettingToggle.addEventListener("change", () => {
  state.bettingEnabled = bettingToggle.checked;
  saveAndRender();
});

diceToggle.addEventListener("change", () => {
  state.digitalDiceEnabled = diceToggle.checked;
  saveAndRender();
});

betTaskSelect.addEventListener("change", () => {
  betCustomTaskField.hidden = betTaskSelect.value !== "custom";
});

addBetBtn.addEventListener("click", () => {
  const playerId = betPlayerSelect.value;
  if (!playerId) {
    return;
  }

  const category = betCategorySelect.value;
  if (!category) {
    return;
  }

  const alreadyBetOnCategory = state.bets.some((bet) => bet.playerId === playerId && bet.category === category);
  if (alreadyBetOnCategory) {
    window.alert("This player already has a bet on that category. Only one bet per category is allowed.");
    return;
  }

  let task = betTaskSelect.value;
  if (task === "custom") {
    task = betCustomTaskInput.value.trim().slice(0, 60);
    if (!task) {
      betCustomTaskInput.focus();
      return;
    }
  }

  state.bets.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playerId,
    task,
    category,
    condition: "Score successfully in this category",
    stakes: betStakesSelect.value,
    status: "pending",
  });

  betCustomTaskInput.value = "";
  saveAndRender();
});

function removeBet(betId) {
  state.bets = state.bets.filter((bet) => bet.id !== betId);
  saveAndRender();
}

startGameBtn.addEventListener("click", () => {
  if (!state.players.length) {
    window.alert("Add at least one player before starting the game.");
    return;
  }

  state.setupComplete = true;
  if (state.digitalDiceEnabled && !state.dice.activePlayerId) {
    state.dice.activePlayerId = state.players[0].id;
  }
  ensureValidCurrentTurn();
  saveAndRender();
});

editSetupBtn.addEventListener("click", () => {
  state.setupComplete = false;
  saveAndRender();
});

// ---------------------------------------------------------------------------
// Game controls
// ---------------------------------------------------------------------------
resetScoresBtn.addEventListener("click", () => {
  if (!state.players.length) {
    return;
  }

  if (!window.confirm("Reset all scores for every player?")) {
    return;
  }

  for (const player of state.players) {
    player.scores = {};
  }

  for (const bet of state.bets) {
    bet.status = "pending";
  }
  state.taskLog = [];
  state.currentTurnPlayerId = state.players.length ? state.players[0].id : null;

  saveAndRender();
});

newGameBtn.addEventListener("click", () => {
  if (!state.players.length && !state.bets.length) {
    return;
  }

  if (!window.confirm("Start a new game? This clears all players, bets, tasks, and scores.")) {
    return;
  }

  const fresh = createDefaultState();
  Object.assign(state, fresh);
  saveAndRender();
});

// ---------------------------------------------------------------------------
// Betting logic
// ---------------------------------------------------------------------------
function getBetForPlayerCategory(playerId, categoryKey) {
  return state.bets.find((bet) => bet.playerId === playerId && bet.category === categoryKey);
}

function resolveBetForScore(player, categoryKey, scoreValue) {
  const bet = getBetForPlayerCategory(player.id, categoryKey);
  if (!bet || bet.status !== "pending") {
    return;
  }

  if (scoreValue > 0) {
    bet.status = "won";
    return;
  }

  bet.status = "lost";
  state.taskLog.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playerId: player.id,
    task: bet.task,
    category: categoryKey,
    status: "pending",
    timestamp: Date.now(),
  });
}

function setTaskLogStatus(taskId, status) {
  const entry = state.taskLog.find((task) => task.id === taskId);
  if (!entry) {
    return;
  }
  entry.status = status;
  saveAndRender();
}

// ---------------------------------------------------------------------------
// Digital dice logic
// ---------------------------------------------------------------------------
function rollDice() {
  if (state.dice.rollsUsed >= 3) {
    return;
  }

  state.dice.values = state.dice.values.map((value, index) => {
    if (state.dice.held[index]) {
      return value;
    }
    return 1 + Math.floor(Math.random() * 6);
  });
  state.dice.rollsUsed += 1;
  saveAndRender();
}

function toggleHold(index) {
  if (state.dice.rollsUsed === 0) {
    return;
  }
  state.dice.held[index] = !state.dice.held[index];
  saveAndRender();
}

function startNewTurn() {
  state.dice.rollsUsed = 0;
  state.dice.held = [false, false, false, false, false];
  saveAndRender();
}

function applyDiceScoreToActivePlayer(categoryKey) {
  const player = state.players.find((entry) => entry.id === state.dice.activePlayerId);
  if (!player) {
    return;
  }
  if (state.dice.rollsUsed === 0) {
    return;
  }

  const hadValue = typeof player.scores[categoryKey] === "number";
  const score = computeScoreForCategory(state.dice.values, categoryKey);
  player.scores[categoryKey] = score;
  resolveBetForScore(player, categoryKey, score);

  if (!hadValue && player.id === state.currentTurnPlayerId) {
    advanceTurn();
  }

  saveAndRender();
}

// ---------------------------------------------------------------------------
// Scoring table rendering
// ---------------------------------------------------------------------------
function createScoreInput(player, categoryKey) {
  const input = document.createElement("input");
  input.type = "number";
  input.className = "score-input";
  input.inputMode = "numeric";
  input.min = "0";
  input.step = "1";
  input.max = String(CATEGORY_MAX_SCORES[categoryKey] ?? 0);

  const value = player.scores[categoryKey];
  input.value = typeof value === "number" ? String(value) : "";

  input.addEventListener("focus", () => {
    input.dataset.hadValueBeforeEdit = typeof player.scores[categoryKey] === "number" ? "1" : "0";
  });

  input.addEventListener("input", (event) => {
    const rawValue = event.target.value;

    if (rawValue === "") {
      delete player.scores[categoryKey];
      saveState();
      updateTotalsForPlayer(player.id);
      return;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    const maxScore = CATEGORY_MAX_SCORES[categoryKey] ?? 0;
    player.scores[categoryKey] = Math.max(0, Math.min(maxScore, Math.trunc(parsedValue)));
    event.target.value = String(player.scores[categoryKey]);
    saveState();
    resolveBetForScore(player, categoryKey, player.scores[categoryKey]);
    updateTotalsForPlayer(player.id);
    renderBetStatus();
    renderTaskLog();
  });

  input.addEventListener("change", () => {
    const hasValue = typeof player.scores[categoryKey] === "number";
    const hadValueBeforeEdit = input.dataset.hadValueBeforeEdit === "1";

    if (hasValue && !hadValueBeforeEdit && player.id === state.currentTurnPlayerId) {
      advanceTurn();
      saveAndRender();
    }
  });

  return input;
}

function createCell(content, className = "") {
  const td = document.createElement("td");
  if (className) {
    td.className = className;
  }

  if (typeof content === "string") {
    td.textContent = content;
  } else {
    td.appendChild(content);
  }

  return td;
}

function createScoreCellContent(player, categoryKey) {
  const wrapper = document.createElement("div");
  wrapper.className = "score-cell-content";
  wrapper.appendChild(createScoreInput(player, categoryKey));

  if (
    state.digitalDiceEnabled &&
    state.setupComplete &&
    state.dice.activePlayerId === player.id &&
    state.dice.rollsUsed > 0
  ) {
    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "apply-dice-btn";
    applyBtn.title = "Apply current dice roll to this category";
    applyBtn.setAttribute("aria-label", `Apply dice score to ${categoryKey}`);
    applyBtn.textContent = "🎲";
    applyBtn.addEventListener("click", () => applyDiceScoreToActivePlayer(categoryKey));
    wrapper.appendChild(applyBtn);
  }

  return wrapper;
}

function createRow({ label, sectionClass = "", isTotal = false, isGrandTotal = false, scoreKey = null, totalKey = null }) {
  const row = document.createElement("tr");
  if (sectionClass) {
    row.classList.add(sectionClass);
  }
  if (isTotal) {
    row.classList.add("total-row");
  }
  if (isGrandTotal) {
    row.classList.add("grand-total-row");
  }

  const labelCell = document.createElement("th");
  labelCell.scope = "row";
  labelCell.className = "category-col";
  labelCell.textContent = label;
  row.appendChild(labelCell);

  for (const player of state.players) {
    if (scoreKey) {
      row.appendChild(createCell(createScoreCellContent(player, scoreKey)));
      continue;
    }
    if (!totalKey) {
      row.appendChild(createCell(""));
      continue;
    }

    const totals = calculateTotals(player);
    const totalCell = createCell(String(totals[totalKey]), "total-value");
    totalCell.dataset.playerId = player.id;
    totalCell.dataset.totalKey = totalKey;
    row.appendChild(totalCell);
  }

  return row;
}

function updateTotalsForPlayer(playerId) {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return;
  }

  const totals = calculateTotals(player);
  const totalCells = scoreTableBody.querySelectorAll("[data-player-id][data-total-key]");
  for (const cell of totalCells) {
    if (cell.dataset.playerId !== playerId) {
      continue;
    }

    const key = cell.dataset.totalKey;
    cell.textContent = key && key in totals ? String(totals[key]) : "";
  }
}

function renderHeader() {
  playerHeaderRow.innerHTML = "";
  const categoryHeader = document.createElement("th");
  categoryHeader.scope = "col";
  categoryHeader.className = "category-col";
  categoryHeader.textContent = "Category";
  playerHeaderRow.appendChild(categoryHeader);

  for (const player of state.players) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = "player-header";
    if (state.setupComplete && player.id === state.currentTurnPlayerId) {
      th.classList.add("current-turn");
    }

    const content = document.createElement("div");
    content.className = "player-header-content";

    const nameWrap = document.createElement("div");
    nameWrap.className = "player-name-wrap";

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.name;
    nameWrap.appendChild(name);

    if (state.setupComplete && player.id === state.currentTurnPlayerId) {
      const badge = document.createElement("span");
      badge.className = "turn-badge";
      badge.textContent = "Current turn";
      nameWrap.appendChild(badge);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-player-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removePlayer(player.id));

    content.append(nameWrap, removeBtn);
    th.appendChild(content);
    playerHeaderRow.appendChild(th);
  }
}

function renderBody() {
  scoreTableBody.innerHTML = "";

  if (!state.players.length) {
    const row = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 1;
    td.className = "empty-state";
    td.textContent = "Add players to start scoring.";
    row.appendChild(td);
    scoreTableBody.appendChild(row);
    return;
  }

  scoreTableBody.appendChild(createRow({ label: "Upper Section", sectionClass: "section-row" }));

  for (const category of SCORE_CATEGORIES.filter((entry) => entry.section === "upper")) {
    scoreTableBody.appendChild(createRow({ label: category.label, scoreKey: category.key }));
  }

  scoreTableBody.appendChild(createRow({ label: "Sum", isTotal: true, totalKey: "upperSum" }));
  scoreTableBody.appendChild(createRow({ label: "Bonus", isTotal: true, totalKey: "bonus" }));
  scoreTableBody.appendChild(createRow({ label: "Upper Total", isTotal: true, totalKey: "upperTotal" }));

  scoreTableBody.appendChild(createRow({ label: "Lower Section", sectionClass: "section-row" }));

  for (const category of SCORE_CATEGORIES.filter((entry) => entry.section === "lower")) {
    scoreTableBody.appendChild(createRow({ label: category.label, scoreKey: category.key }));
  }

  scoreTableBody.appendChild(createRow({ label: "Lower Total", isTotal: true, totalKey: "lowerTotal" }));
  scoreTableBody.appendChild(createRow({ label: "Grand Total", isGrandTotal: true, totalKey: "grandTotal" }));
}

// ---------------------------------------------------------------------------
// Setup lobby rendering
// ---------------------------------------------------------------------------
function renderSetupPlayerList() {
  setupPlayerList.innerHTML = "";
  for (const player of state.players) {
    const li = document.createElement("li");
    li.className = "setup-player-item";

    const name = document.createElement("span");
    name.textContent = player.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-player-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removePlayer(player.id));

    li.append(name, removeBtn);
    setupPlayerList.appendChild(li);
  }
}

function populateSelectOptions(selectEl, options, placeholder) {
  selectEl.innerHTML = "";
  if (placeholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    selectEl.appendChild(opt);
  }
  for (const option of options) {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    selectEl.appendChild(opt);
  }
}

function renderBetForm() {
  populateSelectOptions(
    betPlayerSelect,
    state.players.map((player) => ({ value: player.id, label: player.name })),
    state.players.length ? null : "Add a player first"
  );
  populateSelectOptions(
    betCategorySelect,
    SCORE_CATEGORIES.map((category) => ({ value: category.key, label: category.label }))
  );
}

function renderBetSummary() {
  betSummaryList.innerHTML = "";

  if (!state.bets.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = "No bets placed yet.";
    betSummaryList.appendChild(li);
    return;
  }

  for (const bet of state.bets) {
    const player = state.players.find((entry) => entry.id === bet.playerId);
    const category = SCORE_CATEGORIES.find((entry) => entry.key === bet.category);
    const li = document.createElement("li");
    li.className = "bet-summary-item";

    const text = document.createElement("span");
    text.textContent = `${player ? player.name : "Unknown"} bets on ${category ? category.label : bet.category}: "${bet.task}" (${bet.stakes} stakes)`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-player-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeBet(bet.id));

    li.append(text, removeBtn);
    betSummaryList.appendChild(li);
  }
}

function renderSetupLobby() {
  setupLobby.hidden = state.setupComplete;
  gameArea.hidden = !state.setupComplete;

  bettingToggle.checked = state.bettingEnabled;
  diceToggle.checked = state.digitalDiceEnabled;
  bettingSetup.hidden = !state.bettingEnabled;

  renderSetupPlayerList();
  renderBetForm();
  renderBetSummary();
}

// ---------------------------------------------------------------------------
// Dice roller rendering
// ---------------------------------------------------------------------------
const DIE_FACES = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

function renderDiceRoller() {
  const show = state.setupComplete && state.digitalDiceEnabled;
  diceRoller.hidden = !show;
  if (!show) {
    return;
  }

  populateSelectOptions(
    diceActivePlayerSelect,
    state.players.map((player) => ({ value: player.id, label: player.name }))
  );
  if (state.dice.activePlayerId) {
    diceActivePlayerSelect.value = state.dice.activePlayerId;
  }

  diceRow.innerHTML = "";
  state.dice.values.forEach((value, index) => {
    const die = document.createElement("button");
    die.type = "button";
    die.className = "die";
    if (state.dice.held[index]) {
      die.classList.add("die-held");
    }
    die.textContent = DIE_FACES[value] || String(value);
    die.setAttribute("aria-label", `Die ${index + 1}: ${value}${state.dice.held[index] ? " (held)" : ""}`);
    die.addEventListener("click", () => toggleHold(index));
    diceRow.appendChild(die);
  });

  rollCounter.textContent = `Rolls: ${state.dice.rollsUsed} / 3`;
  rollDiceBtn.disabled = state.dice.rollsUsed >= 3;
}

diceActivePlayerSelect.addEventListener("change", () => {
  state.dice.activePlayerId = diceActivePlayerSelect.value || null;
  saveAndRender();
});

rollDiceBtn.addEventListener("click", rollDice);
resetTurnBtn.addEventListener("click", startNewTurn);

// ---------------------------------------------------------------------------
// Bet status panel & task log rendering
// ---------------------------------------------------------------------------
function renderBetStatus() {
  const show = state.setupComplete && state.bettingEnabled;
  betStatusPanel.hidden = !show;
  if (!show) {
    return;
  }

  betStatusList.innerHTML = "";

  if (!state.bets.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = "No active bets.";
    betStatusList.appendChild(li);
    return;
  }

  for (const bet of state.bets) {
    const player = state.players.find((entry) => entry.id === bet.playerId);
    const category = SCORE_CATEGORIES.find((entry) => entry.key === bet.category);
    const li = document.createElement("li");
    li.className = `bet-status-item bet-status-${bet.status}`;
    li.textContent = `${player ? player.name : "Unknown"} — ${category ? category.label : bet.category}: "${bet.task}" — ${bet.status}`;
    betStatusList.appendChild(li);
  }
}

function renderTaskLog() {
  const show = state.setupComplete && state.bettingEnabled;
  taskLogPanel.hidden = !show;
  if (!show) {
    return;
  }

  taskLogList.innerHTML = "";

  if (!state.taskLog.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = "No tasks yet.";
    taskLogList.appendChild(li);
    return;
  }

  for (const entry of state.taskLog) {
    const player = state.players.find((item) => item.id === entry.playerId);
    const category = SCORE_CATEGORIES.find((item) => item.key === entry.category);
    const li = document.createElement("li");
    li.className = `task-log-item task-log-${entry.status}`;

    const text = document.createElement("span");
    const date = new Date(entry.timestamp);
    text.textContent = `${player ? player.name : "Unknown"} owes: "${entry.task}" (from ${category ? category.label : entry.category}) — ${entry.status} — ${date.toLocaleString()}`;
    li.appendChild(text);

    if (entry.status === "pending") {
      const completeBtn = document.createElement("button");
      completeBtn.type = "button";
      completeBtn.className = "secondary";
      completeBtn.textContent = "Mark Completed";
      completeBtn.addEventListener("click", () => setTaskLogStatus(entry.id, "completed"));

      const forgiveBtn = document.createElement("button");
      forgiveBtn.type = "button";
      forgiveBtn.className = "secondary";
      forgiveBtn.textContent = "Forgive";
      forgiveBtn.addEventListener("click", () => setTaskLogStatus(entry.id, "forgiven"));

      li.append(completeBtn, forgiveBtn);
    }

    taskLogList.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Master render
// ---------------------------------------------------------------------------
function render() {
  renderSetupLobby();
  renderDiceRoller();
  renderBetStatus();
  renderTaskLog();
  renderHeader();
  renderBody();
}

render();
