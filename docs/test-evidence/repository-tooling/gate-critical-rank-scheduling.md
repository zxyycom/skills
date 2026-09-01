### Case GATE-SCHEDULING-CRITICAL-RANK-001: critical-rank 按依赖关键路径重排 admission

Entry:
- `scripts/vibe-check.test.ts > critical-rank scheduling follows the dependency critical path and preserves incomplete-hint order`
- `bun test --test-name-pattern="^critical-rank scheduling follows the dependency critical path and preserves incomplete-hint order$" ./scripts/vibe-check.test.ts`

Contract:
- 已有全部 root executable Check 的历史时长时，按本 Check 时长加直接 successor 最大 rank 的降序稳定重排；提示不完整或存在环时保留声明顺序。

Proves:
- 短前置加长后继的 chain 排在独立长 Check 前，并列 Check 保持原顺序。
- 缺少提示和环不会让 wrapper 挂起或改变 Vibe 对 Definition 的验证责任。
