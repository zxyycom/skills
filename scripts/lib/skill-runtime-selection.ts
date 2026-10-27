import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import type { GeneratedFileMode } from "./generated-file.ts";
import { rootDir, type SkillPackage } from "./project.ts";

export type SkillUpdaterArguments = Readonly<{
  mode: GeneratedFileMode;
  skillNames?: readonly string[];
}>;

function validateSkillNames(skillNames: readonly string[]): readonly string[] {
  if (skillNames.length === 0)
    throw new Error("Selected skill names must not be empty");
  for (const name of skillNames) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name))
      throw new Error(`Invalid selected skill name: ${JSON.stringify(name)}`);
  }
  return [...new Set(skillNames)];
}

export function parseSkillUpdaterArguments(
  argv: readonly string[]
): SkillUpdaterArguments {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      check: { type: "boolean" },
      write: { type: "boolean" },
      skill: { type: "string", multiple: true }
    },
    strict: true
  });
  if (values.check && values.write)
    throw new Error("--check and --write cannot be used together");
  if (values.skill !== undefined && values.write)
    throw new Error("--skill is only supported in check mode");
  return {
    mode: values.write ? "write" : "check",
    ...(values.skill === undefined
      ? {}
      : { skillNames: validateSkillNames(values.skill) })
  };
}

/** Validate the entire selection before any adapter is loaded or output read. */
export async function discoverSelectedSkillPackages(
  skillNames: readonly string[],
  workspaceRoot: string = rootDir
): Promise<readonly SkillPackage[]> {
  const names = validateSkillNames(skillNames);
  const skills: SkillPackage[] = [];
  for (const name of names) {
    const directory = path.join(workspaceRoot, "skills", name);
    try {
      if (!(await fs.lstat(directory)).isDirectory())
        throw new Error("skill directory must be a regular directory");
      if (!(await fs.lstat(path.join(directory, "SKILL.md"))).isFile())
        throw new Error("SKILL.md must be a regular file");
    } catch (error) {
      throw new Error(
        `Unknown or invalid selected skill ${JSON.stringify(name)}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
    skills.push({ name, directory });
  }
  return skills;
}
