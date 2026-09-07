### Case TEST-EVIDENCE-PROJECT-SOURCE-DRIFT-001: 项目生产器拒绝注册期间变更的源输入

Tests:
- `test:590ebf794891616da8b185b0d8f09534b2d761f85c0ae84ddf3bf0f3d8f21cb2`

Tags:
- `repository-tooling`

Contract:
- 收集前后源指纹必须检测注册期间的源输入漂移。

Proves:
- fixture 顶层修改 scripts 输入后，生产器拒绝发布快照。
