import assert from "node:assert/strict";
import test from "node:test";
import * as v from "valibot";
import {
  outcomeFor,
  runDefinition,
  withTemporaryDirectory
} from "../vibe-check-test-support.ts";
import {
  assertMetricFiles,
  findingSchema,
  isolatedFunctionDefinition,
  isolatedChecks,
  selectedDefinition,
  sixParameterFunction,
  writeFiles
} from "./vibe-check-code-test-support.ts";

test("selected version-control metrics block six-parameter maintained product source", async () => {
  await withTemporaryDirectory(
    "gate-version-control-metrics-",
    async (directory) => {
      const owned = "tools/shared/src/version-control/query.ts";
      const definition = selectedDefinition(["version-control"]);
      await writeFiles(directory, [owned]);
      await writeFiles(
        directory,
        ["tools/shared/src/file-text-search/index.ts"],
        sixParameterFunction
      );
      assertMetricFiles(definition, directory, [owned]);
      const isolated = isolatedFunctionDefinition(definition);
      const flags = ["gate-tool:version-control"];
      const healthy = await runDefinition(isolated, directory, flags);
      assert.equal(healthy.aggregate, "passed");
      assert.deepEqual(healthy.snapshot.records, []);
      await writeFiles(directory, [owned], sixParameterFunction);
      const failed = await runDefinition(isolated, directory, flags);
      assert.equal(failed.aggregate, "failed");
      assert.equal(outcomeFor(failed, "function-metrics").status, "failed");
      assert.deepEqual(
        failed.snapshot.records.map(({ data }) => v.parse(findingSchema, data)),
        [
          {
            functionName: "tooMany",
            limit: 5,
            metric: "parameter-count",
            path: owned,
            value: 6
          }
        ]
      );
    }
  );
});

test("selected build-source metrics block eight automation parameters without scanning nested outputs", async () => {
  await withTemporaryDirectory(
    "gate-build-source-metrics-",
    async (directory) => {
      const owned = "scripts/build/adapter.ts";
      const eightParameters =
        "export function tooMany(a, b, c, d, e, f, g, h) { return a; }\n";
      await writeFiles(directory, [owned]);
      await writeFiles(
        directory,
        [
          "scripts/build/node_modules/dependency.ts",
          "scripts/build/dist/output.ts",
          "scripts/build/build/output.ts",
          "scripts/build/nested/build/output.ts",
          "scripts/other/build/output.ts",
          "tools/alpha/build/output.ts",
          "skills/alpha/scripts/runtime/generated.ts"
        ],
        eightParameters
      );
      const definition = selectedDefinition(["repository-code"]);
      assertMetricFiles(definition, directory, [owned]);
      const isolated = isolatedFunctionDefinition(definition);
      const flags = ["gate-tool:repository-code"];
      const healthy = await runDefinition(isolated, directory, flags);
      assert.equal(healthy.aggregate, "passed");
      assert.deepEqual(healthy.snapshot.records, []);
      await writeFiles(directory, [owned], eightParameters);
      const failed = await runDefinition(isolated, directory, flags);
      assert.equal(failed.aggregate, "failed");
      assert.equal(outcomeFor(failed, "function-metrics").status, "failed");
      assert.deepEqual(
        failed.snapshot.records.map(({ data }) => v.parse(findingSchema, data)),
        [
          {
            functionName: "tooMany",
            limit: 7,
            metric: "parameter-count",
            path: owned,
            value: 8
          }
        ]
      );
    }
  );
});

test("record-rust scope selects Rust product and test files and analyzes functions", async () => {
  await withTemporaryDirectory("gate-rust-metrics-", async (directory) => {
    const product = "tools/record-cli/src/lib.rs";
    const rustTest = "tools/record-cli/tests/queries.rs";
    const nestedTest = "tools/record-cli/tests/queries/candidates.rs";
    await writeFiles(directory, [product], "fn healthy() {}\n");
    await writeFiles(
      directory,
      [rustTest, nestedTest],
      "#[test] fn checks() {}\n"
    );
    const definition = selectedDefinition(["record-rust"]);
    assertMetricFiles(definition, directory, [product, rustTest, nestedTest]);
    const isolated = isolatedFunctionDefinition(definition);
    const flags = ["gate-tool:record-rust"];
    const healthy = await runDefinition(isolated, directory, flags);
    assert.equal(healthy.aggregate, "passed");
    await writeFiles(
      directory,
      [product],
      "fn too_many(a:i32,b:i32,c:i32,d:i32,e:i32,f:i32) -> i32 { a }\n"
    );
    const failed = await runDefinition(isolated, directory, flags);
    assert.equal(failed.aggregate, "failed");
    assert.equal(outcomeFor(failed, "function-metrics").status, "failed");
    assert.ok(
      failed.snapshot.records.some(
        ({ data }) => v.parse(findingSchema, data).path === product
      )
    );
    await writeFiles(directory, [product], "fn healthy() {}\n");
    await writeFiles(
      directory,
      [nestedTest],
      "fn too_many(a:i32,b:i32,c:i32,d:i32,e:i32,f:i32,g:i32,h:i32,i:i32) {}\n"
    );
    const failedTest = await runDefinition(isolated, directory, flags);
    assert.equal(failedTest.aggregate, "failed");
    assert.ok(
      failedTest.snapshot.records.some(({ data }) => {
        const finding = v.parse(findingSchema, data);
        return finding.path === nestedTest && finding.limit === 8;
      })
    );
  });
});

