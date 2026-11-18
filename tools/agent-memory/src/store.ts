import { readFileSync } from "node:fs";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import * as v from "valibot";
import { fail } from "./errors.ts";
import type { Content } from "./input.ts";
import {
  edgeType,
  memoryKind,
  positiveInteger,
  unitState,
  type UnitState
} from "./model.ts";

const unitSummary = { id: v.string(), state: unitState };
const headRow = v.object({
  ...unitSummary,
  current_version: positiveInteger,
  generation: positiveInteger,
  kind: memoryKind
});
const versionRow = v.object({
  id: v.string(),
  version: positiveInteger,
  generation: positiveInteger,
  kind: memoryKind,
  title: v.string(),
  body: v.string(),
  source: v.string(),
  conditions: v.string(),
  reason: v.string()
});
const compositionRow = {
  target: v.string(),
  target_generation: positiveInteger
};
const edgeRow = v.object({
  ...compositionRow,
  target_version: positiveInteger,
  type: edgeType,
  role: v.string()
});
const premiseRow = v.object(compositionRow);
const tagRow = v.object({ tag: v.string() });
const recallRow = v.object({
  id: v.string(),
  conditions: v.string(),
  reasons: v.string()
});
const affectedRow = v.object({ ...unitSummary, version: positiveInteger });
const referenceRow = v.object({
  id: v.string(),
  version: positiveInteger,
  target: v.string(),
  targetVersion: positiveInteger,
  type: edgeType,
  role: v.string()
});
const requestRow = v.object({ fingerprint: v.string(), result: v.string() });
const targetRow = v.object({ target: v.string() });
const requestKeyRow = v.object({ request_key: v.string() });
const generationRow = v.object({ generation: positiveInteger });
export const schemaVersion = 1;
const metadataRow = v.object({
  root: v.string(),
  schema_version: v.literal(schemaVersion)
});
export type Head = Readonly<v.InferOutput<typeof headRow>>;
export type StoredEdge = Readonly<v.InferOutput<typeof edgeRow>>;
export type Version = Readonly<v.InferOutput<typeof versionRow>>;
export type Premise = Readonly<v.InferOutput<typeof premiseRow>>;
export type AffectedUnit = Readonly<v.InferOutput<typeof affectedRow>>;
export type RemovedReference = Readonly<v.InferOutput<typeof referenceRow>>;
export type RecallMatch = Readonly<{
  id: string;
  conditions: string;
  reasons: readonly string[];
}>;
type RequestReceipt = Readonly<v.InferOutput<typeof requestRow>>;
type Args = readonly (string | number)[];
type Transaction = "read" | "write";

function stored<T extends v.GenericSchema>(
  schema: T,
  value: unknown
): v.InferOutput<T> {
  const result = v.safeParse(schema, value);
  if (!result.success)
    fail("database data does not match the agent-memory schema");
  return result.output;
}

export function readStoredJson<T extends v.GenericSchema>(
  schema: T,
  text: string
): v.InferOutput<T> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail("database contains invalid JSON");
  }
  return stored(schema, value);
}

function readSql(file: "queries.sql" | "schema.sql"): string {
  try {
    return readFileSync(new URL(file, import.meta.url), "utf8");
  } catch {
    return fail(`cannot read ${file}; verify the installed CLI resources`);
  }
}

function loadQueries(): ReadonlyMap<string, string> {
  const source = readSql("queries.sql");
  const queries = new Map<string, string>();
  for (const [, name, body] of source.matchAll(
    /^-- name: (\w+)\r?\n([\s\S]*?)(?=^-- name: |$(?![\s\S]))/gmu
  )) {
    const sql = body?.trim();
    if (!name || !sql || queries.has(name))
      fail("queries.sql contains a missing or duplicate statement");
    queries.set(name, sql);
  }
  return queries;
}

export function withStore<T>(
  path: string,
  mode: Transaction,
  task: (store: Store) => T
): T {
  const uri = pathToFileURL(path);
  // SQLite enforces existing-only open atomically; a prior existence check cannot.
  uri.searchParams.set("mode", mode === "read" ? "ro" : "rw");
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(uri, {
      readOnly: mode === "read",
      enableForeignKeyConstraints: true
    });
  } catch {
    return fail(
      "cannot open bound database; check that it exists and is accessible"
    );
  }
  try {
    return new Store(db).transaction(mode, task);
  } finally {
    db.close();
  }
}

