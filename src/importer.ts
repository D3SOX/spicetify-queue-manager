import { showConfirmDialog } from "./dialogs";
import { loadSnapshots, saveSnapshots } from "./storage";
import { showErrorToast, showSuccessToast } from "./toast";
import { Settings, Snapshot } from "./types";
import { uploadJson } from "./utils";
import { renderList, renderSettings } from "./ui";
import { UIHandlers } from "./ui";
import { t } from "./i18n";

function isValidSnapshot(s: any): s is Snapshot {
    return s && typeof s.id === "string" && typeof s.createdAt === "number" && (s.type === "auto" || s.type === "manual" || s.type === "synced") && Array.isArray(s.items) && s.items.every((i: any) => typeof i === "string");
}

function isValidSettings(s: any): s is Settings {
    return s && typeof s.autoEnabled === "boolean" && typeof s.autoIntervalMs === "number" && typeof s.maxAutosnapshots === "number" && (s.autoMode === "timer" || s.autoMode === "on-change") && typeof s.onlyNewItems === "boolean" && typeof s.queueWarnEnabled === "boolean" && typeof s.queueMaxSize === "number" && typeof s.queueWarnThreshold === "number" && typeof s.promptManualBeforeReplace === "boolean";
}

export async function importSnapshots(): Promise<void> {
    const data = await uploadJson<Snapshot | Snapshot[]>();
    if (!data) return;

    const snapsToImport = Array.isArray(data) ? data : [data];
    const validSnaps = snapsToImport.filter(isValidSnapshot);

    if (validSnaps.length !== snapsToImport.length) {
        showErrorToast(t('toasts.someImportedSnapshotsInvalid'));
    }

    if (!validSnaps.length) {
        showErrorToast(t('toasts.noValidSnapshotsToImport'));
        return;
    }

    const existing = loadSnapshots();
    const existingIds = new Set(existing.map(s => s.id));
    const newSnaps = validSnaps.filter(s => !existingIds.has(s.id));

    if (!newSnaps.length) {
        showSuccessToast(t('toasts.allSnapshotsAlreadyExist'));
        return;
    }

    const updated: Snapshot[] = [...existing, ...newSnaps];
    saveSnapshots(updated);
    renderList();
    showSuccessToast(t('toasts.snapshotsImported', { count: newSnaps.length, plural: newSnaps.length === 1 ? "snapshot" : "snapshots" }));
}

export async function importSettings(ui: UIHandlers): Promise<void> {
    const data = await uploadJson<Settings>();
    if (!data) return;

    if (!isValidSettings(data)) {
        showErrorToast(t('toasts.invalidSettingsFile'));
        return;
    }

    const confirmed = await showConfirmDialog({
        title: t('dialogs.importSettings.title'),
        message: t('dialogs.importSettings.message'),
        confirmLabel: t('dialogs.importSettings.confirmLabel'),
        tone: "danger",
    });

    if (confirmed !== "confirm") {
        return;
    }

    ui.setSettings(data);
    renderSettings(ui);
    showSuccessToast(t('toasts.settingsImported'));
}
