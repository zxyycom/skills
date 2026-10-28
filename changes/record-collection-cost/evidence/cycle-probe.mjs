import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = "tools/shared/src/graph/relations.ts";
const temporaryDirectory = await mkdtemp(join(tmpdir(), "record-cycle-"));

function replaceOnce(source, target, replacement) {
  assert.equal(
    source.split(target).length,
    2,
    `expected one injection point: ${target}`
  );
  return source.replace(target, replacement);
}

function instrument(source, baseline) {
  assert.equal(
    (
      source.match(
        /export type \{[\s\S]*?\} from "\.\/trace-contract\.ts";/gu
      ) ?? []
    ).length,
    1
  );
  const withoutTraceExport = replaceOnce(
    source,
    'export { selectRelationGraphTrace } from "./trace-selection.ts";',
    ""
  ).replace(/export type \{[\s\S]*?\} from "\.\/trace-contract\.ts";/u, "");
  const point = baseline
    ? "const cycleStart = idStack.indexOf(target);"
    : "const cycleStart = stackPosition.get(target)!;";
  const measured = baseline
    ? `${point} probes += cycleStart + 1;`
    : `${point} probes += 1;`;
  return (
    "export let probes = 0;\n" +
    replaceOnce(withoutTraceExport, point, measured)
  );
}

try {
  const before = execFileSync("git", ["show", `696b888b:${sourcePath}`], {
    encoding: "utf8"
  });
  const after = await readFile(sourcePath, "utf8");
  for (const [name, source, baseline] of [
    ["before", before, true],
    ["after", after, false]
  ]) {
    await writeFile(
      join(temporaryDirectory, `${name}.ts`),
      instrument(source, baseline)
    );
  }
  const oldGraph = await import(
    pathToFileURL(join(temporaryDirectory, "before.ts")).href
  );
  const newGraph = await import(
    pathToFileURL(join(temporaryDirectory, "after.ts")).href
  );
  const ids = Array.from({ length: 1000 }, (_, index) =>
    String(index).padStart(4, "0")
  );
  const edges = [
    ...ids
      .slice(1)
      .map((target, index) => ({ source: ids[index], target, type: "rel" })),
    ...ids
      .slice(2)
      .map((source, index) => ({ source, target: ids[index + 1], type: "rel" }))
  ];
  const oldIssues = oldGraph.relationGraphStructuralIssues(
    oldGraph.buildRelationGraph(ids, edges)
  );
  const newIssues = newGraph.relationGraphStructuralIssues(
    newGraph.buildRelationGraph(ids, edges)
  );
  assert.deepEqual(oldIssues, newIssues);
  assert.equal(oldGraph.probes, 499499);
  assert.equal(newGraph.probes, 998);
  console.log(
    JSON.stringify({
      nodes: ids.length,
      cycles: oldIssues.length,
      beforeScannedStackPositions: oldGraph.probes,
      afterMapLookups: newGraph.probes,
      diagnosticsEqual: true
    })
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
