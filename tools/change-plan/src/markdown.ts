import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import type {
  ArtifactStructureContract,
  ArtifactValidationResult,
  ChangePlanArtifactName,
  ChangePlanDiagnostic
} from "./types.ts";

type RootHeading = {
  depth: number;
  lineIndex: number;
  title: string;
};

const taskLinePrefixPattern = /^- \[[^\]]*\]/u;
const taskLinePattern = /^- \[([ xX])\] ([0-9]+\.[0-9]+(?:\.[0-9]+)*) (.+\S|\S)$/u;

function normalizeNewlines(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}

function rootHeadings(markdown: string): RootHeading[] {
  return fromMarkdown(markdown).children.flatMap((node) => {
    if (node.type !== "heading" || node.position === undefined) {
      return [];
    }
    return [{
      depth: node.depth,
      lineIndex: node.position.start.line - 1,
      title: toString(node).trim().replace(/\s+/gu, " ")
    }];
  });
}

function hasSemanticContent(markdown: string): boolean {
  return fromMarkdown(markdown).children.some((node) => (
    node.type !== "heading" && toString(node).trim().length > 0
  ));
}

function diagnostic(
  file: ChangePlanArtifactName,
  code: ChangePlanDiagnostic["code"],
  message: string,
  line?: number
): ChangePlanDiagnostic {
  return {
    code,
    file,
    ...(line === undefined ? {} : { line }),
    message
  };
}

function validateHeadings(
  lines: readonly string[],
  headings: readonly RootHeading[],
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): RootHeading[] {
  const firstNonEmptyLine = lines.findIndex((line) => line.trim().length > 0);
  const h1 = headings.filter((heading) => heading.depth === 1);
  if (
    firstNonEmptyLine < 0
    || h1[0]?.lineIndex !== firstNonEmptyLine
    || h1[0]?.title !== contract.h1
    || h1.length !== 1
  ) {
    diagnostics.push(diagnostic(
      contract.file,
      "invalid-h1",
      `first non-empty line must be the only "# ${contract.h1}" heading`,
      firstNonEmptyLine < 0 ? 1 : firstNonEmptyLine + 1
    ));
  }

  const h2 = headings.filter((heading) => heading.depth === 2);
  for (const [index, title] of contract.requiredSections.entries()) {
    const matches = h2.filter((heading) => heading.title === title);
    if (matches.length === 0) {
      diagnostics.push(diagnostic(
        contract.file,
        "missing-section",
        `missing required "## ${title}" section`
      ));
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push(diagnostic(
        contract.file,
        "duplicate-section",
        `"## ${title}" must appear exactly once`,
        matches[1].lineIndex + 1
      ));
    }
    if (h2[index]?.title !== title) {
      diagnostics.push(diagnostic(
        contract.file,
        "section-order",
        `H2 sections must start with: ${contract.requiredSections.join(", ")}`,
        h2[index]?.lineIndex === undefined ? undefined : h2[index].lineIndex + 1
      ));
    }
  }

  const firstH2 = h2[0];
  const firstH1 = h1[0];
  if (
    firstH1 !== undefined
    && firstH2 !== undefined
    && !hasSemanticContent(
      lines.slice(firstH1.lineIndex + 1, firstH2.lineIndex).join("\n")
    )
  ) {
    diagnostics.push(diagnostic(
      contract.file,
      "empty-introduction",
      "artifact must contain a non-empty change summary between H1 and the first H2",
      firstH1.lineIndex + 1
    ));
  }

  for (const title of contract.requiredSections) {
    const section = h2.find((heading) => heading.title === title);
    if (section === undefined) {
      continue;
    }
    const nextH2 = h2.find((heading) => heading.lineIndex > section.lineIndex);
    const sectionEnd = nextH2?.lineIndex ?? lines.length;
    if (!hasSemanticContent(lines.slice(section.lineIndex + 1, sectionEnd).join("\n"))) {
      diagnostics.push(diagnostic(
        contract.file,
        "empty-section",
        `"## ${title}" must not be empty`,
        section.lineIndex + 1
      ));
    }
  }

  return h2;
}

function validateTasks(
  lines: readonly string[],
  h2: readonly RootHeading[],
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): Pick<ArtifactValidationResult, "completedTaskCount" | "taskCount"> {
  const taskSections = new Set(contract.taskSections ?? []);
  const taskCounts = new Map([...taskSections].map((title) => [title, 0]));
  const seenTaskIds = new Map<string, number>();
  let completedTaskCount = 0;
  let taskCount = 0;
  let currentSection: string | null = null;
  const headingsByLine = new Map(h2.map((heading) => [heading.lineIndex, heading.title]));

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    currentSection = headingsByLine.get(lineIndex) ?? currentSection;
    const line = lines[lineIndex];
    if (!taskLinePrefixPattern.test(line)) {
      continue;
    }
    if (currentSection === null || !taskSections.has(currentSection)) {
      diagnostics.push(diagnostic(
        contract.file,
        "task-outside-required-section",
        "checklist tasks must be inside Readiness, Implementation, or Verification",
        lineIndex + 1
      ));
      continue;
    }

    const match = line.match(taskLinePattern);
    if (match === null) {
      diagnostics.push(diagnostic(
        contract.file,
        "invalid-task-syntax",
        "task must use '- [ ] <numeric-id> <description>' or '- [x] <numeric-id> <description>'",
        lineIndex + 1
      ));
      continue;
    }

    const taskId = match[2];
    const previousLine = seenTaskIds.get(taskId);
    if (previousLine !== undefined) {
      diagnostics.push(diagnostic(
        contract.file,
        "duplicate-task-id",
        `task id ${taskId} duplicates line ${previousLine}`,
        lineIndex + 1
      ));
    } else {
      seenTaskIds.set(taskId, lineIndex + 1);
    }
    taskCounts.set(currentSection, (taskCounts.get(currentSection) ?? 0) + 1);
    taskCount += 1;
    if (match[1].toLowerCase() === "x") {
      completedTaskCount += 1;
    }
  }

  for (const section of taskSections) {
    if ((taskCounts.get(section) ?? 0) === 0) {
      diagnostics.push(diagnostic(
        contract.file,
        "missing-task",
        `"## ${section}" must contain at least one valid checklist task`
      ));
    }
  }

  return { completedTaskCount, taskCount };
}

export function validateChangePlanArtifact(
  markdown: string,
  contract: ArtifactStructureContract
): ArtifactValidationResult {
  const normalized = normalizeNewlines(markdown);
  const lines = normalized.split("\n");
  const diagnostics: ChangePlanDiagnostic[] = [];
  const headings = rootHeadings(normalized);
  const h2 = validateHeadings(lines, headings, contract, diagnostics);
  const tasks = contract.taskSections === undefined
    ? { completedTaskCount: 0, taskCount: 0 }
    : validateTasks(lines, h2, contract, diagnostics);

  return {
    ...tasks,
    diagnostics
  };
}
