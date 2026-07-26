import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  generatedCliPath,
  generatedDeclarationPath
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
  assert.match(declarationSource, /archiveChangePlanDirectory/u);
  assert.match(declarationSource, /checkChangePlanDirectory/u);
  assert.match(declarationSource, /listChangePlans/u);
  assert.match(declarationSource, /runChangePlanCli/u);
  assert.match(declarationSource, /showChangePlanDirectory/u);
  assert.match(declarationSource, /archived: true/u);
  assert.match(declarationSource, /check: ChangePlanCheckResult \| null/u);
  assert.match(declarationSource, /change-directory-read-failed/u);

  const sourceMap = JSON.parse(
    await fs.readFile(`${generatedCliPath}.map`, "utf8")
  ) as {
    sourceRoot: string;
    sources: string[];
  };
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("tools/change-plan/src/cli.ts"));
  assert.ok(
    sourceMap.sources.every(
      (source) => !path.isAbsolute(source) && !source.includes("\\")
    )
  );
});
