import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { operationErrorDetail } from "../../../tools/shared/src/node/error-detail.ts";
import { rootDir } from "../project.ts";
import { vibeNativeCheckIds } from "./checks/native.ts";
import {
  isReleaseOnlyGatePackageScript,
  packageScriptCheckId,
  releaseRequiredPackageScripts
} from "./checks/package-script.ts";
import {
  packSkillsCheckId,
  releaseSnapshotCheckId,
  releaseVersionCheckId
} from "./checks/release.ts";
import { semanticGateChecks } from "./checks/semantic.ts";

export const gateImpactContractVersion = "incremental-gate-v2";

const receiptFormatVersion = 1;
const maximumSnapshotFileCount = 20_000;
const maximumSnapshotBytes = 536_870_912;
const shellBookkeepingEnvironmentNames = new Set(["_", "OLDPWD", "SHLVL"]);

export type GateImpactTag =
  | "build-system"
  | "change-plan"
  | "decision-records"
  | "documentation"
  | "environment"
  | "global"
  | "index-runtime"
  | "investigation-report"
  | "json"
  | "maintained-code"
  | "markdown"
  | "path-inventory"
  | "secret-surface"
  | "shared-tools"
  | "skill-release"
  | "skill-updater"
  | "skill-validator"
  | "skills"
  | "task-graph"
  | "test-evidence";

export type GateCheckImpactContract = Readonly<{
  checkId: string;
  inputTags: readonly GateImpactTag[];
  version: string;
}>;

type SnapshotFileKind = "file" | "missing" | "symlink" | "unsupported";

export type GateWorkspaceFile = Readonly<{
  digest: string;
  kind: SnapshotFileKind;
  mode: number | null;
  path: string;
  size: number;
  tags: readonly GateImpactTag[];
}>;

export type GateWorkspaceSnapshot = Readonly<{
  files: readonly GateWorkspaceFile[];
  tagDigests: Readonly<Record<GateImpactTag, string>>;
  toolchainFingerprint: string;
  unclassifiedPaths: readonly string[];
  workspaceFingerprint: string;
}>;

export type GateActivationReason =
  | "cache-invalid"
  | "conservative-fallback"
  | "dependency-required"
  | "first-run"
  | "inputs-changed"
  | "release-full"
  | "snapshot-unavailable"
  | "unchanged-success";

export type GateActivationDecision = Readonly<
  | {
      action: "execute";
      checkId: string;
      fingerprint: null;
      reason: "release-full" | "snapshot-unavailable";
    }
  | {
      action: "execute";
      checkId: string;
      fingerprint: string;
      reason:
        | "cache-invalid"
        | "conservative-fallback"
        | "dependency-required"
        | "first-run"
        | "inputs-changed";
    }
  | {
      action: "reuse";
      checkId: string;
      fingerprint: string;
      reason: "unchanged-success";
    }
>;

type GateActivationPlanCommon = Readonly<{
  activeCheckIds: readonly string[];
  cacheDirectory: string;
  decisions: readonly GateActivationDecision[];
}>;

export type GateActivationPlan =
  | (GateActivationPlanCommon &
      Readonly<{
        fallbackDetail: string;
        kind: "fallback";
        snapshot: null;
      }>)
  | (GateActivationPlanCommon &
      Readonly<{
        kind: "incremental";
        snapshot: GateWorkspaceSnapshot;
      }>)
  | (GateActivationPlanCommon &
      Readonly<{
        kind: "release";
        snapshot: null;
      }>);

type GateReceipt = Readonly<{
  checkId: string;
  fingerprint: string;
  outcome: "passed";
}>;

type GateReceiptManifest = Readonly<{
  contractVersion: typeof gateImpactContractVersion;
  formatVersion: typeof receiptFormatVersion;
  receipts: readonly GateReceipt[];
}>;

export type GateReceiptPublication = Readonly<
  | { published: true; receiptCount: number }
  | {
      detail: string;
      published: false;
      reason: "publication-failed" | "snapshot-unavailable";
    }
  | {
      published: false;
      reason: "check-not-passed" | "not-incremental" | "workspace-drift";
    }
>;

