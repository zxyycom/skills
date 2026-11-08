### Case INVESTIGATION-LIST-RELATION-ERRORS-001: 列表拒绝缺失关系目标

Tests:
- `test:8f7d4e88a44f15b8b43b3150b2746fd965c22ba80c1d50679402762dcf9fe1ad`

Tags:
- `investigation-report`

Contract:
- 列表关系 selector 找不到目标时不能退化为无关系筛选的成功结果。

Proves:
- 调查列表投影在有效快照与 tag 条件下设置不存在的 related-to 时返回错误。
