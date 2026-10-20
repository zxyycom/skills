### Case DECISION-CANDIDATE-DISCARD-REFERENCED-001: Discard 拒绝仍被引用的候选

Tests:
- `test:f120cce0bbbe5127da63a9bc1c870fd9e80747c3cc4c9febb9c6e02d2bbacb12`

Tags:
- `decision-records`

Contract:
- 仍被其他候选直接引用的候选目标不能删除，以免留下悬空关系。

Proves:
- 纯生命周期准备对被其他候选引用的目标返回 still referenced 错误，结果不含 changes。
