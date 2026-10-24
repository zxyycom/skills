### Case GATE-GENERATION-PRECONDITION-001: 生成 provider 失败阻断分发 consumer

Tests:
- `test:e5853c511fdfe4be5c9982878b6de79ff94dc89ddbc6960bdb630bcf95672df7`

Tags:
- `repository-tooling`

Contract:
- 共同、TE/LJ 分发与 validator 的真实生成消费者只能在统一 provider passed 后执行。

Proves:
- provider failed 时对应 consumer 为 unavailable、duration=null，命令未进入 execution。
