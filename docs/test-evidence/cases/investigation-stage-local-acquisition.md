### Case INVESTIGATION-STAGE-LOCAL-ACQUISITION-001: 局部暂存不验证无关原文

Tests:
- `test:00be29eed594a01aca8446e7af2a4f7efe96c889f1c2062bbcf14623410e623f`

Tags:
- `investigation-report`

Contract:
- 普通已定位 all/domain stage 仅获取预先选中及必要依赖来源；index stage 只处理发布 metadata。

Proves:
- 无关坏正文和删除不阻断 all/domain；所选报告准备与复核各读一次、索引各一次，index 零正文且 pending 未改变。
