### Case DECISION-SPLIT-OMISSION-001: Evolve 在写入前拒绝遗漏既有拆分后继
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects a split extension that omits an existing successor before writing`
- `bun test --test-name-pattern="^evolve rejects a split extension that omits an existing successor before writing$" ./tools/decision-records/tests/run.ts`
Contract:
- 拆分事务的显式 successor 集合必须等于事务后的全部直接拆分后继，不能遗漏任一既有成员。
Proves:
- 省略一个既有后继时，诊断指出选择集合不完整并列出被遗漏路径。
- 拒绝路径保留新增候选原文和完整 decision-index.json，不产生部分扩充。
