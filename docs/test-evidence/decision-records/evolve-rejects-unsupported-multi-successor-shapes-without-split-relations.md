### Case DECISION-EVOLVE-UNSUPPORTED-MULTI-001: Evolve 拒绝未获策略支持的普通多后继形状
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects unsupported multi-successor shapes without split relations`
- `bun test --test-name-pattern="^evolve rejects unsupported multi-successor shapes without split relations$" ./tools/decision-records/tests/run.ts`
Contract:
- 当前只有闭合拆分策略允许多后继；空关系或普通非拆分关系不能组成未经定义的多后继事务。
Proves:
- 同时选择两个空关系候选时，evolve 在写入前报告多后继只受闭合拆分策略支持。
