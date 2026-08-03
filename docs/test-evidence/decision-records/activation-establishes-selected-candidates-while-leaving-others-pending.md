### Case DECISION-CANDIDATE-ACTIVATION-SELECTION-001: 激活逐个建立选定候选并保留其余候选
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > activation establishes selected candidates while leaving others pending`
- `bun test --test-name-pattern="^activation establishes selected candidates while leaving others pending$" ./tools/decision-records/tests/run.ts`
Contract:
- 多个完整候选并存时，Activate 必须只建立显式目标，索引排除其余候选并继续报告严格检查阻断。
Proves:
- 第一次激活只索引目标并提醒剩余候选；list 只读索引且不扫描候选，sync-index 维护入口仍提醒剩余候选。
- 第二次激活后两个记录都进入索引，严格检查通过。
