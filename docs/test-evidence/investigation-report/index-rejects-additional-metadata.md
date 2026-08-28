### Case INVESTIGATION-INDEX-METADATA-001: index rejects additional metadata

Entry:

- `tools/investigation-report/tests/index-query.test.ts > index rejects additional metadata`
- `bun test --test-name-pattern="^index rejects additional metadata$" ./tools/investigation-report/tests/run.ts`

Contract:

- 当前 Investigation index 的 metadata 必须是严格空对象。

Proves:

- 写入额外 metadata 后，公共 query 返回 metadata 诊断。
