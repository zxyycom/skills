// 可复跑的一次性证据入口。临时 baseline/fixture 在 finally 中删除；不改 Git。
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const evidence = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(evidence, "../../../..");
const baselineRef = "acd4321cba0a7034ca993121b996b6253493ba19";
const repeats = Number(process.argv[2] ?? "7");
const label = process.argv[3] ?? "measured";
if (
  !Number.isSafeInteger(repeats) ||
  repeats < 3 ||
  !/^[a-z0-9-]+$/.test(label)
)
  throw new Error("Usage: node run-measurements.ts [repeats>=3] [new-label]");
const outputFile = path.join(evidence, `${label}.json`);
try {
  await fs.stat(outputFile);
  throw new Error(`Refusing to overwrite evidence: ${outputFile}`);
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
    throw error;
}

type Domain = "decision" | "published" | "investigation";
type Observation = Readonly<{
  name: string;
  milliseconds: number;
  counts: Readonly<Record<string, number>>;
  result: unknown;
}>;
type WorkerOutput = Readonly<{ observations: readonly Observation[] }>;
type Sample = Readonly<{ domain: Domain; size: number }>;
const samples: readonly Sample[] = [
  { domain: "decision", size: 20 },
  { domain: "decision", size: 200 },
  { domain: "published", size: 1000 },
  { domain: "published", size: 1001 },
  { domain: "published", size: 5000 },
  { domain: "published", size: 10000 },
  { domain: "investigation", size: 20 },
  { domain: "investigation", size: 200 }
];
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isObservation(value: unknown): value is Observation {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.milliseconds === "number" &&
    Number.isFinite(value.milliseconds) &&
    isRecord(value.counts) &&
    Object.values(value.counts).every(
      (count) =>
        typeof count === "number" && Number.isSafeInteger(count) && count >= 0
    ) &&
    Object.hasOwn(value, "result")
  );
}
function parseWorker(text: string): WorkerOutput {
  const value: unknown = JSON.parse(text);
  if (
    !isRecord(value) ||
    !Array.isArray(value.observations) ||
    !value.observations.every(isObservation)
  )
    throw new Error("Invalid worker output");
  return { observations: value.observations };
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  return value;
}
function resultEvidence(result: unknown): unknown {
  const text = JSON.stringify(canonical(result));
  return {
    sha256: createHash("sha256").update(text).digest("hex"),
    bytes: Buffer.byteLength(text),
    ...(isRecord(result)
      ? {
          status: result.status,
          errors: result.errors,
          warnings: result.warnings,
          total: result.total,
          source: result.source,
          searchInfo: result.searchInfo
        }
      : {})
  };
}
function measured(
  worker: string,
  sample: Sample,
  counters: boolean
): WorkerOutput {
  const args = counters
    ? ["--import", path.join(path.dirname(worker), "count-hook.ts")]
    : [];
  args.push(
    worker,
    sample.domain,
    String(sample.size),
    counters ? "counts" : "timing"
  );
  return parseWorker(
    execFileSync(process.execPath, args, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: "" }
    })
  );
}
async function manifest(
  root: string
): Promise<Readonly<Record<string, string>>> {
  const hashes: Record<string, string> = {};
  async function visit(directory: string): Promise<void> {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, item.name);
      if (item.isDirectory()) await visit(filename);
      else if (item.isFile() && item.name.endsWith(".ts"))
        hashes[path.relative(root, filename)] = createHash("sha256")
          .update(await fs.readFile(filename))
          .digest("hex");
    }
  }
  for (const domain of [
    "decision-records",
    "investigation-report",
    "index-runtime",
    "shared"
  ])
    await visit(path.join(root, "tools", domain, "src"));
  return hashes;
}
function statistics(values: readonly number[]): unknown {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  return {
    samplesMilliseconds: values,
    medianMilliseconds: median,
    minMilliseconds: sorted[0],
    maxMilliseconds: sorted.at(-1)
  };
}

