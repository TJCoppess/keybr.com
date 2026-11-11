/** A typed character, the same as a step of the text input. */
export type LoggedStep = {
  readonly timeStamp: number;
  readonly codePoint: number;
  readonly timeToType: number;
  readonly typo: boolean;
};

/**
 * Every key typed in a completed lesson.
 *
 * Results keep only the mean time and the error count of each key,
 * which is not enough to learn anything new about the user later.
 * This log is kept in the browser and is never sent to the server.
 */
export type LoggedLesson = {
  readonly layout: string;
  readonly textType: string;
  readonly timeStamp: number;
  /**
   * Three numbers for each typed character: the code point of the expected
   * character, the time to type in milliseconds, and one for a typo
   * or zero for a clean hit.
   */
  readonly steps: readonly number[];
  /**
   * Two numbers for each mistake: the code point of the expected character,
   * and the code point of the character which was typed instead.
   */
  readonly confusions: readonly number[];
};

export function toLoggedLesson(
  layout: string,
  textType: string,
  timeStamp: number,
  steps: readonly Omit<LoggedStep, "timeStamp">[],
  confusions: readonly { readonly expected: number; readonly typed: number }[],
): LoggedLesson {
  return {
    layout,
    textType,
    timeStamp,
    steps: steps.flatMap(({ codePoint, timeToType, typo }) => [
      codePoint,
      Math.round(timeToType),
      Number(typo),
    ]),
    confusions: confusions.flatMap(({ expected, typed }) => [expected, typed]),
  };
}

/** Restores the steps of a logged lesson, with the time stamps accumulated. */
export function toSteps({ timeStamp, steps }: LoggedLesson): LoggedStep[] {
  const result: LoggedStep[] = [];
  let time = timeStamp;
  for (let i = 0; i + 2 < steps.length; i += 3) {
    time += steps[i + 1];
    result.push({
      timeStamp: time,
      codePoint: steps[i],
      timeToType: steps[i + 1],
      typo: steps[i + 2] !== 0,
    });
  }
  return result;
}

const storeName = "lessons";

/** A bounded log of typed lessons in the browser database. */
export class KeystrokeLog {
  readonly #factory: IDBFactory;
  readonly #name: string;
  readonly #limit: number;

  constructor(
    factory: IDBFactory,
    {
      name = "keybr-keystrokes",
      limit = 2000,
    }: { readonly name?: string; readonly limit?: number } = {},
  ) {
    this.#factory = factory;
    this.#name = name;
    this.#limit = limit;
  }

  /** Appends the given lesson, and deletes the oldest lessons over the limit. */
  async append(lesson: LoggedLesson): Promise<void> {
    await this.#run("readwrite", async (store) => {
      await request(store.add(lesson));
      let extra = (await request(store.count())) - this.#limit;
      if (extra > 0) {
        for (const key of await request(store.getAllKeys(null, extra))) {
          await request(store.delete(key));
          extra--;
        }
      }
    });
  }

  /** Returns all lessons from the oldest to the newest. */
  async read(): Promise<LoggedLesson[]> {
    return await this.#run("readonly", (store) => request(store.getAll()));
  }

  async count(): Promise<number> {
    return await this.#run("readonly", (store) => request(store.count()));
  }

  async clear(): Promise<void> {
    await this.#run("readwrite", (store) => request(store.clear()));
  }

  async #run<T>(
    mode: IDBTransactionMode,
    task: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const open = this.#factory.open(this.#name, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(storeName, { autoIncrement: true });
    };
    const db = await request(open);
    try {
      const tx = db.transaction(storeName, mode);
      const completed = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      const result = await task(tx.objectStore(storeName));
      await completed;
      return result;
    } finally {
      db.close();
    }
  }
}

function request<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Returns the log of this browser, or `null` if it has no database. */
export function openKeystrokeLog(): KeystrokeLog | null {
  try {
    return typeof indexedDB !== "undefined"
      ? new KeystrokeLog(indexedDB)
      : null;
  } catch {
    return null;
  }
}
