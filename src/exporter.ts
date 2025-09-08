import { Snapshot } from "./types";
import { getQueueFromSpicetify } from "./queue";
import { formatDateTime } from "./utils";
import { loadSnapshots, saveSnapshots } from "./storage";
import { generateId } from "./utils";
import { APP_NAME } from "./appInfo";

function addSnapshotToStorage(newSnapshot: Snapshot): void {
  const existing = loadSnapshots();
  const autos: Snapshot[] = existing.filter(s => s.type === "auto");
  const manuals: Snapshot[] = existing.filter(s => s.type === "manual");
  const updated = [newSnapshot, ...manuals, ...autos];
  saveSnapshots(updated.sort((a, b) => b.createdAt - a.createdAt));
}

export async function createManualSnapshot(): Promise<void> {
  try {
    const items = await getQueueFromSpicetify();
    if (!items.length) {
      Spicetify.showNotification(`${APP_NAME}: No queue found. If you believe this is an error, please try to play and pause a track.`);
      return;
    }
    const defaultName = `Manual ${new Date().toLocaleString()}`;
    const name = window.prompt?.("Name this snapshot:", defaultName);

    if (!name) {
      Spicetify.showNotification(`${APP_NAME}: Snapshot not saved (no name provided)`);
      return;
    }

    const snapshot: Snapshot = {
      id: generateId(),
      createdAt: Date.now(),
      name,
      type: "manual",
      items,
    };
    addSnapshotToStorage(snapshot);
    Spicetify.showNotification(`${APP_NAME}: Snapshot saved`);
  } catch (e) {
    console.error(`${APP_NAME}: manual snapshot failed`, e);
    Spicetify.showNotification(`${APP_NAME}: Failed to save snapshot`);
  }
}

export async function exportSnapshotToPlaylist(snapshot: Snapshot, buttonEl?: HTMLButtonElement): Promise<void> {
  try {
    if (!snapshot.items.length) {
      Spicetify.showNotification(`${APP_NAME}: Nothing to export`);
      return;
    }

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Exporting…";
    }

    const localUris = snapshot.items.filter(u => u.startsWith("spotify:local:"));
    const webUris = snapshot.items.filter(u => !u.startsWith("spotify:local:"));

    const me = await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/me");
    const userId: string | undefined = me?.id;
    if (!userId) throw new Error("No user id");

    const playlistName = snapshot.name || `Queue ${formatDateTime(snapshot.createdAt)}`;
    const created = await Spicetify.CosmosAsync.post(
      `https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`,
      {
        name: playlistName,
        description: `Saved from ${APP_NAME} on ${new Date(snapshot.createdAt).toLocaleString()}`,
        public: false,
      }
    );
    const playlistId: string | undefined = created?.id;
    if (!playlistId) throw new Error("Playlist creation failed");
    const playlistUri = `spotify:playlist:${playlistId}`;
    const corePlaylistUriV1 = `spotify:user:${userId}:playlist:${playlistId}`;

    // Warm core metadata so core-playlist can resolve the newly created playlist
    try {
      await Spicetify.CosmosAsync.get(
        `sp://core-playlist/v1/playlist/${corePlaylistUriV1}/metadata`,
        { policy: { name: true } as any }
      );
    } catch {}

    // Helpers
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const coreAddWithRetry = async (chunk: string[]): Promise<number> => {
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          try {
            await Spicetify.CosmosAsync.post(
              `sp://core-playlist/v1/playlist/${corePlaylistUriV1}/add`,
              { uris: chunk }
            );
          } catch (e1) {
            await Spicetify.CosmosAsync.post(
              `sp://core-playlist/v1/playlist/${corePlaylistUriV1}/add`,
              { tracks: chunk.map(u => ({ uri: u })) }
            );
          }
          return chunk.length;
        } catch (e) {
          console.warn(`${APP_NAME}: core add failed (attempt ${attempt}/${maxAttempts})`, e);
          if (attempt < maxAttempts) await sleep(250 * attempt);
        }
      }
      return 0;
    };

    // Build runs of consecutive items by type (web vs local) to preserve order
    type Run = { isLocal: boolean; uris: string[] };
    const runs: Run[] = [];
    for (const u of snapshot.items) {
      const isLocal = u.startsWith("spotify:local:");
      const last = runs[runs.length - 1];
      if (last && last.isLocal === isLocal) last.uris.push(u);
      else runs.push({ isLocal, uris: [u] });
    }

    let totalAdded = 0;
    const totalExpected = snapshot.items.length;
    for (const run of runs) {
      if (run.isLocal) {
        for (let i = 0; i < run.uris.length; i += 100) {
          const chunk = run.uris.slice(i, i + 100);
          const added = await coreAddWithRetry(chunk);
          totalAdded += added;
        }
      } else {
        for (let i = 0; i < run.uris.length; i += 100) {
          const chunk = run.uris.slice(i, i + 100);
          try {
            await Spicetify.CosmosAsync.post(
              `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`,
              { uris: chunk }
            );
            totalAdded += chunk.length;
          } catch (e) {
            console.warn(`${APP_NAME}: failed to add a chunk of web tracks`, e);
          }
        }
      }
    }

    const allAdded = totalAdded === totalExpected;

    if (allAdded) {
      Spicetify.showNotification(`${APP_NAME}: Exported to ${playlistName}`);
      try {
        const uri = Spicetify.URI.playlistV2URI(playlistId);
        const path = uri?.toURLPath(true);
        const history = Spicetify.Platform.History;
        if (path) {
          if (history?.push) {
            try {
              history.push(path);
            } catch {
              history.push({ pathname: path });
            }
          } else {
            window.location.hash = path;
          }
        }
      } catch {}
    } else {
      Spicetify.showNotification(`${APP_NAME}: Exported; some tracks couldn't be added (${totalAdded}/${totalExpected})`);
    }

    try {
      console.log(`${APP_NAME}: Export result`, {
        snapshotId: snapshot.id,
        totalExpected,
        totalAdded,
      });
    } catch {}
  } catch (e) {
    console.error(`${APP_NAME}: export failed`, e);
    Spicetify.showNotification(`${APP_NAME}: Failed to export to playlist`);
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = "Export to playlist";
    }
  }
}

