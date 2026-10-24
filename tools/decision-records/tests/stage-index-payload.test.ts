import {
  onWorkspaceIndexRead,
  pendingObjectPath,
  requiredIndexPayloadFailure,
  assertFreshIndexParseReuse,
  assertFreshIndexBomReparse,
  assertFreshInvalidPendingIndex
} from "../../shared/tests/record-stage-evidence.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  runGit as git,
  withTemporaryWorkspace as withTempRoot
} from "./support.ts";
import {
  a,
  b,
  fixture,
  formal,
  sync,
  stage as stageDecision
} from "./support-local-contracts.ts";
const indexRelativePath = "docs/decisions/decision-index.json";
const otherPath = "docs/decisions/" + b + ".md";
const stage = (root: string, scope: "index" | "all" | "domain" = "index") =>
  stageDecision(root, [a], scope);
function parseJsonObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value)
  );
  return Object.fromEntries(Object.entries(value));
}
function jsonObjectMember(
  value: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const member = value[key];
  assert.ok(
    member !== null && typeof member === "object" && !Array.isArray(member)
  );
  return Object.fromEntries(Object.entries(member));
}

async function prepare(root: string): Promise<void> {
  await fixture(root, true);
  await formal(root, a, "Updated selected");
  await sync(root);
}

test("Decision stage scopes preserve unselected missing pending payload without reading it", async () => {
  await withTempRoot("stage-index-narrow", async (root) => {
    await prepare(root);
    const target = pendingObjectPath(root, otherPath);
    await fs.unlink(target);
    const before = git(root, ["ls-files", "--stage"]);
    for (const scope of ["all", "domain"] as const) {
      const full = await stage(root, scope);
      assert.equal(full.status, "ok", JSON.stringify(full));
      const nonSelected = (text: string) =>
        text.split("\n").filter((line) => line.endsWith(otherPath));
      assert.deepEqual(
        nonSelected(git(root, ["ls-files", "--stage"])),
        nonSelected(before)
      );
    }
    const result = await stage(root);
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.deepEqual(result.writtenPaths, []);
    assert.equal(
      jsonObjectMember(
        jsonObjectMember(
          parseJsonObject(git(root, ["show", `:${indexRelativePath}`])),
          "entries"
        ),
        a
      ).title,
      "Updated selected"
    );
    assert.deepEqual(
      git(root, ["ls-files", "--stage"])
        .split("\n")
        .filter((line) => line.endsWith(otherPath)),
      before.split("\n").filter((line) => line.endsWith(otherPath))
    );
    const unchanged = await stage(root);
    assert.equal(unchanged.status, "ok");
    if (unchanged.status === "ok") assert.deepEqual(unchanged.writtenPaths, []);
  });
});

test("Decision stage index preserves unselected partial pending mode and staged deletion", async () => {
  await withTempRoot("stage-index-preservation", async (root) => {
    await fixture(root, true);
    const third = "260901-local-third";
    await formal(root, third, "third");
    await sync(root);
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "third"]);
    await fs.writeFile(path.join(root, otherPath), "partial pending only\n");
    git(root, ["add", otherPath]);
    git(root, ["update-index", "--chmod=+x", otherPath]);
    git(root, ["rm", "--cached", "docs/decisions/" + third + ".md"]);
    await formal(root, a, "Selected update");
    await formal(root, b, "Unselected work");
    await sync(root);
    const before = git(root, ["ls-files", "--stage"]);
    const result = await stage(root);
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.ok(result.preservedPendingPaths.includes(otherPath));
    assert.deepEqual(
      git(root, ["ls-files", "--stage"])
        .split("\n")
        .filter((line) => !line.endsWith(indexRelativePath)),
      before.split("\n").filter((line) => !line.endsWith(indexRelativePath))
    );
    assert.equal(
      git(root, ["show", `:${otherPath}`]),
      "partial pending only\n"
    );
    const entries = jsonObjectMember(
      parseJsonObject(git(root, ["show", `:${indexRelativePath}`])),
      "entries"
    );
    assert.equal(jsonObjectMember(entries, b).title, "原始 B");
    assert.equal(jsonObjectMember(entries, third).title, "third");
  });
});

for (const drift of ["oid", "mode", "membership", "deletion"]) {
  test(`Decision stage index independently rejects full pending ${drift} drift before writing`, async () => {
    await withTempRoot("stage-index-pending-drift", async (root) => {
      await prepare(root);
      let before = "";
      let changed = false;
      const result = await onWorkspaceIndexRead(
        root,
        indexRelativePath,
        async (count) => {
          if (count !== 2) return;
          changed = true;
          if (drift === "oid") {
            await fs.writeFile(
              path.join(root, otherPath),
              "new unrelated pending payload\n"
            );
            git(root, ["add", otherPath]);
          }
          if (drift === "mode")
            git(root, ["update-index", "--chmod=+x", otherPath]);
          if (drift === "membership") {
            await fs.writeFile(
              path.join(root, "docs/decisions/other.txt"),
              "new member"
            );
            git(root, ["add", "docs/decisions/other.txt"]);
          }
          if (drift === "deletion") git(root, ["rm", "--cached", otherPath]);
          before = git(root, ["ls-files", "--stage"]);
        },
        () => stage(root)
      );
      assert.equal(changed, true);
      assert.equal(result.status, "error", JSON.stringify(result));
      assert.match(JSON.stringify(result), /pending-conflict/);
      assert.equal(git(root, ["ls-files", "--stage"]), before);
    });
  });
}

