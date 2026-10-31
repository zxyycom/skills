### Case TASK-GRAPH-SCHEMA-001: 未知字段和互斥状态组合都返回稳定的结构错误

Tests:
- `test:9573b8474c0d312e034e2951ad8fe7e41d52a2b3ab2ec12a1dd95a27782bf15e`

Tags:
- `task-graph`

Contract:
- 严格索引与 apply Schema 拒绝未知字段、不合法的 control 判别联合、保留字典 key，以及存量索引中的重复 running lease ID。

Proves:
- 未知 root/request 字段、非法 control 联合、重复 running lease 与保留 references key 均被各自 schema 入口拒绝。
