### Case DECISION-TRANSACTION-INDEX-PREFLIGHT-001: 决策事务拒绝并发变化的索引

Tests:
- `test:09bd0ca865f55b3027a97809281a7842cd2e9ae0b09c9d5b8d6797dcd08ca83d`

Tags:
- `decision-records`

Contract:
- 事务预检拒绝验证后变化的索引，保留并发索引文本。

Proves:
- 在 scan 后改写 index，断言不写 Markdown 且 index 保持并发版本。
- 事务结果声明 `no-change`，表明预检失败前未进入写入阶段。
