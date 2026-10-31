### Case REPO-SHORT-CLI-001: 仓库短命令通过参数分隔启动所属 CLI

Tests:
- `test:11f2cc9c85ec84c65b0bdb8d03173cb2268202cbf6243f984512d877ff13ebe4`

Tags:
- `repository-tooling`

Contract:
- 仓库维护短命令通过 package script 的参数分隔与固定生成入口启动所属领域 CLI。

Proves:
- 真实 `bun run --silent change-plan -- --help` 成功退出，stdout 包含 Change Plan 独有的 `change-plan.ts check-all` 命令表面。
