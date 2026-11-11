import { type Layout } from "@keybr/keyboard";
import {
  adaptiveAccountStorageKey,
  AdaptivePractice,
  adaptiveStorageKey,
  adaptiveSyncPath,
  parseAdaptiveHistory,
} from "@keybr/lesson";
import { usePageData } from "@keybr/pages-shared";
import { useEffect, useState } from "react";

function readLocalHistory(
  layoutId: string,
  userId?: string | null,
): AdaptivePractice {
  try {
    if (typeof localStorage === "undefined") {
      return new AdaptivePractice();
    }
    if (userId != null) {
      const accountRaw = localStorage.getItem(
        adaptiveAccountStorageKey(userId, layoutId),
      );
      if (accountRaw != null) {
        const parsed = JSON.parse(accountRaw);
        if (typeof parsed?.history === "string") {
          return AdaptivePractice.restore(parsed.history);
        }
      }
    }
    const guestRaw = localStorage.getItem(adaptiveStorageKey(layoutId));
    if (guestRaw != null) {
      return AdaptivePractice.restore(guestRaw);
    }
  } catch {
    // Ignore storage errors
  }
  return new AdaptivePractice();
}

export function useAdaptivePatterns(layout: Layout) {
  const { publicUser } = usePageData();
  const userId = publicUser?.id;
  const layoutId = layout.id;

  const [history, setHistory] = useState<AdaptivePractice>(() =>
    readLocalHistory(layoutId, userId),
  );

  useEffect(() => {
    setHistory(readLocalHistory(layoutId, userId));
    if (userId == null || typeof fetch === "undefined") return;

    let active = true;
    fetch(adaptiveSyncPath(layoutId))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const remote = parseAdaptiveHistory(data);
        if (active && remote != null) {
          setHistory(AdaptivePractice.from(remote));
        }
      })
      .catch(() => {
        // Fall back cleanly to local history on network error or offline
      });

    return () => {
      active = false;
    };
  }, [layoutId, userId]);

  return {
    history,
    currentLesson: history.lesson,
    combinationPatterns: history.patterns,
    wordPatterns: history.words,
    confusions: history.confusions,
  };
}
