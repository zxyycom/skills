### Case INVESTIGATION-CLI-SYNC-001: 生成 Sync-index 命令写入完整 v5 索引

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation sync command writes the full index`
- `bun test --test-name-pattern="^generated investigation sync command writes the full index$" ./tools/investigation-report/tests/run.ts`

Contract:
- `sync-index` 命令必须校验完整调查集合，并将 v5 主题索引写入标准索引文件；资源关系只保存于主题 state，metadata 不保存资源摘要。

Proves:
- 命令成功时只向 stdout 报告同步结果且 stderr 为空。
- 写出的索引 metadata 为 `{}`，并为带随附资源的报告保留 resourceReferences。
