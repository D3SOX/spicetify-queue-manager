import { Snapshot } from "./types";
import { getSnapshotDisplayName, getSnapshotGeneratedNameFor } from "./names";
import { getQueueFromSpicetify } from "./queue";
import { addSnapshot } from "./storage";
import { generateId, setButtonLabel } from "./utils";
import { APP_NAME } from "./appInfo";
import { showPromptDialog } from "./dialogs";
import { showErrorToast, showSuccessToast, showWarningToast } from "./toast";
import { t } from "./i18n";

export async function createManualSnapshot(): Promise<void> {
  try {
    const items = await getQueueFromSpicetify();
    if (!items.length) {
      showWarningToast(t('toasts.noQueueFound'));
      return;
    }
    const defaultName = getSnapshotGeneratedNameFor({ type: "manual", createdAt: Date.now() });
    const name = (await showPromptDialog({
      title: t('dialogs.saveSnapshot.title'),
      message: t('dialogs.saveSnapshot.message'),
      confirmLabel: t('dialogs.saveSnapshot.confirmLabel'),
      cancelLabel: t('dialogs.saveSnapshot.cancelLabel'),
      defaultValue: defaultName,
    }))?.trim() ?? null;

    if (name === null) {
      // canceled
      return;
    } else if (name === '') {
      showErrorToast(t('toasts.nameCannotBeEmpty'));
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
    showSuccessToast(t('toasts.snapshotSaved'));
  } catch (e) {
    console.error(`${APP_NAME}: manual snapshot failed`, e);
    showErrorToast(t('toasts.failedToSaveSnapshot'));
  }
}

export async function exportSnapshotToPlaylist(snapshot: Snapshot, buttonEl?: HTMLButtonElement): Promise<void> {
  try {
    if (!snapshot.items.length) {
      showWarningToast(t('toasts.nothingToExport'));
      return;
    }

    if (buttonEl) {
      buttonEl.disabled = true;
      setButtonLabel(buttonEl, t('snapshots.actions.exporting'));
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
      showSuccessToast(t('toasts.exportedToPlaylist', { name: playlistName }));
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
      showWarningToast(t('toasts.exportResult', { added: totalAdded, total: totalExpected }));
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
    showErrorToast(t('toasts.failedToExport'));
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      setButtonLabel(buttonEl, t('ui.buttons.export'));
    }
  }
}

export async function appendSnapshotToQueue(snapshot: Snapshot, buttonEl?: HTMLButtonElement): Promise<void> {
  try {
    if (!snapshot.items.length) {
      showWarningToast(t('toasts.snapshotEmpty'));
      return;
    }

    if (buttonEl) {
      buttonEl.disabled = true;
      setButtonLabel(buttonEl, t('snapshots.actions.appending'));
    }

    // Filter out items that are already present in the current queue
    const existingQueue = getQueueFromSpicetify();
    const existingSet = new Set(existingQueue);
    const items = snapshot.items.filter(u => !existingSet.has(u));

    if (!items.length) {
      showWarningToast(t('toasts.allItemsAlreadyInQueue'));
      return;
    }
    let added = 0;

    for (let i = 0; i < items.length; i += 100) {
      const chunkUris = items.slice(i, i + 100);
      const chunk = chunkUris.map(uri => ({ uri }));
      try {
        await Spicetify.Platform.PlayerAPI.addToQueue(chunk);
        added += chunk.length;
      } catch (err) {
        console.warn(`${APP_NAME}: addToQueue chunk failed`, err);
        for (const uri of chunkUris) {
          try {
            await Spicetify.Platform.PlayerAPI.addToQueue([{ uri }]);
            added += 1;
          } catch (singleErr) {
            console.warn(`${APP_NAME}: addToQueue single failed`, { uri, error: singleErr });
          }
        }
      }
    }

    const totalExpected = items.length;

    if (added === totalExpected) {
      showSuccessToast(t('toasts.addedToQueue', { count: totalExpected, plural: totalExpected === 1 ? t('ui.itemSingular') : t('ui.itemPlural') }));
    } else if (added > 0) {
      showWarningToast(t('toasts.appendResult', { added, total: totalExpected }));
    } else {
      showErrorToast(t('toasts.failedToAppend'));
    }

    try {
      console.log(`${APP_NAME}: Append result`, {
        snapshotId: snapshot.id,
        totalExpected,
        added,
      });
    } catch {}
  } catch (e) {
    console.error(`${APP_NAME}: append queue failed`, e);
    showErrorToast(t('toasts.failedToAppend'));
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      setButtonLabel(buttonEl, t('ui.buttons.appendToQueue'));
    }
  }
}

export async function replaceQueueWithSnapshot(snapshot: Snapshot, buttonEl?: HTMLButtonElement): Promise<void> {
  try {
    if (!snapshot.items.length) {
      showWarningToast(t('toasts.snapshotEmpty'));
      return;
    }
    if (buttonEl) {
      buttonEl.disabled = true;
      setButtonLabel(buttonEl, t('snapshots.actions.replacing'));
    }

    const items = snapshot.items.slice();
    const first = items.shift()!;

    try {
      await Spicetify.Platform.PlayerAPI.clearQueue();
    } catch (e) {
      console.warn(`${APP_NAME}: clearQueue failed (non-fatal)`, e);
    }

    if (first.startsWith("spotify:local:")) {
      try {
        await Spicetify.Platform.PlayerAPI.play({
          uri: "spotify:internal:local-files",
          pages: [
            {
              items: [{ uri: first }],
            },
          ],
        }, {}, {
          skipTo: {
            index: 0,
          },
        });
      } catch (eLocal) {
        console.warn(`${APP_NAME}: local fallback failed`, eLocal);
        showErrorToast(t('toasts.failedToStartPlayback'));
        return;
      }
    } else {
      // Start playback with the first item
      try {
        await Spicetify.Player.playUri(first);
      } catch (e1) {
        try {
          await Spicetify.Platform.PlayerAPI.play({ uri: first }, {}, {});
        } catch (e2) {
          console.warn(`${APP_NAME}: failed to start first track`, e2);
          showErrorToast(t('toasts.failedToStartPlayback'));
          return;
        }
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
      showSuccessToast(t('toasts.queueReplaced', { count: snapshot.items.length }));
    } else {
      showWarningToast(t('toasts.replaceResult', { added: added + 1, total: snapshot.items.length }));
    }
  } catch (e) {
    console.error(`${APP_NAME}: replace queue failed`, e);
    showErrorToast(t('toasts.failedToReplace'));
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      setButtonLabel(buttonEl, t('ui.buttons.replaceQueue'));
    }
  }
} 