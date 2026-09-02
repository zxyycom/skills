import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { TaskGraphError } from "./errors.ts";
import {
  taskGraphRuntimeProtocolVersion,
  taskGraphSupportedNodeRange,
  type TaskGraphRuntimeInfo,
  type TaskGraphRuntimeInstallCommand
} from "./types.ts";

const nativePackageName = "fs-native-extensions";
const nativePackageVersion = "1.5.0";
const runtimeId = `${nativePackageName}-${nativePackageVersion}`;

export type NativeLockBinding = {
  tryLock(fd: number): boolean;
  unlock(fd: number): void;
};

export type RuntimeContextOptions = {
  arch?: string;
  environment?: NodeJS.ProcessEnv;
  homedir?: () => string;
  nodeVersion?: string;
  platform?: NodeJS.Platform;
};

type RuntimeContext = {
  arch: string;
  nodeVersion: string;
  platform: NodeJS.Platform;
  runtimePath: string;
  toolHome: string;
  toolHomeSource: "default" | "environment";
};

type RuntimeInspection = {
  binding: NativeLockBinding | null;
  info: TaskGraphRuntimeInfo;
};

function isErrno(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function currentNodeVersion(options: RuntimeContextOptions): string {
  const value = options.nodeVersion ?? process.version;
  return value.startsWith("v") ? value : `v${value}`;
}

function isSupportedNodeVersion(nodeVersion: string): boolean {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(nodeVersion);
  if (match === null) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (major >= 26) return true;
  if (major === 24) return minor > 15 || (minor === 15 && patch >= 0);
  return major === 22 && (minor > 22 || (minor === 22 && patch >= 2));
}

function createRuntimeContext(
  options: RuntimeContextOptions = {}
): RuntimeContext {
  const environment = options.environment || process.env;
  const configuredHome = environment.TASK_GRAPH_TOOL_HOME;
  const configured = configuredHome !== undefined && configuredHome.length > 0;
  const toolHomeSource = configured ? "environment" : "default";
  const toolHome = configured
    ? path.resolve(configuredHome)
    : path.join((options.homedir ?? os.homedir)(), ".tools", "task-graph");
  return {
    arch: options.arch ?? process.arch,
    nodeVersion: currentNodeVersion(options),
    platform: options.platform ?? process.platform,
    runtimePath: path.join(toolHome, "runtimes", runtimeId),
    toolHome,
    toolHomeSource
  };
}

function assertSupportedNode(context: RuntimeContext): void {
  if (isSupportedNodeVersion(context.nodeVersion)) return;
  throw new TaskGraphError(
    "RUNTIME_UNSUPPORTED",
    `Task graph requires Node ${taskGraphSupportedNodeRange}`,
    {
      nodeVersion: context.nodeVersion,
      supportedNodeRange: taskGraphSupportedNodeRange,
      platform: context.platform,
      arch: context.arch
    }
  );
}

function installCommand(
  context: RuntimeContext
): TaskGraphRuntimeInstallCommand {
  return {
    command: "npm",
    args: [
      "install",
      "--prefix",
      context.runtimePath,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-exact",
      `${nativePackageName}@${nativePackageVersion}`
    ]
  };
}

function runtimeInfo(
  context: RuntimeContext,
  state: TaskGraphRuntimeInfo["state"],
  reason: string | null
): TaskGraphRuntimeInfo {
  return {
    runtimeId,
    protocolVersion: taskGraphRuntimeProtocolVersion,
    toolHome: context.toolHome,
    runtimePath: context.runtimePath,
    toolHomeSource: context.toolHomeSource,
    state,
    compatible: state === "compatible",
    reason,
    installCommand: state === "missing" ? installCommand(context) : null,
    nodeVersion: context.nodeVersion,
    platform: context.platform,
    arch: context.arch
  };
}

function narrowNativeBinding(input: unknown): NativeLockBinding {
  const value = asRecord(input);
  if (
    typeof value?.tryLock !== "function" ||
    typeof value.unlock !== "function"
  ) {
    throw new Error("native addon does not expose tryLock and unlock");
  }
  const tryLock = value.tryLock;
  const unlock = value.unlock;
  return {
    tryLock: (fd) => {
      const result: unknown = Reflect.apply(tryLock, value, [fd]);
      if (typeof result !== "boolean") {
        throw new Error("native tryLock returned a non-boolean result");
      }
      return result;
    },
    unlock: (fd) => {
      Reflect.apply(unlock, value, [fd]);
    }
  };
}

async function loadBinding(
  context: RuntimeContext
): Promise<NativeLockBinding> {
  const packageRoot = path.join(
    context.runtimePath,
    "node_modules",
    nativePackageName
  );
  const packageInput: unknown = JSON.parse(
    await fs.readFile(path.join(packageRoot, "package.json"), "utf8")
  );
  if (asRecord(packageInput)?.version !== nativePackageVersion) {
    throw new Error(`native package version is not ${nativePackageVersion}`);
  }
  const runtimeRequire = createRequire(
    path.join(context.runtimePath, "package.json")
  );
  return narrowNativeBinding(runtimeRequire(packageRoot) as unknown);
}

async function probeNativeBinding(binding: NativeLockBinding): Promise<void> {
  const probeDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "task-graph-native-probe-")
  );
  const probePath = path.join(probeDirectory, "lock");
  let handle: fs.FileHandle | null = null;
  let locked = false;
  try {
    handle = await fs.open(probePath, "w+");
    locked = binding.tryLock(handle.fd);
    if (!locked)
      throw new Error("native lock probe did not acquire an uncontended file");
    binding.unlock(handle.fd);
    locked = false;
  } finally {
    if (locked && handle !== null) {
      try {
        binding.unlock(handle.fd);
      } catch {
        // Closing the handle below still releases an operating-system lock.
      }
    }
    await handle?.close().catch(() => undefined);
    await fs
      .rm(probeDirectory, { force: true, recursive: true })
      .catch(() => undefined);
  }
}

