### Case ENV-CLONE-HOOK-001: 环境 setup 在新 clone 中启用 pre-commit
Entry:
- `scripts/environment.test.ts > environment setup enables the pre-commit hook in a fresh clone`
- `bun test --test-name-pattern="^environment setup enables the pre-commit hook in a fresh clone$" ./scripts/environment.test.ts`
Contract:
- 标准环境 setup 必须按当前平台建立 Git 可调用的 pre-commit；即使 checkout 启用换行转换，hook 也必须保持 LF。
Proves:
- setup 将 `core.hooksPath` 配置为 `.githooks`；POSIX 还会恢复当前 pre-commit 的执行位。
- 以 `core.autocrlf=true` clone 后，受 `.gitattributes` 约束的 hook 不含 CR 字符。
- 随后的真实 `git commit` 会进入 fixture hook 并被该 hook 阻止。
