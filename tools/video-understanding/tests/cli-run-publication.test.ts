import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runProcess } from "./fixtures/process.ts";
import { processOutput } from "../src/media-runtime.ts";
import { complete } from "./fixtures/evidence-state.ts";
import { cli, publicJson, workspace } from "./fixtures/public-cli.ts";
const fixture = path.join(import.meta.dirname, "fixtures", "media-process.mjs");
test(
  "refinement logs distinguish create, replacement and revoke safety parameters without storing content",
  { timeout: 15_000 },
  async () =>
    workspace(async (directory) => {
      const index = await complete(directory);
      const file = path.join(directory, "draft.json");
      const common = {
        scopeId: index.scopeId,
        kind: "correction",
        targets: ["T0001"],
        replacement: {
          segments: [{ start: 0, end: 2, text: "private calibration body" }]
        },
        reason: "fixture",
        verified: { refs: [], note: "not verified" }
      };
      const actions = [
        {
          draft: { ...common, action: "create" },
          parameters: {
            file,
            action: "create",
            kind: "correction",
            refs: ["T0001"],
            support: []
          }
        },
        {
          draft: {
            ...common,
            action: "update",
            id: "C0001",
            expectedRevision: 1
          },
          parameters: {
            file,
            action: "update",
            id: "C0001",
            expectedRevision: 1,
            kind: "correction",
            refs: ["T0001"],
            support: []
          }
        },
        {
          draft: {
            scopeId: index.scopeId,
            action: "revoke",
            id: "C0001",
            expectedRevision: 2
          },
          parameters: {
            file,
            action: "revoke",
            id: "C0001",
            expectedRevision: 2
          }
        }
      ];
      for (const { draft, parameters } of actions) {
        await writeFile(file, JSON.stringify(draft));
        const result = await publicJson(directory, "refine", ["--file", file]);
        assert.equal(result.exitCode, 0);
        const logs = await publicJson(directory, "logs", [
          "--id",
          result.value.runId
        ]);
        assert.deepEqual(logs.value.items[0].record.parameters, parameters);
        assert.equal(logs.value.items[0].record.status, "complete");
        assert.ok(!logs.stdout.includes("private calibration body"));
      }
    })
);

test(
  "run publication and stage diagnostic failures never override the main operation outcome",
  { timeout: 15_000 },
  async () =>
    workspace(async (directory) => {
      const index = await complete(directory);
      const preload = pathToFileURL(
        path.join(import.meta.dirname, "fixtures/run-publication-failure.mjs")
      ).href;
      const result = await runProcess("node", [
        "--import",
        preload,
        cli,
        "prepare",
        "--input",
        index.source.file,
        "--output",
        directory,
        "--format",
        "json"
      ]);
      assert.ok(
        result.stderr.includes(
          "operation log unavailable; main result unchanged"
        )
      );
      assert.ok(
        !result.stderr.includes("unsafe run publication exception detail")
      );
      const runId = JSON.parse(result.stdout).runId;
      assert.equal(
        (await publicJson(directory, "logs", ["--id", runId])).value.items[0]
          .record.status,
        "running"
      );
      await rm(path.join(directory, "runs"), { recursive: true });
      await writeFile(path.join(directory, "runs"), "not a directory");
      const reused = await publicJson(directory, "prepare", [
        "--input",
        index.source.file
      ]);
      assert.equal(reused.exitCode, 0);
      assert.ok(reused.stderr.includes("no complete persisted run guarantee"));
      const failed = await publicJson(directory, "frames", [
        "--input",
        index.source.file,
        "--times",
        "1",
        "--app-root",
        path.join(directory, "missing")
      ]);
      assert.equal(failed.exitCode, 1);
      assert.ok(
        failed.stderr.includes(`target=${path.join(directory, "missing")}`)
      );
      assert.ok(failed.stderr.includes("main result unchanged"));
      const diagnostic = path.join(directory, "occupied.log");
      await writeFile(diagnostic, "preserve previous log");
      const warning = mock.method(console, "error", () => {});
      try {
        const run = (mode: string) =>
          processOutput({
            command: { program: "node", args: [fixture, mode] },
            env: process.env,
            stage: "inspection",
            diagnostic,
            timeout: 0
          });
        assert.ok((await run("success")).includes('"value"'));
        await assert.rejects(
          run("fail"),
          (error) =>
            error instanceof Error &&
            error.message.includes("process at inspection: exit=2")
        );
        assert.ok(warning.mock.calls.length > 0);
        assert.equal(
          await readFile(diagnostic, "utf8"),
          "preserve previous log"
        );
      } finally {
        warning.mock.restore();
      }
    })
);
