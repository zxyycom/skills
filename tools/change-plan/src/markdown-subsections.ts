import type {
  ArtifactSubsectionContract,
  ArtifactStructureContract,
  ChangePlanArtifactName,
  ChangePlanDiagnostic
} from "./types.ts";
import {
  diagnostic,
  hasSemanticContent,
  type MarkdownRoot,
  type RootHeading
} from "./markdown.ts";

type SubsectionValidationContext = Readonly<{
  diagnostics: ChangePlanDiagnostic[];
  file: ChangePlanArtifactName;
  headings: readonly RootHeading[];
  root: MarkdownRoot;
  sectionEnd: number;
  subsectionContract: ArtifactSubsectionContract;
}>;
export type SubsectionsInput = Readonly<{
  contract: ArtifactStructureContract;
  diagnostics: ChangePlanDiagnostic[];
  h2: readonly RootHeading[];
  headings: readonly RootHeading[];
  lines: readonly string[];
  root: MarkdownRoot;
}>;

function validateRequiredSubsectionHeadings(
  context: SubsectionValidationContext
): void {
  const { diagnostics, file, headings, subsectionContract } = context;
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
  context: SubsectionValidationContext
): void {
  const { diagnostics, file, headings, root, sectionEnd, subsectionContract } =
    context;
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

export function validateSubsections(input: SubsectionsInput): void {
  const { contract, diagnostics, h2, headings, lines, root } = input;
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
    const context = {
      diagnostics,
      file: contract.file,
      headings: subsectionHeadings,
      root,
      sectionEnd,
      subsectionContract
    };
    validateRequiredSubsectionHeadings(context);
    validateRequiredSubsectionContent(context);
  }
}
