### Case INVESTIGATION-REPORT-FRONTMATTER-001: validation enforces report frontmatter fields and canonical ordering

Tests:
- `test:a494a36a656c27289dcf9919df387b669ef209aef6ac1769e2df1a8d1f3fc793`

Tags:
- `investigation-report`

Contract:
- 每份报告使用固定顺序的规范 frontmatter；relations 空集必须使用字节 `[]`，必填标量不得含控制字符。

Proves:
- 独立字面 Markdown 的规范 frontmatter 通过；调换字段、`relations:` 空值或 `\r` 标量各产生领域诊断。
