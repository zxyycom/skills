import { readPendingSnapshot } from "../src/version-control/pending-snapshot.ts";
import { readRevisionFilePrefixes } from "../src/version-control/revision-file-prefixes.ts";
import {
  assert,
  createRepositoryFixture,
  fs,
  gitTestOptions,
  openVersionControl,
  path,
  runGit,
  test,
  withTempRoot,
  hasVersionControlCode
} from "./version-control-test-support.ts";
const contentPath = "docs/tracked.md";

for (const failure of ["missing", "type", "corrupt"]) {
  test(
    `pending selected retention still detects unselected ${failure} objects and preserves default full reads`,
    gitTestOptions,
    async () => {
      await withTempRoot(async (temp) => {
        const { repositoryRoot } = await createRepositoryFixture(temp);
        const repository = await openVersionControl(repositoryRoot);
        const oid = runGit(repositoryRoot, [
          "rev-parse",
          ":docs/staged.bin"
        ]).trim();
        const objectPath = path.join(
          repositoryRoot,
          ".git/objects",
          oid.slice(0, 2),
          oid.slice(2)
        );
        if (failure === "missing") await fs.unlink(objectPath);
        if (failure === "type")
          runGit(repositoryRoot, [
            "update-index",
            "--cacheinfo",
            `100644,${runGit(repositoryRoot, ["rev-parse", "HEAD^{tree}"]).trim()},docs/staged.bin`
          ]);
        if (failure === "corrupt") {
          const bytes = await fs.readFile(objectPath);
          await fs.chmod(objectPath, 0o600);
          await fs.writeFile(objectPath, bytes.subarray(0, bytes.length - 4));
        }
        const before = await fs.readFile(
          path.join(repositoryRoot, ".git/index")
        );
        await assert.rejects(
          readPendingSnapshot(repository, {
            pathScope: "docs",
            contentPaths: [contentPath]
          }),
          (error: unknown) => hasVersionControlCode(error, "operation-failed")
        );
        await assert.rejects(
          repository.readPendingFiles({ pathScopes: ["docs"] }),
          (error: unknown) => hasVersionControlCode(error, "operation-failed")
        );
        assert.deepEqual(
          await fs.readFile(path.join(repositoryRoot, ".git/index")),
          before
        );
      });
    }
  );
}

test(
  "revision prefixes preserve binary bytes and completeness while draining all full payloads",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const prefix = await readRevisionFilePrefixes(repository, {
        revision: currentRevision,
        paths: [contentPath],
        prefixBytes: 3
      });
      assert.deepEqual(
        prefix.map((file) => ({
          path: file.path,
          data: Buffer.from(file.data).toString(),
          complete: file.complete
        })),
        [{ path: contentPath, data: "cur", complete: false }]
      );
      const full = await readRevisionFilePrefixes(repository, {
        revision: currentRevision,
        paths: [contentPath],
        prefixBytes: 100
      });
      assert.equal(full[0]?.complete, true);
      assert.equal(Buffer.from(full[0]!.data).toString(), "current\n");
      assert.deepEqual(
        await readRevisionFilePrefixes(repository, {
          revision: currentRevision,
          paths: [],
          prefixBytes: 0
        }),
        []
      );
    });
  }
);
