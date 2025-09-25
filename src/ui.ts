import "./ui.css";

import { Snapshot, Settings, ButtonRenderOptions, BadgeVariant } from "./types";
import { loadSnapshots, pruneAutosToMax, saveSnapshots } from "./storage";
import { getSnapshotItemNames, getSnapshotDisplayName, getSnapshotGeneratedNameFor } from "./names";
import { escapeHtml, downloadJson, setButtonLabel } from "./utils";
import { showErrorToast, showSuccessToast } from "./toast";
import { createManualSnapshot, exportSnapshotToPlaylist } from "./exporter";
import { replaceQueueWithSnapshot } from "./exporter";
import { APP_CHANNEL, APP_NAME, APP_VERSION } from "./appInfo";
import { getSortedSnapshots } from "./storage";
import { showConfirmDialog, ConfirmDialogResult } from "./dialogs";

export type UIHandlers = {
  getSettings: () => Settings;
  setSettings: (s: Settings) => void;
};

let boundClickHandler: ((e: MouseEvent) => void) | null = null;
let boundChangeHandler: ((e: Event) => void) | null = null;
const exportingIds = new Set<string>();

type InlineEditState = {
  input: HTMLInputElement;
  labelEl: HTMLElement;
  originalLabel: string;
  actionsEl?: HTMLElement;
  originalActionsDisplay?: string;
  generatedName: string;
  onKeyDown: (e: KeyboardEvent) => void;
  onBlur: () => void;
};

const inlineEditors = new Map<string, InlineEditState>();

function closeAllInlineEditors(exceptId?: string) {
  Array.from(inlineEditors.keys()).forEach(id => {
    if (id !== exceptId) {
      cleanupInlineRename(id);
    }
  });
}

function cleanupInlineRename(id: string) {
  const state = inlineEditors.get(id);
  if (!state) return;
  state.input.removeEventListener("keydown", state.onKeyDown);
  state.input.removeEventListener("blur", state.onBlur);
  if (state.input.isConnected) state.input.remove();
  state.labelEl.style.display = "";
  state.labelEl.textContent = state.originalLabel;
  if (state.actionsEl) state.actionsEl.style.display = state.originalActionsDisplay ?? "";
  inlineEditors.delete(id);
}

function beginInlineRename(rowEl: HTMLElement, snapshot: Snapshot) {
  if (!rowEl.isConnected) return;
  const id = snapshot.id;
  if (inlineEditors.has(id)) {
    const existing = inlineEditors.get(id);
    if (existing) {
      existing.input.focus();
      existing.input.select();
    }
    return;
  }
  const titleEl = rowEl.querySelector<HTMLElement>(".qs-row-title");
  if (!titleEl) return;
  const textSpan = Array.from(titleEl.querySelectorAll<HTMLElement>("span"))[1];
  if (!textSpan) return;
  const actionsEl = titleEl.querySelector<HTMLElement>(".qs-title-actions") ?? undefined;
  const originalLabel = textSpan.textContent ?? "";
  const generatedName = getSnapshotGeneratedNameFor(snapshot);
  const originalActionsDisplay = actionsEl?.style.display ?? "";
  const input = document.createElement("input");
  input.type = "text";
  input.value = snapshot.name ?? originalLabel;
  input.className = "qs-inline-input";
  input.setAttribute("aria-label", "Snapshot name");
  textSpan.style.display = "none";
  if (actionsEl) {
    actionsEl.style.display = "none";
  }
  titleEl.insertBefore(input, actionsEl ?? null);

  const onCommit = (save: boolean) => {
    const state = inlineEditors.get(id);
    if (!state) return;
    cleanupInlineRename(id);
    if (save) {
      const newValue = state.input.value.trim();
      if (!newValue) {
        showErrorToast("Name cannot be empty", { duration: 2000 });
        beginInlineRename(rowEl, snapshot);
        return;
      }
      const originalTrimmed = state.originalLabel.trim();
      if (newValue === originalTrimmed) {
        return;
      }
      if (newValue === state.generatedName) {
        showErrorToast("Name must differ from the default suggestion", { duration: 2000 });
        return;
      }
      const snapshots = loadSnapshots();
      const idx = snapshots.findIndex(s => s.id === id);
      if (idx >= 0) {
        snapshots[idx].name = newValue;
        saveSnapshots(snapshots);
        renderList();
      }
    }
  };

  const state: InlineEditState = {
    input,
    labelEl: textSpan,
    originalLabel,
    actionsEl ,
    originalActionsDisplay,
    generatedName,
    onKeyDown(ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        onCommit(true);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        onCommit(false);
      }
    },
    onBlur() {
      onCommit(true);
    },
  };

  inlineEditors.set(id, state);
  input.addEventListener("keydown", state.onKeyDown);
  input.addEventListener("blur", state.onBlur);
  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

