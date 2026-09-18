// ---------------------------------------------------------------------------
// Pure scoring/state logic, shared between script.ts (browser) and tests.
// No DOM or localStorage access lives here so it can be tested in isolation.
// ---------------------------------------------------------------------------

export type Section = "upper" | "lower";

export interface ScoreCategory {
  key: string;
  label: string;
  section: Section;
}

export const SCORE_CATEGORIES: ScoreCategory[] = [
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

export const UPPER_CATEGORY_KEYS: string[] = SCORE_CATEGORIES.filter((category) => category.section === "upper").map(
  (category) => category.key
);
export const LOWER_CATEGORY_KEYS: string[] = SCORE_CATEGORIES.filter((category) => category.section === "lower").map(
  (category) => category.key
);

export const CATEGORY_MAX_SCORES: Record<string, number> = {
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

export type Stakes = "normal" | "double" | "triple";

export const STAKES_MULTIPLIERS: Record<Stakes, number> = { normal: 1, double: 2, triple: 3 };

export type Scores = Record<string, number>;

export interface Player {
  id: string;
  name: string;
  scores: Scores;
}

export interface Totals {
  upperSum: number;
  bonus: number;
  upperTotal: number;
  lowerTotal: number;
  grandTotal: number;
}

export function sanitizeScores(scores: unknown): Scores {
  const safeScores: Scores = {};
  if (!scores || typeof scores !== "object") {
    return safeScores;
  }

  const source = scores as Record<string, unknown>;
  for (const category of SCORE_CATEGORIES) {
    const value = source[category.key];
    if (typeof value === "number" && Number.isFinite(value)) {
      const maxScore = CATEGORY_MAX_SCORES[category.key] ?? 0;
      safeScores[category.key] = Math.max(0, Math.min(maxScore, Math.trunc(value)));
    }
  }

  return safeScores;
}

export function getNumericScore(player: Player, categoryKey: string): number {
  const value = player.scores[categoryKey];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function calculateTotals(player: Player): Totals {
  const upperSum = UPPER_CATEGORY_KEYS.reduce((sum, key) => sum + getNumericScore(player, key), 0);
  const bonus = upperSum >= 63 ? 50 : 0;
  const upperTotal = upperSum + bonus;
  const lowerTotal = LOWER_CATEGORY_KEYS.reduce((sum, key) => sum + getNumericScore(player, key), 0);
  const grandTotal = upperTotal + lowerTotal;

  return { upperSum, bonus, upperTotal, lowerTotal, grandTotal };
}

export function computeScoreForCategory(diceValues: number[], categoryKey: string): number {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const value of diceValues) {
    counts[value] += 1;
  }
  const sumAll = diceValues.reduce((sum, value) => sum + value, 0);

  const numberCategories: Record<string, number> = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
  if (categoryKey in numberCategories) {
    const face = numberCategories[categoryKey];
    return counts[face] * face;
  }

  switch (categoryKey) {
    case "onePair": {
      let best = 0;
      for (let face = 6; face >= 1; face -= 1) {
        if (counts[face] >= 2) {
          best = face * 2;
          break;
        }
      }
      return best;
    }
    case "twoPairs": {
      const pairFaces: number[] = [];
      for (let face = 6; face >= 1; face -= 1) {
        if (counts[face] >= 2) {
          pairFaces.push(face);
        }
      }
      if (pairFaces.length >= 2) {
        return pairFaces[0] * 2 + pairFaces[1] * 2;
      }
      return 0;
    }
    case "threeKind": {
      for (let face = 6; face >= 1; face -= 1) {
        if (counts[face] >= 3) {
          return face * 3;
        }
      }
      return 0;
    }
    case "fourKind": {
      for (let face = 6; face >= 1; face -= 1) {
        if (counts[face] >= 4) {
          return face * 4;
        }
      }
      return 0;
    }
    case "smallStraight": {
      const isSmall = [1, 2, 3, 4, 5].every((face) => counts[face] >= 1) && diceValues.length === 5;
      return isSmall ? 15 : 0;
    }
    case "largeStraight": {
      const isLarge = [2, 3, 4, 5, 6].every((face) => counts[face] >= 1) && diceValues.length === 5;
      return isLarge ? 20 : 0;
    }
    case "fullHouse": {
      const hasThree = counts.some((count, face) => face > 0 && count === 3);
      const hasTwo = counts.some((count, face) => face > 0 && count === 2);
      return hasThree && hasTwo ? sumAll : 0;
    }
    case "chance": {
      return sumAll;
    }
    case "yatzy": {
      const hasFive = counts.some((count) => count === 5);
      return hasFive ? 50 : 0;
    }
    default:
      return 0;
  }
}
