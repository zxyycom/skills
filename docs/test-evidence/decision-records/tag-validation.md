### Case DECISION-TAG-VALIDATION-001: 标签必需、有序且唯一

Entry:
- `tools/decision-records/tests/metadata.test.ts > decision Markdown requires sorted unique tag tokens`
- `bun test --test-name-pattern="^decision Markdown requires sorted unique tag tokens$" ./tools/decision-records/tests/run.ts`

Contract:
- 每条决策 tags 非空、合法、词法有序且唯一。

Proves:
- 缺失、空、非法、逆序、重复 tags 分别被正文验证拒绝。
