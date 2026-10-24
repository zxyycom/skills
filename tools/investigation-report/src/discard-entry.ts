import { discoverInvestigationCandidates } from "./candidate-discovery.ts";
import path from "node:path";
import { lockFailure as candidateDiscardLockFailure } from "./candidate-discard-support.ts";
import { discardCandidateWithinLock } from "./candidate-discard.ts";
import { withInvestigationCollectionMutationLock } from "./collection-mutation-lock.ts";
import { InvestigationPreparation } from "./strict-preparation.ts";
import { discardFromCollection } from "./discard-loading.ts";
import { writeTextAtomically } from "./discard-files.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import { discardLockFailure, discardResult } from "./discard.ts";
import { identifyInvestigationDiscardTarget } from "./discard-target.ts";
import { parseInvestigationReportDiscardOptions } from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import type {
  InvestigationCandidateDiscardResult,
  InvestigationReportDiscardResult,
  InvestigationReportDiscardOptions
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
  const indexPath = path.join(resolved.root, investigationIndexFileName);
  const route: { candidateId: string | null } = { candidateId: null };
  try {
    return await withInvestigationCollectionMutationLock(
      indexPath,
      async () => {
        const preparation = new InvestigationPreparation(
          path.dirname(resolved.root),
          resolved.root
        );
        const layout = await discoverInvestigationCandidates(resolved.root);
        const target = await identifyInvestigationDiscardTarget(
          resolved.root,
          resolved.options.id,
          layout
        );
        if (target.status === "error")
          return discardResult({
            errors: target.errors,
            id: resolved.options.id,
            input: resolved.options
          });
        const routed = { ...resolved.options, id: target.id };
        if (target.kind === "candidate") route.candidateId = target.id;
        return target.kind === "candidate"
          ? await discardCandidateWithinLock({
              beforeCommit: async () => {},
              input: routed,
              root: resolved.root,
              layout
            })
          : await discardFromCollection(
              {
                afterResourceTombstone: async () => {},
                beforePublish: async () => {},
                deleteOwnedResources: routed.deleteOwnedResources === true,
                deleteRecorded: routed.deleteRecorded === true,
                id: routed.id,
                indexPath,
                root: resolved.root,
                write: writeTextAtomically
              },
              { preparation }
            );
      }
    );
  } catch (error) {
    if (route.candidateId !== null)
      return candidateDiscardLockFailure(
        { ...resolved.options, id: route.candidateId },
        error
      );
    return discardLockFailure(error, resolved.options, resolved.options.id);
  }
}

type DiscardLocationFailure = Readonly<{
  errors: readonly string[];
  id: string;
  input: { investigationsDir?: string; workspaceRoot?: string };
  status: "error";
}>;
type ResolvedDiscardLocation = Readonly<{
  options: InvestigationReportDiscardOptions;
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
