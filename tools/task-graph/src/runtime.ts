import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { TaskGraphError } from "./errors.ts";
import {
  taskGraphRuntimeProtocolVersion,
  taskGraphSupportedNodeRange,
  type Clock,
  type JsonObject,
  type TaskGraphRuntimeCheckResult,
  type TaskGraphRuntimeInfo,
  type TaskGraphRuntimeInstallResult
} from "./types.ts";

const nativePackageName = ["fs", "native", "extensions"].join("-");
const nativePackageVersion = "1.5.0";
const installTimeoutMilliseconds = 300_000;
const diagnosticTailBytes = 8 * 1024;
const processTerminationTimeoutMilliseconds = 2_500;
const processTerminationPhaseMilliseconds = 250;

export type NativeLockBinding = {
  tryLock(fd: number): boolean;
  unlock(fd: number): void;
};

type RuntimeAssets = {
  lockedPackages: Array<{
    lockPath: string;
    optional: boolean;
    version: string;
  }>;
  lockText: string;
  manifestText: string;
  packageLockSha256: string;
  runtimeId: string;
};

type RuntimeMarker = {
  schemaVersion: 1;
  runtimeId: string;
  packageLockSha256: string;
  packages: { "fs-native-extensions": "1.5.0" };
  installedAt: string;
  nodeVersion: string;
  platform: NodeJS.Platform;
  arch: string;
};

export type RuntimeContextOptions = {
  arch?: string;
  assetDirectoryUrl?: URL;
  environment?: NodeJS.ProcessEnv;
  homedir?: () => string;
  nodeVersion?: string;
  platform?: NodeJS.Platform;
};

export type NpmCommandRequest = {
  args: string[];
  command: string;
  cwd: string;
  timeoutMilliseconds: number;
  windowsTaskkill?: (pid: number) => Promise<boolean>;
};

export type NpmCommandResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
  timedOut: boolean;
};

export type RuntimeInstallInternalOptions = RuntimeContextOptions & {
  clock?: Clock;
  commandRunner?: (request: NpmCommandRequest) => Promise<NpmCommandResult>;
  probeCommandRunner?: (request: NpmCommandRequest) => Promise<NpmCommandResult>;
  uuid?: () => string;
};

type RuntimeContext = {
  arch: string;
  assets: RuntimeAssets;
  nodeVersion: string;
  platform: NodeJS.Platform;
  runtimePath: string;
  toolHome: string;
  toolHomeSource: "default" | "environment";
};

function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === code;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unavailableRuntimeDetails(options: RuntimeContextOptions, reason: string): JsonObject {
  const environment = options.environment ?? process.env;
  const environmentHome = environment.TASK_GRAPH_TOOL_HOME;
  const toolHome = environmentHome === undefined || environmentHome.length === 0
    ? path.join((options.homedir ?? os.homedir)(), ".tools", "task-graph")
    : path.resolve(environmentHome);
  return {
    runtimeId: "unavailable",
    runtimePath: path.join(toolHome, "runtimes", "unavailable"),
    reason
  };
}

