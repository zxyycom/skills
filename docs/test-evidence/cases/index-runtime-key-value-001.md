### Case INDEX-RUNTIME-KEY-VALUE-001: 拒绝声明文本查询 source 的非法值

Tests:
- `test:577ab4e40012cf5b0697bc5cce3e3927e3add7e23f6ce7a34a4b567a2f1bcbcc`

Tags:
- `index-runtime`

Contract:
- 声明为文本的查询 source 只能提取合法文本值；非法值须返回带定位的诊断。

Proves:
- boolean 文本 source 被拒绝，诊断包含 entry ID、字段与 source；该节点不声明其它 source 容器/时间/path 的完整矩阵。
