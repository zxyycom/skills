import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type {
  GateCommandInvocation,
  GateCommandRunner
} from "./command-runner.ts";
import { createReleaseTestBatchSession } from "./release-test-batch.ts";

async function withTemporaryDirectory<T>(
  prefix: string,
  operation: (directory: string) => Promise<T>
): Promise<T> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await operation(directory);
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}

test("release test batch executes the file union once and projects per-Check outcomes", async () => {
  await withTemporaryDirectory("skills-vibe-test-batch-", async (directory) => {
    const calls: GateCommandInvocation[] = [];
    const groups = [
      { checkId: "test:alpha", files: ["./alpha.test.ts", "./shared.test.ts"] },
      { checkId: "test:beta", files: ["./shared.test.ts", "./beta.test.ts"] }
    ];
    const session = createReleaseTestBatchSession(async (invocation) => {
      calls.push(invocation);
      const requestedFiles = invocation.args.filter((argument) =>
        argument.endsWith(".test.ts")
      );
      const reportArgument = invocation.args.find((argument) =>
        argument.startsWith("--reporter-outfile=")
      );
      assert.ok(reportArgument);
      const reportPath = reportArgument.slice("--reporter-outfile=".length);
      const failed = requestedFiles.includes("./beta.test.ts");
      await fs.writeFile(
        reportPath,
        `<?xml version="1.0" encoding="UTF-8"?><testsuites tests="${requestedFiles.length}" failures="${failed ? 1 : 0}">${requestedFiles
          .map((file) => {
            const normalized = file.slice(2);
            return `<testsuite name="${normalized}" file="${normalized}" tests="1" failures="${file === "./beta.test.ts" ? 1 : 0}"/>`;
          })
          .join("")}</testsuites>`
      );
      return {
        exitCode: failed ? 1 : 0,
        output: failed ? "one test group failed" : "test partition passed",
        status: "completed"
      };
    }, groups);
    const signal = new AbortController().signal;
    const invocation = (checkId: string): GateCommandInvocation => ({
      args: ["test", `./${checkId}.ts`],
      artifactDirectory: path.join(directory, checkId),
      command: "bun",
      cwd: directory,
      signal
    });
    const [alpha, beta] = await Promise.all([
      session.runnerFor("test:alpha")(invocation("test-alpha")),
      session.runnerFor("test:beta")(invocation("test-beta"))
    ]);

    assert.equal(calls.length, 3);
    assert.deepEqual(
      calls.flatMap(({ args }) =>
        args.filter((argument) => argument.endsWith(".test.ts"))
      ),
      ["./alpha.test.ts", "./shared.test.ts", "./beta.test.ts"]
    );
    assert.equal(alpha.status, "completed", JSON.stringify(alpha));
    assert.equal(alpha.status === "completed" ? alpha.exitCode : null, 0);
    assert.equal(beta.status, "completed");
    assert.equal(beta.status === "completed" ? beta.exitCode : null, 1);
    assert.match(
      await fs.readFile(
        path.join(directory, "test-alpha", "process.log"),
        "utf8"
      ),
      /release test batch workers/u
    );
    assert.match(
      await fs.readFile(
        path.join(directory, "test-beta", "process.log"),
        "utf8"
      ),
      /status: exited 1/u
    );
  });
});

test("release test batch fails closed when JUnit does not cover its requested files", async () => {
  await withTemporaryDirectory(
    "skills-vibe-test-report-",
    async (directory) => {
      const session = createReleaseTestBatchSession(
        async (invocation) => {
          const reportArgument = invocation.args.find((argument) =>
            argument.startsWith("--reporter-outfile=")
          );
          assert.ok(reportArgument);
          await fs.writeFile(
            reportArgument.slice("--reporter-outfile=".length),
            '<?xml version="1.0" encoding="UTF-8"?><testsuites tests="0" failures="0"/>'
          );
          return {
            exitCode: 0,
            output: "worker reported success",
            status: "completed"
          };
        },
        [{ checkId: "test:alpha", files: ["./alpha.test.ts"] }]
      );

      const result = await session.runnerFor("test:alpha")({
        args: ["test", "./alpha.test.ts"],
        artifactDirectory: null,
        command: "bun",
        cwd: directory,
        signal: new AbortController().signal
      });

      assert.equal(result.status, "unavailable");
      assert.equal(
        result.status === "unavailable" ? result.reason : null,
        "gate-command-exit-unavailable"
      );
      assert.match(
        result.output,
        /does not cover every requested test container/u
      );
    }
  );
});

