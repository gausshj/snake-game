import test from "node:test";
import assert from "node:assert/strict";

import { boardLayoutForViewport } from "../renderer/layout.js";

const SMALL = { cols: 12, initialLength: 3, rows: 12, tickMs: 150 };
const LARGE = { cols: 20, initialLength: 3, rows: 20, tickMs: 140 };

test("boardLayoutForViewport scales smaller maps up to use available space", () => {
  const layout = boardLayoutForViewport(SMALL, { width: 860, height: 820 });

  assert.equal(layout.gap, 3);
  assert.ok(layout.boardSize >= 540);
});

test("boardLayoutForViewport keeps larger maps within the available viewport budget", () => {
  const layout = boardLayoutForViewport(LARGE, { width: 860, height: 820 });

  assert.equal(layout.gap, 3);
  assert.ok(layout.boardSize <= 570);
});

test("boardLayoutForViewport shrinks the board on compact viewports", () => {
  const layout = boardLayoutForViewport(LARGE, { width: 390, height: 720 });

  assert.equal(layout.gap, 2);
  assert.ok(layout.boardSize <= 334);
});
