### Case NATIVE-RUNTIME-ALIAS-001: 仓库运行时拒绝别名路径

Tests:
- `test:4b415030cf1c41b31bc4d5747de59f19eb6e27b6e8b121953d29b514b5074d0c`
- `test:ef3b73b5bbb4feab4cc6732e3ec926003e0d4c95608f4b580ca673ee7a080bc9`

Tags:
- `repository-tooling`

Contract:
- 本地 runtime 不能通过符号链接目录或 receipt 读取，也不能在检查本地父目录前跟随链接创建输出。

Proves:
- 私有 fixture 中符号链接 receipt、generation 或源码根被拒绝；符号链接 `.local` 不会导致外部子目录被创建。
- 本地父目录、工作区及源码祖先使用 Unix symlink 或 Windows junction 时被拒绝；Windows 独立 receipt/generation symlink fixture 仍跳过。
