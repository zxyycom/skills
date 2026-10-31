### Case DECISION-EVOLVE-DUPLICATE-RELATION-TARGET-001: Evolve CLI 拒绝重复关系覆盖目标

Tests:
- `test:64290b7bbf28bf8315b51eae578d5b28b786378e575afe11d940f0395919e11a`

Tags:
- `decision-records`

Contract:
- 完整关系覆盖中，同一直接前序目标只能出现一次，即使调用方为它声明不同关系类型也不能重复。

Proves:
- 两个 `--relation` 使用不同类型但指向同一路径时，源码 CLI 入口在参数解析期退出 `2` 并报告重复直接前序目标。
