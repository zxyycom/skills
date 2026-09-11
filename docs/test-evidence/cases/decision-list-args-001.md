### Case DECISION-LIST-ARGS-001: Decision CLI 校验近期分页与时间范围参数

Tests:
- `test:541478be5fb145554c2fbb695310f3ff25ca1ee8c551b997f1c8080bb233a923`

Tags:
- `decision-records`

Contract:
- Decision list help 公开 createdAt 范围、limit/offset 与 detail；时间戳、页大小、offset、范围顺序和不可重复选项在 CLI/query 边界验证。

Proves:
- help 显示默认 10、最大 1000 及五个新入口；零或越界 limit、负 offset、非法或逆序时间范围、重复 createdAt/limit/offset 均以退出码 2、空 stdout 失败。
