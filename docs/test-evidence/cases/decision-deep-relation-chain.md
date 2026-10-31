### Case DECISION-DEEP-RELATION-CHAIN-001: 决策图合法深链与晚期环

Tests:
- `test:739e8f8c45f85d7a5c3bf3dbfecd9df4547d6e8ce8d3fb6796b5fdec2bb000e7`

Tags:
- `decision-records`

Contract:
- 合法archived直接修订链不受调用栈深度限制，循环诊断保留来源身份。

Proves:
- 12000节点已归档修订链无问题；晚期闭环诊断保留确定性路径及恰好三个sourceIds。
