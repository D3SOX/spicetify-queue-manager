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
};