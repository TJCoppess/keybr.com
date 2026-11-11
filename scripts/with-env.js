#!/usr/bin/env node

// Runs a command with the given environment variables, on any platform.
// The POSIX `env NAME=value command` does not exist in the Windows shell.
//
// Usage: node scripts/with-env.js NAME=value... command [arg...]

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const env = { ...process.env };
while (args.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(args[0])) {
  const arg = args.shift();
  const index = arg.indexOf("=");
  env[arg.substring(0, index)] = arg.substring(index + 1);
}
if (args.length === 0) {
  console.error("Usage: with-env.js NAME=value... command [arg...]");
  process.exit(2);
}

// The shell finds the commands installed by npm, which on Windows are
// batch files and cannot be spawned directly.
const child = spawn(args.map(quote).join(" "), {
  env,
  stdio: "inherit",
  shell: true,
});
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  process.exit(code ?? (signal != null ? 1 : 0));
});

function quote(arg) {
  return /^[A-Za-z0-9_./:=@-]+$/.test(arg) ? arg : `"${arg}"`;
}
