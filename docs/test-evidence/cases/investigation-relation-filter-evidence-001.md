### Case INVESTIGATION-RELATION-FILTER-EVIDENCE-001: 关系筛选投影完整匹配边并按预算展示

Tests:
- `test:467ff7d14aa08339b107a496622a975ec786375a07e3b7935aee303d6ae72b35`
- `test:91c67475f7cc124d5affcb0205796b357c7153c94600d955289fafb1c12846f7`

Tags:
- `investigation-report`

Contract:
- 带关系条件的 Investigation 查询从同次 snapshot 投影让记录命中的完整 `sourceId`、`type`、`target` 与可选 summary 边；前驱边以 anchor 为 source，后继边以结果为 source，无关系条件时省略投影。
- type-only 匹配边按 UTF-16 的 `(sourceId, type, target)` 顺序投影；CLI 默认预览前三条并报告余量，`--detail` 展开全部匹配边。

Proves:
- 前驱和后继结果分别保留正确 source 方向、type、target 与可选摘要；无筛选结果不含 `filterRelations`，CLI 显示筛选依据。
- 四条 type-only 匹配边完整且有序；紧凑输出只显示前三条并报告 `+1`，detail 显示第四条。
