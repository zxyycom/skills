### Case NATIVE-RECORD-GATE-WAIVER-001: 已审查查询 DTO 的局部重复例外

Tests:
- `test:6c25f134e9b379a3b7108156e85f2db6bec8c9aaf8ebf501a0956592908bc37e`

Tags:
- `record-rust`

Contract:
- 重复例外仅适用于审查过的精确查询 DTO，不得隐藏新的重复。

Proves:
- 隔离材料同时验证指定例外和新重复仍阻断。
