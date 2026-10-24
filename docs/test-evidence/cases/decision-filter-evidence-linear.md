### Case DECISION-FILTER-EVIDENCE-LINEAR-001: 关系证据保留首摘要去重与稳定目标顺序

Tests:
- `test:a88ac358d554b94c6d0fe046b14d262ddbcf5e8c3cef9902f97a9c7bd2d03421`

Tags:
- `decision-records`

Contract:
- type-only 筛选对关系 tuple 去重，保留首摘要、稳定目标顺序及独立输出，不改输入记录。

Proves:
- 分别含 3 条和 10 条反序边及重复 tuple 的两组输入返回完整按目标排序证据与对应摘要；重复调用的证据数组不同，无关系条件不增加输入 filterRelations。
