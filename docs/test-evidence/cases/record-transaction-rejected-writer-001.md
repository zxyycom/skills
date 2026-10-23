### Case RECORD-TRANSACTION-REJECTED-WRITER-001: 共同事务保留拒绝writer的实际索引发布

Tests:
- `test:818e4d8b644ea23810d5e515c7727795e7709159857d3cacdad69315d06b9d70`
- `test:bb76d1bab5689bd7cc19b621af1787ec646e5483eac572cc29b05744155e83c4`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- writer抛错不能证明未发布；实际新索引匹配时保留已知提交事实。

Proves:
- index writer实际写入后拒绝，结果committed且partial-or-unknown，不恢复已提交来源。
