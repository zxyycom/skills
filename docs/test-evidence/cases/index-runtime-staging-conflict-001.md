### Case INDEX-RUNTIME-STAGING-CONFLICT-001: 无变化选择仍拒绝同索引既有 Pending

Tests:
- `test:5ac34c183136f030be12a19550a1f99c628cb8b50f5a7589f239e3b16456fbbe`

Tags:
- `index-runtime`

Contract:
- 即使目标条目与 revision 没有实际差异，选择性暂存仍必须在锁内确认目标索引 pending 干净，不能提前报告成功。

Proves:
- 同索引已有 pending 内容时返回 `pending-conflict` 和该索引 scope 的 `no-change`，既有目标内容不被覆盖。
- 冲突保留 pending 验证 operation 与 `unknown` 原因，不猜测具体竞争来源，要求重新读取 current revision 与目标 pending 后重试。
- 目标外 pending、工作区索引和领域文件不受失败影响。
