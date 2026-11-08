### Case DECISION-UNRECORDED-ARCHIVE-001: 归档尚未进入 Git HEAD 的决策前暂停并要求显式确认

Tests:
- `test:5b9b13e3d716d9150fc3b0c5921646adc10ffe2cc07559a7c2de35107c901c9d`

Tags:
- `decision-records`

Contract:
- Git 工作树尚无首次提交的 unborn HEAD 按空基线处理；单独 `archive` 已建立决策时，首次调用必须暂停且不写入，只有显式确认保留独立决策历史后才能归档。

Proves:
- 真实 unborn Git fixture 中，原生事务首次返回 `unrecorded-history` 与 `--keep-unrecorded-history` 恢复提示，报告未变更。
- 允许保留未记录历史后重试，来源移动至 archive；该节点不验证 CLI 或对齐字段。
