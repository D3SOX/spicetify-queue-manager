import { Snapshot } from "./types";

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

function getIdFromUri(uri: string): { type: "track" | "episode" | null; id: string | null } {
  const parts = uri.split(":");
  if (parts.length >= 3) {
    if (parts[1] === "track") return { type: "track", id: parts[2] };
    if (parts[1] === "episode") return { type: "episode", id: parts[2] };
  }
  return { type: null, id: null };
}

export async function resolveItemNames(uris: string[]): Promise<string[]> {
  const names: string[] = new Array(uris.length).fill("");
  const trackIds: { idx: number; id: string }[] = [];
  const episodeIds: { idx: number; id: string }[] = [];

  uris.forEach((u, idx) => {
    if (u.startsWith("spotify:local:")) {
      names[idx] = parseLocalTrackName(u);
      return;
    }
    const { type, id } = getIdFromUri(u);
    if (type === "track" && id) trackIds.push({ idx, id });
    else if (type === "episode" && id) episodeIds.push({ idx, id });
    else names[idx] = u;
  });

  for (let i = 0; i < trackIds.length; i += 50) {
    const chunk = trackIds.slice(i, i + 50);
    const ids = chunk.map(c => c.id).join(",");
    try {
      const res = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks?ids=${ids}`);
      const arr = Array.isArray(res?.tracks) ? res.tracks : [];
      const idToDisplay = new Map<string, string>();
      for (const t of arr) {
        if (t?.id && t?.name) {
          const artists = Array.isArray(t?.artists) ? t.artists.map((a: any) => a?.name).filter(Boolean).join(", ") : "";
          const display = artists ? `${artists} - ${t.name}` : t.name;
          idToDisplay.set(t.id, display);
        }
      }
      for (const c of chunk) names[c.idx] = idToDisplay.get(c.id) || uris[c.idx];
    } catch {
      for (const c of chunk) names[c.idx] = uris[c.idx];
    }
  }

  if (episodeIds.length) {
    for (let i = 0; i < episodeIds.length; i += 50) {
      const chunk = episodeIds.slice(i, i + 50);
      const ids = chunk.map(c => c.id).join(",");
      try {
        const res = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/episodes?ids=${ids}`);
        const arr = Array.isArray(res?.episodes) ? res.episodes : [];
        const idToDisplay = new Map<string, string>();
        for (const t of arr) {
          if (t?.id && t?.name) {
            const showName = t?.show?.name;
            const display = showName ? `${showName} - ${t.name}` : t.name;
            idToDisplay.set(t.id, display);
          }
        }
        for (const c of chunk) names[c.idx] = idToDisplay.get(c.id) || uris[c.idx];
      } catch {
        for (const c of chunk) names[c.idx] = uris[c.idx];
      }
    }
  }

  return names;
}

const namesCacheBySnapshotId = new Map<string, string[]>();

export async function getSnapshotItemNames(snapshot: Snapshot): Promise<string[]> {
  if (namesCacheBySnapshotId.has(snapshot.id)) return namesCacheBySnapshotId.get(snapshot.id)!;
  const names = await resolveItemNames(snapshot.items);
  namesCacheBySnapshotId.set(snapshot.id, names);
  return names;
} 