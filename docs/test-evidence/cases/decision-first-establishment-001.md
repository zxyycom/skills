### Case DECISION-FIRST-ESTABLISHMENT-001: 首次建立创建根目录 Decision ID 与定义十索引

Tests:
- `test:a265dcbe0bbcea11582eb859ad7d24a62a71da3532574e20d405460eafd4b485`

Tags:
- `decision-records`

Contract:
- 空 workspace 首次建立候选时必须在根目录创建活动 Decision ID，并生成 definition version 10 的 state-only ID 键索引。

Proves:
- 首次建立后记录位于根目录，索引使用当前定义版本及稳定 ID 键。
