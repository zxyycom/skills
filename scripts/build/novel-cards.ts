import path from "node:path";
import {
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type GeneratedArtifact
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";

const sourcePath = "tools/novel-cards/src/cli.ts";
const outputPath = "skills/novel-cards/scripts/novel-cards.mjs";
const mode = parseGeneratedFileMode(process.argv.slice(2));
const bundle = await bundleWithBun({
  banner: buildGeneratedFileHeader({
    artifactName: "novel cards CLI",
    rebuildCommand: "bun run sync:novel-cards-cli",
    repository: githubRepository,
    skillSourcePath: "skills/novel-cards",
    sourcePath
  }),
  cwd: rootDir,
  entryPath: path.join(rootDir, sourcePath),
  format: "esm",
  keepNames: true,
  minify: true,
  outputFileName: path.basename(outputPath),
  sourceMapBaseDirectory: path.dirname(path.join(rootDir, outputPath)),
  sourceMap: true
});
if (bundle.sourceMap === null || bundle.code.includes(rootDir))
  throw new Error("自包含 CLI 必须有 source map 且不含本机路径");
const artifacts: GeneratedArtifact[] = [
  { content: bundle.code, path: path.join(rootDir, outputPath), sourcePath },
  {
    content: bundle.sourceMap,
    path: path.join(rootDir, `${outputPath}.map`),
    sourcePath
  }
];
const changed = await syncGeneratedArtifacts(
  artifacts,
  mode,
  rootDir,
  sourcePath
);
if (mode === "check" && changed) process.exitCode = 1;
