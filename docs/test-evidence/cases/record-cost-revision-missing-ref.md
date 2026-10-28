### Case RECORD-COST-CASE-019: 固定版本解析失败

Tests:
- `test:bc3aef8ccb2949c64c98421202dddc485ce59d9efe8a9e8e004a813d208a1836`

Tags:
- `record-cost`

Contract:
- 准备时无法解析 revision 的结果不能因 ref 后来出现而改变。

Proves:
- 创建同名分支后读取仍报原错误，非法路径优先。
