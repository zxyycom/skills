### Case ENV-CLONE-HOOK-001: 环境 setup 在新 clone 中启用仓库 Hooks

Tests:
- `test:baef42808fb0f96878ced5185b89d6e1ed515d23781f611cd16912a026309fa9`

Tags:
- `repository-tooling`

Contract:
- 标准环境 setup 必须按当前平台建立 Git 可调用的 pre-commit 与 post-commit；即使 checkout 启用换行转换，两类 hook 也必须保持 LF。

Proves:
- setup 将 `core.hooksPath` 配置为 `.githooks`；POSIX 还会恢复当前两类 hook 的执行位。
- 以 `core.autocrlf=true` clone 后，受 `.gitattributes` 约束的两类 hook 都不含 CR 字符。
- 普通真实 `git commit` 会进入 fixture pre-commit 并被阻止；跳过该前置门禁的 commit 会继续调用 fixture post-commit。
