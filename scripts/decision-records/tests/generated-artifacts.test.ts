import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { decisionIndexJsonSchema } from "../src/decision-index-json-schema.ts";
import {
  generatedCliPath,
  generatedDeclarationPath,
  generatedSchemaPath,
  generatedUpdaterPath
} from "./support.ts";

const cliSource = await fs.readFile(generatedCliPath, "utf8");
assert.match(cliSource, /Repository: https:\/\/github\.com\/zxyycom\/skills/);
assert.match(
  cliSource,
  /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/decision-records\/src\/cli\.ts/
);
assert.match(cliSource, /Source path: scripts\/decision-records\/src\/cli\.ts/);
assert.match(
  cliSource,
  /Skill source directory: https:\/\/github\.com\/zxyycom\/skills\/tree\/main\/skills\/decision-records/
);
assert.match(cliSource, /Rebuild: bun run sync:decision-records-cli/);
assert.match(cliSource, /sourceMappingURL=decision-records\.mjs\.map/);

const declarationSource = await fs.readFile(generatedDeclarationPath, "utf8");
assert.match(
  declarationSource,
  /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/decision-records\/decision-records\.d\.mts/
);
assert.match(declarationSource, /validateDecisionRecords/);
assert.match(declarationSource, /runDecisionRecordsCli/);
assert.match(declarationSource, /DecisionProjection/);
assert.match(declarationSource, /DecisionAlignment/);
assert.match(declarationSource, /schemaVersion: 4/);

const distributedSchema: unknown = JSON.parse(
  await fs.readFile(generatedSchemaPath, "utf8")
);
assert.deepEqual(distributedSchema, decisionIndexJsonSchema);
assert.equal(
  decisionIndexJsonSchema.$schema,
  "https://json-schema.org/draft/2020-12/schema"
);
assert.deepEqual(
  decisionIndexJsonSchema.$defs.record.required,
  [
    "path",
    "status",
    "alignment",
    "createdAt",
    "title",
    "purpose",
    "background",
    "decision",
    "relations"
  ]
);

const cliSourceMap = JSON.parse(
  await fs.readFile(`${generatedCliPath}.map`, "utf8")
) as {
  sourceRoot: string;
  sources: string[];
};
assert.equal(cliSourceMap.sourceRoot, "../../../");
assert.ok(cliSourceMap.sources.includes("scripts/decision-records/src/cli.ts"));
assert.ok(cliSourceMap.sources.every(
  (source) => !path.isAbsolute(source) && !source.includes("\\")
));

const updaterSource = await fs.readFile(generatedUpdaterPath, "utf8");
assert.match(updaterSource, /Repository: https:\/\/github\.com\/zxyycom\/skills/);
assert.match(
  updaterSource,
  /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/templates\/update-skill\.ts/
);
assert.match(updaterSource, /Rebuild: bun run sync:skill-updaters/);
assert.match(updaterSource, /sourceMappingURL=update-skill\.mjs\.map/);

const updaterSourceMap = JSON.parse(
  await fs.readFile(`${generatedUpdaterPath}.map`, "utf8")
) as {
  sourceRoot: string;
  sources: string[];
};
assert.equal(updaterSourceMap.sourceRoot, "../../../");
assert.ok(updaterSourceMap.sources.includes("scripts/templates/update-skill.ts"));
assert.ok(updaterSourceMap.sources.every(
  (source) => !path.isAbsolute(source) && !source.includes("\\")
));
