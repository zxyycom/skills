### Case DECISION-ACTIVATION-ARCHIVE-001: 激活与归档保持内容和索引原子性
Entry:
- `tools/decision-records/tests/activation-archive.test.ts > activation and archive transitions preserve content and index atomicity`
- `bun test --test-name-pattern="^activation and archive transitions preserve content and index atomicity$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策激活和归档必须同步更新内容位置与索引状态。
Proves:
- 成功转换后文件与索引一致，失败路径不会留下半完成状态。
