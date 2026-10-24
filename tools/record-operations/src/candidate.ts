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

/** 正式身份只取发布索引；成员发现与候选定位由领域限定，不借候选动作证明正式正文当前性。 */
export async function prepareRecordCandidates(
  options: Readonly<{
    directory: string;
    indexFileName: string;
    loadPublished: () => Promise<readonly CandidateIdentity[]>;
    members: (
      published: readonly CandidateIdentity[],
      indexStatus: "published" | "missing"
    ) => Promise<readonly CandidateMember[]>;
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
  for (const member of await options.members(published, indexStatus)) {
    // 发布位置一律由索引承接，包括当前正文已手改为 candidate 的位置。
    const publishedId = publishedPaths.get(member.sourcePath);
    if (publishedId !== undefined) {
      seen.set(publishedId, member.sourcePath);
      continue;
    }
    if (member.kind === "formal") {
      if (indexStatus === "missing")
        throw new Error(
          "formal index is missing while formal sources exist; explicitly recover the published index before candidate operations"
        );
      continue;
    }
    const text = await readRecordText(options.directory, member.sourcePath);
    const header = options.header(text, member);
    if (header.kind === "formal") {
      if (indexStatus === "missing")
        throw new Error(
          "formal index is missing while formal sources exist; explicitly recover the published index before candidate operations"
        );
      continue;
    }
    if (header.id === null) {
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
    if (formal.has(header.id))
      throw new Error(
        "record exists as both candidate and formal: " + header.id
      );
    seen.set(header.id, member.sourcePath);
    candidates.push({ id: header.id, sourcePath: member.sourcePath, text });
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