type CommandCapture = (
  command: string,
  arguments_: readonly string[],
  cwd: string
) => Promise<Buffer>;

type CaptureDependencies = Readonly<{
  captureCommand?: CommandCapture;
  environment?: Readonly<Record<string, string | undefined>>;
}>;

type PrepareGateActivationOptions = Readonly<{
  cacheDirectory?: string;
  captureDependencies?: CaptureDependencies;
  release: boolean;
  workspaceRoot?: string;
}>;

const allImpactTags = [
  "build-system",
  "change-plan",
  "decision-records",
  "documentation",
  "environment",
  "global",
  "index-runtime",
  "investigation-report",
  "json",
  "maintained-code",
  "markdown",
  "path-inventory",
  "secret-surface",
  "shared-tools",
  "skill-release",
  "skill-updater",
  "skill-validator",
  "skills",
  "task-graph",
  "test-evidence"
] as const satisfies readonly GateImpactTag[];

const tagDependencies: Readonly<
  Partial<Record<GateImpactTag, readonly GateImpactTag[]>>
> = Object.freeze({
  "build-system": ["shared-tools"],
  "change-plan": ["build-system", "shared-tools"],
  "decision-records": ["build-system", "index-runtime", "shared-tools"],
  environment: ["shared-tools", "skill-release"],
  "index-runtime": ["shared-tools"],
  "investigation-report": ["build-system", "index-runtime", "shared-tools"],
  "skill-release": ["shared-tools"],
  "skill-updater": ["build-system", "shared-tools", "skill-release"],
  "skill-validator": ["build-system", "shared-tools"],
  "task-graph": ["build-system", "shared-tools"],
  "test-evidence": ["build-system", "index-runtime", "shared-tools"]
});

const contract = (
  checkId: string,
  inputTags: readonly GateImpactTag[]
): GateCheckImpactContract => ({
  checkId,
  inputTags,
  version: "1"
});

const packageContracts = [
  contract("script:test:environment", [
    "environment",
    "shared-tools",
    "skill-release"
  ]),
  contract("script:test:index-runtime", ["index-runtime"]),
  contract("script:test:check", ["global"]),
  contract("script:test:skill-updater", ["skill-updater", "skill-release"]),
  contract("script:test:skill-validator", ["skill-validator"]),
  contract("script:test:relation-graph", ["shared-tools"]),
  contract("script:test:file-text-search", ["shared-tools"]),
  contract("script:test:skill-release-publisher", ["skill-release"]),
  contract("script:test:test-evidence-project", ["test-evidence"]),
  contract("script:typecheck", ["maintained-code"]),
  contract("script:lint", ["maintained-code"]),
  contract("script:validate", [
    "shared-tools",
    "skill-release",
    "skill-validator",
    "skills"
  ]),
  contract("script:check:investigations", ["investigation-report"]),
  contract("script:check:decisions", ["decision-records"]),
  contract("script:check:test-evidence-cli", ["test-evidence"]),
  contract("script:check:test-evidence-catalog", [
    "maintained-code",
    "skills",
    "test-evidence"
  ]),
  contract("script:check:skill-validator", ["skill-validator"]),
  contract("script:check:investigation-report-check", ["investigation-report"]),
  contract("script:check:change-plan-cli", ["change-plan"]),
  contract("script:check:decision-records-cli", ["decision-records"]),
  contract("script:check:task-graph-cli", ["task-graph"]),
  contract("script:check:skill-updaters", ["skill-release", "skill-updater"]),
  contract("script:test:generated-file", ["build-system", "shared-tools"]),
  contract("script:format:check", ["maintained-code"]),
  contract("script:check:task-graph-index", ["task-graph"])
] as const;

const nativeContracts = [
  contract("duplicate-detection", ["maintained-code"]),
  contract("secret-detection", ["secret-surface"]),
  contract("json-validation", ["json"]),
  contract("json-schema-validation", ["task-graph", "test-evidence"]),
  contract("markdown-link-validation", ["markdown", "path-inventory"]),
  contract("file-metrics", ["maintained-code"]),
  contract("function-metrics", ["maintained-code"])
] as const;