async function readRuntimeAssets(options: RuntimeContextOptions): Promise<RuntimeAssets> {
  const assetDirectoryUrl = options.assetDirectoryUrl
    ?? new URL("../references/runtime/", import.meta.url);
  let manifestText: string;
  let lockText: string;
  try {
    [manifestText, lockText] = await Promise.all([
      fs.readFile(new URL("package.json", assetDirectoryUrl), "utf8"),
      fs.readFile(new URL("package-lock.json", assetDirectoryUrl), "utf8")
    ]);
  } catch (error) {
    throw new TaskGraphError(
      "RUNTIME_INCOMPATIBLE",
      "Task graph runtime installation assets are unavailable",
      unavailableRuntimeDetails(options, "runtime installation assets could not be read"),
      error instanceof Error ? { cause: error } : undefined
    );
  }

  let manifestInput: unknown;
  let lockInput: unknown;
  try {
    manifestInput = JSON.parse(manifestText) as unknown;
    lockInput = JSON.parse(lockText) as unknown;
  } catch (error) {
    throw new TaskGraphError(
      "RUNTIME_INCOMPATIBLE",
      "Task graph runtime installation assets are not valid JSON",
      unavailableRuntimeDetails(options, "runtime installation assets contain invalid JSON"),
      error instanceof Error ? { cause: error } : undefined
    );
  }

  const manifest = asRecord(manifestInput);
  const manifestDependencies = asRecord(manifest?.dependencies);
  const lock = asRecord(lockInput);
  const lockPackages = asRecord(lock?.packages);
  const lockRoot = asRecord(lockPackages?.[""]);
  const lockDependencies = asRecord(lockRoot?.dependencies);
  const nativeEntry = asRecord(lockPackages?.[`node_modules/${nativePackageName}`]);
  const lockedPackages = lockPackages === null
    ? []
    : Object.entries(lockPackages)
      .filter(([lockPath]) => lockPath !== "")
      .map(([lockPath, entry]) => {
        const value = asRecord(entry);
        return {
          lockPath,
          optional: value?.optional === true,
          version: typeof value?.version === "string" ? value.version : ""
        };
      });
  if (
    manifest === null
    || manifest.private !== true
    || manifestDependencies === null
    || Object.keys(manifestDependencies).length !== 1
    || manifestDependencies[nativePackageName] !== nativePackageVersion
    || lock === null
    || lock.lockfileVersion !== 3
    || lockPackages === null
    || lockDependencies === null
    || Object.keys(lockDependencies).length !== 1
    || lockDependencies[nativePackageName] !== nativePackageVersion
    || nativeEntry?.version !== nativePackageVersion
    || typeof nativeEntry.resolved !== "string"
    || typeof nativeEntry.integrity !== "string"
    || lockedPackages.length === 0
    || lockedPackages.some(({ lockPath, version }) =>
      !lockPath.startsWith("node_modules/")
      || lockPath.includes("\\")
      || lockPath.split("/").includes("..")
      || version.length === 0
    )
  ) {
    throw new TaskGraphError(
      "RUNTIME_INCOMPATIBLE",
      "Task graph runtime installation assets do not match the locked native dependency",
      unavailableRuntimeDetails(options, `expected ${nativePackageName}@${nativePackageVersion}`)
    );
  }

  const packageLockSha256 = createHash("sha256")
    .update(JSON.stringify(lockInput), "utf8")
    .digest("hex");
  return {
    lockedPackages,
    lockText,
    manifestText,
    packageLockSha256,
    runtimeId: `v${taskGraphRuntimeProtocolVersion}-${packageLockSha256}`
  };
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

async function createRuntimeContext(options: RuntimeContextOptions = {}): Promise<RuntimeContext> {
  const assets = await readRuntimeAssets(options);
  const environment = options.environment ?? process.env;
  const configuredHome = environment.TASK_GRAPH_TOOL_HOME;
  const toolHomeSource = configuredHome === undefined || configuredHome.length === 0
    ? "default"
    : "environment";
  const toolHome = toolHomeSource === "environment"
    ? path.resolve(configuredHome ?? "")
    : path.join((options.homedir ?? os.homedir)(), ".tools", "task-graph");
  return {
    arch: options.arch ?? process.arch,
    assets,
    nodeVersion: currentNodeVersion(options),
    platform: options.platform ?? process.platform,
    runtimePath: path.join(toolHome, "runtimes", assets.runtimeId),
    toolHome,
    toolHomeSource
  };
}

function runtimeInfo(context: RuntimeContext, state: TaskGraphRuntimeInfo["state"]): TaskGraphRuntimeInfo {
  return {
    runtimeId: context.assets.runtimeId,
    protocolVersion: taskGraphRuntimeProtocolVersion,
    toolHome: context.toolHome,
    runtimePath: context.runtimePath,
    toolHomeSource: context.toolHomeSource,
    state,
    nodeVersion: context.nodeVersion,
    platform: context.platform,
    arch: context.arch
  };
}

function parseRuntimeMarker(input: unknown, context: RuntimeContext): RuntimeMarker | null {
  const value = asRecord(input);
  const packages = asRecord(value?.packages);
  if (
    value === null
    || value.schemaVersion !== 1
    || value.runtimeId !== context.assets.runtimeId
    || value.packageLockSha256 !== context.assets.packageLockSha256
    || packages === null
    || Object.keys(packages).length !== 1
    || packages[nativePackageName] !== nativePackageVersion
    || typeof value.installedAt !== "string"
    || typeof value.nodeVersion !== "string"
    || typeof value.platform !== "string"
    || typeof value.arch !== "string"
  ) {
    return null;
  }
  const installedAt = new Date(value.installedAt);
  if (Number.isNaN(installedAt.valueOf()) || installedAt.toISOString() !== value.installedAt) {
    return null;
  }
  return {
    schemaVersion: 1,
    runtimeId: value.runtimeId,
    packageLockSha256: value.packageLockSha256,
    packages: { "fs-native-extensions": nativePackageVersion },
    installedAt: value.installedAt,
    nodeVersion: value.nodeVersion,
    platform: value.platform as NodeJS.Platform,
    arch: value.arch
  };
}

async function readRuntimeMarker(context: RuntimeContext): Promise<{
  marker: RuntimeMarker | null;
  state: TaskGraphRuntimeInfo["state"];
}> {
  let runtimeStat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    runtimeStat = await fs.lstat(context.runtimePath);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return { marker: null, state: "missing" };
    return { marker: null, state: "invalid" };
  }
  if (!runtimeStat.isDirectory() || runtimeStat.isSymbolicLink()) {
    return { marker: null, state: "invalid" };
  }
  const markerPath = path.join(context.runtimePath, "runtime.json");
  try {
    const markerStat = await fs.lstat(markerPath);
    if (!markerStat.isFile() || markerStat.isSymbolicLink()) {
      return { marker: null, state: "invalid" };
    }
    const markerInput: unknown = JSON.parse(await fs.readFile(markerPath, "utf8"));
    const marker = parseRuntimeMarker(markerInput, context);
    return marker === null
      ? { marker: null, state: "invalid" }
      : { marker, state: "installed" };
  } catch {
    return { marker: null, state: "invalid" };
  }
}

