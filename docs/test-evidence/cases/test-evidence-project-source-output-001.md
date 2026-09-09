### Case TEST-EVIDENCE-PROJECT-SOURCE-OUTPUT-001: 项目生产器从源输入排除请求的工作区快照输出

Tests:
- `test:b2fafe03b7a7d0770875411085f229bb73adcdfb4ad056f59ef3a7a9b5131068`

Tags:
- `repository-tooling`

Contract:
- 项目源指纹必须排除显式请求的工作区内快照输出；调用方已取得且通过项目、scope 与 revision 边界校验的 expected source 可以交给生产器复用，生产结束仍须独立重算以检测漂移。

Proves:
- 错误 scope 的 expected source 在扫描前被拒绝；写入入口复用预先取得的合法 expected source，输出后的快照 source revision 仍与独立重算的源 revision 相同。