const scratch = await fs.mkdtemp(
  path.join(os.tmpdir(), "first-batch-fixed-baseline-")
);
try {
  const archive = execFileSync(
    "git",
    ["-C", repository, "archive", baselineRef, "tools", "package.json"],
    { maxBuffer: 50 * 1024 * 1024 }
  );
  execFileSync("tar", ["-x", "-C", scratch], { input: archive });
  await fs.symlink(
    path.join(repository, "node_modules"),
    path.join(scratch, "node_modules")
  );
  const relativeEvidence = path.relative(repository, evidence);
  const baselineEvidence = path.join(scratch, relativeEvidence);
  await fs.mkdir(baselineEvidence, { recursive: true });
  for (const name of ["measure-worker.ts", "count-hook.ts", "counter-state.ts"])
    await fs.copyFile(
      path.join(evidence, name),
      path.join(baselineEvidence, name)
    );
  const workers = {
    baseline: path.join(baselineEvidence, "measure-worker.ts"),
    current: path.join(evidence, "measure-worker.ts")
  };
  const beforeManifest = await manifest(repository);
  const comparisons: unknown[] = [];
  const counts: unknown[] = [];
  let equivalent = true;
  for (const sample of samples) {
    const baseline = measured(workers.baseline, sample, true);
    const current = measured(workers.current, sample, true);
    if (baseline.observations.length !== current.observations.length)
      throw new Error("Observation count differs");
    for (const [index, before] of baseline.observations.entries()) {
      const after = current.observations[index];
      if (before.name !== after.name)
        throw new Error("Observation order differs");
      const same = isDeepStrictEqual(before.result, after.result);
      equivalent &&= same;
      comparisons.push({
        ...sample,
        operation: before.name,
        comparisonKind: ["prepare-full", "candidate-partial-layout"].includes(
          before.name
        )
          ? "internal-serializable-projection"
          : "complete-public-json-semantics",
        equivalent: same,
        baseline: resultEvidence(before.result),
        current: resultEvidence(after.result),
        ...(!same
          ? { baselineResult: before.result, currentResult: after.result }
          : {})
      });
      counts.push({
        ...sample,
        operation: before.name,
        baseline: before.counts,
        current: after.counts
      });
    }
    console.error(`Compared ${sample.domain} ${sample.size}`);
  }
  const timings: unknown[] = [];
  for (const sample of samples.filter(
    ({ size }) => size === 200 || size === 10000
  )) {
    const baselineSamples = new Map<string, number[]>();
    const currentSamples = new Map<string, number[]>();
    for (let repeat = 0; repeat < repeats; repeat++) {
      // 交错先后顺序；每次是独立、无 --import 的原生 Node 进程。
      const variants =
        repeat % 2 === 0
          ? (["baseline", "current"] as const)
          : (["current", "baseline"] as const);
      for (const variant of variants) {
        const result = measured(workers[variant], sample, false);
        const destination =
          variant === "baseline" ? baselineSamples : currentSamples;
        for (const row of result.observations) {
          const times = destination.get(row.name) ?? [];
          times.push(row.milliseconds);
          destination.set(row.name, times);
        }
      }
    }
    for (const [operation, values] of baselineSamples) {
      const currentValues = currentSamples.get(operation);
      if (currentValues === undefined)
        throw new Error("Missing current timing");
      timings.push({
        ...sample,
        operation,
        baseline: statistics(values),
        current: statistics(currentValues)
      });
    }
    console.error(
      `Timed ${sample.domain} ${sample.size}: ${repeats} processes per variant`
    );
  }
  const afterManifest = await manifest(repository);
  if (!isDeepStrictEqual(beforeManifest, afterManifest))
    throw new Error(
      "Current production source changed during measurement; rerun with stable input"
    );
  const scriptHashes: Record<string, string> = {};
  for (const name of [
    "measure-worker.ts",
    "count-hook.ts",
    "counter-state.ts",
    "run-measurements.ts"
  ])
    scriptHashes[name] = createHash("sha256")
      .update(await fs.readFile(path.join(evidence, name)))
      .digest("hex");
  const data = {
    at: new Date().toISOString(),
    baselineRef,
    currentHead: execFileSync("git", ["-C", repository, "rev-parse", "HEAD"], {
      encoding: "utf8"
    }).trim(),
    node: process.version,
    repeats,
    equivalent,
    normalization:
      "Fixture-root absolute paths become <fixture>. Internal resource identity dev/ino become <fixture-dev>/<fixture-ino>, as independent temporary fixtures cannot share inode identity. Map/Set are represented as ordered entries/values. Public results are compared in complete JSON semantics, where undefined fields/functions are omitted as with JSON output. prepare-full and candidate-partial-layout compare only their serializable data projections, not object methods/private state. No diagnostics, warnings, source, facets, coverage or relations are removed. Every counted pair is deep-compared before successful pairs are replaced by canonical SHA-256 and byte counts.",
    counting:
      "Synchronous function-entry and primitive Proxy counters only; no async coverage. query*InputElements are processed element counts, not comparator calls. Counter timings are discarded. Fixture construction is outside each timed operation. markdownReads counts fs.readFile only, excluding FileHandle.read used by content matching.",
    timing:
      "Independent Node processes, no --import hook, empty NODE_OPTIONS, alternating variant order. Timers enclose only the actual operation, excluding fixture setup, result normalization/serialization and cleanup. Warm in-process module/OS filesystem state is shared only across named operations within one sample process; no explicit warmup. Equivalence is checked in counted pairs, not repeated timing processes; production source manifests are verified stable across the complete run. Wall-clock samples are descriptive, not CPU claims.",
    baselineManifest: await manifest(scratch),
    currentManifest: afterManifest,
    scriptHashes,
    comparisons,
    counts,
    timings
  };
  await fs.writeFile(outputFile, `${JSON.stringify(data, null, 2)}\n`, {
    flag: "wx"
  });
  console.log(outputFile);
  if (!equivalent) process.exitCode = 1;
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}
