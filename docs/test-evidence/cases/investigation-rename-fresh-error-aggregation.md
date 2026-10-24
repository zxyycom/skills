### Case INVESTIGATION-RENAME-FRESH-AGGREGATION-001: 共同安全验收保留更名有序错误聚合

Tests:
- `test:c0af09f80a17555e4b60f6c62bace9eaae1f51a4102f1ff44a455eedad302081`

Tags:
- `investigation-report`
- `record-operations`

Contract:
- IR rename 的来源、目标和索引 fresh 失败按原领域顺序汇集；共同安全 phase 不把单文件错误聚合退化成首个失败，也不覆盖外部变更。

Proves:
- beforePublish 注入来源字节变化、另一来源 symlink、目标占用与索引变化后，零事务写入失败同时包含两份来源、目标、索引的有序诊断；外部目标与索引编辑保持。
