import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import * as v from "valibot";
import { runChild } from "./collector.ts";
const scratch = import.meta.dirname;
const output = path.join(scratch, "results", "stage.jsonl");
const exec = promisify(execFile);
const measured = v.object({
  domain: v.string(),
  operation: v.string(),
  size: v.number(),
  elapsedMs: v.number(),
  maxRssKiB: v.number(),
  summary: v.record(v.string(), v.unknown())
});
async function git(root: string, ...args: string[]): Promise<string> {
  const { stdout } = await exec(
    "git",
    ["-c", "core.hooksPath=/dev/null", ...args],
    { cwd: root, timeout: 180000, maxBuffer: 16 * 1024 * 1024 }
  );
  return stdout;
}
for (const size of [10000, 100000])
  for (const domain of ["decision", "investigation"] as const) {
    const root = path.join(scratch, "datasets", `${domain}-${size}`);
    assert.ok((await fs.lstat(root)).isDirectory());
    await git(root, "-c", "init.templateDir=", "init", "-q");
    await git(root, "add", "--", "docs");
    await git(
      root,
      "-c",
      "user.name=Performance fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "Synthetic baseline"
    );
    const relative = `docs/${domain === "decision" ? "decisions" : "investigations"}`;
    const source = path.join(root, relative, "261020-record-000001.md");
    const before = await fs.readFile(source, "utf8");
    const after =
      domain === "decision"
        ? before.replace(
            /^purpose: [^\n]+$/mu,
            'purpose: "stage changed responsibility"'
          )
        : before.replace(
            /^question: [^\n]+$/mu,
            'question: "needle changed responsibility"'
          );
    assert.notEqual(after, before);
    await fs.writeFile(source, after);
    const cli = path.join(
      scratch,
      "source/skills",
      domain === "decision"
        ? "decision-records/scripts/decision-records.ts"
        : "investigation-report/scripts/check-investigations.ts"
    );
    const synchronization = await runChild(
      [cli, "--root", root, "sync-index"],
      300000
    );
    await fs.appendFile(
      output,
      JSON.stringify({
        kind: "setup",
        domain,
        size,
        baseline: await git(root, "rev-parse", "HEAD"),
        synchronization
      }) + "\n"
    );
    assert.equal(synchronization.exitCode, 0, synchronization.stderr);
    for (const scope of ["index", "domain", "all"]) {
      await git(root, "restore", "--staged", "--", relative);
      const operation = `stage-${scope}`;
      const worker = path.join(
        scratch,
        domain === "decision"
          ? "decision-stage-worker.ts"
          : "investigation-worker.ts"
      );
      const observation = await runChild(
        [worker, operation, root, String(size)],
        180000
      );
      const external: unknown =
        observation.exitCode === 0 ? JSON.parse(observation.stdout) : null;
      const measurement =
        external === null ? null : v.parse(measured, external);
      if (measurement !== null) {
        assert.equal(measurement.operation, operation);
        assert.equal(measurement.size, size);
        assert.equal(measurement.summary.status, "ok");
        assert.ok(
          Array.isArray(measurement.summary.writtenPaths) &&
            measurement.summary.writtenPaths.length ===
              (scope === "all" ? 2 : 1)
        );
      }
      const pendingPaths = (
        await git(root, "diff", "--cached", "--name-only", "-z")
      )
        .split("\0")
        .filter(Boolean)
        .sort();
      await fs.appendFile(
        output,
        JSON.stringify({
          kind: "stage",
          domain,
          size,
          scope,
          observation,
          measurement,
          pendingPaths
        }) + "\n"
      );
      process.stdout.write(
        `${domain} ${size} ${operation}: ${measurement?.elapsedMs ?? "failed"}ms, pendingPaths=${JSON.stringify(pendingPaths)}\n`
      );
    }
    await git(root, "restore", "--staged", "--", relative);
  }
