### Case GATE-SCHEDULING-CRITICAL-RANK-001: critical-rank 按依赖关键路径重排 admission

Tests:
- `test:df4812772b4ad49bc3eeff3eb9af8c7007c6d928d8dee7e213374585962518ee`

Tags:
- `repository-tooling`

Contract:
- 已有全部 root executable Check 的历史时长时，按本 Check 时长加直接 successor 最大 rank 的降序稳定重排；提示不完整或存在环时保留声明顺序。

Proves:
- 短前置加长后继的 chain 排在独立长 Check 前，并列 Check 保持原顺序。
- 缺少提示和环不会让 wrapper 挂起或改变 Vibe 对 Definition 的验证责任。
