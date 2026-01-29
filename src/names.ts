import type { MetadataResponse, PodcastEpisode, Snapshot } from "./types";
import { formatDateTime } from "./utils";
import { t } from "./i18n";

function parseLocalTrackName(uri: string): string {
  const parts = uri.split(":");
  const artist = parts[2] || "Local";
  const track = parts[4] || "track";
  try {
    // TODO: test if we really need to replace + with space, what if a track contains a + in the name?
    const a = decodeURIComponent(artist.replace(/\+/g, " "));
    const t = decodeURIComponent(track.replace(/\+/g, " "));
    return `${a} - ${t}`;
  } catch {
    return `${artist} - ${track}`;
  }
}

export async function resolveItemNames(uris: string[]): Promise<string[]> {
  const names: string[] = new Array(uris.length).fill("");
  const trackIds: { idx: number; id: string; uri: Spicetify.URI }[] = [];
  const episodeIds: { idx: number; id: string, uri: Spicetify.URI }[] = [];

  uris.forEach((u, idx) => {
    if (u.startsWith("spotify:local:")) {
      names[idx] = parseLocalTrackName(u);
      return;
    }
    const parsed = Spicetify.URI.from(u);
    if (!parsed || !parsed.id) {
      names[idx] = u;
      return;
    }
    if (parsed.type === "track") {
      trackIds.push({ idx, id: parsed.id, uri: parsed });
    } else if (parsed.type === "episode") {
      episodeIds.push({ idx, id: parsed.id, uri: parsed });
    } else {
      names[idx] = u;
    }
  });

  if (trackIds.length) {
    const promises = trackIds.map(async (c) => {
      const hex = Spicetify.URI.idToHex(c.id);

      const response = await Spicetify.Platform.RequestBuilder.build()
        .withHost("https://spclient.wg.spotify.com/metadata/4")
        .withPath(`/${c.uri.type}/${hex}`)
        .send();

      const data: MetadataResponse = response.body;

      const trackName = data?.name;
      const artists = data?.artist || [];
      const artistNames = Array.isArray(artists)
        ? artists.map((a) => a?.name).filter(Boolean).join(", ")
        : "";
      const display = trackName
        ? artistNames
          ? `${artistNames} - ${trackName}`
          : trackName
        : null;

      return { idx: c.idx, id: c.id, display };
    });

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      const { idx } = trackIds[index];

      if (result.status === "fulfilled") {
        const value = result.value;
        names[value.idx] = value.display || uris[value.idx];
      } else {
        names[idx] = uris[idx];
      }
    });
  }

  if (episodeIds.length) {
    const promises = episodeIds.map(async (c) => {
      const episodeUri = uris[c.idx];
      const data: PodcastEpisode = await Spicetify.Platform.ShowAPI.getEpisodeOrChapter(episodeUri);
      const episodeName = data?.name;
      const showName = data?.podcast?.name;
      const display = episodeName
        ? showName
          ? `${showName} - ${episodeName}`
          : episodeName
        : null;
      return { idx: c.idx, id: c.id, display };
    });

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      const { idx } = episodeIds[index];

      if (result.status === "fulfilled") {
        const value = result.value;
        names[value.idx] = value.display || uris[value.idx];
      } else {
        names[idx] = uris[idx];
      }
    });
  }

  return names;
}

const namesCacheBySnapshotId = new Map<string, string[]>();

export async function getSnapshotItemNames(snapshot: Snapshot): Promise<string[]> {
  const cached = namesCacheBySnapshotId.get(snapshot.id);
  if (cached) return cached;
  const names = await resolveItemNames(snapshot.items);
  namesCacheBySnapshotId.set(snapshot.id, names);
  return names;
}

export function getSnapshotGeneratedNameFor(snapshot: Pick<Snapshot, "type" | "createdAt">): string {
  if (snapshot.type === "synced") {
    return t('snapshots.defaults.myJam');
  }
  const prefix = snapshot.type === "auto" ? t('snapshots.types.auto') : t('snapshots.types.manual');
  return `${prefix} ${formatDateTime(snapshot.createdAt)}`;
}

export function getSnapshotDisplayName(snapshot: Pick<Snapshot, "type" | "createdAt" | "name">): string {
  return snapshot.name || getSnapshotGeneratedNameFor(snapshot);
} 