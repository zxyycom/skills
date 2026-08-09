### Case REPO-SHORT-CLI-001: 仓库维护短命令调用各自领域 CLI
Entry:
- `scripts/environment.test.ts > repository maintenance short commands invoke their owned skill CLIs`
- `bun test --test-name-pattern="^repository maintenance short commands invoke their owned skill CLIs$" ./scripts/environment.test.ts`
Contract:
- 本仓库为实际使用的稳定 skill 维护 CLI 提供 package 短入口，并保持领域实现仍由各自已有 CLI 承接。
Proves:
- 六个 `bun run <command> -- --help` 入口均成功退出，并返回对应 change、decision、investigation、task、test-evidence 或 skill-validator CLI 的身份输出。
