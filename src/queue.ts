import { APP_NAME } from "./appInfo";

function getTrackUri(val: any): string | null {
  if (typeof val === "string" && val.startsWith("spotify:")) return val;
  if (val && typeof val.uri === "string" && val.uri.startsWith("spotify:")) return val.uri;
  if (val && val.contextTrack && typeof val.contextTrack.uri === "string" && val.contextTrack.uri.startsWith("spotify:")) return val.contextTrack.uri;
  if (val && val.track && typeof val.track.uri === "string" && val.track.uri.startsWith("spotify:")) return val.track.uri;
  if (val && val.item && typeof val.item.uri === "string" && val.item.uri.startsWith("spotify:")) return val.item.uri;
  return null;
}

// TODO: why are we doing this?
function dedupeConsecutive(uris: string[]): string[] {
  const out: string[] = [];
  let prev: string | null = null;
  for (const u of uris) {
    if (u && u !== prev) out.push(u);
    prev = u;
  }
  return out;
}

export function getQueueFromSpicetify(): string[] {
  try {
    const q = Spicetify.Queue;
    const list: string[] = [];
    const current = getTrackUri(q?.track) || getTrackUri(Spicetify.Player?.data?.item);
    if (current) list.push(current);

    const nextArr = q?.nextTracks || [];
    let queuedCount = 0;
    for (const it of Array.isArray(nextArr) ? nextArr : []) {
      const provider: string | undefined = it?.provider;
      const meta = it?.contextTrack?.metadata || it?.metadata;
      const isQueuedFlag = meta?.is_queued === true || meta?.is_queued === "true";
      const isProvidedByQueue = provider === "queue" || isQueuedFlag;
      if (!isProvidedByQueue) continue;
      const uri = getTrackUri(it);
      if (uri) {
        list.push(uri);
        queuedCount++;
      }
    }
    const out = list.length ? dedupeConsecutive(list) : [];
    console.log(`${APP_NAME}: Spicetify.Queue -> now=%s queuedNext=%d total=%d`, Boolean(current), queuedCount, out.length);
    return out;
  } catch (e) { 
    console.error(`${APP_NAME}: Spicetify.Queue read failed`, e);
    return [];
  }
} 