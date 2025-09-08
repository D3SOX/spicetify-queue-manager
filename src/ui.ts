import { Snapshot, Settings } from "./types";
import { loadSnapshots, saveSettings, saveSnapshots } from "./storage";
import { getSnapshotItemNames, getSnapshotDisplayName } from "./names";
import { escapeHtml, downloadJson } from "./utils";
import { createManualSnapshot, exportSnapshotToPlaylist } from "./exporter";
import { replaceQueueWithSnapshot } from "./exporter";
import { APP_NAME } from "./appInfo";
import "./ui.css";

export type UIHandlers = {
  pruneAutosToMax: () => void;
  getSettings: () => Settings;
  setSettings: (s: Settings) => void;
};

let boundClickHandler: ((e: MouseEvent) => void) | null = null;
let boundChangeHandler: ((e: Event) => void) | null = null;
const exportingIds = new Set<string>();

function generateRowsHTMLFor(list: Snapshot[]): string {
  return list
    .map(s => {
      const label = escapeHtml(getSnapshotDisplayName(s));
      const hasLocal = s.items.some(u => u.startsWith("spotify:local:"));
      const meta = `${s.items.length} items${hasLocal ? " · includes local" : ""}`;
      return `
          <div class="qs-row" data-id="${s.id}">
            <div class="qs-row-main">
              <div class="qs-row-title">${label}</div>
              <div class="qs-row-meta">${meta}</div>
            </div>
            <div class="qs-row-actions">
              <button class="qs-btn" data-action="toggle-items">View items</button>
              <button class="qs-btn" data-action="replace-queue">Replace queue</button>
              <button class="qs-btn" data-action="export">Export to playlist</button>
              <button class="qs-btn" data-action="rename">Rename</button>
              <button class="qs-btn" data-action="reset-name">Reset name</button>
              <button class="qs-btn danger" data-action="delete">Delete</button>
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
  const snapshots = loadSnapshots().sort((a, b) => b.createdAt - a.createdAt);
  const autos = snapshots.filter(s => s.type === "auto");
  const manuals = snapshots.filter(s => s.type === "manual");
  const autoRows = generateRowsHTMLFor(autos);
  const manualRows = generateRowsHTMLFor(manuals);
  return `
      <div class="qs-section">
        <div class="qs-section-title">
          <span>Manual Snapshots (${manuals.length})</span>
          <div class="qs-actions">
            <button class="qs-btn" id="qs-export-manuals">Export</button>
            <button class="qs-btn" id="qs-new-manual">Save now</button>
          </div>
        </div>
        ${manualRows || '<div style="opacity:0.7">No manual snapshots yet</div>'}
      </div>
      <div class="qs-section">
        <div class="qs-section-title">
          <span>Automatic Snapshots (${autos.length})</span>
          <div class="qs-actions">
            <button class="qs-btn" id="qs-export-autos">Export</button>
          </div>
        </div>
        ${autoRows || '<div style="opacity:0.7">No automatic snapshots yet</div>'}
      </div>
    `;
}

export function openManagerModal(ui: UIHandlers): void {
  const sections = generateSectionsHTML();
  const s = ui.getSettings();

  const body = `
      <div class="qs-container">
        <div class="qs-header">
          <div style="font-weight:700">Actions and Settings</div>
          <div class="qs-actions">
            <button class="qs-btn" id="qs-refresh">Refresh</button>
            <button class="qs-btn" id="qs-export-settings">Export settings</button>
          </div>
        </div>
        <div class="qs-settings">
          <div class="qs-setting">
            <label class="qs-checkbox"><input type="checkbox" id="qs-auto-enabled" ${s.autoEnabled ? "checked" : ""}/> Enable automatic snapshots</label>
            <div style="opacity:0.7; font-size:12px">Mode 
              <div class="qs-radio-group" id="qs-auto-mode-group">
                <label class="qs-radio-label"><input type="radio" class="qs-radio" name="qs-auto-mode" value="timer" ${s.autoMode === "timer" ? "checked" : ""} ${s.autoEnabled ? "" : "disabled"}/><span>Time-based</span></label>
                <label class="qs-radio-label"><input type="radio" class="qs-radio" name="qs-auto-mode" value="on-change" ${s.autoMode === "on-change" ? "checked" : ""} ${s.autoEnabled ? "" : "disabled"}/><span>Queue changes</span></label>
              </div>
            </div>
            <div class="qs-setting" style="margin-top:6px">
              <label class="qs-checkbox"><input type="checkbox" id="qs-only-new" ${s.onlyNewItems ? "checked" : ""} ${s.autoEnabled ? "" : "disabled"}/> Check for new items</label>
              <div style="opacity:0.7; font-size:12px">Only trigger it when there is a new song that was not in the previous snapshot.</div>
            </div>
            <div class="qs-setting" style="margin-top:6px">
              <div style="opacity:0.7; font-size:12px">Equal queues are never saved as automatic snapshots.</div>
            </div>
          </div>
          <div class="qs-right">
            <div class="qs-setting">
              <label>Interval (minutes)</label>
              <input class="qs-input" type="number" id="qs-auto-interval-mins" min="0.5" step="0.5" value="${(s.autoIntervalMs / 60000).toFixed(2)}" ${s.autoEnabled && s.autoMode === "timer" ? "" : "disabled"} />
              <div style="opacity:0.7; font-size:12px">Minimum 0.5 (30 seconds)</div>
            </div>
            <div class="qs-setting">
              <label>Max automatic snapshots</label>
              <input class="qs-input" type="number" id="qs-max-autos" min="1" step="1" value="${s.maxAutosnapshots}" ${s.autoEnabled ? "" : "disabled"} />
              <div style="opacity:0.7; font-size:12px">Older snapshots are pruned</div>
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
    radios.forEach(r => { r.disabled = !st.autoEnabled; });
    if (intervalInput) intervalInput.disabled = !(st.autoEnabled && st.autoMode === "timer");
    if (chkOnlyNew) chkOnlyNew.disabled = !st.autoEnabled;
    if (maxAutosInput) maxAutosInput.disabled = !st.autoEnabled;
  }

  boundClickHandler = async function clickHandler(e: MouseEvent) {
    const modalRoot = document.querySelector(".qs-container");
    const target = e.target as HTMLElement | null;
    if (modalRoot && target && modalRoot.contains(target)) {
      e.stopPropagation();
    }
    if (!modalRoot) return;
    if (!target) return;

    if (target.id === "qs-new-manual") {
      e.preventDefault();
      await createManualSnapshot();
      renderList();
      return;
    }
    if (target.id === "qs-export-settings") {
      e.preventDefault();
      const settings = ui.getSettings();
      downloadJson(`${APP_NAME}-settings.json`, settings);
      return;
    }
    if (target.id === "qs-export-manuals") {
      e.preventDefault();
      const data = loadSnapshots().filter(s => s.type === "manual");
      downloadJson(`${APP_NAME}-manual-snapshots.json`, data);
      return;
    }
    if (target.id === "qs-export-autos") {
      e.preventDefault();
      const data = loadSnapshots().filter(s => s.type === "auto");
      downloadJson(`${APP_NAME}-auto-snapshots.json`, data);
      return;
    }
    if (target.id === "qs-refresh") {
      e.preventDefault();
      renderList();
      return;
    }
    if (target.matches(".qs-btn")) {
      const rowEl = target.closest(".qs-row") as HTMLElement | null;
      const action = target.getAttribute("data-action");
      if (!rowEl || !action) return;
      const id = rowEl.getAttribute("data-id");
      if (!id) return;
      const snap = loadSnapshots().find(s => s.id === id);
      if (!snap) return;

      if (action === "toggle-items") {
        e.preventDefault();
        const itemsEl = rowEl.nextElementSibling as HTMLElement | null;
        const btn = target as HTMLButtonElement;
        if (!itemsEl || !itemsEl.classList.contains("qs-items")) return;
        const isHidden = itemsEl.style.display === "none" || !itemsEl.style.display;
        if (isHidden) {
          itemsEl.style.display = "block";
          btn.textContent = "Hide items";
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
          btn.textContent = "View items";
        }
        return;
      }

      if (action === "export") {
        if (exportingIds.has(id)) return;
        exportingIds.add(id);
        const btn = target as HTMLButtonElement;
        await exportSnapshotToPlaylist(snap, btn);
        exportingIds.delete(id);
        return;
      }
      if (action === "replace-queue") {
        if (exportingIds.has(id)) return;
        exportingIds.add(id);
        const btn = target as HTMLButtonElement;
        await replaceQueueWithSnapshot(snap, btn);
        exportingIds.delete(id);
        return;
      }
      if (action === "rename") {
        e.preventDefault();
        const input = prompt("Enter a new name.", getSnapshotDisplayName(snap));
        if (input === null) return;
        const newName = input.trim();
        if (newName.length === 0) {
          Spicetify.showNotification("Name cannot be empty", true, 2000);
          return;
        }
        const snapshots = loadSnapshots();
        const idx = snapshots.findIndex(s => s.id === id);
        if (idx >= 0) {
          snapshots[idx].name = newName;
          saveSnapshots(snapshots);
          renderList();
        }
        return;
      }
      if (action === "reset-name") {
        e.preventDefault();
        const snapshots = loadSnapshots();
        const idx = snapshots.findIndex(s => s.id === id);
        if (idx >= 0) {
          delete snapshots[idx].name;
          saveSnapshots(snapshots);
          renderList();
        }
        return;
      }
      if (action === "delete") {
        const remaining = loadSnapshots().filter(s => s.id !== id);
        saveSnapshots(remaining);
        renderList();
        return;
      }
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
      saveSettings(ui.getSettings());
      applyControlDisabledStates();
      return;
    }
    if ((target as HTMLInputElement).name === "qs-auto-mode") {
      const radio = target as HTMLInputElement;
      const s0 = ui.getSettings();
      const mode = radio.value === "on-change" ? "on-change" : "timer";
      const newSettings: Settings = { ...s0, autoMode: mode };
      ui.setSettings(newSettings);
      saveSettings(newSettings);
      applyControlDisabledStates();
      return;
    }
    if (target.id === "qs-only-new") {
      const checkbox = target as HTMLInputElement;
      const onlyNewItems = !!checkbox.checked;
      const s0 = ui.getSettings();
      const newSettings: Settings = { ...s0, onlyNewItems };
      ui.setSettings(newSettings);
      saveSettings(newSettings);
      return;
    }
    if (target.id === "qs-auto-interval-mins") {
      const input = target as HTMLInputElement;
      const s0 = ui.getSettings();
      const mins = parseFloat(input.value);
      const clamped = isFinite(mins) && mins >= 0.5 ? mins : s0.autoIntervalMs / 60000;
      const newSettings = { ...s0, autoIntervalMs: Math.round(clamped * 60000) };
      ui.setSettings(newSettings);
      saveSettings(ui.getSettings());
      return;
    }
    if (target.id === "qs-max-autos") {
      const input = target as HTMLInputElement;
      const s0 = ui.getSettings();
      const num = parseInt(input.value, 10);
      const max = Number.isFinite(num) && num > 0 ? num : s0.maxAutosnapshots;
      ui.setSettings({ ...s0, maxAutosnapshots: max });
      saveSettings(ui.getSettings());
      ui.pruneAutosToMax();
      renderList();
      return;
    }
  };

  document.addEventListener("click", boundClickHandler, true);
  document.addEventListener("change", boundChangeHandler, true);

  applyControlDisabledStates();
}

export function renderList(): void {
  const listEl = document.getElementById("qs-list");
  if (listEl) {
    const sections = generateSectionsHTML();
    listEl.innerHTML = sections || '<div style="opacity:0.7">No snapshots yet</div>';
  }
}