import { test } from "node:test";
import { Application } from "@fastr/core";
import { Settings, stringProp } from "@keybr/settings";
import { SettingsDatabase } from "@keybr/settings-database";
import { deepEqual, equal, like } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

const context = new TestContext();

test("adaptive history requires login and is isolated by account and layout", async () => {
  const request = startApp(context.get(Application, kMain));
  const path = "/_/sync/adaptive/en-colemak-dh";
  const history = {
    version: 1,
    lesson: 3,
    patterns: [
      {
        text: "th",
        samples: 4,
        time: 120,
        errors: 1,
        streak: 0,
        due: 4,
        dueAt: 1000,
      },
    ],
  };
  equal((await request.GET(path).send()).status, 403);
  equal((await request.PUT(path).send(history)).status, 403);
  await request.become("user1@keybr.com");
  equal((await request.PUT(path).send(history)).status, 204);
  deepEqual(await (await request.GET(path).send()).body.json(), history);
  deepEqual(
    await (await request.GET("/_/sync/adaptive/en-us").send()).body.json(),
    {},
  );
  await request.become("user2@keybr.com");
  deepEqual(await (await request.GET(path).send()).body.json(), {});
  equal(
    (await request.PUT(path).send({ version: 1, lesson: -1, patterns: [] }))
      .status,
    400,
  );
  await request.become("user1@keybr.com");
  deepEqual(await (await request.GET(path).send()).body.json(), history);
});

test("handle unauthenticated user", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  // Assert.

  equal((await request.GET("/_/sync/settings").send()).status, 403);
  equal((await request.PUT("/_/sync/settings").send({})).status, 403);
  equal((await request.DELETE("/_/sync/settings").send({})).status, 403);
});

test("get empty settings", async () => {
  // Arrange.

  const user = await findUser("user1@keybr.com");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  // Act.

  const response = await request.GET("/_/sync/settings").send();

  // Assert.

  equal(response.status, 200);
  equal(
    response.headers.get("Content-Type"),
    "application/json; charset=UTF-8",
  );
  equal(response.headers.get("Cache-Control"), "private, no-cache");
  deepEqual(await response.body.json(), {});
});

test("get existing settings", async () => {
  // Arrange.

  const user = await findUser("user1@keybr.com");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const database = context.get(SettingsDatabase);
  await database.set(
    user.id!,
    new Settings().set(stringProp("prop", "abc"), "abc"),
  );

  // Act.

  const response = await request.GET("/_/sync/settings").send();

  // Assert.

  equal(response.status, 200);
  equal(
    response.headers.get("Content-Type"),
    "application/json; charset=UTF-8",
  );
  equal(response.headers.get("Cache-Control"), "private, no-cache");
  like(await response.body.json(), {
    prop: "abc",
  });
});

test("validate content type on put settings", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));
  await request.become("user1@keybr.com");

  // Act.

  const response = await request
    .PUT("/_/sync/settings")
    .type("text/plain")
    .send("something");

  // Assert.

  equal(response.status, 415);
});

test("validate format on put settings", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));
  await request.become("user1@keybr.com");

  // Act.

  const response = await request
    .PUT("/_/sync/settings")
    .type("application/json")
    .send("garbage");

  // Assert.

  equal(response.status, 400);
});

test("handle put settings", async () => {
  // Arrange.

  const user = await findUser("user1@keybr.com");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const database = context.get(SettingsDatabase);
  await database.set(user.id!, null);

  // Act.

  const response = await request
    .PUT("/_/sync/settings")
    .send(new Settings().set(stringProp("prop", "abc"), "abc").toJSON());

  // Assert.

  equal(response.status, 204);
  like((await database.get(user.id!))?.toJSON(), {
    prop: "abc",
  });
});

test("handle delete settings", async () => {
  // Arrange.

  const user = await findUser("user1@keybr.com");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const database = context.get(SettingsDatabase);
  await database.set(
    user.id!,
    new Settings().set(stringProp("prop", "abc"), "abc"),
  );

  // Act.

  const response = await request.DELETE("/_/sync/settings").send();

  // Assert.

  equal(response.status, 204);
  equal(await database.get(user.id!), null);
});
