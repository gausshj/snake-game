import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  ensureUserConfigFile,
  getPreferredConfigPath,
  resolveConfigPath
} = require("../electron/config.cjs");

function createFakeApp(baseDir, appPath = path.join(baseDir, "app")) {
  return {
    isPackaged: false,
    getAppPath() {
      return appPath;
    },
    getPath(name) {
      assert.equal(name, "userData");
      return path.join(baseDir, "userData");
    }
  };
}

test("development config prefers the app directory", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "vue-snake-config-"));
  const app = createFakeApp(baseDir);
  fs.mkdirSync(app.getAppPath(), { recursive: true });

  const preferredPath = getPreferredConfigPath(app);
  const resolvedPath = resolveConfigPath(app);
  const configPath = ensureUserConfigFile(app);

  assert.equal(resolvedPath, preferredPath);
  assert.equal(configPath, preferredPath);
  assert.equal(fs.existsSync(configPath), true);
});

test("resolveConfigPath copies the legacy userData config into the app directory when possible", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "vue-snake-config-copy-"));
  const app = createFakeApp(baseDir);
  const preferredPath = getPreferredConfigPath(app);
  const fallbackPath = path.join(app.getPath("userData"), "snake.config.json");
  const fallbackText = JSON.stringify({ defaults: { mapId: "small" } }, null, 2);

  fs.mkdirSync(app.getAppPath(), { recursive: true });
  fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
  fs.writeFileSync(fallbackPath, fallbackText, "utf8");

  const resolvedPath = resolveConfigPath(app);

  assert.equal(resolvedPath, preferredPath);
  assert.equal(fs.readFileSync(preferredPath, "utf8"), fallbackText);
});

test("resolveConfigPath falls back to userData when the app directory is not writable", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "vue-snake-config-fallback-"));
  const blockedPath = path.join(baseDir, "blocked-app");
  fs.writeFileSync(blockedPath, "not a directory", "utf8");

  const app = createFakeApp(baseDir, blockedPath);
  const fallbackPath = path.join(app.getPath("userData"), "snake.config.json");

  const resolvedPath = resolveConfigPath(app);
  const configPath = ensureUserConfigFile(app);

  assert.equal(resolvedPath, fallbackPath);
  assert.equal(configPath, fallbackPath);
  assert.equal(fs.existsSync(configPath), true);
});
