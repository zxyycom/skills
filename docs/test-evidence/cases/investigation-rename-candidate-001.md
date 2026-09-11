### Case INVESTIGATION-RENAME-CANDIDATE-001: candidate rename preflight 保持零写入

Tests:
- `test:fcd2be825d51546d9cd128366b8034da1d1badbec0d0e3880eddfadcc12d118f`

Tags:
- `investigation-report`

Contract:
- candidate rename 使用 formedAt UTC 日期形成 target ID；preflight 使用同一计划但不写入 candidate。

Proves:
- preflight 后 candidate 原字节保持不变。
- 执行后 candidate locator 和 frontmatter ID 都迁移为 formedAt 同日的新 identity。
