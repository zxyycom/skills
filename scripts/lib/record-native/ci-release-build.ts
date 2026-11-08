import { spawnSync } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { captureNativeCandidateSnapshot } from "./capture.ts";
import { stageNativeCandidateInputs } from "./staging.ts";
import { buildStagedNativeCandidate } from "./build.ts";
import { hostTarget } from "../../../tools/record-cli/delivery/manifest.ts";
import { nativeRoles } from "../../../tools/skill-package/src/native-release-manifest.ts";

// Build only the pending bytes of the checked-out revision. Output is owned by this run.
async function main(): Promise<void> {
  const root = process.cwd();
  const revision = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  });
  const pending = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd: root
  });
  const sha = revision.stdout.trim();
  if (
    revision.status !== 0 ||
    !/^[a-f0-9]{40,64}$/.test(sha) ||
    pending.status !== 0
  )
    throw new Error(
      "formal build requires the clean index of a committed revision"
    );
  const snapshot = await captureNativeCandidateSnapshot(root);
  const stage = await stageNativeCandidateInputs(root, snapshot);
  const version = "0.2.0";
  await buildStagedNativeCandidate(root, stage, version);
  const target = hostTarget();
  const smoke = spawnSync(
    process.execPath,
    [path.join(root, "tools/record-cli/smoke/native.ts")],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        RECORD_CLI_BIN_DIR: path.join(stage, "target", target, "release")
      }
    }
  );
  if (smoke.error || smoke.status !== 0)
    throw new Error("formal frozen binaries failed the real CLI smoke");
  const output = path.join(root, "dist", "record-cli-release-ci");
  await mkdir(output);
  const versionDir = path.join(output, version);
  await mkdir(versionDir);
  for (const file of ["source-files.json", "delivery-files.json"])
    await copyFile(path.join(stage, file), path.join(versionDir, file));
  await copyFile(
    path.join(stage, `native-${target}.json`),
    path.join(versionDir, "native.json")
  );
  for (const role of nativeRoles) {
    const name = `${role}-${version}-${target}.zip`;
    await copyFile(
      path.join(stage, "native-assets", name),
      path.join(versionDir, name)
    );
  }
  await writeFile(
    path.join(output, "comparison.json"),
    `${JSON.stringify({ revision: sha, versions: [version], delivery: { sha256: snapshot.deliveryHash, files: snapshot.delivery.map((file) => file.path) }, sources: [{ sha256: snapshot.sourceHash, files: snapshot.source.map((file) => file.path) }] }, null, 2)}\n`,
    { flag: "wx" }
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
