import { keyboardProps } from "@keybr/keyboard";
import { AdaptivePractice } from "@keybr/lesson";
import { type Settings } from "@keybr/settings";

const memory = new Map<string, AdaptivePractice>();
const keyOf = (settings: Settings) =>
  `keybr.adaptive.v1.${settings.get(keyboardProps.layout).id}`;

export function loadAdaptivePractice(settings: Settings): AdaptivePractice {
  const key = keyOf(settings);
  const current = memory.get(key);
  if (current != null) {
    return current;
  }
  try {
    const saved = localStorage.getItem(key);
    if (saved != null) {
      const history = AdaptivePractice.restore(saved);
      memory.set(key, history);
      return history;
    }
  } catch {
    // Practice also works with browser storage disabled.
  }
  return memory.get(key) ?? new AdaptivePractice();
}

export function saveAdaptivePractice(
  settings: Settings,
  history: AdaptivePractice,
) {
  const key = keyOf(settings);
  memory.set(key, history);
  try {
    localStorage.setItem(key, JSON.stringify(history));
  } catch {
    // Retain this session's learning when storage is unavailable or full.
  }
}
