// src/utils/settings-store.js — Settings persistence independent of game saves.
// Previously settings only persisted via the in-game autosave, so changes
// made from the menu (no active game) were lost on reload.

const KEY = 'governed_settings';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[GOVERNED] Settings save failed:', e);
  }
}
