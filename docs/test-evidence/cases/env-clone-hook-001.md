### Case ENV-CLONE-HOOK-001: 环境 setup 在新 clone 中启用仓库 Hooks

Tests:
- `test:0de6403468340f4d59bcd42954abc134613d8664ef82e6b99a9a2bffa3ab3cfd`

Tags:
- `repository-tooling`

Contract:
- 标准环境 setup 必须按当前平台建立 Git 可调用的 pre-commit 与 post-commit；即使 checkout 启用换行转换，两类 hook 也必须保持 LF。

Proves:
- setup 将 `core.hooksPath` 配置为 `.githooks`；POSIX 还会恢复当前两类 hook 的执行位。
- 以 `core.autocrlf=true` clone 后，受 `.gitattributes` 约束的两类 hook 都不含 CR 字符。
- 普通真实 `git commit` 会进入 fixture pre-commit 并被阻止；跳过该前置门禁的 commit 会继续调用 fixture post-commit。
