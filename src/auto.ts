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

  // Install monkey-patch hooks to emit a custom 'queuechange' event
  function installQueueChangeHooks(): () => void {
    const emit = () => {
      try { Spicetify.Player.dispatchEvent(new Event("queuechange")); } catch {}
    };

    const wrappedKeys: Array<{ obj: any; key: string; orig: any }> = [];
    const wrap = (obj: any, key: string) => {
      if (!obj || !obj[key] || obj[key].__wrapped) return;
      const orig = obj[key];
      const wrapped = async (...args: any[]) => {
        const result = await orig.apply(obj, args);
        emit();
        return result;
      };
      try { wrapped.__wrapped = true; } catch {}
      obj[key] = wrapped;
      wrappedKeys.push({ obj, key, orig });
    };

    // Patch common queue mutation paths
    try { wrap(Spicetify, "addToQueue"); } catch {}
    try { wrap(Spicetify, "removeFromQueue"); } catch {}
    try { wrap(Spicetify.Platform?.PlayerAPI, "addToQueue"); } catch {}
    try { wrap(Spicetify.Platform?.PlayerAPI, "removeFromQueue"); } catch {}
    try { wrap(Spicetify.Platform?.PlayerAPI, "insertIntoQueue"); } catch {}
    try { wrap(Spicetify.Platform?.PlayerAPI, "clearQueue"); } catch {}

    // Return uninstaller to restore originals
    return () => {
      for (const { obj, key, orig } of wrappedKeys) {
        obj[key] = orig;
      }
    };
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
      const uninstall = installQueueChangeHooks();
      queueUnsubscribeHooks.push(() => {
        try {
          uninstall();
        } catch (e) {
          console.error(`${APP_NAME}: failed to uninstall queue change hook`, e);
        }
      });

      const onQueueChange = () => runSnapshotIfChanged(s);
      Spicetify.Player.addEventListener("queuechange", onQueueChange);
      queueUnsubscribeHooks.push(() => {
        try {
          Spicetify.Player.removeEventListener("queuechange", onQueueChange);
        } catch (e) {
          console.error(`${APP_NAME}: failed to remove queue change listener`, e);
        }
      });
    } catch (e) {
      console.error(`${APP_NAME}: failed to start queue change watcher`, e);
      Spicetify.showNotification(`${APP_NAME}: failed to start queue change watcher`);
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