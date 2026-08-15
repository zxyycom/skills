import type {
  StateIndexContext,
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/index.ts";
import {
  loadTestEvidenceCatalog,
  readTestEvidenceCatalogSources,
  type LoadedTestEvidenceCatalogCase
} from "./catalog-source.ts";
import type { TestEvidenceIndexMetadata } from "./schemas.ts";
import {
  identifyTestEvidenceCatalogSource,
  testEvidenceSourceRevision,
  type IdentifiedTestEvidenceCatalogSource
} from "./source-revision.ts";
import { cloneTopicDefinitions } from "./topics.ts";
import type {
  TestEvidenceCaseIndexState,
  TestEvidenceDiagnostic
} from "./types.ts";

export type TestEvidenceIndexSourceResult =
  | {
      diagnostics: [];
      snapshot: StateSnapshot<
        TestEvidenceCaseIndexState,
        TestEvidenceIndexMetadata
      >;
      topics: TestEvidenceIndexMetadata["topics"];
    }
  | {
      diagnostics: TestEvidenceDiagnostic[];
      snapshot: null;
      topics: TestEvidenceIndexMetadata["topics"];
    };

export async function readTestEvidenceIndexSource(
  context: StateIndexContext
): Promise<TestEvidenceIndexSourceResult> {
  const catalog = await loadTestEvidenceCatalog(context.root);
  const topics = cloneTopicDefinitions(catalog.topicCatalog?.topics ?? []);
  if (catalog.diagnostics.length > 0) {
    return {
      diagnostics: catalog.diagnostics,
      snapshot: null,
      topics
    };
  }
  if (catalog.topicCatalog === null) {
    throw new TypeError("validated catalog must include a topic catalog");
  }
  if (catalog.cases.length !== catalog.sources.length) {
    throw new TypeError("validated catalog source and case sets must match");
  }

  const states: Record<string, TestEvidenceCaseIndexState> =
    Object.create(null);
  const revisionSources: IdentifiedTestEvidenceCatalogSource[] = [];
  for (const catalogCase of catalog.cases) {
    const id = catalogCase.validated.id;
    if (Object.hasOwn(states, id)) {
      throw new TypeError(`duplicate validated test evidence case id: ${id}`);
    }
    states[id] = catalogCaseState(catalogCase);
    revisionSources.push({
      id,
      path: catalogCase.source.path,
      text: catalogCase.source.text
    });
  }

  return {
    diagnostics: [],
    snapshot: {
      metadata: { topics },
      sourceRevision: testEvidenceSourceRevision({
        sources: revisionSources,
        topicCatalog: catalog.topicCatalog
      }),
      states
    },
    topics
  };
}

export async function readCurrentTestEvidenceSourceRevision(
  context: StateIndexContext
): Promise<StateSourceRevision> {
  const source = await readTestEvidenceCatalogSources(context.root);
  if (source.diagnostics.length > 0) {
    throw new Error(
      source.diagnostics.map((entry) => entry.message).join("; ")
    );
  }
  if (source.topicCatalog === null) {
    throw new TypeError(
      "validated catalog source must include a topic catalog"
    );
  }
  return testEvidenceSourceRevision({
    sources: source.sources.map(identifyTestEvidenceCatalogSource),
    topicCatalog: source.topicCatalog
  });
}

function catalogCaseState(
  catalogCase: LoadedTestEvidenceCatalogCase
): TestEvidenceCaseIndexState {
  const { parsed, source, validated } = catalogCase;
  const summary = parsed.sections.contract.items[0];
  if (summary === undefined) {
    throw new TypeError(`validated case ${validated.id} has no index summary`);
  }
  return {
    endLine: parsed.endLine,
    entries: [...validated.entries],
    id: validated.id,
    line: validated.line,
    searchText: [
      parsed.title,
      ...parsed.sections.contract.items,
      ...parsed.sections.proves.items,
      ...validated.entries
    ].join(" "),
    sourcePath: source.path,
    summary,
    title: parsed.title
  };
}
