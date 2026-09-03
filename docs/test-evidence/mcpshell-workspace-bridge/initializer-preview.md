### Case MCPSHELL-BRIDGE-INIT-001: initializer previews without writing machine configuration

Entry:
- `tools/mcpshell-workspace-bridge/tests/initializer.test.ts > initializer previews without writing machine configuration`
- `bun test --test-name-pattern="^initializer previews without writing machine configuration$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- initializer 默认 preview 只报告稳定的 agent-project-relative resource labels，不能写入本机 env 或 MCP 配置，也不得在结果中泄漏绝对路径或配置值。

Proves:
- 预览返回 config、env 与 definitions 的相对 labels，结果不含 fixture 的 agent/project absolute root，并保持 `.env.mcpshell` 不存在。
