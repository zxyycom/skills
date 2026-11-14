### Case GATE-NATIVE-PUBLISHER-INPUTS-001: 原生发布与冻结消费者输入使 receipt 失效

Tests:
- `test:1cbb681d71507a0d77599c96528b755fdea41d492afb7bcac3c7ee1303422466`

Tags:
- `repository-tooling`

Contract:
- 发布入口及冻结消费者实际依赖变化时，对应检查不能复用旧 receipt，未受影响的检查仍可复用。

Proves:
- 发布入口变化使 native runtime 检查执行；共享 fixture 或其构建配方依赖变化使 skill updater 检查执行，index runtime 保持复用。
