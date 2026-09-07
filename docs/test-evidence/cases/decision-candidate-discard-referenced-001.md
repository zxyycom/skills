### Case DECISION-CANDIDATE-DISCARD-REFERENCED-001: Discard 拒绝仍被引用的候选

Tests:
- `test:ffc666a28985c71112a77c3d2851b58b1fab9bdf695c385c770735923d19ee2b`

Tags:
- `decision-records`

Contract:
- 仍被其他候选直接引用的候选目标不能删除，以免留下悬空关系。

Proves:
- 目标和引用候选存在关系时，discard 返回 still referenced 诊断。
- 被引用目标、引用来源与正式索引均保持不变。
