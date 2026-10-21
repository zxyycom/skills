// 静态相对导入使 git archive 中的副本自然运行固定基线；不改源码。
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { serializeDecisionFrontmatter } from "../../../../tools/decision-records/src/decision-metadata.ts";
import {
  isDecisionId,
  isDecisionTag,
  isDecisionSourcePath
} from "../../../../tools/decision-records/src/decision-path.ts";
import {
  buildDecisionIndexFromSnapshot,
  decisionIndexState,
  decisionSourceRevision,
  serializeDecisionIndex,
  syncDecisionIndex
} from "../../../../tools/decision-records/src/decision-state-index.ts";
import { executeDecisionQuery } from "../../../../tools/decision-records/src/decision-query-service.ts";
import { scanDecisionRecords } from "../../../../tools/decision-records/src/scan.ts";
import { runDecisionRecordsCli } from "../../../../tools/decision-records/src/cli.ts";
import type {
  DecisionIndexState,
  DecisionSource
} from "../../../../tools/decision-records/src/types.ts";
import { reportMarkdown } from "../../../../tools/investigation-report/tests/fixture-support.ts";
import { synchronizeFullCollection } from "../../../../tools/investigation-report/src/validation-sync-flow.ts";
import { queryInvestigationIndex } from "../../../../tools/investigation-report/src/query.ts";
import { searchInvestigationReports } from "../../../../tools/investigation-report/src/query-search.ts";
import { prepareInvestigationPublish } from "../../../../tools/investigation-report/src/publish-preparation.ts";
import { prepareCandidateReadContext } from "../../../../tools/investigation-report/src/candidate-document.ts";
import { inspectInvestigationCollectionLayout } from "../../../../tools/investigation-report/src/investigation-layout.ts";
import { runInvestigationReportCheckCli } from "../../../../tools/investigation-report/src/cli.ts";
import { measurement } from "./counter-state.ts";

const domain = process.argv[2];
const size = Number(process.argv[3]);
const mode = process.argv[4];
if (
  !["decision", "published", "investigation"].includes(domain ?? "") ||
  !Number.isSafeInteger(size) ||
  size < 1
)
  throw new Error(
    "Usage: node measure-worker.ts decision|published|investigation <N> counts|timing"
  );
if (mode !== "counts" && mode !== "timing") throw new Error("Invalid mode");
const root = await fs.mkdtemp(path.join(os.tmpdir(), "first-batch-fixture-"));
measurement.fixtureRoot = root;
type Observation = Readonly<{
  name: string;
  milliseconds: number;
  counts: Readonly<Record<string, number>>;
  result: unknown;
}>;
const observations: Observation[] = [];

async function observe(
  name: string,
  run: () => Promise<unknown>
): Promise<void> {
  measurement.counts = {};
  measurement.active = mode === "counts";
  const start = performance.now();
  const result = await run();
  const milliseconds = performance.now() - start;
  measurement.active = false;
  observations.push({ name, milliseconds, counts: measurement.counts, result });
}

async function cliResult(
  run: (io: {
    stdout: (text: string) => void;
    stderr: (text: string) => void;
  }) => Promise<number>
): Promise<unknown> {
  let stdout = "";
  let stderr = "";
  const exitCode = await run({
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    }
  });
  return { stdout, stderr, exitCode };
}

