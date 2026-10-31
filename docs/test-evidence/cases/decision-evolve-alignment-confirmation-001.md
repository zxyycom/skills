### Case DECISION-EVOLVE-ALIGNMENT-CONFIRMATION-001: Evolve 拒绝已建立后继的错误对齐确认

Tests:
- `test:11422e590a2d2633863a00bd43a4c613e9a2b3a507d37153d4c4da43130492cf`

Tags:
- `decision-records`

Contract:
- 选择已建立后继时，`--successor` 中的 alignment 只能确认记录现有对齐状态，不能借关系事务改写对齐。

Proves:
- 纯生命周期准备对与 established 记录现状不一致的 alignment 返回明确错误，且结果不含 changes。
