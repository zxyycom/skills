### Case DECISION-UNRECORDED-EVOLUTION-001: 未提交决策演进等待显式保留
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > unrecorded decision evolution pauses until history is explicitly preserved`
- `bun test --test-name-pattern="^unrecorded decision evolution pauses until history is explicitly preserved$" ./tools/decision-records/tests/run.ts`
Contract:
- 演进即将归档未进入 Git HEAD 的直接前序时必须先无写入暂停；只有调用者确认具有长期回放价值后，才能显式保留该历史。
Proves:
- 首次带关系激活返回可行动 warning，并逐字节保留候选、前序和索引。
- `--keep-unrecorded-history` 重试后保留中间记录和后继到中间记录的直接关系。
