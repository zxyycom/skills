### Case DECISION-STAGE-PENDING-REFRESH-001: 连续暂存与重选刷新保留未选版本

Tests:
- `test:b4cc64824d0cde03748148e98c7778142cd2149b59ba9ff55c747cdefd55b8c9`

Tags:
- `decision-records`

Contract:
- stage all 从 pending 合成，选中即刷新，未选对象保留此前完整 pending 版本。

Proves:
- A 后 B 的连续暂存保留 A 第一版，重选 A 只刷新 A，B 保持旧暂存；重复选择相同版本零变化。
