### Case DECISION-UNRECORDED-ARCHIVED-PREDECESSOR-001: 关系事务确认尚未进入 Git HEAD 的归档直接前序

Tests:
- `test:b02b07778a74f51ad07027efc87e865536dcc642cbb1d96fcd30d45ab0ea5a9b`

Tags:
- `decision-records`

Contract:
- 建立后继时，尚未进入 Git HEAD 的 archived 直接前序需要显式历史确认。

Proves:
- 真实 CLI 在 unborn Git 中首次 publish 拒绝并保留候选、归档前序及索引字节；加确认后成功，前序字节不变且索引后继关系指向该前序。
