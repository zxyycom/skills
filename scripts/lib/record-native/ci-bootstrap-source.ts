import { nativeRoles } from "../../../tools/skill-package/src/native-release-manifest.ts";
import { readSkillPackageIdentityFromMarkdown } from "../../../tools/skill-package/src/version.ts";
import { digestNativeSource, type NativeCandidateSnapshot } from "./capture.ts";

/** A private test successor, not a new pending or published version. */
export function privateBootstrapSuccessor(
  base: NativeCandidateSnapshot
): NativeCandidateSnapshot {
  const replacements = new Map([
    [
      "Cargo.toml",
      [
        '[package]\nname = "record-cli"\nversion = "0.1.0"',
        '[package]\nname = "record-cli"\nversion = "0.1.1"'
      ]
    ],
    [
      "Cargo.lock",
      [
        'name = "record-cli"\nversion = "0.1.0"',
        'name = "record-cli"\nversion = "0.1.1"'
      ]
    ]
  ]);
  const source = base.source.map((file) => {
    const pair = replacements.get(file.path);
    if (!pair) return file;
    const text = file.data.toString("utf8");
    const [before, after] = pair;
    if (!before || !after || text.split(before).length !== 2)
      throw new Error(`invalid successor source: ${file.path}`);
    replacements.delete(file.path);
    return { ...file, data: Buffer.from(text.replace(before, after)) };
  });
  if (replacements.size) throw new Error("successor source files missing");
  const filesBySkill = new Map(base.skills.filesBySkill);
  for (const role of nativeRoles) {
    const files = filesBySkill.get(role);
    if (!files) throw new Error(`missing skill: ${role}`);
    let changed = false;
    filesBySkill.set(
      role,
      files.map((file) => {
        if (file.path !== "SKILL.md") return file;
        const text = file.data.toString("utf8");
        const identity = readSkillPackageIdentityFromMarkdown(text);
        if (identity.name !== role || identity.version === null)
          throw new Error(`invalid skill identity: ${role}`);
        const before = `version: "${identity.version}"`;
        if (text.split(before).length !== 2)
          throw new Error(`unexpected skill version: ${role}`);
        changed = true;
        return {
          ...file,
          data: Buffer.from(
            text.replace(before, `version: "${identity.version + 1}"`)
          )
        };
      })
    );
    if (!changed) throw new Error(`missing skill entry: ${role}`);
  }
  return {
    ...base,
    source,
    sourceHash: digestNativeSource(source),
    skills: { ...base.skills, filesBySkill }
  };
}
