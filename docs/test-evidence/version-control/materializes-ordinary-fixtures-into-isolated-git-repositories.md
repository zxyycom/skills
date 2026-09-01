### Case VERSION-CONTROL-GIT-FIXTURE-001: 普通 fixture 物化为隔离 Git 仓库

Entry:
- `tools/shared/tests/version-control.test.ts > materializes an ordinary fixture into isolated Git repositories`
- `bun test --test-name-pattern="^materializes an ordinary fixture into isolated Git repositories$" ./tools/shared/tests/version-control.test.ts`

Contract:
- Git 测试 fixture 只提交普通原始文件；启动 helper 必须复制原始树，在 case 私有目录初始化真实 `main` Git 仓库、固定本地配置与基线提交元数据并提交基线。

Proves:
- 原始 fixture 不含 `.git` 或 workspace 绝对路径，物化后的仓库使用 `main` 与 `core.autocrlf=false`，并具有相同基线 revision。
- 两次物化的可变 Git 状态相互隔离：暂存一份仓库的文件不会改变另一份工作区。
