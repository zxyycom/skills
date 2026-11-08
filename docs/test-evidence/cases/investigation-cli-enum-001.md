### Case INVESTIGATION-CLI-ENUM-001: 列表拒绝非法关系筛选枚举

Tests:
- `test:d330ff4c896bee34d730f18f090082dab989def46ddba030792d4310b042563b`

Tags:
- `investigation-report`

Contract:
- 列表拒绝未知关系类型与方向。

Proves:
- 真实 IR CLI list 的 direction=sideways 和 relation-type=unknown 均返回 invalid-arguments 且未创建集合。
