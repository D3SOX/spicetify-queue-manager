import "./toast.css";

import { APP_NAME } from "./appInfo";

export type ToastTone = "default" | "success" | "danger" | "warning";

export type ToastOptions = {
  tone?: ToastTone;
  duration?: number;
  dismissible?: boolean;
  id?: string;
};

export type ToastHandle = {
  close: () => void;
  element: HTMLElement;
};

let container: HTMLElement | null = null;
const activeToasts = new Map<HTMLElement, number>();

function resolveToastBody(message: string | HTMLElement): string | HTMLElement {
  if (typeof message !== "string") {
    return message;
  }
  const trimmed = message.trim();
  if (!trimmed.length) {
    throw new Error(`${APP_NAME} toast message cannot be empty`);
  }
  return trimmed;
}

function setToastBodyContent(bodyEl: HTMLElement, content: string | HTMLElement): void {
  while (bodyEl.firstChild) {
    bodyEl.removeChild(bodyEl.firstChild);
  }
  if (typeof content === "string") {
    bodyEl.textContent = content;
  } else {
    bodyEl.appendChild(content);
  }
}

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) {
    return container;
  }
  container = document.createElement("div");
  container.className = "qs-toast-container";
  container.setAttribute("role", "region");
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-label", "Notifications");
  document.body.appendChild(container);
  return container;
}

function setToastDurationMetadata(toastEl: HTMLElement, duration: number): void {
  if (duration > 0 && isFinite(duration)) {
    toastEl.dataset.toastDuration = String(duration);
  } else {
    delete toastEl.dataset.toastDuration;
  }
}

