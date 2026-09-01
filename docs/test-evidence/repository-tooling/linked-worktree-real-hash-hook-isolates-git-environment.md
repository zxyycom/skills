### Case ENV-LINKED-HASH-HOOK-001: linked worktree 的真实 hash hook 隔离 Git 环境
Entry:
- `scripts/environment.test.ts > real hash pre-commit succeeds in a linked worktree with isolated Git environment`
- `bun test --test-name-pattern="^real hash pre-commit succeeds in a linked worktree with isolated Git environment$" ./scripts/environment.test.ts`
Contract:
- pre-commit 必须保留真实 `hash:skills` 门禁，同时避免 Git 注入的 repository-local 环境变量改变 hash 内部按目录执行的仓库发现。
Proves:
- 临时主仓库与 linked worktree 使用当前 pre-commit、release preparation 与 skill-package hash 源码执行一次真实 `git commit`。
- hook 清理 `GIT_DIR`、`GIT_INDEX_FILE` 等本地变量后，nested Git 重新发现 linked worktree 及其 index，hash 成功且 commit 完成。
