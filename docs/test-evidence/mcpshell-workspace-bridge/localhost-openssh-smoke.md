### Case MCPSHELL-BRIDGE-INTEGRATION-002: MCPShell calls all four generated operations over localhost OpenSSH into an isolated target workspace

Entry:
- `tools/mcpshell-workspace-bridge/tests/localhost-ssh-integration.test.ts > localhost OpenSSH runs all generated workspace operations against isolated roots`
- `MCPSHELL_BIN=<mcpshell-binary> MCPSHELL_LOCALHOST_SSH_SMOKE=1 bun test --test-name-pattern="^localhost OpenSSH runs all generated workspace operations against isolated roots$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- 此组合 E2E 在 `MCPSHELL_BIN=<mcpshell-binary>` 与 `MCPSHELL_LOCALHOST_SSH_SMOKE=1` 同时提供时运行。既有 MCPShell 通过 stdio 从分发 tools YAML 发起四次固定根 `tools/call`，经分发 bridge runtime 和真实 loopback OpenSSH client/server，从隔离 agent project 操作另一隔离 target project root，并以隔离 staging root 交换文件。测试凭据、host key、known_hosts、sshd 配置和高端口均位于临时目录。

Proves:
- MCPShell binary 先通过 `--version` 与 `validate --tools`，再完成 stdio `initialize` / `initialized`，并以四次 `tools/call` 调用 `workspace_shell`、`workspace_apply_patch`、`workspace_put_file`、`workspace_get_file`。
- `workspace_shell` 返回 target project root，`workspace_apply_patch` 在该 root 更新 tracked 文件。
- `workspace_put_file` 和 `workspace_get_file` 通过真实 SSH stdin/stdout 传输包含 NUL 与 `0xff` 的文件；两个端点的字节、SHA-256 与 operation evidence 一致。
- 两个显式条件共同形成 opt-in；任一条件缺失时入口跳过。该 case 的覆盖边界是本机回环组合 E2E；跨机 SSH 由正式多端测试验证。
