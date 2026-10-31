import {
  readPendingSnapshot,
  replacePendingSnapshot,
  samePendingSnapshots
} from "../../../src/version-control/pending-snapshot.ts";
import {
  assert,
  createRepositoryFixture,
  fs,
  gitTestOptions,
  hasVersionControlCode,
  openGitVersionControl,
  openVersionControl,
  path,
  runGit,
  test,
  withTempRoot,
  writeFile
} from "../protocol/version-control-test-support.ts";
import {
  selected,
  unselected,
  options,
  objectPath,
  overwriteBlobPayload
} from "./version-control-scoped-payload-test-support.ts";

test(
  "content-path payload scope compares and locks actual selected bytes rather than only OIDs",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const snapshot = await readPendingSnapshot(repository, options);
      await overwriteBlobPayload(objectPath(repositoryRoot, selected));
      assert.equal(
        samePendingSnapshots(
          snapshot,
          await readPendingSnapshot(repository, options)
        ),
        false
      );
      await assert.rejects(
        replacePendingSnapshot(repository, {
          expectedRevision: currentRevision,
          expectedSnapshot: snapshot,
          updates: []
        }),
        (error: unknown) => hasVersionControlCode(error, "pending-conflict")
      );
    });
  }
);

for (const phase of ["read", "locked", "readback"]) {
  test(
    `content-path payload scope rejects selected payload failure at ${phase}`,
    gitTestOptions,
    async () => {
      await withTempRoot(async (temp) => {
        const { repositoryRoot, currentRevision } =
          await createRepositoryFixture(temp);
        const repository = await openGitVersionControl(repositoryRoot, {
          afterPendingWrite: async () => {
            if (phase === "readback")
              await fs.unlink(objectPath(repositoryRoot, unselected));
          }
        });
        // A second selected path is retained, so readback must validate its payload too.
        const boundary = { ...options, contentPaths: [selected, unselected] };
        const snapshot = await readPendingSnapshot(repository, boundary);
        const before = await fs.readFile(
          path.join(repositoryRoot, ".git/index")
        );
        if (phase !== "readback")
          await fs.unlink(objectPath(repositoryRoot, unselected));
        if (phase === "read")
          await assert.rejects(readPendingSnapshot(repository, boundary));
        else
          await assert.rejects(
            replacePendingSnapshot(repository, {
              expectedRevision: currentRevision,
              expectedSnapshot: snapshot,
              updates: [
                {
                  path: selected,
                  kind: "regular",
                  data: Buffer.from("new target\n")
                }
              ]
            }),
            (error: unknown) =>
              hasVersionControlCode(error, "pending-replacement-failed")
          );
        assert.deepEqual(
          await fs.readFile(path.join(repositoryRoot, ".git/index")),
          before
        );
        await assert.rejects(
          fs.access(path.join(repositoryRoot, ".git/index.lock"))
        );
      });
    }
  );
}

for (const changed of ["updated", "preserved"]) {
  test(
    `content-path payload scope rejects actual ${changed} payload drift at readback`,
    gitTestOptions,
    async () => {
      await withTempRoot(async (temp) => {
        const { repositoryRoot, currentRevision } =
          await createRepositoryFixture(temp);
        const data = Buffer.from("new selected target\n");
        // Materialize the future target once to identify the exact object to corrupt.
        await writeFile(repositoryRoot, "future-target", data.toString());
        const targetOid = runGit(repositoryRoot, [
          "hash-object",
          "-w",
          "future-target"
        ]).trim();
        const targetPath = path.join(
          repositoryRoot,
          ".git/objects",
          targetOid.slice(0, 2),
          targetOid.slice(2)
        );
        const repository = await openGitVersionControl(repositoryRoot, {
          afterPendingWrite: async () => {
            if (changed === "preserved")
              await overwriteBlobPayload(
                objectPath(repositoryRoot, unselected)
              );
            else await overwriteBlobPayload(targetPath);
          }
        });
        const snapshot = await readPendingSnapshot(repository, {
          ...options,
          contentPaths: [selected, unselected]
        });
        const before = await fs.readFile(
          path.join(repositoryRoot, ".git/index")
        );
        await assert.rejects(
          replacePendingSnapshot(repository, {
            expectedRevision: currentRevision,
            expectedSnapshot: snapshot,
            updates: [{ path: selected, kind: "regular", data }]
          }),
          (error: unknown) =>
            hasVersionControlCode(error, "pending-replacement-failed")
        );
        assert.deepEqual(
          await fs.readFile(path.join(repositoryRoot, ".git/index")),
          before
        );
      });
    }
  );
}