export async function getTaskGraphRuntimeInfo(
  options: RuntimeContextOptions = {}
): Promise<TaskGraphRuntimeInfo> {
  const context = await createRuntimeContext(options);
  return runtimeInfo(context, (await readRuntimeMarker(context)).state);
}

function missingRuntime(context: RuntimeContext): TaskGraphError {
  return new TaskGraphError(
    "RUNTIME_MISSING",
    "Task graph native runtime is not installed",
    {
      runtimeId: context.assets.runtimeId,
      runtimePath: context.runtimePath,
      installCommand: ["runtime", "install"]
    }
  );
}

function incompatibleRuntime(context: RuntimeContext, reason: string, cause?: unknown): TaskGraphError {
  return new TaskGraphError(
    "RUNTIME_INCOMPATIBLE",
    "Task graph native runtime is incompatible",
    {
      runtimeId: context.assets.runtimeId,
      runtimePath: context.runtimePath,
      reason
    },
    cause instanceof Error ? { cause } : undefined
  );
}

function narrowNativeBinding(input: unknown, context: RuntimeContext): NativeLockBinding {
  const value = asRecord(input);
  if (typeof value?.tryLock !== "function" || typeof value.unlock !== "function") {
    throw incompatibleRuntime(context, "native addon does not expose tryLock and unlock");
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

async function verifyRuntimePackages(
  runtimePath: string,
  context: RuntimeContext
): Promise<{ entryPath: string; runtimeRequire: NodeJS.Require }> {
  try {
    const realRuntimePath = await fs.realpath(runtimePath);
    for (const lockedPackage of context.assets.lockedPackages) {
      if (lockedPackage.optional) continue;
      const relativeParts = lockedPackage.lockPath.split("/");
      const expectedPackageRoot = path.join(realRuntimePath, ...relativeParts);
      const realPackageRoot = await fs.realpath(path.join(runtimePath, ...relativeParts));
      if (path.relative(expectedPackageRoot, realPackageRoot) !== "") {
        throw new Error(`${lockedPackage.lockPath} escapes the selected runtime`);
      }
      const realPackageJsonPath = await fs.realpath(path.join(realPackageRoot, "package.json"));
      if (path.relative(realPackageRoot, path.dirname(realPackageJsonPath)) !== "") {
        throw new Error(`${lockedPackage.lockPath} package metadata escapes the selected runtime`);
      }
      const packageInput: unknown = JSON.parse(await fs.readFile(realPackageJsonPath, "utf8"));
      if (asRecord(packageInput)?.version !== lockedPackage.version) {
        throw new Error(
          `${lockedPackage.lockPath} version is not ${lockedPackage.version}`
        );
      }
    }

    const runtimeRequire = createRequire(path.join(realRuntimePath, "package.json"));
    const expectedPackageRoot = path.join(realRuntimePath, "node_modules", nativePackageName);
    const realPackageRoot = await fs.realpath(expectedPackageRoot);
    const packageJsonPath = runtimeRequire.resolve(`${nativePackageName}/package.json`);
    const realPackageJsonPath = await fs.realpath(packageJsonPath);
    if (path.relative(realPackageRoot, path.dirname(realPackageJsonPath)) !== "") {
      throw new Error("native package metadata resolved outside the selected runtime");
    }
    const packageInput: unknown = JSON.parse(await fs.readFile(realPackageJsonPath, "utf8"));
    if (asRecord(packageInput)?.version !== nativePackageVersion) {
      throw new Error(`native package version is not ${nativePackageVersion}`);
    }
    const entryPath = await fs.realpath(runtimeRequire.resolve(nativePackageName));
    const entryRelativePath = path.relative(realPackageRoot, entryPath);
    if (
      entryRelativePath === ".."
      || entryRelativePath.startsWith(`..${path.sep}`)
      || path.isAbsolute(entryRelativePath)
    ) {
      throw new Error("native package entry resolved outside the selected runtime");
    }
    return { entryPath, runtimeRequire };
  } catch (error) {
    if (error instanceof TaskGraphError) throw error;
    throw incompatibleRuntime(context, "runtime package closure is incomplete or escapes the runtime", error);
  }
}

async function loadBinding(runtimePath: string, context: RuntimeContext): Promise<NativeLockBinding> {
  try {
    const verified = await verifyRuntimePackages(runtimePath, context);
    return narrowNativeBinding(
      verified.runtimeRequire(verified.entryPath) as unknown,
      context
    );
  } catch (error) {
    if (error instanceof TaskGraphError) throw error;
    throw incompatibleRuntime(context, "native addon could not be loaded from the runtime", error);
  }
}

async function probeNativeBinding(binding: NativeLockBinding): Promise<void> {
  const probeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "task-graph-native-probe-"));
  const probePath = path.join(probeDirectory, "lock");
  let handle: fs.FileHandle | null = null;
  let locked = false;
  try {
    handle = await fs.open(probePath, "w+");
    locked = binding.tryLock(handle.fd);
    if (!locked) throw new Error("native lock probe did not acquire an uncontended file");
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
    await fs.rm(probeDirectory, { force: true, recursive: true }).catch(() => undefined);
  }
}

