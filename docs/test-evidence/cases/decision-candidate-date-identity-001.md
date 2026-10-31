### Case DECISION-CANDIDATE-DATE-IDENTITY-001: 日期样式 ID 与标题可建立

Tests:
- `test:e0b78d6049d003fe9a0c52a1fa1caab14c6b7ea7c6d9b8a8b6562ed3b7c3037d`

Tags:
- `decision-records`

Contract:
- 仅满足当前 ID token 语法的年份/日期样式 ID 与标题不受旧身份禁令影响，可发现并激活为 candidate。

Proves:
- 内存 Markdown 的 `2026-choice` 出现在候选领域查询中；生命周期准备返回一个建立变更，其 nextText 经真实 snapshot 构建保留日期样式标题，不执行索引落盘。
