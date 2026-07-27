### Case DECISION-CANDIDATE-DISCARD-SELECTION-001: 丢弃只删除选定候选并保留同级候选
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard removes only the selected candidate and preserves siblings`
- `bun test --test-name-pattern="^discard removes only the selected candidate and preserves siblings$" ./tools/decision-records/tests/run.ts`
Contract:
- 多个候选并存时，Discard 必须只删除显式目标并保持其他候选和已建立索引。
Proves:
- 严格检查先报告候选阻断，成功丢弃目标后同级候选原文与索引保持不变。
- 命令输出确认删除目标，并在 stderr 提醒仍存在的候选。
