### Case ENV-LINKED-HASH-HOOK-001: linked worktree 的真实 hash hook 隔离 Git 环境

Tests:
- `test:8112af4769b8a9393fa3e397c495540ace5727b67aa607a2237d8c198630df4f`

Tags:
- `repository-tooling`

Contract:
- pre-commit 必须保留真实 `hash:skills` 门禁，同时避免 Git 注入的 repository-local 环境变量改变 hash 内部按目录执行的仓库发现。

Proves:
- 临时主仓库与 linked worktree 使用当前 pre-commit、release preparation、skill-package hash 源码及其 `tools/shared/src/node` 直接依赖，并以测试显式提供的固定 commit identity 执行一次真实 `git commit`，不依赖宿主全局 Git 配置。
- hook 清理 `GIT_DIR`、`GIT_INDEX_FILE` 等本地变量后，nested Git 重新发现 linked worktree 及其 index，hash 成功且 commit 完成。
