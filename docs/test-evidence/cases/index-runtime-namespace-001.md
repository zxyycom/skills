### Case INDEX-RUNTIME-NAMESPACE-001: 拒绝其他命名空间的持久化索引

Tests:
- `test:c385fe20515b378cea7f4cdc6ac884d5404375c0d4953dac050c605293164911`

Tags:
- `index-runtime`

Contract:
- 持久化索引只能由匹配其命名空间和定义版本的消费者加载。

Proves:
- 相同文本在匹配命名空间下可解析，在不同命名空间下返回诊断。
