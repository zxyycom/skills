### Case DECISION-SPLIT-CLOSURE-001: 严格关系检查拒绝开放拆分
Entry:
- `tools/decision-records/tests/relation-validation.test.ts > strict relation checks reject open splits`
- `bun test --test-name-pattern="^strict relation checks reject open splits$" ./tools/decision-records/tests/run.ts`
Contract:
- 已建立关系图中的拆分必须形成至少两个指向同一直接前序的后继。
Proves:
- 把既有单前序修订改成只有一个直接后继的拆分后，严格检查报告至少需要两个直接拆分后继。
