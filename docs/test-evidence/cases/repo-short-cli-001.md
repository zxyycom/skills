### Case REPO-SHORT-CLI-001: 仓库短命令通过参数分隔启动所属 CLI

Tests:
- `test:84d609cda9c16ba1e5da385aa84071d5591349c43a5ecca940786b701779b389`

Tags:
- `repository-tooling`

Contract:
- 仓库维护短命令通过 package script 的参数分隔与固定生成入口启动所属领域 CLI。

Proves:
- 真实 `bun run --silent change-plan -- --help` 成功退出，stdout 包含 Change Plan 独有的 `change-plan.ts check-all` 命令表面。
