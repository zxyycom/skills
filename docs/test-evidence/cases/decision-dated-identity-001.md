### Case DECISION-DATED-IDENTITY-001: 日期身份与同名创建

Tests:
- `test:31264316906f2dd22939b5f1f81b75fb4ad55c79f7ef3fe06d41dfcb134f5fbb`
- `test:e26441ff7a674e57f6a2b14862848559284a30a7cb1396c5a557b5cc21c0392e`

Tags:
- `decision-records`

Contract:
- 普通 selector 区分完整日期 ID 和名称；创建时日期必须匹配 UTC 形成日，不同日期的同名记录可共存。

Proves:
- 原生 selector 单元测试覆盖大小写不同的 Markdown 后缀、重复名称歧义及不存在的完整日期 ID 不回退。
- 原生创建操作固定 UTC 时间，拒绝日期不匹配的完整 ID 且目录及原候选字节不变；不同日期同名创建成功，旧候选字节保留。该节点不是 CLI 时钟注入测试。
