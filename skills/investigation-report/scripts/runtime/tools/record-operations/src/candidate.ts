/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/candidate.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/candidate.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/candidate.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import fs from "node:fs/promises";
import path from "node:path";
import { readRecordText } from "./source.ts";

export type CandidateIdentity = Readonly<{ id: string; sourcePath: string }>;
export type CandidateSource = CandidateIdentity & Readonly<{ text: string }>;
export type CandidateMember = Readonly<{
  sourcePath: string;
  kind: "candidate" | "formal" | "unknown";
}>;
export type RecordCandidateCollection = Readonly<{
  indexStatus: "published" | "missing";
  formal: readonly CandidateIdentity[];
  candidates: readonly CandidateSource[];
  warnings: readonly string[];
  identityById: ReadonlyMap<string, CandidateIdentity>;
  candidateById: ReadonlyMap<string, CandidateSource>;
}>;

/** 候选动作的身份准备：坏索引不降级；只有真实缺失才使用 header 身份证据。 */
export async function prepareRecordCandidates(
  options: Readonly<{
    directory: string;
    indexFileName: string;
    loadPublished: () => Promise<readonly CandidateIdentity[]>;
    members: () => Promise<readonly CandidateMember[]>;
    header: (
      text: string,
      member: CandidateMember
    ) => Readonly<{ id: string | null; kind: "candidate" | "formal" }>;
  }>
): Promise<RecordCandidateCollection> {
  let indexStatus: "published" | "missing" = "published";
  try {
    const stats = await fs.lstat(
      path.join(options.directory, options.indexFileName)
    );
    if (!stats.isFile() || stats.isSymbolicLink())
      throw new Error(
        "candidate index must be a regular non-symbolic-link file"
      );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    )
      indexStatus = "missing";
    else throw error;
  }
  const published =
    indexStatus === "published" ? await options.loadPublished() : [];
  const formal = new Map(published.map((identity) => [identity.id, identity]));
  const publishedPaths = new Map(
    published.map((identity) => [identity.sourcePath, identity.id])
  );
  if (publishedPaths.size !== published.length)
    throw new Error("published identities share a source path");
  const candidates: CandidateSource[] = [];
  const warnings: string[] =
    indexStatus === "missing"
      ? [
          "formal index is missing; candidate header discovery does not establish published records; explicitly recover before formal queries or publishing existing formal sources"
        ]
      : [];
  const seen = new Map<string, string>();
  for (const member of await options.members()) {
    // 严格发布位置已提供正式身份，即使领域仅凭路径无法分类，也不重读当前 header。
    // 此处不证明正式当前内容；未知位置和显式候选仍须安全读取。
    const publishedId = publishedPaths.get(member.sourcePath);
    if (publishedId !== undefined && member.kind !== "candidate") {
      seen.set(publishedId, member.sourcePath);
      continue;
    }
    const text = await readRecordText(options.directory, member.sourcePath);
    const header = options.header(text, member);
    if (header.id === null) {
      if (header.kind !== "candidate")
        throw new Error(
          member.sourcePath +
            " must declare a unique valid frontmatter record ID"
        );
      warnings.push(
        member.sourcePath +
          " must declare a valid frontmatter record ID; skipped invalid candidate"
      );
      continue;
    }
    const previous = seen.get(header.id) ?? formal.get(header.id)?.sourcePath;
    if (previous !== undefined && previous !== member.sourcePath)
      throw new Error(
        "record ID occurs in more than one source path: " + header.id
      );
    if (header.kind === "candidate" && formal.has(header.id))
      throw new Error(
        "record exists as both candidate and formal: " + header.id
      );
    seen.set(header.id, member.sourcePath);
    if (header.kind === "candidate")
      candidates.push({ id: header.id, sourcePath: member.sourcePath, text });
    else
      formal.set(header.id, { id: header.id, sourcePath: member.sourcePath });
  }
  candidates.sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  );
  return {
    candidates,
    formal: [...formal.values()],
    indexStatus,
    warnings,
    identityById: new Map(
      [...formal.values(), ...candidates].map((source) => [source.id, source])
    ),
    candidateById: new Map(candidates.map((source) => [source.id, source]))
  };
}

