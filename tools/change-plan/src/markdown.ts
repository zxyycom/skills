import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import type {
  ArtifactSubsectionContract,
  ArtifactStructureContract,
  ArtifactValidationResult,
  ChangePlanArtifactName,
  ChangePlanDiagnostic,
  ChangePlanTaskHeading,
  ChangePlanTaskProgress,
  ChangePlanTaskSection
} from "./types.ts";

type MarkdownRoot = ReturnType<typeof fromMarkdown>;
type RootContent = MarkdownRoot["children"][number];
type MarkdownHeading = Extract<RootContent, { type: "heading" }>;

type RootHeading = {
  depth: MarkdownHeading["depth"];
  lineIndex: number;
  title: string;
};

type ChecklistCandidate = {
  line: string;
  lineIndex: number;
};

const taskLinePrefixPattern = /^- \[[^\]]*\]/u;
const taskLinePattern =
  /^- \[([ xX])\] ([0-9]+\.[0-9]+(?:\.[0-9]+)*) (.+\S|\S)$/u;
const taskSectionByHeading: Readonly<
  Record<ChangePlanTaskHeading, ChangePlanTaskSection>
> = {
  Implementation: "implementation",
  Readiness: "readiness",
  Verification: "verification"
};

function emptyTaskProgress(): ChangePlanTaskProgress {
  return {
    implementation: { completedTaskCount: 0, taskCount: 0 },
    readiness: { completedTaskCount: 0, taskCount: 0 },
    verification: { completedTaskCount: 0, taskCount: 0 }
  };
}

function normalizeNewlines(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}

function rootHeadings(root: MarkdownRoot): RootHeading[] {
  return root.children.flatMap((node) => {
    if (node.type !== "heading" || node.position === undefined) {
      return [];
    }
    return [
      {
        depth: node.depth,
        lineIndex: node.position.start.line - 1,
        title: toString(node).trim().replace(/\s+/gu, " ")
      }
    ];
  });
}

function isSemanticNode(node: RootContent): boolean {
  return (
    node.type !== "heading" &&
    node.type !== "html" &&
    toString(node).trim().length > 0
  );
}

function hasSemanticContent(
  root: MarkdownRoot,
  startLineIndex: number,
  endLineIndex: number
): boolean {
  return root.children.some((node) => {
    const lineIndex = node.position?.start.line;
    return (
      lineIndex !== undefined &&
      lineIndex - 1 >= startLineIndex &&
      lineIndex - 1 < endLineIndex &&
      isSemanticNode(node)
    );
  });
}

function checklistCandidates(
  root: MarkdownRoot,
  lines: readonly string[]
): ChecklistCandidate[] {
  return root.children.flatMap((node) => {
    if (node.type !== "list" || node.ordered) {
      return [];
    }
    return node.children.flatMap((item) => {
      const start = item.position?.start;
      if (start === undefined || start.column !== 1) {
        return [];
      }
      const lineIndex = start.line - 1;
      const line = lines[lineIndex];
      return line !== undefined && taskLinePrefixPattern.test(line)
        ? [{ line, lineIndex }]
        : [];
    });
  });
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
  root: MarkdownRoot,
  lines: readonly string[],
  headings: readonly RootHeading[],
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): RootHeading[] {
  const firstNonEmptyLine = lines.findIndex((line) => line.trim().length > 0);
  const h1 = headings.filter((heading) => heading.depth === 1);
  if (
    firstNonEmptyLine < 0 ||
    h1[0]?.lineIndex !== firstNonEmptyLine ||
    h1[0]?.title !== contract.h1 ||
    h1.length !== 1
  ) {
    diagnostics.push(
      diagnostic(
        contract.file,
        "invalid-h1",
        `first non-empty line must be the only "# ${contract.h1}" heading`,
        firstNonEmptyLine < 0 ? 1 : firstNonEmptyLine + 1
      )
    );
  }

  const h2 = headings.filter((heading) => heading.depth === 2);
  for (const [index, title] of contract.requiredSections.entries()) {
    const matches = h2.filter((heading) => heading.title === title);
    if (matches.length === 0) {
      diagnostics.push(
        diagnostic(
          contract.file,
          "missing-section",
          `missing required "## ${title}" section`
        )
      );
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push(
        diagnostic(
          contract.file,
          "duplicate-section",
          `"## ${title}" must appear exactly once`,
          matches[1]?.lineIndex === undefined
            ? undefined
            : matches[1].lineIndex + 1
        )
      );
    }
    if (h2[index]?.title !== title) {
      diagnostics.push(
        diagnostic(
          contract.file,
          "section-order",
          `H2 sections must start with: ${contract.requiredSections.join(", ")}`,
          h2[index]?.lineIndex === undefined
            ? undefined
            : h2[index].lineIndex + 1
        )
      );
    }
  }

  const firstH2 = h2[0];
  const firstH1 = h1[0];
  if (
    firstH1 !== undefined &&
    firstH2 !== undefined &&
    !hasSemanticContent(root, firstH1.lineIndex + 1, firstH2.lineIndex)
  ) {
    diagnostics.push(
      diagnostic(
        contract.file,
        "empty-introduction",
        "artifact must contain a non-empty change summary between H1 and the first H2",
        firstH1.lineIndex + 1
      )
    );
  }

  for (const title of contract.requiredSections) {
    const section = h2.find((heading) => heading.title === title);
    if (section === undefined) {
      continue;
    }
    const nextH2 = h2.find((heading) => heading.lineIndex > section.lineIndex);
    const sectionEnd = nextH2?.lineIndex ?? lines.length;
    if (!hasSemanticContent(root, section.lineIndex + 1, sectionEnd)) {
      diagnostics.push(
        diagnostic(
          contract.file,
          "empty-section",
          `"## ${title}" must not be empty`,
          section.lineIndex + 1
        )
      );
    }
  }

  return h2;
}

