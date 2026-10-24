import { discoverInvestigationCandidates } from "./candidate-discovery.ts";
import { prepareResourceSourceProof } from "./rename-resource-proof.ts";
import fs from "node:fs/promises";
import path from "node:path";
import type { ResourceMoveProgress } from "./rename-contract.ts";

import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "./diagnostics.ts";

import { findCandidatePathForInvestigationId } from "./candidate-path.ts";
import { readLocalPublication } from "./local-publication.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";

import {
  scanCandidateOwnerResources,
  type CandidateResourceTree
} from "./candidate-discard-resources.ts";

export type CandidateDiscardPreparation = Readonly<{
  candidatePath: string;
  candidateText: string;
  resources: CandidateResourceTree;
  resourceProgress: ResourceMoveProgress;
  sharedReferences: string[];
}>;

export type CandidateDiscardPreparationResult =
  | Readonly<{ status: "ok"; value: CandidateDiscardPreparation }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }>;

export async function prepareCandidateDiscard(
  root: string,
  id: string
): Promise<CandidateDiscardPreparationResult> {
  try {
    return await buildCandidateDiscardPreparation(root, id);
  } catch (error) {
    return {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.discard-candidate-prepare-failed",
          error,
          reason:
            "the candidate and owner resources could not be prepared for discard",
          recovery:
            "restore a readable candidate collection and owner resource tree, then retry discard",
          target: id
        })
      ],
      errors: ["candidate discard preparation could not be completed"],
      status: "error"
    };
  }
}

async function buildCandidateDiscardPreparation(
  root: string,
  id: string
): Promise<CandidateDiscardPreparationResult> {
  const candidate = await preparedCandidateFile(root, id);
  if (candidate.status === "error") return candidate;
  const resources = await scanCandidateOwnerResources(
    root,
    path.join(root, investigationResourcesDirectoryName, id)
  );
  if (resources.errors.length > 0)
    return { diagnostics: [], errors: resources.errors, status: "error" };
  const sharedReferences = await sharedCandidateResourceReferences(root, id);
  const resourceProgress = await prepareResourceSourceProof({
    root: path.dirname(root),
    owner: path.join(root, investigationResourcesDirectoryName, id),
    files: resources.resourceIds.map((resourceId) => ({
      path: resourceId.slice(id.length + 1)
    })),
    directories: resources.directories
  });
  return {
    status: "ok",
    value: { ...candidate.value, resources, sharedReferences, resourceProgress }
  };
}

type PreparedCandidateFile = Readonly<{
  candidatePath: string;
  candidateText: string;
}>;

async function preparedCandidateFile(
  root: string,
  id: string
): Promise<
  | Readonly<{ status: "ok"; value: PreparedCandidateFile }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }>
> {
  const layout = await discoverInvestigationCandidates(root);
  if (layout.errors.length > 0)
    return { diagnostics: [], errors: layout.errors, status: "error" };
  if (!layout.candidateIds.includes(id)) return missingCandidatePreparation(id);
  const candidatePath = await findCandidatePathForInvestigationId(root, id);
  if (candidatePath === null) return missingCandidatePreparation(id);
  const entry = await fs.lstat(candidatePath);
  if (entry.isSymbolicLink() || !entry.isFile())
    return {
      diagnostics: [],
      errors: [
        `${id} investigation candidate must be a regular non-symbolic-link file`
      ],
      status: "error"
    };
  return {
    status: "ok",
    value: {
      candidatePath,
      candidateText: await fs.readFile(candidatePath, "utf8")
    }
  };
}

function missingCandidatePreparation(id: string): Readonly<{
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  status: "error";
}> {
  return {
    diagnostics: [],
    errors: [`${id} investigation candidate does not exist`],
    status: "error"
  };
}

async function sharedCandidateResourceReferences(
  root: string,
  id: string
): Promise<string[]> {
  const layout = await discoverInvestigationCandidates(root);
  const references =
    layout.reportIds.length === 0 &&
    layout.candidateCollection.indexStatus === "missing"
      ? new Map<string, ReadonlySet<string>>()
      : new Map(
          [...(await readLocalPublication(root, [])).states].map(
            ([source, state]) => [source, new Set(state.resourceIds)]
          )
        );
  const ownerPrefix = `${id}/`;
  return [...references]
    .filter(
      ([source, ids]) =>
        source !== id &&
        [...ids].some((resourceId) => resourceId.startsWith(ownerPrefix))
    )
    .map(
      ([source]) =>
        `${id} owns resources still referenced by ${source}; remove or replace those resource links before discard`
    )
    .sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
