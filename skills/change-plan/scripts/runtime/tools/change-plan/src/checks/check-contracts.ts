/*
 * Synced TypeScript runtime; repository maintenance edits tools/change-plan/src/checks/check-contracts.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/change-plan/src/checks/check-contracts.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/change-plan/src/checks/check-contracts.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/change-plan
 * Rebuild: bun run sync:change-plan-cli
 */
import type {
  ArtifactStructureContract,
  ArtifactSubsectionContract,
  ChangePlanStage
} from "../types.ts";
const requiredChangeSubsections = [
  "Intended Change",
  "Resulting Impacts"
] as const;
const scopeSubsectionContract = {
  ownerSection: "Scope",
  requiredSubsections: requiredChangeSubsections
} as const satisfies ArtifactSubsectionContract;
const decisionsSubsectionContract = {
  ownerSection: "Decisions",
  requiredSubsections: requiredChangeSubsections
} as const satisfies ArtifactSubsectionContract;
const designArtifactContract = {
  file: "design.md",
  h1: "Design",
  requiredSections: [
    "Context",
    "Goals / Non-Goals",
    "Decisions",
    "Risks / Trade-offs",
    "Open Questions"
  ],
  subsectionContracts: [decisionsSubsectionContract]
} as const satisfies ArtifactStructureContract;
export const artifactContractsByStage = {
  draft: [
    {
      file: "proposal.md",
      h1: "Proposal",
      requiredSections: ["Why", "Outcome"],
      subsectionContracts: [scopeSubsectionContract]
    },
    designArtifactContract
  ],
  plan: [
    {
      file: "proposal.md",
      h1: "Proposal",
      requiredSections: [
        "Why",
        "Outcome",
        "Scope",
        "Success Criteria",
        "Affected Owners"
      ],
      subsectionContracts: [scopeSubsectionContract]
    },
    designArtifactContract,
    {
      file: "tasks.md",
      h1: "Tasks",
      requiredSections: ["Readiness", "Implementation", "Verification"],
      taskSections: ["Readiness", "Implementation", "Verification"]
    }
  ]
} as const satisfies Readonly<
  Record<ChangePlanStage, readonly ArtifactStructureContract[]>
>;
