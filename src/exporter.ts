import { Snapshot } from "./types";
import { getSnapshotDisplayName, getSnapshotGeneratedNameFor } from "./names";
import { getQueueFromSpicetify } from "./queue";
import { addSnapshot } from "./storage";
import { generateId, setButtonLabel } from "./utils";
import { APP_NAME } from "./appInfo";
import { showPromptDialog } from "./dialogs";
import { showErrorToast, showSuccessToast, showWarningToast } from "./toast";

export async function updateQueueFromSnapshot(
  snapshot: Snapshot,
  mode: "append" | "replace",
  buttonEl?: HTMLButtonElement,
): Promise<void> {
  const opName = mode === "replace" ? "Replace" : "Append to";
  const opVerb = mode === "replace" ? "Replacing" : "Appending";
  const opNoun = mode === "replace" ? "replace" : "append";

  try {
    if (!snapshot.items.length) {
      showWarningToast("Snapshot is empty");
      return;
    }
    if (buttonEl) {
      buttonEl.disabled = true;
      setButtonLabel(buttonEl, `${opVerb}…`);
    }

    const itemsToQueue = snapshot.items.slice();
    let playbackStarted = false;

    if (mode === "replace") {
      const first = itemsToQueue.shift()!;

      try {
        await Spicetify.Platform.PlayerAPI.clearQueue();
      } catch (e) {
        console.warn(`${APP_NAME}: clearQueue failed (non-fatal)`, e);
      }

      if (first.startsWith("spotify:local:")) {
        try {
          await Spicetify.Platform.PlayerAPI.play(
            {
              uri: "spotify:internal:local-files",
              pages: [{ items: [{ uri: first }] }],
            },
            {},
            { skipTo: { index: 0 } },
          );
          playbackStarted = true;
        } catch (eLocal) {
          console.warn(`${APP_NAME}: local fallback failed`, eLocal);
        }
      } else {
        try {
          await Spicetify.Player.playUri(first);
          playbackStarted = true;
        } catch (e1) {
          try {
            await Spicetify.Platform.PlayerAPI.play({ uri: first }, {}, {});
            playbackStarted = true;
          } catch (e2) {
            console.warn(`${APP_NAME}: failed to start first track`, e2);
          }
        }
      }

      if (!playbackStarted) {
        throw new Error("Failed to start playback");
      }

      // Give the player a brief moment to switch track
      await new Promise(r => setTimeout(r, 250));
    }

    // Enqueue remaining items in order
    let addedToQueue = 0;
    for (let i = 0; i < itemsToQueue.length; i += 100) {
      const chunkUris = itemsToQueue.slice(i, i + 100);
      const chunk = chunkUris.map(uri => ({ uri }));
      try {
        await Spicetify.Platform.PlayerAPI.addToQueue(chunk);
        addedToQueue += chunk.length;
      } catch (err) {
        console.warn(`${APP_NAME}: addToQueue chunk failed`, err);
        for (const uri of chunkUris) {
          try {
            await Spicetify.Platform.PlayerAPI.addToQueue([{ uri }]);
            addedToQueue += 1;
          } catch (singleErr) {
            console.warn(`${APP_NAME}: addToQueue single failed`, { uri, error: singleErr });
          }
        }
      }
    }

    const totalExpected = snapshot.items.length;
    if (mode === "replace") {
      const totalInQueue = (playbackStarted ? 1 : 0) + addedToQueue;
      if (totalInQueue === totalExpected) {
        showSuccessToast(`Queue replaced (${totalExpected} items)`);
      } else {
        showWarningToast(`Replaced; some items couldn't be queued (${totalInQueue}/${totalExpected})`);
      }
    } else {
      // append
      if (addedToQueue === totalExpected) {
        showSuccessToast(`Added ${totalExpected} ${totalExpected === 1 ? "item" : "items"} to queue`);
      } else if (addedToQueue > 0) {
        showWarningToast(`Added ${addedToQueue}/${totalExpected} items to queue`);
      } else {
        showErrorToast("Failed to queue snapshot items");
      }
    }

    try {
      console.log(`${APP_NAME}: ${opName} result`, {
        snapshotId: snapshot.id,
        totalExpected,
        added: mode === "replace" ? (playbackStarted ? 1 : 0) + addedToQueue : addedToQueue,
      });
    } catch {}
  } catch (e) {
    console.error(`${APP_NAME}: ${opNoun} queue failed`, e);
    if (mode === "replace" && (e as Error)?.message === "Failed to start playback") {
      showErrorToast("Failed to start playback");
    } else {
      showErrorToast(`Failed to ${opNoun} queue`);
    }
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      setButtonLabel(buttonEl, `${opName} queue`);
    }
  }
}

export async function createManualSnapshot(): Promise<void> {
  try {
    const items = await getQueueFromSpicetify();
    if (!items.length) {
      showWarningToast("No queue found. If you believe this is an error, please try to play and pause a track.");
      return;
    }
    const defaultName = getSnapshotGeneratedNameFor({ type: "manual", createdAt: Date.now() });
    const name = (await showPromptDialog({
      title: "Save snapshot",
      message: "Name this snapshot",
      confirmLabel: "Save",
      cancelLabel: "Cancel",
      defaultValue: defaultName,
    }))?.trim() ?? null;

    if (name === null) {
      // canceled
      return;
    } else if (name === '') {
      showErrorToast("Snapshot not saved (name cannot be empty)");
      return;
    }

    const snapshot: Snapshot = {
      id: generateId(),
      createdAt: Date.now(),
      name: name === defaultName ? undefined : name,
      type: "manual",
      items,
    };
    addSnapshot(snapshot);
    showSuccessToast("Snapshot saved");
  } catch (e) {
    console.error(`${APP_NAME}: manual snapshot failed`, e);
    showErrorToast("Failed to save snapshot");
  }
}

export async function exportSnapshotToPlaylist(snapshot: Snapshot, buttonEl?: HTMLButtonElement): Promise<void> {
  try {
    if (!snapshot.items.length) {
      showWarningToast("Nothing to export");
      return;
    }

    if (buttonEl) {
      buttonEl.disabled = true;
      setButtonLabel(buttonEl, "Exporting…");
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
      showSuccessToast(`Exported to ${playlistName}`);
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
      showWarningToast(`Exported; some tracks couldn't be added (${totalAdded}/${totalExpected})`);
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
    showErrorToast("Failed to export to playlist");
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      setButtonLabel(buttonEl, "Export");
    }
  }
} 