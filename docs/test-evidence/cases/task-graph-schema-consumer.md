### Case TASK-GRAPH-SCHEMA-CONSUMER-001: 分发 schema 与运行约束一致

Tests:
- `test:ba3766a53d4edece7129ab3ed96198e00ec5ce7a6cdd7d5118af32f330e601a1`

Tags:
- `task-graph`

Contract:
- 分发 JSON Schema 与源码 schema 字节一致，标准 consumer 与运行时在可表达约束上保持一致。

Proves:
- 分发 schema 字节核对通过，Ajv 与运行时对代表性长度、格式及文本类型边界给出一致接受/拒绝。
