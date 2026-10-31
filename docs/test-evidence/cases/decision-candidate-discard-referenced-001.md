### Case DECISION-CANDIDATE-DISCARD-REFERENCED-001: Discard 拒绝仍被引用的候选

Tests:
- `test:51a68f761e228d96a61859355c658d6d764c2d9ab30972d20dedeb682f3753b0`

Tags:
- `decision-records`

Contract:
- 仍被其他候选直接引用的候选目标不能删除，以免留下悬空关系。

Proves:
- 纯生命周期准备对被其他候选引用的目标返回 still referenced 错误，结果不含 changes。
