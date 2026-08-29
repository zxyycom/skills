### Case DECISION-DISCARD-RECORDED-ATTENTION-001: Discard 在删除已记录决策前暂停
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard pauses before deleting a candidate recorded in Git HEAD`
- `bun test --test-name-pattern="^discard pauses before deleting a candidate recorded in Git HEAD$" ./tools/decision-records/tests/run.ts`
Contract:
- 完整且未被引用的 Decision ID 已进入 Git `HEAD` 时，首次 `discard` 必须零写入 attention；只有显式加入 `--delete-recorded-decision` 才能删除目标。
Proves:
- 首次 discard 保留目标文件和正式索引；带参数重试只删除选定目标，保留同级候选。
