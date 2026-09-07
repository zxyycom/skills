### Case CHANGE-PLAN-COMPLETE-001: Complete 预演零写入且精确 Plan 可删除

Tests:
- `test:c15cbdf2743d9ff65d411a83cbee622d851899ef837b34579b23be1145435535`

Tags:
- `change-plan`

Contract:
- 完整任务的 Plan 只有在工作树与当前 Git HEAD 的目录 tree 精确一致时才能 complete；preflight 复用门禁但不创建 tombstone、不移动或删除文件。

Proves:
- 含嵌套 100644 与 100755 文件的 Plan 经 preflight 后仍存在且 tombstone root 不存在。
- 实际 complete 返回 `completed`、保留 HEAD recovery revision、删除 source，并只留下被 catalog 排除的空 tombstone root。
