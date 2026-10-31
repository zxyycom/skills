### Case GATE-DISTRIBUTION-DEPENDENCY-001: 公开分发 consumer 声明统一当前生成前置

Tests:
- `test:02055d79f6bcee7539c24ff4eff2d086a6112798761ed071aa0cf03286513dba`

Tags:
- `repository-tooling`

Contract:
- 公开分发语义 consumer 与 skill-updater package Check 依赖当前统一生成一致性 Check，provider 激活和失败结算由原生 dependsOn 负责，项目只声明前置。

Proves:
- 全部独立声明的 semantic prerequisites 在生产 Definition 中都精确投影为环境与期望生成前置；script:test:skill-updater 的前置精确为 gate-environment 与 script:check:skill-updaters。
