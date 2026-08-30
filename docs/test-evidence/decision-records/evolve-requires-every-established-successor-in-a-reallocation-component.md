### Case DECISION-REALLOCATION-CLOSURE-001: Evolve 要求重划分量的完整后继集合

Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve requires every established successor in a reallocation component`
- `bun test --test-name-pattern="^evolve requires every established successor in a reallocation component$" ./tools/decision-records/tests/run.ts`

Contract:
- 重划关系的建立或修订必须选择最终连通分量中的全部已建立后继。

Proves:
- 已建立第三个连通后继后，仅选择原来的两个后继时，evolve 报告遗漏的 Decision ID。