function validateRequiredSubsectionHeadings(
  headings: readonly RootHeading[],
  subsectionContract: ArtifactSubsectionContract,
  file: ChangePlanArtifactName,
  diagnostics: ChangePlanDiagnostic[]
): void {
  const { ownerSection, requiredSubsections } = subsectionContract;
  for (const [index, title] of requiredSubsections.entries()) {
    const matches = headings.filter((heading) => heading.title === title);
    if (matches.length === 0) {
      diagnostics.push(
        diagnostic(
          file,
          "missing-section",
          `missing required "### ${title}" subsection in "## ${ownerSection}"`
        )
      );
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push(
        diagnostic(
          file,
          "duplicate-section",
          `"### ${title}" must appear exactly once in "## ${ownerSection}"`,
          matches[1]?.lineIndex === undefined
            ? undefined
            : matches[1].lineIndex + 1
        )
      );
    }
    if (headings[index]?.title !== title) {
      diagnostics.push(
        diagnostic(
          file,
          "section-order",
          `H3 subsections in "## ${ownerSection}" must start with: ${requiredSubsections.join(", ")}`,
          headings[index]?.lineIndex === undefined
            ? undefined
            : headings[index].lineIndex + 1
        )
      );
    }
  }
}

function validateRequiredSubsectionContent(
  root: MarkdownRoot,
  headings: readonly RootHeading[],
  sectionEnd: number,
  subsectionContract: ArtifactSubsectionContract,
  file: ChangePlanArtifactName,
  diagnostics: ChangePlanDiagnostic[]
): void {
  for (const title of subsectionContract.requiredSubsections) {
    const subsection = headings.find((heading) => heading.title === title);
    if (subsection === undefined) {
      continue;
    }
    const nextHeading = headings.find(
      (heading) => heading.lineIndex > subsection.lineIndex
    );
    const subsectionEnd = nextHeading?.lineIndex ?? sectionEnd;
    if (!hasSemanticContent(root, subsection.lineIndex + 1, subsectionEnd)) {
      diagnostics.push(
        diagnostic(
          file,
          "empty-section",
          `"### ${title}" in "## ${subsectionContract.ownerSection}" must not be empty`,
          subsection.lineIndex + 1
        )
      );
    }
  }
}

