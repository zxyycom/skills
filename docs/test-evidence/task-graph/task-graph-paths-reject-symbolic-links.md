### Case TASK-GRAPH-SYMLINK-001: 权威路径与 recovery generation 都拒绝符号链接

Entry:
- `tools/task-graph/tests/store.test.ts > index, lock, and temporary paths reject symbolic-link boundaries`
- `bun test --test-name-pattern="^index, lock, and temporary paths reject symbolic-link boundaries$" ./tools/task-graph/tests/run.ts`

Contract:
- index、lock 与同目录临时文件路径不得跨越符号链接，claimed owner 与 reclaimer generation 也必须是普通非符号文件。

Proves:
- index、lock 与临时路径边界在写入前以 `PATH_SYMLINK` 拒绝；claimed owner 或 reclaimer symlink 在恢复读取时以稳定 `LOCK_RECOVERY_REQUIRED` 拒绝且链接保持不变。
