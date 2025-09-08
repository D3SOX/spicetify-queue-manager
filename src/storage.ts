import { Settings, Snapshot } from "./types";

const SETTINGS_KEY = "queue-saver:settings";
const DEFAULT_SETTINGS: Settings = {
  autoEnabled: false,
  autoIntervalMs: 300000,
  maxAutosnapshots: 20,
  autoMode: "on-change",
  onlyNewItems: true,
};

export function loadSettings(): Settings {
  try {
    const raw = Spicetify.LocalStorage.get(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // ensure json structure, this can be used for migrations in the future
    const s: Settings = {
      autoEnabled: parsed.autoEnabled ?? DEFAULT_SETTINGS.autoEnabled,
      autoIntervalMs: typeof parsed.autoIntervalMs === "number" && parsed.autoIntervalMs > 0 ? parsed.autoIntervalMs : DEFAULT_SETTINGS.autoIntervalMs,
      maxAutosnapshots: typeof parsed.maxAutosnapshots === "number" && parsed.maxAutosnapshots > 0 ? parsed.maxAutosnapshots : DEFAULT_SETTINGS.maxAutosnapshots,
      autoMode: parsed.autoMode === "timer" ? "timer" : "on-change",
      onlyNewItems: parsed.onlyNewItems !== false,
    };
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  Spicetify.LocalStorage.set(SETTINGS_KEY, JSON.stringify(s));
}

const STORAGE_KEY = "queue-saver:snapshots";

export function loadSnapshots(): Snapshot[] {
  try {
    const raw = Spicetify.LocalStorage.get(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Snapshot[];
    // ensuring json structure would be good here too
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveSnapshots(snapshots: Snapshot[]): void {
  Spicetify.LocalStorage.set(STORAGE_KEY, JSON.stringify(snapshots));
}