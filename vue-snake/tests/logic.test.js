import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialState,
  isSafeMove,
  requestDirection,
  selectFoodPosition,
  startGame,
  step,
  togglePause
} from "../renderer/game/logic.js";

test("createInitialState places a horizontal snake and deterministic food", () => {
  const state = createInitialState({ rows: 7, cols: 7, initialLength: 3 }, 0);

  assert.deepEqual(state.snake, [
    { row: 3, col: 3 },
    { row: 3, col: 2 },
    { row: 3, col: 1 }
  ]);
  assert.deepEqual(state.food, { row: 0, col: 0 });
  assert.equal(state.started, false);
});

test("createInitialState rejects boards smaller than 3x3", () => {
  assert.throws(
    () => createInitialState({ rows: 2, cols: 3, initialLength: 2 }, 0),
    /Board must be at least 3x3/);
});

test("createInitialState rejects an initial length that does not fit the board", () => {
  assert.throws(
    () => createInitialState({ rows: 5, cols: 4, initialLength: 4 }, 0),
    /Initial length must fit inside the board/
  );
});

test("step does not move before the game is started", () => {
  const state = createInitialState({ rows: 7, cols: 7, initialLength: 3 }, 0);
  const nextState = step(state, { rows: 7, cols: 7, initialLength: 3 }, 0);

  assert.deepEqual(nextState, state);
});

test("startGame arms the first movement and step moves the snake forward", () => {
  const state = createInitialState({ rows: 7, cols: 7, initialLength: 3 }, 0);
  const startedState = startGame(state);
  const nextState = step(startedState, { rows: 7, cols: 7, initialLength: 3 }, 0);

  assert.deepEqual(nextState.snake, [
    { row: 3, col: 4 },
    { row: 3, col: 3 },
    { row: 3, col: 2 }
  ]);
  assert.equal(nextState.score, 0);
  assert.equal(nextState.gameOver, false);
});

test("togglePause only affects started games", () => {
  const state = createInitialState({ rows: 7, cols: 7, initialLength: 3 }, 0);
  const beforeStart = togglePause(state);
  const started = startGame(state);
  const paused = togglePause(started);

  assert.strictEqual(beforeStart, state);
  assert.equal(paused.paused, true);
  assert.equal(togglePause(paused).paused, false);
});

test("step grows after eating and respawns food deterministically", () => {
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

  const nextState = step(state, { rows: 5, cols: 5, initialLength: 3 }, 0);

  assert.equal(nextState.score, 1);
  assert.equal(nextState.snake.length, 4);
  assert.deepEqual(nextState.snake[0], { row: 2, col: 3 });
  assert.deepEqual(nextState.food, { row: 0, col: 0 });
});

test("step ends the game on a wall collision", () => {
  const state = {
    direction: "up",
    food: { row: 4, col: 4 },
    gameOver: false,
    paused: false,
    queuedDirection: "up",
    score: 0,
    started: true,
    snake: [
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 2, col: 2 }
    ]
  };

  const nextState = step(state, { rows: 5, cols: 5, initialLength: 3 }, 0);

  assert.equal(nextState.gameOver, true);
  assert.equal(nextState.direction, "up");
});

test("step ends the game on a self collision", () => {
  const state = {
    direction: "up",
    food: { row: 4, col: 4 },
    gameOver: false,
    paused: false,
    queuedDirection: "left",
    score: 0,
    started: true,
    snake: [
      { row: 2, col: 2 },
      { row: 2, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 }
    ]
  };

  const nextState = step(state, { rows: 5, cols: 5, initialLength: 3 }, 0);

  assert.equal(nextState.gameOver, true);
  assert.equal(nextState.direction, "left");
});

test("step wins the game when the snake fills the board", () => {
  const config = { rows: 3, cols: 3, initialLength: 3 };
  const state = {
    direction: "left",
    food: { row: 2, col: 0 },
    gameOver: false,
    paused: false,
    queuedDirection: "left",
    score: 7,
    started: true,
    snake: [
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 1, col: 2 },
      { row: 0, col: 2 },
      { row: 0, col: 1 },
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 1, col: 1 }
    ]
  };

  const nextState = step(state, config, 0);

  assert.equal(nextState.gameOver, true);
  assert.equal(nextState.score, 8);
  assert.equal(nextState.snake.length, 9);
});

test("requestDirection ignores invalid and immediate reverse inputs", () => {
  const state = createInitialState({ rows: 7, cols: 7, initialLength: 3 }, 0);
  const invalid = requestDirection(state, "noop");
  const reversed = requestDirection(state, "left");

  assert.strictEqual(invalid, state);
  assert.equal(reversed.queuedDirection, "right");
  assert.equal(reversed.started, false);
});

test("requestDirection starts the game on the first valid input", () => {
  const state = createInitialState({ rows: 7, cols: 7, initialLength: 3 }, 0);
  const queued = requestDirection(state, "up");

  assert.equal(queued.queuedDirection, "up");
  assert.equal(queued.started, true);
});

test("isSafeMove rejects opposite, body, and wall moves while allowing a safe turn", () => {
  const state = {
    direction: "up",
    food: { row: 4, col: 4 },
    gameOver: false,
    paused: false,
    queuedDirection: "up",
    score: 0,
    started: true,
    snake: [
      { row: 2, col: 2 },
      { row: 2, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 }
    ]
  };
  const wallState = {
    ...state,
    direction: "up",
    queuedDirection: "up",
    snake: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 }
    ]
  };
  const config = { rows: 5, cols: 5, initialLength: 3 };

  assert.equal(isSafeMove(state, config, "down"), false);
  assert.equal(isSafeMove(state, config, "left"), false);
  assert.equal(isSafeMove(state, config, "right"), true);
  assert.equal(isSafeMove(wallState, config, "up"), false);
});

test("selectFoodPosition skips occupied cells", () => {
  const food = selectFoodPosition(
    { rows: 2, cols: 3, initialLength: 2 },
    [
      { row: 0, col: 0 },
      { row: 0, col: 1 }
    ],
    0
  );

  assert.deepEqual(food, { row: 0, col: 2 });
});

test("selectFoodPosition throws when no free cells remain", () => {
  assert.throws(
    () => selectFoodPosition(
      { rows: 2, cols: 2, initialLength: 2 },
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 }
      ],
      0
    ),
    /No free cells available/
  );
});
