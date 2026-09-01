### Case INVESTIGATION-CLI-SYNC-001: CLI sync-index writes a missing derived index

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI sync-index writes a missing derived index`
- `bun test --test-name-pattern="^CLI sync-index writes a missing derived index$" ./tools/investigation-report/tests/run.ts`

Contract:

- 直接调用的源码 CLI 入口 `sync-index` 能从合法报告源重建缺失的派生 index。

Proves:

- index 缺失时命令成功、stderr 为空，stdout 报告同步成功，且 index 文件被创建并包含报告 entry。
