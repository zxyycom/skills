### Case DECISION-ID-QUERY-001: 稳定 ID 的 Show

Tests:
- `test:77a75b5cfb9d9f7d62f7d13e6ea587b31c460d592dbfbdf0bb81915a4a10d731`

Tags:
- `decision-records`

Contract:
- show 通过稳定 ID 从持久索引定位 active 或 archived 记录，并返回其带 tags 与明确 alignment 的原始 Markdown。

Proves:
- show 分别输出 active/aligned 与 archived/unaligned 的 metadata 和 Markdown frontmatter。
