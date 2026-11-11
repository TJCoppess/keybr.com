import { spawn } from "node:child_process";

/**
 * Runs Node.js with the TypeScript loader and the given arguments.
 *
 * @param {readonly string[]} args
 * @param {Record<string, string>} env
 */
export function run(args, env = {}) {
  const child = spawn(
    process.execPath,
    ["--enable-source-maps", "--import", "@keybr/tsl", ...args.map(unquote)],
    { env: { ...process.env, ...env }, stdio: "inherit" },
  );
  child.on("error", (err) => {
    console.error(err);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    process.exit(code ?? (signal != null ? 1 : 0));
  });
}

/**
 * Package scripts quote glob patterns with single quotes to keep the POSIX
 * shell from expanding them. The Windows shell passes these quotes through.
 *
 * @param {string} arg
 * @return {string}
 */
function unquote(arg) {
  return arg.length >= 2 && arg.startsWith("'") && arg.endsWith("'")
    ? arg.substring(1, arg.length - 1)
    : arg;
}
