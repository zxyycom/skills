import { commit, hash, fixture } from "./candidate-publish-fixture.ts";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  candidateGithubRemote,
  isExpectedOrigin
} from "../candidate-publish-github.ts";
import {
  publishCandidateRelease,
  type CandidatePublishRemote
} from "../candidate-publish.ts";
import type { PublishedAsset } from "../../publishing/publish-skills-types.ts";

test("native candidate publishing verifies before retirement and recovers partial rolling state", async () => {
  assert.equal(isExpectedOrigin("https://github.com/zxyycom/skills.git"), true);
  assert.equal(isExpectedOrigin("git@github.com:zxyycom/skills.git"), true);
  assert.equal(
    isExpectedOrigin("https://token@github.com/zxyycom/skills.git"),
    false
  );
  assert.equal(isExpectedOrigin("https://github.com/other/skills.git"), false);
  const local = await fs.mkdtemp(
    path.join(os.tmpdir(), "native-publish-target-")
  );
  try {
    execFileSync("git", ["init", "-q", local]);
    execFileSync("git", [
      "-C",
      local,
      "remote",
      "add",
      "origin",
      "https://github.com/zxyycom/skills.git"
    ]);
    execFileSync("git", [
      "-C",
      local,
      "config",
      "url.https://else.invalid/.pushInsteadOf",
      "https://github.com/"
    ]);
    const effectivePush = execFileSync(
      "git",
      ["-C", local, "remote", "get-url", "--push", "--all", "origin"],
      { encoding: "utf8" }
    ).trim();
    assert.equal(isExpectedOrigin(effectivePush), false);
    if (process.platform !== "win32") {
      const fake = path.join(local, "gh"),
        log = path.join(local, "gh.log");
      await fs.writeFile(
        fake,
        `#!/bin/sh
printf '%s\n%s\n%s\n' "$GH_HOST" "$GH_REPO" "$*" > "$RECORD_FAKE_LOG"
if [ "$1" = "api" ]; then printf '%s' '{"tag_name":"skills-latest","id":17}'; else printf '%s' '{"tagName":"skills-latest","databaseId":17,"assets":[]}'; fi
`,
        { mode: 0o755 }
      );
      const previous = {
        PATH: process.env.PATH,
        GH_HOST: process.env.GH_HOST,
        GH_REPO: process.env.GH_REPO,
        RECORD_FAKE_LOG: process.env.RECORD_FAKE_LOG
      };
      try {
        process.env.PATH = `${local}${path.delimiter}${previous.PATH ?? ""}`;
        process.env.GH_HOST = "wrong.example";
        process.env.GH_REPO = "wrong/repo";
        process.env.RECORD_FAKE_LOG = log;
        assert.deepEqual(
          await candidateGithubRemote(local).readRelease("skills-latest"),
          []
        );
        const lines = (await fs.readFile(log, "utf8")).split("\n");
        assert.equal(lines[0], "github.com");
        assert.equal(lines[1], "github.com/zxyycom/skills");
        assert.match(lines[2]!, /--repo github\.com\/zxyycom\/skills/);
        assert.deepEqual(await candidateGithubRemote(local).readLatest(), {
          tag: "skills-latest",
          id: 17
        });
        const api = (await fs.readFile(log, "utf8")).split("\n");
        assert.match(
          api[2]!,
          /api --hostname github\.com repos\/zxyycom\/skills\/releases\/latest/
        );
      } finally {
        for (const [name, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      }
    }
  } finally {
    await fs.rm(local, { recursive: true, force: true });
  }
  const release = fixture();
  const calls: string[] = [];
  let tag: string | undefined = "c".repeat(40);
  let items: PublishedAsset[] | undefined = [
    { name: "decision-records.zip", size: 1, digest: null },
    { name: "investigation-report.zip", size: 1, digest: null },
    { name: "unrelated.zip", size: 1, digest: null }
  ];
  let failManifest = true;
  let latest = { tag: "other-release", id: 99 };
  let notes = "old notes";
  let refuseLatest = false;
  const remote: CandidatePublishRemote = {
    async readTag() {
      calls.push("tag");
      return tag;
    },
    async readRelease() {
      calls.push("read");
      return items?.slice();
    },
    async readReleaseId() {
      calls.push("release id");
      return items ? 17 : undefined;
    },
    async readNotes() {
      return items ? notes : undefined;
    },
    async updateNotes(_tag, value) {
      notes = value;
    },
    async readLatest() {
      calls.push("latest");
      return latest;
    },
    async markLatest() {
      calls.push("mark latest");
      if (!refuseLatest) latest = { tag: "skills-latest", id: 17 };
    },
    async updateRollingTag(target, old) {
      calls.push("update tag");
      assert.equal(tag, old);
      tag = target;
    },
    async createRelease(_tag, target, assets, _rolling, value) {
      calls.push("create");
      tag = target;
      notes = value;
      items = assets.map(({ name, size, digest }) => ({ name, size, digest }));
    },
    async upload(_tag, asset) {
      calls.push(`upload ${asset.name}`);
      if (asset.name === "skill-release-manifest.json" && failManifest) {
        failManifest = false;
        throw new Error("interrupted");
      }
      items = [
        ...(items ?? []).filter((item) => item.name !== asset.name),
        { name: asset.name, size: asset.size, digest: asset.digest }
      ];
    },
    async deleteLegacy(name) {
      calls.push(`delete ${name}`);
      items = items?.filter((item) => item.name !== name);
    }
  };
  const request = {
    release,
    commit,
    packageHash: hash,
    mode: "rolling" as const
  };
  const damaged = fixture();
  damaged.assets[0]!.bytes[0] = 0;
  assert.equal(
    (await publishCandidateRelease({ ...request, release: damaged }, remote))
      .status,
    "failed"
  );
  assert.equal(calls.length, 0);
  for (const provenance of [
    { ...release.provenance, pendingMatchesBase: false },
    { ...release.provenance, pendingBaseRevision: "e".repeat(40) }
  ]) {
    assert.match(
      (
        await publishCandidateRelease(
          { ...request, release: { ...release, provenance } },
          remote
        )
      ).error!,
      /pending inputs are not the publication commit/
    );
  }
  assert.equal(calls.length, 0);
  const privateRelease = fixture(true);
  assert.match(
    (
      await publishCandidateRelease(
        { ...request, release: privateRelease },
        remote
      )
    ).error!,
    /private candidate cannot be published/
  );
  assert.equal(calls.length, 0);
  const privateVersion = fixture(false, "0.1.0");
  assert.match(
    (
      await publishCandidateRelease(
        { ...request, release: privateVersion },
        remote
      )
    ).error!,
    /0.1.0 cannot be published/
  );
  const invalidSchema = fixture(false, "1.0.0", true);
  assert.equal(
    (
      await publishCandidateRelease(
        { ...request, release: invalidSchema },
        remote
      )
    ).status,
    "failed"
  );
  const swappedSchema = fixture();
  swappedSchema.schemas["decision-records"] =
    swappedSchema.schemas["investigation-report"];
  assert.match(
    (
      await publishCandidateRelease(
        { ...request, release: swappedSchema },
        remote
      )
    ).error!,
    /schema differs/
  );
  assert.equal(calls.length, 0);
  const malformed = fixture();
  const otherIndex = malformed.assets.findIndex(
    (item) => item.asset.name === "other.zip"
  );
  const invalidZip = Buffer.from("not a zip");
  malformed.assets[otherIndex] = {
    asset: {
      name: "other.zip",
      byteLength: invalidZip.length,
      sha256: createHash("sha256").update(invalidZip).digest("hex")
    },
    bytes: invalidZip
  };
  assert.equal(
    (await publishCandidateRelease({ ...request, release: malformed }, remote))
      .status,
    "failed"
  );
  assert.equal(calls.length, 0);
  const first = await publishCandidateRelease(request, remote);
  assert.equal(first.status, "failed");
  assert.equal(first.phase, "publish manifest");
  assert.equal(first.oldTag, "c".repeat(40));
  assert.ok(
    calls.indexOf("delete decision-records.zip") >
      calls.lastIndexOf(
        "upload investigation-report-1.0.0-x86_64-pc-windows-msvc.zip"
      )
  );
  assert.ok(items?.some((asset) => asset.name === "unrelated.zip"));
  const second = await publishCandidateRelease(request, remote);
  assert.equal(second.status, "updated");
  assert.equal(
    (await publishCandidateRelease(request, remote)).status,
    "unchanged"
  );
  latest = { tag: "skills-latest", id: 88 };
  refuseLatest = true;
  const failedLatest = await publishCandidateRelease(request, remote);
  assert.equal(failedLatest.status, "failed");
  assert.equal(failedLatest.phase, "verify rolling latest");
  refuseLatest = false;
  const latestStart = calls.length;
  assert.equal(
    (await publishCandidateRelease(request, remote)).status,
    "updated"
  );
  assert.ok(calls.slice(latestStart).includes("mark latest"));
  assert.ok(
    !calls
      .slice(latestStart)
      .some((call) => call.startsWith("upload") || call.startsWith("delete"))
  );
  const runtime = items!.find(
    (item) =>
      item.name === "decision-records-1.0.0-x86_64-unknown-linux-gnu.zip"
  )!;
  items = items!.map((item) =>
    item === runtime ? { ...item, digest: "sha256:" + "0".repeat(64) } : item
  );
  const before = calls.length;
  assert.match(
    (await publishCandidateRelease(request, remote)).error!,
    /immutable runtime conflict/
  );
  assert.ok(
    !calls
      .slice(before)
      .some(
        (call) =>
          call.startsWith("upload") ||
          call.startsWith("delete") ||
          call === "update tag"
      )
  );
  items = undefined;
  tag = undefined;
  latest = { tag: "other-release", id: 99 };
  failManifest = true;
  assert.equal(
    (await publishCandidateRelease(request, remote)).status,
    "failed"
  );
  assert.deepEqual(latest, { tag: "other-release", id: 99 });
  assert.equal(
    (await publishCandidateRelease(request, remote)).status,
    "updated"
  );
  assert.deepEqual(latest, { tag: "skills-latest", id: 17 });
  assert.match(notes, /Ubuntu 22\.04/);
  assert.match(notes, /Windows x64/);
  assert.match(notes, /Get-FileHash/);
  assert.match(notes, /sha256sum --check/);
  items = undefined;
  tag = undefined;
  assert.equal(
    (await publishCandidateRelease({ ...request, mode: "snapshot" }, remote))
      .status,
    "created"
  );
  assert.equal(
    (await publishCandidateRelease({ ...request, mode: "snapshot" }, remote))
      .status,
    "reused"
  );
  items = items!.filter((item) => item.name !== "other.zip");
  const snapshot = await publishCandidateRelease(
    { ...request, mode: "snapshot" },
    remote
  );
  assert.equal(snapshot.status, "failed");
  assert.match(snapshot.error!, /snapshot exists/);
});
