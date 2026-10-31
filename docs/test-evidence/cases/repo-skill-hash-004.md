### Case REPO-SKILL-HASH-004: Aggregate hash retains raw package bytes

Tests:
- `test:5d9b4eb66b8d1348802fe85922f48b535af29be96e0f2d35400add5b001b9b16`

Tags:
- `repository-tooling`

Contract:
- 聚合 hash 是完整 skill 包原始字节的身份，不复用版本门禁对调试元数据和声明格式的例外。

Proves:
- source map 原始字节变化与纯格式的声明字节变化都会得到不同聚合 hash。
