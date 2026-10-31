### Case DECISION-TRANSACTION-INDEX-PREFLIGHT-001: 决策事务拒绝并发变化的索引

Tests:
- `test:9de306fb26883ed18e5173f80f05fe46a29a68cbdc998e520fe6f5ab501ab987`

Tags:
- `decision-records`

Contract:
- 事务预检拒绝验证后变化的索引，保留并发索引文本。

Proves:
- 在 scan 后改写 index，断言不写 Markdown 且 index 保持并发版本。
- 事务结果声明 `no-change`，表明预检失败前未进入写入阶段。
