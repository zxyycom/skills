### Case TASK-GRAPH-SYMLINK-001: 索引路径拒绝穿过已存在符号链接

Entry:
- `tools/task-graph/tests/store.test.ts > store rejects an index path crossing an existing symbolic link`
- `bun test --test-name-pattern="^store rejects an index path crossing an existing symbolic link$" ./tools/task-graph/tests/run.ts`

Contract:
- 权威索引及其旁路锁路径不得穿过已存在的符号链接边界。

Proves:
- init 在创建索引、局部 ignore 或稳定锁文件前以 `PATH_SYMLINK` 拒绝链接目录。
