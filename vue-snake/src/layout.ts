import type { GameConfig } from "./game/types.js";

export interface ViewportSize {
  width: number;
  height: number;
}

export interface BoardLayout {
  boardSize: number;
  gap: number;
}

const MOBILE_BREAKPOINT = 640;
const BOARD_PADDING = 16;
const DESKTOP_GAP = 3;
const MOBILE_GAP = 2;
const DESKTOP_RESERVED_HEIGHT = 250;
const MOBILE_RESERVED_HEIGHT = 300;
const DESKTOP_HORIZONTAL_CHROME = 88;
const MOBILE_HORIZONTAL_CHROME = 56;
const MAX_BOARD_SIZE = 570;
const MIN_CELL_SIZE = 8;
const MAX_CELL_SIZE = 44;

export function boardLayoutForViewport(
  config: GameConfig,
  viewport: ViewportSize,
): BoardLayout {
  const longestEdge = Math.max(config.rows, config.cols);
  const isCompact = viewport.width <= MOBILE_BREAKPOINT;
  const gap = isCompact ? MOBILE_GAP : DESKTOP_GAP;
  const widthBudget = viewport.width - (isCompact ? MOBILE_HORIZONTAL_CHROME : DESKTOP_HORIZONTAL_CHROME);
  const heightBudget = viewport.height - (isCompact ? MOBILE_RESERVED_HEIGHT : DESKTOP_RESERVED_HEIGHT);
  const targetBoardSize = Math.min(MAX_BOARD_SIZE, widthBudget, heightBudget);
  const usableBoardSize = Math.max(0, targetBoardSize);
  const totalGap = Math.max(0, longestEdge - 1) * gap;
  const rawCellSize = Math.floor((usableBoardSize - BOARD_PADDING - totalGap) / longestEdge);
  const cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, rawCellSize));

  return {
    boardSize: longestEdge * cellSize + totalGap + BOARD_PADDING,
    gap,
  };
}
