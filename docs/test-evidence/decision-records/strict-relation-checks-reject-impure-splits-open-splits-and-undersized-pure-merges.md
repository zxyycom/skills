### Case DECISION-SPLIT-CLOSURE-001: 严格关系检查拒绝不闭合拓扑
Entry:
- `tools/decision-records/tests/evolution.test.ts > strict relation checks reject impure splits, open splits, and undersized pure merges`
- `bun test --test-name-pattern="^strict relation checks reject impure splits, open splits, and undersized pure merges$" ./tools/decision-records/tests/run.ts`
Contract:
- 已建立关系图中的纯归并必须至少有两个前序；拆分必须形成至少两个直接后继，且每个拆分后继只保存一条指向同一前序的拆分关系。
Proves:
- 只有一个前序的纯归并由严格检查报告数量不足。
- 只有一个直接后继的拆分和混合拆分与修订关系的后继分别由严格检查报告不闭合或不纯。
