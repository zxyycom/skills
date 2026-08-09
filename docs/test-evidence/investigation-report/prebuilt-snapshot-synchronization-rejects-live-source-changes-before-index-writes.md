### Case INVESTIGATION-SNAPSHOT-REVISION-001: 预构造快照写入前拒绝实时来源变化

Entry:
- `tools/investigation-report/tests/index-query.test.ts > prebuilt snapshot synchronization rejects live source changes before index writes`
- `bun test --test-name-pattern="^prebuilt snapshot synchronization rejects live source changes before index writes$" ./tools/investigation-report/tests/run.ts`

Contract:
- 使用预构造 snapshot 同步索引时，投影必须继续使用同一 snapshot，并在写入前通过实时 revision-only 读取复核来源；两次读取不一致时必须拒绝写入。

Proves:
- 从实际主题文件构造 snapshot 后再修改该文件，写入同步返回 `source-invalid`、`changed: false` 和唯一的 `state-index.source-changed` 诊断。
- 目标索引原本不存在时不会被创建；目标索引已经存在时，其原始字节不会被替换。
