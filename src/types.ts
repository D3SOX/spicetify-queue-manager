export type SnapshotType = "auto" | "manual" | "synced";

export type Snapshot = {
  id: string;
  createdAt: number;
  name?: string;
  type: SnapshotType;
  items: string[];
  playbackPosition?: number; // milliseconds
};

export type AutoMode = "timer" | "on-change";

export type Settings = {
  autoEnabled: boolean;
  autoIntervalMs: number;
  maxAutosnapshots: number;
  autoMode: AutoMode;
  onlyNewItems: boolean;
  queueWarnEnabled: boolean;
  queueMaxSize: number;
  queueWarnThreshold: number;
  promptManualBeforeReplace: boolean;
  language?: string;
  settingsCollapsed: boolean;
  syncedSnapshotId?: string;
};

export type BadgeVariant = "default" | "accent" | "version" | "channel" | "active-sync";

export type ButtonTone = "primary" | "danger" | "subtle" | "default";

export type ButtonRenderOptions = {
  action?: string;
  id?: string;
  tone?: ButtonTone;
  title?: string;
};

export type QueueUpdateEventData = {
  current: Spicetify.PlayerTrack;
  queued: Spicetify.PlayerTrack[];
  nextUp: Spicetify.PlayerTrack[];
};

export type QueueUpdateEvent = Event & { type: "queue_update"; data: QueueUpdateEventData };
export type OnProgressEvent = Event & { type: "onprogress"; data: number };