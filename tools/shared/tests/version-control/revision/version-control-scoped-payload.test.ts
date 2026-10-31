import {
  readPendingSnapshot,
  replacePendingSnapshot,
  samePendingSnapshots,
  extendsPendingSnapshot
} from "../../../src/version-control/pending-snapshot.ts";
import {
  assert,
  createRepositoryFixture,
  fs,
  gitTestOptions,
  hasVersionControlCode,
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
  "pending payload expansion preserves complete identities and selected absence",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot } = await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const initial = await readPendingSnapshot(repository, {
        ...options,
        contentPaths: [selected, "docs/absent"]
      });
      const expanded = await readPendingSnapshot(repository, {
        ...options,
        contentPaths: [selected, unselected, "docs/absent"]
      });
      assert.equal(extendsPendingSnapshot(initial, expanded), true);
      assert.equal(extendsPendingSnapshot(expanded, initial), false);
      assert.equal(samePendingSnapshots(initial, expanded), false);
      assert.equal(
        extendsPendingSnapshot(
          initial,
          await readPendingSnapshot(repository, {
            ...options,
            contentPaths: [selected, unselected]
          })
        ),
        false
      );
    });
  }
);

test(
  "pending payload expansion rejects foreign forged scope and payload policies",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot } = await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const initial = await readPendingSnapshot(repository, options);
      assert.equal(extendsPendingSnapshot({ ...initial }, initial), false);
      assert.equal(
        extendsPendingSnapshot(
          initial,
          await readPendingSnapshot(repository, {
            ...options,
            pathScope: selected
          })
        ),
        false
      );
      assert.equal(
        extendsPendingSnapshot(
          initial,
          await readPendingSnapshot(repository, {
            ...options,
            payloadScope: "scope"
          })
        ),
        false
      );
      assert.equal(
        extendsPendingSnapshot(
          initial,
          await readPendingSnapshot(
            await openVersionControl(repositoryRoot),
            options
          )
        ),
        false
      );
    });
  }
);

test(
  "pending payload expansion rejects changed previous actual payload with stable object identity",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot } = await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const initial = await readPendingSnapshot(repository, options);
      await overwriteBlobPayload(objectPath(repositoryRoot, selected));
      const expanded = await readPendingSnapshot(repository, {
        ...options,
        contentPaths: [selected, unselected]
      });
      assert.equal(extendsPendingSnapshot(initial, expanded), false);
    });
  }
);

for (const failure of ["missing", "corrupt", "type"]) {
  test(
    `content-path payload scope permits unselected ${failure} objects without weakening full defaults`,
    gitTestOptions,
    async () => {
      await withTempRoot(async (temp) => {
        const { repositoryRoot, currentRevision } =
          await createRepositoryFixture(temp);
        const repository = await openVersionControl(repositoryRoot);
        const target = objectPath(repositoryRoot, unselected);
        if (failure === "missing") await fs.unlink(target);
        if (failure === "corrupt") {
          await fs.chmod(target, 0o600);
          await fs.writeFile(target, "invalid zlib object");
        }
        if (failure === "type")
          runGit(repositoryRoot, [
            "update-index",
            "--cacheinfo",
            `100644,${runGit(repositoryRoot, ["rev-parse", "HEAD^{tree}"]).trim()},${unselected}`
          ]);
        const before = runGit(repositoryRoot, ["ls-files", "--stage"]);
        const snapshot = await readPendingSnapshot(repository, options);
        assert.ok(snapshot.members.length > snapshot.files.length);
        for (const payloadScope of [undefined, "scope"] as const)
          await assert.rejects(
            readPendingSnapshot(repository, { ...options, payloadScope }),
            (error: unknown) => hasVersionControlCode(error, "operation-failed")
          );
        await assert.rejects(
          repository.readPendingFiles({ pathScopes: ["docs"] })
        );
        const result = await replacePendingSnapshot(repository, {
          expectedRevision: currentRevision,
          expectedSnapshot: snapshot,
          updates: [
            {
              path: selected,
              kind: "regular",
              data: Buffer.from("selected target\n")
            }
          ]
        });
        assert.deepEqual(result.changedPaths, [selected]);
        assert.equal(
          runGit(repositoryRoot, ["show", `:${selected}`]),
          "selected target\n"
        );
        assert.deepEqual(
          runGit(repositoryRoot, ["ls-files", "--stage"])
            .split("\n")
            .filter((line) => !line.endsWith(selected)),
          before.split("\n").filter((line) => !line.endsWith(selected))
        );
        const fresh = await readPendingSnapshot(repository, options);
        const unchanged = await replacePendingSnapshot(repository, {
          expectedRevision: currentRevision,
          expectedSnapshot: fresh,
          updates: fresh.files
        });
        assert.deepEqual(unchanged.changedPaths, []);
      });
    }
  );
}

