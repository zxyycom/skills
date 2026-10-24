import { access, realpath } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { repoRoot, resolveCommandExecution } from "./environment-command.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  if (
    args.length !== 2 ||
    args[0] !== "--artifact" ||
    !path.isAbsolute(args[1])
  ) {
    throw new Error(
      "Usage: bun run accept:video-windows -- --artifact <absolute-video-understanding.zip>"
    );
  }
  if (process.platform !== "win32")
    throw new Error("Windows video acceptance requires a Windows host");
  const artifact = await realpath(args[1]);
  await access(artifact);
  for (const script of [
    "test:video-understanding-cli",
    "test:video-artifact"
  ]) {
    console.log(`Windows video acceptance: ${script}; artifact=${artifact}`);
    const command = resolveCommandExecution("bun", ["run", script]);
    if (!command) throw new Error("bun was not found on PATH");
    const result = spawnSync(command.executable, [...command.arguments], {
      cwd: repoRoot,
      env: { ...process.env, VIDEO_SKILL_ARTIFACT: artifact },
      stdio: "inherit",
      windowsHide: true,
      windowsVerbatimArguments: command.windowsVerbatimArguments
    });
    if (result.error || result.status !== 0) {
      throw new Error(
        `${script} failed: ${result.error?.message ?? result.status}`
      );
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
