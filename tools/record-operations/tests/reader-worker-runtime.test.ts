import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fixture, many, repository } from "./reader-fixture.ts";
import { forEachRecordText } from "../src/reader-batch.ts";

const execute = promisify(execFile);

async function isolatedReader(
  root: string,
  workerSource?: string
): Promise<string> {
  const install = path.join(root, "installation");
  const destination = path.join(install, "tools/record-operations/src");
  await fs.mkdir(destination, { recursive: true });
  for (const name of [
    "reader-batch.ts",
    "reader-protocol.ts",
    "reader-worker.ts",
    "reader-sync.ts",
    "source.ts",
    "transaction-snapshot.ts"
  ])
    await fs.copyFile(
      path.join(repository, "tools/record-operations/src", name),
      path.join(destination, name)
    );
  const shared = path.join(install, "tools/shared/src/node");
  await fs.mkdir(shared, { recursive: true });
  await fs.copyFile(
    path.join(repository, "tools/shared/src/node/filesystem.ts"),
    path.join(shared, "filesystem.ts")
  );
  await fs.writeFile(path.join(install, "package.json"), '{"type":"module"}');
  await fs.symlink(
    path.join(repository, "node_modules"),
    path.join(install, "node_modules"),
    process.platform === "win32" ? "junction" : "dir"
  );
  if (workerSource !== undefined)
    await fs.writeFile(
      path.join(destination, "reader-worker.ts"),
      workerSource
    );
  return path.join(destination, "reader-batch.ts");
}

async function executeNode(
  root: string,
  script: string,
  flags: readonly string[] = []
) {
  const directory = await fs.mkdtemp(path.join(root, "node-consumer-"));
  const entry = path.join(directory, "consumer.mjs");
  await fs.writeFile(entry, script);
  return await execute("node", [...flags, entry], { timeout: 15000 });
}

test("record worker consumer failure and cancellation settle without late callbacks", async () => {
  await fixture(async (root) => {
    const paths = many(["a.md"]);
    let callbacks = 0;
    const failure = new Error("consumer stopped");
    await assert.rejects(
      forEachRecordText(root, paths, () => {
        callbacks++;
        throw failure;
      }),
      (error) => error === failure
    );
    assert.equal(callbacks, 1);
    const controller = new AbortController();
    await assert.rejects(
      forEachRecordText(
        root,
        paths,
        () => {
          callbacks++;
          controller.abort(failure);
        },
        controller.signal
      ),
      (error) => error === failure
    );
    assert.equal(callbacks, 2);
    // A new call is a real acquisition, not a successful tail from an aborted worker.
    await fs.writeFile(path.join(root, "a.md"), "after abort");
    await forEachRecordText(root, paths, (result) => {
      assert.ok(result.ok);
      assert.equal(result.value, "after abort");
    });
    assert.equal(callbacks, 2);
  });
});

