### Case NATIVE-BUILD-FROZEN-INPUT-001: 构建前拒绝已变化的冻结源码

Tests:
- `test:2e3ceb5f351eced5a955eb3b8c49a07624d85b10c234d412a0b6034802d60eb1`

Tags:
- `repository-tooling`

Contract:
- 原生构建只消费与捕获清单一致的冻结源码；源码在构建前变化时不得执行 Cargo。

Proves:
- 私有 staging 修改源码后构建明确拒绝，且未创建 Cargo target 输出。
