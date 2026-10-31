### Case INVESTIGATION-RENAME-CANDIDATE-001: candidate rename preflight 保持零写入

Tests:
- `test:7ca0488b532b534b78f5087237e8f5ef0c74ebede0421d33583595dda3a8b975`

Tags:
- `investigation-report`

Contract:
- candidate rename 使用 formedAt UTC 日期形成 target ID；preflight 使用同一计划但不写入 candidate。

Proves:
- preflight 后 candidate 原字节保持不变。
- 执行后 candidate locator 和 frontmatter ID 都迁移为 formedAt 同日的新 identity。
