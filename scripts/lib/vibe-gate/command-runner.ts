// 命令的生命周期、输出上限和 transcript 由原生 commandCheck 承接。
export type GateCommand = Readonly<{
  args: readonly string[];
  command: "bun" | "node";
}>;

export const gateCommandPolicy = {
  environment: { mode: "inherit" },
  output: { mode: "transcript" },
  timeoutMs: 120_000,
  outputByteLimit: 16 * 1024 * 1024
} as const;

function quoteCommandArgument(argument: string): string {
  return /^[A-Za-z0-9_./,:=@+%-]+$/u.test(argument)
    ? argument
    : "'" + argument.replaceAll("'", "'\"'\"'") + "'";
}

export function commandText(command: GateCommand): string {
  return [command.command, ...command.args].map(quoteCommandArgument).join(" ");
}
