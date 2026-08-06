### Case DECISION-CANDIDATE-DISCARD-SELECTION-001: 丢弃只删除选定候选并保留同级候选
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard removes only the selected candidate and preserves siblings`
- `bun test --test-name-pattern="^discard removes only the selected candidate and preserves siblings$" ./tools/decision-records/tests/run.ts`
Contract:
- 多个结构完整的显式候选并存时，严格检查允许它们等待审核；Discard 必须只删除显式目标并保持其他候选和已建立索引，候选是否已经进入 Git `HEAD` 不影响删除。
Proves:
- 两个候选提交到 Git `HEAD` 后，严格检查仍成功并计数两个候选；丢弃目标后同级候选原文与正式索引保持不变。
- 命令输出确认删除目标，并在 stderr 提醒仍存在的候选。
