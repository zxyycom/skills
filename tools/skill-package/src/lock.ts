import * as v from "valibot";

export const skillPackageLockFileName = "skill-package-lock.json";

const sha256Schema = v.pipe(
  v.string("must be a lowercase SHA-256 hash"),
  v.regex(/^[a-f0-9]{64}$/, "must be a lowercase SHA-256 hash")
);

export const skillPackageLockSchema = v.object(
  {
    aggregateHash: sha256Schema,
    schemaVersion: v.literal(1, "must be 1"),
    skills: v.pipe(
      v.record(v.string(), sha256Schema, "must be an object"),
      v.minEntries(1, "must not be empty")
    )
  }
);

export type SkillPackageLock = v.InferOutput<typeof skillPackageLockSchema>;

export type SkillPackageLockValidation =
  | {
      issues: string[];
      success: false;
    }
  | {
      output: SkillPackageLock;
      success: true;
    };

export function validateSkillPackageLock(
  input: unknown
): SkillPackageLockValidation {
  const result = v.safeParse(skillPackageLockSchema, input);
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
