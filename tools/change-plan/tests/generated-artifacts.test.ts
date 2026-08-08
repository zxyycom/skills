import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { generatedCliPath } from "./support.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

test("generated runtime stays directly importable with portable source metadata", async () => {
  const cliSource = await fs.readFile(generatedCliPath, "utf8");
  assert.match(
    cliSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/change-plan\/src\/cli\.ts/u
  );
  assert.match(cliSource, /Rebuild: bun run sync:change-plan-cli/u);
  assert.match(cliSource, /sourceMappingURL=change-plan\.mjs\.map/u);

  const runtime: unknown = await import(
    pathToFileURL(generatedCliPath).href
  );
  assert.ok(isRecord(runtime));
  for (const runtimeExport of [
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
    assert.equal(typeof runtime[runtimeExport], "function");
  }

  const sourceMap: unknown = JSON.parse(
    await fs.readFile(`${generatedCliPath}.map`, "utf8")
  );
  assert.ok(isRecord(sourceMap));
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(isUnknownArray(sourceMap.sources));
  assert.ok(sourceMap.sources.includes("tools/change-plan/src/cli.ts"));
  assert.ok(sourceMap.sources.includes("tools/change-plan/src/lifecycle.ts"));
  assert.ok(sourceMap.sources.includes("tools/change-plan/src/metadata.ts"));
  assert.ok(
    sourceMap.sources.every(
      (source) => (
        typeof source === "string"
        && !path.isAbsolute(source)
        && !source.includes("\\")
      )
    )
  );
});
