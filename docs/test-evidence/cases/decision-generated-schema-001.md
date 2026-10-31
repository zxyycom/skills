### Case DECISION-GENERATED-SCHEMA-001: 生成决策 Schema 与运行时索引 Schema 一致

Tests:
- `test:81dee7360836cfb49ad3fca65ffd2f0d7d2c353f3194152a91032debd5efc0c3`

Tags:
- `decision-records`

Contract:
- 分发的决策索引 JSON Schema 必须与维护源码中的运行时 Schema 保持完全一致。

Proves:
- 分发 Schema 与运行时 Schema 逐结构相同，并保留 schemaVersion 4、definitionVersion 11、状态的 name 和 alignment 字段约束。
- Ajv 以分发 Schema 接受包含 active/aligned 与 archived/unaligned 的当前 fixture index，拒绝两种生命周期的 alignment:null/缺失以及 name 缺失、空串或纯空白。
