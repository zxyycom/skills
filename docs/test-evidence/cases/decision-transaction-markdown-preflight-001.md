### Case DECISION-TRANSACTION-MARKDOWN-PREFLIGHT-001: 决策事务拒绝并发变化的 Markdown

Tests:
- `test:3b02fd8dd07b1f116d7867b5fea6bf003df6fd66959d9626e9a12d42d0507a93`

Tags:
- `decision-records`

Contract:
- 事务预检拒绝验证后变化的 Markdown，不覆盖并发内容或其他文件。

Proves:
- 在 scan 后修改源，断言错误和全部文件状态。
- 事务结果声明 `no-change`，表明预检失败前未进入写入阶段。
