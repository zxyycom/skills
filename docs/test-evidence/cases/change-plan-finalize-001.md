### Case CHANGE-PLAN-FINALIZE-001: Finalize 预演零写入且精确 Plan 可删除

Tests:
- `test:c766a47c36a9d84411d7020841ad1afd6d7bea8d560bdf538f28787259c06b3d`

Tags:
- `change-plan`

Contract:
- 完整任务的 Plan 只有在工作树与当前 Git HEAD 的目录 tree 精确一致时才能 finalize；preflight 复用门禁但不创建 tombstone、不移动或删除文件。

Proves:
- 含嵌套 100644 与 100755 文件的 Plan 经 preflight 后仍存在且 tombstone root 不存在。
- 实际 finalize 返回 `finalized`、保留 HEAD recovery revision、删除源 Change 目录，并只留下被 catalog 排除的空 tombstone root。
