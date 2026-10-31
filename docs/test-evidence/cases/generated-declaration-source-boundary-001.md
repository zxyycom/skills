### Case GENERATED-DECLARATION-SOURCE-BOUNDARY-001: 声明依赖限定在所属源码树内

Tests:
- `test:ade9d352771a700c938070f3c5c37365499831124372842f3e160245039af886`

Tags:
- `repository-tooling`

Contract:
- 声明依赖的合法范围为维护源码入口所在目录及其子目录，越界依赖形成明确错误。

Proves:
- 对指向源码根之外的合法类型导出执行声明生成，观察到包含具体父级依赖的拒绝原因。
