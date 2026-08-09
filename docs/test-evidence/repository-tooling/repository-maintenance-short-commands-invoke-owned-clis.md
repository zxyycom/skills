### Case REPO-SHORT-CLI-001: 仓库维护短命令调用各自领域 CLI
Entry:
- `scripts/environment.test.ts > repository maintenance short commands invoke their owned skill CLIs`
- `bun test --test-name-pattern="^repository maintenance short commands invoke their owned skill CLIs$" ./scripts/environment.test.ts`
Contract:
- 维护 CLI 的类型化 package script 映射中的每个命令都必须能调用其领域入口。
Proves:
- 映射中的每个 `bun run <command> -- --help` 均成功退出，并返回对应领域 CLI 的身份输出。
