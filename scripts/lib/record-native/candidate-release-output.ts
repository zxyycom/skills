import fs from "node:fs/promises";
import path from "node:path";
import type { assembleCandidateRelease } from "./candidate-release.ts";
import { assertRuntimeDirectory } from "./runtime.ts";

/** Write this explicit asset set only, in a new owned child; never enumerate or clear dist. */
export async function writeCandidateRelease(
  stage: string,
  release: ReturnType<typeof assembleCandidateRelease>
): Promise<string> {
  await assertRuntimeDirectory(stage);
  const output = path.join(stage, "candidate-release");
  await fs.mkdir(output);
  for (const item of release.assets)
    await fs.writeFile(path.join(output, item.asset.name), item.bytes, {
      flag: "wx"
    });
  await fs.writeFile(
    path.join(output, "provenance.json"),
    `${JSON.stringify(release.provenance, null, 2)}\n`,
    { flag: "wx" }
  );
  await fs.writeFile(
    path.join(output, "skill-release-manifest.json"),
    `${JSON.stringify(release.manifest, null, 2)}\n`,
    { flag: "wx" }
  );
  return output;
}
