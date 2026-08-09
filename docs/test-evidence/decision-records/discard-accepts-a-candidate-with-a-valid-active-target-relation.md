### Case DECISION-CANDIDATE-DISCARD-ACTIVE-TARGET-001: Discard 接受指向活动目标的合法候选
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard accepts a candidate with a valid active-target relation`
- `bun test --test-name-pattern="^discard accepts a candidate with a valid active-target relation$" ./tools/decision-records/tests/run.ts`
Contract:
- 候选指向活动已建立目标是合法的前瞻关系，不应阻止删除该关系的来源候选。
Proves:
- 对带有效活动目标关系的 candidate 执行 discard 成功删除来源文件。
- 只存在已建立成员的正式索引逐字节不变。
