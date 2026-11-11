import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { BadRequestError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { DataDir } from "@keybr/config";
import { Settings } from "@keybr/settings";
import { SettingsDatabase } from "@keybr/settings-database";
import { type AuthState } from "../auth/index.ts";

@injectable()
@controller()
export class Controller {
  constructor(readonly database: SettingsDatabase) {}

  @http.GET("/_/sync/adaptive/{layout:[a-z0-9-]+}")
  async getAdaptive(
    ctx: Context<RouterState & AuthState>,
    @pathParam("layout") layout: string,
  ) {
    const user = ctx.state.requireUser();
    ctx.response.body =
      (await this.adaptiveDatabase(layout).get(user.id!))?.toJSON() ?? {};
    ctx.response.headers.set("Cache-Control", "private, no-cache");
  }

  @http.PUT("/_/sync/adaptive/{layout:[a-z0-9-]+}")
  async putAdaptive(
    ctx: Context<RouterState & AuthState>,
    @pathParam("layout") layout: string,
    @body.json(null, { maxLength: 262144 }) value: any,
  ) {
    const user = ctx.state.requireUser();
    if (
      value?.version !== 1 ||
      !Number.isSafeInteger(value.lesson) ||
      value.lesson < 0 ||
      !Array.isArray(value.patterns) ||
      value.patterns.length > 1000 ||
      !value.patterns.every(
        (p: any) =>
          p != null &&
          typeof p.text === "string" &&
          /^\p{L}{1,3}$/u.test(p.text) &&
          [p.samples, p.time, p.errors, p.streak, p.due, p.dueAt].every(
            (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
          ),
      )
    ) {
      throw new BadRequestError("Invalid adaptive history");
    }
    const patterns = value.patterns.map(
      ({ text, samples, time, errors, streak, due, dueAt }: any) => ({
        text,
        samples,
        time,
        errors,
        streak,
        due,
        dueAt,
      }),
    );
    await this.adaptiveDatabase(layout).set(
      user.id!,
      new Settings({ version: 1, lesson: value.lesson, patterns }),
    );
    ctx.response.status = 204;
  }

  private adaptiveDatabase(layout: string) {
    if (!/^[a-z0-9-]{1,80}$/.test(layout)) {
      throw new BadRequestError("Invalid layout");
    }
    return new SettingsDatabase(
      new DataDir(this.database.dataDir.dataPath("adaptive", layout)),
    );
  }

  @http.GET("/_/sync/settings")
  async getSettings(ctx: Context<RouterState & AuthState>) {
    const user = ctx.state.requireUser();
    ctx.response.body = (await this.database.get(user.id!))?.toJSON() ?? {};
    ctx.response.headers.set("Cache-Control", "private, no-cache");
  }

  @http.PUT("/_/sync/settings")
  async putSettings(
    ctx: Context<RouterState & AuthState>,
    @body.json(null, { maxLength: 65536 }) value: unknown,
  ) {
    const user = ctx.state.requireUser();
    await this.database.set(user.id!, new Settings(value as any));
    ctx.response.status = 204;
  }

  @http.DELETE("/_/sync/settings")
  async deleteSettings(ctx: Context<RouterState & AuthState>) {
    const user = ctx.state.requireUser();
    await this.database.set(user.id!, null);
    ctx.response.status = 204;
  }
}
