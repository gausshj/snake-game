import { computeAIDirection } from "./ai.js";
import {
  isSafeMove,
  nextHeadPosition
} from "./logic.js";
import {
  Q_LEARNING_METADATA,
  Q_LEARNING_POLICY
} from "./qLearningPolicyData.generated.js";
import type {
  Direction,
  GameConfig,
  GameState,
  QLearningPolicy,
  RelativeAction
} from "./types.js";

const RELATIVE_ACTIONS: RelativeAction[] = ["straight", "left", "right"];
const DIRECTION_ORDER: Direction[] = ["up", "right", "down", "left"];
const UNBOUNDED_CONFIG: GameConfig = {
  rows: Number.MAX_SAFE_INTEGER,
  cols: Number.MAX_SAFE_INTEGER,
  initialLength: 3
};

export function rotateDirection(direction: Direction, relativeAction: RelativeAction): Direction {
  const index = DIRECTION_ORDER.indexOf(direction);
  if (relativeAction === "left") {
    return DIRECTION_ORDER[(index + DIRECTION_ORDER.length - 1) % DIRECTION_ORDER.length];
  }
  if (relativeAction === "right") {
    return DIRECTION_ORDER[(index + 1) % DIRECTION_ORDER.length];
  }
  return direction;
}

export function stateKeyForQLearning(
  state: GameState,
  config: GameConfig = UNBOUNDED_CONFIG
): string {
  const head = state.snake[0];
  const dangerStraight = Number(!isSafeMove(state, config, state.direction));
  const dangerLeft = Number(!isSafeMove(state, config, rotateDirection(state.direction, "left")));
  const dangerRight = Number(!isSafeMove(state, config, rotateDirection(state.direction, "right")));

  const bits = [
    dangerStraight,
    dangerLeft,
    dangerRight,
    Number(state.food.row < head.row),
    Number(state.food.row > head.row),
    Number(state.food.col < head.col),
    Number(state.food.col > head.col),
    Number(state.direction === "up"),
    Number(state.direction === "down"),
    Number(state.direction === "left"),
    Number(state.direction === "right")
  ];

  return bits.join("");
}

export function selectBestRelativeAction(qValues: readonly number[]): RelativeAction {
  let bestIndex = 0;
  let bestValue = qValues[0];

  for (let index = 1; index < qValues.length; index += 1) {
    if (qValues[index] > bestValue) {
      bestValue = qValues[index];
      bestIndex = index;
    }
  }

  return RELATIVE_ACTIONS[bestIndex];
}

export function computeQLearningDirection(
  state: GameState,
  config: GameConfig,
  policy: QLearningPolicy = Q_LEARNING_POLICY
): Direction {
  if (state.gameOver || state.paused || !state.started) {
    return state.direction;
  }

  const stateKey = stateKeyForQLearning(state, config);
  const qValues = policy[stateKey];
  if (!qValues) {
    return computeAIDirection(state, config);
  }

  const relativeAction = selectBestRelativeAction(qValues);
  const absoluteDirection = rotateDirection(state.direction, relativeAction);
  if (!isSafeMove(state, config, absoluteDirection)) {
    return computeAIDirection(state, config);
  }

  return absoluteDirection;
}

export function explainQLearningMove(
  state: GameState,
  config: GameConfig,
  policy: QLearningPolicy = Q_LEARNING_POLICY
): string {
  if (!state.started) {
    return "Q-Learning agent is ready to start.";
  }

  const stateKey = stateKeyForQLearning(state, config);
  if (!policy[stateKey]) {
    return "Q-Learning agent fell back to the rule-based pathfinder for this state.";
  }

  const direction = computeQLearningDirection(state, config, policy);
  const nextHead = nextHeadPosition(state.snake[0], direction);
  if (nextHead.row === state.food.row && nextHead.col === state.food.col) {
    return "Q-Learning agent found a learned move that reaches food immediately.";
  }

  return `Q-Learning agent is following its trained value table (${Q_LEARNING_METADATA.episodes} episodes).`;
}
