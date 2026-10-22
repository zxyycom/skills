### Case GATE-ENVIRONMENT-CHECK-001: Gate 通过有界环境命令保护全部生产结果

Tests:
- `test:42afd55bfddd9b4ecaf64fc99f245fad0c409b63aaf7faf73e9d8e9233c235a1`
- `test:7476b63093067d6ee7e8d7b365d0ea0aabee53489ac19c3784cf925d8bec0032`

Tags:
- `repository-tooling`

Contract:
- Gate 环境入口通过原生命令执行 node scripts/environment.js gate，继承环境并保存 transcript；环境入口只检查必要工具版本而不要求 repository setup；每个其他生产 Check 显式依赖它，不能绕过失败环境。

Proves:
- 环境命令 argv、inherit 与 transcript 配置准确，timeout 为 30 秒且 output byte limit 为 1 MiB；完整 release Definition 中所有其他 Check 都包含环境前置。
- 精确工具版本在未配置 repository setup 或 CodeGraph index 的工作区通过；Bun 版本漂移退出 1 并明确报告实际和期望版本。
