import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { buildStateIndexFromSnapshot } from "../../index-runtime/src/index.ts";
import { createInvestigationStateIndexDefinition } from "../src/investigation-index-definition.ts";
import { printInvestigationList } from "../src/list-output.ts";
import {
  prepareQuery,
  queryLoadedInvestigationIndex
} from "../src/query-index.ts";
import { prepareSearch } from "../src/query-options.ts";
import { searchLoadedInvestigationMetadata } from "../src/query-search-metadata.ts";
import { investigationNameFromId } from "../src/report-path.ts";
import {
  investigationRelationTypes,
  type InvestigationIndexQueryOptions,
  type InvestigationSearchOptions
} from "../src/types.ts";
import type { ReportFixture } from "./v6-support.ts";

/** Valid published data for projection tests, without Markdown, disk or Git acquisition. */
export function investigationIndexFixture(reports: readonly ReportFixture[]) {
  const fingerprint = `sha256:${"0".repeat(64)}`;
  const built = buildStateIndexFromSnapshot(
    createInvestigationStateIndexDefinition(),
    {
      metadata: {},
      sourceRevision: {
        metadata: fingerprint,
        entries: Object.fromEntries(reports.map(({ id }) => [id, fingerprint]))
      },
      states: Object.fromEntries(
        reports.map((report) => [
          report.id,
          {
            formedAt: report.formedAt ?? "2026-08-28T12:00:00+00:00",
            name: investigationNameFromId(report.id),
            question: report.question ?? "当前问题是什么？",
            relations: [...(report.relations ?? [])].sort(
              (left, right) =>
                investigationRelationTypes.indexOf(left.type) -
                  investigationRelationTypes.indexOf(right.type) ||
                (left.target < right.target
                  ? -1
                  : left.target > right.target
                    ? 1
                    : 0)
            ),
            resourceIds: report.resources ?? [],
            sourcePath: report.sourcePath ?? `${report.id}.md`,
            tags: [...(report.tags ?? ["investigation-report"])].sort(),
            title: report.title ?? report.id
          }
        ])
      )
    }
  );
  assert.equal(built.status, "ok", JSON.stringify(built.diagnostics));
  if (built.status !== "ok") assert.fail("invalid published fixture");
  return built.value;
}

export function queryIndexFixture(
  index: ReturnType<typeof investigationIndexFixture>,
  options: Omit<InvestigationIndexQueryOptions, "workspaceRoot"> = {}
) {
  const prepared = prepareQuery({ ...options, workspaceRoot: os.tmpdir() });
  if (prepared.isErr()) assert.fail(JSON.stringify(prepared.error));
  const result = queryLoadedInvestigationIndex(
    { status: "ok", diagnostics: [], value: index },
    prepared.value.validated,
    path.join(os.tmpdir(), "investigation-index.json")
  );
  if (result.isErr()) assert.fail(JSON.stringify(result.error));
  return result.value;
}

export function searchIndexFixture(
  index: ReturnType<typeof investigationIndexFixture>,
  options: Omit<InvestigationSearchOptions, "workspaceRoot">
) {
  const prepared = prepareSearch({
    ...options,
    in: "metadata",
    workspaceRoot: os.tmpdir()
  });
  if (prepared.isErr()) assert.fail(prepared.error.join("\n"));
  return searchLoadedInvestigationMetadata(
    Object.entries(index.entries).map(([id, state]) => ({ id, state })),
    prepared.value.indexPath,
    prepared.value
  );
}

export function renderIndexFixture(
  result: ReturnType<typeof queryIndexFixture>,
  detail = false
): string {
  let output = "";
  printInvestigationList(
    result,
    { detail },
    {
      stdout: (text) => {
        output += text;
      }
    }
  );
  return output;
}