function failureReason(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "native runtime could not be loaded and probed";
}

async function inspectRuntime(
  context: RuntimeContext
): Promise<RuntimeInspection> {
  assertSupportedNode(context);
  try {
    const stat = await fs.stat(context.runtimePath);
    if (!stat.isDirectory()) {
      return {
        binding: null,
        info: runtimeInfo(
          context,
          "incompatible",
          "runtime path is not a directory"
        )
      };
    }
  } catch (error) {
    if (isErrno(error, "ENOENT")) {
      return {
        binding: null,
        info: runtimeInfo(context, "missing", "native runtime is not installed")
      };
    }
    return {
      binding: null,
      info: runtimeInfo(context, "incompatible", failureReason(error))
    };
  }

  try {
    const binding = await loadBinding(context);
    await probeNativeBinding(binding);
    return { binding, info: runtimeInfo(context, "compatible", null) };
  } catch (error) {
    return {
      binding: null,
      info: runtimeInfo(context, "incompatible", failureReason(error))
    };
  }
}

export async function getTaskGraphRuntimeInfo(
  options: RuntimeContextOptions = {}
): Promise<TaskGraphRuntimeInfo> {
  const context = createRuntimeContext(options);
  return (await inspectRuntime(context)).info;
}

export async function loadNativeLockBinding(
  options: RuntimeContextOptions = {}
): Promise<NativeLockBinding> {
  const context = createRuntimeContext(options);
  const inspection = await inspectRuntime(context);
  if (inspection.binding !== null) return inspection.binding;
  if (inspection.info.state === "missing") {
    throw new TaskGraphError(
      "RUNTIME_MISSING",
      "Task graph native runtime is not installed",
      {
        runtimeId,
        runtimePath: context.runtimePath,
        installCommand: installCommand(context)
      }
    );
  }
  throw new TaskGraphError(
    "RUNTIME_INCOMPATIBLE",
    "Task graph native runtime is incompatible",
    {
      runtimeId,
      runtimePath: context.runtimePath,
      reason: inspection.info.reason
    }
  );
}
