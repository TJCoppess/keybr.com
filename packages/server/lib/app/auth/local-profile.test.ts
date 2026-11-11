import { afterEach,test } from "node:test";
import { Application, type Context } from "@fastr/core";
import { User } from "@keybr/database";
import { equal } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { localProfileEnabled } from "./local-profile.ts";

const context = new TestContext();
context.bind("canonicalUrl").toValue("http://localhost:3000/");
afterEach(() => {
  delete process.env.LOCAL_PROFILE_ENABLED;
});

test("local profile can be explicitly disabled and enforces same-origin request", async () => {
  process.env.LOCAL_PROFILE_ENABLED = "false";
  const request = startApp(context.get(Application, kMain));
  equal(
    (
      await request
        .POST("/auth/login/local")
        .header("Origin", "http://localhost:3000")
        .send()
    ).status,
    403,
  );
  delete process.env.LOCAL_PROFILE_ENABLED;
  equal(
    (
      await request
        .POST("/auth/login/local")
        .header("Origin", "https://example.com")
        .send()
    ).status,
    403,
  );
  equal((await request.POST("/auth/login/local").send()).status, 403);
  equal(await request.who(), null);
});

test("local login reuses the same persistent profile after logout", async () => {
  process.env.LOCAL_PROFILE_ENABLED = "true";
  const request = startApp(context.get(Application, kMain));
  const login = () =>
    request
      .POST("/auth/login/local")
      .header("Origin", "http://localhost:3000")
      .send();
  equal((await login()).status, 303);
  equal(await request.who(), "user@localhost");
  const id = (await User.findByEmail("user@localhost"))!.id;
  await request.become(null);
  equal((await login()).status, 303);
  equal((await User.findByEmail("user@localhost"))!.id, id);
});

test("local profile rejects remote connections and public deployments", () => {
  process.env.LOCAL_PROFILE_ENABLED = "true";
  const ctx = (origin: string, remoteAddress: string) =>
    ({ request: { origin, req: { socket: { remoteAddress } } } }) as Context;
  equal(
    localProfileEnabled(
      ctx("http://localhost:3000", "192.168.1.5"),
      "http://localhost:3000",
    ),
    false,
  );
  equal(
    localProfileEnabled(
      ctx("https://example.com", "127.0.0.1"),
      "https://example.com",
    ),
    false,
  );
  equal(
    localProfileEnabled(
      ctx("http://evil.example", "127.0.0.1"),
      "http://localhost:3000",
    ),
    false,
  );
});
