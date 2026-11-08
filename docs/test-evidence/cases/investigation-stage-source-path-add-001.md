### Case INVESTIGATION-STAGE-SOURCE-PATH-ADD-001: 按索引位置暂存新增报告并按 ID 收集资源

Tests:
- `test:254b741c592ab9047df47c96fd959aa77a863b700412e6daa10a4207f380befd`

Tags:
- `investigation-report`

Contract:
- domain scope 从工作区索引的 sourcePath 定位新增报告，按完整 ID 包含其受管 owner 资源。

Proves:
- 真实 Git 中语义路径的新增报告与所选 owner 资源进入 pending；索引 pending 不变、未选报告 pending 保留。
