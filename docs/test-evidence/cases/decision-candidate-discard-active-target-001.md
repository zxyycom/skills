### Case DECISION-CANDIDATE-DISCARD-ACTIVE-TARGET-001: Discard 接受指向活动目标的合法候选

Tests:
- `test:c523a64e0dbc68079448e595b6609d0c6b81864d5a55cbee173fa821d2434be1`

Tags:
- `decision-records`

Contract:
- 候选指向活动已建立目标是合法的前瞻关系，不应阻止删除该关系的来源候选。

Proves:
- 对带有效活动目标关系的 candidate 执行 discard 成功删除来源文件。
- 只存在已建立成员的正式索引逐字节不变。