test(
  "pending snapshots bind payload policy and exact content boundary and reject expansion",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const snapshot = await readPendingSnapshot(repository, options);
      const same = await readPendingSnapshot(repository, {
        ...options,
        contentPaths: [selected, selected]
      });
      assert.equal(samePendingSnapshots(snapshot, same), true);
      for (const variant of [
        { ...options, payloadScope: "scope" },
        { ...options, contentPaths: [] },
        { ...options, contentPaths: [selected, "docs/absent"] }
      ] as const)
        assert.equal(
          samePendingSnapshots(
            snapshot,
            await readPendingSnapshot(repository, variant)
          ),
          false
        );
      const before = await fs.readFile(path.join(repositoryRoot, ".git/index"));
      for (const data of [null, Buffer.from("not authorized\n")]) {
        await assert.rejects(
          replacePendingSnapshot(repository, {
            expectedRevision: currentRevision,
            expectedSnapshot: snapshot,
            updates: [{ path: unselected, kind: "regular", data }]
          }),
          (error: unknown) => hasVersionControlCode(error, "pending-conflict")
        );
      }
      assert.deepEqual(
        await fs.readFile(path.join(repositoryRoot, ".git/index")),
        before
      );
    });
  }
);

for (const drift of ["oid", "mode", "member"]) {
  test(
    `content-path payload scope rejects complete unselected ${drift} drift in comparison and locked CAS`,
    gitTestOptions,
    async () => {
      await withTempRoot(async (temp) => {
        const { repositoryRoot, currentRevision } =
          await createRepositoryFixture(temp);
        const repository = await openVersionControl(repositoryRoot);
        const snapshot = await readPendingSnapshot(repository, options);
        if (drift === "oid") {
          await writeFile(
            repositoryRoot,
            unselected,
            "different pending object\n"
          );
          runGit(repositoryRoot, ["add", unselected]);
        }
        if (drift === "mode")
          runGit(repositoryRoot, ["update-index", "--chmod=+x", unselected]);
        if (drift === "member")
          runGit(repositoryRoot, ["rm", "--cached", unselected]);
        const afterDrift = await readPendingSnapshot(repository, options);
        assert.equal(samePendingSnapshots(snapshot, afterDrift), false);
        assert.equal(extendsPendingSnapshot(snapshot, afterDrift), false);
        const before = await fs.readFile(
          path.join(repositoryRoot, ".git/index")
        );
        await assert.rejects(
          replacePendingSnapshot(repository, {
            expectedRevision: currentRevision,
            expectedSnapshot: snapshot,
            updates: []
          }),
          (error: unknown) => hasVersionControlCode(error, "pending-conflict")
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
  "content-path payload scope deliberately excludes unselected bytes with unchanged identity",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const snapshot = await readPendingSnapshot(repository, options);
      await overwriteBlobPayload(objectPath(repositoryRoot, unselected));
      assert.equal(
        samePendingSnapshots(
          snapshot,
          await readPendingSnapshot(repository, options)
        ),
        true
      );
      const result = await replacePendingSnapshot(repository, {
        expectedRevision: currentRevision,
        expectedSnapshot: snapshot,
        updates: [
          { path: selected, kind: "regular", data: Buffer.from("new target\n") }
        ]
      });
      assert.deepEqual(result.changedPaths, [selected]);
    });
  }
);

test(
  "content-path payload scope handles empty scope absent targets and selected deletion",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const emptyOptions = {
        pathScope: "empty",
        contentPaths: ["empty/new"],
        payloadScope: "content-paths"
      } as const;
      const empty = await readPendingSnapshot(repository, emptyOptions);
      assert.deepEqual(empty.members, []);
      const added = await replacePendingSnapshot(repository, {
        expectedRevision: currentRevision,
        expectedSnapshot: empty,
        updates: [
          { path: "empty/new", kind: "regular", data: Buffer.from("created\n") }
        ]
      });
      assert.deepEqual(added.changedPaths, ["empty/new"]);
      const present = await readPendingSnapshot(repository, emptyOptions);
      const deleted = await replacePendingSnapshot(repository, {
        expectedRevision: currentRevision,
        expectedSnapshot: present,
        updates: [{ path: "empty/new", data: null }]
      });
      assert.deepEqual(deleted.changedPaths, ["empty/new"]);
      assert.equal(
        samePendingSnapshots(
          empty,
          await readPendingSnapshot(repository, emptyOptions)
        ),
        true
      );
      const identityOnly = await readPendingSnapshot(repository, {
        ...options,
        contentPaths: []
      });
      const unchanged = await replacePendingSnapshot(repository, {
        expectedRevision: currentRevision,
        expectedSnapshot: identityOnly,
        updates: []
      });
      assert.deepEqual(unchanged.changedPaths, []);
    });
  }
);
