import { APP_NAME } from "./appInfo";
import { showErrorToast, showSuccessToast, showWarningToast } from "./toast";

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

export function setButtonLabel(button: HTMLButtonElement, label: string): void {
  const span = button.querySelector<HTMLElement>(".qs-btn-label");
  if (span) {
    span.textContent = label;
  } else {
    button.textContent = label;
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
          showWarningToast("Export canceled");
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