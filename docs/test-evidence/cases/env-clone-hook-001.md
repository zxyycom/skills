### Case ENV-CLONE-HOOK-001: 环境 setup 在新 clone 中启用 pre-commit

Tests:
- `test:f20a8a8c5788cef841f80ba36c6a9bce5e62dde20d438514266736b4165e9da1`

Tags:
- `repository-tooling`

Contract:
- 标准环境 setup 必须按当前平台建立 Git 可调用的 pre-commit；即使 checkout 启用换行转换，hook 也必须保持 LF。

Proves:
- setup 将 `core.hooksPath` 配置为 `.githooks`；POSIX 还会恢复当前 pre-commit 的执行位。
- 以 `core.autocrlf=true` clone 后，受 `.gitattributes` 约束的 hook 不含 CR 字符。
- 随后的真实 `git commit` 会进入 fixture hook 并被该 hook 阻止。
