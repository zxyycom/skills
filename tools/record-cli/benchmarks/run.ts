import assert from "node:assert/strict";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { invoke, scenarios, verifyQuery } from "./verify.ts";
import {
  base,
  dependencyEntries,
  digest,
  integer,
  record,
  repository,
  treeHash
} from "./identity.ts";
import type { Scenario } from "./verify.ts";
import { collect, writeSummary } from "./measure.ts";
import type { Job } from "./measure.ts";
import { hostTarget, parseManifest, sha256 } from "../delivery/manifest.ts";
import type { Manifest } from "../delivery/manifest.ts";

function shuffle<T>(input: T[], seed: number): T[] {
  let state = seed >>> 0;
  const values = [...input];
  for (let i = values.length - 1; i > 0; i--) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
function commandOutput(command: string, args: string[]): string {
  return invoke(command, args, repository).stdout.trim();
}
async function inputFingerprints(fixture: string, assets: string) {
  return {
    fixture: await treeHash(fixture),
    assets: await treeHash(assets),
    decisionRuntime: await treeHash(
      path.join(repository, "skills/decision-records/scripts")
    ),
    investigationRuntime: await treeHash(
      path.join(repository, "skills/investigation-report/scripts")
    ),
    benchmark: await treeHash(
      path.join(repository, "tools/record-cli/benchmarks")
    ),
    node: digest(await readFile(process.execPath)),
    rootLock: digest(await readFile(path.join(repository, "pnpm-lock.yaml"))),
    dependencyEntries: await dependencyEntries()
  };
}
type Inputs = Awaited<ReturnType<typeof inputFingerprints>>;
async function checkInputs(
  fixture: string,
  assets: string,
  inputs: Inputs
): Promise<void> {
  assert.deepEqual(
    await inputFingerprints(fixture, assets),
    inputs,
    "guarded input drift"
  );
}
async function validateManifest(assets: string): Promise<Manifest> {
  const input: unknown = JSON.parse(
    await readFile(path.join(assets, "record-cli-candidate.json"), "utf8")
  );
  const manifest = parseManifest(input);
  assert.equal(manifest.target, hostTarget());
  for (const item of manifest.assets) {
    const bytes = await readFile(path.join(assets, item.file));
    assert.equal(item.size, bytes.length);
    assert.equal(item.sha256, sha256(bytes));
  }
  return manifest;
}
async function configuration() {
  const [
    fixtureName,
    assetPath,
    runName,
    samplesText = "3",
    seedText = "192837"
  ] = process.argv.slice(2);
  if (
    !fixtureName ||
    !runName ||
    !assetPath ||
    !/^[a-z0-9][a-z0-9-]*$/.test(fixtureName) ||
    !/^[a-z0-9][a-z0-9-]*$/.test(runName)
  )
    throw new Error(
      "Usage: node run.ts <fixture-name> <candidate-assets-dir> <new-run-name> [samples 1..100] [seed 1..4294967295]"
    );
  const samples = integer(Number(samplesText), 1, 100);
  const seed = integer(Number(seedText), 1, 4294967295);
  const fixture = path.join(base, fixtureName);
  assert.equal(
    await realpath(fixture),
    fixture,
    "fixture path must not traverse symlinks"
  );
  const assets = await realpath(path.resolve(assetPath));
  const metadata = record(
    JSON.parse(await readFile(path.join(fixture, "fixture.json"), "utf8"))
  );
  assert.equal(metadata.version, 1);
  const count = integer(metadata.count, 1, 10000);
  const width = integer(metadata.width, 2, 10000);
  const depth = integer(metadata.depth, 1, 10000);
  assert.ok(count >= 10 + width + depth);
  const manifest = await validateManifest(assets);
  const run = path.join(base, runName);
  await mkdir(run);
  return { fixture, assets, run, samples, seed, count, width, depth, manifest };
}
async function validateSuite(
  suite: Scenario[],
  config: { fixture: string; assets: string; run: string }
): Promise<Map<string, string>> {
  const { fixture, assets, run } = config;
  const expectedOutput = new Map<string, string>();
  const correctness = [];
  for (const scenario of suite.filter((item) => !item.mutable)) {
    const output = verifyQuery(scenario, fixture, assets);
    expectedOutput.set(
      `${scenario.domain}:${scenario.name}:node`,
      digest(output.old)
    );
    expectedOutput.set(
      `${scenario.domain}:${scenario.name}:native`,
      digest(output.native)
    );
    correctness.push({ scenario, old: output.old, native: output.native });
  }
  await writeFile(
    path.join(run, "correctness.json"),
    `${JSON.stringify(correctness, null, 2)}\n`,
    { flag: "wx" }
  );
  return expectedOutput;
}
function createJobs(suite: Scenario[], samples: number, seed: number): Job[] {
  const jobs: Job[] = [];
  for (const warmup of [true, false]) {
    const phase: Job[] = [];
    for (let i = 0; i < (warmup ? 1 : samples); i++)
      for (const scenario of suite)
        for (const arm of ["node", "native"] as const)
          phase.push({ scenario, arm, warmup });
    jobs.push(...shuffle(phase, (seed + (warmup ? 0 : 1)) >>> 0 || 1));
  }
  return jobs;
}
async function writeEnvironment(
  config: Awaited<ReturnType<typeof configuration>>,
  inputs: Inputs
): Promise<void> {
  const { fixture, run, samples, seed, count, width, depth, manifest } = config;
  const environment = {
    timestamp: new Date().toISOString(),
    node: process.version,
    nodeExecutable: process.execPath,
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpus: os.cpus().map((cpu) => cpu.model),
    filesystem: commandOutput("stat", ["-f", "-c", "%T", fixture]),
    gitHead: commandOutput("git", ["rev-parse", "HEAD"]),
    fixture: {
      count,
      width,
      depth,
      edges: {
        decisions: 7 + width + depth,
        investigations:
          6 + width + depth + (count >= 11 + 2 * width + depth ? width : 0)
      }
    },
    inputs,
    manifest,
    samples,
    seed,
    cache: "new process; OS cache not cleared",
    warmup: "one process per arm and scenario"
  };
  await writeFile(
    path.join(run, "environment.json"),
    `${JSON.stringify(environment, null, 2)}\n`,
    { flag: "wx" }
  );
}
async function main(): Promise<void> {
  const config = await configuration();
  const { fixture, assets, run, samples, seed, count, width, depth } = config;
  const inputs = await inputFingerprints(fixture, assets);
  const suite = scenarios(count, width, depth);
  const expectedOutput = await validateSuite(suite, { fixture, assets, run });
  const jobs = createJobs(suite, samples, seed);
  await writeEnvironment(config, inputs);
  const results = await collect(jobs, { fixture, assets, run, expectedOutput });
  await checkInputs(fixture, assets, inputs);
  await writeSummary(suite, results, samples, run);
  process.stdout.write(`completed: ${run}\n`);
}

await main();
