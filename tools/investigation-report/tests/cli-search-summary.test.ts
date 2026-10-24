import assert from "node:assert/strict";
import test from "node:test";

import { withTempRoot } from "./fixture-support.ts";
import { runInvestigationCli } from "./cli-support.ts";
import { writeCollection } from "./collection-support.ts";

test("source investigation CLI search prints exact metadata and lower-bound content summaries on proper channels", async () => {
  await withTempRoot("search-info-cli", async (root) => {
    await writeCollection(root, [{ id: "a" }, { id: "b" }, { id: "c" }]);
    const metadata = await runInvestigationCli(root, [
      "search",
      "当前",
      "--in",
      "metadata",
      "--limit",
      "1"
    ]);
    assert.equal(metadata.status, 0, metadata.stderr);
    assert.deepEqual(metadata.stdout.split("\n").slice(0, 6), [
      'Query: text="当前" in=metadata match=all',
      'Filters: {"tags":[]}',
      "Source: kind=published-index currentness=unchecked fallback=false",
      "Limits: maxRecords=1",
      "Counts: matched=3 precision=exact returned=1",
      "Coverage: scan=complete results=limited previews=n/a reasons=max-records"
    ]);
    assert.match(metadata.stderr, /search results limited: max-records/);
    assert.doesNotMatch(
      metadata.stderr,
      /search previews limited|sync-index|resolve the warning|source problem/
    );
    const content = await runInvestigationCli(root, [
      "search",
      "当前",
      "--limit",
      "1"
    ]);
    assert.equal(content.status, 0, content.stderr);
    assert.match(
      content.stdout,
      /Counts: matched>=2 precision=lower-bound returned=1/
    );
    assert.match(
      content.stdout,
      /Coverage: scan=limited results=limited previews=complete reasons=max-records/
    );
    const zero = await runInvestigationCli(root, ["search", "absent"]);
    assert.equal(zero.status, 0, zero.stderr);
    assert.match(zero.stdout, /Counts: matched=0 precision=exact returned=0/);
    assert.match(
      zero.stdout,
      /Coverage: scan=complete results=complete previews=complete reasons=none\nNo investigation reports matched/
    );
  });
});
