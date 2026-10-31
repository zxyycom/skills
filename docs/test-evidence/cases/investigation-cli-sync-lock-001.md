### Case INVESTIGATION-CLI-SYNC-LOCK-001: CLI sync-index preserves collection lock diagnostics

Tests:
- `test:6b990413d458087cba9e9df56a73aafb13399bd3d9aff76dff9bbb0ad351b64d`

Tags:
- `investigation-report`

Contract:
- `sync-index` 遇到已有调查集合 mutation lock 时，CLI 必须保留结构化 busy 归因及未写入事务结果。

Proves:
- 预置 lock 后命令返回退出码 1、stdout 为空，stderr 包含 collection-lock-busy、busy cause、集合 scope 和 no-change outcome。
