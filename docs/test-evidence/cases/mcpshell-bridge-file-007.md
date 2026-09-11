### Case MCPSHELL-BRIDGE-FILE-007: workspace get commits to its canonical staging parent after a lexical destination swap

Tests:
- `test:34bf8497256f504218218bd81dc527138ebed0f58780d2d4ca847b5a54c0f5ce`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- get 必须在 staging destination parent 的 realpath 验证后，用该 canonical physical parent 与 basename 创建 temporary 和最终 commit，不能在传输期间重新解析 lexical symlink parent。

Proves:
- fixture 在 remote 传输期间把 staging lexical destination symlink 换到外部目录；接收文件仍只落到原 canonical staging parent，外部目录没有文件。
