import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFile, cp, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { digest, record, repository, treeHash } from "./identity.ts";
import { executable, invoke, oldCli } from "./verify.ts";
import type { Domain, Scenario } from "./verify.ts";
export type Sample = {
  scenario: string;
  startedAt: string;
  domain: Domain;
  arm: "node" | "native";
  warmup: boolean;
  elapsedMs: number;
  stdoutBytes: number;
  stderrBytes: number;
  stdoutSha256: string;
  stderrSha256: string;
  status: number | null;
  signal: NodeJS.Signals | null;
};
export type Job = { scenario: Scenario; arm: Sample["arm"]; warmup: boolean };
export type Measurement = {
  fixture: string;
  assets: string;
  run: string;
  expectedOutput: Map<string, string>;
};
function indexPath(domain: Domain): string {
  return `docs/${domain}/${domain === "decisions" ? "decision-index.json" : "investigation-index.json"}`;
}
async function prepareRoot(
  job: Job,
  index: number,
  config: Measurement
): Promise<string> {
  if (!job.scenario.mutable) return config.fixture;
  const root = path.join(config.run, `copy-${String(index).padStart(5, "0")}`);
  await cp(config.fixture, root, {
    recursive: true,
    errorOnExist: true,
    force: false
  });
  await unlink(path.join(root, indexPath(job.scenario.domain)));
  return root;
}

function invocation(
  job: Job,
  assets: string,
  root: string
): { command: string; args: string[] } {
  const command =
    job.arm === "node"
      ? process.execPath
      : path.join(assets, executable[job.scenario.domain]);
  const args =
    job.arm === "node"
      ? [oldCli[job.scenario.domain], "--root", root, ...job.scenario.args]
      : [
          ...job.scenario.args,
          "--root",
          root,
          ...(job.scenario.trace ? [] : ["--json"])
        ];
  return { command, args };
}

async function verifySync(
  job: Job,
  root: string,
  fixture: string,
  stdout: string
): Promise<void> {
  if (job.arm === "native") {
    const envelope = record(JSON.parse(stdout));
    const result = record(envelope.result);
    assert.equal(envelope.ok, true);
    assert.equal(result.status, "ok");
    assert.equal(result.changed, true);
    assert.equal(result.committed, true);
    assert.equal(result.verification, "passed");
  } else assert.match(stdout, /Rebuilt|synchronized/);
  const index = indexPath(job.scenario.domain);
  assert.deepEqual(
    await readFile(path.join(root, index)),
    await readFile(path.join(fixture, index)),
    "sync index differs from TS-built reference"
  );
  assert.equal(
    await treeHash(root, index),
    await treeHash(fixture, index),
    "sync modified unrelated input"
  );
  invoke(
    process.execPath,
    [oldCli[job.scenario.domain], "--root", root, "check"],
    repository
  );
}

async function acceptOutput(context: {
  job: Job;
  root: string;
  config: Measurement;
  stdout: string;
}): Promise<void> {
  const { job, root, config, stdout } = context;
  if (job.scenario.mutable) await verifySync(job, root, config.fixture, stdout);
  else
    assert.equal(
      digest(stdout),
      config.expectedOutput.get(
        `${job.scenario.domain}:${job.scenario.name}:${job.arm}`
      ),
      "timed output differs from validated output"
    );
}

async function measure(
  job: Job,
  index: number,
  config: Measurement
): Promise<Sample> {
  const root = await prepareRoot(job, index, config);
  const { command, args } = invocation(job, config.assets, root);
  const startedAt = new Date().toISOString();
  const start = process.hrtime.bigint();
  const child = spawnSync(command, args, {
    cwd: repository,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  const stdout = child.stdout ?? "";
  const stderr = child.stderr ?? "";
  const sample: Sample = {
    scenario: job.scenario.name,
    startedAt,
    domain: job.scenario.domain,
    arm: job.arm,
    warmup: job.warmup,
    elapsedMs,
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: Buffer.byteLength(stderr),
    stdoutSha256: digest(stdout),
    stderrSha256: digest(stderr),
    status: child.status,
    signal: child.signal
  };
  await appendFile(
    path.join(config.run, "samples.jsonl"),
    `${JSON.stringify({ ...sample, command, args })}\n`
  );
  if (child.error || child.status !== 0 || child.signal || stderr)
    throw new Error(
      `sample ${index} failed: ${child.error?.message ?? stderr}`
    );
  await acceptOutput({ job, root, config, stdout });
  return sample;
}

export async function collect(
  jobs: Job[],
  config: Measurement
): Promise<Sample[]> {
  const results: Sample[] = [];
  for (const [index, job] of jobs.entries())
    results.push(await measure(job, index, config));
  return results;
}
export async function writeSummary(
  suite: Scenario[],
  results: Sample[],
  samples: number,
  run: string
): Promise<void> {
  const summary = suite.flatMap((scenario) =>
    (["node", "native"] as const).map((arm) => {
      const selected = results.filter(
        (sample) =>
          !sample.warmup &&
          sample.scenario === scenario.name &&
          sample.domain === scenario.domain &&
          sample.arm === arm
      );
      const values = selected
        .map((sample) => sample.elapsedMs)
        .sort((a, b) => a - b);
      assert.equal(values.length, samples);
      const middle = Math.floor(values.length / 2);
      const median =
        values.length % 2
          ? values[middle]
          : (values[middle - 1] + values[middle]) / 2;
      return {
        domain: scenario.domain,
        scenario: scenario.name,
        arm,
        count: values.length,
        medianMs: median,
        p95Ms: values[Math.ceil(values.length * 0.95) - 1],
        stdoutBytes: [...new Set(selected.map((sample) => sample.stdoutBytes))]
      };
    })
  );
  await writeFile(
    path.join(run, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    { flag: "wx" }
  );
  await writeFile(
    path.join(run, "completed.json"),
    `${JSON.stringify({ finishedAt: new Date().toISOString(), sampleCount: results.length })}\n`,
    { flag: "wx" }
  );
}
