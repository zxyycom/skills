import { repoRoot } from "./environment-command.js";
import {
  globalPrerequisiteRecovery,
  unreadyGlobalPrerequisites
} from "./environment-status.js";

function printStatusLine(label, status) {
  if (status.state === "ready") {
    console.log(`[ok]       ${label} - ${status.detail}`);
  } else {
    console.log(`[${status.state}] ${label} - ${status.detail}`);
  }
}

export function printEnvironmentStatus(status) {
  console.log(`Project environment: ${repoRoot}`);
  for (const tool of status.tools) {
    if (tool.state === "ready") {
      console.log(`[ok]       ${tool.name} ${tool.version.text}`);
    } else {
      const version = tool.version ? ` ${tool.version.text}` : "";
      console.log(`[${tool.state}] ${tool.name}${version} - ${tool.detail}`);
    }
  }

  printStatusLine("project dependencies", status.dependencies);
  if (status.astGrep.state === "not-applicable") {
    console.log(`[not-applicable] project ast-grep - ${status.astGrep.detail}`);
  } else {
    printStatusLine("project ast-grep", status.astGrep);
  }
  printStatusLine("codegraph index", status.codegraphIndex);
  printStatusLine("repository setup", status.repository);

  if (status.ready) {
    console.log("Environment is ready.");
    return;
  }
  const unreadyTools = unreadyGlobalPrerequisites(status.tools);
  if (unreadyTools.length > 0) {
    console.log(
      "The following global prerequisites are not installed by this script:"
    );
    for (const tool of unreadyTools) {
      console.log(`- ${tool.name}: ${globalPrerequisiteRecovery(tool)}`);
    }
    console.log(
      "Environment is not ready. Restore them, then run: " +
        "node scripts/environment.js setup"
    );
  } else {
    console.log(
      "Environment is not ready. Run: node scripts/environment.js setup"
    );
  }
}
