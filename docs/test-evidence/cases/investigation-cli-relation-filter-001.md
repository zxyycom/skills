### Case INVESTIGATION-CLI-RELATION-FILTER-001: 关系筛选单值选项拒绝重复

Tests:
- `test:d330ff4c896bee34d730f18f090082dab989def46ddba030792d4310b042563b`

Tags:
- `investigation-report`

Contract:
- list/search 的关系筛选单值参数不可重复。

Proves:
- 真实 IR CLI 的 list 重复 related-to 或 relation-type、search 重复 direction 均返回 invalid-arguments 且未创建集合。