/** 完整 ID 的语法由领域识别；name 必须在动作自己的集合中唯一。 */
export function selectRecordCandidateIdentity<T extends CandidateIdentity>(
  identities: readonly T[],
  selector: string,
  exactId: boolean,
  name: (id: string) => string
): T {
  const matches = identities.filter((identity) =>
    exactId ? identity.id === selector : name(identity.id) === selector
  );
  if (matches.length === 0)
    throw new Error("candidate selector does not exist: " + selector);
  if (matches.length > 1)
    throw new Error(
      "candidate selector is ambiguous: " +
        selector +
        "; choose one standard ID: " +
        matches
          .map(({ id }) => id)
          .sort()
          .join(", ")
    );
  return matches[0]!;
}

/** 列表宽容只在此处决定；路径、集合与必要依赖错误由 prepare/read 直接拒绝。 */
export async function readRecordCandidates<Context, Value>(
  options: Readonly<{
    collection: RecordCandidateCollection;
    selection?: Readonly<{
      selector: string;
      exactId: boolean;
      name: (id: string) => string;
    }>;
    prepare: (sources: readonly CandidateSource[]) => Promise<Context>;
    read: (
      source: CandidateSource,
      context: Context
    ) => Promise<
      | Readonly<{ status: "ok"; value: Value; warnings: readonly string[] }>
      | Readonly<{ status: "invalid"; errors: readonly string[] }>
    >;
  }>
): Promise<Readonly<{ values: Value[]; warnings: string[] }>> {
  const { collection, selection } = options;
  const selected =
    selection === undefined
      ? collection.candidates
      : [
          selectRecordCandidateIdentity(
            collection.candidates,
            selection.selector,
            selection.exactId,
            selection.name
          )
        ];
  const context = await options.prepare(selected);
  const values: Value[] = [];
  const warnings = [...collection.warnings];
  for (const source of selected) {
    const result = await options.read(source, context);
    if (result.status === "invalid") {
      if (selection !== undefined)
        throw new Error(
          source.sourcePath +
            " is not a valid candidate scaffold: " +
            result.errors.join("; ")
        );
      warnings.push(
        ...result.errors.map((error) => source.sourcePath + ": " + error)
      );
    } else {
      values.push(result.value);
      warnings.push(...result.warnings);
    }
  }
  return { values, warnings };
}

export type CandidatePreparation<Value, Result> =
  | Readonly<{ status: "ok"; value: Value }>
  | Readonly<{ status: "error"; result: Result }>;

/** 两域候选创建的可见顺序；日期、领域冲突、locator 与真实创建结果仍由领域提供。 */
export async function createRecordCandidate<Collection, Request, Result>(
  adapter: Readonly<{
    discover: () => Promise<CandidatePreparation<Collection, Result>>;
    resolve: (collection: Collection) => CandidatePreparation<Request, Result>;
    conflict: (collection: Collection, request: Request) => Result | null;
    allocate: (
      collection: Collection,
      request: Request
    ) => string | Promise<string>;
    writeAndReadiness: (
      collection: Collection,
      request: Request,
      target: string
    ) => Promise<Result>;
  }>
): Promise<Result> {
  const discovered = await adapter.discover();
  if (discovered.status === "error") return discovered.result;
  const resolved = adapter.resolve(discovered.value);
  if (resolved.status === "error") return resolved.result;
  const conflict = adapter.conflict(discovered.value, resolved.value);
  if (conflict !== null) return conflict;
  const target = await adapter.allocate(discovered.value, resolved.value);
  return await adapter.writeAndReadiness(
    discovered.value,
    resolved.value,
    target
  );
}
