// Formation-time investigation evidence, not a maintained test or CLI.
// Run: node <this-file> <repository-root> [scenario] [count]
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] ?? process.cwd());
const scenario = process.argv[3];
const count = Number(process.argv[4] ?? 0);
const self = fileURLToPath(import.meta.url);
if (!scenario) {
  const cases = [
    ["reader-all", 1000], ["reader-all", 1001],
    ["reader-all", 5000], ["reader-all", 10000],
    ["ir-list", 0], ["ir-metadata", 0], ["matcher-miss", 1000],
    ["matcher-miss", 10000], ["matcher-hit", 1000],
    ["record-previews", 5000]
  ];
  const results = cases.map(([name, n]) => {
    const result = spawnSync(process.execPath, [self, root, name, String(n)], {
      encoding: "utf8", maxBuffer: 4 * 1024 * 1024
    });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  });
  process.stdout.write(JSON.stringify({
    node: process.version,
    method: "isolated process per case; registerHooks inserts counters only in memory; no production edits",
    results
  }, null, 2) + "\n");
  process.exit(0);
}

globalThis.__constantAudit = {};
const hit = (name, amount = 1) => {
  const stats = globalThis.__constantAudit;
  stats[name] = (stats[name] ?? 0) + amount;
};
globalThis.__constantHit = hit;
const patches = {
  "tools/index-runtime/src/reader.ts": [
    ["const staticEntries = materializeEffectiveEntries({", "readerMaterialization"],
    ["const entries = effectiveEntries(queryOptions.runtimeStates);", "readerQuery"],
    ["const queried = query(\n", "allPage"]
  ],
  "tools/index-runtime/src/query.ts": [
    ["const parsedQuery = validateStateIndexQueryValue(options.query ?? {});", "queryMaterialized"],
    ["const byId = new Map<string, MaterializedStateIndexEntry<State>>();", "materializeEffectiveEntries"],
    ["const entries = options.entries.filter((entry) =>", "filterVisited", "options.entries.length"],
    ["entries.sort((left, right) => compareEntries(left, right, sort));", "sortVisited", "entries.length"]
  ],
  "tools/index-runtime/src/projection.ts": [
    ["const parsedMetadata = parseStateIndexMetadata(", "normalizeIndex"],
    ["let state: State;", "projectState"],
    ["if (definition.validateIndex === undefined) {", "completeValidation"]
  ],
  "tools/index-runtime/src/query-fields.ts": [
    ["const values: Record<string, StateIndexKeyScalar[]> = {};", "materializeEntry"]
  ],
  "tools/index-runtime/src/snapshot-parser.ts": [
    ["let value: unknown;", "parseEnvelope"]
  ],
  "tools/shared/src/file-text-search/segment-matcher.ts": [
    ["const normalized = segment.normalize(\"NFKC\").toLowerCase();", "normalizeSegment"],
    ["for (const grapheme of segmenter.segment(segment)) {", "mapSegment"],
    ["const expected = grapheme.segment.normalize(\"NFKC\").toLowerCase();", "mapGrapheme"]
  ],
  "tools/shared/src/file-text-search/previews.ts": [
    ["const lines = content.split(/\\r\\n|[\\n\\r]/u);", "splitPhysicalLines", "content.length"]
  ]
};
const hashes = {};
registerHooks({ load(url, context, nextLoad) {
  const loaded = nextLoad(url, context);
  if (!url.startsWith("file:")) return loaded;
  const relative = path.relative(root, fileURLToPath(url)).split(path.sep).join("/");
  if (!patches[relative]) return loaded;
  let source = String(loaded.source);
  hashes[relative] = createHash("sha256").update(source).digest("hex");
  for (const [anchor, name, amount] of patches[relative]) {
    if (source.split(anchor).length !== 2) throw new Error(`Non-unique instrumentation: ${relative}: ${name}`);
    const invocationCount = amount ? `globalThis.__constantHit(${JSON.stringify(`${name}Calls`)});\n  ` : "";
    source = source.replace(anchor, `${invocationCount}globalThis.__constantHit(${JSON.stringify(name)}${amount ? `, ${amount}` : ""});\n  ${anchor}`);
  }
  return { ...loaded, source };
} });
const load = (relative) => import(pathToFileURL(path.join(root, relative)).href);
const value = (result) => {
  if (result.status !== "ok") throw new Error(JSON.stringify(result));
  return result.value;
};
const reset = () => { globalThis.__constantAudit = {}; };
let result;
if (scenario === "reader-all") {
  const api = await load("tools/index-runtime/src/index.ts");
  const states = Object.fromEntries(Array.from({ length: count }, (_, i) => [
    `item-${String(i).padStart(5, "0")}`, { ordinal: i, title: `item ${i}` }
  ]));
  const sourceRevision = {
    entries: Object.fromEntries(Object.keys(states).map((id) => [id, id])), metadata: "fixed"
  };
  const definition = api.defineStateIndexDefinition({
    namespace: "constant-audit", definitionVersion: 1,
    queryFields: [{ name: "ordinal", mode: "range", sources: [{ kind: "state-path", path: ["ordinal"] }] }],
    parseState: (state) => state, parseMetadata: (metadata) => metadata,
    read: async () => ({ states, metadata: {}, sourceRevision }),
    readRevision: async () => sourceRevision
  });
  const index = value(await api.buildStateIndex(definition, { root }));
  reset();
  const reader = api.createStateIndexReader({ definition, index, indexPath: "audit.json" });
  const construction = { ...globalThis.__constantAudit };
  reset();
  const all = value(reader.all({ sort: [{ key: "ordinal", direction: "desc" }] }));
  result = { count, returned: all.length, first: all[0].id, last: all.at(-1).id,
    construction, operation: { ...globalThis.__constantAudit } };
} else if (scenario === "ir-list" || scenario === "ir-metadata") {
  const api = await load("tools/investigation-report/src/query.ts");
  reset();
  const listed = scenario === "ir-list"
    ? await api.queryInvestigationIndex({ workspaceRoot: root, limit: 1 })
    : await api.searchInvestigationReports({ workspaceRoot: root, in: "metadata", query: "never-appears", limit: 1 });
  if (listed.errors.length) throw new Error(JSON.stringify(listed.errors));
  result = { total: listed.total ?? listed.searchInfo.counts.matched.value,
    returned: listed.entries.length, operation: { ...globalThis.__constantAudit } };
} else if (scenario.startsWith("matcher-")) {
  const api = await load("tools/shared/src/file-text-search/segment-matcher.ts");
  const text = "机制研究与数据分析 sample source 0123456789 ".repeat(3);
  const segments = Array.from({ length: count }, (_, identifier) => ({ identifier, text }));
  const matcher = api.createTextSearchMatcher({ mode: "all", text: scenario === "matcher-hit" ? "机制" : "never-appears" });
  reset();
  const matched = api.matchTextSegments(matcher, segments);
  result = { count, textUtf16Units: count * text.length, matched: matched.length,
    returnedRangeCount: matched.reduce((sum, entry) => sum + entry.ranges.length, 0),
    operation: { ...globalThis.__constantAudit } };
} else if (scenario === "record-previews") {
  const api = await load("tools/shared/src/file-text-search/record-search.ts");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "constant-audit-preview-"));
  try {
    const content = Array.from({ length: count }, (_, i) => `line ${i} needle evidence`).join("\n") + "\n";
    await fs.writeFile(path.join(temporary, "report.md"), content);
    reset();
    const searched = await api.searchRecordText({ root: temporary,
      selection: { kind: "files", sourcePaths: ["report.md"] },
      query: { mode: "all", text: "needle" },
      preview: { contextLines: 1, maxFiles: 50, maxMatchesPerFile: 3, maxPreviewCharacters: 24000 }
    });
    result = { lines: count, contentUtf16Units: content.length, matched: searched.matched,
      previews: searched.hits[0].previews.length, operation: { ...globalThis.__constantAudit } };
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
} else throw new Error(`Unknown scenario: ${scenario}`);
process.stdout.write(JSON.stringify({ scenario, ...result, sourceHashes: hashes }) + "\n");
