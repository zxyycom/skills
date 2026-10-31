### Case RECORD-COST-CASE-019: 固定版本解析失败

Tests:
- `test:d1af088e387127d4a07ef3bc053e37f0c546422ca04721ce716cb486ddb27431`

Tags:
- `record-cost`

Contract:
- 准备时无法解析 revision 的结果不能因 ref 后来出现而改变。

Proves:
- 创建同名分支后读取仍报原错误，非法路径优先。
