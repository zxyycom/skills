### Case DECISION-ID-QUERY-001: 稳定 ID 的 Show

Entry:
- `tools/decision-records/tests/queries.test.ts > decision show returns tagged Markdown by stable ID`
- `bun test --test-name-pattern="^decision show returns tagged Markdown by stable ID$" ./tools/decision-records/tests/run.ts`

Contract:
- show 通过稳定 ID 从持久索引定位记录，并返回其带 tags 的原始 Markdown。

Proves:
- show 输出包含 tags frontmatter。
