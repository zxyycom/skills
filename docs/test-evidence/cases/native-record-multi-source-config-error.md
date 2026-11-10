### Case NATIVE-RECORD-MULTI-SOURCE-CONFIG-ERROR-001: 非法或显式缺失配置不回退

Tests:
- `test:960ce86d086bb5d037af6139b4ab6517d48b2a19aaa311195ffb2dce32020cf8`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 默认配置已存在但非法、显式配置缺失、显式 key 无配置或未知 key 时，调查查询必须明确失败，不能静默回退单源。

Proves:
- 存在可成功的合法单源索引时，非法 JSON 仍退出 1 并返回 config-error；缺失显式文件、无默认配置的显式 key 和未知 key 同样被拒绝。来源设置规则矩阵由配置 API 的独立 Case 承接。
