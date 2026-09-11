import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { checkChangePlanDirectory } from "../src/check.ts";
import { changePlanMetadataName } from "../src/types.ts";
import { validBaseCommit, writePlan } from "./support.ts";

export async function testActiveMetadataBoundaries(
  tempRoot: string
): Promise<void> {
  const headCommit = validBaseCommit;
  const invalidCases = [
    ["null-base", { baseCommit: null, stage: "plan" }],
    [
      "implementation",
      {
        baseCommit: headCommit,
        stage: "implementation"
      }
    ],
    [
      "shelved",
      {
        baseCommit: headCommit,
        shelf: {
          atCommit: headCommit,
          reason: "等待上游方向确定",
          source: "explicit"
        },
        stage: "shelved"
      }
    ],
    ["extra-field", { extra: true, stage: "draft" }]
  ] as const;
  for (const [name, metadata] of invalidCases) {
    const directory = await writePlan(path.join(tempRoot, "changes"), name, {
      metadata
    });
    const result = await checkChangePlanDirectory(directory);
    assert.equal(result.valid, false);
    assert.equal(result.stage, null);
    assert.equal(result.metadata, null);
    assert.equal(result.distance, null);
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "invalid-metadata" &&
          diagnostic.file === changePlanMetadataName
      )
    );
  }

  const missingMetadataDirectory = await writePlan(
    path.join(tempRoot, "changes"),
    "missing-metadata",
    { metadata: null }
  );
  const missingMetadataResult = await checkChangePlanDirectory(
    missingMetadataDirectory
  );
  assert.ok(
    missingMetadataResult.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "missing-required-file" &&
        diagnostic.file === changePlanMetadataName
    )
  );
}

export async function testVersionControlFailure(
  tempRoot: string
): Promise<void> {
  const nestedRepository = path.join(tempRoot, "broken-repository");
  await fs.mkdir(nestedRepository);
  await fs.writeFile(path.join(nestedRepository, ".git"), "gitdir: missing\n");
  const planDirectory = await writePlan(
    path.join(nestedRepository, "changes"),
    "unassessable-plan",
    {
      metadata: { baseCommit: validBaseCommit, stage: "plan" }
    }
  );
  const result = await checkChangePlanDirectory(planDirectory);
  assert.equal(result.distance, null);
  assert.equal(result.valid, false);
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "version-control-failed" &&
        diagnostic.file === changePlanMetadataName
    )
  );
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "base-commit-unavailable"
    ),
    false
  );
}
