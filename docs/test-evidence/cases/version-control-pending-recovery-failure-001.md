### Case VERSION-CONTROL-PENDING-RECOVERY-FAILURE-001: 以稳定公共语义报告 pending 恢复不完整

Tests:
- `test:129e1286378a66baa73be41c2a6fd3104b095227ff53b1b5c2b942007b8883c1`

Tags:
- `version-control`

Contract:
- pending 范围恢复无法完成或无法核对时必须停止，并与已完整恢复的普通替换失败明确区分；共享层不把范围外或上层 mutation outcome 写入错误。

Proves:
- 读回失败后恢复写入也失败时返回 `pending-recovery-failed`，并保留受控 recovery operation 与 path scope。
