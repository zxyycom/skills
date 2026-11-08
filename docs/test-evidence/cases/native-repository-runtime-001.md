### Case NATIVE-REPOSITORY-RUNTIME-001: 仓库运行时检查来源及二进制新鲜度

Tests:
- `test:45a5fd516ea1383db421f6f0268beac22ab3218968d722bbf040a47ace995dca`

Tags:
- `repository-tooling`

Contract:
- 显式检查必须只读核对准备来源与两个目标程序，来源漂移或二进制篡改不能报 ready。

Proves:
- 私有 fixture 的一致输入通过，源码修改和二进制篡改被拒绝。