test("Decision stage index independently rereads mutable workspace index before writing", async () => {
  await withTempRoot("stage-index-workspace-drift", async (root) => {
    await prepare(root);
    const before = git(root, ["ls-files", "--stage"]);
    let changed = false;
    const result = await onWorkspaceIndexRead(
      root,
      indexRelativePath,
      async (count) => {
        if (count !== 1) return;
        changed = true;
        const target = path.join(root, indexRelativePath);
        const index = parseJsonObject(await fs.readFile(target, "utf8"));
        const entries = jsonObjectMember(index, "entries");
        index.entries = {
          ...entries,
          [a]: {
            ...jsonObjectMember(entries, a),
            title: "Concurrent workspace update"
          }
        };
        await fs.writeFile(target, JSON.stringify(index));
      },
      () => stage(root)
    );
    assert.equal(changed, true);
    assert.equal(result.status, "error", JSON.stringify(result));
    assert.match(JSON.stringify(result), /stage-source-changed/);
    assert.equal(git(root, ["ls-files", "--stage"]), before);
  });
});

for (const phase of ["preparation", "independent verification"]) {
  test(`Decision stage index refuses required pending index payload failure during ${phase}`, async () => {
    await withTempRoot("stage-index-payload-failure", async (root) => {
      await prepare(root);
      const result = await requiredIndexPayloadFailure(
        root,
        indexRelativePath,
        phase,
        () => stage(root)
      );
      assert.equal(result.status, "error", JSON.stringify(result));
    });
  });
}

test("Decision stage index acquires one preparation pending payload then independent locked and readback payloads", async () => {
  await withTempRoot("stage-index-phase-count", async (root) => {
    await prepare(root);
    const previous = process.env.GIT_TRACE2_EVENT;
    try {
      for (const [round, expectedBatches] of [
        ["changed", 5],
        ["unchanged", 4]
      ] as const) {
        const trace = path.join(root, `${round}.trace`);
        process.env.GIT_TRACE2_EVENT = trace;
        const result = await stage(root);
        assert.equal(result.status, "ok");
        const events = (await fs.readFile(trace, "utf8"))
          .trim()
          .split("\n")
          .map(parseJsonObject);
        const batches = events.filter(
          (event) =>
            event.event === "start" &&
            Array.isArray(event.argv) &&
            event.argv.includes("cat-file") &&
            event.argv.includes("--batch")
        );
        // One fixed HEAD index read, one initial P, one independent P, one locked P;
        // changed targets additionally require postwrite readback.
        assert.equal(batches.length, expectedBatches);
      }
    } finally {
      if (previous === undefined) delete process.env.GIT_TRACE2_EVENT;
      else process.env.GIT_TRACE2_EVENT = previous;
    }
  });
});

test("Decision stage reuses same-call index parses after independent actual W and P payload reads", async () => {
  await withTempRoot("stage-parse-equivalence", async (root) => {
    await prepare(root);
    const pendingText = git(root, ["show", `:${indexRelativePath}`]);
    const result = await assertFreshIndexParseReuse(
      root,
      indexRelativePath,
      pendingText,
      () => stage(root)
    );
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.equal(
      jsonObjectMember(
        jsonObjectMember(
          parseJsonObject(git(root, ["show", `:${indexRelativePath}`])),
          "entries"
        ),
        a
      ).title,
      "Updated selected"
    );
  });
});

test("Decision stage reparses changed actual W bytes even when decoded projection is identical", async () => {
  await withTempRoot("stage-workspace-byte-equivalence", async (root) => {
    await prepare(root);
    const result = await assertFreshIndexBomReparse(
      root,
      indexRelativePath,
      () => stage(root)
    );
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.equal(
      jsonObjectMember(
        jsonObjectMember(
          parseJsonObject(git(root, ["show", `:${indexRelativePath}`])),
          "entries"
        ),
        a
      ).title,
      "Updated selected"
    );
  });
});

test("Decision stage validates changed fresh pending index before reporting identity conflict", async () => {
  await withTempRoot("stage-pending-invalid-priority", async (root) => {
    await prepare(root);
    await assertFreshInvalidPendingIndex(root, indexRelativePath, () =>
      stage(root)
    );
  });
});
