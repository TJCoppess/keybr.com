import { test } from "node:test";
import { FakeIntlProvider } from "@keybr/intl";
import { Layout } from "@keybr/keyboard";
import { PageDataContext } from "@keybr/pages-shared";
import { FakeSettingsContext } from "@keybr/settings";
import { render } from "@testing-library/react";
import { equal, isNotNull, ok } from "rich-assert";
import { KeyCombosSection } from "./KeyCombosSection.tsx";

test("renders empty state when no adaptive pattern data exists", async () => {
  const layout = Layout.ALL.get("en-us")!;
  const r = render(
    <FakeIntlProvider>
      <PageDataContext.Provider
        value={{ publicUser: { id: "test-user" } } as any}
      >
        <FakeSettingsContext>
          <KeyCombosSection layout={layout} />
        </FakeSettingsContext>
      </PageDataContext.Provider>
    </FakeIntlProvider>,
  );

  isNotNull(await r.findByText("Key Combinations"));
  isNotNull(
    await r.findByText(
      /No letter combination data recorded yet for this layout/,
    ),
  );

  r.unmount();
});

test("renders 2- and 3-letter combination stats when adaptive history is present", async () => {
  const layout = Layout.ALL.get("en-us")!;
  const mockHistory = {
    version: 1,
    lesson: 12,
    patterns: [
      {
        text: "th",
        samples: 45,
        time: 150,
        errors: 1,
        streak: 4,
        due: 20,
        dueAt: Date.now() + 86400000,
      },
      {
        text: "ing",
        samples: 30,
        time: 120,
        errors: 0,
        streak: 6,
        due: 35,
        dueAt: Date.now() + 86400000 * 5,
      },
      {
        text: "er",
        samples: 25,
        time: 250,
        errors: 3,
        streak: 0,
        due: 13,
        dueAt: Date.now() - 1000,
      },
      // Single character pattern (should be filtered out from combo view)
      {
        text: "e",
        samples: 100,
        time: 100,
        errors: 0,
        streak: 6,
        due: 50,
        dueAt: Date.now() + 86400000 * 10,
      },
    ],
  };

  const key = `keybr.adaptive.account.v1.user-123.${layout.id}`;
  localStorage.setItem(
    key,
    JSON.stringify({
      history: JSON.stringify(mockHistory),
      pending: false,
    }),
  );

  const r = render(
    <FakeIntlProvider>
      <PageDataContext.Provider
        value={{ publicUser: { id: "user-123" } } as any}
      >
        <FakeSettingsContext>
          <KeyCombosSection layout={layout} />
        </FakeSettingsContext>
      </PageDataContext.Provider>
    </FakeIntlProvider>,
  );

  isNotNull(await r.findByText("Key Combinations"));
  // Verify 2- and 3-letter combo badges are present
  isNotNull(await r.findByText("th"));
  isNotNull(await r.findByText("ing"));
  isNotNull(await r.findByText("er"));

  // Check mastery / review badges
  const masteredBadges = await r.findAllByText("Mastered");
  ok(masteredBadges.length >= 1);
  isNotNull(await r.findByText("Due now"));

  // Summary labels
  isNotNull(await r.findByText("Combinations"));
  isNotNull(await r.findByText("Average Speed"));
  isNotNull(await r.findByText("Needs Review"));

  localStorage.removeItem(key);
  r.unmount();
});

test("shows the accuracy over all recorded samples", async () => {
  const layout = Layout.ALL.get("en-us")!;
  const pattern = {
    time: 150,
    streak: 2,
    due: 20,
    dueAt: Date.now() + 86400000,
  };
  const key = `keybr.adaptive.v1.${layout.id}`;
  localStorage.setItem(
    key,
    JSON.stringify({
      version: 2,
      lesson: 12,
      patterns: [
        { ...pattern, text: "th", samples: 60, errors: 15, errorRate: 0.5 },
        { ...pattern, text: "he", samples: 40, errors: 10, errorRate: 0 },
      ],
    }),
  );

  const r = render(
    <FakeIntlProvider>
      <PageDataContext.Provider value={{ publicUser: { id: null } } as any}>
        <FakeSettingsContext>
          <KeyCombosSection layout={layout} />
        </FakeSettingsContext>
      </PageDataContext.Provider>
    </FakeIntlProvider>,
  );

  // 25 errors in 100 samples.
  isNotNull(await r.findByText(/^75(\.0+)?\s?%$/));
  equal((await r.findAllByTitle("Mastery streak: 2 of 6")).length, 2);

  localStorage.removeItem(key);
  r.unmount();
});