const semanticContracts = semanticGateChecks
  .filter(({ requiredTag }) => requiredTag === undefined)
  .map(({ checkId }) => contract(checkId, ["change-plan"]));

export const baseGateImpactContracts = Object.freeze([
  ...nativeContracts,
  ...packageContracts,
  ...semanticContracts
]);

export const baseGateCheckIds = Object.freeze(
  baseGateImpactContracts.map(({ checkId }) => checkId)
);

const releaseGateCheckIds = Object.freeze([
  releaseSnapshotCheckId,
  ...vibeNativeCheckIds,
  ...releaseRequiredPackageScripts.map(packageScriptCheckId),
  ...semanticGateChecks.map(({ checkId }) => checkId),
  releaseVersionCheckId,
  packSkillsCheckId
]);

const receiptFileName = "receipts.json";

function sha256(values: readonly (Buffer | string)[]): string {
  const hash = createHash("sha256");
  for (const value of values) hash.update(value);
  return hash.digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function addTag(tags: Set<GateImpactTag>, tag: GateImpactTag): void {
  tags.add(tag);
}

function ownerTagForName(value: string | undefined): GateImpactTag | null {
  switch (value) {
    case "change-plan":
    case "decision-records":
    case "index-runtime":
    case "investigation-report":
    case "skill-updater":
    case "skill-updaters":
    case "skill-validator":
    case "task-graph":
    case "test-evidence":
      return value === "skill-updaters" ? "skill-updater" : value;
    default:
      return null;
  }
}

function documentationOwnerTag(
  second: string | undefined,
  third: string | undefined
): GateImpactTag {
  switch (second) {
    case "decisions":
      return "decision-records";
    case "investigations":
      return "investigation-report";
    case "skills":
      return ownerTagForName(third) ?? "skills";
    case "task-graph":
      return "task-graph";
    case "test-evidence":
      return "test-evidence";
    default:
      return "documentation";
  }
}

function toolOwnerTag(second: string | undefined): GateImpactTag | null {
  switch (second) {
    case "index-runtime":
      return "index-runtime";
    case "mcpshell-workspace-bridge":
      return "global";
    case "shared":
      return "shared-tools";
    case "skill-package":
      return "skill-release";
    default:
      return ownerTagForName(second);
  }
}

const scriptOwnerRules = [
  {
    matches: (relativePath: string) =>
      relativePath.includes("vibe-check") ||
      relativePath.includes("vibe-gate") ||
      relativePath === "scripts/lib/project.ts",
    tag: "global"
  },
  {
    matches: (relativePath: string) =>
      ["environment", "auto-push", "project-config", "setup-"].some((name) =>
        relativePath.includes(name)
      ),
    tag: "environment"
  },
  {
    matches: (relativePath: string) =>
      relativePath.includes("generated-") ||
      relativePath === "scripts/lib/oxc-config.ts" ||
      relativePath === "scripts/lib/source-map.ts" ||
      relativePath === "scripts/lint.ts",
    tag: "build-system"
  },
  {
    matches: (relativePath: string) =>
      ["skill-package", "pack-skills", "publish-skills", "hash-skills"].some(
        (name) => relativePath.includes(name)
      ),
    tag: "skill-release"
  },
  {
    matches: (relativePath: string) => relativePath.includes("task-graph"),
    tag: "task-graph"
  },
  {
    matches: (relativePath: string) => relativePath.includes("validat"),
    tag: "skill-validator"
  }
] as const satisfies readonly Readonly<{
  matches: (relativePath: string) => boolean;
  tag: GateImpactTag;
}>[];

function scriptOwnerTag(
  relativePath: string,
  second: string | undefined,
  third: string | undefined
): GateImpactTag | null {
  if (second === "test-evidence") return "test-evidence";
  if (second === "build") {
    return ownerTagForName(third?.split(".")[0]) ?? "global";
  }
  return (
    scriptOwnerRules.find(({ matches }) => matches(relativePath))?.tag ?? null
  );
}

function ownerTagForPath(relativePath: string): GateImpactTag | null {
  const [topLevel, second, third] = relativePath.split("/");
  switch (topLevel) {
    case ".codegraph":
    case ".codex":
    case ".github":
      return "global";
    case ".githooks":
      return "environment";
    case "AGENTS.md":
    case "README.md":
      return "documentation";
    case "changes":
      return "change-plan";
    case "docs":
      return documentationOwnerTag(second, third);
    case "scripts":
      return scriptOwnerTag(relativePath, second, third);
    case "skills":
      return ownerTagForName(second) ?? "skills";
    case "tools":
      return toolOwnerTag(second);
    default:
      return null;
  }
}

function isRootConfiguration(relativePath: string): boolean {
  return (
    relativePath.startsWith(".github/") ||
    relativePath === ".gitattributes" ||
    relativePath === ".gitignore" ||
    relativePath === ".oxfmtrc.json" ||
    relativePath === ".oxlintrc.json" ||
    relativePath === "package.json" ||
    relativePath === "pnpm-lock.yaml" ||
    relativePath === "pnpm-workspace.yaml" ||
    relativePath === "skills.code-workspace" ||
    relativePath === "tsconfig.json"
  );
}

function isMaintainedCode(relativePath: string): boolean {
  return (
    (relativePath.startsWith("scripts/") ||
      relativePath.startsWith("tools/")) &&
    /\.(?:js|ts)$/u.test(relativePath)
  );
}

function isSecretSurface(relativePath: string): boolean {
  return (
    /\.(?:code-workspace|example|html|js|json|jsonl|md|mjs|mts|rules|toml|ts|txt|yaml|yml)$/u.test(
      relativePath
    ) ||
    relativePath === ".gitattributes" ||
    relativePath === ".gitignore" ||
    relativePath.startsWith(".githooks/")
  );
}

export function impactTagsForPath(relativePath: string): Readonly<{
  tags: readonly GateImpactTag[];
  unclassified: boolean;
}> {
  const tags = new Set<GateImpactTag>();
  const ownerTag = ownerTagForPath(relativePath);
  addTag(tags, "path-inventory");
  if (ownerTag !== null) addTag(tags, ownerTag);
  if (relativePath.startsWith("skills/")) addTag(tags, "skills");
  if (isRootConfiguration(relativePath)) addTag(tags, "global");
  if (relativePath.startsWith(".githooks/")) addTag(tags, "environment");
  if (relativePath === "AGENTS.md" || relativePath === "README.md") {
    addTag(tags, "documentation");
  }
  if (isMaintainedCode(relativePath)) addTag(tags, "maintained-code");
  if (relativePath.endsWith(".md")) addTag(tags, "markdown");
  if (relativePath.endsWith(".json")) addTag(tags, "json");
  if (isSecretSurface(relativePath)) addTag(tags, "secret-surface");
  const unclassified = ownerTag === null && !isRootConfiguration(relativePath);
  if (unclassified) addTag(tags, "global");
  return { tags: [...tags].sort(compareText), unclassified };
}

async function captureCommand(
  command: string,
  arguments_: readonly string[],
  cwd: string
): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let totalBytes = 0;
    const append = (target: Buffer[], chunk: Buffer): void => {
      totalBytes += chunk.byteLength;
      if (totalBytes > 16_777_216) {
        child.kill();
        reject(new Error(`${command} output exceeded the Gate capture limit`));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => append(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => append(stderr, chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }
      reject(
        new Error(
          `${command} ${arguments_.join(" ")} exited with ${String(code)}: ${Buffer.concat(stderr).toString("utf8").trim()}`
        )
      );
    });
  });
}

