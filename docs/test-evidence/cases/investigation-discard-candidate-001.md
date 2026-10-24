### Case INVESTIGATION-DISCARD-CANDIDATE-001: 候选删除的明确范围与历史确认

Tests:
- `test:fbd72ac7901f2d74403e378964af263e9ba92b245cc0288e58a6ea64a7d07aa9`

Tags:
- `investigation-report`

Contract:
- 统一 discard 只删除所选候选与授权 owner 树，不自动保护或改写未选候选引用；已进入 HEAD 的目标须确认。

Proves:
- 未选消费者候选引用不阻断目标删除且自身保留；Git 已记录的候选需要确认，确认后只删除目标和 owner 树，正式正文不变。
