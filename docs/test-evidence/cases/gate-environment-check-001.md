### Case GATE-ENVIRONMENT-CHECK-001: Gate 通过有界环境命令保护全部生产结果

Tests:
- `test:42afd55bfddd9b4ecaf64fc99f245fad0c409b63aaf7faf73e9d8e9233c235a1`
- `test:7476b63093067d6ee7e8d7b365d0ea0aabee53489ac19c3784cf925d8bec0032`

Tags:
- `repository-tooling`

Contract:
- Gate 环境入口通过原生命令执行 node scripts/environment.js gate，继承环境并保存 transcript；环境入口只检查必要工具版本而不要求 repository setup；每个其他生产 Check 显式依赖它，不能绕过失败环境。

Proves:
- 环境命令 argv、inherit/transcript、30秒 timeout/1MiB output limit 精确；完整 Definition 的所有其它 Check 依赖环境。
- 精确版本在无 setup/CodeGraph index 的 fixture 通过，Bun mismatch 失败并报告实际/期望；独立 fake 工具日志没有 pnpm install、npm/corepack/go 安装器调用。
