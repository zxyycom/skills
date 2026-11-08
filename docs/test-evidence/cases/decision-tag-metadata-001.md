### Case DECISION-TAG-METADATA-001: 标签 Markdown 往返解析

Tests:
- `test:5188738de44857305dea8370a4fe4b51d21583b81627cc546c443b7f7b829f1b`

Tags:
- `decision-records`

Contract:
- 候选 frontmatter 序列化后重新解析保留字段。

Proves:
- 包含 tags 与正文片段的候选 frontmatter 序列化再解析后与原结构相等，非法生命周期更新被拒绝。
