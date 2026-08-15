### Case DECISION-LIST-EMPTY-001: List 对无匹配 tag 或 alignment 返回空结果

Entry:
- `tools/decision-records/tests/queries.test.ts > decision list reports empty results for unmatched tag and alignment filters`
- `bun test --test-name-pattern="^decision list reports empty results for unmatched tag and alignment filters$" ./tools/decision-records/tests/run.ts`

Contract:
- 不匹配的 tag 或 alignment 是成功的空查询，不得返回无关记录。

Proves:
- 两类选择器均输出 `none`。
