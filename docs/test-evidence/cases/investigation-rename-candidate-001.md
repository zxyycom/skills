### Case INVESTIGATION-RENAME-CANDIDATE-001: candidate rename preflight 保持零写入

Tests:
- `test:6210e68f91196f2912718473c861836bc4fd4601aa85d0e7f6ff7102870aadbb`

Tags:
- `investigation-report`

Contract:
- candidate rename 使用 formedAt UTC 日期形成 target ID；preflight 使用同一计划但不写入 candidate。

Proves:
- preflight 后 candidate 原字节保持不变。
- 执行后 candidate locator 和 frontmatter ID 都迁移为 formedAt 同日的新 identity。
