import assert from "node:assert/strict";
import { test } from "node:test";
import { withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";
import { runInvestigationCli } from "./cli-support.ts";

test("CLI search defaults to content and distinguishes metadata output", async () => {
  await withTempRoot("cli-search-defaults", async (root) => {
    await writeCollection(root, [
      {
        formedAt: "2026-08-28T10:00:00+00:00",
        id: "alpha",
        question: "Current indexed evidence",
        relations: [
          {
            summary: "Source relation summary",
            target: "zulu",
            type: "补充"
          }
        ],
        tags: ["indexed"],
        title: "Alpha metadata"
      },
      {
        formedAt: "2026-08-28T09:00:00+00:00",
        id: "zulu",
        question: "Other indexed evidence",
        tags: ["indexed"],
        title: "Limited metadata"
      }
    ]);
    const defaultContent = await runInvestigationCli(root, [
      "search",
      "Current"
    ]);
    const explicitContent = await runInvestigationCli(root, [
      "search",
      "Current",
      "--in",
      "content"
    ]);
    const metadata = await runInvestigationCli(root, [
      "search",
      "Current",
      "--in",
      "metadata"
    ]);
    assert.equal(defaultContent.status, 0, defaultContent.stderr);
    assert.equal(explicitContent.status, 0, explicitContent.stderr);
    assert.equal(defaultContent.stdout, explicitContent.stdout);
    assert.equal(metadata.status, 0, metadata.stderr);
    assert.match(metadata.stdout, /matchedFields: question/u);
    assert.doesNotMatch(metadata.stdout, /^  \d+: /mu);
  });
});
