import { injectable } from "@fastr/invert";
import { DataDir } from "@keybr/config";
import {
  type AdaptiveHistory,
  parseAdaptiveHistory,
} from "@keybr/lesson/lib/adaptive-history.ts";
import { File } from "@sosimple/fsx-file";
import { LockFile } from "@sosimple/fsx-lockfile";
import { exponentialDelay } from "@sosimple/retry";

const lockOptions = { retryLimit: 5, delayer: exponentialDelay(10) };

/** Keeps the adaptive practice history of each user and keyboard layout. */
@injectable()
export class AdaptiveStore {
  constructor(readonly dataDir: DataDir) {}

  async get(userId: number, layoutId: string): Promise<AdaptiveHistory | null> {
    const file = this.#getFile(userId, layoutId);
    return await LockFile.withLock(file, lockOptions, async (lock) => {
      try {
        return parseAdaptiveHistory(await file.readJson());
      } catch (err: any) {
        if (err.code === "ENOENT") {
          return null;
        } else {
          throw err;
        }
      } finally {
        await lock.rollback();
      }
    });
  }

  async set(
    userId: number,
    layoutId: string,
    history: AdaptiveHistory,
  ): Promise<void> {
    const file = this.#getFile(userId, layoutId);
    await LockFile.withLock(file, lockOptions, async (lock) => {
      await lock.writeFile(JSON.stringify(history));
      await lock.commit();
    });
  }

  #getFile(userId: number, layoutId: string) {
    return new File(this.dataDir.userAdaptiveFile(userId, layoutId));
  }
}
