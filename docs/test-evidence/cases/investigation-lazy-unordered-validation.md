### Case INVESTIGATION-LAZY-VALIDATION-001: 乱序构图保持完整校验诊断

Tests:
- `test:164bf11e3f4db78d6d6a8ab8704bd6d4ca8d30e0520c26381327cd34ffae50e7`

Tags:
- `investigation-report`

Contract:
- 图边输入顺序不能削弱完整关系校验或改变已排序的错误集合。

Proves:
- 包含环、缺失 target、重复 target 和非法普通形状的正逆序投影都返回相同四条明确排序诊断。
