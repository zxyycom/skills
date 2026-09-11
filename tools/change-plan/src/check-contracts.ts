import type {
  ArtifactStructureContract,
  ArtifactSubsectionContract,
  ChangePlanStage
} from "./types.ts";
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
