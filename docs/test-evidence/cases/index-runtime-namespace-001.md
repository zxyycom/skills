### Case INDEX-RUNTIME-NAMESPACE-001: 拒绝其他命名空间的持久化索引

Tests:
- `test:dcf5861a7cdb45acecafc42991eed3cdb33d0c18a3117fb715a3a6df81364ef5`

Tags:
- `index-runtime`

Contract:
- 持久化索引只能由匹配其命名空间和定义版本的消费者加载。

Proves:
- 相同文本在匹配命名空间下可解析，在不同命名空间下返回诊断。
