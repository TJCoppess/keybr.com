#!/usr/bin/env node

// Removes the compiled output of all packages, on any platform.

import { rmSync } from "node:fs";
import { join } from "node:path";
import { findPackages } from "./root.js";

for (const packageDirectory of findPackages()) {
  rmSync(join(packageDirectory, ".types"), { recursive: true, force: true });
}
