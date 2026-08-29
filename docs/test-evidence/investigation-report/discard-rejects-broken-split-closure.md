### Case INVESTIGATION-DISCARD-SPLIT-001: discard rejects a removal that breaks split relation closure

Entry:
- `tools/investigation-report/tests/discard.test.ts > discard rejects a removal that breaks split relation closure`
- `bun test --test-name-pattern="^discard rejects a removal that breaks split relation closure$" ./tools/investigation-report/tests/run.ts`

Contract:
- `discard` 必须预演最终关系图，不能删除会破坏拆分后继闭合的报告。

Proves:
- 删除会使前序只剩一个拆分后继时失败，目标报告保留。
