import test from "node:test";
import assert from "node:assert/strict";

import {
  computeDistilledExpertDirection,
  distilledFeatureVector
} from "../renderer/game/distilledExpert.js";

test("distilledFeatureVector produces the expected fixed feature length", () => {
  const state = {
    direction: "right",
    food: { row: 2, col: 4 },
    gameOver: false,
    paused: false,
    queuedDirection: "right",
    score: 0,
    started: true,
    snake: [
      { row: 2, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 0 }
    ]
  };

  const features = distilledFeatureVector(state, { rows: 6, cols: 6, initialLength: 3 });
  assert.equal(features.length, 106);
});

test("computeDistilledExpertDirection uses the neural model when confidence is high", () => {
  const state = {
    direction: "right",
    food: { row: 2, col: 4 },
    gameOver: false,
    paused: false,
    queuedDirection: "right",
    score: 0,
    started: true,
    snake: [
      { row: 2, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 0 }
    ]
  };

  const featureSize = distilledFeatureVector(state, { rows: 6, cols: 6, initialLength: 3 }).length;
  const zeros = Array.from({ length: featureSize }, () => 0);
  const network = {
    featureSize,
    layers: [
      {
        bias: [4, 0, 0],
        weights: [zeros, zeros, zeros]
      }
    ]
  };

  const direction = computeDistilledExpertDirection(
    state,
    { rows: 6, cols: 6, initialLength: 3 },
    network
  );

  assert.equal(direction, "right");
});
