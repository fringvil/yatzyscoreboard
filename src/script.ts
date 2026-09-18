import {
  SCORE_CATEGORIES,
  CATEGORY_MAX_SCORES,
  STAKES_MULTIPLIERS,
  sanitizeScores,
  calculateTotals,
  computeScoreForCategory,
  Player,
  Stakes,
  Totals,
} from "./logic.js";

const STORAGE_KEY = "yatzy-scoreboard-state-v2";

const ALL_PLAYERS_OPTION = "__all__";
const WIN_GAME_CATEGORY = "winGame";

type BetStatus = "pending" | "won" | "lost";
type TaskStatus = "pending" | "completed" | "forgiven";

interface Bet {
  id: string;
  playerId: string;
  task: string;
  category: string;
  condition: string;
  stakes: Stakes;
  status: BetStatus;
}

interface TaskLogEntry {
  id: string;
  playerId: string;
  task: string;
  category: string;
  status: TaskStatus;
  timestamp: number;
}

interface DiceState {
  values: number[];
  held: boolean[];
  rollsUsed: number;
  activePlayerId: string | null;
}

interface State {
  setupComplete: boolean;
  bettingEnabled: boolean;
  digitalDiceEnabled: boolean;
  players: Player[];
  bets: Bet[];
  taskLog: TaskLogEntry[];
  currentTurnPlayerId: string | null;
  dice: DiceState;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element as T;
}

// ---------------------------------------------------------------------------
// Element references
// ---------------------------------------------------------------------------
const setupLobby = byId<HTMLElement>("setupLobby");
const gameArea = byId<HTMLElement>("gameArea");

const playerNameInput = byId<HTMLInputElement>("playerName");
const addPlayerBtn = byId<HTMLButtonElement>("addPlayerBtn");
const setupPlayerList = byId<HTMLUListElement>("setupPlayerList");

const playerNameInGameInput = byId<HTMLInputElement>("playerNameInGame");
const addPlayerInGameBtn = byId<HTMLButtonElement>("addPlayerInGameBtn");

const resetScoresBtn = byId<HTMLButtonElement>("resetScoresBtn");
const newGameBtn = byId<HTMLButtonElement>("newGameBtn");
const editSetupBtn = byId<HTMLButtonElement>("editSetupBtn");

const bettingToggle = byId<HTMLInputElement>("bettingToggle");
const diceToggle = byId<HTMLInputElement>("diceToggle");
const bettingSetup = byId<HTMLElement>("bettingSetup");

const betPlayerSelect = byId<HTMLSelectElement>("betPlayerSelect");
const betTaskSelect = byId<HTMLSelectElement>("betTaskSelect");
const betCustomTaskField = byId<HTMLElement>("betCustomTaskField");
const betCustomTaskInput = byId<HTMLInputElement>("betCustomTask");
const betCategorySelect = byId<HTMLSelectElement>("betCategorySelect");
const betStakesSelect = byId<HTMLSelectElement>("betStakesSelect");
const addBetBtn = byId<HTMLButtonElement>("addBetBtn");
const betSummaryList = byId<HTMLUListElement>("betSummaryList");

const startGameBtn = byId<HTMLButtonElement>("startGameBtn");

const diceRoller = byId<HTMLElement>("diceRoller");
const diceActivePlayerSelect = byId<HTMLSelectElement>("diceActivePlayer");
const diceRow = byId<HTMLElement>("diceRow");
const rollDiceBtn = byId<HTMLButtonElement>("rollDiceBtn");
const resetTurnBtn = byId<HTMLButtonElement>("resetTurnBtn");
const rollCounter = byId<HTMLElement>("rollCounter");

const betStatusPanel = byId<HTMLElement>("betStatusPanel");
const betStatusList = byId<HTMLUListElement>("betStatusList");

const taskLogPanel = byId<HTMLElement>("taskLogPanel");
const taskLogList = byId<HTMLUListElement>("taskLogList");

