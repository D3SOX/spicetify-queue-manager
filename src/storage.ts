import { Settings, Snapshot } from "./types";

const SETTINGS_KEY = "queue-manager:settings";
const DEFAULT_SETTINGS: Settings = {
  autoEnabled: false,
  autoIntervalMs: 300000,
  maxAutosnapshots: 20,
  autoMode: "timer",
  onlyNewItems: true,
  queueWarnEnabled: true,
  // Heuristic: anecdotal reports suggest ~80 items. Includes current track + queued
  queueMaxSize: 80,
  // Warn when 5 or fewer slots remain
  queueWarnThreshold: 5,
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
      queueWarnEnabled: parsed.queueWarnEnabled !== false,
      queueMaxSize: typeof parsed.queueMaxSize === "number" && parsed.queueMaxSize > 1 ? parsed.queueMaxSize : DEFAULT_SETTINGS.queueMaxSize,
      queueWarnThreshold: typeof parsed.queueWarnThreshold === "number" && parsed.queueWarnThreshold >= 0 ? parsed.queueWarnThreshold : DEFAULT_SETTINGS.queueWarnThreshold,
    };
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  Spicetify.LocalStorage.set(SETTINGS_KEY, JSON.stringify(s));
}

const SNAPSHOTS_KEY = "queue-manager:snapshots";

export function loadSnapshots(): Snapshot[] {
  try {
    const raw = Spicetify.LocalStorage.get(SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Snapshot[];
    // ensuring json structure would be good here too
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function sortSnapshotsDescending(snapshots: Snapshot[]): Snapshot[] {
  return snapshots.sort((a, b) => b.createdAt - a.createdAt);
}

export function saveSnapshots(snapshots: Snapshot[]): void {
  sortSnapshotsDescending(snapshots);
  Spicetify.LocalStorage.set(SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

export function getSortedSnapshots(): Snapshot[] {
  return sortSnapshotsDescending(loadSnapshots());
}

export function pruneAutosToMax(settings: Settings): void {
  const all = getSortedSnapshots();
  const manuals = all.filter(snap => snap.type === "manual");
  const autos = all.filter(snap => snap.type === "auto").slice(0, settings.maxAutosnapshots);
  saveSnapshots([...manuals, ...autos]);
}

export function addSnapshot(newSnapshot: Snapshot, settings?: Settings): void {
  const s = settings ?? loadSettings();
  const existing = loadSnapshots();
  const manuals = existing.filter(snap => snap.type === "manual");
  const autos = existing.filter(snap => snap.type === "auto");

  if (newSnapshot.type === "auto") {
    const autosWithNew = [newSnapshot, ...autos].slice(0, s.maxAutosnapshots);
    saveSnapshots([...manuals, ...autosWithNew]);
  } else {
    saveSnapshots([newSnapshot, ...manuals, ...autos]);
  }
}