### Case TASK-GRAPH-SCHEMA-CONSUMER-001: 分发 schema 与运行约束一致

Tests:
- `test:71b0ee584a573c08d32d17eecb0234fb3e7d87f26c280fc1c63fbb45c434ebc4`

Tags:
- `task-graph`

Contract:
- 分发 JSON Schema 与源码 schema 字节一致，标准 consumer 与运行时在可表达约束上保持一致。

Proves:
- 分发 schema 字节核对通过，Ajv 与运行时对代表性长度、格式及文本类型边界给出一致接受/拒绝。
