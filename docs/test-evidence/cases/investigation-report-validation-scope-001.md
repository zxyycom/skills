### Case INVESTIGATION-REPORT-VALIDATION-SCOPE-001: scoped validation selects report ids without claiming full graph proof

Tests:
- `test:69eac613dd3d3fc1f506e565da088fae0f30e20d9670e95ccf78c467b2b72831`

Tags:
- `investigation-report`

Contract:
- scoped validation 只证明所选规范 Investigation ID，不声明完整关系图或 index 已验证。

Proves:
- 局部校验只选择一个报告且 `indexChecked` 为 false；`./` 与首尾空白输入得到 check-id 诊断。