test("record-rust file metrics report actual Rust code lines", async () => {
  await withTemporaryDirectory("gate-rust-file-metrics-", async (directory) => {
    const file = "tools/record-cli/src/lib.rs";
    await writeFiles(
      directory,
      [file],
      Array.from(
        { length: 800 },
        (_, i) => `const ITEM_${i}: i32 = ${i};`
      ).join("\n") + "\n"
    );
    const definition = selectedDefinition(["record-rust"]);
    const result = await runDefinition(
      isolatedChecks(definition, ["file-metrics"]),
      directory,
      ["gate-tool:record-rust"]
    );
    assert.equal(result.aggregate, "failed");
    assert.equal(outcomeFor(result, "file-metrics").status, "failed");
    assert.ok(
      result.snapshot.records.some(({ data }) =>
        JSON.stringify(data).includes(file)
      )
    );
  });
});

test("Rust raw literals preserve following function boundaries without counting literal syntax", async () => {
  await withTemporaryDirectory("gate-rust-raw-literals-", async (directory) => {
    const file = "tools/record-cli/src/lib.rs";
    const literals = [
      String.raw`r"\\?\UNC\"`,
      String.raw`r#"fn ghost(a:i32,b:i32,c:i32,d:i32,e:i32,f:i32) { if true {} } \"#`,
      String.raw`br##"quoted "# if true { }
fn ghost(a:i32,b:i32,c:i32,d:i32,e:i32,f:i32) {} \"##`,
      String.raw`cr###"quoted "## if true { } \"###`
    ];
    const definition = isolatedFunctionDefinition(
      selectedDefinition(["record-rust"])
    );
    for (const literal of literals) {
      const source = `fn before() { let _ = ${literal}; }\nfn after(a:i32,b:i32,c:i32,d:i32,e:i32,f:i32) {}\n`;
      await writeFiles(directory, [file], source);
      const result = await runDefinition(definition, directory, [
        "gate-tool:record-rust"
      ]);
      assert.equal(result.aggregate, "failed", literal);
      assert.deepEqual(
        result.snapshot.records.map(({ data }) => v.parse(findingSchema, data)),
        [
          {
            functionName: "after",
            limit: 5,
            metric: "parameter-count",
            path: file,
            value: 6
          }
        ],
        literal
      );
    }
  });
});

test("Rust function metrics distinguish declarations, function pointers and nested parameter types", async () => {
  await withTemporaryDirectory("gate-rust-signatures-", async (directory) => {
    const file = "tools/record-cli/src/lib.rs";
    const source = `
struct S { first: fn(&S) -> i32, second: fn(&S) -> i32 }
trait T { fn prototype(a:i32,b:i32,c:i32,d:i32,e:i32,f:i32); fn real(a:i32,b:i32,c:i32,d:i32,e:i32,f:i32) {} }
fn callback(cb: fn(i32,i32,i32,i32,i32,i32,i32)->i32) {}
fn create<T,O:Trait<T>>(&mut self,context:&mut WriteContext<'_,'_,T,O>,index:usize,write:&WriteIntent,after:&[u8]) {}
fn after(a:i32,b:i32,c:i32,d:i32,e:i32,f:i32) {}
`;
    await writeFiles(directory, [file], source);
    const definition = isolatedFunctionDefinition(
      selectedDefinition(["record-rust"])
    );
    const result = await runDefinition(definition, directory, [
      "gate-tool:record-rust"
    ]);
    assert.equal(result.aggregate, "failed");
    assert.deepEqual(
      result.snapshot.records.map(({ data }) => v.parse(findingSchema, data)),
      [
        {
          functionName: "after",
          limit: 5,
          metric: "parameter-count",
          path: file,
          value: 6
        },
        {
          functionName: "real",
          limit: 5,
          metric: "parameter-count",
          path: file,
          value: 6
        }
      ]
    );
  });
});

test("Rust error propagation does not accumulate nesting while nested branches still do", async () => {
  await withTemporaryDirectory("gate-rust-depth-", async (directory) => {
    const file = "tools/record-cli/src/lib.rs";
    const definition = isolatedFunctionDefinition(
      selectedDefinition(["record-rust"])
    );
    await writeFiles(
      directory,
      [file],
      `fn linear() -> Option<()> { a()?; b()?; c()?; d()?; e()?; f()?; Some(()) }\nfn chain() { if a && b && c && d && e && f { x(); } }\n`
    );
    const healthy = await runDefinition(definition, directory, [
      "gate-tool:record-rust"
    ]);
    assert.equal(healthy.aggregate, "passed");
    await writeFiles(
      directory,
      [file],
      `fn nested() { if a { if b { if c { if d { if e { if f {} } } } } } }\n`
    );
    const failed = await runDefinition(definition, directory, [
      "gate-tool:record-rust"
    ]);
    assert.equal(failed.aggregate, "failed");
    assert.ok(
      failed.snapshot.records.some(({ data }) => {
        const finding = v.parse(findingSchema, data);
        return (
          finding.functionName === "nested" &&
          finding.metric === "nesting-depth" &&
          finding.value > finding.limit
        );
      })
    );
  });
});