export async function replaceQueueWithSnapshot(snapshot: Snapshot, buttonEl?: HTMLButtonElement): Promise<void> {
  try {
    if (!snapshot.items.length) {
      Spicetify.showNotification(`${APP_NAME}: Snapshot is empty`);
      return;
    }
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Replacing…";
    }

    const items = snapshot.items.slice();
    const first = items.shift()!;

    try {
      await Spicetify.Platform.PlayerAPI.clearQueue();
    } catch (e) {
      console.warn(`${APP_NAME}: clearQueue failed (non-fatal)`, e);
    }

    // Start playback with the first item (supports local and web URIs)
    try {
      await Spicetify.Player.playUri(first);
    } catch (e1) {
      try {
        await Spicetify.Platform.PlayerAPI.play({ uri: first } as any, {}, {});
      } catch (e2) {
        console.warn(`${APP_NAME}: failed to start first track`, e2);
        Spicetify.showNotification(`${APP_NAME}: Failed to start snapshot`);
        return;
      }
    }

    // Give the player a brief moment to switch track
    await new Promise(r => setTimeout(r, 250));

    // Enqueue remaining items in order (supports locals)
    let added = 0;
    for (let i = 0; i < items.length; i += 100) {
      const chunk = items.slice(i, i + 100).map(u => ({ uri: u }));
      try {
        await Spicetify.Platform.PlayerAPI.addToQueue(chunk as any);
        added += chunk.length;
      } catch (e) {
        console.warn(`${APP_NAME}: addToQueue chunk failed`, e);
      }
    }

    if (added === items.length) {
      Spicetify.showNotification(`${APP_NAME}: Queue replaced (${snapshot.items.length} items)`);
    } else {
      Spicetify.showNotification(`${APP_NAME}: Replaced; some items couldn't be queued (${added + 1}/${snapshot.items.length})`);
    }
  } catch (e) {
    console.error(`${APP_NAME}: replace queue failed`, e);
    Spicetify.showNotification(`${APP_NAME}: Failed to replace queue`);
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = "Replace queue";
    }
  }
} 