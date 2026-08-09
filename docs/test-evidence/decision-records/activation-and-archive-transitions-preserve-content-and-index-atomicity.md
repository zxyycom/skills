### Case DECISION-ACTIVATION-ARCHIVE-001: 激活与归档保持内容和索引原子性
Entry:
- `tools/decision-records/tests/activation-archive.test.ts > activation and archive transitions preserve content and index atomicity`
- `bun test --test-name-pattern="^activation and archive transitions preserve content and index atomicity$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策激活和归档必须同步更新 Markdown 与索引状态，并在归档时保留最后对齐状态；候选来源关系触发的前序归档也进入同一事务边界。
Proves:
- 成功转换后文件与索引一致，aligned 记录归档后仍为 aligned，失败路径不会留下半完成状态。
- 普通 activate 建立带来源关系的候选时，会保存该关系并把其活动直接前序归档。