function getToastDurationFromMetadata(toastEl: HTMLElement): number | null {
  const raw = toastEl.dataset.toastDuration;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function scheduleRemoval(toastEl: HTMLElement, duration: number): void {
  clearRemoval(toastEl);
  if (duration <= 0 || !isFinite(duration)) {
    return;
  }
  const timeoutId = window.setTimeout(() => {
    dismissToast(toastEl);
  }, duration);
  activeToasts.set(toastEl, timeoutId);
}

function clearRemoval(toastEl: HTMLElement): void {
  const timeoutId = activeToasts.get(toastEl);
  if (typeof timeoutId === "number") {
    clearTimeout(timeoutId);
  }
  activeToasts.delete(toastEl);
}

function cleanupContainer(): void {
  if (!container) return;
  if (!container.childElementCount) {
    container.remove();
    container = null;
  }
}

function dismissToast(toastEl: HTMLElement, reason: "default" | "swipe" = "default"): void {
  clearRemoval(toastEl);
  toastEl.classList.remove("qs-toast--enter", "qs-toast--swipe-exit");
  toastEl.classList.add(reason === "swipe" ? "qs-toast--swipe-exit" : "qs-toast--exit");

  let fallback: number | undefined;
  const remove = () => {
    toastEl.removeEventListener("transitionend", remove);
    toastEl.removeEventListener("animationend", remove);
    if (fallback !== undefined) {
      window.clearTimeout(fallback);
    }
    toastEl.remove();
    cleanupContainer();
  };
  toastEl.addEventListener("transitionend", remove);
  toastEl.addEventListener("animationend", remove);
  fallback = window.setTimeout(remove, 450);
  toastEl.setAttribute("aria-hidden", "true");
}

export function showToast(message: string | HTMLElement, options: ToastOptions = {}): ToastHandle {
  const { tone = "default", duration = 3600, dismissible, id } = options;
  const containerEl = ensureContainer();

  if (id) {
    const existing = Array.from(containerEl.children).find(el => el instanceof HTMLElement && el.dataset.toastId === id) as HTMLElement | undefined;
    if (existing) {
      existing.classList.remove("qs-toast--exit");
      existing.dataset.toastId = id;
      const bodyEl = existing.querySelector<HTMLElement>(".qs-toast-message");
      if (bodyEl) {
        const resolvedBody = resolveToastBody(message);
        setToastBodyContent(bodyEl, resolvedBody);
      }
      setToastDurationMetadata(existing, duration);
      scheduleRemoval(existing, duration);
      return {
        close: () => dismissToast(existing),
        element: existing,
      };
    }
  }

  const toastEl = document.createElement("div");
  toastEl.className = `qs-toast qs-toast--${tone}`;
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", tone === "danger" ? "assertive" : "polite");
  if (id) {
    toastEl.dataset.toastId = id;
  }

  const contentEl = document.createElement("div");
  contentEl.className = "qs-toast-content";

  const titleEl = document.createElement("div");
  titleEl.className = "qs-toast-title";
  titleEl.textContent = APP_NAME;

  const bodyEl = document.createElement("div");
  bodyEl.className = "qs-toast-message";
  const resolvedBody = resolveToastBody(message);
  setToastBodyContent(bodyEl, resolvedBody);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "qs-toast-close";
  closeBtn.setAttribute("aria-label", "Dismiss notification");
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", e => {
    e.preventDefault();
    dismissToast(toastEl);
  });

  const shouldBeDismissible = dismissible ?? !(duration > 0 && isFinite(duration));
  if (!shouldBeDismissible && duration > 0 && isFinite(duration)) {
    closeBtn.classList.add("qs-toast-close--hidden");
  }

  contentEl.appendChild(titleEl);
  contentEl.appendChild(bodyEl);
  toastEl.appendChild(contentEl);
  toastEl.appendChild(closeBtn);

  containerEl.appendChild(toastEl);

  // Force reflow for animation
  void toastEl.offsetWidth;
  toastEl.classList.add("qs-toast--enter");

  setToastDurationMetadata(toastEl, duration);
  scheduleRemoval(toastEl, duration);

  toastEl.addEventListener("mouseenter", () => {
    clearRemoval(toastEl);
  });
  toastEl.addEventListener("mouseleave", () => {
    const stored = getToastDurationFromMetadata(toastEl);
    if (stored) {
      scheduleRemoval(toastEl, stored);
    }
  });

  // Gesture support for swipe dismissal (mouse + touch)
  let startX = 0;
  let currentX = 0;
  let dragging = false;
  const threshold = 80;

  const onMove = (clientX: number) => {
    if (!dragging) return;
    currentX = clientX;
    const delta = currentX - startX;
    if (delta < 0) {
      const clamped = Math.max(delta, -200);
      toastEl.style.transform = `translateX(${clamped}px)`;
      toastEl.style.opacity = String(Math.max(0, 1 - Math.abs(clamped) / 160));
    } else {
      toastEl.style.transform = "translateX(0px)";
      toastEl.style.opacity = "1";
    }
  };

  const endDrag = (shouldDismiss: boolean) => {
    dragging = false;
    toastEl.classList.remove("qs-toast--dragging");
    toastEl.style.removeProperty("transition");
    toastEl.style.removeProperty("transform");
    toastEl.style.removeProperty("opacity");
    document.removeEventListener("mousemove", mouseMoveHandler);
    document.removeEventListener("mouseup", mouseUpHandler);
    document.removeEventListener("touchmove", touchMoveHandler);
    document.removeEventListener("touchend", touchEndHandler);
    document.removeEventListener("touchcancel", touchCancelHandler);

    if (shouldDismiss) {
      dismissToast(toastEl, "swipe");
    } else {
      toastEl.classList.add("qs-toast--enter");
      const stored = getToastDurationFromMetadata(toastEl);
      if (stored) {
        scheduleRemoval(toastEl, stored);
      }
    }
  };

  const cancelDrag = () => {
    if (dragging) {
      endDrag(false);
    }
  };

  const mouseMoveHandler = (event: MouseEvent) => {
    onMove(event.clientX);
    if (!dragging) return;
    event.preventDefault();
  };

  const mouseUpHandler = (event: MouseEvent) => {
    if (!dragging) return;
    const delta = event.clientX - startX;
    endDrag(delta <= -threshold);
  };

  const touchMoveHandler = (event: TouchEvent) => {
    if (!dragging) return;
    const touch = event.touches[0];
    if (!touch) return;
    onMove(touch.clientX);
    event.preventDefault();
  };

  const touchEndHandler = (event: TouchEvent) => {
    if (!dragging) return;
    const touch = event.changedTouches[0];
    if (!touch) {
      endDrag(false);
      return;
    }
    const delta = touch.clientX - startX;
    endDrag(delta <= -threshold);
  };

  const touchCancelHandler = () => {
    if (dragging) endDrag(false);
  };

  const beginDrag = (clientX: number) => {
    dragging = true;
    startX = clientX;
    currentX = clientX;
    toastEl.classList.add("qs-toast--dragging");
    clearRemoval(toastEl);
    toastEl.style.transition = "none";
  };

  toastEl.addEventListener("mousedown", event => {
    if (event.button !== 0) return;
    beginDrag(event.clientX);
    document.addEventListener("mousemove", mouseMoveHandler);
    document.addEventListener("mouseup", mouseUpHandler);
    window.addEventListener("blur", cancelDrag, { once: true });
  });

  toastEl.addEventListener("touchstart", event => {
    const touch = event.touches[0];
    if (!touch) return;
    beginDrag(touch.clientX);
    document.addEventListener("touchmove", touchMoveHandler, { passive: false });
    document.addEventListener("touchend", touchEndHandler);
    document.addEventListener("touchcancel", touchCancelHandler);
    window.addEventListener("blur", cancelDrag, { once: true });
  });

  return {
    close: () => dismissToast(toastEl),
    element: toastEl,
  };
}

export function showErrorToast(message: string, options: ToastOptions = {}): ToastHandle {
  return showToast(message, { tone: "danger", ...options });
}

export function showSuccessToast(message: string, options: ToastOptions = {}): ToastHandle {
  return showToast(message, { tone: "success", ...options });
}

export function showWarningToast(message: string, options: ToastOptions = {}): ToastHandle {
  return showToast(message, { tone: "warning", ...options });
}

export function dismissToastById(id: string): void {
  if (!container) return;
  Array.from(container.children).forEach(el => {
    if (el instanceof HTMLElement && el.dataset.toastId === id) {
      dismissToast(el);
    }
  });
}

