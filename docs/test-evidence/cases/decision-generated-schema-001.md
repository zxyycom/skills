### Case DECISION-GENERATED-SCHEMA-001: 决策索引 Schema 与原生 CLI 验收关键字段

Tests:
- `test:4d2e3199bed9cd8bfa4623a8b3c1e917c7481ca1f535ade9c271cdc2681670ac`
- `test:6fbc0939c89a2005c740acbe31c2db39e4f471d16564f534b9a22553d468b2de`

Tags:
- `decision-records`

Contract:
- 决策索引须携带非空 name 与明确 alignment；active/aligned 和 archived/unaligned 是合法状态。

Proves:
- Node AJV 测试直接加载 `tools/record-contracts/schemas/decision-index.schema.json`，接受两种有效状态，拒绝缺失或 null alignment、缺失或空 name。
- 真实原生 CLI 对同类有效输入成功；四种非法输入均以退出码 1 和 `invalid-index` 拒绝。
- 该证据不声明原生业务验证与 JSON Schema 对全部输入等价，也不验证纯空白 name。
