import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { addGeneratedFileHeader } from "../lib/generated-file.ts";
import { pathExists, rootDir, toPosix } from "../lib/project.ts";

type Mode = "check" | "write";

const repositoryUrl = "https://github.com/zxyycom/skills";
const sourceRelativePath = "scripts/decision-records/src/cli.ts";
const outputRelativePath = "skills/decision-records/scripts/decision-records.mjs";
const skillSourceUrl = `${repositoryUrl}/tree/main/skills/decision-records`;

function parseMode(argv: string[]): Mode {
  let mode: Mode | null = null;

  for (const arg of argv) {
    if (arg === "--check" || arg === "--write") {
      const nextMode = arg === "--write" ? "write" : "check";
      if (mode !== null && mode !== nextMode) {
        throw new Error("--check and --write cannot be used together");
      }
      mode = nextMode;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return mode ?? "check";
}

function runBunBuild(entryPath: string, outputPath: string): Promise<void> {
  const args = [
    "build",
    entryPath,
    "--target=node",
    "--format=esm",
    "--packages=bundle",
    `--outfile=${outputPath}`
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const output = Buffer.concat([...stdout, ...stderr]).toString("utf8").trim();
      reject(new Error(output || `bun build exited with code ${code}`));
    });
  });
}

async function buildArtifact(): Promise<string> {
  const tempDir = path.join(rootDir, ".decision-records-cli-build");
  const tempOutputPath = path.join(tempDir, "decision-records.mjs");

  try {
    await fs.rm(tempDir, { force: true, recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await runBunBuild(path.join(rootDir, sourceRelativePath), tempOutputPath);
    const bundled = await fs.readFile(tempOutputPath, "utf8");
    const executable = bundled.startsWith("#!") ? bundled : `#!/usr/bin/env node\n${bundled}`;
    return addGeneratedFileHeader(executable, {
      artifactName: "decision-records CLI",
      rebuildCommand: "bun run sync:decision-records-cli",
      repositoryUrl,
      skillSourceUrl,
      sourcePath: sourceRelativePath,
      sourceUrl: `${repositoryUrl}/blob/main/${sourceRelativePath}`
    });
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const outputPath = path.join(rootDir, outputRelativePath);
  const expected = await buildArtifact();
  const current = await pathExists(outputPath) ? await fs.readFile(outputPath, "utf8") : null;

  if (current === expected) {
    console.log("Decision records CLI generated artifact is current.");
    return;
  }

  if (mode === "check") {
    console.error(`${toPosix(outputRelativePath)} is missing or not generated from ${sourceRelativePath}`);
    process.exit(1);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, expected, "utf8");
  console.log(`Wrote ${toPosix(outputRelativePath)}`);
}

await main();
