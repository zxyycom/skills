### Case TEST-EVIDENCE-PROJECT-NODE-REGISTRATION-001: 项目生产器通过 Bun 注册 Node 目标且保留 selector

Tests:
- `test:a15a34e8f30bb8e55377a33bc62d129c2915ea53ea8a25af6f29acc61cf0336e`

Tags:
- `repository-tooling`

Contract:
- Node 目标原生文件必须经 Bun 注册采集，而实体 selector 仍保持 node --test。

Proves:
- 隔离 fixture 生成一个含 direct 与 Node selector 的实体。
