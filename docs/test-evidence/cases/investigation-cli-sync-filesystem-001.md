### Case INVESTIGATION-CLI-SYNC-FILESYSTEM-001: CLI sync-index renders filesystem diagnostics structurally

Tests:
- `test:17263c6340b557a84f05948026091e4ca816f47d65409946ad72650053b3d60e`

Tags:
- `investigation-report`

Contract:
- `sync-index` 必须消费 StateIndex filesystem diagnostic 的 causeCategory、operation、target 和受控 detail，不得回退为 generic/unknown 字符串。

Proves:
- 注入含 token、绝对路径和换行的 index EACCES read failure 后，CLI 返回退出码 1、stdout 为空；stderr 明确输出 `access-denied`、`read a state-index file`、`investigation-index.json` 和净化 detail，且不泄露 token 或绝对路径。
