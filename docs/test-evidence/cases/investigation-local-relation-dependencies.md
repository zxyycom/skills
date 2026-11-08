### Case INVESTIGATION-LOCAL-RELATION-DEPENDENCIES-001: 关系准备保留未选来源修订

Tests:
- `test:613021a8a7a61804b915021fdd2031f9810aeb11ec799b0c99449c15cb65c631`

Tags:
- `investigation-report`

Contract:
- 选中来源的关系替换以发布索引承接未选依赖，不更改其来源修订。

Proves:
- 单份选中来源可准备指向未选索引条目的关系；所选索引投影更新而未选来源 revision 保持，capture plan 本身不写正文或索引。
