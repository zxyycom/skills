### Case INDEX-RUNTIME-SOURCE-SNAPSHOT-001: 报告畸形源快照

Tests:
- `test:9fa369278473263e199327d2ded22c466fe0d7cf8576ea7fb82358ce6cbfff97`

Tags:
- `index-runtime`

Contract:
- 定义的读取器必须返回结构完整的源快照。

Proves:
- 返回空值的读取器使构建以错误结果结束。
