### Case DECISION-RELATION-FILTER-EVIDENCE-001: 关系筛选完整投影边并按预算展示

Tests:
- `test:aa3c19d12ddda4c83cbdd53bab59500e1deb098f63b80cc89cb55eae81cd0699`

Tags:
- `decision-records`

Contract:
- 带关系条件的 Decision `list` 为每条命中记录投影同次查询快照中的完整 `sourceId`、`type`、`target` 与可选 summary 边集合，并按规范顺序排列。
- CLI 默认只预览前三条匹配边并说明余量，`--detail` 展开当前页记录的全部匹配边。

Proves:
- 一个记录的四条同类型匹配边以规范顺序返回；紧凑输出显示前三条并报告 `+1`，不泄露第四条。
- `--detail` 显示第四条的完整摘要且不再报告余量。
