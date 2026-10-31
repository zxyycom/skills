### Case INVESTIGATION-RELATION-SUMMARY-MARKDOWN-001: relation summary Markdown accepts only normalized optional short text

Tests:
- `test:0493fd24ea2fbf07b9d6ca95acd649a372e20cb847a5c18ff071e0ab612c023a`

Tags:
- `investigation-report`

Contract:
- Markdown relation 的 key 顺序为 `type`、`target`、可选 `summary`；持久 summary 必须已规范化、单行且最多 40 个 Unicode 码点，旧无摘要 relation 保持合法。

Proves:
- 40 个非 BMP 码点可解析并保持 relation 对象投影；41 个码点、转义换行和首尾空白持久值被拒绝。
- 删除 summary 行后的历史关系仍按原 type/target 读取。
