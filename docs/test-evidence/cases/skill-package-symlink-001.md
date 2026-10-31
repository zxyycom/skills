### Case SKILL-PACKAGE-SYMLINK-001: 正式路径的符号链接封闭失败

Tests:
- `test:8f4c2a82f5ce09ac1d6ce3587bd49457f736ffe0875343e9ca35129b8107e2ca`

Tags:
- `repository-tooling`

Contract:
- 正式 skill 制品只承接普通文件；不能把符号链接文本当作普通内容发布。

Proves:
- 真实 Git 暂存正式路径符号链接后，两种 pending 收集入口均在形成可打包快照前明确拒绝。