async function decisionFixture(publishedOnly: boolean): Promise<void> {
  const directory = path.join(root, "docs/decisions");
  await fs.mkdir(directory, { recursive: true });
  const projection = {
    title: "隔离性能样本",
    purpose: "保留事实",
    background: "受控合成",
    decision: "采用样例",
    relations: []
  };
  const body =
    "## 目的\n\n隔离实验。\n\n## 背景\n\n受控合成。\n\n## 决策\n\n- 采用：保留样例。\n";
  const states: Record<string, DecisionIndexState> = {};
  const sources: DecisionSource[] = [];
  const tag = "audit";
  if (!isDecisionTag(tag)) throw new Error("Invalid fixture tag");
  const id = (i: number) => {
    const value = `261021-entry-${String(i).padStart(5, "0")}`;
    if (!isDecisionId(value)) throw new Error("Invalid fixture ID");
    return value;
  };
  for (let i = 0; i < size + (publishedOnly ? 0 : 3); i++) {
    const candidate = i >= size;
    const metadata = candidate
      ? ({ status: "candidate", alignment: null, createdAt: null } as const)
      : ({
          status: "active",
          alignment: "aligned",
          createdAt: "2026-10-21T00:00:00Z"
        } as const);
    const sourcePath = `entry-${String(i).padStart(5, "0")}.md`;
    if (!isDecisionSourcePath(sourcePath))
      throw new Error("Invalid fixture source path");
    const text =
      serializeDecisionFrontmatter(id(i), projection, [tag], metadata) + body;
    if (publishedOnly) {
      if (metadata.status === "candidate")
        throw new Error("Published fixture cannot contain candidates");
      sources.push({ decisionId: id(i), sourcePath, text });
      states[id(i)] = decisionIndexState(
        sourcePath,
        { ...projection, ...metadata, tags: [tag] },
        id(i)
      );
    } else await fs.writeFile(path.join(directory, sourcePath), text);
  }
  if (publishedOnly) {
    const built = await buildDecisionIndexFromSnapshot({
      metadata: {},
      states,
      sourceRevision: decisionSourceRevision(sources)
    });
    if (built.status !== "ok") throw new Error(JSON.stringify(built));
    await fs.writeFile(
      path.join(directory, "decision-index.json"),
      serializeDecisionIndex(built.value)
    );
  } else {
    const synced = await syncDecisionIndex({
      decisionsDirectory: directory,
      mode: "write"
    });
    if (synced.status !== "ok") throw new Error(JSON.stringify(synced));
  }
  const location = { workspaceRoot: root, decisionsDir: "docs/decisions" };
  if (publishedOnly) {
    await observe("list", () =>
      executeDecisionQuery({
        location,
        command: "list",
        alignment: "all",
        status: "all",
        tags: [],
        limit: 20,
        offset: 0
      })
    );
    await observe("trace-id", () =>
      executeDecisionQuery({ location, command: "trace", decisionId: id(0) })
    );
    await observe("trace-name", () =>
      executeDecisionQuery({
        location,
        command: "trace",
        decisionId: "entry-00000"
      })
    );
    if (mode === "counts") {
      await observe("cli-list", () =>
        cliResult((io) =>
          runDecisionRecordsCli(["list", "--root", root], { io })
        )
      );
      await fs.writeFile(
        path.join(directory, "decision-index.json"),
        "{broken"
      );
      await observe("cli-corrupt-index", () =>
        cliResult((io) =>
          runDecisionRecordsCli(["list", "--root", root], { io })
        )
      );
    }
    return;
  }
  await observe("scan", () => scanDecisionRecords({ workspaceRoot: root }));
  if (mode === "timing") return;
  await observe("sync-preview", () =>
    executeDecisionQuery({ location, command: "sync-index", preflight: true })
  );
  await fs.writeFile(path.join(directory, "invalid.md"), "---\nid: [\n---\n");
  await observe("scan-bad-yaml", () =>
    scanDecisionRecords({ workspaceRoot: root })
  );
  await fs.rm(path.join(directory, "invalid.md"));
  await fs.copyFile(
    path.join(directory, "entry-00000.md"),
    path.join(directory, "duplicate.md")
  );
  await observe("scan-duplicate-id", () =>
    scanDecisionRecords({ workspaceRoot: root })
  );
}