async function commandIdentity(
  runCommand: CommandCapture,
  command: string,
  arguments_: readonly string[],
  workspaceRoot: string
): Promise<string> {
  return sha256([await runCommand(command, arguments_, workspaceRoot)]);
}

async function toolchainFingerprint(
  workspaceRoot: string,
  dependencies: CaptureDependencies
): Promise<string> {
  const runCommand = dependencies.captureCommand ?? captureCommand;
  const environment = dependencies.environment ?? process.env;
  const environmentDigest = sha256([
    JSON.stringify(
      Object.entries(environment)
        .filter(([name]) => !shellBookkeepingEnvironmentNames.has(name))
        .map(([name, value]) => [name, value ?? null] as const)
        .sort(([left], [right]) => compareText(left, right))
    )
  ]);
  const [bunToolchain, gitConfiguration, gitVersion, sccVersion] =
    await Promise.all([
      (async () => ({
        astGrepVersion: await commandIdentity(
          runCommand,
          "bun",
          ["x", "--no-install", "ast-grep", "--version"],
          workspaceRoot
        ),
        bunDependencyState: await commandIdentity(
          runCommand,
          "bun",
          ["pm", "ls", "--all"],
          workspaceRoot
        ),
        bunVersion: await commandIdentity(
          runCommand,
          "bun",
          ["--version"],
          workspaceRoot
        ),
        oxfmtVersion: await commandIdentity(
          runCommand,
          "bun",
          ["x", "--no-install", "oxfmt", "--version"],
          workspaceRoot
        ),
        oxlintVersion: await commandIdentity(
          runCommand,
          "bun",
          ["x", "--no-install", "oxlint", "--version"],
          workspaceRoot
        ),
        tsgoVersion: await commandIdentity(
          runCommand,
          "bun",
          ["x", "--no-install", "tsgo", "--version"],
          workspaceRoot
        )
      }))(),
      commandIdentity(
        runCommand,
        "git",
        ["config", "--null", "--list"],
        workspaceRoot
      ),
      commandIdentity(runCommand, "git", ["--version"], workspaceRoot),
      commandIdentity(runCommand, "scc", ["--version"], workspaceRoot)
    ]);
  return sha256([
    JSON.stringify({
      arch: process.arch,
      ...bunToolchain,
      environmentDigest,
      execPath: process.execPath,
      gitConfiguration,
      gitVersion,
      node: process.versions.node,
      platform: process.platform,
      sccVersion
    })
  ]);
}

