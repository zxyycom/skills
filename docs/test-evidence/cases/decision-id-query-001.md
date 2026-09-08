### Case DECISION-ID-QUERY-001: 稳定 ID 的 Show

Tests:
- `test:11afeb815bab1d16a8560af1ad371f572b9c4e3325de3647ed6753e75ebca059`

Tags:
- `decision-records`

Contract:
- show 通过稳定 ID 从持久索引定位 active 或 archived 记录，并返回其带 tags 与明确 alignment 的原始 Markdown。

Proves:
- show 分别输出 active/aligned 与 archived/unaligned 的 metadata 和 Markdown frontmatter。
