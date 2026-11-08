### Case NATIVE-RUNTIME-GATE-INPUT-001: 原生准备与构建输入驱动相关检查

Tests:
- `test:dbdb5802a5c44cdd0dcb23e35885a817cb5e49ea6d09b7f58f63d5e39ce1cbf6`

Tags:
- `repository-tooling`

Contract:
- 仓库原生 runtime 和冻结构建工具发生变化时，消费这些输入的交付和包快照测试必须重新执行。

Proves:
- 私有 Git fixture 分别修改 runtime 与构建源码后，Rust 交付、runtime 及 skill package hash 检查均激活，没有未分类路径。
