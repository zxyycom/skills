### Case DECISION-REALLOCATION-STATIC-MINIMUM-001: 严格关系检查拒绝规模不足的重划分量

Entry:
- `tools/decision-records/tests/relation-validation.test.ts > strict relation checks reject undersized reallocation components`
- `bun test --test-name-pattern="^strict relation checks reject undersized reallocation components$" ./tools/decision-records/tests/run.ts`

Contract:
- 已建立关系图中的每个重划分量都至少有两个直接前序和两个直接后继。

Proves:
- 单条已建立重划边使严格检查报告后继数量不足。
