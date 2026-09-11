import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSkillPackageSnapshotHash,
  getSkillPackageVersionIssues
} from "./skill-package-hash.ts";
import {
  alphaBaselineFiles,
  readBaseline,
  removeSnapshotFile,
  replaceSnapshotFile,
  skillMarkdown,
  skillPackageSnapshot,
  skillPackageSnapshotFromBaseline,
  versionGateBaselineFiles,
  versionIssues
} from "./skill-package-hash-test-support.ts";

test("requires changed skills to increase independent versions", async () => {
  const baselineFiles = alphaBaselineFiles();
  const unchangedVersion = skillPackageSnapshot({
    "SKILL.md": skillMarkdown("alpha", 3, "changed")
  });
  const baseline = await readBaseline(unchangedVersion, baselineFiles);
  assert.deepEqual(baseline.skills, { alpha: 3 });
  assert.match(
    getSkillPackageVersionIssues(
      calculateSkillPackageSnapshotHash(unchangedVersion),
      baseline
    )[0] ?? "",
    /increase skills\/alpha\/SKILL\.md metadata\.version above 3/
  );

  const incrementedVersion = skillPackageSnapshot({
    "SKILL.md": skillMarkdown("alpha", 4, "changed")
  });
  assert.deepEqual(
    getSkillPackageVersionIssues(
      calculateSkillPackageSnapshotHash(incrementedVersion),
      await readBaseline(incrementedVersion, baselineFiles)
    ),
    []
  );
});

test("does not require a version for linked source map edits, additions, or deletions", async () => {
  const baselineFiles = versionGateBaselineFiles();
  const base = skillPackageSnapshotFromBaseline(baselineFiles);
  const changedMap = replaceSnapshotFile(
    base,
    "scripts/cli.mjs.map",
    "edited source map\n"
  );
  assert.deepEqual(await versionIssues(changedMap, baselineFiles), []);

  const deletedMap = removeSnapshotFile(base, "scripts/cli.mjs.map");
  assert.deepEqual(await versionIssues(deletedMap, baselineFiles), []);

  const noMapBaseline = { ...baselineFiles };
  delete noMapBaseline["skills/alpha/scripts/cli.mjs.map"];
  const addedMap = replaceSnapshotFile(
    skillPackageSnapshotFromBaseline(noMapBaseline),
    "scripts/cli.mjs.map",
    "new source map\n"
  );
  assert.deepEqual(await versionIssues(addedMap, noMapBaseline), []);

  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(base, "debug.mjs.map", "edited\n"),
        baselineFiles
      )
    ).length,
    1
  );
  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(base, "scripts/template.mjs.map", "edited\n"),
        baselineFiles
      )
    ).length,
    1
  );
  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(base, "scripts/fake.mjs.map", "edited\n"),
        baselineFiles
      )
    ).length,
    1
  );
});

test("requires a version for runtime and declaration semantic package changes", async () => {
  const baselineFiles = versionGateBaselineFiles();
  const base = skillPackageSnapshotFromBaseline(baselineFiles);
  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(
          base,
          "scripts/cli.mjs",
          "export const v = 2;\n//# sourceMappingURL=cli.mjs.map\n"
        ),
        baselineFiles
      )
    ).length,
    1
  );
  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(
          base,
          "api.d.mts",
          "export declare const value: number;\n"
        ),
        baselineFiles
      )
    ).length,
    1
  );
});

test("ignores declaration formatting but not declaration semantics for versioning", async () => {
  const baselineFiles = versionGateBaselineFiles();
  const base = skillPackageSnapshotFromBaseline(baselineFiles);
  assert.deepEqual(
    await versionIssues(
      replaceSnapshotFile(
        base,
        "api.d.mts",
        "export type Item = ( typeof values )[ number ];\n"
      ),
      baselineFiles
    ),
    []
  );
  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(
          base,
          "api.d.mts",
          "export type Item = (typeof values)[number | string];\n"
        ),
        baselineFiles
      )
    ).length,
    1
  );
});

test("aggregate hashes retain raw source map and declaration bytes", () => {
  const baseSnapshot = skillPackageSnapshot({
    "api.d.mts": "export type Item = (typeof values)[number];\n",
    "scripts/cli.mjs":
      "export const value = 1;\n//# sourceMappingURL=cli.mjs.map\n",
    "scripts/cli.mjs.map": '{"version":3,"mappings":"AAAA"}\n',
    "SKILL.md": skillMarkdown("alpha", 3, "unchanged")
  });
  const changedMapSnapshot = replaceSnapshotFile(
    baseSnapshot,
    "scripts/cli.mjs.map",
    '{"version":3,"mappings":"AAAB"}\n'
  );
  const reformattedDeclarationSnapshot = replaceSnapshotFile(
    baseSnapshot,
    "api.d.mts",
    "export type Item = ( typeof values )[ number ];\n"
  );

  const baseHash =
    calculateSkillPackageSnapshotHash(baseSnapshot).aggregateHash;
  assert.notEqual(
    calculateSkillPackageSnapshotHash(changedMapSnapshot).aggregateHash,
    baseHash
  );
  assert.notEqual(
    calculateSkillPackageSnapshotHash(reformattedDeclarationSnapshot)
      .aggregateHash,
    baseHash
  );
});
