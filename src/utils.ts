import { APP_NAME } from "./appInfo";
import { showErrorToast, showSuccessToast, showWarningToast } from "./toast";
import { t } from "./i18n";
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

    if (typeof window?.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
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
      } catch (err: unknown) {
        const isError = err instanceof Error;
        const errorName = isError ? err.name : 'Unknown';
        const errorMessage = isError ? err.message : '';
        
        // Check if this is a file system error disguised as AbortError
        const isFileSystemError = errorName === "AbortError" && (
          errorMessage.includes('Failed to create') ||
          errorMessage.includes('Failed to truncate') ||
          errorMessage.includes('permission') ||
          errorMessage.includes('access') ||
          errorMessage.includes('denied')
        );
        
        // Only treat as user cancellation if it's truly a user abort
        if (errorName === "AbortError" && !isFileSystemError) {
          return;
        }
        
        const reason = isError ? `${errorName}: ${errorMessage}` : 'Unknown error';
        showErrorToast(t('toasts.failedToExportJson', { reason }), { duration: 10000 });
        return;
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
    showSuccessToast(t('toasts.exportedToDownloads', { filename }));
  } catch (e) {
    console.warn(`${APP_NAME}: downloadJson failed`, e);
    const isError = e instanceof Error;
    const reason = isError ? `${e.name}: ${e.message}` : 'Unknown error';
    showErrorToast(t('toasts.failedToExportJson', { reason }), { duration: 10000 });
  }
}

export async function uploadJson<T>(): Promise<T | null> {
  try {
    let fileContent: string | undefined;

    if (typeof window?.showOpenFilePicker === "function") {
      try {
        const [handle] = await window.showOpenFilePicker({
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
      } catch (err: unknown) {
        const isError = err instanceof Error;
        const errorName = isError ? err.name : 'Unknown';
        if (errorName === "AbortError") {
          return null;
        }
        const reason = isError ? `${err.name}: ${err.message}` : 'Unknown error';
        showErrorToast(t('toasts.failedToImportJson', { reason }), { duration: 10000 });
        return null;
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
              
              if (file.size === 0) {
                showErrorToast(t('toasts.failedToImportJsonAccess'), { duration: 10000 });
                resolve(null);
                return;
              }
              
              const text = await file.text();
              
              if (text.length === 0) {
                showErrorToast(t('toasts.failedToImportJsonAccess'), { duration: 10000 });
                resolve(null);
                return;
              }
              
              resolve(text);
            } catch (readErr) {
              console.error(`${APP_NAME}: file read failed`, readErr);
              const isError = readErr instanceof Error;
              const reason = isError ? `${readErr.name}: ${readErr.message}` : 'Unknown error';
              showErrorToast(t('toasts.failedToImportJson', { reason }), { duration: 10000 });
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
    const isError = e instanceof Error;
    const reason = isError ? `${e.name}: ${e.message}` : 'Unknown error';
    showErrorToast(t('toasts.failedToImportJson', { reason }), { duration: 10000 });
    return null;
  }
}