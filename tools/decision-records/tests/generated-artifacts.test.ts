import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { decisionIndexJsonSchema } from "../src/decision-index-json-schema.ts";
import {
  generatedCliPath,
  generatedDeclarationPath,
  generatedSchemaPath,
  generatedUpdaterPath,
} from "./support.ts";

test("generated decision artifacts expose the tagged ID contract and portable metadata", async () => {
  const cliSource = await fs.readFile(generatedCliPath, "utf8");
  assert.match(cliSource, /Source path: tools\/decision-records\/src\/cli\.ts/);
  assert.match(cliSource, /Rebuild: bun run sync:decision-records-cli/);
  assert.match(cliSource, /sourceMappingURL=decision-records\.mjs\.map/);

  const declarationSource = await fs.readFile(generatedDeclarationPath, "utf8");
  assert.match(declarationSource, /DecisionId/);
  assert.match(declarationSource, /sourcePath: string/);
  assert.match(declarationSource, /tags: string\[\]/);
  assert.match(
    declarationSource,
    /DecisionIndexMetadata = Record<string, never>/,
  );
  assert.doesNotMatch(declarationSource, /DecisionDomainDefinition/);
  assert.doesNotMatch(declarationSource, /domains:/);

  const distributedSchema: unknown = JSON.parse(
    await fs.readFile(generatedSchemaPath, "utf8"),
  );
  assert.deepEqual(distributedSchema, decisionIndexJsonSchema);
  assert.equal(decisionIndexJsonSchema.properties.definitionVersion.const, 6);
  assert.deepEqual(decisionIndexJsonSchema.properties.keyDefinitions.const, [
    { name: "tag", mode: "exact" },
    { name: "status", mode: "exact" },
    { name: "alignment", mode: "exact" },
  ]);
  assert.ok(
    decisionIndexJsonSchema.$defs.state.required.includes("sourcePath"),
  );
  assert.ok(decisionIndexJsonSchema.$defs.state.required.includes("tags"));

  const cliSourceMap = JSON.parse(
    await fs.readFile(`${generatedCliPath}.map`, "utf8"),
  ) as { sourceRoot: string; sources: string[] };
  assert.equal(cliSourceMap.sourceRoot, "../../../");
  assert.ok(cliSourceMap.sources.includes("tools/decision-records/src/cli.ts"));
  assert.ok(
    cliSourceMap.sources.every(
      (source) => !path.isAbsolute(source) && !source.includes("\\"),
    ),
  );

  const updaterSource = await fs.readFile(generatedUpdaterPath, "utf8");
  assert.match(updaterSource, /Rebuild: bun run sync:skill-updaters/);
});
