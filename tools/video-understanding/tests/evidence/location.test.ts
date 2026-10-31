import { resources } from "../fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  access,
  cp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { runProcess } from "../fixtures/process.ts";
import { locateEvidence } from "../../src/location.ts";
import { parseOptions } from "../../src/cli/arguments.ts";
import { loadEvidence, publishEvidence } from "../../src/store/store.ts";
import { complete } from "../fixtures/evidence-state.ts";
import { cli, publicJson, workspace } from "../fixtures/public-cli.ts";

test(
  "collection source selection is canonical, cwd-independent, isolated by path and read-only until a media write",
  { timeout: 15_000 },
  async () =>
    workspace(async (directory) => {
      const collection = path.join(directory, "collection");
      const index = await complete(directory);
      const options = parseOptions([
        "read",
        "--input",
        index.source.file,
        "--evidence-root",
        collection
      ]);
      if (options?.command !== "read") throw new Error("expected read");
      const selected = await locateEvidence(options, resources);
      assert.equal(path.dirname(selected.output), collection);
      assert.match(path.basename(selected.output), /^[a-f0-9]{64}$/);
      const alias = path.join(directory, "source-alias.mp4");
      await symlink(
        index.source.file,
        alias,
        process.platform === "win32" ? "file" : undefined
      );
      assert.equal(
        (await locateEvidence({ ...options, input: alias }, resources)).output,
        selected.output
      );
      if (process.platform === "win32") {
        assert.equal(
          await realpath(index.source.file.toUpperCase()),
          await realpath(index.source.file)
        );
        assert.equal(
          (
            await locateEvidence(
              { ...options, input: index.source.file.toUpperCase() },
              resources
            )
          ).output,
          selected.output
        );
      }
      const second = path.join(directory, "another-source.mp4");
      await writeFile(second, "synthetic source");
      assert.notEqual(
        (await locateEvidence({ ...options, input: second }, resources)).output,
        selected.output
      );
      const read = await runProcess(
        "node",
        [
          cli,
          "read",
          "--input",
          alias,
          "--evidence-root",
          collection,
          "--format",
          "json"
        ],
        { cwd: path.dirname(directory), reject: false }
      );
      assert.equal(read.exitCode, 1);
      assert.equal(read.stdout, "");
      await assert.rejects(access(selected.output));
      const logs = await publicJson(undefined, "logs", [
        "--input",
        index.source.file,
        "--evidence-root",
        collection
      ]);
      const refine = await publicJson(undefined, "refine", [
        "--input",
        index.source.file,
        "--evidence-root",
        collection,
        "--file",
        path.join(directory, "missing.json")
      ]);
      assert.equal(logs.exitCode, 1);
      assert.equal(refine.exitCode, 1);
      await assert.rejects(access(selected.output));
      const missingSelector = await runProcess("node", [cli, "read"], {
        reject: false
      });
      assert.ok(missingSelector.stderr.includes("provide --output"));
    })
);

test(
  "collection media writes create only their own scope, and all commands return its stable output",
  { timeout: 15_000 },
  async () =>
    workspace(async (directory) => {
      const collection = path.join(directory, "collection");
      const invoke = (command: string, args: string[] = []) =>
        publicJson(undefined, command, [
          ...args,
          "--evidence-root",
          collection
        ]);
      const index = await complete(directory);
      const parsed = parseOptions([
        "prepare",
        "--input",
        index.source.file,
        "--evidence-root",
        collection
      ]);
      if (parsed?.command !== "prepare") throw new Error("expected prepare");
      const selected = await locateEvidence(parsed, resources);
      await assert.rejects(access(selected.output));
      try {
        const initial = await invoke("prepare", [
          "--input",
          index.source.file,
          "--app-root",
          path.join(directory, "missing")
        ]);
        assert.equal(initial.exitCode, 1);
        const failedIndex = await loadEvidence(selected.output);
        assert.equal(failedIndex.materials[0]?.status, "failed");
        await cp(
          path.join(directory, "artifacts"),
          path.join(selected.output, "artifacts"),
          { recursive: true }
        );
        await publishEvidence(selected.output, {
          ...index,
          scopeId: failedIndex.scopeId
        });
        const reused = await invoke("prepare", ["--input", index.source.file]);
        assert.partialDeepStrictEqual(reused.value, {
          reused: true,
          output: selected.output
        });
        const read = await invoke("read", [
          "--input",
          index.source.file,
          "--id",
          "T0001"
        ]);
        assert.equal(read.value.output, selected.output);
        const draft = path.join(directory, "default-refinement.json");
        await writeFile(
          draft,
          JSON.stringify({
            scopeId: read.value.scopeId,
            action: "create",
            kind: "correction",
            targets: ["T0001"],
            replacement: {
              segments: [
                { start: 0, end: 2, text: "default selected correction" }
              ]
            },
            reason: "fixture",
            verified: { refs: [], note: "not verified" }
          })
        );
        const refine = await invoke("refine", [
          "--input",
          index.source.file,
          "--file",
          draft
        ]);
        assert.equal(refine.value.output, selected.output);
        const logs = await invoke("logs", [
          "--input",
          index.source.file,
          "--id",
          refine.value.runId
        ]);
        assert.equal(logs.value.output, selected.output);
        assert.equal(logs.value.items[0].record.status, "complete");
        await rm(index.source.file);
        assert.equal(
          (await publicJson(selected.output, "logs", [], cli)).exitCode,
          0
        );
        assert.equal(
          (await invoke("logs", ["--input", index.source.file])).exitCode,
          1
        );
      } finally {
        await rm(selected.output, { recursive: true, force: true });
      }
    })
);

test(
  "explicit output remains a single-video override; an additional input is checked rather than ignored",
  { timeout: 15_000 },
  async () =>
    workspace(async (directory) => {
      const index = await complete(directory);
      const other = path.join(directory, "different.mp4");
      await writeFile(other, "synthetic source");
      const read = await publicJson(directory, "read", [
        "--input",
        index.source.file
      ]);
      assert.equal(read.value.output, directory);
      assert.ok(
        (
          await publicJson(directory, "read", ["--input", other])
        ).stderr.includes("selected input differs")
      );
      assert.ok(
        (
          await publicJson(directory, "logs", ["--input", other])
        ).stderr.includes("selected input differs")
      );
      const draft = path.join(directory, "unused-draft.json");
      await writeFile(draft, "{}");
      assert.ok(
        (
          await publicJson(directory, "refine", [
            "--input",
            other,
            "--file",
            draft
          ])
        ).stderr.includes("selected input differs")
      );
      assert.deepEqual((await loadEvidence(directory)).refinements, []);
      assert.equal(
        await readFile(index.source.file, "utf8"),
        "synthetic source"
      );
    })
);
