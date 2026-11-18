### Case REPO-TASK-ROOT-SUBMODULE-001: 子模块任务根与中央索引

Tests:
- `test:e653b2188db63dcb710f6709fa0b1f3554c76d5a39505e8b8df3631302680b9d`

Tags:
- `repository-tooling`

Contract:
- 当前项目默认任务根是 Git 主工作区；linked worktree 共用中央索引，主工作区无索引时明确失败。

Proves:
- 真实普通仓和 absorbed submodule 的主工作区及各自 linked worktree 均返回预期主工作区。
- absorbed submodule 启用 sparse-checkout 后，确认配置迁入主工作区且 linked worktree 不含该值，两个 checkout 仍解析同一主工作区。
- 两种仓库的主工作区索引缺失时，即使 linked worktree 有索引仍拒绝使用其他根。
