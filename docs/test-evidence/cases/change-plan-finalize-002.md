### Case CHANGE-PLAN-FINALIZE-002: Finalize 对任务或未知成员门禁零移动

Tests:
- `test:6a1b0a6d94b61f3668012b5c03a00322b1fd308dae73eeb26d11c3114d824509`

Tags:
- `change-plan`

Contract:
- Finalize 必须先满足全部 Plan task；Git 未记录的成员使 physical tree 不再可由 HEAD 精确恢复，并在删除前失败。

Proves:
- 未完成 task 与额外未跟踪文件各自得到 `no-change` 及可行动错误。
- 两种失败都保留原 Change 目录。
