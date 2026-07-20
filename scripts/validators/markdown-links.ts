import fs from "node:fs/promises";
import path from "node:path";
import { extractMarkdownHeadingAnchors, extractMarkdownLinks } from "../lib/markdown-links.ts";
import { pathExists, rootDir, toPosix } from "../lib/project.ts";
import type { ReportValidationError } from "../lib/validation.ts";

type NormalizedMarkdownTarget =
  | { kind: "empty"; target: string }
  | { kind: "external"; target: string }
  | { anchor: string | null; kind: "internal"; pathTarget: string | null; target: string };

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

  return { anchor, kind: "internal", pathTarget: pathTarget.length > 0 ? pathTarget : null, target };
}

function decodeMarkdownAnchor(anchor: string): string | null {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return null;
  }
}

export async function validateMarkdownLinks(
  markdownFiles: string[],
  report: ReportValidationError,
  workspaceRoot: string = rootDir
): Promise<void> {
  const headingAnchorsByPath = new Map<string, Set<string>>();

  async function getHeadingAnchors(filePath: string): Promise<Set<string>> {
    const cached = headingAnchorsByPath.get(filePath);
    if (cached) {
      return cached;
    }

    const markdown = await fs.readFile(filePath, "utf8");
    const anchors = extractMarkdownHeadingAnchors(markdown);
    headingAnchorsByPath.set(filePath, anchors);
    return anchors;
  }

  for (const filePath of markdownFiles) {
    const markdown = await fs.readFile(filePath, "utf8");
    const { targets, missingReferenceLabels } = extractMarkdownLinks(markdown);
    const relativeFilePath = toPosix(path.relative(workspaceRoot, filePath));

    for (const label of missingReferenceLabels) {
      report(`${relativeFilePath} has an undefined markdown reference link: ${label}`);
    }

    for (const { target } of targets) {
      const normalized = normalizeMarkdownTarget(target);
      if (normalized.kind === "empty") {
        report(`${relativeFilePath} has an empty markdown link target`);
        continue;
      }

      if (normalized.kind === "external") {
        continue;
      }

      const resolved = normalized.pathTarget
        ? path.resolve(path.dirname(filePath), normalized.pathTarget)
        : filePath;
      const relativeToRoot = path.relative(workspaceRoot, resolved);
      if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
        report(`${relativeFilePath} links outside the validation root: ${target}`);
        continue;
      }

      if (!await pathExists(resolved)) {
        report(`${relativeFilePath} has a missing link target: ${target}`);
        continue;
      }

      if (normalized.anchor === null) {
        continue;
      }

      const decodedAnchor = decodeMarkdownAnchor(normalized.anchor);
      if (decodedAnchor === null || decodedAnchor.length === 0) {
        report(`${relativeFilePath} has an invalid markdown anchor: ${target}`);
        continue;
      }

      if (path.extname(resolved) !== ".md") {
        report(`${relativeFilePath} uses an anchor on a non-markdown target: ${target}`);
        continue;
      }

      const anchors = await getHeadingAnchors(resolved);
      if (!anchors.has(decodedAnchor)) {
        report(`${relativeFilePath} links to a missing markdown heading anchor: ${target}`);
      }
    }
  }
}
