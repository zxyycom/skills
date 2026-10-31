### Case DECISION-EVOLVE-ARCHIVED-SUCCESSOR-001: Evolve 修订关系时保持已归档后继的生命周期

Tests:
- `test:847896497b3082af711dfd594084d50f8fbe240261390b7ee1e7646649e3b597`

Tags:
- `decision-records`

Contract:
- 拥有非空 alignment 的已归档后继可以通过 evolve 修订完整关系，但不能因此重新激活或改变原 alignment 和 createdAt。

Proves:
- 关系替换后目标记录仍为 archived，alignment 与 createdAt 保持事务前值。
- 目标记录保存新的完整修订关系集合。
