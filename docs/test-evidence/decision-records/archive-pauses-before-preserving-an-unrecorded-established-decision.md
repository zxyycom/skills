### Case DECISION-UNRECORDED-ARCHIVE-001: 归档未提交决策前暂停并要求显式保留
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > archive pauses before preserving an unrecorded established decision`
- `bun test --test-name-pattern="^archive pauses before preserving an unrecorded established decision$" ./tools/decision-records/tests/run.ts`
Contract:
- Archive 不得静默保留尚未进入 Git HEAD 的已建立记录；首次调用必须无写入暂停，显式确认后才能归档。
Proves:
- 首次 archive 返回预警且决策 Markdown 与索引逐字节不变。
- 带 `--keep-unrecorded-history` 的重试不再依赖 Git 基线读取，并把目标归档且保留 aligned 对齐状态。
