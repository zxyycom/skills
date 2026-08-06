### Case DECISION-SPLIT-CLOSURE-001: 拆分拒绝不完整后继集合与关系图
Entry:
- `tools/decision-records/tests/evolution.test.ts > split rejects incomplete successor sets and relationship graphs`
- `bun test --test-name-pattern="^split rejects incomplete successor sets and relationship graphs$" ./tools/decision-records/tests/run.ts`
Contract:
- 一个决策拆分必须形成至少两个直接后继；单个后继不能冒充闭合的一对多演进，也不能留下孤立的 `拆分` 关系边。
Proves:
- 只提供一个 `--successor` 时命令失败，并逐字节保留前序、候选和索引。
- 权威 Markdown 只包含一条指向某前序的 `拆分` 边时，严格集合校验报告后继数量不足。
