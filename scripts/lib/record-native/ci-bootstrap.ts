import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureNativeCandidateSnapshot } from "./capture.ts";
import { privateBootstrapSuccessor } from "./ci-bootstrap-source.ts";
import { compareEvidence } from "./ci-frozen.ts";
import { command, json, unpack } from "./ci-bootstrap-process.ts";
import { versions, mockedRelease } from "./ci-bootstrap-release.ts";
import { verifyScenarios } from "./ci-bootstrap-scenarios.ts";

const root = process.cwd();
async function run(): Promise<void> {
  if (process.platform !== "win32")
    throw new Error("this acceptance entry requires Windows");
  const linux = path.resolve(process.argv[2] ?? ""),
    windows = path.resolve(process.argv[3] ?? "");
  const revision = command("git", ["rev-parse", "HEAD"], root)
    .toString()
    .trim();
  compareEvidence(
    await json(path.join(linux, "comparison.json")),
    await json(path.join(windows, "comparison.json"))
  );
  const snapshot = await captureNativeCandidateSnapshot(root);
  const a = await versions(root, snapshot, "0.1.0", revision, {
    "x86_64-unknown-linux-gnu": linux,
    "x86_64-pc-windows-msvc": windows
  });
  const b = await versions(
    root,
    privateBootstrapSuccessor(snapshot),
    "0.1.1",
    revision,
    { "x86_64-unknown-linux-gnu": linux, "x86_64-pc-windows-msvc": windows }
  );
  console.log(
    `private frozen A ${a.sourceHash}; transformed B ${b.sourceHash}; revision ${revision}`
  );
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "record-bootstrap-ci-"));
  console.log(`isolated CI fixture: ${temp}`);
  await unpack(a.prepared.bootstrap.bytes, temp);
  const bootstrap = path.join(temp, "record-native-installer");
  command(
    "pnpm",
    [
      "install",
      "--prod",
      "--frozen-lockfile",
      "--ignore-workspace",
      "--config.node-linker=isolated"
    ],
    bootstrap
  );
  process.chdir(temp);
  process.env.NODE_OPTIONS = "";
  process.env.GITHUB_TOKEN = "fixture-token";
  globalThis.fetch = mockedRelease(a);
  await verifyScenarios(temp, bootstrap, a, b);
  console.log(
    `PASS Windows private bootstrap A/B (mock release, relocated installation): ${temp}`
  );
  process.chdir(root);
  await fs.rm(temp, { recursive: true });
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
