import { type Layout } from "@keybr/keyboard";
import { type AdaptivePattern, AdaptivePractice } from "@keybr/lesson";
import { usePageData } from "@keybr/pages-shared";
import { useEffect, useState } from "react";

function readLocalHistory(layoutId: string, userId?: string | null): AdaptivePractice {
  try {
    if (typeof localStorage === "undefined") {
      return new AdaptivePractice();
    }
    if (userId != null) {
      const accountRaw = localStorage.getItem(
        `keybr.adaptive.account.v1.${userId}.${layoutId}`,
      );
      if (accountRaw != null) {
        const parsed = JSON.parse(accountRaw);
        if (typeof parsed?.history === "string") {
          return AdaptivePractice.restore(parsed.history);
        }
      }
    }
    const guestRaw = localStorage.getItem(`keybr.adaptive.v1.${layoutId}`);
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
    fetch(`/_/sync/adaptive/${encodeURIComponent(layoutId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((remote) => {
        if (active && remote?.version === 1) {
          setHistory(AdaptivePractice.restore(JSON.stringify(remote)));
        }
      })
      .catch(() => {
        // Fall back cleanly to local history on network error or offline
      });

    return () => {
      active = false;
    };
  }, [layoutId, userId]);

  const allPatterns = history.patterns;
  const combinationPatterns = allPatterns.filter(
    (p) => p.text.length >= 2 && p.text.length <= 3,
  );

  return {
    history,
    currentLesson: history.lesson,
    allPatterns,
    combinationPatterns,
  };
}
