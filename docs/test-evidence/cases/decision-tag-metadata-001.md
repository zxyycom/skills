### Case DECISION-TAG-METADATA-001: 标签 Markdown 往返解析

Tests:
- `test:023fef9c5bcbd23061bdd5dee77d319560ec10314b458fc688c23c61edca7398`

Tags:
- `decision-records`

Contract:
- 序列化 frontmatter 后重新解析必须保留 candidate 的 tags、投影字段和正文边界。

Proves:
- 序列化→解析后 tags、title、正文与原解析结果一致。
