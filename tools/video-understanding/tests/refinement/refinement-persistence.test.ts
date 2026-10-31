import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { complete, readyText } from "../fixtures/evidence-state.ts";
import { readFileDigest } from "../../src/evidence/evidence.ts";
import {
  materialFields,
  reusablePreparation
} from "../../src/evidence/material.ts";
import {
  loadEvidence,
  loadSnapshot,
  operationDirectory,
  publishEvidence,
  withWriter
} from "../../src/store/store.ts";
import { parseOptions } from "../../src/cli/arguments.ts";
import { failure } from "../../src/failure.ts";
import { publicJson, workspace } from "../fixtures/public-cli.ts";
import { query, select } from "../fixtures/refinement-state.ts";

test("empty, failed and interrupted material attempts stay distinct and never hide reusable success", async () =>
  workspace(async (directory) => {
    const index = await complete(directory);
    const options = parseOptions([
      "prepare",
      "--input",
      index.source.file,
      "--output",
      directory,
      "--source",
      "asr"
    ]);
    if (options?.command !== "prepare") throw new Error("prepare expected");
    for (const kind of ["process", "timeout", "cancelled"] as const) {
      const fields = materialFields(index, {
        kind: "subtitle",
        origin: "asr",
        parameters: readyText(index).parameters
      });
      index.materials.push({
        ...fields,
        status: kind === "process" ? "failed" : "interrupted",
        failure: failure({
          kind,
          stage: "asr",
          target: "fixture",
          reason: "fixture"
        }).failure,
        processedCoverage: []
      });
    }
    await publishEvidence(directory, index);
    assert.equal(
      reusablePreparation(await loadSnapshot(directory), options, [])?.id,
      "M0001"
    );
    const operation = await operationDirectory(directory);
    await writeFile(path.join(operation.directory, "empty.json"), "[]");
    index.materials.push({
      ...materialFields(index, {
        kind: "subtitle",
        origin: "asr",
        parameters: readyText(index).parameters
      }),
      status: "empty",
      processedCoverage: [{ start: 0, end: 4 }],
      payload: await readFileDigest(
        directory,
        `${operation.relative}/empty.json`
      ),
      files: [],
      warnings: [],
      provenance: readyText(index).provenance
    });
    await publishEvidence(directory, index);
    assert.equal(
      reusablePreparation(await loadSnapshot(directory), options, [])?.status,
      "empty"
    );
    assert.equal(
      (await query(directory, ["--view", "materials"])).items.length,
      5
    );
  }));

test("manifest duplicate and dangling identities block globally; payload/index disagreement stays local", async () =>
  workspace(async (directory) => {
    const index = await complete(directory);
    const file = path.join(directory, "evidence.json");
    await writeFile(
      file,
      JSON.stringify({
        ...index,
        materials: [...index.materials, index.materials[0]]
      })
    );
    await assert.rejects(
      loadSnapshot(directory),
      (error) => error instanceof Error && error.message.includes("duplicate")
    );
    await publishEvidence(directory, index);
    await select(directory, index.scopeId);
    const saved = await loadEvidence(directory);
    await writeFile(
      file,
      JSON.stringify({
        ...saved,
        refinements: [{ ...saved.refinements[0], refs: ["M9999"] }]
      })
    );
    await assert.rejects(
      loadSnapshot(directory),
      (error) => error instanceof Error && error.message.includes("dangling")
    );
    await publishEvidence(directory, saved);
    const material = readyText(index);
    material.cues[0]!.end = 2;
    await publishEvidence(directory, {
      ...saved,
      materials: index.materials
    });
    assert.equal(
      (await query(directory, ["--id", "T0001"])).items[0]?.availability,
      "unavailable"
    );
  }));

test("exclusive writers and unpublished artifacts preserve one valid snapshot; explicit empty rebuild gets a new scope", async () =>
  workspace(async (directory) => {
    const index = await complete(directory);
    const before = await readFile(path.join(directory, "evidence.json"));
    await assert.rejects(
      withWriter({
        output: directory,
        work: async () => {
          await assert.rejects(
            withWriter({ output: directory, work: async () => undefined }),
            (error) => error instanceof Error && error.message.includes("lock")
          );
          const op = await operationDirectory(directory);
          await writeFile(
            path.join(op.directory, "unpublished.json"),
            "partial"
          );
          throw failure({
            kind: "input",
            stage: "refine",
            target: "fixture",
            reason: "not published"
          });
        }
      }),
      (error) =>
        error instanceof Error && error.message.includes("not published")
    );
    assert.deepEqual(
      await readFile(path.join(directory, "evidence.json")),
      before
    );
    assert.equal((await loadSnapshot(directory)).transcripts.length, 2);
    const empty = path.join(directory, "empty");
    await mkdir(empty);
    await withWriter({
      output: empty,
      source: index.source,
      work: async (s) => {
        assert.notEqual(s.index.scopeId, index.scopeId);
        assert.deepEqual(s.index.materials, []);
      }
    });
  }));

for (const label of ["older", "future", "missing", "non-numeric"]) {
  test(`${label} evidence version fails without rewriting the manifest`, async () =>
    workspace(async (directory) => {
      const version = (
        {
          older: 3,
          future: 6,
          missing: undefined,
          "non-numeric": "5"
        } as Record<string, unknown>
      )[label];
      const file = path.join(directory, "evidence.json");
      const original = JSON.stringify({ version });
      await writeFile(file, original);
      const beforeTime = (await stat(file)).mtimeMs;
      await assert.rejects(
        loadEvidence(directory),
        (error) =>
          error instanceof Error &&
          error.message.includes(
            "unsupported evidence version; expected 5; old files left unchanged"
          )
      );
      assert.equal(await readFile(file, "utf8"), original);
      assert.equal((await stat(file)).mtimeMs, beforeTime);
      assert.deepEqual(await readdir(directory), ["evidence.json"]);
    }));
}

test("all public commands reject an unsupported version without changing existing data", async () =>
  workspace(async (directory) => {
    const index = await complete(directory);
    const file = path.join(directory, "evidence.json");
    await writeFile(
      file,
      JSON.stringify({
        version: 4,
        scopeId: index.scopeId,
        source: index.source
      })
    );
    const draft = path.join(directory, "draft.json");
    await writeFile(draft, "{}");
    async function snapshot() {
      return Promise.all(
        (await readdir(directory, { recursive: true }))
          .sort()
          .map(async (name) => {
            const target = path.join(directory, name);
            const entry = await stat(target);
            return {
              name,
              bytes: entry.isFile() ? await readFile(target) : null,
              mtime: entry.isFile() ? entry.mtimeMs : null
            };
          })
      );
    }
    const before = await snapshot();
    for (const [command, args] of [
      ["read", []],
      ["logs", []],
      ["prepare", ["--input", index.source.file]],
      ["frames", ["--input", index.source.file, "--times", "1"]],
      ["ocr", ["--frames", "F0001"]],
      ["refine", ["--file", draft]]
    ] as const) {
      const rejected = await publicJson(directory, command, [...args]);
      assert.equal(rejected.exitCode, 1);
      assert.equal(rejected.stdout, "");
      assert.ok(
        rejected.stderr.includes(
          "unsupported evidence version; expected 5; old files left unchanged"
        )
      );
      assert.ok(
        rejected.stderr.includes(
          "preserve existing data; use a new explicit output for new evidence"
        )
      );
      assert.deepEqual(await snapshot(), before);
    }
  }));
