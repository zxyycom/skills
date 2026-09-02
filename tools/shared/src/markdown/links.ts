import fs from "node:fs/promises";
import path from "node:path";
import GithubSlugger from "github-slugger";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import { pathExists, toPosix } from "../node/filesystem.ts";

export type MarkdownLinkTarget = {
  kind: "link" | "image" | "definition";
  target: string;
};

export type MarkdownLinkExtraction = {
  targets: MarkdownLinkTarget[];
  missingReferenceLabels: string[];
};

export type MarkdownLinkReporter = (error: string) => void;

type HeadingAnchorReader = (filePath: string) => Promise<Set<string>>;

type MarkdownLinkValidationContext = Readonly<{
  filePath: string;
  getHeadingAnchors: HeadingAnchorReader;
  relativeFilePath: string;
  report: MarkdownLinkReporter;
  workspaceRoot: string;
}>;

type NormalizedMarkdownTarget =
  | { kind: "empty"; target: string }
  | { kind: "external"; target: string }
  | {
      anchor: string | null;
      kind: "internal";
      pathTarget: string | null;
      target: string;
    };

type MarkdownNode = {
  children?: MarkdownNode[];
  identifier?: unknown;
  label?: unknown;
  type?: unknown;
  url?: unknown;
};

const targetNodeTypes = new Set(["link", "image", "definition"]);
const referenceNodeTypes = new Set(["linkReference", "imageReference"]);

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().replace(/\s+/g, " ").toUpperCase();
}

function visitMarkdownNode(
  node: MarkdownNode,
  visit: (node: MarkdownNode) => void
): void {
  visit(node);

  for (const child of node.children ?? []) {
    visitMarkdownNode(child, visit);
  }
}

export function extractMarkdownLinks(markdown: string): MarkdownLinkExtraction {
  const tree = fromMarkdown(markdown) as MarkdownNode;
  const targets: MarkdownLinkTarget[] = [];
  const definitionIdentifiers = new Set<string>();
  const references: Array<{ identifier: string; label: string }> = [];

  visitMarkdownNode(tree, (node) => {
    if (typeof node.type !== "string") {
      return;
    }

    if (targetNodeTypes.has(node.type) && typeof node.url === "string") {
      targets.push({
        kind: node.type as MarkdownLinkTarget["kind"],
        target: node.url
      });

      if (node.type === "definition" && typeof node.identifier === "string") {
        definitionIdentifiers.add(normalizeIdentifier(node.identifier));
      }
      return;
    }

    if (
      referenceNodeTypes.has(node.type) &&
      typeof node.identifier === "string"
    ) {
      references.push({
        identifier: normalizeIdentifier(node.identifier),
        label: typeof node.label === "string" ? node.label : node.identifier
      });
    }
  });

  const missingReferenceLabels = references
    .filter((reference) => !definitionIdentifiers.has(reference.identifier))
    .map((reference) => reference.label);

  return { targets, missingReferenceLabels };
}

export function extractMarkdownHeadingAnchors(markdown: string): Set<string> {
  const tree = fromMarkdown(markdown) as MarkdownNode;
  const slugger = new GithubSlugger();
  const anchors = new Set<string>();

  visitMarkdownNode(tree, (node) => {
    if (node.type !== "heading") {
      return;
    }

    anchors.add(slugger.slug(toString(node)));
  });

  return anchors;
}

function normalizeMarkdownTarget(rawTarget: string): NormalizedMarkdownTarget {
  const target = rawTarget.trim().replace(/^<|>$/g, "");
  if (target.length === 0) {
    return { kind: "empty", target };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return { kind: "external", target };
  }

  const hashIndex = target.indexOf("#");
  const pathTarget = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  const anchor = hashIndex >= 0 ? target.slice(hashIndex + 1) : null;

  return {
    anchor,
    kind: "internal",
    pathTarget: pathTarget.length > 0 ? pathTarget : null,
    target
  };
}

function decodeMarkdownAnchor(anchor: string): string | null {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return null;
  }
}

function createHeadingAnchorReader(): HeadingAnchorReader {
  const headingAnchorsByPath = new Map<string, Set<string>>();
  return async (filePath) => {
    const cached = headingAnchorsByPath.get(filePath);
    if (cached) {
      return cached;
    }

    const markdown = await fs.readFile(filePath, "utf8");
    const anchors = extractMarkdownHeadingAnchors(markdown);
    headingAnchorsByPath.set(filePath, anchors);
    return anchors;
  };
}

function reportsOutsideRoot(resolved: string, workspaceRoot: string): boolean {
  const relativeToRoot = path.relative(workspaceRoot, resolved);
  return (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  );
}

async function validateMarkdownTarget(
  target: string,
  context: MarkdownLinkValidationContext
): Promise<void> {
  const normalized = normalizeMarkdownTarget(target);
  if (normalized.kind === "empty") {
    context.report(
      `${context.relativeFilePath} has an empty markdown link target`
    );
    return;
  }
  if (normalized.kind === "external") {
    return;
  }

  const resolved = normalized.pathTarget
    ? path.resolve(path.dirname(context.filePath), normalized.pathTarget)
    : context.filePath;
  if (reportsOutsideRoot(resolved, context.workspaceRoot)) {
    context.report(
      `${context.relativeFilePath} links outside the validation root: ${target}`
    );
    return;
  }
  if (!(await pathExists(resolved))) {
    context.report(
      `${context.relativeFilePath} has a missing link target: ${target}`
    );
    return;
  }
  if (normalized.anchor === null) {
    return;
  }

  const decodedAnchor = decodeMarkdownAnchor(normalized.anchor);
  if (decodedAnchor === null || decodedAnchor.length === 0) {
    context.report(
      `${context.relativeFilePath} has an invalid markdown anchor: ${target}`
    );
    return;
  }
  if (path.extname(resolved) !== ".md") {
    context.report(
      `${context.relativeFilePath} uses an anchor on a non-markdown target: ${target}`
    );
    return;
  }

  const anchors = await context.getHeadingAnchors(resolved);
  if (!anchors.has(decodedAnchor)) {
    context.report(
      `${context.relativeFilePath} links to a missing markdown heading anchor: ${target}`
    );
  }
}

export async function validateMarkdownLinks(
  markdownFiles: readonly string[],
  report: MarkdownLinkReporter,
  workspaceRoot: string
): Promise<void> {
  const getHeadingAnchors = createHeadingAnchorReader();

  for (const filePath of markdownFiles) {
    const markdown = await fs.readFile(filePath, "utf8");
    const { targets, missingReferenceLabels } = extractMarkdownLinks(markdown);
    const relativeFilePath = toPosix(path.relative(workspaceRoot, filePath));

    for (const label of missingReferenceLabels) {
      report(
        `${relativeFilePath} has an undefined markdown reference link: ${label}`
      );
    }

    for (const { target } of targets) {
      await validateMarkdownTarget(target, {
        filePath,
        getHeadingAnchors,
        relativeFilePath,
        report,
        workspaceRoot
      });
    }
  }
}
