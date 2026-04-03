import type { AIModel, GameConfig } from "./game/types.js";

export interface MapPreset extends GameConfig {
  id: string;
  label: string;
}

export interface ThemePreset {
  id: string;
  label: string;
  colors: Record<string, string>;
}

export interface WindowPreset {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  backgroundColor: string;
}

export interface ControlPreset {
  boostHoldMs: number;
  boostMinTickMs: number;
  boostRatio: number;
  speedMultiplier: number;
}

export interface AppConfig {
  version: number;
  defaults: {
    mapId: string;
    themeId: string;
    aiMode: AIModel;
  };
  controls: ControlPreset;
  maps: MapPreset[];
  themes: ThemePreset[];
  window: WindowPreset;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
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
};

export function resolveMapPreset(config: AppConfig, mapId: string): MapPreset {
  return config.maps.find((preset) => preset.id === mapId) ?? config.maps[0];
}

export function resolveThemePreset(config: AppConfig, themeId: string): ThemePreset {
  return config.themes.find((preset) => preset.id === themeId) ?? config.themes[0];
}
