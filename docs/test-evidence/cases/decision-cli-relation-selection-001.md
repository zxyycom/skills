### Case DECISION-CLI-RELATION-SELECTION-001: Relation 与 clear-relations 参数互斥

Tests:
- `test:40f877b3b5f4d9c7e7f7148f87df39d6243cf09bd882919ae86b7697d873dcea`

Tags:
- `decision-records`

Contract:
- 完整关系覆盖与显式空关系是互斥选择，同一命令不能同时使用 `--relation` 和 `--clear-relations`。

Proves:
- Activate 同时提供两个选项时退出 2，并报告 cannot be used with option。
