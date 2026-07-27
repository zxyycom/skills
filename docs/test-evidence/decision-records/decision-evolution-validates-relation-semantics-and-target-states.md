### Case DECISION-EVOLUTION-RELATIONS-001: 决策演进验证关系与目标状态
Entry:
- `tools/decision-records/tests/evolution.test.ts > decision evolution validates relation semantics and target states`
- `bun test --test-name-pattern="^decision evolution validates relation semantics and target states$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策演进关系必须指向存在且已归档的直接前序，并禁止环、自指和重复目标。
Proves:
- 活动或候选目标、缺失目标、循环、自指和重复关系均被拒绝。
- 关系激活失败时目标记录和索引保持不变。
