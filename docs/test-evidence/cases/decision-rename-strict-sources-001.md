### Case DECISION-RENAME-STRICT-SOURCES-001: 真实改名保留全集正文门槛

Tests:
- `test:bb47ed93cfa829ba00e889b3b16e0a5fb933dda60e666e3bac9777eba9a752f8`

Tags:
- `decision-records`

Contract:
- 真实 rename 继续完整验证正式来源与历史，不借局部 no-op 放松其全集义务。

Proves:
- 无关正式正文非法时实际改名失败，目标来源和索引原字节保持。