export class Store {
  readonly #db: DatabaseSync;
  readonly #queries = loadQueries();
  readonly #statements = new Map<string, StatementSync>();

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  transaction<T>(mode: Transaction, task: (store: Store) => T): T {
    this.#exec(mode === "read" ? "begin_read" : "begin_write");
    try {
      const result = task(this);
      this.#exec("commit");
      return result;
    } catch (error) {
      if (this.#db.isTransaction) this.#exec("rollback");
      throw error;
    }
  }

  initialize(root: string, id: string) {
    this.#db.exec(readSql("schema.sql"));
    this.#run("init", root, id, schemaVersion);
  }

  assertBinding(root: string) {
    const rows = this.#statement("meta").all();
    if (
      rows.length !== 1 ||
      !v.is(metadataRow, rows[0]) ||
      rows[0].root !== root
    )
      fail("database project binding or schema mismatch");
  }

  head(id: string): Head {
    return this.#get("head", headRow, id) ?? fail("unknown memory id");
  }

  version(id: string, version: number): Version {
    return (
      this.#get("version", versionRow, id, version) ??
      fail("unknown memory version")
    );
  }

  generation(id: string, version: number): number {
    return (
      this.#get("generation", generationRow, id, version)?.generation ??
      fail("unknown memory version")
    );
  }

  tags(id: string, version: number): readonly string[] {
    return this.#all("tags", tagRow, id, version).map((row) => row.tag);
  }

  edges(id: string, version: number): readonly StoredEdge[] {
    return this.#all("edges", edgeRow, id, version);
  }

  premises(head: Head): readonly Premise[] {
    return this.#all("composition", premiseRow, head.id, head.current_version);
  }

  reaches(from: string, target: string): boolean {
    return this.#statement("reaches").get(from, target) !== undefined;
  }

  *recall(
    tags: readonly string[],
    terms: readonly string[]
  ): Generator<RecallMatch> {
    const matches = this.#statement("recall").iterate(
      JSON.stringify(tags),
      JSON.stringify(terms)
    );
    for (const raw of matches) {
      const row = stored(recallRow, raw);
      yield {
        ...row,
        reasons: readStoredJson(v.array(v.string()), row.reasons)
      };
    }
  }

  affected(id: string, scope: "current" | "history"): readonly AffectedUnit[] {
    return this.#all(
      "affected_units",
      affectedRow,
      id,
      Number(scope === "history")
    );
  }

  removedReferences(ids: readonly string[]): RemovedReference[] {
    return this.#all("removed_references", referenceRow, JSON.stringify(ids));
  }

  createUnit(id: string) {
    this.#run("new_unit", id);
  }

  setHead(id: string, version: number, state: UnitState) {
    this.#run("update_unit", version, state, id);
  }

  writeVersion(
    version: Readonly<{ id: string; version: number; generation: number }>,
    content: Omit<Content, "edges">,
    edges: readonly StoredEdge[]
  ) {
    const { id, version: number, generation } = version;
    const { kind, title, body, source, conditions, reason, tags } = content;
    this.#run(
      "insert_version",
      id,
      number,
      generation,
      kind,
      title,
      body,
      source,
      conditions,
      reason
    );
    for (const tag of tags) this.#run("insert_tag", id, number, tag);
    for (const edge of edges)
      this.#run(
        "insert_edge",
        id,
        number,
        edge.target,
        edge.target_version,
        edge.target_generation,
        edge.type,
        edge.role
      );
  }

  copyForClose(head: Head, reason: string): string[] {
    const { id, current_version } = head;
    this.#run("close_version", reason, id, current_version);
    this.#run("close_tags", id, current_version);
    return this.#all("close_edges", targetRow, id, current_version).map(
      (row) => row.target
    );
  }

  request(id: string): RequestReceipt | undefined {
    return this.#get("request", requestRow, id);
  }

  saveRequest(
    id: string,
    fingerprint: string,
    jsonResult: string,
    affected: readonly string[]
  ) {
    this.#run(
      "insert_request",
      id,
      fingerprint,
      jsonResult,
      JSON.stringify(affected)
    );
  }

  revoked(idHash: string): boolean {
    return this.#statement("revoked_request").get(idHash) !== undefined;
  }

  revoke(idHash: string) {
    this.#run("revoke_request", idHash);
  }

  deleteAffectedRequests(ids: readonly string[]): string[] {
    return this.#all(
      "delete_affected_requests",
      requestKeyRow,
      JSON.stringify(ids)
    ).map((row) => row.request_key);
  }

  deleteUnits(ids: readonly string[]) {
    const selected = JSON.stringify(ids);
    this.#run("delete_target_edges", selected);
    this.#run("delete_units", selected);
  }

  #exec(name: string) {
    this.#db.exec(this.#sql(name));
  }

  #sql(name: string): string {
    return (
      this.#queries.get(name) ?? fail(`queries.sql lacks the ${name} statement`)
    );
  }

  #statement(name: string): StatementSync {
    const known = this.#statements.get(name);
    if (known !== undefined) return known;
    const prepared = this.#db.prepare(this.#sql(name));
    this.#statements.set(name, prepared);
    return prepared;
  }

  #get<T extends v.GenericSchema>(
    name: string,
    schema: T,
    ...args: Args
  ): v.InferOutput<T> | undefined {
    const row = this.#statement(name).get(...args);
    return row === undefined ? undefined : stored(schema, row);
  }

  #all<T extends v.GenericSchema>(
    name: string,
    schema: T,
    ...args: Args
  ): v.InferOutput<T>[] {
    return this.#statement(name)
      .all(...args)
      .map((row) => stored(schema, row));
  }

  #run(name: string, ...args: Args) {
    this.#statement(name).run(...args);
  }
}