async function investigationFixture(): Promise<void> {
  const directory = path.join(root, "docs/investigations");
  await fs.mkdir(directory, { recursive: true });
  execFileSync("git", ["init", "-q", root]);
  const ids = Array.from({ length: size }, (_, i) => `260828-report-${i}`);
  for (const [i, id] of ids.entries()) {
    await fs.writeFile(
      path.join(directory, `${id}.md`),
      reportMarkdown({
        id,
        relations:
          i === 0 ? [] : [{ type: "复查", target: ids[0], summary: "前序" }],
        resources: i === 0 ? [`${id}/asset.txt`] : undefined
      })
    );
  }
  const resourceDirectory = path.join(directory, "_resources", ids[0]);
  await fs.mkdir(resourceDirectory, { recursive: true });
  await fs.writeFile(
    path.join(resourceDirectory, "asset.txt"),
    "shared resource\n"
  );
  const synced = await synchronizeFullCollection(directory, "write", undefined);
  if (synced.errors.length > 0) throw new Error(JSON.stringify(synced));
  const candidates = [
    "260828-candidate-0",
    "260828-candidate-1",
    "260828-candidate-2"
  ];
  for (const id of candidates)
    await fs.writeFile(
      path.join(directory, `_candidate.${id}`),
      reportMarkdown({ id, resources: [`${ids[0]}/asset.txt`] })
    );
  await observe("content-fresh", () =>
    searchInvestigationReports({
      workspaceRoot: root,
      query: "已形成结果",
      limit: 1000
    })
  );
  await observe("list-related-successors", () =>
    queryInvestigationIndex({
      workspaceRoot: root,
      relatedTo: ids[0],
      direction: "successors",
      limit: 1000
    })
  );
  await observe("prepare-full", () =>
    prepareInvestigationPublish(directory, candidates)
  );
  if (mode === "timing") return;
  for (const direction of ["predecessors", "both"] as const)
    await observe(`list-related-${direction}`, () =>
      queryInvestigationIndex({
        workspaceRoot: root,
        relatedTo: ids[1],
        direction,
        limit: 1000
      })
    );
  await observe("list-type-only", () =>
    queryInvestigationIndex({
      workspaceRoot: root,
      relationType: "复查",
      limit: 1000
    })
  );
  await observe("list-combined", () =>
    queryInvestigationIndex({
      workspaceRoot: root,
      relatedTo: ids[0],
      relationType: "复查",
      direction: "successors",
      limit: 10,
      offset: 1
    })
  );
  await observe("list-empty", () =>
    queryInvestigationIndex({
      workspaceRoot: root,
      relatedTo: ids[0],
      relationType: "补充",
      direction: "successors",
      limit: 1000
    })
  );
  await observe("cli-search", () =>
    cliResult((io) =>
      runInvestigationReportCheckCli(["search", "已形成结果", "--root", root], {
        io
      })
    )
  );
  const partial = await inspectInvestigationCollectionLayout(directory, {
    readFormalSources: false
  });
  await observe("candidate-partial-layout", () =>
    prepareCandidateReadContext(directory, partial, candidates)
  );
  const indexFile = path.join(directory, "investigation-index.json");
  const oldIndex = await fs.readFile(indexFile, "utf8");
  const sourceFile = path.join(directory, `${ids[1]}.md`);
  await fs.appendFile(sourceFile, "\n当前追加。\n");
  await observe("content-stale", () =>
    searchInvestigationReports({
      workspaceRoot: root,
      query: "已形成结果",
      limit: 1000
    })
  );
  await fs.writeFile(indexFile, "{broken");
  await observe("content-corrupt-index", () =>
    searchInvestigationReports({
      workspaceRoot: root,
      query: "已形成结果",
      limit: 1000
    })
  );
  await fs.writeFile(indexFile, oldIndex);
}

function serializable(value: unknown, field = ""): unknown {
  if (typeof value === "string") return value.replaceAll(root, "<fixture>");
  if (typeof value === "bigint") {
    if (field === "dev" || field === "ino") return `<fixture-${field}>`;
    return { bigint: value.toString() };
  }
  if (value instanceof Map)
    return {
      mapEntries: [...value.entries()].map(([key, item]) => [
        serializable(key),
        serializable(item)
      ])
    };
  if (value instanceof Set)
    return { setValues: [...value].map((item) => serializable(item)) };
  if (Array.isArray(value)) return value.map((item) => serializable(item));
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializable(item, key)])
    );
  return value;
}

try {
  if (domain === "investigation") await investigationFixture();
  else await decisionFixture(domain === "published");
  console.log(
    JSON.stringify(serializable({ domain, size, mode, observations }))
  );
} finally {
  measurement.active = false;
  await fs.rm(root, { recursive: true, force: true });
}
