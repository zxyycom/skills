### Case GATE-ENVIRONMENT-CHECK-001: Gate 通过有界环境命令保护全部生产结果

Tests:
- `test:3804b050acba9d365fb880865affdd2abb321f045171f5680bf86a9f6a0c8683`
- `test:42afd55bfddd9b4ecaf64fc99f245fad0c409b63aaf7faf73e9d8e9233c235a1`

Tags:
- `repository-tooling`

Contract:
- Gate 环境入口通过原生命令执行 node scripts/environment.js gate，继承环境并保存 transcript；环境入口检查工具可运行性和仍受约束工具的必要版本，不要求 repository setup，也不限制 Bun 版本；每个其他生产 Check 显式依赖它，不能绕过失败环境。

Proves:
- 环境命令 argv、inherit/transcript、30秒 timeout/1MiB output limit 精确；完整 Definition 的所有其它 Check 依赖环境。
- 无 setup/CodeGraph index 的 fixture 可以用默认 Bun 和 Bun 1.4.4 通过；SCC 4.0.1 仍失败并报告期望 4.0.0，所有场景的独立 fake 工具日志没有 pnpm install、npm/corepack/go 安装器调用。
