### Case TASK-GRAPH-SCHEMA-001: 未知字段和互斥状态组合都返回稳定的结构错误

Entry:
- `tools/task-graph/tests/schema-index.test.ts > strict schema rejects unknown fields, illegal state unions, and duplicate leases`
- `bun test --test-name-pattern="^strict schema rejects unknown fields, illegal state unions, and duplicate leases$" ./tools/task-graph/tests/run.ts`

Contract:
- 严格索引与 apply Schema 拒绝未知字段、不合法的 control 判别联合、保留字典 key，以及存量索引中的重复 running lease ID。

Proves:
- 未知字段、互斥状态组合、保留 reference key 和跨 task 重复 lease 都返回稳定结构或语义错误。
