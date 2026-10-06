import { isMainModule } from "../../shared/src/node/main-module.ts";
import { CardFailure, type CardFailureCode } from "./card.ts";
import { currentSource, synchronize } from "./index.ts";
import { expandCards, selectCard } from "./query.ts";
import { parseOptions, type Options } from "./options.ts";

export const help = `Novel Cards — Node.js >=24.18
node <skill>/scripts/novel-cards.mjs check --root <project>
node <skill>/scripts/novel-cards.mjs sync-index --write --root <project>
node <skill>/scripts/novel-cards.mjs show <id> --root <project> [--include-reference]
node <skill>/scripts/novel-cards.mjs expand <id> --root <project> [--depth 0..20] [--max-cards 1..1000] [--include-reference]
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
  const source = await currentSource(options.root);
  const result =
    options.command === "check"
      ? {
          status: "ok",
          cardCount: source.records.length,
          semanticReview: "not-proven"
        }
      : options.command === "show"
        ? selectCard(source.records, options.id, options.includeReference)
        : expandCards(source.records, options.id, options);
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
