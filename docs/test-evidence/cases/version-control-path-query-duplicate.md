### Case VERSION-CONTROL-PATH-QUERY-DUPLICATE-001: 跨批合并保留批内重复

Tests:
- `test:65561ef74b1be87032b7b6fa66edced30ec61d989170ba1a0f4b76e1346af698`

Tags:
- `version-control`

Contract:
- Git 查询仅合并跨批完全相同的重叠记录，批内重复保留给各操作原有的解析与验证边界。

Proves:
- 后续批次的重复 NUL 记录仍保留重复信号，而正常跨批重叠记录只返回一次。
