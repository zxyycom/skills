### Case DECISION-CLI-RELATION-SELECTION-001: Relation 与 clear-relations 参数互斥

Tests:
- `test:977b013a2c390d50778a7f947694d9a2d207cf5b835b8303499dbf7908a8a2cf`

Tags:
- `decision-records`

Contract:
- 完整关系覆盖与显式空关系是互斥选择，同一命令不能同时使用 `--relation` 和 `--clear-relations`。

Proves:
- Activate 同时提供两个选项时退出 2，并报告 cannot be used with option。
