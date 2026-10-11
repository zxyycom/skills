import {
  readPendingSnapshot,
  replacePendingSnapshot
} from "../src/version-control/pending-snapshot.ts";
import {
  assert,
  createRepositoryFixture,
  gitTestOptions,
  openVersionControl,
  runGit,
  test,
  withTempRoot
} from "./version-control-test-support.ts";
const contentPath = "docs/tracked.md";

test(
  "pending patch changed paths and written bytes use the same boundary-owned target despite caller buffer mutation",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const snapshot = await readPendingSnapshot(repository, {
        pathScope: "docs",
        contentPaths: [contentPath]
      });
      const data = Buffer.from("newdata\n");
      const current = repository.getCurrentRevision;
      repository.getCurrentRevision = async () => {
        data.set(Buffer.from("current\n"));
        return await current.call(repository);
      };
      const result = await replacePendingSnapshot(repository, {
        expectedRevision: currentRevision,
        expectedSnapshot: snapshot,
        updates: [{ path: contentPath, kind: "regular", data }]
      });
      assert.deepEqual(result.changedPaths, [contentPath]);
      assert.equal(
        runGit(repositoryRoot, ["show", ":docs/tracked.md"]),
        "newdata\n"
      );
    });
  }
);
