import { ButtonTone } from "./types";
import { t } from "./i18n";

type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ButtonTone;
  extraLabel?: string;
  extraTone?: ButtonTone;
};

type PromptDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ButtonTone;
  defaultValue?: string;
  placeholder?: string;
};

let dialogOpen = false;

function getToneClass(tone?: ButtonTone): string {
  return (tone === "danger" || tone === "primary" || tone === "subtle") ? tone : "default";
}

function createBackdrop(): HTMLDivElement {
  const backdrop = document.createElement("div");
  backdrop.className = "qs-confirm-backdrop";
  document.body.appendChild(backdrop);
  return backdrop;
}

function createDialogContainer(backdrop: HTMLDivElement): HTMLDivElement {
  const dialog = document.createElement("div");
  dialog.className = "qs-confirm-dialog";
  backdrop.appendChild(dialog);
  return dialog;
}

type ConfirmDialogResult = "confirm" | "cancel" | "extra";

export function showConfirmDialog(options: ConfirmDialogOptions): Promise<ConfirmDialogResult> {
  if (dialogOpen) return Promise.resolve("cancel");
  dialogOpen = true;
  const { title, message, confirmLabel = t('ui.buttons.confirm'), cancelLabel = t('ui.buttons.cancel'), tone = "default", extraLabel, extraTone = "subtle" } = options;

  return new Promise(resolve => {
    const backdrop = createBackdrop();
    const dialog = createDialogContainer(backdrop);

    if (title) {
      const titleEl = document.createElement("div");
      titleEl.className = "qs-confirm-title";
      titleEl.textContent = title;
      dialog.appendChild(titleEl);
    }

    const messageEl = document.createElement("div");
    messageEl.className = "qs-confirm-message";
    messageEl.textContent = message;
    dialog.appendChild(messageEl);

    const actionsEl = document.createElement("div");
    actionsEl.className = "qs-confirm-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "qs-btn subtle";
    cancelBtn.textContent = cancelLabel;

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    const toneClass = getToneClass(tone);
    const confirmClasses = ["qs-btn"];
    if (toneClass !== "default") confirmClasses.push(toneClass);
    else confirmClasses.push("primary");
    confirmBtn.className = confirmClasses.join(" ");
    confirmBtn.textContent = confirmLabel;

    let extraBtn: HTMLButtonElement | null = null;
    if (extraLabel) {
      extraBtn = document.createElement("button");
      extraBtn.type = "button";
      const extraToneClass = getToneClass(extraTone);
      const extraClasses = ["qs-btn"];
      if (extraToneClass !== "default") extraClasses.push(extraToneClass);
      else extraClasses.push("primary");
      extraBtn.className = extraClasses.join(" ");
      extraBtn.textContent = extraLabel;
    }

    if (extraBtn) {
      actionsEl.append(cancelBtn, extraBtn, confirmBtn);
    } else {
      actionsEl.append(cancelBtn, confirmBtn);
    }
    dialog.appendChild(actionsEl);

    const prevFocused = document.activeElement as HTMLElement | null;
    let resolved = false;

    function cleanup(result: ConfirmDialogResult) {
      if (resolved) return;
      resolved = true;
      backdrop.remove();
      if (prevFocused?.focus) prevFocused.focus();
      document.removeEventListener("keydown", onKeyDown, true);
      dialogOpen = false;
      resolve(result);
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cleanup("cancel");
      } else if (ev.key === "Enter" && document.activeElement === confirmBtn) {
        ev.preventDefault();
        cleanup("confirm");
      }
    }

    cancelBtn.addEventListener("click", () => cleanup("cancel"));
    confirmBtn.addEventListener("click", () => cleanup("confirm"));
    if (extraBtn) {
      extraBtn.addEventListener("click", () => cleanup("extra"));
    }
    backdrop.addEventListener("click", ev => {
      if (ev.target === backdrop) cleanup("cancel");
    });
    document.addEventListener("keydown", onKeyDown, true);

    setTimeout(() => {
      confirmBtn.focus();
    }, 0);
  });
}

export function showPromptDialog(options: PromptDialogOptions): Promise<string | null> {
  if (dialogOpen) return Promise.resolve(null);
  dialogOpen = true;
  const {
    title,
    message,
    confirmLabel = t('ui.buttons.confirm'),
    cancelLabel = t('ui.buttons.cancel'),
    tone = "default",
    defaultValue = "",
    placeholder,
  } = options;

  return new Promise(resolve => {
    const backdrop = createBackdrop();
    const dialog = createDialogContainer(backdrop);

    if (title) {
      const titleEl = document.createElement("div");
      titleEl.className = "qs-confirm-title";
      titleEl.textContent = title;
      dialog.appendChild(titleEl);
    }

    if (message) {
      const messageEl = document.createElement("div");
      messageEl.className = "qs-confirm-message";
      messageEl.textContent = message;
      dialog.appendChild(messageEl);
    }

    const input = document.createElement("input");
    input.type = "text";
    input.className = "qs-dialog-input";
    input.value = defaultValue;
    if (placeholder) input.placeholder = placeholder;
    dialog.appendChild(input);

    const actionsEl = document.createElement("div");
    actionsEl.className = "qs-confirm-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "qs-btn subtle";
    cancelBtn.textContent = cancelLabel;

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    const toneClass = getToneClass(tone);
    const confirmClasses = ["qs-btn"];
    if (toneClass !== "default") confirmClasses.push(toneClass);
    else confirmClasses.push("primary");
    confirmBtn.className = confirmClasses.join(" ");
    confirmBtn.textContent = confirmLabel;

    actionsEl.append(cancelBtn, confirmBtn);
    dialog.appendChild(actionsEl);

    const prevFocused = document.activeElement as HTMLElement | null;
    let resolved = false;

    function cleanup(result: string | null) {
      if (resolved) return;
      resolved = true;
      backdrop.remove();
      input.removeEventListener("keydown", onInputKeyDown);
      document.removeEventListener("keydown", onGlobalKeyDown, true);
      if (prevFocused?.focus) prevFocused.focus();
      dialogOpen = false;
      resolve(result);
    }

    function onInputKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        cleanup(input.value);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        cleanup(null);
      }
    }

    function onGlobalKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cleanup(null);
      }
    }

    cancelBtn.addEventListener("click", () => cleanup(null));
    confirmBtn.addEventListener("click", () => cleanup(input.value));
    input.addEventListener("keydown", onInputKeyDown);
    document.addEventListener("keydown", onGlobalKeyDown, true);
    backdrop.addEventListener("click", ev => {
      if (ev.target === backdrop) cleanup(null);
    });

    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  });
}

export type { ConfirmDialogOptions, ConfirmDialogResult, PromptDialogOptions };

