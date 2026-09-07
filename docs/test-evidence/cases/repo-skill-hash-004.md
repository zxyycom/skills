### Case REPO-SKILL-HASH-004: Aggregate hash retains raw package bytes

Tests:
- `test:9b329c60576ecb27beb5827490cb23da69e4bfbd38be95f58b8ad91a2452eb77`

Tags:
- `repository-tooling`

Contract:
- 聚合 hash 是完整 skill 包原始字节的身份，不复用版本门禁对调试元数据和声明格式的例外。

Proves:
- source map 原始字节变化与纯格式的声明字节变化都会得到不同聚合 hash。
