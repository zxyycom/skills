### Case DECISION-TAG-METADATA-001: 标签 Markdown 往返解析

Tests:
- `test:dd18d93b69fab8793fdf5b93868a6b576b8e327b8aa43ad14001c70efca2c0be`

Tags:
- `decision-records`

Contract:
- 序列化 frontmatter 后重新解析必须保留 candidate 的 tags、投影字段和正文边界。

Proves:
- 序列化→解析后 tags、title、正文与原解析结果一致。
