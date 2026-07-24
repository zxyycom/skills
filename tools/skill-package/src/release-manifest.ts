import * as v from "valibot";

export const skillReleaseManifestFileName = "skill-release-manifest.json";

export const skillVersionSchema = v.pipe(
  v.number("must be a number"),
  v.integer("must be an integer"),
  v.minValue(1, "must be greater than or equal to 1"),
  v.maxValue(Number.MAX_SAFE_INTEGER, "must be a safe integer")
);

const skillReleaseSchema = v.object({
  version: skillVersionSchema
});

export const skillReleaseManifestSchema = v.object({
  schemaVersion: v.literal(1, "must be 1"),
  skills: v.pipe(
    v.record(v.string(), skillReleaseSchema, "must be an object"),
    v.minEntries(1, "must not be empty")
  )
});

export type SkillReleaseManifest = v.InferOutput<typeof skillReleaseManifestSchema>;

export type SkillReleaseManifestValidation =
  | {
      issues: string[];
      success: false;
    }
  | {
      output: SkillReleaseManifest;
      success: true;
    };

export function validateSkillReleaseManifest(
  input: unknown
): SkillReleaseManifestValidation {
  const result = v.safeParse(skillReleaseManifestSchema, input);
  if (result.success) {
    return {
      output: result.output,
      success: true
    };
  }

  return {
    issues: result.issues.map((issue) => {
      const issuePath = v.getDotPath(issue);
      return issuePath ? `${issuePath} ${issue.message}` : issue.message;
    }),
    success: false
  };
}

export function stringifySkillReleaseManifest(
  manifest: SkillReleaseManifest
): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
