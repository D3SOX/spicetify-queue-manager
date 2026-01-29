import type { Settings, Snapshot } from "./types";

const SETTINGS_KEY = "queue-manager:settings";
const DEFAULT_SETTINGS: Settings = {
  autoEnabled: false,
  autoIntervalMs: 300000,
  maxAutosnapshots: 15,
  autoMode: "timer",
  onlyNewItems: true,
  queueWarnEnabled: true,
  queueMaxSize: 80,
  queueWarnThreshold: 5,
  promptManualBeforeReplace: true,
  language: undefined,
  settingsCollapsed: false,
  syncedSnapshotId: undefined,
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
      promptManualBeforeReplace: parsed.promptManualBeforeReplace !== false,
      language: typeof parsed.language === "string" ? parsed.language : undefined,
      settingsCollapsed: parsed.settingsCollapsed ?? DEFAULT_SETTINGS.settingsCollapsed,
      syncedSnapshotId: typeof parsed.syncedSnapshotId === "string" ? parsed.syncedSnapshotId : undefined,
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
  const synced = all.filter(snap => snap.type === "synced");
  saveSnapshots([...manuals, ...autos, ...synced]);
}

export function addSnapshot(newSnapshot: Snapshot, settings?: Settings): void {
  const s = settings ?? loadSettings();
  const existing = loadSnapshots();
  const manuals = existing.filter(snap => snap.type === "manual");
  const autos = existing.filter(snap => snap.type === "auto");
  const synced = existing.filter(snap => snap.type === "synced");

  if (newSnapshot.type === "auto") {
    const autosWithNew = [newSnapshot, ...autos].slice(0, s.maxAutosnapshots);
    saveSnapshots([...manuals, ...autosWithNew, ...synced]);
  } else {
    saveSnapshots([newSnapshot, ...manuals, ...autos, ...synced]);
  }
}

export function clearAutoSnapshots(): void {
  const existing = loadSnapshots();
  const manuals = existing.filter(snap => snap.type === "manual");
  const synced = existing.filter(snap => snap.type === "synced");
  saveSnapshots([...manuals, ...synced]);
}

export function getSyncedSnapshots(): Snapshot[] {
  return getSortedSnapshots().filter(snap => snap.type === "synced");
}

export function getActiveSyncedSnapshot(settings: Settings): Snapshot | null {
  if (!settings.syncedSnapshotId) return null;
  const snapshots = loadSnapshots();
  return snapshots.find(snap => snap.id === settings.syncedSnapshotId) ?? null;
}