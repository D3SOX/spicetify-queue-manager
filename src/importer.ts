import { showConfirmDialog } from "./dialogs";
import { loadSnapshots, saveSnapshots } from "./storage";
import { showErrorToast, showSuccessToast } from "./toast";
import { Settings, Snapshot } from "./types";
import { uploadJson } from "./utils";
import { renderList, renderSettings } from "./ui";
import { UIHandlers } from "./ui";

function isValidSnapshot(s: any): s is Snapshot {
    return s && typeof s.id === "string" && typeof s.createdAt === "number" && (s.type === "auto" || s.type === "manual") && Array.isArray(s.items) && s.items.every((i: any) => typeof i === "string");
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
        showErrorToast("Some imported snapshots were invalid and have been skipped.");
    }

    if (!validSnaps.length) {
        showErrorToast("No valid snapshots to import.");
        return;
    }

    const existing = loadSnapshots();
    const existingIds = new Set(existing.map(s => s.id));
    const newSnaps = validSnaps.filter(s => !existingIds.has(s.id));

    if (!newSnaps.length) {
        showSuccessToast("All snapshots already exist.");
        return;
    }

    const updated: Snapshot[] = [...existing, ...newSnaps];
    saveSnapshots(updated);
    renderList();
    showSuccessToast(`Imported ${newSnaps.length} new ${newSnaps.length === 1 ? "snapshot" : "snapshots"}.`);
}

export async function importSettings(ui: UIHandlers): Promise<void> {
    const data = await uploadJson<Settings>();
    if (!data) return;

    if (!isValidSettings(data)) {
        showErrorToast("Invalid settings file format.");
        return;
    }

    const confirmed = await showConfirmDialog({
        title: "Import Settings",
        message: "This will overwrite your current settings. Are you sure?",
        confirmLabel: "Import",
        tone: "danger",
    });

    if (confirmed !== "confirm") {
        return;
    }

    ui.setSettings(data);
    renderSettings(ui);
    showSuccessToast("Settings imported successfully.");
}
