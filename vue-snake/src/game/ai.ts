import {
  DIRECTIONS,
  cloneState,
  containsPosition,
  isInsideBoard,
  isOppositeDirection,
  isSafeMove,
  nextHeadPosition,
  positionKey,
  positionsEqual,
  requestDirection,
  step
} from "./logic.js";
import type { Direction, GameConfig, GameState, Position } from "./types.js";

interface PathNode {
  direction: Direction;
  from: string;
}

function directionPriority(state: GameState, target: Position): Direction[] {
  const head = state.snake[0];
  return [...DIRECTIONS].sort((left, right) => {
    const leftHead = nextHeadPosition(head, left);
    const rightHead = nextHeadPosition(head, right);
    const leftDistance = Math.abs(leftHead.row - target.row) + Math.abs(leftHead.col - target.col);
    const rightDistance = Math.abs(rightHead.row - target.row) + Math.abs(rightHead.col - target.col);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    if (left === state.direction) {
      return -1;
    }

    if (right === state.direction) {
      return 1;
    }

    return 0;
  });
}

function findPath(state: GameState, config: GameConfig, target: Position): Direction[] {
  const start = state.snake[0];
  const tail = state.snake[state.snake.length - 1];
  const blocked = new Set(
    state.snake
      .slice(1, -1)
      .filter((segment) => !positionsEqual(segment, target))
      .map(positionKey)
  );

  if (!positionsEqual(target, tail)) {
    blocked.add(positionKey(tail));
    blocked.delete(positionKey(target));
  }

  const queue: Position[] = [start];
  const previous = new Map<string, PathNode | null>([[positionKey(start), null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (positionsEqual(current, target)) {
      const directions: Direction[] = [];
      let cursor = positionKey(current);

      while (previous.get(cursor)?.direction) {
        const entry = previous.get(cursor);
        if (!entry) {
          break;
        }

        directions.push(entry.direction);
        cursor = entry.from;
      }

      return directions.reverse();
    }

    for (const direction of directionPriority(state, target)) {
      const candidate = nextHeadPosition(current, direction);
      const key = positionKey(candidate);

      if (!isInsideBoard(config, candidate) || blocked.has(key) || previous.has(key)) {
        continue;
      }

      previous.set(key, {
        direction,
        from: positionKey(current)
      });
      queue.push(candidate);
    }
  }

  return [];
}

function simulatePath(state: GameState, config: GameConfig, directions: Direction[]): GameState {
  let simulated = cloneState(state);
  for (const direction of directions) {
    simulated = requestDirection(simulated, direction);
    simulated = step(simulated, config, 0);
    if (simulated.gameOver) {
      break;
    }
  }
  return simulated;
}

function pathKeepsTailReachable(state: GameState, config: GameConfig, pathToFood: Direction[]): boolean {
  if (pathToFood.length === 0) {
    return false;
  }

  const simulated = simulatePath(state, config, pathToFood);
  if (simulated.gameOver) {
    return false;
  }

  const tail = simulated.snake[simulated.snake.length - 1];
  if (positionsEqual(simulated.snake[0], tail)) {
    return true;
  }

  return findPath(simulated, config, tail).length > 0;
}

function chooseFallbackDirection(state: GameState, config: GameConfig): Direction {
  const safeDirections = DIRECTIONS.filter((direction) => isSafeMove(state, config, direction));
  if (safeDirections.length === 0) {
    return state.direction;
  }

  const center = {
    row: Math.floor(config.rows / 2),
    col: Math.floor(config.cols / 2)
  };

  return [...safeDirections].sort((left, right) => {
    const leftHead = nextHeadPosition(state.snake[0], left);
    const rightHead = nextHeadPosition(state.snake[0], right);
    const leftCenterDistance = Math.abs(leftHead.row - center.row) + Math.abs(leftHead.col - center.col);
    const rightCenterDistance = Math.abs(rightHead.row - center.row) + Math.abs(rightHead.col - center.col);

    if (leftCenterDistance !== rightCenterDistance) {
      return leftCenterDistance - rightCenterDistance;
    }

    if (left === state.direction) {
      return -1;
    }

    if (right === state.direction) {
      return 1;
    }

    return 0;
  })[0];
}

export function computeAIDirection(state: GameState, config: GameConfig): Direction {
  if (state.gameOver || state.paused || !state.started) {
    return state.direction;
  }

  const pathToFood = findPath(state, config, state.food);
  if (pathToFood.length > 0 && pathKeepsTailReachable(state, config, pathToFood)) {
    return pathToFood[0];
  }

  const tail = state.snake[state.snake.length - 1];
  const pathToTail = findPath(state, config, tail);
  if (pathToTail.length > 0) {
    return pathToTail[0];
  }

  return chooseFallbackDirection(state, config);
}

export function explainAIMove(state: GameState, config: GameConfig): string {
  if (!state.started) {
    return "Rule AI is ready to start.";
  }

  const direction = computeAIDirection(state, config);
  const nextHead = nextHeadPosition(state.snake[0], direction);
  const hitsBody = containsPosition(state.snake.slice(0, -1), nextHead);

  if (!isInsideBoard(config, nextHead) || hitsBody || isOppositeDirection(state.direction, direction)) {
    return "Rule AI is boxed in and is taking the least risky move.";
  }

  if (positionsEqual(nextHead, state.food)) {
    return "Rule AI has a direct line to food.";
  }

  return "Rule AI is keeping a safe route open while moving.";
}
