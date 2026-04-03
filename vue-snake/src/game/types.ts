export type Direction = "up" | "down" | "left" | "right";
export type RelativeAction = "straight" | "left" | "right";
export type AIModel = "human" | "rule" | "q_learning" | "distilled";
export type MapSize = string;
export type ThemeName = string;

export interface Position {
  row: number;
  col: number;
}

export interface GameConfig {
  rows: number;
  cols: number;
  initialLength: number;
  tickMs?: number;
}

export interface GameState {
  direction: Direction;
  food: Position;
  gameOver: boolean;
  paused: boolean;
  queuedDirection: Direction;
  score: number;
  started: boolean;
  snake: Position[];
}

export interface BoardCell {
  key: string;
  type: "empty" | "food" | "head" | "snake";
}

export interface QLearningMetadata {
  actionLabels: RelativeAction[];
  algorithm: string;
  averageEvaluationScore: number;
  averageEvaluationSteps: number;
  board: {
    rows: number;
    cols: number;
  };
  episodes: number;
  featureDescription: string[];
  maxEvaluationScore: number;
  seed: number;
  visitedStates: number;
}

export interface DistilledExpertMetadata {
  algorithm: string;
  boardSizes: string[];
  collectedSamples: number;
  confidenceThreshold: number;
  episodesPerSize: number;
  fallbackEvaluationScore: number;
  featureDescription: string[];
  hiddenSizes: number[];
  seed: number;
  teacherEvaluationScore: number;
  trainingAccuracy: number;
  validationAccuracy: number;
}

export type RelativeActionScores = [number, number, number];
export type RelativeActionPolicy = Record<string, RelativeActionScores>;
export type QLearningPolicy = RelativeActionPolicy;

export interface DenseLayerWeights {
  bias: number[];
  weights: number[][];
}

export interface DistilledExpertNetwork {
  featureSize: number;
  layers: DenseLayerWeights[];
}
