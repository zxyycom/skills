### Case DECISION-REALLOCATION-CONNECTIVITY-001: 重划图拒绝不闭合的断连组件

Tests:
- `test:7b51c6051faa3cf1fc1d60e8b03cdc2957686f8099d43631b1ae0db5eacc288f`

Tags:
- `decision-records`

Contract:
- 重划事件由连通且满足多前序、多后继约束的组件构成。

Proves:
- 原生索引图测试将有效稀疏图改为互不相连的两条一对一边，验证拒绝该图；不声称已区分连通性与各组件规模不足的错误原因。
