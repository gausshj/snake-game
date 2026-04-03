import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_APP_CONFIG,
  resolveMapPreset,
  resolveThemePreset
} from "../renderer/appConfig.js";

test("resolveMapPreset returns a matching map preset", () => {
  const preset = resolveMapPreset(DEFAULT_APP_CONFIG, "large");

  assert.equal(preset.id, "large");
  assert.equal(preset.rows, 20);
  assert.equal(preset.cols, 20);
});

test("resolveMapPreset falls back to the first preset when the id is missing", () => {
  const preset = resolveMapPreset(DEFAULT_APP_CONFIG, "missing");

  assert.equal(preset.id, DEFAULT_APP_CONFIG.maps[0].id);
});

test("resolveThemePreset returns a matching theme preset", () => {
  const preset = resolveThemePreset(DEFAULT_APP_CONFIG, "sage_stone");

  assert.equal(preset.id, "sage_stone");
  assert.equal(preset.colors["--cell-food"], "#c46a4a");
});

test("resolveThemePreset falls back to the first preset when the id is missing", () => {
  const preset = resolveThemePreset(DEFAULT_APP_CONFIG, "missing");

  assert.equal(preset.id, DEFAULT_APP_CONFIG.themes[0].id);
});
