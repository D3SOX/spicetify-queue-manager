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
  queueWarnEnabled?: boolean;
  queueMaxSize?: number;
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