function validateSubsections(
  root: MarkdownRoot,
  lines: readonly string[],
  headings: readonly RootHeading[],
  h2: readonly RootHeading[],
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): void {
  for (const subsectionContract of contract.subsectionContracts ?? []) {
    const section = h2.find(
      (heading) => heading.title === subsectionContract.ownerSection
    );
    if (section === undefined) {
      continue;
    }
    const nextH2 = h2.find((heading) => heading.lineIndex > section.lineIndex);
    const sectionEnd = nextH2?.lineIndex ?? lines.length;
    const subsectionHeadings = headings.filter(
      (heading) =>
        heading.depth === 3 &&
        heading.lineIndex > section.lineIndex &&
        heading.lineIndex < sectionEnd
    );
    validateRequiredSubsectionHeadings(
      subsectionHeadings,
      subsectionContract,
      contract.file,
      diagnostics
    );
    validateRequiredSubsectionContent(
      root,
      subsectionHeadings,
      sectionEnd,
      subsectionContract,
      contract.file,
      diagnostics
    );
  }
}

function isTaskHeading(
  heading: string,
  taskSections: ReadonlySet<string>
): heading is ChangePlanTaskHeading {
  return (
    taskSections.has(heading) && Object.hasOwn(taskSectionByHeading, heading)
  );
}

function validateTasks(
  root: MarkdownRoot,
  lines: readonly string[],
  h2: readonly RootHeading[],
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): Pick<
  ArtifactValidationResult,
  "completedTaskCount" | "taskCount" | "taskProgress"
> {
  const taskSections = new Set(contract.taskSections ?? []);
  const taskCounts = new Map<ChangePlanTaskHeading, number>(
    [...taskSections].map((title) => [title, 0])
  );
  const taskProgress = emptyTaskProgress();
  const seenTaskIds = new Map<string, number>();
  let completedTaskCount = 0;
  let taskCount = 0;

  for (const candidate of checklistCandidates(root, lines)) {
    const section = h2.findLast(
      (heading) => heading.lineIndex < candidate.lineIndex
    )?.title;
    if (section === undefined || !isTaskHeading(section, taskSections)) {
      diagnostics.push(
        diagnostic(
          contract.file,
          "task-outside-required-section",
          "checklist tasks must be inside Readiness, Implementation, or Verification",
          candidate.lineIndex + 1
        )
      );
      continue;
    }

    const match = taskLinePattern.exec(candidate.line);
    if (match === null) {
      diagnostics.push(
        diagnostic(
          contract.file,
          "invalid-task-syntax",
          "task must use '- [ ] <numeric-id> <description>' or '- [x] <numeric-id> <description>'",
          candidate.lineIndex + 1
        )
      );
      continue;
    }

    const completedMarker = match[1];
    const taskId = match[2];
    if (completedMarker === undefined || taskId === undefined) {
      continue;
    }
    const previousLine = seenTaskIds.get(taskId);
    if (previousLine !== undefined) {
      diagnostics.push(
        diagnostic(
          contract.file,
          "duplicate-task-id",
          `task id ${taskId} duplicates line ${previousLine}`,
          candidate.lineIndex + 1
        )
      );
    } else {
      seenTaskIds.set(taskId, candidate.lineIndex + 1);
    }
    taskCounts.set(section, (taskCounts.get(section) ?? 0) + 1);
    const progress = taskProgress[taskSectionByHeading[section]];
    progress.taskCount += 1;
    taskCount += 1;
    if (completedMarker.toLowerCase() === "x") {
      progress.completedTaskCount += 1;
      completedTaskCount += 1;
    }
  }

  for (const section of taskSections) {
    if ((taskCounts.get(section) ?? 0) === 0) {
      diagnostics.push(
        diagnostic(
          contract.file,
          "missing-task",
          `"## ${section}" must contain at least one valid checklist task`
        )
      );
    }
  }

  return { completedTaskCount, taskCount, taskProgress };
}

export function validateChangePlanArtifact(
  markdown: string,
  contract: ArtifactStructureContract
): ArtifactValidationResult {
  const normalized = normalizeNewlines(markdown);
  const root = fromMarkdown(normalized);
  const lines = normalized.split("\n");
  const diagnostics: ChangePlanDiagnostic[] = [];
  const headings = rootHeadings(root);
  const h2 = validateHeadings(root, lines, headings, contract, diagnostics);
  validateSubsections(root, lines, headings, h2, contract, diagnostics);
  const tasks =
    contract.taskSections === undefined
      ? {
          completedTaskCount: 0,
          taskCount: 0,
          taskProgress: emptyTaskProgress()
        }
      : validateTasks(root, lines, h2, contract, diagnostics);

  return {
    ...tasks,
    diagnostics
  };
}
