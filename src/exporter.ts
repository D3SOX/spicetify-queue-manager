import { Snapshot } from "./types";
import { getSnapshotDisplayName, getSnapshotGeneratedNameFor } from "./names";
import { getQueueFromSpicetify } from "./queue";
import { addSnapshot } from "./storage";
import { generateId } from "./utils";
import { APP_NAME } from "./appInfo";

export async function createManualSnapshot(): Promise<void> {
  try {
    const items = await getQueueFromSpicetify();
    if (!items.length) {
      Spicetify.showNotification(`${APP_NAME}: No queue found. If you believe this is an error, please try to play and pause a track.`);
      return;
    }
    const defaultName = getSnapshotGeneratedNameFor({type: "manual", createdAt: Date.now()});
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
    addSnapshot(snapshot);
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

    const me = await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/me");
    const userId: string | undefined = me?.id;
    if (!userId) throw new Error("No user id");

    const playlistName = getSnapshotDisplayName(snapshot);
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

    let totalAdded = 0;
    const totalExpected = snapshot.items.length;
    for (let i = 0; i < snapshot.items.length; i += 100) {
      const chunk = snapshot.items.slice(i, i + 100);
      try {
        await Spicetify.Platform.PlaylistAPI.add(playlistUri, chunk, { after: "end" });
        totalAdded += chunk.length;
      } catch (e) {
        console.warn(`${APP_NAME}: failed to add a chunk`, e);
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

    // Start playback with the first item
    try {
      await Spicetify.Player.playUri(first);
    } catch (e1) {
      try {
        await Spicetify.Platform.PlayerAPI.play({ uri: first }, {}, {});
      } catch (e2) {
        console.warn(`${APP_NAME}: failed to start first track`, e2);
        Spicetify.showNotification(`${APP_NAME}: Failed to start snapshot`);
        return;
      }
    }

    // Give the player a brief moment to switch track
    await new Promise(r => setTimeout(r, 250));

    // Enqueue remaining items in order
    let added = 0;
    for (let i = 0; i < items.length; i += 100) {
      const chunk = items.slice(i, i + 100).map(u => ({ uri: u }));
      try {
        await Spicetify.Platform.PlayerAPI.addToQueue(chunk);
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