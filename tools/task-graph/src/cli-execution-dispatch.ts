import {
  controlInput,
  failArgument,
  integerValue,
  keyValueDictionary,
  parseCommandOptions,
  requirePositionals,
  stringValue,
  stringsValue
} from "./cli-arguments.ts";
import type { DispatchResult, ParsedCommandOptions } from "./cli-contract.ts";
import { readJsonRequest } from "./cli-dispatch.ts";
import { requiredRevision } from "./cli-task-dispatch.ts";
import { parseTaskGraphApplyRequest } from "./schema.ts";
import { TaskGraphService } from "./service.ts";

const executionDispatchers: Readonly<
  Record<
    string,
    (
      service: TaskGraphService,
      tokens: readonly string[]
    ) => Promise<DispatchResult>
  >
> = {
  apply: dispatchApply,
  cancel: dispatchCancel,
  claim: dispatchClaim,
  complete: dispatchComplete,
  fail: dispatchFail,
  release: dispatchRelease,
  renew: dispatchRenew,
  retry: dispatchRetry
};

export async function dispatchExecutionCommand(
  service: TaskGraphService,
  command: string | undefined,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const dispatcher =
    command === undefined ? undefined : executionDispatchers[command];
  if (dispatcher === undefined)
    failArgument("Unknown task-graph command", { command: command ?? null });
  return await dispatcher(service, tokens);
}

async function dispatchClaim(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(1), {
    actor: { kind: "string" },
    duration: { kind: "string" },
    "recover-lease": { kind: "string" },
    "expected-revision": { kind: "string" },
    reason: { kind: "string" }
  });
  const [taskId = ""] = requirePositionals(
    parsed,
    1,
    "task-graph claim <task-id> --actor <actor> [--recover-lease <id> --expected-revision <n> --reason <text>]"
  );
  const recoverLeaseId = stringValue(parsed, "recover-lease");
  const expectedRevision = integerValue(parsed, "expected-revision");
  const reason = stringValue(parsed, "reason");
  const recoveryValueCount = [recoverLeaseId, expectedRevision, reason].filter(
    (value) => value !== undefined
  ).length;
  if (recoveryValueCount !== 0 && recoveryValueCount !== 3) {
    failArgument(
      "--recover-lease, --expected-revision, and --reason must be provided together"
    );
  }
  const common = {
    taskId,
    actor: stringValue(parsed, "actor", { required: true }) ?? "",
    durationSeconds: integerValue(parsed, "duration", {
      minimum: 60,
      maximum: 86_400
    })
  };
  return recoverLeaseId === undefined
    ? await service.claim(common)
    : await service.claim({
        ...common,
        recoverLeaseId,
        expectedRevision: expectedRevision ?? 0,
        reason: reason ?? ""
      });
}

async function dispatchRenew(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(1), {
    lease: { kind: "string" },
    duration: { kind: "string" }
  });
  const [taskId = ""] = requirePositionals(
    parsed,
    1,
    "task-graph renew <task-id> --lease <id> [--duration <seconds>]"
  );
  return await service.renew({
    taskId,
    leaseId: stringValue(parsed, "lease", { required: true }) ?? "",
    durationSeconds: integerValue(parsed, "duration", {
      minimum: 60,
      maximum: 86_400
    })
  });
}

async function dispatchRelease(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(1), {
    lease: { kind: "string" },
    control: { kind: "string" },
    reason: { kind: "string" }
  });
  const [taskId = ""] = requirePositionals(
    parsed,
    1,
    "task-graph release <task-id> --lease <id> --control <mode>"
  );
  const control = controlInput(
    stringValue(parsed, "control", { required: true }),
    stringValue(parsed, "reason")
  );
  if (control === undefined) failArgument("--control is required");
  return await service.release({
    taskId,
    leaseId: stringValue(parsed, "lease", { required: true }) ?? "",
    control
  });
}

function executionAuthority(parsed: ParsedCommandOptions): {
  expectedRevision: number | undefined;
  leaseId: string | undefined;
} {
  const leaseId = stringValue(parsed, "lease");
  const expectedRevision = integerValue(parsed, "expected-revision");
  if (leaseId !== undefined && expectedRevision !== undefined) {
    failArgument("--lease and --expected-revision are mutually exclusive");
  }
  if (leaseId === undefined && expectedRevision === undefined) {
    failArgument("One of --lease or --expected-revision is required");
  }
  return { expectedRevision, leaseId };
}

async function dispatchComplete(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(1), {
    lease: { kind: "string" },
    "expected-revision": { kind: "string" },
    "result-summary": { kind: "string" },
    "result-reference": { kind: "string", multiple: true }
  });
  const [taskId = ""] = requirePositionals(
    parsed,
    1,
    "task-graph complete <task-id> --result-summary <text> [--lease <id>|--expected-revision <n>]"
  );
  const authority = executionAuthority(parsed);
  const common = {
    taskId,
    result: {
      summary: stringValue(parsed, "result-summary", { required: true }) ?? "",
      references: keyValueDictionary(
        stringsValue(parsed, "result-reference"),
        "--result-reference"
      )
    }
  };
  return await service.complete(
    authority.leaseId !== undefined
      ? { ...common, leaseId: authority.leaseId }
      : { ...common, expectedRevision: authority.expectedRevision ?? 0 }
  );
}

async function dispatchFail(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(1), {
    lease: { kind: "string" },
    reason: { kind: "string" }
  });
  const [taskId = ""] = requirePositionals(
    parsed,
    1,
    "task-graph fail <task-id> --lease <id> --reason <text>"
  );
  return await service.fail({
    taskId,
    leaseId: stringValue(parsed, "lease", { required: true }) ?? "",
    reason: stringValue(parsed, "reason", { required: true }) ?? ""
  });
}

async function dispatchRetry(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(1), {
    "expected-revision": { kind: "string" }
  });
  const [taskId = ""] = requirePositionals(
    parsed,
    1,
    "task-graph retry <task-id> --expected-revision <n>"
  );
  return await service.retry({
    taskId,
    expectedRevision: requiredRevision(parsed)
  });
}

async function dispatchCancel(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(1), {
    lease: { kind: "string" },
    "expected-revision": { kind: "string" },
    reason: { kind: "string" }
  });
  const [taskId = ""] = requirePositionals(
    parsed,
    1,
    "task-graph cancel <task-id> --reason <text> [--lease <id>|--expected-revision <n>]"
  );
  const authority = executionAuthority(parsed);
  const common = {
    taskId,
    reason: stringValue(parsed, "reason", { required: true }) ?? ""
  };
  return await service.cancel(
    authority.leaseId !== undefined
      ? { ...common, leaseId: authority.leaseId }
      : { ...common, expectedRevision: authority.expectedRevision ?? 0 }
  );
}

async function dispatchApply(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(1), {
    file: { kind: "string" }
  });
  requirePositionals(parsed, 0, "task-graph apply [--file <path>|stdin]");
  const request = parseTaskGraphApplyRequest(
    await readJsonRequest(stringValue(parsed, "file"))
  );
  return await service.apply(request);
}
