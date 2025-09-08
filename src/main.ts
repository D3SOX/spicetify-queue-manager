import { Settings } from "./types";
import { loadSettings, saveSettings } from "./storage";
import { openManagerModal, UIHandlers } from "./ui";
import { createAutoManager } from "./auto";
import { APP_NAME } from "./appInfo";

async function main() {
  while (!Spicetify?.showNotification || !Spicetify?.CosmosAsync || !Spicetify?.LocalStorage) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  let settings: Settings = loadSettings();

  const autoMgr = createAutoManager(() => settings);
  autoMgr.primeFromExisting();
  autoMgr.applyAutoMode(settings);

  const uiHandlers: UIHandlers = {
    pruneAutosToMax: autoMgr.pruneAutosToMax,
    getSettings: () => settings,
    setSettings: (s: Settings) => {
      settings = s;
      saveSettings(s);
      autoMgr.applyAutoMode(s);
    },
  };

  const icon = "queue";

  try {
    if (Spicetify?.Topbar?.Button) {
      new Spicetify.Topbar.Button(APP_NAME, icon, () => openManagerModal(uiHandlers), undefined, true);
    }
  } catch {
    console.error(`${APP_NAME}: failed to add topbar button`);
  }

  try {
    const shouldAdd: Spicetify.ContextMenu.ShouldAddCallback = (_uris: string[], _uids?: string[], contextUri?: string) => {
      try {
        if (contextUri) {
          const ctx = Spicetify.URI.fromString(contextUri);
          if (ctx?.type === Spicetify.URI.Type.QUEUE) return true;
          if (contextUri.includes(":queue")) return true;
        }
        const path = Spicetify.Platform?.History?.location?.pathname || "";
        return path.includes("queue");
      } catch {}
      return false;
    };

    const item = new Spicetify.ContextMenu.Item(
      APP_NAME,
      () => openManagerModal(uiHandlers),
      shouldAdd,
      icon
    );
    item.register();
  } catch {
    console.error(`${APP_NAME}: failed to add context menu item`);
  }

  try {
    Spicetify.Keyboard.registerShortcut({
      key: "q",
      ctrl: true,
      alt: true,
    }, () => openManagerModal(uiHandlers));
  } catch {
    console.error(`${APP_NAME}: failed to add keyboard shortcut`);
  }
}

export default main; 