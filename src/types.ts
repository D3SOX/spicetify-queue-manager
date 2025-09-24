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
  promptManualBeforeReplace?: boolean;
};

export type ButtonTone = "primary" | "danger" | "subtle" | "default";

export type IconName =
  | "collaborative"
  | "album"
  | "artist"
  | "block"
  | "brightness"
  | "car"
  | "chart-down"
  | "chart-up"
  | "check"
  | "check-alt-fill"
  | "chevron-left"
  | "chevron-right"
  | "chromecast-disconnected"
  | "clock"
  | "computer"
  | "copy"
  | "download"
  | "downloaded"
  | "edit"
  | "enhance"
  | "exclamation-circle"
  | "external-link"
  | "facebook"
  | "follow"
  | "fullscreen"
  | "gamepad"
  | "grid-view"
  | "heart"
  | "heart-active"
  | "instagram"
  | "laptop"
  | "library"
  | "list-view"
  | "location"
  | "locked"
  | "locked-active"
  | "lyrics"
  | "menu"
  | "minimize"
  | "minus"
  | "more"
  | "new-spotify-connect"
  | "offline"
  | "pause"
  | "phone"
  | "play"
  | "playlist"
  | "playlist-folder"
  | "plus2px"
  | "plus-alt"
  | "podcasts"
  | "projector"
  | "queue"
  | "repeat"
  | "repeat-once"
  | "search"
  | "search-active"
  | "shuffle"
  | "skip-back"
  | "skip-back15"
  | "skip-forward"
  | "skip-forward15"
  | "soundbetter"
  | "speaker"
  | "spotify"
  | "subtitles"
  | "tablet"
  | "ticket"
  | "twitter"
  | "visualizer"
  | "voice"
  | "volume"
  | "volume-off"
  | "volume-one-wave"
  | "volume-two-wave"
  | "watch"
  | "x";

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