const playerHeaderRow = byId<HTMLTableRowElement>("playerHeaderRow");
const scoreTableBody = byId<HTMLTableSectionElement>("scoreTableBody");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state: State = loadState();

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------
function createDefaultPlayer(name: string): Player {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    scores: {},
  };
}

function createDefaultState(): State {
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

function loadState(): State {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.players)) {
      return createDefaultState();
    }

    const players: Player[] = parsed.players
      .filter((player: unknown): player is { name: string } => {
        return Boolean(player) && typeof (player as Record<string, unknown>).name === "string";
      })
      .map((player: Record<string, unknown>) => ({
        id: typeof player.id === "string" ? player.id : `${Date.now()}-${Math.random()}`,
        name: (player.name as string).trim().slice(0, 30) || "Player",
        scores: sanitizeScores(player.scores),
      }));

    const bets: Bet[] = Array.isArray(parsed.bets)
      ? parsed.bets
          .filter(
            (bet: unknown): bet is Record<string, unknown> =>
              Boolean(bet) &&
              typeof (bet as Record<string, unknown>).playerId === "string" &&
              typeof (bet as Record<string, unknown>).category === "string"
          )
          .map((bet: Record<string, unknown>) => ({
            id: typeof bet.id === "string" ? bet.id : `${Date.now()}-${Math.random()}`,
            playerId: bet.playerId as string,
            task: typeof bet.task === "string" ? bet.task.slice(0, 60) : "Task",
            category: bet.category as string,
            condition: typeof bet.condition === "string" ? bet.condition : "Score successfully in this category",
            stakes: (STAKES_MULTIPLIERS as Record<string, number>)[bet.stakes as string]
              ? (bet.stakes as Stakes)
              : "normal",
            status: ["pending", "won", "lost"].includes(bet.status as string) ? (bet.status as BetStatus) : "pending",
          }))
      : [];

    const taskLog: TaskLogEntry[] = Array.isArray(parsed.taskLog)
      ? parsed.taskLog
          .filter(
            (entry: unknown): entry is Record<string, unknown> =>
              Boolean(entry) && typeof (entry as Record<string, unknown>).playerId === "string"
          )
          .map((entry: Record<string, unknown>) => ({
            id: typeof entry.id === "string" ? entry.id : `${Date.now()}-${Math.random()}`,
            playerId: entry.playerId as string,
            task: typeof entry.task === "string" ? entry.task.slice(0, 60) : "Task",
            category: typeof entry.category === "string" ? entry.category : "",
            status: ["pending", "completed", "forgiven"].includes(entry.status as string)
              ? (entry.status as TaskStatus)
              : "pending",
            timestamp: typeof entry.timestamp === "number" ? entry.timestamp : Date.now(),
          }))
      : [];

    const dice = parsed.dice && typeof parsed.dice === "object" ? parsed.dice : {};

    const currentTurnPlayerId =
      typeof parsed.currentTurnPlayerId === "string" &&
      players.some((player) => player.id === parsed.currentTurnPlayerId)
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

function saveState(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures (e.g. private browsing quota errors).
  }
}

function saveAndRender(): void {
  saveState();
  render();
}

// ---------------------------------------------------------------------------
// Turn management
// ---------------------------------------------------------------------------
function ensureValidCurrentTurn(): void {
  if (!state.players.length) {
    state.currentTurnPlayerId = null;
    return;
  }

  if (!state.players.some((player) => player.id === state.currentTurnPlayerId)) {
    state.currentTurnPlayerId = state.players[0].id;
  }
}

