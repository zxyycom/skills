### Case INDEX-RUNTIME-NAMESPACE-001: 拒绝其他命名空间的持久化索引

Tests:
- `test:9bdd6c3fe3ed791e11fab37212b8a40ee0461a6fbd6351e3009fc1fd24ec97c2`

Tags:
- `index-runtime`

Contract:
- 持久化索引只能由匹配其命名空间和定义版本的消费者加载。

Proves:
- 相同文本在匹配命名空间下可解析，在不同命名空间下返回诊断。
