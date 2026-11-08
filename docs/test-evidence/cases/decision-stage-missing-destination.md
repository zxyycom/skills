### Case DECISION-STAGE-MISSING-DESTINATION-001: 暂存不将缺失新位置冒充同步删除

Tests:
- `test:c1ed0c7ba2efd8b1517c3d2c6ac413d24d85a540b2a0880560d62923f51481c4`

Tags:
- `decision-records`

Contract:
- 发布投影仍指向所选 ID 时，缺失当前来源不得冒充已同步删除。

Proves:
- 已发布路径移动但新位置缺失时，all/domain 均失败且 pending 条目不变。
