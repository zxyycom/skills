### Case INVESTIGATION-CLI-SYNC-001: 生成 sync-index 命令写入完整索引
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation sync command writes the full index`
- `bun test --test-name-pattern="^generated investigation sync command writes the full index$" ./tools/investigation-report/tests/run.ts`
Contract:
- `sync-index` 命令必须验证完整调查集合与资源集合，并写入标准索引文件。
Proves:
- 命令成功报告同步结果，且目标索引实际保存资源关系与原始字节 SHA-256。
