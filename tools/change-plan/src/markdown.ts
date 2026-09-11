import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import type {
  ArtifactStructureContract,
  ArtifactValidationResult,
  ChangePlanArtifactName,
  ChangePlanDiagnostic,
  ChangePlanTaskHeading,
  ChangePlanTaskProgress,
  ChangePlanTaskSection
} from "./types.ts";
import { validateSubsections } from "./markdown-subsections.ts";
import { validateTasks } from "./markdown-tasks.ts";

export type MarkdownRoot = ReturnType<typeof fromMarkdown>;
type RootContent = MarkdownRoot["children"][number];
type MarkdownHeading = Extract<RootContent, { type: "heading" }>;

export type RootHeading = {
  depth: MarkdownHeading["depth"];
  lineIndex: number;
  title: string;
};

export type ChecklistCandidate = {
  line: string;
  lineIndex: number;
};

export type TaskValidationContext = {
  completedTaskCount: number;
  contract: ArtifactStructureContract;
  diagnostics: ChangePlanDiagnostic[];
  h2: readonly RootHeading[];
  seenTaskIds: Map<string, number>;
  taskCount: number;
  taskCounts: Map<ChangePlanTaskHeading, number>;
  taskProgress: ChangePlanTaskProgress;
  taskSections: ReadonlySet<ChangePlanTaskHeading>;
};

const taskLinePrefixPattern = /^- \[[^\]]*\]/u;
export const taskLinePattern =
  /^- \[([ xX])\] ([0-9]+\.[0-9]+(?:\.[0-9]+)*) (.+\S|\S)$/u;
export const taskSectionByHeading: Readonly<
  Record<ChangePlanTaskHeading, ChangePlanTaskSection>
> = {
  Implementation: "implementation",
  Readiness: "readiness",
  Verification: "verification"
};

export function emptyTaskProgress(): ChangePlanTaskProgress {
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

export function hasSemanticContent(
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

export function checklistCandidates(
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

export function diagnostic(
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

function validateH1(
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
  return h1;
}

function validateRequiredSections(
  headings: readonly RootHeading[],
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): RootHeading[] {
  const h2 = headings.filter((heading) => heading.depth === 2);
  for (const [index, title] of contract.requiredSections.entries()) {
    validateRequiredSection({ contract, diagnostics, h2, index, title });
  }
  return h2;
}

function validateRequiredSection(context: {
  contract: ArtifactStructureContract;
  diagnostics: ChangePlanDiagnostic[];
  h2: readonly RootHeading[];
  index: number;
  title: string;
}): void {
  const { contract, diagnostics, h2, index, title } = context;
  const matches = h2.filter((heading) => heading.title === title);
  if (matches.length === 0) {
    diagnostics.push(
      diagnostic(
        contract.file,
        "missing-section",
        `missing required "## ${title}" section`
      )
    );
    return;
  }
  if (matches.length > 1)
    diagnostics.push(
      diagnostic(
        contract.file,
        "duplicate-section",
        `"## ${title}" must appear exactly once`,
        lineOf(matches[1])
      )
    );
  if (h2[index]?.title !== title)
    diagnostics.push(
      diagnostic(
        contract.file,
        "section-order",
        `H2 sections must start with: ${contract.requiredSections.join(", ")}`,
        lineOf(h2[index])
      )
    );
}
function lineOf(heading: RootHeading | undefined): number | undefined {
  return heading === undefined ? undefined : heading.lineIndex + 1;
}

function validateIntroduction(
  root: MarkdownRoot,
  h1: readonly RootHeading[],
  h2: readonly RootHeading[],
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): void {
  const firstH1 = h1[0];
  const firstH2 = h2[0];
  if (
    firstH1 === undefined ||
    firstH2 === undefined ||
    hasSemanticContent(root, firstH1.lineIndex + 1, firstH2.lineIndex)
  ) {
    return;
  }
  diagnostics.push(
    diagnostic(
      contract.file,
      "empty-introduction",
      "artifact must contain a non-empty change summary between H1 and the first H2",
      firstH1.lineIndex + 1
    )
  );
}

function validateSectionContents(
  root: MarkdownRoot,
  lines: readonly string[],
  h2: readonly RootHeading[],
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): void {
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
}

function validateHeadings(
  root: MarkdownRoot,
  lines: readonly string[],
  headings: readonly RootHeading[],
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): RootHeading[] {
  const h1 = validateH1(lines, headings, contract, diagnostics);
  const h2 = validateRequiredSections(headings, contract, diagnostics);
  validateIntroduction(root, h1, h2, contract, diagnostics);
  validateSectionContents(root, lines, h2, contract, diagnostics);
  return h2;
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
  validateSubsections({ contract, diagnostics, h2, headings, lines, root });
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
