import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  cargoArtifacts,
  cargoPackage,
  type Artifact
} from "./snapshot-cargo-messages.ts";
import { cargoTestCommand } from "./snapshot-commands.ts";
import { runSnapshotCommand, snapshotFailure } from "./snapshot-files.ts";
import type { RepositoryTestEntity } from "./snapshot-types.ts";

export function cargoTestNames(output: string): readonly string[] {
  const names: string[] = [];
  for (const line of output.split(/\r?\n/u)) {
    if (line.length === 0 || /^\d+ tests?, \d+ benchmarks?$/u.test(line))
      continue;
    if (!line.endsWith(": test"))
      throw snapshotFailure(`unsupported Cargo test listing: ${line}`);
    const name = line.slice(0, -6);
    if (!name || names.includes(name))
      throw snapshotFailure(`empty or duplicate Cargo test name: ${name}`);
    names.push(name);
  }
  return names;
}

export async function collectCargoEntities(
  root: string
): Promise<readonly RepositoryTestEntity[]> {
  const manifest = v.parse(
    v.object({ scripts: v.optional(v.record(v.string(), v.unknown())) }),
    JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"))
  );
  if (manifest.scripts?.["test:record-rust"] === undefined) {
    try {
      await fs.lstat(path.join(root, "tools/record-cli/Cargo.toml"));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      throw error;
    }
    throw snapshotFailure(
      "record-cli Cargo package has no test:record-rust entry"
    );
  }
  if (manifest.scripts["test:record-rust"] !== cargoTestCommand)
    throw snapshotFailure("unsupported Cargo test script");
  const args = ["--manifest-path", "./tools/record-cli/Cargo.toml"];
  const metadata = await runSnapshotCommand(
    "cargo",
    [
      "+1.98.1",
      "metadata",
      ...args,
      "--locked",
      "--no-deps",
      "--format-version",
      "1"
    ],
    root
  );
  if (metadata.exitCode !== 0)
    throw snapshotFailure(`cargo metadata failed: ${metadata.output}`);
  const pkg = cargoPackage(metadata.output);
  const build = await runSnapshotCommand(
    "cargo",
    [
      "+1.98.1",
      "test",
      ...args,
      "--locked",
      "--all-targets",
      "--no-run",
      "--message-format=json"
    ],
    root
  );
  if (build.exitCode !== 0)
    throw snapshotFailure(`Cargo test build failed: ${build.output}`);
  const artifacts = cargoArtifacts(build.output, pkg);
  return await listCargoEntities(root, artifacts);
}

async function listCargoEntities(
  root: string,
  artifacts: ReadonlyMap<string, Artifact>
): Promise<readonly RepositoryTestEntity[]> {
  const entities: RepositoryTestEntity[] = [];
  for (const [key, artifact] of artifacts) {
    if (!artifact.executable)
      throw snapshotFailure(`Cargo executable missing: ${key}`);
    const listed = await runSnapshotCommand(
      artifact.executable,
      ["--list"],
      root
    );
    if (listed.exitCode !== 0)
      throw snapshotFailure(`Cargo test listing failed: ${key}`);
    const kind = artifact.target.kind;
    const selector = kind.includes("lib")
      ? "--lib"
      : kind.includes("bin")
        ? `--bin ${artifact.target.name}`
        : kind.includes("test")
          ? `--test ${artifact.target.name}`
          : null;
    if (selector === null)
      throw snapshotFailure(`unsupported Cargo target kind: ${key}`);
    for (const name of cargoTestNames(listed.output)) {
      const identity = ["cargo", "record-cli", key, name];
      const id = `test:${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`;
      entities.push({
        id,
        name,
        locators: [
          `cargo:${key.replace("\0", ":")} > ${name}`,
          `${cargoTestCommand.replace(" --all-targets -- --include-ignored", "")} ${selector} -- ${JSON.stringify(name)} --exact --include-ignored`
        ].sort()
      });
    }
  }
  if (!entities.length) throw snapshotFailure("Cargo test inventory is empty");
  return entities;
}
