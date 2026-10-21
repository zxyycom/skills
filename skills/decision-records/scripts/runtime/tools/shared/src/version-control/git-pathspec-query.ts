/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/git-pathspec-query.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/git-pathspec-query.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/git-pathspec-query.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { runGitForExitCode } from "./git-command.ts";
import type { GitRepositoryContext } from "./git-context.ts";
import { operationError } from "./git-core.ts";

// Git 私有传输预算；同时保守计入 Windows 转义和 UTF-8 argv 字节，不探测宿主 ARG_MAX。
const gitPathQueryArgumentBudget = 28_000;

function argumentCost(argument: string): number {
  // Windows 为最坏转义、包围引号和分隔符留量；UTF-8 argv 另计 NUL 与 8 字节指针。
  const windowsQuotedCost = 2 * argument.length + 3;
  const utf8ArgvCost = Buffer.byteLength(argument) + 9;
  return Math.max(windowsQuotedCost, utf8ArgvCost);
}

/** pathScopes 已由 Git 操作边界规范化；这里只负责传输，不重新解释路径语义。 */
export function gitPathspecBatches(
  rootDirectory: string,
  fixedArguments: readonly string[],
  pathScopes: readonly string[]
): readonly (readonly string[])[] {
  const fixedCost = ["git", "-C", rootDirectory, ...fixedArguments].reduce(
    (total, argument) => total + argumentCost(argument),
    1
  );
  if (fixedCost > gitPathQueryArgumentBudget)
    throw operationError(
      "prepare a Git path query",
      "fixed arguments exceed the Git path-query transport budget"
    );
  const batches: string[][] = [];
  let batch: string[] = [];
  let cost = fixedCost;
  for (const scope of pathScopes) {
    const pathspec = `:(literal)${scope}`;
    const pathCost = argumentCost(pathspec);
    if (fixedCost + pathCost > gitPathQueryArgumentBudget)
      throw operationError(
        "prepare a Git path query",
        "one path scope exceeds the Git path-query transport budget"
      );
    if (cost + pathCost > gitPathQueryArgumentBudget) {
      batches.push(batch);
      batch = [];
      cost = fixedCost;
    }
    batch.push(pathspec);
    cost += pathCost;
  }
  // 空 pathScopes 保持一次全范围查询。
  if (batch.length > 0 || batches.length === 0) batches.push(batch);
  return batches;
}

/** 仅用于按字面 pathspec 取并集的 Git NUL-record 只读查询。 */
export async function queryGitPathspecs(
  context: GitRepositoryContext,
  fixedArguments: readonly string[],
  pathScopes: readonly string[],
  environment?: NodeJS.ProcessEnv
): Promise<string> {
  const batches = gitPathspecBatches(
    context.rootDirectory,
    fixedArguments,
    pathScopes
  );
  const records: string[] = [];
  const previousRecords = new Set<string>();
  for (const batch of batches) {
    const args = [...fixedArguments, ...batch];
    const output = await runPathQuery(context, args, environment);
    if (batches.length === 1) return output;
    const current = output.split("\0");
    if (current.at(-1) === "") current.pop();
    const currentRecords = new Set<string>();
    // 只消除跨批重叠；批内重复和冲突记录保留给各操作原有的解析与验证边界。
    for (const record of current) {
      if (!previousRecords.has(record) || currentRecords.has(record))
        records.push(record);
      currentRecords.add(record);
    }
    for (const record of current) previousRecords.add(record);
  }
  return records.length === 0 ? "" : records.join("\0") + "\0";
}

async function runPathQuery(
  context: GitRepositoryContext,
  args: readonly string[],
  environment?: NodeJS.ProcessEnv
): Promise<string> {
  if (environment === undefined) return await context.git.raw([...args]);
  const result = await runGitForExitCode(
    context.rootDirectory,
    args,
    environment
  );
  if (result.exitCode !== 0)
    throw operationError("query files using path scopes", result.stderr, {
      causeCategory: "command-failed"
    });
  return result.stdout;
}
