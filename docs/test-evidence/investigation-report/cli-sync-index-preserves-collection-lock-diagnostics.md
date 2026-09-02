### Case INVESTIGATION-CLI-SYNC-LOCK-001: CLI sync-index preserves collection lock diagnostics

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI sync-index preserves collection lock diagnostics`
- `bun test --test-name-pattern="^CLI sync-index preserves collection lock diagnostics$" ./tools/investigation-report/tests/run.ts`

Contract:
- `sync-index` 遇到已有调查集合 mutation lock 时，CLI 必须保留结构化 busy 归因及未写入事务结果。

Proves:
- 预置 lock 后命令返回退出码 1、stdout 为空，stderr 包含 collection-lock-busy、busy cause、集合 scope 和 no-change outcome。
