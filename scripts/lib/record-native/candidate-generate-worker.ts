import fs from "node:fs/promises";
import path from "node:path";
import { candidateLock } from "./candidate-lock.ts";
import { buildSourceRuntimeArtifacts } from "../generation/runtime/source-runtime.ts";
import { githubRepository } from "../project.ts";
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
const sourcePath = "tools/skill-updater/src/native/cli.ts";
const modulePath = "./runtime/tools/skill-updater/src/native/cli.ts";
const resource = {
  sourcePath: "tools/skill-updater/src/native/legacy-manifests.json",
  outputPath:
    "scripts/runtime/tools/skill-updater/src/native/legacy-manifests.json"
};
type Encoded = { path: string; data: string };
type Input = {
  runtimeVersion: string;
  sourceHash: string;
  deliveryHash: string;
  source: Encoded[];
  delivery: Encoded[];
  skills: Record<NativeRole, Encoded[]>;
};
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
function entry(role: NativeRole, bootstrap: boolean): string {
  const config = {
    releaseAssetName: `${role}-native.zip`,
    releaseManifestAssetName: "skill-release-manifest.json",
    repo: githubRepository,
    skillName: role,
    sourcePath: `skills/${role}`
  };
  return `import { runNativeUpdaterCli } from ${JSON.stringify(modulePath)};
import { pathToFileURL } from "node:url";
import path from "node:path";
const config = ${JSON.stringify(config)};
export async function run(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  return await runNativeUpdaterCli(config, ${JSON.stringify(role)}, import.meta.url, argv, ${bootstrap});
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { process.exitCode = await run(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}`;
}
async function generated(
  role: NativeRole,
  bootstrap: boolean
): Promise<SkillPackageFile[]> {
  const skillName = bootstrap ? `${role}-installer` : role;
  const artifacts = await buildSourceRuntimeArtifacts({
    workspaceRoot: root,
    skillName,
    entries: [
      {
        sourcePath,
        outputName: bootstrap ? `${role}.ts` : "update-skill.ts",
        body: entry(role, bootstrap)
      }
    ],
    rebuildCommand: "private native candidate generation",
    nodeEngine: ">=24.18",
    resources: [resource]
  });
  return artifacts.map((artifact) => ({
    path: path
      .relative(path.join(root, "skills", skillName), artifact.path)
      .replaceAll("\\", "/"),
    data: Buffer.from(artifact.content)
  }));
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
    skillInputHashes[role] = digestNativeSource(original);
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
    schemas[role] = schema;
    const runtime = await generated(role, false);
    const lock = candidateLock(
      required(runtime, "package.json"),
      required(original, "pnpm-lock.yaml")
    );
    filesBySkill.set(role, [
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
    ]);
    const installer = await generated(role, true);
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
            "# Private native installer\n\n仅供隔离验收。显式安装 bootstrap 锁定依赖后，运行对应 scripts/<role>.ts，必须传入 --target-dir。原生业务安装后可直接运行；独立目标 updater 使用前须在目标目录按自身 lock 显式安装依赖。\n"
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
const input = JSON.parse(
  await fs.readFile(path.join(root, "candidate-input.json"), "utf8")
) as Input;
await fs.writeFile(
  path.join(root, "candidate-output.json"),
  JSON.stringify(await prepare(input)),
  { flag: "wx" }
);
