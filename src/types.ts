export type SnapshotType = "auto" | "manual";

export type Snapshot = {
  id: string;
  createdAt: number;
  name?: string;
  type: SnapshotType;
  items: string[];
};

export type AutoMode = "timer" | "on-change";

export type Settings = {
  autoEnabled: boolean;
  autoIntervalMs: number;
  maxAutosnapshots: number;
  autoMode: AutoMode;
  onlyNewItems: boolean;
  // Warn when queue approaches capacity (client-side heuristic)
  queueWarnEnabled?: boolean;
  // Maximum queue length heuristic (includes current track). Unknown officially; user-tunable.
  queueMaxSize?: number;
  // Warn when remaining slots <= this number
  queueWarnThreshold?: number;
};

export type QueueUpdateEventData = {
  current: Spicetify.PlayerTrack;
  queued: Spicetify.PlayerTrack[];
  nextUp: Spicetify.PlayerTrack[];
};

export type QueueUpdateEvent = Event & {
  type: "queue_update";
  data?: QueueUpdateEventData;
};
