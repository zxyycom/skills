### Case RECORD-TRANSACTION-PREFLIGHT-FRESH-001: 共同预检零锁且 unchanged 仍核对 fresh

Tests:
- `test:f09f1728b2c011b3769fd88c65b2a0fa22fb0cfb370ddd4dc53ea112d4a00d34`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 预检不取独占写锁；执行包括 unchanged 仍独立 fresh。

Proves:
- 忙锁回调不得被预检调用，零写；fresh 后外部改动导致 unchanged 拒绝且保留后来字节。
