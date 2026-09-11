### Case TASK-GRAPH-SCHEMA-001: 未知字段和互斥状态组合都返回稳定的结构错误

Tests:
- `test:acbd5bf575edb77443722c6a931db68bb78e9be939b0c20e76947a40d4995c54`

Tags:
- `task-graph`

Contract:
- 严格索引与 apply Schema 拒绝未知字段、不合法的 control 判别联合、保留字典 key，以及存量索引中的重复 running lease ID。

Proves:
- 未知字段、互斥状态组合、保留 reference key 和跨 task 重复 lease 都返回稳定结构或语义错误。
- TaskGraphError detail 中的 boolean 保持原始 boolean，并可被 JSON 序列化而不变成字符串。
