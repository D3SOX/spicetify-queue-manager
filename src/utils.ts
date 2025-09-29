import { APP_NAME } from "./appInfo";
import { showErrorToast, showSuccessToast, showWarningToast } from "./toast";

export const DEFAULT_ICON_SIZE = 16;

export function formatDateTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return `${ts}`;
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getIconMarkup(icon: Spicetify.Icon, size = DEFAULT_ICON_SIZE): string {
  const iconMap = (Spicetify.SVGIcons ?? {}) as Record<string, string>;
  const raw = iconMap[icon];
  if (!raw) return "";
  return `<span class="qs-btn-icon" data-icon-name="${escapeHtml(
    icon,
  )}"><svg class="qs-svg-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style="width:${size}px;height:${size}px;">${raw}</svg></span>`;
}

export function setButtonLabel(button: HTMLButtonElement, label: string): void {
  const span = button.querySelector<HTMLElement>(".qs-btn-label");
  if (span) {
    span.textContent = label;
  } else {
    button.textContent = label;
  }
}

export function setButtonIcon(button: HTMLButtonElement, icon: Spicetify.Icon): void {
  const iconEl = button.querySelector<HTMLElement>(".qs-btn-icon");
  if (iconEl) {
    const newIconHTML = getIconMarkup(icon);
    if (newIconHTML) {
      iconEl.outerHTML = newIconHTML;
    }
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function areQueuesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export async function downloadJson(filename: string, data: any): Promise<void> {
  // Try File System Access API
  try {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });

    const w: any = window as any;
    if (w && typeof w.showSaveFilePicker === "function") {
      try {
        const handle = await w.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "JSON Files",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err && (err.name === "AbortError" || err.name === "NotAllowedError")) {
          showWarningToast(`Export canceled (${err.name})`);
          return;
        }
      }
    }

    // Fallback to anchor-triggered download (default download directory)
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showSuccessToast(`Exported ${filename} to Downloads folder`);
  } catch (e) {
    console.warn(`${APP_NAME}: downloadJson failed`, e);
    showErrorToast("Failed to export JSON");
  }
}

export async function uploadJson<T>(): Promise<T | null> {
  try {
    const w: any = window as any;
    let fileContent: string | undefined;

    if (w && typeof w.showOpenFilePicker === "function") {
      try {
        const [handle] = await w.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "JSON Files",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const file = await handle.getFile();
        fileContent = await file.text();
      } catch (err: any) {
        if (err && (err.name === "AbortError" || err.name === "NotAllowedError")) {
          showWarningToast(`Import canceled (${err.name})`);
          return null;
        }
      }
    } else {
      // Fallback for browsers that don't support showOpenFilePicker
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";

      const content = await new Promise<string | null>(resolve => {
        input.onchange = async () => {
          if (input.files?.length) {
            try {
              const file = input.files[0];
              const text = await file.text();
              resolve(text);
            } catch (readErr) {
              console.error(`${APP_NAME}: file read failed`, readErr);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };
        input.click();
      });
      if (content) {
        fileContent = content;
      }
    }

    if (typeof fileContent !== "string") {
      return null;
    }

    const data = JSON.parse(fileContent);
    return data as T;
  } catch (e) {
    console.warn(`${APP_NAME}: uploadJson failed`, e);
    showErrorToast("Failed to import JSON");
    return null;
  }
}