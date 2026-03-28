import assert from "node:assert/strict";
import test from "node:test";
import {
  computeLevel,
  computeWinnerPointsBase,
  computeWinnerPointsFinal,
} from "./onlineScoring";

test("winner points base follows 100 - X", () => {
  assert.equal(computeWinnerPointsBase(60), 40);
  assert.equal(computeWinnerPointsBase(0), 100);
  assert.equal(computeWinnerPointsBase(99), 1);
});

test("winner points apply bot reduction when bot-filled", () => {
  assert.equal(computeWinnerPointsFinal(60, true, 0.5), 20);
  assert.equal(computeWinnerPointsFinal(99, true, 0.5), 1);
  assert.equal(computeWinnerPointsFinal(60, false, 0.5), 40);
});

test("level mapping uses 1000-point steps across 6 levels", () => {
  assert.equal(computeLevel(0), 1);
  assert.equal(computeLevel(999), 1);
  assert.equal(computeLevel(1000), 2);
  assert.equal(computeLevel(2500), 3);
  assert.equal(computeLevel(4999), 5);
  assert.equal(computeLevel(5000), 6);
  assert.equal(computeLevel(99999), 6);
});
