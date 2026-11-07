### Case NATIVE-RECORD-GIT-PUBLISH-001: 真实 Git 选择性发布

Tests:
- `test:20ad9f1001408d13e8eb929189f5535672bd3c836d4b0162e88ad6020e39cf32`
- `test:93ac163e715cb209189e59376e4099ef2db76da0c97fc4fb104c1dca07920dcb`
- `test:a4990d60483af484e0ea3a2d71d720d053f31266164b2cb263a00e1098608081`
- `test:bc48ce19bfffdd269ff1d5dc0853c0ee7639432a496877ad324c7da1f5146ebe`

Tags:
- `record-rust`

Contract:
- Git 暂存须保留未选 pending 与工作树，并处理所选变更。

Proves:
- 真实 Git 验证选中条目的新增删除、未选 pending、mode 与链接。
