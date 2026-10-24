### Case DECISION-INDEX-MAINTENANCE-001: 索引规范重建与严格投影校验

Tests:
- `test:721cba81356e6de88947b4392de4f94c08d4c40f9cb61602914d4bf5157e220d`
- `test:ae2873a7692a5f881da181a853b23aea559f0c6d3e18073cc14897f1b5e9fc1c`
- `test:f6a82c16f67340767ec38edb9d050ed0f6e45149836197967c9110fb21a347dc`

Tags:
- `decision-records`

Contract:
- 持久索引需使用当前 definition 与合法投影；缺失索引只能从合法 Markdown 全量重建，纯 parser 负责拒绝非法索引字段。

Proves:
- 旧 definition 的 check 失败并提示 sync-index，重建后为 definition 11；复制规则文件与 sourcePath 不一致产生对应结构诊断。
- 删除索引后全量同步逐字节还原规范索引，schemaVersion、metadata 与严格检查结果正确。
- 纯 parser 节点拒绝非法顶层/schema、createdAt、source fingerprint、标题/目的长度及 established alignment，不获取文件。
