### Case DECISION-PUBLISHED-INDEX-FAIL-CLOSED-001: 发布索引异常与非法领域图保持失败

Tests:
- `test:db7075c04af1e9c9f1f5840eaf1e931b739b919e57df84c29bd6b5086459b757`

Tags:
- `decision-records`

Contract:
- 纯索引查询完整验证发布索引的结构、definition 与领域关系；索引异常返回失败。

Proves:
- JSON 损坏、definition 不兼容、合法结构但缺失关系 target 与索引缺失分别使 list、trace、metadata search 失败，无来源降级或合法空成功。