test("record native Node worker failures and malformed replies cannot become per-file success", async () => {
  await fixture(async (root) => {
    const entry = await isolatedReader(root);
    const script = `import assert from "node:assert/strict";
      const { forEachRecordText } = await import(${JSON.stringify(entry)});
      let calls = 0;
      await assert.rejects(forEachRecordText(${JSON.stringify(root)}, Array(1000).fill("a.md"), () => calls++), /before replying|protocol|Invalid|array|reader crashed/);
      assert.equal(calls, 0);`;
    const worker = path.join(path.dirname(entry), "reader-worker.ts");
    await fs.writeFile(worker, 'throw new Error("reader crashed");');
    await executeNode(root, script);
    await fs.writeFile(worker, "process.exit(0);");
    await executeNode(root, script);
    await fs.writeFile(
      worker,
      'import {parentPort} from "node:worker_threads"; parentPort.once("message", () => process.exit(0));'
    );
    await executeNode(root, script);
    await fs.writeFile(
      worker,
      'import {parentPort} from "node:worker_threads"; parentPort.on("message", (x) => { if(x === null) parentPort.close(); else parentPort.postMessage([]); });'
    );
    await executeNode(root, script);
    await fs.writeFile(
      worker,
      'import {parentPort} from "node:worker_threads"; parentPort.once("message", (request) => { parentPort.postMessage(request.paths.map(() => ({ok: true, result: {kind: "text", value: "a"}}))); parentPort.once("message", () => process.exit(0)); });'
    );
    await executeNode(
      root,
      `
      import assert from "node:assert/strict";
      const {forEachRecordText} = await import(${JSON.stringify(entry)});
      let calls = 0;
      let readerWorker;
      const exited = new Promise((resolve) => process.once("worker", (worker) => {
        readerWorker = worker;
        worker.once("exit", resolve);
      }));
      await assert.rejects(forEachRecordText(${JSON.stringify(root)}, Array(1000).fill("a.md"), async () => {
        calls++;
        // 首个 consumer 已进入后才触发退出，避免回包与退出的事件调度竞态。
        readerWorker.postMessage(null);
        await exited;
      }), /exited with code 0/);
      assert.equal(calls, 1);
    `
    );
  });
});

test("record native Node reader installation runs its local worker without repository source", async () => {
  await fixture(async (root) => {
    const entry = await isolatedReader(root);
    await executeNode(
      root,
      `
      import assert from "node:assert/strict";
      const {forEachRecordTextSnapshot} = await import(${JSON.stringify(entry)});
      let count = 0;
      await forEachRecordTextSnapshot(${JSON.stringify(root)}, Array(1000).fill(${JSON.stringify(path.join(root, "a.md"))}), (result) => {
        assert.ok(result.ok); assert.equal(result.value.text, "\\ufeffalpha 中文\\n"); count++;
      });
      assert.equal(count, 1000);
    `
    );
  });
});

