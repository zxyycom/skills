### Case DECISION-STATIC-MERGE-MINIMUM-001: 严格关系检查拒绝前序不足的纯归并
Entry:
- `tools/decision-records/tests/relation-validation.test.ts > strict relation checks reject undersized pure merges`
- `bun test --test-name-pattern="^strict relation checks reject undersized pure merges$" ./tools/decision-records/tests/run.ts`
Contract:
- 已建立关系图中的纯归并关系集必须至少包含两个直接前序。
Proves:
- 把既有单前序修订改成单前序归并后，严格检查报告 pure 归并 relation set 数量不足。
