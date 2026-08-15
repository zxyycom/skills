### Case DECISION-TAG-METADATA-001: 标签 Markdown 往返解析

Entry:
- `tools/decision-records/tests/metadata.test.ts > decision Markdown parses canonical tags and round-trips its semantic fields`
- `bun test --test-name-pattern="^decision Markdown parses canonical tags and round-trips its semantic fields$" ./tools/decision-records/tests/run.ts`

Contract:
- 序列化 frontmatter 后重新解析必须保留 candidate 的 tags、投影字段和正文边界。

Proves:
- 序列化→解析后 tags、title、正文与原解析结果一致。
