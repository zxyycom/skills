import { resources } from "./fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { failure } from "../src/failure.ts";
import { recordedOperation } from "../src/runs.ts";
import { locateEvidence } from "../src/location.ts";
import { parseOptions } from "../src/arguments.ts";
import { complete, readyText } from "./fixtures/evidence-state.ts";
import { publicJson, workspace } from "./fixtures/public-cli.ts";
import { withWriter } from "../src/store.ts";
test(
  "structured runs record reuse, refine safety parameters and failures without transcript or prompt duplication",
  { timeout: 15_000 },
  async () =>
    workspace(async (directory) => {
      const index = await complete(directory);
      const reused = await publicJson(directory, "prepare", [
        "--input",
        index.source.file
      ]);
      assert.equal(reused.exitCode, 0);
      const logs = await publicJson(directory, "logs", [
        "--id",
        reused.value.runId
      ]);
      assert.partialDeepStrictEqual(logs.value.items[0], {
        availability: "available",
        record: {
          command: "prepare",
          status: "reused",
          failure: null,
          runId: reused.value.runId,
          scopeId: index.scopeId
        }
      });
      assert.equal(typeof logs.value.items[0].record.startedAt, "string");
      assert.equal(typeof logs.value.items[0].record.endedAt, "string");
      const draft = path.join(directory, "draft.json");
      await writeFile(
        draft,
        JSON.stringify({
          scopeId: index.scopeId,
          action: "create",
          kind: "correction",
          targets: ["T0001"],
          replacement: {
            segments: [
              { start: 0, end: 2, text: "unique-private-refinement-body" }
            ]
          },
          reason: "fixture",
          verified: { refs: [], note: "not verified" }
        })
      );
      const refined = await publicJson(directory, "refine", ["--file", draft]);
      assert.equal(refined.exitCode, 0);
      const refinedRun = await publicJson(directory, "logs", [
        "--id",
        refined.value.runId
      ]);
      assert.partialDeepStrictEqual(refinedRun.value.items[0].record, {
        status: "complete",
        parameters: { action: "create", kind: "correction", refs: ["T0001"] }
      });
      assert.ok(!refinedRun.stdout.includes("unique-private-refinement-body"));
      assert.ok(
        refinedRun.value.items[0].record.artifacts[0].includes(
          `artifacts/${refined.value.runId}/`
        )
      );
      const failed = await publicJson(directory, "prepare", [
        "--input",
        index.source.file,
        "--initial-prompt",
        "unique-private-prompt",
        "--app-root",
        path.join(directory, "missing-runtime")
      ]);
      assert.equal(failed.exitCode, 1);
      const first = await publicJson(directory, "logs", ["--limit", "1"]);
      assert.equal(first.value.nextOffset, 1);
      assert.equal(first.value.items[0].status, "failed");
      const failedRun = await publicJson(directory, "logs", [
        "--id",
        first.value.items[0].runId
      ]);
      assert.partialDeepStrictEqual(failedRun.value.items[0].record.failure, {
        kind: "environment",
        stage: "runtime"
      });
      assert.equal(
        typeof failedRun.value.items[0].record.failure.reason,
        "string"
      );
      assert.equal(
        typeof failedRun.value.items[0].record.failure.action,
        "string"
      );
      assert.ok(!failedRun.stdout.includes("unique-private-prompt"));
      assert.equal(
        failedRun.value.items[0].record.parameters.initialPromptProvided,
        true
      );
      const second = await publicJson(directory, "logs", [
        "--limit",
        "1",
        "--offset",
        "1"
      ]);
      assert.equal(second.value.items[0].runId, refined.value.runId);
    })
);

