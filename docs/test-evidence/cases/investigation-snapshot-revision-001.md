### Case INVESTIGATION-SNAPSHOT-REVISION-001: list filters reports at an inclusive formedAt range

Tests:
- `test:8f7d4e88a44f15b8b43b3150b2746fd965c22ba80c1d50679402762dcf9fe1ad`
- `test:9e384b8c0a87b3e039b43a96a8b5b173bb1d056653e69f560eca9fc5aa497a96`

Tags:
- `investigation-report`

Contract:
- list 的形成时间筛选包含起止端点。

Proves:
- Decision 真实 CLI 的共享日期范围在起止时刻相同（且时区表示不同）时包含两个对应记录；IR 列表投影另有真实领域状态筛选节点。
- 两域 list 源码使用同一 ListDateRange::parse 与 contains；此组合不声称真实 IR CLI 已运行时间边界 fixture。
