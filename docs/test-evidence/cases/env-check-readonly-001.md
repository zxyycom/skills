### Case ENV-CHECK-READONLY-001: 环境 check 只报告缺失的仓库配置

Tests:
- `test:db34e78be152a685a28c4b35387656de35c8708f0eb8dcc0c150b07fe80ede29`

Tags:
- `repository-tooling`

Contract:
- `environment.js check` 只诊断环境与仓库配置，不能借检查写入 Git config 或文件 mode。

Proves:
- 缺失仓库 setup 时检查失败，并给出运行 `environment.js setup` 的行动诊断。
- 检查前后的仓库 local config 和 pre-commit mode 完全相同。
