import { type Context } from "@fastr/core";
import { Env } from "@keybr/config";

/** Passwordless profiles are a loopback-only self-hosted option. */
export function localProfileEnabled(
  ctx: Context<any>,
  canonicalUrl: string,
): boolean {
  const isLoopbackAddress = (address?: string) =>
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address ?? "");

  const isLocalHost = (host: string) =>
    ["localhost", "127.0.0.1", "[::1]", "::1", "[::]", "::", "0.0.0.0"].includes(
      host,
    );

  const address = ctx.request.req.socket.remoteAddress;
  if (!isLoopbackAddress(address)) {
    return false;
  }

  const reqHost = new URL(ctx.request.origin).hostname;
  if (!isLocalHost(reqHost)) {
    return false;
  }

  const canonicalHost = new URL(canonicalUrl).hostname;
  const isLocalDeployment =
    isLocalHost(canonicalHost) || process.env.NODE_ENV !== "production";

  return Env.getBoolean("LOCAL_PROFILE_ENABLED", isLocalDeployment);
}
