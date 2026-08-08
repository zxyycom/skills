import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { implementChangePlanDirectory } from "../src/lifecycle.ts";
import { validBaseCommit, withTempRoot, writePlan } from "./support.ts";

test("lifecycle returns a stable version-control failure without metadata mutation", () => (
  withTempRoot("lifecycle-version-control", async (tempRoot) => {
    const changeDirectory = await writePlan(tempRoot, "unassessable-plan", {
      metadata: {
        baseCommit: validBaseCommit,
        schemaVersion: 1,
        stage: "plan"
      }
    });
    const metadataPath = path.join(changeDirectory, ".change-plan.json");
    const before = await fs.readFile(metadataPath, "utf8");
    const result = await implementChangePlanDirectory(changeDirectory);
    assert.equal(result.success, false);
    assert.equal(result.action, "implement");
    assert.equal(result.errorCode, "version-control-failed");
    assert.equal(result.fromStage, "plan");
    assert.equal(result.toStage, null);
    assert.match(result.error, /restore version-control access and retry/u);
    assert.equal(await fs.readFile(metadataPath, "utf8"), before);
  })
));
