### Case DECISION-RENAME-ESTABLISHED-001: 建立记录 rename 保留日期并重建索引

Tests:
- `test:1e3a07c832554098be105599763555de6aa0920ae9c560912d9c2135ae46e0da`

Tags:
- `decision-records`

Contract:
- 已建立 legacy Decision rename 使用 `createdAt` 的 UTC 日期形成新 ID，并在同一事务移动 sourcePath 和重建完整索引。

Proves:
- rename 后新文件使用目标 name basename，旧 sourcePath 不再存在。
- 索引仅以新 ID 及新 sourcePath 投影该建立记录，严格检查通过。
