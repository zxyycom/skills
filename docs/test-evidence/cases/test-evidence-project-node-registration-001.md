### Case TEST-EVIDENCE-PROJECT-NODE-REGISTRATION-001: 项目生产器通过 Bun 注册 Node 目标且保留 selector

Tests:
- `test:e20783e25a338d1dd6b83122e14b63c11ae17a4dadb9fd4b3ba87278309b9e02`

Tags:
- `repository-tooling`

Contract:
- Node 目标原生文件必须经 Bun 注册采集，而实体 selector 仍保持 node --test。

Proves:
- 隔离 fixture 生成一个含 direct 与 Node selector 的实体。