async function probeInstalledRuntimeInChild(
  runtimePath: string,
  context: RuntimeContext,
  commandRunner: (request: NpmCommandRequest) => Promise<NpmCommandResult>
): Promise<NpmCommandResult> {
  await verifyRuntimePackages(runtimePath, context);
  const script = [
    "const {createRequire}=require('node:module')",
    "const fs=require('node:fs')",
    "const os=require('node:os')",
    "const path=require('node:path')",
    "const root=process.argv[1]",
    `const packageName=${JSON.stringify(nativePackageName)}`,
    "const runtimeRequire=createRequire(path.join(root,'package.json'))",
    "const binding=runtimeRequire(runtimeRequire.resolve(packageName))",
    "if(typeof binding.tryLock!=='function'||typeof binding.unlock!=='function')throw new Error('invalid native binding')",
    "const directory=fs.mkdtempSync(path.join(os.tmpdir(),'task-graph-native-install-probe-'))",
    "const handle=fs.openSync(path.join(directory,'lock'),'w+')",
    "let locked=false",
    "try{locked=binding.tryLock(handle);if(locked!==true)throw new Error('uncontended native lock failed');binding.unlock(handle);locked=false}finally{if(locked){try{binding.unlock(handle)}catch{}}try{fs.closeSync(handle)}finally{fs.rmSync(directory,{force:true,recursive:true})}}"
  ].join(";");
  return await commandRunner({
    args: ["-e", script, runtimePath],
    command: process.execPath,
    cwd: runtimePath,
    timeoutMilliseconds: 30_000
  });
}

async function loadCompatibleBinding(
  context: RuntimeContext,
  marker: RuntimeMarker
): Promise<NativeLockBinding> {
  if (marker.platform !== context.platform || marker.arch !== context.arch) {
    throw incompatibleRuntime(
      context,
      `runtime was installed for ${marker.platform}/${marker.arch}, not ${context.platform}/${context.arch}`
    );
  }
  const binding = await loadBinding(context.runtimePath, context);
  try {
    await probeNativeBinding(binding);
  } catch (error) {
    throw incompatibleRuntime(context, "native lock/unlock probe failed", error);
  }
  return binding;
}

