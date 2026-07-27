### Case DECISION-DOMAIN-CATALOG-STRUCTURE-001: 决策领域目录要求必需、有序且唯一的条目
Entry:
- `tools/decision-records/tests/decision-domain-catalog.test.ts > decision domain catalog enforces required sorted unique entries`
- `bun test --test-name-pattern="^decision domain catalog enforces required sorted unique entries$" ./tools/decision-records/tests/run.ts`
Contract:
- decision-domains.json 必须存在，领域 ID 按词法排序且唯一，描述保持单行。
Proves:
- 缺失目录表、逆序条目、重复 ID 与多行描述分别产生对应验证诊断。
