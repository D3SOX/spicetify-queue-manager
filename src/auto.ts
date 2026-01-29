import type { Snapshot, Settings, AutoMode, QueueUpdateEvent, OnProgressEvent } from "./types";
import { getQueueFromSpicetify } from "./queue";
import { areQueuesEqual, generateId } from "./utils";
import { addSnapshot, getSortedSnapshots, loadSnapshots, saveSnapshots, saveSettings } from "./storage";
import { APP_NAME } from "./appInfo";
import { showErrorToast, showWarningToast } from "./toast";
import { t } from "./i18n";


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

  async function runSnapshotIfChanged(s: Settings) {
    try {
      if (!s.autoEnabled) return;
      const currentItems = getQueueFromSpicetify();
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
        lastSnapshotItems = currentItems;
        return;
      }

      // also check for other duplicates in the existing auto snapshots
      const existingAutos = loadSnapshots().filter(snap => snap.type === "auto");
      if (existingAutos.some(snap => areQueuesEqual(snap.items, currentItems))) {
        lastSnapshotItems = currentItems;
        return;
      }

      const snapshot: Snapshot = {
        id: generateId(),
        createdAt: Date.now(),
        type: "auto",
        items: currentItems,
      };
      addSnapshot(snapshot, s);
      lastSnapshotItems = currentItems;
    } catch (e) {
      console.error(`${APP_NAME}: auto snapshot error`, e);
      showErrorToast(t('toasts.failedToSaveAutomatic'));
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
      const events = Spicetify?.Player?.origin?._events;
      if (!events?.addListener || !events?.removeListener) {
        throw new Error("events API not available");
     }
      const onQueueUpdate: (event?: QueueUpdateEvent) => void = (evt) => {
        runSnapshotIfChanged(s);
        //console.debug(`${APP_NAME}: queue_update`, evt);
      };
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
      showErrorToast(t('toasts.failedToStartQueueWatcher'));
    }
  }

  function primeFromExisting(): void {
    const existing = getSortedSnapshots()[0];
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
    }

    currentMode = desiredMode;
  }

  return { startAutoTimer, primeFromExisting, applyAutoMode };
} 

export function createQueueCapacityWatcher(getSettings: () => Settings) {
  let unsubscribe: (() => void) | null = null;
  let lastWarnRemaining: number | null = null;
  let lastWarnAt = 0;
  let lastReportedSize: number | null = null;
  const warnCooldownMs = 30000;

  async function checkAndWarnOnce(): Promise<void> {
    try {
      const s = getSettings();
      if (!s.queueWarnEnabled) return;
      const maxSize = s.queueMaxSize;
      const threshold = s.queueWarnThreshold;
      if (threshold < 0 || maxSize <= 1) return;

      const items = getQueueFromSpicetify();
      const currentSize = items.length;
      
      // Skip if queue size hasn't increased
      if (lastReportedSize !== null && currentSize <= lastReportedSize) {
        return;
      }
      lastReportedSize = currentSize;
      
      if (!currentSize) return;
      const remaining = Math.max(0, maxSize - currentSize);
      if (remaining <= threshold) {
        const now = Date.now();
        if (lastWarnRemaining !== remaining || now - lastWarnAt >= warnCooldownMs) {
          const used = maxSize - remaining;
          showWarningToast(t('toasts.queueNearlyFull', { used, max: maxSize }), { duration: 15000, id: "queue-nearly-full" });
          lastWarnRemaining = remaining;
          lastWarnAt = now;
        }
      }
    } catch (e) {
      console.warn(`${APP_NAME}: queue capacity check failed`, e);
    }
  }

  function stop(): void {
    if (unsubscribe) {
      try { unsubscribe(); } catch {}
      unsubscribe = null;
    }
    lastReportedSize = null;
  }

  function start(): void {
    stop();
    try {
      const events = Spicetify?.Player?.origin?._events;
      if (!events?.addListener || !events?.removeListener) {
        throw new Error("queue_update events API not available");
      }

      const onQueueUpdate: (event?: QueueUpdateEvent) => void = (_evt) => {
        checkAndWarnOnce();
      };
      events.addListener("queue_update", onQueueUpdate);
      
      unsubscribe = () => {
        try { events.removeListener("queue_update", onQueueUpdate); } catch (e) {
          console.error(`${APP_NAME}: failed to remove queue_update listener (capacity watcher)`, e);
        }
      };

      checkAndWarnOnce();
    } catch (e) {
      console.error(`${APP_NAME}: failed to start capacity watcher`, e);
      showErrorToast(t('toasts.failedToStartCapacityWatcher'));
    }
  }

  return { start, stop, checkAndWarnOnce };
}

