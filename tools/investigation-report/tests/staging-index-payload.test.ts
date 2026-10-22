import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationReports } from "../src/staging.ts";
import { git, initializeGit } from "./git-support.ts";
import {
  indexRelativePath,
  jsonObjectMember,
  parseJsonObject,
  withTempRoot
} from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

const otherPath = "docs/investigations/two.md";
const stage = (root: string, scope: "index" | "all" | "domain" = "index") =>
  stageInvestigationReports({ workspaceRoot: root, reportIds: ["one"], scope });

function objectPath(root: string, file: string): string {
  const oid = git(root, ["rev-parse", `:${file}`]).trim();
  return path.join(root, ".git/objects", oid.slice(0, 2), oid.slice(2));
}

async function prepare(root: string): Promise<void> {
  await writeCollection(root, [{ id: "one" }, { id: "two" }]);
  initializeGit(root);
  await writeCollection(root, [
    { id: "one", title: "Updated selected" },
    { id: "two" }
  ]);
}

async function onWorkspaceIndexRead<T>(
  root: string,
  callback: (count: number) => Promise<void>,
  run: () => Promise<T>
): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
  assert.ok(descriptor !== undefined);
  const original = fs.readFile;
  let count = 0;
  Object.defineProperty(fs, "readFile", {
    ...descriptor,
    value: async (...args: readonly unknown[]) => {
      const result: unknown = await Reflect.apply(original, fs, args);
      if (args[0] === path.join(root, indexRelativePath)) {
        count += 1;
        await callback(count);
      }
      return result;
    }
  });
  try {
    return await run();
  } finally {
    Object.defineProperty(fs, "readFile", descriptor);
  }
}

for (const failure of ["missing", "corrupt", "type"]) {
  test(`stage index permits non-index pending ${failure} payload while all and domain retain full validation`, async () => {
    await withTempRoot("stage-index-narrow", async (root) => {
      await prepare(root);
      const target = objectPath(root, otherPath);
      if (failure === "missing") await fs.unlink(target);
      if (failure === "corrupt") {
        await fs.chmod(target, 0o600);
        await fs.writeFile(target, "not a valid compressed object");
      }
      if (failure === "type")
        git(root, [
          "update-index",
          "--cacheinfo",
          `100644,${git(root, ["rev-parse", "HEAD^{tree}"]).trim()},${otherPath}`
        ]);
      const before = git(root, ["ls-files", "--stage"]);
      for (const scope of ["all", "domain"] as const) {
        const full = await stage(root, scope);
        assert.equal(full.status, "error");
        assert.equal(full.state, "domain-stage-failed");
        assert.ok(
          full.diagnostics.some(
            (diagnostic) =>
              diagnostic.code ===
              "investigation-report.stage-pending-read-failed"
          )
        );
        assert.equal(git(root, ["ls-files", "--stage"]), before);
      }
      const result = await stage(root);
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.deepEqual(result.writtenPaths, [indexRelativePath]);
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
          .filter((line) => !line.endsWith(indexRelativePath)),
        before.split("\n").filter((line) => !line.endsWith(indexRelativePath))
      );
      const unchanged = await stage(root);
      assert.equal(unchanged.state, "unchanged");
    });
  });
}

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
    assert.equal(jsonObjectMember(entries, "two").title, "two");
    assert.equal(jsonObjectMember(entries, "three").title, "three");
  });
});

for (const drift of ["oid", "mode", "member"]) {
  test(`stage index independently rejects full pending ${drift} drift before writing`, async () => {
    await withTempRoot("stage-index-pending-drift", async (root) => {
      await prepare(root);
      let before = "";
      let changed = false;
      const result = await onWorkspaceIndexRead(
        root,
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
          if (drift === "member") git(root, ["rm", "--cached", otherPath]);
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
      // Give pending its own object so fixed HEAD baseline remains readable.
      const target = path.join(root, indexRelativePath);
      const workspace = await fs.readFile(target);
      await fs.appendFile(target, "\n");
      git(root, ["add", indexRelativePath]);
      await fs.writeFile(target, workspace);
      const requiredObject = objectPath(root, indexRelativePath);
      const before = git(root, ["ls-files", "--stage"]);
      let removed = false;
      if (phase === "preparation") {
        await fs.unlink(requiredObject);
        removed = true;
      }
      const result = await onWorkspaceIndexRead(
        root,
        async (count) => {
          if (phase === "independent verification" && count === 2) {
            await fs.unlink(requiredObject);
            removed = true;
          }
        },
        () => stage(root)
      );
      assert.equal(removed, true);
      assert.equal(result.state, "domain-stage-failed", JSON.stringify(result));
      assert.ok(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "investigation-report.stage-pending-read-failed"
        )
      );
      assert.equal(git(root, ["ls-files", "--stage"]), before);
    });
  });
}

test("stage index acquires one preparation pending payload then independent locked and readback payloads", async () => {
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
        assert.equal(
          result.state,
          round === "changed" ? "staged" : "unchanged"
        );
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
