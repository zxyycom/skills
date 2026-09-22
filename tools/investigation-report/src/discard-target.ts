import { inspectInvestigationCollectionLayout } from "./investigation-index-source.ts";
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
  selector: string
): Promise<InvestigationDiscardTarget> {
  const layout = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
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
