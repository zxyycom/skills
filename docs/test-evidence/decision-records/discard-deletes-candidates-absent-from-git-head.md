### Case DECISION-CANDIDATE-DISCARD-UNRECORDED-001: Discard 删除未进入 Git HEAD 的候选
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard deletes candidates absent from Git HEAD`
- `bun test --test-name-pattern="^discard deletes candidates absent from Git HEAD$" ./tools/decision-records/tests/run.ts`
Contract:
- Git 工作树已有已提交基线时，未进入 Git `HEAD` 的完整且未被引用 candidate 可由普通 `discard` 删除，不需要已记录候选删除参数。
Proves:
- 提交既有决策集合后新建 candidate，普通 discard 成功删除该文件。
- 已建立成员的正式索引逐字节不变。
