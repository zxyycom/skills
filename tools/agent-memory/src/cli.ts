import { randomUUID } from "node:crypto";
import {
  closeSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep
} from "node:path";
import { parseArgs } from "node:util";
import { is } from "valibot";
import { preview } from "./control.ts";
import { fail, MemoryError } from "./errors.ts";
import { hash } from "./fingerprint.ts";
import {
  command,
  parseInvocation,
  type ReadOperation,
  type WriteRequest
} from "./input.ts";
import { recall, show } from "./retrieval.ts";
import { schemaVersion, withStore, type Store } from "./store.ts";
import { write } from "./writes.ts";

const help = `agent-memory <recall|show|save|revise|review|close|forget|init> --root ABS [--db ABS] [--json] [--input JSON]
--db overrides AGENT_MEMORY_DB. Pass a JSON object via --input or stdin.
Use declared fields only, including in batch items and edges. A ? marks an optional field; int is a positive safe integer.

recall  {tags?:string[], terms?:string[], limit?:int} (at least one clue; limit defaults to 10)
show    {id, version?:int} (omit version for the current result)
save    {requestId, ...content} or {requestId, items:[content, ...]}
revise  {id, expectedVersion, requestId, reason, semanticChange:boolean, ...contentChanges}
review  {id, expectedVersion, requestId, reason, outcome:"unchanged"|"changed"|"pending", ...contentChanges}
close   {id, expectedVersion, requestId, reason, outcome:"completed"|"cancelled"}
forget  {id, action:"disable"|"hide"|"purge"} previews the scope.
        Add requestId, confirm:token and expectedVersion to apply the preview.
        expectedVersion is optional for purge and checked when supplied.
init    {} (creates a new database outside the project root)

content: {kind:"knowledge"|"intent", title, body, source, conditions, reason?:string, tags?:string[], edges?:edge[]}.
contentChanges: optional kind, title, body, source, conditions, tags and edges. Unset fields keep their current values.
edge: {target, version:int, type:"composition"|"supports"|"limits"|"conflicts"|"replaces"|"splits", role}.
For an atomic split, use a splits edge from each successor to the current original.
`;

type Binding = Readonly<{ root: string; path: string }>;

function argumentsFor(args: string[]) {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      options: {
        root: { type: "string" },
        db: { type: "string" },
        json: { type: "boolean" },
        input: { type: "string" },
        help: { type: "boolean" }
      }
    });
  } catch {
    return fail("invalid arguments; see --help");
  }
}

function readInput(arg: string | undefined): unknown {
  let source: string;
  try {
    source =
      arg ?? (process.stdin.isTTY ? "{}" : readFileSync(0, "utf8") || "{}");
  } catch {
    return fail("cannot read JSON input from stdin");
  }
  try {
    return JSON.parse(source);
  } catch {
    return fail("input is not valid JSON");
  }
}

function projectRoot(input: string): string {
  let root: string;
  let directory: boolean;
  try {
    root = realpathSync.native(input);
    directory = statSync(root).isDirectory();
  } catch {
    return fail("cannot resolve --root; check the project directory");
  }
  if (!directory) fail("project root must be a directory");
  return root;
}

function outsideProject(root: string, path: string): string {
  let parent: string;
  try {
    parent = realpathSync.native(dirname(path));
  } catch {
    return fail("cannot resolve database parent directory");
  }
  const rel = relative(root, parent);
  if (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  )
    fail("database must be outside the project root");
  return resolve(parent, basename(path));
}

function initialize(root: string, path: string) {
  const target = outsideProject(root, path);
  let fd: number;
  try {
    fd = openSync(target, "wx", 0o600);
  } catch {
    return fail(
      "cannot create database; check permissions and that it does not already exist"
    );
  }
  try {
    closeSync(fd);
    withStore(target, "write", (store) => store.initialize(root, randomUUID()));
  } catch (error) {
    try {
      unlinkSync(target);
    } catch {
      return fail(
        "database initialization failed and the new file could not be removed; inspect the target"
      );
    }
    throw error;
  }
  return { root, db: target, schemaVersion };
}

function read(store: Store, operation: ReadOperation) {
  switch (operation.name) {
    case "show":
      return show(store, operation.data);
    case "recall":
      return recall(store, operation.data);
    case "forget-preview":
      return preview(store, operation.data);
  }
}

function selectCommand(args: string[]) {
  const { positionals, values } = argumentsFor(args);
  const [name] = positionals;
  if (values.help || name === undefined) return null;
  if (positionals.length !== 1 || !is(command, name)) {
    fail("invalid command; see --help");
  }
  return { name, values };
}

function binding(values: Readonly<{ root?: string; db?: string }>): Binding {
  const root = values.root ?? fail("--root is required");
  const db = values.db ?? process.env.AGENT_MEMORY_DB;
  if (db === undefined) {
    return fail("--db or AGENT_MEMORY_DB is required");
  }
  if (!isAbsolute(root) || !isAbsolute(db)) {
    return fail("root and database paths must be absolute");
  }
  return { root: projectRoot(root), path: resolve(db) };
}

function run(args: string[]) {
  const selected = selectCommand(args);
  if (selected === null) return help;
  const paths = binding(selected.values);
  const input = readInput(selected.values.input);
  const operation = parseInvocation(selected.name, input);
  const result =
    operation.name === "init"
      ? initialize(paths.root, paths.path)
      : dispatch(paths, operation, input);
  const indent = selected.values.json ? 0 : 2;
  return JSON.stringify(result, null, indent) + "\n";
}

function dispatch(
  paths: Binding,
  operation: ReadOperation | WriteRequest,
  input: unknown
) {
  if (operation.name !== "write") {
    return withStore(paths.path, "read", (store) => {
      store.assertBinding(paths.root);
      return read(store, operation);
    });
  }
  const fingerprint = hash({ action: operation.action, input });
  return withStore(paths.path, "write", (store) => {
    store.assertBinding(paths.root);
    return write(store, operation, fingerprint);
  });
}
type CliOutput = Readonly<{
  stdout: { readonly write: (text: string) => unknown };
  stderr: { readonly write: (text: string) => unknown };
}>;

export async function runCli(
  args: string[],
  output: CliOutput = process
): Promise<number> {
  try {
    output.stdout.write(run(args));
    return 0;
  } catch (error) {
    const message =
      error instanceof MemoryError
        ? error.message
        : "database operation failed; verify the binding, access, schema and installed CLI resources";
    output.stderr.write(`agent-memory: ${message}\n`);
    return 1;
  }
}
