### Case DECISION-CLI-EVOLVE-RELATION-GROUPS-001: Evolve 在写入前拒绝不完整或混用的关系分组

Tests:
- `test:a0afbe1d4e683619ea665f1f4dd78d0b94ea229be8d1810ea5b9e922fb75f51e`
- `test:bf1b5166177bf9babf6fd696fedbb503a8063ad7b3fdf62741ff258a2c6cffdf`

Tags:
- `decision-records`

Contract:
- `evolve` 的逐 successor 关系分组必须以 `--relations-for` 开始，且每组只能声明一个完整 replacement 或显式清空。

Proves:
- 首组之前的关系选项、空组、clear 与 relation 混用、原始重复 source 及组内重复 target 均以参数错误退出，且不产生标准输出。