const DEFAULT_ICON_SIZE = 16;

function getIconMarkup(icon: Spicetify.Icon, size = DEFAULT_ICON_SIZE): string {
  const iconMap = (Spicetify.SVGIcons ?? {}) as Record<string, string>;
  const raw = iconMap[icon];
  if (!raw) return "";
  return `<span class="qs-btn-icon" data-icon-name="${escapeHtml(icon)}"><svg class="qs-svg-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style="width:${size}px;height:${size}px;">${raw}</svg></span>`;
}

function renderButton(label: string, icon: Spicetify.Icon, options: ButtonRenderOptions = {}): string {
  const { action, id, tone = "default", title } = options;
  const classes = ["qs-btn"];
  if (tone === "danger") classes.push("danger");
  if (tone === "primary") classes.push("primary");
  if (tone === "subtle") classes.push("subtle");
  const attrs: string[] = [];
  if (action) attrs.push(`data-action="${action}"`);
  if (id) attrs.push(`id="${id}"`);
  if (title) attrs.push(`title="${escapeHtml(title)}"`);
  const attrString = attrs.length ? ` ${attrs.join(" ")}` : "";
  const iconHtml = getIconMarkup(icon);
  return `<button type="button" class="${classes.join(" ")}"${attrString}>${iconHtml}<span class="qs-btn-label">${escapeHtml(label)}</span></button>`;
}

function renderActionIconButton(action: string, icon: Spicetify.Icon, title: string): string {
  return `<button type="button" class="qs-icon-btn" data-action="${escapeHtml(action)}" title="${escapeHtml(title)}">${getIconMarkup(icon)}</button>`;
}

function renderBadge(text: string, variant: BadgeVariant = "default"): string {
  const classes = ["qs-pill"];
  if (variant !== "default") {
    const variantClasses: Record<Exclude<BadgeVariant, "default">, string> = {
      accent: "qs-pill--accent",
      version: "qs-pill--version",
      channel: "qs-pill--channel",
    };
    classes.push(variantClasses[variant]);
  }
  return `<span class="${classes.join(" ")}">${escapeHtml(text)}</span>`;
}

function generateRowsHTMLFor(list: Snapshot[]): string {
  return list
    .map(s => {
      const label = escapeHtml(getSnapshotDisplayName(s));
      const hasLocal = s.items.some(u => u.startsWith("spotify:local:"));
      const metaParts = [
        renderBadge(`${s.items.length} ${s.items.length === 1 ? "item" : "items"}`, "accent"),
      ];
      if (hasLocal) {
        metaParts.push(renderBadge("includes local"));
      }
      const meta = metaParts.join("");
      return `
          <div class="qs-row" data-id="${s.id}">
            <div class="qs-row-main">
              <div class="qs-row-title">
                ${getIconMarkup(s.type === "auto" ? "clock" : "playlist")}
                <span>${label}</span>
                <span class="qs-title-actions">
                  ${renderActionIconButton("rename", "edit", "Rename snapshot")}
                  ${s.name ? renderActionIconButton("reset-name", "repeat", "Reset name") : ""}
                </span>
              </div>
              <div class="qs-row-meta">${meta}</div>
              <div class="qs-row-actions">
                ${renderButton("View items", "list-view", { action: "toggle-items", title: "Toggle items" })}
                ${renderButton("Replace queue", "queue", { action: "replace-queue", title: "Replace queue", tone: "primary" })}
                ${renderButton("Export", "download", { action: "export", title: "Export to playlist" })}
                ${renderButton("Delete", "minus", { action: "delete", title: "Delete snapshot", tone: "danger" })}
              </div>
            </div>
          </div>
          <div class="qs-items" data-id="${s.id}" style="display:none">
            <div class="qs-items-body">Loading…</div>
          </div>
        `;
    })
    .join("");
}

