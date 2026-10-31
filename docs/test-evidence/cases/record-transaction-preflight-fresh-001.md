### Case RECORD-TRANSACTION-PREFLIGHT-FRESH-001: 共同预检零锁且 unchanged 仍核对 fresh

Tests:
- `test:4a0b3f35fa66f2c173383e5703919306a19c871da1f799703c5b42f10404b971`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 预检不取独占写锁；执行包括 unchanged 仍独立 fresh。

Proves:
- 忙锁回调不得被预检调用，零写；fresh 后外部改动导致 unchanged 拒绝且保留后来字节。
