export const repoRoot: string;

export type CommandExecution = Readonly<{
  executable: string;
  arguments: readonly string[];
  windowsVerbatimArguments: boolean;
}>;

export type CommandResult = Readonly<{
  exitCode: number | null;
  output: string;
  resolutionError: string | null;
  stderr?: string;
  stdout?: string;
}>;

export function resolveCommand(command: string): string | null;
export function resolveCommandExecution(
  command: string,
  args: readonly string[]
): CommandExecution | null;
export function runCommand(
  command: string,
  args: readonly string[],
  options?: Readonly<{ inherit?: boolean }>
): CommandResult;
export function requireSuccessfulCommand(
  command: string,
  args: readonly string[]
): void;
export function errorMessage(error: unknown): string;
