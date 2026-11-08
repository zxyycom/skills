import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as v from "valibot";
import { execute } from "../publishing/publish-skills-github.ts";
import type { LocalAsset } from "../publishing/publish-skills-types.ts";
import type {
  CandidatePublishAsset,
  CandidatePublishRemote
} from "./candidate-publish.ts";

const repository = "zxyycom/skills";
const githubRepository = `github.com/${repository}`;
const githubEnvironment = () => ({
  ...process.env,
  GH_HOST: "github.com",
  GH_REPO: githubRepository
});
const releaseSchema = v.object({
  tagName: v.string(),
  databaseId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  body: v.nullish(v.string()),
  assets: v.array(
    v.object({
      name: v.string(),
      size: v.pipe(v.number(), v.integer(), v.minValue(0)),
      digest: v.nullish(v.string())
    })
  )
});
function validTag(tag: string): boolean {
  return tag === "skills-latest" || /^skills-[a-f0-9]{12}$/.test(tag);
}
function requireTag(tag: string): void {
  if (!validTag(tag)) throw new Error("invalid release tag");
}
export function isExpectedOrigin(url: string): boolean {
  return /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)zxyycom\/skills(?:\.git)?$/i.test(
    url
  );
}
function checkOrigin(root: string): void {
  for (const args of [
    ["remote", "get-url", "--all", "origin"],
    ["remote", "get-url", "--push", "--all", "origin"]
  ]) {
    const result = spawnSync("git", args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    });
    const urls = result.stdout?.trim().split(/\r?\n/) ?? [];
    if (
      result.error ||
      result.status !== 0 ||
      urls.length !== 1 ||
      !isExpectedOrigin(urls[0]!)
    )
      throw new Error(
        `origin must point only to ${repository} for fetch and push`
      );
  }
}
function inspectRelease(root: string, tag: string) {
  const result = spawnSync(
    "gh",
    [
      "release",
      "view",
      tag,
      "--json",
      "tagName,assets,databaseId,body",
      "--repo",
      githubRepository
    ],
    { cwd: root, encoding: "utf8", windowsHide: true, env: githubEnvironment() }
  );
  if (result.error) throw new Error("cannot start GitHub release inspection");
  if (result.status !== 0) {
    if (
      /(?:release not found|HTTP 404|404 Not Found)/iu.test(
        `${result.stdout}\n${result.stderr}`
      )
    )
      return undefined;
    throw new Error(`cannot inspect GitHub release ${tag}`);
  }
  const parsed = v.safeParse(
    releaseSchema,
    JSON.parse(result.stdout) as unknown
  );
  if (!parsed.success || parsed.output.tagName !== tag)
    throw new Error(`invalid GitHub release ${tag}`);
  const names = new Set(parsed.output.assets.map((item) => item.name));
  if (names.size !== parsed.output.assets.length || names.has(""))
    throw new Error(`duplicate or empty release asset: ${tag}`);
  return {
    id: parsed.output.databaseId,
    notes: parsed.output.body ?? "",
    assets: parsed.output.assets.map((item) => ({
      name: item.name,
      size: item.size,
      digest: item.digest ?? null
    }))
  };
}
function runGithub(root: string, args: readonly string[], label: string): void {
  const result = spawnSync("gh", [...args], {
    cwd: root,
    env: githubEnvironment(),
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error || result.status !== 0) throw new Error(`${label} failed`);
}

async function withAssets<T>(
  assets: readonly CandidatePublishAsset[],
  action: (files: LocalAsset[]) => T
): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "native-release-"));
  try {
    const files: LocalAsset[] = [];
    for (const asset of assets) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(asset.name))
        throw new Error("invalid asset name");
      const file = path.join(dir, asset.name);
      await fs.writeFile(file, asset.bytes, { flag: "wx" });
      files.push({
        name: asset.name,
        path: file,
        size: asset.size,
        digest: asset.digest
      });
    }
    return action(files);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
