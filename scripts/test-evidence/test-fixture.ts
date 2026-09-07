import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function withSnapshotFixture<T>(
  scripts: Record<string, string>,
  files: Record<string, string>,
  operation: (root: string) => Promise<T>
): Promise<T> {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-fixture-")
  );
  const root = path.join(parent, "workspace");
  try {
    await fs.mkdir(path.join(root, "node_modules", ".bin"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ scripts }, null, 2)}\n`,
      "utf8"
    );
    await fs.writeFile(
      path.join(root, "pnpm-lock.yaml"),
      "lockfileVersion: '9.0'\n",
      "utf8"
    );
    await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "{}\n", "utf8");
    await fs.writeFile(path.join(root, "tsconfig.json"), "{}\n", "utf8");
    for (const [relativePath, source] of Object.entries(files)) {
      const filePath = path.join(root, relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, source, "utf8");
    }
    const projectAstGrep = await fs.realpath(
      path.join(process.cwd(), "node_modules", "@ast-grep", "cli", "ast-grep")
    );
    const astGrep = path.join(root, "node_modules", ".bin", "ast-grep");
    await fs.writeFile(
      astGrep,
      `#!/bin/sh\nexec ${JSON.stringify(projectAstGrep)} "$@"\n`,
      "utf8"
    );
    await fs.chmod(astGrep, 0o755);
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync(
      "git",
      [
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "user.name=Test Fixture",
        "commit",
        "--quiet",
        "-m",
        "fixture"
      ],
      { cwd: root }
    );
    return await operation(root);
  } finally {
    await fs.rm(parent, { force: true, recursive: true });
  }
}
