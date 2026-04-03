import type { Direction, GameConfig, GameState, Position } from "./types.js";

export const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

export const DEFAULT_CONFIG: Readonly<GameConfig> = Object.freeze({
  cols: 20,
  initialLength: 3,
  rows: 20,
  tickMs: 140
});

const DIRECTION_OFFSETS: Record<Direction, Position> = {
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
  up: { row: -1, col: 0 }
};

const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
  down: "up",
  left: "right",
  right: "left",
  up: "down"
};

export function clonePosition(position: Position): Position {
  return { row: position.row, col: position.col };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    food: clonePosition(state.food),
    snake: state.snake.map(clonePosition)
  };
}

export function positionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

export function positionsEqual(left: Position, right: Position): boolean {
  return left.row === right.row && left.col === right.col;
}

export function isOppositeDirection(current: Direction, next: Direction): boolean {
  return OPPOSITE_DIRECTIONS[current] === next;
}

export function nextHeadPosition(head: Position, direction: Direction): Position {
  const offset = DIRECTION_OFFSETS[direction];
  return {
    row: head.row + offset.row,
    col: head.col + offset.col
  };
}

export function isInsideBoard(config: GameConfig, position: Position): boolean {
  return position.row >= 0 &&
    position.row < config.rows &&
    position.col >= 0 &&
    position.col < config.cols;
}

export function containsPosition(snake: Position[], target: Position): boolean {
  return snake.some((segment) => positionsEqual(segment, target));
}

export function collectFreeCells(config: GameConfig, snake: Position[]): Position[] {
  const occupied = new Set(snake.map(positionKey));
  const freeCells: Position[] = [];

  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.cols; col += 1) {
      const candidate = { row, col };
      if (!occupied.has(positionKey(candidate))) {
        freeCells.push(candidate);
      }
    }
  }

  return freeCells;
}

export function selectFoodPosition(
  config: GameConfig,
  snake: Position[],
  selector = 0
): Position {
  const freeCells = collectFreeCells(config, snake);
  if (freeCells.length === 0) {
    throw new Error("No free cells available for food placement.");
  }

  return freeCells[Math.abs(selector) % freeCells.length];
}

export function createInitialState(
  config: GameConfig = DEFAULT_CONFIG,
  foodSelector = 0
): GameState {
  if (config.rows < 3 || config.cols < 3) {
    throw new Error("Board must be at least 3x3.");
  }

  if (config.initialLength < 2 || config.initialLength >= config.cols) {
    throw new Error("Initial length must fit inside the board.");
  }

  const centerRow = Math.floor(config.rows / 2);
  const headCol = Math.max(config.initialLength - 1, Math.floor(config.cols / 2));
  const snake: Position[] = [];

  for (let offset = 0; offset < config.initialLength; offset += 1) {
    snake.push({ row: centerRow, col: headCol - offset });
  }

  return {
    direction: "right",
    food: selectFoodPosition(config, snake, foodSelector),
    gameOver: false,
    paused: false,
    queuedDirection: "right",
    score: 0,
    started: false,
    snake
  };
}

export function startGame(state: GameState): GameState {
  if (state.gameOver || state.started) {
    return state;
  }

  return {
    ...state,
    started: true
  };
}

export function requestDirection(state: GameState, nextDirection: Direction): GameState {
  if (state.gameOver || !DIRECTIONS.includes(nextDirection)) {
    return state;
  }

  if (isOppositeDirection(state.direction, nextDirection)) {
    return state;
  }

  return {
    ...state,
    queuedDirection: nextDirection,
    started: true
  };
}

export function togglePause(state: GameState): GameState {
  if (state.gameOver || !state.started) {
    return state;
  }

  return {
    ...state,
    paused: !state.paused
  };
}

export function getOccupiedAfterMove(state: GameState, nextHead: Position): Position[] {
  const eatsFood = positionsEqual(nextHead, state.food);
  return eatsFood ? state.snake : state.snake.slice(0, -1);
}

export function isSafeMove(state: GameState, config: GameConfig, direction: Direction): boolean {
  if (isOppositeDirection(state.direction, direction)) {
    return false;
  }

  const nextHead = nextHeadPosition(state.snake[0], direction);
  if (!isInsideBoard(config, nextHead)) {
    return false;
  }

  return !containsPosition(getOccupiedAfterMove(state, nextHead), nextHead);
}

export function step(
  state: GameState,
  config: GameConfig = DEFAULT_CONFIG,
  foodSelector = 0
): GameState {
  if (state.gameOver || state.paused || !state.started) {
    return state;
  }

  const direction = isOppositeDirection(state.direction, state.queuedDirection)
    ? state.direction
    : state.queuedDirection;

  const nextHead = nextHeadPosition(state.snake[0], direction);
  if (!isInsideBoard(config, nextHead)) {
    return {
      ...state,
      direction,
      gameOver: true,
      queuedDirection: direction
    };
  }

  const eatsFood = positionsEqual(nextHead, state.food);
  const occupied = getOccupiedAfterMove(state, nextHead);
  if (containsPosition(occupied, nextHead)) {
    return {
      ...state,
      direction,
      gameOver: true,
      queuedDirection: direction
    };
  }

  const snake = [nextHead, ...state.snake];
  if (!eatsFood) {
    snake.pop();
  }

  const nextState: GameState = {
    ...state,
    direction,
    queuedDirection: direction,
    snake
  };

  if (!eatsFood) {
    return nextState;
  }

  const score = state.score + 1;
  if (snake.length === config.rows * config.cols) {
    return {
      ...nextState,
      gameOver: true,
      score
    };
  }

  return {
    ...nextState,
    food: selectFoodPosition(config, snake, foodSelector),
    score
  };
}