export function createQueueSyncManager(getSettings: () => Settings) {
  let unsubscribe: (() => void) | null = null;
  let lastKnownQueue: string[] = [];
  let isActive = false;
  let isSuspended = false;

  async function updatePlaybackPosition(progressMs: number) {
    const s = getSettings();
    if (!s.syncedSnapshotId || !isActive) return;

    const snapshots = loadSnapshots();
    const idx = snapshots.findIndex(snap => snap.id === s.syncedSnapshotId);
    if (idx >= 0) {
      snapshots[idx].playbackPosition = progressMs;
      saveSnapshots(snapshots);
    }
  }

  async function syncQueueToSnapshot(currentQueue: string[]) {
    const s = getSettings();
    if (!s.syncedSnapshotId) return;

    const snapshots = loadSnapshots();
    const idx = snapshots.findIndex(snap => snap.id === s.syncedSnapshotId);
    if (idx >= 0) {
      // Don't sync empty queues to prevent losing the snapshot content during queue replacements
      if (currentQueue.length === 0) {
        console.debug(`${APP_NAME}: skipping sync of empty queue to snapshot`);
        return;
      }
      snapshots[idx].items = currentQueue.slice();
      snapshots[idx].playbackPosition = Spicetify.Player.getProgress();
      saveSnapshots(snapshots);
    } else {
      // Synced snapshot no longer exists
      console.warn(`${APP_NAME}: synced snapshot ${s.syncedSnapshotId} no longer exists, deactivating sync mode`);
      const newSettings = { ...s, syncedSnapshotId: undefined };
      saveSettings(newSettings);

      showWarningToast(t('toasts.syncedSnapshotNotFound'));
    }
  }

  async function handleQueueUpdate() {
    try {
      const s = getSettings();
      if (!s.syncedSnapshotId || !isActive || isSuspended) return;

      const currentQueue = getQueueFromSpicetify();
      if (!areQueuesEqual(currentQueue, lastKnownQueue)) {
        await syncQueueToSnapshot(currentQueue);
        lastKnownQueue = currentQueue.slice();
      }
    } catch (e) {
      console.error(`${APP_NAME}: queue sync error`, e);
    }
  }

  function stop(): void {
    if (unsubscribe) {
      try { unsubscribe(); } catch {}
      unsubscribe = null;
    }
    isActive = false;
    isSuspended = false;
    lastKnownQueue = [];
  }

  function start(): void {
    stop();
    const s = getSettings();
    if (!s.syncedSnapshotId) return;

    try {
      const events = Spicetify?.Player?.origin?._events;
      if (!events?.addListener || !events?.removeListener) {
        throw new Error("events API not available");
      }

      const onQueueUpdate: (evt?: QueueUpdateEvent) => void = (_evt) => {
        handleQueueUpdate();
      };
      const onProgress = (evt?: Event) => {
        const event = evt as OnProgressEvent;
        updatePlaybackPosition(event.data);
      };

      events.addListener("queue_update", onQueueUpdate);
      Spicetify.Player.addEventListener("onprogress", onProgress);
      unsubscribe = () => {
        try { 
          events.removeListener("queue_update", onQueueUpdate);
          Spicetify.Player.removeEventListener("onprogress", onProgress);
        } catch (e) {
          console.error(`${APP_NAME}: failed to remove listeners (sync manager)`, e);
        }
      };

      isActive = true;
      
      // Initialize last known queue
      lastKnownQueue = getQueueFromSpicetify();
    } catch (e) {
      console.error(`${APP_NAME}: failed to start queue sync manager`, e);
      showErrorToast(t('toasts.failedToStartSyncManager'));
    }
  }

  function applySync(newSettings: Settings): void {
    const shouldBeActive = !!newSettings.syncedSnapshotId;
    
    if (shouldBeActive && !isActive) {
      start();
    } else if (!shouldBeActive && isActive) {
      stop();
    }
  }

  function suspend(): void {
    isSuspended = true;
    console.debug(`${APP_NAME}: sync manager suspended`);
  }

  async function resume(): Promise<void> {
    isSuspended = false;
    // After resuming, capture the current queue state so we don't sync the queue replacement
    lastKnownQueue = getQueueFromSpicetify();
    console.debug(`${APP_NAME}: sync manager resumed`);
  }

  return { start, stop, applySync, suspend, resume };
}