export async function loadNativeLockBinding(
  options: RuntimeContextOptions = {}
): Promise<NativeLockBinding> {
  const context = await createRuntimeContext(options);
  assertSupportedNode(context);
  const installation = await readRuntimeMarker(context);
  if (installation.state === "missing") throw missingRuntime(context);
  if (installation.marker === null) {
    throw incompatibleRuntime(context, "runtime marker is missing or invalid");
  }
  return await loadCompatibleBinding(context, installation.marker);
}

export async function checkTaskGraphRuntime(
  options: RuntimeContextOptions = {}
): Promise<TaskGraphRuntimeCheckResult> {
  const context = await createRuntimeContext(options);
  assertSupportedNode(context);
  const installation = await readRuntimeMarker(context);
  if (installation.state === "missing") throw missingRuntime(context);
  if (installation.marker === null) {
    throw incompatibleRuntime(context, "runtime marker is missing or invalid");
  }
  await loadCompatibleBinding(context, installation.marker);
  return { ...runtimeInfo(context, "installed"), compatible: true };
}

class DiagnosticSanitizer {
  private authority = "";
  private authorityOverflow = false;
  private escaped = false;
  private output = "";
  private pending = "";
  private previous = "";
  private state: "normal" | "secret-double" | "secret-single" | "secret-unquoted"
    | "url-authority" = "normal";

  push(chunk: Buffer | string): void {
    this.pending += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
    this.process(false);
  }

  finish(): string {
    this.process(true);
    if (this.state === "url-authority") this.finishAuthority();
    return this.output;
  }

  private append(value: string): void {
    const combined = Buffer.concat([Buffer.from(this.output), Buffer.from(value)]);
    this.output = combined
      .subarray(Math.max(0, combined.length - diagnosticTailBytes))
      .toString("utf8");
  }

  private finishAuthority(): void {
    if (this.authorityOverflow) {
      this.append("[redacted]");
    } else {
      const separator = this.authority.lastIndexOf("@");
      this.append(separator === -1
        ? this.authority
        : `[redacted]@${this.authority.slice(separator + 1)}`);
    }
    this.authority = "";
    this.authorityOverflow = false;
    this.state = "normal";
  }

  private process(final: boolean): void {
    const normalLookahead = 64;
    while (this.pending.length > 0) {
      if (this.state === "url-authority") {
        const character = this.pending[0] ?? "";
        if (/[/\s?#]/u.test(character)) {
          this.finishAuthority();
          continue;
        }
        this.pending = this.pending.slice(1);
        if (!this.authorityOverflow) {
          this.authority += character;
          if (this.authority.length > 4_096) {
            this.authority = "";
            this.authorityOverflow = true;
          }
        }
        continue;
      }

      if (this.state === "secret-double" || this.state === "secret-single") {
        const character = this.pending[0] ?? "";
        this.pending = this.pending.slice(1);
        const quote = this.state === "secret-double" ? "\"" : "'";
        if (this.escaped) {
          this.escaped = false;
        } else if (character === "\\") {
          this.escaped = true;
        } else if (character === quote) {
          this.append(character);
          this.previous = character;
          this.state = "normal";
        }
        continue;
      }

      if (this.state === "secret-unquoted") {
        const character = this.pending[0] ?? "";
        if (/[\s,}\]]/u.test(character)) {
          this.state = "normal";
          continue;
        }
        this.pending = this.pending.slice(1);
        continue;
      }

      if (!final && this.pending.length <= normalLookahead) return;
      if (this.pending.startsWith("\u001b[")) {
        const sequence = /^[0-?]*[ -/]*[@-~]/u.exec(this.pending.slice(2));
        if (sequence === null) {
          if (!final && this.pending.length < normalLookahead) return;
          this.pending = this.pending.slice(1);
        } else {
          this.pending = this.pending.slice(sequence[0].length + 2);
        }
        continue;
      }

      const character = this.pending[0] ?? "";
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(character)) {
        this.pending = this.pending.slice(1);
        continue;
      }

      const urlMatch = /^(https?:\/\/)/iu.exec(this.pending);
      if (urlMatch !== null) {
        this.append(urlMatch[1] ?? "");
        this.previous = "/";
        this.pending = this.pending.slice(urlMatch[0].length);
        this.state = "url-authority";
        continue;
      }

