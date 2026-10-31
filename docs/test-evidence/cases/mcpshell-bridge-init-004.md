### Case MCPSHELL-BRIDGE-INIT-004: initializer rejects non-exact ignore rules and line-breaking configuration

Tests:
- `test:3e24b849d867e52c714e38571f113f28ef67f7f05438248ab8ee7526f1a9ea0f`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 本机 env 只有在 skill 同目录存在精确 ignore rule 时才能写入，配置值不能用换行或 NUL 改写 dotenv 结构。

Proves:
- 带前导空格的 ignore rule 返回 `config_invalid`。
- 包含换行的 backend handle 返回 `config_invalid`，且不创建 `.env.mcpshell`。