async function readSnapshotFile(
  workspaceRoot: string,
  relativePath: string,
  reserveBytes: (size: number) => void
): Promise<GateWorkspaceFile> {
  const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
  const impact = impactTagsForPath(relativePath);
  try {
    const status = await fs.lstat(absolutePath);
    const mode = status.mode & 0o777;
    if (status.isFile()) {
      reserveBytes(status.size);
      const contents = await fs.readFile(absolutePath);
      if (contents.byteLength > status.size) {
        reserveBytes(contents.byteLength - status.size);
      }
      return {
        digest: sha256([contents]),
        kind: "file",
        mode,
        path: relativePath,
        size: contents.byteLength,
        tags: impact.tags
      };
    }
    if (status.isSymbolicLink()) {
      return {
        digest: sha256([await fs.readlink(absolutePath)]),
        kind: "symlink",
        mode,
        path: relativePath,
        size: 0,
        tags: impact.tags
      };
    }
    return {
      digest: sha256(["unsupported"]),
      kind: "unsupported",
      mode,
      path: relativePath,
      size: 0,
      tags: [...new Set([...impact.tags, "global" as const])].sort(compareText)
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        digest: sha256(["missing"]),
        kind: "missing",
        mode: null,
        path: relativePath,
        size: 0,
        tags: impact.tags
      };
    }
    throw error;
  }
}

function parseGitPaths(output: Buffer): readonly string[] {
  const decoded = output.toString("utf8");
  if (!Buffer.from(decoded, "utf8").equals(output)) {
    throw new Error("Git returned a path list that is not valid UTF-8");
  }
  const paths = decoded.split("\0").filter((value) => value.length > 0);
  if (paths.length > maximumSnapshotFileCount) {
    throw new Error("Gate snapshot file count exceeded its safety limit");
  }
  if (
    paths.some(
      (relativePath) =>
        path.posix.isAbsolute(relativePath) ||
        path.win32.isAbsolute(relativePath) ||
        relativePath.split("/").some((segment) => segment === "..")
    )
  ) {
    throw new Error("Git returned a path outside the Gate workspace");
  }
  return [...new Set(paths)].sort(compareText);
}

