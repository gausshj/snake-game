import type { AppConfig } from "./appConfig.js";

interface SnakeDesktopConfigPayload {
  config: AppConfig;
  configPath: string;
  error: string | null;
}

interface SnakeDesktopBridge {
  getConfig(): Promise<SnakeDesktopConfigPayload>;
  reloadConfig(): Promise<SnakeDesktopConfigPayload>;
  openConfigDirectory(): Promise<string>;
  openConfigFile(): Promise<string>;
}

declare global {
  interface Window {
    snakeDesktop?: SnakeDesktopBridge;
  }
}

export {};
