### Case INVESTIGATION-LAZY-TRACE-001: 乱序构图保持追踪事件与预算选择

Tests:
- `test:7bbb915a0ae4d6ab8ece56755bacf497d1bdab3ee40ffbb35829ed834170f91f`

Tags:
- `investigation-report`

Contract:
- 图边无需全量排序，trace 仍须在各方向、深度与预算下给出确定的成员、完整事件和截断边界。

Proves:
- 明确的拆分预算不足返回完整三成员 blockedEvent；216 组方向、深度、记录预算及 anchor 组合在乱序投影上与正序得到相同完整 trace 结果。
