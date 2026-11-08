import { spawnSync } from "node:child_process";
import { installFirstCandidate } from "./ci-bootstrap-scenarios.ts";

/** Exercise the same check/install order for online fresh and legacy targets. */
export async function installOnlineTarget(
  destination: string,
  legacy: boolean,
  bootstrapEntry: string,
  workingDirectory: string
): Promise<void> {
  await installFirstCandidate(destination, legacy, {
    async run(args) {
      const result = spawnSync(
        process.execPath,
        [bootstrapEntry, ...args, "--release-tag", "skills-latest"],
        { cwd: workingDirectory, encoding: "utf8" }
      );
      if (result.error) throw result.error;
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      if (result.status === null)
        throw new Error("online bootstrap terminated without an exit code");
      return result.status;
    }
  });
}
