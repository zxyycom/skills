### Case VERSION-CONTROL-PATH-QUERY-FAILURE-001: 任一 Git 批次失败拒绝整体结果

Tests:
- `test:2375f7a98f1b249dcd7dffaaef1f6ea47173b20aee7f62c14772c6c04d78317f`

Tags:
- `version-control`

Contract:
- 分批 Git 查询仅在全部批次成功后返回完整结果，任一批失败即终止当前查询。

Proves:
- 第一批返回记录、第二批抛错时，调用整体 reject 并停止后续批次。
