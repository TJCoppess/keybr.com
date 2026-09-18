import { equal, notEqual } from "node:assert/strict";
import { test } from "node:test";
import { keyboardProps, Layout } from "@keybr/keyboard";
import { AdaptivePractice } from "@keybr/lesson";
import { Settings } from "@keybr/settings";
import {
  loadAdaptivePractice,
  saveAdaptivePractice,
} from "./adaptive-storage.ts";

test("keep layout histories separate and preserve session history when storage fails", (t) => {
  const values = new Map<string, string>();
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  t.after(() => {
    if (descriptor) {
      Object.defineProperty(globalThis, "localStorage", descriptor);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
  const settings = new Settings().set(keyboardProps.layout, Layout.EN_US);
  const history = new AdaptivePractice();
  saveAdaptivePractice(settings, history);
  equal(values.size, 1);
  equal(loadAdaptivePractice(settings), history);
  const other = Layout.ALL.find((layout) => layout !== Layout.EN_US)!;
  notEqual(
    loadAdaptivePractice(settings.set(keyboardProps.layout, other)),
    history,
  );
  localStorage.setItem = () => {
    throw new Error("Storage full");
  };
  const next = new AdaptivePractice();
  saveAdaptivePractice(settings, next);
  equal(loadAdaptivePractice(settings), next);
});