function generateSectionsHTML(): string {
  const snapshots = getSortedSnapshots();
  const autos = snapshots.filter(s => s.type === "auto");
  const manuals = snapshots.filter(s => s.type === "manual");
  const autoRows = generateRowsHTMLFor(autos);
  const manualRows = generateRowsHTMLFor(manuals);
  return `
      <div class="qs-section-card">
        <div class="qs-section-head">
          <div class="qs-section-heading">
            ${getIconMarkup("playlist")}
            <div class="qs-section-text">
              <div class="qs-section-name">Manual Snapshots</div>
              <div class="qs-section-caption">Your saved queues for later</div>
            </div>
            ${renderBadge(String(manuals.length), "accent")}
          </div>
          <div class="qs-actions">
            ${renderButton("Export all", "download", { id: "qs-export-manuals", tone: "subtle" })}
            ${renderButton("Save now", "plus-alt", { id: "qs-new-manual", tone: "primary" })}
          </div>
        </div>
        <div class="qs-section-body">
          ${manualRows || '<div class="qs-empty">No manual snapshots yet</div>'}
        </div>
      </div>
      <div class="qs-section-card">
        <div class="qs-section-head">
          <div class="qs-section-heading">
            ${getIconMarkup("clock")}
            <div class="qs-section-text">
              <div class="qs-section-name">Automatic Snapshots</div>
              <div class="qs-section-caption">Captured in the background</div>
            </div>
            ${renderBadge(String(autos.length), "accent")}
          </div>
          <div class="qs-actions">
            ${renderButton("Export all", "download", { id: "qs-export-autos", tone: "subtle" })}
          </div>
        </div>
        <div class="qs-section-body">
          ${autoRows || '<div class="qs-empty">No automatic snapshots yet</div>'}
        </div>
      </div>
    `;
}

