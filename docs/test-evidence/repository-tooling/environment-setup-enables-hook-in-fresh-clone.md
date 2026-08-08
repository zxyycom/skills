### Case ENV-CLONE-HOOK-001: 环境 setup 在新 clone 中启用 pre-commit
Entry:
- `scripts/environment.test.ts > environment setup enables the pre-commit hook in a fresh clone`
- `bun test --test-name-pattern="^environment setup enables the pre-commit hook in a fresh clone$" ./scripts/environment.test.ts`
Contract:
- 标准环境 setup 必须让新 clone 的当前 worktree 直接具备可执行且由 Git 使用的 pre-commit hook。
Proves:
- setup 将 `core.hooksPath` 配置为 `.githooks`，并把当前 pre-commit 设为可执行。
- 随后的真实 `git commit` 会进入 fixture hook 并被该 hook 阻止。