      const hasKeyBoundary = this.previous.length === 0 || !/[A-Za-z0-9_]/u.test(this.previous);
      const secretMatch = hasKeyBoundary
        ? /^(?:(["'])(_authToken|token|password)\1|(_authToken|token|password))(\s*[=:]\s*)(["']?)/iu.exec(this.pending)
        : null;
      if (secretMatch !== null) {
        const prefix = secretMatch[0];
        const valueQuote = secretMatch[5] ?? "";
        this.append(`${prefix}[redacted]`);
        this.previous = valueQuote;
        this.pending = this.pending.slice(prefix.length);
        this.escaped = false;
        this.state = valueQuote === "\""
          ? "secret-double"
          : valueQuote === "'"
            ? "secret-single"
            : "secret-unquoted";
        continue;
      }

      this.append(character);
      this.previous = character;
      this.pending = this.pending.slice(1);
    }
  }
}

function cleanDiagnostic(text: string): string {
  const sanitizer = new DiagnosticSanitizer();
  sanitizer.push(text);
  return sanitizer.finish();
}

type ChildCloseTracker = {
  detach(): void;
  isClosed(): boolean;
  waitUntil(deadline: number): Promise<boolean>;
};

function createChildCloseTracker(child: ReturnType<typeof spawn>): ChildCloseTracker {
  let closed = false;
  let resolveClosed: (() => void) | undefined;
  const closedPromise = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  const onClose = (): void => {
    closed = true;
    resolveClosed?.();
  };
  child.once("close", onClose);

  return {
    detach: () => child.removeListener("close", onClose),
    isClosed: () => closed,
    waitUntil: async (deadline) => {
      if (closed) return true;
      const remaining = Math.max(0, deadline - performance.now());
      if (remaining === 0) return false;
      return await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (didClose: boolean): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(didClose);
        };
        void closedPromise.then(() => finish(true));
        const timeout = setTimeout(() => finish(false), remaining);
      });
    }
  };
}

function phaseDeadline(totalDeadline: number): number {
  return Math.min(
    totalDeadline,
    performance.now() + processTerminationPhaseMilliseconds
  );
}

async function booleanBeforeDeadline(
  value: Promise<boolean>,
  deadline: number
): Promise<boolean> {
  const remaining = Math.max(0, deadline - performance.now());
  if (remaining === 0) {
    void value.catch(() => undefined);
    return false;
  }
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    void value.then((result) => finish(result), () => finish(false));
    const timeout = setTimeout(() => finish(false), remaining);
  });
}

function signalPosixProcessGroup(
  child: ReturnType<typeof spawn>,
  signal: NodeJS.Signals
): boolean {
  if (child.pid === undefined) {
    return child.kill(signal);
  }
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch {
    try {
      return child.kill(signal);
    } catch {
      return false;
    }
  }
}

async function runWindowsTaskkill(pid: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const killer = spawn(
      "taskkill.exe",
      ["/pid", String(pid), "/t", "/f"],
      { shell: false, stdio: "ignore", windowsHide: true }
    );
    let settled = false;
    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      killer.removeAllListeners("error");
      killer.removeAllListeners("close");
      resolve(result);
    };
    killer.once("error", () => finish(false));
    killer.once("close", (exitCode) => finish(exitCode === 0));
    const timeout = setTimeout(() => {
      killer.kill("SIGKILL");
      finish(false);
    }, processTerminationPhaseMilliseconds);
  });
}

async function terminateProcessTree(
  child: ReturnType<typeof spawn>,
  closeTracker: ChildCloseTracker,
  totalDeadline: number,
  windowsTaskkill: (pid: number) => Promise<boolean>
): Promise<boolean> {
  if (closeTracker.isClosed()) return true;
  if (process.platform !== "win32") {
    if (!signalPosixProcessGroup(child, "SIGTERM")) return closeTracker.isClosed();
    if (await closeTracker.waitUntil(phaseDeadline(totalDeadline))) return true;
    if (!signalPosixProcessGroup(child, "SIGKILL")) return closeTracker.isClosed();
    return await closeTracker.waitUntil(phaseDeadline(totalDeadline));
  }
  if (child.pid === undefined) {
    if (!child.kill("SIGKILL")) return closeTracker.isClosed();
    return await closeTracker.waitUntil(phaseDeadline(totalDeadline));
  }
  let taskkillPromise: Promise<boolean>;
  try {
    taskkillPromise = windowsTaskkill(child.pid);
  } catch {
    taskkillPromise = Promise.resolve(false);
  }
  const taskkillSucceeded = await booleanBeforeDeadline(
    taskkillPromise,
    phaseDeadline(totalDeadline)
  );
  if (
    taskkillSucceeded
    && await closeTracker.waitUntil(phaseDeadline(totalDeadline))
  ) {
    return true;
  }
  if (!child.kill("SIGKILL")) return closeTracker.isClosed();
  return await closeTracker.waitUntil(phaseDeadline(totalDeadline));
}

