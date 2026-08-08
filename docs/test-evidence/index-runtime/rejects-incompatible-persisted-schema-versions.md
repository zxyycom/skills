### Case INDEX-RUNTIME-PERSISTED-SCHEMA-VERSION-001: 拒绝不兼容的持久化 Schema 版本

Entry:
- `tools/index-runtime/tests/runtime.test.ts > rejects incompatible persisted schema versions`
- `bun test --test-name-pattern="^rejects incompatible persisted schema versions$" ./tools/index-runtime/tests/run.ts`

Contract:
- 持久化索引 parser 必须拒绝与当前协议不兼容的 schema version，而不能把旧结构当作当前索引读取。

Proves:
- 将一个有效序列化索引的 `schemaVersion` 改为 `2` 后，解析返回 error，并报告 `state-index.schema-version-unsupported`。
