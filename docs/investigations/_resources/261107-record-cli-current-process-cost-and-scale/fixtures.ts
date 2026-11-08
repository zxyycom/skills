import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = "/workspace/skills";
const outputBase = "/workspace/skills/dist/record-benchmarks/perf-261107-main";
type Domain = "decisions" | "investigations";
type Relation = { type: string; target: string };

const oldCli: Record<Domain, string> = {
  decisions: "skills/decision-records/scripts/decision-records.ts",
  investigations: "skills/investigation-report/scripts/check-investigations.ts"
};

const shapes: Record<Domain, Record<number, [string, ...number[]]>> = {
  decisions: {
    1: ["拆分", 0],
    2: ["拆分", 0],
    3: ["修订", 1],
    4: ["修订", 3],
    7: ["重划", 5, 6],
    8: ["重划", 6]
  },
  investigations: {
    1: ["拆分", 0],
    2: ["拆分", 0],
    3: ["补充", 1],
    4: ["补充", 3],
    7: ["归并", 5, 6]
  }
};

function idFor(i: number): string {
  return `260101-record-${String(i).padStart(5, "0")}`;
}

function graphEdges(
  domain: Domain,
  i: number,
  count: number,
  width: number,
  depth: number
): Relation[] {
  const shape = shapes[domain][i];
  if (shape)
    return shape
      .slice(1)
      .map((target) => ({ type: shape[0], target: idFor(Number(target)) }));
  const root = 9 + width;
  if (i === root)
    return Array.from({ length: width }, (_, offset) => ({
      type: "归并",
      target: idFor(9 + offset)
    }));
  if (i > root && i <= root + depth)
    return [
      { type: domain === "decisions" ? "修订" : "补充", target: idFor(i - 1) }
    ];
  const ordinaryRoot = root + depth + 1;
  if (
    domain === "investigations" &&
    count >= ordinaryRoot + width + 1 &&
    i > ordinaryRoot &&
    i <= ordinaryRoot + width
  )
    return [{ type: "补充", target: idFor(ordinaryRoot) }];
  return [];
}

function isArchived(
  domain: Domain,
  i: number,
  width: number,
  depth: number
): boolean {
  if (domain !== "decisions") return false;
  return [0, 1, 3, 5, 6].includes(i) || (i >= 9 && i < 9 + width + depth + 1);
}

function source(
  domain: Domain,
  i: number,
  count: number,
  width: number,
  depth: number
): string {
  const name = `record-${String(i).padStart(5, "0")}`;
  const id = `260101-${name}`;
  const base = `title: "Benchmark ${name} 中文 😀"\nid: "${id}"\n`;
  const archived = isArchived(domain, i, width, depth);
  const edges = graphEdges(domain, i, count, width, depth);
  const relations = edges.length
    ? `relations:\n${edges.map((edge) => `  - type: "${edge.type}"\n    target: "${edge.target}"`).join("\n")}`
    : "relations: []";
  const fields =
    domain === "decisions"
      ? `status: ${archived ? "archived" : "active"}\nalignment: aligned\ncreatedAt: "2026-01-01T00:00:00Z"\npurpose: "Benchmark purpose"\nbackground: "Benchmark background"\ndecision: "Benchmark decision"\n`
      : `formedAt: "2026-01-01T00:00:00Z"\nquestion: "Benchmark question"\n`;
  const body =
    domain === "decisions"
      ? "## 目的\n\nBenchmark purpose.\n\n## 背景\n\nBenchmark background.\n\n## 决策\n\n- 采用: Benchmark decision.\n"
      : "## 形成时背景\n\nBenchmark background.\n\n## 调查目的\n\nBenchmark purpose.\n\n## 调查范围与依据\n\nBenchmark evidence.\n\n## 调查结果与边界\n\nBenchmark results.\n";
  return `---\n${base}${fields}tags:\n  - "benchmark"\n${relations}\n---\n\n${body}\nneedle-content-${i % 10}\n`;
}

async function main(): Promise<void> {
  const [name, countText, widthText = "4", depthText = "4"] =
    process.argv.slice(2);
  const count = Number(countText);
  const width = Number(widthText);
  const depth = Number(depthText);
  if (
    !name ||
    !/^[a-z0-9][a-z0-9-]*$/.test(name) ||
    !Number.isSafeInteger(count) ||
    count > 10000 ||
    !Number.isSafeInteger(width) ||
    width < 2 ||
    !Number.isSafeInteger(depth) ||
    depth < 1 ||
    count < 10 + width + depth
  )
    throw new Error(
      "Usage: node fixtures.ts <new-name> <count> [width>=2] [depth>=1], count >= 10 + width + depth and <= 10000"
    );
  await mkdir(outputBase, { recursive: true });
  if ((await realpath(outputBase)) !== outputBase)
    throw new Error("benchmark output directory must not be a symlink");
  const root = path.join(outputBase, name);
  await mkdir(root);
  for (const domain of ["decisions", "investigations"] as const) {
    const directory = path.join(root, "docs", domain);
    await mkdir(directory, { recursive: true });
    for (let i = 0; i < count; i++) {
      const id = idFor(i);
      const archived = isArchived(domain, i, width, depth);
      const target = archived ? path.join(directory, "archive") : directory;
      if (archived) await mkdir(target, { recursive: true });
      await writeFile(
        path.join(target, `${id}.md`),
        source(domain, i, count, width, depth),
        { flag: "wx" }
      );
    }
    for (const command of ["sync-index", "check"]) {
      const result = spawnSync(
        process.execPath,
        [path.join(repository, oldCli[domain]), "--root", root, command],
        { encoding: "utf8" }
      );
      if (result.error || result.status !== 0)
        throw new Error(
          `${domain} ${command} failed (${result.status}): ${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`
        );
      process.stdout.write(`${domain} ${command}: passed\n`);
    }
  }
  await writeFile(
    path.join(root, "fixture.json"),
    `${JSON.stringify({ version: 1, count, width, depth }, null, 2)}\n`,
    { flag: "wx" }
  );
  process.stdout.write(`fixture: ${root}\n`);
}

await main();
