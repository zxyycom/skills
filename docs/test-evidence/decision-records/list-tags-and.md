### Case DECISION-LIST-TAG-AND-001: List 对重复标签采用 AND 筛选

Entry:
- `tools/decision-records/tests/queries.test.ts > decision list combines repeated tag selectors with AND semantics`
- `bun test --test-name-pattern="^decision list combines repeated tag selectors with AND semantics$" ./tools/decision-records/tests/run.ts`

Contract:
- 重复 `--tag` 选择器必须取交集，而不是并集。

Proves:
- A、A+B、B 三条记录中，双 tag 仅返回 A+B。
