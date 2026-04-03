import test from "node:test";
import assert from "node:assert/strict";

import { computeAIDirection } from "../renderer/game/ai.js";
import {
  computeQLearningDirection,
  explainQLearningMove,
  rotateDirection,
  selectBestRelativeAction,
  stateKeyForQLearning
} from "../renderer/game/qLearning.js";

test("rotateDirection maps relative actions around the current heading", () => {
  assert.equal(rotateDirection("up", "left"), "left");
  assert.equal(rotateDirection("up", "right"), "right");
  assert.equal(rotateDirection("left", "right"), "up");
});

test("stateKeyForQLearning encodes local danger and food direction bits", () => {
  const state = {
    direction: "right",
    food: { row: 1, col: 4 },
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

  assert.equal(stateKeyForQLearning(state, { rows: 6, cols: 6, initialLength: 3 }), "00010010001");
});

test("selectBestRelativeAction picks the highest valued action", () => {
  assert.equal(selectBestRelativeAction([0.1, 0.4, 0.2]), "left");
});

test("computeQLearningDirection uses the learned policy when a state is present", () => {
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

  const direction = computeQLearningDirection(
    state,
    { rows: 6, cols: 6, initialLength: 3 },
    {
      "00000010001": [1.0, 0.0, 0.0]
    }
  );

  assert.equal(direction, "right");
});

test("computeQLearningDirection falls back to the rule AI when the state is missing from the policy", () => {
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
  const config = { rows: 6, cols: 6, initialLength: 3 };

  assert.equal(computeQLearningDirection(state, config, {}), computeAIDirection(state, config));
});

test("computeQLearningDirection falls back when the learned move is unsafe", () => {
  const state = {
    direction: "right",
    food: { row: 4, col: 4 },
    gameOver: false,
    paused: false,
    queuedDirection: "right",
    score: 0,
    started: true,
    snake: [
      { row: 0, col: 4 },
      { row: 0, col: 3 },
      { row: 0, col: 2 }
    ]
  };
  const config = { rows: 5, cols: 5, initialLength: 3 };
  const policy = {
    [stateKeyForQLearning(state, config)]: [1.0, 0.0, 0.0]
  };

  assert.equal(computeQLearningDirection(state, config, policy), computeAIDirection(state, config));
});

test("explainQLearningMove reports the ready state before the game starts", () => {
  const state = {
    direction: "right",
    food: { row: 2, col: 4 },
    gameOver: false,
    paused: false,
    queuedDirection: "right",
    score: 0,
    started: false,
    snake: [
      { row: 2, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 0 }
    ]
  };

  assert.equal(
    explainQLearningMove(state, { rows: 6, cols: 6, initialLength: 3 }, {}),
    "Q-Learning agent is ready to start."
  );
});

test("explainQLearningMove reports the rule-AI fallback when the state is missing", () => {
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

  assert.equal(
    explainQLearningMove(state, { rows: 6, cols: 6, initialLength: 3 }, {}),
    "Q-Learning agent fell back to the rule-based pathfinder for this state."
  );
});

test("explainQLearningMove reports a learned direct move to food", () => {
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
  const config = { rows: 5, cols: 5, initialLength: 3 };
  const policy = {
    [stateKeyForQLearning(state, config)]: [1.0, 0.0, 0.0]
  };

  assert.equal(
    explainQLearningMove(state, config, policy),
    "Q-Learning agent found a learned move that reaches food immediately."
  );
});

test("explainQLearningMove reports that it is following the learned table when no fallback is needed", () => {
  const state = {
    direction: "right",
    food: { row: 0, col: 5 },
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
  const config = { rows: 6, cols: 6, initialLength: 3 };
  const policy = {
    [stateKeyForQLearning(state, config)]: [1.0, 0.0, 0.0]
  };

  assert.match(
    explainQLearningMove(state, config, policy),
    /^Q-Learning agent is following its trained value table \(/);
});