test("release test batch fails closed on a nonzero worker without a failing suite", async () => {
  await withTemporaryDirectory("skills-vibe-test-exit-", async (directory) => {
    const session = createReleaseTestBatchSession(
      async (invocation) => {
        const reportArgument = invocation.args.find((argument) =>
          argument.startsWith("--reporter-outfile=")
        );
        assert.ok(reportArgument);
        await fs.writeFile(
          reportArgument.slice("--reporter-outfile=".length),
          '<?xml version="1.0" encoding="UTF-8"?><testsuites tests="1" failures="0"><testsuite name="alpha.test.ts" file="alpha.test.ts" tests="1" failures="0"/></testsuites>'
        );
        return { exitCode: 1, output: "worker crashed", status: "completed" };
      },
      [{ checkId: "test:alpha", files: ["./alpha.test.ts"] }]
    );

    const result = await session.runnerFor("test:alpha")({
      args: ["test", "./alpha.test.ts"],
      artifactDirectory: null,
      command: "bun",
      cwd: directory,
      signal: new AbortController().signal
    });

    assert.equal(result.status, "unavailable");
    assert.match(
      result.output,
      /exited nonzero without a failing JUnit suite/u
    );
  });
});

test("release test batch reuses only an exact successful proof and cold reruns", async () => {
  await withTemporaryDirectory("skills-vibe-test-proof-", async (directory) => {
    const cacheDirectory = path.join(directory, "cache");
    const groups = [
      { checkId: "test:alpha", files: ["./alpha.test.ts"] },
      { checkId: "test:beta", files: ["./beta.test.ts"] }
    ];
    const workspaceFingerprint = "1".repeat(64);
    let calls = 0;
    const runner: GateCommandRunner = async (invocation) => {
      calls += 1;
      const requestedFiles = invocation.args.filter((argument) =>
        argument.endsWith(".test.ts")
      );
      const reportArgument = invocation.args.find((argument) =>
        argument.startsWith("--reporter-outfile=")
      );
      assert.ok(reportArgument);
      await fs.writeFile(
        reportArgument.slice("--reporter-outfile=".length),
        `<?xml version="1.0" encoding="UTF-8"?><testsuites tests="${requestedFiles.length}" failures="0">${requestedFiles
          .map((file) => {
            const normalized = file.slice(2);
            return `<testsuite name="${normalized}" file="${normalized}" tests="1" failures="0"/>`;
          })
          .join("")}</testsuites>`
      );
      return { exitCode: 0, output: "fresh tests passed", status: "completed" };
    };
    const proofOptions = (cold: boolean) => ({
      cacheDirectory,
      captureWorkspaceFingerprint: async () => workspaceFingerprint,
      cold,
      initialWorkspaceFingerprint: workspaceFingerprint
    });
    const invocation = (artifact: string): GateCommandInvocation => ({
      args: ["test", "./alpha.test.ts"],
      artifactDirectory: path.join(directory, artifact),
      command: "bun",
      cwd: directory,
      signal: new AbortController().signal
    });

    const fresh = await createReleaseTestBatchSession(
      runner,
      groups,
      proofOptions(false)
    ).runnerFor("test:alpha")(invocation("fresh"));
    assert.equal(fresh.status, "completed", JSON.stringify(fresh));
    assert.equal(calls, 2);

    const reused = await createReleaseTestBatchSession(
      runner,
      groups,
      proofOptions(false)
    ).runnerFor("test:alpha")(invocation("reused"));
    assert.equal(reused.status, "completed");
    assert.match(reused.output, /exact content\/toolchain\/environment/u);
    assert.equal(calls, 2);

    await fs.writeFile(path.join(cacheDirectory, "success.json"), "{}\n");
    const afterCorruptProof = await createReleaseTestBatchSession(
      runner,
      groups,
      proofOptions(false)
    ).runnerFor("test:alpha")(invocation("corrupt-proof"));
    assert.equal(afterCorruptProof.status, "completed");
    assert.equal(calls, 4);

    const cold = await createReleaseTestBatchSession(
      runner,
      groups,
      proofOptions(true)
    ).runnerFor("test:alpha")(invocation("cold"));
    assert.equal(cold.status, "completed");
    assert.equal(calls, 6);

    const changedCatalog = await createReleaseTestBatchSession(
      runner,
      [...groups, { checkId: "test:gamma", files: ["./gamma.test.ts"] }],
      proofOptions(false)
    ).runnerFor("test:alpha")(invocation("changed-catalog"));
    assert.equal(changedCatalog.status, "completed");
    assert.equal(calls, 9);
  });
});
