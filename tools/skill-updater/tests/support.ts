import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { zipSync } from "fflate";
import {
  runSkillUpdaterCli,
  skillUpdaterConfig
} from "../../../skills/ai-ready-docs/scripts/update-skill.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(testsDirectory, "../../..");
export const skillName = "ai-ready-docs";
export const generatedUpdaterPath = path.join(
  rootDir,
  "skills",
  skillName,
  "scripts",
  "update-skill.ts"
);

const manifestAssetUrl = "https://example.test/skill-release-manifest.json";
const zipAssetUrl = `https://example.test/${skillName}.zip`;
export const validRelease = {
  assets: [
    { name: "skill-release-manifest.json", url: manifestAssetUrl },
    { name: `${skillName}.zip`, url: zipAssetUrl }
  ],
  html_url: "https://example.test/releases/review",
  tag_name: "review"
};

type UpdaterRunOptions = Readonly<{
  args: readonly string[];
  env?: Readonly<NodeJS.ProcessEnv>;
  fetchMarkerPath?: string;
  updaterPath?: string;
  useDefaultTarget?: boolean;
  manifest: unknown;
  release: unknown;
  targetDir: string;
  zipData: Uint8Array;
}>;

export function skillMarkdown(
  version: number,
  body: string,
  name: string = skillName
): string {
  return [
    "---",
    `name: ${name}`,
    "description: AI-ready docs test skill",
    "metadata:",
    `  version: "${version}"`,
    "---",
    "",
    body,
    ""
  ].join("\n");
}

export function runUpdater(
  mockFetchPath: string,
  options: UpdaterRunOptions
): SpawnSyncReturns<string> {
  const result = spawnSync(
    "node",
    [
      "--import",
      pathToFileURL(mockFetchPath).href,
      options.updaterPath ?? generatedUpdaterPath,
      ...options.args,
      ...(options.useDefaultTarget ? [] : ["--target-dir", options.targetDir])
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_TOKEN: "fixture-updater-token",
        GH_TOKEN: "",
        SKILLS_TEST_AUTH_LOG: "",
        ...options.env,
        SKILLS_TEST_FETCH_MARKER_PATH: options.fetchMarkerPath ?? "",
        SKILLS_TEST_MANIFEST_JSON: JSON.stringify(options.manifest),
        SKILLS_TEST_RELEASE_JSON: JSON.stringify(options.release),
        SKILLS_TEST_ZIP_BASE64: Buffer.from(options.zipData).toString("base64")
      }
    }
  );

  if (result.error) {
    throw result.error;
  }
  return result;
}

export const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "skill-updater-test-")
);
after(async () => {
  await fs.rm(tempRoot, { force: true, recursive: true });
});

export const mockFetchPath = path.join(
  testsDirectory,
  "fixtures/mock-fetch.ts"
);

export const remoteSkillMarkdown = skillMarkdown(2, "# Updated AI-ready docs");
const remoteFiles = [
  {
    data: Buffer.from(remoteSkillMarkdown, "utf8"),
    path: "SKILL.md"
  },
  {
    data: Buffer.from("# Current reference\n", "utf8"),
    path: "references/current.md"
  }
];
export const zipData = zipSync(
  Object.fromEntries(
    remoteFiles.map((file) => [`${skillName}/${file.path}`, file.data])
  )
);
export const validManifest = {
  schemaVersion: 1,
  skills: {
    [skillName]: { version: 2 }
  }
} as const;

export async function copyUpdaterSkill(target: string): Promise<void> {
  await fs.cp(path.join(rootDir, "skills", skillName), target, {
    recursive: true,
    filter: (source) => path.basename(source) !== "node_modules"
  });
}

export async function sourcePackageZip(target: string): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  for (const relative of await fs.readdir(target, { recursive: true })) {
    const source = path.join(target, relative);
    if (!(await fs.lstat(source)).isFile()) continue;
    entries[`${skillName}/${relative.replaceAll("\\", "/")}`] =
      await fs.readFile(source);
  }
  entries[`${skillName}/SKILL.md`] = Buffer.from(remoteSkillMarkdown);
  return zipSync(entries);
}

export { runSkillUpdaterCli, skillUpdaterConfig };
