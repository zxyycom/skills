### Case GATE-ENVIRONMENT-CHECK-001: Gate 以基础环境 Check 阻断工具漂移

Tests:
- `test:342c7f87fab37831df86f7c2ee0e2a79e10e73cb4f684899d85399e741435bca`
- `test:7476b63093067d6ee7e8d7b365d0ea0aabee53489ac19c3784cf925d8bec0032`

Tags:
- `repository-tooling`

Contract:
- Gate 基础环境 Check 只验证实际执行权威门禁所需的工具版本，不要求完整开发环境状态；它必须每次执行，其他 Check 都依赖它，基础工具漂移必须保留可行动诊断并阻止依赖 Check 启动。

Proves:
- 精确工具版本可在尚未配置 repository setup 或 CodeGraph index 的工作区通过 Gate 环境检查，较新 Bun 漂移会明确报告期望版本。
- `gate-environment` 失败时只启动复用自举 `gate` action 的环境命令，所选业务 Check 由 Vibe 结算为依赖不可用而不执行。
