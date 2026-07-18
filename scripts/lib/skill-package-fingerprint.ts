import { createHash } from "node:crypto";

export type SkillPackageFingerprintFile = {
  data: Uint8Array;
  path: string;
};

export function calculateSkillPackageFingerprint(
  skillName: string,
  files: readonly SkillPackageFingerprintFile[]
): string {
  const hash = createHash("sha256");
  hash.update(`skill-self-update-v1\0${skillName}\0`);

  const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path));
  for (const file of sortedFiles) {
    hash.update(`file\0${file.path}\0${file.data.byteLength}\0`);
    hash.update(file.data);
    hash.update("\0");
  }

  return hash.digest("hex");
}
