import path from "node:path";
import type { StateSnapshot } from "../../index-runtime/src/index.ts";
import {
  decisionDomainCatalogFileName,
  type DecisionDomainCatalog
} from "./decision-domain-catalog.ts";
import { decisionDomainFromRelativePath } from "./decision-path.ts";
import { establishedDecisionMetadataFromSource } from "./decision-metadata.ts";
import { validateDecisionBody } from "./record.ts";
import { decisionRelationConsistencyIssues } from "./relation-graph.ts";
import { prepareDecisionSources } from "./decision-source-revision.ts";
import type {
  DecisionDocument,
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionMetadata,
  DecisionSource
} from "./types.ts";

const decisionSourceParseConcurrency = 32;

export function decisionIndexState(
  relativePath: string,
  document: DecisionDocument
): DecisionIndexState {
  const metadata: DecisionMetadata = document.status === "active"
    ? {
        status: "active",
        alignment: document.alignment,
        createdAt: document.createdAt
      }
    : {
        status: "archived",
        alignment: document.alignment,
        createdAt: document.createdAt
      };
  return {
    path: relativePath,
    title: document.title,
    ...metadata,
    purpose: document.purpose,
    background: document.background,
    decision: document.decision,
    relations: document.relations.map(({ type, target }) => ({ type, target }))
  };
}

export async function buildDecisionStateSnapshotFromSources(
  catalog: DecisionDomainCatalog,
  sources: readonly DecisionSource[],
  signal?: AbortSignal
): Promise<StateSnapshot<DecisionIndexState, DecisionIndexMetadata>> {
  const prepared = prepareDecisionSources(catalog, sources);
  const domainIds = new Set(catalog.domains.map((domain) => domain.id));
  const states: DecisionIndexState[] = [];
  for (
    let offset = 0;
    offset < prepared.sources.length;
    offset += decisionSourceParseConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("decision state projection was aborted");
    }
    const batch = prepared.sources.slice(
      offset,
      offset + decisionSourceParseConcurrency
    );
    states.push(...await Promise.all(batch.map(async (source) => (
      await parseDecisionSource(source, domainIds, prepared.sourcePaths)
    ))));
  }

  const relationIssues = decisionRelationConsistencyIssues(states.map((state) => ({
    projection: state,
    relativePath: state.path,
    status: state.status
  })));
  if (relationIssues.length > 0) {
    throw new Error(relationIssues.map((issue) => issue.message).join("; "));
  }

  return {
    metadata: {
      domains: catalog.domains.map(({ id, description }) => ({ id, description }))
    },
    sourceRevision: prepared.revision,
    states: Object.fromEntries(states.map((state) => [state.path, state]))
  };
}

async function parseDecisionSource(
  source: DecisionSource,
  domainIds: ReadonlySet<string>,
  sourcePaths: ReadonlySet<string>
): Promise<DecisionIndexState> {
  const errors: string[] = [];
  const domain = decisionDomainFromRelativePath(source.path);
  if (domain === null || !domainIds.has(domain)) {
    errors.push(
      `${source.path} path domain is not defined in `
      + `${decisionDomainCatalogFileName}: ${domain ?? "<invalid>"}`
    );
  }
  const candidate = await validateDecisionBody({
    body: source.text,
    errors,
    fileName: path.posix.basename(source.path),
    relativePath: source.path,
    targetExists: (targetPath) => sourcePaths.has(targetPath)
  });
  const metadata = candidate === null
    ? null
    : establishedDecisionMetadataFromSource(candidate);
  if (candidate === null || metadata === null || errors.length > 0) {
    throw new Error(
      errors.length > 0
        ? errors.join("; ")
        : `${source.path} does not contain established decision metadata`
    );
  }

  return decisionIndexState(source.path, {
    title: candidate.title,
    purpose: candidate.purpose,
    background: candidate.background,
    decision: candidate.decision,
    relations: candidate.relations,
    ...metadata
  });
}
