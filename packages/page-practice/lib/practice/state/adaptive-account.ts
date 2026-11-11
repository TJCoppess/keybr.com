import { keyboardProps } from "@keybr/keyboard";
import {
  adaptiveAccountStorageKey,
  AdaptivePractice,
  adaptiveSyncPath,
  parseAdaptiveHistory,
} from "@keybr/lesson";
import { type Settings } from "@keybr/settings";
import { loadAdaptivePractice } from "./adaptive-storage.ts";

/** Tells which exchange with the server has failed. */
export class AdaptiveSyncError extends Error {
  constructor(readonly action: "load" | "save") {
    super(`Cannot ${action} the adaptive history`);
    this.name = "AdaptiveSyncError";
  }
}

/** One account/layout per instance; queued writes cannot arrive out of order. */
export class AdaptiveAccount {
  readonly key: string;
  readonly url: string;
  readonly migrationKey: string;
  history = new AdaptivePractice();
  #pending: string | null = null;
  #queue = Promise.resolve();

  constructor(
    readonly settings: Settings,
    userId: string,
    readonly send: typeof fetch = (...args) => fetch(...args),
    readonly storage: Pick<Storage, "getItem" | "setItem"> = {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
  ) {
    const layout = settings.get(keyboardProps.layout).id;
    this.key = adaptiveAccountStorageKey(userId, layout);
    this.migrationKey = `keybr.adaptive.imported.v1.${layout}`;
    this.url = adaptiveSyncPath(layout);
  }

  async open() {
    let cached: { history?: string; pending?: boolean } = {};
    try {
      cached = JSON.parse(this.storage.getItem(this.key) ?? "{}");
    } catch {
      /* Optional cache. */
    }
    const response = await this.send(this.url);
    if (!response.ok) {
      throw new AdaptiveSyncError("load");
    }
    const remote = parseAdaptiveHistory(await response.json());
    if (cached?.pending && typeof cached.history === "string") {
      this.history = AdaptivePractice.restore(cached.history);
      this.#pending = JSON.stringify(this.history);
    } else if (remote != null) {
      this.history = AdaptivePractice.from(remote);
    } else {
      this.history =
        typeof cached?.history === "string"
          ? AdaptivePractice.restore(cached.history)
          : this.#legacy();
      this.#pending = JSON.stringify(this.history);
    }
    this.#cache();
    await this.flush();
    try {
      this.storage.setItem(this.migrationKey, this.key);
    } catch {
      /* Optional marker. */
    }
    return this;
  }

  load = () => this.history;

  save = (_settings: Settings, history: AdaptivePractice) => {
    this.history = history;
    this.#pending = JSON.stringify(history);
    this.#cache();
  };

  flush(): Promise<void> {
    this.#queue = this.#queue
      .catch(() => {})
      .then(async () => {
        const snapshot = this.#pending;
        if (snapshot == null) return;
        const response = await this.send(this.url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: snapshot,
        });
        if (!response.ok) {
          throw new AdaptiveSyncError("save");
        }
        if (this.#pending === snapshot) this.#pending = null;
        this.#cache();
      });
    return this.#queue;
  }

  #cache() {
    try {
      this.storage.setItem(
        this.key,
        JSON.stringify({
          history: JSON.stringify(this.history),
          pending: this.#pending != null,
        }),
      );
    } catch {
      /* The server remains authoritative when browser storage is unavailable. */
    }
  }

  #legacy() {
    try {
      const owner = this.storage.getItem(this.migrationKey);
      if (owner != null && owner !== this.key) return new AdaptivePractice();
    } catch {
      return new AdaptivePractice();
    }
    return AdaptivePractice.from(loadAdaptivePractice(this.settings).toJSON());
  }
}
