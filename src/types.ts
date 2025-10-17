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
  queueWarnEnabled: boolean;
  queueMaxSize: number;
  queueWarnThreshold: number;
  promptManualBeforeReplace: boolean;
  language?: string;
};

export type BadgeVariant = "default" | "accent" | "version" | "channel";

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

export type QueueUpdateEvent = Event & {
  type: "queue_update";
  data?: QueueUpdateEventData;
};
