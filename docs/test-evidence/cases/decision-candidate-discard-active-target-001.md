### Case DECISION-CANDIDATE-DISCARD-ACTIVE-TARGET-001: Discard 接受指向活动目标的合法候选

Tests:
- `test:1128d18f8b2d020742e40f66a3e0051c158e6cc044ac099ec2f9badd7a2b63b0`

Tags:
- `decision-records`

Contract:
- 候选指向活动已建立目标是合法的前瞻关系，不应阻止删除该关系的来源候选。

Proves:
- 对带有效活动目标关系的 candidate 执行 discard 成功删除来源文件。
- 只存在已建立成员的正式索引逐字节不变。
