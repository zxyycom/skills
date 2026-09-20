### Case CHANGE-PLAN-FINALIZE-002: Finalize 对任务或未知成员门禁零移动

Tests:
- `test:d595b6d0d4c428787ce116ee097579cf81eabebd23eccaafde359e96e677c552`

Tags:
- `change-plan`

Contract:
- Finalize 必须先满足全部 Plan task；Git 未记录的成员使 physical tree 不再可由 HEAD 精确恢复，并在删除前失败。

Proves:
- 未完成 task 与额外未跟踪文件各自得到 `no-change` 及可行动错误。
- 两种失败都保留原 Change 目录。
