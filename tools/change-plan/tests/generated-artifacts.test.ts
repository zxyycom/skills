import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  generatedCliPath,
  generatedDeclarationDirectory,
  generatedDeclarationPath,
  generatedMetadataSchemaPath
} from "./support.ts";

test("generated artifacts expose the public API and portable source metadata", async () => {
  const cliSource = await fs.readFile(generatedCliPath, "utf8");
  assert.match(
    cliSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/change-plan\/src\/cli\.ts/u
  );
  assert.match(cliSource, /Rebuild: bun run sync:change-plan-cli/u);
  assert.match(cliSource, /sourceMappingURL=change-plan\.mjs\.map/u);

  const declarationSource = await fs.readFile(generatedDeclarationPath, "utf8");
  assert.match(
    declarationSource,
    /export \* from "\.\/change-plan-sdk\/cli\.mjs"/u
  );
  const cliDeclaration = await fs.readFile(
    path.join(generatedDeclarationDirectory, "cli.d.mts"),
    "utf8"
  );
  for (const publicApi of [
    "archiveChangePlanDirectory",
    "checkChangePlanDirectory",
    "implementChangePlanDirectory",
    "listChangePlans",
    "parseChangePlanMetadata",
    "planChangePlanDirectory",
    "readChangePlanMetadata",
    "reconcileChangePlanDirectory",
    "resumeChangePlanDirectory",
    "runChangePlanCli",
    "shelveChangePlanDirectory",
    "showChangePlanDirectory"
  ]) {
    assert.match(cliDeclaration, new RegExp(`\\b${publicApi}\\b`, "u"));
  }

  const typesDeclaration = await fs.readFile(
    path.join(generatedDeclarationDirectory, "types.d.mts"),
    "utf8"
  );
  assert.match(typesDeclaration, /ChangePlanArtifactCheckResult/u);
  assert.match(typesDeclaration, /targetStage: ChangePlanStage/u);
  assert.match(typesDeclaration, /assessment: ChangePlanAssessment \| null/u);
  assert.match(typesDeclaration, /errorCode: ChangePlanLifecycleErrorCode/u);
  assert.match(typesDeclaration, /action: "reconcile"/u);
  assert.match(typesDeclaration, /change-directory-read-failed/u);

  const metadataDeclaration = await fs.readFile(
    path.join(generatedDeclarationDirectory, "metadata.d.mts"),
    "utf8"
  );
  assert.match(metadataDeclaration, /ChangePlanMetadataErrorCode/u);
  assert.match(metadataDeclaration, /parseChangePlanMetadata/u);
  assert.match(metadataDeclaration, /readChangePlanMetadata/u);
  assert.doesNotMatch(metadataDeclaration, /writeChangePlanMetadata/u);
  assert.doesNotMatch(metadataDeclaration, /valibot/u);
  assert.doesNotMatch(metadataDeclaration, /changePlanMetadataSchema/u);

  const metadataTypeDeclaration = await fs.readFile(
    path.join(
      generatedDeclarationDirectory,
      "change-plan-metadata.types.d.mts"
    ),
    "utf8"
  );
  assert.match(metadataTypeDeclaration, /stage: "draft"/u);
  assert.match(metadataTypeDeclaration, /stage: "plan"/u);
  assert.match(metadataTypeDeclaration, /stage: "implementation"/u);
  assert.match(metadataTypeDeclaration, /stage: "shelved"/u);
  assert.match(metadataTypeDeclaration, /source: "git-distance-v1"/u);

  const metadataSchema = await fs.readFile(
    generatedMetadataSchemaPath,
    "utf8"
  );
  assert.match(metadataSchema, /"additionalProperties": false/u);
  assert.match(metadataSchema, /"maximum": 9007199254740991/u);
  assert.match(metadataSchema, /"pattern": "\^\\\\S\+\$"/u);
  assert.match(metadataSchema, /"title": "ChangePlanMetadata"/u);

  const sourceMap = JSON.parse(
    await fs.readFile(`${generatedCliPath}.map`, "utf8")
  ) as {
    sourceRoot: string;
    sources: string[];
  };
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("tools/change-plan/src/cli.ts"));
  assert.ok(sourceMap.sources.includes("tools/change-plan/src/lifecycle.ts"));
  assert.ok(sourceMap.sources.includes("tools/change-plan/src/metadata.ts"));
  assert.ok(
    sourceMap.sources.every(
      (source) => !path.isAbsolute(source) && !source.includes("\\")
    )
  );
});
