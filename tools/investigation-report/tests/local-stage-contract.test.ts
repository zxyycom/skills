import { validateDomainReportSources } from "../src/staging-domain-sources.ts";
import {
  domainStageControl,
  resolveDomainSelection,
  verifyDomainIndex
} from "../src/staging-domain-context.ts";
import {
  verifyDomainWrites,
  type DomainWritesAcquisition
} from "../src/staging-domain-writes.ts";
import { loadInvestigationIndex } from "../src/investigation-state-index.ts";
import type { VersionControlFile } from "../../shared/src/version-control/index.ts";
import {
  buildStateIndexFromSnapshot,
  selectTargetSnapshot
} from "../../index-runtime/src/index.ts";
import { investigationIndexFixture } from "./index-fixture.ts";
import { createInvestigationStageIndexDefinition } from "../src/staging-domain-index.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationReports } from "../src/staging.ts";
import { git, initializeGit } from "./git-support.ts";
import {
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  reportMarkdown,
  withTempRoot
} from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

async function observeReads<T>(
  root: string,
  run: () => Promise<T>,
  onRead?: (target: string) => Promise<void>
) {
  const original = fs.readFile;
  const paths: string[] = [];
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    const value = await original(...args);
    const target = typeof args[0] === "string" ? args[0] : "";
    if (target.startsWith(investigationRoot(root) + path.sep)) {
      paths.push(path.relative(investigationRoot(root), target));
      await onRead?.(target);
    }
    return value;
  }) as typeof fs.readFile;
  try {
    return { result: await run(), paths };
  } finally {
    fs.readFile = original;
  }
}

const stage = (root: string, scope: "all" | "domain" | "index") =>
  stageInvestigationReports({ workspaceRoot: root, scope, reportIds: ["one"] });

test("local investigation stage ignores unrelated malformed and missing bodies and reads selected sources once per phase", async () => {
  await withTempRoot("stage-local-sources", async (root) => {
    await writeCollection(root, [
      { id: "one" },
      { id: "two" },
      { id: "three" }
    ]);
    initializeGit(root);
    await fs.writeFile(
      path.join(investigationRoot(root), "two.md"),
      "malformed unrelated body"
    );
    await fs.rm(path.join(investigationRoot(root), "three.md"));
    for (const scope of ["domain", "all"] as const) {
      const observed = await observeReads(root, () => stage(root, scope));
      assert.equal(observed.result.status, "ok");
      assert.deepEqual(
        observed.paths.filter((name) => name.endsWith(".md")),
        ["one.md", "one.md"]
      );
      assert.equal(
        observed.paths.filter((name) => name.endsWith(".json")).length,
        2
      );
    }
    const indexed = await observeReads(root, () => stage(root, "index"));
    assert.equal(indexed.result.status, "ok");
    assert.deepEqual(
      indexed.paths.filter((name) => name.endsWith(".md")),
      []
    );
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
  });
});

