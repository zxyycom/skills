### Case DECISION-RELATION-GRAPH-ORDERING-001: 共享边排序按 UTF-16 代码单元排序且不改变输入

Entry:

- `tools/shared/tests/relation-graph.test.ts > relation edge sorting uses UTF-16 code units without mutating inputs`
- `bun test --test-name-pattern="^relation edge sorting uses UTF-16 code units without mutating inputs$" ./tools/shared/tests/relation-graph.test.ts`

Contract:

- 需要规范边顺序的调用方显式使用共享排序能力，排序不得依赖 locale 或修改输入集合。

Proves:

- source、type 与 target 的大小写及连字符组合按 UTF-16 代码单元稳定排序。
- 输入数组中的边顺序保持不变。
