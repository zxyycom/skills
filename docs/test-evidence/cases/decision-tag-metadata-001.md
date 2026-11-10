### Case DECISION-TAG-METADATA-001: 标签 Markdown 往返解析

Tests:
- `test:b280cca6253da2cd8ce22790ea6b318276506040b98972340b0c801a573134f1`

Tags:
- `decision-records`

Contract:
- 候选 frontmatter 序列化后重新解析保留字段。

Proves:
- 包含 tags 与正文片段的候选 frontmatter 序列化再解析后与原结构相等，非法生命周期更新被拒绝。