function advanceTurn(): void {
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
function addPlayer(name: string): void {
  const trimmed = name.trim().slice(0, 30);
  if (!trimmed) {
    return;
  }

  state.players.push(createDefaultPlayer(trimmed));
  ensureValidCurrentTurn();
  saveAndRender();
}

function removePlayer(playerId: string): void {
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
  const playerSelection = betPlayerSelect.value;
  if (!playerSelection) {
    return;
  }

  const category = betCategorySelect.value;
  if (!category) {
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

  const targetPlayerIds =
    playerSelection === ALL_PLAYERS_OPTION ? state.players.map((player) => player.id) : [playerSelection];

  const condition = category === WIN_GAME_CATEGORY ? "Win the whole game" : "Score successfully in this category";

  let skippedCount = 0;
  for (const playerId of targetPlayerIds) {
    const alreadyBetOnCategory = state.bets.some((bet) => bet.playerId === playerId && bet.category === category);
    if (alreadyBetOnCategory) {
      skippedCount += 1;
      continue;
    }

    state.bets.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerId,
      task,
      category,
      condition,
      stakes: betStakesSelect.value as Stakes,
      status: "pending",
    });
  }

  if (skippedCount > 0) {
    window.alert(
      skippedCount === targetPlayerIds.length
        ? "Every selected player already has a bet on that category. Only one bet per category is allowed per player."
        : `${skippedCount} player(s) already had a bet on that category and were skipped.`
    );
  }

  betCustomTaskInput.value = "";
  saveAndRender();
});

function removeBet(betId: string): void {
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
function getBetForPlayerCategory(playerId: string, categoryKey: string): Bet | undefined {
  return state.bets.find((bet) => bet.playerId === playerId && bet.category === categoryKey);
}

function resolveBetForScore(player: Player, categoryKey: string, scoreValue: number): void {
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

function setTaskLogStatus(taskId: string, status: TaskStatus): void {
  const entry = state.taskLog.find((task) => task.id === taskId);
  if (!entry) {
    return;
  }
  entry.status = status;
  saveAndRender();
}

function allCategoriesFilled(player: Player): boolean {
  return SCORE_CATEGORIES.every((category) => typeof player.scores[category.key] === "number");
}

function isGameComplete(): boolean {
  return state.players.length > 0 && state.players.every(allCategoriesFilled);
}

function resolveWinGameBets(): void {
  if (!isGameComplete()) {
    return;
  }

  const winGameBets = state.bets.filter((bet) => bet.category === WIN_GAME_CATEGORY && bet.status === "pending");
  if (!winGameBets.length) {
    return;
  }

  const highestTotal = Math.max(...state.players.map((player) => calculateTotals(player).grandTotal));

  for (const bet of winGameBets) {
    const player = state.players.find((entry) => entry.id === bet.playerId);
    if (!player) {
      continue;
    }

    if (calculateTotals(player).grandTotal === highestTotal) {
      bet.status = "won";
      continue;
    }

    bet.status = "lost";
    state.taskLog.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerId: player.id,
      task: bet.task,
      category: WIN_GAME_CATEGORY,
      status: "pending",
      timestamp: Date.now(),
    });
  }
}

