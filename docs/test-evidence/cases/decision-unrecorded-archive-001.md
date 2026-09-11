### Case DECISION-UNRECORDED-ARCHIVE-001: 归档尚未进入 Git HEAD 的决策前暂停并要求显式确认

Tests:
- `test:7ee0a985a225d9374a5088d4ec5abe2af175dd6209d07f4f9cae1cdd42586d5c`

Tags:
- `decision-records`

Contract:
- Git 工作树尚无首次提交的 unborn HEAD 按空基线处理；单独 `archive` 已建立决策时，首次调用必须暂停且不写入，只有显式确认保留独立决策历史后才能归档。

Proves:
- unborn HEAD fixture 中，首次 `archive` 返回独立历史确认提示，决策 Markdown 与索引逐字节不变。
- 带 `--keep-unrecorded-history` 的重试将目标归档并保留其 `aligned` 对齐状态。
