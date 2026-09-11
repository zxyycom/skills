### Case DECISION-CLI-REMOVED-PROTOCOLS-001: CLI 拒绝已移除的拆分与位置式演进协议

Tests:
- `test:ddb58788215facce55833984f8bb379fbcd11aa674f8b24f32875b87629807e7`

Tags:
- `decision-records`

Contract:
- 关系演进只接受统一 evolve 协议；已移除的独立 split 命令与旧位置式 evolve 参数形状必须在参数边界失败。

Proves:
- 独立 split 调用和带位置后继及旧 alignment 的 evolve 调用都退出 2。
