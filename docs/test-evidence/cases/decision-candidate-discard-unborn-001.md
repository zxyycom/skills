### Case DECISION-CANDIDATE-DISCARD-UNBORN-001: Discard 删除 unborn Git HEAD 工作树中的候选

Tests:
- `test:6f9f791eec6030349b2473bad5a9341356947f8359dc54a3adf429f364d33d9a`

Tags:
- `decision-records`

Contract:
- 尚无首次提交的 Git 工作树没有已记录 Decision ID；完整且未被引用的 candidate 可由普通 `discard` 删除。

Proves:
- 初始化但未提交的 Git 工作树中，普通 discard 成功删除 candidate 文件。