test(
  "run inspection works for damaged raw and persists interrupted outcomes; pure reads leave files unchanged",
  { timeout: 15_000 },
  async () =>
    workspace(async (directory) => {
      const index = await complete(directory);
      const options = parseOptions([
        "prepare",
        "--input",
        index.source.file,
        "--output",
        directory
      ]);
      if (options?.command !== "prepare") throw new Error("expected prepare");
      await assert.rejects(
        recordedOperation(await locateEvidence(options, resources), (run) =>
          withWriter({
            output: directory,
            onLocked: (current) => run.begin(current),
            work: async () => {
              throw failure({
                kind: "cancelled",
                stage: "asr",
                target: "fixture",
                reason: "explicit interruption"
              });
            }
          })
        ),
        (error) =>
          error instanceof Error && error.message.includes("cancelled at asr")
      );
      const before = (await readdir(directory, { recursive: true })).sort();
      const read = await publicJson(directory, "read", ["--id", "T0001"]);
      assert.partialDeepStrictEqual(read.value.latestSavedRun, {
        status: "interrupted",
        meaning: "latest saved run, not necessarily latest CLI invocation",
        failure: { kind: "cancelled", stage: "asr" }
      });
      const logPath = read.value.latestSavedRun.path;
      const beforeLog = await readFile(logPath, "utf8");
      await publicJson(directory, "read");
      await publicJson(directory, "logs");
      assert.deepEqual(
        (await readdir(directory, { recursive: true })).sort(),
        before
      );
      assert.equal(await readFile(logPath, "utf8"), beforeLog);
      await writeFile(
        path.join(directory, readyText(index).payload.file),
        "damaged raw"
      );
      const failed = await publicJson(directory, "prepare", [
        "--input",
        index.source.file,
        "--app-root",
        path.join(directory, "missing-runtime")
      ]);
      assert.ok(failed.stderr.includes("runtime"));
      const logs = await publicJson(directory, "logs");
      assert.equal(logs.exitCode, 0);
      assert.equal(logs.value.items[0].status, "failed");
      const detail = await publicJson(directory, "logs", [
        "--id",
        logs.value.items[0].runId
      ]);
      assert.equal(detail.value.items[0].record.failure.stage, "runtime");
    })
);

test(
  "foreign-scope, reordered-time and damaged logs are invalid without blocking evidence",
  { timeout: 15_000 },
  async () =>
    workspace(async (directory) => {
      const index = await complete(directory);
      const reused = await publicJson(directory, "prepare", [
        "--input",
        index.source.file
      ]);
      const detail = await publicJson(directory, "logs", [
        "--id",
        reused.value.runId
      ]);
      const saved = detail.value.items[0];
      const record = saved.record;
      for (const alteration of [
        { ...record, scopeId: "00000000-0000-4000-8000-000000000000" },
        { ...record, startedAt: "2000-01-01T00:00:00.000Z" },
        { ...record, artifacts: ["artifacts/foreign-run/image.png"] }
      ]) {
        await writeFile(saved.path, JSON.stringify(alteration));
        const read = await publicJson(directory, "read", ["--limit", "1"]);
        assert.equal(read.exitCode, 0);
        assert.equal(read.value.items[0].text, "原始文本");
        assert.equal(read.value.latestSavedRun.availability, "invalid");
        assert.equal(
          read.value.latestSavedRun.reason,
          "run scope, filename or artifact identity mismatch"
        );
        assert.equal(
          (await publicJson(directory, "logs", ["--id", record.runId])).value
            .items[0].availability,
          "invalid"
        );
      }
      await writeFile(saved.path, JSON.stringify({ damaged: true }));
      const damaged = (
        await publicJson(directory, "logs", ["--id", record.runId])
      ).value.items[0];
      assert.equal(damaged.availability, "invalid");
      assert.ok(damaged.reason.includes("invalid"));
      for (const [status, kind] of [
        ["interrupted", "process"],
        ["failed", "timeout"],
        ["failed", "cancelled"]
      ] as const) {
        await writeFile(
          saved.path,
          JSON.stringify({
            ...record,
            status,
            failure: failure({
              kind,
              stage: "asr",
              target: "fixture",
              reason: "mismatched outcome"
            }).failure
          })
        );
        const mismatched = (
          await publicJson(directory, "logs", ["--id", record.runId])
        ).value.items[0];
        assert.equal(mismatched.availability, "invalid");
        assert.ok(mismatched.reason.includes("invalid"));
      }
      assert.equal(
        (
          await publicJson(directory, "logs", [
            "--id",
            "00000000-0000-4000-8000-000000000000"
          ])
        ).value.items[0].availability,
        "missing"
      );
    })
);
