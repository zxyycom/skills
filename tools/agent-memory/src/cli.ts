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

const help = `agent-memory <init|save|revise|recall|show|review|close|forget> --root ABS --db ABS [--json] [--input JSON]
--db overrides AGENT_MEMORY_DB. JSON input may instead be supplied on stdin.
New writes and forget previews reject unknown JSON fields, including in items and edges.
init: {}.
save: {requestId,kind:"knowledge"|"intent",title,body,source,conditions,reason?:string,tags?:[string],edges?:[{target,version,type:"composition"|"supports"|"limits"|"conflicts"|"replaces"|"splits",role}]}.
Batch save: {requestId,items:[save fields without requestId]}. For atomic split, use a splits edge from each successor to the current original.
revise: {id,expectedVersion,requestId,reason,semanticChange:boolean} plus optional kind,title,body,source,conditions,tags,edges.
review: {id,expectedVersion,requestId,reason,outcome:"unchanged"|"changed"|"pending"} plus the same optional content fields.
recall: {tags:[string],terms:[string],limit?:number}; show: {id,version?:number}; close: {id,expectedVersion,requestId,outcome:"completed"|"cancelled",reason}.
forget: first {id,action:"disable"|"hide"|"purge"} previews an active/pending target and newly blocked current dependants (disable/hide), or the full historical composition scope (purge).
Then {id,action,requestId,confirm:token,expectedVersion} executes; expectedVersion is optional for purge and checked when supplied.
`;

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
  return { root, db: path, schemaVersion };
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

function binding(values: Readonly<{ root?: string; db?: string }>) {
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
  paths: ReturnType<typeof binding>,
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
export async function runCli(args: string[]): Promise<number> {
  try {
    process.stdout.write(run(args));
    return 0;
  } catch (error) {
    const message =
      error instanceof MemoryError
        ? error.message
        : "database operation failed; verify the binding, access, schema and installed CLI resources";
    process.stderr.write(`agent-memory: ${message}\n`);
    return 1;
  }
}
