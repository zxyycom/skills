import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDecisionMarkdown,
  replaceDecisionFrontmatter
} from "../src/decision-metadata.ts";
import { validateDecisionBody } from "../src/record.ts";
import { candidateDecisionBody } from "./support.ts";

test("decision Markdown requires sorted unique tag tokens", async () => {
  for (const replacement of [
    "relations: []",
    "tags:\nrelations: []",
    "tags:\n  - invalid_tag\nrelations: []",
    "tags:\n  - zeta\n  - alpha\nrelations: []",
    "tags:\n  - alpha\n  - alpha\nrelations: []"
  ]) {
    const errors: string[] = [];
    await validateDecisionBody({
      body: candidateDecisionBody().replace(
        "tags:\n  - decision-records\nrelations: []",
        replacement
      ),
      errors,
      decisionId: "use-tags",
      sourcePath: "use-tags.md",
      targetExists: () => false
    });
    assert.notEqual(errors.length, 0, replacement);
  }
});

test("decision Markdown parses canonical tags and round-trips its semantic fields", () => {
  const errors: string[] = [];
  const markdown = candidateDecisionBody({
    tags: ["decision-records", "project-tooling"]
  });
  const parsed = parseDecisionMarkdown({
    errors,
    markdown,
    relativePath: "use-tags.md"
  });

  assert.deepEqual(errors, []);
  assert.ok(parsed);
  assert.deepEqual(parsed.tags, ["decision-records", "project-tooling"]);
  assert.equal(parsed.projection.title, "使用 Markdown 建立状态");
  assert.equal(parsed.body, markdown.slice(markdown.indexOf("## 目的")));

  const serialized = replaceDecisionFrontmatter(markdown, {
    metadata: { status: "candidate", alignment: null, createdAt: null }
  });
  assert.ok(serialized);
  const roundTripErrors: string[] = [];
  const roundTripped = parseDecisionMarkdown({
    errors: roundTripErrors,
    markdown: serialized,
    relativePath: "use-tags.md"
  });
  assert.deepEqual(roundTripErrors, []);
  assert.ok(roundTripped);
  assert.deepEqual(roundTripped.tags, parsed.tags);
  assert.deepEqual(roundTripped.projection, parsed.projection);
  assert.equal(roundTripped.body, parsed.body);
});

test("decision Markdown requires explicit alignment for every established status", () => {
  for (const [status, alignment] of [
    ["active", "aligned"],
    ["active", "unaligned"],
    ["archived", "aligned"],
    ["archived", "unaligned"]
  ] as const) {
    const errors: string[] = [];
    const parsed = parseDecisionMarkdown({
      errors,
      markdown: candidateDecisionBody()
        .replace("status: candidate", `status: ${status}`)
        .replace("alignment: null", `alignment: ${alignment}`)
        .replace("createdAt: null", "createdAt: 2026-09-08T10:20:30Z"),
      relativePath:
        status === "archived"
          ? `archive/use-${status}-${alignment}.md`
          : `use-${status}-${alignment}.md`
    });
    assert.ok(parsed);
    assert.deepEqual(errors, []);
  }

  for (const [status, invalidAlignment] of [
    ["active", "alignment: null"],
    ["active", ""],
    ["archived", "alignment: null"],
    ["archived", ""]
  ] as const) {
    const errors: string[] = [];
    const parsed = parseDecisionMarkdown({
      errors,
      markdown: candidateDecisionBody()
        .replace("status: candidate", `status: ${status}`)
        .replace("alignment: null", invalidAlignment)
        .replace("createdAt: null", "createdAt: 2026-09-08T10:20:30Z"),
      relativePath:
        status === "archived"
          ? `archive/use-${status}-invalid.md`
          : `use-${status}-invalid.md`
    });
    assert.equal(parsed, null);
    assert.match(errors.join("\n"), /alignment/);
  }
});

test("decision Markdown rejects removed domain fields and unknown frontmatter", async () => {
  for (const line of [
    "domain: decision-records",
    "domains: []",
    "extra: value"
  ]) {
    const errors: string[] = [];
    await validateDecisionBody({
      body: candidateDecisionBody().replace("tags:", `${line}\ntags:`),
      errors,
      decisionId: "use-tags",
      sourcePath: "use-tags.md",
      targetExists: () => false
    });
    assert.notEqual(errors.length, 0, line);
  }
});
