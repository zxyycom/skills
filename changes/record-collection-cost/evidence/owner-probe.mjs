import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const source = await readFile(
  "tools/investigation-report/src/candidate-read-resources.ts",
  "utf8"
);
const startMarker = "function candidateGitResourcesByOwner(";
const endMarker = "\nasync function visibleCandidateOwnerResources(";
assert.equal(source.split(startMarker).length, 2);
assert.equal(source.split(endMarker).length, 2);
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
assert.ok(end > start);
const temporaryDirectory = await mkdtemp(join(tmpdir(), "owner-index-"));
try {
  const types =
    'declare function prepareInvestigationResourceRoot(): Promise<{ status: "ready"; membership: { mode: "version-control"; files: readonly string[] } }>;\n';
  await writeFile(
    join(temporaryDirectory, "probe.ts"),
    types + "export " + source.slice(start, end)
  );
  const { candidateGitResourcesByOwner } = await import(
    pathToFileURL(join(temporaryDirectory, "probe.ts")).href
  );
  const files = Array.from(
    { length: 1000 },
    (_, index) => `owner-${index % 100}/file-${index}`
  );
  const owners = Array.from({ length: 100 }, (_, index) => `owner-${index}`);
  let visits = 0;
  const countedFiles = {
    *[Symbol.iterator]() {
      for (const file of files) {
        visits += 1;
        yield file;
      }
    }
  };
  const actual = candidateGitResourcesByOwner(
    {
      status: "ready",
      membership: { mode: "version-control", files: countedFiles }
    },
    owners
  );
  const expected = new Map(
    owners.map((owner) => [
      owner,
      files.filter((file) => file.startsWith(owner + "/"))
    ])
  );
  assert.deepEqual(actual, expected);
  assert.equal(visits, 1000);
  console.log(
    JSON.stringify({
      files: files.length,
      owners: owners.length,
      baselineExpectedFileVisits: files.length * owners.length,
      afterFileVisits: visits,
      ownerResultsEqual: true
    })
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
