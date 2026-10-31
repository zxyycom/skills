### Case INVESTIGATION-RELATION-TRANSACTION-IDEMPOTENCE-001: set-relations is idempotent and leaves unrelated report fields unchanged

Tests:
- `test:421d9a7f79e3b6b99b1f41cb32e255b2dcc8c85994f64bdc0c0f609db19b1dba`

Tags:
- `investigation-report`

Contract:
- 同一最终关系重复写入返回 unchanged，且不改写无关报告字段。

Proves:
- 第二次调用不改变报告字节，title 仍保留。
