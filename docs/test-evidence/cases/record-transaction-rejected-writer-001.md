### Case RECORD-TRANSACTION-REJECTED-WRITER-001: 共同事务保留拒绝writer的实际索引发布

Tests:
- `test:bf5dae0465a9246a8dc130eaf5312a61e6ade291dc79a99f297a40f8681452c2`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- writer抛错不能证明未发布；实际新索引匹配时保留已知提交事实。

Proves:
- index writer实际写入后拒绝，结果committed且partial-or-unknown，不恢复已提交来源。
