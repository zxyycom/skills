import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { generatedCliPath, repositoryRoot } from "./support.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

test("generated runtime stays directly importable with portable source metadata", async () => {
  const cliSource = await fs.readFile(generatedCliPath, "utf8");
  assert.match(
    cliSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/change-plan\/src\/cli\.ts/u
  );
  assert.match(cliSource, /Rebuild: bun run sync:change-plan-cli/u);
  assert.match(cliSource, /runtime\/tools\/change-plan\/src\/cli\.ts/u);
  assert.match(cliSource, /Installed skill copies may be edited directly/u);
  assert.equal(cliSource.includes(repositoryRoot), false);
  assert.doesNotMatch(
    cliSource,
    /archiveChangePlanDirectory|completeChangePlanDirectory/u
  );
  assert.equal(
    cliSource.includes(repositoryRoot.replaceAll("\\", "\\\\")),
    false
  );

  const runtime: unknown = await import(pathToFileURL(generatedCliPath).href);
  assert.ok(isRecord(runtime));
  assert.equal(runtime.completeChangePlanDirectory, undefined);
  for (const runtimeExport of [
    "finalizeChangePlanDirectory",
    "checkChangePlanCollection",
    "checkChangePlanDirectory",
    "listChangePlans",
    "parseChangePlanMetadata",
    "planChangePlanDirectory",
    "readChangePlanMetadata",
    "runChangePlanCli",
    "showChangePlanDirectory"
  ]) {
    assert.equal(typeof runtime[runtimeExport], "function");
  }

  await assert.rejects(
    fs.stat(`${generatedCliPath.replace(/\.ts$/u, ".mjs")}.map`),
    { code: "ENOENT" }
  );
  const copiedLifecycle = await fs.readFile(
    path.join(
      path.dirname(generatedCliPath),
      "runtime/tools/change-plan/src/lifecycle.ts"
    ),
    "utf8"
  );
  assert.match(copiedLifecycle, /Synced TypeScript runtime/u);
  assert.match(copiedLifecycle, /from "\.\/metadata\.ts"/u);
});
