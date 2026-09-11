### Case INVESTIGATION-CLI-SYNC-LOCK-001: CLI sync-index preserves collection lock diagnostics

Tests:
- `test:2d847ecce3f004e9c8404db3316268d5ce7d9656526b6dd59d9ef1c9e5d68cbd`

Tags:
- `investigation-report`

Contract:
- `sync-index` 遇到已有调查集合 mutation lock 时，CLI 必须保留结构化 busy 归因及未写入事务结果。

Proves:
- 预置 lock 后命令返回退出码 1、stdout 为空，stderr 包含 collection-lock-busy、busy cause、集合 scope 和 no-change outcome。
