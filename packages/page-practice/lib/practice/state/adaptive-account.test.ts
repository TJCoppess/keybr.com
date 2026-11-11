import { deepStrictEqual, equal, rejects } from "node:assert/strict";
import { test } from "node:test";
import { Settings } from "@keybr/settings";
import { AdaptiveAccount } from "./adaptive-account.ts";

function storage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

test("restore account history in a fresh browser and retry a failed backup after reload", async () => {
  let server = { version: 1, lesson: 2, patterns: [] };
  let fail = false;
  const send: typeof fetch = async (_url, options) => {
    if (options?.method === "PUT") {
      if (fail) return new Response(null, { status: 503 });
      server = JSON.parse(String(options.body));
      return new Response(null, { status: 204 });
    }
    return Response.json(server);
  };
  const cache = storage();
  const account = await new AdaptiveAccount(
    new Settings(),
    "user1",
    send,
    cache,
  ).open();
  equal(account.history.toJSON().lesson, 2);
  account.history.record([], 200);
  account.save(new Settings(), account.history);
  fail = true;
  await rejects(account.flush());
  equal(server.lesson, 2);
  fail = false;
  await new AdaptiveAccount(new Settings(), "user1", send, cache).open();
  equal(server.lesson, 3);
  const fresh = await new AdaptiveAccount(
    new Settings(),
    "user1",
    send,
    storage(),
  ).open();
  deepStrictEqual(fresh.history.toJSON(), server);
});

test("account cache keys differ and a failed load does not overwrite server data", async () => {
  let writes = 0;
  const send: typeof fetch = async (_url, options) => {
    if (options?.method === "PUT") writes++;
    return new Response(null, { status: 503 });
  };
  const first = new AdaptiveAccount(new Settings(), "user1", send, storage());
  const second = new AdaptiveAccount(new Settings(), "user2", send, storage());
  equal(first.key === second.key, false);
  await rejects(first.open());
  equal(writes, 0);
});
