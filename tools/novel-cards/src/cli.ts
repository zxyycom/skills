import { readSource } from "./source.ts";
import { randomUUID } from "node:crypto";
import { match } from "ts-pattern";
import { applyTransition } from "./apply-transition.ts";
import { recoverTransaction } from "./transaction.ts";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { CardFailure, type CardFailureCode } from "./card.ts";
import { currentSource, synchronize } from "./index.ts";
import { expandCards, selectCard, findCards, historyFor } from "./query.ts";
import { parseOptions, type Options } from "./options.ts";

export const help = `Novel Cards — Node.js >=24.18
node <skill>/scripts/novel-cards.mjs check --root <project>
node <skill>/scripts/novel-cards.mjs sync-index --write --root <project>
node <skill>/scripts/novel-cards.mjs show <id> --root <project> [--include-reference]
node <skill>/scripts/novel-cards.mjs expand <id> --root <project> [--depth 0..20] [--max-cards 1..1000] [--include-reference]
node <skill>/scripts/novel-cards.mjs find --title TEXT | --chapter N [--scope ID]
node <skill>/scripts/novel-cards.mjs history <id[@N]> --root <project>
node <skill>/scripts/novel-cards.mjs new-id
node <skill>/scripts/novel-cards.mjs apply-transition --input FILE --write --root <project>
node <skill>/scripts/novel-cards.mjs recover --write --root <project>
除 --help 外 stdout 为单个 JSON；失败 stderr 诊断。退出0成功，1来源/索引/引用错误，2参数错误。
索引不存在或陈旧时显式 sync-index --write；同步不证明摘要语义。`;

type Diagnostic = Readonly<{
  code: CardFailureCode;
  file: string;
  message: string;
}>;
type CliOutput = Readonly<{
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}>;
const consoleOutput: CliOutput = {
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text)
};

function diagnosticFailure(error: unknown, root: string): Diagnostic {
  if (error instanceof CardFailure)
    return { code: error.code, file: error.file, message: error.message };
  return {
    code: "read-failed",
    file: root,
    message: error instanceof Error ? error.message : String(error)
  };
}

async function generateId(root: string): Promise<Readonly<{ id: string }>> {
  const existing = new Set(
    (await readSource(root)).records.map((record) => record.card.id)
  );
  let id: string;
  do {
    id = `card-${randomUUID()}`;
  } while (existing.has(id));
  return { id };
}

async function executeCommand(
  options: Options,
  output: CliOutput
): Promise<number> {
  if (options.command === "sync-index") {
    const result = await synchronize(options.root);
    output.stdout(JSON.stringify(result));
    if (result.status === "error") {
      output.stderr(result.diagnostics.map((item) => item.message).join("; "));
      return 1;
    }
    return 0;
  }
  if (options.command === "recover") {
    output.stdout(JSON.stringify(await recoverTransaction(options.root)));
    return 0;
  }
  if (options.command === "apply-transition") {
    output.stdout(
      JSON.stringify(await applyTransition(options.root, options.input))
    );
    return 0;
  }
  if (options.command === "new-id") {
    output.stdout(JSON.stringify(await generateId(options.root)));
    return 0;
  }
  const source = await currentSource(options.root);
  const result = match(options)
    .with({ command: "find" }, (query) => findCards(source.records, query))
    .with({ command: "history" }, (query) =>
      historyFor(source.records, query.id, query.includeReference)
    )
    .with({ command: "check" }, () => ({
      status: "ok",
      cardCount: source.records.length,
      semanticReview: "not-proven"
    }))
    .with({ command: "show" }, (query) =>
      selectCard(source.records, query.id, query.includeReference)
    )
    .with({ command: "expand" }, (query) =>
      expandCards(source.records, query.id, query)
    )
    .exhaustive();
  output.stdout(JSON.stringify(result));
  return 0;
}

export async function runCli(
  argv: readonly string[],
  output: CliOutput = consoleOutput
): Promise<number> {
  let options: ReturnType<typeof parseOptions>;
  try {
    options = parseOptions(argv);
  } catch (error) {
    output.stderr(error instanceof Error ? error.message : String(error));
    return 2;
  }
  if (options === null) {
    output.stdout(help);
    return 0;
  }
  try {
    return await executeCommand(options, output);
  } catch (error) {
    const failure = diagnosticFailure(error, options.root);
    output.stdout(JSON.stringify({ status: "error", error: failure }));
    output.stderr(`${failure.code}: ${failure.file}: ${failure.message}`);
    return 1;
  }
}

if (isMainModule(import.meta.url))
  process.exitCode = await runCli(process.argv.slice(2));
