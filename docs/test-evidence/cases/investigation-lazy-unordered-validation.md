### Case INVESTIGATION-LAZY-VALIDATION-001: 乱序构图保持完整校验诊断

Tests:
- `test:c81b7a2a41e3c46b19079d3d0625caa94c7319784fb881429711d2ba88e35689`

Tags:
- `investigation-report`

Contract:
- 图边输入顺序不能削弱完整关系校验或改变已排序的错误集合。

Proves:
- 包含环、缺失 target、重复 target 和非法普通形状的正逆序投影都返回相同四条明确排序诊断。
