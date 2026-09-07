### Case DECISION-TRANSACTION-MARKDOWN-PREFLIGHT-001: 决策事务拒绝并发变化的 Markdown

Tests:
- `test:f2fcb44c538f9163ecfc9fb69021c8ff59406117f81d0c8492a9df1429ccaba3`

Tags:
- `decision-records`

Contract:
- 事务预检拒绝验证后变化的 Markdown，不覆盖并发内容或其他文件。

Proves:
- 在 scan 后修改源，断言错误和全部文件状态。
- 事务结果声明 `no-change`，表明预检失败前未进入写入阶段。
