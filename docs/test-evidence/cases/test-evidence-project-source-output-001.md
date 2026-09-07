### Case TEST-EVIDENCE-PROJECT-SOURCE-OUTPUT-001: 项目生产器从源输入排除请求的工作区快照输出

Tests:
- `test:b2fafe03b7a7d0770875411085f229bb73adcdfb4ad056f59ef3a7a9b5131068`

Tags:
- `repository-tooling`

Contract:
- 项目源指纹必须排除显式请求的工作区内快照输出。

Proves:
- 写入输出后的快照 source revision 与独立重算的源 revision 相同。
