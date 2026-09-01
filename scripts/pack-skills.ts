import path from "node:path";
import { packSkillPackageSnapshot } from "./lib/skill-package-release.ts";
import { readPendingSkillPackageSnapshot } from "./lib/skill-package-hash.ts";
import { rootDir } from "./lib/project.ts";
import { skillReleaseManifestFileName } from "../tools/skill-package/src/release-manifest.ts";

const snapshot = await readPendingSkillPackageSnapshot(rootDir);
const packed = await packSkillPackageSnapshot(
  snapshot,
  path.join(rootDir, "dist")
);

for (const archive of packed.archives) {
  console.log(
    `Packed ${archive.skillName} -> ${path.relative(rootDir, archive.outputPath)} (${archive.byteLength} bytes).`
  );
}
console.log(
  `Generated ${skillReleaseManifestFileName} -> ${path.relative(rootDir, packed.manifestOutputPath)}.`
);
