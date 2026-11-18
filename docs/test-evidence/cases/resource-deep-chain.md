### Case RESOURCE-DEEP-CHAIN-001: 长版本链的有界查询

Tests:
- `test:d9c84f01ef763b3e10ba2a86363a099d704de44dfe025f41dc9055ea9579fa3f`

Tags:
- `resource-records`

Contract:
- 合法深层版本沿革可校验，trace 受节点和深度限制。

Proves:
- 真实进程同步一万版本的合法链后，返回有界一边、两节点与截断标记，而非栈溢出。
