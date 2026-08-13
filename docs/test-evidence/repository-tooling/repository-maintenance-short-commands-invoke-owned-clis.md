### Case REPO-SHORT-CLI-001: 仓库维护短命令调用各自领域 CLI
Entry:
- `scripts/environment.test.ts > repository maintenance short commands invoke their owned skill CLIs`
- `bun test --test-name-pattern="^repository maintenance short commands invoke their owned skill CLIs$" ./scripts/environment.test.ts`
Contract:
- 维护 CLI 的类型化 package script 映射中的每个命令都必须能调用其领域入口，并以稳定能力标识确认没有路由到其他工具。
Proves:
- 映射中的每个 `bun run <command> -- --help` 均成功退出，并返回对应领域 CLI 的稳定能力标识；Change Plan 以 `check-all` 命令表面识别当前入口。
