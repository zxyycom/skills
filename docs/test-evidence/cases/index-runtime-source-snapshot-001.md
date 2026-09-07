### Case INDEX-RUNTIME-SOURCE-SNAPSHOT-001: 报告畸形源快照

Tests:
- `test:9dc973ae30d7c33a3888450fcb58e2bed7c2a4514bf9ce65bd13b74485067e21`

Tags:
- `index-runtime`

Contract:
- 定义的读取器必须返回结构完整的源快照。

Proves:
- 返回空值的读取器使构建以错误结果结束。