async function readSnapshotFiles(
  workspaceRoot: string,
  relativePaths: readonly string[]
): Promise<readonly GateWorkspaceFile[]> {
  const files: GateWorkspaceFile[] = [];
  let reservedBytes = 0;
  const reserveBytes = (size: number): void => {
    reservedBytes += size;
    if (reservedBytes > maximumSnapshotBytes) {
      throw new Error("Gate snapshot byte count exceeded its safety limit");
    }
  };
  for (let offset = 0; offset < relativePaths.length; offset += 32) {
    const batch = relativePaths.slice(offset, offset + 32);
    const captured = await Promise.all(
      batch.map(async (relativePath) => {
        return await readSnapshotFile(
          workspaceRoot,
          relativePath,
          reserveBytes
        );
      })
    );
    files.push(...captured);
  }
  return files;
}

function digestFileIdentities(files: readonly GateWorkspaceFile[]): string {
  return sha256(
    files.flatMap((file) => [
      file.path,
      "\0",
      file.kind,
      "\0",
      String(file.mode),
      "\0",
      String(file.size),
      "\0",
      file.digest,
      "\0"
    ])
  );
}

function digestPathIdentities(files: readonly GateWorkspaceFile[]): string {
  return sha256(
    files.flatMap((file) => [
      file.path,
      "\0",
      file.kind,
      "\0",
      file.kind === "symlink" ? file.digest : "",
      "\0"
    ])
  );
}

export async function captureGateWorkspaceSnapshot(
  workspaceRoot: string = rootDir,
  dependencies: CaptureDependencies = {}
): Promise<GateWorkspaceSnapshot> {
  const runCommand = dependencies.captureCommand ?? captureCommand;
  const relativePaths = parseGitPaths(
    await runCommand(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      workspaceRoot
    )
  );
  const [files, toolchain] = await Promise.all([
    readSnapshotFiles(workspaceRoot, relativePaths),
    toolchainFingerprint(workspaceRoot, dependencies)
  ]);
  const tagDigests = Object.fromEntries(
    allImpactTags.map((tag) => [
      tag,
      tag === "path-inventory"
        ? digestPathIdentities(files)
        : digestFileIdentities(files.filter((file) => file.tags.includes(tag)))
    ])
  ) as Record<GateImpactTag, string>;
  const unclassifiedPaths = files
    .filter(({ path: filePath }) => impactTagsForPath(filePath).unclassified)
    .map(({ path: filePath }) => filePath);
  return {
    files,
    tagDigests,
    toolchainFingerprint: toolchain,
    unclassifiedPaths,
    workspaceFingerprint: sha256([
      gateImpactContractVersion,
      toolchain,
      digestFileIdentities(files)
    ])
  };
}

function effectiveTagsForContract(
  contract_: GateCheckImpactContract
): readonly GateImpactTag[] {
  const effective = new Set<GateImpactTag>(["global"]);
  const visit = (tag: GateImpactTag): void => {
    if (effective.has(tag)) return;
    effective.add(tag);
    for (const dependency of tagDependencies[tag] ?? []) visit(dependency);
  };
  for (const tag of contract_.inputTags) visit(tag);
  return [...effective].sort(compareText);
}

export function gateCheckInputFingerprint(
  contract_: GateCheckImpactContract,
  snapshot: GateWorkspaceSnapshot
): string {
  return sha256([
    JSON.stringify({
      checkId: contract_.checkId,
      contractVersion: gateImpactContractVersion,
      inputs: effectiveTagsForContract(contract_).map((tag) => [
        tag,
        snapshot.tagDigests[tag]
      ]),
      toolchainFingerprint: snapshot.toolchainFingerprint,
      version: contract_.version
    })
  ]);
}

function isReceipt(value: unknown): value is GateReceipt {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).sort().join(",") === "checkId,fingerprint,outcome" &&
    typeof record.checkId === "string" &&
    typeof record.fingerprint === "string" &&
    /^[a-f0-9]{64}$/u.test(record.fingerprint) &&
    record.outcome === "passed"
  );
}

function parseReceiptManifest(value: unknown): GateReceiptManifest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !==
      "contractVersion,formatVersion,receipts" ||
    record.contractVersion !== gateImpactContractVersion ||
    record.formatVersion !== receiptFormatVersion ||
    !Array.isArray(record.receipts) ||
    !record.receipts.every(isReceipt)
  ) {
    return null;
  }
  const receipts = record.receipts as GateReceipt[];
  if (
    new Set(receipts.map(({ checkId }) => checkId)).size !== receipts.length
  ) {
    return null;
  }
  return {
    contractVersion: gateImpactContractVersion,
    formatVersion: receiptFormatVersion,
    receipts
  };
}

