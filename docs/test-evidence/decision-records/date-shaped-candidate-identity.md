### Case DECISION-CANDIDATE-DATE-IDENTITY-001: 日期样式 ID 与标题可建立

Entry:
- `tools/decision-records/tests/first-establishment.test.ts > date-shaped IDs and titles remain valid candidates and can be activated`
- `bun test --test-name-pattern="^date-shaped IDs and titles remain valid candidates and can be activated$" ./tools/decision-records/tests/run.ts`

Contract:
- 仅满足当前 ID token 语法的年份/日期样式 basename 与标题不受旧身份禁令影响，可发现并激活为 candidate。

Proves:
- `2026-choice.md` 和日期样式标题出现在 candidates 查询中，并可激活写入索引。
