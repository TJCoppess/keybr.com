import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { BadRequestError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { parseAdaptiveHistory } from "@keybr/lesson/lib/adaptive-history.ts";
import { Settings } from "@keybr/settings";
import { SettingsDatabase } from "@keybr/settings-database";
import { type AuthState } from "../auth/index.ts";
import { AdaptiveStore } from "./adaptive-store.ts";

@injectable()
@controller()
export class Controller {
  constructor(
    readonly database: SettingsDatabase,
    readonly adaptive: AdaptiveStore,
  ) {}

  @http.GET("/_/sync/adaptive/{layout:[a-z0-9-]+}")
  async getAdaptive(
    ctx: Context<RouterState & AuthState>,
    @pathParam("layout") layout: string,
  ) {
    const user = ctx.state.requireUser();
    checkLayout(layout);
    ctx.response.body = (await this.adaptive.get(user.id!, layout)) ?? {};
    ctx.response.headers.set("Cache-Control", "private, no-cache");
  }

  @http.PUT("/_/sync/adaptive/{layout:[a-z0-9-]+}")
  async putAdaptive(
    ctx: Context<RouterState & AuthState>,
    @pathParam("layout") layout: string,
    @body.json(null, { maxLength: 262144 }) value: unknown,
  ) {
    const user = ctx.state.requireUser();
    checkLayout(layout);
    const history = parseAdaptiveHistory(value);
    if (history == null) {
      throw new BadRequestError("Invalid adaptive history");
    }
    await this.adaptive.set(user.id!, layout, history);
    ctx.response.status = 204;
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

/** The layout id is a part of a file path. */
function checkLayout(layout: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(layout)) {
    throw new BadRequestError("Invalid layout");
  }
}
