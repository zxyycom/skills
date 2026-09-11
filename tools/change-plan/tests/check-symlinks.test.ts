import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { checkChangePlanDirectory } from "../src/check.ts";
import { changePlanMetadataName } from "../src/types.ts";
import { validDesign, writePlan } from "./support.ts";

export async function testSymbolicLinkDiagnostics(
  tempRoot: string
): Promise<void> {
  const targetDirectory = await writePlan(
    path.join(tempRoot, "changes"),
    "linked-target",
    {
      metadata: { stage: "draft" }
    }
  );
  const linkedDirectory = path.join(tempRoot, "changes", "linked-change");
  await fs.symlink(
    targetDirectory,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir"
  );
  const linkedDirectoryResult = await checkChangePlanDirectory(linkedDirectory);
  assert.equal(linkedDirectoryResult.distance, null);
  assert.ok(
    linkedDirectoryResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "change-path-not-directory"
    )
  );

  const linkedArtifactDirectory = await writePlan(
    path.join(tempRoot, "changes"),
    "linked-artifact",
    {
      metadata: { stage: "draft" }
    }
  );
  const designTarget = path.join(tempRoot, "design-target.md");
  await fs.writeFile(designTarget, validDesign, "utf8");
  await fs.rm(path.join(linkedArtifactDirectory, "design.md"));
  await fs.symlink(
    designTarget,
    path.join(linkedArtifactDirectory, "design.md"),
    "file"
  );
  const linkedArtifactResult = await checkChangePlanDirectory(
    linkedArtifactDirectory
  );
  assert.ok(
    linkedArtifactResult.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "required-path-not-file" &&
        diagnostic.file === "design.md"
    )
  );

  const linkedMetadataDirectory = await writePlan(
    path.join(tempRoot, "changes"),
    "linked-metadata",
    {
      metadata: { stage: "draft" }
    }
  );
  const metadataPath = path.join(
    linkedMetadataDirectory,
    changePlanMetadataName
  );
  const metadataTarget = path.join(tempRoot, "metadata-target.json");
  await fs.rename(metadataPath, metadataTarget);
  await fs.symlink(metadataTarget, metadataPath, "file");
  const linkedMetadataResult = await checkChangePlanDirectory(
    linkedMetadataDirectory
  );
  assert.ok(
    linkedMetadataResult.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "required-path-not-file" &&
        diagnostic.file === changePlanMetadataName
    )
  );
}
