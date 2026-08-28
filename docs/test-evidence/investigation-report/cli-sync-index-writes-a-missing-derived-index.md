### Case INVESTIGATION-CLI-SYNC-001: CLI sync-index writes a missing derived index

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI sync-index writes a missing derived index`
- `bun test --test-name-pattern="^CLI sync-index writes a missing derived index$" ./tools/investigation-report/tests/run.ts`

Contract:
- CLI `sync-index` 可以从合法报告源重建缺失的派生索引。

Proves:
- 索引文件缺失时执行 `sync-index` 返回成功。
