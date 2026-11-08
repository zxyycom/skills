import path from "node:path";
import { packIsolatedSkillSnapshot } from "./lib/record-native/staging.ts";
import { readPendingSkillPackageSnapshot } from "./lib/skill-package/skill-package-hash.ts";
import { rootDir } from "./lib/project.ts";
import { skillReleaseManifestFileName } from "../tools/skill-package/src/release-manifest.ts";

const snapshot = await readPendingSkillPackageSnapshot(rootDir);
const packed = await packIsolatedSkillSnapshot(
  snapshot,
  rootDir,
  process.env.SKILL_RELEASE_STAGE
);

for (const archive of packed.archives) {
  console.log(
    `Packed ${archive.skillName} -> ${path.relative(rootDir, archive.outputPath)} (${archive.byteLength} bytes).`
  );
}
console.log(
  `Generated ${skillReleaseManifestFileName} -> ${path.relative(rootDir, packed.manifestOutputPath)}.`
);
