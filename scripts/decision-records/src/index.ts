import { parseSections } from "./markdown.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  compareDecisionRecords,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionValidationResult,
  type ExpectedIndex
} from "./types.ts";

const managedIndexHeadings = new Set([
  "## 活动决策",
  "## 决策清单"
]);

function renderActiveSection(records: DecisionRecord[]): string {
  const groups = new Map<string, DecisionRecord[]>();
  const activeRecords = records.filter(
    (record) => record.fileStatus === "active" && !record.archived
  );

  for (const record of activeRecords) {
    const current = groups.get(record.areaId) ?? [];
    current.push(record);
    groups.set(record.areaId, current);
  }

  if (groups.size === 0) {
    return "当前没有 active 决策。";
  }

  const backtick = String.fromCharCode(96);
  const blocks: string[] = [];
  for (const areaId of [...groups.keys()].sort()) {
    const areaRecords = groups.get(areaId) ?? [];
    areaRecords.sort(compareDecisionRecords);

    const lines = [backtick + areaId + backtick + "：", ""];
    for (let index = 0; index < areaRecords.length; index += 1) {
      const record = areaRecords[index];
      lines.push(
        `${index + 1}. [active: ${record.fullDate} - ${record.title}](${record.relativePath})`
      );
    }
    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n");
}

export function expectedIndex(scan: DecisionScan): ExpectedIndex {
  const index = scan.index.replace(/\r\n/g, "\n");
  const sections = parseSections(index);
  const headings = sections.filter(
    (section) => managedIndexHeadings.has(section.heading)
  );
  const errors: string[] = [];
  let prefix: string;

  if (headings.length > 1) {
    errors.push(scan.indexRelativePath + " must contain only one managed decision-list section");
    return { errors, text: null };
  }

  if (headings.length === 0) {
    prefix = index.trimEnd();
  } else {
    const managed = headings[0];
    const laterHeadings = sections.filter(
      (section) => section.index > managed.index
    );
    if (laterHeadings.length > 0) {
      errors.push(scan.indexRelativePath + " managed decision-list section must be the final section");
      return { errors, text: null };
    }
    prefix = index.slice(0, managed.index).trimEnd();
  }

  const section = renderActiveSection(scan.records);
  return {
    errors,
    text: prefix + "\n\n## 活动决策\n\n" + section + "\n"
  };
}

export async function validateDecisionRecords(
  options: DecisionScanOptions = {}
): Promise<DecisionValidationResult> {
  const scan = await scanDecisionRecords(options);
  const errors = [...scan.errors];
  const generated = expectedIndex(scan);
  errors.push(...generated.errors);

  if (generated.text !== null
    && scan.index.replace(/\r\n/g, "\n") !== generated.text) {
    errors.push(
      scan.indexRelativePath
      + " active decision section is out of sync; run sync-index --write"
    );
  }

  return {
    activeCount: scan.records.filter((record) => record.fileStatus === "active").length,
    archivedCount: scan.records.filter((record) => record.archived).length,
    areaCount: scan.areaIds.size,
    decisionCount: scan.records.length,
    errors,
    scan
  };
}
