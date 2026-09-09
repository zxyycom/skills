### Case AUTO-PUSH-THROTTLE-001: Main 自动推送按小时节流

Tests:
- `test:fa8a5825df205d4cac5abb7d6621832090c2364c5f9693f4792c0d6343512aa0`

Tags:
- `repository-tooling`

Contract:
- 当前分支为 `main` 且存在 `origin` 时，自动推送使用非强制 main refspec，并在同一 Git common dir 中把推送尝试限制为滚动一小时内至多一次。

Proves:
- 启用当前真实 post-commit 后，首次 commit 把当前本地 main 推送到隔离 bare remote，并写入共享节流状态。
- 小于一小时的第二次 commit 不更新 remote；将状态置于窗口外后，下一次 commit 会把累积的 main 提交推送出去。
