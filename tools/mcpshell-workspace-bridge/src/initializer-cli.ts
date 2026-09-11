import process from "node:process";
import { parseArgs } from "node:util";
import { BridgeError } from "./shared.ts";
import type {
  InitializerCommand,
  InitializerRequest
} from "./initializer-contract.ts";

const usage =
  "usage: init-mcpshell-workspace.mjs [preview|apply|remove] --identity <name> [...]";

type CliValues = Readonly<{
  backend?: string;
  identity?: string;
  "project-root"?: string;
  "remove-env"?: boolean;
  "staging-root"?: string;
}>;

function commandFrom(argv: readonly string[]): InitializerCommand {
  const command = argv[2] ?? "preview";
  if (command === "preview" || command === "apply" || command === "remove")
    return command;
  throw new Error(usage);
}

function valuesFrom(argv: readonly string[]): CliValues {
  return parseArgs({
    args: argv.slice(3),
    options: {
      backend: { type: "string" },
      identity: { type: "string" },
      "project-root": { type: "string" },
      "remove-env": { type: "boolean" },
      "staging-root": { type: "string" }
    },
    strict: true
  }).values;
}

function configFrom(values: CliValues) {
  const provided = [
    values.backend,
    values["project-root"],
    values["staging-root"]
  ].filter((value) => value !== undefined);
  if (provided.length === 0) return undefined;
  if (provided.length !== 3)
    throw new BridgeError(
      "invalid_input",
      "--backend, --project-root, and --staging-root must be provided together"
    );
  return {
    backendHandle: values.backend as string,
    projectRoot: values["project-root"] as string,
    stagingRoot: values["staging-root"] as string
  };
}

export function readCliRequest(
  argv: readonly string[] = process.argv
): InitializerRequest {
  const command = commandFrom(argv);
  const values = valuesFrom(argv);
  if (values.identity === undefined)
    throw new BridgeError("invalid_input", "--identity is required");
  return {
    command,
    config: command === "remove" ? undefined : configFrom(values),
    identity: values.identity,
    removeEnv: values["remove-env"] ?? false
  };
}
