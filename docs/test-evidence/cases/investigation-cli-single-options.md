### Case INVESTIGATION-CLI-SINGLE-OPTIONS-001: 重复单值 CLI 选项不创建集合文件

Tests:
- `test:262ac584eb3d99b3d145a56692e06a25ad3d12619a9e50f7066ffa6b28fb888a`

Tags:
- `investigation-report`

Contract:
- 重复单值选项作为 usage 错误拒绝，不能创建候选或集合文件。

Proves:
- 各重复单值选项返回 usage 失败，fixture 下没有创建 collection/candidate 文件。
