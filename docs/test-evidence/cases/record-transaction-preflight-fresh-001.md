### Case RECORD-TRANSACTION-PREFLIGHT-FRESH-001: 共同预检零锁且 unchanged 仍核对 fresh

Tests:
- `test:445f6f32453937cd7b3cceabea8a573d0af2a4af1f7c80e493fc701ebec9bdb6`
- `test:fa7432df11978a981230186b94750247c4093986ef6fed117ed1356599a2e902`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 预检不取独占写锁；执行包括 unchanged 仍独立 fresh。

Proves:
- 忙锁回调不得被预检调用，零写；fresh 后外部改动导致 unchanged 拒绝且保留后来字节。
