### Case TEST-EVIDENCE-PROJECT-SOURCE-DRIFT-001: 项目生产器拒绝注册期间变更的源输入

Tests:
- `test:0c1fb0df0ce52758f84cabf5d26ef7351f66093ef6c6f1d4dc1ca61e2d882d45`

Tags:
- `repository-tooling`

Contract:
- 收集前后源指纹必须检测注册期间的源输入漂移。

Proves:
- fixture 顶层修改 scripts 输入后，生产器拒绝发布快照。
