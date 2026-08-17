### Case INVESTIGATION-SNAPSHOT-REVISION-001: 预构造快照写入前拒绝实时主题变化

Entry:
- `tools/investigation-report/tests/index-query.test.ts > prebuilt snapshot synchronization rejects live topic changes before index writes`
- `bun test --test-name-pattern="^prebuilt snapshot synchronization rejects live topic changes before index writes$" ./tools/investigation-report/tests/run.ts`

Contract:
- 使用预构造 snapshot 同步索引时，投影必须继续使用同一 snapshot，并在写入前通过实时主题 revision 复核来源；两次读取不一致时必须拒绝写入。

Proves:
- snapshot 形成后修改主题 Markdown，写入同步返回 `source-invalid`、`changed: false` 和唯一的 `state-index.source-changed` 诊断。
- 已存在索引的原始字节不会被替换。
