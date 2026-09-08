### Case DECISION-FIRST-ESTABLISHMENT-001: 首次建立创建根目录 Decision ID 与定义十一索引

Tests:
- `test:66d243c300a0246a0b24ab60b006e3fd5b67896a226468e81be219d935c31e08`

Tags:
- `decision-records`

Contract:
- 空 workspace 首次建立候选时必须在根目录创建活动 Decision ID，并生成 definition version 11 的 state-only ID 键索引。

Proves:
- 首次建立后记录位于根目录，索引使用当前定义版本、稳定 ID 键及显式 aligned state。
