### Case DECISION-EVOLVE-HISTORICAL-SUCCESSOR-001: Evolve 在非法归档来源前零写入失败

Tests:
- `test:97cc32c2fdcf71e1ed2b4203301cca119b169272d59b600db9aadf3a7235e5a0`

Tags:
- `decision-records`

Contract:
- 生命周期 mutation 必须在写入前拒绝 alignment 为 null 或缺失的 archived 来源，不输出成功 relationReview，并给出可信历史恢复与同步路径。

Proves:
- 两种非法 archived 来源均使 evolve 失败、stdout 为空且不含 relationReview，并报告 lifecycle preflight、alignment 与恢复步骤。
- 失败后归档 Markdown 和持久索引字节均不变。
