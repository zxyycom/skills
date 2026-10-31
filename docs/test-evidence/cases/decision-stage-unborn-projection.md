### Case DECISION-STAGE-UNBORN-PROJECTION-001: unborn集合只暂存明确所选投影

Tests:
- `test:882ac7cfe3274c35cfdc37a4d80813bb788a941864284e4bd2b23a5a00fa5c63`

Tags:
- `decision-records`

Contract:
- HEAD 与 pending 无索引时，以工作区 metadata 建空基底，只接纳明确选中对象。

Proves:
- unborn Git 中选择 A 暂存只生成含 A 的 pending 索引和正文，未选 B 不进入 pending。
