### Case DECISION-CLI-EVOLVE-RELATION-GROUPS-001: Evolve 在写入前拒绝不完整或混用的关系分组

Tests:
- `test:1da6056637ae606c119a8d762b9d5ab72d58105342440a2298c70ce33161ad9a`
- `test:bb887beba6fb5eeaf43c0eb591879f6714f232968f9e166c044182026b84a0a7`

Tags:
- `decision-records`

Contract:
- `evolve` 的逐 successor 关系分组必须以 `--source` 开始，且每组只能声明一个完整 replacement 或显式清空。

Proves:
- 首组之前的关系选项、空组、clear 与 relation 混用、原始重复 source 及组内重复 target 均以参数错误退出，且不产生标准输出。
