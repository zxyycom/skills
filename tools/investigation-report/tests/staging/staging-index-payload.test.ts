import {
  onWorkspaceIndexRead,
  pendingObjectPath,
  requiredIndexPayloadFailure,
  assertFreshIndexParseReuse,
  assertFreshIndexBomReparse,
  assertFreshInvalidPendingIndex
} from "../../../shared/tests/record-stage-evidence.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationReports } from "../../src/staging/staging.ts";
import { git, initializeGit } from "../support/git-support.ts";
import {
  indexRelativePath,
  jsonObjectMember,
  parseJsonObject,
  withTempRoot
} from "../support/fixture-support.ts";
import { writeCollection } from "../support/collection-support.ts";

const otherPath = "docs/investigations/two.md";
const stage = (root: string, scope: "index" | "all" | "domain" = "index") =>
  stageInvestigationReports({ workspaceRoot: root, reportIds: ["one"], scope });

async function prepare(root: string): Promise<void> {
  await writeCollection(root, [{ id: "one" }, { id: "two" }]);
  initializeGit(root);
  await writeCollection(root, [
    { id: "one", title: "Updated selected" },
    { id: "two" }
  ]);
}

test("stage scopes preserve unrelated pending missing payload without reading it", async () => {
  await withTempRoot("stage-index-narrow", async (root) => {
    await prepare(root);
    const target = pendingObjectPath(root, otherPath);
    await fs.unlink(target);
    const before = git(root, ["ls-files", "--stage"]);
    for (const scope of ["all", "domain"] as const) {
      const selected = await stage(root, scope);
      assert.equal(selected.status, "ok", JSON.stringify(selected));
      assert.equal(
        git(root, ["ls-files", "--stage"])
          .split("\n")
          .find((line) => line.endsWith(otherPath)),
        before.split("\n").find((line) => line.endsWith(otherPath))
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
        "one"
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
    assert.equal(unchanged.state, "unchanged");
  });
});
test("stage index preserves unselected partial pending mode and staged deletion", async () => {
  await withTempRoot("stage-index-preservation", async (root) => {
    await writeCollection(root, [
      { id: "one" },
      { id: "two" },
      { id: "three" }
    ]);
    initializeGit(root);
    await fs.writeFile(path.join(root, otherPath), "partial pending only\n");
    git(root, ["add", otherPath]);
    git(root, ["update-index", "--chmod=+x", otherPath]);
    git(root, ["rm", "--cached", "docs/investigations/three.md"]);
    await writeCollection(root, [
      { id: "one", title: "Selected update" },
      { id: "two", title: "Unselected work" },
      { id: "three" }
    ]);
    const before = git(root, ["ls-files", "--stage"]);
    const result = await stage(root);
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.ok(result.preservedPendingPaths.includes(otherPath));
    assert.ok(
      result.preservedPendingPaths.includes("docs/investigations/three.md")
    );
    assert.deepEqual(
      git(root, ["ls-files", "--stage"])
        .split("\n")
        .filter((line) => line.endsWith(otherPath)),
      before.split("\n").filter((line) => line.endsWith(otherPath))
    );
    assert.equal(
      git(root, ["show", `:${otherPath}`]),
      "partial pending only\n"
    );
    assert.equal(
      git(root, ["ls-files", "--stage", "--", "docs/investigations/three.md"]),
      ""
    );
    const entries = jsonObjectMember(
      parseJsonObject(git(root, ["show", `:${indexRelativePath}`])),
      "entries"
    );
    assert.equal(jsonObjectMember(entries, "two").title, "two");
    assert.equal(jsonObjectMember(entries, "three").title, "three");
  });
});

for (const drift of ["oid", "mode", "membership", "deletion"]) {
  test(`stage index independently rejects full pending ${drift} drift before writing`, async () => {
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
              path.join(root, "docs/investigations/other.txt"),
              "new member"
            );
            git(root, ["add", "docs/investigations/other.txt"]);
          }
          if (drift === "deletion") git(root, ["rm", "--cached", otherPath]);
          before = git(root, ["ls-files", "--stage"]);
        },
        () => stage(root)
      );
      assert.equal(changed, true);
      assert.equal(result.state, "pending-conflict", JSON.stringify(result));
      assert.equal(git(root, ["ls-files", "--stage"]), before);
    });
  });
}

test("stage index independently rereads mutable workspace index before writing", async () => {
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
        jsonObjectMember(jsonObjectMember(index, "entries"), "one").title =
          "Concurrent workspace update";
        await fs.writeFile(target, JSON.stringify(index));
      },
      () => stage(root)
    );
    assert.equal(changed, true);
    assert.equal(result.state, "source-drift", JSON.stringify(result));
    assert.equal(git(root, ["ls-files", "--stage"]), before);
  });
});

for (const phase of ["preparation", "independent verification"]) {
  test(`stage index refuses required pending index payload failure during ${phase}`, async () => {
    await withTempRoot("stage-index-payload-failure", async (root) => {
      await prepare(root);
      const result = await requiredIndexPayloadFailure(
        root,
        indexRelativePath,
        phase,
        () => stage(root)
      );
      assert.equal(result.state, "domain-stage-failed", JSON.stringify(result));
      assert.ok(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "investigation-report.stage-pending-read-failed"
        )
      );
    });
  });
}

for (const phase of ["preparation", "independent verification"]) {
  test(`stage preserves workspace graph failure classification during ${phase}`, async () => {
    for (const scope of ["index", "all", "domain"] as const) {
      await withTempRoot("stage-workspace-graph-failure", async (root) => {
        await prepare(root);
        const target = path.join(root, indexRelativePath);
        const index = parseJsonObject(await fs.readFile(target, "utf8"));
        jsonObjectMember(jsonObjectMember(index, "entries"), "one").relations =
          [{ type: "补充", target: "missing" }];
        const invalidText = JSON.stringify(index);
        const before = git(root, ["ls-files", "--stage"]);
        if (phase === "preparation") await fs.writeFile(target, invalidText);
        let changed = phase === "preparation";
        const result = await onWorkspaceIndexRead(
          root,
          indexRelativePath,
          async (count) => {
            if (phase === "independent verification" && count === 1) {
              changed = true;
              await fs.writeFile(target, invalidText);
            }
          },
          () => stage(root, scope)
        );
        assert.equal(changed, true);
        assert.equal(result.status, "error", JSON.stringify(result));
        assert.equal(
          result.state,
          phase === "preparation" ? "domain-stage-failed" : "source-drift"
        );
        assert.ok(
          result.diagnostics.some(
            (item) =>
              item.code ===
              (phase === "preparation"
                ? "investigation-report.stage-workspace-index-invalid"
                : "investigation-report.stage-source-drift")
          )
        );
        assert.equal(git(root, ["ls-files", "--stage"]), before);
        assert.equal(await fs.readFile(target, "utf8"), invalidText);
      });
    }
  });
}

test("stage reuses same-call index parses after independent actual W and P payload reads", async () => {
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
        "one"
      ).title,
      "Updated selected"
    );
  });
});

test("stage reparses changed actual W bytes even when decoded projection is identical", async () => {
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
        "one"
      ).title,
      "Updated selected"
    );
  });
});

test("stage validates changed fresh pending index before reporting identity conflict", async () => {
  await withTempRoot("stage-pending-invalid-priority", async (root) => {
    await prepare(root);
    await assertFreshInvalidPendingIndex(root, indexRelativePath, () =>
      stage(root)
    );
  });
});
