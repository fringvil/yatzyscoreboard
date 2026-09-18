const SCORE_CATEGORIES = [
  { key: "ones", label: "Ones", section: "upper" },
  { key: "twos", label: "Twos", section: "upper" },
  { key: "threes", label: "Threes", section: "upper" },
  { key: "fours", label: "Fours", section: "upper" },
  { key: "fives", label: "Fives", section: "upper" },
  { key: "sixes", label: "Sixes", section: "upper" },
  { key: "onePair", label: "One Pair", section: "lower" },
  { key: "twoPairs", label: "Two Pairs", section: "lower" },
  { key: "threeKind", label: "Three of a Kind", section: "lower" },
  { key: "fourKind", label: "Four of a Kind", section: "lower" },
  { key: "smallStraight", label: "Small Straight", section: "lower" },
  { key: "largeStraight", label: "Large Straight", section: "lower" },
  { key: "fullHouse", label: "Full House", section: "lower" },
  { key: "chance", label: "Chance", section: "lower" },
  { key: "yatzy", label: "Yatzy", section: "lower" },
];

const STORAGE_KEY = "yatzy-scoreboard-state-v1";
const CATEGORY_MAX_SCORES = {
  ones: 5,
  twos: 10,
  threes: 15,
  fours: 20,
  fives: 25,
  sixes: 30,
  onePair: 12,
  twoPairs: 22,
  threeKind: 18,
  fourKind: 24,
  smallStraight: 15,
  largeStraight: 20,
  fullHouse: 28,
  chance: 30,
  yatzy: 50,
};

const playerNameInput = document.getElementById("playerName");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const resetScoresBtn = document.getElementById("resetScoresBtn");
const newGameBtn = document.getElementById("newGameBtn");
const playerHeaderRow = document.getElementById("playerHeaderRow");
const scoreTableBody = document.getElementById("scoreTableBody");

const state = loadState();

render();

addPlayerBtn.addEventListener("click", addPlayer);
playerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addPlayer();
  }
});

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

  saveAndRender();
});

newGameBtn.addEventListener("click", () => {
  if (!state.players.length) {
    return;
  }

  if (!window.confirm("Start a new game? This clears all players and scores.")) {
    return;
  }

  state.players = [];
  saveAndRender();
});

function createDefaultPlayer(name) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    scores: {},
  };
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { players: [] };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.players)) {
      return { players: [] };
    }

    const players = parsed.players
      .filter((player) => player && typeof player.name === "string")
      .map((player) => ({
        id: typeof player.id === "string" ? player.id : `${Date.now()}-${Math.random()}`,
        name: player.name.trim().slice(0, 30) || "Player",
        scores: sanitizeScores(player.scores),
      }));

    return { players };
  } catch {
    return { players: [] };
  }
}

function sanitizeScores(scores) {
  const safeScores = {};
  if (!scores || typeof scores !== "object") {
    return safeScores;
  }

  for (const category of SCORE_CATEGORIES) {
    const value = scores[category.key];
    if (typeof value === "number" && Number.isFinite(value)) {
      const maxScore = CATEGORY_MAX_SCORES[category.key] ?? 0;
      safeScores[category.key] = Math.max(0, Math.min(maxScore, Math.trunc(value)));
    }
  }

  return safeScores;
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

function addPlayer() {
  const name = playerNameInput.value.trim();
  if (!name) {
    playerNameInput.focus();
    return;
  }

  state.players.push(createDefaultPlayer(name.slice(0, 30)));
  playerNameInput.value = "";
  saveAndRender();
}

function removePlayer(playerId) {
  state.players = state.players.filter((player) => player.id !== playerId);
  saveAndRender();
}

function getNumericScore(player, categoryKey) {
  const value = player.scores[categoryKey];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function calculateTotals(player) {
  const upperKeys = SCORE_CATEGORIES.filter((category) => category.section === "upper").map((category) => category.key);
  const lowerKeys = SCORE_CATEGORIES.filter((category) => category.section === "lower").map((category) => category.key);

  const upperSum = upperKeys.reduce((sum, key) => sum + getNumericScore(player, key), 0);
  const bonus = upperSum >= 63 ? 50 : 0;
  const upperTotal = upperSum + bonus;
  const lowerTotal = lowerKeys.reduce((sum, key) => sum + getNumericScore(player, key), 0);
  const grandTotal = upperTotal + lowerTotal;

  return { upperSum, bonus, upperTotal, lowerTotal, grandTotal };
}

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
    updateTotalsForPlayer(player.id);
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
      row.appendChild(createCell(createScoreInput(player, scoreKey)));
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

    const content = document.createElement("div");
    content.className = "player-header-content";

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-player-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removePlayer(player.id));

    content.append(name, removeBtn);
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

function render() {
  renderHeader();
  renderBody();
}
