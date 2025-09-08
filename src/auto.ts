import { Snapshot, Settings, AutoMode } from "./types";
import { getQueueFromSpicetify } from "./queue";
import { areQueuesEqual, generateId } from "./utils";
import { loadSnapshots, saveSnapshots } from "./storage";
import { APP_NAME } from "./appInfo";


export function createAutoManager(getSettings: () => Settings) {
  let lastSnapshotItems: string[] = [];
  let autoTimer: number | null = null;
  let queueUnsubscribeHooks: Array<() => void> = [];
  let currentMode: AutoMode | null = null;
  let activeIntervalMs: number | null = null;

  function stopAutoTimer(): void {
    if (autoTimer !== null) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function addSnapshotToStorage(newSnapshot: Snapshot, s: Settings): void {
    const all = loadSnapshots();
    const updated = [newSnapshot, ...all].sort((a, b) => b.createdAt - a.createdAt).slice(0, s.maxAutosnapshots);
    saveSnapshots(updated);
  }

  // this is used bt the UI
  function pruneAutosToMax(): void {
    const s = getSettings();
    const all = loadSnapshots().sort((a, b) => b.createdAt - a.createdAt);
    const manuals = all.filter(snap => snap.type === "manual");
    const autos = all.filter(snap => snap.type === "auto").slice(0, s.maxAutosnapshots);
    saveSnapshots([...manuals, ...autos].sort((a, b) => b.createdAt - a.createdAt));
  }

  async function runSnapshotIfChanged(s: Settings) {
    try {
      if (!s.autoEnabled) return;
      const currentItems = await getQueueFromSpicetify();
      if (!currentItems.length) {
        console.log(`${APP_NAME}: queue is empty, skipping auto snapshot`);
        return;
      }

      if (s.onlyNewItems) {
        const lastSet = new Set(lastSnapshotItems);
        const hasNovelItems = currentItems.some(u => !lastSet.has(u));
        if (!hasNovelItems) {
          lastSnapshotItems = currentItems;
          return;
        }
      }
      if (areQueuesEqual(currentItems, lastSnapshotItems)) {
        return;
      }

      const snapshot: Snapshot = {
        id: generateId(),
        createdAt: Date.now(),
        type: "auto",
        items: currentItems,
      };
      addSnapshotToStorage(snapshot, s);
      lastSnapshotItems = currentItems;
    } catch (e) {
      console.error(`${APP_NAME}: auto snapshot error`, e);
      Spicetify.showNotification(`${APP_NAME}: failed to save an automatic snapshot`);
    }
  }

  function startAutoTimer(s: Settings): void {
    stopAutoTimer();
    if (!s.autoEnabled) return;
    autoTimer = window.setInterval(() => runSnapshotIfChanged(s), s.autoIntervalMs);
    activeIntervalMs = s.autoIntervalMs;
  }

  function unregisterQueueWatcher() {
    for (const u of queueUnsubscribeHooks) {
      u();
    }
    queueUnsubscribeHooks = [];
  }

  function startQueueWatcher(s: Settings): void {
    unregisterQueueWatcher();

    if (!s.autoEnabled) return;

    try {
      const events: any = (Spicetify as any)?.Player?.origin?._events;
      if (!events?.addListener || !events?.removeListener) {
        throw new Error("queue_update events API not available");
      }

      const onQueueUpdate = (_evt: any) => runSnapshotIfChanged(s);
      events.addListener("queue_update", onQueueUpdate);

      queueUnsubscribeHooks.push(() => {
        try {
          events.removeListener("queue_update", onQueueUpdate);
        } catch (e) {
          console.error(`${APP_NAME}: failed to remove queue_update listener`, e);
        }
      });
    } catch (e) {
      console.error(`${APP_NAME}: failed to start queue update watcher`, e);
      Spicetify.showNotification(`${APP_NAME}: failed to start queue update watcher`);
    }
  }

  function primeFromExisting(): void {
    const existing = loadSnapshots().sort((a, b) => b.createdAt - a.createdAt)[0];
    if (existing?.items?.length) lastSnapshotItems = existing.items.slice();
  }

  // this is used to idempotently apply the auto mode on settings changes and startup
  function applyAutoMode(newSettings: Settings): void {
    const desiredMode = !newSettings.autoEnabled ? null : newSettings.autoMode;

    // If mode didn't change, do nothing unless interval changed in timer mode
    if (desiredMode === currentMode) {
      if (desiredMode === "timer" && activeIntervalMs !== newSettings.autoIntervalMs) {
        startAutoTimer(newSettings);
      }
      return;
    }

    // Tear down previous mode
    if (currentMode === "on-change") {
      unregisterQueueWatcher();
    } else if (currentMode === "timer") {
      stopAutoTimer();
    }

    // Start new mode
    if (desiredMode === "on-change") {
      startQueueWatcher(newSettings);
    } else if (desiredMode === "timer") {
      startAutoTimer(newSettings);
    } else {
      // disabled
      unregisterQueueWatcher();
      stopAutoTimer();
    }

    currentMode = desiredMode;
  }

  return { startAutoTimer, primeFromExisting, pruneAutosToMax, applyAutoMode };
} 