test("record native Node shutdown closes every actual synchronous read handle", async () => {
  await fixture(async (root) => {
    const entry = await isolatedReader(root);
    const worker = path.join(path.dirname(entry), "reader-worker.ts");
    const closed = path.join(root, "worker-handles.jsonl");
    await fs.appendFile(
      worker,
      `
      import readerProbeFs from "node:fs";
      const readerProbeOpen = readerProbeFs.openSync;
      const readerProbeClose = readerProbeFs.closeSync;
      const readerProbeFds = new Set();
      let readerProbeReads = 0;
      readerProbeFs.openSync = (...args) => { const fd = readerProbeOpen(...args); readerProbeFds.add(fd); readerProbeReads++; return fd; };
      readerProbeFs.closeSync = (fd) => { readerProbeClose(fd); readerProbeFds.delete(fd); };
      process.on("exit", () => readerProbeFs.appendFileSync(${JSON.stringify(closed)}, JSON.stringify({reads: readerProbeReads, open: readerProbeFds.size}) + "\\n"));
    `
    );
    await executeNode(
      root,
      `
      import assert from "node:assert/strict";
      import fs from "node:fs";
      const {forEachRecordText} = await import(${JSON.stringify(entry)});
      const paths = Array(1000).fill("a.md");
      const failure = new Error("consumer stopped");
      await assert.rejects(forEachRecordText(${JSON.stringify(root)}, paths, () => {throw failure}), (error) => error === failure);
      assert.equal(fs.readFileSync(${JSON.stringify(closed)}, "utf8").trim().split("\\n").length, 1);
      const abort = new AbortController();
      await assert.rejects(forEachRecordText(${JSON.stringify(root)}, paths, () => abort.abort(failure), abort.signal), (error) => error === failure);
      assert.equal(fs.readFileSync(${JSON.stringify(closed)}, "utf8").trim().split("\\n").length, 2);
    `
    );
    const observations: unknown[] = (await fs.readFile(closed, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as unknown);
    assert.equal(
      observations.length,
      2,
      "both workers exited before the calls returned"
    );
    for (const observation of observations) {
      assert.ok(typeof observation === "object" && observation !== null);
      assert.ok(
        "reads" in observation && typeof observation.reads === "number"
      );
      assert.ok(
        observation.reads > 0,
        "worker must have acquired actual files"
      );
      assert.ok("open" in observation);
      assert.equal(observation.open, 0);
    }
  });
});

test("record generated skill installations include executable local worker closures", async () => {
  await fixture(async (root) => {
    for (const skill of ["decision-records", "investigation-report"]) {
      const install = path.join(root, "generated-" + skill);
      await fs.cp(path.join(repository, "skills", skill, "scripts"), install, {
        recursive: true
      });
      await fs.writeFile(
        path.join(install, "package.json"),
        '{"type":"module"}'
      );
      await fs.symlink(
        path.join(repository, "node_modules"),
        path.join(install, "node_modules"),
        process.platform === "win32" ? "junction" : "dir"
      );
      const entry = path.join(
        install,
        "runtime/tools/record-operations/src/reader-batch.ts"
      );
      await executeNode(
        root,
        `
        import assert from "node:assert/strict";
        const {forEachRecordFileSnapshot} = await import(${JSON.stringify(entry)});
        let count = 0;
        await forEachRecordFileSnapshot(${JSON.stringify(root)}, Array(1000).fill(${JSON.stringify(path.join(root, "a.md"))}), (result) => {
          assert.ok(result.ok); assert.ok(result.value); count++;
        });
        assert.equal(count, 1000);
      `
      );
    }
  });
});

test("record Node permission-constrained batches retain denials without creating workers", async () => {
  await fixture(async (root) => {
    const entry = await isolatedReader(root);
    const denied = path.join(root, "denied/record.md");
    await fs.mkdir(path.dirname(denied));
    await fs.writeFile(denied, "must stay denied");
    const script = `
      import assert from "node:assert/strict";
      const {forEachRecordText} = await import(${JSON.stringify(entry)});
      let workers = 0;
      process.on("worker", () => workers++);
      let failures = 0;
      await forEachRecordText(${JSON.stringify(path.dirname(denied))}, Array(1000).fill("record.md"), (result) => {
        assert.equal(result.ok, false);
        assert.equal(result.error.code, "ERR_ACCESS_DENIED");
        assert.equal(result.error.permission, "FileSystemRead");
        failures++;
      });
      assert.equal(failures, 1000);
      assert.equal(workers, 0);
    `;
    // Grant only the explicit installation/dependency/consumer trees, not the target.
    const consumer = path.join(root, "permission-consumer");
    await fs.mkdir(consumer);
    const flags = [
      "--permission",
      "--allow-fs-read=" + path.join(root, "installation"),
      "--allow-fs-read=" + path.join(repository, "node_modules"),
      "--allow-fs-read=" + consumer
    ];
    await executeNode(consumer, script, flags);
    await executeNode(consumer, script, [...flags, "--allow-worker"]);
  });
});

test(
  "record Node input-type consumers retain original asynchronous acquisition",
  { timeout: 20_000 },
  async () => {
    await fixture(async (root) => {
      const entry = await isolatedReader(
        root,
        'throw new Error("file-backed worker is incompatible with input-type");'
      );
      const script = `
      import assert from "node:assert/strict";
      const {forEachRecordText} = await import(${JSON.stringify(entry)});
      let workers = 0;
      process.on("worker", () => workers++);
      let count = 0;
      await forEachRecordText(${JSON.stringify(root)}, Array(1000).fill("a.md"), (result) => {
        assert.ok(result.ok); assert.equal(result.value, "\\ufeffalpha 中文\\n"); count++;
      });
      assert.equal(count, 1000);
      assert.equal(workers, 0);
    `;
      await execute("node", ["--input-type=module", "-e", script], {
        timeout: 15_000,
        killSignal: "SIGKILL"
      });
    });
  }
);
