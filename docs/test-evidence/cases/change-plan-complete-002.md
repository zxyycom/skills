### Case CHANGE-PLAN-COMPLETE-002: Complete 对任务或未知成员门禁零移动

Tests:
- `test:15712446f5fbd1eb97cfc180a75310717767d22403d211c4189be4fa8e320d6e`

Tags:
- `change-plan`

Contract:
- Complete 必须先满足全部 Plan task；Git 未记录的成员使 physical tree 不再可由 HEAD 精确恢复，并在移动前失败。

Proves:
- 未完成 task 与额外未跟踪文件各自得到 `no-change` 及可行动错误。
- 两种失败都保留原 Change 目录。
