### Case DECISION-STAGE-PENDING-ONLY-001: Stage 清理可定位旧路径并拒绝失定位 pending 身份

Tests:
- `test:dfa4633a9388fab03b05034a132f552c282fe6c36ad322e3fc6ceebb7d3f11e0`

Tags:
- `decision-records`

Contract:
- stage 只从 H/W/P 索引与所选 canonical basename 定位旧来源，不扫描无关 pending blob 恢复任意路径身份。

Proves:
- domain 暂存新增后改名会清理 canonical 旧路径；任意 basename 的 pending-only 来源在 W 删除且三方索引都无定位后，所选 ID 明确失败且 pending tree 不变。
- 恢复可信 pending 索引 locator 后，同一 ID 的 domain 清理成功移除旧 pending 路径。
