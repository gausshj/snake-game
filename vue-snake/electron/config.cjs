const fs = require("node:fs");
const path = require("node:path");

const AI_MODES = new Set(["human", "rule", "q_learning", "distilled"]);
const CONFIG_FILENAME = "snake.config.json";
const LEGACY_DEFAULT_WINDOW = Object.freeze({
  width: 860,
  height: 920,
  minWidth: 620,
  minHeight: 720,
  backgroundColor: "#f2efe8"
});

const DEFAULT_APP_CONFIG = Object.freeze({
  version: 2,
  defaults: {
    mapId: "medium",
    themeId: "classic",
    aiMode: "human"
  },
  controls: {
    boostHoldMs: 180,
    boostMinTickMs: 65,
    boostRatio: 0.5,
    speedMultiplier: 1
  },
  maps: [
    {
      id: "small",
      label: "12 x 12",
      rows: 12,
      cols: 12,
      initialLength: 3,
      tickMs: 150
    },
    {
      id: "medium",
      label: "16 x 16",
      rows: 16,
      cols: 16,
      initialLength: 3,
      tickMs: 145
    },
    {
      id: "large",
      label: "20 x 20",
      rows: 20,
      cols: 20,
      initialLength: 3,
      tickMs: 140
    }
  ],
  themes: [
    {
      id: "classic",
      label: "Classic",
      colors: {
        "--board-bg": "#d9d1c2",
        "--board-border": "#cdc4b4",
        "--card-bg": "rgba(255, 252, 247, 0.92)",
        "--card-border": "#d3ccbe",
        "--cell-empty": "#f7f4ee",
        "--cell-food": "#cb6b4a",
        "--cell-head": "#3e5d2b",
        "--cell-snake": "#6f8754",
        "--eyebrow": "#6d7763",
        "--hint": "#57534a",
        "--input-bg": "#fffaf0",
        "--input-border": "#cfc7b9",
        "--input-text": "#1f1f1f",
        "--overlay-bg": "rgba(245, 241, 232, 0.86)",
        "--overlay-text": "#2f3427",
        "--page-end": "#ece7dc",
        "--page-start": "#f5f2ec",
        "--pill-active-bg": "#edf3df",
        "--pill-active-border": "#83945f",
        "--pill-active-text": "#425126",
        "--pill-bg": "#f7f3ea",
        "--pill-border": "#d5cebf",
        "--pill-text": "#2b2b2b",
        "--spot-color": "rgba(120, 134, 107, 0.18)",
        "--text-main": "#1c1c1c"
      }
    },
    {
      id: "sage_stone",
      label: "Sage Stone",
      colors: {
        "--board-bg": "#d7ddd5",
        "--board-border": "#bec9be",
        "--card-bg": "rgba(248, 248, 245, 0.94)",
        "--card-border": "#d8dcd8",
        "--cell-empty": "#eef1ec",
        "--cell-food": "#c46a4a",
        "--cell-head": "#49583f",
        "--cell-snake": "#8a9b74",
        "--eyebrow": "#667161",
        "--hint": "#555f54",
        "--input-bg": "#fbfbf8",
        "--input-border": "#cfd5cf",
        "--input-text": "#2f362f",
        "--overlay-bg": "rgba(241, 243, 239, 0.9)",
        "--overlay-text": "#3a4139",
        "--page-end": "#e4e5e8",
        "--page-start": "#f8f8f5",
        "--pill-active-bg": "#e7ecdf",
        "--pill-active-border": "#7f8f69",
        "--pill-active-text": "#49583f",
        "--pill-bg": "#f4f5f1",
        "--pill-border": "#d7ddd6",
        "--pill-text": "#374037",
        "--spot-color": "rgba(169, 191, 216, 0.18)",
        "--text-main": "#303630"
      }
    },
    {
      id: "desert_olive",
      label: "Desert Olive",
      colors: {
        "--board-bg": "#d9ccb9",
        "--board-border": "#cbb9a2",
        "--card-bg": "rgba(241, 237, 230, 0.94)",
        "--card-border": "#dacdbd",
        "--cell-empty": "#f7f2ea",
        "--cell-food": "#ad5d5d",
        "--cell-head": "#2c3e50",
        "--cell-snake": "#8a9670",
        "--eyebrow": "#80715f",
        "--hint": "#63584b",
        "--input-bg": "#faf6ef",
        "--input-border": "#d4c4af",
        "--input-text": "#352d26",
        "--overlay-bg": "rgba(245, 239, 230, 0.9)",
        "--overlay-text": "#3a3129",
        "--page-end": "#d4bfaa",
        "--page-start": "#f1ede6",
        "--pill-active-bg": "#e4eadb",
        "--pill-active-border": "#7e8b5f",
        "--pill-active-text": "#485139",
        "--pill-bg": "#f6f1e9",
        "--pill-border": "#d8c9b5",
        "--pill-text": "#473c32",
        "--spot-color": "rgba(173, 93, 93, 0.16)",
        "--text-main": "#2b241f"
      }
    }
  ],
  window: {
    width: 860,
    height: 820,
    minWidth: 620,
    minHeight: 720,
    backgroundColor: "#f2efe8"
  }
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrFallback(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberOrFallback(value, fallback, options = {}) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  const min = options.min ?? Number.NEGATIVE_INFINITY;
  const max = options.max ?? Number.POSITIVE_INFINITY;
  const nextValue = Math.min(max, Math.max(min, value));
  return options.integer === false ? nextValue : Math.round(nextValue);
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function isLegacyWindowConfig(value) {
  if (!isObject(value) || !isObject(value.window)) {
    return false;
  }

  return (
    numberOrFallback(value.window.width, LEGACY_DEFAULT_WINDOW.width) === LEGACY_DEFAULT_WINDOW.width &&
    numberOrFallback(value.window.height, LEGACY_DEFAULT_WINDOW.height) === LEGACY_DEFAULT_WINDOW.height &&
    numberOrFallback(value.window.minWidth, LEGACY_DEFAULT_WINDOW.minWidth) === LEGACY_DEFAULT_WINDOW.minWidth &&
    numberOrFallback(value.window.minHeight, LEGACY_DEFAULT_WINDOW.minHeight) === LEGACY_DEFAULT_WINDOW.minHeight &&
    stringOrFallback(value.window.backgroundColor, LEGACY_DEFAULT_WINDOW.backgroundColor) ===
      LEGACY_DEFAULT_WINDOW.backgroundColor
  );
}

function sanitizeMapPreset(value, index) {
  if (!isObject(value)) {
    return null;
  }

  const rows = numberOrFallback(value.rows, 12, { min: 8, max: 32 });
  const cols = numberOrFallback(value.cols, 12, { min: 8, max: 32 });
  const initialLength = numberOrFallback(value.initialLength, 3, {
    min: 2,
    max: Math.max(2, Math.min(rows, cols) - 1)
  });
  const tickMs = numberOrFallback(value.tickMs, 145, { min: 60, max: 400 });

  return {
    id: stringOrFallback(value.id, `map_${index + 1}`),
    label: stringOrFallback(value.label, `${rows} x ${cols}`),
    rows,
    cols,
    initialLength,
    tickMs
  };
}

function sanitizeThemePreset(value, index, fallbackColors) {
  if (!isObject(value)) {
    return null;
  }

  const colors = { ...fallbackColors };
  if (isObject(value.colors)) {
    for (const [key, color] of Object.entries(value.colors)) {
      if (typeof color === "string" && key.startsWith("--")) {
        colors[key] = color;
      }
    }
  }

  return {
    id: stringOrFallback(value.id, `theme_${index + 1}`),
    label: stringOrFallback(value.label, `Theme ${index + 1}`),
    colors
  };
}

function ensureDefaultsExist(config) {
  if (config.maps.length === 0) {
    config.maps = clone(DEFAULT_APP_CONFIG.maps);
  }
  if (config.themes.length === 0) {
    config.themes = clone(DEFAULT_APP_CONFIG.themes);
  }

  const defaultMap =
    config.maps.find((item) => item.id === config.defaults.mapId) ??
    config.maps.find((item) => item.id === DEFAULT_APP_CONFIG.defaults.mapId) ??
    config.maps[0];
  const defaultTheme =
    config.themes.find((item) => item.id === config.defaults.themeId) ??
    config.themes.find((item) => item.id === DEFAULT_APP_CONFIG.defaults.themeId) ??
    config.themes[0];

  config.defaults.mapId = defaultMap.id;
  config.defaults.themeId = defaultTheme.id;
}

function normalizeAppConfig(value) {
  const config = clone(DEFAULT_APP_CONFIG);
  if (!isObject(value)) {
    return config;
  }

  const sourceVersion = numberOrFallback(value.version, 1, { min: 1 });
  config.version = DEFAULT_APP_CONFIG.version;

  if (isObject(value.controls)) {
    config.controls.boostHoldMs = numberOrFallback(
      value.controls.boostHoldMs,
      config.controls.boostHoldMs,
      { min: 80, max: 600 }
    );
    config.controls.boostMinTickMs = numberOrFallback(
      value.controls.boostMinTickMs,
      config.controls.boostMinTickMs,
      { min: 40, max: 240 }
    );
    config.controls.boostRatio = numberOrFallback(
      value.controls.boostRatio,
      config.controls.boostRatio,
      { min: 0.2, max: 1, integer: false }
    );
    config.controls.speedMultiplier = numberOrFallback(
      value.controls.speedMultiplier,
      config.controls.speedMultiplier,
      { min: 0.5, max: 3, integer: false }
    );
  }

  if (Array.isArray(value.maps)) {
    config.maps = uniqueById(
      value.maps
        .map((item, index) => sanitizeMapPreset(item, index))
        .filter(Boolean)
    );
  }

  if (Array.isArray(value.themes)) {
    config.themes = uniqueById(
      value.themes
        .map((item, index) => sanitizeThemePreset(item, index, DEFAULT_APP_CONFIG.themes[0].colors))
        .filter(Boolean)
    );
  }

  if (isObject(value.defaults)) {
    config.defaults.mapId = stringOrFallback(value.defaults.mapId, config.defaults.mapId);
    config.defaults.themeId = stringOrFallback(value.defaults.themeId, config.defaults.themeId);
    config.defaults.aiMode = AI_MODES.has(value.defaults.aiMode)
      ? value.defaults.aiMode
      : config.defaults.aiMode;
  }

  if (isObject(value.window)) {
    config.window.width = numberOrFallback(value.window.width, config.window.width, { min: 620, max: 1800 });
    config.window.height = numberOrFallback(value.window.height, config.window.height, { min: 720, max: 1800 });
    config.window.minWidth = numberOrFallback(value.window.minWidth, config.window.minWidth, {
      min: 520,
      max: config.window.width
    });
    config.window.minHeight = numberOrFallback(value.window.minHeight, config.window.minHeight, {
      min: 620,
      max: config.window.height
    });
    config.window.backgroundColor = stringOrFallback(
      value.window.backgroundColor,
      config.window.backgroundColor
    );
  }

  if (sourceVersion < DEFAULT_APP_CONFIG.version && isLegacyWindowConfig(value)) {
    config.window = clone(DEFAULT_APP_CONFIG.window);
  }

  ensureDefaultsExist(config);
  return config;
}

function getPreferredConfigPath(app) {
  if (!app.isPackaged) {
    return path.join(app.getAppPath(), CONFIG_FILENAME);
  }

  if (process.platform === "darwin") {
    const appBundlePath = path.dirname(path.dirname(path.dirname(process.execPath)));
    return path.join(path.dirname(appBundlePath), CONFIG_FILENAME);
  }

  return path.join(path.dirname(process.execPath), CONFIG_FILENAME);
}

function getUserConfigPath(app) {
  return path.join(app.getPath("userData"), CONFIG_FILENAME);
}

function canWriteConfigPath(configPath) {
  try {
    const parentDir = path.dirname(configPath);
    fs.mkdirSync(parentDir, { recursive: true });
    if (fs.existsSync(configPath)) {
      fs.accessSync(configPath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    }
    fs.accessSync(parentDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveConfigPath(app) {
  const preferredPath = getPreferredConfigPath(app);
  const fallbackPath = getUserConfigPath(app);

  if (fs.existsSync(preferredPath) && canWriteConfigPath(preferredPath)) {
    return preferredPath;
  }

  if (!fs.existsSync(preferredPath) && fs.existsSync(fallbackPath) && canWriteConfigPath(preferredPath)) {
    try {
      fs.mkdirSync(path.dirname(preferredPath), { recursive: true });
      fs.copyFileSync(fallbackPath, preferredPath);
      return preferredPath;
    } catch {
      return fallbackPath;
    }
  }

  if (canWriteConfigPath(preferredPath)) {
    return preferredPath;
  }

  return fallbackPath;
}

function ensureUserConfigFile(app) {
  const configPath = resolveConfigPath(app);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `${JSON.stringify(DEFAULT_APP_CONFIG, null, 2)}\n`, "utf8");
  }
  return configPath;
}

function loadAppConfig(app) {
  const configPath = ensureUserConfigFile(app);

  try {
    const rawText = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(rawText);
    return {
      config: normalizeAppConfig(parsed),
      configPath,
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown config error";
    return {
      config: clone(DEFAULT_APP_CONFIG),
      configPath,
      error: message
    };
  }
}

module.exports = {
  DEFAULT_APP_CONFIG,
  canWriteConfigPath,
  ensureUserConfigFile,
  getPreferredConfigPath,
  getUserConfigPath,
  loadAppConfig,
  normalizeAppConfig,
  resolveConfigPath
};
