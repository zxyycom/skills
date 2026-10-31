### Case GATE-GENERATION-PRECONDITION-001: 生成 provider 失败阻断分发 consumer

Tests:
- `test:3ebeebed809db41bf1915e8f94e8bc60ea0b462254b77d86556a0201d6d16749`

Tags:
- `repository-tooling`

Contract:
- 共同、TE/LJ 分发与 validator 的真实生成消费者只能在统一 provider passed 后执行。

Proves:
- provider failed 时对应 consumer 为 unavailable、duration=null，命令未进入 execution。
