import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runProcess } from "./fixtures/process.ts";
import { readSourceStamp } from "../src/evidence.ts";
import { freshEvidence, publishEvidence } from "../src/store.ts";
import { root, cli } from "./fixtures/public-cli.ts";

const fixture = path.join(import.meta.dirname, "fixtures/cleanup-failure.mjs");

for (const mode of [
  "publish-success",
  "publish-primary",
  "writer-success",
  "writer-primary",
  "writer-close-success",
  "writer-close-primary"
]) {
  test(`cleanup ${mode}`, async () => {
    const base = path.join(
      root,
      ".tmp/video-understanding/style-review-cleanup-tests"
    );
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(path.join(base, "scope-"));
    try {
      const result = await runProcess("node", [fixture, directory, mode]);
      // The child returns its observed failure, not a production source-shape assertion.
      const observed = JSON.parse(result.stdout);
      const primary = mode.includes("primary");
      assert.equal(observed.unchanged, primary);
      assert.equal(observed.frameStatus, primary ? "unprepared" : "complete");
      if (primary) {
        assert.equal(
          observed.failure.kind,
          mode.startsWith("publish") ? "protocol" : "input"
        );
        assert.ok(
          result.stderr.includes("cleanup failed; primary error retained")
        );
        if (!mode.startsWith("publish"))
          assert.equal(observed.primaryIdentityPreserved, true);
      } else {
        assert.equal(observed.failure.kind, "environment");
        assert.equal(
          observed.failure.stage,
          mode.startsWith("publish") ? "publish" : "lock"
        );
        assert.ok(observed.failure.target.includes(directory));
      }
      if (mode.startsWith("writer"))
        assert.equal(observed.removeAttempted, true);
      if (mode.includes("close")) assert.equal(observed.closeAttempted, true);
      assert.ok(
        !(result.stderr + result.stdout).includes(
          "unsafe cleanup exception detail"
        )
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

for (const command of ["prepare", "frames"]) {
  test(`${command} preserves its original failure when status publication fails`, async () => {
    const base = path.join(
      root,
      ".tmp/video-understanding/style-review-publication-tests"
    );
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(path.join(base, "scope-"));
    try {
      const input = path.join(directory, "source.mp4");
      await writeFile(
        input,
        "synthetic source; the runtime must not be started"
      );
      const index = freshEvidence(await readSourceStamp(input));
      await publishEvidence(directory, index);
      const manifest = path.join(directory, "evidence.json");
      const before = await readFile(manifest, "utf8");
      const appRoot = path.join(directory, "missing-runtime");
      const args = [
        cli,
        command,
        "--input",
        input,
        "--output",
        directory,
        "--app-root",
        appRoot,
        "--format",
        "json"
      ];
      if (command === "frames") args.push("--times", "1");
      const preload = pathToFileURL(
        path.join(import.meta.dirname, "fixtures/publish-failure.mjs")
      ).href;
      const result = await runProcess("node", ["--import", preload, ...args], {
        reject: false
      });
      assert.equal(result.exitCode, 1);
      assert.equal(result.stdout, "");
      assert.ok(
        result.stderr.includes(
          "failure status publication failed; primary error retained"
        )
      );
      assert.ok(result.stderr.includes("environment at publish"));
      assert.ok(result.stderr.includes(`target=${manifest}`));
      assert.ok(result.stderr.includes("published status may be unchanged"));
      assert.ok(
        result.stderr.includes("inspect output permissions before retrying")
      );
      const primaryDiagnostic = result.stderr.trim().split("\n").at(-1) ?? "";
      assert.ok(primaryDiagnostic.includes("environment at runtime"));
      assert.ok(primaryDiagnostic.includes("ENOENT"));
      assert.ok(primaryDiagnostic.includes(`target=${appRoot}`));
      assert.ok(!result.stderr.includes("unsafe publication exception detail"));
      assert.equal(await readFile(manifest, "utf8"), before);
      assert.ok(!(await readdir(directory)).includes(".write-lock"));
      assert.equal(
        (await readdir(directory)).some((file) => file.startsWith(".index-")),
        false
      );
      const control = await runProcess("node", args, { reject: false });
      assert.equal(control.exitCode, 1);
      assert.equal(control.stdout, "");
      assert.equal(control.stderr.trim(), primaryDiagnostic);
      const published = JSON.parse(await readFile(manifest, "utf8"));
      assert.equal(
        command === "prepare"
          ? published.materials[0].status
          : published.frames.attempt.status,
        "failed"
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
