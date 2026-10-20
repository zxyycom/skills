### Case SKILL-PACKAGE-SYMLINK-001: 正式路径的符号链接封闭失败

Tests:
- `test:85424d8235bc6851f98b89052ce591a1be2fd4f6f2f15dabd2a8729cdfad6894`

Tags:
- `repository-tooling`

Contract:
- 正式 skill 制品只承接普通文件；不能把符号链接文本当作普通内容发布。

Proves:
- 真实 Git 暂存正式路径符号链接后，两种 pending 收集入口均在形成可打包快照前明确拒绝。
