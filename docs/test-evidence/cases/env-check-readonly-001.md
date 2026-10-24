### Case ENV-CHECK-READONLY-001: 环境 check 只报告缺失的仓库配置

Tests:
- `test:db34e78be152a685a28c4b35387656de35c8708f0eb8dcc0c150b07fe80ede29`

Tags:
- `repository-tooling`

Contract:
- `environment.js check` 只诊断环境与仓库配置，不能借检查写入 Git config 或文件 mode。

Proves:
- 缺 repository setup 的 check 失败并提示 setup；local config 与 pre-commit mode 完全不变。
- fake dispatcher 的独立命令日志不含 pnpm install、npm、corepack 或 go 调用，检查没有进入安装器。