export async function runNpmCommand(request: NpmCommandRequest): Promise<NpmCommandResult> {
  return await new Promise<NpmCommandResult>((resolve, reject) => {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const stdoutDiagnostic = new DiagnosticSanitizer();
    const stderrDiagnostic = new DiagnosticSanitizer();
    const closeTracker = createChildCloseTracker(child);
    let timedOut = false;
    let settled = false;
    let capturingOutput = true;
    const onStdout = (chunk: Buffer | string): void => {
      stdoutDiagnostic.push(chunk);
    };
    const onStderr = (chunk: Buffer | string): void => {
      stderrDiagnostic.push(chunk);
    };
    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const stopCapturingOutput = (): void => {
      if (!capturingOutput) return;
      capturingOutput = false;
      child.stdout?.removeListener("data", onStdout);
      child.stderr?.removeListener("data", onStderr);
    };
    const finalize = (result: NpmCommandResult | Error): void => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      child.removeListener("error", onError);
      child.removeListener("close", onClose);
      closeTracker.detach();
      stopCapturingOutput();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };
    const currentResult = (
      exitCode = child.exitCode,
      signal = child.signalCode
    ): NpmCommandResult => ({
      exitCode,
      signal,
      stderr: stderrDiagnostic.finish(),
      stdout: stdoutDiagnostic.finish(),
      timedOut
    });
    const onError = (error: Error): void => finalize(error);
    const onClose = (
      exitCode: number | null,
      signal: NodeJS.Signals | null
    ): void => finalize(currentResult(exitCode, signal));
    child.once("error", onError);
    child.once("close", onClose);
    timeout = setTimeout(() => {
      timedOut = true;
      stopCapturingOutput();
      const totalDeadline = performance.now() + processTerminationTimeoutMilliseconds;
      void terminateProcessTree(
        child,
        closeTracker,
        totalDeadline,
        request.windowsTaskkill ?? runWindowsTaskkill
      ).then(async (closed) => {
        if (settled) return;
        if (!closed) {
          child.stdout?.destroy();
          child.stderr?.destroy();
          await closeTracker.waitUntil(phaseDeadline(totalDeadline));
        }
        if (!settled) finalize(currentResult());
      }, async () => {
        if (settled) return;
        child.stdout?.destroy();
        child.stderr?.destroy();
        await closeTracker.waitUntil(phaseDeadline(totalDeadline));
        if (!settled) finalize(currentResult());
      });
    }, request.timeoutMilliseconds);
  });
}

function installFailure(
  context: RuntimeContext,
  phase: string,
  extra: JsonObject = {},
  cause?: unknown
): TaskGraphError {
  return new TaskGraphError(
    "RUNTIME_INSTALL_FAILED",
    `Task graph runtime installation failed during ${phase}`,
    {
      phase,
      runtimeId: context.assets.runtimeId,
      runtimePath: context.runtimePath,
      ...extra
    },
    cause instanceof Error ? { cause } : undefined
  );
}

function commandFailureDetails(result: NpmCommandResult): JsonObject {
  return {
    exitCode: result.exitCode,
    signal: result.signal,
    stdoutTail: cleanDiagnostic(result.stdout),
    stderrTail: cleanDiagnostic(result.stderr),
    timedOut: result.timedOut
  };
}

function commandForPlatform(platform: NodeJS.Platform): { command: string; prefix: string[] } {
  return platform === "win32"
    ? {
        command: process.env.ComSpec ?? "cmd.exe",
        prefix: ["/d", "/s", "/c", "npm.cmd"]
      }
    : { command: "npm", prefix: [] };
}

