import { discardInvestigationCandidate } from "./candidate-discard.ts";
import { discardInvestigationReport, discardResult } from "./discard.ts";
import { identifyInvestigationDiscardTarget } from "./discard-target.ts";
import { parseInvestigationReportDiscardOptions } from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import type {
  InvestigationCandidateDiscardResult,
  InvestigationReportDiscardResult
} from "./types.ts";

/**
 * Unified discard entry: classifies the shared-ID target, then routes to the
 * matching domain service while reusing its lock, history, and recovery path.
 */
export async function discardInvestigationRecord(
  input: unknown
): Promise<
  InvestigationReportDiscardResult | InvestigationCandidateDiscardResult
> {
  const resolved = await resolvedDiscardLocation(input);
  if (resolved.status === "error")
    return discardResult({
      errors: resolved.errors,
      id: resolved.id,
      input: resolved.input
    });
  const target = await identifyInvestigationDiscardTarget(
    resolved.root,
    resolved.options.id
  );
  if (target.status === "error")
    return discardResult({
      errors: target.errors,
      id: resolved.options.id,
      input: resolved.options
    });
  const routed = { ...resolved.options, id: target.id };
  return target.kind === "candidate"
    ? await discardInvestigationCandidate(routed)
    : await discardInvestigationReport(routed);
}

type DiscardLocationFailure = Readonly<{
  errors: readonly string[];
  id: string;
  input: { investigationsDir?: string; workspaceRoot?: string };
  status: "error";
}>;
type ResolvedDiscardLocation = Readonly<{
  options: { investigationsDir?: string; workspaceRoot?: string } & {
    id: string;
  };
  root: string;
  status: "ok";
}>;

async function resolvedDiscardLocation(
  input: unknown
): Promise<DiscardLocationFailure | ResolvedDiscardLocation> {
  const parsed = parseInvestigationReportDiscardOptions(input);
  if (parsed.isErr())
    return { errors: parsed.error, id: "", input: {}, status: "error" };
  if (parsed.value.id.length === 0)
    return {
      errors: ["discard requires an Investigation selector"],
      id: parsed.value.id,
      input: parsed.value,
      status: "error"
    };
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr())
    return {
      errors: resolved.error,
      id: parsed.value.id,
      input: parsed.value,
      status: "error"
    };
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr())
    return {
      errors: canonical.error,
      id: parsed.value.id,
      input: parsed.value,
      status: "error"
    };
  return {
    options: parsed.value,
    root: canonical.value.investigationsDirectory,
    status: "ok"
  };
}
