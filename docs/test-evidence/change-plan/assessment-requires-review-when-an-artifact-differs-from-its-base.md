### Case CHANGE-PLAN-ASSESS-ARTIFACTS-001: 计划制品偏离基线时要求复核
Entry:
- `tools/change-plan/tests/assessment.test.ts > assessment requires review when an artifact differs from its base`
- `bun test --test-name-pattern="^assessment requires review when an artifact differs from its base$" ./tools/change-plan/tests/run.ts`
Contract:
- 任一计划制品与元数据记录的基线不同，都必须先复核计划而不能继续进行距离评估。
Proves:
- 工作树修改、提交到新 HEAD 的修改，以及 index 已暂存但工作树恢复为 HEAD 的修改，都返回 `plan-review-required` 与 `artifacts-changed` 原因。
