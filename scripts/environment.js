#!/usr/bin/env node

import { errorMessage } from "./environment-command.js";
import { parseAction, readEnvironmentConfig } from "./environment-config.js";
import { printEnvironmentStatus } from "./environment-output.js";
import { setupEnvironment } from "./environment-setup.js";
import { getEnvironmentStatus } from "./environment-status.js";

try {
  const action = parseAction(process.argv.slice(2));
  const config = readEnvironmentConfig();
  if (action === "setup") {
    setupEnvironment(config);
  } else {
    const status = getEnvironmentStatus(config);
    printEnvironmentStatus(status);
    if (!status.ready) process.exitCode = 1;
  }
} catch (error) {
  console.error(`project environment failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