async function validatePublishedRuntime(
  context: RuntimeContext
): Promise<NativeLockBinding> {
  const installation = await readRuntimeMarker(context);
  if (installation.state === "missing") throw missingRuntime(context);
  if (installation.marker === null) {
    throw incompatibleRuntime(context, "runtime marker is missing or invalid");
  }
  return await loadCompatibleBinding(context, installation.marker);
}

export async function installTaskGraphRuntime(
  options: RuntimeInstallInternalOptions = {}
): Promise<TaskGraphRuntimeInstallResult> {
  const context = await createRuntimeContext(options);
  assertSupportedNode(context);
  const existing = await readRuntimeMarker(context);
  if (existing.state !== "missing") {
    if (existing.marker === null) {
      throw incompatibleRuntime(context, "existing runtime directory is invalid");
    }
    await loadCompatibleBinding(context, existing.marker);
    return { ...runtimeInfo(context, "installed"), action: "reused" };
  }

  const runtimesDirectory = path.dirname(context.runtimePath);
  try {
    await fs.mkdir(runtimesDirectory, { recursive: true });
  } catch (error) {
    throw installFailure(context, "prepare", {}, error);
  }
  const uuid = (options.uuid ?? randomUUID)();
  const temporaryPath = path.join(
    runtimesDirectory,
    `.install-${context.assets.runtimeId}-${uuid}`
  );
  let published = false;
  let temporaryCreated = false;
  try {
    await fs.mkdir(temporaryPath);
    temporaryCreated = true;
    await Promise.all([
      fs.writeFile(path.join(temporaryPath, "package.json"), context.assets.manifestText, "utf8"),
      fs.writeFile(path.join(temporaryPath, "package-lock.json"), context.assets.lockText, "utf8")
    ]);

    const npm = commandForPlatform(context.platform);
    const npmArgs = [
      ...npm.prefix,
      "ci",
      "--ignore-scripts",
      "--omit=dev",
      "--no-audit",
      "--no-fund"
    ];
    let commandResult: NpmCommandResult;
    try {
      commandResult = await (options.commandRunner ?? runNpmCommand)({
        args: npmArgs,
        command: npm.command,
        cwd: temporaryPath,
        timeoutMilliseconds: installTimeoutMilliseconds
      });
    } catch (error) {
      throw installFailure(context, "npm-spawn", {}, error);
    }
    if (commandResult.timedOut || commandResult.exitCode !== 0) {
      throw installFailure(context, "npm-ci", commandFailureDetails(commandResult));
    }

    let probeResult: NpmCommandResult;
    try {
      probeResult = await probeInstalledRuntimeInChild(
        temporaryPath,
        context,
        options.probeCommandRunner ?? runNpmCommand
      );
    } catch (error) {
      throw installFailure(context, "probe", {}, error);
    }
    if (probeResult.timedOut || probeResult.exitCode !== 0) {
      throw installFailure(context, "probe", commandFailureDetails(probeResult));
    }
    const installedAt = (options.clock ?? (() => new Date()))().toISOString();
    const marker: RuntimeMarker = {
      schemaVersion: 1,
      runtimeId: context.assets.runtimeId,
      packageLockSha256: context.assets.packageLockSha256,
      packages: { "fs-native-extensions": nativePackageVersion },
      installedAt,
      nodeVersion: context.nodeVersion,
      platform: context.platform,
      arch: context.arch
    };
    try {
      await fs.writeFile(
        path.join(temporaryPath, "runtime.json"),
        `${JSON.stringify(marker, null, 2)}\n`,
        "utf8"
      );
    } catch (error) {
      throw installFailure(context, "marker", {}, error);
    }

    try {
      await fs.rename(temporaryPath, context.runtimePath);
      published = true;
      return { ...runtimeInfo(context, "installed"), action: "installed" };
    } catch (error) {
      let finalExists = false;
      try {
        finalExists = (await fs.lstat(context.runtimePath)).isDirectory();
      } catch (statError) {
        if (!isErrno(statError, "ENOENT")) {
          throw installFailure(context, "publish", {}, error);
        }
      }
      if (!finalExists) throw installFailure(context, "publish", {}, error);
      await validatePublishedRuntime(context);
      return { ...runtimeInfo(context, "installed"), action: "reused" };
    }
  } catch (error) {
    if (error instanceof TaskGraphError) throw error;
    throw installFailure(context, "prepare", {}, error);
  } finally {
    if (temporaryCreated && !published) {
      await fs.rm(temporaryPath, { force: true, recursive: true }).catch(() => undefined);
    }
  }
}
