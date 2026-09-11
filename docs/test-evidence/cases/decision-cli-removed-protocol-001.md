### Case DECISION-CLI-REMOVED-PROTOCOL-001: CLI 拒绝移除的领域和路径查询协议

Tests:
- `test:15766480365566de8b36183c9e2f0ad2bf084c15eedd5ca4d7c9fee15822324d`

Tags:
- `decision-records`

Contract:
- 当前 CLI 不公开 `domains`、`--domain`、路径式 record ID 或 tag OR/NOT 选择器。

Proves:
- 帮助不含领域协议，五种已移除调用均以参数错误码 `2` 退出、不写 stdout，并在 stderr 报告多余位置参数、未知选项或无效 Decision ID。
