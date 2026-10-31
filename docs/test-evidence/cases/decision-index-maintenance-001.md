### Case DECISION-INDEX-MAINTENANCE-001: 索引规范重建与严格投影校验

Tests:
- `test:2cd5e80f4988ed7a41fcf6f5d2f818caf951444391e9ea45208874b7361b78fc`
- `test:52fcca11b6aa47380f44682858978e4093d304fc752a363fd2fbb2a14a71f11a`
- `test:b9cb8ab6461e8c5f00d670d56e4ff160239e4b2688ddfecc3c1b85bc8f102dff`

Tags:
- `decision-records`

Contract:
- 持久索引需使用当前 definition 与合法投影；缺失索引只能从合法 Markdown 全量重建，纯 parser 负责拒绝非法索引字段。

Proves:
- 旧 definition 的 check 失败并提示 sync-index，重建后为 definition 11；复制规则文件与 sourcePath 不一致产生对应结构诊断。
- 删除索引后全量同步逐字节还原规范索引，schemaVersion、metadata 与严格检查结果正确。
- 纯 parser 节点拒绝非法顶层/schema、createdAt、source fingerprint、标题/目的长度及 established alignment，不获取文件。
