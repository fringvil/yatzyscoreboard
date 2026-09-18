import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_MAX_SCORES,
  sanitizeScores,
  calculateTotals,
  computeScoreForCategory,
} from "../logic.js";

test("sanitizeScores drops non-numeric and out-of-range values", () => {
  const result = sanitizeScores({
    ones: 3,
    twos: "not a number",
    threes: 999, // above the category max, should be clamped
    fours: -5, // below zero, should be clamped
    sixes: 12.9, // should be truncated
    notACategory: 10,
  });

  assert.equal(result.ones, 3);
  assert.equal(result.twos, undefined);
  assert.equal(result.threes, CATEGORY_MAX_SCORES.threes);
  assert.equal(result.fours, 0);
  assert.equal(result.sixes, 12);
  assert.equal(result.notACategory, undefined);
});

test("sanitizeScores returns an empty object for invalid input", () => {
  assert.deepEqual(sanitizeScores(null), {});
  assert.deepEqual(sanitizeScores(undefined), {});
  assert.deepEqual(sanitizeScores("nope"), {});
});

test("calculateTotals sums upper/lower sections without bonus", () => {
  const player = { scores: { ones: 3, twos: 4, onePair: 10 } };
  const totals = calculateTotals(player);

  assert.equal(totals.upperSum, 7);
  assert.equal(totals.bonus, 0);
  assert.equal(totals.upperTotal, 7);
  assert.equal(totals.lowerTotal, 10);
  assert.equal(totals.grandTotal, 17);
});

test("calculateTotals awards the 50 point bonus at 63+ upper sum", () => {
  const player = { scores: { ones: 5, twos: 10, threes: 15, fours: 20, fives: 13 } };
  const totals = calculateTotals(player);

  assert.equal(totals.upperSum, 63);
  assert.equal(totals.bonus, 50);
  assert.equal(totals.upperTotal, 113);
});

test("calculateTotals treats missing scores as zero", () => {
  const totals = calculateTotals({ scores: {} });
  assert.deepEqual(totals, { upperSum: 0, bonus: 0, upperTotal: 0, lowerTotal: 0, grandTotal: 0 });
});

test("computeScoreForCategory scores upper-section categories by face count", () => {
  assert.equal(computeScoreForCategory([1, 1, 3, 4, 5], "ones"), 2);
  assert.equal(computeScoreForCategory([6, 6, 6, 2, 3], "sixes"), 18);
});

test("computeScoreForCategory finds the best pair / two pairs", () => {
  assert.equal(computeScoreForCategory([2, 2, 5, 5, 6], "onePair"), 10);
  assert.equal(computeScoreForCategory([1, 1, 1, 2, 2], "onePair"), 4);
  assert.equal(computeScoreForCategory([2, 2, 5, 5, 6], "twoPairs"), 14);
  assert.equal(computeScoreForCategory([2, 2, 5, 6, 3], "twoPairs"), 0);
});

test("computeScoreForCategory detects three/four of a kind", () => {
  assert.equal(computeScoreForCategory([4, 4, 4, 2, 3], "threeKind"), 12);
  assert.equal(computeScoreForCategory([4, 4, 2, 3, 5], "threeKind"), 0);
  assert.equal(computeScoreForCategory([5, 5, 5, 5, 3], "fourKind"), 20);
  assert.equal(computeScoreForCategory([5, 5, 5, 3, 3], "fourKind"), 0);
});

test("computeScoreForCategory detects straights", () => {
  assert.equal(computeScoreForCategory([1, 2, 3, 4, 5], "smallStraight"), 15);
  assert.equal(computeScoreForCategory([2, 3, 4, 5, 6], "smallStraight"), 0);
  assert.equal(computeScoreForCategory([2, 3, 4, 5, 6], "largeStraight"), 20);
  assert.equal(computeScoreForCategory([1, 2, 3, 4, 5], "largeStraight"), 0);
});

test("computeScoreForCategory detects full house", () => {
  assert.equal(computeScoreForCategory([3, 3, 3, 6, 6], "fullHouse"), 21);
  assert.equal(computeScoreForCategory([3, 3, 3, 3, 6], "fullHouse"), 0);
});

test("computeScoreForCategory sums chance and flags yatzy", () => {
  assert.equal(computeScoreForCategory([1, 2, 3, 4, 5], "chance"), 15);
  assert.equal(computeScoreForCategory([6, 6, 6, 6, 6], "yatzy"), 50);
  assert.equal(computeScoreForCategory([6, 6, 6, 6, 5], "yatzy"), 0);
});
