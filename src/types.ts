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

export type BadgeVariant =
  | "default"
  | "accent"
  | "version"
  | "channel"
  | "active-sync";

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
  data: QueueUpdateEventData;
};
export type OnProgressEvent = Event & { type: "onprogress"; data: number };

export interface MetadataResponse {
  gid: string;
  name: string;
  album: Album;
  artist: Artist[];
  number: number;
  disc_number: number;
  duration: number;
  popularity: number;
  external_id: ExternalID[];
  earliest_live_timestamp: number;
  licensor: Licensor;
  language_of_performance: string[];
  original_audio: OriginalAudio;
  original_title: string;
  artist_with_role: ArtistWithRole[];
  canonical_uri: string;
  content_authorization_attributes: string;
  audio_formats: AudioFormat[];
  media_type: string;
  implementation_details: ImplementationDetails;
}

export interface Album {
  gid: string;
  name: string;
  artist: Artist[];
  label: string;
  date: DateClass;
  cover_group: CoverGroup;
  licensor: Licensor;
}

export interface Artist {
  gid: string;
  name: string;
}

export interface CoverGroup {
  image: Image[];
}

export interface Image {
  file_id: string;
  size: string;
  width: number;
  height: number;
}

export interface DateClass {
  year: number;
  month: number;
  day: number;
}

export interface Licensor {
  uuid: string;
}

export interface ArtistWithRole {
  artist_gid: string;
  artist_name: string;
  role: string;
}

export interface AudioFormat {
  original_audio: OriginalAudio;
}

export interface OriginalAudio {
  uuid: string;
  format: string;
}

export interface ExternalID {
  type: string;
  id: string;
}

export interface ImplementationDetails {
  catalog_insertion_date: CatalogInsertionDate;
}

export interface CatalogInsertionDate {
  seconds: number;
  nanos: number;
}
