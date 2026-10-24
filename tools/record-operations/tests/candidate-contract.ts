import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as v from "valibot";

type Observation = Readonly<{
  ok: boolean;
  ids?: readonly string[];
  warnings?: readonly string[];
  body?: string;
  scaffoldValid?: boolean;
  bodyReady?: boolean;
}>;
export type RecordCandidateAdapter = Readonly<{
  collection: string;
  indexFileName: string;
  candidate: (
    id: string,
    valid: boolean
  ) => Readonly<{ sourcePath: string; text: string }>;
  formal: (id: string) => Readonly<{ sourcePath: string; text: string }>;
  create: (
    root: string,
    name: string,
    targets: readonly string[]
  ) => Promise<Observation>;
  list: (root: string) => Promise<Observation>;
  show: (root: string, selector: string) => Promise<Observation>;
  sync: (root: string) => Promise<void>;
  queryCli: (
    root: string,
    selector?: string
  ) => Promise<Readonly<{ ok: boolean; stdout: string }>>;
  createCli: (
    root: string,
    target: string
  ) => Promise<Readonly<{ ok: boolean; stdout: string }>>;
}>;

/** 同一候选产品契约由两个领域原生入口执行；后验直接核对文件与索引字节。 */
export async function assertCandidateOperationContract(
  adapter: RecordCandidateAdapter
): Promise<void> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "record-candidate-contract-")
  );
  const directory = path.join(root, adapter.collection);
  const indexPath = path.join(directory, adapter.indexFileName);
  const reset = async () => {
    await fs.rm(directory, { force: true, recursive: true });
    await fs.mkdir(directory, { recursive: true });
  };
  const write = async (
    source: Readonly<{ sourcePath: string; text: string }>
  ) => {
    await fs.writeFile(path.join(directory, source.sourcePath), source.text);
  };
  try {
    await reset();
    const created = await adapter.create(root, "draft", ["261225-future"]);
    assert.equal(created.ok, true, "new accepts a future complete target ID");
    const futureListed = await adapter.list(root);
    assert.equal(futureListed.ok, true);
    assert.deepEqual(
      futureListed.ids,
      created.ids,
      "new future-target scaffold remains visible in candidates"
    );
    const futureShown = await adapter.show(root, "draft");
    assert.equal(
      futureShown.ok,
      true,
      "future target does not invalidate show-candidate scaffold"
    );
    assert.deepEqual(futureShown.ids, created.ids);
    assert.equal(futureShown.scaffoldValid, true);
    assert.equal(futureShown.bodyReady, false);
    assert.match(futureShown.body ?? "", /261225-future/);
    for (const selector of [undefined, "draft"]) {
      const queried = await adapter.queryCli(root, selector);
      assert.equal(
        queried.ok,
        true,
        "CLI candidates/show-candidate retain future-target scaffold"
      );
      assert.match(queried.stdout, /scaffold(?:Valid)?[=: ]+true/i);
    }
    await assert.rejects(fs.lstat(indexPath), { code: "ENOENT" });
    const cli = await adapter.createCli(root, "261225-future");
    assert.equal(
      cli.ok,
      true,
      "future target must not turn post-create readiness into CLI failure"
    );
    assert.match(cli.stdout, /created/i);
    assert.match(cli.stdout, /scaffold(?:Valid)?[=: ]+true/i);
    assert.match(cli.stdout, /body(?:Ready)?[=: ]+false/i);

    await reset();
    const formal = adapter.formal("261021-same");
    await write({
      ...formal,
      text: formal.text.replace(
        /\n##[\s\S]*/u,
        "\nmalformed unrelated formal body\n"
      )
    });
    const good = adapter.candidate("261022-same", true);
    const bad = adapter.candidate("261022-bad", false);
    await write(good);
    await write(bad);
    const listed = await adapter.list(root);
    assert.equal(
      listed.ok,
      true,
      "one invalid candidate does not hide good candidates"
    );
    assert.deepEqual(listed.ids, ["261022-same"]);
    assert.ok((listed.warnings?.length ?? 0) > 0);
    const shown = await adapter.show(root, "same");
    assert.equal(
      shown.ok,
      true,
      "show-candidate does not mix in the same-name formal record"
    );
    assert.deepEqual(shown.ids, ["261022-same"]);
    assert.equal(
      shown.body,
      good.text,
      "show-candidate returns its discovered safe source bytes"
    );
    assert.equal((await adapter.show(root, "bad")).ok, false);
    assert.equal((await adapter.show(root, "absent")).ok, false);
    await assert.rejects(fs.lstat(indexPath), { code: "ENOENT" });
    assert.equal(
      (await adapter.create(root, "named-target", ["same"])).ok,
      false,
      "new name targets use candidate plus visible formal identities and reject ambiguity"
    );
    assert.equal(
      (await adapter.create(root, "missing-target", ["absent"])).ok,
      false
    );
    await write(adapter.candidate("261020-unique", true));
    assert.equal(
      (await adapter.create(root, "unique-target", ["unique"])).ok,
      true
    );
    // Even broken candidate bodies retain their legal identity for collision detection.
    await write({
      ...adapter.candidate("261022-same", false),
      sourcePath: adapter.candidate("duplicate", false).sourcePath
    });
    assert.equal((await adapter.list(root)).ok, false);
    await fs.rm(
      path.join(directory, adapter.candidate("duplicate", false).sourcePath)
    );
    await fs.symlink(
      path.join(directory, good.sourcePath),
      path.join(directory, adapter.candidate("linked", true).sourcePath)
    );
    assert.equal(
      (await adapter.list(root)).ok,
      false,
      "unsafe members never become warnings"
    );

    await reset();
    await write(adapter.formal("261021-base"));
    await adapter.sync(root);
    await write(adapter.candidate("261022-next", true));
    assert.equal(
      (await adapter.list(root)).ok,
      true,
      "a legal published baseline is accepted"
    );
    const indexBytes = await fs.readFile(indexPath, "utf8");
    const indexValue: unknown = JSON.parse(indexBytes);
    const incompatible = v.parse(
      v.looseObject({ definitionVersion: v.number() }),
      indexValue
    );
    incompatible.definitionVersion += 100;
    for (const invalid of ["invalid JSON\n", JSON.stringify(incompatible)]) {
      await fs.writeFile(indexPath, invalid);
      assert.equal(
        (await adapter.list(root)).ok,
        false,
        "existing invalid/incompatible indexes never fall back"
      );
      assert.equal((await adapter.show(root, "next")).ok, false);
      assert.equal((await adapter.create(root, "blocked", [])).ok, false);
      assert.equal(
        await fs.readFile(indexPath, "utf8"),
        invalid,
        "candidate discovery does not repair indexes"
      );
    }
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
}
