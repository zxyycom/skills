### Case DECISION-CANDIDATE-DISCARD-UNBORN-001: Discard 删除 unborn Git HEAD 工作树中的候选

Tests:
- `test:057392b309d99deb224eba8e1326abd66606547f61a6df10d9dc318c2143f852`

Tags:
- `decision-records`

Contract:
- 尚无首次提交的 Git 工作树没有已记录 Decision ID；完整且未被引用的 candidate 可由普通 `discard` 删除。

Proves:
- 初始化但未提交的 Git 工作树中，普通 discard 成功删除 candidate 文件。
