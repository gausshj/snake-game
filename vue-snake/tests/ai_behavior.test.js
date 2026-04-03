import test from "node:test";
import assert from "node:assert/strict";

import {
  computeAIDirection,
  explainAIMove
} from "../renderer/game/ai.js";

test("computeAIDirection keeps the current direction before the game starts", () => {
  const state = {
    direction: "right",
    food: { row: 1, col: 4 },
    gameOver: false,
    paused: false,
    queuedDirection: "right",
    score: 0,
    started: false,
    snake: [
      { row: 1, col: 2 },
      { row: 1, col: 1 },
      { row: 1, col: 0 }
    ]
  };

  assert.equal(computeAIDirection(state, { rows: 5, cols: 5, initialLength: 3 }), "right");
});

test("explainAIMove reports the ready state before the game starts", () => {
  const state = {
    direction: "right",
    food: { row: 1, col: 4 },
    gameOver: false,
    paused: false,
    queuedDirection: "right",
    score: 0,
    started: false,
    snake: [
      { row: 1, col: 2 },
      { row: 1, col: 1 },
      { row: 1, col: 0 }
    ]
  };

  assert.equal(
    explainAIMove(state, { rows: 5, cols: 5, initialLength: 3 }),
    "Rule AI is ready to start."
  );
});

test("explainAIMove reports a direct path to food", () => {
  const state = {
    direction: "right",
    food: { row: 2, col: 3 },
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

  assert.equal(
    explainAIMove(state, { rows: 5, cols: 5, initialLength: 3 }),
    "Rule AI has a direct line to food."
  );
});

test("explainAIMove reports a boxed-in fallback when no safe moves remain", () => {
  const state = {
    direction: "right",
    food: { row: 2, col: 0 },
    gameOver: false,
    paused: false,
    queuedDirection: "right",
    score: 0,
    started: true,
    snake: [
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 1, col: 1 }
    ]
  };

  assert.equal(
    explainAIMove(state, { rows: 3, cols: 3, initialLength: 3 }),
    "Rule AI is boxed in and is taking the least risky move."
  );
});