async function readReceiptManifest(cacheDirectory: string): Promise<
  Readonly<{
    manifest: GateReceiptManifest | null;
    state: "invalid" | "missing" | "valid";
  }>
> {
  try {
    const parsed: unknown = JSON.parse(
      await fs.readFile(path.join(cacheDirectory, receiptFileName), "utf8")
    );
    const manifest = parseReceiptManifest(parsed);
    return manifest === null
      ? { manifest: null, state: "invalid" }
      : { manifest, state: "valid" };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { manifest: null, state: "missing" };
    }
    return { manifest: null, state: "invalid" };
  }
}

function baseDependencyMap(): ReadonlyMap<string, readonly string[]> {
  return new Map(
    semanticGateChecks
      .filter(({ requiredTag }) => requiredTag === undefined)
      .map(
        (check) =>
          [check.checkId, "dependsOn" in check ? check.dependsOn : []] as const
      )
  );
}

function closeRequiredDependencies(
  decisions: readonly GateActivationDecision[]
): readonly GateActivationDecision[] {
  const byCheckId = new Map(
    decisions.map((decision) => [decision.checkId, decision])
  );
  const dependencies = baseDependencyMap();
  const visit = (checkId: string): void => {
    for (const dependency of dependencies.get(checkId) ?? []) {
      const decision = byCheckId.get(dependency);
      if (decision?.action === "reuse") {
        byCheckId.set(dependency, {
          ...decision,
          action: "execute",
          reason: "dependency-required"
        });
      }
      visit(dependency);
    }
  };
  for (const decision of decisions) {
    if (decision.action === "execute") visit(decision.checkId);
  }
  return decisions.map(
    (decision) => byCheckId.get(decision.checkId) ?? decision
  );
}

function releasePlan(cacheDirectory: string): GateActivationPlan {
  const decisions = releaseGateCheckIds.map((checkId) => ({
    action: "execute" as const,
    checkId,
    fingerprint: null,
    reason: "release-full" as const
  }));
  return {
    activeCheckIds: releaseGateCheckIds,
    cacheDirectory,
    decisions,
    kind: "release",
    snapshot: null
  };
}

function fallbackPlan(
  cacheDirectory: string,
  detail: string
): GateActivationPlan {
  return {
    activeCheckIds: baseGateCheckIds,
    cacheDirectory,
    decisions: baseGateCheckIds.map((checkId) => ({
      action: "execute" as const,
      checkId,
      fingerprint: null,
      reason: "snapshot-unavailable" as const
    })),
    fallbackDetail: detail,
    kind: "fallback",
    snapshot: null
  };
}

export async function prepareGateActivation(
  options: PrepareGateActivationOptions
): Promise<GateActivationPlan> {
  const workspaceRoot = options.workspaceRoot ?? rootDir;
  const cacheDirectory =
    options.cacheDirectory ??
    path.join(workspaceRoot, ".log/vibe-check/cache/incremental-gate-v2");
  if (options.release) {
    return releasePlan(cacheDirectory);
  }
  let snapshot: GateWorkspaceSnapshot;
  try {
    snapshot = await captureGateWorkspaceSnapshot(
      workspaceRoot,
      options.captureDependencies
    );
  } catch (error) {
    return fallbackPlan(
      cacheDirectory,
      operationErrorDetail(error) ?? "workspace snapshot failed"
    );
  }
  const receiptRead = await readReceiptManifest(cacheDirectory);
  const receipts = new Map(
    receiptRead.manifest?.receipts.map((receipt) => [
      receipt.checkId,
      receipt
    ]) ?? []
  );
  const rawDecisions = baseGateImpactContracts.map((contract_) => {
    const fingerprint = gateCheckInputFingerprint(contract_, snapshot);
    const receipt = receipts.get(contract_.checkId);
    if (receipt?.fingerprint === fingerprint) {
      return {
        action: "reuse" as const,
        checkId: contract_.checkId,
        fingerprint,
        reason: "unchanged-success" as const
      };
    }
    const reason: GateActivationReason =
      receiptRead.state === "invalid"
        ? "cache-invalid"
        : receipt === undefined
          ? "first-run"
          : snapshot.unclassifiedPaths.length > 0
            ? "conservative-fallback"
            : "inputs-changed";
    return {
      action: "execute" as const,
      checkId: contract_.checkId,
      fingerprint,
      reason
    };
  });
  const decisions = closeRequiredDependencies(rawDecisions);
  return {
    activeCheckIds: decisions
      .filter(({ action }) => action === "execute")
      .map(({ checkId }) => checkId),
    cacheDirectory,
    decisions,
    kind: "incremental",
    snapshot
  };
}

