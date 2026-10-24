/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/discard-target.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/discard-target.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/discard-target.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  inspectInvestigationCollectionLayout,
  type InvestigationCollectionLayout
} from "./investigation-index-source.ts";
import {
  investigationSelectorEntries,
  resolveInvestigationSelector
} from "./investigation-selector.ts";

export type InvestigationDiscardTarget =
  | Readonly<{ errors: readonly string[]; status: "error" }>
  | Readonly<{ id: string; kind: "candidate" | "report"; status: "ok" }>;

/**
 * The shared Investigation ID space lets one selector identify either an
 * authoring candidate or a formal report, but never silently one of both:
 * classification is the discard boundary's target-kind decision.
 */
export async function identifyInvestigationDiscardTarget(
  investigationsDirectory: string,
  selector: string,
  acquiredLayout?: InvestigationCollectionLayout
): Promise<InvestigationDiscardTarget> {
  const layout =
    acquiredLayout ??
    (await inspectInvestigationCollectionLayout(investigationsDirectory));
  if (layout.errors.length > 0)
    return { errors: layout.errors, status: "error" };
  const candidate = resolveInvestigationSelector(
    investigationSelectorEntries(layout.candidateIds),
    selector,
    "investigation candidate"
  );
  const report = resolveInvestigationSelector(
    investigationSelectorEntries(layout.reportIds),
    selector,
    "investigation report"
  );
  if (candidate.status === "ok" && report.status === "ok") {
    return {
      errors: [
        `${selector} matches both an investigation candidate and a formal report; retry with one complete Investigation ID`
      ],
      status: "error"
    };
  }
  if (candidate.status === "ok")
    return { id: candidate.id, kind: "candidate", status: "ok" };
  if (report.status === "ok")
    return { id: report.id, kind: "report", status: "ok" };
  return {
    errors: [...candidate.errors, ...report.errors],
    status: "error"
  };
}
