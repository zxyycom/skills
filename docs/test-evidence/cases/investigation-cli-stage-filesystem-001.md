### Case INVESTIGATION-CLI-STAGE-FILESYSTEM-001: CLI stage-index renders filesystem diagnostics structurally

Tests:
- `test:3d23aae6fd8e6183e3c6daa10124fa969f1dc94ede33974c3938fce494161e1a`

Tags:
- `investigation-report`

Contract:
- `stage-index` 必须消费没有 version-control 字段的 StateIndex filesystem diagnostic，输出稳定 reason、access-denied filesystem cause、operation、target 和受控 detail，而非压缩为普通错误字符串。

Proves:
- 注入含 token、绝对路径和换行的 index EACCES read failure 后，CLI 返回退出码 1、stdout 为空，stderr 保留 index-read-failed 的 access-denied、operation、target 和受控 detail，且不泄露 token 或绝对路径。
