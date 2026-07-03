import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { rootDir } from "./lib/project.ts";

function setHooksPath(cwd: string): void {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd,
    stdio: "inherit"
  });
}

async function makePreCommitExecutable(cwd: string): Promise<void> {
  await fs.chmod(path.join(cwd, ".githooks", "pre-commit"), 0o755);
}

await makePreCommitExecutable(rootDir);
setHooksPath(rootDir);
console.log("Configured root repository hooksPath: .githooks");
