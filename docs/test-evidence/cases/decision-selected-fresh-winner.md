### Case DECISION-SELECTED-FRESH-WINNER-001: 局部同步保留后来的来源与索引winner

Tests:
- `test:e8beb0baf76588ea233565501e3c3d834691b328a64d67e34a347bd891ef3657`

Tags:
- `decision-records`

Contract:
- Decision selected sync 在原生fresh阶段独立重读所选来源和实际baseline，后来变化失败而不覆盖。

Proves:
- 准备后的source新字节导致同步拒绝且index不变。
- fresh前外部写入index后保留external winner，不发布准备的旧投影。
