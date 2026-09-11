### Case DECISION-EVOLVE-ALIGNMENT-CONFIRMATION-001: Evolve 拒绝已建立后继的错误对齐确认

Tests:
- `test:b3ae929531e4b2470ff80ac69bf94ac017b6e0f9cc329034e7a98eb5158c260f`

Tags:
- `decision-records`

Contract:
- 选择已建立后继时，`--successor` 中的 alignment 只能确认记录现有对齐状态，不能借关系事务改写对齐。

Proves:
- 与现状不一致的 alignment 返回明确失败诊断。
- 拒绝路径逐字节保留目标 Markdown 和 decision-index.json。
