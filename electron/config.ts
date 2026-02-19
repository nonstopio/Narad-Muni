import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

export interface NaradaConfig {
  version: number;
  database: {
    path?: string;
  };
  window: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    isMaximized: boolean;
  };
}

const DEFAULT_CONFIG: NaradaConfig = {
  version: 1,
  database: {},
  window: {
    width: 1280,
    height: 800,
    isMaximized: false,
  },
};

function getConfigPath(): string {
  return path.join(app.getPath("userData"), "narada.config.json");
}

export function readConfig(): NaradaConfig {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    console.warn("Failed to read config, using defaults");
  }
  return { ...DEFAULT_CONFIG };
}

export function writeConfig(config: NaradaConfig): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function getDbPath(): string {
  const config = readConfig();
  if (config.database.path) {
    return config.database.path;
  }
  return path.join(app.getPath("userData"), "narada.db");
}

export function saveWindowBounds(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}): void {
  const config = readConfig();
  config.window = bounds;
  writeConfig(config);
}