// ---------------------------------------------------------------------------
// Digital dice logic
// ---------------------------------------------------------------------------
function rollDice(): void {
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

function toggleHold(index: number): void {
  if (state.dice.rollsUsed === 0) {
    return;
  }
  state.dice.held[index] = !state.dice.held[index];
  saveAndRender();
}

function startNewTurn(): void {
  state.dice.rollsUsed = 0;
  state.dice.held = [false, false, false, false, false];
  saveAndRender();
}

function applyDiceScoreToActivePlayer(categoryKey: string): void {
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
  resolveWinGameBets();

  if (!hadValue && player.id === state.currentTurnPlayerId) {
    advanceTurn();
  }

  saveAndRender();
}

// ---------------------------------------------------------------------------
// Scoring table rendering
// ---------------------------------------------------------------------------
function createScoreInput(player: Player, categoryKey: string): HTMLInputElement {
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
    const rawValue = (event.target as HTMLInputElement).value;

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
    (event.target as HTMLInputElement).value = String(player.scores[categoryKey]);
    saveState();
    resolveBetForScore(player, categoryKey, player.scores[categoryKey]);
    resolveWinGameBets();
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

function createCell(content: string | HTMLElement, className = ""): HTMLTableCellElement {
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

function createScoreCellContent(player: Player, categoryKey: string): HTMLDivElement {
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

interface CreateRowOptions {
  label: string;
  sectionClass?: string;
  isTotal?: boolean;
  isGrandTotal?: boolean;
  scoreKey?: string | null;
  totalKey?: keyof Totals | null;
}

function createRow({
  label,
  sectionClass = "",
  isTotal = false,
  isGrandTotal = false,
  scoreKey = null,
  totalKey = null,
}: CreateRowOptions): HTMLTableRowElement {
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

function updateTotalsForPlayer(playerId: string): void {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return;
  }

  const totals = calculateTotals(player);
  const totalCells = scoreTableBody.querySelectorAll<HTMLElement>("[data-player-id][data-total-key]");
  for (const cell of totalCells) {
    if (cell.dataset.playerId !== playerId) {
      continue;
    }

    const key = cell.dataset.totalKey as keyof Totals | undefined;
    cell.textContent = key && key in totals ? String(totals[key]) : "";
  }
}

function renderHeader(): void {
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

function renderBody(): void {
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
function renderSetupPlayerList(): void {
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

interface SelectOption {
  value: string;
  label: string;
}

function populateSelectOptions(selectEl: HTMLSelectElement, options: SelectOption[], placeholder?: string | null): void {
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

function getCategoryLabel(categoryKey: string): string {
  if (categoryKey === WIN_GAME_CATEGORY) {
    return "Win the Whole Game";
  }
  const category = SCORE_CATEGORIES.find((entry) => entry.key === categoryKey);
  return category ? category.label : categoryKey;
}

function renderBetForm(): void {
  const playerOptions: SelectOption[] = state.players.map((player) => ({ value: player.id, label: player.name }));
  if (state.players.length > 1) {
    playerOptions.push({ value: ALL_PLAYERS_OPTION, label: "All players" });
  }
  populateSelectOptions(betPlayerSelect, playerOptions, state.players.length ? null : "Add a player first");
  populateSelectOptions(betCategorySelect, [
    ...SCORE_CATEGORIES.map((category) => ({ value: category.key, label: category.label })),
    { value: WIN_GAME_CATEGORY, label: getCategoryLabel(WIN_GAME_CATEGORY) },
  ]);
}

function renderBetSummary(): void {
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
    const li = document.createElement("li");
    li.className = "bet-summary-item";

    const text = document.createElement("span");
    text.textContent = `${player ? player.name : "Unknown"} bets on ${getCategoryLabel(bet.category)}: "${bet.task}" (${bet.stakes} stakes)`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-player-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeBet(bet.id));

    li.append(text, removeBtn);
    betSummaryList.appendChild(li);
  }
}

function renderSetupLobby(): void {
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
const DIE_FACES: Record<number, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

function renderDiceRoller(): void {
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
function renderBetStatus(): void {
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
    const li = document.createElement("li");
    li.className = `bet-status-item bet-status-${bet.status}`;
    li.textContent = `${player ? player.name : "Unknown"} — ${getCategoryLabel(bet.category)}: "${bet.task}" — ${bet.status}`;
    betStatusList.appendChild(li);
  }
}

function renderTaskLog(): void {
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
    const li = document.createElement("li");
    li.className = `task-log-item task-log-${entry.status}`;

    const text = document.createElement("span");
    const date = new Date(entry.timestamp);
    text.textContent = `${player ? player.name : "Unknown"} owes: "${entry.task}" (from ${getCategoryLabel(entry.category)}) — ${entry.status} — ${date.toLocaleString()}`;
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
function render(): void {
  renderSetupLobby();
  renderDiceRoller();
  renderBetStatus();
  renderTaskLog();
  renderHeader();
  renderBody();
}

render();