test("domain source selection includes direct resource owners without selecting them for publication and rejects their drift", async () => {
  await withTempRoot("stage-owner-dependency", async (root) => {
    const resource = "owner/sample.txt";
    await fs.mkdir(path.join(investigationRoot(root), "_resources/owner"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(investigationRoot(root), "_resources", resource),
      "sample\n"
    );
    await writeCollection(root, [
      { id: "one", resources: [resource] },
      { id: "owner", resources: [resource] },
      { id: "other" }
    ]);
    const loaded = await loadInvestigationIndex({
      investigationsDirectory: investigationRoot(root)
    });
    assert.ok(loaded.status === "ok");
    await fs.writeFile(
      path.join(investigationRoot(root), "other.md"),
      "unrelated malformed"
    );
    const resolved = resolveDomainSelection(
      {
        baseline: loaded.value,
        workspaceIndex: loaded.value,
        pendingIndex: loaded.value,
        pendingReportPaths: new Map()
      },
      domainStageControl({
        investigationsDirectory: investigationRoot(root),
        reportIds: ["one"],
        scope: "domain"
      })
    );
    assert.equal(resolved.status, "ok");
    if (resolved.status !== "ok") assert.fail("dependency selection failed");
    assert.deepEqual(resolved.value.selectedIds, ["one"]);
    const selection = resolved.value.sourceSelection;
    assert.deepEqual(selection, {
      deletedIds: [],
      reportIds: ["one", "owner"],
      resourceIds: [resource]
    });
    const observed = await observeReads(root, async () => {
      for (let phase = 0; phase < 2; phase += 1) {
        const files = new Map<string, VersionControlFile>();
        for (const id of selection.reportIds) {
          const relative = `docs/investigations/${loaded.value.entries[id]!.sourcePath}`;
          files.set(relative, {
            path: relative,
            kind: "regular",
            data: await fs.readFile(path.join(root, relative))
          });
        }
        validateDomainReportSources({
          files,
          index: loaded.value,
          investigationsScope: "docs/investigations",
          selection
        });
      }
    });
    assert.deepEqual(
      observed.paths.filter((name) => name.endsWith(".md")).sort(),
      ["one.md", "one.md", "owner.md", "owner.md"]
    );
    const ownerPath = path.join(investigationRoot(root), "owner.md");
    await fs.writeFile(ownerPath, reportMarkdown({ id: "owner" }));
    const files = new Map<string, VersionControlFile>();
    for (const id of selection.reportIds) {
      const relative = `docs/investigations/${loaded.value.entries[id]!.sourcePath}`;
      files.set(relative, {
        path: relative,
        kind: "regular",
        data: await fs.readFile(path.join(root, relative))
      });
    }
    assert.throws(
      () =>
        validateDomainReportSources({
          files,
          index: loaded.value,
          investigationsScope: "docs/investigations",
          selection
        }),
      /required owner changed from the published source/u
    );
    assert.equal(
      await fs.readFile(ownerPath, "utf8"),
      reportMarkdown({ id: "owner" })
    );
  });
});

test("investigation index stage validates global metadata relations and the final selective projection without bodies", () => {
  const baseline = investigationIndexFixture([{ id: "one" }]);
  const workspace = investigationIndexFixture([
    { id: "one", relations: [{ type: "补充", target: "new" }] },
    { id: "new" }
  ]);
  const definition = createInvestigationStageIndexDefinition();
  const target = buildStateIndexFromSnapshot(
    definition,
    selectTargetSnapshot(baseline, workspace, new Set(["one"]))
  );
  assert.equal(target.status, "error");
  assert.ok(
    target.diagnostics.some((diagnostic) => diagnostic.message.includes("new"))
  );
  const invalid = investigationIndexFixture([
    { id: "one", relations: [{ type: "补充", target: "missing" }] }
  ]);
  assert.throws(() => definition.validateIndex?.(invalid), /missing/u);
});

test("domain index verification rejects mutable published index drift", async () => {
  await withTempRoot("stage-index-drift", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    const loaded = await loadInvestigationIndex({
      investigationsDirectory: investigationRoot(root)
    });
    assert.ok(loaded.status === "ok");
    const snapshot = {
      baseline: null,
      revision: null,
      workspaceIndex: loaded.value,
      canonicalDefinition: createInvestigationStageIndexDefinition()
    };
    const control = domainStageControl({
      investigationsDirectory: investigationRoot(root),
      reportIds: ["one"],
      scope: "all"
    });
    assert.deepEqual(await verifyDomainIndex(snapshot, control), {
      status: "ok"
    });
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const index = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    jsonObjectMember(jsonObjectMember(index, "entries"), "one").title =
      "changed metadata";
    await fs.writeFile(indexPath, JSON.stringify(index));
    const result = await verifyDomainIndex(snapshot, control);
    assert.equal(result.status, "error");
    if (result.status !== "error")
      assert.fail("changed published index accepted");
    assert.equal(
      result.diagnostics[0]?.code,
      "investigation-report.stage-source-drift"
    );
    assert.match(
      result.diagnostics[0]?.message ?? "",
      /published workspace index changed/u
    );
  });
});

test("domain phase comparison rechecks required owner and shared resource bytes", async () => {
  for (const driftingPath of ["owner.md", "_resources/owner/sample.txt"]) {
    await withTempRoot("stage-dependency-drift", async (root) => {
      const resource = "owner/sample.txt";
      await fs.mkdir(path.join(investigationRoot(root), "_resources/owner"), {
        recursive: true
      });
      await fs.writeFile(
        path.join(investigationRoot(root), "_resources", resource),
        "sample\n"
      );
      await writeCollection(root, [
        { id: "one", resources: [resource] },
        { id: "owner", resources: [resource] }
      ]);
      let changed = false;
      const observed = await observeReads(
        root,
        async () => {
          const phases: DomainWritesAcquisition[] = [];
          for (let phase = 0; phase < 2; phase += 1) {
            const sourceFiles: VersionControlFile[] = [];
            for (const relative of [
              "one.md",
              "owner.md",
              "_resources/owner/sample.txt"
            ]) {
              sourceFiles.push({
                path: `docs/investigations/${relative}`,
                kind: "regular",
                data: await fs.readFile(
                  path.join(investigationRoot(root), relative)
                )
              });
            }
            phases.push({
              status: "ok",
              sourceFiles,
              value: [sourceFiles[0]!],
              pending: {
                pathScope: "docs/investigations",
                files: [],
                members: []
              }
            });
          }
          return verifyDomainWrites(phases[0]!, phases[1]!);
        },
        async (target) => {
          if (
            target === path.join(investigationRoot(root), driftingPath) &&
            !changed
          ) {
            changed = true;
            await fs.appendFile(target, "\ndependency drift\n");
          }
        }
      );
      assert.equal(observed.result.status, "drift");
      if (observed.result.status !== "drift")
        assert.fail("required source drift was accepted");
      assert.match(
        observed.result.reason,
        /required owner bytes or representation changed/u
      );
      assert.equal(
        observed.paths.filter((name) => name === driftingPath).length,
        2
      );
      assert.equal(changed, true);
      assert.ok(
        (
          await fs.readFile(
            path.join(investigationRoot(root), driftingPath),
            "utf8"
          )
        ).endsWith("\ndependency drift\n")
      );
    });
  }
});
