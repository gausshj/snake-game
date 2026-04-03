import { computeAIDirection } from "./ai.js";
import {
  isInsideBoard,
  isSafeMove,
  nextHeadPosition
} from "./logic.js";
import {
  DISTILLED_EXPERT_METADATA,
  DISTILLED_EXPERT_NETWORK
} from "./distilledExpertPolicyData.generated.js";
import { rotateDirection, selectBestRelativeAction } from "./qLearning.js";
import type {
  DenseLayerWeights,
  Direction,
  DistilledExpertNetwork,
  GameConfig,
  GameState,
  RelativeActionScores,
  Position
} from "./types.js";

const WINDOW_RADIUS = 2;
const RELATIVE_ACTION_LABELS = ["straight", "left", "right"] as const;

function projectRelativeOffset(direction: Direction, forward: number, right: number): Position {
  if (direction === "up") {
    return { row: -forward, col: right };
  }
  if (direction === "right") {
    return { row: right, col: forward };
  }
  if (direction === "down") {
    return { row: forward, col: -right };
  }

  return { row: -right, col: -forward };
}

function rotateFoodDelta(direction: Direction, head: Position, food: Position): { forward: number; right: number } {
  const rowDelta = food.row - head.row;
  const colDelta = food.col - head.col;

  if (direction === "up") {
    return { forward: -rowDelta, right: colDelta };
  }
  if (direction === "right") {
    return { forward: colDelta, right: rowDelta };
  }
  if (direction === "down") {
    return { forward: rowDelta, right: -colDelta };
  }

  return { forward: -colDelta, right: -rowDelta };
}

function normalizeDelta(value: number, scale: number): number {
  if (scale <= 0) {
    return 0;
  }

  return Math.max(-1, Math.min(1, value / scale));
}

export function distilledFeatureVector(state: GameState, config: GameConfig): number[] {
  const head = state.snake[0];
  const snakeLookup = new Set(state.snake.slice(1).map((segment) => `${segment.row}:${segment.col}`));
  const rotatedFood = rotateFoodDelta(state.direction, head, state.food);
  const features: number[] = [];

  for (let forward = WINDOW_RADIUS; forward >= -WINDOW_RADIUS; forward -= 1) {
    for (let right = -WINDOW_RADIUS; right <= WINDOW_RADIUS; right += 1) {
      let wall = 0;
      let body = 0;
      let food = 0;
      let self = 0;

      if (forward === 0 && right === 0) {
        self = 1;
      } else {
        const offset = projectRelativeOffset(state.direction, forward, right);
        const candidate = {
          row: head.row + offset.row,
          col: head.col + offset.col
        };

        if (!isInsideBoard(config, candidate)) {
          wall = 1;
        } else if (snakeLookup.has(`${candidate.row}:${candidate.col}`)) {
          body = 1;
        } else if (candidate.row === state.food.row && candidate.col === state.food.col) {
          food = 1;
        }
      }

      features.push(wall, body, food, self);
    }
  }

  features.push(
    normalizeDelta(rotatedFood.forward, Math.max(1, config.rows - 1)),
    normalizeDelta(rotatedFood.right, Math.max(1, config.cols - 1)),
    Number(isSafeMove(state, config, state.direction)),
    Number(isSafeMove(state, config, rotateDirection(state.direction, "left"))),
    Number(isSafeMove(state, config, rotateDirection(state.direction, "right"))),
    state.snake.length / (config.rows * config.cols)
  );

  return features;
}

function denseForward(input: number[], layer: DenseLayerWeights, applyRelu: boolean): number[] {
  const output = new Array<number>(layer.bias.length).fill(0);

  for (let neuronIndex = 0; neuronIndex < layer.bias.length; neuronIndex += 1) {
    let value = layer.bias[neuronIndex];
    const weights = layer.weights[neuronIndex];

    for (let featureIndex = 0; featureIndex < input.length; featureIndex += 1) {
      value += input[featureIndex] * weights[featureIndex];
    }

    output[neuronIndex] = applyRelu ? Math.max(0, value) : value;
  }

  return output;
}

function softmax(values: number[]): number[] {
  const maxValue = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - maxValue));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

function inferRelativeActionScores(
  state: GameState,
  config: GameConfig,
  network: DistilledExpertNetwork
): RelativeActionScores {
  let activations = distilledFeatureVector(state, config);

  for (let layerIndex = 0; layerIndex < network.layers.length; layerIndex += 1) {
    activations = denseForward(
      activations,
      network.layers[layerIndex],
      layerIndex < network.layers.length - 1
    );
  }

  const probabilities = softmax(activations);
  return [
    probabilities[0] ?? 0,
    probabilities[1] ?? 0,
    probabilities[2] ?? 0
  ];
}

export function computeDistilledExpertDirection(
  state: GameState,
  config: GameConfig,
  network: DistilledExpertNetwork = DISTILLED_EXPERT_NETWORK
): Direction {
  if (state.gameOver || state.paused || !state.started) {
    return state.direction;
  }

  const probabilities = inferRelativeActionScores(state, config, network);
  const confidence = Math.max(...probabilities);
  if (confidence < DISTILLED_EXPERT_METADATA.confidenceThreshold) {
    return computeAIDirection(state, config);
  }

  const relativeAction = selectBestRelativeAction(probabilities);
  const absoluteDirection = rotateDirection(state.direction, relativeAction);
  if (!isSafeMove(state, config, absoluteDirection)) {
    return computeAIDirection(state, config);
  }

  return absoluteDirection;
}

export function explainDistilledExpertMove(
  state: GameState,
  config: GameConfig,
  network: DistilledExpertNetwork = DISTILLED_EXPERT_NETWORK
): string {
  if (!state.started) {
    return "Distilled Expert model is ready to start.";
  }

  const probabilities = inferRelativeActionScores(state, config, network);
  const confidence = Math.max(...probabilities);
  if (confidence < DISTILLED_EXPERT_METADATA.confidenceThreshold) {
    return "Distilled Expert model fell back to the rule-based planner because confidence was too low for this state.";
  }

  const direction = computeDistilledExpertDirection(state, config, network);
  const nextHead = nextHeadPosition(state.snake[0], direction);
  if (nextHead.row === state.food.row && nextHead.col === state.food.col) {
    return "Distilled Expert model recognized a trained move that reaches food immediately.";
  }

  const actionIndex = probabilities.indexOf(confidence);
  return `Distilled Expert model is following a locally trained neural policy (${RELATIVE_ACTION_LABELS[actionIndex]} confidence ${(confidence * 100).toFixed(0)}%).`;
}