/** Remote target is pinned; only the explicitly authorized rolling tag can move. */
export function candidateGithubRemote(root: string): CandidatePublishRemote {
  return {
    async readTag(tag) {
      requireTag(tag);
      checkOrigin(root);
      const ref = `refs/tags/${tag}`;
      const result = spawnSync("git", ["ls-remote", "--refs", "origin", ref], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true
      });
      if (result.error || result.status !== 0)
        throw new Error(`cannot inspect remote tag ${tag}`);
      const output = result.stdout.trim();
      if (!output) return undefined;
      const match =
        /^(?:([a-f0-9]{40}|[a-f0-9]{64}))\s+(refs\/tags\/[^\s]+)$/.exec(output);
      if (!match || match[2] !== ref)
        throw new Error(`invalid remote tag response: ${tag}`);
      return match[1];
    },
    async readRelease(tag) {
      requireTag(tag);
      return inspectRelease(root, tag)?.assets;
    },
    async readReleaseId(tag) {
      requireTag(tag);
      return inspectRelease(root, tag)?.id;
    },
    async readNotes(tag) {
      requireTag(tag);
      return inspectRelease(root, tag)?.notes;
    },
    async updateNotes(tag, notes) {
      if (tag !== "skills-latest")
        throw new Error("only rolling notes may be updated");
      runGithub(
        root,
        ["release", "edit", tag, "--repo", githubRepository, "--notes", notes],
        "Update rolling instructions"
      );
    },
    async readLatest() {
      const result = spawnSync(
        "gh",
        [
          "api",
          "--hostname",
          "github.com",
          `repos/${repository}/releases/latest`
        ],
        {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
          env: githubEnvironment()
        }
      );
      if (result.error)
        throw new Error("cannot start latest release inspection");
      if (result.status !== 0) {
        if (
          /(?:HTTP 404|404 Not Found)/iu.test(
            `${result.stdout}\n${result.stderr}`
          )
        )
          return undefined;
        throw new Error("cannot inspect latest GitHub release");
      }
      const parsed = v.safeParse(
        v.object({
          id: v.pipe(v.number(), v.integer(), v.minValue(1)),
          tag_name: v.string()
        }),
        JSON.parse(result.stdout) as unknown
      );
      if (!parsed.success) throw new Error("invalid latest GitHub release");
      return { id: parsed.output.id, tag: parsed.output.tag_name };
    },
    async markLatest() {
      runGithub(
        root,
        [
          "release",
          "edit",
          "skills-latest",
          "--latest",
          "--repo",
          githubRepository
        ],
        "Mark rolling release latest"
      );
    },
    async updateRollingTag(commit, old) {
      if (
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit) ||
        (old !== undefined && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(old))
      )
        throw new Error("invalid tag commit");
      checkOrigin(root);
      console.log(
        `Rolling tag recovery boundary: refs/tags/skills-latest old=${old ?? "(absent)"} target=${commit}; restore only after inspecting concurrent changes.`
      );
      execute(
        root,
        "git",
        [
          "push",
          `--force-with-lease=refs/tags/skills-latest:${old ?? ""}`,
          "origin",
          `${commit}:refs/tags/skills-latest`
        ],
        "Update rolling tag"
      );
    },
    async createRelease(tag, commit, assets, rolling, notes) {
      requireTag(tag);
      if (
        (rolling && tag !== "skills-latest") ||
        (!rolling && tag === "skills-latest") ||
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)
      )
        throw new Error("invalid release creation target");
      await withAssets(assets, (files) => {
        const args = [
          "release",
          "create",
          tag,
          "--repo",
          githubRepository,
          "--title",
          rolling ? "skills latest" : `skills snapshot ${tag.slice(7)}`,
          "--notes",
          notes,
          "--latest=false"
        ];
        if (rolling) args.push("--verify-tag");
        else args.push("--target", commit);
        args.push(...files.map((file) => file.path));
        runGithub(root, args, `Create ${tag}`);
      });
    },
    async upload(tag, asset, replace) {
      if (tag !== "skills-latest")
        throw new Error("only rolling assets may be uploaded");
      await withAssets([asset], (files) =>
        runGithub(
          root,
          [
            "release",
            "upload",
            "skills-latest",
            files[0]!.path,
            "--repo",
            githubRepository,
            ...(replace ? ["--clobber"] : [])
          ],
          `Upload ${asset.name}`
        )
      );
    },
    async deleteLegacy(name) {
      if (
        name !== "decision-records.zip" &&
        name !== "investigation-report.zip"
      )
        throw new Error("invalid legacy asset");
      runGithub(
        root,
        [
          "release",
          "delete-asset",
          "skills-latest",
          "--yes",
          "--repo",
          githubRepository,
          "--",
          name
        ],
        `Delete ${name}`
      );
    }
  };
}
