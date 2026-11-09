import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { candidateLock } from "./candidate-lock.ts";
import { buildSourceRuntimeArtifacts } from "../generation/runtime/source-runtime.ts";
import {
  nativeSkillGitIgnorePatterns,
  nativeUpdaterEntry,
  nativeUpdaterResources
} from "../generation/native-updater-entry.ts";
import { readSkillPackageIdentityFromMarkdown } from "../../../tools/skill-package/src/version.ts";
import {
  nativeRoles,
  nativeTargets,
  type NativeRole
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import { prepareCandidateSourcePackages } from "./candidate-package.ts";
import { digestNativeSource } from "./capture.ts";
import type { SkillPackageFile } from "../skill-package/skill-package-hash.ts";

const root = process.cwd();
const encoded = v.object({ path: v.string(), data: v.string() });
const inputSchema = v.object({
  formal: v.optional(v.boolean()),
  runtimeVersion: v.string(),
  sourceHash: v.string(),
  deliveryHash: v.string(),
  source: v.array(encoded),
  delivery: v.array(encoded),
  skills: v.object({
    "decision-records": v.array(encoded),
    "investigation-report": v.array(encoded)
  })
});
type Encoded = v.InferOutput<typeof encoded>;
type Input = v.InferOutput<typeof inputSchema>;
function decode(files: Encoded[]): SkillPackageFile[] {
  return files.map((file) => ({
    path: file.path,
    data: Buffer.from(file.data, "base64")
  }));
}
function required(files: readonly SkillPackageFile[], name: string): Buffer {
  const item = files.find((file) => file.path === name);
  if (!item) throw new Error(`frozen candidate input missing: ${name}`);
  return item.data;
}
async function generated(
  role: NativeRole,
  bootstrap: boolean
): Promise<SkillPackageFile[]> {
  const skillName = bootstrap ? `${role}-installer` : role;
  const artifacts = await buildSourceRuntimeArtifacts({
    workspaceRoot: root,
    skillName,
    entries: [nativeUpdaterEntry(role, bootstrap)],
    rebuildCommand: "private native candidate generation",
    nodeEngine: ">=24.18",
    additionalGitIgnorePatterns: bootstrap ? [] : nativeSkillGitIgnorePatterns,
    resources: nativeUpdaterResources
  });
  return artifacts.map((artifact) => ({
    path: path
      .relative(path.join(root, "skills", skillName), artifact.path)
      .replaceAll("\\", "/"),
    data: Buffer.from(artifact.content)
  }));
}
async function prepareRole(
  input: Input,
  role: NativeRole,
  delivery: readonly SkillPackageFile[],
  original: SkillPackageFile[]
) {
  const skillInputHash = digestNativeSource(original);
  const identity = readSkillPackageIdentityFromMarkdown(
    required(original, "SKILL.md").toString("utf8")
  );
  if (identity.name !== role || identity.version === null)
    throw new Error(`invalid frozen skill identity: ${role}`);
  const schemaName =
    role === "decision-records"
      ? "decision-index.schema.json"
      : "investigation-index.schema.json";
  const schema = required(
    delivery,
    `tools/record-contracts/schemas/${schemaName}`
  );
  const runtime = await generated(role, false);
  const lock = candidateLock(
    required(runtime, "package.json"),
    required(original, "pnpm-lock.yaml")
  );
  const files = input.formal
    ? original
    : [
        ...runtime,
        { path: "pnpm-lock.yaml", data: lock },
        { path: `references/${schemaName}`, data: schema },
        {
          path: "native-runtime.json",
          data: Buffer.from(
            `${JSON.stringify({ schemaVersion: 1, role, runtimeVersion: input.runtimeVersion, sourceHash: input.sourceHash, targets: nativeTargets }, null, 2)}\n`
          )
        },
        {
          path: "SKILL.md",
          data: Buffer.from(
            `---\nname: ${role}\ndescription: Private native candidate for isolated verification only.\nmetadata:\n  version: "${identity.version + 1}"\n---\n\n# Private candidate: ${role}\n\n仅供隔离验收，不是正式 skill。使用安装后的原生程序 bin/${role}；运行 --help 查看命令。依赖须显式安装；业务不回退至 TypeScript。\n`
          )
        }
      ];
  return {
    files,
    schema,
    skillInputHash,
    installer: await generated(role, true)
  };
}
async function prepare(input: Input) {
  const source = decode(input.source),
    delivery = decode(input.delivery);
  const filesBySkill = new Map<string, SkillPackageFile[]>();
  const schemas = {} as Record<NativeRole, Buffer>;
  const skillInputHashes = {} as Record<NativeRole, string>;
  let bootstrap: SkillPackageFile[] = [];
  for (const role of nativeRoles) {
    const original = decode(input.skills[role]);
    const prepared = await prepareRole(input, role, delivery, original);
    filesBySkill.set(role, prepared.files);
    schemas[role] = prepared.schema;
    skillInputHashes[role] = prepared.skillInputHash;
    const { installer } = prepared;
    if (bootstrap.length === 0)
      bootstrap = [
        ...installer,
        {
          path: "pnpm-lock.yaml",
          data: candidateLock(
            required(installer, "package.json"),
            required(original, "pnpm-lock.yaml")
          )
        },
        {
          path: "README.md",
          data: Buffer.from(
            input.formal
              ? "# Native record installer\n\n显式安装 bootstrap 锁定依赖后，运行对应 scripts/<role>.ts，并指定 --target-dir 与 --release-tag。原生业务安装后可直接运行；独立目标 updater 使用前须在目标目录按自身 lock 显式安装依赖。\n"
              : "# Private native installer\n\n仅供隔离验收。显式安装 bootstrap 锁定依赖后，运行对应 scripts/<role>.ts，必须传入 --target-dir。原生业务安装后可直接运行；独立目标 updater 使用前须在目标目录按自身 lock 显式安装依赖。\n"
          )
        }
      ];
    else
      bootstrap.push({
        path: `scripts/${role}.ts`,
        data: required(installer, `scripts/${role}.ts`)
      });
  }
  const snapshot = {
    source,
    sourceHash: input.sourceHash,
    delivery,
    deliveryHash: input.deliveryHash,
    skills: {
      skills: nativeRoles.map((name) => ({
        name,
        directory: path.join(root, "skills", name)
      })),
      filesBySkill
    }
  };
  const result = prepareCandidateSourcePackages({
    snapshot,
    runtimeVersion: input.runtimeVersion,
    schemas,
    bootstrap: { files: bootstrap, entry: "scripts/decision-records.ts" }
  });
  const encode = (item: typeof result.bootstrap) => ({
    asset: item.asset,
    bytes: item.bytes.toString("base64")
  });
  return {
    sourceHash: input.sourceHash,
    deliveryHash: input.deliveryHash,
    skillInputHashes,
    versions: result.versions,
    packages: Object.fromEntries(
      nativeRoles.map((role) => [role, encode(result.packages[role])])
    ),
    bootstrap: encode(result.bootstrap)
  };
}
const rawInput: unknown = JSON.parse(
  await fs.readFile(path.join(root, "candidate-input.json"), "utf8")
);
const input = v.parse(inputSchema, rawInput);
await fs.writeFile(
  path.join(root, "candidate-output.json"),
  JSON.stringify(await prepare(input)),
  { flag: "wx" }
);
