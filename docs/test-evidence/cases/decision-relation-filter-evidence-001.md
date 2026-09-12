### Case DECISION-RELATION-FILTER-EVIDENCE-001: 关系筛选完整投影边并按预算展示

Tests:
- `test:66a6fb23912b72338a83ce1ed678c8340e033eb7d2cfc8a4b450fbafc6c42714`

Tags:
- `decision-records`

Contract:
- 带关系条件的 Decision `list` 为每条命中记录投影同次查询快照中的完整 `sourceId`、`type`、`target` 与可选 summary 边集合，并按规范顺序排列。
- CLI 默认只预览前三条匹配边并说明余量，`--detail` 展开当前页记录的全部匹配边。

Proves:
- 一个记录的四条同类型匹配边以规范顺序返回；紧凑输出显示前三条并报告 `+1`，不泄露第四条。
- `--detail` 显示第四条的完整摘要且不再报告余量。
