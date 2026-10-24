### Case REPO-SHORT-CLI-001: 仓库短命令通过参数分隔启动所属 CLI

Tests:
- `test:5bf4726a85764f1b6d3d4c999709e59ccbc2ae6a230a6ddb608bfd6da83478bd`

Tags:
- `repository-tooling`

Contract:
- 仓库维护短命令通过 package script 的参数分隔与固定生成入口启动所属领域 CLI。

Proves:
- 真实 `bun run --silent change-plan -- --help` 成功退出，stdout 包含 Change Plan 独有的 `change-plan.ts check-all` 命令表面。