export function openManagerModal(ui: UIHandlers): void {
  const versionBadge = renderBadge(`v${APP_VERSION}`, "version");
  const channelBadge = APP_CHANNEL ? renderBadge(APP_CHANNEL.toUpperCase(), "channel") : "";
  const sections = generateSectionsHTML();
  const s = ui.getSettings();

  const body = `
      <div class="qs-container">
        <div class="qs-header">
          <div class="qs-header-title">
            <div class="qs-header-icon">${getIconMarkup("queue", 20)}</div>
            <span class="qs-header-badges">${versionBadge}${channelBadge}</span>
          </div>
          <div class="qs-actions">
            ${renderButton("Refresh", "repeat", { id: "qs-refresh", tone: "subtle" })}
            ${renderButton("Export settings", "download", { id: "qs-export-settings" })}
          </div>
        </div>
        <div class="qs-settings">
          <div class="qs-settings-header">
            <div class="qs-section-heading">
              ${getIconMarkup("grid-view")}
              <div class="qs-section-text">
                <div class="qs-section-name">Settings</div>
                <div class="qs-section-caption">Tune automation and queue alerts</div>
              </div>
            </div>
          </div>
          <div class="qs-setting">
              <label class="qs-checkbox"><input type="checkbox" id="qs-auto-enabled" ${s.autoEnabled ? "checked" : ""}/> ${getIconMarkup("brightness")}Enable automatic snapshots</label>
            <div class="qs-dim">Mode 
              <div class="qs-radio-group" id="qs-auto-mode-group">
                <label class="qs-radio-label"><input type="radio" class="qs-radio" name="qs-auto-mode" value="timer" ${s.autoMode === "timer" ? "checked" : ""} ${s.autoEnabled ? "" : "disabled"}/><span>${getIconMarkup("clock")} Time-based</span></label>
                <label class="qs-radio-label"><input type="radio" class="qs-radio" name="qs-auto-mode" value="on-change" ${s.autoMode === "on-change" ? "checked" : ""} ${s.autoEnabled ? "" : "disabled"}/><span>${getIconMarkup("shuffle")} Queue changes</span><span class="qs-icon"><span class="qs-icon-glyph">ⓘ</span><span class="qs-tooltip"><span class="qs-tooltip-emph">Experimental!</span>This mode may create many similar snapshots (for example when queuing a bunch of songs)</span></span></label>
              </div>
            </div>
            <div class="qs-setting" style="margin-top:6px">
              <label class="qs-checkbox"><input type="checkbox" id="qs-only-new" ${s.onlyNewItems ? "checked" : ""} ${s.autoEnabled ? "" : "disabled"}/> ${getIconMarkup("search")} Check for new items</label>
              <div style="opacity:0.7; font-size:12px">Only trigger it when there is a new song that was not in the previous snapshot.</div>
            </div>
            <div class="qs-setting" style="margin-top:6px">
              <div style="opacity:0.7; font-size:12px">Equal queues are never saved as automatic snapshots.</div>
            </div>
            <div class="qs-setting" style="margin-top:12px">
              <label class="qs-checkbox"><input type="checkbox" id="qs-queue-warn-enabled" ${s.queueWarnEnabled ? "checked" : ""}/> ${getIconMarkup("exclamation-circle")} Warn when queue is nearly full</label>
              <div style="opacity:0.7; font-size:12px">Heuristic limit; includes current track. Adjust if needed.</div>
            </div>
            <div class="qs-setting" style="margin-top:12px">
              <label class="qs-checkbox"><input type="checkbox" id="qs-prompt-manual-before-replace" ${s.promptManualBeforeReplace ? "checked" : ""}/> ${getIconMarkup("copy")} Ask to save manual snapshot before replacing queue</label>
              <div style="opacity:0.7; font-size:12px">Offers to store the current queue before overwriting it.</div>
            </div>
          </div>
          <div class="qs-right">
            <div class="qs-setting">
              <label>${getIconMarkup("clock")} Interval (minutes)</label>
              <input class="qs-input" type="number" id="qs-auto-interval-mins" min="0.5" step="0.5" value="${(s.autoIntervalMs / 60000).toFixed(2)}" ${s.autoEnabled && s.autoMode === "timer" ? "" : "disabled"} />
              <div style="opacity:0.7; font-size:12px">Minimum 0.5 (30 seconds)</div>
            </div>
            <div class="qs-setting">
              <label>${getIconMarkup("chart-up")} Max automatic snapshots</label>
              <input class="qs-input" type="number" id="qs-max-autos" min="1" step="1" value="${s.maxAutosnapshots}" ${s.autoEnabled ? "" : "disabled"} />
              <div style="opacity:0.7; font-size:12px">Older snapshots are pruned. Be careful when changing this</div>
            </div>
            <div class="qs-setting">
              <label>${getIconMarkup("queue")} Queue max size</label>
              <input class="qs-input" type="number" id="qs-queue-max-size" min="10" step="1" value="${s.queueMaxSize}" ${s.queueWarnEnabled ? "" : "disabled"} />
            </div>
            <div class="qs-setting">
              <label>${getIconMarkup("exclamation-circle")} Warn when remaining slots ≤</label>
              <input class="qs-input" type="number" id="qs-queue-warn-threshold" min="0" step="1" value="${s.queueWarnThreshold}" ${s.queueWarnEnabled ? "" : "disabled"} />
            </div>
          </div>
        </div>
        <div id="qs-list">
          ${sections || '<div style="opacity:0.7">No snapshots yet</div>'}
        </div>
      </div>
    `;

  Spicetify.PopupModal.display({
    title: APP_NAME,
    content: body,
    isLarge: true,
  });

  if (boundClickHandler) {
    document.removeEventListener("click", boundClickHandler, true);
    boundClickHandler = null;
  }
  if (boundChangeHandler) {
    document.removeEventListener("change", boundChangeHandler, true);
    boundChangeHandler = null;
  }

  function applyControlDisabledStates() {
    const st = ui.getSettings();
    const radios = document.querySelectorAll<HTMLInputElement>('input.qs-radio[name="qs-auto-mode"]');
    const intervalInput = document.querySelector<HTMLInputElement>("#qs-auto-interval-mins");
    const chkOnlyNew = document.querySelector<HTMLInputElement>("#qs-only-new");
    const maxAutosInput = document.querySelector<HTMLInputElement>("#qs-max-autos");
    const queueMaxSizeInput = document.querySelector<HTMLInputElement>("#qs-queue-max-size");
    const queueWarnThresholdInput = document.querySelector<HTMLInputElement>("#qs-queue-warn-threshold");
    radios.forEach(r => { r.disabled = !st.autoEnabled; });
    if (intervalInput) intervalInput.disabled = !(st.autoEnabled && st.autoMode === "timer");
    if (chkOnlyNew) chkOnlyNew.disabled = !st.autoEnabled;
    if (maxAutosInput) maxAutosInput.disabled = !st.autoEnabled;
    const warnEnabled = st.queueWarnEnabled;
    if (queueMaxSizeInput) queueMaxSizeInput.disabled = !warnEnabled;
    if (queueWarnThresholdInput) queueWarnThresholdInput.disabled = !warnEnabled;
  }

  boundClickHandler = async function clickHandler(e: MouseEvent) {
    const modalRoot = document.querySelector(".qs-container");
    const target = e.target as HTMLElement | null;
    if (modalRoot && target && modalRoot.contains(target)) {
      e.stopPropagation();
    }
    if (!modalRoot) return;
    if (!target) return;

    const snapshots = loadSnapshots();

    const clickedButton = target.closest<HTMLButtonElement>(".qs-btn, .qs-icon-btn");

    if (clickedButton?.id === "qs-new-manual") {
      e.preventDefault();
      closeAllInlineEditors();
      await createManualSnapshot();
      renderList();
      return;
    }
    if (clickedButton?.id === "qs-export-settings") {
      e.preventDefault();
      const settings = ui.getSettings();
      return await downloadJson(`${APP_NAME}-settings.json`, settings);
    }
    if (clickedButton?.id === "qs-export-manuals") {
      e.preventDefault();
      const data = snapshots.filter(s => s.type === "manual");
      return await downloadJson(`${APP_NAME}-manual-snapshots.json`, data);
    }
    if (clickedButton?.id === "qs-export-autos") {
      e.preventDefault();
      const data = snapshots.filter(s => s.type === "auto");
      return await downloadJson(`${APP_NAME}-auto-snapshots.json`, data);
    }
    if (clickedButton?.id === "qs-refresh") {
      e.preventDefault();
      renderList();
      return;
    }

    if (!clickedButton) return;

    const rowEl = clickedButton.closest<HTMLElement>(".qs-row");
    const actionAttr = clickedButton.getAttribute("data-action");
    const isRowAction = clickedButton.classList.contains("qs-icon-btn");

    if (!rowEl || (!actionAttr && isRowAction)) return;
    const id = rowEl.getAttribute("data-id");
    if (!id) return;
    if (!inlineEditors.has(id)) {
      closeAllInlineEditors(id);
    }
    const snap = snapshots.find(s => s.id === id);
    if (!snap) return;

    if (isRowAction) {
      if (actionAttr === "rename") {
        e.preventDefault();
        beginInlineRename(rowEl, snap);
        return;
      }
      if (actionAttr === "reset-name") {
        e.preventDefault();
        const idx = snapshots.findIndex(s => s.id === id);
        if (idx >= 0) {
          delete snapshots[idx].name;
          saveSnapshots(snapshots);
          renderList();
        }
        return;
      }
      return;
    }

    const action = actionAttr;
    if (!action) return;

    if (action === "toggle-items") {
      const itemsEl = rowEl.nextElementSibling as HTMLElement | null;
      const btn = clickedButton;
      if (!itemsEl || !itemsEl.classList.contains("qs-items")) return;
      const isHidden = itemsEl.style.display === "none" || !itemsEl.style.display;
      if (isHidden) {
        itemsEl.style.display = "block";
        setButtonLabel(btn, "Hide items");
        const bodyEl = itemsEl.querySelector(".qs-items-body") as HTMLElement | null;
        if (bodyEl) {
          bodyEl.textContent = "Loading…";
          try {
            const names = await getSnapshotItemNames(snap);
            bodyEl.innerHTML = names
              .map((n, i) => `<div>${i + 1}. ${escapeHtml(n)}</div>`)
              .join("");
          } catch (err) {
            bodyEl.textContent = "Failed to load items";
          }
        }
      } else {
        itemsEl.style.display = "none";
        setButtonLabel(btn, "View items");
      }
      return;
    }
    if (action === "export") {
      if (exportingIds.has(id)) return;
      exportingIds.add(id);
      await exportSnapshotToPlaylist(snap, clickedButton);
      exportingIds.delete(id);
      return;
    }
    if (action === "replace-queue") {
      if (exportingIds.has(id)) return;
      exportingIds.add(id);
      try {
        const settings = ui.getSettings();
        if (settings.promptManualBeforeReplace) {
          const shouldSave = await showConfirmDialog({
            title: "Save current queue?",
            message: "Create a manual snapshot of the current queue before replacing it?",
            confirmLabel: "Save snapshot",
            cancelLabel: "Skip",
            extraLabel: "Cancel",
            extraTone: "subtle",
            tone: "primary",
          });
          if (shouldSave === "extra") {
            return;
          }
          if (shouldSave === "confirm") {
            await createManualSnapshot();
            renderList();
          }
        }
        await replaceQueueWithSnapshot(snap, clickedButton);
      } finally {
        exportingIds.delete(id);
      }
      return;
    }
    if (action === "delete") {
      const confirmDelete: ConfirmDialogResult = await showConfirmDialog({
        title: "Delete snapshot",
        message: "Delete this snapshot? This cannot be undone.",
        confirmLabel: "Delete",
        tone: "danger",
      });
      if (confirmDelete !== "confirm") return;
      const snapshotName = getSnapshotDisplayName(snap);
      const remaining = snapshots.filter(s => s.id !== id);
      saveSnapshots(remaining);
      renderList();
      showSuccessToast(`Snapshot deleted: ${snapshotName}`);
      return;
    }
  };

  boundChangeHandler = function changeHandler(e: Event) {
    const modalRoot = document.querySelector(".qs-container");
    const target = e.target as HTMLElement | null;
    if (!modalRoot || !target || !modalRoot.contains(target)) return;
    e.stopPropagation();

    if (target.id === "qs-auto-enabled") {
      const checkbox = target as HTMLInputElement;
      const autoEnabled = !!checkbox.checked;
      const s0 = ui.getSettings();
      const newSettings = { ...s0, autoEnabled };
      ui.setSettings(newSettings);
      closeAllInlineEditors();
      applyControlDisabledStates();
      return;
    }
    if ((target as HTMLInputElement).name === "qs-auto-mode") {
      const radio = target as HTMLInputElement;
      const s0 = ui.getSettings();
      const mode = radio.value === "on-change" ? "on-change" : "timer";
      const newSettings: Settings = { ...s0, autoMode: mode };
      ui.setSettings(newSettings);
      applyControlDisabledStates();
      return;
    }
    if (target.id === "qs-only-new") {
      const checkbox = target as HTMLInputElement;
      const onlyNewItems = !!checkbox.checked;
      const s0 = ui.getSettings();
      const newSettings: Settings = { ...s0, onlyNewItems };
      ui.setSettings(newSettings);
      return;
    }
    if (target.id === "qs-auto-interval-mins") {
      const input = target as HTMLInputElement;
      const s0 = ui.getSettings();
      const mins = parseFloat(input.value);
      const clamped = isFinite(mins) && mins >= 0.5 ? mins : s0.autoIntervalMs / 60000;
      const newSettings = { ...s0, autoIntervalMs: Math.round(clamped * 60000) };
      ui.setSettings(newSettings);
      return;
    }
    if (target.id === "qs-max-autos") {
      const input = target as HTMLInputElement;
      const s0 = ui.getSettings();
      const num = parseInt(input.value, 10);
      const max = Number.isFinite(num) && num > 0 ? num : s0.maxAutosnapshots;
      const newSettings = { ...s0, maxAutosnapshots: max };
      ui.setSettings(newSettings);
      pruneAutosToMax(newSettings);
      renderList();
      return;
    }
    if (target.id === "qs-queue-warn-enabled") {
      const checkbox = target as HTMLInputElement;
      const queueWarnEnabled = checkbox.checked;
      const s0 = ui.getSettings();
      const newSettings: Settings = { ...s0, queueWarnEnabled };
      ui.setSettings(newSettings);
      applyControlDisabledStates();
      return;
    }
    if (target.id === "qs-queue-max-size") {
      const input = target as HTMLInputElement;
      const s0 = ui.getSettings();
      const num = parseInt(input.value, 10);
      const value = Number.isFinite(num) && num > 1 ? num : s0.queueMaxSize;
      const newSettings: Settings = { ...s0, queueMaxSize: value };
      ui.setSettings(newSettings);
      return;
    }
    if (target.id === "qs-queue-warn-threshold") {
      const input = target as HTMLInputElement;
      const s0 = ui.getSettings();
      const num = parseInt(input.value, 10);
      const value = Number.isFinite(num) && num >= 0 ? num : s0.queueWarnThreshold;
      const newSettings: Settings = { ...s0, queueWarnThreshold: value };
      ui.setSettings(newSettings);
      return;
    }
    if (target.id === "qs-prompt-manual-before-replace") {
      const checkbox = target as HTMLInputElement;
      const promptManualBeforeReplace = checkbox.checked;
      const s0 = ui.getSettings();
      const newSettings: Settings = { ...s0, promptManualBeforeReplace };
      ui.setSettings(newSettings);
      return;
    }
  };

  document.addEventListener("click", boundClickHandler, true);
  document.addEventListener("change", boundChangeHandler, true);

  applyControlDisabledStates();
}

export function renderList(): void {
  closeAllInlineEditors();
  const listEl = document.getElementById("qs-list");
  if (listEl) {
    const sections = generateSectionsHTML();
    listEl.innerHTML = sections || '<div style="opacity:0.7">No snapshots yet</div>';
  }
}