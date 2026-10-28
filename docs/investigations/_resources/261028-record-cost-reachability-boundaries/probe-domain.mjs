import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { runDecisionRecordsCli } from "./instrumented/tools/decision-records/src/cli.ts";
import { runDecisionRecordsCli as baselineCli } from "./baseline/tools/decision-records/src/cli.ts";
import { candidateDecisionBody } from "./baseline/tools/decision-records/tests/support-record-fixture.ts";
const base = path.dirname(new URL(import.meta.url).pathname);
globalThis.__evidence = { closureHas: 0, sequenceItems: 0, maxEqualPrefix: 0 };
async function cli(root, args, runner = runDecisionRecordsCli) {
  let stdout = "",
    stderr = "";
  const exitCode = await runner([...args, "--root", root], {
    cwd: root,
    io: { stdout: (t) => (stdout += t), stderr: (t) => (stderr += t) }
  });
  return { exitCode, stdout, stderr };
}
async function write(root, id, status, relations = []) {
  let text = candidateDecisionBody({ id, relations });
  if (status !== "candidate")
    text = text
      .replace("status: candidate", `status: ${status}`)
      .replace("alignment: null", "alignment: aligned")
      .replace("createdAt: null", "createdAt: 2026-10-01T00:00:00Z");
  const file = path.join(
    root,
    "docs/decisions",
    status === "archived" ? "archive" : "",
    id + ".md"
  );
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
}
const results = [];
for (const [M, K] of [
  [5, 4],
  [20, 20],
  [40, 40]
]) {
  const root = await fs.mkdtemp(path.join(base, `reallocation-${M}-${K}-`));
  for (let i = 0; i < M; i++) {
    const n = String(i).padStart(3, "0");
    const p1 = `a-${n}-p1`,
      p2 = `a-${n}-p2`;
    await write(root, p1, "archived");
    await write(root, p2, "archived");
    await write(root, `a-${n}-s1`, "active", [
      { type: "重划", target: p1 },
      { type: "重划", target: p2 }
    ]);
    await write(root, `a-${n}-s2`, "active", [{ type: "重划", target: p1 }]);
  }
  await write(root, "z-p1", "active");
  await write(root, "z-p2", "active");
  const sync = await cli(root, ["sync-index"]);
  assert.equal(sync.exitCode, 0, JSON.stringify(sync));
  const selected = [];
  for (let k = 0; k < K; k++) {
    const id = `z-s-${String(k).padStart(3, "0")}`;
    selected.push(id);
    await write(
      root,
      id,
      "candidate",
      k === 0
        ? [
            { type: "重划", target: "z-p1" },
            { type: "重划", target: "z-p2" }
          ]
        : [{ type: "重划", target: "z-p1" }]
    );
  }
  globalThis.__evidence.closureHas = 0;
  const evolve = await cli(root, [
    "evolve",
    ...selected.flatMap((id) => ["--successor", `aligned=${id}`]),
    "--keep-unrecorded-history"
  ]);
  const closureHas = globalThis.__evidence.closureHas;
  assert.equal(closureHas, M * K + 1);
  assert.equal(evolve.exitCode, 0, JSON.stringify(evolve));
  const check = await cli(root, ["check"], baselineCli);
  assert.equal(check.exitCode, 0, JSON.stringify(check));
  results.push({ kind: "reallocation", M, K, root, closureHas, evolve, check });
}
for (const [P, M] of [
  [4, 4],
  [20, 20],
  [40, 40]
]) {
  const root = await fs.mkdtemp(path.join(base, `trace-${P}-${M}-`));
  await write(root, "anchor", "archived");
  const common = [];
  for (let p = 0; p < P; p++) {
    const id = `b-common-${String(p).padStart(3, "0")}`;
    common.push(id);
    await write(root, id, "archived", [{ type: "替代", target: "anchor" }]);
  }
  for (let m = 0; m < M; m++) {
    await write(
      root,
      `z-merge-${String(m).padStart(3, "0")}`,
      "active",
      ["anchor", ...common].map((target) => ({ type: "归并", target }))
    );
  }
  const sync = await cli(root, ["sync-index"]);
  assert.equal(sync.exitCode, 0, JSON.stringify(sync));
  const check = await cli(root, ["check"]);
  assert.equal(check.exitCode, 0, JSON.stringify(check));
  globalThis.__evidence.sequenceItems = 0;
  globalThis.__evidence.maxEqualPrefix = 0;
  const trace = await cli(root, [
    "trace",
    "anchor",
    "--direction",
    "successors",
    "--depth",
    "1",
    "--max-records",
    String(P + M + 1),
    "--json"
  ]);
  assert.equal(trace.exitCode, 0, JSON.stringify(trace));
  const sequenceItems = globalThis.__evidence.sequenceItems;
  const maxEqualPrefix = globalThis.__evidence.maxEqualPrefix;
  assert.equal(maxEqualPrefix, P);
  assert.ok(sequenceItems >= P);
  const plain = await cli(
    root,
    [
      "trace",
      "anchor",
      "--direction",
      "successors",
      "--depth",
      "1",
      "--max-records",
      String(P + M + 1),
      "--json"
    ],
    baselineCli
  );
  assert.deepEqual(plain, trace);
  results.push({
    kind: "trace",
    P,
    M,
    root,
    sequenceItems,
    maxEqualPrefix,
    trace,
    check,
    baselineTraceEquivalent: true
  });
}
await fs.writeFile(
  path.join(base, "domain-results.json"),
  JSON.stringify(
    { version: "eea1d03e3429f83797e660d75326e0ebd752f61d", results },
    null,
    2
  )
);
console.log(
  JSON.stringify(
    results.map(
      ({ kind, M, K, P, root, closureHas, sequenceItems, maxEqualPrefix }) => ({
        kind,
        M,
        K,
        P,
        root,
        closureHas,
        sequenceItems,
        maxEqualPrefix
      })
    ),
    null,
    2
  )
);
// Minimal archival evidence: retain complete smallest CLI responses, selected raw lines and envelopes for scale cases.
const { createHash } = await import("node:crypto");
const sha = (text) => createHash("sha256").update(text).digest("hex");
const evidence = {
  version: "eea1d03e3429f83797e660d75326e0ebd752f61d",
  capture:
    "Complete raw CLI stdout/stderr remains in generated domain-results.json. This archival subset keeps the smallest full evolve/trace response; all larger check outputs, exit codes, stderr, exact first stdout line or JSON envelope fields, counts, and full-stdout SHA-256. Fixture inputs are deterministically generated in probe-domain.mjs.",
  results: results.map((r) => {
    const common = {
      kind: r.kind,
      M: r.M,
      ...(r.K === undefined ? { P: r.P } : { K: r.K }),
      closureHas: r.closureHas,
      sequenceItems: r.sequenceItems,
      maxEqualPrefix: r.maxEqualPrefix,
      check: r.check
    };
    if (r.kind === "reallocation")
      return {
        ...common,
        evolve:
          r.M === 5
            ? r.evolve
            : {
                exitCode: r.evolve.exitCode,
                stderr: r.evolve.stderr,
                stdoutFirstLine: r.evolve.stdout.split("\n")[0],
                stdoutSha256: sha(r.evolve.stdout)
              }
      };
    const t = JSON.parse(r.trace.stdout);
    assert.ok(t !== null && typeof t === "object" && !Array.isArray(t));
    assert.ok(Array.isArray(t.frontier));
    assert.ok(
      t.entries !== null &&
        typeof t.entries === "object" &&
        !Array.isArray(t.entries)
    );
    assert.ok(Array.isArray(t.traceIds) && Array.isArray(t.contextIds));
    for (const key of [
      "status",
      "source",
      "anchorId",
      "direction",
      "limits",
      "coverage",
      "traceIds",
      "contextIds"
    ]) {
      assert.ok(Object.hasOwn(t, key), `missing trace field: ${key}`);
    }
    return {
      ...common,
      baselineTraceEquivalent: r.baselineTraceEquivalent,
      trace:
        r.M === 4
          ? r.trace
          : {
              exitCode: r.trace.exitCode,
              stderr: r.trace.stderr,
              stdoutSha256: sha(r.trace.stdout),
              envelope: Object.fromEntries(
                [
                  "status",
                  "source",
                  "anchorId",
                  "direction",
                  "limits",
                  "coverage",
                  "traceIds",
                  "contextIds"
                ].map((k) => [k, t[k]])
              ),
              frontierCount: t.frontier.length,
              entryCount: Object.keys(t.entries).length
            }
    };
  })
};
await fs.writeFile(
  path.join(base, "domain-evidence.json"),
  JSON.stringify(evidence, null, 2)
);