export function activationFlagForCheck(checkId: string): string {
  return `gate-activation:${checkId}`;
}

export function gateActivationFlags(
  plan: GateActivationPlan
): readonly string[] {
  return plan.activeCheckIds.map(activationFlagForCheck);
}

async function writeReceiptManifest(
  cacheDirectory: string,
  receipts: readonly GateReceipt[]
): Promise<void> {
  await fs.mkdir(cacheDirectory, { recursive: true });
  const target = path.join(cacheDirectory, receiptFileName);
  const temporary = path.join(
    cacheDirectory,
    `.${receiptFileName}.${process.pid}.${randomUUID()}.tmp`
  );
  const manifest: GateReceiptManifest = {
    contractVersion: gateImpactContractVersion,
    formatVersion: receiptFormatVersion,
    receipts
  };
  try {
    await fs.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {
      mode: 0o600
    });
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function publishGateReceipts(
  plan: GateActivationPlan,
  passedCheckIds: ReadonlySet<string>,
  workspaceRoot: string = rootDir,
  captureDependencies: CaptureDependencies = {}
): Promise<GateReceiptPublication> {
  if (plan.kind !== "incremental") {
    return { published: false, reason: "not-incremental" };
  }
  if (
    plan.decisions.some(
      ({ action, checkId }) =>
        action === "execute" && !passedCheckIds.has(checkId)
    )
  ) {
    return { published: false, reason: "check-not-passed" };
  }
  let finalSnapshot: GateWorkspaceSnapshot;
  try {
    finalSnapshot = await captureGateWorkspaceSnapshot(
      workspaceRoot,
      captureDependencies
    );
  } catch (error) {
    return {
      detail: operationErrorDetail(error) ?? "final workspace snapshot failed",
      published: false,
      reason: "snapshot-unavailable"
    };
  }
  if (
    finalSnapshot.workspaceFingerprint !== plan.snapshot.workspaceFingerprint
  ) {
    return { published: false, reason: "workspace-drift" };
  }
  const receipts = plan.decisions
    .filter(
      (
        decision
      ): decision is GateActivationDecision & { fingerprint: string } =>
        decision.fingerprint !== null
    )
    .map(({ checkId, fingerprint }) => ({
      checkId,
      fingerprint,
      outcome: "passed" as const
    }))
    .sort((left, right) => compareText(left.checkId, right.checkId));
  try {
    await writeReceiptManifest(plan.cacheDirectory, receipts);
    return { published: true, receiptCount: receipts.length };
  } catch (error) {
    return {
      detail: operationErrorDetail(error) ?? "receipt publication failed",
      published: false,
      reason: "publication-failed"
    };
  }
}

export function validateBaseGateImpactContracts(): readonly string[] {
  const expected = [
    ...vibeNativeCheckIds,
    ...releaseRequiredPackageScripts
      .filter((script) => !isReleaseOnlyGatePackageScript(script))
      .map(packageScriptCheckId),
    ...semanticGateChecks
      .filter(({ requiredTag }) => requiredTag === undefined)
      .map(({ checkId }) => checkId)
  ].sort(compareText);
  const actual = [...baseGateCheckIds].sort(compareText);
  return expected.length === actual.length &&
    expected.every((checkId, index) => checkId === actual[index])
    ? []
    : [
        "base Gate impact contracts do not exactly cover the base Check catalog"
      ];
}
