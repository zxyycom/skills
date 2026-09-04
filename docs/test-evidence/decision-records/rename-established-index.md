### Case DECISION-RENAME-ESTABLISHED-001: 建立记录 rename 保留日期并重建索引

Entry:
- `tools/decision-records/tests/rename.test.ts > Decision rename keeps the established date, moves its source, and rebuilds the complete index`
- `bun test --test-name-pattern="^Decision rename keeps the established date, moves its source, and rebuilds the complete index$" ./tools/decision-records/tests/run.ts`

Contract:
- 已建立 legacy Decision rename 使用 `createdAt` 的 UTC 日期形成新 ID，并在同一事务移动 sourcePath 和重建完整索引。

Proves:
- rename 后新文件使用目标 name basename，旧 sourcePath 不再存在。
- 索引仅以新 ID 及新 sourcePath 投影该建立记录，严格检查通过。
