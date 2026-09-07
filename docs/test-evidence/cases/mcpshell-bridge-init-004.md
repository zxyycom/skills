### Case MCPSHELL-BRIDGE-INIT-004: initializer rejects non-exact ignore rules and line-breaking configuration

Tests:
- `test:1cb8b71f7368f82eea626a09b61905178d30df10b438c3f73444e6c8b04932ad`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 本机 env 只有在 skill 同目录存在精确 ignore rule 时才能写入，配置值不能用换行或 NUL 改写 dotenv 结构。

Proves:
- 带前导空格的 ignore rule 返回 `config_invalid`。
- 包含换行的 backend handle 返回 `config_invalid`，且不创建 `.env.mcpshell`。
