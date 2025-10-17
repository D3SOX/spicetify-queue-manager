export type TranslationKeys = {
  ui: {
    buttons: {
      save: string;
      cancel: string;
      confirm: string;
      delete: string;
      export: string;
      import: string;
      refresh: string;
      view: string;
      hide: string;
      rename: string;
      resetName: string;
      clearAll: string;
      exportAll: string;
      saveNow: string;
      replaceQueue: string;
      appendToQueue: string;
      exportToPlaylist: string;
      exportSettings: string;
      importSnapshots: string;
      importSettings: string;
    };
    labels: {
      snapshotName: string;
      toggleItems: string;
      replaceQueue: string;
      appendQueue: string;
      exportToPlaylist: string;
      renameSnapshot: string;
      resetName: string;
      deleteSnapshot: string;
      exportSettings: string;
      importSnapshots: string;
      importSettings: string;
      exportAllManuals: string;
      exportAllAutos: string;
      clearAllAutos: string;
      saveNewManual: string;
    };
    sections: {
      manualSnapshots: string;
      manualSnapshotsCaption: string;
      automaticSnapshots: string;
      automaticSnapshotsCaption: string;
      settings: string;
      settingsCaption: string;
    };
    empty: {
      noManualSnapshots: string;
      noAutomaticSnapshots: string;
      noSnapshots: string;
    };
    itemSingular: string;
    itemPlural: string;
    includesLocal: string;
    loading: string;
    failedToLoadItems: string;
  };
  snapshots: {
    types: {
      auto: string;
      manual: string;
    };
    actions: {
      exporting: string;
      appending: string;
      replacing: string;
    };
  };
  settings: {
    autoEnabled: string;
    autoMode: string;
    timeBased: string;
    queueChanges: string;
    experimental: string;
    experimentalTooltip: string;
    onlyNewItems: string;
    onlyNewItemsDescription: string;
    equalQueuesNote: string;
    queueWarnEnabled: string;
    queueWarnDescription: string;
    promptManualBeforeReplace: string;
    promptManualDescription: string;
    interval: string;
    intervalDescription: string;
    maxAutomaticSnapshots: string;
    maxAutomaticDescription: string;
    queueMaxSize: string;
    queueWarnThreshold: string;
  };
  toasts: {
    snapshotSaved: string;
    snapshotDeleted: string;
    clearedAutomaticSnapshots: string;
    exportedToPlaylist: string;
    addedToQueue: string;
    queueReplaced: string;
    settingsImported: string;
    snapshotsImported: string;
    noQueueFound: string;
    nothingToExport: string;
    snapshotEmpty: string;
    allItemsAlreadyInQueue: string;
    failedToSaveSnapshot: string;
    failedToExport: string;
    failedToAppend: string;
    failedToReplace: string;
    failedToStartPlayback: string;
    failedToSaveAutomatic: string;
    failedToStartQueueWatcher: string;
    failedToStartCapacityWatcher: string;
    queueNearlyFull: string;
    nameCannotBeEmpty: string;
    nameMustDifferFromDefault: string;
    noAutomaticSnapshotsToClear: string;
    someImportedSnapshotsInvalid: string;
    noValidSnapshotsToImport: string;
    allSnapshotsAlreadyExist: string;
    invalidSettingsFile: string;
    exportResult: string;
    appendResult: string;
    replaceResult: string;
    exportCanceled: string;
    exportedToDownloads: string;
    failedToExportJson: string;
    importCanceled: string;
    failedToImportJson: string;
  };
  dialogs: {
    saveSnapshot: {
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
    };
    deleteSnapshot: {
      title: string;
      message: string;
      confirmLabel: string;
    };
    clearAutomaticSnapshots: {
      title: string;
      message: string;
      confirmLabel: string;
    };
    saveCurrentQueue: {
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
      extraLabel: string;
    };
    importSettings: {
      title: string;
      message: string;
      confirmLabel: string;
    };
  };
  errors: {
    failedToAddTopbarButton: string;
    failedToAddContextMenuItem: string;
    failedToAddKeyboardShortcut: string;
  };
};

export type TranslationParams = Record<string, string | number>;

// Single source of truth for supported languages
export const SUPPORTED_LOCALES = ['en', 'de', 'es', 'fr'] as const;

export type Locale = typeof SUPPORTED_LOCALES[number];

function getCurrentLocale(): Locale {
  try {
    const locale = Spicetify?.Platform?.Session?.locale;
    // Check if the detected locale is in our supported locales
    if (SUPPORTED_LOCALES.includes(locale as Locale)) {
      return locale as Locale;
    }
    return 'en'; // Default fallback
  } catch {
    return 'en'; // Fallback on error
  }
}

// Helper type to convert nested object keys to dot notation
type DotNotation<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, any>
    ? `${K}.${DotNotation<T[K]>}`
    : K
  : never;

export type TranslationKey = DotNotation<TranslationKeys>;

export type TranslationFunction = (
  key: TranslationKey,
  params?: TranslationParams
) => string;


import { en } from './locales/en';
import { de } from './locales/de';
import { es } from './locales/es';
import { fr } from './locales/fr';

const locales: Record<Locale, TranslationKeys> = {
  en,
  de,
  es,
  fr,
} as const;


let currentLocale: Locale = getCurrentLocale();

export function t(
  key: TranslationKey,
  params?: TranslationParams
): string {
  const translation = getNestedValue(locales[currentLocale], key);
  
  if (typeof translation !== 'string') {
    console.warn(`Translation missing for key: ${key} in locale: ${currentLocale}`);
    return String(key);
  }
  
  if (!params) {
    return translation;
  }
  
  // Simple interpolation using template syntax
  return translation.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
    return String(params[paramKey] || match);
  });
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

// Initialize locale
currentLocale = getCurrentLocale();
