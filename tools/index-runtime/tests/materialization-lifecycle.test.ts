import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  loadCurrentStateIndex,
  loadStateIndex,
  syncStateIndex
} from "../src/index.ts";
import { resultValue } from "./support.ts";
import {
  createDecisionFixture,
  withTempRoot
} from "./materialization-test-support.ts";
test("checks, writes, and reloads current indexes across line endings", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition, source } = await createDecisionFixture();
    const indexPath = "indexes/decisions.json";
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "check"
        })
      ).state,
      "index-missing"
    );
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "write"
        })
      ).state,
      "written"
    );
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "check"
        })
      ).state,
      "current"
    );

    const resolvedIndexPath = path.join(tempRoot, ...indexPath.split("/"));
    await fs.writeFile(
      resolvedIndexPath,
      (await fs.readFile(resolvedIndexPath, "utf8")).replace(/\n/g, "\r\n"),
      "utf8"
    );
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "check"
        })
      ).state,
      "current"
    );

    const loaded = await loadStateIndex({
      context: { root: tempRoot },
      definition,
      expectation: { definitionVersion: 1, namespace: "decisions" },
      indexPath
    });
    assert.equal(
      Object.keys(resultValue(loaded).entries).length,
      source.states.length
    );
    assert.equal(
      (
        await loadCurrentStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath
        })
      ).status,
      "ok"
    );
  });
});

test("sync checks reject invalid UTF-8 indexes and writes repair them", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition, source } = await createDecisionFixture();
    source.states[0] = {
      ...source.states[0]!,
      title: "Replacement character �( stays distinguishable"
    };
    const indexPath = "indexes/invalid-utf8.json";
    const resolvedIndexPath = path.join(tempRoot, ...indexPath.split("/"));
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "write"
        })
      ).state,
      "written"
    );

    const expected = await fs.readFile(resolvedIndexPath);
    const validSequence = Buffer.from([0xef, 0xbf, 0xbd, 0x28]);
    const offset = expected.indexOf(validSequence);
    assert.notEqual(offset, -1);
    const invalid = Buffer.concat([
      expected.subarray(0, offset),
      Buffer.from([0xc3, 0x28]),
      expected.subarray(offset + validSequence.length)
    ]);
    assert.equal(invalid.toString("utf8"), expected.toString("utf8"));
    await fs.writeFile(resolvedIndexPath, invalid);

    const checked = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "check"
    });
    assert.equal(checked.status, "error");
    assert.equal(checked.state, "index-invalid");
    assert.ok(
      checked.diagnostics.some(
        (entry) => entry.code === "state-index.index-encoding-invalid"
      )
    );

    const repaired = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "write"
    });
    assert.equal(repaired.status, "ok");
    assert.equal(repaired.state, "written");
    assert.equal(repaired.changed, true);
    assert.deepEqual(await fs.readFile(resolvedIndexPath), expected);
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "check"
        })
      ).state,
      "current"
    );
  });
});

test("rejects persisted indexes with changed definition versions", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    const indexPath = "indexes/decisions.json";
    await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "write"
    });
    const result = await loadCurrentStateIndex({
      context: { root: tempRoot },
      definition: {
        ...definition,
        definitionVersion: definition.definitionVersion + 1,
        queryFields: definition.queryFields.map((field) =>
          field.name === "status" ? { ...field, name: "lifecycle" } : field
        )
      },
      indexPath
    });
    assert.equal(result.status, "error");
    assert.ok(
      result.diagnostics.some(
        (entry) => entry.code === "state-index.definition-version-mismatch"
      )
    );
  });
});
