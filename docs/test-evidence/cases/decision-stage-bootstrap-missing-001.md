### Case DECISION-STAGE-BOOTSTRAP-MISSING-001: 无 revision 的 Stage 拒绝不存在 ID

Tests:
- `test:aad4af5de2fdc7b37fea5e911cd2fe4302a1639b9723ca69b27857da831b6ed4`

Tags:
- `decision-records`

Contract:
- 没有 HEAD 时选择缺失 ID 不得写入 pending。

Proves:
- 真实 unborn Git 的工作区索引含两个已发布对象时，all scope 选择缺失 name 返回失败且 pending 条目不变。
