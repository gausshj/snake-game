import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DEFAULT_APP_CONFIG,
  getPreferredConfigPath,
  loadAppConfig,
  normalizeAppConfig
} = require("../electron/config.cjs");

function createFakeApp(baseDir) {
  return {
    isPackaged: false,
    getAppPath() {
      return path.join(baseDir, "app");
    },
    getPath(name) {
      assert.equal(name, "userData");
      return path.join(baseDir, "userData");
    }
  };
}

test("normalizeAppConfig keeps configurable custom maps and themes", () => {
  const config = normalizeAppConfig({
    defaults: {
      aiMode: "q_learning",
      mapId: "tiny",
      themeId: "night_sand"
    },
    maps: [
      {
        id: "tiny",
        label: "10 x 10",
        rows: 10,
        cols: 10,
        initialLength: 3,
        tickMs: 120
      }
    ],
    themes: [
      {
        id: "night_sand",
        label: "Night Sand",
        colors: {
          "--cell-food": "#ff8844",
          "--cell-head": "#223344"
        }
      }
    ]
  });

  assert.equal(config.defaults.mapId, "tiny");
  assert.equal(config.defaults.themeId, "night_sand");
  assert.equal(config.defaults.aiMode, "q_learning");
  assert.equal(config.controls.speedMultiplier, 1);
  assert.equal(config.maps[0].label, "10 x 10");
  assert.equal(config.themes[0].colors["--cell-food"], "#ff8844");
  assert.equal(
    config.themes[0].colors["--page-start"],
    DEFAULT_APP_CONFIG.themes[0].colors["--page-start"]
  );
});

test("normalizeAppConfig falls back when ids or values are invalid", () => {
  const config = normalizeAppConfig({
    controls: {
      boostMinTickMs: 5,
      boostRatio: 9,
      speedMultiplier: 9
    },
    defaults: {
      aiMode: "not_real",
      mapId: "missing",
      themeId: "missing"
    },
    maps: [],
    themes: [],
    window: {
      width: 500,
      height: 500
    }
  });

  assert.equal(config.defaults.aiMode, DEFAULT_APP_CONFIG.defaults.aiMode);
  assert.equal(config.defaults.mapId, DEFAULT_APP_CONFIG.defaults.mapId);
  assert.equal(config.defaults.themeId, DEFAULT_APP_CONFIG.defaults.themeId);
  assert.equal(config.controls.boostMinTickMs, 40);
  assert.equal(config.controls.boostRatio, 1);
  assert.equal(config.controls.speedMultiplier, 3);
  assert.equal(config.window.width, 620);
  assert.equal(config.window.height, 720);
});

test("normalizeAppConfig deduplicates presets and migrates the legacy window size", () => {
  const config = normalizeAppConfig({
    version: 1,
    defaults: {
      aiMode: "distilled",
      mapId: "dup",
      themeId: "sand"
    },
    maps: [
      {
        id: "dup",
        rows: 9,
        cols: 9,
        initialLength: 2,
        tickMs: 100
      },
      {
        id: "dup",
        rows: 18,
        cols: 18,
        initialLength: 4,
        tickMs: 90
      }
    ],
    themes: [
      {
        id: "sand",
        label: "Sand",
        colors: {
          "--cell-food": "#aa5500"
        }
      },
      {
        id: "sand",
        label: "Duplicate",
        colors: {
          "--cell-food": "#111111"
        }
      }
    ],
    window: {
      width: 860,
      height: 920,
      minWidth: 620,
      minHeight: 720,
      backgroundColor: "#f2efe8"
    }
  });

  assert.equal(config.version, DEFAULT_APP_CONFIG.version);
  assert.equal(config.maps.length, 1);
  assert.equal(config.maps[0].id, "dup");
  assert.equal(config.themes.length, 1);
  assert.equal(config.defaults.aiMode, "distilled");
  assert.equal(config.themes[0].colors["--cell-food"], "#aa5500");
  assert.equal(config.window.height, DEFAULT_APP_CONFIG.window.height);
});

test("loadAppConfig falls back to defaults when the config file is invalid JSON", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "vue-snake-invalid-config-"));
  const app = createFakeApp(baseDir);
  const configPath = getPreferredConfigPath(app);

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, "{ not valid json", "utf8");

  const result = loadAppConfig(app);

  assert.equal(result.configPath, configPath);
  assert.deepEqual(result.config, DEFAULT_APP_CONFIG);
  assert.ok(result.error);
});
